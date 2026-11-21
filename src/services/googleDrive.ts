const DRIVE_API_BASE = 'https://www.googleapis.com/drive/v3';
const DRIVE_UPLOAD_BASE = 'https://www.googleapis.com/upload/drive/v3';

export interface DriveUploadResult {
  id: string;
  name: string;
  mimeType: string;
  size: number;
  webViewLink: string;
  webContentLink?: string;
  folderPath: string;
}

function sanitizeFolderName(name: string, fallback: string): string {
  const cleaned = name
    .replace(/[/\\<>:"|?*]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return cleaned.slice(0, 80) || fallback;
}

function escapeDriveQueryValue(val: string): string {
  return val.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

function translateDriveError(status: number, rawMessage?: string): string {
  if (status === 401) {
    return 'Sesi akses Google Drive telah kedaluwarsa. Klik "Hubungkan Ulang Google" lalu coba lagi.';
  }
  if (status === 403) {
    if (rawMessage?.toLowerCase().includes('storage')) {
      return 'Kapasitas Google Drive Anda penuh atau kuota terlampaui.';
    }
    return 'Izin Google Drive (drive.file) belum diberikan atau ditolak. Silakan login ulang dan centang izin Google Drive.';
  }
  if (status === 404) {
    return 'File atau folder tidak ditemukan di Google Drive.';
  }
  return rawMessage || `Gagal terhubung ke Google Drive (HTTP ${status}).`;
}

async function findOrCreateFolder(
  accessToken: string,
  folderName: string,
  parentId?: string
): Promise<string> {
  const safeName = escapeDriveQueryValue(folderName);
  const parentClause = parentId ? ` and '${escapeDriveQueryValue(parentId)}' in parents` : '';
  const query = `name = '${safeName}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false${parentClause}`;

  const searchRes = await fetch(
    `${DRIVE_API_BASE}/files?q=${encodeURIComponent(query)}&fields=files(id,name)&spaces=drive`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    }
  );

  if (!searchRes.ok) {
    const errBody = await searchRes.json().catch(() => ({}));
    throw new Error(
      translateDriveError(searchRes.status, errBody?.error?.message)
    );
  }

  const searchData = (await searchRes.json()) as { files?: Array<{ id: string; name: string }> };
  if (searchData.files && searchData.files.length > 0) {
    return searchData.files[0].id;
  }

  const metadata: Record<string, unknown> = {
    name: folderName,
    mimeType: 'application/vnd.google-apps.folder',
  };
  if (parentId) {
    metadata.parents = [parentId];
  }

  const createRes = await fetch(`${DRIVE_API_BASE}/files?fields=id,name`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(metadata),
  });

  if (!createRes.ok) {
    const errBody = await createRes.json().catch(() => ({}));
    throw new Error(
      translateDriveError(createRes.status, errBody?.error?.message)
    );
  }

  const created = (await createRes.json()) as { id: string };
  return created.id;
}

export async function ensureOrderDriveFolder(
  accessToken: string,
  rootFolderName: string,
  clientName: string,
  orderCode: string
): Promise<{ folderId: string; folderPath: string }> {
  const rootSafe = sanitizeFolderName(rootFolderName, 'PrintDesk');
  const clientSafe = sanitizeFolderName(clientName, 'Client Umum');
  const orderSafe = sanitizeFolderName(orderCode, 'Order');

  const rootId = await findOrCreateFolder(accessToken, rootSafe);
  const clientId = await findOrCreateFolder(accessToken, clientSafe, rootId);
  const orderFolderId = await findOrCreateFolder(accessToken, orderSafe, clientId);

  return {
    folderId: orderFolderId,
    folderPath: `${rootSafe}/${clientSafe}/${orderSafe}`,
  };
}

export async function uploadFileToDrive(
  accessToken: string,
  file: File,
  rootFolderName: string,
  clientName: string,
  orderCode: string,
  onProgress?: (percent: number) => void
): Promise<DriveUploadResult> {
  if (!accessToken) {
    throw new Error(
      'Akun Google belum terhubung atau izin Google Drive belum aktif. Silakan masuk dengan Google terlebih dahulu.'
    );
  }

  if (onProgress) onProgress(5);
  const { folderId, folderPath } = await ensureOrderDriveFolder(
    accessToken,
    rootFolderName,
    clientName,
    orderCode
  );
  if (onProgress) onProgress(15);

  const metadata = {
    name: file.name,
    parents: [folderId],
    mimeType: file.type || 'application/octet-stream',
  };

  const boundary = `printdesk_boundary_${Date.now()}_${Math.random().toString(36).slice(2)}`;
  const metadataPart =
    `--${boundary}\r\n` +
    `Content-Type: application/json; charset=UTF-8\r\n\r\n` +
    `${JSON.stringify(metadata)}\r\n` +
    `--${boundary}\r\n` +
    `Content-Type: ${file.type || 'application/octet-stream'}\r\n\r\n`;
  const closingPart = `\r\n--${boundary}--`;

  const multipartBody = new Blob([metadataPart, file, closingPart], {
    type: `multipart/related; boundary=${boundary}`,
  });

  return new Promise<DriveUploadResult>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open(
      'POST',
      `${DRIVE_UPLOAD_BASE}/files?uploadType=multipart&fields=id,name,mimeType,size,webViewLink,webContentLink`
    );
    xhr.setRequestHeader('Authorization', `Bearer ${accessToken}`);
    xhr.setRequestHeader('Content-Type', `multipart/related; boundary=${boundary}`);

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable && onProgress) {
        const pct = Math.min(98, Math.round(15 + (event.loaded / event.total) * 83));
        onProgress(pct);
      }
    };

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const data = JSON.parse(xhr.responseText);
          if (onProgress) onProgress(100);
          resolve({
            id: data.id,
            name: data.name || file.name,
            mimeType: data.mimeType || file.type || 'application/octet-stream',
            size: Number(data.size) || file.size,
            webViewLink:
              data.webViewLink ||
              `https://drive.google.com/file/d/${data.id}/view`,
            webContentLink: data.webContentLink,
            folderPath,
          });
        } catch {
          reject(new Error('Respons upload Google Drive tidak valid.'));
        }
      } else {
        let errMsg = '';
        try {
          const parsed = JSON.parse(xhr.responseText);
          errMsg = parsed?.error?.message || '';
        } catch {
          errMsg = '';
        }
        reject(new Error(translateDriveError(xhr.status, errMsg)));
      }
    };

    xhr.onerror = () => {
      reject(
        new Error(
          'Koneksi jaringan terputus saat mengunggah ke Google Drive. Periksa internet Anda dan coba lagi.'
        )
      );
    };

    xhr.send(multipartBody);
  });
}

export async function fetchDriveFileBlob(
  accessToken: string,
  driveFileId: string
): Promise<Blob> {
  if (!accessToken) {
    throw new Error('Token Google belum tersedia. Hubungkan akun Google terlebih dahulu.');
  }

  const res = await fetch(`${DRIVE_API_BASE}/files/${encodeURIComponent(driveFileId)}?alt=media`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!res.ok) {
    const errBody = await res.json().catch(() => ({}));
    throw new Error(translateDriveError(res.status, errBody?.error?.message));
  }

  return res.blob();
}

export async function deleteDriveFile(
  accessToken: string,
  driveFileId: string
): Promise<void> {
  if (!accessToken) {
    throw new Error('Token Google belum tersedia untuk menghapus file di Google Drive.');
  }

  const res = await fetch(`${DRIVE_API_BASE}/files/${encodeURIComponent(driveFileId)}`, {
    method: 'DELETE',
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!res.ok && res.status !== 404) {
    const errBody = await res.json().catch(() => ({}));
    throw new Error(translateDriveError(res.status, errBody?.error?.message));
  }
}
