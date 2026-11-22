import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  writeBatch,
} from 'firebase/firestore';
import { User } from 'firebase/auth';
import {
  EmailLog,
  OrderFile,
  PrintClient,
  PrintOrder,
  ShopSettings,
  WorkStatus,
} from '../types/printdesk';
import { db, handleFirestoreError, OperationType } from './firebase';
import { DEFAULT_SHOP_SETTINGS } from '../data/sampleData';
import { resetOrderSequences } from '../utils/formatters';

const LOCAL_ORDERS_KEY = 'printdesk_local_orders_v1';
const LOCAL_CLIENTS_KEY = 'printdesk_local_clients_v1';
const LOCAL_SETTINGS_KEY = 'printdesk_local_settings_v1';

// ============================================================================
// IndexedDB + In-Memory Blob Cache (untuk preview file instan)
// ============================================================================
const memoryBlobMap = new Map<string, Blob>();
const IDB_NAME = 'printdesk_file_cache';
const IDB_STORE = 'blobs';

function openBlobDb(): Promise<IDBDatabase | null> {
  if (typeof indexedDB === 'undefined') return Promise.resolve(null);
  return new Promise((resolve) => {
    try {
      const req = indexedDB.open(IDB_NAME, 1);
      req.onupgradeneeded = () => {
        const database = req.result;
        if (!database.objectStoreNames.contains(IDB_STORE)) {
          database.createObjectStore(IDB_STORE);
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

export async function cacheFileBlob(fileId: string, blob: Blob): Promise<void> {
  memoryBlobMap.set(fileId, blob);
  const database = await openBlobDb();
  if (!database) return;
  await new Promise<void>((resolve) => {
    try {
      const tx = database.transaction(IDB_STORE, 'readwrite');
      tx.objectStore(IDB_STORE).put(blob, fileId);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    } catch {
      resolve();
    }
  });
}

export async function getCachedFileBlob(fileId: string): Promise<Blob | null> {
  if (memoryBlobMap.has(fileId)) {
    return memoryBlobMap.get(fileId) || null;
  }
  const database = await openBlobDb();
  if (!database) return null;
  return new Promise<Blob | null>((resolve) => {
    try {
      const tx = database.transaction(IDB_STORE, 'readonly');
      const req = tx.objectStore(IDB_STORE).get(fileId);
      req.onsuccess = () => {
        const res = req.result as Blob | undefined;
        if (res) memoryBlobMap.set(fileId, res);
        resolve(res || null);
      };
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

export async function clearBlobCache(): Promise<void> {
  memoryBlobMap.clear();
  const database = await openBlobDb();
  if (!database) return;
  await new Promise<void>((resolve) => {
    try {
      const tx = database.transaction(IDB_STORE, 'readwrite');
      tx.objectStore(IDB_STORE).clear();
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    } catch {
      resolve();
    }
  });
}

// ============================================================================
// Sanitizer Helpers (Selaras dengan firestore.rules & firebase-blueprint.json)
// ============================================================================
function clampStr(val: unknown, max: number, fallback = ''): string {
  return String(val ?? fallback).trim().slice(0, max);
}

function clampNum(val: unknown, min = 0, max = 10000000000): number {
  const n = Number(val);
  if (!Number.isFinite(n)) return min;
  return Math.min(max, Math.max(min, n));
}

function sanitizeFiles(files: OrderFile[]): OrderFile[] {
  return files.slice(0, 20).map((f) => ({
    id: clampStr(f.id || `file_${Date.now()}`, 128, 'file_1'),
    name: clampStr(f.name || 'dokumen', 240, 'dokumen'),
    mimeType: clampStr(f.mimeType || 'application/octet-stream', 120),
    size: clampNum(f.size, 0, 10000000000),
    ...(f.driveFileId ? { driveFileId: clampStr(f.driveFileId, 128) } : {}),
    ...(f.webViewLink ? { webViewLink: clampStr(f.webViewLink, 500) } : {}),
    ...(f.webContentLink ? { webContentLink: clampStr(f.webContentLink, 500) } : {}),
    ...(f.driveFolderPath ? { driveFolderPath: clampStr(f.driveFolderPath, 240) } : {}),
    uploadedAt: clampStr(f.uploadedAt || new Date().toISOString(), 40),
  }));
}

function sanitizeEmailHistory(history: EmailLog[]): EmailLog[] {
  return history.slice(0, 50).map((item) => ({
    id: clampStr(item.id || `email_${Date.now()}`, 128, 'email_1'),
    sentAt: clampStr(item.sentAt || new Date().toISOString(), 40),
    recipients: (item.recipients || []).slice(0, 20).map((r) => clampStr(r, 160)),
    ...(item.cc && item.cc.length > 0
      ? { cc: item.cc.slice(0, 20).map((r) => clampStr(r, 160)) }
      : {}),
    subject: clampStr(item.subject, 200),
    mode: item.mode === 'lampiran' ? 'lampiran' : 'link_drive',
    ...(item.attachments && item.attachments.length > 0
      ? { attachments: item.attachments.slice(0, 20).map((a) => clampStr(a, 240)) }
      : {}),
    status: item.status === 'gagal' ? 'gagal' : 'berhasil',
    ...(item.errorMessage ? { errorMessage: clampStr(item.errorMessage, 300) } : {}),
  }));
}

function buildFirestoreOrderFields(uid: string, order: PrintOrder) {
  const totalPrice = clampNum(order.totalPrice);
  const dpAmount = clampNum(order.dpAmount);
  const remainingAmount = Math.max(0, totalPrice - dpAmount);

  return {
    id: clampStr(order.id, 128),
    ownerId: uid,
    orderCode: clampStr(order.orderCode, 40, 'PD-001'),
    clientId: clampStr(order.clientId || '', 128),
    clientName: clampStr(order.clientName, 120, 'Pelanggan'),
    clientPhone: clampStr(order.clientPhone, 32),
    clientEmail: clampStr(order.clientEmail || '', 160),
    printType: clampStr(order.printType, 120, 'Cetak Dokumen'),
    category: order.category,
    specs: {
      paperSize: clampStr(order.specs?.paperSize || 'A4', 60),
      orientation: clampStr(order.specs?.orientation || 'Portrait', 30),
      pageCount: clampNum(order.specs?.pageCount ?? 1, 1, 100000),
      copies: clampNum(order.specs?.copies ?? 1, 1, 100000),
      qtyUnit: clampStr(order.specs?.qtyUnit || 'PCS', 30),
      paperMaterial: clampStr(order.specs?.paperMaterial || 'HVS 80gsm', 80),
      colorMode: clampStr(order.specs?.colorMode || 'Full Color', 40),
      finishing: clampStr(order.specs?.finishing || 'Tanpa Finishing', 120),
    },
    files: sanitizeFiles(order.files || []),
    totalPrice,
    dpAmount,
    remainingAmount,
    workStatus: order.workStatus,
    paymentStatus: order.paymentStatus,
    pickupAt: clampStr(order.pickupAt || new Date().toISOString(), 40),
    pickedUp: Boolean(order.pickedUp),
    notes: clampStr(order.notes || '', 1000),
    emailHistory: sanitizeEmailHistory(order.emailHistory || []),
    vendorSentAt: clampStr(order.vendorSentAt || '', 40),
    vendorEmailHistory: sanitizeEmailHistory(order.vendorEmailHistory || []),
  };
}

function timestampToIso(val: unknown, fallback: string): string {
  if (val instanceof Timestamp) {
    return val.toDate().toISOString();
  }
  if (val && typeof (val as { toDate?: () => Date }).toDate === 'function') {
    return (val as { toDate: () => Date }).toDate().toISOString();
  }
  if (typeof val === 'string') return val;
  return fallback;
}

// ============================================================================
// Firestore Operations
// ============================================================================
export async function ensureUserProfile(user: User): Promise<void> {
  const path = `users/${user.uid}`;
  try {
    const ref = doc(db, 'users', user.uid);
    const snap = await getDoc(ref);
    if (!snap.exists()) {
      await setDoc(ref, {
        uid: user.uid,
        displayName: clampStr(user.displayName || 'Admin PrintDesk', 120),
        email: clampStr(user.email || 'user@printdesk.id', 160),
        photoUrl: clampStr(user.photoURL || '', 500),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } else {
      await updateDoc(ref, {
        displayName: clampStr(user.displayName || 'Admin PrintDesk', 120),
        email: clampStr(user.email || 'user@printdesk.id', 160),
        photoUrl: clampStr(user.photoURL || '', 500),
        updatedAt: serverTimestamp(),
      });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export function subscribeFirestoreOrders(
  uid: string,
  onData: (orders: PrintOrder[]) => void,
  onError: (err: Error) => void
): () => void {
  const path = `users/${uid}/orders`;
  const q = query(collection(db, 'users', uid, 'orders'), orderBy('createdAt', 'desc'));
  return onSnapshot(
    q,
    (snapshot) => {
      const nowIso = new Date().toISOString();
      const orders: PrintOrder[] = snapshot.docs.map((d) => {
        const data = d.data();
        return {
          id: d.id,
          ownerId: data.ownerId,
          orderCode: data.orderCode,
          clientId: data.clientId || '',
          clientName: data.clientName,
          clientPhone: data.clientPhone,
          clientEmail: data.clientEmail || '',
          printType: data.printType,
          category: data.category,
          specs: {
            ...data.specs,
            qtyUnit: data.specs?.qtyUnit || 'PCS',
          },
          files: data.files || [],
          totalPrice: Number(data.totalPrice) || 0,
          dpAmount: Number(data.dpAmount) || 0,
          remainingAmount: Number(data.remainingAmount) || 0,
          workStatus: data.workStatus,
          paymentStatus: data.paymentStatus,
          pickupAt: data.pickupAt,
          pickedUp: Boolean(data.pickedUp),
          notes: data.notes || '',
          emailHistory: data.emailHistory || [],
          vendorSentAt: data.vendorSentAt || '',
          vendorEmailHistory: data.vendorEmailHistory || [],
          createdAtIso: timestampToIso(data.createdAt, nowIso),
          updatedAtIso: timestampToIso(data.updatedAt, nowIso),
        };
      });
      onData(orders);
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.LIST, path);
      } catch (wrapped) {
        onError(wrapped as Error);
      }
    }
  );
}

export function subscribeFirestoreClients(
  uid: string,
  onData: (clients: PrintClient[]) => void,
  onError: (err: Error) => void
): () => void {
  const path = `users/${uid}/clients`;
  const q = query(collection(db, 'users', uid, 'clients'), orderBy('name', 'asc'));
  return onSnapshot(
    q,
    (snapshot) => {
      const nowIso = new Date().toISOString();
      const clients: PrintClient[] = snapshot.docs.map((d) => {
        const data = d.data();
        return {
          id: d.id,
          ownerId: data.ownerId,
          name: data.name,
          phone: data.phone,
          email: data.email || '',
          company: data.company || '',
          notes: data.notes || '',
          createdAtIso: timestampToIso(data.createdAt, nowIso),
          updatedAtIso: timestampToIso(data.updatedAt, nowIso),
        };
      });
      onData(clients);
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.LIST, path);
      } catch (wrapped) {
        onError(wrapped as Error);
      }
    }
  );
}

export function subscribeFirestoreSettings(
  uid: string,
  onData: (settings: ShopSettings) => void,
  onError: (err: Error) => void
): () => void {
  const path = `users/${uid}/settings/shop`;
  const ref = doc(db, 'users', uid, 'settings', 'shop');
  return onSnapshot(
    ref,
    (snap) => {
      if (!snap.exists()) {
        onData({ ...DEFAULT_SHOP_SETTINGS, ownerId: uid });
        return;
      }
      const data = snap.data();
      onData({
        ownerId: data.ownerId,
        shopName: data.shopName ?? '',
        shopAddress: data.shopAddress || '',
        shopPhone: data.shopPhone || '',
        shopEmail: data.shopEmail || '',
        logoDataUrl: data.logoDataUrl || '',
        driveRootFolder: data.driveRootFolder || 'PrintDesk',
        emailSubjectTemplate:
          data.emailSubjectTemplate || DEFAULT_SHOP_SETTINGS.emailSubjectTemplate,
        emailBodyTemplate:
          data.emailBodyTemplate || DEFAULT_SHOP_SETTINGS.emailBodyTemplate,
        vendorName: data.vendorName ?? DEFAULT_SHOP_SETTINGS.vendorName,
        vendorEmail: data.vendorEmail ?? DEFAULT_SHOP_SETTINGS.vendorEmail,
        vendorCcEmail: data.vendorCcEmail ?? '',
        vendorEmailBodyTemplate:
          data.vendorEmailBodyTemplate || DEFAULT_SHOP_SETTINGS.vendorEmailBodyTemplate,
        updatedAtIso: timestampToIso(data.updatedAt, new Date().toISOString()),
      });
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.GET, path);
      } catch (wrapped) {
        onError(wrapped as Error);
      }
    }
  );
}

export async function createOrderInFirestore(uid: string, order: PrintOrder): Promise<void> {
  const path = `users/${uid}/orders/${order.id}`;
  try {
    const payload = buildFirestoreOrderFields(uid, order);
    await setDoc(doc(db, 'users', uid, 'orders', order.id), {
      ...payload,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function updateOrderInFirestore(uid: string, order: PrintOrder): Promise<void> {
  const path = `users/${uid}/orders/${order.id}`;
  try {
    const payload = buildFirestoreOrderFields(uid, order);
    const { id: _id, ownerId: _ownerId, ...updatable } = payload;
    await updateDoc(doc(db, 'users', uid, 'orders', order.id), {
      ...updatable,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function updateOrderStatusInFirestore(
  uid: string,
  orderId: string,
  patch: Pick<
    PrintOrder,
    'workStatus' | 'paymentStatus' | 'dpAmount' | 'remainingAmount' | 'pickedUp'
  >
): Promise<void> {
  const path = `users/${uid}/orders/${orderId}`;
  try {
    await updateDoc(doc(db, 'users', uid, 'orders', orderId), {
      workStatus: patch.workStatus,
      paymentStatus: patch.paymentStatus,
      dpAmount: clampNum(patch.dpAmount),
      remainingAmount: clampNum(patch.remainingAmount),
      pickedUp: Boolean(patch.pickedUp),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function appendEmailLogInFirestore(
  uid: string,
  orderId: string,
  emailHistory: EmailLog[]
): Promise<void> {
  const path = `users/${uid}/orders/${orderId}`;
  try {
    await updateDoc(doc(db, 'users', uid, 'orders', orderId), {
      emailHistory: sanitizeEmailHistory(emailHistory),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function recordVendorEmailInFirestore(
  uid: string,
  orderId: string,
  vendorEmailHistory: EmailLog[],
  vendorSentAt?: string,
  nextWorkStatus?: WorkStatus
): Promise<void> {
  const path = `users/${uid}/orders/${orderId}`;
  try {
    const updatePayload: Record<string, unknown> = {
      vendorEmailHistory: sanitizeEmailHistory(vendorEmailHistory),
      updatedAt: serverTimestamp(),
    };
    if (vendorSentAt !== undefined) {
      updatePayload.vendorSentAt = clampStr(vendorSentAt, 40);
    }
    if (nextWorkStatus) {
      updatePayload.workStatus = nextWorkStatus;
    }
    await updateDoc(doc(db, 'users', uid, 'orders', orderId), updatePayload);
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function deleteOrderInFirestore(uid: string, orderId: string): Promise<void> {
  const path = `users/${uid}/orders/${orderId}`;
  try {
    await deleteDoc(doc(db, 'users', uid, 'orders', orderId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function saveClientInFirestore(
  uid: string,
  client: PrintClient,
  isNew: boolean
): Promise<void> {
  const path = `users/${uid}/clients/${client.id}`;
  try {
    const ref = doc(db, 'users', uid, 'clients', client.id);
    if (isNew) {
      await setDoc(ref, {
        id: clampStr(client.id, 128),
        ownerId: uid,
        name: clampStr(client.name, 120, 'Client'),
        phone: clampStr(client.phone, 32),
        email: clampStr(client.email || '', 160),
        company: clampStr(client.company || '', 120),
        notes: clampStr(client.notes || '', 500),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } else {
      await updateDoc(ref, {
        name: clampStr(client.name, 120, 'Client'),
        phone: clampStr(client.phone, 32),
        email: clampStr(client.email || '', 160),
        company: clampStr(client.company || '', 120),
        notes: clampStr(client.notes || '', 500),
        updatedAt: serverTimestamp(),
      });
    }
  } catch (error) {
    handleFirestoreError(error, isNew ? OperationType.CREATE : OperationType.UPDATE, path);
  }
}

export async function deleteClientInFirestore(uid: string, clientId: string): Promise<void> {
  const path = `users/${uid}/clients/${clientId}`;
  try {
    await deleteDoc(doc(db, 'users', uid, 'clients', clientId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function saveSettingsInFirestore(
  uid: string,
  settings: ShopSettings
): Promise<void> {
  const path = `users/${uid}/settings/shop`;
  try {
    const ref = doc(db, 'users', uid, 'settings', 'shop');
    const existingSnap = await getDoc(ref);
    const payload = {
      ownerId: uid,
      shopName: clampStr(settings.shopName ?? '', 120),
      shopAddress: clampStr(settings.shopAddress ?? '', 240),
      shopPhone: clampStr(settings.shopPhone ?? '', 40),
      shopEmail: clampStr(settings.shopEmail ?? '', 160),
      logoDataUrl: clampStr(settings.logoDataUrl || '', 300000),
      driveRootFolder: clampStr(settings.driveRootFolder, 100, 'PrintDesk'),
      emailSubjectTemplate: clampStr(settings.emailSubjectTemplate, 200),
      emailBodyTemplate: clampStr(settings.emailBodyTemplate, 2000),
      vendorName: clampStr(settings.vendorName || '', 120),
      vendorEmail: clampStr(settings.vendorEmail || '', 320),
      vendorCcEmail: clampStr(settings.vendorCcEmail || '', 320),
      vendorEmailBodyTemplate: clampStr(settings.vendorEmailBodyTemplate || '', 2000),
      updatedAt: serverTimestamp(),
    };
    if (!existingSnap.exists()) {
      await setDoc(ref, payload);
    } else {
      const { ownerId: _owner, ...updatable } = payload;
      await updateDoc(ref, updatable);
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export function isFirestorePermissionError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err ?? '');
  const lower = msg.toLowerCase();
  return (
    lower.includes('permission-denied') ||
    lower.includes('missing or insufficient permissions') ||
    lower.includes('permission_denied') ||
    lower.includes('akses database firestore ditolak')
  );
}

export async function resetAllAppData(params: {
  uid?: string | null;
  includeSettings: boolean;
}): Promise<void> {
  const { uid, includeSettings } = params;

  if (uid) {
    try {
      const ordersSnap = await getDocs(collection(db, 'users', uid, 'orders'));
      const clientsSnap = await getDocs(collection(db, 'users', uid, 'clients'));

      const refsToDelete = [
        ...ordersSnap.docs.map((d) => d.ref),
        ...clientsSnap.docs.map((d) => d.ref),
      ];

      if (includeSettings) {
        refsToDelete.push(doc(db, 'users', uid, 'settings', 'shop'));
      }

      for (let i = 0; i < refsToDelete.length; i += 400) {
        const batch = writeBatch(db);
        const chunk = refsToDelete.slice(i, i + 400);
        for (const ref of chunk) {
          batch.delete(ref);
        }
        await batch.commit();
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `users/${uid}/reset`);
    }
  }

  localStorage.removeItem(LOCAL_ORDERS_KEY);
  localStorage.removeItem(LOCAL_CLIENTS_KEY);
  if (includeSettings) {
    localStorage.removeItem(LOCAL_SETTINGS_KEY);
  }
  resetOrderSequences();
  await clearBlobCache();
}

// ============================================================================
// LocalStorage Fallback (Dimulai dalam kondisi KOSONG bersih)
// ============================================================================
export function loadLocalData(): {
  orders: PrintOrder[];
  clients: PrintClient[];
  settings: ShopSettings;
} {
  try {
    const rawOrders = localStorage.getItem(LOCAL_ORDERS_KEY);
    const rawClients = localStorage.getItem(LOCAL_CLIENTS_KEY);
    const rawSettings = localStorage.getItem(LOCAL_SETTINGS_KEY);

    const parsedOrders: PrintOrder[] = rawOrders ? JSON.parse(rawOrders) : [];
    const orders: PrintOrder[] = parsedOrders.map((o) => ({
      ...o,
      specs: {
        ...o.specs,
        qtyUnit: o.specs?.qtyUnit || 'PCS',
      },
      emailHistory: o.emailHistory || [],
      vendorSentAt: o.vendorSentAt || '',
      vendorEmailHistory: o.vendorEmailHistory || [],
    }));
    const clients: PrintClient[] = rawClients ? JSON.parse(rawClients) : [];
    const settings: ShopSettings = rawSettings
      ? { ...DEFAULT_SHOP_SETTINGS, ...JSON.parse(rawSettings) }
      : { ...DEFAULT_SHOP_SETTINGS };

    return { orders, clients, settings };
  } catch {
    return {
      orders: [],
      clients: [],
      settings: { ...DEFAULT_SHOP_SETTINGS },
    };
  }
}

export function saveLocalOrders(orders: PrintOrder[]): void {
  localStorage.setItem(LOCAL_ORDERS_KEY, JSON.stringify(orders));
}

export function saveLocalClients(clients: PrintClient[]): void {
  localStorage.setItem(LOCAL_CLIENTS_KEY, JSON.stringify(clients));
}

export function saveLocalSettings(settings: ShopSettings): void {
  localStorage.setItem(LOCAL_SETTINGS_KEY, JSON.stringify(settings));
}
