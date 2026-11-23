export type OrderCategory =
  | 'Dokumen'
  | 'Banner'
  | 'Spanduk'
  | 'Kartu Nama'
  | 'Brosur'
  | 'Undangan'
  | 'Stiker'
  | 'Lainnya';

export type WorkStatus = 'belum_dp' | 'dalam_proses' | 'selesai';

export type PaymentStatus = 'belum_dp' | 'sudah_dp' | 'lunas';

export interface OrderSpecs {
  paperSize: string;
  orientation: 'Portrait' | 'Landscape' | string;
  pageCount: number;
  copies: number;
  qtyUnit: string;
  paperMaterial: string;
  colorMode: 'Full Color' | 'Hitam Putih' | string;
  finishing: string;
}

export interface OrderFile {
  id: string;
  name: string;
  mimeType: string;
  size: number;
  driveFileId?: string;
  webViewLink?: string;
  webContentLink?: string;
  driveFolderPath?: string;
  uploadedAt: string;
}

export interface EmailLog {
  id: string;
  sentAt: string;
  recipients: string[];
  cc?: string[];
  subject: string;
  mode: 'link_drive' | 'lampiran';
  attachments?: string[];
  status: 'berhasil' | 'gagal';
  errorMessage?: string;
}

export interface PrintOrder {
  id: string;
  ownerId: string;
  orderCode: string;
  clientId?: string;
  clientName: string;
  clientPhone: string;
  clientEmail?: string;
  printType: string;
  category: OrderCategory;
  specs: OrderSpecs;
  files: OrderFile[];
  totalPrice: number;
  dpAmount: number;
  remainingAmount: number;
  workStatus: WorkStatus;
  paymentStatus: PaymentStatus;
  pickupAt: string; // ISO string
  pickedUp: boolean;
  notes?: string;
  emailHistory: EmailLog[];
  vendorSentAt?: string;
  vendorEmailHistory: EmailLog[];
  salesName?: string;
  createdAtIso: string;
  updatedAtIso: string;
}

export interface PrintClient {
  id: string;
  ownerId: string;
  name: string;
  phone: string;
  email?: string;
  company?: string;
  notes?: string;
  createdAtIso: string;
  updatedAtIso: string;
}

export interface ShopSettings {
  ownerId: string;
  shopName: string;
  shopAddress: string;
  shopPhone: string;
  shopEmail: string;
  logoDataUrl?: string;
  driveRootFolder: string;
  emailSubjectTemplate: string;
  emailBodyTemplate: string;
  vendorName: string;
  vendorEmail: string;
  vendorCcEmail: string;
  vendorEmailBodyTemplate: string;
  salesNames?: string[];
  updatedAtIso: string;
}

export type AppPage =
  | 'dashboard'
  | 'order-new'
  | 'order-edit'
  | 'order-detail'
  | 'schedule'
  | 'clients'
  | 'settings';

export interface UploadProgressItem {
  id: string;
  fileName: string;
  progress: number;
  status: 'uploading' | 'done' | 'error';
  errorMessage?: string;
}

export const ORDER_CATEGORIES: OrderCategory[] = [
  'Dokumen',
  'Banner',
  'Spanduk',
  'Kartu Nama',
  'Brosur',
  'Undangan',
  'Stiker',
  'Lainnya',
];

export const PRINT_TYPE_PRESETS = [
  'SPANDUK',
  'BANNER',
  'STIKER',
  'BROSUR',
  'KARTU NAMA',
  'DOKUMEN',
  'UNDANGAN',
  'X-BANNER',
  'POSTER',
];

export const MATERIAL_PRESETS = [
  'Flexi China',
  'Flexi Korea 440gsm',
  'Vinyl',
  'Art Paper 150gr',
  'Art Carton 260gr',
  'HVS 80gsm',
  'Stiker Chromo',
  'Albatros',
];

export const QTY_UNIT_OPTIONS = [
  'PCS',
  'LEMBAR',
  'BOX',
  'RIM',
  'SET',
  'METER',
];

export const WORK_STATUS_META: Record<
  WorkStatus,
  { label: string; shortLabel: string; colorClass: string; dotClass: string }
> = {
  belum_dp: {
    label: 'Belum DP',
    shortLabel: 'Belum DP',
    colorClass:
      'bg-red-50 text-red-700 border-red-200 dark:bg-red-950/60 dark:text-red-300 dark:border-red-900',
    dotClass: 'bg-red-600',
  },
  dalam_proses: {
    label: 'Dalam Proses Pengerjaan',
    shortLabel: 'Dalam Proses',
    colorClass:
      'bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-900',
    dotClass: 'bg-amber-500',
  },
  selesai: {
    label: 'Selesai',
    shortLabel: 'Selesai',
    colorClass:
      'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-900',
    dotClass: 'bg-emerald-600',
  },
};

export const PAYMENT_STATUS_META: Record<
  PaymentStatus,
  { label: string; colorClass: string }
> = {
  belum_dp: {
    label: 'Belum DP',
    colorClass:
      'bg-red-50 text-red-700 border-red-200 dark:bg-red-950/50 dark:text-red-300 dark:border-red-900',
  },
  sudah_dp: {
    label: 'Sudah DP',
    colorClass:
      'bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950/50 dark:text-amber-300 dark:border-amber-900',
  },
  lunas: {
    label: 'Lunas',
    colorClass:
      'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-900',
  },
};
