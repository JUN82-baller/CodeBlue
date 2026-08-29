// Emergency Voice Broadcast & Text-to-Speech Engine for ICU Red Alerts

import { playDoctorAlertChime, getAudioContext } from './sound';

let currentUtterance: SpeechSynthesisUtterance | null = null;
let isAnnouncing = false;

export function isSpeechSynthesisSupported(): boolean {
  return typeof window !== 'undefined' && 'speechSynthesis' in window;
}

/**
 * Stop any currently playing voice announcement
 */
export function stopVoiceAnnouncement(): void {
  if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
    try {
      window.speechSynthesis.cancel();
      isAnnouncing = false;
      currentUtterance = null;
    } catch (e) {
      console.warn('Failed to cancel speech synthesis:', e);
    }
  }
}

export interface RedAlertVoiceParams {
  patientName?: string;
  roomNumber?: string;
  heartRate?: number;
  spO2?: number;
  reason?: string;
  severity?: string;
}

/**
 * Immediately broadcast an audible voice emergency alert using Web Speech Synthesis
 */
export function speakRedAlertAnnouncement(
  alert: RedAlertVoiceParams,
  language: 'vi' | 'en' = 'vi'
): void {
  if (!isSpeechSynthesisSupported()) {
    console.warn('Speech synthesis is not supported on this browser');
    return;
  }

  try {
    // 1. Play introductory urgent hospital alarm chime
    playDoctorAlertChime();

    // 2. Cancel any running speech to broadcast the newest critical alert immediately
    window.speechSynthesis.cancel();

    // 3. Compose concise text based on language and severity (no lengthy details)
    let textToSpeak = '';
    const room = alert.roomNumber ? `Phòng ${alert.roomNumber}` : '';
    const name = alert.patientName || 'Bệnh nhân';
    const reason = alert.reason ? alert.reason.split('.')[0] : 'Cấp cứu';

    if (language === 'vi') {
      textToSpeak = `Báo động đỏ! ${room ? room + ', ' : ''}${name}. ${reason}!`;
    } else {
      const roomEn = alert.roomNumber ? `Room ${alert.roomNumber}` : '';
      textToSpeak = `Code Red! ${roomEn ? roomEn + ', ' : ''}${name}. ${reason}!`;
    }

    const utterance = new SpeechSynthesisUtterance(textToSpeak);
    currentUtterance = utterance;

    // Pick best available voice for language
    const voices = window.speechSynthesis.getVoices();
    if (language === 'vi') {
      utterance.lang = 'vi-VN';
      const viVoice = voices.find(
        (v) => v.lang.startsWith('vi') || v.name.toLowerCase().includes('vietnam') || v.name.toLowerCase().includes('vietnamese')
      );
      if (viVoice) utterance.voice = viVoice;
    } else {
      utterance.lang = 'en-US';
      const enVoice = voices.find(
        (v) => (v.lang === 'en-US' || v.lang.startsWith('en')) && (v.name.includes('Google') || v.name.includes('Natural'))
      );
      if (enVoice) utterance.voice = enVoice;
    }

    // Voice modulation for urgency, clarity, and brisk pace
    utterance.rate = 1.15; // Brisk & concise
    utterance.pitch = 1.0;
    utterance.volume = 1.0;

    utterance.onstart = () => {
      isAnnouncing = true;
    };

    utterance.onend = () => {
      isAnnouncing = false;
      currentUtterance = null;
    };

    utterance.onerror = (e) => {
      console.warn('Speech synthesis error:', e);
      isAnnouncing = false;
      currentUtterance = null;
    };

    // Small delay (150ms) after the chime starts so the chime is audible before the voice starts
    setTimeout(() => {
      try {
        window.speechSynthesis.speak(utterance);
      } catch (err) {
        console.warn('Could not speak utterance:', err);
      }
    }, 200);
  } catch (error) {
    console.warn('speakRedAlertAnnouncement failed:', error);
  }
}

/**
 * Check if the browser is currently announcing an alert
 */
export function isCurrentlyAnnouncing(): boolean {
  return isAnnouncing;
}
