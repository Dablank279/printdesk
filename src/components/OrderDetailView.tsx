import React, { useState } from 'react';
import {
  ArrowLeft,
  Edit,
  Trash2,
  Mail,
  Factory,
  Eye,
  Printer,
  MessageCircle,
  ExternalLink,
  CheckCircle2,
  Clock,
  FileText,
  Download,
  AlertCircle,
  RefreshCw,
} from 'lucide-react';
import {
  EmailLog,
  OrderFile,
  PAYMENT_STATUS_META,
  PaymentStatus,
  PrintOrder,
  ShopSettings,
  WORK_STATUS_META,
  WorkStatus,
} from '../types/printdesk';
import {
  buildWhatsAppUrl,
  canSendToVendor,
  formatDateTimeId,
  formatFileSize,
  formatRupiah,
  getPickupUrgency,
} from '../utils/formatters';
import { ConfirmModal } from './ConfirmModal';
import { getCachedFileBlob } from '../services/storageService';
import { deleteDriveFile, fetchDriveFileBlob } from '../services/googleDrive';

interface OrderDetailViewProps {
  order: PrintOrder;
  settings: ShopSettings;
  accessToken: string | null;
  onBack: () => void;
  onEdit: (order: PrintOrder) => void;
  onDelete: (orderId: string) => Promise<void>;
  onUpdateStatus: (
    order: PrintOrder,
    patch: Pick<
      PrintOrder,
      'workStatus' | 'paymentStatus' | 'dpAmount' | 'remainingAmount' | 'pickedUp'
    >
  ) => Promise<void>;
  onRemoveFile: (order: PrintOrder, fileId: string) => Promise<void>;
  onOpenPreview: (order: PrintOrder, fileIndex?: number) => void;
  onOpenEmail: (order: PrintOrder) => void;
  onOpenVendorEmail: (order: PrintOrder) => void;
  onOpenReceipt: (order: PrintOrder) => void;
}

export const OrderDetailView: React.FC<OrderDetailViewProps> = ({
  order,
  settings,
  accessToken,
  onBack,
  onEdit,
  onDelete,
  onUpdateStatus,
  onRemoveFile,
  onOpenPreview,
  onOpenEmail,
  onOpenVendorEmail,
  onOpenReceipt,
}) => {
  const [confirmDeleteOrder, setConfirmDeleteOrder] = useState(false);
  const [deletingOrder, setDeletingOrder] = useState(false);
  const [fileToDelete, setFileToDelete] = useState<OrderFile | null>(null);
  const [deletingFile, setDeletingFile] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [historyTab, setHistoryTab] = useState<'client' | 'vendor'>('client');

  const workMeta = WORK_STATUS_META[order.workStatus];
  const payMeta = PAYMENT_STATUS_META[order.paymentStatus];
  const urgency = getPickupUrgency(order.pickupAt, order.pickedUp);
  const vendorCheck = canSendToVendor(order);

  const handleWorkChange = async (nextWork: WorkStatus) => {
    await onUpdateStatus(order, {
      workStatus: nextWork,
      paymentStatus: order.paymentStatus,
      dpAmount: order.dpAmount,
      remainingAmount: order.remainingAmount,
      pickedUp: order.pickedUp,
    });
  };

  const handlePaymentChange = async (nextPay: PaymentStatus) => {
    let nextDp = order.dpAmount;
    if (nextPay === 'lunas') nextDp = order.totalPrice;
    else if (nextPay === 'belum_dp') nextDp = 0;

    await onUpdateStatus(order, {
      workStatus: order.workStatus,
      paymentStatus: nextPay,
      dpAmount: nextDp,
      remainingAmount: Math.max(0, order.totalPrice - nextDp),
      pickedUp: order.pickedUp,
    });
  };

  const handleTogglePickedUp = async () => {
    await onUpdateStatus(order, {
      workStatus: !order.pickedUp ? 'selesai' : order.workStatus,
      paymentStatus: order.paymentStatus,
      dpAmount: order.dpAmount,
      remainingAmount: order.remainingAmount,
      pickedUp: !order.pickedUp,
    });
  };

  const handleDownloadFile = async (f: OrderFile) => {
    setActionError(null);
    try {
      let blob = await getCachedFileBlob(f.id);
      if (!blob && f.driveFileId && accessToken) {
        blob = await fetchDriveFileBlob(accessToken, f.driveFileId);
      }

      if (blob) {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = f.name;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      } else if (f.webViewLink) {
        window.open(f.webViewLink, '_blank', 'noopener,noreferrer');
      } else {
        setActionError('Hubungkan akun Google untuk mengunduh file dari Google Drive.');
      }
    } catch (err: unknown) {
      setActionError(err instanceof Error ? err.message : 'Gagal mengunduh file.');
    }
  };

  const handleConfirmDeleteFile = async () => {
    if (!fileToDelete) return;
    setDeletingFile(true);
    setActionError(null);
    try {
      if (fileToDelete.driveFileId && accessToken) {
        await deleteDriveFile(accessToken, fileToDelete.driveFileId);
      }
      await onRemoveFile(order, fileToDelete.id);
      setFileToDelete(null);
    } catch (err: unknown) {
      setActionError(
        err instanceof Error ? err.message : 'Gagal menghapus file dari Google Drive.'
      );
      setFileToDelete(null);
    } finally {
      setDeletingFile(false);
    }
  };

  const renderHistoryLogs = (logs: EmailLog[], emptyText: string, onResend: () => void) => {
    if (logs.length === 0) {
      return (
        <p className="text-xs text-slate-500 dark:text-slate-400">
          {emptyText}
        </p>
      );
    }

    return (
      <div className="space-y-2.5">
        {logs.map((log) => (
          <div
            key={log.id}
            className="p-3.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 text-xs space-y-1.5"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="font-semibold text-slate-900 dark:text-white break-all">
                {log.subject}
              </span>
              <div className="flex items-center gap-2 shrink-0">
                <span
                  className={`px-2 py-0.5 rounded border font-medium ${
                    log.status === 'berhasil'
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-900'
                      : 'bg-red-50 text-red-700 border-red-200 dark:bg-red-950/60 dark:text-red-300 dark:border-red-900'
                  }`}
                >
                  {log.status === 'berhasil' ? 'Terkirim' : 'Gagal'}
                </span>
                <button
                  type="button"
                  onClick={onResend}
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 font-medium"
                >
                  <RefreshCw className="w-3 h-3" />
                  Kirim ulang
                </button>
              </div>
            </div>
            <div className="text-slate-600 dark:text-slate-300">
              Kepada: {log.recipients.join(', ')}
              {log.cc && log.cc.length > 0 ? ` · CC: ${log.cc.join(', ')}` : ''} ·{' '}
              {log.mode === 'lampiran' ? 'Lampiran File' : 'Link Google Drive'}
            </div>
            {log.attachments && log.attachments.length > 0 && (
              <div className="text-slate-500 dark:text-slate-400">
                File: {log.attachments.join(', ')}
              </div>
            )}
            <div className="text-slate-500 dark:text-slate-400 font-mono text-[11px]">
              {formatDateTimeId(log.sentAt)}
            </div>
            {log.errorMessage && (
              <div className="text-red-600 dark:text-red-400 pt-1">
                Error: {log.errorMessage}
              </div>
            )}
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Top Action Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-2 text-sm font-medium text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white"
        >
          <ArrowLeft className="w-4 h-4" />
          Kembali ke Papan Status
        </button>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => onOpenPreview(order, 0)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800"
          >
            <Eye className="w-4 h-4" />
            Preview Dokumen
          </button>

          <button
            type="button"
            onClick={() => onOpenEmail(order)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800"
          >
            <Mail className="w-4 h-4" />
            Kirim Email Client
          </button>

          <button
            type="button"
            disabled={!vendorCheck.ready}
            onClick={() => onOpenVendorEmail(order)}
            title={vendorCheck.ready ? 'Kirim order ke percetakan' : vendorCheck.reason}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-orange-600 hover:bg-orange-700 text-white text-xs font-semibold disabled:opacity-45 disabled:cursor-not-allowed"
          >
            <Factory className="w-4 h-4" />
            Kirim ke Percetakan
          </button>

          {order.clientPhone && (
            <a
              href={buildWhatsAppUrl(order, settings.shopName)}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold"
            >
              <MessageCircle className="w-4 h-4" />
              WhatsApp Client
            </a>
          )}

          <button
            type="button"
            onClick={() => onOpenReceipt(order)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800"
          >
            <Printer className="w-4 h-4" />
            Cetak Nota
          </button>

          <button
            type="button"
            onClick={() => onEdit(order)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800"
          >
            <Edit className="w-4 h-4" />
            Edit
          </button>

          <button
            type="button"
            onClick={() => setConfirmDeleteOrder(true)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-red-200 dark:border-red-900 text-xs font-semibold text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/50"
          >
            <Trash2 className="w-4 h-4" />
            Hapus
          </button>
        </div>
      </div>

      {actionError && (
        <div className="p-3.5 rounded-xl bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-900 flex items-start gap-2.5 text-xs text-red-700 dark:text-red-300">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{actionError}</span>
        </div>
      )}

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {/* Header & Spec Card */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-5">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-2.5 flex-wrap">
                  <span className="text-sm font-mono font-bold text-orange-600 dark:text-orange-400">
                    {order.orderCode}
                  </span>
                  <span className="text-xs text-slate-400">·</span>
                  <span className="text-xs text-slate-500 dark:text-slate-400">
                    Dibuat {formatDateTimeId(order.createdAtIso)}
                  </span>
                </div>
                <h2 className="text-xl font-bold text-slate-900 dark:text-white mt-1">
                  {order.printType}
                </h2>
                <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  Kategori:{' '}
                  <span className="font-medium text-slate-700 dark:text-slate-200">
                    {order.category}
                  </span>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <span
                  className={`text-xs font-semibold px-2.5 py-1 rounded border ${workMeta.colorClass}`}
                >
                  {workMeta.label}
                </span>
                <span
                  className={`text-xs font-semibold px-2.5 py-1 rounded border ${payMeta.colorClass}`}
                >
                  {payMeta.label}
                </span>
                <span
                  className={`text-xs font-semibold px-2.5 py-1 rounded border ${urgency.badgeClass}`}
                >
                  {urgency.label}
                </span>
                {order.vendorSentAt ? (
                  <span className="text-xs font-semibold px-2.5 py-1 rounded border bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-900">
                    Sudah dikirim ke percetakan ({formatDateTimeId(order.vendorSentAt)})
                  </span>
                ) : (
                  <span className="text-xs font-semibold px-2.5 py-1 rounded border bg-slate-50 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700">
                    Belum dikirim ke percetakan
                  </span>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-4 border-t border-slate-100 dark:border-slate-800 text-xs">
              <div>
                <div className="text-slate-500 dark:text-slate-400">Ukuran & Orientasi</div>
                <div className="font-semibold text-slate-900 dark:text-white mt-0.5">
                  {order.specs.paperSize} · {order.specs.orientation}
                </div>
              </div>
              <div>
                <div className="text-slate-500 dark:text-slate-400">Qty & Halaman</div>
                <div className="font-mono tabular-nums font-semibold text-slate-900 dark:text-white mt-0.5">
                  {order.specs.copies} {order.specs.qtyUnit || 'PCS'} ({order.specs.pageCount} hal)
                </div>
              </div>
              <div>
                <div className="text-slate-500 dark:text-slate-400">Bahan / Kertas</div>
                <div className="font-semibold text-slate-900 dark:text-white mt-0.5">
                  {order.specs.paperMaterial}
                </div>
              </div>
              <div>
                <div className="text-slate-500 dark:text-slate-400">Mode Warna</div>
                <div className="font-semibold text-slate-900 dark:text-white mt-0.5">
                  {order.specs.colorMode}
                </div>
              </div>
              <div className="col-span-2 sm:col-span-4">
                <div className="text-slate-500 dark:text-slate-400">Finishing</div>
                <div className="font-semibold text-slate-900 dark:text-white mt-0.5">
                  {order.specs.finishing || '-'}
                </div>
              </div>
              {order.notes && (
                <div className="col-span-2 sm:col-span-4 p-3 rounded-lg bg-slate-50 dark:bg-slate-800/60 text-slate-700 dark:text-slate-300">
                  <span className="font-semibold">Catatan:</span> {order.notes}
                </div>
              )}
            </div>
          </div>

          {/* Attached Files */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-4">
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              Dokumen Cetak & Arsip Google Drive ({order.files.length})
            </h3>

            {order.files.length === 0 ? (
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Belum ada file terlampir. Klik "Edit" untuk mengunggah dokumen order.
              </p>
            ) : (
              <div className="divide-y divide-slate-100 dark:divide-slate-800 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
                {order.files.map((f, idx) => (
                  <div
                    key={f.id}
                    className="p-4 flex flex-wrap items-center justify-between gap-3"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <FileText className="w-5 h-5 text-orange-600 shrink-0" />
                      <div className="min-w-0">
                        <div className="text-sm font-semibold text-slate-900 dark:text-white truncate">
                          {f.name}
                        </div>
                        <div className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-2 flex-wrap">
                          <span>{formatFileSize(f.size)}</span>
                          {f.driveFolderPath && (
                            <>
                              <span aria-hidden="true">·</span>
                              <span className="font-mono">{f.driveFolderPath}</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => onOpenPreview(order, idx)}
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-slate-900 dark:bg-slate-800 hover:bg-slate-800 dark:hover:bg-slate-700 text-white text-xs font-medium"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        Preview
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDownloadFile(f)}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800"
                      >
                        <Download className="w-3.5 h-3.5" />
                        Download
                      </button>
                      {f.webViewLink && (
                        <a
                          href={f.webViewLink}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                          Drive
                        </a>
                      )}
                      <button
                        type="button"
                        onClick={() => setFileToDelete(f)}
                        title="Hapus file"
                        className="p-1.5 rounded-lg text-red-600 hover:bg-red-50 dark:hover:bg-red-950/50"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Email History with 2 Tabs: Client & Percetakan */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-lg">
                <button
                  type="button"
                  onClick={() => setHistoryTab('client')}
                  className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors ${
                    historyTab === 'client'
                      ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-2xs'
                      : 'text-slate-600 dark:text-slate-300'
                  }`}
                >
                  Email ke Client ({order.emailHistory.length})
                </button>
                <button
                  type="button"
                  onClick={() => setHistoryTab('vendor')}
                  className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors ${
                    historyTab === 'vendor'
                      ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-2xs'
                      : 'text-slate-600 dark:text-slate-300'
                  }`}
                >
                  Email ke Percetakan ({order.vendorEmailHistory.length})
                </button>
              </div>

              {historyTab === 'client' ? (
                <button
                  type="button"
                  onClick={() => onOpenEmail(order)}
                  className="text-xs font-semibold text-orange-600 hover:underline"
                >
                  + Kirim ke Client
                </button>
              ) : (
                <button
                  type="button"
                  disabled={!vendorCheck.ready}
                  onClick={() => onOpenVendorEmail(order)}
                  title={vendorCheck.reason}
                  className="text-xs font-semibold text-orange-600 hover:underline disabled:opacity-45 disabled:cursor-not-allowed"
                >
                  + Kirim ke Percetakan
                </button>
              )}
            </div>

            {historyTab === 'client'
              ? renderHistoryLogs(
                  order.emailHistory,
                  'Belum ada riwayat email ke client untuk order ini.',
                  () => onOpenEmail(order)
                )
              : renderHistoryLogs(
                  order.vendorEmailHistory,
                  'Order ini belum pernah dikirim ke email percetakan.',
                  () => onOpenVendorEmail(order)
                )}
          </div>
        </div>

        {/* Right Sidebar: Client, Payment, Status Controls */}
        <div className="space-y-6">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-4">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
              Informasi Client & Pengambilan
            </h3>
            <div className="space-y-2 text-xs">
              <div>
                <div className="text-slate-500 dark:text-slate-400">Nama Client</div>
                <div className="text-sm font-bold text-slate-900 dark:text-white">
                  {order.clientName}
                </div>
              </div>
              <div>
                <div className="text-slate-500 dark:text-slate-400">No. HP / WhatsApp</div>
                <div className="font-mono text-slate-800 dark:text-slate-200">
                  {order.clientPhone}
                </div>
              </div>
              {order.clientEmail && (
                <div>
                  <div className="text-slate-500 dark:text-slate-400">Email</div>
                  <div className="text-slate-800 dark:text-slate-200 break-all">
                    {order.clientEmail}
                  </div>
                </div>
              )}
              <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
                <div className="text-slate-500 dark:text-slate-400 flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5" />
                  Jadwal Pengambilan
                </div>
                <div className="text-sm font-mono font-semibold text-slate-900 dark:text-white mt-0.5">
                  {formatDateTimeId(order.pickupAt)}
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={handleTogglePickedUp}
              className={`w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-xs font-semibold transition-colors ${
                order.pickedUp
                  ? 'bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-900 text-emerald-700 dark:text-emerald-300'
                  : 'bg-slate-900 dark:bg-slate-800 hover:bg-slate-800 dark:hover:bg-slate-700 text-white'
              }`}
            >
              <CheckCircle2 className="w-4 h-4" />
              {order.pickedUp ? 'Sudah Diambil Client (Klik untuk batal)' : 'Tandai Sudah Diambil'}
            </button>
          </div>

          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-4">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
              Rincian Biaya & Status Cepat
            </h3>
            <div className="space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-500 dark:text-slate-400">Harga Total</span>
                <span className="font-mono tabular-nums font-semibold text-slate-900 dark:text-white">
                  {formatRupiah(order.totalPrice)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 dark:text-slate-400">DP Masuk</span>
                <span className="font-mono tabular-nums font-semibold text-emerald-600 dark:text-emerald-400">
                  {formatRupiah(order.dpAmount)}
                </span>
              </div>
              <div className="flex justify-between pt-2 border-t border-slate-100 dark:border-slate-800 text-sm">
                <span className="font-bold text-slate-900 dark:text-white">Sisa Tagihan</span>
                <span className="font-mono tabular-nums font-bold text-orange-600 dark:text-orange-400">
                  {formatRupiah(order.remainingAmount)}
                </span>
              </div>
            </div>

            <div className="space-y-3 pt-2 border-t border-slate-100 dark:border-slate-800">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Ubah Status Pengerjaan
                </label>
                <select
                  value={order.workStatus}
                  onChange={(e) => handleWorkChange(e.target.value as WorkStatus)}
                  className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
                >
                  <option value="belum_dp">Belum DP</option>
                  <option value="dalam_proses">Dalam Proses Pengerjaan</option>
                  <option value="selesai">Selesai</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Ubah Status Pembayaran
                </label>
                <select
                  value={order.paymentStatus}
                  onChange={(e) => handlePaymentChange(e.target.value as PaymentStatus)}
                  className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
                >
                  <option value="belum_dp">Belum DP</option>
                  <option value="sudah_dp">Sudah DP</option>
                  <option value="lunas">Lunas (otomatis lunasi sisa)</option>
                </select>
              </div>
            </div>
          </div>
        </div>
      </div>

      <ConfirmModal
        open={confirmDeleteOrder}
        title="Hapus Order Ini?"
        description={`Order ${order.orderCode} milik ${order.clientName} akan dihapus permanen dari daftar order. Tindakan ini tidak dapat dibatalkan.`}
        confirmLabel="Ya, Hapus Order"
        loading={deletingOrder}
        onCancel={() => setConfirmDeleteOrder(false)}
        onConfirm={async () => {
          setDeletingOrder(true);
          await onDelete(order.id);
          setDeletingOrder(false);
          setConfirmDeleteOrder(false);
        }}
      />

      <ConfirmModal
        open={Boolean(fileToDelete)}
        title="Hapus File Dokumen?"
        description={`File "${fileToDelete?.name}" akan dihapus dari order ini${
          fileToDelete?.driveFileId ? ' dan dari Google Drive Anda' : ''
        }. Lanjutkan?`}
        confirmLabel="Ya, Hapus File"
        loading={deletingFile}
        onCancel={() => setFileToDelete(null)}
        onConfirm={handleConfirmDeleteFile}
      />
    </div>
  );
};
