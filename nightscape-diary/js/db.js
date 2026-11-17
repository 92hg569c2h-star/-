// IndexedDB のラッパー。
// entries: 日記（写真以外のデータ） / photos: 写真（本体とサムネイル） / meta: 設定や手紙の履歴

const DB_NAME = 'nightscape-diary';
const DB_VERSION = 1;
let dbPromise = null;

function openDB() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains('entries')) {
        db.createObjectStore('entries', { keyPath: 'id' }).createIndex('createdAt', 'createdAt');
      }
      if (!db.objectStoreNames.contains('photos')) db.createObjectStore('photos', { keyPath: 'id' });
      if (!db.objectStoreNames.contains('meta')) db.createObjectStore('meta', { keyPath: 'key' });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

function run(storeNames, mode, fn) {
  return openDB().then(db => new Promise((resolve, reject) => {
    const tx = db.transaction(storeNames, mode);
    let result;
    tx.oncomplete = () => resolve(result);
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
    const stores = storeNames.map(n => tx.objectStore(n));
    const r = fn(...stores);
    if (r && 'onsuccess' in r) r.onsuccess = () => { result = r.result; };
  }));
}

// Safari の古い版でも確実に保存できるよう、Blob は ArrayBuffer にして保存する
async function blobToStored(blob) {
  return { buf: await blob.arrayBuffer(), type: blob.type || 'image/jpeg' };
}
function storedToBlob(s) {
  if (!s) return null;
  if (s instanceof Blob) return s;
  return new Blob([s.buf], { type: s.type });
}

export const db = {
  async allEntries() {
    const list = await run(['entries'], 'readonly', s => s.getAll());
    return (list || []).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  },
  getEntry(id) { return run(['entries'], 'readonly', s => s.get(id)); },

  /** photo: { full: Blob, thumb: Blob } を渡すと写真も保存 */
  async saveEntry(entry, photo) {
    const stored = photo ? { id: entry.id, full: await blobToStored(photo.full), thumb: await blobToStored(photo.thumb) } : null;
    return run(['entries', 'photos'], 'readwrite', (es, ps) => {
      es.put(entry);
      if (stored) ps.put(stored);
    });
  },
  deleteEntry(id) {
    return run(['entries', 'photos'], 'readwrite', (es, ps) => { es.delete(id); ps.delete(id); });
  },
  async getPhoto(id) {
    const p = await run(['photos'], 'readonly', s => s.get(id));
    if (!p) return null;
    return { full: storedToBlob(p.full), thumb: storedToBlob(p.thumb) };
  },
  async getMeta(key, fallback) {
    const r = await run(['meta'], 'readonly', s => s.get(key));
    return r ? r.value : fallback;
  },
  setMeta(key, value) { return run(['meta'], 'readwrite', s => s.put({ key, value })); },
  async allMeta() {
    const list = await run(['meta'], 'readonly', s => s.getAll());
    return Object.fromEntries((list || []).map(m => [m.key, m.value]));
  },
  async clearAll() {
    return run(['entries', 'photos', 'meta'], 'readwrite', (a, b, c) => { a.clear(); b.clear(); c.clear(); });
  },
};
