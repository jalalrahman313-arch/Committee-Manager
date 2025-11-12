import { Committee, Member, Pair, Payment, Draw, AppData } from '../types';

const DB_NAME = 'CommitteeManagerDB';
const DB_VERSION = 4; // Bumped version for robust upgrade

let db: IDBDatabase;

const openDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    if (db) {
      return resolve(db);
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => {
      console.error('Error opening DB', request.error);
      reject(request.error);
    };

    request.onsuccess = (event) => {
      db = (event.target as IDBOpenDBRequest).result;
      resolve(db);
    };

    request.onupgradeneeded = (event) => {
      const dbInstance = (event.target as IDBOpenDBRequest).result;
      const tx = (event.target as IDBOpenDBRequest).transaction;
      if (!tx) return;

      // Helper to create stores and indexes idempotently.
      // This ensures that the schema is correct, whether it's a new DB or an upgrade.
      const createStoreWithIndexes = (
          // FIX: Corrected type 'IDBObjectStoreNames' to 'string' as it is not a valid TypeScript type for IndexedDB.
          storeName: string,
          keyPath: string,
          autoIncrement: boolean,
          indexes: { name: string; keyPath: string | string[]; options?: IDBIndexParameters }[]
      ) => {
          let store: IDBObjectStore;
          if (!dbInstance.objectStoreNames.contains(storeName)) {
              store = dbInstance.createObjectStore(storeName, { keyPath, autoIncrement });
          } else {
              store = tx.objectStore(storeName);
          }

          indexes.forEach(index => {
              if (!store.indexNames.contains(index.name)) {
                  store.createIndex(index.name, index.keyPath, index.options);
              }
          });
      };

      // Define the entire schema using the helper. This fixes any missing indexes on upgrade.
      createStoreWithIndexes('committees', 'id', true, []);
      
      createStoreWithIndexes('members', 'id', true, [
          { name: 'committeeId', keyPath: 'committeeId', options: { unique: false } }
      ]);

      createStoreWithIndexes('pairs', 'id', true, [
          { name: 'committeeId', keyPath: 'committeeId', options: { unique: false } }
      ]);
      
      createStoreWithIndexes('payments', 'id', true, [
          { name: 'committeeId', keyPath: 'committeeId', options: { unique: false } },
          { name: 'payer', keyPath: ['payerId', 'payerType'], options: { unique: false } }
      ]);
      
      createStoreWithIndexes('draws', 'id', true, [
          { name: 'committeeId', keyPath: 'committeeId', options: { unique: false } }
      ]);
    };
  });
};

const getStore = (storeName: string, mode: IDBTransactionMode) => {
  const tx = db.transaction(storeName, mode);
  return tx.objectStore(storeName);
};

// Generic CRUD operations
const add = async <T,>(storeName: string, item: T): Promise<number> => {
  await openDB();
  return new Promise((resolve, reject) => {
    const store = getStore(storeName, 'readwrite');
    const request = store.add(item);
    request.onsuccess = () => resolve(request.result as number);
    request.onerror = () => reject(request.error);
  });
};

const update = async <T,>(storeName: string, item: T): Promise<void> => {
    await openDB();
    return new Promise((resolve, reject) => {
        const store = getStore(storeName, 'readwrite');
        const request = store.put(item);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
    });
};

const getAll = async <T,>(storeName: string): Promise<T[]> => {
  await openDB();
  return new Promise((resolve, reject) => {
    const store = getStore(storeName, 'readonly');
    const request = store.getAll();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
};

const getByIndex = async <T,>(storeName: string, indexName: string, query: IDBValidKey): Promise<T[]> => {
  await openDB();
  return new Promise((resolve, reject) => {
    const store = getStore(storeName, 'readonly');
    const index = store.index(indexName);
    const request = index.getAll(query);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
};


const deleteById = async (storeName: string, id: number): Promise<void> => {
    await openDB();
    return new Promise((resolve, reject) => {
        const store = getStore(storeName, 'readwrite');
        const request = store.delete(id);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
    });
};


export const dbService = {
  init: openDB,
  
  // Committee
  addCommittee: (committee: Committee) => add<Committee>('committees', committee),
  getCommittees: () => getAll<Committee>('committees'),
  updateCommittee: (committee: Committee) => update<Committee>('committees', committee),
  deleteCommittee: async (id: number) => {
    await openDB();
    const storeNames: string[] = ['committees', 'members', 'pairs', 'payments', 'draws'];
    const tx = db.transaction(storeNames, 'readwrite');
    
    // 1. Delete the committee object itself
    tx.objectStore('committees').delete(id);

    // 2. Use cursors on the 'committeeId' index to delete all related data efficiently
    const keyRange = IDBKeyRange.only(id);
    
    for (const storeName of ['members', 'pairs', 'payments', 'draws']) {
        const store = tx.objectStore(storeName);
        if (store.indexNames.contains('committeeId')) {
            const index = store.index('committeeId');
            index.openCursor(keyRange).onsuccess = event => {
                const cursor = (event.target as IDBRequest<IDBCursor>).result;
                if (cursor) {
                    cursor.delete();
                    cursor.continue();
                }
            };
        }
    }

    return new Promise<void>((resolve, reject) => {
        tx.oncomplete = () => resolve();
        tx.onerror = () => {
            console.error(`Transaction Error in deleteCommittee for ID ${id}:`, tx.error);
            reject(tx.error);
        }
    });
  },

  // Member
  addMember: (member: Member) => add<Member>('members', member),
  updateMember: (member: Member) => update<Member>('members', member),
  deleteMember: async (memberId: number): Promise<void> => {
    await openDB();
    const tx = db.transaction(['members', 'payments'], 'readwrite');
    const memberStore = tx.objectStore('members');
    const paymentStore = tx.objectStore('payments');
    const paymentPayerIndex = paymentStore.index('payer');

    return new Promise<void>((resolve, reject) => {
        const memberReq = memberStore.get(memberId);
        memberReq.onsuccess = () => {
            const member = memberReq.result;
            if (!member) {
                tx.abort();
                return reject(new Error("Member not found"));
            }
            if (member.pairId) {
                tx.abort();
                return reject(new Error("Cannot delete a member that is part of a pair. Delete the pair instead."));
            }
            
            // Delete member
            memberStore.delete(memberId);
            
            // Delete payments for this member
            const paymentsReq = paymentPayerIndex.openCursor(IDBKeyRange.only([memberId, 'member']));
            paymentsReq.onsuccess = (event) => {
                const cursor = (event.target as IDBRequest<IDBCursorWithValue>).result;
                if (cursor) {
                    cursor.delete();
                    cursor.continue();
                }
            };
        };
        memberReq.onerror = () => reject(memberReq.error);
        tx.oncomplete = () => resolve();
        tx.onerror = () => {
            console.error(`Transaction Error in deleteMember for ID ${memberId}:`, tx.error);
            reject(tx.error);
        }
    });
  },
  getMembersByCommittee: (committeeId: number) => getByIndex<Member>('members', 'committeeId', committeeId),
  getMembers: () => getAll<Member>('members'),

  // Pair
  addPair: (pair: Pair) => add<Pair>('pairs', pair),
  updatePair: (pair: Pair) => update<Pair>('pairs', pair),
  deletePair: async (pairId: number): Promise<void> => {
    await openDB();
    const tx = db.transaction(['members', 'pairs', 'payments'], 'readwrite');
    const memberStore = tx.objectStore('members');
    const pairStore = tx.objectStore('pairs');
    const paymentStore = tx.objectStore('payments');
    const paymentPayerIndex = paymentStore.index('payer');

    return new Promise<void>((resolve, reject) => {
        const pairReq = pairStore.get(pairId);
        pairReq.onsuccess = () => {
            const pair = pairReq.result;
            if (!pair) {
                tx.abort();
                return reject(new Error("Pair not found"));
            }
            
            // Delete members of the pair
            memberStore.delete(pair.member1Id);
            memberStore.delete(pair.member2Id);
            
            // Delete pair itself
            pairStore.delete(pairId);
            
            // Delete payments for this pair
            const paymentsReq = paymentPayerIndex.openCursor(IDBKeyRange.only([pairId, 'pair']));
            paymentsReq.onsuccess = (event) => {
                const cursor = (event.target as IDBRequest<IDBCursorWithValue>).result;
                if (cursor) {
                    cursor.delete();
                    cursor.continue();
                }
            };
        };
        pairReq.onerror = () => reject(pairReq.error);
        tx.oncomplete = () => resolve();
        tx.onerror = () => {
            console.error(`Transaction Error in deletePair for ID ${pairId}:`, tx.error);
            reject(tx.error);
        }
    });
  },
  getPairsByCommittee: (committeeId: number) => getByIndex<Pair>('pairs', 'committeeId', committeeId),
  getPairs: () => getAll<Pair>('pairs'),

  // Payment
  addPayment: (payment: Payment) => add<Payment>('payments', payment),
  updatePayment: (payment: Payment) => update<Payment>('payments', payment),
  getPaymentsByCommittee: (committeeId: number) => getByIndex<Payment>('payments', 'committeeId', committeeId),

  // Draw
  addDraw: (draw: Draw) => add<Draw>('draws', draw),
  updateDraw: (draw: Draw) => update<Draw>('draws', draw),
  getDrawsByCommittee: (committeeId: number) => getByIndex<Draw>('draws', 'committeeId', committeeId),
  getDraws: () => getAll<Draw>('draws'),

  // Backup & Restore
  exportData: async (): Promise<AppData> => {
    await openDB();
    const committees = await getAll<Committee>('committees');
    const members = await getAll<Member>('members');
    const pairs = await getAll<Pair>('pairs');
    const payments = await getAll<Payment>('payments');
    const draws = await getAll<Draw>('draws');
    return { committees, members, pairs, payments, draws };
  },

  importData: async (data: AppData) => {
    await openDB();
    const tx = db.transaction(['committees', 'members', 'pairs', 'payments', 'draws'], 'readwrite');
    const stores = {
        committees: tx.objectStore('committees'),
        members: tx.objectStore('members'),
        pairs: tx.objectStore('pairs'),
        payments: tx.objectStore('payments'),
        draws: tx.objectStore('draws'),
    };

    // Clear existing data
    Object.values(stores).forEach(store => store.clear());

    // Import new data
    data.committees.forEach(item => stores.committees.add(item));
    data.members.forEach(item => stores.members.add(item));
    data.pairs.forEach(item => stores.pairs.add(item));
    data.payments.forEach(item => stores.payments.add(item));
    data.draws.forEach(item => stores.draws.add(item));

    return new Promise<void>((resolve, reject) => {
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
    });
  }
};