// Web Notification API wrapper for emergency alerts

export async function requestNotificationPermission(): Promise<boolean> {
  if (!('Notification' in window)) {
    console.warn('Browser does not support desktop notifications');
    return false;
  }

  if (Notification.permission === 'granted') {
    return true;
  }

  if (Notification.permission !== 'denied') {
    const permission = await Notification.requestPermission();
    return permission === 'granted';
  }

  return false;
}

export interface DesktopNotificationParams {
  title: string;
  body: string;
  requireInteraction?: boolean;
  tag?: string;
}

export function sendDesktopAlertNotification(
  paramOrName: string | DesktopNotificationParams,
  roomNumber?: string,
  heartRate?: number,
  severity?: string,
  reason?: string
) {
  if (!('Notification' in window) || Notification.permission !== 'granted') {
    return;
  }

  try {
    let title: string;
    let body: string;
    let tag = `emergency-alert-${Date.now()}`;
    let requireInteraction = true;

    if (typeof paramOrName === 'object') {
      title = paramOrName.title;
      body = paramOrName.body;
      if (paramOrName.tag) tag = paramOrName.tag;
      if (paramOrName.requireInteraction !== undefined) requireInteraction = paramOrName.requireInteraction;
    } else {
      title = `🚨 CẢNH BÁO KHẨN CẤP: ${roomNumber || ''} - ${paramOrName}`;
      body = `Mức độ: ${(severity || 'CRITICAL').toUpperCase()} | Nhịp tim: ${heartRate || 0} BPM\nLý do: ${reason || ''}\nBấm vào đây để tiếp nhận ngay lập tức!`;
    }

    const options: NotificationOptions = {
      body,
      icon: '/favicon.ico',
      tag,
      requireInteraction,
    };

    const notification = new Notification(title, options);
    notification.onclick = () => {
      window.focus();
      notification.close();
    };
  } catch (err) {
    console.warn('Could not send notification:', err);
  }
}
