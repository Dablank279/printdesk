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

function escapeHtml(raw: string): string {
  return raw
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function parseRasterLogoDataUrl(dataUrl?: string): {
  mimeType: string;
  base64Data: string;
} | null {
  if (!dataUrl || dataUrl.length > 220000) return null;
  const match = /^data:(image\/(?:png|jpeg|jpg|webp));base64,([A-Za-z0-9+/=]+)$/.exec(
    dataUrl.trim()
  );
  if (!match) return null;
  return {
    mimeType: match[1] === 'image/jpg' ? 'image/jpeg' : match[1],
    base64Data: match[2],
  };
}

function buildEmailHtmlBody(
  bodyText: string,
  branding?: ShopEmailBranding,
  hasCidLogo?: boolean
): string {
  const shopName = branding?.shopName?.trim() || 'PrintDesk';
  const contactParts = [branding?.shopAddress?.trim(), branding?.shopPhone?.trim()].filter(
    Boolean
  );
  const contactLine = contactParts.join(' · ');
  const formattedBody = escapeHtml(bodyText).replace(/\r?\n/g, '<br/>');

  const logoCell = hasCidLogo
    ? `<td style="padding-right:12px;vertical-align:middle;width:52px;">
         <img src="cid:shop-logo" alt="${escapeHtml(shopName)}" width="44" height="44" style="display:block;width:44px;height:44px;object-fit:contain;border-radius:8px;background:#ffffff;border:1px solid #e2e8f0;padding:3px;" />
       </td>`
    : '';

  return `<!DOCTYPE html>
<html lang="id">
<head><meta charset="UTF-8" /></head>
<body style="margin:0;padding:16px;background-color:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#0f172a;">
  <div style="max-width:640px;margin:0 auto;background:#ffffff;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden;">
    <div style="padding:16px 20px;background:#0f172a;color:#ffffff;">
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="width:100%;">
        <tr>
          ${logoCell}
          <td style="vertical-align:middle;">
            <div style="font-size:16px;font-weight:700;line-height:1.3;color:#ffffff;">${escapeHtml(shopName)}</div>
            ${contactLine ? `<div style="font-size:12px;line-height:1.4;color:#cbd5e1;margin-top:2px;">${escapeHtml(contactLine)}</div>` : ''}
          </td>
        </tr>
      </table>
    </div>
    <div style="padding:20px;font-size:14px;line-height:1.65;color:#1e293b;">
      ${formattedBody}
    </div>
  </div>
</body>
</html>`;
}

export interface ShopEmailBranding {
  shopName?: string;
  shopAddress?: string;
  shopPhone?: string;
  logoDataUrl?: string;
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
  shopBranding?: ShopEmailBranding;
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
    shopBranding,
  } = params;

  if (!accessToken) {
    throw new Error(
      'Izin Gmail belum aktif atau sesi Google telah berakhir. Klik "Hubungkan Akun Google" lalu coba kirim ulang.'
    );
  }
  if (recipients.length === 0) {
    throw new Error('Minimal satu alamat email tujuan harus diisi.');
  }

  const ts = `${Date.now()}_${Math.random().toString(36).slice(2)}`;
  const mixedBoundary = `printdesk_mixed_${ts}`;
  const relatedBoundary = `printdesk_related_${ts}`;
  const altBoundary = `printdesk_alt_${ts}`;

  const safeSubject = encodeUtf8Header(subject);
  const toHeader = recipients.join(', ');
  const inlineLogo = parseRasterLogoDataUrl(shopBranding?.logoDataUrl);
  const htmlBody = buildEmailHtmlBody(bodyText, shopBranding, Boolean(inlineLogo));

  const buildAlternativeLines = (): string[] => {
    const plainBytes = new TextEncoder().encode(bodyText);
    const htmlBytes = new TextEncoder().encode(htmlBody);
    return [
      `Content-Type: multipart/alternative; boundary="${altBoundary}"`,
      '',
      `--${altBoundary}`,
      'Content-Type: text/plain; charset="UTF-8"',
      'Content-Transfer-Encoding: base64',
      '',
      wrapBase64(uint8ToBase64(plainBytes)),
      '',
      `--${altBoundary}`,
      'Content-Type: text/html; charset="UTF-8"',
      'Content-Transfer-Encoding: base64',
      '',
      wrapBase64(uint8ToBase64(htmlBytes)),
      '',
      `--${altBoundary}--`,
    ];
  };

  const buildBodyBlock = (): string[] => {
    const altLines = buildAlternativeLines();
    if (!inlineLogo) {
      return altLines;
    }
    const ext = inlineLogo.mimeType === 'image/jpeg' ? 'jpg' : inlineLogo.mimeType.split('/')[1];
    return [
      `Content-Type: multipart/related; boundary="${relatedBoundary}"`,
      '',
      `--${relatedBoundary}`,
      ...altLines,
      '',
      `--${relatedBoundary}`,
      `Content-Type: ${inlineLogo.mimeType}; name="logo.${ext}"`,
      'Content-Transfer-Encoding: base64',
      'Content-ID: <shop-logo>',
      `Content-Disposition: inline; filename="logo.${ext}"`,
      '',
      wrapBase64(inlineLogo.base64Data),
      '',
      `--${relatedBoundary}--`,
    ];
  };

  const parts: string[] = [];
  parts.push(`To: ${toHeader}`);
  if (cc.length > 0) {
    parts.push(`Cc: ${cc.join(', ')}`);
  }
  parts.push(`Subject: ${safeSubject}`);
  parts.push('MIME-Version: 1.0');

  if (attachments.length === 0) {
    parts.push(...buildBodyBlock());
  } else {
    parts.push(`Content-Type: multipart/mixed; boundary="${mixedBoundary}"`);
    parts.push('');
    parts.push(`--${mixedBoundary}`);
    parts.push(...buildBodyBlock());
    parts.push('');

    for (const att of attachments) {
      const arrayBuf = await att.blob.arrayBuffer();
      const fileBytes = new Uint8Array(arrayBuf);
      const safeName = att.name.replace(/"/g, '');
      const mime = att.mimeType || 'application/octet-stream';
      parts.push(`--${mixedBoundary}`);
      parts.push(`Content-Type: ${mime}; name="${safeName}"`);
      parts.push('Content-Transfer-Encoding: base64');
      parts.push(`Content-Disposition: attachment; filename="${safeName}"`);
      parts.push('');
      parts.push(wrapBase64(uint8ToBase64(fileBytes)));
      parts.push('');
    }
    parts.push(`--${mixedBoundary}--`);
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
