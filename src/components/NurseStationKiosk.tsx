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
} from 'lucide-react';
import { Alert, Doctor, Patient, SystemSettings, VitalReading } from '../types';
import { useLanguage } from '../context/LanguageContext';
import { useTheme } from '../context/ThemeContext';

interface NurseStationKioskProps {
  alerts: Alert[];
  patients: Patient[];
  doctors: Doctor[];
  recentVitals: Record<string, VitalReading>;
  settings: SystemSettings;
  soundEnabled: boolean;
  onAcknowledgeAlert: (alertId: string, responderName: string) => Promise<void>;
  onInjectEmergency: (patientId: string, heartRate: number, spO2: number) => Promise<void>;
}

export const NurseStationKiosk: React.FC<NurseStationKioskProps> = ({
  alerts,
  patients,
  doctors,
  recentVitals,
  settings,
  soundEnabled,
  onAcknowledgeAlert,
  onInjectEmergency,
}) => {
  const { t, language } = useLanguage();
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const [isFullscreen, setIsFullscreen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const [processingAlertId, setProcessingAlertId] = useState<string | null>(null);

  const pendingAlerts = alerts.filter((a) => a.status === 'Pending');
  const hasPendingAlerts = pendingAlerts.length > 0;

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

                {/* Right: Big Acknowledge Button */}
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

      {/* HOSPITAL WARD FLOOR GRID */}
      <div className="relative z-10 mt-8 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className={`text-base font-bold flex items-center gap-2 ${isDark ? 'text-white' : 'text-slate-900'}`}>
            <Bed className="w-5 h-5 text-indigo-500" />
            {t.bedMapTitle}
          </h3>
          <div className={`flex items-center gap-4 text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" /> {t.bedSafe}
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-ping" /> {t.bedAlerting}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {patients.map((patient) => {
            const reading = recentVitals[patient.id];
            const bpm = reading ? reading.heartRate : 75;
            const spo2 = reading?.spO2 || 98;
            const hasActivePending = alerts.some((a) => a.patientId === patient.id && a.status === 'Pending');
            const hasAcknowledged = alerts.some((a) => a.patientId === patient.id && a.status === 'Acknowledged');

            return (
              <div
                key={patient.id}
                id={`kiosk-room-${patient.roomNumber.replace('.', '')}`}
                className={`rounded-2xl p-4 transition-all border ${
                  hasActivePending
                    ? 'bg-red-950/80 border-2 border-red-500 shadow-xl shadow-red-950/60 animate-pulse'
                    : hasAcknowledged
                    ? isDark ? 'bg-amber-950/40 border-amber-500/50' : 'bg-amber-50 border-amber-300'
                    : isDark ? 'bg-slate-950/80 border-slate-800 hover:border-slate-700' : 'bg-slate-50/80 border-slate-200 hover:border-slate-300 shadow-sm'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <span
                      className={`text-sm font-black px-2.5 py-1 rounded-lg ${
                        hasActivePending
                          ? 'bg-red-600 text-white'
                          : hasAcknowledged
                          ? 'bg-amber-600 text-white'
                          : isDark ? 'bg-slate-800 text-slate-200' : 'bg-slate-200 text-slate-800'
                      }`}
                    >
                      {patient.roomNumber}
                    </span>
                    <span className={`text-xs font-medium ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                      {language === 'vi' ? `Giường ${patient.bed}` : `Bed ${patient.bed}`}
                    </span>
                  </div>

                  {/* Status Tag */}
                  <span
                    className={`text-xs px-2 py-0.5 rounded font-bold ${
                      hasActivePending
                        ? 'bg-red-600 text-white animate-bounce'
                        : hasAcknowledged
                        ? isDark ? 'bg-amber-600/40 text-amber-300 border border-amber-500/40' : 'bg-amber-100 text-amber-800 border border-amber-300'
                        : isDark ? 'bg-emerald-950 text-emerald-400 border border-emerald-800' : 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                    }`}
                  >
                    {hasActivePending
                      ? (language === 'vi' ? 'CẦN HỖ TRỢ GẤP' : 'URGENT ATTENTION')
                      : hasAcknowledged
                      ? (language === 'vi' ? 'Đang can thiệp' : 'In Progress')
                      : (language === 'vi' ? 'Ổn định' : 'Normal')}
                  </span>
                </div>

                <div className="mt-3">
                  <h4 className={`font-bold text-base ${isDark ? 'text-white' : 'text-slate-900'}`}>{patient.name}</h4>
                  <p className={`text-xs mt-0.5 line-clamp-1 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{patient.diagnosis}</p>
                </div>

                {/* Telemetry Display */}
                <div className={`mt-4 pt-3 border-t flex items-center justify-between ${isDark ? 'border-slate-800/80' : 'border-slate-200'}`}>
                  <div>
                    <span className={`text-[10px] uppercase font-semibold ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                      {language === 'vi' ? 'Nhịp tim' : 'Heart Rate'}
                    </span>
                    <div className="flex items-center gap-1">
                      <HeartPulse
                        className={`w-4 h-4 ${hasActivePending ? 'text-red-500' : 'text-emerald-500'}`}
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
                    <span className={`text-[10px] uppercase font-semibold ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>SpO2</span>
                    <div className="text-lg font-mono font-bold text-sky-500">{spo2}%</div>
                  </div>
                </div>

                {/* Quick Simulation Button for Ward */}
                <div className={`mt-3 pt-2 border-t flex justify-end gap-1.5 ${isDark ? 'border-slate-900' : 'border-slate-100'}`}>
                  <button
                    onClick={() => onInjectEmergency(patient.id, 175, 88)}
                    className={`px-2.5 py-1 text-[10px] font-bold rounded-lg border transition-all ${
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
