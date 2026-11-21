import React from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';

interface ErrorBoundaryState {
  hasError: boolean;
  message: string;
}

export class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  ErrorBoundaryState
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, message: '' };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      message: error?.message || 'Terjadi kesalahan yang tidak terduga.',
    };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo): void {
    console.error('PrintDesk ErrorBoundary:', error, info);
  }

  render() {
    if (this.state.hasError) {
      let friendlyMsg = this.state.message;
      if (friendlyMsg.startsWith('{') && friendlyMsg.includes('operationType')) {
        friendlyMsg =
          'Akses database Firestore ditolak atau sesi berakhir. Silakan muat ulang aplikasi atau login ulang dengan akun Google Anda.';
      }

      return (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center p-6">
          <div className="max-w-md w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 shadow-sm">
            <div className="flex items-center gap-3 text-red-600 dark:text-red-400 mb-3">
              <AlertTriangle className="w-6 h-6 shrink-0" />
              <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                Terjadi Gangguan Aplikasi
              </h2>
            </div>
            <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed mb-5">
              {friendlyMsg}
            </p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-slate-900 dark:bg-orange-600 text-white text-sm font-medium hover:bg-slate-800 dark:hover:bg-orange-500 transition-colors"
            >
              <RotateCcw className="w-4 h-4" />
              Muat Ulang PrintDesk
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
