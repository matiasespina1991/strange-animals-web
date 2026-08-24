/* eslint-disable unicorn/no-document-cookie -- The browser identifier intentionally uses a scoped, persistent cookie. */
import {doc, getDoc, serverTimestamp, setDoc} from 'firebase/firestore';
import {firebaseDb} from '@/lib/firebase';

const PREFERENCES_VERSION = 1;
const BROWSER_ID_COOKIE = 'sa_identity_browser_id';
const COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 365;
const MAX_STORED_FONT_IDS = 500;
const FONT_ID_PATTERN = /^[\w-]{1,200}$/i;
const BROWSER_ID_PATTERN = /^[\da-f]{8}-(?:[\da-f]{4}-){3}[\da-f]{12}$/i;

export type IdentityFontPreferences = {
  favoriteFontIds: string[];
  pinnedFontIds: string[];
  showOnlyFavorites: boolean;
};

export const EMPTY_IDENTITY_FONT_PREFERENCES: IdentityFontPreferences = {
  favoriteFontIds: [],
  pinnedFontIds: [],
  showOnlyFavorites: false,
};

let preferenceWriteQueue: Promise<void> = Promise.resolve();

function readCookie(name: string) {
  const prefix = `${encodeURIComponent(name)}=`;
  const cookie = document.cookie
    .split('; ')
    .find((item) => item.startsWith(prefix));

  if (!cookie) return undefined;

  try {
    return decodeURIComponent(cookie.slice(prefix.length));
  } catch {
    return undefined;
  }
}

function writeBrowserIdCookie(browserId: string) {
  const secure = window.location.protocol === 'https:' ? '; Secure' : '';

  document.cookie = `${encodeURIComponent(BROWSER_ID_COOKIE)}=${encodeURIComponent(browserId)}; Path=/identity; Max-Age=${COOKIE_MAX_AGE_SECONDS}; SameSite=Strict${secure}`;
}

function getOrCreateBrowserId() {
  const storedBrowserId = readCookie(BROWSER_ID_COOKIE);
  const browserId =
    storedBrowserId && BROWSER_ID_PATTERN.test(storedBrowserId)
      ? storedBrowserId
      : crypto.randomUUID();

  // Refresh the one-year lifetime whenever the identity section is used.
  writeBrowserIdCookie(browserId);
  return browserId;
}

function readStoredFontIds(value: unknown) {
  if (typeof value !== 'string' || value.length === 0) return [];

  return [...new Set(value.split(','))]
    .filter((fontId) => FONT_ID_PATTERN.test(fontId))
    .slice(0, MAX_STORED_FONT_IDS);
}

function serializeFontIds(fontIds: string[]) {
  return [...new Set(fontIds)]
    .filter((fontId) => FONT_ID_PATTERN.test(fontId))
    .slice(0, MAX_STORED_FONT_IDS)
    .join(',');
}

function readPreferences(value: Record<string, unknown>) {
  if (value.version !== PREFERENCES_VERSION) {
    return EMPTY_IDENTITY_FONT_PREFERENCES;
  }

  return {
    favoriteFontIds: readStoredFontIds(value.favoriteFontKeys),
    pinnedFontIds: readStoredFontIds(value.pinnedFontKeys),
    showOnlyFavorites: value.showOnlyFavorites === true,
  } satisfies IdentityFontPreferences;
}

export async function loadIdentityFontPreferences() {
  const browserId = getOrCreateBrowserId();
  const preferenceReference = doc(firebaseDb, 'users', browserId);
  const snapshot = await getDoc(preferenceReference);

  if (snapshot.exists()) {
    return readPreferences(snapshot.data());
  }

  await setDoc(preferenceReference, {
    version: PREFERENCES_VERSION,
    favoriteFontKeys: '',
    pinnedFontKeys: '',
    showOnlyFavorites: false,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  return EMPTY_IDENTITY_FONT_PREFERENCES;
}

export async function saveIdentityFontPreferences(
  preferences: IdentityFontPreferences,
) {
  const browserId = getOrCreateBrowserId();
  const preferenceReference = doc(firebaseDb, 'users', browserId);

  preferenceWriteQueue = preferenceWriteQueue
    .catch(() => undefined)
    .then(async () => {
      await setDoc(
        preferenceReference,
        {
          version: PREFERENCES_VERSION,
          favoriteFontKeys: serializeFontIds(preferences.favoriteFontIds),
          pinnedFontKeys: serializeFontIds(preferences.pinnedFontIds),
          showOnlyFavorites: preferences.showOnlyFavorites,
          updatedAt: serverTimestamp(),
        },
        {merge: true},
      );
    });

  await preferenceWriteQueue;
}
