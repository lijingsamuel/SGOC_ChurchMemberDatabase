/**
 * db.js
 * IndexedDB wrapper for offline-first behavior:
 *  - "drafts"  : in-progress family forms, autosaved every 20s and on blur.
 *  - "outbox"  : saveFamily requests captured while offline, replayed once
 *                connectivity returns.
 */

const DB_NAME = 'church-family-db';
const DB_VERSION = 1;
const STORE_DRAFTS = 'drafts';
const STORE_OUTBOX = 'outbox';

let dbPromise = null;

function openDb() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_DRAFTS)) {
        db.createObjectStore(STORE_DRAFTS, { keyPath: 'localId' });
      }
      if (!db.objectStoreNames.contains(STORE_OUTBOX)) {
        db.createObjectStore(STORE_OUTBOX, { keyPath: 'localId', autoIncrement: true });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

function tx(storeName, mode) {
  return openDb().then(db => db.transaction(storeName, mode).objectStore(storeName));
}

export const DraftStore = {
  async save(draft) {
    const store = await tx(STORE_DRAFTS, 'readwrite');
    return new Promise((resolve, reject) => {
      const req = store.put(draft);
      req.onsuccess = () => resolve(draft);
      req.onerror = () => reject(req.error);
    });
  },
  async get(localId) {
    const store = await tx(STORE_DRAFTS, 'readonly');
    return new Promise((resolve, reject) => {
      const req = store.get(localId);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
    });
  },
  async getAll() {
    const store = await tx(STORE_DRAFTS, 'readonly');
    return new Promise((resolve, reject) => {
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });
  },
  async remove(localId) {
    const store = await tx(STORE_DRAFTS, 'readwrite');
    return new Promise((resolve, reject) => {
      const req = store.delete(localId);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }
};

export const Outbox = {
  async enqueue(request) {
    const store = await tx(STORE_OUTBOX, 'readwrite');
    return new Promise((resolve, reject) => {
      const req = store.add({ ...request, queuedAt: Date.now() });
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  },
  async getAll() {
    const store = await tx(STORE_OUTBOX, 'readonly');
    return new Promise((resolve, reject) => {
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });
  },
  async remove(localId) {
    const store = await tx(STORE_OUTBOX, 'readwrite');
    return new Promise((resolve, reject) => {
      const req = store.delete(localId);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }
};
