import {
  doc,
  collection,
  setDoc,
  updateDoc,
  addDoc,
  onSnapshot,
  runTransaction,
  serverTimestamp,
  type DocumentReference,
} from 'firebase/firestore';
import { getDb } from './firebase';
import { uploadMedia, pickRecorderMimeType, baseMime } from './media';
import type { CallDoc, CallStatus, CallType, PersonRef } from '../types';

export type CallPhase = 'outgoing' | 'incoming' | 'connecting' | 'connected' | 'reconnecting' | 'ended';

export interface CallView {
  callId: string | null;
  role: 'caller' | 'callee';
  type: CallType;
  partner: PersonRef;
  phase: CallPhase;
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
  muted: boolean;
  cameraOff: boolean;
  facingMode: 'user' | 'environment';
  connectedAt: number | null;
  endReason: string | null;
  partnerMuted: boolean;
  partnerCameraOff: boolean;
  partnerRecording: boolean;
  recording: boolean;
  savingRecording: boolean;
  relayed: boolean;
  videoUnavailable: boolean;
}

const RING_TIMEOUT_MS = 45_000;
const CONNECT_TIMEOUT_MS = 30_000;
const DISCONNECT_GRACE_MS = 15_000;

const AUDIO_CONSTRAINTS: MediaTrackConstraints = {
  echoCancellation: true,
  noiseSuppression: true,
  autoGainControl: true,
};

const END_REASONS: Record<string, string> = {
  declined: 'Call declined',
  busy: 'is on another call',
  missed: 'No answer',
  cancelled: 'Call cancelled',
  failed: 'Call failed',
  ended: 'Call ended',
};

function friendlyMediaError(err: unknown, type: CallType): Error {
  const name = (err as DOMException)?.name;
  const device = type === 'video' ? 'camera and microphone' : 'microphone';
  if (name === 'NotAllowedError' || name === 'SecurityError') {
    return new Error(`Permission to use your ${device} was denied. Allow access in your browser settings and try again.`);
  }
  if (name === 'NotFoundError' || name === 'OverconstrainedError') return new Error(`No ${device} was found on this device.`);
  if (name === 'NotReadableError') return new Error(`Your ${device} is being used by another app.`);
  return new Error((err as Error)?.message || `Could not access your ${device}.`);
}

async function acquireMedia(type: CallType, facingMode: 'user' | 'environment') {
  if (!navigator.mediaDevices?.getUserMedia) {
    throw new Error('Calls need a secure (https) connection and a browser with camera/microphone support.');
  }
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: AUDIO_CONSTRAINTS,
      video: type === 'video' ? { facingMode, width: { ideal: 1280 }, height: { ideal: 720 } } : false,
    });
    return { stream, videoUnavailable: false };
  } catch (err) {
    if (type === 'video') {
      // No camera / camera blocked: continue as audio so the call still works.
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: AUDIO_CONSTRAINTS });
        return { stream, videoUnavailable: true };
      } catch {
        /* fall through to the original error */
      }
    }
    throw friendlyMediaError(err, type);
  }
}

export class CallSession {
  private view: CallView;
  private listeners = new Set<(v: CallView) => void>();
  private pc: RTCPeerConnection | null = null;
  private callRef: DocumentReference | null = null;
  private unsubs: Array<() => void> = [];
  private timers = new Map<string, number>();
  private pendingRemote: RTCIceCandidateInit[] = [];
  private pendingLocal: RTCIceCandidateInit[] = [];
  private callDocReady = false;
  private answerApplied = false;
  private finished = false;
  private endingLocally = false;
  private offer: RTCSessionDescriptionInit | null = null;
  private recorder: MediaRecorder | null = null;
  private recorderChunks: Blob[] = [];
  private recorderAudio: AudioContext | null = null;

  private constructor(
    private me: PersonRef,
    partner: PersonRef,
    type: CallType,
    role: 'caller' | 'callee',
    private iceServers: RTCIceServer[]
  ) {
    this.view = {
      callId: null,
      role,
      type,
      partner,
      phase: role === 'caller' ? 'outgoing' : 'incoming',
      localStream: null,
      remoteStream: null,
      muted: false,
      cameraOff: false,
      facingMode: 'user',
      connectedAt: null,
      endReason: null,
      partnerMuted: false,
      partnerCameraOff: false,
      partnerRecording: false,
      recording: false,
      savingRecording: false,
      relayed: false,
      videoUnavailable: false,
    };
  }

  // ---------- public API ----------

  static placeCall(me: PersonRef, partner: PersonRef, type: CallType, iceServers: RTCIceServer[]): CallSession {
    const session = new CallSession(me, partner, type, 'caller', iceServers);
    void session.startOutgoing();
    return session;
  }

  static fromIncoming(me: PersonRef, call: CallDoc, iceServers: RTCIceServer[]): CallSession {
    const partner: PersonRef = { uid: call.callerId, ...call.caller };
    const session = new CallSession(me, partner, call.type, 'callee', iceServers);
    session.callRef = doc(getDb(), 'calls', call.id);
    session.offer = call.offer ?? null;
    session.patch({ callId: call.id });
    session.watchCallDoc();
    return session;
  }

  get state(): CallView {
    return this.view;
  }

  subscribe(listener: (v: CallView) => void): () => void {
    this.listeners.add(listener);
    listener(this.view);
    return () => this.listeners.delete(listener);
  }

  get isActive() {
    return this.view.phase !== 'ended';
  }

  async accept() {
    if (this.view.role !== 'callee' || this.view.phase !== 'incoming' || !this.callRef || !this.offer) return;
    this.patch({ phase: 'connecting' });
    try {
      const { stream, videoUnavailable } = await acquireMedia(this.view.type, this.view.facingMode);
      if (this.finished) return stream.getTracks().forEach((t) => t.stop());
      this.patch({ localStream: stream, videoUnavailable, cameraOff: videoUnavailable });

      // Make sure the caller hasn't hung up while we were asking for permissions.
      const stillRinging = await runTransaction(getDb(), async (tx) => {
        const snap = await tx.get(this.callRef!);
        return snap.exists() && snap.data().status === 'ringing';
      });
      if (!stillRinging) return this.finish('Call ended before it was answered');

      const pc = this.createPeer(stream);
      this.callDocReady = true;
      await pc.setRemoteDescription(this.offer);
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      await updateDoc(this.callRef, {
        answer: { type: answer.type, sdp: answer.sdp },
        status: 'accepted',
        answeredAt: serverTimestamp(),
        [`media.${this.me.uid}`]: { muted: false, cameraOff: videoUnavailable },
      });
      this.answerApplied = true;
      this.listenForCandidates('callerCandidates');
      this.startTimer('connect', CONNECT_TIMEOUT_MS, () => this.failConnect());
      this.flushRemoteCandidates();
    } catch (err) {
      void this.writeStatus('failed');
      this.finish((err as Error).message);
    }
  }

  decline() {
    if (this.view.phase !== 'incoming') return;
    void this.writeStatus('declined');
    this.finish('Call declined');
  }

  /** Marks an incoming call as busy without ringing (already on another call). */
  static async rejectBusy(callId: string) {
    try {
      await updateDoc(doc(getDb(), 'calls', callId), { status: 'busy', endedAt: serverTimestamp() });
    } catch {
      /* ignore */
    }
  }

  static async markMissed(callId: string) {
    try {
      await updateDoc(doc(getDb(), 'calls', callId), { status: 'missed', endedAt: serverTimestamp() });
    } catch {
      /* ignore */
    }
  }

  async hangup() {
    if (this.finished) return;
    if (this.view.recording) await this.stopRecording();
    const { phase, role } = this.view;
    const status: CallStatus = phase === 'outgoing' && role === 'caller' ? 'cancelled' : phase === 'incoming' ? 'declined' : 'ended';
    // Don't wait for the server: the local write is applied immediately and syncs when possible.
    void this.writeStatus(status);
    this.finish(status === 'cancelled' ? 'Call cancelled' : 'Call ended');
  }

  toggleMute() {
    const muted = !this.view.muted;
    this.view.localStream?.getAudioTracks().forEach((t) => (t.enabled = !muted));
    this.patch({ muted });
    void this.publishMediaState();
  }

  toggleCamera() {
    if (this.view.type !== 'video' || this.view.videoUnavailable) return;
    const cameraOff = !this.view.cameraOff;
    this.view.localStream?.getVideoTracks().forEach((t) => (t.enabled = !cameraOff));
    this.patch({ cameraOff });
    void this.publishMediaState();
  }

  async switchCamera() {
    const stream = this.view.localStream;
    if (this.view.type !== 'video' || !stream || this.view.videoUnavailable) return;
    const next = this.view.facingMode === 'user' ? 'environment' : 'user';
    const old = stream.getVideoTracks()[0];
    // Many phones cannot open two cameras at once, so release the current one first.
    old?.stop();
    let track: MediaStreamTrack | undefined;
    try {
      const fresh = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { exact: next } } });
      track = fresh.getVideoTracks()[0];
    } catch {
      const fallback = await navigator.mediaDevices.getUserMedia({ video: { facingMode: this.view.facingMode } });
      track = fallback.getVideoTracks()[0];
    }
    if (!track) return;
    track.enabled = !this.view.cameraOff;
    const sender = this.pc?.getSenders().find((s) => s.track?.kind === 'video');
    await sender?.replaceTrack(track);
    const updated = new MediaStream([...stream.getAudioTracks(), track]);
    this.patch({ localStream: updated, facingMode: track.getSettings().facingMode === 'environment' ? 'environment' : next });
  }

  async startRecording() {
    const remote = this.view.remoteStream;
    const local = this.view.localStream;
    if (this.view.recording || !remote || typeof MediaRecorder === 'undefined') return;
    try {
      const ac = new AudioContext();
      const dest = ac.createMediaStreamDestination();
      for (const s of [local, remote]) {
        const tracks = s?.getAudioTracks() || [];
        if (tracks.length) ac.createMediaStreamSource(new MediaStream(tracks)).connect(dest);
      }
      const tracks = [...dest.stream.getAudioTracks()];
      const remoteVideo = this.view.type === 'video' ? remote.getVideoTracks()[0] : undefined;
      if (remoteVideo) tracks.push(remoteVideo);
      const mimeType = pickRecorderMimeType(remoteVideo ? 'video' : 'audio');
      const recorder = new MediaRecorder(new MediaStream(tracks), mimeType ? { mimeType } : undefined);
      this.recorderChunks = [];
      recorder.ondataavailable = (e) => e.data.size && this.recorderChunks.push(e.data);
      recorder.start(1000);
      this.recorder = recorder;
      this.recorderAudio = ac;
      this.patch({ recording: true });
      if (this.callRef) await updateDoc(this.callRef, { [`recording.${this.me.uid}`]: true });
    } catch (err) {
      console.warn('[call] recording unavailable', err);
    }
  }

  async stopRecording() {
    const recorder = this.recorder;
    if (!recorder) return;
    this.recorder = null;
    this.patch({ recording: false, savingRecording: true });
    const stopped = new Promise<void>((resolve) => (recorder.onstop = () => resolve()));
    if (recorder.state !== 'inactive') recorder.stop();
    await stopped;
    void this.recorderAudio?.close();
    this.recorderAudio = null;
    const blob = new Blob(this.recorderChunks, { type: baseMime(recorder.mimeType) || 'audio/webm' });
    try {
      if (blob.size > 0) {
        const result = await uploadMedia(blob, 'calls', { fileName: `call-${this.view.callId}.${blob.type.includes('mp4') ? 'mp4' : 'webm'}` });
        if (this.callRef) {
          await updateDoc(this.callRef, {
            [`recordings.${this.me.uid}`]: result.url,
            [`recording.${this.me.uid}`]: false,
          });
        }
      }
    } catch (err) {
      console.warn('[call] failed to save recording', err);
    } finally {
      this.patch({ savingRecording: false });
    }
  }

  // ---------- internals ----------

  private patch(changes: Partial<CallView>) {
    this.view = { ...this.view, ...changes };
    this.listeners.forEach((l) => l(this.view));
  }

  private startTimer(name: string, ms: number, fn: () => void) {
    this.clearTimer(name);
    this.timers.set(name, window.setTimeout(fn, ms));
  }

  private clearTimer(name: string) {
    const id = this.timers.get(name);
    if (id !== undefined) window.clearTimeout(id);
    this.timers.delete(name);
  }

  private async startOutgoing() {
    try {
      const { stream, videoUnavailable } = await acquireMedia(this.view.type, this.view.facingMode);
      if (this.finished) return stream.getTracks().forEach((t) => t.stop());
      this.patch({ localStream: stream, videoUnavailable, cameraOff: videoUnavailable });

      const db = getDb();
      this.callRef = doc(collection(db, 'calls'));
      this.patch({ callId: this.callRef.id });
      const pc = this.createPeer(stream);
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      await setDoc(this.callRef, {
        callerId: this.me.uid,
        calleeId: this.view.partner.uid,
        participants: [this.me.uid, this.view.partner.uid],
        caller: { name: this.me.name, avatarColor: this.me.avatarColor, avatarUrl: this.me.avatarUrl || null },
        callee: {
          name: this.view.partner.name,
          avatarColor: this.view.partner.avatarColor,
          avatarUrl: this.view.partner.avatarUrl || null,
        },
        type: this.view.type,
        status: 'ringing',
        offer: { type: offer.type, sdp: offer.sdp },
        createdAt: serverTimestamp(),
        media: { [this.me.uid]: { muted: false, cameraOff: videoUnavailable } },
      });
      this.callDocReady = true;
      this.flushLocalCandidates();
      this.watchCallDoc();
      this.listenForCandidates('calleeCandidates');
      this.startTimer('ring', RING_TIMEOUT_MS, () => {
        if (this.view.phase === 'outgoing') {
          void this.writeStatus('missed');
          this.finish('No answer');
        }
      });
    } catch (err) {
      if (this.callRef && this.callDocReady) void this.writeStatus('failed');
      this.finish((err as Error).message);
    }
  }

  private createPeer(stream: MediaStream): RTCPeerConnection {
    const pc = new RTCPeerConnection({ iceServers: this.iceServers, iceCandidatePoolSize: 2 });
    this.pc = pc;
    stream.getTracks().forEach((t) => pc.addTrack(t, stream));

    pc.onicecandidate = (event) => {
      if (!event.candidate) return;
      const candidate = event.candidate.toJSON();
      if (this.callDocReady) void this.sendLocalCandidate(candidate);
      else this.pendingLocal.push(candidate);
    };

    pc.ontrack = (event) => {
      const remote = event.streams[0] || new MediaStream([event.track]);
      if (this.view.remoteStream !== remote) this.patch({ remoteStream: remote });
      else this.patch({});
    };

    const onState = () => {
      // Older Safari only exposes iceConnectionState (which uses 'completed' as well as 'connected').
      const state: string = pc.connectionState || pc.iceConnectionState;
      if (state === 'connected' || state === 'completed') {
        this.clearTimer('connect');
        this.clearTimer('disconnect');
        if (this.view.phase !== 'connected') {
          this.patch({ phase: 'connected', connectedAt: this.view.connectedAt ?? Date.now() });
          void this.detectRelay();
        }
      } else if (state === 'disconnected') {
        if (this.view.phase === 'connected') this.patch({ phase: 'reconnecting' });
        this.startTimer('disconnect', DISCONNECT_GRACE_MS, () => {
          void this.writeStatus('ended');
          this.finish('Connection lost');
        });
      } else if (state === 'failed') {
        void this.failConnect();
      }
    };
    pc.onconnectionstatechange = onState;
    pc.oniceconnectionstatechange = () => {
      if (!('connectionState' in pc)) onState();
    };
    return pc;
  }

  private async detectRelay() {
    try {
      const stats = await this.pc?.getStats();
      stats?.forEach((report) => {
        if (report.type === 'candidate-pair' && report.nominated && report.state === 'succeeded') {
          const local = stats.get(report.localCandidateId);
          if (local?.candidateType === 'relay') this.patch({ relayed: true });
        }
      });
    } catch {
      /* stats are informational only */
    }
  }

  private failConnect() {
    if (this.view.phase === 'connected' || this.finished) return;
    void this.writeStatus('failed');
    this.finish('Could not connect. The network may be blocking calls — a TURN relay server may be required.');
  }

  private async sendLocalCandidate(candidate: RTCIceCandidateInit) {
    if (!this.callRef) return;
    const lane = this.view.role === 'caller' ? 'callerCandidates' : 'calleeCandidates';
    try {
      await addDoc(collection(this.callRef, lane), candidate);
    } catch (err) {
      console.warn('[call] failed to send ICE candidate', err);
    }
  }

  private flushLocalCandidates() {
    const queued = this.pendingLocal.splice(0);
    queued.forEach((c) => void this.sendLocalCandidate(c));
  }

  private listenForCandidates(lane: 'callerCandidates' | 'calleeCandidates') {
    if (!this.callRef) return;
    const unsub = onSnapshot(collection(this.callRef, lane), (snap) => {
      snap.docChanges().forEach((change) => {
        if (change.type !== 'added') return;
        const candidate = change.doc.data() as RTCIceCandidateInit;
        if (this.pc?.remoteDescription) {
          this.pc.addIceCandidate(candidate).catch((e) => console.warn('[call] addIceCandidate', e));
        } else {
          this.pendingRemote.push(candidate);
        }
      });
    });
    this.unsubs.push(unsub);
  }

  private flushRemoteCandidates() {
    const queued = this.pendingRemote.splice(0);
    queued.forEach((c) => this.pc?.addIceCandidate(c).catch((e) => console.warn('[call] addIceCandidate', e)));
  }

  private watchCallDoc() {
    if (!this.callRef) return;
    const unsub = onSnapshot(this.callRef, async (snap) => {
      if (!snap.exists() || this.finished) return;
      const data = snap.data();
      const partnerId = this.view.partner.uid;
      const partnerMedia = data.media?.[partnerId] || {};
      this.patch({
        partnerRecording: Boolean(data.recording?.[partnerId]),
        partnerMuted: Boolean(partnerMedia.muted),
        partnerCameraOff: Boolean(partnerMedia.cameraOff),
      });

      // Caller: apply the callee's answer once.
      if (this.view.role === 'caller' && data.answer && !this.answerApplied && this.pc) {
        this.answerApplied = true;
        this.clearTimer('ring');
        this.patch({ phase: 'connecting' });
        try {
          await this.pc.setRemoteDescription(data.answer);
          this.flushRemoteCandidates();
          this.startTimer('connect', CONNECT_TIMEOUT_MS, () => this.failConnect());
        } catch (err) {
          void this.writeStatus('failed');
          this.finish(`Could not start media: ${(err as Error).message}`);
        }
      }

      if (this.view.role === 'callee' && this.pc?.remoteDescription) this.flushRemoteCandidates();

      const status = data.status as CallStatus;
      // Our own end-of-call write echoes back here; the local finish() already set the reason.
      if (this.endingLocally) return;
      // Another of my devices/tabs picked up this call.
      if (this.view.role === 'callee' && this.view.phase === 'incoming' && status === 'accepted') {
        this.finish('Answered on another device');
        return;
      }
      if (status !== 'ringing' && status !== 'accepted') {
        const reason = status === 'busy' ? `${this.view.partner.name} ${END_REASONS.busy}` : END_REASONS[status];
        // The callee sees a caller-cancelled/missed call as missed.
        const calleeView = this.view.role === 'callee' && this.view.phase === 'incoming' ? 'Missed call' : reason;
        this.finish(calleeView || 'Call ended');
      }
    });
    this.unsubs.push(unsub);
  }

  private async publishMediaState() {
    if (!this.callRef || !this.callDocReady) return;
    try {
      await updateDoc(this.callRef, {
        [`media.${this.me.uid}`]: { muted: this.view.muted, cameraOff: this.view.cameraOff },
      });
    } catch {
      /* non-critical */
    }
  }

  private async writeStatus(status: CallStatus) {
    if (!this.callRef || this.finished) return;
    this.endingLocally = true;
    const payload: Record<string, unknown> = {
      status,
      endedAt: serverTimestamp(),
      endedBy: this.me.uid,
    };
    if (this.view.connectedAt) payload.duration = Math.round((Date.now() - this.view.connectedAt) / 1000);
    try {
      await updateDoc(this.callRef, payload);
    } catch (err) {
      console.warn('[call] failed to update status', err);
    }
  }

  private finish(reason: string) {
    if (this.finished) return;
    this.finished = true;
    this.timers.forEach((id) => window.clearTimeout(id));
    this.timers.clear();
    this.unsubs.forEach((u) => u());
    this.unsubs = [];
    if (this.recorder && this.recorder.state !== 'inactive') {
      // Keep what was captured even when the other side hung up first.
      void this.stopRecording();
    }
    this.view.localStream?.getTracks().forEach((t) => t.stop());
    try {
      this.pc?.close();
    } catch {
      /* already closed */
    }
    this.pc = null;
    this.patch({ phase: 'ended', endReason: reason });
  }
}
