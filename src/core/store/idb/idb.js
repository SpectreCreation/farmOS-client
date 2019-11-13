import config from './idb.config';
import { filterAndSort, runUpgrades } from '@/utils/runUpgrades';

/**
 * Initialize a global counter for each store, eg:
 * const counter = {
 *  logs: 0,
 *  assets: 0,
 *  areas: 0,
 *  ...etc
 * }
 */
const counter = config.stores.reduce((countObj, store) => ({ ...countObj, [store.name]: 0 }), {});

function openDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(config.name, config.version);
    request.onerror = event => reject(event.target.errorcode);
    request.onsuccess = () => resolve(request.result);
    request.onupgradeneeded = event => config.stores
      .map(store => store.upgrades.reduce(filterAndSort(event.oldVersion), []))
      .forEach(upgrades => runUpgrades(event)(upgrades));
  });
}

function getRecords(db, storeName, predicate) {
  return new Promise((resolve, reject) => {
    const store = db.transaction(storeName, 'readonly').objectStore(storeName);
    if (!predicate) {
      const request = store.getAll();
      request.onerror = event => reject(event.target);
      request.onsuccess = event => resolve(event.target.result);
    } else {
      const request = store.openCursor();
      const results = [];
      request.onerror = event => reject(event.target);
      request.onsuccess = (event) => {
        const cursor = event.target.result;
        if (cursor) {
          if (predicate(cursor.value)) {
            results.push(cursor.value);
          }
          cursor.continue();
        } else {
          resolve(results);
        }
      };
    }
  });
}

function generateLocalID(db, storeName) {
  // Set a local counter so we don't increment the store counter more than once.
  let i = 1;
  return new Promise((resolve, reject) => {
    const store = db.transaction(storeName, 'readonly').objectStore(storeName);
    const request = store.openCursor(null, 'prevunique');
    request.onerror = event => reject(new Error(event.target.errorcode));
    request.onsuccess = (event) => {
      // Return if the cursor has already moved back more than once.
      if (i > 1) { return; }
      let newID;
      const cursor = event.target.result;
      if (cursor) {
        cursor.continue();
        if (counter[storeName] > cursor.value.local_id) {
          newID = counter[storeName] + 1;
        } else {
          newID = cursor.value.local_id + 1;
        }
      } else {
        newID = counter[storeName] + 1;
      }
      counter[storeName] = newID;
      i += 1;
      resolve(newID);
    };
  });
}

function saveRecord(db, storeName, record) {
  return new Promise((resolve, reject) => {
    const store = db.transaction(storeName, 'readwrite').objectStore(storeName);
    const request = store.put(record);
    request.onerror = event => reject(new Error(event.target.errorcode));
    request.onsuccess = event => resolve(event.target.result);
  });
}

function deleteRecord(db, storeName, key) {
  return new Promise((resolve, reject) => {
    const store = db.transaction(storeName, 'readwrite').objectStore(storeName);
    const request = store.delete(key);
    request.onsuccess = event => resolve(event.target.result);
    request.onerror = event => reject(event.error);
  });
}

function clearStore(db, storeName) {
  return new Promise((resolve, reject) => {
    const store = db.transaction(storeName, 'readwrite').objectStore(storeName);
    const request = store.clear();
    request.onsuccess = event => resolve(event.target.result);
    request.onerror = event => reject(event.error);
  });
}

export {
  openDatabase,
  getRecords,
  saveRecord,
  deleteRecord,
  clearStore,
  generateLocalID,
};
