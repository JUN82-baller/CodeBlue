import React, { useState, useEffect, useMemo } from 'react';
import {
  Calendar as CalendarIcon,
  CheckCircle2,
  Clock,
  ExternalLink,
  Filter,
  Heart,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  Stethoscope,
  Trash2,
  User,
  AlertCircle,
  Pill,
  Syringe,
  Activity,
  Check,
  PauseCircle,
  CalendarCheck,
  Sparkles,
} from 'lucide-react';
import { Doctor, MedicationRoute, MedicationSchedule, MedicationStatus, Patient } from '../types';
import { useLanguage } from '../context/LanguageContext';
import { useTheme } from '../context/ThemeContext';
import {
  createGoogleCalendarMedicationEvent,
  generateDirectGoogleCalendarUrl,
  getCachedCalendarToken,
  requestGoogleCalendarAccessToken,
  clearCalendarToken,
} from '../services/googleCalendar';

interface MedicationCalendarManagerProps {
  medications: MedicationSchedule[];
  patients: Patient[];
  doctors: Doctor[];
  onMedicationsUpdated: () => void;
  onAdministerMedication: (
    id: string,
    data: {
      administeredBy: string;
      administeredRole: string;
      administerNotes?: string;
      recordedHeartRate?: number;
      recordedBloodPressure?: string;
    }
  ) => Promise<void>;
  onHoldMedication: (id: string, reason: string, heldBy: string) => Promise<void>;
  onCreateMedication: (data: Partial<MedicationSchedule>) => Promise<void>;
  onDeleteMedication: (id: string) => Promise<void>;
}

// Preset ICU medications for quick prescribing
const PRESET_MEDICATIONS = [
  { name: 'Digoxin 0.25mg', dosage: '1 viên (0.25mg)', route: 'Oral' as MedicationRoute, freq: '1 lần/ngày (08:00)', instructions: 'Đo nhịp tim trước dùng. Nếu HR < 60 bpm báo BS.', preVitals: true },
  { name: 'Furosemide 20mg/2ml', dosage: '1 ống (20mg)', route: 'IV' as MedicationRoute, freq: '2 lần/ngày (08:00, 14:00)', instructions: 'Tiêm tĩnh mạch chậm trong 2 phút.', preVitals: true },
  { name: 'Amiodarone 150mg/3ml', dosage: '1 ống (150mg)', route: 'Infusion' as MedicationRoute, freq: 'Mỗi 8 giờ', instructions: 'Pha truyền tĩnh mạch theo dõi monitor liên tục.', preVitals: true },
  { name: 'Enoxaparin 40mg/0.4ml', dosage: '1 bơm tiêm sẵn', route: 'Subcutaneous' as MedicationRoute, freq: '1 lần/ngày (18:00)', instructions: 'Tiêm dưới da bụng luân phiên vị trí.', preVitals: false },
  { name: 'Ceftriaxone 1g', dosage: '1 lọ (1g)', route: 'Infusion' as MedicationRoute, freq: '1 lần/ngày (09:00)', instructions: 'Pha 100ml NaCl 0.9% truyền trong 30 phút.', preVitals: false },
  { name: 'Paracetamol 500mg', dosage: '1 viên (500mg)', route: 'Oral' as MedicationRoute, freq: 'Khi sốt/đau cách 6h', instructions: 'Uống sau bữa ăn với nhiều nước.', preVitals: false },
  { name: 'Nitroglycerin 10mg/10ml', dosage: '1 ống pha truyền', route: 'Infusion' as MedicationRoute, freq: 'Duy trì liên tục', instructions: 'Bơm tiêm điện duy trì, theo dõi HA sát.', preVitals: true },
  { name: 'Morphine Sulfate 10mg', dosage: '1/2 ống (5mg)', route: 'IV' as MedicationRoute, freq: 'Khi đau ngực cấp', instructions: 'Tiêm TM chậm, theo dõi SpO2 và tần số thở.', preVitals: true },
];

export const MedicationCalendarManager: React.FC<MedicationCalendarManagerProps> = ({
  medications,
  patients,
  doctors,
  onMedicationsUpdated,
  onAdministerMedication,
  onHoldMedication,
  onCreateMedication,
  onDeleteMedication,
}) => {
  const { t, language } = useLanguage();
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  // Google Calendar State
  const [hasGoogleAuth, setHasGoogleAuth] = useState<boolean>(!!getCachedCalendarToken());
  const [isSyncingAll, setIsSyncingAll] = useState(false);
  const [syncProgressMsg, setSyncProgressMsg] = useState<string | null>(null);
  const [syncingSingleId, setSyncingSingleId] = useState<string | null>(null);

  // Filters & Search
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'All' | MedicationStatus>('All');
  const [selectedPatientFilter, setSelectedPatientFilter] = useState<string>('All');

  // Modals
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [administeringMed, setAdministeringMed] = useState<MedicationSchedule | null>(null);
  const [holdingMed, setHoldingMed] = useState<MedicationSchedule | null>(null);
  const [deletingMedId, setDeletingMedId] = useState<string | null>(null);

  // Administration Form State
  const [adminPulse, setAdminPulse] = useState<string>('72');
  const [adminBP, setAdminBP] = useState<string>('120/80');
  const [adminNotes, setAdminNotes] = useState<string>('Đã kiểm tra 5 đúng. Bệnh nhân dùng thuốc an toàn, không có phản ứng phụ.');
  const [adminStaffName, setAdminStaffName] = useState<string>('ĐD. Đặng Thị Hồng Hạnh');
  const [isSubmittingAdmin, setIsSubmittingAdmin] = useState(false);

  // Hold Form State
  const [holdReason, setHoldReason] = useState<string>('Nhịp tim chậm dưới 55 bpm, tạm hoãn chờ chỉ định bác sĩ.');
  const [isSubmittingHold, setIsSubmittingHold] = useState(false);

  // Add Medication Form State
  const todayStr = new Date().toISOString().split('T')[0];
  const [newMedData, setNewMedData] = useState({
    patientId: patients[0]?.id || '',
    medicationName: '',
    dosage: '',
    route: 'Oral' as MedicationRoute,
    scheduledTime: '08:00',
    scheduledDate: todayStr,
    frequency: '1 lần/ngày (08:00)',
    prescribedByDoctorId: doctors[0]?.id || '',
    assignedNurseId: doctors.find((d) => d.role?.includes('Điều Dưỡng'))?.id || doctors[0]?.id || '',
    instructions: 'Tuân thủ quy trình 5 đúng khi cho thuốc.',
    preVitalsRequired: true,
    autoSyncGoogleCalendar: true,
  });
  const [isSubmittingNew, setIsSubmittingNew] = useState(false);

  // Check cached token periodically
  useEffect(() => {
    setHasGoogleAuth(!!getCachedCalendarToken());
  }, []);

  // Preset medication quick selector
  const handleSelectPreset = (preset: typeof PRESET_MEDICATIONS[0]) => {
    setNewMedData((prev) => ({
      ...prev,
      medicationName: preset.name,
      dosage: preset.dosage,
      route: preset.route,
      frequency: preset.freq,
      instructions: preset.instructions,
      preVitalsRequired: preset.preVitals,
    }));
  };

  // Google Calendar Auth handler
  const handleConnectGoogleCalendar = async () => {
    try {
      setSyncProgressMsg(language === 'vi' ? 'Đang mở cửa sổ đăng nhập Google...' : 'Opening Google Sign-in...');
      const token = await requestGoogleCalendarAccessToken();
      if (token) {
        setHasGoogleAuth(true);
        setSyncProgressMsg(language === 'vi' ? 'Đã kết nối Google Calendar thành công!' : 'Google Calendar connected successfully!');
        setTimeout(() => setSyncProgressMsg(null), 3000);
      }
    } catch (err: any) {
      console.error('Google Calendar OAuth error', err);
      setSyncProgressMsg(err.message || 'Lỗi kết nối Google Calendar');
      setTimeout(() => setSyncProgressMsg(null), 5000);
    }
  };

  const handleDisconnectGoogleCalendar = () => {
    clearCalendarToken();
    setHasGoogleAuth(false);
    setSyncProgressMsg(language === 'vi' ? 'Đã ngắt kết nối Google Calendar' : 'Disconnected from Google Calendar');
    setTimeout(() => setSyncProgressMsg(null), 3000);
  };

  // Sync Single Medication to Google Calendar
  const handleSyncSingleMedication = async (med: MedicationSchedule) => {
    setSyncingSingleId(med.id);
    try {
      let token = getCachedCalendarToken();
      if (!token) {
        token = await requestGoogleCalendarAccessToken();
        setHasGoogleAuth(true);
      }

      // Collect attendee emails (doctor + nurse)
      const doc = doctors.find((d) => d.id === med.prescribedByDoctorId);
      const nurse = doctors.find((d) => d.id === med.assignedNurseId);
      const attendees = [doc?.email, nurse?.email].filter(Boolean) as string[];

      const result = await createGoogleCalendarMedicationEvent(token, med, attendees);

      // Save sync status to backend
      await fetch(`/api/medications/${med.id}/sync-gcal`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          googleCalendarEventId: result.id,
          googleCalendarHtmlLink: result.htmlLink,
        }),
      });

      onMedicationsUpdated();
      setSyncProgressMsg(
        language === 'vi'
          ? `Đã đồng bộ lịch thuốc BN ${med.patientName} vào Google Calendar!`
          : `Synced medication for ${med.patientName} to Google Calendar!`
      );
      setTimeout(() => setSyncProgressMsg(null), 3500);
    } catch (err: any) {
      console.error('Error syncing single med to calendar', err);
      // Fallback: Open direct Google Calendar web link if OAuth popup failed or canceled
      const directUrl = generateDirectGoogleCalendarUrl(med);
      window.open(directUrl, '_blank');
      setSyncProgressMsg(
        language === 'vi'
          ? 'Đã mở liên kết thêm nhanh vào Google Calendar của bạn!'
          : 'Opened Google Calendar quick-add link!'
      );
      setTimeout(() => setSyncProgressMsg(null), 4000);
    } finally {
      setSyncingSingleId(null);
    }
  };

  // Sync All Pending Medications to Google Calendar
  const handleSyncAllToGoogleCalendar = async () => {
    setIsSyncingAll(true);
    setSyncProgressMsg(language === 'vi' ? 'Đang chuẩn bị đồng bộ...' : 'Preparing sync...');

    try {
      let token = getCachedCalendarToken();
      if (!token) {
        token = await requestGoogleCalendarAccessToken();
        setHasGoogleAuth(true);
      }

      const pendingMeds = medications.filter((m) => m.status === 'Scheduled');
      if (pendingMeds.length === 0) {
        setSyncProgressMsg(language === 'vi' ? 'Không có lịch thuốc nào đang chờ dùng.' : 'No pending medication doses found.');
        setTimeout(() => setSyncProgressMsg(null), 3000);
        return;
      }

      let successCount = 0;
      for (let i = 0; i < pendingMeds.length; i++) {
        const med = pendingMeds[i];
        setSyncProgressMsg(
          language === 'vi'
            ? `Đang đồng bộ (${i + 1}/${pendingMeds.length}): ${med.medicationName} cho ${med.patientName}...`
            : `Syncing (${i + 1}/${pendingMeds.length}): ${med.medicationName}...`
        );

        try {
          const doc = doctors.find((d) => d.id === med.prescribedByDoctorId);
          const nurse = doctors.find((d) => d.id === med.assignedNurseId);
          const attendees = [doc?.email, nurse?.email].filter(Boolean) as string[];

          const result = await createGoogleCalendarMedicationEvent(token, med, attendees);

          await fetch(`/api/medications/${med.id}/sync-gcal`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              googleCalendarEventId: result.id,
              googleCalendarHtmlLink: result.htmlLink,
            }),
          });
          successCount++;
        } catch (err) {
          console.warn('Failed to sync item', med.id, err);
        }
      }

      onMedicationsUpdated();
      setSyncProgressMsg(
        language === 'vi'
          ? `Đã đồng bộ thành công ${successCount}/${pendingMeds.length} lịch thuốc vào Google Calendar của Bác Sĩ & Điều Dưỡng!`
          : `Successfully synced ${successCount}/${pendingMeds.length} medication events to Google Calendar!`
      );
      setTimeout(() => setSyncProgressMsg(null), 4000);
    } catch (err: any) {
      console.error('Error syncing all to calendar', err);
      setSyncProgressMsg(err.message || 'Lỗi đồng bộ Google Calendar');
      setTimeout(() => setSyncProgressMsg(null), 5000);
    } finally {
      setIsSyncingAll(false);
    }
  };

  // Submit Administration (Cho uống thuốc)
  const handleSubmitAdminister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!administeringMed) return;

    setIsSubmittingAdmin(true);
    try {
      await onAdministerMedication(administeringMed.id, {
        administeredBy: adminStaffName,
        administeredRole: 'Điều Dưỡng Trực Ca',
        administerNotes: adminNotes,
        recordedHeartRate: adminPulse ? parseInt(adminPulse, 10) : undefined,
        recordedBloodPressure: adminBP || undefined,
      });
      setAdministeringMed(null);
    } finally {
      setIsSubmittingAdmin(false);
    }
  };

  // Submit Hold
  const handleSubmitHold = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!holdingMed) return;

    setIsSubmittingHold(true);
    try {
      await onHoldMedication(holdingMed.id, holdReason, adminStaffName);
      setHoldingMed(null);
    } finally {
      setIsSubmittingHold(false);
    }
  };

  // Submit New Medication
  const handleSubmitNewMedication = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMedData.patientId || !newMedData.medicationName || !newMedData.dosage) return;

    setIsSubmittingNew(true);
    try {
      await onCreateMedication({
        ...newMedData,
      });

      setIsAddModalOpen(false);
      // Reset form
      setNewMedData({
        patientId: patients[0]?.id || '',
        medicationName: '',
        dosage: '',
        route: 'Oral',
        scheduledTime: '08:00',
        scheduledDate: todayStr,
        frequency: '1 lần/ngày (08:00)',
        prescribedByDoctorId: doctors[0]?.id || '',
        assignedNurseId: doctors.find((d) => d.role?.includes('Điều Dưỡng'))?.id || doctors[0]?.id || '',
        instructions: 'Tuân thủ quy trình 5 đúng khi cho thuốc.',
        preVitalsRequired: true,
        autoSyncGoogleCalendar: true,
      });
    } finally {
      setIsSubmittingNew(false);
    }
  };

  // Stats calculation
  const totalCount = medications.length;
  const completedCount = medications.filter((m) => m.status === 'Administered').length;
  const pendingCount = medications.filter((m) => m.status === 'Scheduled').length;
  const syncedCount = medications.filter((m) => !!m.googleCalendarEventId).length;

  // Filtered medication list
  const filteredMedications = useMemo(() => {
    return medications.filter((m) => {
      // Patient Filter
      if (selectedPatientFilter !== 'All' && m.patientId !== selectedPatientFilter) {
        return false;
      }
      // Status Filter
      if (statusFilter !== 'All' && m.status !== statusFilter) {
        return false;
      }
      // Search term
      if (searchTerm.trim()) {
        const query = searchTerm.toLowerCase();
        const matchName = m.medicationName.toLowerCase().includes(query);
        const matchPatient = m.patientName.toLowerCase().includes(query);
        const matchRoom = m.roomNumber.toLowerCase().includes(query);
        const matchDoc = m.prescribedByDoctorName.toLowerCase().includes(query);
        if (!matchName && !matchPatient && !matchRoom && !matchDoc) {
          return false;
        }
      }
      return true;
    });
  }, [medications, selectedPatientFilter, statusFilter, searchTerm]);

  // Route Icon & Style helper
  const getRouteBadge = (route: MedicationRoute) => {
    switch (route) {
      case 'IV':
      case 'Infusion':
        return {
          icon: <Syringe className="w-3.5 h-3.5" />,
          label: route === 'IV' ? t.routeIV : t.routeInfusion,
          bg: isDark ? 'bg-amber-950/60 text-amber-300 border-amber-800/40' : 'bg-amber-50 text-amber-800 border-amber-200',
        };
      case 'Subcutaneous':
      case 'IM':
        return {
          icon: <Syringe className="w-3.5 h-3.5" />,
          label: route === 'Subcutaneous' ? t.routeSubcutaneous : t.routeIM,
          bg: isDark ? 'bg-purple-950/60 text-purple-300 border-purple-800/40' : 'bg-purple-50 text-purple-800 border-purple-200',
        };
      case 'Inhalation':
        return {
          icon: <Activity className="w-3.5 h-3.5" />,
          label: t.routeInhalation,
          bg: isDark ? 'bg-cyan-950/60 text-cyan-300 border-cyan-800/40' : 'bg-cyan-50 text-cyan-800 border-cyan-200',
        };
      default:
        return {
          icon: <Pill className="w-3.5 h-3.5" />,
          label: t.routeOral,
          bg: isDark ? 'bg-blue-950/60 text-blue-300 border-blue-800/40' : 'bg-blue-50 text-blue-800 border-blue-200',
        };
    }
  };

  return (
    <div id="medication-schedule-view" className="space-y-6 animate-in fade-in duration-200">
      {/* Top Header & Google Calendar Integration Banner */}
      <div
        className={`p-5 sm:p-6 rounded-3xl border shadow-lg transition-all ${
          isDark
            ? 'bg-slate-900/90 border-slate-800/80 text-white'
            : 'bg-white border-slate-200/90 text-slate-900 shadow-slate-200/50'
        }`}
      >
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-blue-600 via-indigo-600 to-cyan-500 text-white flex items-center justify-center shadow-md shadow-indigo-900/30">
                <CalendarIcon className="w-5 h-5" />
              </div>
              <div>
                <h1 className="text-lg sm:text-xl font-black tracking-tight flex items-center gap-2">
                  <span>{t.medicationTitle}</span>
                  <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-blue-500/20 text-blue-400 border border-blue-500/30">
                    Google Calendar Sync
                  </span>
                </h1>
                <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                  {t.medicationSubtitle}
                </p>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2.5 flex-wrap w-full lg:w-auto">
            {/* Google Calendar Connection Indicator & Action */}
            {hasGoogleAuth ? (
              <div className="flex items-center gap-2">
                <div
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold border ${
                    isDark ? 'bg-emerald-950/50 text-emerald-300 border-emerald-800/50' : 'bg-emerald-50 text-emerald-800 border-emerald-200'
                  }`}
                >
                  <CalendarCheck className="w-4 h-4 text-emerald-500" />
                  <span>{t.googleCalendarConnected}</span>
                </div>
                <button
                  onClick={handleDisconnectGoogleCalendar}
                  className={`px-3 py-2 text-xs font-bold rounded-xl border transition-colors cursor-pointer ${
                    isDark ? 'border-slate-700 text-slate-400 hover:text-slate-200' : 'border-slate-300 text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {t.btnDisconnectGoogleCalendar}
                </button>
              </div>
            ) : (
              <button
                id="btn-connect-google-calendar"
                onClick={handleConnectGoogleCalendar}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white text-xs font-black shadow-md shadow-blue-900/30 transition-all active:scale-95 cursor-pointer"
              >
                <CalendarIcon className="w-4 h-4" />
                <span>{t.btnConnectGoogleCalendar}</span>
              </button>
            )}

            {/* Sync All to Google Calendar */}
            <button
              id="btn-sync-all-gcal"
              onClick={handleSyncAllToGoogleCalendar}
              disabled={isSyncingAll}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 active:scale-95 text-white text-xs font-black shadow-md shadow-emerald-900/30 transition-all cursor-pointer disabled:opacity-75"
            >
              <RefreshCw className={`w-4 h-4 ${isSyncingAll ? 'animate-spin' : ''}`} />
              <span>{isSyncingAll ? 'Đang đồng bộ...' : t.btnSyncAllToGoogleCalendar}</span>
            </button>

            {/* Prescribe / Add New Medication */}
            <button
              id="btn-add-medication-open"
              onClick={() => setIsAddModalOpen(true)}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-500 hover:to-purple-500 active:scale-95 text-white text-xs font-black shadow-md shadow-purple-900/30 transition-all cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>{t.btnAddMedication}</span>
            </button>
          </div>
        </div>

        {/* Sync Progress Notification Banner */}
        {syncProgressMsg && (
          <div className="mt-4 p-3 rounded-2xl bg-blue-500/15 border border-blue-500/30 text-blue-400 text-xs font-bold flex items-center gap-2 animate-in fade-in">
            <Sparkles className="w-4 h-4 text-blue-400 animate-pulse" />
            <span>{syncProgressMsg}</span>
          </div>
        )}

        {/* Metric Cards Summary */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-5 pt-5 border-t border-slate-700/40">
          <div className={`p-3.5 rounded-2xl border ${isDark ? 'bg-slate-950/60 border-slate-800' : 'bg-slate-50 border-slate-200'}`}>
            <p className={`text-[11px] font-bold ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{t.medTotalDoses}</p>
            <p className="text-xl sm:text-2xl font-black mt-1 text-blue-500">{totalCount}</p>
          </div>

          <div className={`p-3.5 rounded-2xl border ${isDark ? 'bg-slate-950/60 border-slate-800' : 'bg-slate-50 border-slate-200'}`}>
            <p className={`text-[11px] font-bold ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{t.medCompletedDoses}</p>
            <p className="text-xl sm:text-2xl font-black mt-1 text-emerald-500">{completedCount}</p>
          </div>

          <div className={`p-3.5 rounded-2xl border ${isDark ? 'bg-slate-950/60 border-slate-800' : 'bg-slate-50 border-slate-200'}`}>
            <p className={`text-[11px] font-bold ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{t.medPendingDoses}</p>
            <p className="text-xl sm:text-2xl font-black mt-1 text-amber-500">{pendingCount}</p>
          </div>

          <div className={`p-3.5 rounded-2xl border ${isDark ? 'bg-slate-950/60 border-slate-800' : 'bg-slate-50 border-slate-200'}`}>
            <p className={`text-[11px] font-bold ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{t.medSyncedCount}</p>
            <p className="text-xl sm:text-2xl font-black mt-1 text-cyan-400">{syncedCount}</p>
          </div>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div
        className={`p-4 rounded-2xl border flex flex-col sm:flex-row items-center justify-between gap-3 ${
          isDark ? 'bg-slate-900/80 border-slate-800' : 'bg-white border-slate-200'
        }`}
      >
        {/* Search */}
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder={t.medSearchPlaceholder}
            className={`w-full pl-9 pr-3 py-2 text-xs rounded-xl border focus:outline-none focus:ring-2 focus:ring-blue-500 ${
              isDark ? 'bg-slate-950 border-slate-800 text-white placeholder-slate-500' : 'bg-slate-50 border-slate-200 text-slate-900'
            }`}
          />
        </div>

        {/* Patient & Status Selectors */}
        <div className="flex items-center gap-2 w-full sm:w-auto flex-wrap sm:flex-nowrap">
          <select
            value={selectedPatientFilter}
            onChange={(e) => setSelectedPatientFilter(e.target.value)}
            className={`px-3 py-2 text-xs font-semibold rounded-xl border focus:outline-none ${
              isDark ? 'bg-slate-950 border-slate-800 text-slate-200' : 'bg-slate-50 border-slate-200 text-slate-800'
            }`}
          >
            <option value="All">{language === 'vi' ? 'Tất cả bệnh nhân' : 'All Patients'}</option>
            {patients.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} ({p.roomNumber})
              </option>
            ))}
          </select>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as any)}
            className={`px-3 py-2 text-xs font-semibold rounded-xl border focus:outline-none ${
              isDark ? 'bg-slate-950 border-slate-800 text-slate-200' : 'bg-slate-50 border-slate-200 text-slate-800'
            }`}
          >
            <option value="All">{t.medFilterAll}</option>
            <option value="Scheduled">{t.medFilterScheduled}</option>
            <option value="Administered">{t.medFilterAdministered}</option>
            <option value="Held">{t.medFilterHeld}</option>
          </select>
        </div>
      </div>

      {/* Medication Cards List */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {filteredMedications.length === 0 ? (
          <div
            className={`col-span-full p-12 text-center rounded-3xl border border-dashed ${
              isDark ? 'border-slate-800 text-slate-500' : 'border-slate-300 text-slate-400'
            }`}
          >
            <Pill className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p className="font-bold text-sm">{language === 'vi' ? 'Không tìm thấy lịch thuốc nào phù hợp' : 'No matching medication schedules'}</p>
            <p className="text-xs mt-1">{language === 'vi' ? 'Bấm "Kê Đơn & Thêm Lịch Thuốc" để tạo lịch dùng thuốc mới cho bệnh nhân.' : 'Click "Prescribe & Add Schedule" to create a new medication dose.'}</p>
          </div>
        ) : (
          filteredMedications.map((med) => {
            const routeInfo = getRouteBadge(med.route);
            const isDone = med.status === 'Administered';
            const isHeld = med.status === 'Held';

            return (
              <div
                key={med.id}
                id={`med-card-${med.id}`}
                className={`p-5 rounded-3xl border shadow-md transition-all flex flex-col justify-between space-y-4 ${
                  isDone
                    ? isDark
                      ? 'bg-slate-900/60 border-slate-800/60 opacity-80'
                      : 'bg-slate-50 border-slate-200 opacity-90'
                    : isHeld
                    ? isDark
                      ? 'bg-amber-950/20 border-amber-800/50'
                      : 'bg-amber-50/60 border-amber-200'
                    : isDark
                    ? 'bg-slate-900 border-slate-800 hover:border-blue-700/60'
                    : 'bg-white border-slate-200 hover:border-blue-300'
                }`}
              >
                {/* Header: Patient & Room Info */}
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="px-2.5 py-1 text-xs font-black rounded-xl bg-blue-600 text-white shadow-sm">
                        {med.roomNumber} - {med.bed}
                      </span>
                      <span className={`text-xs font-bold ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                        {med.patientName}
                      </span>
                    </div>

                    {/* Status Badge */}
                    <span
                      className={`px-2.5 py-1 text-[11px] font-bold rounded-xl border flex items-center gap-1 ${
                        isDone
                          ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                          : isHeld
                          ? 'bg-amber-500/20 text-amber-400 border-amber-500/30'
                          : 'bg-blue-500/20 text-blue-400 border-blue-500/30 animate-pulse'
                      }`}
                    >
                      {isDone ? <CheckCircle2 className="w-3.5 h-3.5" /> : isHeld ? <PauseCircle className="w-3.5 h-3.5" /> : <Clock className="w-3.5 h-3.5" />}
                      {isDone ? t.medStatusAdministered : isHeld ? t.medStatusHeld : t.medStatusScheduled}
                    </span>
                  </div>

                  {/* Medication Details */}
                  <div className="mt-3.5 space-y-1.5">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className={`text-base font-black tracking-tight ${isDark ? 'text-white' : 'text-slate-900'}`}>
                        {med.medicationName}
                      </h3>
                      <span className={`px-2 py-0.5 text-[11px] font-bold rounded-lg border flex items-center gap-1 shrink-0 ${routeInfo.bg}`}>
                        {routeInfo.icon}
                        <span>{routeInfo.label}</span>
                      </span>
                    </div>

                    <p className="text-xs font-bold text-blue-500">
                      {language === 'vi' ? 'Liều lượng:' : 'Dosage:'} {med.dosage}
                    </p>

                    <div className="flex items-center gap-2 text-xs font-semibold text-slate-400">
                      <Clock className="w-3.5 h-3.5 text-amber-500" />
                      <span>
                        {med.scheduledTime} ({med.frequency})
                      </span>
                    </div>

                    {/* Instructions & Warnings */}
                    {med.instructions && (
                      <p className={`text-xs p-2.5 rounded-xl border mt-2 leading-relaxed ${
                        med.preVitalsRequired
                          ? isDark ? 'bg-rose-950/30 text-rose-300 border-rose-800/40' : 'bg-rose-50 text-rose-800 border-rose-200'
                          : isDark ? 'bg-slate-950 text-slate-300 border-slate-800' : 'bg-slate-50 text-slate-700 border-slate-200'
                      }`}>
                        <span className="font-bold">{med.preVitalsRequired ? '⚠️ Yêu cầu đo Mạch/HA: ' : 'Lưu ý: '}</span>
                        {med.instructions}
                      </p>
                    )}

                    {/* Prescriber & Nurse Info */}
                    <div className={`pt-2 text-[11px] space-y-0.5 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                      <p>
                        👨‍⚕️ {language === 'vi' ? 'BS chỉ định:' : 'Prescribed by:'}{' '}
                        <span className="font-semibold text-slate-300">{med.prescribedByDoctorName}</span>
                      </p>
                      {med.assignedNurseName && (
                        <p>
                          👩‍⚕️ {language === 'vi' ? 'Điều dưỡng:' : 'Assigned Nurse:'}{' '}
                          <span className="font-semibold text-slate-300">{med.assignedNurseName}</span>
                        </p>
                      )}
                    </div>

                    {/* Administration Record info if administered */}
                    {isDone && (
                      <div className={`p-2.5 rounded-xl text-xs space-y-1 mt-2 border ${
                        isDark ? 'bg-emerald-950/40 border-emerald-800/50 text-emerald-300' : 'bg-emerald-50 border-emerald-200 text-emerald-900'
                      }`}>
                        <p className="font-bold flex items-center gap-1">
                          <Check className="w-3.5 h-3.5 text-emerald-500" />
                          <span>Đã cho dùng: {new Date(med.administeredAt!).toLocaleTimeString('vi-VN')}</span>
                        </p>
                        <p className="text-[11px]">Người thực hiện: {med.administeredBy}</p>
                        {med.recordedHeartRate && (
                          <p className="text-[11px] font-semibold">
                            Mạch trước dùng: {med.recordedHeartRate} BPM {med.recordedBloodPressure ? `• HA: ${med.recordedBloodPressure}` : ''}
                          </p>
                        )}
                        {med.administerNotes && <p className="text-[11px] italic">{med.administerNotes}</p>}
                      </div>
                    )}
                  </div>
                </div>

                {/* Google Calendar Sync Status Bar & Action Controls */}
                <div className="pt-3 border-t border-slate-700/40 space-y-2.5">
                  {/* Google Calendar Link / Status */}
                  <div className="flex items-center justify-between text-xs">
                    {med.googleCalendarEventId ? (
                      <a
                        href={med.googleCalendarHtmlLink || `https://calendar.google.com`}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center gap-1 text-[11px] font-bold text-cyan-400 hover:text-cyan-300 transition-colors"
                        title={t.btnOpenInGCal}
                      >
                        <CalendarCheck className="w-3.5 h-3.5 text-cyan-400" />
                        <span>{language === 'vi' ? 'Đã lên Google Calendar' : 'On Google Calendar'}</span>
                        <ExternalLink className="w-3 h-3 ml-0.5" />
                      </a>
                    ) : (
                      <button
                        onClick={() => handleSyncSingleMedication(med)}
                        disabled={syncingSingleId === med.id}
                        className="flex items-center gap-1 text-[11px] font-bold text-indigo-400 hover:text-indigo-300 transition-colors cursor-pointer disabled:opacity-50"
                      >
                        <CalendarIcon className="w-3.5 h-3.5" />
                        <span>{syncingSingleId === med.id ? 'Đang đồng bộ...' : t.btnSyncSingleToGCal}</span>
                      </button>
                    )}

                    {/* Direct Quick Add URL */}
                    <a
                      href={generateDirectGoogleCalendarUrl(med)}
                      target="_blank"
                      rel="noreferrer"
                      className={`text-[11px] font-semibold hover:underline flex items-center gap-1 ${
                        isDark ? 'text-slate-400 hover:text-slate-200' : 'text-slate-600 hover:text-slate-900'
                      }`}
                      title="Mở thêm nhanh vào lịch cá nhân"
                    >
                      <span>Thêm nhanh</span>
                      <ExternalLink className="w-2.5 h-2.5" />
                    </a>
                  </div>

                  {/* Primary Workflow Buttons */}
                  {!isDone && (
                    <div className="flex items-center gap-2">
                      <button
                        id={`btn-administer-${med.id}`}
                        onClick={() => setAdministeringMed(med)}
                        className="flex-1 py-2 px-3 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 active:scale-95 text-white font-bold text-xs rounded-xl shadow-md shadow-emerald-950/40 transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        <CheckCircle2 className="w-4 h-4" />
                        <span>{t.btnAdministerMed}</span>
                      </button>

                      <button
                        id={`btn-hold-${med.id}`}
                        onClick={() => setHoldingMed(med)}
                        className={`p-2 rounded-xl text-xs font-bold border transition-colors cursor-pointer ${
                          isDark ? 'bg-slate-800 hover:bg-slate-700 text-amber-400 border-slate-700' : 'bg-slate-100 hover:bg-slate-200 text-amber-700 border-slate-300'
                        }`}
                        title={t.btnHoldMed}
                      >
                        <PauseCircle className="w-4 h-4" />
                      </button>

                      <button
                        onClick={() => setDeletingMedId(med.id)}
                        className="p-2 rounded-xl text-xs text-rose-400 hover:text-rose-300 hover:bg-rose-950/30 transition-colors cursor-pointer"
                        title="Xóa lịch"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* MODAL 1: Administer Medication (Cho dùng thuốc & ký nhận) */}
      {administeringMed && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-150">
          <div
            className={`w-full max-w-lg rounded-3xl border p-6 shadow-2xl space-y-4 ${
              isDark ? 'bg-slate-900 border-slate-800 text-white' : 'bg-white border-slate-200 text-slate-900'
            }`}
          >
            <div className="flex items-center justify-between border-b pb-3 border-slate-700/50">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
                  <CheckCircle2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black">{t.medAdministerModalTitle}</h3>
                  <p className="text-xs text-slate-400">
                    BN: {administeringMed.patientName} ({administeringMed.roomNumber} - {administeringMed.bed})
                  </p>
                </div>
              </div>
            </div>

            <form onSubmit={handleSubmitAdminister} className="space-y-4">
              <div className={`p-3 rounded-2xl border ${isDark ? 'bg-slate-950 border-slate-800' : 'bg-slate-50 border-slate-200'}`}>
                <p className="text-xs font-black text-blue-400">{administeringMed.medicationName}</p>
                <p className="text-xs font-semibold text-slate-300 mt-0.5">
                  Liều lượng: {administeringMed.dosage} • Đường dùng: {administeringMed.route}
                </p>
                <p className="text-xs text-slate-400 mt-1">{administeringMed.instructions}</p>
              </div>

              {administeringMed.preVitalsRequired && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-bold text-rose-400 flex items-center gap-1">
                      <Heart className="w-3.5 h-3.5 text-rose-500" />
                      <span>{t.medPulseBeforeDose}</span>
                    </label>
                    <input
                      type="number"
                      value={adminPulse}
                      onChange={(e) => setAdminPulse(e.target.value)}
                      placeholder="vd: 75"
                      className={`w-full mt-1 px-3 py-2 text-xs rounded-xl border focus:outline-none focus:ring-2 focus:ring-emerald-500 ${
                        isDark ? 'bg-slate-950 border-slate-800 text-white' : 'bg-slate-50 border-slate-200 text-slate-900'
                      }`}
                    />
                  </div>

                  <div>
                    <label className="text-xs font-bold text-blue-400">{t.medBPBeforeDose}</label>
                    <input
                      type="text"
                      value={adminBP}
                      onChange={(e) => setAdminBP(e.target.value)}
                      placeholder="vd: 120/80"
                      className={`w-full mt-1 px-3 py-2 text-xs rounded-xl border focus:outline-none focus:ring-2 focus:ring-emerald-500 ${
                        isDark ? 'bg-slate-950 border-slate-800 text-white' : 'bg-slate-50 border-slate-200 text-slate-900'
                      }`}
                    />
                  </div>
                </div>
              )}

              <div>
                <label className="text-xs font-bold text-slate-300">{language === 'vi' ? 'Điều dưỡng / Bác sĩ cho thuốc:' : 'Administered by:'}</label>
                <input
                  type="text"
                  value={adminStaffName}
                  onChange={(e) => setAdminStaffName(e.target.value)}
                  className={`w-full mt-1 px-3 py-2 text-xs rounded-xl border focus:outline-none ${
                    isDark ? 'bg-slate-950 border-slate-800 text-white' : 'bg-slate-50 border-slate-200 text-slate-900'
                  }`}
                  required
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-300">{t.medAdministerNotes}</label>
                <textarea
                  value={adminNotes}
                  onChange={(e) => setAdminNotes(e.target.value)}
                  rows={2}
                  className={`w-full mt-1 px-3 py-2 text-xs rounded-xl border focus:outline-none ${
                    isDark ? 'bg-slate-950 border-slate-800 text-white' : 'bg-slate-50 border-slate-200 text-slate-900'
                  }`}
                />
              </div>

              <div className="pt-3 border-t border-slate-700/50 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setAdministeringMed(null)}
                  className={`px-4 py-2 rounded-xl text-xs font-bold ${
                    isDark ? 'bg-slate-800 hover:bg-slate-700 text-slate-300' : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                  }`}
                >
                  {t.btnCancel}
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingAdmin}
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-black shadow-md shadow-emerald-950/50 flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>{isSubmittingAdmin ? t.btnAdministering : t.btnAdministerMed}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: Hold Medication Dose */}
      {holdingMed && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-150">
          <div
            className={`w-full max-w-md rounded-3xl border p-6 shadow-2xl space-y-4 ${
              isDark ? 'bg-slate-900 border-slate-800 text-white' : 'bg-white border-slate-200 text-slate-900'
            }`}
          >
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center">
                <PauseCircle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-black text-amber-400">{t.medHoldModalTitle}</h3>
                <p className="text-xs text-slate-400">{holdingMed.medicationName} - BN: {holdingMed.patientName}</p>
              </div>
            </div>

            <form onSubmit={handleSubmitHold} className="space-y-4">
              <div>
                <label className="text-xs font-bold text-slate-300">{t.medHoldReason}</label>
                <textarea
                  value={holdReason}
                  onChange={(e) => setHoldReason(e.target.value)}
                  rows={3}
                  className={`w-full mt-1 px-3 py-2 text-xs rounded-xl border focus:outline-none ${
                    isDark ? 'bg-slate-950 border-slate-800 text-white' : 'bg-slate-50 border-slate-200 text-slate-900'
                  }`}
                  required
                />
              </div>

              <div className="pt-3 border-t border-slate-700/50 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setHoldingMed(null)}
                  className={`px-4 py-2 rounded-xl text-xs font-bold ${
                    isDark ? 'bg-slate-800 hover:bg-slate-700 text-slate-300' : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                  }`}
                >
                  {t.btnCancel}
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingHold}
                  className="px-5 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-xl text-xs font-black shadow-md shadow-amber-950/50 flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  <PauseCircle className="w-4 h-4" />
                  <span>{isSubmittingHold ? 'Đang lưu...' : t.btnHoldMed}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: Prescribe & Add New Medication Schedule */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-150 overflow-y-auto">
          <div
            className={`w-full max-w-2xl rounded-3xl border p-6 shadow-2xl space-y-4 my-8 ${
              isDark ? 'bg-slate-900 border-slate-800 text-white' : 'bg-white border-slate-200 text-slate-900'
            }`}
          >
            <div className="flex items-center justify-between border-b pb-3 border-slate-700/50">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-purple-600 to-indigo-600 text-white flex items-center justify-center">
                  <Plus className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black">{t.btnAddMedication}</h3>
                  <p className="text-xs text-slate-400">
                    {language === 'vi' ? 'Kê đơn thuốc và lên lịch nhắc nhở trên Google Calendar' : 'Prescribe medication & schedule Google Calendar reminders'}
                  </p>
                </div>
              </div>
            </div>

            {/* Quick Prescribing Preset Selector */}
            <div>
              <p className="text-[11px] font-bold text-purple-400 mb-1.5 flex items-center gap-1">
                <Sparkles className="w-3.5 h-3.5" />
                <span>{language === 'vi' ? 'Thuốc cấp cứu & tim mạch gợi ý nhanh:' : 'Quick ICU prescription templates:'}</span>
              </p>
              <div className="flex items-center gap-1.5 flex-wrap">
                {PRESET_MEDICATIONS.map((preset, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handleSelectPreset(preset)}
                    className={`px-2.5 py-1 text-[11px] font-semibold rounded-lg border transition-colors cursor-pointer ${
                      newMedData.medicationName === preset.name
                        ? 'bg-purple-600 text-white border-purple-500'
                        : isDark
                        ? 'bg-slate-950 border-slate-800 text-slate-300 hover:border-purple-600'
                        : 'bg-slate-100 border-slate-200 text-slate-700 hover:border-purple-400'
                    }`}
                  >
                    {preset.name}
                  </button>
                ))}
              </div>
            </div>

            <form onSubmit={handleSubmitNewMedication} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-300">{t.medSelectPatient}</label>
                  <select
                    value={newMedData.patientId}
                    onChange={(e) => setNewMedData({ ...newMedData, patientId: e.target.value })}
                    className={`w-full mt-1 px-3 py-2 text-xs rounded-xl border focus:outline-none ${
                      isDark ? 'bg-slate-950 border-slate-800 text-white' : 'bg-slate-50 border-slate-200 text-slate-900'
                    }`}
                    required
                  >
                    {patients.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} - Phòng {p.roomNumber} ({p.bed})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-300">{t.medNameLabel}</label>
                  <input
                    type="text"
                    value={newMedData.medicationName}
                    onChange={(e) => setNewMedData({ ...newMedData, medicationName: e.target.value })}
                    placeholder="vd: Digoxin 0.25mg, Furosemide 20mg..."
                    className={`w-full mt-1 px-3 py-2 text-xs rounded-xl border focus:outline-none ${
                      isDark ? 'bg-slate-950 border-slate-800 text-white' : 'bg-slate-50 border-slate-200 text-slate-900'
                    }`}
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-300">{t.medDosageLabel}</label>
                  <input
                    type="text"
                    value={newMedData.dosage}
                    onChange={(e) => setNewMedData({ ...newMedData, dosage: e.target.value })}
                    placeholder="vd: 1 viên, 2 ống..."
                    className={`w-full mt-1 px-3 py-2 text-xs rounded-xl border focus:outline-none ${
                      isDark ? 'bg-slate-950 border-slate-800 text-white' : 'bg-slate-50 border-slate-200 text-slate-900'
                    }`}
                    required
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-300">{t.medRouteLabel}</label>
                  <select
                    value={newMedData.route}
                    onChange={(e) => setNewMedData({ ...newMedData, route: e.target.value as any })}
                    className={`w-full mt-1 px-3 py-2 text-xs rounded-xl border focus:outline-none ${
                      isDark ? 'bg-slate-950 border-slate-800 text-white' : 'bg-slate-50 border-slate-200 text-slate-900'
                    }`}
                  >
                    <option value="Oral">{t.routeOral}</option>
                    <option value="IV">{t.routeIV}</option>
                    <option value="Infusion">{t.routeInfusion}</option>
                    <option value="Subcutaneous">{t.routeSubcutaneous}</option>
                    <option value="IM">{t.routeIM}</option>
                    <option value="Inhalation">{t.routeInhalation}</option>
                    <option value="Topical">{t.routeTopical}</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-300">{t.medTimeLabel}</label>
                  <input
                    type="time"
                    value={newMedData.scheduledTime}
                    onChange={(e) => setNewMedData({ ...newMedData, scheduledTime: e.target.value })}
                    className={`w-full mt-1 px-3 py-2 text-xs rounded-xl border focus:outline-none ${
                      isDark ? 'bg-slate-950 border-slate-800 text-white' : 'bg-slate-50 border-slate-200 text-slate-900'
                    }`}
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-300">{t.medDoctorLabel}</label>
                  <select
                    value={newMedData.prescribedByDoctorId}
                    onChange={(e) => setNewMedData({ ...newMedData, prescribedByDoctorId: e.target.value })}
                    className={`w-full mt-1 px-3 py-2 text-xs rounded-xl border focus:outline-none ${
                      isDark ? 'bg-slate-950 border-slate-800 text-white' : 'bg-slate-50 border-slate-200 text-slate-900'
                    }`}
                  >
                    {doctors.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name} ({d.role || d.department})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-300">{t.medNurseLabel}</label>
                  <select
                    value={newMedData.assignedNurseId}
                    onChange={(e) => setNewMedData({ ...newMedData, assignedNurseId: e.target.value })}
                    className={`w-full mt-1 px-3 py-2 text-xs rounded-xl border focus:outline-none ${
                      isDark ? 'bg-slate-950 border-slate-800 text-white' : 'bg-slate-50 border-slate-200 text-slate-900'
                    }`}
                  >
                    {doctors.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-300">{t.medInstructionsLabel}</label>
                <textarea
                  value={newMedData.instructions}
                  onChange={(e) => setNewMedData({ ...newMedData, instructions: e.target.value })}
                  rows={2}
                  className={`w-full mt-1 px-3 py-2 text-xs rounded-xl border focus:outline-none ${
                    isDark ? 'bg-slate-950 border-slate-800 text-white' : 'bg-slate-50 border-slate-200 text-slate-900'
                  }`}
                />
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="chk-previtals"
                  checked={newMedData.preVitalsRequired}
                  onChange={(e) => setNewMedData({ ...newMedData, preVitalsRequired: e.target.checked })}
                  className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 cursor-pointer"
                />
                <label htmlFor="chk-previtals" className="text-xs font-semibold text-rose-400 cursor-pointer">
                  {t.medPreVitalsLabel}
                </label>
              </div>

              <div className="pt-4 border-t border-slate-700/50 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className={`px-4 py-2 rounded-xl text-xs font-bold ${
                    isDark ? 'bg-slate-800 hover:bg-slate-700 text-slate-300' : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                  }`}
                >
                  {t.btnCancel}
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingNew}
                  className="px-5 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white rounded-xl text-xs font-black shadow-md shadow-purple-950/50 flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  <Plus className="w-4 h-4" />
                  <span>{isSubmittingNew ? 'Đang lưu...' : t.btnAddMedication}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 4: Delete Confirmation Modal */}
      {deletingMedId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-150">
          <div
            className={`w-full max-w-md rounded-3xl border p-6 shadow-2xl space-y-4 ${
              isDark ? 'bg-slate-900 border-slate-800 text-white' : 'bg-white border-slate-200 text-slate-900'
            }`}
          >
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-rose-500/20 text-rose-400 flex items-center justify-center font-bold">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-black text-rose-500">
                  {language === 'vi' ? 'Xác nhận xóa lịch thuốc' : 'Confirm Delete Schedule'}
                </h3>
                <p className="text-xs text-slate-400">
                  {language === 'vi' ? 'Hành động không thể hoàn tác' : 'This action cannot be undone'}
                </p>
              </div>
            </div>

            <p className="text-xs text-slate-300">
              {language === 'vi'
                ? 'Bạn có chắc chắn muốn xóa liều thuốc này khỏi lịch dùng thuốc của bệnh nhân?'
                : 'Are you sure you want to remove this medication schedule?'}
            </p>

            <div className="pt-3 border-t border-slate-700/50 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setDeletingMedId(null)}
                className={`px-4 py-2 rounded-xl text-xs font-bold ${
                  isDark ? 'bg-slate-800 hover:bg-slate-700 text-slate-300' : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                }`}
              >
                {t.btnCancel}
              </button>
              <button
                type="button"
                onClick={async () => {
                  await onDeleteMedication(deletingMedId);
                  setDeletingMedId(null);
                }}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-bold shadow-md shadow-rose-950/50 cursor-pointer"
              >
                {language === 'vi' ? 'Xóa Lịch Thuốc' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
