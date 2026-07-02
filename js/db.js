// js/db.js
const DB_NAME = 'reading-trainer';
const DB_VERSION = 1;

const STORES = {
  questionBank: 'questionBank',
  profile: 'profile',
  records: 'records',
  plans: 'plans',
  gamification: 'gamification',
  config: 'config',
  flaggedQuestions: 'flaggedQuestions',
};

let _db = null;

export function openDB() {
  return new Promise((resolve, reject) => {
    if (_db) return resolve(_db);
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(STORES.questionBank))
        db.createObjectStore(STORES.questionBank, { keyPath: 'version' });
      if (!db.objectStoreNames.contains(STORES.profile))
        db.createObjectStore(STORES.profile, { keyPath: 'subject' });
      if (!db.objectStoreNames.contains(STORES.records)) {
        const s = db.createObjectStore(STORES.records, { keyPath: 'recordId' });
        s.createIndex('date', 'date', { unique: false });
        s.createIndex('passageId', 'passageId', { unique: false });
        s.createIndex('skill', 'skill', { unique: false });
      }
      if (!db.objectStoreNames.contains(STORES.plans))
        db.createObjectStore(STORES.plans, { keyPath: 'date' });
      if (!db.objectStoreNames.contains(STORES.gamification))
        db.createObjectStore(STORES.gamification, { keyPath: 'id' });
      if (!db.objectStoreNames.contains(STORES.config))
        db.createObjectStore(STORES.config, { keyPath: 'key' });
      if (!db.objectStoreNames.contains(STORES.flaggedQuestions))
        db.createObjectStore(STORES.flaggedQuestions, { keyPath: 'flagId' });
    };
    req.onsuccess = (e) => { _db = e.target.result; resolve(_db); };
    req.onerror = (e) => reject(e.target.error);
  });
}

function tx(storeName, mode = 'readonly') {
  return openDB().then(db => db.transaction(storeName, mode).objectStore(storeName));
}

export async function dbGet(store, key) {
  const s = await tx(store);
  return new Promise((resolve, reject) => {
    const r = s.get(key);
    r.onsuccess = () => resolve(r.result || null);
    r.onerror = () => reject(r.error);
  });
}

export async function dbGetAll(store) {
  const s = await tx(store);
  return new Promise((resolve, reject) => {
    const r = s.getAll();
    r.onsuccess = () => resolve(r.result || []);
    r.onerror = () => reject(r.error);
  });
}

export async function dbGetByIndex(store, indexName, value) {
  const s = await tx(store);
  const idx = s.index(indexName);
  return new Promise((resolve, reject) => {
    const r = idx.getAll(value);
    r.onsuccess = () => resolve(r.result || []);
    r.onerror = () => reject(r.error);
  });
}

export async function dbPut(store, value) {
  const s = await tx(store, 'readwrite');
  return new Promise((resolve, reject) => {
    const r = s.put(value);
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
}

export async function dbDelete(store, key) {
  const s = await tx(store, 'readwrite');
  return new Promise((resolve, reject) => {
    const r = s.delete(key);
    r.onsuccess = () => resolve();
    r.onerror = () => reject(r.error);
  });
}

export { STORES };
