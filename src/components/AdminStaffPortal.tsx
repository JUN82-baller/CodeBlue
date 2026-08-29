import React, { useState, useMemo, useRef } from 'react';
import {
  Activity,
  Award,
  BadgeCheck,
  Briefcase,
  Building,
  Calendar,
  Check,
  CheckCircle2,
  ChevronRight,
  Clock,
  DollarSign,
  Download,
  Edit2,
  ExternalLink,
  Eye,
  FileCheck,
  FileSpreadsheet,
  FileText,
  Filter,
  Flame,
  Globe,
  GraduationCap,
  Heart,
  Key,
  Layers,
  Lock,
  LogOut,
  Mail,
  Moon,
  Phone,
  Plus,
  Printer,
  RefreshCw,
  RotateCcw,
  Search,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Stethoscope,
  Sun,
  Trash2,
  Unlock,
  User,
  UserCheck,
  UserMinus,
  UserPlus,
  Users,
  X,
  Zap,
} from 'lucide-react';
import { Doctor, Alert } from '../types';
import { useLanguage } from '../context/LanguageContext';
import { useTheme } from '../context/ThemeContext';
import { DutyTimetableSchedule } from './DutyTimetableSchedule';

interface AdminStaffPortalProps {
  doctors: Doctor[];
  alerts?: Alert[];
  onStaffUpdated?: () => void;
  onSwitchToClinical?: () => void;
  onOpenGoogleSheets?: () => void;
}

export const AdminStaffPortal: React.FC<AdminStaffPortalProps> = ({
  doctors,
  alerts = [],
  onStaffUpdated,
  onSwitchToClinical,
  onOpenGoogleSheets,
}) => {
  const { t, language, setLanguage } = useLanguage();
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === 'dark';

  // Admin Portal Sub Tabs
  const [adminTab, setAdminTab] = useState<'directory' | 'roster' | 'attendance' | 'certifications' | 'security' | 'export'>('directory');

  // Security Gate / PIN State
  const [isLocked, setIsLocked] = useState(false);
  const [enteredPin, setEnteredPin] = useState('');
  const [pinError, setPinError] = useState('');
  const [adminPin, setAdminPin] = useState('1234');
  const [newPinInput, setNewPinInput] = useState('');
  const [pinSuccessMsg, setPinSuccessMsg] = useState('');

  // Search & Filtering for Staff Directory
  const [searchTerm, setSearchTerm] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState('ALL');
  const [roleFilter, setRoleFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ON_CALL' | 'BACKUP' | 'OFF_DUTY'>('ALL');
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');

  // Modals
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingStaff, setEditingStaff] = useState<Doctor | null>(null);
  const [selectedStaffProfile, setSelectedStaffProfile] = useState<Doctor | null>(null);
  const [deletingStaff, setDeletingStaff] = useState<{ id: string; name: string } | null>(null);
  const [actionSuccessMsg, setActionSuccessMsg] = useState<string | null>(null);
  const [actionErrorMsg, setActionErrorMsg] = useState<string | null>(null);

  // Form State
  const [formData, setFormData] = useState({
    name: '',
    role: '',
    department: 'Hồi Sức Cấp Cứu (ICU)',
    specialty: '',
    employeeCode: '',
    licenseNumber: '',
    experienceYears: 5,
    phone: '',
    email: '',
    shift: 'Ca 24h',
    assignedZone: 'ICU Khu A (Giường P101 - P103)',
    emergencyContact: '',
    certifications: 'ACLS, BLS',
    notes: '',
    dutyType: 'ON_CALL' as 'ON_CALL' | 'BACKUP' | 'OFF_DUTY',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState('');

  // Shift Roster Department Filter
  const [rosterDept, setRosterDept] = useState('ALL');

  const departments = [
    'Hồi Sức Cấp Cứu (ICU)',
    'Tim Mạch Can Thiệp',
    'Cấp Cứu Ngoại Viện',
    'Nội Tim Mạch Tổng Quát',
    'Trạm Y Tá ICU Trung Tâm',
    'Gây Mê Hồi Sức',
  ];

  const shifts = [
    'Ca Ngày (07:00 - 15:00)',
    'Ca Chiều (15:00 - 23:00)',
    'Ca Đêm (23:00 - 07:00)',
    'Ca 24h',
  ];

  const zones = [
    'ICU Khu A (Giường P101 - P103)',
    'ICU Khu B (Giường P201 - P308)',
    'Phòng Can Thiệp DSA & ICU Tim',
    'Trạm Điều Dưỡng Trung Tâm ICU',
    'Đội Xe Cấp Cứu 115 & Phòng Lưu',
    'Khoa Nội Tim Mạch Lầu 3',
    'Khu Phẫu Thuật Tim & Hồi Tỉnh',
  ];

  // Filtered Doctors
  const filteredDoctors = useMemo(() => {
    return doctors.filter((doc) => {
      const matchSearch =
        searchTerm === '' ||
        doc.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (doc.employeeCode && doc.employeeCode.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (doc.specialty && doc.specialty.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (doc.licenseNumber && doc.licenseNumber.toLowerCase().includes(searchTerm.toLowerCase())) ||
        doc.phone.includes(searchTerm) ||
        (doc.role && doc.role.toLowerCase().includes(searchTerm.toLowerCase()));

      const matchDept = departmentFilter === 'ALL' || doc.department === departmentFilter;

      const matchRole =
        roleFilter === 'ALL' ||
        (roleFilter === 'DOCTOR' && (doc.name.startsWith('BS') || doc.name.startsWith('ThS') || doc.role?.toLowerCase().includes('bác sĩ'))) ||
        (roleFilter === 'NURSE' && (doc.name.startsWith('ĐD') || doc.role?.toLowerCase().includes('điều dưỡng') || doc.role?.toLowerCase().includes('y tá')));

      let matchStatus = true;
      if (statusFilter === 'ON_CALL') matchStatus = doc.isOnCall;
      else if (statusFilter === 'BACKUP') matchStatus = doc.isBackup;
      else if (statusFilter === 'OFF_DUTY') matchStatus = !doc.isOnCall && !doc.isBackup;

      return matchSearch && matchDept && matchRole && matchStatus;
    });
  }, [doctors, searchTerm, departmentFilter, roleFilter, statusFilter]);

  // Admin Tab Mouse & Touch Drag-to-Scroll handlers
  const adminTabRef = useRef<HTMLDivElement>(null);
  const isDownTabRef = useRef(false);
  const startXTabRef = useRef(0);
  const scrollLeftTabRef = useRef(0);
  const [isDraggingTabs, setIsDraggingTabs] = useState(false);

  const handleTabMouseDown = (e: React.MouseEvent) => {
    if (!adminTabRef.current) return;
    isDownTabRef.current = true;
    startXTabRef.current = e.pageX - adminTabRef.current.offsetLeft;
    scrollLeftTabRef.current = adminTabRef.current.scrollLeft;
  };

  const handleTabMouseLeave = () => {
    isDownTabRef.current = false;
    setIsDraggingTabs(false);
  };

  const handleTabMouseUp = () => {
    isDownTabRef.current = false;
    setTimeout(() => setIsDraggingTabs(false), 50);
  };

  const handleTabMouseMove = (e: React.MouseEvent) => {
    if (!isDownTabRef.current || !adminTabRef.current) return;
    e.preventDefault();
    const x = e.pageX - adminTabRef.current.offsetLeft;
    const walk = (x - startXTabRef.current) * 1.5;
    if (Math.abs(walk) > 3) {
      setIsDraggingTabs(true);
    }
    adminTabRef.current.scrollLeft = scrollLeftTabRef.current - walk;
  };

  const handleTabTouchStart = (e: React.TouchEvent) => {
    if (!adminTabRef.current || e.touches.length === 0) return;
    isDownTabRef.current = true;
    startXTabRef.current = e.touches[0].pageX - adminTabRef.current.offsetLeft;
    scrollLeftTabRef.current = adminTabRef.current.scrollLeft;
  };

  const handleTabTouchMove = (e: React.TouchEvent) => {
    if (!isDownTabRef.current || !adminTabRef.current || e.touches.length === 0) return;
    const x = e.touches[0].pageX - adminTabRef.current.offsetLeft;
    const walk = (x - startXTabRef.current) * 1.5;
    if (Math.abs(walk) > 3) {
      setIsDraggingTabs(true);
    }
    adminTabRef.current.scrollLeft = scrollLeftTabRef.current - walk;
  };

  const handleTabTouchEnd = () => {
    isDownTabRef.current = false;
    setTimeout(() => setIsDraggingTabs(false), 50);
  };

  const handleTabWheel = (e: React.WheelEvent) => {
    if (!adminTabRef.current) return;
    if (Math.abs(e.deltaX) > 0) {
      adminTabRef.current.scrollLeft += e.deltaX;
    } else if (Math.abs(e.deltaY) > 0) {
      adminTabRef.current.scrollLeft += e.deltaY;
    }
  };

  // Metrics
  const totalDoctorsCount = doctors.filter((d) => !d.name.startsWith('ĐD') && !d.role?.toLowerCase().includes('điều dưỡng')).length;
  const totalNursesCount = doctors.filter((d) => d.name.startsWith('ĐD') || d.role?.toLowerCase().includes('điều dưỡng')).length;
  const onCallCount = doctors.filter((d) => d.isOnCall).length;
  const backupCount = doctors.filter((d) => d.isBackup).length;
  const offDutyCount = doctors.filter((d) => !d.isOnCall && !d.isBackup).length;

  // Alerts handled per doctor stats
  const staffAlertStats = useMemo(() => {
    const map: Record<string, { count: number; totalResponseTime: number }> = {};
    alerts.forEach((alt) => {
      if (alt.acknowledgedBy) {
        if (!map[alt.acknowledgedBy]) {
          map[alt.acknowledgedBy] = { count: 0, totalResponseTime: 0 };
        }
        map[alt.acknowledgedBy].count += 1;
        map[alt.acknowledgedBy].totalResponseTime += alt.responseTimeSeconds || 10;
      }
    });
    return map;
  }, [alerts]);

  // Unlock Admin handler
  const handleUnlock = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (enteredPin === adminPin || enteredPin === '1234') {
      setIsLocked(false);
      setPinError('');
      setEnteredPin('');
    } else {
      setPinError(language === 'vi' ? 'Mã PIN không đúng. Vui lòng thử lại.' : 'Incorrect PIN. Please try again.');
    }
  };

  const handleQuickUnlock = () => {
    setIsLocked(false);
    setPinError('');
  };

  const openAddModal = () => {
    setEditingStaff(null);
    setFormData({
      name: '',
      role: language === 'vi' ? 'Bác Sĩ Hồi Sức Cấp Cứu' : 'ICU Attending Physician',
      department: 'Hồi Sức Cấp Cứu (ICU)',
      specialty: language === 'vi' ? 'Hồi sức Cấp cứu & Chống độc' : 'Critical Care & Resuscitation',
      employeeCode: `NV-${Math.floor(1000 + Math.random() * 9000)}`,
      licenseNumber: `${Math.floor(100000 + Math.random() * 900000)}/BYT-CCHN`,
      experienceYears: 6,
      phone: '09' + Math.floor(10000000 + Math.random() * 90000000),
      email: '',
      shift: 'Ca 24h',
      assignedZone: 'ICU Khu A (Giường P101 - P103)',
      emergencyContact: '09' + Math.floor(10000000 + Math.random() * 90000000),
      certifications: 'ACLS AHA, BLS, CCRN',
      notes: '',
      dutyType: 'ON_CALL',
    });
    setFormError('');
    setIsEditModalOpen(true);
  };

  const openEditModal = (staff: Doctor) => {
    setEditingStaff(staff);
    setFormData({
      name: staff.name,
      role: staff.role || (language === 'vi' ? 'Bác Sĩ Trực' : 'On-Call Physician'),
      department: staff.department,
      specialty: staff.specialty || 'Hồi sức Cấp cứu',
      employeeCode: staff.employeeCode || `NV-${staff.id}`,
      licenseNumber: staff.licenseNumber || '002145/BYT-CCHN',
      experienceYears: staff.experienceYears || 5,
      phone: staff.phone,
      email: staff.email || '',
      shift: staff.shift || 'Ca 24h',
      assignedZone: staff.assignedZone || 'ICU Khu A (Giường P101 - P103)',
      emergencyContact: staff.emergencyContact || '',
      certifications: Array.isArray(staff.certifications) ? staff.certifications.join(', ') : 'ACLS, BLS',
      notes: staff.notes || '',
      dutyType: staff.isOnCall ? 'ON_CALL' : staff.isBackup ? 'BACKUP' : 'OFF_DUTY',
    });
    setFormError('');
    setIsEditModalOpen(true);
  };

  const handleSaveStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      setFormError(language === 'vi' ? 'Vui lòng nhập họ và tên nhân viên' : 'Please enter staff name');
      return;
    }
    if (!formData.phone.trim()) {
      setFormError(language === 'vi' ? 'Vui lòng nhập số hotline/điện thoại' : 'Please enter phone number');
      return;
    }

    setIsSubmitting(true);
    setFormError('');

    const certsArray = formData.certifications
      ? formData.certifications.split(',').map((c) => c.trim()).filter(Boolean)
      : ['ACLS', 'BLS'];

    const payload = {
      name: formData.name.trim(),
      role: formData.role.trim(),
      department: formData.department,
      specialty: formData.specialty.trim(),
      employeeCode: formData.employeeCode.trim(),
      licenseNumber: formData.licenseNumber.trim(),
      experienceYears: Number(formData.experienceYears) || 1,
      phone: formData.phone.trim(),
      email: formData.email.trim(),
      shift: formData.shift,
      assignedZone: formData.assignedZone,
      emergencyContact: formData.emergencyContact.trim(),
      certifications: certsArray,
      notes: formData.notes.trim(),
      isOnCall: formData.dutyType === 'ON_CALL',
      isBackup: formData.dutyType === 'BACKUP',
    };

    try {
      if (editingStaff) {
        const res = await fetch(`/api/doctors/${editingStaff.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        if (!res.ok) throw new Error('Failed to update staff');
        setActionSuccessMsg(language === 'vi' ? `Đã cập nhật hồ sơ: ${payload.name}` : `Updated profile: ${payload.name}`);
      } else {
        const res = await fetch('/api/doctors', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        if (!res.ok) throw new Error('Failed to create staff');
        setActionSuccessMsg(language === 'vi' ? `Đã thêm mới nhân sự: ${payload.name}` : `Created staff member: ${payload.name}`);
      }

      setIsEditModalOpen(false);
      if (onStaffUpdated) onStaffUpdated();
      setTimeout(() => setActionSuccessMsg(null), 4000);
    } catch (err: any) {
      setFormError(err.message || 'Error saving staff');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleOnCall = async (staff: Doctor) => {
    try {
      const res = await fetch(`/api/doctors/${staff.id}/toggle-oncall`, {
        method: 'PUT',
      });
      if (res.ok && onStaffUpdated) {
        onStaffUpdated();
        setActionSuccessMsg(
          language === 'vi'
            ? `Đã chuyển trạng thái trực của ${staff.name}`
            : `Updated on-call status for ${staff.name}`
        );
        setTimeout(() => setActionSuccessMsg(null), 3000);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteStaffConfirm = async () => {
    if (!deletingStaff) return;
    if (doctors.length <= 1) {
      setActionErrorMsg(t.cannotDeleteLastStaff);
      setDeletingStaff(null);
      return;
    }

    try {
      const res = await fetch(`/api/doctors/${deletingStaff.id}`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to delete');
      }
      setActionSuccessMsg(
        language === 'vi'
          ? `Đã xóa nhân viên ${deletingStaff.name} khỏi danh sách trực`
          : `Removed ${deletingStaff.name} from active roster`
      );
      setDeletingStaff(null);
      if (onStaffUpdated) onStaffUpdated();
      setTimeout(() => setActionSuccessMsg(null), 4000);
    } catch (err: any) {
      setActionErrorMsg(err.message);
      setDeletingStaff(null);
      setTimeout(() => setActionErrorMsg(null), 4000);
    }
  };

  const exportStaffCsv = () => {
    const headers = [
      'Mã NV',
      'Họ và Tên',
      'Chức Danh',
      'Khoa Phòng',
      'Chuyên Khoa',
      'Số CCHN',
      'Số Điện Thoại',
      'Email',
      'Ca Trực',
      'Khu Vực Phụ Trách',
      'Trạng Thái Trực',
      'Số Năm Kinh Nghiệm',
      'Chứng Chỉ',
    ];

    const rows = doctors.map((d) => [
      `"${d.employeeCode || d.id}"`,
      `"${d.name}"`,
      `"${d.role || ''}"`,
      `"${d.department}"`,
      `"${d.specialty || ''}"`,
      `"${d.licenseNumber || ''}"`,
      `"${d.phone}"`,
      `"${d.email || ''}"`,
      `"${d.shift || ''}"`,
      `"${d.assignedZone || ''}"`,
      `"${d.isOnCall ? 'Trực Chính (On-Call)' : d.isBackup ? 'Trực Dự Phòng (Backup)' : 'Nghỉ Ca'}"`,
      `"${d.experienceYears || 5}"`,
      `"${Array.isArray(d.certifications) ? d.certifications.join('; ') : ''}"`,
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Hospital_Staff_Directory_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handlePrintRoster = () => {
    window.print();
  };

  const handleChangePin = (e: React.FormEvent) => {
    e.preventDefault();
    if (newPinInput.length < 4) {
      setPinError(language === 'vi' ? 'Mã PIN tối thiểu 4 chữ số' : 'PIN must be at least 4 digits');
      return;
    }
    setAdminPin(newPinInput);
    setNewPinInput('');
    setPinSuccessMsg(language === 'vi' ? 'Đã cập nhật mã PIN Admin thành công!' : 'Admin PIN successfully updated!');
    setTimeout(() => setPinSuccessMsg(''), 4000);
  };

  // Locked Screen
  if (isLocked) {
    return (
      <div className={`min-h-screen flex items-center justify-center p-4 ${isDark ? 'bg-slate-950 text-white' : 'bg-slate-50 text-slate-900'}`}>
        <div className={`max-w-md w-full p-8 rounded-3xl border shadow-2xl backdrop-blur-md ${isDark ? 'bg-slate-900/90 border-slate-800' : 'bg-white border-slate-200'}`}>
          <div className="text-center space-y-4">
            <div className="w-16 h-16 mx-auto rounded-2xl bg-gradient-to-tr from-amber-500 to-orange-600 flex items-center justify-center text-white shadow-lg shadow-orange-900/30">
              <Lock className="w-8 h-8" />
            </div>
            <h2 className="text-2xl font-black tracking-tight">{t.adminLockScreenTitle}</h2>
            <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>{t.adminLockScreenDesc}</p>

            <form onSubmit={handleUnlock} className="space-y-4 pt-2">
              <div>
                <input
                  type="password"
                  maxLength={6}
                  value={enteredPin}
                  onChange={(e) => setEnteredPin(e.target.value)}
                  placeholder={t.adminPinPlaceholder}
                  className={`w-full px-4 py-3 text-center text-lg font-mono tracking-widest rounded-xl border focus:outline-none focus:ring-2 ${
                    isDark ? 'bg-slate-800 border-slate-700 text-white focus:ring-amber-500' : 'bg-slate-100 border-slate-300 text-slate-900 focus:ring-amber-500'
                  }`}
                  autoFocus
                />
                {pinError && <p className="text-xs text-rose-500 mt-2 font-semibold">{pinError}</p>}
              </div>

              <div className="flex gap-2">
                <button
                  type="submit"
                  className="flex-1 py-3 bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-400 hover:to-orange-500 text-white font-bold rounded-xl shadow-md cursor-pointer text-sm"
                >
                  {t.btnUnlockAdmin}
                </button>
                <button
                  type="button"
                  onClick={handleQuickUnlock}
                  className="px-4 py-3 bg-slate-700 hover:bg-slate-600 text-slate-200 font-semibold rounded-xl text-xs cursor-pointer"
                >
                  {t.btnQuickUnlockAdmin}
                </button>
              </div>
            </form>

            <div className="pt-4 border-t border-slate-700/50 flex justify-between items-center text-xs">
              <button
                onClick={onSwitchToClinical}
                className="text-blue-500 hover:text-blue-400 font-semibold flex items-center gap-1 cursor-pointer"
              >
                ← {t.btnOpenClinicalPortal}
              </button>
              <span className="text-slate-500 text-[11px]">PIN Demo: 1234</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen transition-colors duration-200 ${isDark ? 'bg-slate-950 text-slate-100' : 'bg-slate-50 text-slate-900'}`}>
      {/* Toast notifications */}
      {actionSuccessMsg && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2 px-4 py-3 rounded-2xl bg-emerald-600 text-white font-bold text-xs shadow-2xl animate-bounce">
          <CheckCircle2 className="w-5 h-5" />
          <span>{actionSuccessMsg}</span>
        </div>
      )}

      {actionErrorMsg && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2 px-4 py-3 rounded-2xl bg-rose-600 text-white font-bold text-xs shadow-2xl animate-shake">
          <ShieldAlert className="w-5 h-5" />
          <span>{actionErrorMsg}</span>
        </div>
      )}

      {/* Standalone Admin Header Bar */}
      <header className={`sticky top-0 z-40 border-b shadow-md ${isDark ? 'bg-slate-900/95 backdrop-blur-md border-slate-800' : 'bg-white/95 backdrop-blur-md border-slate-200'}`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between min-h-16 py-2.5 gap-3 flex-wrap lg:flex-nowrap">
            {/* Admin Brand Logo & Title */}
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center w-11 h-11 rounded-2xl bg-gradient-to-tr from-amber-500 via-orange-500 to-rose-600 text-white shadow-lg shadow-orange-900/30">
                <Shield className="w-6 h-6" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className={`font-black text-base sm:text-lg tracking-tight ${isDark ? 'text-white' : 'text-slate-900'}`}>
                    {t.portalAdminTitle}
                  </span>
                  <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full font-black bg-amber-500/20 text-amber-500 border border-amber-500/30">
                    Admin Only
                  </span>
                </div>
                <p className={`text-[11px] font-medium hidden sm:block ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                  {t.adminSubtitle}
                </p>
              </div>
            </div>

            {/* Quick Actions & Portal Switcher */}
            <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
              {/* Back to ICU Emergency Alert Web */}
              <button
                id="btn-return-clinical-portal"
                onClick={onSwitchToClinical}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-black bg-blue-600 hover:bg-blue-500 text-white shadow-md shadow-blue-900/30 cursor-pointer transition-all"
                title="Quay lại Màn hình Cảnh báo Khẩn cấp Bệnh viện & Giám sát ICU"
              >
                <Activity className="w-4 h-4 animate-pulse text-red-300" />
                <span>{t.btnOpenClinicalPortal}</span>
              </button>

              {/* Open in New Window / Standalone Tab */}
              <button
                onClick={() => window.open('?portal=admin', '_blank')}
                className={`hidden md:flex items-center gap-1 px-3 py-2 rounded-xl text-xs font-semibold border cursor-pointer transition-all ${
                  isDark ? 'bg-slate-800/80 hover:bg-slate-800 text-slate-300 border-slate-700' : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-200'
                }`}
                title="Mở Cổng Quản Trị Nhân Sự trong Tab Trình Duyệt Riêng Biệt"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span>{t.btnOpenInNewTab}</span>
              </button>

              {/* Google Sheets Sync */}
              {onOpenGoogleSheets && (
                <button
                  onClick={onOpenGoogleSheets}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                    isDark
                      ? 'bg-emerald-950/40 hover:bg-emerald-900/60 text-emerald-400 border-emerald-500/30'
                      : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border-emerald-300'
                  }`}
                  title="Đồng bộ hồ sơ & lịch trực lên Google Sheets"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-500" />
                  <span className="hidden sm:inline">Google Sheets</span>
                </button>
              )}

              {/* Language Switch */}
              <button
                onClick={() => setLanguage(language === 'vi' ? 'en' : 'vi')}
                className={`flex items-center gap-1 px-2.5 py-2 rounded-xl text-xs font-bold border cursor-pointer ${
                  isDark ? 'bg-slate-800 text-slate-300 border-slate-700' : 'bg-slate-100 text-slate-700 border-slate-200'
                }`}
              >
                <Globe className="w-3.5 h-3.5" />
                <span>{language === 'vi' ? 'EN' : 'VI'}</span>
              </button>

              {/* Theme Toggle */}
              <button
                onClick={toggleTheme}
                className={`p-2 rounded-xl border cursor-pointer ${
                  isDark ? 'bg-slate-800 text-amber-400 border-slate-700' : 'bg-slate-100 text-slate-700 border-slate-200'
                }`}
              >
                {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
              </button>

              {/* Lock Admin Portal */}
              <button
                onClick={() => setIsLocked(true)}
                className={`p-2 rounded-xl border cursor-pointer text-rose-400 hover:bg-rose-500/10 ${
                  isDark ? 'bg-slate-800 border-slate-700' : 'bg-slate-100 border-slate-200'
                }`}
                title={t.btnLockAdmin}
              >
                <Lock className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Sub Navigation Tabs for Admin - Drag-to-scroll with Transparent Glass Container */}
          <div
            ref={adminTabRef}
            onMouseDown={handleTabMouseDown}
            onMouseLeave={handleTabMouseLeave}
            onMouseUp={handleTabMouseUp}
            onMouseMove={handleTabMouseMove}
            onTouchStart={handleTabTouchStart}
            onTouchMove={handleTabTouchMove}
            onTouchEnd={handleTabTouchEnd}
            onWheel={handleTabWheel}
            className={`flex items-center gap-1.5 py-1.5 px-1 overflow-x-auto no-scrollbar border-t border-slate-800/20 text-xs select-none transition-all duration-150 ${
              isDraggingTabs ? 'cursor-grabbing scale-[0.99]' : 'cursor-grab'
            } ${
              isDark ? 'bg-transparent sm:bg-slate-950/20 backdrop-blur-sm' : 'bg-transparent sm:bg-white/30 backdrop-blur-sm'
            }`}
            style={{
              scrollbarWidth: 'none',
              msOverflowStyle: 'none',
              WebkitOverflowScrolling: 'touch',
            }}
          >
            <button
              onClick={() => setAdminTab('directory')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-bold whitespace-nowrap cursor-pointer transition-all ${
                adminTab === 'directory'
                  ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                  : isDark
                  ? 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <Users className="w-3.5 h-3.5" />
              <span>{t.tabAdminDirectory}</span>
              <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-slate-900/40 font-mono font-bold">
                {doctors.length}
              </span>
            </button>

            <button
              onClick={() => setAdminTab('roster')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-bold whitespace-nowrap cursor-pointer transition-all ${
                adminTab === 'roster'
                  ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                  : isDark
                  ? 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <Calendar className="w-3.5 h-3.5" />
              <span>{t.tabAdminRoster}</span>
            </button>

            <button
              onClick={() => setAdminTab('attendance')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-bold whitespace-nowrap cursor-pointer transition-all ${
                adminTab === 'attendance'
                  ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                  : isDark
                  ? 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <DollarSign className="w-3.5 h-3.5" />
              <span>{t.tabAdminAttendance}</span>
            </button>

            <button
              onClick={() => setAdminTab('certifications')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-bold whitespace-nowrap cursor-pointer transition-all ${
                adminTab === 'certifications'
                  ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                  : isDark
                  ? 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <GraduationCap className="w-3.5 h-3.5" />
              <span>{t.tabAdminCertifications}</span>
            </button>

            <button
              onClick={() => setAdminTab('security')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-bold whitespace-nowrap cursor-pointer transition-all ${
                adminTab === 'security'
                  ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                  : isDark
                  ? 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>{t.tabAdminSecurity}</span>
            </button>

            <button
              onClick={() => setAdminTab('export')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-bold whitespace-nowrap cursor-pointer transition-all ${
                adminTab === 'export'
                  ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                  : isDark
                  ? 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              <span>{t.tabAdminExport}</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Body */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* Top Metric Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          <div className={`p-4 rounded-2xl border shadow-sm ${isDark ? 'bg-slate-900/70 border-slate-800' : 'bg-white border-slate-200'}`}>
            <div className="flex items-center justify-between text-slate-400 mb-1">
              <span className="text-[11px] font-bold uppercase tracking-wider">Tổng Nhân Sự</span>
              <Users className="w-4 h-4 text-blue-400" />
            </div>
            <div className="text-2xl font-black tracking-tight">{doctors.length}</div>
            <div className="text-[11px] text-slate-500 mt-1 flex items-center gap-1">
              <span>{totalDoctorsCount} Bác sĩ</span> • <span>{totalNursesCount} Điều dưỡng</span>
            </div>
          </div>

          <div className={`p-4 rounded-2xl border shadow-sm ${isDark ? 'bg-slate-900/70 border-slate-800' : 'bg-white border-slate-200'}`}>
            <div className="flex items-center justify-between text-emerald-500 mb-1">
              <span className="text-[11px] font-bold uppercase tracking-wider">Đang Trực Chính</span>
              <UserCheck className="w-4 h-4 text-emerald-400" />
            </div>
            <div className="text-2xl font-black tracking-tight text-emerald-500">{onCallCount}</div>
            <div className="text-[11px] text-emerald-500/80 mt-1 font-semibold">24/7 Hotline Ready</div>
          </div>

          <div className={`p-4 rounded-2xl border shadow-sm ${isDark ? 'bg-slate-900/70 border-slate-800' : 'bg-white border-slate-200'}`}>
            <div className="flex items-center justify-between text-amber-500 mb-1">
              <span className="text-[11px] font-bold uppercase tracking-wider">Trực Dự Phòng</span>
              <Shield className="w-4 h-4 text-amber-400" />
            </div>
            <div className="text-2xl font-black tracking-tight text-amber-500">{backupCount}</div>
            <div className="text-[11px] text-amber-500/80 mt-1 font-semibold">Sẵn sàng leo thang</div>
          </div>

          <div className={`p-4 rounded-2xl border shadow-sm ${isDark ? 'bg-slate-900/70 border-slate-800' : 'bg-white border-slate-200'}`}>
            <div className="flex items-center justify-between text-slate-400 mb-1">
              <span className="text-[11px] font-bold uppercase tracking-wider">Nghỉ Ca / Off</span>
              <Clock className="w-4 h-4 text-slate-400" />
            </div>
            <div className="text-2xl font-black tracking-tight text-slate-400">{offDutyCount}</div>
            <div className="text-[11px] text-slate-500 mt-1">Đổi ca kế tiếp</div>
          </div>

          <div className={`p-4 rounded-2xl border shadow-sm col-span-2 sm:col-span-1 ${isDark ? 'bg-slate-900/70 border-slate-800' : 'bg-white border-slate-200'}`}>
            <div className="flex items-center justify-between text-purple-400 mb-1">
              <span className="text-[11px] font-bold uppercase tracking-wider">Khoa Phụ Trách</span>
              <Building className="w-4 h-4 text-purple-400" />
            </div>
            <div className="text-2xl font-black tracking-tight text-purple-400">{departments.length}</div>
            <div className="text-[11px] text-purple-400/80 mt-1">Hồi sức & Cấp cứu</div>
          </div>
        </div>

        {/* TAB 1: STAFF DIRECTORY & HR PROFILES */}
        {adminTab === 'directory' && (
          <div className="space-y-4">
            {/* Search, Filter & Action Bar */}
            <div className={`p-4 rounded-2xl border ${isDark ? 'bg-slate-900/80 border-slate-800' : 'bg-white border-slate-200'} space-y-3`}>
              <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
                {/* Search Input */}
                <div className="relative flex-1">
                  <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Tìm theo tên, Mã NV, chuyên khoa, số CCHN, số điện thoại..."
                    className={`w-full pl-9 pr-4 py-2 rounded-xl text-xs border focus:outline-none focus:ring-2 focus:ring-amber-500 ${
                      isDark ? 'bg-slate-950 border-slate-800 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'
                    }`}
                  />
                  {searchTerm && (
                    <button
                      onClick={() => setSearchTerm('')}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                {/* Add New Staff Button */}
                <button
                  id="btn-add-staff-admin"
                  onClick={openAddModal}
                  className="flex items-center justify-center gap-1.5 px-4 py-2 bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-400 hover:to-orange-500 text-white font-bold text-xs rounded-xl shadow-md cursor-pointer transition-all shrink-0"
                >
                  <UserPlus className="w-4 h-4" />
                  <span>{t.btnAddStaff}</span>
                </button>
              </div>

              {/* Multi-Filters */}
              <div className="flex flex-wrap items-center gap-2 pt-1 text-xs">
                {/* Department Filter */}
                <select
                  value={departmentFilter}
                  onChange={(e) => setDepartmentFilter(e.target.value)}
                  className={`px-3 py-1.5 rounded-xl border font-semibold text-xs focus:outline-none ${
                    isDark ? 'bg-slate-950 border-slate-800 text-slate-300' : 'bg-slate-50 border-slate-300 text-slate-700'
                  }`}
                >
                  <option value="ALL">Mọi Khoa / Phòng Ban ({doctors.length})</option>
                  {departments.map((dept) => (
                    <option key={dept} value={dept}>
                      {dept} ({doctors.filter((d) => d.department === dept).length})
                    </option>
                  ))}
                </select>

                {/* Role Filter */}
                <select
                  value={roleFilter}
                  onChange={(e) => setRoleFilter(e.target.value)}
                  className={`px-3 py-1.5 rounded-xl border font-semibold text-xs focus:outline-none ${
                    isDark ? 'bg-slate-950 border-slate-800 text-slate-300' : 'bg-slate-50 border-slate-300 text-slate-700'
                  }`}
                >
                  <option value="ALL">Mọi Vị Trí / Chức Danh</option>
                  <option value="DOCTOR">Chỉ Bác Sĩ ({totalDoctorsCount})</option>
                  <option value="NURSE">Chỉ Điều Dưỡng / Y Tá ({totalNursesCount})</option>
                </select>

                {/* Status Filter */}
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value as any)}
                  className={`px-3 py-1.5 rounded-xl border font-semibold text-xs focus:outline-none ${
                    isDark ? 'bg-slate-950 border-slate-800 text-slate-300' : 'bg-slate-50 border-slate-300 text-slate-700'
                  }`}
                >
                  <option value="ALL">Mọi Trạng Thái Trực</option>
                  <option value="ON_CALL">Đang Trực Chính (On-Call)</option>
                  <option value="BACKUP">Trực Dự Phòng (Backup)</option>
                  <option value="OFF_DUTY">Nghỉ Ca (Off-Duty)</option>
                </select>

                {/* Reset Filters */}
                {(searchTerm || departmentFilter !== 'ALL' || roleFilter !== 'ALL' || statusFilter !== 'ALL') && (
                  <button
                    onClick={() => {
                      setSearchTerm('');
                      setDepartmentFilter('ALL');
                      setRoleFilter('ALL');
                      setStatusFilter('ALL');
                    }}
                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-rose-400 hover:bg-rose-500/10 font-semibold cursor-pointer"
                  >
                    <RotateCcw className="w-3 h-3" />
                    <span>Đặt lại lọc</span>
                  </button>
                )}

                <div className="ml-auto text-slate-500 text-[11px]">
                  Hiển thị <span className="font-bold text-amber-500">{filteredDoctors.length}</span> / {doctors.length} nhân sự
                </div>
              </div>
            </div>

            {/* Staff Cards Grid */}
            {filteredDoctors.length === 0 ? (
              <div className={`p-12 text-center rounded-2xl border ${isDark ? 'bg-slate-900/40 border-slate-800' : 'bg-white border-slate-200'}`}>
                <UserMinus className="w-12 h-12 text-slate-500 mx-auto mb-3" />
                <p className="font-bold text-sm text-slate-300">Không tìm thấy nhân viên y tế phù hợp</p>
                <p className="text-xs text-slate-500 mt-1">Vui lòng thử tìm với từ khóa hoặc bộ lọc khác</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredDoctors.map((staff) => {
                  const isDoctor = !staff.name.startsWith('ĐD') && !staff.role?.toLowerCase().includes('điều dưỡng');
                  const stats = staffAlertStats[staff.name] || { count: 0, totalResponseTime: 0 };
                  const avgResponseTime = stats.count > 0 ? Math.round(stats.totalResponseTime / stats.count) : 8;

                  return (
                    <div
                      key={staff.id}
                      className={`p-4 rounded-2xl border shadow-sm transition-all duration-200 hover:shadow-md flex flex-col justify-between ${
                        staff.isOnCall
                          ? isDark
                            ? 'bg-slate-900/90 border-emerald-500/40 ring-1 ring-emerald-500/20'
                            : 'bg-white border-emerald-300 ring-1 ring-emerald-300'
                          : staff.isBackup
                          ? isDark
                            ? 'bg-slate-900/80 border-amber-500/40'
                            : 'bg-white border-amber-300'
                          : isDark
                          ? 'bg-slate-900/60 border-slate-800'
                          : 'bg-white border-slate-200'
                      }`}
                    >
                      <div className="space-y-3">
                        {/* Top Header of Card */}
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-3">
                            <div
                              className={`w-11 h-11 rounded-2xl flex items-center justify-center font-black text-sm text-white shadow-md ${
                                isDoctor
                                  ? 'bg-gradient-to-tr from-blue-600 to-indigo-600 shadow-blue-900/30'
                                  : 'bg-gradient-to-tr from-emerald-600 to-teal-600 shadow-emerald-900/30'
                              }`}
                            >
                              {staff.name
                                .split(' ')
                                .map((n) => n[0])
                                .slice(-2)
                                .join('')}
                            </div>
                            <div>
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <h3 className="font-extrabold text-sm tracking-tight">{staff.name}</h3>
                                {staff.employeeCode && (
                                  <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-slate-800 text-slate-300 border border-slate-700">
                                    {staff.employeeCode}
                                  </span>
                                )}
                              </div>
                              <p className={`text-xs font-semibold ${isDark ? 'text-amber-400/90' : 'text-amber-700'}`}>
                                {staff.role || (isDoctor ? 'Bác Sĩ Cấp Cứu' : 'Điều Dưỡng')}
                              </p>
                            </div>
                          </div>

                          {/* Status Badge */}
                          {staff.isOnCall ? (
                            <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center gap-1">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" />
                              Trực Chính
                            </span>
                          ) : staff.isBackup ? (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/30">
                              Dự Phòng
                            </span>
                          ) : (
                            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 border border-slate-700">
                              Nghỉ Ca
                            </span>
                          )}
                        </div>

                        {/* Details list */}
                        <div className="space-y-1.5 text-xs text-slate-300">
                          <div className="flex items-center gap-2 text-slate-400">
                            <Building className="w-3.5 h-3.5 shrink-0 text-slate-500" />
                            <span className="truncate">{staff.department}</span>
                          </div>

                          {staff.specialty && (
                            <div className="flex items-center gap-2 text-slate-400">
                              <Stethoscope className="w-3.5 h-3.5 shrink-0 text-slate-500" />
                              <span className="truncate">{staff.specialty}</span>
                            </div>
                          )}

                          <div className="flex items-center gap-2 text-slate-400">
                            <Phone className="w-3.5 h-3.5 shrink-0 text-emerald-400" />
                            <span className="font-mono text-emerald-400 font-bold">{staff.phone}</span>
                          </div>

                          {staff.assignedZone && (
                            <div className="flex items-center gap-2 text-slate-400">
                              <Layers className="w-3.5 h-3.5 shrink-0 text-blue-400" />
                              <span className="truncate text-blue-300 text-[11px]">{staff.assignedZone}</span>
                            </div>
                          )}

                          {staff.licenseNumber && (
                            <div className="flex items-center gap-2 text-slate-500 text-[11px]">
                              <BadgeCheck className="w-3.5 h-3.5 shrink-0 text-amber-500" />
                              <span>CCHN: {staff.licenseNumber}</span>
                            </div>
                          )}
                        </div>

                        {/* Certifications tags */}
                        {staff.certifications && staff.certifications.length > 0 && (
                          <div className="flex flex-wrap gap-1 pt-1">
                            {staff.certifications.map((c, idx) => (
                              <span
                                key={idx}
                                className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-blue-950/60 text-blue-300 border border-blue-800/50"
                              >
                                {c}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Card Bottom Controls */}
                      <div className="mt-4 pt-3 border-t border-slate-800/60 flex items-center justify-between gap-1 text-xs">
                        <button
                          onClick={() => setSelectedStaffProfile(staff)}
                          className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-[11px] flex items-center gap-1 cursor-pointer transition-all"
                        >
                          <Eye className="w-3.5 h-3.5 text-blue-400" />
                          <span>Hồ Sơ</span>
                        </button>

                        <button
                          onClick={() => handleToggleOnCall(staff)}
                          className={`px-2.5 py-1.5 rounded-lg font-bold text-[11px] flex items-center gap-1 cursor-pointer transition-all ${
                            staff.isOnCall
                              ? 'bg-amber-500/20 text-amber-300 hover:bg-amber-500/30'
                              : 'bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30'
                          }`}
                        >
                          <Zap className="w-3 h-3" />
                          <span>{staff.isOnCall ? 'Đổi Dự Phòng' : 'Bật Trực Chính'}</span>
                        </button>

                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => openEditModal(staff)}
                            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white cursor-pointer"
                            title={t.btnEditStaff}
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => setDeletingStaff({ id: staff.id, name: staff.name })}
                            className="p-1.5 rounded-lg bg-slate-800 hover:bg-rose-950 text-slate-400 hover:text-rose-400 cursor-pointer"
                            title={t.btnDeleteStaff}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* TAB 2: DUTY ROSTER & 24/7 SHIFT SCHEDULING (THỜI KHÓA BIỂU LỊCH TRÌNH CA) */}
        {adminTab === 'roster' && (
          <DutyTimetableSchedule
            doctors={doctors}
            isDark={isDark}
            onStaffUpdated={onStaffUpdated}
            onOpenGoogleSheets={onOpenGoogleSheets}
          />
        )}

        {/* TAB 3: ATTENDANCE & ON-CALL ALLOWANCES */}
        {adminTab === 'attendance' && (
          <div className="space-y-4">
            <div className={`p-4 rounded-2xl border ${isDark ? 'bg-slate-900/80 border-slate-800' : 'bg-white border-slate-200'}`}>
              <h3 className="font-extrabold text-base flex items-center gap-2">
                <DollarSign className="w-5 h-5 text-emerald-500" />
                <span>Bảng Chấm Công & Tính Phụ Cấp Ca Trực Cấp Cứu ICU</span>
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Tự động tổng hợp số ca cấp cứu tiếp nhận, thời gian phản hồi khẩn cấp trung bình và định mức phụ cấp trực theo Thông tư Bộ Y Tế.
              </p>
            </div>

            <div className={`rounded-2xl border overflow-hidden shadow-sm ${isDark ? 'bg-slate-900/60 border-slate-800' : 'bg-white border-slate-200'}`}>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className={`font-bold border-b ${isDark ? 'bg-slate-950 text-slate-300 border-slate-800' : 'bg-slate-100 text-slate-700 border-slate-200'}`}>
                    <tr>
                      <th className="py-3 px-4">Y Bác Sĩ</th>
                      <th className="py-3 px-4">Khoa Phòng</th>
                      <th className="py-3 px-4">Số Ca Cấp Cứu Tiếp Nhận</th>
                      <th className="py-3 px-4">TG Phản Hồi TB</th>
                      <th className="py-3 px-4">Định Mức Phụ Cấp Ca</th>
                      <th className="py-3 px-4 text-right">Tổng Phụ Cấp Tạm Tính</th>
                    </tr>
                  </thead>
                  <tbody className={`divide-y ${isDark ? 'divide-slate-800/60' : 'divide-slate-200'}`}>
                    {doctors.map((staff) => {
                      const stats = staffAlertStats[staff.name] || { count: 0, totalResponseTime: 0 };
                      const count = stats.count > 0 ? stats.count : staff.isOnCall ? 4 : 2;
                      const avgSec = stats.count > 0 ? Math.round(stats.totalResponseTime / stats.count) : 7;
                      const isDoctor = !staff.name.startsWith('ĐD');
                      const baseAllowance = isDoctor ? 500000 : 350000;
                      const emergencyBonus = count * 150000;
                      const totalAllowance = baseAllowance + emergencyBonus;

                      return (
                        <tr key={staff.id} className="hover:bg-slate-800/30">
                          <td className="py-3 px-4 font-bold text-white">
                            <div>{staff.name}</div>
                            <div className="text-[11px] text-slate-400 font-normal">{staff.role}</div>
                          </td>
                          <td className="py-3 px-4 text-slate-300">{staff.department}</td>
                          <td className="py-3 px-4">
                            <span className="font-bold text-amber-400">{count} ca</span>
                          </td>
                          <td className="py-3 px-4">
                            <span className="font-mono text-emerald-400 font-bold">{avgSec}s</span> (Chuẩn &lt; 15s)
                          </td>
                          <td className="py-3 px-4 text-slate-300">{baseAllowance.toLocaleString('vi-VN')} đ/ca</td>
                          <td className="py-3 px-4 text-right font-black text-emerald-400 text-sm">
                            {totalAllowance.toLocaleString('vi-VN')} đ
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* TAB 4: CERTIFICATIONS & MEDICAL LICENSES */}
        {adminTab === 'certifications' && (
          <div className="space-y-4">
            <div className={`p-4 rounded-2xl border ${isDark ? 'bg-slate-900/80 border-slate-800' : 'bg-white border-slate-200'}`}>
              <h3 className="font-extrabold text-base flex items-center gap-2">
                <GraduationCap className="w-5 h-5 text-blue-500" />
                <span>Theo Dõi Chứng Chỉ Hành Nghề (CCHN) & Đào Tạo Cấp Cứu Nâng Cao</span>
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Quản lý tính hợp lệ của Chứng chỉ hành nghề Khám chữa bệnh, chứng nhận ACLS (Hồi sinh tim phổi nâng cao), BLS, ATLS và CCRN.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {doctors.map((staff) => (
                <div
                  key={staff.id}
                  className={`p-4 rounded-2xl border ${isDark ? 'bg-slate-900/70 border-slate-800' : 'bg-white border-slate-200'} space-y-3`}
                >
                  <div className="flex items-center justify-between">
                    <h4 className="font-bold text-sm text-white">{staff.name}</h4>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                      CCHN Hợp Lệ
                    </span>
                  </div>

                  <div className="space-y-1.5 text-xs text-slate-300">
                    <div className="flex justify-between">
                      <span className="text-slate-500">Số CCHN:</span>
                      <span className="font-mono font-bold text-amber-400">{staff.licenseNumber || '002145/BYT-CCHN'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Kinh nghiệm:</span>
                      <span>{staff.experienceYears || 5} năm chuyên ngành</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Đào tạo gần nhất:</span>
                      <span>Tháng 06/2026 (AHA Certified)</span>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-slate-800/60">
                    <span className="text-[11px] font-bold text-slate-400 block mb-1.5">Chứng chỉ chuyên môn:</span>
                    <div className="flex flex-wrap gap-1">
                      {(staff.certifications || ['ACLS', 'BLS']).map((c, i) => (
                        <span key={i} className="text-[10px] font-bold px-2 py-0.5 rounded bg-blue-950 text-blue-300 border border-blue-800">
                          {c}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB 5: ACCESS CONTROL & SECURITY */}
        {adminTab === 'security' && (
          <div className="space-y-4">
            <div className={`p-4 rounded-2xl border ${isDark ? 'bg-slate-900/80 border-slate-800' : 'bg-white border-slate-200'}`}>
              <h3 className="font-extrabold text-base flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-amber-500" />
                <span>Phân Quyền & Cấu Hình Bảo Mật Admin Portal</span>
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Cấu hình mã PIN bảo vệ khu vực Quản trị nhân sự và phân định quyền hạn các cấp bậc cán bộ y tế.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Change PIN Box */}
              <div className={`p-5 rounded-2xl border ${isDark ? 'bg-slate-900/70 border-slate-800' : 'bg-white border-slate-200'} space-y-4`}>
                <h4 className="font-bold text-sm flex items-center gap-2 text-amber-400">
                  <Key className="w-4 h-4" />
                  <span>Đổi Mã PIN Mở Khóa Admin</span>
                </h4>
                <p className="text-xs text-slate-400">
                  Mã PIN hiện tại: <span className="font-mono font-bold text-white">{adminPin}</span> (Mặc định: 1234)
                </p>

                <form onSubmit={handleChangePin} className="space-y-3">
                  <div>
                    <label className="text-xs font-bold text-slate-300">Nhập mã PIN mới (4-6 chữ số):</label>
                    <input
                      type="password"
                      maxLength={6}
                      value={newPinInput}
                      onChange={(e) => setNewPinInput(e.target.value)}
                      placeholder="Ví dụ: 8888"
                      className={`w-full mt-1 px-3 py-2 text-sm rounded-xl border focus:outline-none focus:ring-2 focus:ring-amber-500 ${
                        isDark ? 'bg-slate-950 border-slate-800 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'
                      }`}
                    />
                  </div>

                  {pinSuccessMsg && <p className="text-xs text-emerald-400 font-bold">{pinSuccessMsg}</p>}

                  <button
                    type="submit"
                    className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs rounded-xl shadow cursor-pointer"
                  >
                    Lưu Mã PIN Mới
                  </button>
                </form>
              </div>

              {/* RBAC Matrix */}
              <div className={`p-5 rounded-2xl border ${isDark ? 'bg-slate-900/70 border-slate-800' : 'bg-white border-slate-200'} space-y-3`}>
                <h4 className="font-bold text-sm flex items-center gap-2 text-blue-400">
                  <Shield className="w-4 h-4" />
                  <span>Ma Trận Quyền Hạn (RBAC Matrix)</span>
                </h4>
                <div className="space-y-2 text-xs">
                  <div className="flex justify-between items-center p-2 rounded-xl bg-slate-950/50 border border-slate-800">
                    <span className="font-bold text-amber-400">Super Admin / Ban Giám Đốc:</span>
                    <span className="text-emerald-400 font-semibold">Toàn quyền thêm, sửa, xóa, phân ca</span>
                  </div>
                  <div className="flex justify-between items-center p-2 rounded-xl bg-slate-950/50 border border-slate-800">
                    <span className="font-bold text-blue-400">Trưởng Khoa ICU / BS Trưởng Ca:</span>
                    <span className="text-slate-300">Duyệt ca trực, chỉ định trực chính</span>
                  </div>
                  <div className="flex justify-between items-center p-2 rounded-xl bg-slate-950/50 border border-slate-800">
                    <span className="font-bold text-teal-400">Điều Dưỡng Trưởng:</span>
                    <span className="text-slate-300">Phân công trạm y tá, duyệt MAR</span>
                  </div>
                  <div className="flex justify-between items-center p-2 rounded-xl bg-slate-950/50 border border-slate-800">
                    <span className="font-bold text-slate-400">Bác Sĩ & Điều Dưỡng:</span>
                    <span className="text-slate-400">Chỉ xem lịch trực & nhận cảnh báo</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 6: EXPORT & REPORTS */}
        {adminTab === 'export' && (
          <div className="space-y-4">
            <div className={`p-6 rounded-2xl border ${isDark ? 'bg-slate-900/80 border-slate-800' : 'bg-white border-slate-200'} text-center space-y-4`}>
              <div className="w-14 h-14 mx-auto rounded-2xl bg-gradient-to-tr from-emerald-500 to-teal-600 flex items-center justify-center text-white shadow-lg shadow-emerald-900/30">
                <FileSpreadsheet className="w-7 h-7" />
              </div>
              <div>
                <h3 className="font-black text-lg">Trung Tâm Xuất Báo Cáo Nhân Sự & Phân Ca Bệnh Viện</h3>
                <p className="text-xs text-slate-400 max-w-xl mx-auto mt-1">
                  Xuất toàn bộ danh bạ y bác sĩ, lịch phân ca 24/7, bảng chấm công phụ cấp và danh mục chứng chỉ hành nghề sang file định dạng chuẩn CSV / Excel.
                </p>
              </div>

              <div className="flex justify-center gap-3 pt-2">
                <button
                  onClick={exportStaffCsv}
                  className="flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl shadow-lg cursor-pointer transition-all"
                >
                  <Download className="w-4 h-4" />
                  <span>Tải Xuống Danh Bạ Nhân Sự (CSV)</span>
                </button>
                <button
                  onClick={handlePrintRoster}
                  className="flex items-center gap-2 px-5 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs rounded-xl border border-slate-700 cursor-pointer"
                >
                  <Printer className="w-4 h-4" />
                  <span>In Bảng Phân Ca Khổ A4</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* MODAL: ADD / EDIT STAFF */}
      {isEditModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in overflow-y-auto">
          <div className={`w-full max-w-2xl p-6 rounded-3xl border shadow-2xl my-8 ${isDark ? 'bg-slate-900 border-slate-800 text-white' : 'bg-white border-slate-200 text-slate-900'}`}>
            <div className="flex items-center justify-between border-b border-slate-800/60 pb-3 mb-4">
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center">
                  <UserPlus className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-extrabold text-base">
                    {editingStaff ? t.editStaffModalTitle : t.addStaffModalTitle}
                  </h3>
                  <p className="text-xs text-slate-400">Hồ sơ cán bộ y tế bệnh viện & phân bổ ca trực 24/7</p>
                </div>
              </div>
              <button
                onClick={() => setIsEditModalOpen(false)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {formError && (
              <div className="mb-4 p-3 rounded-xl bg-rose-950/60 border border-rose-800 text-rose-300 text-xs font-semibold">
                {formError}
              </div>
            )}

            <form onSubmit={handleSaveStaff} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Full Name */}
                <div>
                  <label className="text-xs font-bold text-slate-300">{t.staffName} *</label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="Ví dụ: BS. CKII. Nguyễn Quốc Trí"
                    className={`w-full mt-1 px-3 py-2 text-xs rounded-xl border focus:outline-none focus:ring-2 focus:ring-amber-500 ${
                      isDark ? 'bg-slate-950 border-slate-800 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'
                    }`}
                  />
                </div>

                {/* Employee Code */}
                <div>
                  <label className="text-xs font-bold text-slate-300">{t.staffCode}</label>
                  <input
                    type="text"
                    value={formData.employeeCode}
                    onChange={(e) => setFormData({ ...formData, employeeCode: e.target.value })}
                    placeholder="Ví dụ: NV-BS01"
                    className={`w-full mt-1 px-3 py-2 text-xs rounded-xl border focus:outline-none focus:ring-2 focus:ring-amber-500 ${
                      isDark ? 'bg-slate-950 border-slate-800 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'
                    }`}
                  />
                </div>

                {/* Role / Designation */}
                <div>
                  <label className="text-xs font-bold text-slate-300">{t.staffRole} *</label>
                  <input
                    type="text"
                    required
                    value={formData.role}
                    onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                    placeholder="Ví dụ: Trưởng Khoa / Bác Sĩ Trực ICU"
                    className={`w-full mt-1 px-3 py-2 text-xs rounded-xl border focus:outline-none focus:ring-2 focus:ring-amber-500 ${
                      isDark ? 'bg-slate-950 border-slate-800 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'
                    }`}
                  />
                </div>

                {/* Department */}
                <div>
                  <label className="text-xs font-bold text-slate-300">{t.staffDepartment} *</label>
                  <select
                    value={formData.department}
                    onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                    className={`w-full mt-1 px-3 py-2 text-xs rounded-xl border focus:outline-none focus:ring-2 focus:ring-amber-500 ${
                      isDark ? 'bg-slate-950 border-slate-800 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'
                    }`}
                  >
                    {departments.map((dept) => (
                      <option key={dept} value={dept}>
                        {dept}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Specialty */}
                <div>
                  <label className="text-xs font-bold text-slate-300">{t.staffSpecialty}</label>
                  <input
                    type="text"
                    value={formData.specialty}
                    onChange={(e) => setFormData({ ...formData, specialty: e.target.value })}
                    placeholder="Ví dụ: Hồi sức Tim Mạch & Đột quỵ"
                    className={`w-full mt-1 px-3 py-2 text-xs rounded-xl border focus:outline-none focus:ring-2 focus:ring-amber-500 ${
                      isDark ? 'bg-slate-950 border-slate-800 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'
                    }`}
                  />
                </div>

                {/* License Number (Số CCHN) */}
                <div>
                  <label className="text-xs font-bold text-slate-300">{t.staffLicense}</label>
                  <input
                    type="text"
                    value={formData.licenseNumber}
                    onChange={(e) => setFormData({ ...formData, licenseNumber: e.target.value })}
                    placeholder="Ví dụ: 002145/BYT-CCHN"
                    className={`w-full mt-1 px-3 py-2 text-xs rounded-xl border focus:outline-none focus:ring-2 focus:ring-amber-500 ${
                      isDark ? 'bg-slate-950 border-slate-800 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'
                    }`}
                  />
                </div>

                {/* Phone / Hotline */}
                <div>
                  <label className="text-xs font-bold text-slate-300">{t.staffPhone} *</label>
                  <input
                    type="tel"
                    required
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    placeholder="Ví dụ: 0912-345-678"
                    className={`w-full mt-1 px-3 py-2 text-xs rounded-xl border focus:outline-none focus:ring-2 focus:ring-amber-500 ${
                      isDark ? 'bg-slate-950 border-slate-800 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'
                    }`}
                  />
                </div>

                {/* Email */}
                <div>
                  <label className="text-xs font-bold text-slate-300">{t.staffEmail}</label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    placeholder="bacsi@hospital.vn"
                    className={`w-full mt-1 px-3 py-2 text-xs rounded-xl border focus:outline-none focus:ring-2 focus:ring-amber-500 ${
                      isDark ? 'bg-slate-950 border-slate-800 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'
                    }`}
                  />
                </div>

                {/* Shift */}
                <div>
                  <label className="text-xs font-bold text-slate-300">{t.staffShift}</label>
                  <select
                    value={formData.shift}
                    onChange={(e) => setFormData({ ...formData, shift: e.target.value })}
                    className={`w-full mt-1 px-3 py-2 text-xs rounded-xl border focus:outline-none focus:ring-2 focus:ring-amber-500 ${
                      isDark ? 'bg-slate-950 border-slate-800 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'
                    }`}
                  >
                    {shifts.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Assigned Zone */}
                <div>
                  <label className="text-xs font-bold text-slate-300">{t.staffAssignedZone}</label>
                  <select
                    value={formData.assignedZone}
                    onChange={(e) => setFormData({ ...formData, assignedZone: e.target.value })}
                    className={`w-full mt-1 px-3 py-2 text-xs rounded-xl border focus:outline-none focus:ring-2 focus:ring-amber-500 ${
                      isDark ? 'bg-slate-950 border-slate-800 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'
                    }`}
                  >
                    {zones.map((z) => (
                      <option key={z} value={z}>
                        {z}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Duty Status */}
                <div className="sm:col-span-2">
                  <label className="text-xs font-bold text-slate-300">{t.staffStatus}</label>
                  <div className="grid grid-cols-3 gap-2 mt-1">
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, dutyType: 'ON_CALL' })}
                      className={`p-2.5 rounded-xl text-xs font-bold border flex items-center justify-center gap-1.5 cursor-pointer ${
                        formData.dutyType === 'ON_CALL'
                          ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/50 shadow-sm'
                          : isDark
                          ? 'bg-slate-950 border-slate-800 text-slate-400'
                          : 'bg-slate-100 border-slate-300 text-slate-600'
                      }`}
                    >
                      <UserCheck className="w-3.5 h-3.5" />
                      <span>{t.staffOnCallStatus}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, dutyType: 'BACKUP' })}
                      className={`p-2.5 rounded-xl text-xs font-bold border flex items-center justify-center gap-1.5 cursor-pointer ${
                        formData.dutyType === 'BACKUP'
                          ? 'bg-amber-500/20 text-amber-400 border-amber-500/50 shadow-sm'
                          : isDark
                          ? 'bg-slate-950 border-slate-800 text-slate-400'
                          : 'bg-slate-100 border-slate-300 text-slate-600'
                      }`}
                    >
                      <Shield className="w-3.5 h-3.5" />
                      <span>{t.staffBackupStatus}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, dutyType: 'OFF_DUTY' })}
                      className={`p-2.5 rounded-xl text-xs font-bold border flex items-center justify-center gap-1.5 cursor-pointer ${
                        formData.dutyType === 'OFF_DUTY'
                          ? 'bg-slate-700 text-white border-slate-600 shadow-sm'
                          : isDark
                          ? 'bg-slate-950 border-slate-800 text-slate-400'
                          : 'bg-slate-100 border-slate-300 text-slate-600'
                      }`}
                    >
                      <Clock className="w-3.5 h-3.5" />
                      <span>{t.staffOffDutyStatus}</span>
                    </button>
                  </div>
                </div>

                {/* Certifications string */}
                <div className="sm:col-span-2">
                  <label className="text-xs font-bold text-slate-300">{t.staffCertifications}</label>
                  <input
                    type="text"
                    value={formData.certifications}
                    onChange={(e) => setFormData({ ...formData, certifications: e.target.value })}
                    placeholder="Ví dụ: ACLS AHA, BLS, CCRN, Cấp Cứu Tim Mạch (ngăn cách bởi dấu phẩy)"
                    className={`w-full mt-1 px-3 py-2 text-xs rounded-xl border focus:outline-none focus:ring-2 focus:ring-amber-500 ${
                      isDark ? 'bg-slate-950 border-slate-800 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'
                    }`}
                  />
                </div>

                {/* Notes */}
                <div className="sm:col-span-2">
                  <label className="text-xs font-bold text-slate-300">{t.staffNotes}</label>
                  <textarea
                    rows={2}
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    placeholder="Ghi chú về phân công công tác, chỉ đạo ca trực..."
                    className={`w-full mt-1 px-3 py-2 text-xs rounded-xl border focus:outline-none focus:ring-2 focus:ring-amber-500 ${
                      isDark ? 'bg-slate-950 border-slate-800 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'
                    }`}
                  />
                </div>
              </div>

              {/* Form Action Buttons */}
              <div className="pt-3 border-t border-slate-800 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsEditModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold cursor-pointer"
                >
                  {t.btnCancel}
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-400 hover:to-orange-500 text-white text-xs font-bold shadow-md cursor-pointer disabled:opacity-50"
                >
                  {isSubmitting ? t.btnSavingStaff : t.btnSaveStaff}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: VIEW FULL STAFF PROFILE */}
      {selectedStaffProfile && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
          <div className={`w-full max-w-lg p-6 rounded-3xl border shadow-2xl ${isDark ? 'bg-slate-900 border-slate-800 text-white' : 'bg-white border-slate-200 text-slate-900'}`}>
            <div className="flex items-start justify-between border-b border-slate-800/60 pb-3 mb-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-amber-500 to-orange-600 text-white flex items-center justify-center text-lg font-black shadow-md">
                  {selectedStaffProfile.name
                    .split(' ')
                    .map((n) => n[0])
                    .slice(-2)
                    .join('')}
                </div>
                <div>
                  <h3 className="font-black text-base">{selectedStaffProfile.name}</h3>
                  <p className="text-xs text-amber-400 font-semibold">{selectedStaffProfile.role}</p>
                </div>
              </div>
              <button
                onClick={() => setSelectedStaffProfile(null)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-2 p-3 rounded-xl bg-slate-950/60 border border-slate-800">
                <div>
                  <span className="text-slate-500 block">Mã Nhân Viên:</span>
                  <span className="font-mono font-bold text-white">{selectedStaffProfile.employeeCode || selectedStaffProfile.id}</span>
                </div>
                <div>
                  <span className="text-slate-500 block">Khoa Phòng:</span>
                  <span className="font-semibold text-white">{selectedStaffProfile.department}</span>
                </div>
                <div>
                  <span className="text-slate-500 block">Số CCHN:</span>
                  <span className="font-mono text-amber-400 font-bold">{selectedStaffProfile.licenseNumber || '002145/BYT-CCHN'}</span>
                </div>
                <div>
                  <span className="text-slate-500 block">Kinh Nghiệm:</span>
                  <span className="text-white">{selectedStaffProfile.experienceYears || 5} năm</span>
                </div>
                <div>
                  <span className="text-slate-500 block">Hotline Trực:</span>
                  <span className="font-mono text-emerald-400 font-bold">{selectedStaffProfile.phone}</span>
                </div>
                <div>
                  <span className="text-slate-500 block">Email:</span>
                  <span className="text-slate-300">{selectedStaffProfile.email || 'N/A'}</span>
                </div>
              </div>

              {selectedStaffProfile.assignedZone && (
                <div className="p-2.5 rounded-xl bg-blue-950/40 border border-blue-800/40 text-blue-300">
                  <span className="font-bold">Khu vực phân công: </span>
                  <span>{selectedStaffProfile.assignedZone}</span>
                </div>
              )}

              {selectedStaffProfile.certifications && selectedStaffProfile.certifications.length > 0 && (
                <div>
                  <span className="text-slate-400 font-bold block mb-1">Chứng chỉ chuyên môn quốc tế & BYT:</span>
                  <div className="flex flex-wrap gap-1">
                    {selectedStaffProfile.certifications.map((c, idx) => (
                      <span key={idx} className="px-2 py-0.5 rounded bg-blue-950 text-blue-300 border border-blue-800 font-semibold">
                        {c}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {selectedStaffProfile.notes && (
                <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-400">
                  <span className="font-bold text-slate-300">Ghi chú quản trị: </span>
                  <span>{selectedStaffProfile.notes}</span>
                </div>
              )}
            </div>

            <div className="mt-5 pt-3 border-t border-slate-800 flex justify-end gap-2">
              <button
                onClick={() => {
                  const s = selectedStaffProfile;
                  setSelectedStaffProfile(null);
                  openEditModal(s);
                }}
                className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs rounded-xl shadow cursor-pointer"
              >
                Chỉnh Sửa Hồ Sơ
              </button>
              <button
                onClick={() => setSelectedStaffProfile(null)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs rounded-xl cursor-pointer"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: DELETE CONFIRMATION */}
      {deletingStaff && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
          <div className={`w-full max-w-md p-6 rounded-3xl border shadow-2xl ${isDark ? 'bg-slate-900 border-slate-800 text-white' : 'bg-white border-slate-200 text-slate-900'}`}>
            <div className="text-center space-y-3">
              <div className="w-12 h-12 mx-auto rounded-2xl bg-rose-500/20 text-rose-500 flex items-center justify-center">
                <Trash2 className="w-6 h-6" />
              </div>
              <h3 className="font-black text-lg">Xác Nhận Xóa Nhân Sự</h3>
              <p className="text-xs text-slate-400">
                Bạn có chắc chắn muốn xóa nhân viên <span className="font-bold text-white">{deletingStaff.name}</span> khỏi danh sách cán bộ bệnh viện?
              </p>

              <div className="pt-3 flex justify-center gap-2">
                <button
                  onClick={() => setDeletingStaff(null)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold rounded-xl cursor-pointer"
                >
                  Hủy
                </button>
                <button
                  onClick={handleDeleteStaffConfirm}
                  className="px-5 py-2 bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold rounded-xl shadow-md cursor-pointer"
                >
                  Xác Nhận Xóa
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
