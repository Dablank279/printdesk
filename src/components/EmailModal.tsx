import React, { useEffect, useState } from 'react';
import {
  X,
  Mail,
  Paperclip,
  Link as LinkIcon,
  Send,
  AlertCircle,
  CheckCircle2,
  RefreshCw,
} from 'lucide-react';
import { EmailLog, PrintOrder, ShopSettings } from '../types/printdesk';
import { generateSafeId, interpolateTemplate } from '../utils/formatters';
import {
  EmailAttachmentPayload,
  parseEmailRecipients,
  sendOrderEmailViaGmail,
} from '../services/gmailApi';
import { getCachedFileBlob } from '../services/storageService';
import { fetchDriveFileBlob } from '../services/googleDrive';

interface EmailModalProps {
  open: boolean;
  order: PrintOrder | null;
  settings: ShopSettings;
  accessToken: string | null;
  onClose: () => void;
  onRequestGoogleAuth: () => Promise<string | null>;
  onRecordEmailLog: (orderId: string, log: EmailLog) => Promise<void>;
}

export const EmailModal: React.FC<EmailModalProps> = ({
  open,
  order,
  settings,
  accessToken,
  onClose,
  onRequestGoogleAuth,
  onRecordEmailLog,
}) => {
  const [recipientsRaw, setRecipientsRaw] = useState('');
  const [subject, setSubject] = useState('');
  const [bodyText, setBodyText] = useState('');
  const [mode, setMode] = useState<'link_drive' | 'lampiran'>('link_drive');
  const [confirmStep, setConfirmStep] = useState(false);
  const [sending, setSending] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !order) return;
    setRecipientsRaw(order.clientEmail || '');
    setSubject(
      interpolateTemplate(
        settings.emailSubjectTemplate || 'Dokumen Order {KodeOrder} - {NamaClient}',
        order,
        settings
      )
    );
    setBodyText(
      interpolateTemplate(settings.emailBodyTemplate, order, settings)
    );
    setMode(
      order.files.some((f) => f.webViewLink) ? 'link_drive' : 'lampiran'
    );
    setConfirmStep(false);
    setErrorMsg(null);
    setSuccessMsg(null);
  }, [open, order?.id, settings]);

  if (!open || !order) return null;

  const { valid, invalid } = parseEmailRecipients(recipientsRaw);

  const handlePrepareConfirm = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    if (invalid.length > 0) {
      setErrorMsg(`Format email tidak valid: ${invalid.join(', ')}`);
      return;
    }
    if (valid.length === 0) {
      setErrorMsg('Masukkan minimal satu alamat email tujuan yang valid.');
      return;
    }
    if (!subject.trim()) {
      setErrorMsg('Subjek email tidak boleh kosong.');
      return;
    }
    setConfirmStep(true);
  };

  const executeSend = async () => {
    setSending(true);
    setErrorMsg(null);

    try {
      let activeToken = accessToken;
      if (!activeToken) {
        activeToken = await onRequestGoogleAuth();
      }
      if (!activeToken) {
        throw new Error(
          'Izin Gmail belum diberikan. Silakan login dengan Google dan centang akses pengiriman email.'
        );
      }

      const attachments: EmailAttachmentPayload[] = [];
      if (mode === 'lampiran' && order.files.length > 0) {
        for (const f of order.files) {
          let blob = await getCachedFileBlob(f.id);
          if (!blob && f.driveFileId) {
            blob = await fetchDriveFileBlob(activeToken, f.driveFileId);
          }
          if (blob) {
            attachments.push({
              name: f.name,
              mimeType: f.mimeType,
              blob,
            });
          }
        }
      }

      await sendOrderEmailViaGmail({
        accessToken: activeToken,
        recipients: valid,
        subject: subject.trim(),
        bodyText,
        attachments,
        shopBranding: {
          shopName: settings.shopName,
          shopAddress: settings.shopAddress,
          shopPhone: settings.shopPhone,
          logoDataUrl: settings.logoDataUrl,
        },
      });

      const log: EmailLog = {
        id: generateSafeId('mail'),
        sentAt: new Date().toISOString(),
        recipients: valid,
        subject: subject.trim(),
        mode,
        attachments: order.files.map((f) => f.name),
        status: 'berhasil',
      };
      await onRecordEmailLog(order.id, log);
      setConfirmStep(false);
      setSuccessMsg(`Email berhasil dikirim ke ${valid.join(', ')}.`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Gagal mengirim email.';
      setErrorMsg(msg);
      setConfirmStep(false);

      const failLog: EmailLog = {
        id: generateSafeId('mail'),
        sentAt: new Date().toISOString(),
        recipients: valid,
        subject: subject.trim(),
        mode,
        attachments: order.files.map((f) => f.name),
        status: 'gagal',
        errorMessage: msg.slice(0, 250),
      };
      await onRecordEmailLog(order.id, failLog);
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
            <div className="w-9 h-9 rounded-lg bg-orange-50 dark:bg-orange-950/60 text-orange-600 flex items-center justify-center">
              <Mail className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                Kirim Email ke Client
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

        <form onSubmit={handlePrepareConfirm} className="flex-1 overflow-y-auto p-6 space-y-4">
          {errorMsg && (
            <div className="p-3.5 rounded-lg bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-900 text-xs text-red-700 dark:text-red-300 space-y-2">
              <div className="flex items-start gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{errorMsg}</span>
              </div>
              <div className="flex items-center gap-2 pl-6">
                <button
                  type="button"
                  onClick={executeSend}
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
                  Hubungkan Ulang Google
                </button>
              </div>
            </div>
          )}

          {successMsg && (
            <div className="p-3.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-900 flex items-start gap-2 text-xs text-emerald-700 dark:text-emerald-300">
              <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{successMsg}</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              Alamat Email Tujuan (pisahkan dengan koma jika lebih dari satu)
            </label>
            <input
              type="text"
              value={recipientsRaw}
              onChange={(e) => setRecipientsRaw(e.target.value)}
              placeholder="contoh: client@perusahaan.com, tim@perusahaan.com"
              className="w-full px-3.5 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-500/40 focus:border-orange-500"
            />
            {invalid.length > 0 && (
              <p className="text-xs text-red-600 dark:text-red-400 mt-1">
                Email tidak valid: {invalid.join(', ')}
              </p>
            )}
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              Subjek Email
            </label>
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="w-full px-3.5 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-500/40 focus:border-orange-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              Metode Pengiriman File ({order.files.length} file tersedia)
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={() => setMode('link_drive')}
                className={`flex items-center gap-2.5 p-3 rounded-lg border text-left text-xs transition-colors ${
                  mode === 'link_drive'
                    ? 'border-orange-500 bg-orange-50 dark:bg-orange-950/40 text-orange-900 dark:text-orange-200'
                    : 'border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
                }`}
              >
                <LinkIcon className="w-4 h-4 shrink-0" />
                <div>
                  <div className="font-semibold">Kirim Link Google Drive</div>
                  <div className="text-[11px] opacity-80">Ringan & cepat untuk file besar</div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setMode('lampiran')}
                className={`flex items-center gap-2.5 p-3 rounded-lg border text-left text-xs transition-colors ${
                  mode === 'lampiran'
                    ? 'border-orange-500 bg-orange-50 dark:bg-orange-950/40 text-orange-900 dark:text-orange-200'
                    : 'border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
                }`}
              >
                <Paperclip className="w-4 h-4 shrink-0" />
                <div>
                  <div className="font-semibold">Lampirkan File Langsung</div>
                  <div className="text-[11px] opacity-80">File ikut terlampir di email</div>
                </div>
              </button>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              Isi Pesan
            </label>
            <textarea
              rows={8}
              value={bodyText}
              onChange={(e) => setBodyText(e.target.value)}
              className="w-full px-3.5 py-2.5 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-500/40 focus:border-orange-500 font-sans leading-relaxed"
            />
          </div>

          {confirmStep && (
            <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900 space-y-3">
              <div className="text-xs font-semibold text-amber-900 dark:text-amber-200">
                Konfirmasi Pengiriman Email via Gmail
              </div>
              <p className="text-xs text-amber-800 dark:text-amber-300 leading-relaxed">
                Anda akan mengirim email dengan subjek <strong>"{subject}"</strong> kepada{' '}
                <strong>{valid.join(', ')}</strong> ({mode === 'lampiran' ? `dengan ${order.files.length} lampiran file` : 'hanya link Google Drive'}). Lanjutkan?
              </p>
              <div className="flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setConfirmStep(false)}
                  disabled={sending}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium border border-amber-300 dark:border-amber-800 text-amber-900 dark:text-amber-200 hover:bg-amber-100 dark:hover:bg-amber-900/40"
                >
                  Periksa Ulang
                </button>
                <button
                  type="button"
                  onClick={executeSend}
                  disabled={sending}
                  className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-orange-600 hover:bg-orange-700 text-white text-xs font-semibold disabled:opacity-60"
                >
                  <Send className="w-3.5 h-3.5" />
                  {sending ? 'Mengirim via Gmail...' : 'Ya, Kirim Sekarang'}
                </button>
              </div>
            </div>
          )}

          <div className="pt-2 flex items-center justify-end gap-2.5 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg text-sm font-medium border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800"
            >
              Tutup
            </button>
            {!confirmStep && (
              <button
                type="submit"
                disabled={sending}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-orange-600 hover:bg-orange-700 text-white text-sm font-semibold transition-colors"
              >
                <Send className="w-4 h-4" />
                Kirim Email
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
};
