import React from 'react';
import {
  LayoutDashboard,
  PlusCircle,
  CalendarClock,
  Users,
  Settings,
  Printer,
  LogOut,
  X,
  RefreshCw,
  HardDrive,
} from 'lucide-react';
import { AppPage } from '../types/printdesk';

interface SidebarProps {
  activePage: AppPage;
  onNavigate: (page: AppPage) => void;
  mobileOpen: boolean;
  onCloseMobile: () => void;
  shopName: string;
  userDisplayName: string;
  userEmail: string;
  userPhotoUrl?: string;
  isLocalMode: boolean;
  hasGoogleToken: boolean;
  onConnectGoogle: () => void;
  onLogout: () => void;
  overdueCount: number;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activePage,
  onNavigate,
  mobileOpen,
  onCloseMobile,
  shopName,
  userDisplayName,
  userEmail,
  userPhotoUrl,
  isLocalMode,
  hasGoogleToken,
  onConnectGoogle,
  onLogout,
  overdueCount,
}) => {
  const navItems: Array<{
    id: AppPage;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    count?: number;
  }> = [
    { id: 'dashboard', label: 'Papan Status', icon: LayoutDashboard },
    { id: 'order-new', label: 'Order Baru', icon: PlusCircle },
    {
      id: 'schedule',
      label: 'Jadwal Pengambilan',
      icon: CalendarClock,
      count: overdueCount > 0 ? overdueCount : undefined,
    },
    { id: 'clients', label: 'Data Client', icon: Users },
    { id: 'settings', label: 'Pengaturan', icon: Settings },
  ];

  const handleNav = (page: AppPage) => {
    onNavigate(page);
    onCloseMobile();
  };

  const sidebarContent = (
    <div className="flex flex-col h-full bg-slate-900 text-slate-100 w-[260px] select-none">
      <div className="px-5 py-5 flex items-center justify-between border-b border-slate-800">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-9 h-9 rounded-lg bg-orange-600 text-white flex items-center justify-center shrink-0">
            <Printer className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <div className="text-base font-bold tracking-tight text-white truncate">
              PrintDesk
            </div>
            <div className="text-xs text-slate-400 truncate">{shopName}</div>
          </div>
        </div>
        <button
          type="button"
          onClick={onCloseMobile}
          className="lg:hidden p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
          aria-label="Tutup menu"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive =
            activePage === item.id ||
            (item.id === 'dashboard' &&
              (activePage === 'order-detail' || activePage === 'order-edit'));
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => handleNav(item.id)}
              className={`w-full flex items-center justify-between gap-3 px-3.5 py-2.5 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
                isActive
                  ? 'bg-orange-600 text-white'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800/80'
              }`}
            >
              <span className="flex items-center gap-3 min-w-0">
                <Icon className="w-4 h-4 shrink-0" />
                <span className="truncate">{item.label}</span>
              </span>
              {item.count !== undefined && (
                <span
                  className={`text-xs font-mono tabular-nums px-1.5 py-0.5 rounded ${
                    isActive
                      ? 'bg-white/20 text-white'
                      : 'bg-red-500/20 text-red-300'
                  }`}
                >
                  {item.count}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      <div className="p-3 border-t border-slate-800 space-y-3">
        <div className="p-3 rounded-lg bg-slate-800/70 border border-slate-700/60 space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-300 font-medium flex items-center gap-1.5">
              <HardDrive className="w-3.5 h-3.5 text-slate-400" />
              Drive & Gmail
            </span>
            <span
              className={`font-medium ${
                hasGoogleToken ? 'text-emerald-400' : 'text-amber-400'
              }`}
            >
              {hasGoogleToken ? 'Terhubung' : 'Perlu Izin'}
            </span>
          </div>
          {!hasGoogleToken && (
            <button
              type="button"
              onClick={onConnectGoogle}
              className="w-full inline-flex items-center justify-center gap-1.5 px-2.5 py-1.5 rounded-md bg-orange-600 hover:bg-orange-500 text-white text-xs font-medium transition-colors"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              {isLocalMode ? 'Hubungkan Akun Google' : 'Aktifkan Ulang Google'}
            </button>
          )}
        </div>

        <div className="flex items-center justify-between gap-2 px-1">
          <div className="flex items-center gap-2.5 min-w-0">
            {userPhotoUrl ? (
              <img
                src={userPhotoUrl}
                alt={userDisplayName}
                referrerPolicy="no-referrer"
                className="w-8 h-8 rounded-full object-cover shrink-0 border border-slate-700"
              />
            ) : (
              <div className="w-8 h-8 rounded-full bg-slate-700 text-slate-200 flex items-center justify-center text-xs font-bold shrink-0">
                {userDisplayName.slice(0, 2).toUpperCase()}
              </div>
            )}
            <div className="min-w-0">
              <div className="text-xs font-semibold text-white truncate">
                {userDisplayName}
              </div>
              <div className="text-[11px] text-slate-400 truncate">
                {isLocalMode ? 'Mode Lokal (Browser)' : userEmail}
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={onLogout}
            title="Keluar"
            className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors shrink-0"
            aria-label="Keluar dari akun"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <>
      <aside className="hidden lg:block shrink-0 h-screen sticky top-0 no-print">
        {sidebarContent}
      </aside>

      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex no-print">
          <div
            className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs"
            onClick={onCloseMobile}
          />
          <div className="relative z-10 h-full">{sidebarContent}</div>
        </div>
      )}
    </>
  );
};
