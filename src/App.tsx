import React, { useState, useEffect, useCallback } from 'react';
import { Navbar } from './components/Navbar';
import { DoctorPortal } from './components/DoctorPortal';
import { NurseStationKiosk } from './components/NurseStationKiosk';
import { TelemetrySimulator } from './components/TelemetrySimulator';
import { AlertAuditHistory } from './components/AlertAuditHistory';
import { PersonnelAdmin } from './components/PersonnelAdmin';
import { MedicationCalendarManager } from './components/MedicationCalendarManager';
import { SettingsModal } from './components/SettingsModal';
import { useLanguage } from './context/LanguageContext';
import { useTheme } from './context/ThemeContext';
import {
  Alert,
  Doctor,
  MedicationSchedule,
  Patient,
  SystemSettings,
  SystemStats,
  VitalReading,
  WsServerMessage,
} from './types';
import { realtimeHub } from './services/websocket';
import {
  initAudio,
  playAcknowledgeChime,
  playDoctorAlertChime,
  startNurseStationSiren,
  stopNurseStationSiren,
} from './services/sound';
import {
  requestNotificationPermission,
  sendDesktopAlertNotification,
} from './services/notifications';

const defaultSettings: SystemSettings = {
  minNormalHeartRate: 50,
  maxNormalHeartRate: 120,
  criticalLowHeartRate: 40,
  criticalHighHeartRate: 150,
  minSpO2: 88,
  escalationTimeoutSeconds: 15,
};

export default function App() {
  const { t, language } = useLanguage();
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  const [activeTab, setActiveTab] = useState<'doctor' | 'nurse' | 'medication' | 'simulator' | 'audit' | 'admin' | 'settings'>('doctor');
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [hasNotificationPermission, setHasNotificationPermission] = useState(false);

  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [medications, setMedications] = useState<MedicationSchedule[]>([]);
  const [settings, setSettings] = useState<SystemSettings>(defaultSettings);
  const [stats, setStats] = useState<SystemStats | null>(null);

  const [selectedDoctorId, setSelectedDoctorId] = useState<string>('DOC01');
  const [recentVitals, setRecentVitals] = useState<Record<string, VitalReading>>({});
  const [recentReadingsList, setRecentReadingsList] = useState<VitalReading[]>([]);

  // Check notification permission on mount
  useEffect(() => {
    if ('Notification' in window) {
      setHasNotificationPermission(Notification.permission === 'granted');
    }
  }, []);

  const handleRequestNotification = async () => {
    const granted = await requestNotificationPermission();
    setHasNotificationPermission(granted);
  };

  // Sound user-activation listener
  useEffect(() => {
    const unlockSound = () => initAudio();
    window.addEventListener('click', unlockSound, { once: true });
    window.addEventListener('keydown', unlockSound, { once: true });
    return () => {
      window.removeEventListener('click', unlockSound);
      window.removeEventListener('keydown', unlockSound);
    };
  }, []);

  // Sync group with active tab
  useEffect(() => {
    if (activeTab === 'doctor') {
      const doc = doctors.find((d) => d.id === selectedDoctorId);
      realtimeHub.setGroup('OnCallDoctors', selectedDoctorId, doc?.name);
    } else if (activeTab === 'nurse') {
      realtimeHub.setGroup('NurseStationDisplay');
    } else {
      realtimeHub.setGroup('Global');
    }
  }, [activeTab, selectedDoctorId, doctors]);

  // Handle WebSocket Connection & Incoming Events
  useEffect(() => {
    const unsubStatus = realtimeHub.onStatusChange((status) => {
      setIsConnected(status);
    });

    const unsubMsg = realtimeHub.onMessage((msg: WsServerMessage) => {
      switch (msg.type) {
        case 'INIT_STATE':
          setAlerts(msg.alerts || []);
          setPatients(msg.patients || []);
          setDoctors(msg.doctors || []);
          if (msg.medications) setMedications(msg.medications);
          if (msg.settings) setSettings(msg.settings);
          if (msg.stats) setStats(msg.stats);
          break;

        case 'MEDICATIONS_UPDATED':
          setMedications(msg.medications || []);
          break;

        case 'MEDICATION_ADMINISTERED':
          setMedications((prev) =>
            prev.map((m) => (m.id === msg.medication.id ? msg.medication : m))
          );
          if (soundEnabled) {
            playAcknowledgeChime();
          }
          break;

        case 'NEW_ALERT':
          setAlerts((prev) => {
            const exists = prev.some((a) => a.id === msg.alert.id);
            if (exists) return prev.map((a) => (a.id === msg.alert.id ? msg.alert : a));
            return [msg.alert, ...prev];
          });

          // Play Sound & Siren
          if (soundEnabled) {
            playDoctorAlertChime();
            startNurseStationSiren();
          }

          // Trigger Desktop Push Notification
          sendDesktopAlertNotification({
            title: `BÁO ĐỘNG ĐỎ - PHÒNG ${msg.alert.roomNumber || ''}`,
            body: `${msg.alert.patientName || 'Bệnh nhân'}: ${msg.alert.reason || 'Nguy kịch'} (${msg.alert.heartRate ?? 0} BPM)`,
            requireInteraction: true,
            tag: msg.alert.id,
          });
          break;

        case 'ALERT_ESCALATED':
          setAlerts((prev) => prev.map((a) => (a.id === msg.alert.id ? msg.alert : a)));
          if (soundEnabled) {
            playDoctorAlertChime();
          }
          sendDesktopAlertNotification({
            title: `[ESCALATED] CHUYỂN BS DỰ PHÒNG`,
            body: `Cảnh báo phòng ${msg.alert.roomNumber} đã tự động chuyển cho ${msg.backupDoctorName || 'BS Dự phòng'}!`,
            requireInteraction: true,
            tag: `esc-${msg.alert.id}`,
          });
          break;

        case 'ALERT_ACKNOWLEDGED':
          setAlerts((prev) => prev.map((a) => (a.id === msg.alert.id ? msg.alert : a)));
          if (soundEnabled) {
            playAcknowledgeChime();
          }
          // Stop siren if no other pending alerts
          setTimeout(() => {
            setAlerts((current) => {
              const hasPending = current.some((a) => a.status === 'Pending');
              if (!hasPending) {
                stopNurseStationSiren();
              }
              return current;
            });
          }, 100);
          break;

        case 'ALERT_RESOLVED':
          setAlerts((prev) => prev.map((a) => (a.id === msg.alert.id ? msg.alert : a)));
          break;

        case 'NEW_VITAL':
          setRecentVitals((prev) => ({
            ...prev,
            [msg.reading.patientId]: msg.reading,
          }));
          setRecentReadingsList((prev) => [msg.reading, ...prev.slice(0, 49)]);
          break;

        case 'DOCTORS_UPDATED':
          setDoctors(msg.doctors);
          break;

        case 'STATS_UPDATED':
          setStats(msg.stats);
          break;

        case 'DATA_RESET':
          setAlerts(msg.alerts);
          setPatients(msg.patients);
          setDoctors(msg.doctors);
          if (msg.medications) setMedications(msg.medications);
          setRecentVitals({});
          setRecentReadingsList([]);
          stopNurseStationSiren();
          break;
      }
    });

    return () => {
      unsubStatus();
      unsubMsg();
    };
  }, [soundEnabled]);

  // Initial Fetch fallback
  const fetchInitialData = useCallback(async () => {
    try {
      const [resPatients, resDocs, resAlerts, resSettings, resMeds] = await Promise.all([
        fetch('/api/patients'),
        fetch('/api/doctors'),
        fetch('/api/alerts'),
        fetch('/api/settings'),
        fetch('/api/medications'),
      ]);
      if (resPatients.ok) setPatients(await resPatients.json());
      if (resDocs.ok) {
        const docsData = await resDocs.json();
        setDoctors(docsData);
        if (docsData.length > 0 && !selectedDoctorId) {
          setSelectedDoctorId(docsData[0].id);
        }
      }
      if (resAlerts.ok) setAlerts(await resAlerts.json());
      if (resSettings.ok) setSettings(await resSettings.json());
      if (resMeds.ok) setMedications(await resMeds.json());
    } catch (err) {
      console.error('Initial data fetch error:', err);
    }
  }, [selectedDoctorId]);

  useEffect(() => {
    fetchInitialData();
  }, [fetchInitialData]);

  // Medication Handlers
  const handleAdministerMedication = async (
    id: string,
    data: {
      administeredBy: string;
      administeredRole: string;
      administerNotes?: string;
      recordedHeartRate?: number;
      recordedBloodPressure?: string;
    }
  ) => {
    try {
      const res = await fetch(`/api/medications/${id}/administer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (res.ok) {
        const updated = await res.json();
        setMedications((prev) =>
          prev.map((m) => (m.id === id ? updated.medication : m))
        );
      }
    } catch (e) {
      console.error('Failed to administer medication', e);
    }
  };

  const handleHoldMedication = async (id: string, reason: string, heldBy: string) => {
    try {
      const res = await fetch(`/api/medications/${id}/hold`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason, heldBy }),
      });
      if (res.ok) {
        const updated = await res.json();
        setMedications((prev) =>
          prev.map((m) => (m.id === id ? updated.medication : m))
        );
      }
    } catch (e) {
      console.error('Failed to hold medication', e);
    }
  };

  const handleCreateMedication = async (data: Partial<MedicationSchedule>) => {
    try {
      const res = await fetch('/api/medications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (res.ok) {
        const newMed = await res.json();
        setMedications((prev) => [...prev, newMed]);
      }
    } catch (e) {
      console.error('Failed to create medication', e);
    }
  };

  const handleDeleteMedication = async (id: string) => {
    try {
      await fetch(`/api/medications/${id}`, { method: 'DELETE' });
      setMedications((prev) => prev.filter((m) => m.id !== id));
    } catch (e) {
      console.error('Failed to delete medication', e);
    }
  };

  // Actions
  const handleAcknowledgeAlert = async (alertId: string, customName?: string, role?: string) => {
    const doc = doctors.find((d) => d.id === selectedDoctorId);
    const doctorName = customName || (doc ? doc.name : 'BS. Trực Ca ICU');
    const ackRole = role || (customName ? 'Điều Dưỡng Trực' : 'Bác Sĩ Trực');

    // Optimistic local state update for instant UI response
    setAlerts((prev) =>
      prev.map((a) => {
        if (a.id === alertId) {
          return {
            ...a,
            status: 'Acknowledged',
            acknowledgedAt: new Date().toISOString(),
            acknowledgedBy: doctorName,
            acknowledgedRole: ackRole,
          };
        }
        return a;
      })
    );

    if (soundEnabled) {
      playAcknowledgeChime();
    }
    stopNurseStationSiren();

    try {
      await fetch(`/api/alerts/${alertId}/ack`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          acknowledgedBy: doctorName,
          acknowledgedDoctorId: selectedDoctorId,
          role: ackRole,
        }),
      });
    } catch (e) {
      console.error('Failed to acknowledge alert', e);
    }
  };

  const handleResolveAlert = async (alertId: string, notes: string) => {
    const doc = doctors.find((d) => d.id === selectedDoctorId);
    const doctorName = doc ? doc.name : 'BS. Trực Ca ICU';
    try {
      await fetch(`/api/alerts/${alertId}/resolve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          resolvedBy: doctorName,
          notes,
        }),
      });
    } catch (e) {
      console.error('Failed to resolve alert', e);
    }
  };

  const handleToggleOnCall = async (doctorId: string) => {
    try {
      await fetch(`/api/doctors/${doctorId}/toggle-oncall`, {
        method: 'PUT',
      });
    } catch (e) {
      console.error('Failed to toggle on-call status', e);
    }
  };

  const handleSendVital = async (reading: Partial<VitalReading>) => {
    try {
      const res = await fetch('/api/vitals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(reading),
      });
      return await res.json();
    } catch (e) {
      console.error('Failed to send vital', e);
      throw e;
    }
  };

  const handleInjectEmergency = async (
    patientId: string,
    typeOrHr: 'vfib' | 'brady' | 'hypoxia' | number,
    customSpO2?: number
  ) => {
    const testVitals: Record<string, { heartRate: number; spO2: number; bloodPressureSystolic: number; bloodPressureDiastolic: number }> = {
      vfib: { heartRate: 172, spO2: 91, bloodPressureSystolic: 80, bloodPressureDiastolic: 45 },
      brady: { heartRate: 34, spO2: 89, bloodPressureSystolic: 75, bloodPressureDiastolic: 40 },
      hypoxia: { heartRate: 125, spO2: 78, bloodPressureSystolic: 95, bloodPressureDiastolic: 60 },
    };

    let targetHeartRate = 175;
    let targetSpO2 = 88;
    let sys = 80;
    let dia = 45;

    if (typeof typeOrHr === 'number') {
      targetHeartRate = typeOrHr;
      targetSpO2 = customSpO2 !== undefined ? customSpO2 : 88;
    } else if (testVitals[typeOrHr]) {
      const chosen = testVitals[typeOrHr];
      targetHeartRate = chosen.heartRate;
      targetSpO2 = chosen.spO2;
      sys = chosen.bloodPressureSystolic;
      dia = chosen.bloodPressureDiastolic;
    }

    await handleSendVital({
      patientId,
      heartRate: targetHeartRate,
      spO2: targetSpO2,
      bloodPressureSystolic: sys,
      bloodPressureDiastolic: dia,
    });
  };

  const pendingAlertsCount = alerts.filter((a) => a.status === 'Pending').length;

  const handleSaveSettings = async (newSettings: SystemSettings) => {
    try {
      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newSettings),
      });
      const saved = await res.json();
      setSettings(saved);
    } catch (e) {
      console.error('Failed to save settings', e);
    }
  };

  const handleResetData = async () => {
    const confirmText =
      language === 'vi'
        ? 'Bạn có chắc chắn muốn thiết lập lại toàn bộ dữ liệu cảnh báo và lịch sử về ban đầu?'
        : 'Are you sure you want to reset all emergency alerts and audit history to defaults?';
    if (!window.confirm(confirmText)) {
      return;
    }
    try {
      await fetch('/api/reset-data', { method: 'POST' });
    } catch (e) {
      console.error('Failed to reset data', e);
    }
  };

  const currentDoctor = doctors.find((d) => d.id === selectedDoctorId) || doctors[0] || {
    id: 'DOC01',
    name: 'BS. CKII. Nguyễn Quốc Trí',
    role: 'Trưởng Ca Trực ICU',
    department: 'Hồi Sức Cấp Cứu (ICU)',
    phone: '0912-345-678',
    isOnCall: true,
    isBackup: false,
  };

  return (
    <div
      className={`min-h-screen flex flex-col font-sans transition-colors duration-200 selection:bg-red-500 selection:text-white ${
        isDark ? 'bg-slate-950 text-slate-100' : 'bg-slate-50 text-slate-900'
      }`}
    >
      {/* Top Navigation */}
      <Navbar
        activeTab={activeTab === 'settings' ? 'doctor' : activeTab}
        setActiveTab={(tab) => {
          if (tab === 'settings') {
            setIsSettingsOpen(true);
          } else {
            setActiveTab(tab);
          }
        }}
        onOpenSettings={() => setIsSettingsOpen(true)}
        isConnected={isConnected}
        pendingAlertsCount={pendingAlertsCount}
      />

      {/* Main Content Body */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8">
        {activeTab === 'doctor' && (
          <DoctorPortal
            doctor={currentDoctor}
            patients={patients}
            alerts={alerts}
            recentVitals={recentVitals}
            settings={settings}
            onAcknowledgeAlert={handleAcknowledgeAlert}
            onResolveAlert={handleResolveAlert}
            onToggleOnCall={handleToggleOnCall}
            onInjectEmergency={handleInjectEmergency}
            doctors={doctors}
            selectedDoctorId={selectedDoctorId}
            setSelectedDoctorId={setSelectedDoctorId}
          />
        )}

        {activeTab === 'nurse' && (
          <NurseStationKiosk
            alerts={alerts}
            patients={patients}
            doctors={doctors}
            recentVitals={recentVitals}
            settings={settings}
            soundEnabled={soundEnabled}
            onAcknowledgeAlert={handleAcknowledgeAlert}
            onInjectEmergency={handleInjectEmergency}
          />
        )}

        {activeTab === 'medication' && (
          <MedicationCalendarManager
            medications={medications}
            patients={patients}
            doctors={doctors}
            onMedicationsUpdated={fetchInitialData}
            onAdministerMedication={handleAdministerMedication}
            onHoldMedication={handleHoldMedication}
            onCreateMedication={handleCreateMedication}
            onDeleteMedication={handleDeleteMedication}
          />
        )}

        {activeTab === 'simulator' && (
          <TelemetrySimulator
            patients={patients}
            recentReadings={recentReadingsList}
            onSendVital={handleSendVital}
          />
        )}

        {activeTab === 'audit' && (
          <AlertAuditHistory alerts={alerts} stats={stats} />
        )}

        {activeTab === 'admin' && (
          <PersonnelAdmin
            doctors={doctors}
            onStaffUpdated={fetchInitialData}
          />
        )}
      </main>

      {/* Settings Modal */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        settings={settings}
        onSaveSettings={handleSaveSettings}
        onResetData={() => {
          handleResetData();
          setIsSettingsOpen(false);
        }}
        onNavigateToStaffAdmin={() => {
          setActiveTab('admin');
        }}
        soundEnabled={soundEnabled}
        setSoundEnabled={setSoundEnabled}
        hasNotificationPermission={hasNotificationPermission}
        onRequestNotification={handleRequestNotification}
        doctors={doctors}
        selectedDoctorId={selectedDoctorId}
        setSelectedDoctorId={setSelectedDoctorId}
      />

      {/* Footer info bar */}
      <footer
        className={`border-t py-3 text-center text-xs transition-colors duration-200 ${
          isDark ? 'border-slate-900 bg-slate-950/80 text-slate-500' : 'border-slate-200 bg-white/80 text-slate-600'
        }`}
      >
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>{t.footerSystemName}</span>
          <div className="text-[11px] opacity-75">
            <span>{t.footerVersion}</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
