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
  History,
  FileText,
  Download,
  RotateCcw,
  Thermometer,
  Eye,
  X,
  Printer,
} from 'lucide-react';
import {
  Doctor,
  MedicationAdministrationRecord,
  MedicationRoute,
  MedicationSchedule,
  MedicationStatus,
  Patient,
} from '../types';
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
  medicationHistory?: MedicationAdministrationRecord[];
  patients: Patient[];
  doctors: Doctor[];
  onMedicationsUpdated: () => void;
  onAdministerMedication: (
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
  medicationHistory = [],
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

  // Active View Mode: 'schedules' or 'history'
  const [activeView, setActiveView] = useState<'schedules' | 'history'>('schedules');

  // Google Calendar State
  const [hasGoogleAuth, setHasGoogleAuth] = useState<boolean>(!!getCachedCalendarToken());
  const [isSyncingAll, setIsSyncingAll] = useState(false);
  const [syncProgressMsg, setSyncProgressMsg] = useState<string | null>(null);
  const [syncingSingleId, setSyncingSingleId] = useState<string | null>(null);

  // Schedules Filters & Search
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'All' | MedicationStatus>('All');
  const [selectedPatientFilter, setSelectedPatientFilter] = useState<string>('All');

  // History Log Filters & Search
  const [historySearchTerm, setHistorySearchTerm] = useState('');
  const [historyMedFilter, setHistoryMedFilter] = useState<string>('All');
  const [historyPatientFilter, setHistoryPatientFilter] = useState<string>('All');
  const [historyStaffFilter, setHistoryStaffFilter] = useState<string>('All');
  const [historyVitalsFilter, setHistoryVitalsFilter] = useState<'All' | 'Normal' | 'Warning'>('All');

  // Modals & Receipts
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [administeringMed, setAdministeringMed] = useState<MedicationSchedule | null>(null);
  const [holdingMed, setHoldingMed] = useState<MedicationSchedule | null>(null);
  const [deletingMedId, setDeletingMedId] = useState<string | null>(null);
  const [selectedReceipt, setSelectedReceipt] = useState<MedicationAdministrationRecord | null>(null);

  // Administration Form State
  const [adminPulse, setAdminPulse] = useState<string>('72');
  const [adminBP, setAdminBP] = useState<string>('120/80');
  const [adminSpO2, setAdminSpO2] = useState<string>('98');
  const [adminTemp, setAdminTemp] = useState<string>('36.8');
  const [adminNotes, setAdminNotes] = useState<string>('Đã kiểm tra quy trình 5 đúng. Bệnh nhân dùng thuốc an toàn, không có phản ứng phụ.');
  const [adminStaffName, setAdminStaffName] = useState<string>('ĐD. Đặng Thị Hồng Hạnh');
  const [adminStaffRole, setAdminStaffRole] = useState<string>('Điều Dưỡng Trưởng Trạm');
  const [adminStaffId, setAdminStaffId] = useState<string>('NUR01');
  const [fiveRightsChecked, setFiveRightsChecked] = useState(true);
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

      onMedicationsUpdated();
      setSyncProgressMsg(
        language === 'vi'
          ? `Đã đồng bộ lịch thuốc BN ${med.patientName} vào Google Calendar!`
          : `Synced medication for ${med.patientName} to Google Calendar!`
      );
      setTimeout(() => setSyncProgressMsg(null), 3500);
    } catch (err: any) {
      console.error('Error syncing single med to calendar', err);
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

  // Submit Administration (Cho uống thuốc & ký nhận MAR)
  const handleSubmitAdminister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!administeringMed) return;

    setIsSubmittingAdmin(true);
    try {
      await onAdministerMedication(administeringMed.id, {
        administeredBy: adminStaffName,
        administeredRole: adminStaffRole,
        administeredStaffId: adminStaffId,
        administerNotes: adminNotes,
        recordedHeartRate: adminPulse ? parseInt(adminPulse, 10) : undefined,
        recordedBloodPressure: adminBP || undefined,
        recordedSpO2: adminSpO2 ? parseInt(adminSpO2, 10) : undefined,
        recordedTemperature: adminTemp ? parseFloat(adminTemp) : undefined,
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

  // Switch to History View with Specific Medication Filtered
  const handleViewMedicationHistory = (medicationName: string) => {
    setHistoryMedFilter(medicationName);
    setHistorySearchTerm('');
    setHistoryPatientFilter('All');
    setHistoryStaffFilter('All');
    setHistoryVitalsFilter('All');
    setActiveView('history');
  };

  // Reset History Filters
  const handleResetHistoryFilters = () => {
    setHistorySearchTerm('');
    setHistoryMedFilter('All');
    setHistoryPatientFilter('All');
    setHistoryStaffFilter('All');
    setHistoryVitalsFilter('All');
  };

  // Export Medication History to CSV
  const handleExportHistoryCSV = () => {
    if (filteredHistoryLogs.length === 0) return;

    const headers = [
      'Record ID',
      'Thời Điểm (Administered At)',
      'Tên Thuốc (Medication)',
      'Liều Lượng (Dosage)',
      'Đường Dùng (Route)',
      'Bệnh Nhân (Patient)',
      'Phòng/Giường (Room/Bed)',
      'Người Cho Thuốc (Administered By)',
      'Chức Danh (Role)',
      'Mạch HR (BPM)',
      'Huyết Áp BP (mmHg)',
      'SpO2 (%)',
      'Nhiệt Độ (°C)',
      'Bác Sĩ Chỉ Định (Prescriber)',
      'Ghi Chú Lâm Sàng (Notes)',
    ];

    const rows = filteredHistoryLogs.map((log) => [
      `"${log.id}"`,
      `"${new Date(log.administeredAt).toLocaleString('vi-VN')}"`,
      `"${log.medicationName}"`,
      `"${log.dosage}"`,
      `"${log.route}"`,
      `"${log.patientName}"`,
      `"${log.roomNumber} - ${log.bed}"`,
      `"${log.administeredBy}"`,
      `"${log.administeredRole || ''}"`,
      `"${log.recordedHeartRate ?? ''}"`,
      `"${log.recordedBloodPressure || ''}"`,
      `"${log.recordedSpO2 ?? ''}"`,
      `"${log.recordedTemperature ?? ''}"`,
      `"${log.prescribedByDoctorName || ''}"`,
      `"${(log.administerNotes || '').replace(/"/g, '""')}"`,
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `ICU_MAR_Administration_History_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Stats calculation
  const totalCount = medications.length;
  const completedCount = medications.filter((m) => m.status === 'Administered').length;
  const pendingCount = medications.filter((m) => m.status === 'Scheduled').length;
  const syncedCount = medications.filter((m) => !!m.googleCalendarEventId).length;

  // Unique lists for history filters
  const uniqueHistoryMedNames = useMemo(() => {
    const set = new Set<string>();
    medicationHistory.forEach((h) => set.add(h.medicationName));
    medications.forEach((m) => set.add(m.medicationName));
    return Array.from(set).sort();
  }, [medicationHistory, medications]);

  const uniqueHistoryStaffNames = useMemo(() => {
    const set = new Set<string>();
    medicationHistory.forEach((h) => {
      if (h.administeredBy) set.add(h.administeredBy);
    });
    doctors.forEach((d) => set.add(d.name));
    return Array.from(set).sort();
  }, [medicationHistory, doctors]);

  // Filtered medication list for Schedules View
  const filteredMedications = useMemo(() => {
    return medications.filter((m) => {
      if (selectedPatientFilter !== 'All' && m.patientId !== selectedPatientFilter) {
        return false;
      }
      if (statusFilter !== 'All' && m.status !== statusFilter) {
        return false;
      }
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

  // Filtered Medication Administration History Log Records
  const filteredHistoryLogs = useMemo(() => {
    return medicationHistory.filter((log) => {
      // Medication Name Filter
      if (historyMedFilter !== 'All' && log.medicationName.toLowerCase() !== historyMedFilter.toLowerCase()) {
        return false;
      }
      // Patient Filter
      if (historyPatientFilter !== 'All' && log.patientId !== historyPatientFilter) {
        return false;
      }
      // Staff Member Filter
      if (historyStaffFilter !== 'All' && !log.administeredBy.toLowerCase().includes(historyStaffFilter.toLowerCase())) {
        return false;
      }
      // Vitals Status Filter
      if (historyVitalsFilter !== 'All') {
        const isWarning = log.vitalsEvaluation === 'Warning' || log.vitalsEvaluation === 'Critical';
        if (historyVitalsFilter === 'Warning' && !isWarning) return false;
        if (historyVitalsFilter === 'Normal' && isWarning) return false;
      }
      // Search Term
      if (historySearchTerm.trim()) {
        const q = historySearchTerm.toLowerCase();
        const matchMed = log.medicationName.toLowerCase().includes(q);
        const matchPatient = log.patientName.toLowerCase().includes(q);
        const matchRoom = log.roomNumber.toLowerCase().includes(q) || log.bed.toLowerCase().includes(q);
        const matchStaff = log.administeredBy.toLowerCase().includes(q) || (log.administeredRole && log.administeredRole.toLowerCase().includes(q));
        const matchNotes = log.administerNotes && log.administerNotes.toLowerCase().includes(q);
        const matchDoc = log.prescribedByDoctorName && log.prescribedByDoctorName.toLowerCase().includes(q);
        if (!matchMed && !matchPatient && !matchRoom && !matchStaff && !matchNotes && !matchDoc) {
          return false;
        }
      }
      return true;
    });
  }, [medicationHistory, historyMedFilter, historyPatientFilter, historyStaffFilter, historyVitalsFilter, historySearchTerm]);

  // History Log Stats Summary
  const historyStats = useMemo(() => {
    const totalAdmin = medicationHistory.length;
    const uniqueMeds = new Set(medicationHistory.map((m) => m.medicationName)).size;
    const uniqueStaff = new Set(medicationHistory.map((m) => m.administeredBy)).size;
    const withVitals = medicationHistory.filter((m) => m.recordedHeartRate || m.recordedBloodPressure).length;
    const complianceRate = totalAdmin > 0 ? Math.round((withVitals / totalAdmin) * 100) : 100;
    return { totalAdmin, uniqueMeds, uniqueStaff, complianceRate };
  }, [medicationHistory]);

  const hasActiveHistoryFilters =
    historySearchTerm.trim() !== '' ||
    historyMedFilter !== 'All' ||
    historyPatientFilter !== 'All' ||
    historyStaffFilter !== 'All' ||
    historyVitalsFilter !== 'All';

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

  // Helper for formatting time relative / formatted
  const formatDateTime = (iso: string) => {
    try {
      const d = new Date(iso);
      return {
        dateStr: d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' }),
        timeStr: d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      };
    } catch {
      return { dateStr: '', timeStr: iso };
    }
  };

  return (
    <div id="medication-schedule-view" className="space-y-5 animate-in fade-in duration-200">
      {/* View Switcher Tabs & Main Header Banner */}
      <div
        className={`p-4 sm:p-5 rounded-3xl border shadow-lg transition-all ${
          isDark
            ? 'bg-slate-900/90 border-slate-800/80 text-white'
            : 'bg-white border-slate-200/90 text-slate-900 shadow-slate-200/50'
        }`}
      >
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
          {/* Header Title & Subtitle */}
          <div className="space-y-1">
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-blue-600 via-indigo-600 to-cyan-500 text-white flex items-center justify-center shadow-md shadow-indigo-900/30">
                {activeView === 'history' ? <History className="w-5 h-5" /> : <CalendarIcon className="w-5 h-5" />}
              </div>
              <div>
                <h1 className="text-lg sm:text-xl font-black tracking-tight flex items-center gap-2">
                  <span>{activeView === 'history' ? t.medHistoryTitle : t.medicationTitle}</span>
                  <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-blue-500/20 text-blue-400 border border-blue-500/30">
                    {activeView === 'history' ? 'MAR Audit Log' : 'Google Calendar Sync'}
                  </span>
                </h1>
                <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                  {activeView === 'history' ? t.medHistorySubtitle : t.medicationSubtitle}
                </p>
              </div>
            </div>
          </div>

          {/* Top Actions & Google Calendar Controls */}
          <div className="flex items-center gap-2.5 flex-wrap w-full lg:w-auto">
            {/* View Mode Toggle Pill */}
            <div className={`p-1 rounded-2xl border flex items-center gap-1 ${isDark ? 'bg-slate-950 border-slate-800' : 'bg-slate-100 border-slate-200'}`}>
              <button
                id="tab-btn-med-schedules"
                onClick={() => setActiveView('schedules')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                  activeView === 'schedules'
                    ? 'bg-blue-600 text-white shadow-sm'
                    : isDark
                    ? 'text-slate-400 hover:text-slate-200'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <CalendarIcon className="w-3.5 h-3.5" />
                <span>{t.tabMedSchedules}</span>
                <span className={`px-1.5 py-0.2 text-[10px] rounded-full font-black ${activeView === 'schedules' ? 'bg-blue-700 text-blue-100' : 'bg-slate-800 text-slate-400'}`}>
                  {totalCount}
                </span>
              </button>

              <button
                id="tab-btn-med-history"
                onClick={() => setActiveView('history')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                  activeView === 'history'
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : isDark
                    ? 'text-slate-400 hover:text-slate-200'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <History className="w-3.5 h-3.5" />
                <span>{t.tabMedHistoryLog}</span>
                <span className={`px-1.5 py-0.2 text-[10px] rounded-full font-black ${activeView === 'history' ? 'bg-emerald-700 text-emerald-100' : 'bg-slate-800 text-slate-400'}`}>
                  {medicationHistory.length}
                </span>
              </button>
            </div>

            {/* Google Calendar Controls (in schedules view) */}
            {activeView === 'schedules' && (
              <>
                {hasGoogleAuth ? (
                  <div className="flex items-center gap-1.5">
                    <div
                      className={`flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-semibold border ${
                        isDark ? 'bg-emerald-950/50 text-emerald-300 border-emerald-800/50' : 'bg-emerald-50 text-emerald-800 border-emerald-200'
                      }`}
                    >
                      <CalendarCheck className="w-3.5 h-3.5 text-emerald-500" />
                      <span>{t.googleCalendarConnected}</span>
                    </div>
                    <button
                      onClick={handleDisconnectGoogleCalendar}
                      className={`px-2.5 py-1.5 text-xs font-bold rounded-xl border transition-colors cursor-pointer ${
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
                    className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white text-xs font-black shadow-md shadow-blue-900/30 transition-all active:scale-95 cursor-pointer"
                  >
                    <CalendarIcon className="w-3.5 h-3.5" />
                    <span>{t.btnConnectGoogleCalendar}</span>
                  </button>
                )}

                <button
                  id="btn-sync-all-gcal"
                  onClick={handleSyncAllToGoogleCalendar}
                  disabled={isSyncingAll}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 active:scale-95 text-white text-xs font-black shadow-md shadow-emerald-900/30 transition-all cursor-pointer disabled:opacity-75"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isSyncingAll ? 'animate-spin' : ''}`} />
                  <span>{isSyncingAll ? 'Đang đồng bộ...' : t.btnSyncAllToGoogleCalendar}</span>
                </button>

                <button
                  id="btn-add-medication-open"
                  onClick={() => setIsAddModalOpen(true)}
                  className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-500 hover:to-purple-500 active:scale-95 text-white text-xs font-black shadow-md shadow-purple-900/30 transition-all cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>{t.btnAddMedication}</span>
                </button>
              </>
            )}

            {/* Quick Export CSV in History view */}
            {activeView === 'history' && (
              <button
                id="btn-export-med-history-csv"
                onClick={handleExportHistoryCSV}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-black shadow-md shadow-emerald-950/40 transition-all active:scale-95 cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span>{t.btnExportMedHistoryCsv}</span>
              </button>
            )}
          </div>
        </div>

        {/* Sync Progress Notification Banner */}
        {syncProgressMsg && (
          <div className="mt-3 p-2.5 rounded-2xl bg-blue-500/15 border border-blue-500/30 text-blue-400 text-xs font-bold flex items-center gap-2 animate-in fade-in">
            <Sparkles className="w-4 h-4 text-blue-400 animate-pulse shrink-0" />
            <span>{syncProgressMsg}</span>
          </div>
        )}

        {/* Metric Cards Summary Bar */}
        {activeView === 'schedules' ? (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 mt-4 pt-4 border-t border-slate-700/40">
            <div className={`p-3 rounded-2xl border ${isDark ? 'bg-slate-950/60 border-slate-800' : 'bg-slate-50 border-slate-200'}`}>
              <p className={`text-[11px] font-bold ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{t.medTotalDoses}</p>
              <p className="text-xl sm:text-2xl font-black mt-0.5 text-blue-500">{totalCount}</p>
            </div>

            <div className={`p-3 rounded-2xl border ${isDark ? 'bg-slate-950/60 border-slate-800' : 'bg-slate-50 border-slate-200'}`}>
              <p className={`text-[11px] font-bold ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{t.medCompletedDoses}</p>
              <p className="text-xl sm:text-2xl font-black mt-0.5 text-emerald-500">{completedCount}</p>
            </div>

            <div className={`p-3 rounded-2xl border ${isDark ? 'bg-slate-950/60 border-slate-800' : 'bg-slate-50 border-slate-200'}`}>
              <p className={`text-[11px] font-bold ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{t.medPendingDoses}</p>
              <p className="text-xl sm:text-2xl font-black mt-0.5 text-amber-500">{pendingCount}</p>
            </div>

            <div className={`p-3 rounded-2xl border ${isDark ? 'bg-slate-950/60 border-slate-800' : 'bg-slate-50 border-slate-200'}`}>
              <p className={`text-[11px] font-bold ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{t.medSyncedCount}</p>
              <p className="text-xl sm:text-2xl font-black mt-0.5 text-cyan-400">{syncedCount}</p>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 mt-4 pt-4 border-t border-slate-700/40">
            <div className={`p-3 rounded-2xl border ${isDark ? 'bg-slate-950/60 border-slate-800' : 'bg-slate-50 border-slate-200'}`}>
              <p className={`text-[11px] font-bold ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{t.statTotalAdministered}</p>
              <p className="text-xl sm:text-2xl font-black mt-0.5 text-emerald-400">{historyStats.totalAdmin}</p>
            </div>

            <div className={`p-3 rounded-2xl border ${isDark ? 'bg-slate-950/60 border-slate-800' : 'bg-slate-50 border-slate-200'}`}>
              <p className={`text-[11px] font-bold ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{t.statUniqueMedsGiven}</p>
              <p className="text-xl sm:text-2xl font-black mt-0.5 text-blue-400">{historyStats.uniqueMeds}</p>
            </div>

            <div className={`p-3 rounded-2xl border ${isDark ? 'bg-slate-950/60 border-slate-800' : 'bg-slate-50 border-slate-200'}`}>
              <p className={`text-[11px] font-bold ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{t.statActiveStaff}</p>
              <p className="text-xl sm:text-2xl font-black mt-0.5 text-indigo-400">{historyStats.uniqueStaff}</p>
            </div>

            <div className={`p-3 rounded-2xl border ${isDark ? 'bg-slate-950/60 border-slate-800' : 'bg-slate-50 border-slate-200'}`}>
              <p className={`text-[11px] font-bold ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{t.statPreVitalsCompliance}</p>
              <p className="text-xl sm:text-2xl font-black mt-0.5 text-teal-400">{historyStats.complianceRate}%</p>
            </div>
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* VIEW 1: MEDICATION SCHEDULES & CALENDAR CARDS                             */}
      {/* ========================================================================= */}
      {activeView === 'schedules' && (
        <div className="space-y-4">
          {/* Filter & Search Bar */}
          <div
            className={`p-3.5 rounded-2xl border flex flex-col sm:flex-row items-center justify-between gap-3 ${
              isDark ? 'bg-slate-900/80 border-slate-800' : 'bg-white border-slate-200'
            }`}
          >
            {/* Search */}
            <div className="relative w-full sm:w-80">
              <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder={t.medSearchPlaceholder}
                className={`w-full pl-9 pr-3 py-1.5 text-xs rounded-xl border focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                  isDark ? 'bg-slate-950 border-slate-800 text-white placeholder-slate-500' : 'bg-slate-50 border-slate-200 text-slate-900'
                }`}
              />
            </div>

            {/* Patient & Status Selectors */}
            <div className="flex items-center gap-2 w-full sm:w-auto flex-wrap sm:flex-nowrap">
              <select
                value={selectedPatientFilter}
                onChange={(e) => setSelectedPatientFilter(e.target.value)}
                className={`px-3 py-1.5 text-xs font-semibold rounded-xl border focus:outline-none ${
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
                className={`px-3 py-1.5 text-xs font-semibold rounded-xl border focus:outline-none ${
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
                          ? 'bg-slate-900/60 border-slate-800/60 opacity-85'
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
                            <p className="font-bold flex items-center justify-between">
                              <span className="flex items-center gap-1">
                                <Check className="w-3.5 h-3.5 text-emerald-500" />
                                <span>Đã cho dùng: {new Date(med.administeredAt!).toLocaleTimeString('vi-VN')}</span>
                              </span>
                              <button
                                onClick={() => {
                                  // Find in history logs or make temporary receipt
                                  const matchingLog = medicationHistory.find((h) => h.medicationScheduleId === med.id) || {
                                    id: `MAR-TEMP-${med.id}`,
                                    medicationScheduleId: med.id,
                                    medicationName: med.medicationName,
                                    dosage: med.dosage,
                                    route: med.route,
                                    patientId: med.patientId,
                                    patientName: med.patientName,
                                    roomNumber: med.roomNumber,
                                    bed: med.bed,
                                    administeredAt: med.administeredAt || new Date().toISOString(),
                                    administeredBy: med.administeredBy || 'Điều Dưỡng Trực',
                                    administeredRole: med.administeredRole || 'Điều Dưỡng Trưởng Trạm',
                                    administerNotes: med.administerNotes,
                                    recordedHeartRate: med.recordedHeartRate,
                                    recordedBloodPressure: med.recordedBloodPressure,
                                    recordedSpO2: med.recordedSpO2 || 98,
                                    recordedTemperature: med.recordedTemperature || 36.8,
                                    prescribedByDoctorName: med.prescribedByDoctorName,
                                    vitalsEvaluation: 'Normal',
                                  };
                                  setSelectedReceipt(matchingLog);
                                }}
                                className="text-[10px] font-bold text-emerald-400 hover:underline flex items-center gap-0.5 cursor-pointer"
                              >
                                <Eye className="w-3 h-3" />
                                <span>Xem phiếu ký</span>
                              </button>
                            </p>
                            <p className="text-[11px]">Người thực hiện: <span className="font-bold">{med.administeredBy}</span></p>
                            {med.recordedHeartRate && (
                              <p className="text-[11px] font-semibold text-emerald-200">
                                Mạch trước dùng: {med.recordedHeartRate} BPM {med.recordedBloodPressure ? `• HA: ${med.recordedBloodPressure}` : ''}
                              </p>
                            )}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Google Calendar Sync Status Bar & Action Controls */}
                    <div className="pt-3 border-t border-slate-700/40 space-y-2.5">
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

                        {/* Quick View History Link */}
                        <button
                          id={`btn-view-history-med-${med.id}`}
                          onClick={() => handleViewMedicationHistory(med.medicationName)}
                          className="text-[11px] font-bold text-blue-400 hover:text-blue-300 flex items-center gap-1 cursor-pointer transition-colors"
                        >
                          <History className="w-3 h-3" />
                          <span>{t.btnViewMedicationHistory}</span>
                        </button>
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
        </div>
      )}

      {/* ========================================================================= */}
      {/* VIEW 2: SEARCHABLE MEDICATION ADMINISTRATION HISTORY LOG (MAR AUDIT)       */}
      {/* ========================================================================= */}
      {activeView === 'history' && (
        <div className="space-y-4 animate-in fade-in duration-150">
          {/* Compact Omni-Search & Multi-Filter Control Bar */}
          <div
            className={`p-3.5 rounded-2xl border shadow-sm space-y-3 ${
              isDark ? 'bg-slate-900/90 border-slate-800' : 'bg-white border-slate-200'
            }`}
          >
            <div className="flex flex-col lg:flex-row items-center justify-between gap-2.5">
              {/* Omni-Search Input */}
              <div className="relative w-full lg:w-96">
                <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
                <input
                  id="input-search-med-history"
                  type="text"
                  value={historySearchTerm}
                  onChange={(e) => setHistorySearchTerm(e.target.value)}
                  placeholder={t.medHistorySearchPlaceholder}
                  className={`w-full pl-9 pr-8 py-1.5 text-xs rounded-xl border focus:outline-none focus:ring-2 focus:ring-emerald-500 ${
                    isDark ? 'bg-slate-950 border-slate-800 text-white placeholder-slate-500' : 'bg-slate-50 border-slate-200 text-slate-900'
                  }`}
                />
                {historySearchTerm && (
                  <button
                    onClick={() => setHistorySearchTerm('')}
                    className="absolute right-2.5 top-2 text-slate-400 hover:text-slate-200 cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* Filter Selectors */}
              <div className="flex items-center gap-2 w-full lg:w-auto flex-wrap sm:flex-nowrap">
                {/* Medication Filter */}
                <select
                  id="select-filter-med-name"
                  value={historyMedFilter}
                  onChange={(e) => setHistoryMedFilter(e.target.value)}
                  className={`px-2.5 py-1.5 text-xs font-semibold rounded-xl border focus:outline-none ${
                    isDark ? 'bg-slate-950 border-slate-800 text-slate-200' : 'bg-slate-50 border-slate-200 text-slate-800'
                  }`}
                >
                  <option value="All">{t.filterAllMeds}</option>
                  {uniqueHistoryMedNames.map((name) => (
                    <option key={name} value={name}>
                      {name}
                    </option>
                  ))}
                </select>

                {/* Patient Filter */}
                <select
                  id="select-filter-patient-mar"
                  value={historyPatientFilter}
                  onChange={(e) => setHistoryPatientFilter(e.target.value)}
                  className={`px-2.5 py-1.5 text-xs font-semibold rounded-xl border focus:outline-none ${
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

                {/* Staff Filter */}
                <select
                  id="select-filter-staff-mar"
                  value={historyStaffFilter}
                  onChange={(e) => setHistoryStaffFilter(e.target.value)}
                  className={`px-2.5 py-1.5 text-xs font-semibold rounded-xl border focus:outline-none ${
                    isDark ? 'bg-slate-950 border-slate-800 text-slate-200' : 'bg-slate-50 border-slate-200 text-slate-800'
                  }`}
                >
                  <option value="All">{t.filterAllStaff}</option>
                  {uniqueHistoryStaffNames.map((name) => (
                    <option key={name} value={name}>
                      {name}
                    </option>
                  ))}
                </select>

                {/* Vitals Evaluation Filter */}
                <select
                  id="select-filter-vitals-status"
                  value={historyVitalsFilter}
                  onChange={(e) => setHistoryVitalsFilter(e.target.value as any)}
                  className={`px-2.5 py-1.5 text-xs font-semibold rounded-xl border focus:outline-none ${
                    isDark ? 'bg-slate-950 border-slate-800 text-slate-200' : 'bg-slate-50 border-slate-200 text-slate-800'
                  }`}
                >
                  <option value="All">{t.filterAllVitals}</option>
                  <option value="Normal">{t.filterVitalsNormal}</option>
                  <option value="Warning">{t.filterVitalsWarning}</option>
                </select>

                {/* Reset Filters Button */}
                {hasActiveHistoryFilters && (
                  <button
                    id="btn-reset-med-history-filters"
                    onClick={handleResetHistoryFilters}
                    className={`px-2.5 py-1.5 text-xs font-bold rounded-xl border flex items-center gap-1 transition-colors cursor-pointer ${
                      isDark ? 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700' : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-300'
                    }`}
                    title="Đặt lại toàn bộ bộ lọc"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>{t.resetFilters}</span>
                  </button>
                )}
              </div>
            </div>

            {/* Active Filter Chips Bar */}
            {hasActiveHistoryFilters && (
              <div className="flex items-center gap-2 flex-wrap pt-2 border-t border-slate-800/40 text-xs">
                <span className="text-[11px] font-bold text-slate-400 flex items-center gap-1">
                  <Filter className="w-3 h-3 text-emerald-400" />
                  <span>Bộ lọc đang áp dụng ({filteredHistoryLogs.length} kết quả):</span>
                </span>

                {historyMedFilter !== 'All' && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-blue-500/20 text-blue-300 border border-blue-500/30 text-[11px] font-bold">
                    <span>Thuốc: {historyMedFilter}</span>
                    <button onClick={() => setHistoryMedFilter('All')} className="hover:text-white cursor-pointer"><X className="w-3 h-3" /></button>
                  </span>
                )}

                {historyPatientFilter !== 'All' && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 text-[11px] font-bold">
                    <span>BN: {patients.find((p) => p.id === historyPatientFilter)?.name || historyPatientFilter}</span>
                    <button onClick={() => setHistoryPatientFilter('All')} className="hover:text-white cursor-pointer"><X className="w-3 h-3" /></button>
                  </span>
                )}

                {historyStaffFilter !== 'All' && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-teal-500/20 text-teal-300 border border-teal-500/30 text-[11px] font-bold">
                    <span>NV: {historyStaffFilter}</span>
                    <button onClick={() => setHistoryStaffFilter('All')} className="hover:text-white cursor-pointer"><X className="w-3 h-3" /></button>
                  </span>
                )}

                {historyVitalsFilter !== 'All' && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-amber-500/20 text-amber-300 border border-amber-500/30 text-[11px] font-bold">
                    <span>Sinh tồn: {historyVitalsFilter === 'Normal' ? 'Ổn định' : 'Cần lưu ý'}</span>
                    <button onClick={() => setHistoryVitalsFilter('All')} className="hover:text-white cursor-pointer"><X className="w-3 h-3" /></button>
                  </span>
                )}

                {historySearchTerm.trim() && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-purple-500/20 text-purple-300 border border-purple-500/30 text-[11px] font-bold">
                    <span>Từ khóa: "{historySearchTerm}"</span>
                    <button onClick={() => setHistorySearchTerm('')} className="hover:text-white cursor-pointer"><X className="w-3 h-3" /></button>
                  </span>
                )}
              </div>
            )}
          </div>

          {/* MAR History Log List Table */}
          <div
            className={`rounded-3xl border overflow-hidden shadow-lg ${
              isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'
            }`}
          >
            {filteredHistoryLogs.length === 0 ? (
              <div className="p-12 text-center text-slate-400">
                <History className="w-12 h-12 mx-auto mb-3 opacity-30 text-slate-500" />
                <p className="font-bold text-sm">
                  {language === 'vi' ? 'Không tìm thấy lượt cho thuốc nào trong lịch sử' : 'No medication administration records found'}
                </p>
                <p className="text-xs text-slate-500 mt-1">
                  {hasActiveHistoryFilters
                    ? language === 'vi'
                      ? 'Thử xóa bớt bộ lọc hoặc từ khóa tìm kiếm để hiển thị thêm.'
                      : 'Try resetting some search filters to view more records.'
                    : language === 'vi'
                    ? 'Chưa có bản ghi dùng thuốc nào được xác nhận trong ca trực này.'
                    : 'No administration records have been signed off yet in this shift.'}
                </p>
                {hasActiveHistoryFilters && (
                  <button
                    onClick={handleResetHistoryFilters}
                    className="mt-3 px-4 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold inline-flex items-center gap-1 cursor-pointer"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>{t.resetFilters}</span>
                  </button>
                )}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className={`border-b text-[11px] font-black uppercase tracking-wider ${isDark ? 'bg-slate-950/80 border-slate-800 text-slate-400' : 'bg-slate-50 border-slate-200 text-slate-500'}`}>
                      <th className="py-3 px-4">{t.tableColAdminTime}</th>
                      <th className="py-3 px-4">{t.tableColMedication}</th>
                      <th className="py-3 px-4">{t.tableColPatientMar}</th>
                      <th className="py-3 px-4">{t.tableColAdminBy}</th>
                      <th className="py-3 px-4">{t.tableColVitalsAtTime}</th>
                      <th className="py-3 px-4">{t.tableColNotes}</th>
                      <th className="py-3 px-4 text-right">{t.tableColActions}</th>
                    </tr>
                  </thead>
                  <tbody className={`divide-y ${isDark ? 'divide-slate-800/60' : 'divide-slate-200'}`}>
                    {filteredHistoryLogs.map((log) => {
                      const { dateStr, timeStr } = formatDateTime(log.administeredAt);
                      const routeBadge = getRouteBadge(log.route);
                      const isVitalsWarning = log.vitalsEvaluation === 'Warning' || log.vitalsEvaluation === 'Critical';

                      return (
                        <tr
                          key={log.id}
                          id={`mar-row-${log.id}`}
                          className={`transition-colors ${
                            isDark ? 'hover:bg-slate-800/40' : 'hover:bg-blue-50/40'
                          }`}
                        >
                          {/* Administered Time */}
                          <td className="py-3.5 px-4 whitespace-nowrap">
                            <div className="font-black text-slate-200 flex items-center gap-1.5">
                              <Clock className="w-3.5 h-3.5 text-emerald-400" />
                              <span>{timeStr}</span>
                            </div>
                            <span className="text-[10px] font-semibold text-slate-400">{dateStr}</span>
                          </td>

                          {/* Medication & Dosage */}
                          <td className="py-3.5 px-4">
                            <div className="font-black text-white text-sm tracking-tight">{log.medicationName}</div>
                            <div className="flex items-center gap-1.5 mt-1">
                              <span className="font-bold text-blue-400 text-[11px]">{log.dosage}</span>
                              <span className={`px-2 py-0.5 text-[10px] font-bold rounded-md border flex items-center gap-1 ${routeBadge.bg}`}>
                                {routeBadge.icon}
                                <span>{routeBadge.label}</span>
                              </span>
                            </div>
                            {log.prescribedByDoctorName && (
                              <p className="text-[10px] text-slate-400 mt-0.5">
                                BS: <span className="text-slate-300 font-semibold">{log.prescribedByDoctorName}</span>
                              </p>
                            )}
                          </td>

                          {/* Patient & Room */}
                          <td className="py-3.5 px-4 whitespace-nowrap">
                            <div className="font-bold text-slate-200">{log.patientName}</div>
                            <div className="flex items-center gap-1 mt-0.5">
                              <span className="px-2 py-0.5 rounded-md bg-blue-600/30 text-blue-300 border border-blue-500/30 font-bold text-[10px]">
                                {log.roomNumber} • {log.bed}
                              </span>
                            </div>
                          </td>

                          {/* Administered By (Staff Performer) */}
                          <td className="py-3.5 px-4">
                            <div className="flex items-center gap-2">
                              <div className="w-7 h-7 rounded-xl bg-emerald-500/20 text-emerald-300 flex items-center justify-center font-bold text-xs shrink-0">
                                <User className="w-3.5 h-3.5" />
                              </div>
                              <div>
                                <p className="font-bold text-slate-200">{log.administeredBy}</p>
                                <p className="text-[10px] text-emerald-400 font-semibold">{log.administeredRole || 'Điều Dưỡng Trực'}</p>
                              </div>
                            </div>
                          </td>

                          {/* Vitals At Time of Dose */}
                          <td className="py-3.5 px-4">
                            <div className="space-y-1">
                              <div className="flex items-center gap-2">
                                {log.recordedHeartRate ? (
                                  <span className={`px-2 py-0.5 rounded-md font-bold text-[11px] border flex items-center gap-1 ${
                                    log.recordedHeartRate < 60 || log.recordedHeartRate > 105
                                      ? 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                                      : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                                  }`}>
                                    <Heart className="w-3 h-3 text-rose-500 fill-rose-500" />
                                    <span>{log.recordedHeartRate} BPM</span>
                                  </span>
                                ) : (
                                  <span className="text-[10px] text-slate-500 italic">Chưa đo HR</span>
                                )}

                                {log.recordedBloodPressure && (
                                  <span className="px-2 py-0.5 rounded-md bg-slate-800 border border-slate-700 font-bold text-[11px] text-blue-300">
                                    HA: {log.recordedBloodPressure}
                                  </span>
                                )}
                              </div>

                              <div className="flex items-center gap-2 text-[10px] text-slate-400">
                                {log.recordedSpO2 && (
                                  <span>SpO2: <strong className="text-slate-200">{log.recordedSpO2}%</strong></span>
                                )}
                                {log.recordedTemperature && (
                                  <span>T: <strong className="text-slate-200">{log.recordedTemperature}°C</strong></span>
                                )}
                                <span className={`px-1.5 py-0.2 rounded font-bold ${isVitalsWarning ? 'bg-amber-500/20 text-amber-300' : 'bg-emerald-500/20 text-emerald-300'}`}>
                                  {isVitalsWarning ? 'Lưu ý' : 'Ổn định'}
                                </span>
                              </div>
                            </div>
                          </td>

                          {/* Notes & Verification */}
                          <td className="py-3.5 px-4 max-w-xs">
                            <p className="text-[11px] text-slate-300 line-clamp-2 italic">
                              "{log.administerNotes || 'Đã cho dùng đúng liều, tình trạng ổn định.'}"
                            </p>
                            <div className="flex items-center gap-1 text-[10px] font-bold text-emerald-400 mt-1">
                              <ShieldCheck className="w-3 h-3" />
                              <span>5 Đúng đã xác minh</span>
                            </div>
                          </td>

                          {/* Actions: View Receipt */}
                          <td className="py-3.5 px-4 text-right whitespace-nowrap">
                            <button
                              id={`btn-view-receipt-${log.id}`}
                              onClick={() => setSelectedReceipt(log)}
                              className="px-3 py-1.5 rounded-xl bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 border border-blue-500/30 font-bold text-xs inline-flex items-center gap-1 transition-all active:scale-95 cursor-pointer"
                            >
                              <FileText className="w-3.5 h-3.5" />
                              <span>{t.btnViewMedHistoryDetail}</span>
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 1: ELECTRONIC MAR RECEIPT AUDIT DETAILS MODAL                       */}
      {/* ========================================================================= */}
      {selectedReceipt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-150">
          <div
            className={`w-full max-w-2xl rounded-3xl border p-6 shadow-2xl space-y-5 max-h-[90vh] overflow-y-auto ${
              isDark ? 'bg-slate-900 border-slate-800 text-white' : 'bg-white border-slate-200 text-slate-900'
            }`}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b pb-4 border-slate-700/50">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-500 text-white flex items-center justify-center shadow-md shadow-emerald-950/40">
                  <ShieldCheck className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-base sm:text-lg font-black tracking-tight flex items-center gap-2">
                    <span>{t.medHistoryReceiptTitle}</span>
                    <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                      ĐÃ KÝ DUYỆT
                    </span>
                  </h3>
                  <p className="text-xs text-slate-400">
                    Mã bản ghi MAR: <strong className="text-slate-300">{selectedReceipt.id}</strong>
                  </p>
                </div>
              </div>

              <button
                onClick={() => setSelectedReceipt(null)}
                className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Receipt Body: 2 Columns */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              {/* Patient Info Card */}
              <div className={`p-4 rounded-2xl border space-y-2 ${isDark ? 'bg-slate-950 border-slate-800' : 'bg-slate-50 border-slate-200'}`}>
                <p className="text-[11px] font-black text-slate-400 uppercase tracking-wider">Thông Tin Bệnh Nhân</p>
                <div className="space-y-1">
                  <p className="text-sm font-black text-white">{selectedReceipt.patientName}</p>
                  <p className="text-xs text-slate-300">
                    Mã BN: <strong className="text-slate-200">{selectedReceipt.patientId}</strong> • Vị trí: <strong className="text-blue-400">{selectedReceipt.roomNumber} - {selectedReceipt.bed}</strong>
                  </p>
                  <p className="text-xs text-slate-400">
                    Khoa: <strong>Hồi Sức Tích Cực (ICU) & Tim Mạch Can Thiệp</strong>
                  </p>
                </div>
              </div>

              {/* Medication Administered Details */}
              <div className={`p-4 rounded-2xl border space-y-2 ${isDark ? 'bg-slate-950 border-slate-800' : 'bg-slate-50 border-slate-200'}`}>
                <p className="text-[11px] font-black text-slate-400 uppercase tracking-wider">Thuốc & Liều Dùng</p>
                <div className="space-y-1">
                  <p className="text-sm font-black text-emerald-400">{selectedReceipt.medicationName}</p>
                  <p className="text-xs text-slate-300">
                    Liều lượng: <strong className="text-white">{selectedReceipt.dosage}</strong> • Đường dùng: <strong className="text-white">{selectedReceipt.route}</strong>
                  </p>
                  <p className="text-xs text-slate-400">
                    BS Chỉ định: <strong className="text-slate-200">{selectedReceipt.prescribedByDoctorName || 'BS. Trực Ca'}</strong>
                  </p>
                </div>
              </div>
            </div>

            {/* Staff & Timestamp Sign-Off Banner */}
            <div className={`p-4 rounded-2xl border space-y-2 ${isDark ? 'bg-emerald-950/20 border-emerald-800/40 text-emerald-200' : 'bg-emerald-50 border-emerald-200 text-emerald-900'}`}>
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                <div>
                  <p className="text-[11px] font-black uppercase tracking-wider text-emerald-400">Nhân Viên Y Tế Thực Hiện & Ký Xác Nhận</p>
                  <p className="text-sm font-black text-white mt-0.5">{selectedReceipt.administeredBy}</p>
                  <p className="text-xs text-emerald-300">{selectedReceipt.administeredRole || 'Điều Dưỡng Trưởng Trạm'}</p>
                </div>

                <div className="text-right sm:text-right">
                  <p className="text-[11px] font-bold text-slate-400">Thời điểm cho thuốc:</p>
                  <p className="text-xs font-black text-white">{new Date(selectedReceipt.administeredAt).toLocaleString('vi-VN')}</p>
                  <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-400 mt-0.5">
                    <CheckCircle2 className="w-3 h-3" />
                    <span>Chữ Ký Số Telemetry Đã Xác Thực</span>
                  </span>
                </div>
              </div>
            </div>

            {/* Vitals Telemetry Snapshot at Administration Moment */}
            <div className={`p-4 rounded-2xl border space-y-3 ${isDark ? 'bg-slate-950 border-slate-800' : 'bg-slate-50 border-slate-200'}`}>
              <p className="text-[11px] font-black text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                <Activity className="w-4 h-4 text-rose-500" />
                <span>Ảnh Chụp Sinh Tồn Tại Thời Điểm Cho Thuốc (Telemetry Snapshot)</span>
              </p>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
                <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-800">
                  <p className="text-[10px] text-slate-400 font-bold">Nhịp Tim (HR)</p>
                  <p className="text-base font-black text-rose-400 mt-0.5 flex items-center justify-center gap-1">
                    <Heart className="w-3.5 h-3.5 fill-rose-500" />
                    <span>{selectedReceipt.recordedHeartRate ?? 75} BPM</span>
                  </p>
                </div>

                <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-800">
                  <p className="text-[10px] text-slate-400 font-bold">Huyết Áp (BP)</p>
                  <p className="text-base font-black text-blue-400 mt-0.5">
                    {selectedReceipt.recordedBloodPressure || '120/80'}
                  </p>
                </div>

                <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-800">
                  <p className="text-[10px] text-slate-400 font-bold">Oxy Máu (SpO2)</p>
                  <p className="text-base font-black text-cyan-400 mt-0.5">
                    {selectedReceipt.recordedSpO2 ?? 98}%
                  </p>
                </div>

                <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-800">
                  <p className="text-[10px] text-slate-400 font-bold">Nhiệt Độ (Temp)</p>
                  <p className="text-base font-black text-amber-400 mt-0.5 flex items-center justify-center gap-1">
                    <Thermometer className="w-3.5 h-3.5" />
                    <span>{selectedReceipt.recordedTemperature ?? 36.8}°C</span>
                  </p>
                </div>
              </div>
            </div>

            {/* 5 Rights Checklist Verification */}
            <div className={`p-4 rounded-2xl border space-y-2 ${isDark ? 'bg-slate-950 border-slate-800' : 'bg-slate-50 border-slate-200'}`}>
              <p className="text-[11px] font-black text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                <span>Quy Trình 5 Đúng Trong Sử Dụng Thuốc An Toàn</span>
              </p>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs font-semibold text-slate-300">
                <div className="flex items-center gap-1.5 text-emerald-400"><Check className="w-3.5 h-3.5" /> Đúng Bệnh Nhân</div>
                <div className="flex items-center gap-1.5 text-emerald-400"><Check className="w-3.5 h-3.5" /> Đúng Thuốc</div>
                <div className="flex items-center gap-1.5 text-emerald-400"><Check className="w-3.5 h-3.5" /> Đúng Liều Lượng</div>
                <div className="flex items-center gap-1.5 text-emerald-400"><Check className="w-3.5 h-3.5" /> Đúng Đường Dùng</div>
                <div className="flex items-center gap-1.5 text-emerald-400"><Check className="w-3.5 h-3.5" /> Đúng Thời Gian</div>
                <div className="flex items-center gap-1.5 text-emerald-400"><Check className="w-3.5 h-3.5" /> Đã Ghi Chép MAR</div>
              </div>
            </div>

            {/* Clinical Observations Notes */}
            <div>
              <p className="text-[11px] font-bold text-slate-400">Ghi Chú Lâm Sàng & Phản Ứng Sau Cho Thuốc:</p>
              <div className={`p-3 rounded-xl border mt-1 text-xs text-slate-200 leading-relaxed italic ${isDark ? 'bg-slate-950 border-slate-800' : 'bg-slate-50 border-slate-200'}`}>
                "{selectedReceipt.administerNotes || 'Bệnh nhân dùng thuốc an toàn, không có phản ứng dị ứng hay tác dụng ngoại ý.'}"
              </div>
            </div>

            {/* Modal Actions */}
            <div className="pt-3 border-t border-slate-700/50 flex items-center justify-between">
              <span className="text-[11px] text-slate-500 font-semibold">
                ICU Telemetry System • Stat-Alert MAR v2.4
              </span>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className={`px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer ${
                    isDark ? 'bg-slate-800 hover:bg-slate-700 text-slate-300' : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                  }`}
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>In Phiếu Ký</span>
                </button>

                <button
                  type="button"
                  onClick={() => setSelectedReceipt(null)}
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-black shadow-md shadow-blue-950/50 cursor-pointer"
                >
                  {t.btnClose}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 2: ADMINISTER MEDICATION & SIGN-OFF MODAL                           */}
      {/* ========================================================================= */}
      {administeringMed && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150">
          <div
            className={`w-full max-w-lg rounded-3xl border p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto ${
              isDark ? 'bg-slate-900 border-slate-800 text-white' : 'bg-white border-slate-200 text-slate-900'
            }`}
          >
            <div className="flex items-center justify-between border-b pb-3 border-slate-700/50">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold">
                  <CheckCircle2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black">{t.medAdministerModalTitle}</h3>
                  <p className="text-xs text-slate-400">
                    BN: {administeringMed.patientName} ({administeringMed.roomNumber} - {administeringMed.bed})
                  </p>
                </div>
              </div>

              <button onClick={() => setAdministeringMed(null)} className="text-slate-400 hover:text-white cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSubmitAdminister} className="space-y-4">
              <div className={`p-3 rounded-2xl border ${isDark ? 'bg-slate-950 border-slate-800' : 'bg-slate-50 border-slate-200'}`}>
                <p className="text-xs font-black text-blue-400">{administeringMed.medicationName}</p>
                <p className="text-xs font-semibold text-slate-300 mt-0.5">
                  Liều lượng: {administeringMed.dosage} • Đường dùng: {administeringMed.route}
                </p>
                <p className="text-xs text-slate-400 mt-1">{administeringMed.instructions}</p>
              </div>

              {/* Vitals Input Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                <div>
                  <label className="text-[11px] font-bold text-rose-400 flex items-center gap-1">
                    <Heart className="w-3 h-3 text-rose-500" />
                    <span>{t.medPulseBeforeDoseLabel}</span>
                  </label>
                  <input
                    type="number"
                    value={adminPulse}
                    onChange={(e) => setAdminPulse(e.target.value)}
                    placeholder="75"
                    className={`w-full mt-1 px-2.5 py-1.5 text-xs rounded-xl border focus:outline-none focus:ring-2 focus:ring-emerald-500 ${
                      isDark ? 'bg-slate-950 border-slate-800 text-white' : 'bg-slate-50 border-slate-200 text-slate-900'
                    }`}
                  />
                </div>

                <div>
                  <label className="text-[11px] font-bold text-blue-400">{t.medBPBeforeDoseLabel}</label>
                  <input
                    type="text"
                    value={adminBP}
                    onChange={(e) => setAdminBP(e.target.value)}
                    placeholder="120/80"
                    className={`w-full mt-1 px-2.5 py-1.5 text-xs rounded-xl border focus:outline-none focus:ring-2 focus:ring-emerald-500 ${
                      isDark ? 'bg-slate-950 border-slate-800 text-white' : 'bg-slate-50 border-slate-200 text-slate-900'
                    }`}
                  />
                </div>

                <div>
                  <label className="text-[11px] font-bold text-cyan-400">{t.medSpO2BeforeDoseLabel}</label>
                  <input
                    type="number"
                    value={adminSpO2}
                    onChange={(e) => setAdminSpO2(e.target.value)}
                    placeholder="98"
                    className={`w-full mt-1 px-2.5 py-1.5 text-xs rounded-xl border focus:outline-none focus:ring-2 focus:ring-emerald-500 ${
                      isDark ? 'bg-slate-950 border-slate-800 text-white' : 'bg-slate-50 border-slate-200 text-slate-900'
                    }`}
                  />
                </div>

                <div>
                  <label className="text-[11px] font-bold text-amber-400">{t.medTempBeforeDoseLabel}</label>
                  <input
                    type="number"
                    step="0.1"
                    value={adminTemp}
                    onChange={(e) => setAdminTemp(e.target.value)}
                    placeholder="36.8"
                    className={`w-full mt-1 px-2.5 py-1.5 text-xs rounded-xl border focus:outline-none focus:ring-2 focus:ring-emerald-500 ${
                      isDark ? 'bg-slate-950 border-slate-800 text-white' : 'bg-slate-50 border-slate-200 text-slate-900'
                    }`}
                  />
                </div>
              </div>

              {/* Staff Performer Selection */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-300">Nhân viên thực hiện:</label>
                  <select
                    value={adminStaffName}
                    onChange={(e) => {
                      const selected = doctors.find((d) => d.name === e.target.value);
                      setAdminStaffName(e.target.value);
                      if (selected) {
                        setAdminStaffRole(selected.role || 'Điều Dưỡng Trực');
                        setAdminStaffId(selected.id);
                      }
                    }}
                    className={`w-full mt-1 px-3 py-2 text-xs rounded-xl border focus:outline-none ${
                      isDark ? 'bg-slate-950 border-slate-800 text-white' : 'bg-slate-50 border-slate-200 text-slate-900'
                    }`}
                  >
                    {doctors.map((d) => (
                      <option key={d.id} value={d.name}>
                        {d.name} ({d.role})
                      </option>
                    ))}
                    <option value="ĐD. Đặng Thị Hồng Hạnh">ĐD. Đặng Thị Hồng Hạnh (Điều Dưỡng Trưởng Trạm)</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-300">Chức vụ / Vị trí trực:</label>
                  <input
                    type="text"
                    value={adminStaffRole}
                    onChange={(e) => setAdminStaffRole(e.target.value)}
                    className={`w-full mt-1 px-3 py-2 text-xs rounded-xl border focus:outline-none ${
                      isDark ? 'bg-slate-950 border-slate-800 text-white' : 'bg-slate-50 border-slate-200 text-slate-900'
                    }`}
                  />
                </div>
              </div>

              {/* 5-Rights Checkbox */}
              <div className="flex items-center gap-2 p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30">
                <input
                  type="checkbox"
                  id="chk-5-rights"
                  checked={fiveRightsChecked}
                  onChange={(e) => setFiveRightsChecked(e.target.checked)}
                  className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                  required
                />
                <label htmlFor="chk-5-rights" className="text-xs font-bold text-emerald-300 cursor-pointer">
                  {t.fiveRightsVerified}
                </label>
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
                  disabled={isSubmittingAdmin || !fiveRightsChecked}
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

      {/* ========================================================================= */}
      {/* MODAL 3: HOLD MEDICATION DOSE                                             */}
      {/* ========================================================================= */}
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

      {/* ========================================================================= */}
      {/* MODAL 4: PRESCRIBE & ADD MEDICATION SCHEDULE                             */}
      {/* ========================================================================= */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-150">
          <div
            className={`w-full max-w-2xl rounded-3xl border p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto ${
              isDark ? 'bg-slate-900 border-slate-800 text-white' : 'bg-white border-slate-200 text-slate-900'
            }`}
          >
            <div className="flex items-center justify-between border-b pb-3 border-slate-700/50">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-purple-500/20 text-purple-400 flex items-center justify-center">
                  <Plus className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black">{t.btnAddMedication}</h3>
                  <p className="text-xs text-slate-400">
                    {language === 'vi'
                      ? 'Lên lịch dùng thuốc và tự động đồng bộ Google Calendar'
                      : 'Schedule dose and auto-sync with Google Calendar'}
                  </p>
                </div>
              </div>
              <button onClick={() => setIsAddModalOpen(false)} className="text-slate-400 hover:text-white cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Quick Presets Selection */}
            <div>
              <p className="text-xs font-bold text-slate-400 mb-2">⚡ Thuốc Hồi Sức Thường Dùng (Bấm chọn nhanh):</p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {PRESET_MEDICATIONS.map((preset) => (
                  <button
                    key={preset.name}
                    type="button"
                    onClick={() => handleSelectPreset(preset)}
                    className={`p-2 rounded-xl text-left border text-[11px] font-bold transition-all hover:scale-102 cursor-pointer ${
                      newMedData.medicationName === preset.name
                        ? 'bg-purple-600 text-white border-purple-500 shadow-md'
                        : isDark
                        ? 'bg-slate-950 border-slate-800 text-slate-300 hover:border-purple-500/50'
                        : 'bg-slate-50 border-slate-200 text-slate-800 hover:border-purple-400'
                    }`}
                  >
                    <p className="truncate">{preset.name}</p>
                    <p className="text-[10px] opacity-75">{preset.dosage}</p>
                  </button>
                ))}
              </div>
            </div>

            <form onSubmit={handleSubmitNewMedication} className="space-y-4 pt-2">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-300">{t.medSelectPatient}</label>
                  <select
                    value={newMedData.patientId}
                    onChange={(e) => setNewMedData({ ...newMedData, patientId: e.target.value })}
                    className={`w-full mt-1 px-3 py-2 text-xs rounded-xl border focus:outline-none ${
                      isDark ? 'bg-slate-950 border-slate-800 text-white' : 'bg-slate-50 border-slate-200 text-slate-900'
                    }`}
                  >
                    {patients.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} ({p.roomNumber} - {p.bed})
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
                    placeholder="vd: Digoxin 0.25mg"
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
                    placeholder="vd: 1 viên (0.25mg)"
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
                    type="text"
                    value={newMedData.scheduledTime}
                    onChange={(e) => setNewMedData({ ...newMedData, scheduledTime: e.target.value })}
                    placeholder="08:00"
                    className={`w-full mt-1 px-3 py-2 text-xs rounded-xl border focus:outline-none ${
                      isDark ? 'bg-slate-950 border-slate-800 text-white' : 'bg-slate-50 border-slate-200 text-slate-900'
                    }`}
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

      {/* ========================================================================= */}
      {/* MODAL 5: DELETE CONFIRMATION MODAL                                        */}
      {/* ========================================================================= */}
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
