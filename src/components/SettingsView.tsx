import React, { useEffect, useState } from 'react';
import {
  Save,
  Upload,
  CheckCircle2,
  HardDrive,
  RefreshCw,
  Trash2,
  Factory,
  Send,
  AlertCircle,
  Download,
  AlertTriangle,
  Users,
  Plus,
  Edit2,
  X,
} from 'lucide-react';
import { ShopSettings } from '../types/printdesk';
import { DEFAULT_SALES_NAMES } from '../data/sampleData';
import { parseEmailRecipients, sendOrderEmailViaGmail } from '../services/gmailApi';
import { processLogoFile } from '../utils/logoProcessor';
import { ResetDataModal } from './ResetDataModal';
import { ShopLogo } from './ShopLogo';

interface SettingsViewProps {
  settings: ShopSettings;
  ordersCount: number;
  clientsCount: number;
  hasGoogleToken: boolean;
  accessToken: string | null;
  isLocalMode: boolean;
  onSaveSettings: (next: ShopSettings) => Promise<void>;
  onConnectGoogle: () => Promise<string | null>;
  onDownloadBackup: () => void;
  onResetAllData: (includeSettings: boolean) => Promise<void>;
  onNotifyToast: (msg: string, tone?: 'success' | 'error') => void;
}

const CLIENT_TEMPLATE_VARIABLES = [
  '{KodeOrder}',
  '{NamaClient}',
  '{JenisCetakan}',
  '{penangan_order}',
  '{WaktuPengambilan}',
  '{TotalHarga}',
  '{NominalDP}',
  '{SisaPembayaran}',
  '{LinkDrive}',
  '{NamaUsaha}',
];

const VENDOR_TEMPLATE_VARIABLES = [
  '{kode_order}',
  '{nama_client}',
  '{penangan_order}',
  '{jenis_cetakan}',
  '{bahan}',
  '{ukuran}',
  '{qty}',
  '{finishing}',
  '{catatan}',
  '{waktu_pengambilan}',
  '{nama_usaha}',
];

export const SettingsView: React.FC<SettingsViewProps> = ({
  settings,
  ordersCount,
  clientsCount,
  hasGoogleToken,
  accessToken,
  isLocalMode,
  onSaveSettings,
  onConnectGoogle,
  onDownloadBackup,
  onResetAllData,
  onNotifyToast,
}) => {
  const [form, setForm] = useState<ShopSettings>(settings);
  const [saving, setSaving] = useState(false);
  const [savedNotice, setSavedNotice] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [testingEmail, setTestingEmail] = useState(false);
  const [testEmailStatus, setTestEmailStatus] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);

  const [processingLogo, setProcessingLogo] = useState(false);
  const [logoError, setLogoError] = useState<string | null>(null);
  const [resetModalOpen, setResetModalOpen] = useState(false);

  // State daftar yang menangani order
  const [newSalesName, setNewSalesName] = useState('');
  const [editingSalesIdx, setEditingSalesIdx] = useState<number | null>(null);
  const [editingSalesValue, setEditingSalesValue] = useState('');
  const [salesError, setSalesError] = useState<string | null>(null);
  const [savingSalesList, setSavingSalesList] = useState(false);
  const skipNextFullFormSyncRef = React.useRef(false);

  useEffect(() => {
    if (skipNextFullFormSyncRef.current) {
      skipNextFullFormSyncRef.current = false;
      setForm((prev) => ({
        ...prev,
        salesNames: Array.isArray(settings.salesNames)
          ? settings.salesNames
          : [...DEFAULT_SALES_NAMES],
      }));
      return;
    }
    setForm(settings);
  }, [settings]);

  const salesList = Array.isArray(form.salesNames)
    ? form.salesNames
    : DEFAULT_SALES_NAMES;

  const { valid: validVendorTo, invalid: invalidVendorTo } = parseEmailRecipients(
    form.vendorEmail || ''
  );
  const { valid: validVendorCc, invalid: invalidVendorCc } = parseEmailRecipients(
    form.vendorCcEmail || ''
  );

  const handleLogoUpload = async (file: File) => {
    setLogoError(null);
    setProcessingLogo(true);
    try {
      const processedDataUrl = await processLogoFile(file);
      setForm((prev) => ({
        ...prev,
        logoDataUrl: processedDataUrl,
      }));
      onNotifyToast(
        'Logo siap digunakan. Klik "Simpan Pengaturan" untuk menerapkan.',
        'success'
      );
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : 'Gagal memproses file logo.';
      setLogoError(msg);
      onNotifyToast(msg, 'error');
    } finally {
      setProcessingLogo(false);
    }
  };

  const handleRemoveLogo = () => {
    setLogoError(null);
    setForm((prev) => ({ ...prev, logoDataUrl: '' }));
  };

  const persistSalesList = async (nextList: string[], successMessage: string) => {
    const prevList = salesList;
    setSalesError(null);
    setSavingSalesList(true);
    setForm((prev) => ({ ...prev, salesNames: nextList }));
    skipNextFullFormSyncRef.current = true;
    try {
      await onSaveSettings({
        ...settings,
        salesNames: nextList,
        updatedAtIso: new Date().toISOString(),
      });
      onNotifyToast(successMessage, 'success');
    } catch (err: unknown) {
      skipNextFullFormSyncRef.current = false;
      setForm((prev) => ({ ...prev, salesNames: prevList }));
      const msg =
        err instanceof Error
          ? err.message
          : 'Gagal menyimpan daftar penangan order.';
      setSalesError(msg);
      onNotifyToast(msg, 'error');
    } finally {
      setSavingSalesList(false);
    }
  };

  const handleAddSalesName = async () => {
    setSalesError(null);
    const trimmed = newSalesName.trim();
    if (!trimmed) {
      setSalesError('Nama penangan order wajib diisi.');
      return;
    }
    if (trimmed.length > 60) {
      setSalesError('Nama penangan order maksimal 60 karakter.');
      return;
    }
    if (salesList.length >= 20) {
      setSalesError('Maksimal 20 nama penangan order.');
      return;
    }
    if (salesList.some((n) => n.toLowerCase() === trimmed.toLowerCase())) {
      setSalesError('Nama tersebut sudah ada dalam daftar.');
      return;
    }

    const nextList = [...salesList, trimmed];
    setNewSalesName('');
    await persistSalesList(nextList, `Nama "${trimmed}" berhasil ditambahkan.`);
  };

  const handleStartEditSales = (idx: number) => {
    setSalesError(null);
    setEditingSalesIdx(idx);
    setEditingSalesValue(salesList[idx] || '');
  };

  const handleSaveEditSales = async () => {
    if (editingSalesIdx === null) return;
    setSalesError(null);
    const trimmed = editingSalesValue.trim();
    if (!trimmed) {
      setSalesError('Nama penangan order wajib diisi.');
      return;
    }
    if (trimmed.length > 60) {
      setSalesError('Nama penangan order maksimal 60 karakter.');
      return;
    }
    if (
      salesList.some(
        (n, i) => i !== editingSalesIdx && n.toLowerCase() === trimmed.toLowerCase()
      )
    ) {
      setSalesError('Nama tersebut sudah ada dalam daftar.');
      return;
    }

    const nextList = salesList.map((item, i) =>
      i === editingSalesIdx ? trimmed : item
    );
    setEditingSalesIdx(null);
    setEditingSalesValue('');
    await persistSalesList(nextList, 'Nama penangan order berhasil diperbarui.');
  };

  const handleDeleteSalesName = async (idx: number) => {
    setSalesError(null);
    const removed = salesList[idx];
    if (editingSalesIdx === idx) {
      setEditingSalesIdx(null);
      setEditingSalesValue('');
    }
    const nextList = salesList.filter((_, i) => i !== idx);
    await persistSalesList(nextList, `Nama "${removed}" dihapus dari daftar.`);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setSavedNotice(false);

    if (invalidVendorTo.length > 0) {
      setFormError(`Format Email Percetakan Tujuan tidak valid: ${invalidVendorTo.join(', ')}`);
      return;
    }
    if (validVendorTo.length === 0) {
      setFormError('Email Percetakan Tujuan wajib diisi minimal 1 alamat email valid.');
      return;
    }
    if (invalidVendorCc.length > 0) {
      setFormError(`Format Email CC tidak valid: ${invalidVendorCc.join(', ')}`);
      return;
    }

    setSaving(true);
    try {
      await onSaveSettings({
        ...form,
        salesNames: salesList,
        vendorName: form.vendorName.trim() || 'Percetakan',
        vendorEmail: validVendorTo.join(', '),
        vendorCcEmail: validVendorCc.join(', '),
        updatedAtIso: new Date().toISOString(),
      });
      setSavedNotice(true);
      onNotifyToast('Pengaturan berhasil disimpan', 'success');
      setTimeout(() => setSavedNotice(false), 3000);
    } catch (err: unknown) {
      setFormError(
        err instanceof Error ? err.message : 'Gagal menyimpan pengaturan.'
      );
    } finally {
      setSaving(false);
    }
  };

  const handleSendTestVendorEmail = async () => {
    setTestEmailStatus(null);
    if (invalidVendorTo.length > 0 || validVendorTo.length === 0) {
      setTestEmailStatus({
        type: 'error',
        message: 'Pastikan Email Percetakan Tujuan terisi dengan format email yang valid.',
      });
      return;
    }
    if (invalidVendorCc.length > 0) {
      setTestEmailStatus({
        type: 'error',
        message: `Format Email CC tidak valid: ${invalidVendorCc.join(', ')}`,
      });
      return;
    }

    setTestingEmail(true);
    try {
      let token = accessToken;
      if (!token) {
        token = await onConnectGoogle();
      }
      if (!token) {
        throw new Error(
          'Akun Google belum terhubung atau izin Gmail belum diberikan.'
        );
      }

      const senderTitle = form.shopName.trim() || 'PrintDesk';
      await sendOrderEmailViaGmail({
        accessToken: token,
        recipients: validVendorTo,
        cc: validVendorCc,
        subject: `TES KONEKSI EMAIL PERCETAKAN - ${senderTitle}`.toUpperCase(),
        bodyText: `Halo ${form.vendorName || 'Tim Percetakan'},\n\nIni adalah email tes dari ${senderTitle} untuk memastikan alamat email percetakan tujuan berfungsi dengan baik sebelum pengiriman order cetak.\n\nSalam,\n${senderTitle}`,
        shopBranding: {
          shopName: form.shopName,
          shopAddress: form.shopAddress,
          shopPhone: form.shopPhone,
          logoDataUrl: form.logoDataUrl,
        },
      });

      setTestEmailStatus({
        type: 'success',
        message: `Email tes berhasil dikirim ke ${validVendorTo.join(', ')}.`,
      });
    } catch (err: unknown) {
      setTestEmailStatus({
        type: 'error',
        message:
          err instanceof Error ? err.message : 'Gagal mengirim email tes ke percetakan.',
      });
    } finally {
      setTestingEmail(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-8">
      <form onSubmit={handleSubmit} className="space-y-6">
        {formError && (
          <div className="p-4 rounded-xl bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-900 flex items-start gap-2.5 text-xs text-red-700 dark:text-red-300">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{formError}</span>
          </div>
        )}

        {/* Shop Identity */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-4">
          <h2 className="text-base font-bold text-slate-900 dark:text-white">
            Profil Usaha Percetakan (Tampil di Nota & Email)
          </h2>

          <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 space-y-3">
            <div className="text-xs font-semibold text-slate-700 dark:text-slate-300">
              Logo Usaha
            </div>
            <div className="flex flex-wrap items-center gap-4">
              <ShopLogo
                logoDataUrl={form.logoDataUrl}
                shopName={form.shopName}
                size="lg"
              />

              <div className="space-y-2 flex-1 min-w-[220px]">
                <div className="flex flex-wrap items-center gap-2">
                  <label
                    className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 cursor-pointer ${
                      processingLogo ? 'opacity-60 pointer-events-none' : ''
                    }`}
                  >
                    {processingLogo ? (
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Upload className="w-3.5 h-3.5" />
                    )}
                    {processingLogo ? 'Memproses logo...' : 'Unggah Logo'}
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/webp,image/svg+xml,.png,.jpg,.jpeg,.webp,.svg"
                      disabled={processingLogo}
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        e.currentTarget.value = '';
                        if (f) void handleLogoUpload(f);
                      }}
                      className="hidden"
                    />
                  </label>

                  <button
                    type="button"
                    onClick={handleRemoveLogo}
                    disabled={!form.logoDataUrl || processingLogo}
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-red-200 dark:border-red-900/60 bg-white dark:bg-slate-800 text-xs font-semibold text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Hapus Logo
                  </button>
                </div>

                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  PNG/JPG/SVG, disarankan latar transparan, rasio persegi (maks. 2 MB; otomatis dikompres &lt; 200 KB).
                </p>
              </div>
            </div>

            {logoError && (
              <div className="p-2.5 rounded-lg bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-900 flex items-start gap-2 text-xs text-red-700 dark:text-red-300">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{logoError}</span>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Nama Usaha
              </label>
              <input
                type="text"
                maxLength={120}
                value={form.shopName}
                onChange={(e) => setForm({ ...form, shopName: e.target.value })}
                placeholder="Nama percetakan Anda"
                className="w-full px-3.5 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Nomor Telepon / WhatsApp Toko
              </label>
              <input
                type="text"
                value={form.shopPhone}
                onChange={(e) => setForm({ ...form, shopPhone: e.target.value })}
                className="w-full px-3.5 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Email Usaha
              </label>
              <input
                type="email"
                value={form.shopEmail}
                onChange={(e) => setForm({ ...form, shopEmail: e.target.value })}
                className="w-full px-3.5 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Folder Utama Google Drive
              </label>
              <input
                type="text"
                required
                value={form.driveRootFolder}
                onChange={(e) =>
                  setForm({ ...form, driveRootFolder: e.target.value })
                }
                className="w-full px-3.5 py-2 text-sm font-mono rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Alamat Lengkap Usaha
              </label>
              <input
                type="text"
                value={form.shopAddress}
                onChange={(e) =>
                  setForm({ ...form, shopAddress: e.target.value })
                }
                className="w-full px-3.5 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
              />
            </div>
          </div>
        </div>

        {/* Daftar Yang Menangani Order */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Users className="w-5 h-5 text-orange-600" />
              <h2 className="text-base font-bold text-slate-900 dark:text-white">
                Daftar Yang Menangani Order
              </h2>
            </div>
            <span className="text-xs font-mono tabular-nums text-slate-500 dark:text-slate-400">
              {salesList.length}/20 nama
            </span>
          </div>

          <p className="text-xs text-slate-500 dark:text-slate-400">
            Digunakan pada pilihan &quot;Yang Menangani Order&quot; saat membuat atau mengubah order. Menghapus nama dari daftar tidak akan mengubah order lama yang sudah mencatat nama tersebut.
          </p>

          {salesError && (
            <div className="p-3 rounded-lg bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-900 flex items-start gap-2 text-xs text-red-700 dark:text-red-300">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{salesError}</span>
            </div>
          )}

          <div className="flex flex-col sm:flex-row gap-2">
            <input
              type="text"
              maxLength={60}
              value={newSalesName}
              disabled={savingSalesList || salesList.length >= 20}
              onChange={(e) => {
                setNewSalesName(e.target.value);
                if (salesError) setSalesError(null);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  void handleAddSalesName();
                }
              }}
              placeholder="Tambah nama penangan / operator baru..."
              className="flex-1 px-3.5 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white disabled:opacity-60"
            />
            <button
              type="button"
              disabled={savingSalesList || salesList.length >= 20}
              onClick={() => void handleAddSalesName()}
              className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg bg-slate-900 dark:bg-orange-600 hover:bg-slate-800 dark:hover:bg-orange-500 text-white text-xs font-semibold disabled:opacity-50 shrink-0"
            >
              <Plus className="w-4 h-4" />
              Tambah Nama
            </button>
          </div>

          {salesList.length === 0 ? (
            <div className="p-4 rounded-xl border border-dashed border-slate-300 dark:border-slate-700 text-center text-xs text-slate-500 dark:text-slate-400">
              Daftar kosong. Tambahkan minimal satu nama yang menangani order.
            </div>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-slate-800 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
              {salesList.map((name, idx) => {
                const isEditing = editingSalesIdx === idx;
                return (
                  <div
                    key={`${name}-${idx}`}
                    className="px-4 py-2.5 flex flex-wrap items-center justify-between gap-2 bg-white dark:bg-slate-900"
                  >
                    {isEditing ? (
                      <div className="flex-1 flex flex-wrap items-center gap-2">
                        <input
                          type="text"
                          maxLength={60}
                          autoFocus
                          value={editingSalesValue}
                          onChange={(e) => setEditingSalesValue(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              void handleSaveEditSales();
                            } else if (e.key === 'Escape') {
                              setEditingSalesIdx(null);
                              setEditingSalesValue('');
                            }
                          }}
                          className="flex-1 min-w-[160px] px-3 py-1.5 text-sm rounded-lg border border-orange-400 dark:border-orange-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                        />
                        <button
                          type="button"
                          disabled={savingSalesList}
                          onClick={() => void handleSaveEditSales()}
                          className="px-3 py-1.5 rounded-lg bg-orange-600 hover:bg-orange-700 text-white text-xs font-semibold disabled:opacity-60"
                        >
                          Simpan
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setEditingSalesIdx(null);
                            setEditingSalesValue('');
                          }}
                          className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-500 hover:text-slate-700 dark:hover:text-slate-200"
                          title="Batal edit"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ) : (
                      <>
                        <span className="text-sm font-medium text-slate-900 dark:text-white">
                          {name}
                        </span>
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            disabled={savingSalesList}
                            onClick={() => handleStartEditSales(idx)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-50"
                          >
                            <Edit2 className="w-3 h-3" />
                            Edit
                          </button>
                          <button
                            type="button"
                            disabled={savingSalesList}
                            onClick={() => void handleDeleteSalesName(idx)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md border border-red-200 dark:border-red-900/60 text-xs font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 disabled:opacity-50"
                          >
                            <Trash2 className="w-3 h-3" />
                            Hapus
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Vendor / Printing Shop Email Settings */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Factory className="w-5 h-5 text-orange-600" />
              <h2 className="text-base font-bold text-slate-900 dark:text-white">
                Pengaturan Email Percetakan / Vendor
              </h2>
            </div>

            <button
              type="button"
              disabled={testingEmail}
              onClick={handleSendTestVendorEmail}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-xs font-semibold text-slate-800 dark:text-slate-100 disabled:opacity-60"
            >
              {testingEmail ? (
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Send className="w-3.5 h-3.5" />
              )}
              {testingEmail ? 'Mengirim Tes...' : 'Kirim email tes'}
            </button>
          </div>

          {testEmailStatus && (
            <div
              className={`p-3 rounded-lg border text-xs flex items-start justify-between gap-2 ${
                testEmailStatus.type === 'success'
                  ? 'bg-emerald-50 dark:bg-emerald-950/50 border-emerald-200 dark:border-emerald-900 text-emerald-700 dark:text-emerald-300'
                  : 'bg-red-50 dark:bg-red-950/50 border-red-200 dark:border-red-900 text-red-700 dark:text-red-300'
              }`}
            >
              <span>{testEmailStatus.message}</span>
              {testEmailStatus.type === 'error' && !hasGoogleToken && (
                <button
                  type="button"
                  onClick={() => onConnectGoogle()}
                  className="px-2.5 py-1 rounded bg-red-600 text-white font-semibold shrink-0"
                >
                  Hubungkan Akun Google
                </button>
              )}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Nama Percetakan
              </label>
              <input
                type="text"
                value={form.vendorName}
                onChange={(e) => setForm({ ...form, vendorName: e.target.value })}
                placeholder="Wahana Dimensi"
                className="w-full px-3.5 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Email Percetakan Tujuan * (pisahkan koma jika lebih dari 1)
              </label>
              <input
                type="text"
                required
                value={form.vendorEmail}
                onChange={(e) => setForm({ ...form, vendorEmail: e.target.value })}
                placeholder="wahanadimensiwd@gmail.com"
                className="w-full px-3.5 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
              />
              {invalidVendorTo.length > 0 && (
                <p className="text-[11px] text-red-600 mt-1">
                  Email tidak valid: {invalidVendorTo.join(', ')}
                </p>
              )}
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Email CC (opsional, pisahkan koma jika lebih dari 1)
              </label>
              <input
                type="text"
                value={form.vendorCcEmail}
                onChange={(e) => setForm({ ...form, vendorCcEmail: e.target.value })}
                placeholder="admin@percetakan.com"
                className="w-full px-3.5 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
              />
              {invalidVendorCc.length > 0 && (
                <p className="text-[11px] text-red-600 mt-1">
                  CC tidak valid: {invalidVendorCc.join(', ')}
                </p>
              )}
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              Template Isi Email Percetakan
            </label>
            <textarea
              rows={7}
              required
              value={form.vendorEmailBodyTemplate}
              onChange={(e) =>
                setForm({ ...form, vendorEmailBodyTemplate: e.target.value })
              }
              className="w-full px-3.5 py-2.5 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white leading-relaxed"
            />
            <div className="mt-2 flex flex-wrap gap-1.5">
              {VENDOR_TEMPLATE_VARIABLES.map((v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() =>
                    setForm((prev) => ({
                      ...prev,
                      vendorEmailBodyTemplate: `${prev.vendorEmailBodyTemplate} ${v}`,
                    }))
                  }
                  className="px-2 py-1 rounded bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-[11px] font-mono text-slate-700 dark:text-slate-300"
                >
                  + {v}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Client Email Templates */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-4">
          <h2 className="text-base font-bold text-slate-900 dark:text-white">
            Template Email ke Client
          </h2>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              Template Subjek Email Client
            </label>
            <input
              type="text"
              value={form.emailSubjectTemplate}
              onChange={(e) =>
                setForm({ ...form, emailSubjectTemplate: e.target.value })
              }
              className="w-full px-3.5 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              Template Isi Email Client
            </label>
            <textarea
              rows={7}
              value={form.emailBodyTemplate}
              onChange={(e) =>
                setForm({ ...form, emailBodyTemplate: e.target.value })
              }
              className="w-full px-3.5 py-2.5 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white leading-relaxed"
            />
            <div className="mt-2 flex flex-wrap gap-1.5">
              {CLIENT_TEMPLATE_VARIABLES.map((v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() =>
                    setForm((prev) => ({
                      ...prev,
                      emailBodyTemplate: `${prev.emailBodyTemplate} ${v}`,
                    }))
                  }
                  className="px-2 py-1 rounded bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-[11px] font-mono text-slate-700 dark:text-slate-300"
                >
                  + {v}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between gap-4">
          {savedNotice ? (
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="w-4 h-4" />
              Pengaturan berhasil disimpan
            </span>
          ) : (
            <span />
          )}

          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-orange-600 hover:bg-orange-700 text-white text-sm font-semibold disabled:opacity-60"
          >
            <Save className="w-4 h-4" />
            {saving ? 'Menyimpan...' : 'Simpan Pengaturan'}
          </button>
        </div>
      </form>

      {/* Google Integration & JSON Backup */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-4">
        <h2 className="text-base font-bold text-slate-900 dark:text-white">
          Integrasi Google Workspace & Cadangan Data
        </h2>

        <div className="flex flex-wrap items-center justify-between gap-4 p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800">
          <div className="flex items-start gap-3">
            <HardDrive className="w-5 h-5 text-orange-600 shrink-0 mt-0.5" />
            <div className="text-xs space-y-0.5">
              <div className="font-semibold text-slate-900 dark:text-white">
                Status Koneksi Google Workspace:{' '}
                <span
                  className={
                    hasGoogleToken
                      ? 'text-emerald-600 dark:text-emerald-400'
                      : 'text-amber-600 dark:text-amber-400'
                  }
                >
                  {hasGoogleToken
                    ? 'Aktif (Drive & Gmail Siap)'
                    : 'Belum Aktif / Perlu Izin Ulang'}
                </span>
              </div>
              <div className="text-slate-500 dark:text-slate-400">
                Penyimpanan aktif: {isLocalMode ? 'Browser (localStorage)' : 'Firebase Firestore Cloud'}
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={() => onConnectGoogle()}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-slate-900 dark:bg-orange-600 hover:bg-slate-800 dark:hover:bg-orange-500 text-white text-xs font-semibold"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            {hasGoogleToken ? 'Perbarui Izin Google' : 'Hubungkan Akun Google'}
          </button>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-4 pt-2">
          <div className="text-xs text-slate-600 dark:text-slate-400">
            Unduh salinan lengkap order, client, dan pengaturan dalam format JSON sebagai cadangan.
          </div>
          <button
            type="button"
            onClick={onDownloadBackup}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800"
          >
            <Download className="w-3.5 h-3.5" />
            Ekspor backup (JSON)
          </button>
        </div>
      </div>

      {/* Zona Berbahaya */}
      <div className="bg-white dark:bg-slate-900 border border-red-200 dark:border-red-900/70 rounded-xl p-6 space-y-4">
        <div className="flex items-center gap-2 text-red-600 dark:text-red-400">
          <AlertTriangle className="w-5 h-5" />
          <h2 className="text-base font-bold">Zona Berbahaya</h2>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="text-xs text-slate-600 dark:text-slate-300 space-y-1 max-w-xl">
            <p className="font-semibold text-slate-900 dark:text-white">
              Hapus seluruh data operasional PrintDesk
            </p>
            <p>
              Menghapus semua order ({ordersCount}), data client ({clientsCount}), riwayat email, nomor urut kode order (kembali ke 001), notifikasi, dan cache preview lokal. File di Google Drive tidak akan ikut terhapus.
            </p>
          </div>

          <button
            type="button"
            onClick={() => setResetModalOpen(true)}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-red-600 hover:bg-red-700 text-white text-xs font-semibold shrink-0"
          >
            <Trash2 className="w-4 h-4" />
            Reset Semua Data
          </button>
        </div>
      </div>

      <ResetDataModal
        open={resetModalOpen}
        ordersCount={ordersCount}
        clientsCount={clientsCount}
        onDownloadBackup={onDownloadBackup}
        onConfirmReset={onResetAllData}
        onClose={() => setResetModalOpen(false)}
      />
    </div>
  );
};
