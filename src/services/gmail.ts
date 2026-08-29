import { Alert, Doctor, MedicationSchedule } from '../types';

export interface GmailMessageItem {
  id: string;
  threadId: string;
  snippet: string;
  subject: string;
  from: string;
  to: string;
  date: string;
  isImportant?: boolean;
}

export interface SendEmailPayload {
  to: string;
  subject: string;
  bodyHtml: string;
  bodyText?: string;
  cc?: string;
  bcc?: string;
}

/**
 * Encodes string to RFC 4648 Base64URL without padding (Gmail API standard)
 */
function base64UrlEncode(str: string): string {
  // UTF-8 encode string properly
  const utf8Bytes = new TextEncoder().encode(str);
  let binary = '';
  for (let i = 0; i < utf8Bytes.length; i++) {
    binary += String.fromCharCode(utf8Bytes[i]);
  }
  return btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

/**
 * Creates RFC 2822 compliant email string
 */
function createRawEmail(payload: SendEmailPayload): string {
  const boundary = `----=_Part_${Date.now()}_${Math.random().toString(36).substring(2)}`;
  
  const headers = [
    `To: ${payload.to}`,
    payload.cc ? `Cc: ${payload.cc}` : null,
    payload.bcc ? `Bcc: ${payload.bcc}` : null,
    `Subject: =?UTF-8?B?${btoa(unescape(encodeURIComponent(payload.subject)))}?=`,
    'MIME-Version: 1.0',
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
  ].filter(Boolean).join('\r\n');

  const textBody = payload.bodyText || payload.bodyHtml.replace(/<[^>]+>/g, ' ');

  const body = [
    `--${boundary}`,
    'Content-Type: text/plain; charset=UTF-8',
    'Content-Transfer-Encoding: 7bit',
    '',
    textBody,
    `--${boundary}`,
    'Content-Type: text/html; charset=UTF-8',
    'Content-Transfer-Encoding: 7bit',
    '',
    payload.bodyHtml,
    `--${boundary}--`,
  ].join('\r\n');

  return `${headers}\r\n\r\n${body}`;
}

/**
 * Send an email using the Gmail REST API (users.messages.send)
 */
export async function sendGmailMessage(
  accessToken: string,
  payload: SendEmailPayload
): Promise<{ id: string; threadId: string }> {
  const rawEmail = createRawEmail(payload);
  const encodedRaw = base64UrlEncode(rawEmail);

  const response = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      raw: encodedRaw,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Lỗi gửi Gmail (${response.status}): ${errorText}`);
  }

  return response.json();
}

/**
 * Send Critical Red Alert Dispatch Email
 */
export async function sendEmergencyRedAlertEmail(
  accessToken: string,
  doctorEmail: string,
  alert: Alert,
  doctorName?: string
): Promise<{ id: string; threadId: string }> {
  const isFatal = alert.severity === 'Fatal';
  const severityBadge = isFatal ? '🚨 [TỬ VONG / NGUY KỊCH TỐI KHẨN]' : '🔴 [BÁO ĐỘNG ĐỎ CẤP CỨU]';
  const subject = `${severityBadge} PHÒNG ${alert.roomNumber} - BN ${alert.patientName}`;

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; margin: 0; padding: 20px; color: #1e293b; }
    .card { max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 10px 25px rgba(220, 38, 38, 0.15); border: 2px solid #ef4444; }
    .header { background: linear-gradient(135deg, #dc2626, #991b1b); color: #ffffff; padding: 24px; text-align: center; }
    .content { padding: 24px; line-height: 1.6; }
    .vital-grid { display: flex; gap: 12px; margin: 20px 0; background: #fef2f2; border: 1px solid #fecaca; border-radius: 12px; padding: 16px; }
    .vital-box { flex: 1; text-align: center; }
    .vital-val { font-size: 24px; font-weight: 800; color: #dc2626; }
    .vital-lbl { font-size: 11px; text-transform: uppercase; color: #991b1b; font-weight: 600; }
    .detail-row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #f1f5f9; font-size: 14px; }
    .label { color: #64748b; font-weight: 500; }
    .value { color: #0f172a; font-weight: 700; }
    .alert-box { background: #fee2e2; border-left: 4px solid #ef4444; padding: 12px 16px; border-radius: 8px; margin: 16px 0; color: #991b1b; font-weight: 600; font-size: 14px; }
    .footer { background: #f8fafc; padding: 16px 24px; text-align: center; font-size: 12px; color: #64748b; border-top: 1px solid #e2e8f0; }
  </style>
</head>
<body>
  <div class="card">
    <div class="header">
      <h1 style="margin: 0; font-size: 22px; text-transform: uppercase; letter-spacing: 1px;">🚨 LỆNH ĐIỀU ĐỘNG CẤP CỨU ICU</h1>
      <p style="margin: 6px 0 0 0; opacity: 0.9; font-size: 13px;">Hệ Thống Giám Sát Sinh Tồn Bệnh Viện Tự Động</p>
    </div>
    <div class="content">
      <p>Kính gửi Bác sĩ: <strong>${doctorName || 'Bác sĩ trực cấp cứu'}</strong>,</p>
      <div class="alert-box">
        ⚠️ Phát hiện bất thường sinh tồn nghiêm trọng vượt ngưỡng an toàn lâm sàng!
      </div>

      <div class="vital-grid">
        <div class="vital-box">
          <div class="vital-val">${alert.heartRate}</div>
          <div class="vital-lbl">Nhịp Tim (BPM)</div>
        </div>
        ${alert.spO2 ? `
        <div class="vital-box">
          <div class="vital-val">${alert.spO2}%</div>
          <div class="vital-lbl">SpO2</div>
        </div>` : ''}
        <div class="vital-box">
          <div class="vital-val">${alert.severity}</div>
          <div class="vital-lbl">Mức Độ</div>
        </div>
      </div>

      <div class="detail-row">
        <span class="label">Bệnh nhân:</span>
        <span class="value">${alert.patientName} (Mã: ${alert.patientId})</span>
      </div>
      <div class="detail-row">
        <span class="label">Vị trí phòng bệnh:</span>
        <span class="value">Phòng ${alert.roomNumber} - Khoa ICU</span>
      </div>
      <div class="detail-row">
        <span class="label">Lý do báo động:</span>
        <span class="value" style="color: #dc2626;">${alert.reason}</span>
      </div>
      <div class="detail-row">
        <span class="label">Thời điểm phát hiện:</span>
        <span class="value">${new Date(alert.createdAt).toLocaleString('vi-VN')}</span>
      </div>
      ${alert.escalatedToBackup ? `
      <div class="detail-row">
        <span class="label">Tình trạng chuyển tuyến:</span>
        <span class="value" style="color: #b91c1c;">⚠️ Đã chuyển tiếp bác sĩ dự phòng do quá hạn phản hồi</span>
      </div>` : ''}

      <p style="margin-top: 20px; font-size: 13px; color: #475569;">
        👉 <em>Yêu cầu Bác sĩ và Điều dưỡng trực khẩn trương tiếp cận buồng bệnh và kích hoạt quy trình cấp cứu ngay lập tức.</em>
      </p>
    </div>
    <div class="footer">
      Email được phát tự động từ Hệ thống Cảnh Báo Khẩn Cấp Bệnh Viện ICU Realtime.<br>
      Vui lòng không trả lời trực tiếp email tự động này.
    </div>
  </div>
</body>
</html>
  `;

  return sendGmailMessage(accessToken, {
    to: doctorEmail,
    subject,
    bodyHtml: html,
  });
}

/**
 * Send Patient Prescription & Medication Schedule Summary Email
 */
export async function sendMedicationPrescriptionEmail(
  accessToken: string,
  recipientEmail: string,
  patientName: string,
  roomNumber: string,
  medications: MedicationSchedule[],
  doctorName?: string
): Promise<{ id: string; threadId: string }> {
  const subject = `💊 [LỊCH DÙNG THUỐC ICU] Bệnh nhân: ${patientName} - Phòng ${roomNumber}`;

  const medRows = medications
    .map(
      (m, idx) => `
      <tr style="border-bottom: 1px solid #e2e8f0; background: ${idx % 2 === 0 ? '#ffffff' : '#f8fafc'};">
        <td style="padding: 10px; font-weight: 600;">${m.medicationName}</td>
        <td style="padding: 10px;">${m.dosage}</td>
        <td style="padding: 10px;">${m.route}</td>
        <td style="padding: 10px; font-weight: 700; color: #2563eb;">${m.scheduledTime}</td>
        <td style="padding: 10px;">${m.frequency}</td>
        <td style="padding: 10px; font-size: 12px; color: #64748b;">${m.instructions || '-'}</td>
      </tr>
    `
    )
    .join('');

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f8fafc; padding: 20px; color: #1e293b; }
    .card { max-width: 650px; margin: 0 auto; background: #ffffff; border-radius: 16px; overflow: hidden; border: 1px solid #cbd5e1; }
    .header { background: #0f766e; color: #ffffff; padding: 20px; text-align: center; }
    .content { padding: 24px; }
    table { width: 100%; border-collapse: collapse; margin: 16px 0; font-size: 13px; }
    th { background: #f1f5f9; padding: 10px; text-align: left; font-weight: 700; color: #334155; }
    .footer { background: #f8fafc; padding: 14px; text-align: center; font-size: 11px; color: #64748b; }
  </style>
</head>
<body>
  <div class="card">
    <div class="header">
      <h2 style="margin:0;">📋 DANH MỤC Y LỆNH & LỊCH DÙNG THUỐC BỆNH NHÂN</h2>
      <p style="margin: 4px 0 0 0; opacity: 0.9; font-size: 13px;">Khoa Hồi Sức Cấp Cứu ICU</p>
    </div>
    <div class="content">
      <p><strong>Bệnh nhân:</strong> ${patientName} &nbsp;|&nbsp; <strong>Vị trí:</strong> Phòng ${roomNumber}</p>
      <p><strong>Bác sĩ chỉ định:</strong> ${doctorName || 'Bác sĩ điều trị'} &nbsp;|&nbsp; <strong>Ngày áp dụng:</strong> ${new Date().toLocaleDateString('vi-VN')}</p>

      <table>
        <thead>
          <tr>
            <th>Tên Thuốc</th>
            <th>Liều Lượng</th>
            <th>Đường Dùng</th>
            <th>Giờ Dùng</th>
            <th>Tần Suất</th>
            <th>Lưu Ý</th>
          </tr>
        </thead>
        <tbody>
          ${medRows}
        </tbody>
      </table>

      <p style="font-size: 13px; color: #b91c1c; font-weight: 600;">
        ⚠️ Đề nghị điều dưỡng thực hiện đối chiếu 5 đúng và ghi nhận chỉ số sinh tồn trước khi tiêm/truyền.
      </p>
    </div>
    <div class="footer">
      Đồng bộ từ Hệ Thống Y Tế ICU Hospital System
    </div>
  </div>
</body>
</html>
  `;

  return sendGmailMessage(accessToken, {
    to: recipientEmail,
    subject,
    bodyHtml: html,
  });
}

/**
 * List recent emails from Gmail (sent or inbox for hospital)
 */
export async function listRecentGmailMessages(
  accessToken: string,
  query: string = 'subject:ICU OR subject:CẤP CỨU OR subject:BÁO ĐỘNG',
  maxResults: number = 10
): Promise<GmailMessageItem[]> {
  const url = `https://gmail.googleapis.com/gmail/v1/users/me/messages?q=${encodeURIComponent(query)}&maxResults=${maxResults}`;
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Lỗi tải danh sách Gmail (${response.status}): ${errorText}`);
  }

  const data = await response.json();
  const messages: { id: string; threadId: string }[] = data.messages || [];

  if (messages.length === 0) {
    return [];
  }

  // Fetch header snippets for each message in parallel
  const details = await Promise.all(
    messages.slice(0, 10).map(async (msg) => {
      try {
        const detailUrl = `https://gmail.googleapis.com/gmail/v1/users/me/messages/${msg.id}?format=metadata&metadataHeaders=Subject&metadataHeaders=From&metadataHeaders=To&metadataHeaders=Date`;
        const res = await fetch(detailUrl, {
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        if (!res.ok) return null;
        const msgData = await res.json();

        const headers = msgData.payload?.headers || [];
        const getHeader = (name: string) => headers.find((h: any) => h.name.toLowerCase() === name.toLowerCase())?.value || '';

        return {
          id: msgData.id,
          threadId: msgData.threadId,
          snippet: msgData.snippet || '',
          subject: getHeader('Subject') || '(Không có tiêu đề)',
          from: getHeader('From') || '',
          to: getHeader('To') || '',
          date: getHeader('Date') || '',
          isImportant: (msgData.labelIds || []).includes('IMPORTANT') || getHeader('Subject').includes('BÁO ĐỘNG') || getHeader('Subject').includes('CẤP CỨU'),
        };
      } catch {
        return null;
      }
    })
  );

  return details.filter(Boolean) as GmailMessageItem[];
}

/**
 * Trash an email (Requires explicit user confirmation per workspace guidelines)
 */
export async function trashGmailMessage(
  accessToken: string,
  messageId: string
): Promise<void> {
  const url = `https://gmail.googleapis.com/gmail/v1/users/me/messages/${messageId}/trash`;
  const response = await fetch(url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Lỗi chuyển thư vào thùng rác (${response.status}): ${errorText}`);
  }
}
