import React, { useState } from 'react';
import { AlertTriangle, Download, Trash2, X } from 'lucide-react';

interface ResetDataModalProps {
  open: boolean;
  ordersCount: number;
  clientsCount: number;
  onDownloadBackup: () => void;
  onConfirmReset: (includeSettings: boolean) => Promise<void>;
  onClose: () => void;
}

export const ResetDataModal: React.FC<ResetDataModalProps> = ({
  open,
  ordersCount,
  clientsCount,
  onDownloadBackup,
  onConfirmReset,
  onClose,
}) => {
  const [step, setStep] = useState<1 | 2>(1);
  const [confirmText, setConfirmText] = useState('');
  const [includeSettings, setIncludeSettings] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!open) return null;

  const handleClose = () => {
    if (resetting) return;
    setStep(1);
    setConfirmText('');
    setIncludeSettings(false);
    setErrorMsg(null);
    onClose();
  };

  const handleExecute = async () => {
    if (confirmText.trim() !== 'RESET') return;
    setResetting(true);
    setErrorMsg(null);
    try {
      await onConfirmReset(includeSettings);
      setStep(1);
      setConfirmText('');
      setIncludeSettings(false);
      onClose();
    } catch (err: unknown) {
      setErrorMsg(
        err instanceof Error ? err.message : 'Gagal mereset data. Silakan coba lagi.'
      );
    } finally {
      setResetting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-xs p-4"
      role="dialog"
      aria-modal="true"
    >
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-red-50 dark:bg-red-950/60 text-red-600 dark:text-red-400 flex items-center justify-center shrink-0">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                Reset Semua Data PrintDesk
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Langkah {step} dari 2 · Tindakan permanen
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleClose}
            disabled={resetting}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {errorMsg && (
          <div className="p-3 rounded-lg bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-900 text-xs text-red-700 dark:text-red-300">
            {errorMsg}
          </div>
        )}

        {step === 1 ? (
          <div className="space-y-4 text-xs">
            <div className="p-4 rounded-xl bg-red-50/80 dark:bg-red-950/40 border border-red-200 dark:border-red-900 space-y-2 text-red-800 dark:text-red-200">
              <p className="font-semibold">
                Peringatan: Data berikut akan dihapus permanen dan tidak bisa dikembalikan:
              </p>
              <ul className="list-disc pl-5 space-y-1">
                <li>Semua order ({ordersCount} order tercatat) & riwayat email terkirim</li>
                <li>Semua data client ({clientsCount} client)</li>
                <li>Nomor urut kode order (kembali mulai dari PD-YYYYMMDD-001)</li>
                <li>Notifikasi pengingat & cache preview dokumen lokal</li>
              </ul>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 space-y-1.5 text-slate-700 dark:text-slate-300">
              <p className="font-semibold text-slate-900 dark:text-white">
                Yang TIDAK ikut dihapus:
              </p>
              <p>
                Koneksi akun Google, file dokumen di Google Drive Anda, serta pengaturan usaha (nama usaha, logo, template email, dan email percetakan) tetap aman.
              </p>
            </div>

            <label className="flex items-center gap-2 text-slate-700 dark:text-slate-300 cursor-pointer">
              <input
                type="checkbox"
                checked={includeSettings}
                onChange={(e) => setIncludeSettings(e.target.checked)}
                className="rounded border-slate-300 text-red-600 focus:ring-red-500"
              />
              <span>
                <strong>Reset pengaturan juga</strong> (kembalikan profil usaha & template ke bawaan)
              </span>
            </label>

            <div className="pt-2 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={onDownloadBackup}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800"
              >
                <Download className="w-3.5 h-3.5" />
                Unduh Backup Dulu
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleClose}
                  className="px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-700 dark:text-slate-200"
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={() => setStep(2)}
                  className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white text-xs font-semibold"
                >
                  Lanjut Konfirmasi
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-4 text-xs">
            <p className="text-sm text-slate-700 dark:text-slate-200 leading-relaxed">
              Ketik kata <span className="font-mono font-bold text-red-600 dark:text-red-400">RESET</span> pada kolom di bawah untuk mengonfirmasi penghapusan seluruh data.
            </p>

            <input
              type="text"
              autoFocus
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder="Ketik RESET"
              className="w-full px-3.5 py-2.5 text-sm font-mono rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-red-500/40 focus:border-red-500"
            />

            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              File di Google Drive Anda tidak akan terhapus.
            </p>

            <div className="pt-2 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setStep(1)}
                disabled={resetting}
                className="px-3.5 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-700 dark:text-slate-200"
              >
                Kembali
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleClose}
                  disabled={resetting}
                  className="px-3.5 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-700 dark:text-slate-200"
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={handleExecute}
                  disabled={resetting || confirmText.trim() !== 'RESET'}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white text-xs font-semibold disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  {resetting ? 'Mereset Data...' : 'Ya, Hapus Semua Data'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
