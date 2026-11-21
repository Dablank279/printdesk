import { ShopSettings } from '../types/printdesk';

export const DEFAULT_SHOP_SETTINGS: ShopSettings = {
  ownerId: 'local',
  shopName: 'PrintDesk Studio & Percetakan',
  shopAddress: 'Jl. Merdeka Raya No. 88, Bandung',
  shopPhone: '0812-3456-7890',
  shopEmail: 'halo@printdesk.id',
  logoDataUrl: '',
  driveRootFolder: 'PrintDesk',
  emailSubjectTemplate: 'Dokumen Order {KodeOrder} - {NamaClient}',
  emailBodyTemplate: `Halo {NamaClient},

Berikut kami kirimkan informasi dan dokumen untuk pesanan cetak Anda di {NamaUsaha}:

Kode Order : {KodeOrder}
Jenis Cetakan : {JenisCetakan}
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
  updatedAtIso: new Date().toISOString(),
};
