/**
 * End-to-end test: two real browsers (Alice & Bob) against the Firebase Auth + Firestore
 * emulators and a mock Bunny.net storage server, running the production server build.
 *
 *   npm run build && npm run test:e2e
 *
 * Requires Java (for the emulators) and a Chromium for Playwright
 * (`npx playwright install chromium`, or set CHROMIUM_PATH).
 */
import { spawn, type ChildProcess } from 'node:child_process';
import { existsSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { chromium, type Browser, type Page } from 'playwright';
import { startMockBunny } from './mockBunny.ts';

const APP_PORT = 3100;
const BUNNY_PORT = 9199;
const BASE = `http://127.0.0.1:${APP_PORT}`;
const PROJECT = 'demo-bluechats';
const AUTH_EMULATOR = process.env.FIREBASE_AUTH_EMULATOR_HOST || '127.0.0.1:9099';
const ARTIFACTS = process.env.E2E_ARTIFACTS || path.resolve('tests/e2e/artifacts');
const ALICE = { local: '820000001', e164: '+27820000001', name: 'Alice Test' };
const BOB = { local: '820000002', e164: '+27820000002', name: 'Bob Test' };

mkdirSync(ARTIFACTS, { recursive: true });

const results: Array<{ name: string; ok: boolean; ms: number; error?: string }> = [];
const pageErrors: string[] = [];

async function step(name: string, fn: () => Promise<void>, pages: Page[] = []) {
  const started = Date.now();
  try {
    await fn();
    results.push({ name, ok: true, ms: Date.now() - started });
    console.log(`  ✔ ${name} (${Date.now() - started}ms)`);
  } catch (err) {
    const message = (err as Error).message.split('\n')[0];
    results.push({ name, ok: false, ms: Date.now() - started, error: message });
    console.log(`  ✘ ${name}\n      ${message}`);
    for (const [i, p] of pages.entries()) {
      await p.screenshot({ path: path.join(ARTIFACTS, `FAILED-${name.replace(/\W+/g, '_')}-${i}.png`) }).catch(() => {});
    }
  }
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

async function waitForHttp(url: string, timeoutMs = 60_000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(url);
      if (res.ok) return;
    } catch {
      /* not up yet */
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`Timed out waiting for ${url}`);
}

async function smsCodeFor(phone: string): Promise<string> {
  for (let i = 0; i < 40; i++) {
    const res = await fetch(`http://${AUTH_EMULATOR}/emulator/v1/projects/${PROJECT}/verificationCodes`);
    const data = (await res.json()) as { verificationCodes?: Array<{ phoneNumber: string; code: string }> };
    const match = (data.verificationCodes || []).filter((c) => c.phoneNumber === phone).pop();
    if (match) return match.code;
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error(`No SMS code issued for ${phone}`);
}

async function signUp(page: Page, user: typeof ALICE) {
  await page.goto(BASE);
  await page.fill('input[name=phone]', user.local);
  if (user === ALICE) await page.screenshot({ path: path.join(ARTIFACTS, '00-signin-phone.png') });
  await page.click('#send-code-button');
  await page.waitForSelector('input[name=otp]', { timeout: 20_000 });
  if (user === ALICE) await page.screenshot({ path: path.join(ARTIFACTS, '00-signin-code.png') });
  const code = await smsCodeFor(user.e164);
  assert(/^\d{6}$/.test(code), `expected a 6-digit code, got ${code}`);
  await page.fill('input[name=otp]', code);
  await page.waitForSelector('input[name=name]', { timeout: 20_000 });
  await page.fill('input[name=name]', user.name);
  await page.click('button:has-text("Continue →")');
  await page.click('text=No wallet needed for now');
  await page.click('button:has-text("Continue to Blue Chats")');
  await page.waitForSelector('nav button:has-text("Chats")', { timeout: 20_000 });
}

async function nav(page: Page, tab: string) {
  // Close an open chat first — it covers the bottom navigation.
  const back = page.locator('div.fixed.inset-0 button[aria-label="Back"]');
  if (await back.count()) await back.first().click();
  await page.click(`nav button:has-text("${tab}")`);
}

async function idToken(page: Page): Promise<string> {
  return page.evaluate(
    () =>
      new Promise<string>((resolve, reject) => {
        const req = indexedDB.open('firebaseLocalStorageDb');
        req.onerror = () => reject(req.error);
        req.onsuccess = () => {
          const tx = req.result.transaction('firebaseLocalStorage', 'readonly');
          const all = tx.objectStore('firebaseLocalStorage').getAll();
          all.onsuccess = () => {
            const entry = all.result.find((r: { fbase_key: string }) => r.fbase_key.startsWith('firebase:authUser'));
            resolve(entry?.value?.stsTokenManager?.accessToken || '');
          };
        };
      })
  );
}

async function main() {
  assert(existsSync('dist/index.html') && existsSync('server.js'), 'build output missing — run `npm run build` first');

  const bunny = await startMockBunny(BUNNY_PORT, 'e2e-zone', 'e2e-storage-key');
  // Exactly what `npm start` runs in production.
  const server: ChildProcess = spawn(process.execPath, ['server.js'], {
    env: {
      ...process.env,
      NODE_ENV: 'production',
      PORT: String(APP_PORT),
      FIREBASE_API_KEY: 'demo-api-key',
      FIREBASE_AUTH_DOMAIN: `${PROJECT}.firebaseapp.com`,
      FIREBASE_PROJECT_ID: PROJECT,
      FIREBASE_APP_ID: '1:000000000000:web:e2e',
      FIREBASE_AUTH_EMULATOR_HOST: AUTH_EMULATOR,
      FIRESTORE_EMULATOR_HOST: process.env.FIRESTORE_EMULATOR_HOST || '127.0.0.1:8080',
      BUNNY_STORAGE_ENDPOINT: `http://127.0.0.1:${BUNNY_PORT}`,
      BUNNY_STORAGE_ZONE: 'e2e-zone',
      BUNNY_STORAGE_API_KEY: 'e2e-storage-key',
      CEO_PHONE_NUMBERS: ALICE.e164,
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  server.stdout?.on('data', (d) => process.env.E2E_VERBOSE && process.stdout.write(`[server] ${d}`));
  server.stderr?.on('data', (d) => process.stdout.write(`[server:err] ${d}`));

  let browser: Browser | null = null;
  try {
    await waitForHttp(`${BASE}/api/health`);
    browser = await chromium.launch({
      executablePath: process.env.CHROMIUM_PATH || (existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined),
      args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', '--autoplay-policy=no-user-gesture-required'],
    });
    const mkPage = async (label: string) => {
      const ctx = await browser!.newContext({ viewport: { width: 420, height: 860 }, permissions: ['camera', 'microphone', 'clipboard-read', 'clipboard-write'] });
      const page = await ctx.newPage();
      page.on('pageerror', (e) => pageErrors.push(`[${label}] ${e.message}`));
      page.on('console', (m) => m.type() === 'error' && pageErrors.push(`[${label}] console: ${m.text()}`));
      page.setDefaultTimeout(20_000);
      page.on('dialog', (d) => void d.accept());
      return page;
    };
    const alice = await mkPage('alice');
    const bob = await mkPage('bob');
    const both = [alice, bob];

    console.log('\nBlue Chats E2E\n');

    await step('server refuses uploads without a sign-in token', async () => {
      const res = await fetch(`${BASE}/api/media/upload?folder=photos`, { method: 'POST' });
      assert(res.status === 401, `expected 401, got ${res.status}`);
      const legacy = await fetch(`${BASE}/api/admin/verify-claims`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'jeynim6@gmail.com' }),
      });
      assert(legacy.status === 401, `CEO email bypass must be closed, got ${legacy.status}`);
    });

    await step('Alice signs up with SMS verification', () => signUp(alice, ALICE), [alice]);
    await step('Bob signs up with SMS verification', () => signUp(bob, BOB), [bob]);
    await alice.screenshot({ path: path.join(ARTIFACTS, '01-alice-home.png') });

    await step('wrong SMS code is rejected', async () => {
      const p = await mkPage('eve');
      await p.goto(BASE);
      await p.fill('input[name=phone]', '820000003');
      await p.click('#send-code-button');
      await p.waitForSelector('input[name=otp]');
      await p.fill('input[name=otp]', '000000');
      await p.waitForSelector('text=That code is incorrect');
      await p.context().close();
    });

    await step('Alice adds Bob as a contact by phone number', async () => {
      await nav(alice, 'Contacts');
      await alice.click('button[aria-label="New contact"]');
      await alice.fill('input[name=contact-name]', BOB.name);
      await alice.fill('input[name=contact-phone]', BOB.local);
      await alice.click('button:has-text("Save contact")');
      await alice.waitForSelector(`button[aria-label="Message ${BOB.name}"]`);
    }, [alice]);

    await step('Alice messages Bob; Bob receives it in real time with an unread badge', async () => {
      await alice.click(`button[aria-label="Message ${BOB.name}"]`);
      await alice.fill('textarea[aria-label=Message]', 'Hello Bob 👋 real-time test');
      await alice.keyboard.press('Enter');
      await alice.waitForSelector('text=Hello Bob 👋 real-time test');
      await nav(bob, 'Chats');
      const row = bob.locator('button', { hasText: ALICE.name }).first();
      await row.waitFor();
      await row.locator('text=Hello Bob').waitFor();
      await bob.locator('nav button:has-text("Chats") span:has-text("1")').waitFor();
      await row.click();
      await bob.waitForSelector('text=Hello Bob 👋 real-time test');
    }, both);

    await step('read receipt reaches Alice after Bob opens the chat', async () => {
      await alice.locator('[aria-label="Read"]').last().waitFor();
    }, [alice]);

    await step('typing indicator shows while Bob types', async () => {
      await bob.fill('textarea[aria-label=Message]', 'Hi Alice');
      await alice.locator('text=typing…').first().waitFor();
      await bob.keyboard.press('Enter');
      await alice.waitForSelector('text=Hi Alice');
    }, both);

    await step('photo is uploaded to Bunny storage and delivered to Bob', async () => {
      const dataUrl = await alice.evaluate(() => {
        const c = document.createElement('canvas');
        c.width = 320;
        c.height = 200;
        const ctx = c.getContext('2d')!;
        ctx.fillStyle = '#3B6BFA';
        ctx.fillRect(0, 0, 320, 200);
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 36px sans-serif';
        ctx.fillText('Blue Chats', 60, 110);
        return c.toDataURL('image/png');
      });
      const before = bunny.stats.puts;
      await alice.locator('input[type=file][accept="image/*,video/*"]').first().setInputFiles({
        name: 'sunset.png',
        mimeType: 'image/png',
        buffer: Buffer.from(dataUrl.split(',')[1], 'base64'),
      });
      await alice.fill('input[placeholder="Add a caption…"]', 'Sunset photo');
      await alice.click('button[aria-label="Send media"]');
      await bob.waitForSelector('img[alt="Sunset photo"]');
      const loaded = await bob.$eval('img[alt="Sunset photo"]', async (img: HTMLImageElement) => {
        if (!img.complete) await new Promise((r) => (img.onload = r));
        return { w: img.naturalWidth, src: img.getAttribute('src') };
      });
      assert(loaded.w === 320, `image did not load for Bob (width ${loaded.w})`);
      assert(loaded.src?.startsWith('/api/media/file/photos/'), `unexpected media URL ${loaded.src}`);
      assert(bunny.stats.puts === before + 1, 'expected exactly one PUT to Bunny storage');
    }, both);

    await step('voice note is recorded, uploaded and playable for Bob', async () => {
      await alice.click('button[aria-label="Record voice note"]');
      await alice.waitForTimeout(2200);
      await alice.click('button[aria-label="Send voice note"]');
      await bob.locator('button[aria-label="Play voice note"]').first().waitFor({ timeout: 30_000 });
      const src = await bob.locator('audio').last().getAttribute('src');
      assert(src?.includes('/api/media/file/voice/'), `unexpected voice URL ${src}`);
      const res = await fetch(`${BASE}${src}`);
      assert(res.ok && (await res.arrayBuffer()).byteLength > 1000, 'voice note file is empty or unreachable');
    }, both);

    await step('another user cannot delete Alice’s uploaded file', async () => {
      const [file] = [...bunny.files.keys()].filter((k) => k.startsWith('photos/'));
      assert(file, 'no uploaded photo found');
      const token = await idToken(bob);
      assert(token, 'could not read Bob’s ID token');
      const res = await fetch(`${BASE}/api/media`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: file }),
      });
      assert(res.status === 403, `expected 403, got ${res.status}`);
      assert(bunny.files.has(file), 'file was deleted by the wrong user');
    }, [bob]);

    await alice.screenshot({ path: path.join(ARTIFACTS, '02-alice-chat.png') });
    await bob.screenshot({ path: path.join(ARTIFACTS, '03-bob-chat.png') });

    await step('live WebRTC video call connects with media flowing both ways', async () => {
      await alice.click('button[aria-label="Video call"]');
      await bob.locator('button[aria-label="Accept call"]').waitFor({ timeout: 20_000 });
      await bob.screenshot({ path: path.join(ARTIFACTS, '04-bob-incoming-call.png') });
      await bob.click('button[aria-label="Accept call"]');
      await alice.waitForSelector('text=Encrypted peer-to-peer', { timeout: 30_000 });
      await bob.waitForSelector('text=Encrypted peer-to-peer', { timeout: 30_000 });
      await alice.waitForTimeout(2500);
      for (const [who, page] of [['Alice', alice], ['Bob', bob]] as const) {
        const media = await page.evaluate(() => ({
          videos: [...document.querySelectorAll('video')].map((v) => ({ w: v.videoWidth, t: v.currentTime })),
          audio: [...document.querySelectorAll('audio')].map((a) => ({
            tracks: (a.srcObject as MediaStream | null)?.getAudioTracks().length || 0,
            paused: a.paused,
          })),
        }));
        assert(media.videos.length >= 2 && media.videos.every((v) => v.w > 0), `${who}: remote/local video not rendering ${JSON.stringify(media.videos)}`);
        assert(media.audio.some((a) => a.tracks > 0 && !a.paused), `${who}: remote audio not playing ${JSON.stringify(media.audio)}`);
      }
      await alice.screenshot({ path: path.join(ARTIFACTS, '05-alice-video-call.png') });
      await bob.screenshot({ path: path.join(ARTIFACTS, '06-bob-video-call.png') });
    }, both);

    await step('mute and camera-off are signalled to the other side', async () => {
      await alice.click('button[aria-label="Mute"]');
      await bob.waitForSelector('text=is muted');
      await alice.click('button[aria-label="Turn camera off"]');
      await bob.waitForSelector('text=turned their camera off');
    }, both);

    await step('hanging up ends the call on both devices and logs history', async () => {
      await alice.click('button[aria-label="Hang up"]');
      await bob.waitForSelector('text=Call ended');
      await bob.waitForSelector('[role=dialog][aria-label^="Call with"]', { state: 'detached', timeout: 10_000 });
      await alice.waitForSelector('[role=dialog][aria-label^="Call with"]', { state: 'detached', timeout: 10_000 });
      await nav(bob, 'Calls');
      await bob.locator('text=/\\d+:\\d{2}/').first().waitFor();
    }, both);

    await step('declined voice call is reported to the caller', async () => {
      await nav(bob, 'Chats');
      await bob.locator('button', { hasText: ALICE.name }).first().click();
      await bob.click('button[aria-label="Voice call"]');
      await alice.locator('button[aria-label="Decline call"]').waitFor();
      await alice.click('button[aria-label="Decline call"]');
      await bob.waitForSelector('text=Call declined');
      await bob.waitForSelector('[role=dialog][aria-label^="Call with"]', { state: 'detached', timeout: 10_000 });
      await alice.waitForTimeout(500);
      assert(
        (await alice.locator('nav button:has-text("Calls") span.bg-brand').count()) === 0,
        'a call Alice declined herself must not show a missed-call badge'
      );
    }, both);

    await step('status update is shared and view is counted', async () => {
      await nav(bob, 'Status');
      await bob.click('button[aria-label="Add status"]');
      await bob.fill('textarea[aria-label="Status text"]', 'Braai on Saturday 🔥');
      await bob.click('button:has-text("Post status")');
      await bob.waitForSelector('text=Status posted');
      await nav(alice, 'Status');
      await alice.locator('button', { hasText: BOB.name }).first().click();
      await alice.waitForSelector('text=Braai on Saturday 🔥');
      await alice.waitForTimeout(800);
      await alice.click('[aria-label="Status viewer"] button[aria-label="Close"]');
      await bob.click('button[aria-label="View my status"]');
      await bob.waitForSelector('text=1 view');
      await bob.click('[aria-label="Status viewer"] button[aria-label="Close"]');
    }, both);

    await step('Discover post with star and live comment', async () => {
      await nav(alice, 'Discover');
      await alice.getByRole('button', { name: 'Post', exact: true }).click();
      const dataUrl = await alice.evaluate(() => {
        const c = document.createElement('canvas');
        c.width = 400;
        c.height = 300;
        const ctx = c.getContext('2d')!;
        ctx.fillStyle = '#2FBE8F';
        ctx.fillRect(0, 0, 400, 300);
        return c.toDataURL('image/png');
      });
      await alice.locator('input[type=file][accept="image/*,video/*"]').setInputFiles({
        name: 'post.png',
        mimeType: 'image/png',
        buffer: Buffer.from(dataUrl.split(',')[1], 'base64'),
      });
      await alice.fill('textarea[placeholder^="Share a thought"]', 'Table Mountain today');
      await alice.click('button:has-text("Publish post")');
      await alice.waitForSelector('text=Table Mountain today');
      await nav(bob, 'Discover');
      const post = bob.locator('article', { hasText: 'Table Mountain today' });
      await post.waitFor();
      await post.locator('button[aria-label="Star"]').click();
      await post.locator('button[aria-label="Unstar"]:has-text("1")').waitFor();
      await post.locator('img').click();
      await bob.fill('input[aria-label=Comment]', 'Beautiful view!');
      await bob.click('button[aria-label="Send comment"]');
      await bob.waitForSelector('text=Beautiful view!');
      await alice.waitForFunction(() =>
        [...document.querySelectorAll('article')].some((a) => a.textContent?.includes('Table Mountain today') && /Beautiful|1/.test(a.textContent || ''))
      );
      await bob.click('button[aria-label="Close"]');
    }, both);

    await step('designated CEO gets server-verified dashboard; others do not', async () => {
      await nav(alice, 'Settings');
      await alice.click('button:has-text("Open →")', { timeout: 20_000 });
      await alice.waitForSelector('text=CEO control panel', { timeout: 20_000 });
      await alice.locator('text=Total users').waitFor();
      await alice.waitForFunction(() => document.body.innerText.includes('Alice Test') && document.body.innerText.includes('Bob Test'));
      await alice.screenshot({ path: path.join(ARTIFACTS, '07-ceo-dashboard.png') });
      await nav(bob, 'Settings');
      await bob.waitForSelector('text=Storage & connectivity');
      await bob.waitForTimeout(1500);
      assert((await bob.locator('text=CEO / Admin dashboard').count()) === 0, 'Bob must not see the CEO dashboard');
    }, both);

    await step('accent colour and dark mode customisation apply instantly', async () => {
      await bob.click('button[aria-label="Rose accent"]');
      const brand = await bob.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--color-brand').trim());
      assert(brand.toLowerCase() === '#e0457b', `accent not applied (${brand})`);
      await bob.click('button[aria-label="Toggle dark mode"]');
      assert(await bob.evaluate(() => document.documentElement.classList.contains('dark')), 'dark mode not applied');
      await bob.screenshot({ path: path.join(ARTIFACTS, '08-bob-settings-theme.png'), fullPage: false });
    }, [bob]);

    await step('storage self-test in Settings round-trips a file', async () => {
      await alice.click('button:has-text("Back")');
      await alice.click('button:has-text("Run upload test")');
      await alice.waitForSelector('text=deleted successfully', { timeout: 20_000 });
    }, [alice]);

    await step('session survives a page reload (no re-login, chats restored)', async () => {
      await bob.reload();
      await nav(bob, 'Chats');
      await bob.locator('button', { hasText: ALICE.name }).first().waitFor();
      assert((await bob.locator('input[name=phone]').count()) === 0, 'reload must not show sign-in');
    }, [bob]);

    await step('existing user signing in on a new device skips onboarding', async () => {
      const device2 = await mkPage('bob-device-2');
      await device2.goto(BASE);
      await device2.fill('input[name=phone]', BOB.local);
      await device2.click('#send-code-button');
      await device2.waitForSelector('input[name=otp]');
      await device2.fill('input[name=otp]', await smsCodeFor(BOB.e164));
      await device2.waitForSelector('nav button:has-text("Chats")', { timeout: 20_000 });
      assert((await device2.locator('input[name=name]').count()) === 0, 'profile step shown to an existing user');
      await device2.locator('button', { hasText: ALICE.name }).first().waitFor();
      await device2.context().close();
    }, [bob]);

    await step('group chat: create, message, and member receives it', async () => {
      await nav(alice, 'Chats');
      await alice.click('button[aria-label="New chat"]');
      await alice.click('button:has-text("New group")');
      await alice.fill('input[placeholder="Group name"]', 'Braai Crew');
      await alice.locator('[role=dialog] button', { hasText: BOB.name }).first().click();
      await alice.waitForSelector('text=1 selected');
      await alice.click('button:has-text("Create group")');
      await alice.fill('textarea[aria-label=Message]', 'Group hello!');
      await alice.keyboard.press('Enter');
      await nav(bob, 'Chats');
      await bob.locator('button', { hasText: 'Braai Crew' }).first().click();
      await bob.waitForSelector('text=Group hello!');
      await bob.waitForSelector('text=created the group');
    }, both);

    await step('blocked user cannot reach you by call', async () => {
      // Bob blocks Alice from the group-member list / profile
      await nav(bob, 'Chats');
      await bob.locator('button', { hasText: ALICE.name }).first().click();
      await bob.click('button[aria-label="Chat info"]');
      await bob.click(`button:has-text("Block ${ALICE.name}")`);
      await bob.locator(`button:has-text("Unblock ${ALICE.name}")`).waitFor();
      await bob.locator('button[aria-label="Close"]').first().click();
      await bob.waitForSelector('text=Unblock to send messages or call');
      await nav(alice, 'Contacts');
      await alice.click(`button[aria-label="Voice call ${BOB.name}"]`);
      await alice.waitForSelector(`text=${BOB.name} is on another call`, { timeout: 20_000 });
      assert((await bob.locator('button[aria-label="Accept call"]').count()) === 0, 'blocked caller must not ring');
      await bob.getByRole('button', { name: 'Unblock', exact: true }).click();
      await bob.locator('textarea[aria-label=Message]').waitFor();
    }, both);

    await step('logging out returns to the sign-in screen and clears the session', async () => {
      await nav(bob, 'Settings');
      // Logging out wipes the offline cache and reloads the page by itself.
      await Promise.all([bob.waitForEvent('load', { timeout: 20_000 }), bob.click('button:has-text("Log out")')]);
      await bob.waitForSelector('input[name=phone]', { timeout: 20_000 });
      assert(
        (await bob.evaluate(() => indexedDB.databases())).every((d) => !d.name?.startsWith('firestore/')),
        'offline Firestore cache should be cleared after logout'
      );
    }, [bob]);
  } finally {
    await browser?.close();
    server.kill();
    bunny.close();
  }

  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} steps passed`);
  const unexpected = pageErrors.filter((e) => !/Failed to load resource|favicon|net::ERR_ABORTED/.test(e));
  if (unexpected.length) {
    console.log(`\nBrowser errors (${unexpected.length}):`);
    [...new Set(unexpected)].slice(0, 25).forEach((e) => console.log(`  - ${e.slice(0, 300)}`));
  }
  console.log(`Screenshots: ${ARTIFACTS}`);
  process.exit(failed.length ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
