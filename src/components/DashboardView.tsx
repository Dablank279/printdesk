import React, { useMemo, useState } from 'react';
import {
  Kanban,
  Table2,
  Download,
  Eye,
  Mail,
  Factory,
  MessageCircle,
  ExternalLink,
  CalendarClock,
  FileText,
  Filter,
  RotateCcw,
  GripVertical,
  Plus,
} from 'lucide-react';
import {
  PAYMENT_STATUS_META,
  PrintOrder,
  ShopSettings,
  WORK_STATUS_META,
  WorkStatus,
} from '../types/printdesk';
import {
  buildWhatsAppUrl,
  canSendToVendor,
  exportOrdersToCsv,
  formatDateTimeId,
  formatRupiah,
  getPickupUrgency,
} from '../utils/formatters';

interface DashboardViewProps {
  orders: PrintOrder[];
  settings: ShopSettings;
  globalSearch: string;
  onGlobalSearchChange: (v: string) => void;
  onChangeWorkStatus: (order: PrintOrder, nextStatus: WorkStatus) => Promise<void>;
  onOpenDetail: (orderId: string) => void;
  onOpenPreview: (order: PrintOrder) => void;
  onOpenEmail: (order: PrintOrder) => void;
  onOpenVendorEmail: (order: PrintOrder) => void;
  onNewOrder: () => void;
}

const COLUMNS: Array<{ status: WorkStatus; title: string; headerAccent: string }> = [
  {
    status: 'belum_dp',
    title: 'Belum DP',
    headerAccent: 'bg-red-600',
  },
  {
    status: 'dalam_proses',
    title: 'Dalam Proses Pengerjaan',
    headerAccent: 'bg-amber-500',
  },
  {
    status: 'selesai',
    title: 'Selesai',
    headerAccent: 'bg-emerald-600',
  },
];

export const DashboardView: React.FC<DashboardViewProps> = ({
  orders,
  settings,
  globalSearch,
  onGlobalSearchChange,
  onChangeWorkStatus,
  onOpenDetail,
  onOpenPreview,
  onOpenEmail,
  onOpenVendorEmail,
  onNewOrder,
}) => {
  const [viewMode, setViewMode] = useState<'kanban' | 'table'>('kanban');
  const [statusFilter, setStatusFilter] = useState<'all' | WorkStatus>('all');
  const [paymentFilter, setPaymentFilter] = useState<
    'all' | PrintOrder['paymentStatus']
  >('all');
  const [urgencyFilter, setUrgencyFilter] = useState<
    'all' | 'overdue' | 'today' | 'tomorrow'
  >('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [draggedOrderId, setDraggedOrderId] = useState<string | null>(null);
  const [dragOverColumn, setDragOverColumn] = useState<WorkStatus | null>(null);

  const stats = useMemo(() => {
    let totalValue = 0;
    let totalDp = 0;
    let totalRemaining = 0;
    let countBelumDp = 0;
    let countProses = 0;
    let countSelesai = 0;

    for (const o of orders) {
      totalValue += o.totalPrice;
      totalDp += o.dpAmount;
      totalRemaining += o.remainingAmount;
      if (o.workStatus === 'belum_dp') countBelumDp++;
      else if (o.workStatus === 'dalam_proses') countProses++;
      else if (o.workStatus === 'selesai') countSelesai++;
    }

    return {
      totalOrders: orders.length,
      totalValue,
      totalDp,
      totalRemaining,
      countBelumDp,
      countProses,
      countSelesai,
    };
  }, [orders]);

  const filteredOrders = useMemo(() => {
    const q = globalSearch.trim().toLowerCase();
    return orders.filter((o) => {
      if (q) {
        const hay = `${o.orderCode} ${o.clientName} ${o.clientPhone} ${o.printType} ${o.category}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      if (statusFilter !== 'all' && o.workStatus !== statusFilter) return false;
      if (paymentFilter !== 'all' && o.paymentStatus !== paymentFilter) return false;

      if (urgencyFilter !== 'all') {
        const urg = getPickupUrgency(o.pickupAt, o.pickedUp);
        if (urgencyFilter === 'overdue' && !urg.isOverdue) return false;
        if (urgencyFilter === 'today' && urg.key !== 'today') return false;
        if (urgencyFilter === 'tomorrow' && urg.key !== 'tomorrow') return false;
      }

      if (dateFrom) {
        const fromMs = new Date(`${dateFrom}T00:00:00`).getTime();
        if (new Date(o.createdAtIso).getTime() < fromMs) return false;
      }
      if (dateTo) {
        const toMs = new Date(`${dateTo}T23:59:59`).getTime();
        if (new Date(o.createdAtIso).getTime() > toMs) return false;
      }
      return true;
    });
  }, [orders, globalSearch, statusFilter, paymentFilter, urgencyFilter, dateFrom, dateTo]);

  const handleResetFilters = () => {
    onGlobalSearchChange('');
    setStatusFilter('all');
    setPaymentFilter('all');
    setUrgencyFilter('all');
    setDateFrom('');
    setDateTo('');
  };

  const handleDropOnColumn = async (targetStatus: WorkStatus) => {
    setDragOverColumn(null);
    if (!draggedOrderId) return;
    const ord = orders.find((o) => o.id === draggedOrderId);
    setDraggedOrderId(null);
    if (ord && ord.workStatus !== targetStatus) {
      await onChangeWorkStatus(ord, targetStatus);
    }
  };

  const hasActiveFilter =
    Boolean(globalSearch) ||
    statusFilter !== 'all' ||
    paymentFilter !== 'all' ||
    urgencyFilter !== 'all' ||
    Boolean(dateFrom) ||
    Boolean(dateTo);

  return (
    <div className="space-y-6">
      {/* KPI Statistics Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5">
          <div className="text-xs font-medium text-slate-500 dark:text-slate-400">
            Total Order Aktif
          </div>
          <div className="text-2xl font-bold text-slate-900 dark:text-white font-mono tabular-nums mt-1">
            {stats.totalOrders}
          </div>
          <div className="text-xs text-slate-500 dark:text-slate-400 mt-2 flex items-center gap-2 flex-wrap">
            <span className="text-red-600 dark:text-red-400 font-medium tabular-nums">
              {stats.countBelumDp} Belum DP
            </span>
            <span aria-hidden="true">·</span>
            <span className="text-amber-600 dark:text-amber-400 font-medium tabular-nums">
              {stats.countProses} Proses
            </span>
            <span aria-hidden="true">·</span>
            <span className="text-emerald-600 dark:text-emerald-400 font-medium tabular-nums">
              {stats.countSelesai} Selesai
            </span>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5">
          <div className="text-xs font-medium text-slate-500 dark:text-slate-400">
            Total Nilai Order
          </div>
          <div className="text-2xl font-bold text-slate-900 dark:text-white font-mono tabular-nums mt-1">
            {formatRupiah(stats.totalValue)}
          </div>
          <div className="text-xs text-slate-500 dark:text-slate-400 mt-2">
            Akumulasi seluruh order tercatat
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5">
          <div className="text-xs font-medium text-slate-500 dark:text-slate-400">
            Total DP Masuk
          </div>
          <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 font-mono tabular-nums mt-1">
            {formatRupiah(stats.totalDp)}
          </div>
          <div className="text-xs text-slate-500 dark:text-slate-400 mt-2">
            Pembayaran awal & pelunasan diterima
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5">
          <div className="text-xs font-medium text-slate-500 dark:text-slate-400">
            Total Sisa Tagihan
          </div>
          <div className="text-2xl font-bold text-orange-600 dark:text-orange-400 font-mono tabular-nums mt-1">
            {formatRupiah(stats.totalRemaining)}
          </div>
          <div className="text-xs text-slate-500 dark:text-slate-400 mt-2">
            Piutang menunggu pelunasan client
          </div>
        </div>
      </div>

      {/* Filter & View Controls Toolbar */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-700 dark:text-slate-200">
            <Filter className="w-4 h-4 text-slate-400" />
            <span>Filter & Tampilan</span>
            <span className="font-mono tabular-nums text-slate-500 dark:text-slate-400 font-normal">
              ({filteredOrders.length} dari {orders.length} order)
            </span>
          </div>

          <div className="flex items-center flex-wrap gap-2">
            <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-lg">
              <button
                type="button"
                onClick={() => setViewMode('kanban')}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                  viewMode === 'kanban'
                    ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <Kanban className="w-3.5 h-3.5" />
                Papan Kanban
              </button>
              <button
                type="button"
                onClick={() => setViewMode('table')}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                  viewMode === 'table'
                    ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <Table2 className="w-3.5 h-3.5" />
                Tabel Terpadu
              </button>
            </div>

            <button
              type="button"
              onClick={() => exportOrdersToCsv(filteredOrders)}
              disabled={filteredOrders.length === 0}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-50 whitespace-nowrap shrink-0"
            >
              <Download className="w-3.5 h-3.5" />
              Ekspor CSV
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-2.5">
          <input
            type="text"
            value={globalSearch}
            onChange={(e) => onGlobalSearchChange(e.target.value)}
            placeholder="Cari kode / client / cetakan..."
            className="md:hidden px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
          />

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as 'all' | WorkStatus)}
            className="px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-100"
            aria-label="Filter status pengerjaan"
          >
            <option value="all">Semua Status Pengerjaan</option>
            <option value="belum_dp">Belum DP</option>
            <option value="dalam_proses">Dalam Proses Pengerjaan</option>
            <option value="selesai">Selesai</option>
          </select>

          <select
            value={paymentFilter}
            onChange={(e) =>
              setPaymentFilter(
                e.target.value as 'all' | PrintOrder['paymentStatus']
              )
            }
            className="px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-100"
            aria-label="Filter status pembayaran"
          >
            <option value="all">Semua Status Pembayaran</option>
            <option value="belum_dp">Belum DP</option>
            <option value="sudah_dp">Sudah DP</option>
            <option value="lunas">Lunas</option>
          </select>

          <select
            value={urgencyFilter}
            onChange={(e) =>
              setUrgencyFilter(
                e.target.value as 'all' | 'overdue' | 'today' | 'tomorrow'
              )
            }
            className="px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-100"
            aria-label="Filter jatuh tempo pengambilan"
          >
            <option value="all">Semua Jadwal Pengambilan</option>
            <option value="overdue">Terlambat Diambil</option>
            <option value="today">Jatuh Tempo Hari Ini</option>
            <option value="tomorrow">Jatuh Tempo Besok</option>
          </select>

          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            title="Dari tanggal order"
            className="px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-100"
          />

          <div className="flex items-center gap-2">
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              title="Sampai tanggal order"
              className="flex-1 min-w-0 px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-100"
            />
            {hasActiveFilter && (
              <button
                type="button"
                onClick={handleResetFilters}
                title="Reset semua filter"
                className="p-2 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 shrink-0"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Empty State */}
      {filteredOrders.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-12 text-center space-y-3">
          <div className="w-12 h-12 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-400 flex items-center justify-center mx-auto">
            <FileText className="w-6 h-6" />
          </div>
          <h3 className="text-base font-semibold text-slate-900 dark:text-white">
            {orders.length === 0
              ? 'Belum ada order. Klik Order Baru untuk mulai.'
              : 'Tidak ada order yang cocok dengan filter'}
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto">
            {orders.length === 0
              ? 'Catat order pertama Anda, unggah dokumen cetak ke Google Drive, pantau status pengerjaan & DP, dan kirim order langsung ke percetakan.'
              : 'Coba ubah kata kunci pencarian atau reset filter untuk melihat semua order.'}
          </p>
          <div className="pt-2">
            {orders.length === 0 ? (
              <button
                type="button"
                onClick={onNewOrder}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-orange-600 hover:bg-orange-700 text-white text-xs font-semibold"
              >
                <Plus className="w-4 h-4" />
                Order Baru
              </button>
            ) : (
              <button
                type="button"
                onClick={handleResetFilters}
                className="px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800"
              >
                Reset Filter
              </button>
            )}
          </div>
        </div>
      ) : viewMode === 'kanban' ? (
        /* KANBAN BOARD */
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 items-start">
          {COLUMNS.map((col) => {
            const colOrders = filteredOrders.filter((o) => o.workStatus === col.status);
            const isOver = dragOverColumn === col.status;
            return (
              <div
                key={col.status}
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragOverColumn(col.status);
                }}
                onDragLeave={() => setDragOverColumn(null)}
                onDrop={() => handleDropOnColumn(col.status)}
                className={`rounded-xl border transition-colors p-3.5 space-y-3 min-h-[260px] ${
                  isOver
                    ? 'bg-orange-50/70 dark:bg-orange-950/20 border-orange-400 dark:border-orange-700'
                    : 'bg-slate-100/80 dark:bg-slate-900/50 border-slate-200 dark:border-slate-800'
                }`}
              >
                <div className="flex items-center justify-between px-1 py-1">
                  <div className="flex items-center gap-2">
                    <span className={`w-2.5 h-2.5 rounded-sm ${col.headerAccent}`} />
                    <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                      {col.title}
                    </h2>
                  </div>
                  <span className="text-xs font-mono tabular-nums font-semibold text-slate-500 dark:text-slate-400">
                    {colOrders.length}
                  </span>
                </div>

                <div className="space-y-3">
                  {colOrders.length === 0 ? (
                    <div className="py-10 text-center text-xs text-slate-400 dark:text-slate-500 border border-dashed border-slate-300 dark:border-slate-700 rounded-lg">
                      Tarik kartu ke sini untuk ubah status ke {col.title}
                    </div>
                  ) : (
                    colOrders.map((order) => {
                      const urgency = getPickupUrgency(order.pickupAt, order.pickedUp);
                      const payMeta = PAYMENT_STATUS_META[order.paymentStatus];
                      const workMeta = WORK_STATUS_META[order.workStatus];
                      const vendorCheck = canSendToVendor(order);

                      return (
                        <div
                          key={order.id}
                          draggable
                          onDragStart={() => setDraggedOrderId(order.id)}
                          onDragEnd={() => {
                            setDraggedOrderId(null);
                            setDragOverColumn(null);
                          }}
                          className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-2xs hover:border-slate-300 dark:hover:border-slate-700 transition-all space-y-3 cursor-grab active:cursor-grabbing"
                        >
                          {/* Top Row: Code + Drag grip + Urgency */}
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-1.5 min-w-0">
                              <GripVertical className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                              <button
                                type="button"
                                onClick={() => onOpenDetail(order.id)}
                                className="text-xs font-mono font-bold text-slate-900 dark:text-white hover:text-orange-600 dark:hover:text-orange-400 truncate"
                              >
                                {order.orderCode}
                              </button>
                            </div>
                            <span
                              className={`text-[11px] font-medium px-2 py-0.5 rounded border whitespace-nowrap shrink-0 ${urgency.badgeClass}`}
                            >
                              {urgency.label}
                            </span>
                          </div>

                          {/* Client & Print Title */}
                          <div>
                            <button
                              type="button"
                              onClick={() => onOpenDetail(order.id)}
                              className="text-left text-sm font-bold text-slate-900 dark:text-white hover:underline block truncate w-full"
                            >
                              {order.printType}
                            </button>
                            <div className="text-xs text-slate-600 dark:text-slate-300 mt-0.5 flex items-center gap-1.5 truncate">
                              <span className="font-medium">{order.clientName}</span>
                              <span aria-hidden="true">·</span>
                              <span>
                                {order.specs.paperMaterial} · {order.specs.paperSize}
                              </span>
                            </div>
                          </div>

                          {/* Work, Payment & Vendor Status Badges */}
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span
                              className={`text-[11px] font-medium px-2 py-0.5 rounded border ${workMeta.colorClass}`}
                            >
                              {workMeta.shortLabel}
                            </span>
                            <span
                              className={`text-[11px] font-medium px-2 py-0.5 rounded border ${payMeta.colorClass}`}
                            >
                              {payMeta.label}
                            </span>
                            {order.vendorSentAt ? (
                              <span className="text-[11px] font-medium px-2 py-0.5 rounded border bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-900">
                                Sudah dikirim ke percetakan ({formatDateTimeId(order.vendorSentAt)})
                              </span>
                            ) : (
                              <span className="text-[11px] font-medium px-2 py-0.5 rounded border bg-slate-50 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700">
                                Belum dikirim ke percetakan
                              </span>
                            )}
                          </div>

                          {/* Financials & Pickup */}
                          <div className="pt-2 border-t border-slate-100 dark:border-slate-800 space-y-1 text-xs">
                            <div className="flex items-center justify-between">
                              <span className="text-slate-500 dark:text-slate-400">Total / DP</span>
                              <span className="font-mono tabular-nums font-semibold text-slate-900 dark:text-slate-100">
                                {formatRupiah(order.totalPrice)}{' '}
                                <span className="text-slate-400 font-normal">
                                  (DP {formatRupiah(order.dpAmount)})
                                </span>
                              </span>
                            </div>
                            <div className="flex items-center justify-between">
                              <span className="text-slate-500 dark:text-slate-400 flex items-center gap-1">
                                <CalendarClock className="w-3.5 h-3.5" />
                                Ambil
                              </span>
                              <span className="font-mono tabular-nums text-slate-700 dark:text-slate-300">
                                {formatDateTimeId(order.pickupAt)}
                              </span>
                            </div>
                          </div>

                          {/* Card Actions & Quick Move Status */}
                          <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                            <div className="flex flex-wrap items-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => onOpenPreview(order)}
                                title="Preview Dokumen"
                                className="inline-flex items-center gap-1 px-2 py-1.5 rounded-md bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-xs font-medium text-slate-700 dark:text-slate-200"
                              >
                                <Eye className="w-3.5 h-3.5" />
                                Preview
                              </button>
                              <button
                                type="button"
                                onClick={() => onOpenEmail(order)}
                                title="Kirim Email ke Client"
                                className="inline-flex items-center gap-1 px-2 py-1.5 rounded-md bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-xs font-medium text-slate-700 dark:text-slate-200"
                              >
                                <Mail className="w-3.5 h-3.5" />
                                Email
                              </button>
                              <button
                                type="button"
                                disabled={!vendorCheck.ready}
                                onClick={() => onOpenVendorEmail(order)}
                                title={
                                  vendorCheck.ready
                                    ? 'Kirim order ke email percetakan'
                                    : vendorCheck.reason
                                }
                                className="inline-flex items-center gap-1 px-2 py-1.5 rounded-md bg-orange-50 dark:bg-orange-950/60 hover:bg-orange-100 dark:hover:bg-orange-900/60 border border-orange-200 dark:border-orange-900 text-xs font-semibold text-orange-700 dark:text-orange-300 disabled:opacity-45 disabled:cursor-not-allowed"
                              >
                                <Factory className="w-3.5 h-3.5" />
                                Kirim ke Percetakan
                              </button>
                              {order.clientPhone && (
                                <a
                                  href={buildWhatsAppUrl(order, settings.shopName)}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  title="Hubungi via WhatsApp"
                                  className="p-1.5 rounded-md bg-emerald-50 dark:bg-emerald-950/60 hover:bg-emerald-100 dark:hover:bg-emerald-900 text-emerald-700 dark:text-emerald-300"
                                >
                                  <MessageCircle className="w-3.5 h-3.5" />
                                </a>
                              )}
                            </div>

                            <div className="flex items-center justify-between gap-2">
                              <span className="text-[11px] text-slate-500 dark:text-slate-400">
                                Ubah Status:
                              </span>
                              <select
                                value={order.workStatus}
                                onChange={(e) =>
                                  onChangeWorkStatus(order, e.target.value as WorkStatus)
                                }
                                aria-label="Ubah status pengerjaan"
                                className="text-[11px] px-2 py-1 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200"
                              >
                                <option value="belum_dp">Belum DP</option>
                                <option value="dalam_proses">Dalam Proses</option>
                                <option value="selesai">Selesai</option>
                              </select>
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* INTEGRATED TABLE VIEW */
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60 text-slate-600 dark:text-slate-300">
                  <th className="py-3 px-4 font-semibold whitespace-nowrap">Kode Order</th>
                  <th className="py-3 px-4 font-semibold">Client & Cetakan</th>
                  <th className="py-3 px-4 font-semibold whitespace-nowrap">Pengerjaan</th>
                  <th className="py-3 px-4 font-semibold whitespace-nowrap">Pembayaran</th>
                  <th className="py-3 px-4 font-semibold text-right whitespace-nowrap">Total / Sisa</th>
                  <th className="py-3 px-4 font-semibold whitespace-nowrap">Pengambilan</th>
                  <th className="py-3 px-4 font-semibold text-right whitespace-nowrap">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {filteredOrders.map((order) => {
                  const workMeta = WORK_STATUS_META[order.workStatus];
                  const payMeta = PAYMENT_STATUS_META[order.paymentStatus];
                  const urgency = getPickupUrgency(order.pickupAt, order.pickedUp);
                  const vendorCheck = canSendToVendor(order);

                  return (
                    <tr
                      key={order.id}
                      className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors"
                    >
                      <td className="py-3 px-4 font-mono font-semibold text-slate-900 dark:text-white whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => onOpenDetail(order.id)}
                          className="hover:text-orange-600 dark:hover:text-orange-400"
                        >
                          {order.orderCode}
                        </button>
                      </td>
                      <td className="py-3 px-4 min-w-[220px]">
                        <button
                          type="button"
                          onClick={() => onOpenDetail(order.id)}
                          className="font-semibold text-slate-900 dark:text-white hover:underline text-left block"
                        >
                          {order.printType}
                        </button>
                        <div className="text-slate-500 dark:text-slate-400 mt-0.5">
                          {order.clientName} · {order.specs.paperMaterial} ({order.specs.paperSize}) ·{' '}
                          {order.files.length} file
                        </div>
                        <div className="mt-1">
                          {order.vendorSentAt ? (
                            <span className="inline-block text-[10px] font-medium px-1.5 py-0.5 rounded border bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-900">
                              Sudah dikirim ke percetakan ({formatDateTimeId(order.vendorSentAt)})
                            </span>
                          ) : (
                            <span className="inline-block text-[10px] font-medium px-1.5 py-0.5 rounded border bg-slate-50 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700">
                              Belum dikirim ke percetakan
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded border font-medium ${workMeta.colorClass}`}
                        >
                          <span className={`w-1.5 h-1.5 rounded-full ${workMeta.dotClass}`} />
                          {workMeta.shortLabel}
                        </span>
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center px-2.5 py-1 rounded border font-medium ${payMeta.colorClass}`}
                        >
                          {payMeta.label}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right font-mono tabular-nums whitespace-nowrap">
                        <div className="font-semibold text-slate-900 dark:text-white">
                          {formatRupiah(order.totalPrice)}
                        </div>
                        <div className="text-[11px] text-slate-500 dark:text-slate-400">
                          Sisa: {formatRupiah(order.remainingAmount)}
                        </div>
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap">
                        <div className="font-mono tabular-nums text-slate-800 dark:text-slate-200">
                          {formatDateTimeId(order.pickupAt)}
                        </div>
                        <span
                          className={`inline-block mt-1 text-[11px] font-medium px-1.5 py-0.5 rounded border ${urgency.badgeClass}`}
                        >
                          {urgency.label}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        <div className="inline-flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => onOpenPreview(order)}
                            title="Preview Dokumen"
                            className="p-1.5 rounded-md border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => onOpenEmail(order)}
                            title="Kirim Email ke Client"
                            className="p-1.5 rounded-md border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
                          >
                            <Mail className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            disabled={!vendorCheck.ready}
                            onClick={() => onOpenVendorEmail(order)}
                            title={
                              vendorCheck.ready
                                ? 'Kirim ke Percetakan'
                                : vendorCheck.reason
                            }
                            className="inline-flex items-center gap-1 px-2 py-1.5 rounded-md bg-orange-50 dark:bg-orange-950/60 hover:bg-orange-100 dark:hover:bg-orange-900/60 border border-orange-200 dark:border-orange-900 text-[11px] font-semibold text-orange-700 dark:text-orange-300 disabled:opacity-45 disabled:cursor-not-allowed"
                          >
                            <Factory className="w-3.5 h-3.5" />
                            Kirim ke Percetakan
                          </button>
                          <button
                            type="button"
                            onClick={() => onOpenDetail(order.id)}
                            title="Buka Detail"
                            className="p-1.5 rounded-md border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
