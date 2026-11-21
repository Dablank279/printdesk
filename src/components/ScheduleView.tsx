import React, { useMemo, useState } from 'react';
import {
  CalendarClock,
  CheckCircle2,
  Eye,
  MessageCircle,
  ExternalLink,
  AlertTriangle,
} from 'lucide-react';
import {
  PAYMENT_STATUS_META,
  PrintOrder,
  ShopSettings,
  WORK_STATUS_META,
} from '../types/printdesk';
import {
  buildWhatsAppUrl,
  formatDateOnlyId,
  formatRupiah,
  formatTimeOnlyId,
  getPickupUrgency,
} from '../utils/formatters';

interface ScheduleViewProps {
  orders: PrintOrder[];
  settings: ShopSettings;
  onTogglePickedUp: (order: PrintOrder) => Promise<void>;
  onOpenDetail: (orderId: string) => void;
  onOpenPreview: (order: PrintOrder) => void;
}

export const ScheduleView: React.FC<ScheduleViewProps> = ({
  orders,
  settings,
  onTogglePickedUp,
  onOpenDetail,
  onOpenPreview,
}) => {
  const [showPickedUp, setShowPickedUp] = useState(false);

  const grouped = useMemo(() => {
    const visible = orders
      .filter((o) => (showPickedUp ? true : !o.pickedUp))
      .slice()
      .sort(
        (a, b) => new Date(a.pickupAt).getTime() - new Date(b.pickupAt).getTime()
      );

    const overdue: PrintOrder[] = [];
    const byDateMap = new Map<string, { label: string; items: PrintOrder[] }>();

    for (const order of visible) {
      const urg = getPickupUrgency(order.pickupAt, order.pickedUp);
      if (urg.isOverdue && !order.pickedUp) {
        overdue.push(order);
        continue;
      }

      const d = new Date(order.pickupAt);
      const dateKey = Number.isNaN(d.getTime())
        ? 'unknown'
        : `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
            d.getDate()
          ).padStart(2, '0')}`;

      let label = formatDateOnlyId(order.pickupAt);
      if (urg.key === 'today') label = `Hari Ini · ${label}`;
      else if (urg.key === 'tomorrow') label = `Besok · ${label}`;

      if (!byDateMap.has(dateKey)) {
        byDateMap.set(dateKey, { label, items: [] });
      }
      byDateMap.get(dateKey)!.items.push(order);
    }

    return {
      overdue,
      groups: Array.from(byDateMap.entries()).map(([key, val]) => ({
        key,
        ...val,
      })),
    };
  }, [orders, showPickedUp]);

  const renderOrderCard = (order: PrintOrder) => {
    const urg = getPickupUrgency(order.pickupAt, order.pickedUp);
    const workMeta = WORK_STATUS_META[order.workStatus];
    const payMeta = PAYMENT_STATUS_META[order.paymentStatus];

    return (
      <div
        key={order.id}
        className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
      >
        <div className="space-y-1.5 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-mono font-bold text-slate-900 dark:text-white">
              {formatTimeOnlyId(order.pickupAt)}
            </span>
            <span className="text-slate-300 dark:text-slate-700">|</span>
            <button
              type="button"
              onClick={() => onOpenDetail(order.id)}
              className="text-xs font-mono font-semibold text-orange-600 dark:text-orange-400 hover:underline"
            >
              {order.orderCode}
            </button>
            <span
              className={`text-[11px] font-medium px-2 py-0.5 rounded border ${urg.badgeClass}`}
            >
              {urg.label}
            </span>
          </div>

          <div className="text-sm font-bold text-slate-900 dark:text-white">
            {order.clientName}{' '}
            <span className="font-normal text-slate-500 dark:text-slate-400">
              — {order.printType}
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className={`px-2 py-0.5 rounded border font-medium ${workMeta.colorClass}`}>
              {workMeta.shortLabel}
            </span>
            <span className={`px-2 py-0.5 rounded border font-medium ${payMeta.colorClass}`}>
              {payMeta.label}
            </span>
            <span className="text-slate-500 dark:text-slate-400 font-mono tabular-nums">
              Sisa: {formatRupiah(order.remainingAmount)}
            </span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => onOpenPreview(order)}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800"
          >
            <Eye className="w-3.5 h-3.5" />
            Preview
          </button>

          {order.clientPhone && (
            <a
              href={buildWhatsAppUrl(order, settings.shopName)}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-medium"
            >
              <MessageCircle className="w-3.5 h-3.5" />
              WhatsApp
            </a>
          )}

          <button
            type="button"
            onClick={() => onTogglePickedUp(order)}
            className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
              order.pickedUp
                ? 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                : 'bg-slate-900 dark:bg-orange-600 hover:bg-slate-800 dark:hover:bg-orange-500 text-white'
            }`}
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            {order.pickedUp ? 'Sudah Diambil' : 'Tandai Diambil'}
          </button>

          <button
            type="button"
            onClick={() => onOpenDetail(order.id)}
            className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
            title="Detail Order"
          >
            <ExternalLink className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4">
        <div className="flex items-center gap-2.5">
          <CalendarClock className="w-5 h-5 text-orange-600" />
          <div>
            <h2 className="text-sm font-bold text-slate-900 dark:text-white">
              Antrean Jadwal Pengambilan Order
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Diurutkan otomatis dari waktu pengambilan terdekat dan dikelompokkan per hari.
            </p>
          </div>
        </div>

        <label className="inline-flex items-center gap-2 text-xs font-medium text-slate-700 dark:text-slate-300 cursor-pointer">
          <input
            type="checkbox"
            checked={showPickedUp}
            onChange={(e) => setShowPickedUp(e.target.checked)}
            className="rounded border-slate-300 text-orange-600 focus:ring-orange-500"
          />
          Tampilkan yang sudah diambil
        </label>
      </div>

      {grouped.overdue.length === 0 && grouped.groups.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-12 text-center">
          <CalendarClock className="w-10 h-10 text-slate-400 mx-auto mb-3" />
          <h3 className="text-base font-semibold text-slate-900 dark:text-white">
            Semua order sudah diambil
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Tidak ada antrean pengambilan yang tertunda saat ini.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {grouped.overdue.length > 0 && (
            <section className="space-y-3">
              <div className="flex items-center gap-2 text-sm font-bold text-red-600 dark:text-red-400">
                <AlertTriangle className="w-4 h-4" />
                <span>Terlambat Diambil ({grouped.overdue.length})</span>
              </div>
              <div className="space-y-3">{grouped.overdue.map(renderOrderCard)}</div>
            </section>
          )}

          {grouped.groups.map((grp) => (
            <section key={grp.key} className="space-y-3">
              <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200 border-b border-slate-200 dark:border-slate-800 pb-2">
                {grp.label} ({grp.items.length})
              </h3>
              <div className="space-y-3">{grp.items.map(renderOrderCard)}</div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
};
