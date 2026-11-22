import DOMPurify from 'dompurify';

export const MAX_RAW_LOGO_BYTES = 2 * 1024 * 1024; // 2 MB
export const MAX_ENCODED_LOGO_BYTES = 200 * 1024; // 200 KB
export const MAX_LOGO_DIMENSION = 512;

export const DEFAULT_PRINTER_FAVICON_DATA_URL =
  'data:image/svg+xml;utf8,' +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
      <rect width="64" height="64" rx="14" fill="#ea580c"/>
      <g fill="none" stroke="#ffffff" stroke-width="3.6" stroke-linecap="round" stroke-linejoin="round">
        <path d="M20 24V14h24v10"/>
        <path d="M20 44h-4a4 4 0 0 1-4-4V30a4 4 0 0 1 4-4h32a4 4 0 0 1 4 4v10a4 4 0 0 1-4 4h-4"/>
        <rect x="20" y="36" width="24" height="14" rx="2"/>
      </g>
    </svg>`
  );

export function updateBrowserFavicon(logoDataUrl?: string): void {
  if (typeof document === 'undefined') return;
  const href =
    logoDataUrl && logoDataUrl.startsWith('data:image/')
      ? logoDataUrl
      : DEFAULT_PRINTER_FAVICON_DATA_URL;

  let link = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
  if (!link) {
    link = document.createElement('link');
    link.rel = 'icon';
    document.head.appendChild(link);
  }
  link.href = href;
}

function loadImageFromUrl(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () =>
      reject(new Error('Gagal membaca gambar logo. Pastikan file gambar tidak rusak.'));
    img.src = url;
  });
}

function encodeUtf8ToBase64(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let binary = '';
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

export async function processLogoFile(file: File): Promise<string> {
  if (!file) {
    throw new Error('File logo tidak ditemukan.');
  }

  const ext = (file.name.split('.').pop() || '').toLowerCase();
  const mime = (file.type || '').toLowerCase();

  const isSvg = mime === 'image/svg+xml' || ext === 'svg';
  const isPng = mime === 'image/png' || ext === 'png';
  const isJpeg = mime === 'image/jpeg' || mime === 'image/jpg' || ext === 'jpg' || ext === 'jpeg';
  const isWebp = mime === 'image/webp' || ext === 'webp';

  if (!isSvg && !isPng && !isJpeg && !isWebp) {
    throw new Error(
      'Format file tidak didukung. Gunakan file gambar PNG, JPG, WEBP, atau SVG.'
    );
  }

  if (file.size > MAX_RAW_LOGO_BYTES) {
    throw new Error(
      'Ukuran file logo terlalu besar (maksimal 2 MB sebelum diproses).'
    );
  }

  if (isSvg) {
    const rawSvg = await file.text();
    const cleanedSvg = DOMPurify.sanitize(rawSvg, {
      USE_PROFILES: { svg: true, svgFilters: true },
      FORBID_TAGS: ['script', 'foreignObject'],
    }).trim();

    if (!cleanedSvg || !cleanedSvg.toLowerCase().includes('<svg')) {
      throw new Error('File SVG tidak valid atau kosong.');
    }

    const dataUrl = `data:image/svg+xml;base64,${encodeUtf8ToBase64(cleanedSvg)}`;
    if (dataUrl.length >= MAX_ENCODED_LOGO_BYTES) {
      throw new Error(
        'Ukuran SVG melebihi batas 200 KB setelah dikompres. Sederhanakan file SVG atau ekspor sebagai PNG.'
      );
    }
    return dataUrl;
  }

  // Raster image processing (PNG / JPG / WEBP)
  const objectUrl = URL.createObjectURL(file);
  try {
    const img = await loadImageFromUrl(objectUrl);
    if (!img.width || !img.height) {
      throw new Error('Dimensi gambar logo tidak valid.');
    }

    const dimsToTry = [MAX_LOGO_DIMENSION, 384, 256, 192, 128];
    const preserveTransparency = isPng || isWebp;

    for (const maxDim of dimsToTry) {
      const ratio = Math.min(maxDim / img.width, maxDim / img.height, 1);
      const targetW = Math.max(1, Math.round(img.width * ratio));
      const targetH = Math.max(1, Math.round(img.height * ratio));

      const canvas = document.createElement('canvas');
      canvas.width = targetW;
      canvas.height = targetH;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        throw new Error('Browser tidak mendukung pemrosesan kanvas untuk mengompres logo.');
      }

      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';

      if (!preserveTransparency) {
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, targetW, targetH);
      } else {
        ctx.clearRect(0, 0, targetW, targetH);
      }

      ctx.drawImage(img, 0, 0, targetW, targetH);

      if (preserveTransparency) {
        // Prioritaskan PNG terlebih dahulu agar transparansi terjaga sempurna
        const pngData = canvas.toDataURL('image/png');
        if (pngData.length < MAX_ENCODED_LOGO_BYTES) {
          return pngData;
        }
        // Jika PNG masih >= 200 KB, coba WEBP transparan dengan kualitas menurun
        for (const q of [0.9, 0.82, 0.72]) {
          const webpData = canvas.toDataURL('image/webp', q);
          if (
            webpData.startsWith('data:image/webp') &&
            webpData.length < MAX_ENCODED_LOGO_BYTES
          ) {
            return webpData;
          }
        }
      } else {
        for (const q of [0.88, 0.8, 0.7, 0.6]) {
          const jpegData = canvas.toDataURL('image/jpeg', q);
          if (jpegData.length < MAX_ENCODED_LOGO_BYTES) {
            return jpegData;
          }
        }
      }
    }

    throw new Error(
      'Logo gagal dikompres di bawah 200 KB. Coba gunakan gambar dengan resolusi atau detail lebih ringan.'
    );
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}
