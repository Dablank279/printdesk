import React from 'react';
import {
  Printer,
  FolderUp,
  Mail,
  Kanban,
  FileSearch,
  CalendarClock,
  Moon,
  Sun,
  AlertCircle,
} from 'lucide-react';

interface LoginViewProps {
  onGoogleLogin: () => Promise<void>;
  onEnterLocalMode: () => void;
  isLoggingIn: boolean;
  errorMessage: string | null;
  darkMode: boolean;
  onToggleDarkMode: () => void;
}

export const LoginView: React.FC<LoginViewProps> = ({
  onGoogleLogin,
  onEnterLocalMode,
  isLoggingIn,
  errorMessage,
  darkMode,
  onToggleDarkMode,
}) => {
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col justify-between p-4 sm:p-8">
      <div className="max-w-6xl w-full mx-auto flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-lg bg-slate-900 dark:bg-orange-600 text-white flex items-center justify-center">
            <Printer className="w-5 h-5" />
          </div>
          <span className="text-lg font-bold tracking-tight text-slate-900 dark:text-white">
            PrintDesk
          </span>
        </div>

        <button
          type="button"
          onClick={onToggleDarkMode}
          className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
        >
          {darkMode ? <Sun className="w-4 h-4 text-orange-400" /> : <Moon className="w-4 h-4" />}
          {darkMode ? 'Mode Terang' : 'Mode Gelap'}
        </button>
      </div>

      <div className="max-w-5xl w-full mx-auto my-8 grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
        <div className="lg:col-span-7 space-y-6">
          <div className="space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-orange-600 dark:text-orange-400">
              Sistem Operasional Percetakan
            </p>
            <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-slate-900 dark:text-white [text-wrap:balance]">
              Kelola order cetak, file Google Drive, DP, dan pengiriman email dalam satu meja kerja.
            </h1>
            <p className="text-base text-slate-600 dark:text-slate-300 leading-relaxed max-w-xl">
              Dirancang khusus untuk pemilik dan staf percetakan agar tidak ada file tercecer, status DP tertukar, atau jadwal pengambilan yang terlewat.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
            <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
              <FolderUp className="w-5 h-5 text-orange-600 mb-2" />
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                Arsip Otomatis Google Drive
              </h3>
              <p className="text-xs text-slate-600 dark:text-slate-400 mt-1 leading-relaxed">
                File PDF, DOCX, dan gambar otomatis tersusun ke folder PrintDesk/Nama Client/Kode Order.
              </p>
            </div>
            <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
              <Kanban className="w-5 h-5 text-orange-600 mb-2" />
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                Papan Status & DP Terpadu
              </h3>
              <p className="text-xs text-slate-600 dark:text-slate-400 mt-1 leading-relaxed">
                Pantau progres Belum DP, Dalam Proses, dan Selesai dalam tampilan Kanban drag & drop maupun tabel.
              </p>
            </div>
            <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
              <FileSearch className="w-5 h-5 text-orange-600 mb-2" />
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                Preview Sebelum Cetak
              </h3>
              <p className="text-xs text-slate-600 dark:text-slate-400 mt-1 leading-relaxed">
                Cek halaman PDF, zoom & pan gambar, hingga baca file DOCX lengkap dengan info ukuran & finishing.
              </p>
            </div>
            <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
              <CalendarClock className="w-5 h-5 text-orange-600 mb-2" />
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                Email Gmail & Pengingat Ambil
              </h3>
              <p className="text-xs text-slate-600 dark:text-slate-400 mt-1 leading-relaxed">
                Kirim dokumen ke client lewat Gmail API serta pantau order yang jatuh tempo hari ini atau terlambat.
              </p>
            </div>
          </div>
        </div>

        <div className="lg:col-span-5">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 sm:p-8 shadow-sm">
            <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-1.5">
              Masuk ke PrintDesk
            </h2>
            <p className="text-sm text-slate-600 dark:text-slate-400 mb-6">
              Hubungkan akun Google Anda untuk sinkronisasi database cloud, penyimpanan Google Drive, dan kirim email Gmail.
            </p>

            {errorMessage && (
              <div className="mb-5 p-3.5 rounded-lg bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-900 flex items-start gap-2.5 text-xs text-red-700 dark:text-red-300">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{errorMessage}</span>
              </div>
            )}

            <button
              type="button"
              onClick={onGoogleLogin}
              disabled={isLoggingIn}
              className="gsi-material-button w-full"
            >
              <div className="gsi-material-button-state" />
              <div className="gsi-material-button-content-wrapper">
                <div className="gsi-material-button-icon">
                  <svg
                    version="1.1"
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 48 48"
                    style={{ display: 'block' }}
                  >
                    <path
                      fill="#EA4335"
                      d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
                    />
                    <path
                      fill="#4285F4"
                      d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
                    />
                    <path
                      fill="#34A853"
                      d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
                    />
                    <path fill="none" d="M0 0h48v48H0z" />
                  </svg>
                </div>
                <span className="gsi-material-button-contents">
                  {isLoggingIn ? 'Menghubungkan ke Google...' : 'Sign in with Google'}
                </span>
              </div>
            </button>

            <div className="my-5 flex items-center gap-3">
              <div className="h-px flex-1 bg-slate-200 dark:bg-slate-800" />
              <span className="text-xs text-slate-400">atau</span>
              <div className="h-px flex-1 bg-slate-200 dark:bg-slate-800" />
            </div>

            <button
              type="button"
              onClick={onEnterLocalMode}
              disabled={isLoggingIn}
              className="w-full py-2.5 px-4 rounded-lg border border-slate-200 dark:border-slate-700 text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
            >
              Masuk Mode Lokal (Simpan di Browser)
            </button>

            <div className="mt-5 pt-4 border-t border-slate-100 dark:border-slate-800 space-y-2 text-xs text-slate-500 dark:text-slate-400">
              <div className="flex items-start gap-2">
                <Mail className="w-3.5 h-3.5 mt-0.5 shrink-0 text-slate-400" />
                <span>
                  Izin Google yang diminta hanya akses file yang diunggah oleh aplikasi ini (drive.file) dan pengiriman email atas nama Anda (gmail.send).
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <footer className="max-w-6xl w-full mx-auto text-center text-xs text-slate-500 dark:text-slate-500">
        PrintDesk — Aplikasi Manajemen Operasional Percetakan
      </footer>
    </div>
  );
};
