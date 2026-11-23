import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  UploadCloud,
  FileText,
  Eye,
  Trash2,
  Save,
  AlertCircle,
  RefreshCw,
  CheckCircle2,
  UserCheck,
  HardDrive,
  Factory,
} from 'lucide-react';
import {
  MATERIAL_PRESETS,
  ORDER_CATEGORIES,
  OrderCategory,
  OrderFile,
  PRINT_TYPE_PRESETS,
  PaymentStatus,
  PrintClient,
  PrintOrder,
  QTY_UNIT_OPTIONS,
  ShopSettings,
  UploadProgressItem,
  WorkStatus,
} from '../types/printdesk';
import {
  buildVendorEmailSubject,
  formatFileSize,
  formatRupiah,
  generateOrderCode,
  generateSafeId,
  toLocalDateTimeInputValue,
  UNASSIGNED_SALES_LABEL,
} from '../utils/formatters';
import { DEFAULT_SALES_NAMES } from '../data/sampleData';
import { uploadFileToDrive } from '../services/googleDrive';
import { cacheFileBlob } from '../services/storageService';

interface OrderFormViewProps {
  mode: 'create' | 'edit';
  initialOrder?: PrintOrder | null;
  existingOrders: PrintOrder[];
  clients: PrintClient[];
  settings: ShopSettings;
  ownerId: string;
  accessToken: string | null;
  onRequestGoogleAuth: () => Promise<string | null>;
  onSaveOrder: (order: PrintOrder, newClientIfAny?: PrintClient) => Promise<void>;
  onPreviewDraftOrder: (order: PrintOrder, fileIndex?: number) => void;
  onCancel: () => void;
}

export const OrderFormView: React.FC<OrderFormViewProps> = ({
  mode,
  initialOrder,
  existingOrders,
  clients,
  settings,
  ownerId,
  accessToken,
  onRequestGoogleAuth,
  onSaveOrder,
  onPreviewDraftOrder,
  onCancel,
}) => {
  const defaultPickup = useMemo(() => {
    const d = new Date(Date.now() + 24 * 3600000);
    d.setMinutes(0, 0, 0);
    return toLocalDateTimeInputValue(d.toISOString());
  }, []);

  const [orderCode, setOrderCode] = useState(
    initialOrder?.orderCode || generateOrderCode(existingOrders)
  );
  const [clientId, setClientId] = useState(initialOrder?.clientId || '');
  const [clientName, setClientName] = useState(initialOrder?.clientName || '');
  const [clientPhone, setClientPhone] = useState(initialOrder?.clientPhone || '');
  const [clientEmail, setClientEmail] = useState(initialOrder?.clientEmail || '');
  const [showClientSuggestions, setShowClientSuggestions] = useState(false);

  const [printType, setPrintType] = useState(initialOrder?.printType || '');
  const [category, setCategory] = useState<OrderCategory>(
    initialOrder?.category || 'Dokumen'
  );

  const [paperSize, setPaperSize] = useState(initialOrder?.specs.paperSize || 'A4');
  const [orientation, setOrientation] = useState(
    initialOrder?.specs.orientation || 'Portrait'
  );
  const [pageCount, setPageCount] = useState(initialOrder?.specs.pageCount || 1);
  const [copies, setCopies] = useState(initialOrder?.specs.copies || 1);
  const [qtyUnit, setQtyUnit] = useState(initialOrder?.specs.qtyUnit || 'PCS');
  const [paperMaterial, setPaperMaterial] = useState(
    initialOrder?.specs.paperMaterial || 'HVS 80gsm'
  );
  const [colorMode, setColorMode] = useState(
    initialOrder?.specs.colorMode || 'Full Color'
  );
  const [finishing, setFinishing] = useState(
    initialOrder?.specs.finishing || 'Tanpa Finishing'
  );

  const [totalPrice, setTotalPrice] = useState(initialOrder?.totalPrice || 0);
  const [dpAmount, setDpAmount] = useState(initialOrder?.dpAmount || 0);
  const [workStatus, setWorkStatus] = useState<WorkStatus>(
    initialOrder?.workStatus || 'belum_dp'
  );
  const [paymentStatus, setPaymentStatus] = useState<PaymentStatus>(
    initialOrder?.paymentStatus || 'belum_dp'
  );
  const [pickupLocal, setPickupLocal] = useState(
    initialOrder?.pickupAt
      ? toLocalDateTimeInputValue(initialOrder.pickupAt)
      : defaultPickup
  );
  const [notes, setNotes] = useState(initialOrder?.notes || '');
  const [salesName, setSalesName] = useState(initialOrder?.salesName || '');
  const [files, setFiles] = useState<OrderFile[]>(initialOrder?.files || []);

  const [uploads, setUploads] = useState<UploadProgressItem[]>([]);
  const [pendingRetryFiles, setPendingRetryFiles] = useState<Record<string, File>>({});
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const remainingAmount = Math.max(0, totalPrice - dpAmount);

  const salesNameOptions = useMemo(() => {
    const base = Array.isArray(settings.salesNames)
      ? settings.salesNames
      : DEFAULT_SALES_NAMES;
    const current = (initialOrder?.salesName || '').trim();
    if (current && !base.some((n) => n.toLowerCase() === current.toLowerCase())) {
      return [...base, current];
    }
    return base;
  }, [settings.salesNames, initialOrder?.salesName]);

  const isLegacyUnassignedEdit =
    mode === 'edit' && !(initialOrder?.salesName || '').trim();

  const liveVendorSubject = useMemo(
    () =>
      buildVendorEmailSubject({
        printType: printType || 'JENIS CETAKAN',
        paperMaterial: paperMaterial || 'BAHAN',
        paperSize: paperSize || 'UKURAN',
        copies,
        qtyUnit,
      }),
    [printType, paperMaterial, paperSize, copies, qtyUnit]
  );

  // Sinkronkan status pembayaran otomatis saat nominal DP / Total diubah
  useEffect(() => {
    if (
      mode === 'create' ||
      dpAmount !== initialOrder?.dpAmount ||
      totalPrice !== initialOrder?.totalPrice
    ) {
      if (dpAmount <= 0) {
        setPaymentStatus('belum_dp');
      } else if (totalPrice > 0 && dpAmount >= totalPrice) {
        setPaymentStatus('lunas');
        if (workStatus === 'belum_dp') setWorkStatus('dalam_proses');
      } else {
        setPaymentStatus('sudah_dp');
        if (workStatus === 'belum_dp') setWorkStatus('dalam_proses');
      }
    }
  }, [dpAmount, totalPrice]);

  const matchedClients = useMemo(() => {
    const q = clientName.trim().toLowerCase();
    if (!q) return clients.slice(0, 6);
    return clients
      .filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          c.phone.includes(q) ||
          (c.company || '').toLowerCase().includes(q)
      )
      .slice(0, 6);
  }, [clients, clientName]);

  const handleSelectClient = (client: PrintClient) => {
    setClientId(client.id);
    setClientName(client.name);
    setClientPhone(client.phone);
    setClientEmail(client.email || '');
    setShowClientSuggestions(false);
  };

  const applyPickupPreset = (
    hoursFromTodayEndOrTomorrow: 'today_17' | 'tomorrow_10' | 'tomorrow_15' | 'plus2_14'
  ) => {
    const now = new Date();
    let target: Date;
    if (hoursFromTodayEndOrTomorrow === 'today_17') {
      target = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 17, 0, 0);
    } else if (hoursFromTodayEndOrTomorrow === 'tomorrow_10') {
      target = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 10, 0, 0);
    } else if (hoursFromTodayEndOrTomorrow === 'tomorrow_15') {
      target = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 15, 0, 0);
    } else {
      target = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 2, 14, 0, 0);
    }
    setPickupLocal(toLocalDateTimeInputValue(target.toISOString()));
  };

  const handleSelectPresetPrintType = (preset: string) => {
    setPrintType(preset);
    if (preset === 'SPANDUK') setCategory('Spanduk');
    else if (preset === 'BANNER' || preset === 'X-BANNER') setCategory('Banner');
    else if (preset === 'STIKER') setCategory('Stiker');
    else if (preset === 'BROSUR') setCategory('Brosur');
    else if (preset === 'KARTU NAMA') setCategory('Kartu Nama');
    else if (preset === 'UNDANGAN') setCategory('Undangan');
    else if (preset === 'DOKUMEN') setCategory('Dokumen');
    else setCategory('Lainnya');
  };

  const processUploadFiles = async (fileList: FileList | File[]) => {
    const arr = Array.from(fileList);
    if (arr.length === 0) return;

    setUploadError(null);
    const activeToken = accessToken;

    for (const file of arr) {
      const tempId = generateSafeId('file');
      await cacheFileBlob(tempId, file);

      setUploads((prev) => [
        ...prev,
        { id: tempId, fileName: file.name, progress: 5, status: 'uploading' },
      ]);

      if (!activeToken) {
        const localFileMeta: OrderFile = {
          id: tempId,
          name: file.name,
          mimeType: file.type || 'application/octet-stream',
          size: file.size,
          uploadedAt: new Date().toISOString(),
        };
        setFiles((prev) => [...prev, localFileMeta]);
        setPendingRetryFiles((prev) => ({ ...prev, [tempId]: file }));
        setUploads((prev) =>
          prev.map((u) =>
            u.id === tempId
              ? {
                  ...u,
                  progress: 100,
                  status: 'error',
                  errorMessage:
                    'File disimpan di browser (belum ke Google Drive karena akun Google belum terhubung).',
                }
              : u
          )
        );
        setUploadError(
          'Izin Google Drive belum aktif. File tetap tersimpan untuk preview lokal, atau hubungkan Google lalu klik "Upload ke Drive".'
        );
        continue;
      }

      try {
        const result = await uploadFileToDrive(
          activeToken,
          file,
          settings.driveRootFolder || 'PrintDesk',
          clientName.trim() || 'Client Umum',
          orderCode.trim() || 'PD-ORDER',
          (pct) => {
            setUploads((prev) =>
              prev.map((u) => (u.id === tempId ? { ...u, progress: pct } : u))
            );
          }
        );

        const driveMeta: OrderFile = {
          id: tempId,
          name: result.name,
          mimeType: result.mimeType,
          size: result.size,
          driveFileId: result.id,
          webViewLink: result.webViewLink,
          webContentLink: result.webContentLink,
          driveFolderPath: result.folderPath,
          uploadedAt: new Date().toISOString(),
        };

        setFiles((prev) => [...prev, driveMeta]);
        setUploads((prev) =>
          prev.map((u) =>
            u.id === tempId ? { ...u, progress: 100, status: 'done' } : u
          )
        );
      } catch (err: unknown) {
        const msg =
          err instanceof Error
            ? err.message
            : 'Gagal mengunggah file ke Google Drive.';
        setPendingRetryFiles((prev) => ({ ...prev, [tempId]: file }));
        setFiles((prev) => [
          ...prev,
          {
            id: tempId,
            name: file.name,
            mimeType: file.type || 'application/octet-stream',
            size: file.size,
            uploadedAt: new Date().toISOString(),
          },
        ]);
        setUploads((prev) =>
          prev.map((u) =>
            u.id === tempId ? { ...u, status: 'error', errorMessage: msg } : u
          )
        );
        setUploadError(msg);
      }
    }
  };

  const handleRetryDriveUpload = async (fileId: string) => {
    const rawFile = pendingRetryFiles[fileId];
    if (!rawFile) return;

    setUploadError(null);
    let token = accessToken;
    if (!token) {
      token = await onRequestGoogleAuth();
    }
    if (!token) {
      setUploadError('Login Google dibatalkan atau izin Drive belum diberikan.');
      return;
    }

    setUploads((prev) => {
      const exists = prev.some((u) => u.id === fileId);
      if (exists) {
        return prev.map((u) =>
          u.id === fileId
            ? { ...u, progress: 10, status: 'uploading', errorMessage: undefined }
            : u
        );
      }
      return [
        ...prev,
        { id: fileId, fileName: rawFile.name, progress: 10, status: 'uploading' },
      ];
    });

    try {
      const result = await uploadFileToDrive(
        token,
        rawFile,
        settings.driveRootFolder || 'PrintDesk',
        clientName.trim() || 'Client Umum',
        orderCode.trim() || 'PD-ORDER',
        (pct) => {
          setUploads((prev) =>
            prev.map((u) => (u.id === fileId ? { ...u, progress: pct } : u))
          );
        }
      );

      setFiles((prev) =>
        prev.map((f) =>
          f.id === fileId
            ? {
                ...f,
                driveFileId: result.id,
                webViewLink: result.webViewLink,
                webContentLink: result.webContentLink,
                driveFolderPath: result.folderPath,
              }
            : f
        )
      );
      setPendingRetryFiles((prev) => {
        const copy = { ...prev };
        delete copy[fileId];
        return copy;
      });
      setUploads((prev) =>
        prev.map((u) =>
          u.id === fileId ? { ...u, progress: 100, status: 'done' } : u
        )
      );
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : 'Gagal mengunggah ulang ke Drive.';
      setUploadError(msg);
      setUploads((prev) =>
        prev.map((u) =>
          u.id === fileId ? { ...u, status: 'error', errorMessage: msg } : u
        )
      );
    }
  };

  const buildDraftOrder = (): PrintOrder => {
    const nowIso = new Date().toISOString();
    const pickupIso = pickupLocal
      ? new Date(pickupLocal).toISOString()
      : new Date(Date.now() + 24 * 3600000).toISOString();

    return {
      id: initialOrder?.id || generateSafeId('ord'),
      ownerId,
      orderCode: orderCode.trim() || generateOrderCode(existingOrders),
      clientId: clientId || '',
      clientName: clientName.trim(),
      clientPhone: clientPhone.trim(),
      clientEmail: clientEmail.trim(),
      printType: printType.trim(),
      category,
      specs: {
        paperSize: paperSize.trim() || 'A4',
        orientation,
        pageCount: Math.max(1, Number(pageCount) || 1),
        copies: Math.max(1, Number(copies) || 1),
        qtyUnit: qtyUnit.trim() || 'PCS',
        paperMaterial: paperMaterial.trim() || 'HVS 80gsm',
        colorMode,
        finishing: finishing.trim() || 'Tanpa Finishing',
      },
      files,
      totalPrice: Math.max(0, Number(totalPrice) || 0),
      dpAmount: Math.max(0, Number(dpAmount) || 0),
      remainingAmount,
      workStatus,
      paymentStatus,
      pickupAt: pickupIso,
      pickedUp: initialOrder?.pickedUp || false,
      notes: notes.trim(),
      emailHistory: initialOrder?.emailHistory || [],
      vendorSentAt: initialOrder?.vendorSentAt || '',
      vendorEmailHistory: initialOrder?.vendorEmailHistory || [],
      salesName: salesName.trim().slice(0, 60),
      createdAtIso: initialOrder?.createdAtIso || nowIso,
      updatedAtIso: nowIso,
    };
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!clientName.trim()) {
      setFormError('Nama Client wajib diisi.');
      return;
    }
    if (!clientPhone.trim()) {
      setFormError('Nomor HP / WhatsApp client wajib diisi.');
      return;
    }
    if (!printType.trim()) {
      setFormError('Jenis cetakan wajib diisi.');
      return;
    }
    if (!paperMaterial.trim()) {
      setFormError('Bahan cetakan wajib diisi.');
      return;
    }
    if (!paperSize.trim()) {
      setFormError('Ukuran cetakan wajib diisi.');
      return;
    }
    if (!copies || copies < 1) {
      setFormError('Qty minimal 1.');
      return;
    }
    if (!pickupLocal) {
      setFormError('Waktu pengambilan wajib diisi.');
      return;
    }
    if (!isLegacyUnassignedEdit && !salesName.trim()) {
      setFormError('Yang Menangani Order wajib dipilih.');
      return;
    }

    setSaving(true);
    try {
      const draft = buildDraftOrder();
      let newClient: PrintClient | undefined;

      const existingMatch = clients.find(
        (c) =>
          c.id === clientId ||
          (c.name.toLowerCase() === clientName.trim().toLowerCase() &&
            c.phone.replace(/\D/g, '') === clientPhone.replace(/\D/g, ''))
      );
      if (!existingMatch) {
        const cid = generateSafeId('cli');
        draft.clientId = cid;
        newClient = {
          id: cid,
          ownerId,
          name: clientName.trim(),
          phone: clientPhone.trim(),
          email: clientEmail.trim(),
          company: '',
          notes: '',
          createdAtIso: new Date().toISOString(),
          updatedAtIso: new Date().toISOString(),
        };
      } else {
        draft.clientId = existingMatch.id;
      }

      await onSaveOrder(draft, newClient);
    } catch (err: unknown) {
      setFormError(
        err instanceof Error ? err.message : 'Gagal menyimpan order.'
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between gap-4">
        <button
          type="button"
          onClick={onCancel}
          className="inline-flex items-center gap-2 text-sm font-medium text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white"
        >
          <ArrowLeft className="w-4 h-4" />
          Kembali
        </button>
        <div className="text-xs font-mono text-slate-500 dark:text-slate-400">
          Folder Drive: {settings.driveRootFolder}/{clientName || 'Nama Client'}/{orderCode}
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {formError && (
          <div className="p-4 rounded-xl bg-red-50 dark:bg-red-950/60 border border-red-200 dark:border-red-900 flex items-start gap-2.5 text-sm text-red-700 dark:text-red-300">
            <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
            <span>{formError}</span>
          </div>
        )}

        {/* Section 1: Data Client & Jadwal Pengambilan */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 sm:p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-slate-900 dark:text-white">
              1. Data Client & Jadwal Pengambilan
            </h2>
            <span className="text-xs font-mono font-semibold text-orange-600 dark:text-orange-400">
              {orderCode}
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="relative">
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Nama Client * (pilih dari riwayat atau ketik baru)
              </label>
              <input
                type="text"
                required
                value={clientName}
                onFocus={() => setShowClientSuggestions(true)}
                onBlur={() => setTimeout(() => setShowClientSuggestions(false), 180)}
                onChange={(e) => {
                  setClientName(e.target.value);
                  setClientId('');
                  setShowClientSuggestions(true);
                }}
                placeholder="Contoh: Andi Wijaya / Toko Berkah"
                className="w-full px-3.5 py-2.5 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-500/40 focus:border-orange-500"
              />
              {showClientSuggestions && matchedClients.length > 0 && (
                <div className="absolute z-20 mt-1 w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-lg max-h-52 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-700">
                  {matchedClients.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onMouseDown={() => handleSelectClient(c)}
                      className="w-full text-left px-3.5 py-2.5 hover:bg-slate-50 dark:hover:bg-slate-700 flex items-center justify-between text-xs"
                    >
                      <div>
                        <div className="font-semibold text-slate-900 dark:text-white flex items-center gap-1.5">
                          <UserCheck className="w-3.5 h-3.5 text-orange-500" />
                          {c.name}
                        </div>
                        <div className="text-slate-500 dark:text-slate-400">
                          {c.phone} {c.company ? `· ${c.company}` : ''}
                        </div>
                      </div>
                      <span className="text-[11px] text-orange-600 dark:text-orange-400 font-medium">
                        Pilih
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Kode Order
              </label>
              <input
                type="text"
                value={orderCode}
                onChange={(e) => setOrderCode(e.target.value)}
                className="w-full px-3.5 py-2.5 text-sm font-mono rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Nomor HP / WhatsApp *
              </label>
              <input
                type="tel"
                required
                value={clientPhone}
                onChange={(e) => setClientPhone(e.target.value)}
                placeholder="0812xxxxxxxx"
                className="w-full px-3.5 py-2.5 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Email Client (opsional, untuk kirim dokumen)
              </label>
              <input
                type="email"
                value={clientEmail}
                onChange={(e) => setClientEmail(e.target.value)}
                placeholder="client@email.com"
                className="w-full px-3.5 py-2.5 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Yang Menangani Order {isLegacyUnassignedEdit ? '' : '*'}
              </label>
              <select
                required={!isLegacyUnassignedEdit}
                value={salesName}
                onChange={(e) => setSalesName(e.target.value)}
                className="w-full px-3.5 py-2.5 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
              >
                <option value="">
                  {isLegacyUnassignedEdit
                    ? UNASSIGNED_SALES_LABEL
                    : '-- Pilih Yang Menangani Order --'}
                </option>
                {salesNameOptions.map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
              </select>
            </div>

            <div className="md:col-span-2">
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Waktu Pengambilan (Tanggal & Jam) *
              </label>
              <div className="flex flex-col sm:flex-row gap-2.5 sm:items-center">
                <input
                  type="datetime-local"
                  required
                  value={pickupLocal}
                  onChange={(e) => setPickupLocal(e.target.value)}
                  className="px-3.5 py-2.5 text-sm font-mono rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                />
                <div className="flex flex-wrap gap-1.5">
                  <button
                    type="button"
                    onClick={() => applyPickupPreset('today_17')}
                    className="px-2.5 py-1.5 rounded-md bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-xs font-medium text-slate-700 dark:text-slate-200"
                  >
                    Hari Ini 17:00
                  </button>
                  <button
                    type="button"
                    onClick={() => applyPickupPreset('tomorrow_10')}
                    className="px-2.5 py-1.5 rounded-md bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-xs font-medium text-slate-700 dark:text-slate-200"
                  >
                    Besok 10:00
                  </button>
                  <button
                    type="button"
                    onClick={() => applyPickupPreset('tomorrow_15')}
                    className="px-2.5 py-1.5 rounded-md bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-xs font-medium text-slate-700 dark:text-slate-200"
                  >
                    Besok 15:00
                  </button>
                  <button
                    type="button"
                    onClick={() => applyPickupPreset('plus2_14')}
                    className="px-2.5 py-1.5 rounded-md bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-xs font-medium text-slate-700 dark:text-slate-200"
                  >
                    2 Hari Lagi 14:00
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Section 2: Jenis & Spesifikasi Cetakan */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 sm:p-6 space-y-4">
          <h2 className="text-base font-bold text-slate-900 dark:text-white">
            2. Jenis & Spesifikasi Cetakan
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="md:col-span-2 space-y-2">
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                Jenis Cetakan * (pilih preset atau ketik manual)
              </label>
              <input
                type="text"
                required
                list="printdesk-print-types"
                value={printType}
                onChange={(e) => setPrintType(e.target.value)}
                placeholder="Contoh: SPANDUK, BANNER, STIKER, BROSUR"
                className="w-full px-3.5 py-2.5 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
              />
              <datalist id="printdesk-print-types">
                {PRINT_TYPE_PRESETS.map((p) => (
                  <option key={p} value={p} />
                ))}
              </datalist>
              <div className="flex flex-wrap gap-1.5">
                {PRINT_TYPE_PRESETS.map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => handleSelectPresetPrintType(preset)}
                    className={`px-2 py-1 rounded text-[11px] font-medium border transition-colors ${
                      printType.toUpperCase() === preset
                        ? 'bg-orange-600 text-white border-orange-600'
                        : 'bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700'
                    }`}
                  >
                    {preset}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Kategori
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as OrderCategory)}
                className="w-full px-3.5 py-2.5 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
              >
                {ORDER_CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Bahan *
              </label>
              <input
                type="text"
                required
                list="printdesk-materials"
                value={paperMaterial}
                onChange={(e) => setPaperMaterial(e.target.value)}
                placeholder="Flexi China, Art Paper 150gr, Vinyl"
                className="w-full px-3.5 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
              />
              <datalist id="printdesk-materials">
                {MATERIAL_PRESETS.map((m) => (
                  <option key={m} value={m} />
                ))}
              </datalist>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Ukuran *
              </label>
              <input
                type="text"
                required
                value={paperSize}
                onChange={(e) => setPaperSize(e.target.value)}
                placeholder="2x1, 100x60 cm, A4, A3+"
                className="w-full px-3.5 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Qty & Satuan *
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={1}
                  required
                  value={copies}
                  onChange={(e) => setCopies(Math.max(1, Number(e.target.value) || 1))}
                  className="w-24 px-3 py-2 text-sm font-mono tabular-nums rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                />
                <select
                  value={qtyUnit}
                  onChange={(e) => setQtyUnit(e.target.value)}
                  aria-label="Satuan Qty"
                  className="flex-1 px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                >
                  {QTY_UNIT_OPTIONS.map((unit) => (
                    <option key={unit} value={unit}>
                      {unit}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Orientasi
              </label>
              <select
                value={orientation}
                onChange={(e) => setOrientation(e.target.value)}
                className="w-full px-3.5 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
              >
                <option value="Portrait">Portrait</option>
                <option value="Landscape">Landscape</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Mode Warna
              </label>
              <select
                value={colorMode}
                onChange={(e) => setColorMode(e.target.value)}
                className="w-full px-3.5 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
              >
                <option value="Full Color">Full Color (CMYK)</option>
                <option value="Hitam Putih">Hitam Putih (BW)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Jumlah Halaman
              </label>
              <input
                type="number"
                min={1}
                value={pageCount}
                onChange={(e) => setPageCount(Math.max(1, Number(e.target.value) || 1))}
                className="w-full px-3.5 py-2 text-sm font-mono tabular-nums rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
              />
            </div>

            <div className="md:col-span-3">
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Finishing (Jilid, Laminasi, Potong, Mata Ayam, Lipat Pinggir, dll)
              </label>
              <input
                type="text"
                value={finishing}
                onChange={(e) => setFinishing(e.target.value)}
                placeholder="Contoh: Mata ayam 4 sudut + lipat pinggir"
                className="w-full px-3.5 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
              />
            </div>
          </div>

          {/* Live Preview Subjek Email Percetakan */}
          <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 space-y-1">
            <div className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-500 dark:text-slate-400">
              <Factory className="w-3.5 h-3.5 text-orange-600 dark:text-orange-400" />
              <span>Preview Subjek Email ke Percetakan (otomatis):</span>
            </div>
            <div className="text-xs sm:text-sm font-mono font-bold text-slate-900 dark:text-white break-all">
              {liveVendorSubject}
            </div>
          </div>
        </div>

        {/* Section 3: Upload File ke Google Drive */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 sm:p-6 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white">
                3. Upload File Dokumen Cetak (Google Drive)
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Mendukung PDF, DOCX, JPG, PNG, AI, dan PSD. Otomatis tersimpan ke folder{' '}
                <span className="font-mono">
                  {settings.driveRootFolder}/{clientName || 'Nama Client'}/{orderCode}
                </span>
              </p>
            </div>

            {!accessToken && (
              <button
                type="button"
                onClick={() => onRequestGoogleAuth()}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-orange-50 dark:bg-orange-950/60 border border-orange-200 dark:border-orange-900 text-xs font-semibold text-orange-700 dark:text-orange-300 hover:bg-orange-100"
              >
                <HardDrive className="w-3.5 h-3.5" />
                Hubungkan Google Drive
              </button>
            )}
          </div>

          {uploadError && (
            <div className="p-3.5 rounded-lg bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-900 text-xs text-amber-800 dark:text-amber-200 flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{uploadError}</span>
            </div>
          )}

          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragOver(false);
              if (e.dataTransfer.files) {
                processUploadFiles(e.dataTransfer.files);
              }
            }}
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors ${
              dragOver
                ? 'border-orange-500 bg-orange-50/70 dark:bg-orange-950/20'
                : 'border-slate-300 dark:border-slate-700 hover:border-orange-400 bg-slate-50/50 dark:bg-slate-800/30'
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept=".pdf,.docx,.doc,.jpg,.jpeg,.png,.webp,.ai,.psd"
              onChange={(e) => {
                if (e.target.files) processUploadFiles(e.target.files);
                e.target.value = '';
              }}
              className="hidden"
            />
            <UploadCloud className="w-9 h-9 text-orange-600 mx-auto mb-2.5" />
            <p className="text-sm font-semibold text-slate-900 dark:text-white">
              Tarik & lepas file ke sini, atau klik untuk memilih file
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              PDF, DOCX, JPG, PNG, AI, PSD — bisa unggah lebih dari satu file sekaligus
            </p>
          </div>

          {/* Progress Bars */}
          {uploads.length > 0 && (
            <div className="space-y-2">
              {uploads.map((u) => (
                <div
                  key={u.id}
                  className="p-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 space-y-1.5"
                >
                  <div className="flex items-center justify-between gap-2 text-xs">
                    <span className="font-medium text-slate-800 dark:text-slate-200 truncate">
                      {u.fileName}
                    </span>
                    <span className="font-mono tabular-nums text-slate-500 dark:text-slate-400">
                      {u.status === 'done'
                        ? 'Tersimpan di Drive'
                        : u.status === 'error'
                          ? 'Perlu Upload Drive'
                          : `${u.progress}%`}
                    </span>
                  </div>
                  <div className="w-full h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                    <div
                      className={`h-full transition-all duration-200 ${
                        u.status === 'done'
                          ? 'bg-emerald-600'
                          : u.status === 'error'
                            ? 'bg-amber-500'
                            : 'bg-orange-600'
                      }`}
                      style={{ width: `${u.progress}%` }}
                    />
                  </div>
                  {u.errorMessage && (
                    <div className="text-[11px] text-amber-700 dark:text-amber-300">
                      {u.errorMessage}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Attached Files List */}
          {files.length > 0 && (
            <div className="divide-y divide-slate-100 dark:divide-slate-800 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
              {files.map((f, idx) => (
                <div
                  key={f.id}
                  className="p-3.5 flex flex-wrap items-center justify-between gap-3 bg-white dark:bg-slate-900"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <FileText className="w-5 h-5 text-slate-400 shrink-0" />
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-slate-900 dark:text-white truncate">
                        {f.name}
                      </div>
                      <div className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-2 flex-wrap">
                        <span>{formatFileSize(f.size)}</span>
                        <span aria-hidden="true">·</span>
                        {f.driveFileId ? (
                          <span className="text-emerald-600 dark:text-emerald-400 inline-flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3" />
                            Google Drive ({f.driveFolderPath || 'Tersimpan'})
                          </span>
                        ) : (
                          <span className="text-amber-600 dark:text-amber-400">
                            Cache Lokal (Belum di Drive)
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5">
                    {!f.driveFileId && pendingRetryFiles[f.id] && (
                      <button
                        type="button"
                        onClick={() => handleRetryDriveUpload(f.id)}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-orange-50 dark:bg-orange-950/60 text-orange-700 dark:text-orange-300 text-xs font-medium hover:bg-orange-100"
                      >
                        <RefreshCw className="w-3.5 h-3.5" />
                        Upload ke Drive
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => onPreviewDraftOrder(buildDraftOrder(), idx)}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      Preview
                    </button>
                    <button
                      type="button"
                      onClick={() => setFiles((prev) => prev.filter((x) => x.id !== f.id))}
                      className="p-1.5 rounded-lg text-red-600 hover:bg-red-50 dark:hover:bg-red-950/50"
                      title="Hapus file dari order"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Section 4: Biaya, DP & Status */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 sm:p-6 space-y-4">
          <h2 className="text-base font-bold text-slate-900 dark:text-white">
            4. Pembayaran, DP & Status Order
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Harga Total (Rp)
              </label>
              <input
                type="number"
                min={0}
                step={500}
                value={totalPrice}
                onChange={(e) => setTotalPrice(Math.max(0, Number(e.target.value) || 0))}
                className="w-full px-3.5 py-2.5 text-sm font-mono tabular-nums rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Nominal DP Masuk (Rp)
              </label>
              <input
                type="number"
                min={0}
                step={500}
                value={dpAmount}
                onChange={(e) => setDpAmount(Math.max(0, Number(e.target.value) || 0))}
                className="w-full px-3.5 py-2.5 text-sm font-mono tabular-nums rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Sisa Pembayaran (Otomatis)
              </label>
              <div className="w-full px-3.5 py-2.5 text-sm font-mono tabular-nums font-bold rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/70 text-orange-600 dark:text-orange-400">
                {formatRupiah(remainingAmount)}
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Status Pembayaran
              </label>
              <select
                value={paymentStatus}
                onChange={(e) => setPaymentStatus(e.target.value as PaymentStatus)}
                className="w-full px-3.5 py-2.5 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
              >
                <option value="belum_dp">Belum DP</option>
                <option value="sudah_dp">Sudah DP</option>
                <option value="lunas">Lunas</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Status Pengerjaan
              </label>
              <select
                value={workStatus}
                onChange={(e) => setWorkStatus(e.target.value as WorkStatus)}
                className="w-full px-3.5 py-2.5 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
              >
                <option value="belum_dp">Belum DP</option>
                <option value="dalam_proses">Dalam Proses Pengerjaan</option>
                <option value="selesai">Selesai</option>
              </select>
            </div>

            <div className="sm:col-span-2 lg:col-span-3">
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Catatan Tambahan
              </label>
              <textarea
                rows={2}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Catatan khusus operator cetak, warna, atau instruksi pengambilan..."
                className="w-full px-3.5 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
              />
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 pb-6">
          <button
            type="button"
            onClick={onCancel}
            className="px-5 py-2.5 rounded-lg border border-slate-200 dark:border-slate-700 text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800"
          >
            Batal
          </button>
          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center gap-2 px-6 py-2.5 rounded-lg bg-orange-600 hover:bg-orange-700 text-white text-sm font-semibold transition-colors disabled:opacity-60"
          >
            <Save className="w-4 h-4" />
            {saving
              ? 'Menyimpan...'
              : mode === 'create'
                ? 'Simpan Order Baru'
                : 'Simpan Perubahan'}
          </button>
        </div>
      </form>
    </div>
  );
};
