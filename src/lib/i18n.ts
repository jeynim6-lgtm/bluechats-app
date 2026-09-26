import { useSyncExternalStore } from 'react';

/**
 * Lightweight translations for navigation and core actions.
 * Missing keys fall back to English. isiZulu and Sesotho strings should be reviewed by a native speaker.
 */
export const LANGUAGES = [
  { code: 'en', label: 'English' },
  { code: 'zu', label: 'isiZulu' },
  { code: 'st', label: 'Sesotho' },
  { code: 'af', label: 'Afrikaans' },
  { code: 'fr', label: 'Français' },
  { code: 'pt', label: 'Português' },
  { code: 'es', label: 'Español' },
  { code: 'sw', label: 'Kiswahili' },
] as const;

export type LanguageCode = (typeof LANGUAGES)[number]['code'];

const en = {
  chats: 'Chats',
  discover: 'Discover',
  status: 'Status',
  calls: 'Calls',
  contacts: 'Contacts',
  settings: 'Settings',
  searchChats: 'Search chats or messages…',
  searchContacts: 'Search contacts…',
  typeMessage: 'Type a message',
  newChat: 'New chat',
  newGroup: 'New group',
  newContact: 'New contact',
  myStatus: 'My status',
  recentUpdates: 'Recent updates',
  allCalls: 'All',
  missed: 'Missed',
  logOut: 'Log out',
  online: 'online',
  typing: 'typing…',
  voiceCall: 'Voice call',
  videoCall: 'Video call',
  message: 'Message',
  cancel: 'Cancel',
  save: 'Save',
  invite: 'Invite',
};

type Dict = Partial<Record<keyof typeof en, string>>;

const dictionaries: Record<LanguageCode, Dict> = {
  en,
  af: {
    chats: 'Kletse', discover: 'Ontdek', status: 'Status', calls: 'Oproepe', contacts: 'Kontakte', settings: 'Instellings',
    searchChats: 'Soek kletse of boodskappe…', searchContacts: 'Soek kontakte…', typeMessage: 'Tik ’n boodskap',
    newChat: 'Nuwe klets', newGroup: 'Nuwe groep', newContact: 'Nuwe kontak', myStatus: 'My status',
    recentUpdates: 'Onlangse opdaterings', allCalls: 'Alle', missed: 'Gemis', logOut: 'Teken uit', online: 'aanlyn',
    typing: 'tik…', voiceCall: 'Stemoproep', videoCall: 'Video-oproep', message: 'Boodskap', cancel: 'Kanselleer',
    save: 'Stoor', invite: 'Nooi',
  },
  fr: {
    chats: 'Discussions', discover: 'Découvrir', status: 'Statut', calls: 'Appels', contacts: 'Contacts', settings: 'Paramètres',
    searchChats: 'Rechercher des discussions…', searchContacts: 'Rechercher des contacts…', typeMessage: 'Écrire un message',
    newChat: 'Nouvelle discussion', newGroup: 'Nouveau groupe', newContact: 'Nouveau contact', myStatus: 'Mon statut',
    recentUpdates: 'Mises à jour récentes', allCalls: 'Tous', missed: 'Manqués', logOut: 'Se déconnecter', online: 'en ligne',
    typing: 'écrit…', voiceCall: 'Appel vocal', videoCall: 'Appel vidéo', message: 'Message', cancel: 'Annuler',
    save: 'Enregistrer', invite: 'Inviter',
  },
  pt: {
    chats: 'Conversas', discover: 'Descobrir', status: 'Status', calls: 'Chamadas', contacts: 'Contatos', settings: 'Definições',
    searchChats: 'Pesquisar conversas…', searchContacts: 'Pesquisar contatos…', typeMessage: 'Escreva uma mensagem',
    newChat: 'Nova conversa', newGroup: 'Novo grupo', newContact: 'Novo contato', myStatus: 'Meu status',
    recentUpdates: 'Atualizações recentes', allCalls: 'Todas', missed: 'Perdidas', logOut: 'Terminar sessão', online: 'online',
    typing: 'a escrever…', voiceCall: 'Chamada de voz', videoCall: 'Videochamada', message: 'Mensagem', cancel: 'Cancelar',
    save: 'Guardar', invite: 'Convidar',
  },
  es: {
    chats: 'Chats', discover: 'Descubrir', status: 'Estados', calls: 'Llamadas', contacts: 'Contactos', settings: 'Ajustes',
    searchChats: 'Buscar chats o mensajes…', searchContacts: 'Buscar contactos…', typeMessage: 'Escribe un mensaje',
    newChat: 'Nuevo chat', newGroup: 'Nuevo grupo', newContact: 'Nuevo contacto', myStatus: 'Mi estado',
    recentUpdates: 'Actualizaciones recientes', allCalls: 'Todas', missed: 'Perdidas', logOut: 'Cerrar sesión', online: 'en línea',
    typing: 'escribiendo…', voiceCall: 'Llamada de voz', videoCall: 'Videollamada', message: 'Mensaje', cancel: 'Cancelar',
    save: 'Guardar', invite: 'Invitar',
  },
  sw: {
    chats: 'Soga', discover: 'Gundua', status: 'Hali', calls: 'Simu', contacts: 'Anwani', settings: 'Mipangilio',
    searchChats: 'Tafuta soga au ujumbe…', searchContacts: 'Tafuta anwani…', typeMessage: 'Andika ujumbe',
    newChat: 'Soga mpya', newGroup: 'Kikundi kipya', newContact: 'Anwani mpya', myStatus: 'Hali yangu',
    recentUpdates: 'Masasisho ya karibuni', allCalls: 'Zote', missed: 'Zilizokosa', logOut: 'Ondoka', online: 'mtandaoni',
    typing: 'anaandika…', voiceCall: 'Simu ya sauti', videoCall: 'Simu ya video', message: 'Ujumbe', cancel: 'Ghairi',
    save: 'Hifadhi', invite: 'Alika',
  },
  zu: {
    chats: 'Izingxoxo', discover: 'Thola', status: 'Isimo', calls: 'Amakholi', contacts: 'Oxhumana nabo', settings: 'Izilungiselelo',
    typeMessage: 'Bhala umlayezo', newChat: 'Ingxoxo entsha', newGroup: 'Iqembu elisha', myStatus: 'Isimo sami',
    missed: 'Okuphuthiwe', logOut: 'Phuma', online: 'ku-inthanethi', message: 'Umlayezo', cancel: 'Khansela', save: 'Londoloza',
  },
  st: {
    chats: 'Dipuisano', status: 'Boemo', calls: 'Mehala', typeMessage: 'Ngola molaetsa', message: 'Molaetsa',
  },
};

const STORAGE_KEY = 'bluechats_language';
const listeners = new Set<() => void>();

function readLanguage(): LanguageCode {
  try {
    const saved = localStorage.getItem(STORAGE_KEY) || '';
    const byCode = LANGUAGES.find((l) => l.code === saved);
    // Older versions stored the label ("isiZulu") instead of the code.
    const byLabel = LANGUAGES.find((l) => l.label === saved);
    return (byCode || byLabel)?.code ?? 'en';
  } catch {
    return 'en';
  }
}

let current: LanguageCode = readLanguage();

export function setLanguage(code: LanguageCode) {
  current = code;
  try {
    localStorage.setItem(STORAGE_KEY, code);
  } catch {
    /* ignore */
  }
  document.documentElement.lang = code;
  listeners.forEach((l) => l());
}

export function getLanguage(): LanguageCode {
  return current;
}

export type TranslationKey = keyof typeof en;

export function translate(key: TranslationKey): string {
  return dictionaries[current][key] || en[key];
}

export function useT(): (key: TranslationKey) => string {
  useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => current
  );
  return translate;
}
