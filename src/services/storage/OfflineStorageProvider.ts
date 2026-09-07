export interface OfflineStorageItem {
  id: string; // e.g. "lesson_123_video_456"
  lessonId: string;
  type: 'SLIDE' | 'VIDEO' | 'AUDIO' | 'DOCUMENT';
  title: string;
  mediaUrl: string;
  localBlobUrl?: string;
  blobData?: Blob;
  sizeBytes: number;
  version: number;
  checksum?: string;
  savedAt: string;
}

export class OfflineStorageProvider {
  private dbName = 'GDCTV4_OfflineMediaDB';
  private dbVersion = 1;
  private storeName = 'offline_media';

  private openDB(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.dbVersion);

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(this.storeName)) {
          const store = db.createObjectStore(this.storeName, { keyPath: 'id' });
          store.createIndex('lessonId', 'lessonId', { unique: false });
          store.createIndex('type', 'type', { unique: false });
        }
      };

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async saveMediaOffline(item: Omit<OfflineStorageItem, 'savedAt'>, fileBlob: Blob): Promise<OfflineStorageItem> {
    const db = await this.openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(this.storeName, 'readwrite');
      const store = tx.objectStore(this.storeName);

      const record: OfflineStorageItem = {
        ...item,
        blobData: fileBlob,
        sizeBytes: fileBlob.size || item.sizeBytes || 0,
        savedAt: new Date().toISOString()
      };

      const req = store.put(record);
      req.onsuccess = () => {
        resolve({
          ...record,
          localBlobUrl: URL.createObjectURL(fileBlob)
        });
      };
      req.onerror = () => reject(req.error);
    });
  }

  async getOfflineMedia(id: string): Promise<OfflineStorageItem | null> {
    const db = await this.openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(this.storeName, 'readonly');
      const store = tx.objectStore(this.storeName);
      const req = store.get(id);

      req.onsuccess = () => {
        const res = req.result as OfflineStorageItem | undefined;
        if (!res) return resolve(null);
        if (res.blobData) {
          res.localBlobUrl = URL.createObjectURL(res.blobData);
        }
        resolve(res);
      };
      req.onerror = () => reject(req.error);
    });
  }

  async getOfflineMediaByLesson(lessonId: string): Promise<OfflineStorageItem[]> {
    const db = await this.openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(this.storeName, 'readonly');
      const store = tx.objectStore(this.storeName);
      const index = store.index('lessonId');
      const req = index.getAll(lessonId);

      req.onsuccess = () => {
        const items = (req.result as OfflineStorageItem[]).map(item => {
          if (item.blobData) {
            item.localBlobUrl = URL.createObjectURL(item.blobData);
          }
          return item;
        });
        resolve(items);
      };
      req.onerror = () => reject(req.error);
    });
  }

  async removeOfflineMedia(id: string): Promise<boolean> {
    const db = await this.openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(this.storeName, 'readwrite');
      const store = tx.objectStore(this.storeName);
      const req = store.delete(id);

      req.onsuccess = () => resolve(true);
      req.onerror = () => reject(false);
    });
  }

  async clearLessonOfflineMedia(lessonId: string): Promise<boolean> {
    const items = await this.getOfflineMediaByLesson(lessonId);
    for (const item of items) {
      await this.removeOfflineMedia(item.id);
    }
    return true;
  }

  async getTotalOfflineSize(): Promise<{ totalBytes: number; totalMb: number; itemCount: number }> {
    const db = await this.openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(this.storeName, 'readonly');
      const store = tx.objectStore(this.storeName);
      const req = store.getAll();

      req.onsuccess = () => {
        const items = req.result as OfflineStorageItem[];
        let totalBytes = 0;
        for (const item of items) {
          totalBytes += item.sizeBytes || (item.blobData ? item.blobData.size : 0);
        }
        resolve({
          totalBytes,
          totalMb: Math.round((totalBytes / (1024 * 1024)) * 100) / 100,
          itemCount: items.length
        });
      };
      req.onerror = () => reject(req.error);
    });
  }
}

export const offlineStorageProvider = new OfflineStorageProvider();
