import { PrintClient, PrintOrder, ShopSettings } from '../types/printdesk';

const ORDER_SEQ_KEY = 'printdesk_order_seq_map_v1';

export function formatRupiah(amount: number): string {
  const safe = Number.isFinite(amount) ? Math.max(0, Math.round(amount)) : 0;
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(safe);
}

export function formatDateTimeId(isoString: string): string {
  const d = new Date(isoString);
  if (Number.isNaN(d.getTime())) return '-';
  return new Intl.DateTimeFormat('id-ID', {
    weekday: 'short',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(d);
}

export function formatDateOnlyId(isoString: string): string {
  const d = new Date(isoString);
  if (Number.isNaN(d.getTime())) return '-';
  return new Intl.DateTimeFormat('id-ID', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  }).format(d);
}

export function formatTimeOnlyId(isoString: string): string {
  const d = new Date(isoString);
  if (Number.isNaN(d.getTime())) return '-';
  return new Intl.DateTimeFormat('id-ID', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(d);
}

export function toLocalDateTimeInputValue(isoString: string): string {
  const d = new Date(isoString);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function formatFileSize(bytes: number): string {
  if (!bytes || bytes <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  let idx = 0;
  let val = bytes;
  while (val >= 1024 && idx < units.length - 1) {
    val /= 1024;
    idx++;
  }
  return `${val.toFixed(idx === 0 ? 0 : 1)} ${units[idx]}`;
}

export interface PickupUrgency {
  key: 'picked_up' | 'overdue' | 'today' | 'tomorrow' | 'upcoming';
  label: string;
  badgeClass: string;
  isOverdue: boolean;
  isDueSoon: boolean;
  diffMinutes: number;
}

export function getPickupUrgency(pickupAt: string, pickedUp: boolean): PickupUrgency {
  if (pickedUp) {
    return {
      key: 'picked_up',
      label: 'Sudah Diambil',
      badgeClass:
        'bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700',
      isOverdue: false,
      isDueSoon: false,
      diffMinutes: 0,
    };
  }

  const now = new Date();
  const target = new Date(pickupAt);
  if (Number.isNaN(target.getTime())) {
    return {
      key: 'upcoming',
      label: 'Jadwal Belum Diatur',
      badgeClass:
        'bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700',
      isOverdue: false,
      isDueSoon: false,
      diffMinutes: 99999,
    };
  }

  const diffMs = target.getTime() - now.getTime();
  const diffMinutes = Math.round(diffMs / 60000);

  if (diffMs < 0) {
    return {
      key: 'overdue',
      label: 'Terlambat diambil',
      badgeClass:
        'bg-red-50 text-red-700 border-red-200 dark:bg-red-950/70 dark:text-red-300 dark:border-red-900',
      isOverdue: true,
      isDueSoon: true,
      diffMinutes,
    };
  }

  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfTarget = new Date(target.getFullYear(), target.getMonth(), target.getDate());
  const dayDiff = Math.round((startOfTarget.getTime() - startOfToday.getTime()) / 86400000);

  if (dayDiff === 0) {
    return {
      key: 'today',
      label: 'Hari ini',
      badgeClass:
        'bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-950/60 dark:text-orange-300 dark:border-orange-900',
      isOverdue: false,
      isDueSoon: true,
      diffMinutes,
    };
  }

  if (dayDiff === 1) {
    return {
      key: 'tomorrow',
      label: 'Besok',
      badgeClass:
        'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/60 dark:text-blue-300 dark:border-blue-900',
      isOverdue: false,
      isDueSoon: diffMinutes <= 24 * 60,
      diffMinutes,
    };
  }

  return {
    key: 'upcoming',
    label: `${dayDiff} hari lagi`,
    badgeClass:
      'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700',
    isOverdue: false,
    isDueSoon: false,
    diffMinutes,
  };
}

function getTodayDateKey(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}${m}${d}`;
}

export function generateOrderCode(existingOrders: PrintOrder[]): string {
  const todayKey = getTodayDateKey();
  const prefix = `PD-${todayKey}-`;

  let maxSeq = 0;
  for (const ord of existingOrders) {
    if (ord.orderCode.startsWith(prefix)) {
      const num = parseInt(ord.orderCode.slice(prefix.length), 10);
      if (!Number.isNaN(num) && num > maxSeq) {
        maxSeq = num;
      }
    }
  }

  try {
    const raw = localStorage.getItem(ORDER_SEQ_KEY);
    if (raw) {
      const map = JSON.parse(raw) as Record<string, number>;
      const storedSeq = Number(map[todayKey]) || 0;
      if (storedSeq > maxSeq) {
        maxSeq = storedSeq;
      }
    }
  } catch {
    // Ignore localStorage parse error
  }

  return `${prefix}${String(maxSeq + 1).padStart(3, '0')}`;
}

export function commitOrderSequence(orderCode: string): void {
  const match = /^PD-(\d{8})-(\d+)$/.exec(orderCode.trim());
  if (!match) return;
  const [, dateKey, seqStr] = match;
  const seqNum = parseInt(seqStr, 10);
  if (Number.isNaN(seqNum)) return;

  try {
    const raw = localStorage.getItem(ORDER_SEQ_KEY);
    const map: Record<string, number> = raw ? JSON.parse(raw) : {};
    if ((map[dateKey] || 0) < seqNum) {
      map[dateKey] = seqNum;
      localStorage.setItem(ORDER_SEQ_KEY, JSON.stringify(map));
    }
  } catch {
    // Ignore storage error
  }
}

export function resetOrderSequences(): void {
  localStorage.removeItem(ORDER_SEQ_KEY);
}

export function generateSafeId(prefix = 'id'): string {
  const rand = Math.random().toString(36).slice(2, 8);
  return `${prefix}_${Date.now()}_${rand}`.replace(/[^a-zA-Z0-9_-]/g, '');
}

export function normalizeWhatsAppPhone(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (!digits) return '';
  if (digits.startsWith('0')) return `62${digits.slice(1)}`;
  if (digits.startsWith('62')) return digits;
  return `62${digits}`;
}

export function buildWhatsAppUrl(order: PrintOrder, shopName: string): string {
  const phone = normalizeWhatsAppPhone(order.clientPhone);
  const statusText =
    order.workStatus === 'selesai'
      ? 'sudah selesai dicetak dan siap diambil'
      : order.workStatus === 'dalam_proses'
        ? 'sedang dalam proses pengerjaan'
        : 'menunggu konfirmasi DP untuk diproses';
  const remainingText =
    order.remainingAmount > 0
      ? `\nSisa pembayaran: ${formatRupiah(order.remainingAmount)}`
      : '\nStatus pembayaran: Lunas';
  const shopPart = shopName.trim() ? ` di ${shopName.trim()}` : '';

  const text = `Halo ${order.clientName}, pesanan ${order.orderCode} (${order.printType})${shopPart} ${statusText}.\nJadwal pengambilan: ${formatDateTimeId(order.pickupAt)}${remainingText}\n\nTerima kasih!`;
  return `https://wa.me/${phone}?text=${encodeURIComponent(text)}`;
}

export const UNASSIGNED_SALES_LABEL = 'Belum ada penanggung jawab';

export function getSalesDisplayName(salesName?: string): string {
  const trimmed = (salesName || '').trim();
  return trimmed || UNASSIGNED_SALES_LABEL;
}

export function interpolateTemplate(
  template: string,
  order: PrintOrder,
  settings: ShopSettings
): string {
  const driveLinks = order.files
    .filter((f) => f.webViewLink)
    .map((f) => `- ${f.name}: ${f.webViewLink}`)
    .join('\n');
  const displayShopName = settings.shopName.trim() || 'PrintDesk';
  const salesDisplay = getSalesDisplayName(order.salesName);

  const rendered = template
    .replaceAll('{KodeOrder}', order.orderCode)
    .replaceAll('{NamaClient}', order.clientName)
    .replaceAll('{JenisCetakan}', order.printType)
    .replaceAll('{WaktuPengambilan}', formatDateTimeId(order.pickupAt))
    .replaceAll('{TotalHarga}', formatRupiah(order.totalPrice))
    .replaceAll('{NominalDP}', formatRupiah(order.dpAmount))
    .replaceAll('{SisaPembayaran}', formatRupiah(order.remainingAmount))
    .replaceAll('{NamaUsaha}', displayShopName)
    .replaceAll('{penangan_order}', salesDisplay)
    .replaceAll('{LinkDrive}', driveLinks || '(Belum ada link Google Drive)');

  if (!template.includes('{penangan_order}') && order.salesName?.trim()) {
    return `${rendered}\n\nYang menangani order: ${order.salesName.trim()}`;
  }
  return rendered;
}

export function buildVendorEmailSubject(params: {
  printType: string;
  paperMaterial: string;
  paperSize: string;
  copies: number;
  qtyUnit?: string;
}): string {
  const jenis = (params.printType || 'CETAKAN').trim().toUpperCase();
  const bahan = (params.paperMaterial || '-').trim().toUpperCase();
  const ukuran = (params.paperSize || '-').trim().toUpperCase();
  const unit = (params.qtyUnit || 'PCS').trim().toUpperCase();
  const qty = `${Math.max(1, Number(params.copies) || 1)}${unit === 'PCS' ? 'PCS' : ` ${unit}`}`;

  return `CETAK ${jenis} - CETAK ${jenis} BAHAN ${bahan} UKURAN : ${ukuran} QTY : ${qty}`;
}

export function interpolateVendorTemplate(
  template: string,
  order: PrintOrder,
  settings: ShopSettings
): string {
  const unit = (order.specs.qtyUnit || 'PCS').trim().toUpperCase();
  const qtyText = `${order.specs.copies} ${unit}`;
  const driveLinks = order.files
    .filter((f) => f.webViewLink)
    .map((f) => `- ${f.name}: ${f.webViewLink}`)
    .join('\n');
  const displayShopName = settings.shopName.trim() || 'PrintDesk';
  const salesDisplay = getSalesDisplayName(order.salesName);

  const rendered = template
    .replaceAll('{NamaPercetakan}', settings.vendorName || 'Percetakan')
    .replaceAll('{kode_order}', order.orderCode)
    .replaceAll('{nama_client}', order.clientName)
    .replaceAll('{jenis_cetakan}', order.printType)
    .replaceAll('{bahan}', order.specs.paperMaterial)
    .replaceAll('{ukuran}', order.specs.paperSize)
    .replaceAll('{qty}', qtyText)
    .replaceAll('{finishing}', order.specs.finishing || '-')
    .replaceAll('{catatan}', order.notes || '-')
    .replaceAll('{waktu_pengambilan}', formatDateTimeId(order.pickupAt))
    .replaceAll('{nama_usaha}', displayShopName)
    .replaceAll('{penangan_order}', salesDisplay)
    .replaceAll('{link_drive}', driveLinks || '(Terlampir pada email)');

  if (!template.includes('{penangan_order}') && order.salesName?.trim()) {
    return `${rendered}\n\nYang menangani order: ${order.salesName.trim()}`;
  }
  return rendered;
}

export function canSendToVendor(order: PrintOrder): {
  ready: boolean;
  reason: string;
} {
  if (!order.files || order.files.length === 0) {
    return {
      ready: false,
      reason: 'Order belum memiliki file cetak (PDF/gambar). Unggah file terlebih dahulu.',
    };
  }
  if (!order.printType.trim()) {
    return {
      ready: false,
      reason: 'Jenis cetakan belum diisi.',
    };
  }
  if (!order.specs.paperMaterial?.trim()) {
    return {
      ready: false,
      reason: 'Spesifikasi bahan cetak belum diisi.',
    };
  }
  if (!order.specs.paperSize?.trim()) {
    return {
      ready: false,
      reason: 'Spesifikasi ukuran cetak belum diisi.',
    };
  }
  if (!order.specs.copies || order.specs.copies < 1) {
    return {
      ready: false,
      reason: 'Jumlah Qty cetak minimal 1.',
    };
  }
  return { ready: true, reason: '' };
}

export function exportOrdersToCsv(orders: PrintOrder[]): void {
  const headers = [
    'Kode Order',
    'Tanggal Dibuat',
    'Nama Client',
    'No HP/WhatsApp',
    'Email Client',
    'Jenis Cetakan',
    'Kategori',
    'Ukuran',
    'Bahan',
    'Warna',
    'Halaman',
    'Qty',
    'Satuan',
    'Finishing',
    'Total Harga',
    'Nominal DP',
    'Sisa Pembayaran',
    'Status Pengerjaan',
    'Status Pembayaran',
    'Waktu Pengambilan',
    'Sudah Diambil',
    'Status Kirim Percetakan',
    'Catatan',
    'Yang Menangani Order',
  ];

  const escapeCsv = (val: unknown) => {
    const str = String(val ?? '').replace(/"/g, '""');
    return `"${str}"`;
  };

  const workLabel = (s: PrintOrder['workStatus']) =>
    s === 'belum_dp' ? 'Belum DP' : s === 'dalam_proses' ? 'Dalam Proses' : 'Selesai';
  const payLabel = (s: PrintOrder['paymentStatus']) =>
    s === 'belum_dp' ? 'Belum DP' : s === 'sudah_dp' ? 'Sudah DP' : 'Lunas';

  const rows = orders.map((o) =>
    [
      o.orderCode,
      formatDateTimeId(o.createdAtIso),
      o.clientName,
      o.clientPhone,
      o.clientEmail || '',
      o.printType,
      o.category,
      o.specs.paperSize,
      o.specs.paperMaterial,
      o.specs.colorMode,
      o.specs.pageCount,
      o.specs.copies,
      o.specs.qtyUnit || 'PCS',
      o.specs.finishing,
      o.totalPrice,
      o.dpAmount,
      o.remainingAmount,
      workLabel(o.workStatus),
      payLabel(o.paymentStatus),
      formatDateTimeId(o.pickupAt),
      o.pickedUp ? 'Ya' : 'Belum',
      o.vendorSentAt ? `Sudah (${formatDateTimeId(o.vendorSentAt)})` : 'Belum dikirim',
      o.notes || '',
      getSalesDisplayName(o.salesName),
    ]
      .map(escapeCsv)
      .join(',')
  );

  const csvContent = '\uFEFF' + [headers.map(escapeCsv).join(','), ...rows].join('\r\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `PrintDesk_Orders_${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function exportBackupJson(payload: {
  orders: PrintOrder[];
  clients: PrintClient[];
  settings: ShopSettings;
}): void {
  const backup = {
    app: 'PrintDesk',
    version: 1,
    exportedAt: new Date().toISOString(),
    orders: payload.orders,
    clients: payload.clients,
    settings: payload.settings,
  };
  const blob = new Blob([JSON.stringify(backup, null, 2)], {
    type: 'application/json;charset=utf-8;',
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `PrintDesk_Backup_${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
