import { ShopSettings } from '../types/printdesk';

export const DEFAULT_SALES_NAMES: string[] = [
  'Bagus',
  'Inna',
  'Reza',
  'Anisah',
  'Dafa',
];

export const DEFAULT_SHOP_SETTINGS: ShopSettings = {
  ownerId: 'local',
  shopName: '',
  shopAddress: '',
  shopPhone: '',
  shopEmail: '',
  logoDataUrl: '',
  driveRootFolder: 'PrintDesk',
  emailSubjectTemplate: 'Dokumen Order {KodeOrder} - {NamaClient}',
  emailBodyTemplate: `Halo {NamaClient},

Berikut kami kirimkan informasi dan dokumen untuk pesanan cetak Anda di {NamaUsaha}:

Kode Order : {KodeOrder}
Jenis Cetakan : {JenisCetakan}
Yang menangani order : {penangan_order}
Jadwal Pengambilan : {WaktuPengambilan}
Total Biaya : {TotalHarga}
DP Masuk : {NominalDP}
Sisa Pembayaran : {SisaPembayaran}

Tautan File Google Drive:
{LinkDrive}

Jika ada revisi sebelum cetak, silakan balas email ini atau hubungi kami via WhatsApp.

Terima kasih,
{NamaUsaha}`,
  vendorName: 'Wahana Dimensi',
  vendorEmail: 'wahanadimensiwd@gmail.com',
  vendorCcEmail: '',
  vendorEmailBodyTemplate: `Halo Tim {NamaPercetakan},

Mohon bantu proses order cetak berikut dari {nama_usaha}:

Kode Order       : {kode_order}
Nama Client      : {nama_client}
Yang menangani order: {penangan_order}
Jenis Cetakan    : {jenis_cetakan}
Bahan            : {bahan}
Ukuran           : {ukuran}
Qty              : {qty}
Finishing        : {finishing}
Target Ambil     : {waktu_pengambilan}
Catatan Produksi : {catatan}

File cetak terlampir pada email ini. Mohon konfirmasi jika file sudah diterima dan siap naik cetak.

Terima kasih,
{nama_usaha}`,
  salesNames: [...DEFAULT_SALES_NAMES],
  updatedAtIso: new Date().toISOString(),
};
