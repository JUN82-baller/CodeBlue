import React, { useState, useEffect, useRef } from 'react';
import {
  AlertOctagon,
  AlertTriangle,
  BellRing,
  CheckCircle2,
  Maximize2,
  Minimize2,
  Radio,
  ShieldAlert,
  Users,
  Volume2,
  VolumeX,
  Bed,
  Flame,
  HeartPulse,
  UserPlus,
  Edit3,
  Check,
  Filter,
  Activity,
  Layers,
} from 'lucide-react';
import { Alert, Doctor, Patient, SystemSettings, VitalReading, WardBedSlot } from '../types';
import { useLanguage } from '../context/LanguageContext';
import { useTheme } from '../context/ThemeContext';
import { speakRedAlertAnnouncement } from '../services/voiceAnnouncement';
import { triggerRedAlertVibration, triggerAcknowledgeHaptic } from '../services/haptic';

interface NurseStationKioskProps {
  alerts: Alert[];
  patients: Patient[];
  doctors: Doctor[];
  beds?: WardBedSlot[];
  recentVitals: Record<string, VitalReading>;
  settings: SystemSettings;
  soundEnabled: boolean;
  onAcknowledgeAlert: (alertId: string, responderName: string) => Promise<void>;
  onInjectEmergency: (patientId: string, heartRate: number, spO2: number) => Promise<void>;
  onOpenAdmitModal?: (preselectedBed?: { roomNumber: string; bed: string } | null, patient?: Patient | null) => void;
}

export const NurseStationKiosk: React.FC<NurseStationKioskProps> = ({
  alerts,
  patients,
  doctors,
  beds = [],
  recentVitals,
  settings,
  soundEnabled,
  onAcknowledgeAlert,
  onInjectEmergency,
  onOpenAdmitModal,
}) => {
  const { t, language } = useLanguage();
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const [isFullscreen, setIsFullscreen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const [processingAlertId, setProcessingAlertId] = useState<string | null>(null);
  const [bedFilter, setBedFilter] = useState<'all' | 'available' | 'occupied' | 'alert'>('all');

  const pendingAlerts = alerts.filter((a) => a.status === 'Pending');
  const hasPendingAlerts = pendingAlerts.length > 0;

  // Calculate Bed Capacity & Availability
  // If beds list is provided, use it; otherwise fallback to default 13 beds
  const effectiveBeds: WardBedSlot[] =
    beds.length > 0
      ? beds
      : [
          { id: 'P101-G01', roomNumber: 'P.101', bed: 'G01', department: 'Hồi Sức Cấp Cứu (ICU Khu A)', status: 'occupied' },
          { id: 'P101-G02', roomNumber: 'P.101', bed: 'G02', department: 'Hồi Sức Cấp Cứu (ICU Khu A)', status: 'available' },
          { id: 'P102-G01', roomNumber: 'P.102', bed: 'G01', department: 'Hồi Sức Cấp Cứu (ICU Khu A)', status: 'available' },
          { id: 'P102-G02', roomNumber: 'P.102', bed: 'G02', department: 'Hồi Sức Cấp Cứu (ICU Khu A)', status: 'occupied' },
          { id: 'P201-G01', roomNumber: 'P.201', bed: 'G01', department: 'Hồi Sức Tim Mạch (ICU Khu B)', status: 'occupied' },
          { id: 'P201-G02', roomNumber: 'P.201', bed: 'G02', department: 'Hồi Sức Tim Mạch (ICU Khu B)', status: 'available' },
          { id: 'P203-G01', roomNumber: 'P.203', bed: 'G01', department: 'Hồi Sức Can Thiệp Mạch Vành', status: 'available' },
          { id: 'P203-G02', roomNumber: 'P.203', bed: 'G02', department: 'Hồi Sức Can Thiệp Mạch Vành', status: 'available' },
          { id: 'P203-G03', roomNumber: 'P.203', bed: 'G03', department: 'Hồi Sức Can Thiệp Mạch Vành', status: 'occupied' },
          { id: 'P305-G01', roomNumber: 'P.305', bed: 'G01', department: 'Hồi Sức Hô Hấp & Đa Khoa', status: 'available' },
          { id: 'P305-G02', roomNumber: 'P.305', bed: 'G02', department: 'Hồi Sức Hô Hấp & Đa Khoa', status: 'occupied' },
          { id: 'P308-G01', roomNumber: 'P.308', bed: 'G01', department: 'Phòng Lưu Hậu Phẫu Tim', status: 'occupied' },
          { id: 'P308-G02', roomNumber: 'P.308', bed: 'G02', department: 'Phòng Lưu Hậu Phẫu Tim', status: 'available' },
        ];

  // Match each bed with its current patient if any
  const mappedBeds = effectiveBeds.map((b) => {
    const occupant = patients.find(
      (p) =>
        (p.roomNumber.trim().toLowerCase() === b.roomNumber.trim().toLowerCase() &&
         p.bed.trim().toLowerCase() === b.bed.trim().toLowerCase()) ||
        p.id === b.patientId
    );
    const isOccupied = !!occupant;
    const hasActivePending = occupant ? alerts.some((a) => a.patientId === occupant.id && a.status === 'Pending') : false;
    const hasAcknowledged = occupant ? alerts.some((a) => a.patientId === occupant.id && a.status === 'Acknowledged') : false;

    return {
      ...b,
      status: isOccupied ? ('occupied' as const) : ('available' as const),
      occupant,
      hasActivePending,
      hasAcknowledged,
    };
  });

  const totalBeds = mappedBeds.length;
  const occupiedBeds = mappedBeds.filter((b) => b.status === 'occupied').length;
  const availableBeds = totalBeds - occupiedBeds;
  const occupancyRate = totalBeds > 0 ? Math.round((occupiedBeds / totalBeds) * 100) : 0;
  const alertBedsCount = mappedBeds.filter((b) => b.hasActivePending).length;

  // Filtered beds list
  const filteredBeds = mappedBeds.filter((b) => {
    if (bedFilter === 'available') return b.status === 'available';
    if (bedFilter === 'occupied') return b.status === 'occupied';
    if (bedFilter === 'alert') return b.hasActivePending;
    return true;
  });

  // Toggle fullscreen mode
  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      containerRef.current?.requestFullscreen().catch((err) => {
        console.warn('Could not activate fullscreen:', err);
      });
      setIsFullscreen(true);
    } else {
      document.exitFullscreen().catch(() => {});
      setIsFullscreen(false);
    }
  };

  // Listen to fullscreenchange
  useEffect(() => {
    const handleFsChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFsChange);
    return () => document.removeEventListener('fullscreenchange', handleFsChange);
  }, []);

  const handleKioskAcknowledge = async (alertId: string) => {
    triggerAcknowledgeHaptic();
    setProcessingAlertId(alertId);
    try {
      await onAcknowledgeAlert(
        alertId,
        language === 'vi' ? 'Điều Dưỡng Trực Trạm' : 'Nurse Station Staff'
      );
    } catch (err) {
      console.error('Error acknowledging alert in kiosk:', err);
    } finally {
      setProcessingAlertId(null);
    }
  };

  return (
    <div
      ref={containerRef}
      id="nurse-station-kiosk-view"
      className={`relative min-h-[85vh] rounded-3xl p-6 transition-all duration-500 ${
        hasPendingAlerts
          ? 'bg-slate-950 border-4 border-red-600 shadow-[0_0_80px_rgba(220,38,38,0.4)]'
          : isDark
          ? 'bg-slate-900 border border-slate-800'
          : 'bg-white border border-slate-200 shadow-xl'
      } ${isFullscreen ? 'p-8 min-h-screen overflow-y-auto' : ''}`}
    >
      {/* BACKGROUND ROTATING SIREN LIGHT / FLASH EFFECT WHEN PENDING ALERT EXISTS */}
      {hasPendingAlerts && (
        <div className="absolute inset-0 pointer-events-none overflow-hidden rounded-3xl z-0">
          {/* Pulsing red vignette */}
          <div className="absolute inset-0 bg-red-600/15 animate-pulse" />
          {/* Rotating beacon sweep beam */}
          <div className="absolute -top-[50%] -left-[50%] w-[200%] h-[200%] bg-[conic-gradient(from_0deg,transparent_0deg,rgba(239,68,68,0.25)_60deg,transparent_120deg)] animate-[spin_3s_linear_infinite]" />
        </div>
      )}

      {/* TOP KIOSK HEADER BAR */}
      <div className={`relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border-b pb-5 ${isDark ? 'border-slate-800/80' : 'border-slate-200'}`}>
        <div className="flex items-center gap-3.5">
          <div
            className={`w-12 h-12 rounded-2xl flex items-center justify-center font-bold text-white shadow-lg ${
              hasPendingAlerts ? 'bg-red-600 animate-bounce shadow-red-900/60' : 'bg-indigo-600 shadow-indigo-900/40'
            }`}
          >
            {hasPendingAlerts ? <BellRing className="w-6 h-6 animate-spin" /> : <Radio className="w-6 h-6" />}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className={`text-xl font-black tracking-tight uppercase ${isDark ? 'text-white' : 'text-slate-900'}`}>
                {t.kioskTitle}
              </h2>
            </div>
            <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
              {t.kioskSubtitle}
            </p>
          </div>
        </div>

        {/* Kiosk Controls */}
        <div className="flex items-center gap-3">
          <button
            id="btn-kiosk-fullscreen"
            onClick={toggleFullscreen}
            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-all border ${
              isDark
                ? 'bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white border-slate-700'
                : 'bg-slate-100 hover:bg-slate-200 text-slate-700 hover:text-slate-900 border-slate-300'
            }`}
          >
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            <span>{isFullscreen ? t.btnExitFullscreen : t.btnFullscreen}</span>
          </button>
        </div>
      </div>

      {/* EMERGENCY HIGHLIGHT BANNER FOR NURSE STATION */}
      {hasPendingAlerts ? (
        <div className="relative z-10 mt-6 space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-red-500 text-sm font-black tracking-wider uppercase flex items-center gap-2 animate-pulse">
              <Flame className="w-5 h-5 text-red-500" />
              {t.emergencyRoomActive} ({pendingAlerts.length})
            </span>
            <span className="text-xs text-red-300 font-medium bg-red-950/80 px-3 py-1 rounded-full border border-red-700/60 animate-pulse">
              {t.sirenActiveNotice}
            </span>
          </div>

          <div className="grid grid-cols-1 gap-4">
            {pendingAlerts.map((alert) => (
              <div
                key={alert.id}
                id={`nurse-alert-card-${alert.id}`}
                className="bg-red-950/90 border-4 border-red-500 rounded-3xl p-6 shadow-2xl backdrop-blur-md flex flex-col xl:flex-row items-start xl:items-center justify-between gap-6"
              >
                {/* Left: Giant Room Callout */}
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <span className="px-4 py-1.5 bg-red-600 text-white font-black text-lg rounded-xl shadow-lg animate-pulse">
                      🚨 {t.room} {alert.roomNumber}
                    </span>
                    <span className="px-3 py-1 bg-slate-900/90 text-amber-300 border border-amber-500/50 rounded-lg text-sm font-bold">
                      {alert.severity === 'Fatal' ? t.codeRed : t.criticalAlert}
                    </span>
                  </div>

                  <div>
                    <h3 className="text-3xl sm:text-4xl font-black text-white tracking-tight">{alert.patientName}</h3>
                    <p className="text-base font-bold text-red-200 mt-1 flex items-center gap-2">
                      <AlertOctagon className="w-5 h-5 text-red-400" />
                      {alert.reason}
                    </p>
                  </div>
                </div>

                {/* Center: Heart Rate Value */}
                <div className="bg-slate-950/90 border-2 border-red-500/60 rounded-2xl px-6 py-4 text-center min-w-[220px]">
                  <div className="text-xs uppercase font-bold text-slate-400">{t.kioskHeartRate}</div>
                  <div className="text-5xl font-black text-red-400 flex items-center justify-center gap-2 mt-1">
                    <HeartPulse className="w-9 h-9 text-red-500 animate-ping" />
                    <span>{alert.heartRate}</span>
                    <span className="text-sm font-bold text-slate-400">BPM</span>
                  </div>
                  {alert.spO2 !== undefined && (
                    <div className="text-sm font-bold text-sky-400 mt-1">SpO2: {alert.spO2}%</div>
                  )}
                </div>

                {/* Right: Big Acknowledge Button & Voice Broadcast */}
                <div className="w-full xl:w-auto flex flex-col gap-2 min-w-[260px]">
                  <button
                    id={`btn-ack-nurse-${alert.id}`}
                    onClick={() => handleKioskAcknowledge(alert.id)}
                    disabled={processingAlertId === alert.id}
                    className="w-full px-8 py-5 bg-gradient-to-r from-red-600 via-rose-600 to-red-600 hover:from-red-500 hover:to-red-500 active:scale-95 text-white font-black text-lg rounded-2xl shadow-xl shadow-red-950/80 transition-all flex items-center justify-center gap-3 cursor-pointer border-2 border-white/20 animate-pulse disabled:opacity-75 disabled:cursor-not-allowed"
                  >
                    <CheckCircle2 className="w-6 h-6" />
                    <span>{processingAlertId === alert.id ? t.btnAcknowledging : t.btnNurseAcknowledge}</span>
                  </button>

                  <button
                    id={`btn-kiosk-voice-${alert.id}`}
                    onClick={() => {
                      triggerRedAlertVibration(false);
                      speakRedAlertAnnouncement(alert, language);
                    }}
                    className="w-full py-2.5 px-4 bg-slate-900/90 hover:bg-slate-800 text-amber-300 text-xs font-bold rounded-xl border border-amber-400/40 transition-colors flex items-center justify-center gap-2 cursor-pointer"
                    title={language === 'vi' ? 'Phát loa thông báo khẩn cấp ngay' : 'Broadcast voice announcement now'}
                  >
                    <Volume2 className="w-4 h-4 text-amber-400 animate-bounce" />
                    <span>{language === 'vi' ? 'Phát loa thông báo giọng nói' : 'Broadcast Voice Announcement'}</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className={`relative z-10 mt-6 border rounded-2xl p-4 flex items-center justify-between ${
          isDark ? 'bg-slate-950/60 border-emerald-500/30' : 'bg-emerald-50/70 border-emerald-200'
        }`}>
          <div className="flex items-center gap-3 text-emerald-600">
            <CheckCircle2 className="w-6 h-6" />
            <div>
              <span className="font-bold text-sm">
                {language === 'vi' ? 'Tất cả phòng bệnh trong tầm kiểm soát an toàn' : 'All patient rooms are secure and stable'}
              </span>
              <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                {language === 'vi' ? 'Không có cảnh báo khẩn cấp nào đang chờ xử lý.' : 'No active emergency alarms pending.'}
              </p>
            </div>
          </div>
          <span className={`text-xs font-semibold px-3 py-1 rounded-full border ${
            isDark ? 'bg-emerald-950 text-emerald-400 border-emerald-800' : 'bg-emerald-100 text-emerald-800 border-emerald-300'
          }`}>
            {language === 'vi' ? 'HỆ THỐNG SẴN SÀNG' : 'SYSTEM READY'}
          </span>
        </div>
      )}

      {/* BED MANAGEMENT & OCCUPANCY CAPACITY DASHBOARD */}
      <div className="relative z-10 mt-6 space-y-4">
        {/* KPI Statistics Row */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
          {/* Card 1: Total Ward Beds */}
          <div
            className={`p-4 rounded-2xl border transition-all ${
              isDark ? 'bg-slate-950/80 border-slate-800' : 'bg-slate-50 border-slate-200'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className={`text-xs font-semibold ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                {language === 'vi' ? 'Tổng công suất buồng' : 'Total Ward Beds'}
              </span>
              <div className="p-1.5 rounded-lg bg-indigo-500/10 text-indigo-500">
                <Bed className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl font-black font-mono">{totalBeds}</span>
              <span className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                {language === 'vi' ? 'giường ICU' : 'ICU beds'}
              </span>
            </div>
            <div className="mt-2 text-[11px] text-slate-400 flex items-center gap-1">
              <Layers className="w-3 h-3 text-slate-500" />
              <span>{language === 'vi' ? 'Phân bổ trên 6 buồng hồi sức' : 'Across 6 acute care units'}</span>
            </div>
          </div>

          {/* Card 2: Available Beds (Còn trống) */}
          <div
            className={`p-4 rounded-2xl border transition-all ${
              availableBeds > 0
                ? isDark
                  ? 'bg-emerald-950/30 border-emerald-500/40 text-emerald-400'
                  : 'bg-emerald-50 border-emerald-300 text-emerald-800'
                : isDark
                ? 'bg-rose-950/30 border-rose-500/40 text-rose-400'
                : 'bg-rose-50 border-rose-300 text-rose-800'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider">
                {language === 'vi' ? 'Giường còn trống' : 'Available Beds'}
              </span>
              <div
                className={`p-1.5 rounded-lg ${
                  availableBeds > 0 ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'
                }`}
              >
                <CheckCircle2 className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl font-black font-mono">{availableBeds}</span>
              <span className="text-xs font-semibold">
                / {totalBeds} {language === 'vi' ? 'giường sẵn sàng' : 'ready beds'}
              </span>
            </div>
            <div className="mt-2 text-[11px] font-medium opacity-90">
              {availableBeds > 0
                ? language === 'vi'
                  ? '🟢 Sẵn sàng tiếp nhận bệnh nhân mới'
                  : '🟢 Ready for patient admission'
                : language === 'vi'
                ? '🔴 Đã kín giường - Cần điều chuyển'
                : '🔴 Full capacity - Reroute needed'}
            </div>
          </div>

          {/* Card 3: Occupied Beds & Occupancy Rate */}
          <div
            className={`p-4 rounded-2xl border transition-all ${
              isDark ? 'bg-slate-950/80 border-slate-800' : 'bg-slate-50 border-slate-200'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className={`text-xs font-semibold ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                {language === 'vi' ? 'Đang điều trị (Lấp đầy)' : 'Occupied (Rate)'}
              </span>
              <div className="p-1.5 rounded-lg bg-blue-500/10 text-blue-500">
                <Activity className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl font-black font-mono">{occupiedBeds}</span>
              <span className="text-xs font-bold text-blue-500 font-mono">({occupancyRate}%)</span>
            </div>
            {/* Occupancy progress bar */}
            <div className="mt-2.5 w-full bg-slate-700/30 h-1.5 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${
                  occupancyRate >= 90
                    ? 'bg-rose-500'
                    : occupancyRate >= 70
                    ? 'bg-amber-500'
                    : 'bg-blue-500'
                }`}
                style={{ width: `${Math.min(100, occupancyRate)}%` }}
              />
            </div>
          </div>

          {/* Card 4: Urgent Emergency Alerts */}
          <div
            className={`p-4 rounded-2xl border transition-all flex flex-col justify-between ${
              alertBedsCount > 0
                ? isDark
                  ? 'bg-red-950/40 border-red-500 shadow-lg shadow-red-950/50 animate-pulse'
                  : 'bg-red-50 border-red-300'
                : isDark
                ? 'bg-slate-950/80 border-slate-800'
                : 'bg-slate-50 border-slate-200'
            }`}
          >
            <div>
              <div className="flex items-center justify-between">
                <span
                  className={`text-xs font-bold ${
                    alertBedsCount > 0 ? 'text-red-400' : isDark ? 'text-slate-400' : 'text-slate-500'
                  }`}
                >
                  {language === 'vi' ? 'Giường cần can thiệp' : 'Critical Bed Alarms'}
                </span>
                <div
                  className={`p-1.5 rounded-lg ${
                    alertBedsCount > 0 ? 'bg-red-500/20 text-red-400' : 'bg-slate-500/10 text-slate-400'
                  }`}
                >
                  <AlertOctagon className="w-4 h-4" />
                </div>
              </div>
              <div className="mt-2 flex items-baseline gap-2">
                <span
                  className={`text-2xl font-black font-mono ${
                    alertBedsCount > 0 ? 'text-red-500' : isDark ? 'text-white' : 'text-slate-900'
                  }`}
                >
                  {alertBedsCount}
                </span>
                <span className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                  {language === 'vi' ? 'ca báo động đỏ' : 'urgent cases'}
                </span>
              </div>
            </div>

            {/* Quick Admit Button */}
            {onOpenAdmitModal && (
              <button
                id="btn-kiosk-admit-patient-top"
                onClick={() => onOpenAdmitModal(null, null)}
                className="mt-2.5 py-1.5 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-all shadow flex items-center justify-center gap-1.5 cursor-pointer active:scale-95"
              >
                <UserPlus className="w-3.5 h-3.5" />
                <span>{language === 'vi' ? '+ Tiếp nhận bệnh nhân' : '+ Admit Patient'}</span>
              </button>
            )}
          </div>
        </div>

        {/* Filter Chips & Section Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pt-2">
          <div className="flex items-center gap-2">
            <Bed className="w-5 h-5 text-indigo-500" />
            <h3 className={`text-base font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>
              {language === 'vi' ? 'SƠ ĐỒ BUỒNG GIƯỜNG & TELEMETRY ICU' : 'ICU WARD BED MATRIX & TELEMETRY'}
            </h3>
            <span
              className={`text-xs px-2.5 py-0.5 rounded-full font-bold border ${
                isDark ? 'bg-slate-800 text-slate-300 border-slate-700' : 'bg-slate-100 text-slate-700 border-slate-300'
              }`}
            >
              {language === 'vi' ? `Còn trống ${availableBeds}/${totalBeds} giường` : `${availableBeds}/${totalBeds} available`}
            </span>
          </div>

          {/* Filter Chips */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <button
              onClick={() => setBedFilter('all')}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition-colors cursor-pointer border ${
                bedFilter === 'all'
                  ? 'bg-indigo-600 text-white border-indigo-500'
                  : isDark
                  ? 'bg-slate-900 border-slate-700 text-slate-400 hover:text-white'
                  : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-100'
              }`}
            >
              {language === 'vi' ? `Tất cả (${totalBeds})` : `All (${totalBeds})`}
            </button>

            <button
              onClick={() => setBedFilter('available')}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition-colors cursor-pointer border flex items-center gap-1.5 ${
                bedFilter === 'available'
                  ? 'bg-emerald-600 text-white border-emerald-500'
                  : isDark
                  ? 'bg-slate-900 border-slate-700 text-emerald-400 hover:text-emerald-300'
                  : 'bg-white border-slate-200 text-emerald-700 hover:bg-emerald-50'
              }`}
            >
              <span className="w-2 h-2 rounded-full bg-emerald-400" />
              {language === 'vi' ? `Còn trống (${availableBeds})` : `Available (${availableBeds})`}
            </button>

            <button
              onClick={() => setBedFilter('occupied')}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition-colors cursor-pointer border flex items-center gap-1.5 ${
                bedFilter === 'occupied'
                  ? 'bg-blue-600 text-white border-blue-500'
                  : isDark
                  ? 'bg-slate-900 border-slate-700 text-blue-400 hover:text-blue-300'
                  : 'bg-white border-slate-200 text-blue-700 hover:bg-blue-50'
              }`}
            >
              <span className="w-2 h-2 rounded-full bg-blue-400" />
              {language === 'vi' ? `Đang dùng (${occupiedBeds})` : `Occupied (${occupiedBeds})`}
            </button>

            {alertBedsCount > 0 && (
              <button
                onClick={() => setBedFilter('alert')}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition-colors cursor-pointer border flex items-center gap-1.5 ${
                  bedFilter === 'alert'
                    ? 'bg-red-600 text-white border-red-500 animate-pulse'
                    : isDark
                    ? 'bg-slate-900 border-slate-700 text-red-400 hover:text-red-300'
                    : 'bg-white border-slate-200 text-red-700 hover:bg-red-50'
                }`}
              >
                <span className="w-2 h-2 rounded-full bg-red-500 animate-ping" />
                {language === 'vi' ? `Có cảnh báo (${alertBedsCount})` : `Alerts (${alertBedsCount})`}
              </button>
            )}
          </div>
        </div>

        {/* WARD BED TILES MATRIX */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredBeds.map((bedSlot) => {
            const patient = bedSlot.occupant;

            // CASE 1: OCCUPIED BED (CÓ BỆNH NHÂN ĐANG NẰM)
            if (patient) {
              const reading = recentVitals[patient.id];
              const bpm = reading ? reading.heartRate : patient.initialHeartRate || 75;
              const spo2 = reading ? reading.spO2 : patient.initialSpO2 || 98;
              const hasActivePending = bedSlot.hasActivePending;
              const hasAcknowledged = bedSlot.hasAcknowledged;

              return (
                <div
                  key={bedSlot.id}
                  id={`kiosk-bed-${bedSlot.roomNumber.replace(/[^a-zA-Z0-9]/g, '')}-${bedSlot.bed}`}
                  className={`rounded-2xl p-4 transition-all border relative flex flex-col justify-between ${
                    hasActivePending
                      ? 'bg-red-950/80 border-2 border-red-500 shadow-xl shadow-red-950/60 animate-pulse'
                      : hasAcknowledged
                      ? isDark
                        ? 'bg-amber-950/40 border-amber-500/50'
                        : 'bg-amber-50 border-amber-300'
                      : isDark
                      ? 'bg-slate-950/80 border-slate-800 hover:border-slate-700'
                      : 'bg-slate-50/80 border-slate-200 hover:border-slate-300 shadow-sm'
                  }`}
                >
                  <div>
                    {/* Header: Room, Bed, and Status Badge */}
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2">
                        <span
                          className={`text-sm font-black px-2.5 py-1 rounded-lg ${
                            hasActivePending
                              ? 'bg-red-600 text-white'
                              : hasAcknowledged
                              ? 'bg-amber-600 text-white'
                              : isDark
                              ? 'bg-slate-800 text-slate-200'
                              : 'bg-slate-200 text-slate-800'
                          }`}
                        >
                          {bedSlot.roomNumber}
                        </span>
                        <span className={`text-xs font-bold px-2 py-0.5 rounded ${
                          isDark ? 'bg-blue-500/20 text-blue-400' : 'bg-blue-50 text-blue-700 border border-blue-200'
                        }`}>
                          {language === 'vi' ? `Giường ${bedSlot.bed}` : `Bed ${bedSlot.bed}`}
                        </span>
                      </div>

                      {/* Status Tag */}
                      <span
                        className={`text-xs px-2.5 py-0.5 rounded-full font-bold ${
                          hasActivePending
                            ? 'bg-red-600 text-white animate-bounce'
                            : hasAcknowledged
                            ? isDark
                              ? 'bg-amber-600/40 text-amber-300 border border-amber-500/40'
                              : 'bg-amber-100 text-amber-800 border border-amber-300'
                            : isDark
                            ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                            : 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                        }`}
                      >
                        {hasActivePending
                          ? language === 'vi'
                            ? 'CẦN HỖ TRỢ GẤP'
                            : 'URGENT ATTENTION'
                          : hasAcknowledged
                          ? language === 'vi'
                            ? 'Đang can thiệp'
                            : 'In Progress'
                          : language === 'vi'
                          ? 'Ổn định'
                          : 'Normal'}
                      </span>
                    </div>

                    {/* Patient Name & Diagnosis */}
                    <div className="mt-3">
                      <div className="flex items-baseline justify-between">
                        <h4 className={`font-bold text-base ${isDark ? 'text-white' : 'text-slate-900'}`}>
                          {patient.name}
                        </h4>
                        <span className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                          {patient.age} {language === 'vi' ? 'tuổi' : 'y/o'} • {patient.gender || 'Nam'}
                        </span>
                      </div>
                      <p className={`text-xs mt-1 line-clamp-1 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                        {patient.diagnosis}
                      </p>
                    </div>

                    {/* Telemetry Display */}
                    <div
                      className={`mt-4 pt-3 border-t flex items-center justify-between ${
                        isDark ? 'border-slate-800/80' : 'border-slate-200'
                      }`}
                    >
                      <div>
                        <span className={`text-[10px] uppercase font-semibold ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                          {language === 'vi' ? 'Nhịp tim' : 'Heart Rate'}
                        </span>
                        <div className="flex items-center gap-1.5">
                          <HeartPulse
                            className={`w-4 h-4 ${
                              hasActivePending
                                ? 'text-red-500 animate-ping'
                                : 'text-emerald-500'
                            }`}
                          />
                          <span
                            className={`text-xl font-mono font-black ${
                              hasActivePending ? 'text-red-500' : 'text-emerald-500'
                            }`}
                          >
                            {bpm}
                          </span>
                          <span className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>bpm</span>
                        </div>
                      </div>

                      <div className="text-right">
                        <span className={`text-[10px] uppercase font-semibold ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                          SpO2
                        </span>
                        <div className="text-lg font-mono font-bold text-sky-500">{spo2}%</div>
                      </div>
                    </div>
                  </div>

                  {/* Actions Row */}
                  <div
                    className={`mt-3 pt-2.5 border-t flex items-center justify-between gap-2 ${
                      isDark ? 'border-slate-900' : 'border-slate-100'
                    }`}
                  >
                    {/* Edit / Patient Record Button */}
                    {onOpenAdmitModal && (
                      <button
                        id={`btn-edit-patient-${patient.id}`}
                        onClick={() => onOpenAdmitModal(null, patient)}
                        className={`px-2.5 py-1 text-[11px] font-semibold rounded-lg border transition-colors flex items-center gap-1 cursor-pointer ${
                          isDark
                            ? 'bg-slate-900 hover:bg-slate-800 text-slate-300 border-slate-700'
                            : 'bg-white hover:bg-slate-100 text-slate-700 border-slate-300'
                        }`}
                        title={language === 'vi' ? 'Sửa thông tin hoặc xuất viện' : 'Edit record or discharge'}
                      >
                        <Edit3 className="w-3 h-3 text-blue-400" />
                        <span>{language === 'vi' ? 'Sửa / Hồ sơ' : 'Edit'}</span>
                      </button>
                    )}

                    {/* Quick Simulation Button for Ward */}
                    <button
                      id={`btn-inject-emergency-${patient.id}`}
                      onClick={() => onInjectEmergency(patient.id, 175, 88)}
                      className={`px-2.5 py-1 text-[10px] font-bold rounded-lg border transition-all cursor-pointer ${
                        isDark
                          ? 'bg-red-950 hover:bg-red-900 text-red-300 border-red-800/60'
                          : 'bg-red-50 hover:bg-red-100 text-red-700 border-red-200'
                      }`}
                    >
                      {t.testTriggerBed}
                    </button>
                  </div>
                </div>
              );
            }

            // CASE 2: AVAILABLE / EMPTY BED (GIƯỜNG CÒN TRỐNG - SẴN SÀNG TIẾP NHẬN)
            return (
              <div
                key={bedSlot.id}
                id={`kiosk-empty-bed-${bedSlot.roomNumber.replace(/[^a-zA-Z0-9]/g, '')}-${bedSlot.bed}`}
                className={`rounded-2xl p-4 transition-all border-2 border-dashed flex flex-col justify-between min-h-[220px] ${
                  isDark
                    ? 'bg-slate-950/40 border-slate-800 hover:border-emerald-500/50 hover:bg-emerald-950/10'
                    : 'bg-emerald-50/20 border-slate-300 hover:border-emerald-400 hover:bg-emerald-50/40'
                }`}
              >
                <div>
                  {/* Bed Header */}
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2">
                      <span
                        className={`text-sm font-black px-2.5 py-1 rounded-lg ${
                          isDark ? 'bg-slate-900 text-slate-300 border border-slate-700' : 'bg-slate-100 text-slate-700 border border-slate-300'
                        }`}
                      >
                        {bedSlot.roomNumber}
                      </span>
                      <span className={`text-xs font-bold px-2 py-0.5 rounded ${
                        isDark ? 'bg-slate-800 text-slate-400' : 'bg-slate-100 text-slate-600'
                      }`}>
                        {language === 'vi' ? `Giường ${bedSlot.bed}` : `Bed ${bedSlot.bed}`}
                      </span>
                    </div>

                    <span className="text-xs px-2.5 py-0.5 rounded-full font-bold bg-emerald-500/15 text-emerald-500 border border-emerald-500/30 flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                      {language === 'vi' ? 'CÒN TRỐNG' : 'AVAILABLE'}
                    </span>
                  </div>

                  {/* Bed description / department */}
                  <div className="mt-4 text-center py-2">
                    <div className="w-10 h-10 mx-auto rounded-full bg-emerald-500/10 text-emerald-500 flex items-center justify-center mb-2">
                      <Bed className="w-5 h-5" />
                    </div>
                    <h4 className={`text-xs font-bold ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                      {bedSlot.department || 'Khoa Hồi Sức Tích Cực (ICU)'}
                    </h4>
                    <p className={`text-[11px] mt-0.5 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                      {language === 'vi'
                        ? 'Giường sẵn sàng, hệ thống monitor và oxy đang chờ kết nối'
                        : 'Bed is clean and ready. Monitor awaiting patient.'}
                    </p>
                  </div>
                </div>

                {/* Big friendly admission button */}
                <div className="pt-2">
                  <button
                    id={`btn-admit-to-${bedSlot.roomNumber.replace(/[^a-zA-Z0-9]/g, '')}-${bedSlot.bed}`}
                    onClick={() =>
                      onOpenAdmitModal?.({ roomNumber: bedSlot.roomNumber, bed: bedSlot.bed }, null)
                    }
                    className="w-full py-2 px-3 rounded-xl bg-emerald-600/90 hover:bg-emerald-600 active:scale-98 text-white text-xs font-bold transition-all shadow-sm flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <UserPlus className="w-3.5 h-3.5" />
                    <span>{language === 'vi' ? '+ Nhập bệnh nhân cho giường này' : '+ Admit Patient to Bed'}</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ON-CALL DOCTORS ON DUTY BOARD */}
      <div className={`relative z-10 mt-8 border rounded-2xl p-5 ${
        isDark ? 'bg-slate-950/80 border-slate-800' : 'bg-slate-50 border-slate-200 shadow-sm'
      }`}>
        <div className="flex items-center justify-between mb-4">
          <h3 className={`text-sm font-bold flex items-center gap-2 ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>
            <Users className="w-4 h-4 text-blue-500" />
            {language === 'vi' ? 'DANH SÁCH BÁC SĨ TRỰC CA HIỆN TẠI' : 'ON-DUTY MEDICAL STAFF DIRECTORY'}
          </h3>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {doctors.map((doc) => (
            <div
              key={doc.id}
              className={`p-3 rounded-xl border flex flex-col justify-between ${
                doc.isOnCall
                  ? isDark ? 'bg-blue-950/40 border-blue-600/40' : 'bg-blue-50/70 border-blue-200'
                  : isDark ? 'bg-slate-900 border-slate-800 opacity-70' : 'bg-white border-slate-200 opacity-75'
              }`}
            >
              <div>
                <div className="flex items-center justify-between">
                  <span className={`text-xs font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>{doc.name}</span>
                  <span
                    className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${
                      doc.isOnCall ? 'bg-emerald-600 text-white' : isDark ? 'bg-slate-800 text-slate-400' : 'bg-slate-200 text-slate-700'
                    }`}
                  >
                    {doc.isOnCall
                      ? (language === 'vi' ? 'Trực Chính' : 'Primary On-Call')
                      : (language === 'vi' ? 'Dự Phòng' : 'Backup')}
                  </span>
                </div>
                <div className={`text-[11px] mt-1 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{doc.department}</div>
              </div>
              <div className="text-[11px] text-blue-500 font-mono mt-2 flex items-center gap-1">
                📞 {doc.phone}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
