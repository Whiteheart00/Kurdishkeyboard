// Dual-layer persistent storage (localStorage + IndexedDB + StorageManager.persist)
// Ensures keyboard state, editor text, settings, and clipboard history survive browser/phone restarts.

const DB_NAME = 'kurdikebord_persistent_db';
const STORE_NAME = 'kv_store';
const DB_VERSION = 1;

let dbPromise: Promise<IDBDatabase | null> | null = null;
type StorageErrorListener = (op: string, key: string, err: unknown) => void;
let storageErrorListener: StorageErrorListener | null = null;

export function setStorageErrorListener(listener: StorageErrorListener | null): void {
  storageErrorListener = listener;
}

function notifyStorageError(op: string, key: string, err: unknown): void {
  try {
    storageErrorListener?.(op, key, err);
  } catch {
    // Never let diagnostic hooks throw inside storage layer
  }
}

function openDB(): Promise<IDBDatabase | null> {
  if (typeof window === 'undefined' || !('indexedDB' in window)) {
    return Promise.resolve(null);
  }
  if (!dbPromise) {
    dbPromise = new Promise((resolve) => {
      try {
        const req = window.indexedDB.open(DB_NAME, DB_VERSION);
        req.onupgradeneeded = () => {
          const db = req.result;
          if (!db.objectStoreNames.contains(STORE_NAME)) {
            db.createObjectStore(STORE_NAME);
          }
        };
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => {
          notifyStorageError('openDB', DB_NAME, req.error);
          resolve(null);
        };
      } catch (err) {
        notifyStorageError('openDB', DB_NAME, err);
        resolve(null);
      }
    });
  }
  return dbPromise;
}

export async function requestPersistentStorage(): Promise<'granted' | 'denied' | 'unsupported'> {
  try {
    if (typeof navigator !== 'undefined' && navigator.storage?.persist) {
      const granted = await navigator.storage.persist();
      return granted ? 'granted' : 'denied';
    }
    return 'unsupported';
  } catch (err) {
    notifyStorageError('storage.persist', 'navigator.storage', err);
    return 'unsupported';
  }
}

export async function idbSet<T>(key: string, value: T): Promise<boolean> {
  const db = await openDB();
  if (!db) return false;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).put(value, key);
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => {
        notifyStorageError('idbSet', key, tx.error);
        resolve(false);
      };
    } catch (err) {
      notifyStorageError('idbSet', key, err);
      resolve(false);
    }
  });
}

export async function idbGet<T>(key: string): Promise<T | undefined> {
  const db = await openDB();
  if (!db) return undefined;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const req = tx.objectStore(STORE_NAME).get(key);
      req.onsuccess = () => resolve(req.result as T | undefined);
      req.onerror = () => {
        notifyStorageError('idbGet', key, req.error);
        resolve(undefined);
      };
    } catch (err) {
      notifyStorageError('idbGet', key, err);
      resolve(undefined);
    }
  });
}

export async function idbDelete(key: string): Promise<boolean> {
  const db = await openDB();
  if (!db) return false;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).delete(key);
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => {
        notifyStorageError('idbDelete', key, tx.error);
        resolve(false);
      };
    } catch (err) {
      notifyStorageError('idbDelete', key, err);
      resolve(false);
    }
  });
}
