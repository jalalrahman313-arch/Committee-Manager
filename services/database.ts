import { Committee, Member, Pair, Payment, Draw, AppData } from '../types';

const DB_NAME = 'CommitteeManagerDB';
const DB_VERSION = 1;

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
      if (!dbInstance.objectStoreNames.contains('committees')) {
        dbInstance.createObjectStore('committees', { keyPath: 'id', autoIncrement: true });
      }
      if (!dbInstance.objectStoreNames.contains('members')) {
        const memberStore = dbInstance.createObjectStore('members', { keyPath: 'id', autoIncrement: true });
        memberStore.createIndex('committeeId', 'committeeId', { unique: false });
      }
      if (!dbInstance.objectStoreNames.contains('pairs')) {
        const pairStore = dbInstance.createObjectStore('pairs', { keyPath: 'id', autoIncrement: true });
        pairStore.createIndex('committeeId', 'committeeId', { unique: false });
      }
      if (!dbInstance.objectStoreNames.contains('payments')) {
        const paymentStore = dbInstance.createObjectStore('payments', { keyPath: 'id', autoIncrement: true });
        paymentStore.createIndex('committeeId', 'committeeId', { unique: false });
        paymentStore.createIndex('payer', ['payerId', 'payerType'], { unique: false });
      }
      if (!dbInstance.objectStoreNames.contains('draws')) {
        const drawStore = dbInstance.createObjectStore('draws', { keyPath: 'id', autoIncrement: true });
        drawStore.createIndex('committeeId', 'committeeId', { unique: false });
      }
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
    const members = await getByIndex<Member>('members', 'committeeId', id);
    const pairs = await getByIndex<Pair>('pairs', 'committeeId', id);
    const payments = await getByIndex<Payment>('payments', 'committeeId', id);
    const draws = await getByIndex<Draw>('draws', 'committeeId', id);

    const tx = db.transaction(['committees', 'members', 'pairs', 'payments', 'draws'], 'readwrite');
    const committeeStore = tx.objectStore('committees');
    const memberStore = tx.objectStore('members');
    const pairStore = tx.objectStore('pairs');
    const paymentStore = tx.objectStore('payments');
    const drawStore = tx.objectStore('draws');

    committeeStore.delete(id);
    for (const member of members) {
        if(member.id) memberStore.delete(member.id);
    }
    for (const pair of pairs) {
        if(pair.id) pairStore.delete(pair.id);
    }
     for (const payment of payments) {
        if(payment.id) paymentStore.delete(payment.id);
    }
    for (const draw of draws) {
        if(draw.id) drawStore.delete(draw.id);
    }

    return new Promise<void>((resolve, reject) => {
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
    });
  },

  // Member
  addMember: (member: Member) => add<Member>('members', member),
  updateMember: (member: Member) => update<Member>('members', member),
  getMembersByCommittee: (committeeId: number) => getByIndex<Member>('members', 'committeeId', committeeId),
  getMembers: () => getAll<Member>('members'),

  // Pair
  addPair: (pair: Pair) => add<Pair>('pairs', pair),
  updatePair: (pair: Pair) => update<Pair>('pairs', pair),
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