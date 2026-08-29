import React, { useState, useEffect } from 'react';
import {
  AlertTriangle,
  AlertCircle,
  AlertOctagon,
  Check,
  CheckCircle2,
  Heart,
  Phone,
  PhoneCall,
  ShieldAlert,
  User,
  Activity,
  Bed,
  Sparkles,
  ArrowRight,
  Clock,
  Volume2,
  Stethoscope,
  Send,
  MessageSquare,
  Flame,
  Zap,
  Gauge,
  Info,
  Mail,
} from 'lucide-react';
import { Alert, Doctor, Patient, SystemSettings, VitalReading } from '../types';
import { useLanguage } from '../context/LanguageContext';
import { useTheme } from '../context/ThemeContext';
import { QuickContactModal } from './QuickContactModal';
import { speakRedAlertAnnouncement } from '../services/voiceAnnouncement';
import { triggerRedAlertVibration, triggerAcknowledgeHaptic } from '../services/haptic';

export type SeverityLevel = 'Fatal' | 'Critical' | 'Warning';

export interface SeverityDisplayInfo {
  level: SeverityLevel;
  badgeLabel: string;
  badgeBg: string;
  badgeBorder: string;
  badgeText: string;
  cardGradient: string;
  cardBorder: string;
  flashingBar: string;
  iconBg: string;
  iconColor: string;
  glowShadow: string;
  heartRateColor: string;
  pulseSpeed: string;
  thresholdNote: string;
  colorName: 'red' | 'rose' | 'yellow';
}

/**
 * Calculates color-coded severity details based on patient vital signs threshold breaches
 */
export const getSeverityDisplayInfo = (
  alert: Alert,
  settings: SystemSettings,
  language: 'vi' | 'en'
): SeverityDisplayInfo => {
  const hr = alert.heartRate;
  const spo2 = alert.spO2;

  // Determine threshold breach conditions
  const isFatalBpmLow = hr <= settings.criticalLowHeartRate;
  const isFatalBpmHigh = hr >= settings.criticalHighHeartRate;
  const isFatalSpO2 = spo2 !== undefined && spo2 <= 80;
  const isExplicitFatal = alert.severity === 'Fatal';

  const isWarningBpm =
    (hr >= 100 && hr <= settings.maxNormalHeartRate) ||
    (hr <= 60 && hr >= settings.minNormalHeartRate);
  const isWarningSpO2 = spo2 !== undefined && spo2 >= 88 && spo2 <= 92;
  const isExplicitWarning = alert.severity === 'Warning';

  // 1. FATAL / CODE RED (Extreme life-threatening breach: HR <= 40 or >= 150 BPM, SpO2 <= 80%)
  if (isExplicitFatal || isFatalBpmLow || isFatalBpmHigh || isFatalSpO2) {
    let thresholdNote = '';
    if (isFatalBpmHigh) {
      thresholdNote =
        language === 'vi'
          ? `Nguy kịch cực độ: ${hr} BPM ≥ ${settings.criticalHighHeartRate} BPM (Ngưỡng Rung Thất Báo Động Đỏ)`
          : `Fatal breach: ${hr} BPM ≥ ${settings.criticalHighHeartRate} BPM (Code Red V-Fib Limit)`;
    } else if (isFatalBpmLow) {
      thresholdNote =
        language === 'vi'
          ? `Ngừng tim/Nhịp tụt: ${hr} BPM ≤ ${settings.criticalLowHeartRate} BPM (Nguy cơ tử vong)`
          : `Fatal bradycardia: ${hr} BPM ≤ ${settings.criticalLowHeartRate} BPM (Asystole Risk)`;
    } else if (isFatalSpO2) {
      thresholdNote =
        language === 'vi'
          ? `Suy hô hấp cấp tử vong: SpO2 ${spo2}% ≤ 80%`
          : `Severe hypoxemia: SpO2 ${spo2}% ≤ 80%`;
    } else {
      thresholdNote =
        language === 'vi'
          ? 'Chỉ số sinh tồn vượt ngưỡng sống còn'
          : 'Vital parameters beyond survival limit';
    }

    return {
      level: 'Fatal',
      badgeLabel: language === 'vi' ? 'BÁO ĐỘNG ĐỎ (FATAL)' : 'CODE RED (FATAL)',
      badgeBg: 'bg-red-600',
      badgeBorder: 'border-red-400',
      badgeText: 'text-white',
      cardGradient: 'from-red-950 via-slate-900 to-red-950',
      cardBorder: 'border-2 border-red-500 shadow-2xl shadow-red-950/80',
      flashingBar: 'bg-gradient-to-r from-red-600 via-rose-400 to-red-600',
      iconBg: 'bg-red-600/30 text-red-300 border-red-500/60',
      iconColor: 'text-red-400',
      glowShadow: 'shadow-red-950/80',
      heartRateColor: 'text-red-400',
      pulseSpeed: 'animate-ping',
      thresholdNote,
      colorName: 'red',
    };
  }

  // 2. WARNING / YELLOW (Moderate/Elevated breach: borderline vitals)
  if (isExplicitWarning || isWarningBpm || isWarningSpO2) {
    let thresholdNote = '';
    if (isWarningBpm) {
      thresholdNote =
        language === 'vi'
          ? `Cảnh báo mức vàng: ${hr} BPM (Vượt nhẹ mức an toàn ${settings.minNormalHeartRate}-${settings.maxNormalHeartRate} BPM)`
          : `Warning level: ${hr} BPM (Approaching boundary ${settings.minNormalHeartRate}-${settings.maxNormalHeartRate} BPM)`;
    } else if (isWarningSpO2) {
      thresholdNote =
        language === 'vi'
          ? `Cảnh báo SpO2 giảm: ${spo2}% (Tiệm cận ngưỡng an toàn)`
          : `Warning SpO2 drop: ${spo2}% (Near safety boundary)`;
    } else {
      thresholdNote =
        language === 'vi'
          ? 'Chỉ số bắt đầu vượt ngưỡng an toàn'
          : 'Vitals approaching abnormal threshold';
    }

    return {
      level: 'Warning',
      badgeLabel: language === 'vi' ? 'CẢNH BÁO VÀNG (WARNING)' : 'WARNING (YELLOW)',
      badgeBg: 'bg-amber-400 text-slate-950 font-black',
      badgeBorder: 'border-amber-300',
      badgeText: 'text-slate-950',
      cardGradient: 'from-amber-950/90 via-slate-900 to-amber-950/90',
      cardBorder: 'border-2 border-amber-400 shadow-2xl shadow-amber-950/70',
      flashingBar: 'bg-gradient-to-r from-amber-500 via-yellow-300 to-amber-500',
      iconBg: 'bg-amber-400/30 text-amber-300 border-amber-400/60',
      iconColor: 'text-amber-400',
      glowShadow: 'shadow-amber-950/70',
      heartRateColor: 'text-amber-400',
      pulseSpeed: 'animate-pulse',
      thresholdNote,
      colorName: 'yellow',
    };
  }

  // 3. CRITICAL / HIGH BREACH (Red: HR < minNormal or > maxNormal, or SpO2 < minSpO2)
  let thresholdNote = '';
  if (hr > settings.maxNormalHeartRate) {
    thresholdNote =
      language === 'vi'
        ? `Nguy cấp - Nhịp tim cao: ${hr} BPM > ${settings.maxNormalHeartRate} BPM (Ngưỡng cho phép)`
        : `Critical Tachycardia: ${hr} BPM > ${settings.maxNormalHeartRate} BPM (Normal Upper Limit)`;
  } else if (hr < settings.minNormalHeartRate) {
    thresholdNote =
      language === 'vi'
        ? `Nguy cấp - Nhịp tim chậm: ${hr} BPM < ${settings.minNormalHeartRate} BPM (Ngưỡng cho phép)`
        : `Critical Bradycardia: ${hr} BPM < ${settings.minNormalHeartRate} BPM (Normal Lower Limit)`;
  } else if (spo2 !== undefined && spo2 < settings.minSpO2) {
    thresholdNote =
      language === 'vi'
        ? `Nguy cấp - Suy hô hấp: SpO2 ${spo2}% < ${settings.minSpO2}%`
        : `Critical Hypoxemia: SpO2 ${spo2}% < ${settings.minSpO2}%`;
  } else {
    thresholdNote =
      language === 'vi'
        ? 'Chỉ số sinh tồn vượt ngưỡng nguy cấp'
        : 'Vitals breached critical threshold';
  }

  return {
    level: 'Critical',
    badgeLabel: language === 'vi' ? 'NGUY CẤP ĐỎ (CRITICAL)' : 'CRITICAL ALERT (RED)',
    badgeBg: 'bg-rose-600',
    badgeBorder: 'border-rose-400',
    badgeText: 'text-white',
    cardGradient: 'from-rose-950/90 via-slate-900 to-rose-950/90',
    cardBorder: 'border-2 border-rose-500 shadow-2xl shadow-rose-950/70',
    flashingBar: 'bg-gradient-to-r from-rose-500 via-orange-400 to-rose-500',
    iconBg: 'bg-rose-600/30 text-rose-300 border-rose-500/60',
    iconColor: 'text-rose-400',
    glowShadow: 'shadow-rose-950/70',
    heartRateColor: 'text-rose-400',
    pulseSpeed: 'animate-bounce',
    thresholdNote,
    colorName: 'red',
  };
};

/**
 * Evaluates patient status in ward list relative to configured thresholds
 */
export const getPatientVitalSeverity = (
  reading: VitalReading | undefined,
  settings: SystemSettings,
  language: 'vi' | 'en'
) => {
  if (!reading) {
    return {
      severity: 'Normal' as const,
      colorClass: 'emerald',
      label: language === 'vi' ? 'Ổn Định' : 'Stable',
      icon: <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />,
      badgeBg: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
      borderClass: 'border-slate-800',
      detailNote: language === 'vi' ? 'Chỉ số trong khoảng bình thường' : 'Vitals within normal limits',
    };
  }

  const hr = reading.heartRate;
  const spo2 = reading.spO2 || 98;

  if (hr <= settings.criticalLowHeartRate || hr >= settings.criticalHighHeartRate || spo2 <= 80) {
    return {
      severity: 'Fatal' as const,
      colorClass: 'red',
      label: language === 'vi' ? 'Báo Động Đỏ' : 'Code Red',
      icon: <ShieldAlert className="w-3.5 h-3.5 text-red-400 animate-pulse" />,
      badgeBg: 'bg-red-600/30 text-red-300 border-red-500 animate-pulse',
      borderClass: 'border-red-500/80 bg-red-950/25 ring-1 ring-red-500/40',
      detailNote:
        hr >= settings.criticalHighHeartRate
          ? `${hr} BPM ≥ ${settings.criticalHighHeartRate} BPM (Rung thất)`
          : hr <= settings.criticalLowHeartRate
          ? `${hr} BPM ≤ ${settings.criticalLowHeartRate} BPM (Ngừng tim)`
          : `SpO2 ${spo2}% ≤ 80% (Thiếu oxy)`,
    };
  }

  if (hr < settings.minNormalHeartRate || hr > settings.maxNormalHeartRate || spo2 < settings.minSpO2) {
    return {
      severity: 'Critical' as const,
      colorClass: 'red',
      label: language === 'vi' ? 'Nguy Cấp' : 'Critical',
      icon: <AlertTriangle className="w-3.5 h-3.5 text-rose-400 animate-bounce" />,
      badgeBg: 'bg-rose-600/30 text-rose-300 border-rose-500',
      borderClass: 'border-rose-500/70 bg-rose-950/20 ring-1 ring-rose-500/30',
      detailNote:
        hr > settings.maxNormalHeartRate
          ? `${hr} BPM > ${settings.maxNormalHeartRate} BPM (Nhịp nhanh)`
          : hr < settings.minNormalHeartRate
          ? `${hr} BPM < ${settings.minNormalHeartRate} BPM (Nhịp chậm)`
          : `SpO2 ${spo2}% < ${settings.minSpO2}%`,
    };
  }

  if (
    (hr >= 100 && hr <= settings.maxNormalHeartRate) ||
    (hr <= 60 && hr >= settings.minNormalHeartRate) ||
    (spo2 >= 88 && spo2 <= 92)
  ) {
    return {
      severity: 'Warning' as const,
      colorClass: 'yellow',
      label: language === 'vi' ? 'Cảnh Báo Vàng' : 'Warning',
      icon: <AlertCircle className="w-3.5 h-3.5 text-amber-400" />,
      badgeBg: 'bg-amber-500/25 text-amber-300 border-amber-400',
      borderClass: 'border-amber-500/60 bg-amber-950/15 ring-1 ring-amber-500/20',
      detailNote: language === 'vi' ? `${hr} BPM (Tiệm cận ngưỡng)` : `${hr} BPM (Near threshold)`,
    };
  }

  return {
    severity: 'Normal' as const,
    colorClass: 'emerald',
    label: language === 'vi' ? 'Ổn Định' : 'Stable',
    icon: <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />,
    badgeBg: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
    borderClass: 'border-slate-800',
    detailNote: language === 'vi' ? 'Chỉ số trong khoảng bình thường' : 'Vitals within normal limits',
  };
};

interface DoctorPortalProps {
  doctor: Doctor;
  patients: Patient[];
  alerts: Alert[];
  recentVitals: Record<string, VitalReading>;
  settings: SystemSettings;
  onAcknowledgeAlert: (alertId: string) => Promise<void>;
  onResolveAlert: (alertId: string, note: string) => Promise<void>;
  onToggleOnCall: (doctorId: string) => Promise<void>;
  onInjectEmergency: (patientId: string, type: 'vfib' | 'brady' | 'hypoxia') => Promise<void>;
  onConsultAi?: (patientId?: string, role?: 'clinical_doctor' | 'pharmacist' | 'transfer_coordinator' | 'triage_nurse') => void;
  doctors?: Doctor[];
  selectedDoctorId?: string;
  setSelectedDoctorId?: (id: string) => void;
  onOpenGmail?: (alert?: Alert, doctor?: Doctor) => void;
}

export const DoctorPortal: React.FC<DoctorPortalProps> = ({
  doctor,
  patients,
  alerts,
  recentVitals,
  settings,
  onAcknowledgeAlert,
  onResolveAlert,
  onToggleOnCall,
  onInjectEmergency,
  onConsultAi,
  doctors = [],
  selectedDoctorId,
  setSelectedDoctorId,
  onOpenGmail,
}) => {
  const { t, language } = useLanguage();
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  const [resolvingAlertId, setResolvingAlertId] = useState<string | null>(null);
  const [resolveNote, setResolveNote] = useState('');
  const [processingAlertId, setProcessingAlertId] = useState<string | null>(null);

  // Quick Contact Modal State
  const [contactAlert, setContactAlert] = useState<Alert | null>(null);
  const [contactMode, setContactMode] = useState<'call' | 'message'>('call');
  const [isContactModalOpen, setIsContactModalOpen] = useState(false);

  const handleOpenQuickContact = (targetAlert: Alert, mode: 'call' | 'message' = 'call') => {
    setContactAlert(targetAlert);
    setContactMode(mode);
    setIsContactModalOpen(true);
  };

  // Active Pending alerts for on-call doctor
  const pendingAlerts = alerts.filter((a) => a.status === 'Pending');
  const acknowledgedAlerts = alerts.filter((a) => a.status === 'Acknowledged');

  // Time elapsed ticker for countdown
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const handleAcknowledge = async (alertId: string) => {
    setProcessingAlertId(alertId);
    try {
      await onAcknowledgeAlert(alertId);
    } catch (err) {
      console.error('Error acknowledging alert in doctor portal:', err);
    } finally {
      setProcessingAlertId(null);
    }
  };

  const handleResolveSubmit = async (alertId: string) => {
    if (!resolveNote.trim()) return;
    setProcessingAlertId(alertId);
    try {
      await onResolveAlert(alertId, resolveNote);
      setResolvingAlertId(null);
      setResolveNote('');
    } catch (err) {
      console.error('Error resolving alert in doctor portal:', err);
    } finally {
      setProcessingAlertId(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Doctor Profile & Duty Status Card */}
      <div
        className={`border rounded-2xl p-5 shadow-lg flex flex-col md:flex-row items-start md:items-center justify-between gap-4 transition-colors ${
          isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'
        }`}
      >
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-500 font-bold text-xl shadow-inner">
            <Stethoscope className="w-7 h-7" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className={`text-xl font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>{doctor.name}</h2>
              <span className="text-xs px-2.5 py-0.5 rounded-full font-semibold bg-blue-500/20 text-blue-500 border border-blue-500/30">
                {doctor.department}
              </span>
              {doctors.length > 1 && selectedDoctorId && setSelectedDoctorId && (
                <select
                  value={selectedDoctorId}
                  onChange={(e) => setSelectedDoctorId(e.target.value)}
                  className={`text-xs px-2 py-1 rounded-lg border font-semibold focus:outline-none cursor-pointer ${
                    isDark
                      ? 'bg-slate-950 border-slate-700 text-slate-200'
                      : 'bg-slate-100 border-slate-300 text-slate-800'
                  }`}
                  title="Chuyển hồ sơ bác sĩ"
                >
                  {doctors.map((d) => (
                    <option key={d.id} value={d.id} className={isDark ? 'bg-slate-900 text-white' : 'bg-white text-slate-900'}>
                      {d.name} {d.isOnCall ? t.onDutyTag : t.backupTag}
                    </option>
                  ))}
                </select>
              )}
            </div>
            <div className={`flex items-center gap-4 text-xs mt-1 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
              <span className="flex items-center gap-1">
                <Phone className="w-3.5 h-3.5 text-emerald-500" />
                {t.hotline} <strong className={`font-mono ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>{doctor.phone}</strong>
              </span>
              {doctor.role && <span>• {doctor.role}</span>}
            </div>
          </div>
        </div>

        {/* On-Call Duty Switch & Emergency Quick Contact Banner */}
        <div className="flex items-center gap-3 flex-wrap">
          {alerts.filter((a) => a.status !== 'Resolved').length > 0 && (
            <button
              id="btn-header-quick-contact"
              onClick={() => {
                const firstActive = pendingAlerts[0] || acknowledgedAlerts[0] || alerts[0];
                if (firstActive) handleOpenQuickContact(firstActive, 'call');
              }}
              className="px-4 py-2.5 bg-red-600 hover:bg-red-500 active:scale-95 text-white text-xs font-black rounded-xl shadow-lg shadow-red-950/40 border border-red-400/30 flex items-center gap-2 transition-all animate-pulse cursor-pointer"
              title="Mở đường dây nóng liên lạc khẩn cấp"
            >
              <PhoneCall className="w-4 h-4" />
              <span>{t.btnQuickContact}</span>
            </button>
          )}

          <div
            className={`flex items-center gap-3 p-2 rounded-xl border w-full md:w-auto justify-between md:justify-start ${
              isDark ? 'bg-slate-950/80 border-slate-800' : 'bg-slate-50 border-slate-200'
            }`}
          >
            <div className="text-left px-2">
              <div className={`text-xs font-medium ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{t.dutyStatus}</div>
              <div className="text-sm font-bold flex items-center gap-1.5">
                <span className={`w-2.5 h-2.5 rounded-full ${doctor.isOnCall ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'}`} />
                <span className={doctor.isOnCall ? 'text-emerald-500' : isDark ? 'text-slate-400' : 'text-slate-500'}>
                  {doctor.isOnCall ? t.statusOnCall : t.statusOffDuty}
                </span>
              </div>
            </div>

            <button
              id="btn-toggle-oncall"
              onClick={() => onToggleOnCall(doctor.id)}
              className={`px-4 py-2 rounded-lg text-xs font-bold transition-all shadow-sm cursor-pointer ${
                doctor.isOnCall
                  ? 'bg-emerald-600 hover:bg-emerald-500 text-white'
                  : isDark
                  ? 'bg-slate-800 hover:bg-slate-700 text-slate-200'
                  : 'bg-slate-200 hover:bg-slate-300 text-slate-800'
              }`}
            >
              {doctor.isOnCall ? t.btnSwitchBackup : t.btnSwitchOnCall}
            </button>
          </div>
        </div>
      </div>

      {/* THRESHOLD REFERENCE & LIVE ALERT SEVERITY SUMMARY BAR */}
      <div
        className={`p-3.5 rounded-xl border flex flex-col md:flex-row items-start md:items-center justify-between gap-3 text-xs ${
          isDark ? 'bg-slate-900/90 border-slate-800' : 'bg-slate-50 border-slate-200'
        }`}
      >
        <div className="flex items-center gap-2 flex-wrap">
          <span className={`font-bold flex items-center gap-1 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
            <Gauge className="w-4 h-4 text-blue-500" />
            <span>{language === 'vi' ? 'Phân loại mức độ vi phạm ngưỡng:' : 'Threshold Breach Classification:'}</span>
          </span>

          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-red-600/20 text-red-400 border border-red-500/40 font-bold">
            <ShieldAlert className="w-3.5 h-3.5 text-red-500 animate-pulse" />
            <span>
              {language === 'vi'
                ? `Đỏ Tử Vong: ≤${settings.criticalLowHeartRate} | ≥${settings.criticalHighHeartRate} BPM, SpO2 ≤80%`
                : `Red Fatal: ≤${settings.criticalLowHeartRate} | ≥${settings.criticalHighHeartRate} BPM, SpO2 ≤80%`}
            </span>
          </span>

          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-rose-600/20 text-rose-400 border border-rose-500/40 font-bold">
            <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
            <span>
              {language === 'vi'
                ? `Đỏ Nguy Cấp: <${settings.minNormalHeartRate} | >${settings.maxNormalHeartRate} BPM, SpO2 <${settings.minSpO2}%`
                : `Red Critical: <${settings.minNormalHeartRate} | >${settings.maxNormalHeartRate} BPM, SpO2 <${settings.minSpO2}%`}
            </span>
          </span>

          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-amber-500/20 text-amber-300 border border-amber-400/40 font-bold">
            <AlertCircle className="w-3.5 h-3.5 text-amber-400" />
            <span>
              {language === 'vi'
                ? `Vàng Cảnh Báo: 50-60 | 100-120 BPM, SpO2 88-92%`
                : `Yellow Warning: 50-60 | 100-120 BPM, SpO2 88-92%`}
            </span>
          </span>
        </div>

        <div className="flex items-center gap-2 self-end md:self-auto font-mono text-[11px]">
          <span className="px-2 py-0.5 rounded bg-red-500/15 text-red-400 border border-red-500/30 font-bold">
            {
              alerts.filter(
                (a) =>
                  a.status !== 'Resolved' &&
                  (a.severity === 'Fatal' ||
                    a.heartRate <= settings.criticalLowHeartRate ||
                    a.heartRate >= settings.criticalHighHeartRate ||
                    a.severity === 'Critical' ||
                    a.heartRate > settings.maxNormalHeartRate ||
                    a.heartRate < settings.minNormalHeartRate)
              ).length
            }{' '}
            {language === 'vi' ? 'Cấp Đỏ' : 'Red'}
          </span>
          <span className="px-2 py-0.5 rounded bg-amber-500/15 text-amber-400 border border-amber-500/30 font-bold">
            {alerts.filter((a) => a.status !== 'Resolved' && a.severity === 'Warning').length}{' '}
            {language === 'vi' ? 'Cấp Vàng' : 'Yellow'}
          </span>
        </div>
      </div>

      {/* POPUP / MODAL BANNER CHO CẢNH BÁO ĐANG CHỜ (PENDING ALERTS) */}
      {pendingAlerts.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-black tracking-tight text-red-500 flex items-center gap-2">
              <ShieldAlert className="w-6 h-6 animate-bounce text-red-500" />
              {t.activeAlertsPending} ({pendingAlerts.length})
            </h3>
            <span className="text-xs font-medium text-red-400 animate-pulse">
              {t.broadcastingAlert}
            </span>
          </div>

          <div className="grid grid-cols-1 gap-4">
            {pendingAlerts.map((alert) => {
              const createdMs = new Date(alert.createdAt).getTime();
              const elapsedSec = Math.floor((now - createdMs) / 1000);
              const remainingSec = Math.max(0, settings.escalationTimeoutSeconds - elapsedSec);
              const severityInfo = getSeverityDisplayInfo(alert, settings, language);

              return (
                <div
                  key={alert.id}
                  id={`doctor-alert-${alert.id}`}
                  className={`relative overflow-hidden rounded-2xl bg-gradient-to-r ${severityInfo.cardGradient} ${severityInfo.cardBorder} p-5 sm:p-6 text-white transition-all`}
                >
                  {/* Flashing accent bar */}
                  <div className={`absolute top-0 left-0 right-0 h-1.5 ${severityInfo.flashingBar} animate-pulse`} />

                  <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
                    {/* Left: Patient & Room Info with Color-Coded Severity Badge and Icon */}
                    <div className="space-y-2.5 flex-1">
                      <div className="flex items-center gap-2.5 flex-wrap">
                        {/* Color-Coded Severity Badge (Red for Fatal/Critical, Yellow for Warning) */}
                        <span
                          className={`px-3 py-1.5 rounded-lg ${severityInfo.badgeBg} ${severityInfo.badgeText} font-black text-xs sm:text-sm tracking-wide shadow-lg border ${severityInfo.badgeBorder} flex items-center gap-2`}
                        >
                          {severityInfo.level === 'Fatal' ? (
                            <ShieldAlert className="w-4 h-4 animate-pulse text-white" />
                          ) : severityInfo.level === 'Warning' ? (
                            <AlertCircle className="w-4 h-4 text-slate-950" />
                          ) : (
                            <AlertTriangle className="w-4 h-4 animate-bounce text-white" />
                          )}
                          <span>{severityInfo.badgeLabel}</span>
                        </span>

                        <span className="px-3 py-1 rounded-lg bg-slate-800/90 border border-slate-700 text-white font-bold text-sm flex items-center gap-1.5 shadow-sm">
                          <Bed className="w-4 h-4 text-blue-400" />
                          {t.room} {alert.roomNumber}
                        </span>

                        {/* Threshold Breach Pill Tag */}
                        <span
                          className={`px-2.5 py-1 rounded-md text-xs font-bold border ${
                            severityInfo.level === 'Warning'
                              ? 'bg-amber-950/80 text-amber-300 border-amber-400/50'
                              : 'bg-red-950/90 text-rose-200 border-red-500/50'
                          } flex items-center gap-1.5`}
                        >
                          <Gauge className="w-3.5 h-3.5" />
                          <span>{severityInfo.thresholdNote}</span>
                        </span>
                      </div>

                      <div className="flex items-baseline gap-3">
                        <h4 className="text-2xl font-black text-white tracking-tight">{alert.patientName}</h4>
                        <span className="text-xs text-slate-400">{t.patientCode} {alert.patientId}</span>
                      </div>

                      <p
                        className={`text-sm font-semibold flex items-center gap-2 ${
                          severityInfo.level === 'Warning' ? 'text-amber-200' : 'text-rose-200'
                        }`}
                      >
                        <Heart className={`w-4 h-4 ${severityInfo.iconColor} ${severityInfo.pulseSpeed}`} />
                        <span>{alert.reason}</span>
                      </p>
                    </div>

                    {/* Middle: Live Heart Rate Metric Box with color-coded numbers and icon */}
                    <div
                      className={`flex items-center gap-4 bg-slate-950/85 border ${
                        severityInfo.level === 'Warning' ? 'border-amber-400/40' : 'border-red-500/40'
                      } rounded-xl p-4 min-w-[210px] justify-center shadow-inner`}
                    >
                      <div className="text-center">
                        <div className="text-xs text-slate-400 uppercase font-semibold flex items-center justify-center gap-1">
                          <span>{t.measuredHR}</span>
                        </div>
                        <div className={`text-4xl font-black ${severityInfo.heartRateColor} flex items-center justify-center gap-1.5 mt-0.5`}>
                          <Heart className={`w-7 h-7 ${severityInfo.iconColor} fill-current ${severityInfo.pulseSpeed}`} />
                          <span>{alert.heartRate}</span>
                          <span className="text-xs text-slate-400 font-normal ml-0.5">BPM</span>
                        </div>
                        {alert.spO2 !== undefined && (
                          <div
                            className={`text-xs font-bold mt-1.5 px-2 py-0.5 rounded-full inline-block ${
                              alert.spO2 < settings.minSpO2
                                ? 'bg-red-500/20 text-red-400 border border-red-500/40 animate-pulse'
                                : 'bg-sky-500/20 text-sky-400 border border-sky-500/30'
                            }`}
                          >
                            SpO2: {alert.spO2}% {alert.spO2 < settings.minSpO2 ? '(Tụt Oxy)' : ''}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Right: Escalation Status & Action Buttons */}
                    <div className="flex flex-col items-stretch lg:items-end gap-3 min-w-[240px]">
                      {/* Escalation countdown badge */}
                      <div className="text-xs bg-slate-950/90 border border-slate-800 rounded-lg p-2.5 text-center lg:text-right w-full">
                        {alert.escalatedToBackup ? (
                          <div className="text-amber-400 font-bold flex items-center justify-center lg:justify-end gap-1">
                            <AlertTriangle className="w-4 h-4 text-amber-400" />
                            {t.escalatedToBackup}
                          </div>
                        ) : (
                          <div className="text-slate-300 font-medium">
                            {t.autoEscalateIn}{' '}
                            <strong className="text-red-400 font-mono text-sm">{remainingSec}s</strong>
                          </div>
                        )}
                        <div className="text-[11px] text-slate-500 mt-0.5">
                          {language === 'vi' ? 'Thời gian phát hiện: ' : 'Detected at: '}
                          {new Date(alert.createdAt).toLocaleTimeString(language === 'vi' ? 'vi-VN' : 'en-US')}
                        </div>
                      </div>

                      {/* Action Buttons: Acknowledge + Quick Contact */}
                      <div className="flex flex-col sm:flex-row lg:flex-col gap-2 w-full">
                        <button
                          id={`btn-ack-doctor-${alert.id}`}
                          onClick={() => handleAcknowledge(alert.id)}
                          disabled={processingAlertId === alert.id}
                          className="flex-1 px-5 py-3 bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white font-black text-sm rounded-xl shadow-lg shadow-emerald-950/50 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-75"
                        >
                          <CheckCircle2 className="w-5 h-5" />
                          <span>{processingAlertId === alert.id ? t.btnAcknowledging : t.btnAcknowledgeNow}</span>
                        </button>

                        <div className="flex gap-2">
                          <button
                            id={`btn-announce-alert-${alert.id}`}
                            onClick={() => {
                              triggerRedAlertVibration(false);
                              speakRedAlertAnnouncement({
                                patientName: alert.patientName,
                                roomNumber: alert.roomNumber,
                                heartRate: alert.heartRate,
                                spO2: alert.spO2,
                                reason: alert.reason,
                                severity: alert.severity,
                              }, language);
                            }}
                            className="px-3 py-2.5 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 font-bold text-xs rounded-xl shadow-md border border-amber-400/40 transition-all flex items-center justify-center gap-1 cursor-pointer"
                            title={language === 'vi' ? 'Phát loa thông báo khẩn cấp ngay lập tức' : 'Broadcast instant emergency voice announcement'}
                          >
                            <Volume2 className="w-4 h-4 text-amber-400 animate-bounce" />
                            <span className="hidden sm:inline">{language === 'vi' ? 'Phát loa' : 'Voice'}</span>
                          </button>

                          <button
                            id={`btn-quick-contact-call-${alert.id}`}
                            onClick={() => handleOpenQuickContact(alert, 'call')}
                            className="flex-1 px-3.5 py-2.5 bg-red-600/90 hover:bg-red-500 active:scale-95 text-white font-bold text-xs rounded-xl shadow-md border border-red-400/40 transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                            title="Gọi điện thoại khẩn cấp đến Trạm Điều Dưỡng / Code Blue"
                          >
                            <PhoneCall className="w-4 h-4 animate-pulse" />
                            <span>{t.btnQuickContact}</span>
                          </button>

                          <button
                            id={`btn-quick-contact-msg-${alert.id}`}
                            onClick={() => handleOpenQuickContact(alert, 'message')}
                            className="px-3 py-2.5 bg-blue-600/90 hover:bg-blue-500 active:scale-95 text-white font-bold text-xs rounded-xl shadow-md border border-blue-400/40 transition-all flex items-center justify-center gap-1 cursor-pointer"
                            title="Gửi tin nhắn / bộ đàm cấp cứu"
                          >
                            <MessageSquare className="w-4 h-4" />
                            <span className="hidden sm:inline">Chat</span>
                          </button>

                          {onOpenGmail && (
                            <button
                              id={`btn-gmail-dispatch-alert-${alert.id}`}
                              onClick={() => onOpenGmail(alert, doctor)}
                              className="px-3 py-2.5 bg-rose-600/90 hover:bg-rose-500 active:scale-95 text-white font-bold text-xs rounded-xl shadow-md border border-rose-400/40 transition-all flex items-center justify-center gap-1 cursor-pointer"
                              title={language === 'vi' ? 'Gửi email Gmail cảnh báo đỏ khẩn cấp đến kíp trực' : 'Dispatch Code Red email alert via Gmail'}
                            >
                              <Mail className="w-4 h-4" />
                              <span className="hidden sm:inline">Mail</span>
                            </button>
                          )}

                          {onConsultAi && (
                            <button
                              id={`btn-ai-consult-alert-${alert.id}`}
                              onClick={() => onConsultAi(alert.patientId, 'clinical_doctor')}
                              className="px-3 py-2.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 active:scale-95 text-white font-bold text-xs rounded-xl shadow-md border border-purple-400/40 transition-all flex items-center justify-center gap-1 cursor-pointer"
                              title="Hỏi Cố Vấn Gemini AI về phác đồ xử trí ca cấp cứu này"
                            >
                              <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                              <span>AI</span>
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* DANH SÁCH CẢNH BÁO ĐANG XỬ LÝ (ACKNOWLEDGED ALERTS IN PROGRESS) */}
      {acknowledgedAlerts.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold text-amber-500 flex items-center gap-2">
              <Clock className="w-5 h-5 text-amber-500" />
              {t.acknowledgedAlertsHeader} ({acknowledgedAlerts.length})
            </h3>
            <span className="text-xs text-amber-500/80 font-medium">
              {acknowledgedAlerts.length} {language === 'vi' ? 'cảnh báo đang xử lý' : 'in progress'}
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {acknowledgedAlerts.map((alert) => {
              const severityInfo = getSeverityDisplayInfo(alert, settings, language);

              return (
                <div
                  key={alert.id}
                  id={`ack-alert-card-${alert.id}`}
                  className={`border rounded-xl p-4 shadow-md space-y-3 transition-all ${
                    severityInfo.level === 'Warning'
                      ? isDark
                        ? 'bg-slate-900 border-amber-400/40 text-white'
                        : 'bg-white border-amber-300 text-slate-900'
                      : isDark
                      ? 'bg-slate-900 border-rose-500/40 text-white'
                      : 'bg-white border-rose-300 text-slate-900'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        {/* Color-Coded Severity Icon & Badge */}
                        <span
                          className={`px-2 py-0.5 rounded text-[11px] font-black border flex items-center gap-1 ${
                            severityInfo.level === 'Warning'
                              ? 'bg-amber-400/20 text-amber-400 border-amber-400/40'
                              : 'bg-red-500/20 text-red-400 border-red-500/40'
                          }`}
                        >
                          {severityInfo.level === 'Fatal' ? (
                            <ShieldAlert className="w-3 h-3 text-red-400 animate-pulse" />
                          ) : severityInfo.level === 'Warning' ? (
                            <AlertCircle className="w-3 h-3 text-amber-400" />
                          ) : (
                            <AlertTriangle className="w-3 h-3 text-rose-400" />
                          )}
                          <span>
                            {severityInfo.level === 'Fatal'
                              ? 'CODE RED'
                              : severityInfo.level === 'Warning'
                              ? 'WARNING'
                              : 'CRITICAL'}
                          </span>
                        </span>

                        <span className="font-bold text-base">{alert.patientName}</span>
                        <span className="text-xs px-2 py-0.5 bg-blue-500/20 text-blue-500 rounded font-semibold border border-blue-500/30">
                          {t.room} {alert.roomNumber}
                        </span>
                      </div>

                      <p
                        className={`text-xs font-semibold ${
                          severityInfo.level === 'Warning' ? 'text-amber-500' : 'text-rose-500'
                        }`}
                      >
                        {alert.reason}
                      </p>

                      <div className="text-[11px] text-slate-400 flex items-center gap-1">
                        <Gauge className="w-3 h-3 text-slate-500" />
                        <span>{severityInfo.thresholdNote}</span>
                      </div>
                    </div>

                    <div className="text-right whitespace-nowrap">
                      <span
                        className={`text-lg font-black ${
                          severityInfo.level === 'Warning' ? 'text-amber-500' : 'text-red-500'
                        }`}
                      >
                        {alert.heartRate} BPM
                      </span>
                      <div className={`text-[11px] ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                        {alert.acknowledgedAt
                          ? new Date(alert.acknowledgedAt).toLocaleTimeString(language === 'vi' ? 'vi-VN' : 'en-US')
                          : ''}
                      </div>
                    </div>
                  </div>

                  <div
                    className={`text-xs flex items-center justify-between border-t pt-2 ${
                      isDark ? 'border-slate-800 text-slate-400' : 'border-slate-100 text-slate-600'
                    }`}
                  >
                    <span>
                      {t.acknowledgedBy} <strong className={isDark ? 'text-slate-200' : 'text-slate-800'}>{alert.acknowledgedBy}</strong>
                    </span>
                    <span>
                      {t.responseTime} <strong className="text-emerald-500">{alert.responseTimeSeconds}s</strong>
                    </span>
                  </div>

                  {/* Quick Contact button on Acknowledged Alert */}
                  <div className="flex gap-2">
                    <button
                      id={`btn-ack-quick-contact-${alert.id}`}
                      onClick={() => handleOpenQuickContact(alert, 'call')}
                      className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-bold transition-colors flex items-center justify-center gap-1.5 border cursor-pointer ${
                        isDark
                          ? 'bg-slate-800/80 hover:bg-slate-700 text-red-400 border-slate-700'
                          : 'bg-red-50 hover:bg-red-100 text-red-700 border-red-200'
                      }`}
                    >
                      <PhoneCall className="w-3.5 h-3.5" />
                      <span>{t.btnQuickContact}</span>
                    </button>

                    <button
                      onClick={() => handleOpenQuickContact(alert, 'message')}
                      className={`py-1.5 px-3 rounded-lg text-xs font-bold transition-colors flex items-center justify-center gap-1.5 border cursor-pointer ${
                        isDark
                          ? 'bg-slate-800/80 hover:bg-slate-700 text-blue-400 border-slate-700'
                          : 'bg-blue-50 hover:bg-blue-100 text-blue-700 border-blue-200'
                      }`}
                    >
                      <MessageSquare className="w-3.5 h-3.5" />
                      <span>Chat</span>
                    </button>
                  </div>

                  {/* Resolve Action */}
                  {resolvingAlertId === alert.id ? (
                    <div
                      className={`space-y-2 p-3 rounded-lg border ${
                        isDark ? 'bg-slate-950 border-slate-800' : 'bg-slate-50 border-slate-200'
                      }`}
                    >
                      <input
                        type="text"
                        placeholder={t.clinicalNotesPlaceholder}
                        value={resolveNote}
                        onChange={(e) => setResolveNote(e.target.value)}
                        className={`w-full rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-emerald-500 border ${
                          isDark
                            ? 'bg-slate-900 border-slate-700 text-white'
                            : 'bg-white border-slate-300 text-slate-900'
                        }`}
                      />
                      <div className="flex gap-2 justify-end">
                        <button
                          onClick={() => setResolvingAlertId(null)}
                          className={`px-3 py-1.5 text-xs rounded-md ${
                            isDark ? 'text-slate-400 hover:text-white' : 'text-slate-600 hover:text-slate-900'
                          }`}
                        >
                          {t.btnCancel}
                        </button>
                        <button
                          id={`btn-confirm-resolve-${alert.id}`}
                          onClick={() => handleResolveSubmit(alert.id)}
                          disabled={!resolveNote.trim() || processingAlertId === alert.id}
                          className="px-4 py-1.5 text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                        >
                          <Check className="w-3.5 h-3.5" />
                          <span>{processingAlertId === alert.id ? t.btnResolving : t.btnSubmitResolution}</span>
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      id={`btn-open-resolve-${alert.id}`}
                      onClick={() => {
                        setResolvingAlertId(alert.id);
                        setResolveNote(
                          language === 'vi'
                            ? 'Đã khám trực tiếp tại giường bệnh, nhịp tim và các chỉ số sinh tồn đã ổn định.'
                            : 'Bedside clinical examination completed. Vital parameters stabilized.'
                        );
                      }}
                      className={`w-full py-2 font-bold text-xs rounded-lg transition-colors flex items-center justify-center gap-1.5 border cursor-pointer ${
                        isDark
                          ? 'bg-slate-800 hover:bg-slate-700 text-emerald-400 border-slate-700'
                          : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border-emerald-200'
                      }`}
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      <span>{t.btnResolveComplete}</span>
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* DANH SÁCH BỆNH NHÂN ĐANG THEO DÕI TẠI KHOA (WARD PATIENT TELEMETRY) */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className={`text-base font-bold flex items-center gap-2 ${isDark ? 'text-white' : 'text-slate-900'}`}>
            <Activity className="w-5 h-5 text-blue-500" />
            <span>{t.patientListHeader}</span>
          </h3>
          <span className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
            {patients.length} {t.patientCount}
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {patients.map((patient) => {
            const reading = recentVitals[patient.id];
            const currentBpm = reading ? reading.heartRate : 75;
            const currentSpO2 = reading?.spO2 || 98;
            const patSeverity = getPatientVitalSeverity(reading, settings, language);

            return (
              <div
                key={patient.id}
                id={`patient-card-${patient.id}`}
                className={`rounded-2xl border p-4 transition-all shadow-sm ${
                  patSeverity.borderClass
                } ${
                  isDark ? 'bg-slate-900' : 'bg-white'
                }`}
              >
                {/* Header: Name, Room, Bed, Color-Coded Severity Badge */}
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <h4 className={`font-bold text-base ${isDark ? 'text-white' : 'text-slate-900'}`}>
                        {patient.name}
                      </h4>
                      <span className="text-xs px-2 py-0.5 rounded bg-blue-500/10 text-blue-500 font-semibold border border-blue-500/20">
                        {t.room} {patient.roomNumber} ({patient.bed})
                      </span>
                    </div>
                    <div className={`text-xs mt-0.5 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                      {patient.age} {language === 'vi' ? 'tuổi' : 'y/o'} • {t.patientCode} {patient.id}
                    </div>
                  </div>

                  {/* Color-Coded Severity Badge with Icon */}
                  <span
                    className={`text-xs px-2.5 py-1 rounded-full font-black border flex items-center gap-1.5 whitespace-nowrap ${patSeverity.badgeBg}`}
                  >
                    {patSeverity.icon}
                    <span>{patSeverity.label}</span>
                  </span>
                </div>

                {/* Threshold Status Detail */}
                <div
                  className={`mt-2 text-xs flex items-center gap-1.5 ${
                    patSeverity.severity === 'Fatal' || patSeverity.severity === 'Critical'
                      ? 'text-red-400 font-semibold'
                      : patSeverity.severity === 'Warning'
                      ? 'text-amber-400 font-semibold'
                      : isDark
                      ? 'text-slate-400'
                      : 'text-slate-500'
                  }`}
                >
                  <Gauge className="w-3.5 h-3.5 flex-shrink-0" />
                  <span>{patSeverity.detailNote}</span>
                </div>

                {/* Diagnosis */}
                <div className={`mt-1.5 text-xs ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
                  <span className="text-slate-400 font-medium">{t.diagnosis}</span> {patient.diagnosis}
                </div>

                {/* Live Metrics Row with Color-Coded Vital Icons */}
                <div
                  className={`mt-3 p-3 rounded-xl border flex items-center justify-between ${
                    isDark ? 'bg-slate-950/80 border-slate-800' : 'bg-slate-50 border-slate-200'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <Heart
                      className={`w-5 h-5 ${
                        patSeverity.severity === 'Fatal' || patSeverity.severity === 'Critical'
                          ? 'text-red-500 animate-ping'
                          : patSeverity.severity === 'Warning'
                          ? 'text-amber-400 animate-pulse'
                          : 'text-emerald-500'
                      }`}
                    />
                    <div>
                      <div className={`text-[10px] uppercase font-semibold ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                        {t.lastRecordedHR}
                      </div>
                      <div
                        className={`text-lg font-black ${
                          patSeverity.severity === 'Fatal' || patSeverity.severity === 'Critical'
                            ? 'text-red-500'
                            : patSeverity.severity === 'Warning'
                            ? 'text-amber-400'
                            : 'text-emerald-500'
                        }`}
                      >
                        {currentBpm} <span className="text-xs font-normal text-slate-400">BPM</span>
                      </div>
                    </div>
                  </div>

                  <div className="text-right">
                    <div className={`text-[10px] uppercase font-semibold ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>SpO2</div>
                    <div
                      className={`text-lg font-black ${
                        currentSpO2 < settings.minSpO2 ? 'text-red-500 animate-pulse' : 'text-sky-500'
                      }`}
                    >
                      {currentSpO2}%
                    </div>
                  </div>
                </div>

                {/* Quick Test Trigger Buttons & AI Consult */}
                <div className="mt-3 pt-2.5 border-t border-slate-800/60 flex items-center justify-between gap-2 text-xs flex-wrap">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {onConsultAi && (
                      <button
                        id={`btn-ai-consult-patient-${patient.id}`}
                        onClick={() => onConsultAi(patient.id, 'clinical_doctor')}
                        className="px-2 py-1 bg-indigo-500/20 hover:bg-indigo-500/30 text-indigo-400 rounded border border-indigo-500/30 text-[10px] font-bold transition-colors cursor-pointer flex items-center gap-1"
                        title="Tư vấn phác đồ và an toàn thuốc với Gemini AI"
                      >
                        <Sparkles className="w-3 h-3 text-amber-300" />
                        <span>Hỏi AI</span>
                      </button>
                    )}

                    <button
                      id={`btn-voice-announce-patient-${patient.id}`}
                      onClick={() => {
                        triggerRedAlertVibration(false);
                        speakRedAlertAnnouncement(
                          {
                            patientName: patient.name,
                            roomNumber: patient.roomNumber,
                            heartRate: currentBpm,
                            spO2: currentSpO2,
                            reason: patSeverity.label,
                            severity: patSeverity.severity,
                          },
                          language
                        );
                      }}
                      className={`px-2 py-1 rounded border text-[10px] font-bold transition-colors cursor-pointer flex items-center gap-1 ${
                        patSeverity.severity === 'Fatal' || patSeverity.severity === 'Critical'
                          ? 'bg-red-600 hover:bg-red-500 text-white border-red-500 animate-pulse shadow-xs'
                          : isDark
                          ? 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700'
                          : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-300'
                      }`}
                      title={language === 'vi' ? 'Phát thông báo giọng nói khẩn cấp cho bệnh nhân này' : 'Broadcast voice announcement for this patient'}
                    >
                      <Volume2 className={`w-3 h-3 ${patSeverity.severity === 'Fatal' || patSeverity.severity === 'Critical' ? 'animate-bounce text-white' : 'text-slate-400'}`} />
                      <span>{language === 'vi' ? 'Phát loa' : 'Voice'}</span>
                    </button>
                  </div>
                  <div className="flex gap-1.5">
                    <button
                      id={`btn-inject-vfib-${patient.id}`}
                      onClick={() => onInjectEmergency(patient.id, 'vfib')}
                      className="px-2 py-1 bg-red-500/10 hover:bg-red-500/20 text-red-500 rounded border border-red-500/30 text-[10px] font-bold transition-colors cursor-pointer"
                      title="Bắn nhịp rung thất 172 BPM"
                    >
                      {t.triggerVfib}
                    </button>
                    <button
                      id={`btn-inject-brady-${patient.id}`}
                      onClick={() => onInjectEmergency(patient.id, 'brady')}
                      className="px-2 py-1 bg-amber-500/10 hover:bg-amber-500/20 text-amber-500 rounded border border-amber-500/30 text-[10px] font-bold transition-colors cursor-pointer"
                      title="Bắn nhịp chậm 34 BPM"
                    >
                      {t.triggerBrady}
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* QUICK CONTACT MODAL (SIMULATED PHONE CALL & MESSAGING) */}
      <QuickContactModal
        isOpen={isContactModalOpen}
        onClose={() => setIsContactModalOpen(false)}
        alert={contactAlert}
        currentDoctor={doctor}
        patients={patients}
        doctors={doctors}
        initialMode={contactMode}
        onOpenGmail={onOpenGmail}
      />
    </div>
  );
};
