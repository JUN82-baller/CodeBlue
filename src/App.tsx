import React, { useState, useEffect, useCallback } from 'react';
import { Navbar } from './components/Navbar';
import { DoctorPortal } from './components/DoctorPortal';
import { NurseStationKiosk } from './components/NurseStationKiosk';
import { TelemetrySimulator } from './components/TelemetrySimulator';
import { AlertAuditHistory } from './components/AlertAuditHistory';
import { PersonnelAdmin } from './components/PersonnelAdmin';
import { AdminStaffPortal } from './components/AdminStaffPortal';
import { MedicationCalendarManager } from './components/MedicationCalendarManager';
import { AiClinicalAssistant } from './components/AiClinicalAssistant';
import { SettingsModal } from './components/SettingsModal';
import { GoogleSheetsSyncModal } from './components/GoogleSheetsSyncModal';
import { GmailDispatcherModal } from './components/GmailDispatcherModal';
import { Bot, MessageSquare, Sparkles, X, ShieldAlert, Volume2, VolumeX, PhoneCall, Bed, AlertTriangle } from 'lucide-react';
import { useLanguage } from './context/LanguageContext';
import { useTheme } from './context/ThemeContext';
import {
  AiConsultationRole,
  Alert,
  Doctor,
  MedicationAdministrationRecord,
  MedicationSchedule,
  Patient,
  SystemSettings,
  SystemStats,
  VitalReading,
  WardBedSlot,
  WsServerMessage,
} from './types';
import { PatientBedModal } from './components/PatientBedModal';
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
import {
  speakRedAlertAnnouncement,
  stopVoiceAnnouncement,
} from './services/voiceAnnouncement';
import {
  triggerRedAlertVibration,
  triggerEscalationVibration,
  triggerAcknowledgeHaptic,
  stopHapticVibration,
} from './services/haptic';

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

  const [portalMode, setPortalMode] = useState<'clinical' | 'admin'>(() => {
    if (typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search);
      if (
        urlParams.get('portal') === 'admin' ||
        window.location.pathname.startsWith('/admin') ||
        window.location.hash.includes('admin')
      ) {
        return 'admin';
      }
    }
    return 'clinical';
  });

  const switchToAdminPortal = useCallback(() => {
    setPortalMode('admin');
    if (typeof window !== 'undefined' && window.history.pushState) {
      const url = new URL(window.location.href);
      url.searchParams.set('portal', 'admin');
      window.history.pushState({}, '', url.pathname + '?' + url.searchParams.toString());
    }
  }, []);

  const switchToClinicalPortal = useCallback(() => {
    setPortalMode('clinical');
    if (typeof window !== 'undefined' && window.history.pushState) {
      const url = new URL(window.location.href);
      url.searchParams.delete('portal');
      window.history.pushState({}, '', url.pathname + (url.search ? '?' + url.searchParams.toString() : ''));
    }
  }, []);

  const [activeTab, setActiveTab] = useState<'doctor' | 'nurse' | 'medication' | 'ai' | 'simulator' | 'audit' | 'settings'>('doctor');
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isGoogleSheetsOpen, setIsGoogleSheetsOpen] = useState(false);
  const [isGmailDispatcherOpen, setIsGmailDispatcherOpen] = useState(false);
  const [gmailPrefillAlert, setGmailPrefillAlert] = useState<Alert | null>(null);
  const [gmailPrefillDoctor, setGmailPrefillDoctor] = useState<Doctor | null>(null);
  const [isAiDrawerOpen, setIsAiDrawerOpen] = useState(false);
  const [aiDrawerPatientId, setAiDrawerPatientId] = useState<string>('');
  const [aiDrawerRole, setAiDrawerRole] = useState<AiConsultationRole>('clinical_doctor');
  const [isConnected, setIsConnected] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [hasNotificationPermission, setHasNotificationPermission] = useState(false);

  const handleOpenGmailDispatcher = (alert?: Alert, doctor?: Doctor) => {
    setGmailPrefillAlert(alert || null);
    setGmailPrefillDoctor(doctor || null);
    setIsGmailDispatcherOpen(true);
  };

  const openAiConsultation = (patientId?: string, role: AiConsultationRole = 'clinical_doctor') => {
    if (patientId) {
      setAiDrawerPatientId(patientId);
    }
    setAiDrawerRole(role);
    setIsAiDrawerOpen(true);
  };

  const handleStaffImportedFromSheets = async (importedStaff: Doctor[]) => {
    try {
      const res = await fetch('/api/doctors/bulk-import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ importedStaff }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.doctors) {
          setDoctors(data.doctors);
        }
      }
    } catch (e) {
      console.error('Failed to import staff to backend:', e);
    }
  };

  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [medications, setMedications] = useState<MedicationSchedule[]>([]);
  const [medicationHistory, setMedicationHistory] = useState<MedicationAdministrationRecord[]>([]);
  const [settings, setSettings] = useState<SystemSettings>(defaultSettings);
  const [stats, setStats] = useState<SystemStats | null>(null);

  const [selectedDoctorId, setSelectedDoctorId] = useState<string>('DOC01');
  const [recentVitals, setRecentVitals] = useState<Record<string, VitalReading>>({});
  const [recentReadingsList, setRecentReadingsList] = useState<VitalReading[]>([]);

  // Bed & Patient Admission Management State
  const [beds, setBeds] = useState<WardBedSlot[]>([]);
  const [isPatientBedModalOpen, setIsPatientBedModalOpen] = useState(false);
  const [selectedBedForAdmission, setSelectedBedForAdmission] = useState<{ roomNumber: string; bed: string } | null>(null);
  const [selectedPatientForEdit, setSelectedPatientForEdit] = useState<Patient | null>(null);

  const handleOpenAdmitModal = (
    bedSlot?: { roomNumber: string; bed: string } | null,
    patient?: Patient | null
  ) => {
    setSelectedBedForAdmission(bedSlot || null);
    setSelectedPatientForEdit(patient || null);
    setIsPatientBedModalOpen(true);
  };

  const handleSavePatient = async (patientData: Partial<Patient>): Promise<boolean> => {
    try {
      if (selectedPatientForEdit && selectedPatientForEdit.id) {
        // Edit existing patient record
        const res = await fetch(`/api/patients/${selectedPatientForEdit.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(patientData),
        });
        if (res.ok) {
          const updated = await res.json();
          setPatients((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
        } else {
          return false;
        }
      } else {
        // Admit new patient to bed
        const res = await fetch('/api/patients', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(patientData),
        });
        if (res.ok) {
          const created = await res.json();
          setPatients((prev) => [created, ...prev.filter((p) => p.id !== created.id)]);
        } else {
          return false;
        }
      }

      // Re-fetch beds to ensure synchronous consistency
      const bedsRes = await fetch('/api/beds');
      if (bedsRes.ok) {
        const bData = await bedsRes.json();
        if (bData.beds) setBeds(bData.beds);
      }
      return true;
    } catch (err) {
      console.error('Failed to save patient record:', err);
      return false;
    }
  };

  const handleDischargePatient = async (patientId: string): Promise<boolean> => {
    try {
      const res = await fetch(`/api/patients/${patientId}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        setPatients((prev) => prev.filter((p) => p.id !== patientId));
        // Re-fetch beds
        const bedsRes = await fetch('/api/beds');
        if (bedsRes.ok) {
          const bData = await bedsRes.json();
          if (bData.beds) setBeds(bData.beds);
        }
        return true;
      }
      return false;
    } catch (err) {
      console.error('Failed to discharge patient:', err);
      return false;
    }
  };

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

  // Global shortcut listener for Ctrl+K (or Cmd+K) to trigger #btn-floating-ai-assistant
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && (e.key === 'k' || e.key === 'K')) {
        e.preventDefault();
        const floatingBtn = document.getElementById('btn-floating-ai-assistant');
        if (floatingBtn) {
          floatingBtn.click();
        } else {
          setIsAiDrawerOpen((prev) => !prev);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

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
          if (msg.beds) setBeds(msg.beds);
          if (msg.medications) setMedications(msg.medications);
          if (msg.medicationHistory) setMedicationHistory(msg.medicationHistory);
          if (msg.settings) setSettings(msg.settings);
          if (msg.stats) setStats(msg.stats);
          break;

        case 'PATIENTS_UPDATED':
          setPatients(msg.patients || []);
          break;

        case 'BEDS_UPDATED':
          setBeds(msg.beds || []);
          break;

        case 'MEDICATIONS_UPDATED':
          setMedications(msg.medications || []);
          break;

        case 'MEDICATION_ADMINISTERED':
          setMedications((prev) =>
            prev.map((m) => (m.id === msg.medication.id ? msg.medication : m))
          );
          if (msg.logRecord) {
            setMedicationHistory((prev) => [msg.logRecord!, ...prev.filter((l) => l.id !== msg.logRecord!.id)]);
          }
          if (soundEnabled) {
            playAcknowledgeChime();
          }
          break;

        case 'MEDICATION_HISTORY_UPDATED':
          setMedicationHistory(msg.history || []);
          break;

        case 'NEW_ALERT':
          setAlerts((prev) => {
            const exists = prev.some((a) => a.id === msg.alert.id);
            if (exists) return prev.map((a) => (a.id === msg.alert.id ? msg.alert : a));
            return [msg.alert, ...prev];
          });

          // Play Sound, Siren, Instant Voice Announcement & Mobile Haptic Vibration
          if (soundEnabled) {
            playDoctorAlertChime();
            startNurseStationSiren();
            speakRedAlertAnnouncement(msg.alert, language);
          }

          // Trigger continuous mobile haptic emergency pulses
          triggerRedAlertVibration(true);

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
            speakRedAlertAnnouncement(
              {
                ...msg.alert,
                reason: language === 'vi' ? 'Chuyển bác sĩ dự phòng' : 'Backup escalated',
              },
              language
            );
          }
          // Escalation heavy haptic pulse
          triggerEscalationVibration();

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
          triggerAcknowledgeHaptic();

          // Stop siren, voice, and vibration if no other pending alerts
          setTimeout(() => {
            setAlerts((current) => {
              const hasPending = current.some((a) => a.status === 'Pending');
              if (!hasPending) {
                stopNurseStationSiren();
                stopVoiceAnnouncement();
                stopHapticVibration();
              }
              return current;
            });
          }, 100);
          break;

        case 'ALERT_RESOLVED':
          setAlerts((prev) => prev.map((a) => (a.id === msg.alert.id ? msg.alert : a)));
          setTimeout(() => {
            setAlerts((current) => {
              const hasPending = current.some((a) => a.status === 'Pending');
              if (!hasPending) {
                stopNurseStationSiren();
                stopVoiceAnnouncement();
                stopHapticVibration();
              }
              return current;
            });
          }, 100);
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
          if (msg.beds) setBeds(msg.beds);
          if (msg.medications) setMedications(msg.medications);
          if (msg.medicationHistory) setMedicationHistory(msg.medicationHistory);
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
      const [resPatients, resDocs, resAlerts, resSettings, resMeds, resMedHistory, resBeds] = await Promise.all([
        fetch('/api/patients'),
        fetch('/api/doctors'),
        fetch('/api/alerts'),
        fetch('/api/settings'),
        fetch('/api/medications'),
        fetch('/api/medications-history'),
        fetch('/api/beds'),
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
      if (resMedHistory && resMedHistory.ok) setMedicationHistory(await resMedHistory.json());
      if (resBeds && resBeds.ok) {
        const bedsData = await resBeds.json();
        if (bedsData.beds) setBeds(bedsData.beds);
      }
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
      administeredStaffId?: string;
      administerNotes?: string;
      recordedHeartRate?: number;
      recordedBloodPressure?: string;
      recordedSpO2?: number;
      recordedTemperature?: number;
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
        if (updated.logRecord) {
          setMedicationHistory((prev) => [updated.logRecord, ...prev.filter((l) => l.id !== updated.logRecord.id)]);
        }
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

  if (portalMode === 'admin') {
    return (
      <>
        <AdminStaffPortal
          doctors={doctors}
          alerts={alerts}
          onStaffUpdated={fetchInitialData}
          onSwitchToClinical={switchToClinicalPortal}
          onOpenGoogleSheets={() => setIsGoogleSheetsOpen(true)}
        />
        <GoogleSheetsSyncModal
          isOpen={isGoogleSheetsOpen}
          onClose={() => setIsGoogleSheetsOpen(false)}
          doctors={doctors}
          alerts={alerts}
          medications={medications}
          onStaffImported={handleStaffImportedFromSheets}
        />
      </>
    );
  }

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
        onOpenGoogleSheets={() => setIsGoogleSheetsOpen(true)}
        onOpenGmail={() => handleOpenGmailDispatcher()}
        isConnected={isConnected}
        pendingAlertsCount={pendingAlertsCount}
        availableBedsCount={Math.max(0, (beds.length || 13) - patients.length)}
        totalBedsCount={beds.length || 13}
        onOpenBedModal={() => handleOpenAdmitModal()}
      />

      {/* Emergency Red Alert Voice Broadcast Header Banner */}
      {pendingAlertsCount > 0 && (
        <div className="bg-red-600 border-b border-red-700 text-white shadow-lg shadow-red-950/40 sticky top-16 z-30 animate-pulse">
          <div className="max-w-7xl mx-auto px-4 py-2.5 flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-white/20 flex items-center justify-center shrink-0 animate-bounce">
                <ShieldAlert className="w-5 h-5 text-white" />
              </div>
              <div>
                <div className="font-black text-sm tracking-wide flex items-center gap-2">
                  <span>🚨 {language === 'vi' ? 'BÁO ĐỘNG ĐỎ CẤP CỨU ĐANG KÍCH HOẠT!' : 'CODE RED EMERGENCY ACTIVE!'}</span>
                  <span className="px-2 py-0.2 bg-black/40 rounded-full text-xs font-mono font-bold">
                    {pendingAlertsCount} {language === 'vi' ? 'ca' : 'cases'}
                  </span>
                </div>
                {alerts.find((a) => a.status === 'Pending') && (
                  <div className="text-xs text-red-100 font-medium">
                    {alerts.find((a) => a.status === 'Pending')?.roomNumber && (
                      <span className="font-bold mr-1.5">
                        Phòng {alerts.find((a) => a.status === 'Pending')?.roomNumber}:
                      </span>
                    )}
                    {alerts.find((a) => a.status === 'Pending')?.patientName} —{' '}
                    {alerts.find((a) => a.status === 'Pending')?.reason} (
                    {alerts.find((a) => a.status === 'Pending')?.heartRate} BPM)
                  </div>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
              <button
                id="btn-broadcast-voice-global"
                onClick={() => {
                  const firstPending = alerts.find((a) => a.status === 'Pending');
                  if (firstPending) {
                    speakRedAlertAnnouncement(firstPending, language);
                  }
                }}
                className="px-3 py-1.5 bg-white text-red-700 hover:bg-red-50 active:scale-95 text-xs font-black rounded-lg shadow transition-all flex items-center gap-1.5 cursor-pointer"
                title={language === 'vi' ? 'Phát loa thông báo khẩn cấp bằng giọng nói' : 'Broadcast emergency voice announcement'}
              >
                <Volume2 className="w-4 h-4 text-red-600" />
                <span>{language === 'vi' ? 'Phát thông báo giọng nói' : 'Voice Announce'}</span>
              </button>

              <button
                id="btn-silence-alarm-global"
                onClick={() => {
                  stopNurseStationSiren();
                  stopVoiceAnnouncement();
                  stopHapticVibration();
                }}
                className="px-2.5 py-1.5 bg-red-800/80 hover:bg-red-900 text-white text-xs font-bold rounded-lg border border-red-400/40 transition-colors flex items-center gap-1 cursor-pointer"
                title={language === 'vi' ? 'Tắt còi, dừng thông báo và ngắt rung' : 'Silence Siren, Voice and Vibration'}
              >
                <VolumeX className="w-3.5 h-3.5" />
                <span>{language === 'vi' ? 'Tắt còi & Rung' : 'Mute & Stop Vibration'}</span>
              </button>

              {activeTab !== 'doctor' && (
                <button
                  id="btn-goto-doctor-alerts"
                  onClick={() => setActiveTab('doctor')}
                  className="px-3 py-1.5 bg-black/40 hover:bg-black/60 text-white text-xs font-bold rounded-lg transition-colors cursor-pointer"
                >
                  {language === 'vi' ? 'Xử lý ngay →' : 'Handle Now →'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

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
            onConsultAi={openAiConsultation}
            doctors={doctors}
            selectedDoctorId={selectedDoctorId}
            setSelectedDoctorId={setSelectedDoctorId}
            onOpenGmail={handleOpenGmailDispatcher}
            onOpenAdmitModal={handleOpenAdmitModal}
          />
        )}

        {activeTab === 'nurse' && (
          <NurseStationKiosk
            alerts={alerts}
            patients={patients}
            doctors={doctors}
            beds={beds}
            recentVitals={recentVitals}
            settings={settings}
            soundEnabled={soundEnabled}
            onAcknowledgeAlert={handleAcknowledgeAlert}
            onInjectEmergency={handleInjectEmergency}
            onOpenAdmitModal={handleOpenAdmitModal}
          />
        )}

        {activeTab === 'medication' && (
          <MedicationCalendarManager
            medications={medications}
            medicationHistory={medicationHistory}
            patients={patients}
            doctors={doctors}
            onMedicationsUpdated={fetchInitialData}
            onAdministerMedication={handleAdministerMedication}
            onHoldMedication={handleHoldMedication}
            onCreateMedication={handleCreateMedication}
            onDeleteMedication={handleDeleteMedication}
            onOpenGoogleSheets={() => setIsGoogleSheetsOpen(true)}
          />
        )}

        {activeTab === 'ai' && (
          <div className="h-[calc(100vh-140px)] min-h-[580px]">
            <AiClinicalAssistant
              patients={patients}
              medications={medications}
              recentVitals={recentVitals}
              initialSelectedPatientId={aiDrawerPatientId}
              initialRole={aiDrawerRole}
            />
          </div>
        )}

        {activeTab === 'simulator' && (
          <TelemetrySimulator
            patients={patients}
            recentReadings={recentReadingsList}
            onSendVital={handleSendVital}
          />
        )}

        {activeTab === 'audit' && (
          <AlertAuditHistory
            alerts={alerts}
            stats={stats}
            onOpenGoogleSheets={() => setIsGoogleSheetsOpen(true)}
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
          setIsSettingsOpen(false);
          switchToAdminPortal();
        }}
        soundEnabled={soundEnabled}
        setSoundEnabled={setSoundEnabled}
        hasNotificationPermission={hasNotificationPermission}
        onRequestNotification={handleRequestNotification}
        doctors={doctors}
        selectedDoctorId={selectedDoctorId}
        setSelectedDoctorId={setSelectedDoctorId}
        onOpenGmail={() => handleOpenGmailDispatcher()}
      />

      {/* Google Sheets Synchronization Modal */}
      <GoogleSheetsSyncModal
        isOpen={isGoogleSheetsOpen}
        onClose={() => setIsGoogleSheetsOpen(false)}
        doctors={doctors}
        alerts={alerts}
        medications={medications}
        onStaffImported={handleStaffImportedFromSheets}
      />

      {/* Patient Admission & Bed Management Modal */}
      <PatientBedModal
        isOpen={isPatientBedModalOpen}
        onClose={() => {
          setIsPatientBedModalOpen(false);
          setSelectedBedForAdmission(null);
          setSelectedPatientForEdit(null);
        }}
        beds={beds}
        patients={patients}
        doctors={doctors}
        isDark={isDark}
        language={language}
        preselectedBed={selectedBedForAdmission}
        editingPatient={selectedPatientForEdit}
        onSavePatient={handleSavePatient}
        onDischargePatient={handleDischargePatient}
      />

      {/* Gmail Emergency & Clinical Dispatcher Modal */}
      <GmailDispatcherModal
        isOpen={isGmailDispatcherOpen}
        onClose={() => {
          setIsGmailDispatcherOpen(false);
          setGmailPrefillAlert(null);
          setGmailPrefillDoctor(null);
        }}
        doctors={doctors}
        alerts={alerts}
        medications={medications}
        prefilledAlert={gmailPrefillAlert}
        prefilledDoctor={gmailPrefillDoctor}
      />

      {/* Floating Quick AI Clinical Assistant Button (Available on all tabs) */}
      {activeTab !== 'ai' && (
        <div className="fixed bottom-6 right-6 z-40 flex items-center gap-2">
          <button
            id="btn-floating-ai-assistant"
            onClick={() => setIsAiDrawerOpen(!isAiDrawerOpen)}
            className="flex items-center gap-2 px-4 py-3 rounded-2xl font-extrabold text-xs sm:text-sm text-white bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 hover:from-indigo-500 hover:to-pink-500 shadow-2xl shadow-purple-900/50 border border-purple-400/40 hover:scale-105 active:scale-95 transition-all cursor-pointer group"
            title={language === 'vi' ? 'Mở Trợ Lý Quyết Định Lâm Sàng Gemini AI (Ctrl+K)' : 'Open Gemini AI Clinical Decision Support (Ctrl+K)'}
          >
            <div className="relative">
              <Bot className="w-5 h-5 group-hover:rotate-12 transition-transform" />
              <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-emerald-400 border-2 border-indigo-900 animate-ping" />
            </div>
            <span className="hidden sm:inline">
              {language === 'vi' ? 'Hỏi AI Cấp Cứu' : 'AI Clinical Consult'}
            </span>
            <kbd className="hidden md:inline-flex items-center px-1.5 py-0.5 text-[10px] font-mono font-bold bg-white/20 text-white rounded-md border border-white/30 backdrop-blur-xs">
              Ctrl+K
            </kbd>
            <Sparkles className="w-3.5 h-3.5 text-amber-300 animate-spin" />
          </button>
        </div>
      )}

      {/* Floating AI Consultation Modal Drawer */}
      {isAiDrawerOpen && activeTab !== 'ai' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
          <div className="relative w-full max-w-4xl h-[90vh] max-h-[780px] flex flex-col rounded-2xl overflow-hidden shadow-2xl border border-indigo-500/30">
            <AiClinicalAssistant
              patients={patients}
              medications={medications}
              recentVitals={recentVitals}
              initialSelectedPatientId={aiDrawerPatientId}
              initialRole={aiDrawerRole}
              isFloatingDrawer={true}
              onCloseFloating={() => setIsAiDrawerOpen(false)}
            />
          </div>
        </div>
      )}

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
