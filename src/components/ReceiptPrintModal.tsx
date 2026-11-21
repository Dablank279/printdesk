import React from 'react';
import { Printer, X } from 'lucide-react';
import {
  PAYMENT_STATUS_META,
  PrintOrder,
  ShopSettings,
  WORK_STATUS_META,
} from '../types/printdesk';
import { formatDateTimeId, formatRupiah } from '../utils/formatters';

interface ReceiptPrintModalProps {
  open: boolean;
  order: PrintOrder | null;
  settings: ShopSettings;
  onClose: () => void;
}

export const ReceiptPrintModal: React.FC<ReceiptPrintModalProps> = ({
  open,
  order,
  settings,
  onClose,
}) => {
  if (!open || !order) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-xs p-4"
      role="dialog"
      aria-modal="true"
    >
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-2xl w-full max-h-[92vh] flex flex-col shadow-2xl overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between no-print">
          <h3 className="text-base font-bold text-slate-900 dark:text-white">
            Nota / Tanda Terima Order
          </h3>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => window.print()}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-orange-600 hover:bg-orange-700 text-white text-xs font-semibold"
            >
              <Printer className="w-4 h-4" />
              Cetak Nota
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6 bg-slate-50 dark:bg-slate-950">
          <div
            id="printdesk-printable-area"
            className="bg-white text-slate-900 border border-slate-200 rounded-xl p-6 sm:p-8 max-w-xl mx-auto space-y-6"
          >
            {/* Header Nota */}
            <div className="flex items-start justify-between gap-4 pb-5 border-b border-slate-200">
              <div className="flex items-start gap-3">
                {settings.logoDataUrl ? (
                  <img
                    src={settings.logoDataUrl}
                    alt={settings.shopName}
                    className="w-12 h-12 object-contain rounded-lg border border-slate-200"
                  />
                ) : (
                  <div className="w-11 h-11 rounded-lg bg-slate-900 text-white flex items-center justify-center shrink-0">
                    <Printer className="w-5 h-5" />
                  </div>
                )}
                <div>
                  <h2 className="text-lg font-bold text-slate-900">
                    {settings.shopName}
                  </h2>
                  <p className="text-xs text-slate-600">{settings.shopAddress}</p>
                  <p className="text-xs text-slate-600">
                    Telp/WA: {settings.shopPhone} · {settings.shopEmail}
                  </p>
                </div>
              </div>
              <div className="text-right">
                <div className="text-[11px] uppercase tracking-wider font-semibold text-slate-500">
                  Tanda Terima Order
                </div>
                <div className="text-sm font-mono font-bold text-slate-900 mt-0.5">
                  {order.orderCode}
                </div>
                <div className="text-[11px] text-slate-500 mt-0.5">
                  {formatDateTimeId(order.createdAtIso)}
                </div>
              </div>
            </div>

            {/* Data Client & Pengambilan */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div className="space-y-1">
                <div className="text-slate-500 font-medium">Data Pemesan</div>
                <div className="text-sm font-semibold text-slate-900">
                  {order.clientName}
                </div>
                <div className="text-slate-600">HP/WA: {order.clientPhone}</div>
                {order.clientEmail && (
                  <div className="text-slate-600">Email: {order.clientEmail}</div>
                )}
              </div>
              <div className="space-y-1 sm:text-right">
                <div className="text-slate-500 font-medium">Jadwal Pengambilan</div>
                <div className="text-sm font-semibold text-slate-900">
                  {formatDateTimeId(order.pickupAt)}
                </div>
                <div className="text-slate-600">
                  Pengerjaan: {WORK_STATUS_META[order.workStatus].shortLabel}
                </div>
                <div className="text-slate-600">
                  Pembayaran: {PAYMENT_STATUS_META[order.paymentStatus].label}
                </div>
              </div>
            </div>

            {/* Rincian Cetakan */}
            <div className="border border-slate-200 rounded-lg overflow-hidden">
              <table className="w-full text-xs">
                <thead className="bg-slate-100 text-slate-700">
                  <tr>
                    <th className="text-left px-4 py-2.5 font-semibold">
                      Item & Spesifikasi Cetakan
                    </th>
                    <th className="text-right px-4 py-2.5 font-semibold">
                      Jumlah
                    </th>
                    <th className="text-right px-4 py-2.5 font-semibold">
                      Subtotal
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  <tr>
                    <td className="px-4 py-3">
                      <div className="font-semibold text-slate-900">
                        {order.printType} ({order.category})
                      </div>
                      <div className="text-slate-600 mt-1 space-y-0.5">
                        <div>
                          Ukuran: {order.specs.paperSize} · {order.specs.orientation} ·{' '}
                          {order.specs.colorMode}
                        </div>
                        <div>
                          Bahan: {order.specs.paperMaterial} · {order.specs.pageCount} hal
                        </div>
                        <div>Finishing: {order.specs.finishing || '-'}</div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right font-mono tabular-nums align-top">
                      {order.specs.copies}x
                    </td>
                    <td className="px-4 py-3 text-right font-mono tabular-nums font-semibold align-top">
                      {formatRupiah(order.totalPrice)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Ringkasan Pembayaran */}
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pt-2">
              <div className="text-xs text-slate-600 max-w-xs">
                <div className="font-semibold text-slate-700 mb-1">Catatan Order:</div>
                <p>{order.notes || 'Tidak ada catatan tambahan.'}</p>
              </div>

              <div className="w-full sm:w-64 space-y-1.5 text-xs border-t sm:border-t-0 pt-3 sm:pt-0 border-slate-200">
                <div className="flex justify-between">
                  <span className="text-slate-600">Total Biaya</span>
                  <span className="font-mono tabular-nums font-semibold">
                    {formatRupiah(order.totalPrice)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600">DP Masuk</span>
                  <span className="font-mono tabular-nums text-emerald-700 font-semibold">
                    {formatRupiah(order.dpAmount)}
                  </span>
                </div>
                <div className="flex justify-between pt-1.5 border-t border-slate-200 text-sm">
                  <span className="font-bold text-slate-900">Sisa Tagihan</span>
                  <span className="font-mono tabular-nums font-bold text-slate-900">
                    {formatRupiah(order.remainingAmount)}
                  </span>
                </div>
              </div>
            </div>

            <div className="pt-6 border-t border-dashed border-slate-300 flex items-center justify-between text-[11px] text-slate-500">
              <span>Harap membawa nota / menyebutkan kode order saat pengambilan.</span>
              <span>Terima kasih</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
