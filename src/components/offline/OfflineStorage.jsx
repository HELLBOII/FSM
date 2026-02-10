/**
 * Offline Storage Manager using IndexedDB
 */

const DB_NAME = 'IrriServeOffline';
const DB_VERSION = 1;
const STORES = {
  JOBS: 'jobs',
  SYNC_QUEUE: 'syncQueue',
  PHOTOS: 'photos'
};

class OfflineStorage {
  constructor() {
    this.db = null;
  }

  async init() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        resolve(this.db);
      };

      request.onupgradeneeded = (event) => {
        const db = event.target.result;

        // Jobs store
        if (!db.objectStoreNames.contains(STORES.JOBS)) {
          db.createObjectStore(STORES.JOBS, { keyPath: 'id' });
        }

        // Sync queue store
        if (!db.objectStoreNames.contains(STORES.SYNC_QUEUE)) {
          const queueStore = db.createObjectStore(STORES.SYNC_QUEUE, { 
            keyPath: 'id', 
            autoIncrement: true 
          });
          queueStore.createIndex('timestamp', 'timestamp', { unique: false });
        }

        // Photos store
        if (!db.objectStoreNames.contains(STORES.PHOTOS)) {
          db.createObjectStore(STORES.PHOTOS, { keyPath: 'id' });
        }
      };
    });
  }

  // Jobs
  async saveJob(job) {
    const tx = this.db.transaction(STORES.JOBS, 'readwrite');
    await tx.objectStore(STORES.JOBS).put(job);
    return tx.complete;
  }

  async saveJobs(jobs) {
    const tx = this.db.transaction(STORES.JOBS, 'readwrite');
    const store = tx.objectStore(STORES.JOBS);
    for (const job of jobs) {
      await store.put(job);
    }
    return tx.complete;
  }

  async getJob(id) {
    const tx = this.db.transaction(STORES.JOBS, 'readonly');
    return tx.objectStore(STORES.JOBS).get(id);
  }

  async getAllJobs() {
    const tx = this.db.transaction(STORES.JOBS, 'readonly');
    return tx.objectStore(STORES.JOBS).getAll();
  }

  // Sync Queue
  async addToSyncQueue(action) {
    const tx = this.db.transaction(STORES.SYNC_QUEUE, 'readwrite');
    const item = {
      ...action,
      timestamp: Date.now(),
      synced: false
    };
    await tx.objectStore(STORES.SYNC_QUEUE).add(item);
    return tx.complete;
  }

  async getSyncQueue() {
    const tx = this.db.transaction(STORES.SYNC_QUEUE, 'readonly');
    return tx.objectStore(SYNC_QUEUE).getAll();
  }

  async clearSyncQueue() {
    const tx = this.db.transaction(STORES.SYNC_QUEUE, 'readwrite');
    await tx.objectStore(STORES.SYNC_QUEUE).clear();
    return tx.complete;
  }

  async removeSyncItem(id) {
    const tx = this.db.transaction(STORES.SYNC_QUEUE, 'readwrite');
    await tx.objectStore(STORES.SYNC_QUEUE).delete(id);
    return tx.complete;
  }

  // Photos
  async savePhoto(photo) {
    const tx = this.db.transaction(STORES.PHOTOS, 'readwrite');
    await tx.objectStore(STORES.PHOTOS).put(photo);
    return tx.complete;
  }

  async getPhoto(id) {
    const tx = this.db.transaction(STORES.PHOTOS, 'readonly');
    return tx.objectStore(STORES.PHOTOS).get(id);
  }

  async deletePhoto(id) {
    const tx = this.db.transaction(STORES.PHOTOS, 'readwrite');
    await tx.objectStore(STORES.PHOTOS).delete(id);
    return tx.complete;
  }
}

export const offlineStorage = new OfflineStorage();