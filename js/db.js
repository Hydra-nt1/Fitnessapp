const DB_NAME = 'FitnessDB';
const DB_VERSION = 4;
let _db;

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onerror = () => reject(req.error);
    req.onsuccess = () => { _db = req.result; resolve(_db); };
    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains('plans')) {
        db.createObjectStore('plans', { keyPath: 'id', autoIncrement: true });
      }
      if (!db.objectStoreNames.contains('planExercises')) {
        const s = db.createObjectStore('planExercises', { keyPath: 'id', autoIncrement: true });
        s.createIndex('planId', 'planId');
      }
      if (!db.objectStoreNames.contains('workoutSessions')) {
        const s = db.createObjectStore('workoutSessions', { keyPath: 'id', autoIncrement: true });
        s.createIndex('startedAt', 'startedAt');
      }
      if (!db.objectStoreNames.contains('workoutSets')) {
        const s = db.createObjectStore('workoutSets', { keyPath: 'id', autoIncrement: true });
        s.createIndex('sessionId', 'sessionId');
      }
      if (!db.objectStoreNames.contains('bodyStats')) {
        const s = db.createObjectStore('bodyStats', { keyPath: 'id', autoIncrement: true });
        s.createIndex('date', 'date');
      }
      // NEW: week plan — one entry per day (key = day name)
      if (!db.objectStoreNames.contains('weekPlan')) {
        db.createObjectStore('weekPlan', { keyPath: 'day' });
      }
      if (!db.objectStoreNames.contains('customExercises')) {
        db.createObjectStore('customExercises', { keyPath: 'id', autoIncrement: true });
      }
      if (!db.objectStoreNames.contains('weekExercises')) {
        const s = db.createObjectStore('weekExercises', { keyPath: 'id', autoIncrement: true });
        s.createIndex('planExerciseId', 'planExerciseId');
        s.createIndex('weekStart', 'weekStart');
      }
    };
  });
}

function dbGetAll(store, idx, val) {
  return new Promise((resolve, reject) => {
    const tx = _db.transaction(store, 'readonly');
    const s = tx.objectStore(store);
    const req = (idx !== undefined) ? s.index(idx).getAll(val) : s.getAll();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function dbGet(store, id) {
  return new Promise((resolve, reject) => {
    const req = _db.transaction(store, 'readonly').objectStore(store).get(id);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function dbAdd(store, data) {
  return new Promise((resolve, reject) => {
    const req = _db.transaction(store, 'readwrite').objectStore(store).add(data);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function dbPut(store, data) {
  return new Promise((resolve, reject) => {
    const req = _db.transaction(store, 'readwrite').objectStore(store).put(data);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function dbDelete(store, id) {
  return new Promise((resolve, reject) => {
    const req = _db.transaction(store, 'readwrite').objectStore(store).delete(id);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}
