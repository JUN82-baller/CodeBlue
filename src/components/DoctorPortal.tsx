import React, { useState, useEffect } from 'react';
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  Heart,
  Phone,
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
} from 'lucide-react';
import { Alert, Doctor, Patient, SystemSettings, VitalReading } from '../types';
import { useLanguage } from '../context/LanguageContext';
import { useTheme } from '../context/ThemeContext';

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
  doctors?: Doctor[];
  selectedDoctorId?: string;
  setSelectedDoctorId?: (id: string) => void;
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
  doctors = [],
  selectedDoctorId,
  setSelectedDoctorId,
}) => {
  const { t, language } = useLanguage();
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  const [resolvingAlertId, setResolvingAlertId] = useState<string | null>(null);
  const [resolveNote, setResolveNote] = useState('');
  const [processingAlertId, setProcessingAlertId] = useState<string | null>(null);

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

        {/* On-Call Duty Switch */}
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

              return (
                <div
                  key={alert.id}
                  id={`doctor-alert-${alert.id}`}
                  className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-red-950 via-slate-900 to-red-950 border-2 border-red-500 shadow-2xl shadow-red-950/80 p-5 sm:p-6 text-white"
                >
                  {/* Flashing accent bar */}
                  <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-red-500 via-amber-400 to-red-500 animate-pulse" />

                  <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
                    {/* Left: Patient & Room Info */}
                    <div className="space-y-2 flex-1">
                      <div className="flex items-center gap-2.5 flex-wrap">
                        <span className="px-3 py-1 rounded-lg bg-red-600 text-white font-black text-sm tracking-wide shadow-md flex items-center gap-1.5">
                          <AlertTriangle className="w-4 h-4" />
                          {alert.severity === 'Fatal' ? t.codeRed : t.criticalAlert}
                        </span>
                        <span className="px-3 py-1 rounded-lg bg-slate-800 border border-slate-700 text-white font-bold text-sm flex items-center gap-1.5">
                          <Bed className="w-4 h-4 text-blue-400" />
                          {t.room} {alert.roomNumber}
                        </span>
                      </div>

                      <div className="flex items-baseline gap-3">
                        <h4 className="text-2xl font-black text-white">{alert.patientName}</h4>
                        <span className="text-xs text-slate-400">{t.patientCode} {alert.patientId}</span>
                      </div>

                      <p className="text-sm font-semibold text-rose-300 flex items-center gap-1.5">
                        <Heart className="w-4 h-4 text-red-500 animate-ping" />
                        {alert.reason}
                      </p>
                    </div>

                    {/* Middle: Live Heart Rate Metric Box */}
                    <div className="flex items-center gap-4 bg-slate-950/80 border border-red-500/40 rounded-xl p-4 min-w-[200px] justify-center">
                      <div className="text-center">
                        <div className="text-xs text-slate-400 uppercase font-semibold">{t.measuredHR}</div>
                        <div className="text-4xl font-black text-red-400 flex items-center justify-center gap-1">
                          <Heart className="w-7 h-7 text-red-500 fill-red-500 animate-bounce" />
                          <span>{alert.heartRate}</span>
                          <span className="text-xs text-slate-400 font-normal ml-0.5">BPM</span>
                        </div>
                        {alert.spO2 !== undefined && (
                          <div className="text-xs font-bold text-sky-400 mt-1">SpO2: {alert.spO2}%</div>
                        )}
                      </div>
                    </div>

                    {/* Right: Escalation Status & Acknowledge Action Button */}
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

                      {/* Primary Acknowledge Button */}
                      <button
                        id={`btn-ack-doctor-${alert.id}`}
                        onClick={() => handleAcknowledge(alert.id)}
                        disabled={processingAlertId === alert.id}
                        className="w-full px-6 py-3.5 bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white font-black text-base rounded-xl shadow-lg shadow-emerald-950/50 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-75"
                      >
                        <CheckCircle2 className="w-5 h-5" />
                        <span>{processingAlertId === alert.id ? t.btnAcknowledging : t.btnAcknowledgeNow}</span>
                      </button>
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
          <h3 className="text-base font-bold text-amber-500 flex items-center gap-2">
            <Clock className="w-5 h-5 text-amber-500" />
            {t.acknowledgedAlertsHeader} ({acknowledgedAlerts.length})
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {acknowledgedAlerts.map((alert) => (
              <div
                key={alert.id}
                id={`ack-alert-card-${alert.id}`}
                className={`border rounded-xl p-4 shadow-md space-y-3 ${
                  isDark ? 'bg-slate-900 border-amber-500/40 text-white' : 'bg-white border-amber-300 text-slate-900'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-base">{alert.patientName}</span>
                      <span className="text-xs px-2 py-0.5 bg-blue-500/20 text-blue-500 rounded font-semibold border border-blue-500/30">
                        {t.room} {alert.roomNumber}
                      </span>
                    </div>
                    <p className="text-xs text-amber-500 font-semibold mt-1">{alert.reason}</p>
                  </div>
                  <div className="text-right">
                    <span className="text-lg font-black text-amber-500">{alert.heartRate} BPM</span>
                    <div className={`text-[11px] ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                      {alert.acknowledgedAt ? new Date(alert.acknowledgedAt).toLocaleTimeString(language === 'vi' ? 'vi-VN' : 'en-US') : ''}
                    </div>
                  </div>
                </div>

                <div className={`text-xs flex items-center justify-between border-t pt-2 ${isDark ? 'border-slate-800 text-slate-400' : 'border-slate-100 text-slate-600'}`}>
                  <span>{t.acknowledgedBy} <strong className={isDark ? 'text-slate-200' : 'text-slate-800'}>{alert.acknowledgedBy}</strong></span>
                  <span>{t.responseTime} <strong className="text-emerald-500">{alert.responseTimeSeconds}s</strong></span>
                </div>

                {/* Resolve Action */}
                {resolvingAlertId === alert.id ? (
                  <div className={`space-y-2 p-3 rounded-lg border ${isDark ? 'bg-slate-950 border-slate-800' : 'bg-slate-50 border-slate-200'}`}>
                    <input
                      type="text"
                      placeholder={t.clinicalNotesPlaceholder}
                      value={resolveNote}
                      onChange={(e) => setResolveNote(e.target.value)}
                      className={`w-full rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-emerald-500 border ${
                        isDark ? 'bg-slate-900 border-slate-700 text-white' : 'bg-white border-slate-300 text-slate-900'
                      }`}
                    />
                    <div className="flex gap-2 justify-end">
                      <button
                        onClick={() => setResolvingAlertId(null)}
                        className={`px-3 py-1.5 text-xs rounded-md ${isDark ? 'text-slate-400 hover:text-white' : 'text-slate-600 hover:text-slate-900'}`}
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
            ))}
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
            const isAbnormal = reading?.isAbnormal || false;

            return (
              <div
                key={patient.id}
                id={`patient-card-${patient.id}`}
                className={`rounded-2xl border p-4 transition-all shadow-sm ${
                  isAbnormal
                    ? 'border-red-500/60 bg-red-950/20 ring-1 ring-red-500/30'
                    : isDark
                    ? 'bg-slate-900 border-slate-800'
                    : 'bg-white border-slate-200'
                }`}
              >
                {/* Header: Name, Room, Bed */}
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2">
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

                  <span
                    className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase ${
                      isAbnormal
                        ? 'bg-red-500/20 text-red-500 border border-red-500/40 animate-pulse'
                        : 'bg-emerald-500/20 text-emerald-500 border border-emerald-500/30'
                    }`}
                  >
                    {isAbnormal ? t.criticalStatus : t.stableStatus}
                  </span>
                </div>

                {/* Diagnosis */}
                <div className={`mt-2.5 text-xs ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
                  <span className="text-slate-400 font-medium">{t.diagnosis}</span> {patient.diagnosis}
                </div>

                {/* Live Metrics Row */}
                <div
                  className={`mt-3 p-3 rounded-xl border flex items-center justify-between ${
                    isDark ? 'bg-slate-950/80 border-slate-800' : 'bg-slate-50 border-slate-200'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <Heart className={`w-5 h-5 ${isAbnormal ? 'text-red-500 animate-ping' : 'text-emerald-500'}`} />
                    <div>
                      <div className={`text-[10px] uppercase font-semibold ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                        {t.lastRecordedHR}
                      </div>
                      <div className={`text-lg font-black ${isAbnormal ? 'text-red-500' : 'text-emerald-500'}`}>
                        {currentBpm} <span className="text-xs font-normal text-slate-400">BPM</span>
                      </div>
                    </div>
                  </div>

                  <div className="text-right">
                    <div className={`text-[10px] uppercase font-semibold ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>SpO2</div>
                    <div className="text-lg font-black text-sky-500">
                      {currentSpO2}%
                    </div>
                  </div>
                </div>

                {/* Quick Test Trigger Buttons */}
                <div className="mt-3 pt-2.5 border-t border-slate-800/60 flex items-center justify-between gap-2 text-xs">
                  <span className={`text-[11px] ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{t.emergencyTestTriggers}</span>
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
    </div>
  );
};
