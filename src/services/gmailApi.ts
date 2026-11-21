const GMAIL_SEND_ENDPOINT = 'https://gmail.googleapis.com/gmail/v1/users/me/messages/send';

export function isValidEmailFormat(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

export function parseEmailRecipients(input: string): {
  valid: string[];
  invalid: string[];
} {
  const parts = input
    .split(/[,;\n]+/)
    .map((s) => s.trim())
    .filter(Boolean);

  const valid: string[] = [];
  const invalid: string[] = [];

  for (const part of parts) {
    if (isValidEmailFormat(part)) {
      if (!valid.includes(part)) valid.push(part);
    } else {
      invalid.push(part);
    }
  }
  return { valid, invalid };
}

function uint8ToBase64(bytes: Uint8Array): string {
  let binary = '';
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode(...chunk);
  }
  return btoa(binary);
}

function toBase64Url(strBytes: Uint8Array): string {
  return uint8ToBase64(strBytes)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

function encodeUtf8Header(text: string): string {
  const bytes = new TextEncoder().encode(text);
  return `=?UTF-8?B?${uint8ToBase64(bytes)}?=`;
}

function wrapBase64(b64: string, lineLength = 76): string {
  const lines: string[] = [];
  for (let i = 0; i < b64.length; i += lineLength) {
    lines.push(b64.slice(i, i + lineLength));
  }
  return lines.join('\r\n');
}

export interface EmailAttachmentPayload {
  name: string;
  mimeType: string;
  blob: Blob;
}

export interface SendGmailParams {
  accessToken: string;
  recipients: string[];
  cc?: string[];
  subject: string;
  bodyText: string;
  attachments?: EmailAttachmentPayload[];
}

export async function sendOrderEmailViaGmail(
  params: SendGmailParams
): Promise<{ messageId: string }> {
  const {
    accessToken,
    recipients,
    cc = [],
    subject,
    bodyText,
    attachments = [],
  } = params;

  if (!accessToken) {
    throw new Error(
      'Izin Gmail belum aktif atau sesi Google telah berakhir. Klik "Hubungkan Akun Google" lalu coba kirim ulang.'
    );
  }
  if (recipients.length === 0) {
    throw new Error('Minimal satu alamat email tujuan harus diisi.');
  }

  const boundary = `printdesk_mime_${Date.now()}_${Math.random().toString(36).slice(2)}`;
  const safeSubject = encodeUtf8Header(subject);
  const toHeader = recipients.join(', ');

  const parts: string[] = [];
  parts.push(`To: ${toHeader}`);
  if (cc.length > 0) {
    parts.push(`Cc: ${cc.join(', ')}`);
  }
  parts.push(`Subject: ${safeSubject}`);
  parts.push('MIME-Version: 1.0');

  if (attachments.length === 0) {
    parts.push('Content-Type: text/plain; charset="UTF-8"');
    parts.push('Content-Transfer-Encoding: base64');
    parts.push('');
    const bodyBytes = new TextEncoder().encode(bodyText);
    parts.push(wrapBase64(uint8ToBase64(bodyBytes)));
  } else {
    parts.push(`Content-Type: multipart/mixed; boundary="${boundary}"`);
    parts.push('');
    parts.push(`--${boundary}`);
    parts.push('Content-Type: text/plain; charset="UTF-8"');
    parts.push('Content-Transfer-Encoding: base64');
    parts.push('');
    const bodyBytes = new TextEncoder().encode(bodyText);
    parts.push(wrapBase64(uint8ToBase64(bodyBytes)));
    parts.push('');

    for (const att of attachments) {
      const arrayBuf = await att.blob.arrayBuffer();
      const fileBytes = new Uint8Array(arrayBuf);
      const safeName = att.name.replace(/"/g, '');
      const mime = att.mimeType || 'application/octet-stream';
      parts.push(`--${boundary}`);
      parts.push(`Content-Type: ${mime}; name="${safeName}"`);
      parts.push('Content-Transfer-Encoding: base64');
      parts.push(`Content-Disposition: attachment; filename="${safeName}"`);
      parts.push('');
      parts.push(wrapBase64(uint8ToBase64(fileBytes)));
      parts.push('');
    }
    parts.push(`--${boundary}--`);
  }

  const rawMimeString = parts.join('\r\n');
  const rawBytes = new TextEncoder().encode(rawMimeString);
  const encodedRaw = toBase64Url(rawBytes);

  const response = await fetch(GMAIL_SEND_ENDPOINT, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ raw: encodedRaw }),
  });

  if (!response.ok) {
    const errBody = await response.json().catch(() => ({}));
    if (response.status === 401) {
      throw new Error(
        'Sesi login Google kedaluwarsa. Hubungkan ulang akun Google Anda lalu coba kirim email lagi.'
      );
    }
    if (response.status === 403) {
      throw new Error(
        'Izin mengirim email (gmail.send) belum diberikan. Pastikan Anda mencentang izin Gmail saat login Google.'
      );
    }
    if (response.status === 413) {
      throw new Error(
        'Ukuran total lampiran melebihi batas maksimum Gmail. Silakan pilih opsi kirim Link Google Drive.'
      );
    }
    throw new Error(
      errBody?.error?.message || `Gagal mengirim email melalui Gmail API (HTTP ${response.status}).`
    );
  }

  const data = (await response.json()) as { id: string };
  return { messageId: data.id };
}
