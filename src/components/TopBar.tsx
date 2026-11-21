import React, { useState, useRef, useEffect } from 'react';
import {
  Menu,
  Search,
  Bell,
  Sun,
  Moon,
  Plus,
  Clock,
  AlertTriangle,
  X,
} from 'lucide-react';
import { AppPage, PrintOrder } from '../types/printdesk';
import { formatDateTimeId, getPickupUrgency } from '../utils/formatters';

interface TopBarProps {
  activePage: AppPage;
  onOpenMobileMenu: () => void;
  globalSearch: string;
  onGlobalSearchChange: (val: string) => void;
  orders: PrintOrder[];
  onSelectOrder: (orderId: string) => void;
  onNewOrder: () => void;
  darkMode: boolean;
  onToggleDarkMode: () => void;
}

const PAGE_TITLES: Record<AppPage, string> = {
  dashboard: 'Papan Status Terpadu',
  'order-new': 'Buat Order Baru',
  'order-edit': 'Edit Data Order',
  'order-detail': 'Detail Order Percetakan',
  schedule: 'Jadwal Pengambilan',
  clients: 'Data Client',
  settings: 'Pengaturan Usaha & Integrasi',
};

export const TopBar: React.FC<TopBarProps> = ({
  activePage,
  onOpenMobileMenu,
  globalSearch,
  onGlobalSearchChange,
  orders,
  onSelectOrder,
  onNewOrder,
  darkMode,
  onToggleDarkMode,
}) => {
  const [notifOpen, setNotifOpen] = useState(false);
  const notifRef = useRef<HTMLDivElement>(null);

  const urgentOrders = orders
    .filter((o) => !o.pickedUp)
    .map((o) => ({ order: o, urgency: getPickupUrgency(o.pickupAt, o.pickedUp) }))
    .filter((item) => item.urgency.isDueSoon || item.urgency.isOverdue)
    .sort((a, b) => a.urgency.diffMinutes - b.urgency.diffMinutes);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setNotifOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <header className="sticky top-0 z-30 bg-white/95 dark:bg-slate-900/95 backdrop-blur-xs border-b border-slate-200 dark:border-slate-800 px-4 sm:px-6 h-16 flex items-center justify-between gap-4 no-print">
      <div className="flex items-center gap-3 min-w-0">
        <button
          type="button"
          onClick={onOpenMobileMenu}
          className="lg:hidden p-2 -ml-2 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
          aria-label="Buka menu navigasi"
        >
          <Menu className="w-5 h-5" />
        </button>
        <h1 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white truncate">
          {PAGE_TITLES[activePage]}
        </h1>
      </div>

      <div className="flex items-center gap-2 sm:gap-3 shrink-0">
        <div className="relative hidden md:block w-64 lg:w-72">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={globalSearch}
            onChange={(e) => onGlobalSearchChange(e.target.value)}
            placeholder="Cari cepat kode, client, cetakan..."
            className="w-full pl-9 pr-8 py-1.5 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-orange-500/40 focus:border-orange-500"
          />
          {globalSearch && (
            <button
              type="button"
              onClick={() => onGlobalSearchChange('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              aria-label="Hapus pencarian"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        <div className="relative" ref={notifRef}>
          <button
            type="button"
            onClick={() => setNotifOpen((prev) => !prev)}
            className="relative p-2 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            aria-label="Notifikasi jadwal pengambilan"
          >
            <Bell className="w-4 h-4" />
            {urgentOrders.length > 0 && (
              <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-orange-600 text-white text-[10px] font-mono font-semibold flex items-center justify-center tabular-nums">
                {urgentOrders.length}
              </span>
            )}
          </button>

          {notifOpen && (
            <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xl overflow-hidden z-40">
              <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                <span className="text-sm font-semibold text-slate-900 dark:text-white">
                  Pengingat Pengambilan ({urgentOrders.length})
                </span>
                <button
                  type="button"
                  onClick={() => setNotifOpen(false)}
                  className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="max-h-80 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800">
                {urgentOrders.length === 0 ? (
                  <div className="p-6 text-center text-xs text-slate-500 dark:text-slate-400">
                    Tidak ada order yang mendekati atau melewati jadwal pengambilan dalam 24 jam ke depan.
                  </div>
                ) : (
                  urgentOrders.map(({ order, urgency }) => (
                    <button
                      key={order.id}
                      type="button"
                      onClick={() => {
                        onSelectOrder(order.id);
                        setNotifOpen(false);
                      }}
                      className="w-full text-left px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors flex items-start gap-3"
                    >
                      {urgency.isOverdue ? (
                        <AlertTriangle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                      ) : (
                        <Clock className="w-4 h-4 text-orange-600 shrink-0 mt-0.5" />
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs font-mono font-semibold text-slate-900 dark:text-white">
                            {order.orderCode}
                          </span>
                          <span
                            className={`text-[11px] font-medium px-1.5 py-0.5 rounded border ${urgency.badgeClass}`}
                          >
                            {urgency.label}
                          </span>
                        </div>
                        <div className="text-xs font-medium text-slate-700 dark:text-slate-200 truncate mt-0.5">
                          {order.clientName} — {order.printType}
                        </div>
                        <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                          Ambil: {formatDateTimeId(order.pickupAt)}
                        </div>
                      </div>
                    </button>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        <button
          type="button"
          onClick={onToggleDarkMode}
          className="p-2 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          aria-label={darkMode ? 'Aktifkan mode terang' : 'Aktifkan mode gelap'}
        >
          {darkMode ? <Sun className="w-4 h-4 text-orange-400" /> : <Moon className="w-4 h-4" />}
        </button>

        <button
          type="button"
          onClick={onNewOrder}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-orange-600 hover:bg-orange-700 text-white text-sm font-semibold transition-colors whitespace-nowrap shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span className="hidden sm:inline">Order Baru</span>
        </button>
      </div>
    </header>
  );
};
