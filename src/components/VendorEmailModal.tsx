import React, { useEffect, useMemo, useState } from 'react';
import {
  X,
  Send,
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  RefreshCw,
  Factory,
  Paperclip,
  Link as LinkIcon,
  Eye,
} from 'lucide-react';
import { EmailLog, PrintOrder, ShopSettings } from '../types/printdesk';
import {
  buildVendorEmailSubject,
  formatDateTimeId,
  formatFileSize,
  generateSafeId,
  interpolateVendorTemplate,
} from '../utils/formatters';
import {
  EmailAttachmentPayload,
  parseEmailRecipients,
  sendOrderEmailViaGmail,
} from '../services/gmailApi';
import { cacheFileBlob, getCachedFileBlob } from '../services/storageService';
import { fetchDriveFileBlob } from '../services/googleDrive';

const MAX_ATTACHMENT_BYTES = 20 * 1024 * 1024; // 20 MB

interface VendorEmailModalProps {
  open: boolean;
  order: PrintOrder | null;
  settings: ShopSettings;
  accessToken: string | null;
  onClose: () => void;
  onRequestGoogleAuth: () => Promise<string | null>;
  onRecordVendorEmail: (params: {
    orderId: string;
    log: EmailLog;
    succeeded: boolean;
    markInProgress: boolean;
  }) => Promise<void>;
  onNotifyToast: (msg: string, tone?: 'success' | 'error') => void;
}

export const VendorEmailModal: React.FC<VendorEmailModalProps> = ({
  open,
  order,
  settings,
  accessToken,
  onClose,
  onRequestGoogleAuth,
  onRecordVendorEmail,
  onNotifyToast,
}) => {
  const [recipientsRaw, setRecipientsRaw] = useState('');
  const [ccRaw, setCcRaw] = useState('');
  const [subject, setSubject] = useState('');
  const [bodyText, setBodyText] = useState('');
  const [selectedFileIds, setSelectedFileIds] = useState<string[]>([]);
  const [sendMode, setSendMode] = useState<'lampiran' | 'link_drive'>('lampiran');
  const [markInProgress, setMarkInProgress] = useState(true);
  const [showPreviewBox, setShowPreviewBox] = useState(false);

  const [sending, setSending] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !order) return;
    setRecipientsRaw(settings.vendorEmail || '');
    setCcRaw(settings.vendorCcEmail || '');
    setSubject(
      buildVendorEmailSubject({
        printType: order.printType,
        paperMaterial: order.specs.paperMaterial,
        paperSize: order.specs.paperSize,
        copies: order.specs.copies,
        qtyUnit: order.specs.qtyUnit,
      })
    );
    setBodyText(
      interpolateVendorTemplate(
        settings.vendorEmailBodyTemplate,
        order,
        settings
      )
    );
    setSelectedFileIds(order.files.map((f) => f.id));
    setSendMode('lampiran');
    setMarkInProgress(true);
    setShowPreviewBox(false);
    setErrorMsg(null);
  }, [open, order?.id, settings]);

  const selectedFiles = useMemo(() => {
    if (!order) return [];
    return order.files.filter((f) => selectedFileIds.includes(f.id));
  }, [order, selectedFileIds]);

  const totalSelectedBytes = useMemo(
    () => selectedFiles.reduce((sum, f) => sum + (Number(f.size) || 0), 0),
    [selectedFiles]
  );

  const exceeds20Mb = totalSelectedBytes > MAX_ATTACHMENT_BYTES;

  if (!open || !order) return null;

  const { valid: validTo, invalid: invalidTo } = parseEmailRecipients(recipientsRaw);
  const { valid: validCc, invalid: invalidCc } = parseEmailRecipients(ccRaw);

  const toggleFileSelection = (fileId: string) => {
    setSelectedFileIds((prev) =>
      prev.includes(fileId) ? prev.filter((id) => id !== fileId) : [...prev, fileId]
    );
  };

  const handleSend = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setErrorMsg(null);

    if (invalidTo.length > 0) {
      setErrorMsg(`Format email tujuan tidak valid: ${invalidTo.join(', ')}`);
      return;
    }
    if (validTo.length === 0) {
      setErrorMsg('Alamat email percetakan tujuan wajib diisi.');
      return;
    }
    if (invalidCc.length > 0) {
      setErrorMsg(`Format email CC tidak valid: ${invalidCc.join(', ')}`);
      return;
    }
    if (!subject.trim()) {
      setErrorMsg('Subjek email percetakan tidak boleh kosong.');
      return;
    }
    if (sendMode === 'lampiran' && selectedFiles.length === 0) {
      setErrorMsg('Pilih minimal 1 file cetak untuk dilampirkan.');
      return;
    }
    if (sendMode === 'lampiran' && exceeds20Mb) {
      setErrorMsg(
        'Total ukuran lampiran melebihi 20 MB. Silakan gunakan opsi "Kirim Link Google Drive" atau kurangi lampiran.'
      );
      return;
    }

    setSending(true);
    try {
      let activeToken = accessToken;
      if (!activeToken) {
        activeToken = await onRequestGoogleAuth();
      }
      if (!activeToken) {
        throw new Error(
          'Akun Google belum terhubung atau izin Gmail belum diberikan.'
        );
      }

      const attachments: EmailAttachmentPayload[] = [];
      let finalBody = bodyText;

      if (sendMode === 'lampiran') {
        for (const f of selectedFiles) {
          let blob = await getCachedFileBlob(f.id);
          if (!blob && f.driveFileId) {
            blob = await fetchDriveFileBlob(activeToken, f.driveFileId);
            await cacheFileBlob(f.id, blob);
          }
          if (!blob) {
            throw new Error(
              `File "${f.name}" tidak ditemukan di Google Drive maupun cache browser.`
            );
          }
          attachments.push({
            name: f.name,
            mimeType: f.mimeType || 'application/pdf',
            blob,
          });
        }
      } else {
        const driveLinks = selectedFiles
          .filter((f) => f.webViewLink)
          .map((f) => `- ${f.name}: ${f.webViewLink}`)
          .join('\n');
        if (!driveLinks) {
          throw new Error(
            'File belum diunggah ke Google Drive sehingga tautan Drive belum tersedia.'
          );
        }
        if (!finalBody.includes('drive.google.com')) {
          finalBody = `${finalBody}\n\nTautan File Cetak (Google Drive):\n${driveLinks}`;
        }
      }

      await sendOrderEmailViaGmail({
        accessToken: activeToken,
        recipients: validTo,
        cc: validCc,
        subject: subject.trim(),
        bodyText: finalBody,
        attachments,
      });

      const log: EmailLog = {
        id: generateSafeId('vmail'),
        sentAt: new Date().toISOString(),
        recipients: validTo,
        cc: validCc,
        subject: subject.trim(),
        mode: sendMode,
        attachments: selectedFiles.map((f) => f.name),
        status: 'berhasil',
      };

      await onRecordVendorEmail({
        orderId: order.id,
        log,
        succeeded: true,
        markInProgress,
      });

      onNotifyToast(
        `Order ${order.orderCode} berhasil dikirim ke ${settings.vendorName || validTo[0]}.`,
        'success'
      );
      onClose();
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : 'Gagal mengirim email ke percetakan.';
      setErrorMsg(msg);

      const failLog: EmailLog = {
        id: generateSafeId('vmail'),
        sentAt: new Date().toISOString(),
        recipients: validTo,
        cc: validCc,
        subject: subject.trim(),
        mode: sendMode,
        attachments: selectedFiles.map((f) => f.name),
        status: 'gagal',
        errorMessage: msg.slice(0, 250),
      };

      await onRecordVendorEmail({
        orderId: order.id,
        log: failLog,
        succeeded: false,
        markInProgress: false,
      });
    } finally {
      setSending(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-xs p-4"
      role="dialog"
      aria-modal="true"
    >
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-2xl w-full max-h-[92vh] flex flex-col shadow-2xl overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-lg bg-slate-900 dark:bg-orange-600 text-white flex items-center justify-center">
              <Factory className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                Kirim Order ke Percetakan
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                <span className="font-mono">{order.orderCode}</span> · {order.clientName}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSend} className="flex-1 overflow-y-auto p-6 space-y-4">
          {/* Duplicate Warning */}
          {order.vendorSentAt && (
            <div className="p-3.5 rounded-xl bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-900 flex items-start gap-2.5 text-xs text-amber-800 dark:text-amber-200">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" />
              <div>
                <div className="font-semibold">
                  Order ini sudah dikirim pada {formatDateTimeId(order.vendorSentAt)}. Kirim ulang?
                </div>
                <div className="opacity-85 mt-0.5">
                  Pastikan Anda memang ingin mengirim ulang agar tidak terjadi cetak ganda di percetakan.
                </div>
              </div>
            </div>
          )}

          {/* Error Banner */}
          {errorMsg && (
            <div className="p-3.5 rounded-xl bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-900 text-xs text-red-700 dark:text-red-300 space-y-2">
              <div className="flex items-start gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{errorMsg}</span>
              </div>
              <div className="flex flex-wrap items-center gap-2 pl-6">
                <button
                  type="button"
                  onClick={() => handleSend()}
                  disabled={sending}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-red-600 hover:bg-red-700 text-white font-medium"
                >
                  <RefreshCw className="w-3 h-3" />
                  Coba Lagi
                </button>
                <button
                  type="button"
                  onClick={() => onRequestGoogleAuth()}
                  className="px-2.5 py-1 rounded border border-red-300 dark:border-red-800 hover:bg-red-100 dark:hover:bg-red-900/40 font-medium"
                >
                  Hubungkan Akun Google
                </button>
              </div>
            </div>
          )}

          {!accessToken && !errorMsg && (
            <div className="p-3.5 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex flex-wrap items-center justify-between gap-2 text-xs">
              <span className="text-slate-700 dark:text-slate-200">
                Akun Google belum terhubung untuk mengirim email via Gmail.
              </span>
              <button
                type="button"
                onClick={() => onRequestGoogleAuth()}
                className="px-3 py-1.5 rounded-lg bg-orange-600 hover:bg-orange-700 text-white font-semibold"
              >
                Hubungkan Akun Google
              </button>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Email Percetakan Tujuan *
              </label>
              <input
                type="text"
                value={recipientsRaw}
                onChange={(e) => setRecipientsRaw(e.target.value)}
                placeholder="wahanadimensiwd@gmail.com"
                className="w-full px-3.5 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
              />
              {invalidTo.length > 0 && (
                <p className="text-[11px] text-red-600 mt-1">
                  Tidak valid: {invalidTo.join(', ')}
                </p>
              )}
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Email CC (opsional)
              </label>
              <input
                type="text"
                value={ccRaw}
                onChange={(e) => setCcRaw(e.target.value)}
                placeholder="admin@percetakan.com"
                className="w-full px-3.5 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
              />
              {invalidCc.length > 0 && (
                <p className="text-[11px] text-red-600 mt-1">
                  CC tidak valid: {invalidCc.join(', ')}
                </p>
              )}
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              Subjek Email (Otomatis Huruf Kapital — Dapat Diedit)
            </label>
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="w-full px-3.5 py-2 text-xs sm:text-sm font-mono font-semibold rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
            />
          </div>

          {/* Attachment Checklist & 20MB guard */}
          <div className="space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                File Cetak Terlampir ({selectedFiles.length} dipilih · Total{' '}
                <span className="font-mono">{formatFileSize(totalSelectedBytes)}</span>)
              </label>
              <div className="flex items-center gap-1 p-0.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-[11px]">
                <button
                  type="button"
                  onClick={() => setSendMode('lampiran')}
                  className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md font-medium ${
                    sendMode === 'lampiran'
                      ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-2xs'
                      : 'text-slate-500 dark:text-slate-400'
                  }`}
                >
                  <Paperclip className="w-3 h-3" />
                  Lampiran File
                </button>
                <button
                  type="button"
                  onClick={() => setSendMode('link_drive')}
                  className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md font-medium ${
                    sendMode === 'link_drive'
                      ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-2xs'
                      : 'text-slate-500 dark:text-slate-400'
                  }`}
                >
                  <LinkIcon className="w-3 h-3" />
                  Link Google Drive
                </button>
              </div>
            </div>

            {exceeds20Mb && sendMode === 'lampiran' && (
              <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-900 flex flex-wrap items-center justify-between gap-2 text-xs text-amber-800 dark:text-amber-200">
                <span>
                  Ukuran total lampiran ({formatFileSize(totalSelectedBytes)}) melebihi 20 MB. Disarankan kirim lewat Link Google Drive.
                </span>
                <button
                  type="button"
                  onClick={() => setSendMode('link_drive')}
                  className="px-2.5 py-1 rounded bg-amber-600 hover:bg-amber-700 text-white font-semibold shrink-0"
                >
                  Ganti ke Link Google Drive
                </button>
              </div>
            )}

            <div className="border border-slate-200 dark:border-slate-800 rounded-xl divide-y divide-slate-100 dark:divide-slate-800 max-h-40 overflow-y-auto">
              {order.files.map((f) => {
                const checked = selectedFileIds.includes(f.id);
                return (
                  <label
                    key={f.id}
                    className="flex items-center justify-between gap-3 px-3.5 py-2.5 text-xs cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50"
                  >
                    <span className="flex items-center gap-2.5 min-w-0">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleFileSelection(f.id)}
                        className="rounded border-slate-300 text-orange-600 focus:ring-orange-500"
                      />
                      <span className="font-medium text-slate-900 dark:text-white truncate">
                        {f.name}
                      </span>
                    </span>
                    <span className="font-mono text-slate-500 dark:text-slate-400 shrink-0">
                      {formatFileSize(f.size)}
                    </span>
                  </label>
                );
              })}
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              Isi Pesan ke Percetakan
            </label>
            <textarea
              rows={7}
              value={bodyText}
              onChange={(e) => setBodyText(e.target.value)}
              className="w-full px-3.5 py-2.5 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white leading-relaxed"
            />
          </div>

          {/* Toggle Preview Email */}
          <div className="space-y-2">
            <button
              type="button"
              onClick={() => setShowPreviewBox((p) => !p)}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-orange-600 dark:text-orange-400 hover:underline"
            >
              <Eye className="w-3.5 h-3.5" />
              {showPreviewBox ? 'Sembunyikan Preview Email' : 'Lihat Preview Email Sebelum Kirim'}
            </button>

            {showPreviewBox && (
              <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 text-xs space-y-2">
                <div>
                  <span className="text-slate-500 dark:text-slate-400">Kepada: </span>
                  <span className="font-medium text-slate-900 dark:text-white">
                    {validTo.join(', ') || '-'}
                  </span>
                  {validCc.length > 0 && (
                    <span className="text-slate-500 dark:text-slate-400">
                      {' '}
                      (CC: {validCc.join(', ')})
                    </span>
                  )}
                </div>
                <div>
                  <span className="text-slate-500 dark:text-slate-400">Subjek: </span>
                  <span className="font-mono font-semibold text-slate-900 dark:text-white">
                    {subject}
                  </span>
                </div>
                <div className="pt-2 border-t border-slate-200 dark:border-slate-700 whitespace-pre-wrap text-slate-700 dark:text-slate-200">
                  {bodyText}
                </div>
                <div className="pt-2 border-t border-slate-200 dark:border-slate-700">
                  <span className="text-slate-500 dark:text-slate-400">
                    {sendMode === 'lampiran' ? 'Lampiran File: ' : 'Tautan Drive: '}
                  </span>
                  <span className="font-medium text-slate-900 dark:text-white">
                    {selectedFiles.map((f) => f.name).join(', ') || '-'}
                  </span>
                </div>
              </div>
            )}
          </div>

          <label className="flex items-center gap-2 text-xs font-medium text-slate-700 dark:text-slate-300 cursor-pointer pt-1">
            <input
              type="checkbox"
              checked={markInProgress}
              onChange={(e) => setMarkInProgress(e.target.checked)}
              className="rounded border-slate-300 text-orange-600 focus:ring-orange-500"
            />
            Ubah status jadi <strong className="text-slate-900 dark:text-white">Dalam Proses Pengerjaan</strong> setelah terkirim
          </label>

          <div className="pt-3 flex items-center justify-end gap-2.5 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={onClose}
              disabled={sending}
              className="px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={sending}
              className="inline-flex items-center gap-2 px-5 py-2 rounded-lg bg-orange-600 hover:bg-orange-700 text-white text-sm font-semibold transition-colors disabled:opacity-60"
            >
              {sending ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  Mengirim ke Percetakan...
                </>
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  Kirim Sekarang
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
