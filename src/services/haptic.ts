// Haptic Feedback (Vibration API) Service for ICU Mobile Alerts

let vibrationInterval: ReturnType<typeof setInterval> | null = null;
let isVibratingContinuously = false;

/**
 * Check if the current browser and mobile device supports the Vibration API
 */
export function isHapticSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof navigator !== 'undefined' &&
    typeof navigator.vibrate === 'function'
  );
}

// Vibration rhythm definitions (duration in ms: [vibrate, pause, vibrate, pause, ...])
export const HAPTIC_PATTERNS = {
  // Urgent SOS / Code Red pattern: heavy urgent pulses for emergency room
  RED_ALERT: [400, 150, 400, 150, 600, 200, 400],
  // Escalation pulse: distinct double heavy buzz
  ESCALATION: [600, 120, 600, 120, 800],
  // Warning pulse: short double buzz
  WARNING: [250, 100, 250],
  // Success / Acknowledged tap: crisp tactile confirmation
  ACKNOWLEDGE: [70],
};

/**
 * Trigger immediate single haptic pattern
 */
export function triggerHapticPattern(pattern: number[]): boolean {
  if (!isHapticSupported()) return false;
  try {
    return navigator.vibrate(pattern);
  } catch (e) {
    console.warn('Vibration API call failed:', e);
    return false;
  }
}

/**
 * Stop any active continuous vibration and reset device motor
 */
export function stopHapticVibration(): void {
  if (vibrationInterval) {
    clearInterval(vibrationInterval);
    vibrationInterval = null;
  }
  isVibratingContinuously = false;

  if (isHapticSupported()) {
    try {
      navigator.vibrate(0);
    } catch (e) {
      console.warn('Failed to stop vibration:', e);
    }
  }
}

/**
 * Trigger continuous urgent haptic feedback for Red Alerts until acknowledged or resolved
 */
export function triggerRedAlertVibration(continuous = true): boolean {
  if (!isHapticSupported()) return false;

  try {
    // 1. Fire first immediate burst
    navigator.vibrate(HAPTIC_PATTERNS.RED_ALERT);

    if (continuous) {
      // Clear any prior interval
      if (vibrationInterval) {
        clearInterval(vibrationInterval);
      }
      isVibratingContinuously = true;

      // Repeat vibration sequence every 3.5 seconds
      vibrationInterval = setInterval(() => {
        if (!isVibratingContinuously) {
          if (vibrationInterval) clearInterval(vibrationInterval);
          return;
        }
        try {
          navigator.vibrate(HAPTIC_PATTERNS.RED_ALERT);
        } catch (err) {
          console.warn('Repeating vibration failed:', err);
        }
      }, 3500);
    }
    return true;
  } catch (e) {
    console.warn('triggerRedAlertVibration error:', e);
    return false;
  }
}

/**
 * Trigger escalation vibration pulse (when alert is escalated to backup doctor)
 */
export function triggerEscalationVibration(): boolean {
  if (!isHapticSupported()) return false;
  try {
    return navigator.vibrate(HAPTIC_PATTERNS.ESCALATION);
  } catch (e) {
    return false;
  }
}

/**
 * Quick confirmation haptic feedback
 */
export function triggerAcknowledgeHaptic(): boolean {
  if (!isHapticSupported()) return false;
  try {
    return navigator.vibrate(HAPTIC_PATTERNS.ACKNOWLEDGE);
  } catch (e) {
    return false;
  }
}

/**
 * Test haptic vibration
 */
export function testHapticFeedback(): boolean {
  return triggerHapticPattern([300, 100, 300, 100, 500]);
}
