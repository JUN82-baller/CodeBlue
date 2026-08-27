import { MedicationSchedule } from '../types';

declare global {
  interface Window {
    google?: {
      accounts: {
        oauth2: {
          initTokenClient: (config: {
            client_id: string;
            scope: string;
            callback: (response: { access_token?: string; error?: string }) => void;
            error_callback?: (err: any) => void;
          }) => {
            requestAccessToken: (options?: { prompt?: string }) => void;
          };
        };
      };
    };
  }
}

// Global cached access token
let cachedAccessToken: string | null = null;
let tokenExpiresAt = 0;

export function getCachedCalendarToken(): string | null {
  if (cachedAccessToken && Date.now() < tokenExpiresAt) {
    return cachedAccessToken;
  }
  return null;
}

export function setCachedCalendarToken(token: string, expiresInSeconds: number = 3600) {
  cachedAccessToken = token;
  tokenExpiresAt = Date.now() + (expiresInSeconds - 60) * 1000;
}

export function clearCalendarToken() {
  cachedAccessToken = null;
  tokenExpiresAt = 0;
}

/**
 * Loads the Google Identity Services (GIS) script dynamically if not present
 */
export function loadGsiScript(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (window.google?.accounts?.oauth2) {
      resolve();
      return;
    }

    const existingScript = document.querySelector('script[src="https://accounts.google.com/gsi/client"]');
    if (existingScript) {
      existingScript.addEventListener('load', () => resolve());
      existingScript.addEventListener('error', (e) => reject(e));
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = (e) => reject(new Error('Failed to load Google GSI script'));
    document.head.appendChild(script);
  });
}

/**
 * Fetch Google Client ID from backend or fallback
 */
export async function getGoogleClientId(): Promise<string> {
  try {
    const res = await fetch('/api/google-calendar/auth-info');
    if (res.ok) {
      const data = await res.json();
      if (data.clientId) return data.clientId;
    }
  } catch (err) {
    console.warn('Could not fetch server google client id', err);
  }
  return '';
}

/**
 * Request Access Token via GIS popup
 */
export async function requestGoogleCalendarAccessToken(clientId?: string): Promise<string> {
  await loadGsiScript();

  const activeClientId = clientId || (await getGoogleClientId());

  if (!activeClientId) {
    throw new Error('Chưa cấu hình Google Client ID cho Google Calendar.');
  }

  return new Promise((resolve, reject) => {
    try {
      const client = window.google!.accounts.oauth2.initTokenClient({
        client_id: activeClientId,
        scope: 'https://www.googleapis.com/auth/calendar.events https://www.googleapis.com/auth/calendar',
        callback: (tokenResponse) => {
          if (tokenResponse.error) {
            reject(new Error(tokenResponse.error));
            return;
          }
          if (tokenResponse.access_token) {
            setCachedCalendarToken(tokenResponse.access_token);
            resolve(tokenResponse.access_token);
          } else {
            reject(new Error('Không nhận được Access Token từ Google.'));
          }
        },
        error_callback: (err) => {
          reject(err);
        },
      });

      client.requestAccessToken({ prompt: '' });
    } catch (err) {
      reject(err);
    }
  });
}

/**
 * Build ISO start/end strings for a scheduled medication event
 */
function buildMedicationEventTimes(medication: MedicationSchedule): { startDateTime: string; endDateTime: string } {
  const dateStr = medication.scheduledDate || new Date().toISOString().split('T')[0];
  const timeStr = medication.scheduledTime || '08:00';

  const [hours, minutes] = timeStr.split(':').map((n) => parseInt(n, 10) || 0);

  const startDate = new Date(dateStr);
  startDate.setHours(hours, minutes, 0, 0);

  const endDate = new Date(startDate.getTime() + 30 * 60 * 1000); // 30 mins duration

  return {
    startDateTime: startDate.toISOString(),
    endDateTime: endDate.toISOString(),
  };
}

/**
 * Create an event on Google Calendar for a patient medication schedule
 */
export async function createGoogleCalendarMedicationEvent(
  accessToken: string,
  medication: MedicationSchedule,
  attendeeEmails: string[] = []
): Promise<{ id: string; htmlLink?: string }> {
  const { startDateTime, endDateTime } = buildMedicationEventTimes(medication);

  const attendeesList = attendeeEmails
    .filter((e) => e && e.includes('@'))
    .map((email) => ({ email }));

  const eventPayload = {
    summary: `💊 [Y TẾ ICU] Cho thuốc BN: ${medication.patientName} (${medication.roomNumber} - Giường ${medication.bed})`,
    location: `Khoa Hồi Sức Cấp Cứu ICU - Phòng ${medication.roomNumber} (Giường ${medication.bed})`,
    description: `🏥 LỊCH TIẾP NHẬN & CHO THUỐC BỆNH NHÂN
--------------------------------------------------
👤 Bệnh nhân: ${medication.patientName} (ID: ${medication.patientId})
🚪 Phòng: ${medication.roomNumber} - Giường: ${medication.bed}
💊 Thuốc: ${medication.medicationName}
📏 Liều lượng: ${medication.dosage}
💉 Đường dùng: ${medication.route}
⏰ Giờ chỉ định: ${medication.scheduledTime} (${medication.frequency})
👨‍⚕️ Bác sĩ chỉ định: ${medication.prescribedByDoctorName}
👩‍⚕️ Điều dưỡng phụ trách: ${medication.assignedNurseName || 'Trực ca Điều dưỡng'}
⚠️ Hướng dẫn lưu ý: ${medication.instructions || 'Tuân thủ nghiêm ngặt 5 đúng'}
${medication.preVitalsRequired ? '🔴 LƯU Ý: Yêu cầu kiểm tra Mạch/Huyết áp trước khi cho bệnh nhân dùng!' : ''}
--------------------------------------------------
Được đồng bộ tự động từ Hệ Thống Cảnh Báo Khẩn Cấp Bệnh Viện ICU`,
    start: {
      dateTime: startDateTime,
      timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Ho_Chi_Minh',
    },
    end: {
      dateTime: endDateTime,
      timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Ho_Chi_Minh',
    },
    colorId: '11', // Red color on Google Calendar for high priority medical dose
    reminders: {
      useDefault: false,
      overrides: [
        { method: 'popup', minutes: 15 },
        { method: 'popup', minutes: 5 },
        { method: 'popup', minutes: 0 },
      ],
    },
    attendees: attendeesList.length > 0 ? attendeesList : undefined,
  };

  const response = await fetch('https://www.googleapis.com/calendar/v3/calendars/primary/events', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(eventPayload),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Lỗi Google Calendar API (${response.status}): ${errorText}`);
  }

  const data = await response.json();
  return {
    id: data.id,
    htmlLink: data.htmlLink,
  };
}

/**
 * Generate direct Google Calendar URL (1-click add to personal/work calendar without OAuth)
 */
export function generateDirectGoogleCalendarUrl(medication: MedicationSchedule): string {
  const { startDateTime, endDateTime } = buildMedicationEventTimes(medication);

  // Format YYYYMMDDTHHmmssZ
  const formatUtc = (isoStr: string) => {
    const d = new Date(isoStr);
    return d.toISOString().replace(/-|:|\.\d+/g, '');
  };

  const dates = `${formatUtc(startDateTime)}/${formatUtc(endDateTime)}`;
  const title = encodeURIComponent(`[ICU] Cho thuốc: ${medication.patientName} (${medication.roomNumber} - ${medication.medicationName})`);
  const details = encodeURIComponent(
    `Bệnh nhân: ${medication.patientName}\nPhòng: ${medication.roomNumber} - Giường: ${medication.bed}\nThuốc: ${medication.medicationName}\nLiều lượng: ${medication.dosage}\nĐường dùng: ${medication.route}\nBác sĩ: ${medication.prescribedByDoctorName}\nĐiều dưỡng: ${medication.assignedNurseName || 'Trực ca'}\nLưu ý: ${medication.instructions || 'Tuân thủ 5 đúng'}`
  );
  const location = encodeURIComponent(`Phòng ${medication.roomNumber}, Khoa ICU Bệnh Viện`);

  return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&dates=${dates}&details=${details}&location=${location}`;
}
