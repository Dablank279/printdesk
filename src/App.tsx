import { useEffect, useMemo, useState } from 'react';
import { User } from 'firebase/auth';
import {
  AppPage,
  EmailLog,
  PrintClient,
  PrintOrder,
  ShopSettings,
  WorkStatus,
} from './types/printdesk';
import {
  getAccessToken,
  googleSignIn,
  initAuth,
  logoutGoogle,
  testFirestoreConnection,
} from './services/firebase';
import {
  appendEmailLogInFirestore,
  createOrderInFirestore,
  deleteClientInFirestore,
  deleteOrderInFirestore,
  ensureUserProfile,
  loadLocalData,
  recordVendorEmailInFirestore,
  resetAllAppData,
  saveClientInFirestore,
  saveLocalClients,
  saveLocalOrders,
  saveLocalSettings,
  saveSettingsInFirestore,
  subscribeFirestoreClients,
  subscribeFirestoreOrders,
  subscribeFirestoreSettings,
  updateOrderInFirestore,
  updateOrderStatusInFirestore,
} from './services/storageService';
import { DEFAULT_SHOP_SETTINGS } from './data/sampleData';
import {
  commitOrderSequence,
  exportBackupJson,
  getPickupUrgency,
} from './utils/formatters';
import { ErrorBoundary } from './components/ErrorBoundary';
import { LoginView } from './components/LoginView';
import { Sidebar } from './components/Sidebar';
import { TopBar } from './components/TopBar';
import { DashboardView } from './components/DashboardView';
import { OrderFormView } from './components/OrderFormView';
import { OrderDetailView } from './components/OrderDetailView';
import { ScheduleView } from './components/ScheduleView';
import { ClientsView } from './components/ClientsView';
import { SettingsView } from './components/SettingsView';
import { DocumentPreviewModal } from './components/DocumentPreviewModal';
import { EmailModal } from './components/EmailModal';
import { VendorEmailModal } from './components/VendorEmailModal';
import { ReceiptPrintModal } from './components/ReceiptPrintModal';
import { AlertCircle, CheckCircle2, Loader2, X } from 'lucide-react';

const DARK_MODE_STORAGE_KEY = 'printdesk_theme';
const LOCAL_SESSION_KEY = 'printdesk_local_session';

function PrintDeskApp() {
  const [darkMode, setDarkMode] = useState<boolean>(() => {
    const saved = localStorage.getItem(DARK_MODE_STORAGE_KEY);
    if (saved === 'dark') return true;
    if (saved === 'light') return false;
    return window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false;
  });

  useEffect(() => {
    const root = document.documentElement;
    if (darkMode) {
      root.classList.add('dark');
      localStorage.setItem(DARK_MODE_STORAGE_KEY, 'dark');
    } else {
      root.classList.remove('dark');
      localStorage.setItem(DARK_MODE_STORAGE_KEY, 'light');
    }
  }, [darkMode]);

  // Auth & session state
  const [authReady, setAuthReady] = useState(false);
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [isLocalMode, setIsLocalMode] = useState<boolean>(
    () => localStorage.getItem(LOCAL_SESSION_KEY) === '1'
  );
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);

  // Domain data state (selalu mulai kosong tanpa data contoh)
  const [orders, setOrders] = useState<PrintOrder[]>([]);
  const [clients, setClients] = useState<PrintClient[]>([]);
  const [settings, setSettings] = useState<ShopSettings>(DEFAULT_SHOP_SETTINGS);
  const [loadingData, setLoadingData] = useState(false);
  const [firestoreError, setFirestoreError] = useState<Error | null>(null);

  // Navigation, Modal & Toast state
  const [activePage, setActivePage] = useState<AppPage>('dashboard');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [globalSearch, setGlobalSearch] = useState('');
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);

  const [previewTarget, setPreviewTarget] = useState<{
    order: PrintOrder;
    fileIndex: number;
  } | null>(null);
  const [emailTarget, setEmailTarget] = useState<PrintOrder | null>(null);
  const [vendorEmailTarget, setVendorEmailTarget] = useState<PrintOrder | null>(null);
  const [receiptTarget, setReceiptTarget] = useState<PrintOrder | null>(null);

  const [toast, setToast] = useState<{
    message: string;
    tone: 'success' | 'error';
  } | null>(null);

  const notifyToast = (message: string, tone: 'success' | 'error' = 'success') => {
    setToast({ message, tone });
  };

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 4500);
    return () => clearTimeout(timer);
  }, [toast]);

  if (firestoreError) {
    throw firestoreError;
  }

  // Test Firestore connection on mount + init auth listener
  useEffect(() => {
    testFirestoreConnection();
    const unsub = initAuth(
      (user, token) => {
        setFirebaseUser(user);
        setAccessToken(token || getAccessToken());
        setIsLocalMode(false);
        localStorage.removeItem(LOCAL_SESSION_KEY);
        setAuthReady(true);
      },
      () => {
        setFirebaseUser(null);
        setAccessToken(null);
        setAuthReady(true);
      }
    );
    return () => unsub();
  }, []);

  // Load & subscribe to data (Firestore when signed in, localStorage when in local mode)
  useEffect(() => {
    if (!authReady) return;

    if (firebaseUser) {
      let unsubOrders: (() => void) | undefined;
      let unsubClients: (() => void) | undefined;
      let unsubSettings: (() => void) | undefined;

      setLoadingData(true);
      const startFirestore = async () => {
        try {
          await ensureUserProfile(firebaseUser);

          unsubOrders = subscribeFirestoreOrders(
            firebaseUser.uid,
            (list) => {
              setOrders(list);
              setLoadingData(false);
            },
            (err) => setFirestoreError(err)
          );
          unsubClients = subscribeFirestoreClients(
            firebaseUser.uid,
            (list) => setClients(list),
            (err) => setFirestoreError(err)
          );
          unsubSettings = subscribeFirestoreSettings(
            firebaseUser.uid,
            (s) => setSettings(s),
            (err) => setFirestoreError(err)
          );
        } catch (err) {
          setLoadingData(false);
          setFirestoreError(
            err instanceof Error ? err : new Error('Gagal terhubung ke Firestore.')
          );
        }
      };

      startFirestore();
      return () => {
        if (unsubOrders) unsubOrders();
        if (unsubClients) unsubClients();
        if (unsubSettings) unsubSettings();
      };
    }

    if (isLocalMode) {
      const local = loadLocalData();
      setOrders(local.orders);
      setClients(local.clients);
      setSettings(local.settings);
      setLoadingData(false);
    }
  }, [authReady, firebaseUser, isLocalMode]);

  const handleGoogleLogin = async (): Promise<string | null> => {
    setIsLoggingIn(true);
    setLoginError(null);
    try {
      const { user, accessToken: token } = await googleSignIn();
      setFirebaseUser(user);
      setAccessToken(token);
      setIsLocalMode(false);
      localStorage.removeItem(LOCAL_SESSION_KEY);
      return token;
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : 'Gagal masuk dengan Google.';
      setLoginError(msg);
      return null;
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleEnterLocalMode = () => {
    localStorage.setItem(LOCAL_SESSION_KEY, '1');
    setIsLocalMode(true);
  };

  const handleLogout = async () => {
    if (firebaseUser) {
      await logoutGoogle();
    }
    localStorage.removeItem(LOCAL_SESSION_KEY);
    setIsLocalMode(false);
    setFirebaseUser(null);
    setAccessToken(null);
    setActivePage('dashboard');
  };

  const ownerId = firebaseUser?.uid || 'local';

  // CRUD Handlers (Firestore + LocalStorage)
  const handleSaveOrder = async (
    order: PrintOrder,
    newClientIfAny?: PrintClient
  ) => {
    const isNew = !orders.some((o) => o.id === order.id);

    if (firebaseUser) {
      if (newClientIfAny) {
        await saveClientInFirestore(firebaseUser.uid, newClientIfAny, true);
      }
      if (isNew) {
        await createOrderInFirestore(firebaseUser.uid, order);
      } else {
        await updateOrderInFirestore(firebaseUser.uid, order);
      }
    } else {
      if (newClientIfAny) {
        const nextClients = [...clients, newClientIfAny];
        setClients(nextClients);
        saveLocalClients(nextClients);
      }
      const nextOrders = isNew
        ? [order, ...orders]
        : orders.map((o) => (o.id === order.id ? order : o));
      setOrders(nextOrders);
      saveLocalOrders(nextOrders);
    }

    if (isNew) {
      commitOrderSequence(order.orderCode);
    }

    setSelectedOrderId(order.id);
    setActivePage('order-detail');
  };

  const handleChangeWorkStatus = async (
    order: PrintOrder,
    nextStatus: WorkStatus
  ) => {
    const patch = {
      workStatus: nextStatus,
      paymentStatus: order.paymentStatus,
      dpAmount: order.dpAmount,
      remainingAmount: order.remainingAmount,
      pickedUp: order.pickedUp,
    };
    if (firebaseUser) {
      await updateOrderStatusInFirestore(firebaseUser.uid, order.id, patch);
    } else {
      const nextOrders = orders.map((o) =>
        o.id === order.id
          ? { ...o, ...patch, updatedAtIso: new Date().toISOString() }
          : o
      );
      setOrders(nextOrders);
      saveLocalOrders(nextOrders);
    }
  };

  const handleUpdateOrderStatus = async (
    order: PrintOrder,
    patch: Pick<
      PrintOrder,
      'workStatus' | 'paymentStatus' | 'dpAmount' | 'remainingAmount' | 'pickedUp'
    >
  ) => {
    if (firebaseUser) {
      await updateOrderStatusInFirestore(firebaseUser.uid, order.id, patch);
    } else {
      const nextOrders = orders.map((o) =>
        o.id === order.id
          ? { ...o, ...patch, updatedAtIso: new Date().toISOString() }
          : o
      );
      setOrders(nextOrders);
      saveLocalOrders(nextOrders);
    }
  };

  const handleDeleteOrder = async (orderId: string) => {
    if (firebaseUser) {
      await deleteOrderInFirestore(firebaseUser.uid, orderId);
    } else {
      const nextOrders = orders.filter((o) => o.id !== orderId);
      setOrders(nextOrders);
      saveLocalOrders(nextOrders);
    }
    setSelectedOrderId(null);
    setActivePage('dashboard');
  };

  const handleRemoveFileFromOrder = async (
    order: PrintOrder,
    fileId: string
  ) => {
    const updatedOrder: PrintOrder = {
      ...order,
      files: order.files.filter((f) => f.id !== fileId),
      updatedAtIso: new Date().toISOString(),
    };
    if (firebaseUser) {
      await updateOrderInFirestore(firebaseUser.uid, updatedOrder);
    } else {
      const nextOrders = orders.map((o) =>
        o.id === order.id ? updatedOrder : o
      );
      setOrders(nextOrders);
      saveLocalOrders(nextOrders);
    }
  };

  const handleRecordEmailLog = async (orderId: string, log: EmailLog) => {
    const target = orders.find((o) => o.id === orderId);
    if (!target) return;
    const nextHistory = [log, ...target.emailHistory].slice(0, 50);

    if (firebaseUser) {
      await appendEmailLogInFirestore(firebaseUser.uid, orderId, nextHistory);
    } else {
      const nextOrders = orders.map((o) =>
        o.id === orderId
          ? {
              ...o,
              emailHistory: nextHistory,
              updatedAtIso: new Date().toISOString(),
            }
          : o
      );
      setOrders(nextOrders);
      saveLocalOrders(nextOrders);
    }
  };

  const handleRecordVendorEmail = async (params: {
    orderId: string;
    log: EmailLog;
    succeeded: boolean;
    markInProgress: boolean;
  }) => {
    const target = orders.find((o) => o.id === params.orderId);
    if (!target) return;
    const nextHistory = [params.log, ...(target.vendorEmailHistory || [])].slice(0, 50);
    const nextSentAt = params.succeeded ? params.log.sentAt : target.vendorSentAt;
    const nextWorkStatus: WorkStatus | undefined =
      params.succeeded && params.markInProgress ? 'dalam_proses' : undefined;

    if (firebaseUser) {
      await recordVendorEmailInFirestore(
        firebaseUser.uid,
        params.orderId,
        nextHistory,
        nextSentAt,
        nextWorkStatus
      );
    } else {
      const nextOrders = orders.map((o) =>
        o.id === params.orderId
          ? {
              ...o,
              vendorEmailHistory: nextHistory,
              ...(nextSentAt !== undefined ? { vendorSentAt: nextSentAt } : {}),
              ...(nextWorkStatus ? { workStatus: nextWorkStatus } : {}),
              updatedAtIso: new Date().toISOString(),
            }
          : o
      );
      setOrders(nextOrders);
      saveLocalOrders(nextOrders);
    }
  };

  const handleSaveClient = async (client: PrintClient, isNew: boolean) => {
    if (firebaseUser) {
      await saveClientInFirestore(firebaseUser.uid, client, isNew);
    } else {
      const next = isNew
        ? [...clients, client]
        : clients.map((c) => (c.id === client.id ? client : c));
      setClients(next);
      saveLocalClients(next);
    }
  };

  const handleDeleteClient = async (clientId: string) => {
    if (firebaseUser) {
      await deleteClientInFirestore(firebaseUser.uid, clientId);
    } else {
      const next = clients.filter((c) => c.id !== clientId);
      setClients(next);
      saveLocalClients(next);
    }
  };

  const handleSaveSettings = async (nextSettings: ShopSettings) => {
    if (firebaseUser) {
      await saveSettingsInFirestore(firebaseUser.uid, nextSettings);
    } else {
      setSettings(nextSettings);
      saveLocalSettings(nextSettings);
    }
  };

  const handleDownloadBackup = () => {
    exportBackupJson({ orders, clients, settings });
    notifyToast('File backup JSON berhasil diunduh.', 'success');
  };

  const handleResetAllData = async (includeSettings: boolean) => {
    await resetAllAppData({
      uid: firebaseUser?.uid,
      includeSettings,
    });
    setOrders([]);
    setClients([]);
    setSelectedOrderId(null);
    setGlobalSearch('');
    if (includeSettings) {
      setSettings({ ...DEFAULT_SHOP_SETTINGS, ownerId });
    }
    setActivePage('dashboard');
    notifyToast('Semua data berhasil direset', 'success');
  };

  const activeOrder = useMemo(
    () => orders.find((o) => o.id === selectedOrderId) || null,
    [orders, selectedOrderId]
  );

  const overdueCount = useMemo(
    () =>
      orders.filter((o) => getPickupUrgency(o.pickupAt, o.pickedUp).isOverdue)
        .length,
    [orders]
  );

  if (!authReady) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col items-center justify-center gap-3 text-slate-500 dark:text-slate-400">
        <Loader2 className="w-7 h-7 animate-spin text-orange-600" />
        <span className="text-sm font-medium">Menyiapkan PrintDesk...</span>
      </div>
    );
  }

  if (!firebaseUser && !isLocalMode) {
    return (
      <LoginView
        onGoogleLogin={async () => {
          await handleGoogleLogin();
        }}
        onEnterLocalMode={handleEnterLocalMode}
        isLoggingIn={isLoggingIn}
        errorMessage={loginError}
        darkMode={darkMode}
        onToggleDarkMode={() => setDarkMode((d) => !d)}
      />
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex text-slate-900 dark:text-slate-100">
      <Sidebar
        activePage={activePage}
        onNavigate={(page) => {
          setActivePage(page);
          if (page !== 'order-detail' && page !== 'order-edit') {
            setSelectedOrderId(null);
          }
        }}
        mobileOpen={mobileMenuOpen}
        onCloseMobile={() => setMobileMenuOpen(false)}
        shopName={settings.shopName}
        userDisplayName={firebaseUser?.displayName || 'Staf Percetakan'}
        userEmail={firebaseUser?.email || 'lokal@printdesk.id'}
        userPhotoUrl={firebaseUser?.photoURL || undefined}
        isLocalMode={isLocalMode && !firebaseUser}
        hasGoogleToken={Boolean(accessToken)}
        onConnectGoogle={handleGoogleLogin}
        onLogout={handleLogout}
        overdueCount={overdueCount}
      />

      <div className="flex-1 min-w-0 flex flex-col">
        <TopBar
          activePage={activePage}
          onOpenMobileMenu={() => setMobileMenuOpen(true)}
          globalSearch={globalSearch}
          onGlobalSearchChange={(v) => {
            setGlobalSearch(v);
            if (v && activePage !== 'dashboard') {
              setActivePage('dashboard');
            }
          }}
          orders={orders}
          onSelectOrder={(id) => {
            setSelectedOrderId(id);
            setActivePage('order-detail');
          }}
          onNewOrder={() => {
            setSelectedOrderId(null);
            setActivePage('order-new');
          }}
          darkMode={darkMode}
          onToggleDarkMode={() => setDarkMode((d) => !d)}
        />

        <main className="flex-1 p-4 sm:p-6 lg:p-8 no-print">
          {loadingData ? (
            <div className="py-20 flex flex-col items-center justify-center gap-3 text-slate-500 dark:text-slate-400">
              <Loader2 className="w-7 h-7 animate-spin text-orange-600" />
              <span className="text-sm">Memuat data order dari cloud...</span>
            </div>
          ) : (
            <>
              {activePage === 'dashboard' && (
                <DashboardView
                  orders={orders}
                  settings={settings}
                  globalSearch={globalSearch}
                  onGlobalSearchChange={setGlobalSearch}
                  onChangeWorkStatus={handleChangeWorkStatus}
                  onOpenDetail={(id) => {
                    setSelectedOrderId(id);
                    setActivePage('order-detail');
                  }}
                  onOpenPreview={(ord) =>
                    setPreviewTarget({ order: ord, fileIndex: 0 })
                  }
                  onOpenEmail={(ord) => setEmailTarget(ord)}
                  onOpenVendorEmail={(ord) => setVendorEmailTarget(ord)}
                  onNewOrder={() => setActivePage('order-new')}
                />
              )}

              {activePage === 'order-new' && (
                <OrderFormView
                  mode="create"
                  existingOrders={orders}
                  clients={clients}
                  settings={settings}
                  ownerId={ownerId}
                  accessToken={accessToken}
                  onRequestGoogleAuth={handleGoogleLogin}
                  onSaveOrder={handleSaveOrder}
                  onPreviewDraftOrder={(draft, fileIdx = 0) =>
                    setPreviewTarget({ order: draft, fileIndex: fileIdx })
                  }
                  onCancel={() => setActivePage('dashboard')}
                />
              )}

              {activePage === 'order-edit' && activeOrder && (
                <OrderFormView
                  mode="edit"
                  initialOrder={activeOrder}
                  existingOrders={orders}
                  clients={clients}
                  settings={settings}
                  ownerId={ownerId}
                  accessToken={accessToken}
                  onRequestGoogleAuth={handleGoogleLogin}
                  onSaveOrder={handleSaveOrder}
                  onPreviewDraftOrder={(draft, fileIdx = 0) =>
                    setPreviewTarget({ order: draft, fileIndex: fileIdx })
                  }
                  onCancel={() => setActivePage('order-detail')}
                />
              )}

              {activePage === 'order-detail' && activeOrder && (
                <OrderDetailView
                  order={activeOrder}
                  settings={settings}
                  accessToken={accessToken}
                  onBack={() => setActivePage('dashboard')}
                  onEdit={() => setActivePage('order-edit')}
                  onDelete={handleDeleteOrder}
                  onUpdateStatus={handleUpdateOrderStatus}
                  onRemoveFile={handleRemoveFileFromOrder}
                  onOpenPreview={(ord, idx = 0) =>
                    setPreviewTarget({ order: ord, fileIndex: idx })
                  }
                  onOpenEmail={(ord) => setEmailTarget(ord)}
                  onOpenVendorEmail={(ord) => setVendorEmailTarget(ord)}
                  onOpenReceipt={(ord) => setReceiptTarget(ord)}
                />
              )}

              {activePage === 'schedule' && (
                <ScheduleView
                  orders={orders}
                  settings={settings}
                  onTogglePickedUp={async (ord) => {
                    await handleUpdateOrderStatus(ord, {
                      workStatus: !ord.pickedUp ? 'selesai' : ord.workStatus,
                      paymentStatus: ord.paymentStatus,
                      dpAmount: ord.dpAmount,
                      remainingAmount: ord.remainingAmount,
                      pickedUp: !ord.pickedUp,
                    });
                  }}
                  onOpenDetail={(id) => {
                    setSelectedOrderId(id);
                    setActivePage('order-detail');
                  }}
                  onOpenPreview={(ord) =>
                    setPreviewTarget({ order: ord, fileIndex: 0 })
                  }
                />
              )}

              {activePage === 'clients' && (
                <ClientsView
                  clients={clients}
                  orders={orders}
                  ownerId={ownerId}
                  onSaveClient={handleSaveClient}
                  onDeleteClient={handleDeleteClient}
                  onOpenOrderDetail={(id) => {
                    setSelectedOrderId(id);
                    setActivePage('order-detail');
                  }}
                />
              )}

              {activePage === 'settings' && (
                <SettingsView
                  settings={settings}
                  ordersCount={orders.length}
                  clientsCount={clients.length}
                  hasGoogleToken={Boolean(accessToken)}
                  accessToken={accessToken}
                  isLocalMode={isLocalMode && !firebaseUser}
                  onSaveSettings={handleSaveSettings}
                  onConnectGoogle={handleGoogleLogin}
                  onDownloadBackup={handleDownloadBackup}
                  onResetAllData={handleResetAllData}
                  onNotifyToast={notifyToast}
                />
              )}
            </>
          )}
        </main>
      </div>

      <DocumentPreviewModal
        open={Boolean(previewTarget)}
        order={previewTarget?.order || null}
        initialFileIndex={previewTarget?.fileIndex || 0}
        accessToken={accessToken}
        onClose={() => setPreviewTarget(null)}
        onRequestGoogleAuth={async () => {
          await handleGoogleLogin();
        }}
      />

      <EmailModal
        open={Boolean(emailTarget)}
        order={emailTarget}
        settings={settings}
        accessToken={accessToken}
        onClose={() => setEmailTarget(null)}
        onRequestGoogleAuth={handleGoogleLogin}
        onRecordEmailLog={handleRecordEmailLog}
      />

      <VendorEmailModal
        open={Boolean(vendorEmailTarget)}
        order={vendorEmailTarget}
        settings={settings}
        accessToken={accessToken}
        onClose={() => setVendorEmailTarget(null)}
        onRequestGoogleAuth={handleGoogleLogin}
        onRecordVendorEmail={handleRecordVendorEmail}
        onNotifyToast={notifyToast}
      />

      <ReceiptPrintModal
        open={Boolean(receiptTarget)}
        order={receiptTarget}
        settings={settings}
        onClose={() => setReceiptTarget(null)}
      />

      {toast && (
        <div
          role="status"
          className={`fixed bottom-5 right-5 z-50 max-w-sm px-4 py-3 rounded-xl shadow-xl border flex items-center gap-2.5 text-xs font-semibold no-print ${
            toast.tone === 'error'
              ? 'bg-red-600 text-white border-red-700'
              : 'bg-slate-900 dark:bg-emerald-600 text-white border-slate-800 dark:border-emerald-700'
          }`}
        >
          {toast.tone === 'error' ? (
            <AlertCircle className="w-4 h-4 shrink-0" />
          ) : (
            <CheckCircle2 className="w-4 h-4 shrink-0" />
          )}
          <span className="flex-1">{toast.message}</span>
          <button
            type="button"
            onClick={() => setToast(null)}
            className="p-0.5 rounded hover:bg-white/15"
            aria-label="Tutup notifikasi"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <PrintDeskApp />
    </ErrorBoundary>
  );
}
