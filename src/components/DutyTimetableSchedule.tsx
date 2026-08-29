import React, { useState, useMemo, useEffect } from 'react';
import {
  Calendar,
  Clock,
  UserCheck,
  Shield,
  Zap,
  Plus,
  Edit2,
  Trash2,
  Shuffle,
  Sparkles,
  Printer,
  Download,
  Filter,
  Search,
  CheckCircle2,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  Sun,
  Moon,
  Sunset,
  Flame,
  Building,
  Layers,
  Phone,
  UserPlus,
  Users,
  X,
  RotateCcw,
  BadgeCheck,
  Check,
  Info,
  FileSpreadsheet,
} from 'lucide-react';
import { Doctor, StaffShiftSchedule } from '../types';
import { useLanguage } from '../context/LanguageContext';

interface DutyTimetableScheduleProps {
  doctors: Doctor[];
  isDark: boolean;
  onStaffUpdated?: () => void;
  onOpenGoogleSheets?: () => void;
}

// 4 Standard Hospital Duty Shifts
export const HOSPITAL_SHIFTS = [
  {
    type: 'MORNING' as const,
    code: 'SANG',
    nameVi: 'Ca Sáng (07:00 - 15:00)',
    nameEn: 'Morning Shift (07:00 - 15:00)',
    startTime: '07:00',
    endTime: '15:00',
    hours: 8,
    icon: Sun,
    colorLight: 'bg-amber-50 text-amber-800 border-amber-300 ring-amber-300',
    colorDark: 'bg-amber-950/40 text-amber-300 border-amber-700/60 ring-amber-500/20',
    badgeClass: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  },
  {
    type: 'AFTERNOON' as const,
    code: 'CHIEU',
    nameVi: 'Ca Chiều (15:00 - 23:00)',
    nameEn: 'Afternoon Shift (15:00 - 23:00)',
    startTime: '15:00',
    endTime: '23:00',
    hours: 8,
    icon: Sunset,
    colorLight: 'bg-orange-50 text-orange-800 border-orange-300 ring-orange-300',
    colorDark: 'bg-orange-950/40 text-orange-300 border-orange-700/60 ring-orange-500/20',
    badgeClass: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
  },
  {
    type: 'NIGHT' as const,
    code: 'DEM',
    nameVi: 'Ca Đêm (23:00 - 07:00)',
    nameEn: 'Night Shift (23:00 - 07:00)',
    startTime: '23:00',
    endTime: '07:00',
    hours: 8,
    icon: Moon,
    colorLight: 'bg-indigo-50 text-indigo-900 border-indigo-300 ring-indigo-300',
    colorDark: 'bg-indigo-950/50 text-indigo-300 border-indigo-700/60 ring-indigo-500/20',
    badgeClass: 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30',
  },
  {
    type: '24H' as const,
    code: '24H',
    nameVi: 'Ca 24h & Cấp Cứu Ngoại Viện',
    nameEn: '24h Emergency & On-Call',
    startTime: '07:00',
    endTime: '07:00 (+1)',
    hours: 24,
    icon: Flame,
    colorLight: 'bg-rose-50 text-rose-900 border-rose-300 ring-rose-300',
    colorDark: 'bg-rose-950/50 text-rose-300 border-rose-700/60 ring-rose-500/20',
    badgeClass: 'bg-rose-500/20 text-rose-400 border-rose-500/30',
  },
];

export const HOSPITAL_ZONES = [
  'ICU Khu A (Giường P101 - P103)',
  'ICU Khu B (Giường P201 - P308)',
  'Phòng Can Thiệp DSA & ICU Tim',
  'Trạm Điều Dưỡng Trung Tâm ICU',
  'Đội Xe Cấp Cứu 115 & Phòng Lưu',
  'Khu Phẫu Thuật Tim & Hồi Tỉnh',
];

// Helper to get week days from offset
function getWeekDates(offsetWeeks: number = 0) {
  const now = new Date();
  const day = now.getDay();
  // Adjust to Monday of current week
  const diff = now.getDate() - day + (day === 0 ? -6 : 1) + offsetWeeks * 7;
  const monday = new Date(now.setDate(diff));

  const weekDays = [];
  const dayNamesVi = ['Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy', 'Chủ Nhật'];
  const dayNamesEn = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

  for (let i = 0; i < 7; i++) {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    const dateStr = d.toISOString().split('T')[0];
    const isToday = new Date().toISOString().split('T')[0] === dateStr;

    weekDays.push({
      dateStr,
      dayIndex: i, // 0 = Mon, ..., 6 = Sun
      dayOfWeek: (i + 1) % 7,
      dayNameVi: dayNamesVi[i],
      dayNameEn: dayNamesEn[i],
      dayNumber: d.getDate(),
      monthNumber: d.getMonth() + 1,
      year: d.getFullYear(),
      formattedDate: `${d.getDate().toString().padStart(2, '0')}/${(d.getMonth() + 1).toString().padStart(2, '0')}`,
      isToday,
    });
  }
  return weekDays;
}

// Generate balanced initial sample schedule
function generateInitialSchedules(doctors: Doctor[], weekDays: ReturnType<typeof getWeekDates>): StaffShiftSchedule[] {
  const schedules: StaffShiftSchedule[] = [];
  if (doctors.length === 0) return schedules;

  const docList = doctors.filter((d) => !d.name.startsWith('ĐD'));
  const nurseList = doctors.filter((d) => d.name.startsWith('ĐD') || d.role?.toLowerCase().includes('điều dưỡng'));

  weekDays.forEach((day, dayIdx) => {
    // Lead Doctor for 24h/Morning
    const leadDoc = docList[dayIdx % docList.length] || doctors[0];
    const backupDoc = docList[(dayIdx + 1) % docList.length] || doctors[1] || doctors[0];
    const nightDoc = docList[(dayIdx + 2) % docList.length] || doctors[2] || doctors[0];
    const afternoonDoc = docList[(dayIdx + 3) % docList.length] || doctors[3] || doctors[0];

    const leadNurse = nurseList[dayIdx % (nurseList.length || 1)] || doctors[0];
    const nightNurse = nurseList[(dayIdx + 1) % (nurseList.length || 1)] || doctors[0];

    // 1. Morning Shift
    schedules.push({
      id: `SCH-${day.dateStr}-MORNING-1`,
      staffId: leadDoc.id,
      staffName: leadDoc.name,
      department: leadDoc.department,
      role: leadDoc.role || 'Bác Sĩ Cấp Cứu',
      dayOfWeek: day.dayOfWeek,
      date: day.dateStr,
      shiftType: 'MORNING',
      shiftName: 'Ca Sáng (07:00 - 15:00)',
      startTime: '07:00',
      endTime: '15:00',
      zone: 'ICU Khu A (Giường P101 - P103)',
      isOnCallLead: true,
      status: 'SCHEDULED',
      notes: 'Trực buồng hồi sức A',
    });

    if (leadNurse && leadNurse.id !== leadDoc.id) {
      schedules.push({
        id: `SCH-${day.dateStr}-MORNING-2`,
        staffId: leadNurse.id,
        staffName: leadNurse.name,
        department: leadNurse.department,
        role: leadNurse.role || 'Điều Dưỡng',
        dayOfWeek: day.dayOfWeek,
        date: day.dateStr,
        shiftType: 'MORNING',
        shiftName: 'Ca Sáng (07:00 - 15:00)',
        startTime: '07:00',
        endTime: '15:00',
        zone: 'Trạm Điều Dưỡng Trung Tâm ICU',
        isOnCallLead: false,
        status: 'SCHEDULED',
      });
    }

    // 2. Afternoon Shift
    schedules.push({
      id: `SCH-${day.dateStr}-AFTERNOON-1`,
      staffId: afternoonDoc.id,
      staffName: afternoonDoc.name,
      department: afternoonDoc.department,
      role: afternoonDoc.role || 'Bác Sĩ Trực Ca',
      dayOfWeek: day.dayOfWeek,
      date: day.dateStr,
      shiftType: 'AFTERNOON',
      shiftName: 'Ca Chiều (15:00 - 23:00)',
      startTime: '15:00',
      endTime: '23:00',
      zone: 'ICU Khu B (Giường P201 - P308)',
      isOnCallLead: false,
      status: 'SCHEDULED',
    });

    // 3. Night Shift
    schedules.push({
      id: `SCH-${day.dateStr}-NIGHT-1`,
      staffId: nightDoc.id,
      staffName: nightDoc.name,
      department: nightDoc.department,
      role: nightDoc.role || 'Bác Sĩ Trực Đêm ICU',
      dayOfWeek: day.dayOfWeek,
      date: day.dateStr,
      shiftType: 'NIGHT',
      shiftName: 'Ca Đêm (23:00 - 07:00)',
      startTime: '23:00',
      endTime: '07:00',
      zone: 'Toàn bộ ICU & Phòng Can Thiệp DSA',
      isOnCallLead: true,
      status: 'SCHEDULED',
      notes: 'Bác sĩ trực chính ca đêm',
    });

    if (nightNurse && nightNurse.id !== nightDoc.id) {
      schedules.push({
        id: `SCH-${day.dateStr}-NIGHT-2`,
        staffId: nightNurse.id,
        staffName: nightNurse.name,
        department: nightNurse.department,
        role: nightNurse.role || 'Điều Dưỡng Trực Đêm',
        dayOfWeek: day.dayOfWeek,
        date: day.dateStr,
        shiftType: 'NIGHT',
        shiftName: 'Ca Đêm (23:00 - 07:00)',
        startTime: '23:00',
        endTime: '07:00',
        zone: 'Trạm Điều Dưỡng Trung Tâm ICU',
        isOnCallLead: false,
        status: 'SCHEDULED',
      });
    }

    // 4. 24H Emergency On-Call
    schedules.push({
      id: `SCH-${day.dateStr}-24H-1`,
      staffId: backupDoc.id,
      staffName: backupDoc.name,
      department: backupDoc.department,
      role: backupDoc.role || 'Bác Sĩ Cố Vấn 24/7',
      dayOfWeek: day.dayOfWeek,
      date: day.dateStr,
      shiftType: '24H',
      shiftName: 'Ca 24h & Cấp Cứu Ngoại Viện',
      startTime: '07:00',
      endTime: '07:00 (+1)',
      zone: 'Đội Xe Cấp Cứu 115 & Phòng Lưu',
      isOnCallLead: false,
      status: 'SCHEDULED',
      notes: 'Trực hotline cấp cứu ngoại viện 24/7',
    });
  });

  return schedules;
}

export const DutyTimetableSchedule: React.FC<DutyTimetableScheduleProps> = ({
  doctors,
  isDark,
  onStaffUpdated,
  onOpenGoogleSheets,
}) => {
  const { t, language } = useLanguage();

  // Navigation & Week selector
  const [weekOffset, setWeekOffset] = useState(0);
  const weekDays = useMemo(() => getWeekDates(weekOffset), [weekOffset]);

  // Timetable State (persisted in localStorage)
  const [schedules, setSchedules] = useState<StaffShiftSchedule[]>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('stat_alert_staff_schedules');
      if (saved) {
        try {
          return JSON.parse(saved);
        } catch (e) {
          console.error(e);
        }
      }
    }
    return generateInitialSchedules(doctors, getWeekDates(0));
  });

  // Save schedules on update
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('stat_alert_staff_schedules', JSON.stringify(schedules));
    }
  }, [schedules]);

  // View Mode: 'matrix' (7 days x 4 shifts) | 'staff' (table per doctor) | 'department'
  const [viewMode, setViewMode] = useState<'matrix' | 'staff' | 'department'>('matrix');

  // Filters
  const [departmentFilter, setDepartmentFilter] = useState('ALL');
  const [shiftFilter, setShiftFilter] = useState('ALL');
  const [roleFilter, setRoleFilter] = useState('ALL');
  const [searchTerm, setSearchTerm] = useState('');

  // Modals
  const [isShiftModalOpen, setIsShiftModalOpen] = useState(false);
  const [editingShift, setEditingShift] = useState<StaffShiftSchedule | null>(null);
  const [isSwapModalOpen, setIsSwapModalOpen] = useState(false);
  const [swapShiftA, setSwapShiftA] = useState<StaffShiftSchedule | null>(null);
  const [swapShiftB, setSwapShiftB] = useState<StaffShiftSchedule | null>(null);
  const [swapReason, setSwapReason] = useState('');

  // Shift Form Data
  const [shiftForm, setShiftForm] = useState({
    staffId: doctors[0]?.id || '',
    date: weekDays[0]?.dateStr || new Date().toISOString().split('T')[0],
    shiftType: 'MORNING' as 'MORNING' | 'AFTERNOON' | 'NIGHT' | '24H',
    zone: HOSPITAL_ZONES[0],
    isOnCallLead: false,
    status: 'SCHEDULED' as 'SCHEDULED' | 'CHECKED_IN' | 'COMPLETED' | 'SWAPPED',
    notes: '',
  });

  // Toast feedback
  const [toastMsg, setToastMsg] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  const showToast = (text: string, type: 'success' | 'error' = 'success') => {
    setToastMsg({ text, type });
    setTimeout(() => setToastMsg(null), 3500);
  };

  // Week Date Span Header string
  const weekSpanText = useMemo(() => {
    const start = weekDays[0];
    const end = weekDays[6];
    if (language === 'vi') {
      return `Tuần từ ${start.formattedDate}/${start.year} đến ${end.formattedDate}/${end.year}`;
    }
    return `Week from ${start.formattedDate}/${start.year} to ${end.formattedDate}/${end.year}`;
  }, [weekDays, language]);

  // Filtered schedules for current active week
  const currentWeekSchedules = useMemo(() => {
    const weekDatesSet = new Set(weekDays.map((w) => w.dateStr));
    return schedules.filter((sch) => {
      if (!weekDatesSet.has(sch.date)) return false;

      if (departmentFilter !== 'ALL' && sch.department !== departmentFilter) return false;
      if (shiftFilter !== 'ALL' && sch.shiftType !== shiftFilter) return false;

      if (roleFilter === 'DOCTOR' && sch.staffName.startsWith('ĐD')) return false;
      if (roleFilter === 'NURSE' && !sch.staffName.startsWith('ĐD') && !sch.role?.toLowerCase().includes('điều dưỡng')) return false;

      if (searchTerm) {
        const q = searchTerm.toLowerCase();
        const matchName = sch.staffName.toLowerCase().includes(q);
        const matchZone = sch.zone.toLowerCase().includes(q);
        const matchRole = sch.role.toLowerCase().includes(q);
        if (!matchName && !matchZone && !matchRole) return false;
      }

      return true;
    });
  }, [schedules, weekDays, departmentFilter, shiftFilter, roleFilter, searchTerm]);

  // Timetable map: date -> shiftType -> StaffShiftSchedule[]
  const timetableMatrix = useMemo(() => {
    const matrix: Record<string, Record<string, StaffShiftSchedule[]>> = {};

    weekDays.forEach((w) => {
      matrix[w.dateStr] = {
        MORNING: [],
        AFTERNOON: [],
        NIGHT: [],
        '24H': [],
      };
    });

    currentWeekSchedules.forEach((sch) => {
      if (matrix[sch.date] && matrix[sch.date][sch.shiftType]) {
        matrix[sch.date][sch.shiftType].push(sch);
      }
    });

    return matrix;
  }, [weekDays, currentWeekSchedules]);

  // Calculate statistics for the current week
  const weekStats = useMemo(() => {
    const totalShifts = currentWeekSchedules.length;
    const morningCount = currentWeekSchedules.filter((s) => s.shiftType === 'MORNING').length;
    const afternoonCount = currentWeekSchedules.filter((s) => s.shiftType === 'AFTERNOON').length;
    const nightCount = currentWeekSchedules.filter((s) => s.shiftType === 'NIGHT').length;
    const emergency24hCount = currentWeekSchedules.filter((s) => s.shiftType === '24H').length;

    // Hours per staff calculation & overwork flag (> 48h/week)
    const staffHoursMap: Record<string, { name: string; hours: number; shifts: number; nightShifts: number; role: string }> = {};

    doctors.forEach((d) => {
      staffHoursMap[d.id] = { name: d.name, hours: 0, shifts: 0, nightShifts: 0, role: d.role || '' };
    });

    currentWeekSchedules.forEach((sch) => {
      if (!staffHoursMap[sch.staffId]) {
        staffHoursMap[sch.staffId] = { name: sch.staffName, hours: 0, shifts: 0, nightShifts: 0, role: sch.role };
      }
      const shiftConfig = HOSPITAL_SHIFTS.find((h) => h.type === sch.shiftType);
      const hours = shiftConfig?.hours || 8;
      staffHoursMap[sch.staffId].hours += hours;
      staffHoursMap[sch.staffId].shifts += 1;
      if (sch.shiftType === 'NIGHT' || sch.shiftType === '24H') {
        staffHoursMap[sch.staffId].nightShifts += 1;
      }
    });

    const staffList = Object.values(staffHoursMap);
    const overworkedStaff = staffList.filter((s) => s.hours > 48);
    const avgHours = staffList.length > 0 ? Math.round(staffList.reduce((sum, s) => sum + s.hours, 0) / staffList.length) : 0;

    return {
      totalShifts,
      morningCount,
      afternoonCount,
      nightCount,
      emergency24hCount,
      overworkedStaff,
      avgHours,
      staffHoursMap,
    };
  }, [currentWeekSchedules, doctors]);

  // Open modal to add shift on a specific day / slot
  const handleOpenAddShift = (dateStr?: string, shiftType?: 'MORNING' | 'AFTERNOON' | 'NIGHT' | '24H') => {
    setEditingShift(null);
    setShiftForm({
      staffId: doctors[0]?.id || '',
      date: dateStr || weekDays[0].dateStr,
      shiftType: shiftType || 'MORNING',
      zone: HOSPITAL_ZONES[0],
      isOnCallLead: shiftType === '24H' || shiftType === 'NIGHT',
      status: 'SCHEDULED',
      notes: '',
    });
    setIsShiftModalOpen(true);
  };

  // Open modal to edit an existing shift
  const handleOpenEditShift = (shift: StaffShiftSchedule) => {
    setEditingShift(shift);
    setShiftForm({
      staffId: shift.staffId,
      date: shift.date,
      shiftType: shift.shiftType as any,
      zone: shift.zone,
      isOnCallLead: shift.isOnCallLead,
      status: shift.status,
      notes: shift.notes || '',
    });
    setIsShiftModalOpen(true);
  };

  // Save Shift Handler
  const handleSaveShift = (e: React.FormEvent) => {
    e.preventDefault();
    const staff = doctors.find((d) => d.id === shiftForm.staffId);
    if (!staff) {
      showToast(language === 'vi' ? 'Không tìm thấy nhân viên y tế.' : 'Staff not found.', 'error');
      return;
    }

    const shiftConfig = HOSPITAL_SHIFTS.find((s) => s.type === shiftForm.shiftType);

    if (editingShift) {
      // Update
      setSchedules((prev) =>
        prev.map((s) =>
          s.id === editingShift.id
            ? {
                ...s,
                staffId: staff.id,
                staffName: staff.name,
                department: staff.department,
                role: staff.role || 'Bác Sĩ',
                date: shiftForm.date,
                shiftType: shiftForm.shiftType,
                shiftName: language === 'vi' ? shiftConfig?.nameVi || '' : shiftConfig?.nameEn || '',
                startTime: shiftConfig?.startTime || '07:00',
                endTime: shiftConfig?.endTime || '15:00',
                zone: shiftForm.zone,
                isOnCallLead: shiftForm.isOnCallLead,
                status: shiftForm.status,
                notes: shiftForm.notes,
              }
            : s
        )
      );
      showToast(
        language === 'vi'
          ? `Đã cập nhật ca trực: ${staff.name} (${shiftForm.date})`
          : `Updated shift for ${staff.name}`
      );
    } else {
      // Insert new
      const newShift: StaffShiftSchedule = {
        id: `SCH-${shiftForm.date}-${shiftForm.shiftType}-${Date.now()}`,
        staffId: staff.id,
        staffName: staff.name,
        department: staff.department,
        role: staff.role || 'Bác Sĩ',
        dayOfWeek: new Date(shiftForm.date).getDay(),
        date: shiftForm.date,
        shiftType: shiftForm.shiftType,
        shiftName: language === 'vi' ? shiftConfig?.nameVi || '' : shiftConfig?.nameEn || '',
        startTime: shiftConfig?.startTime || '07:00',
        endTime: shiftConfig?.endTime || '15:00',
        zone: shiftForm.zone,
        isOnCallLead: shiftForm.isOnCallLead,
        status: shiftForm.status,
        notes: shiftForm.notes,
      };

      setSchedules((prev) => [...prev, newShift]);
      showToast(
        language === 'vi'
          ? `Đã thêm ca trực cho ${staff.name} (${shiftConfig?.nameVi})`
          : `Added shift for ${staff.name}`
      );
    }

    setIsShiftModalOpen(false);
  };

  // Delete Shift
  const handleDeleteShift = (id: string, name: string) => {
    setSchedules((prev) => prev.filter((s) => s.id !== id));
    showToast(
      language === 'vi' ? `Đã xóa ca trực của ${name}` : `Removed shift for ${name}`
    );
  };

  // Smart Auto-Schedule Generator
  const handleAutoGenerateWeek = () => {
    const newWeeklySchedules = generateInitialSchedules(doctors, weekDays);
    const currentDatesSet = new Set(weekDays.map((w) => w.dateStr));

    // Replace current week only, keep other weeks
    setSchedules((prev) => [
      ...prev.filter((s) => !currentDatesSet.has(s.date)),
      ...newWeeklySchedules,
    ]);

    showToast(
      language === 'vi'
        ? `Đã tự động xếp thời khóa biểu cân bằng cho 7 ngày tuần này!`
        : `Smart auto-scheduled balanced timetable for the week!`
    );
  };

  // Open Swap Modal
  const handleOpenSwapModal = (initialShift?: StaffShiftSchedule) => {
    setSwapShiftA(initialShift || currentWeekSchedules[0] || null);
    setSwapShiftB(currentWeekSchedules[1] || null);
    setSwapReason('');
    setIsSwapModalOpen(true);
  };

  // Execute Shift Swap
  const handleExecuteSwap = (e: React.FormEvent) => {
    e.preventDefault();
    if (!swapShiftA || !swapShiftB || swapShiftA.id === swapShiftB.id) {
      showToast(language === 'vi' ? 'Vui lòng chọn 2 ca trực khác nhau để đổi.' : 'Please select 2 distinct shifts.', 'error');
      return;
    }

    setSchedules((prev) =>
      prev.map((s) => {
        if (s.id === swapShiftA.id) {
          return {
            ...s,
            staffId: swapShiftB.staffId,
            staffName: swapShiftB.staffName,
            department: swapShiftB.department,
            role: swapShiftB.role,
            status: 'SWAPPED',
            notes: `[Đổi ca với ${swapShiftA.staffName}] ${swapReason ? 'Lý do: ' + swapReason : ''}`,
          };
        }
        if (s.id === swapShiftB.id) {
          return {
            ...s,
            staffId: swapShiftA.staffId,
            staffName: swapShiftA.staffName,
            department: swapShiftA.department,
            role: swapShiftA.role,
            status: 'SWAPPED',
            notes: `[Đổi ca với ${swapShiftB.staffName}] ${swapReason ? 'Lý do: ' + swapReason : ''}`,
          };
        }
        return s;
      })
    );

    setIsSwapModalOpen(false);
    showToast(
      language === 'vi'
        ? `Đã đổi ca trực thành công giữa ${swapShiftA.staffName} và ${swapShiftB.staffName}!`
        : `Successfully swapped shifts between ${swapShiftA.staffName} and ${swapShiftB.staffName}!`
    );
  };

  // Export CSV
  const exportTimetableCsv = () => {
    const headers = [
      'Ngày Trực',
      'Thứ',
      'Khung Ca',
      'Thời Gian',
      'Họ và Tên Nhân Sự',
      'Chức Danh',
      'Khoa Phòng',
      'Khu Vực Phân Bổ',
      'Trưởng Kíp',
      'Trạng Thái',
      'Ghi Chú',
    ];

    const rows = currentWeekSchedules.map((s) => [
      `"${s.date}"`,
      `"${weekDays.find((w) => w.dateStr === s.date)?.dayNameVi || ''}"`,
      `"${s.shiftName}"`,
      `"${s.startTime} - ${s.endTime}"`,
      `"${s.staffName}"`,
      `"${s.role}"`,
      `"${s.department}"`,
      `"${s.zone}"`,
      `"${s.isOnCallLead ? 'Trưởng Kíp (Lead)' : 'Thành Viên'}"`,
      `"${s.status}"`,
      `"${s.notes || ''}"`,
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Thoi_Khoa_Bieu_Truc_ICU_${weekDays[0].dateStr}_${weekDays[6].dateStr}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-5">
      {/* Toast Notification */}
      {toastMsg && (
        <div
          className={`fixed bottom-6 right-6 z-50 flex items-center gap-2 px-4 py-3 rounded-2xl text-white font-bold text-xs shadow-2xl transition-all ${
            toastMsg.type === 'success' ? 'bg-emerald-600' : 'bg-rose-600'
          }`}
        >
          {toastMsg.type === 'success' ? <CheckCircle2 className="w-5 h-5" /> : <AlertTriangle className="w-5 h-5" />}
          <span>{toastMsg.text}</span>
        </div>
      )}

      {/* Top Section: Title Bar & Smart Action Controls */}
      <div
        className={`p-5 rounded-3xl border shadow-sm ${
          isDark ? 'bg-slate-900/90 border-slate-800' : 'bg-white border-slate-200'
        } space-y-4`}
      >
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-amber-500 via-orange-500 to-rose-600 text-white flex items-center justify-center shadow-md shadow-orange-900/20">
                <Calendar className="w-5 h-5" />
              </div>
              <div>
                <h2 className="font-black text-lg tracking-tight flex items-center gap-2">
                  <span>{t.timetableTitle}</span>
                  <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                    24/7 Matrix
                  </span>
                </h2>
                <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                  {t.timetableSubtitle}
                </p>
              </div>
            </div>
          </div>

          {/* Action Buttons Toolbar */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Auto Schedule */}
            <button
              onClick={handleAutoGenerateWeek}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white shadow-md shadow-purple-900/20 cursor-pointer transition-all"
              title="Tự động phân bổ ca sáng, ca chiều, ca đêm và ngày nghỉ cân bằng cho toàn bộ bác sĩ & điều dưỡng"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>{t.btnAutoSchedule}</span>
            </button>

            {/* Swap Shifts */}
            <button
              onClick={() => handleOpenSwapModal()}
              className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold border cursor-pointer transition-all ${
                isDark
                  ? 'bg-slate-800 hover:bg-slate-700 text-amber-300 border-amber-500/30'
                  : 'bg-amber-50 hover:bg-amber-100 text-amber-900 border-amber-300'
              }`}
            >
              <Shuffle className="w-3.5 h-3.5 text-amber-500" />
              <span>{t.btnSwapShifts}</span>
            </button>

            {/* Add Shift */}
            <button
              onClick={() => handleOpenAddShift()}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-black bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-400 hover:to-orange-500 text-slate-950 shadow-md shadow-amber-900/20 cursor-pointer transition-all"
            >
              <Plus className="w-4 h-4" />
              <span>{t.btnAddShift}</span>
            </button>

            {/* Google Sheets Sync */}
            {onOpenGoogleSheets && (
              <button
                onClick={onOpenGoogleSheets}
                className={`flex items-center gap-1 px-3 py-2 rounded-xl text-xs font-bold border cursor-pointer transition-all ${
                  isDark
                    ? 'bg-emerald-950/40 hover:bg-emerald-900/60 text-emerald-400 border-emerald-500/30'
                    : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border-emerald-300'
                }`}
                title="Đồng bộ thời khóa biểu trực lên Google Sheets"
              >
                <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-500" />
                <span className="hidden sm:inline">Google Sheets</span>
              </button>
            )}

            {/* Print */}
            <button
              onClick={() => window.print()}
              className={`flex items-center gap-1 px-3 py-2 rounded-xl text-xs font-semibold border cursor-pointer transition-all ${
                isDark ? 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700' : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-300'
              }`}
              title="In Bảng Thời Khóa Biểu Khổ Giấy A4 Chuẩn Bệnh Viện"
            >
              <Printer className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">{t.btnPrintTimetable}</span>
            </button>

            {/* Export CSV */}
            <button
              onClick={exportTimetableCsv}
              className={`flex items-center gap-1 px-3 py-2 rounded-xl text-xs font-semibold border cursor-pointer transition-all ${
                isDark ? 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700' : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-300'
              }`}
            >
              <Download className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">CSV</span>
            </button>
          </div>
        </div>

        {/* Week Navigator & View Selector Bar */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-3 border-t border-slate-800/40">
          {/* Week Date Navigator */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setWeekOffset((prev) => prev - 1)}
              className={`p-2 rounded-xl border transition-all cursor-pointer ${
                isDark ? 'bg-slate-800 hover:bg-slate-700 border-slate-700 text-slate-300' : 'bg-slate-100 hover:bg-slate-200 border-slate-300 text-slate-700'
              }`}
              title="Tuần Trước"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            <button
              onClick={() => setWeekOffset(0)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                weekOffset === 0
                  ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-sm'
                  : isDark
                  ? 'bg-slate-800 text-slate-300 border-slate-700'
                  : 'bg-slate-100 text-slate-700 border-slate-300'
              }`}
            >
              {language === 'vi' ? 'Tuần Này (Hiện Tại)' : 'Current Week'}
            </button>

            <button
              onClick={() => setWeekOffset((prev) => prev + 1)}
              className={`p-2 rounded-xl border transition-all cursor-pointer ${
                isDark ? 'bg-slate-800 hover:bg-slate-700 border-slate-700 text-slate-300' : 'bg-slate-100 hover:bg-slate-200 border-slate-300 text-slate-700'
              }`}
              title="Tuần Sau"
            >
              <ChevronRight className="w-4 h-4" />
            </button>

            <div className="font-mono font-bold text-xs ml-1 flex items-center gap-1.5">
              <span className={isDark ? 'text-amber-400' : 'text-amber-700'}>{weekSpanText}</span>
            </div>
          </div>

          {/* View Mode Switcher */}
          <div className="flex items-center gap-1 bg-slate-950/40 p-1 rounded-2xl border border-slate-800 text-xs">
            <button
              onClick={() => setViewMode('matrix')}
              className={`px-3 py-1.5 rounded-xl font-bold cursor-pointer transition-all ${
                viewMode === 'matrix'
                  ? 'bg-amber-500 text-slate-950 shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              {t.viewWeeklyMatrix}
            </button>

            <button
              onClick={() => setViewMode('staff')}
              className={`px-3 py-1.5 rounded-xl font-bold cursor-pointer transition-all ${
                viewMode === 'staff'
                  ? 'bg-amber-500 text-slate-950 shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              {t.viewByStaff}
            </button>

            <button
              onClick={() => setViewMode('department')}
              className={`px-3 py-1.5 rounded-xl font-bold cursor-pointer transition-all ${
                viewMode === 'department'
                  ? 'bg-amber-500 text-slate-950 shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              {t.viewByDepartment}
            </button>
          </div>
        </div>

        {/* Search & Secondary Filters */}
        <div className="flex flex-wrap items-center gap-2 pt-2 text-xs">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Tìm theo tên bác sĩ, điều dưỡng, buồng trực, vị trí..."
              className={`w-full pl-8 pr-3 py-1.5 rounded-xl text-xs border focus:outline-none focus:ring-1 focus:ring-amber-500 ${
                isDark ? 'bg-slate-950 border-slate-800 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'
              }`}
            />
          </div>

          <select
            value={departmentFilter}
            onChange={(e) => setDepartmentFilter(e.target.value)}
            className={`px-2.5 py-1.5 rounded-xl border text-xs font-semibold focus:outline-none ${
              isDark ? 'bg-slate-950 border-slate-800 text-slate-300' : 'bg-slate-50 border-slate-300 text-slate-700'
            }`}
          >
            <option value="ALL">Mọi Khoa Phòng</option>
            <option value="Hồi Sức Cấp Cứu (ICU)">Hồi Sức Cấp Cứu (ICU)</option>
            <option value="Tim Mạch Can Thiệp">Tim Mạch Can Thiệp</option>
            <option value="Cấp Cứu Ngoại Viện">Cấp Cứu Ngoại Viện</option>
            <option value="Gây Mê Hồi Sức">Gây Mê Hồi Sức</option>
            <option value="Trạm Y Tá ICU Trung Tâm">Trạm Y Tá ICU Trung Tâm</option>
          </select>

          <select
            value={shiftFilter}
            onChange={(e) => setShiftFilter(e.target.value)}
            className={`px-2.5 py-1.5 rounded-xl border text-xs font-semibold focus:outline-none ${
              isDark ? 'bg-slate-950 border-slate-800 text-slate-300' : 'bg-slate-50 border-slate-300 text-slate-700'
            }`}
          >
            <option value="ALL">Mọi Khung Ca</option>
            <option value="MORNING">Ca Sáng (07:00 - 15:00)</option>
            <option value="AFTERNOON">Ca Chiều (15:00 - 23:00)</option>
            <option value="NIGHT">Ca Đêm (23:00 - 07:00)</option>
            <option value="24H">Ca 24h & Cấp Cứu</option>
          </select>

          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className={`px-2.5 py-1.5 rounded-xl border text-xs font-semibold focus:outline-none ${
              isDark ? 'bg-slate-950 border-slate-800 text-slate-300' : 'bg-slate-50 border-slate-300 text-slate-700'
            }`}
          >
            <option value="ALL">Tất cả Chức Danh</option>
            <option value="DOCTOR">Chỉ Bác Sĩ</option>
            <option value="NURSE">Chỉ Điều Dưỡng</option>
          </select>

          {(searchTerm || departmentFilter !== 'ALL' || shiftFilter !== 'ALL' || roleFilter !== 'ALL') && (
            <button
              onClick={() => {
                setSearchTerm('');
                setDepartmentFilter('ALL');
                setShiftFilter('ALL');
                setRoleFilter('ALL');
              }}
              className="flex items-center gap-1 px-2 py-1 rounded-lg text-rose-400 hover:bg-rose-500/10 font-bold cursor-pointer"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Đặt lại</span>
            </button>
          )}
        </div>
      </div>

      {/* Analytics & Medical Safety Overview Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 gap-3">
        <div className={`p-3.5 rounded-2xl border shadow-sm ${isDark ? 'bg-slate-900/70 border-slate-800' : 'bg-white border-slate-200'}`}>
          <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1 flex items-center justify-between">
            <span>Tổng Ca Trực Tuần</span>
            <Calendar className="w-3.5 h-3.5 text-blue-400" />
          </div>
          <div className="text-xl font-black">{weekStats.totalShifts} ca</div>
          <div className="text-[10px] text-slate-500 mt-0.5">Phân bổ 7 ngày</div>
        </div>

        <div className={`p-3.5 rounded-2xl border shadow-sm ${isDark ? 'bg-slate-900/70 border-slate-800' : 'bg-white border-slate-200'}`}>
          <div className="text-[11px] font-bold text-indigo-400 uppercase tracking-wider mb-1 flex items-center justify-between">
            <span>Ca Đêm (Night)</span>
            <Moon className="w-3.5 h-3.5 text-indigo-400" />
          </div>
          <div className="text-xl font-black text-indigo-400">{weekStats.nightCount} ca</div>
          <div className="text-[10px] text-slate-500 mt-0.5">Phụ cấp trực đêm</div>
        </div>

        <div className={`p-3.5 rounded-2xl border shadow-sm ${isDark ? 'bg-slate-900/70 border-slate-800' : 'bg-white border-slate-200'}`}>
          <div className="text-[11px] font-bold text-rose-400 uppercase tracking-wider mb-1 flex items-center justify-between">
            <span>Ca 24h Cấp Cứu</span>
            <Flame className="w-3.5 h-3.5 text-rose-400" />
          </div>
          <div className="text-xl font-black text-rose-400">{weekStats.emergency24hCount} ca</div>
          <div className="text-[10px] text-slate-500 mt-0.5">Hotline & DSA sẵn sàng</div>
        </div>

        <div className={`p-3.5 rounded-2xl border shadow-sm ${isDark ? 'bg-slate-900/70 border-slate-800' : 'bg-white border-slate-200'}`}>
          <div className="text-[11px] font-bold text-amber-400 uppercase tracking-wider mb-1 flex items-center justify-between">
            <span>Trung Bình Giờ / NV</span>
            <Clock className="w-3.5 h-3.5 text-amber-400" />
          </div>
          <div className="text-xl font-black text-amber-400">{weekStats.avgHours}h / tuần</div>
          <div className="text-[10px] text-slate-500 mt-0.5">Định mức chuẩn: 40-48h</div>
        </div>

        <div className={`p-3.5 rounded-2xl border shadow-sm col-span-2 sm:col-span-1 ${isDark ? 'bg-slate-900/70 border-slate-800' : 'bg-white border-slate-200'}`}>
          <div className="text-[11px] font-bold text-emerald-400 uppercase tracking-wider mb-1 flex items-center justify-between">
            <span>An Toàn Lâm Sàng</span>
            <Shield className="w-3.5 h-3.5 text-emerald-400" />
          </div>
          {weekStats.overworkedStaff.length === 0 ? (
            <div>
              <div className="text-sm font-black text-emerald-400 flex items-center gap-1 mt-1">
                <Check className="w-4 h-4" /> Đạt Chuẩn
              </div>
              <div className="text-[10px] text-slate-500 mt-0.5">Không quá tải &gt;48h</div>
            </div>
          ) : (
            <div>
              <div className="text-xs font-black text-rose-400 flex items-center gap-1 mt-1">
                <AlertTriangle className="w-3.5 h-3.5" /> {weekStats.overworkedStaff.length} cảnh báo
              </div>
              <div className="text-[10px] text-rose-400/80 mt-0.5 truncate">Trực quá tải &gt;48h</div>
            </div>
          )}
        </div>
      </div>

      {/* VIEW 1: WEEKLY 7-DAY TIMETABLE MATRIX (Ma Trận Thời Khóa Biểu Tuần 7 Ngày) */}
      {viewMode === 'matrix' && (
        <div className="space-y-4">
          {/* 7 Days Matrix Columns */}
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-7 gap-3">
            {weekDays.map((day) => {
              const dayShifts = timetableMatrix[day.dateStr] || { MORNING: [], AFTERNOON: [], NIGHT: [], '24H': [] };
              const totalDayShiftsCount =
                dayShifts.MORNING.length + dayShifts.AFTERNOON.length + dayShifts.NIGHT.length + dayShifts['24H'].length;

              return (
                <div
                  key={day.dateStr}
                  className={`rounded-2xl border flex flex-col shadow-sm transition-all ${
                    day.isToday
                      ? isDark
                        ? 'bg-slate-900 border-amber-500/50 ring-2 ring-amber-500/20'
                        : 'bg-white border-amber-400 ring-2 ring-amber-400/30'
                      : isDark
                      ? 'bg-slate-900/60 border-slate-800'
                      : 'bg-white border-slate-200'
                  }`}
                >
                  {/* Day Header */}
                  <div
                    className={`p-3 border-b rounded-t-2xl flex items-center justify-between ${
                      day.isToday
                        ? 'bg-gradient-to-r from-amber-500/20 to-orange-500/20 border-amber-500/30'
                        : isDark
                        ? 'bg-slate-950/60 border-slate-800'
                        : 'bg-slate-100 border-slate-200'
                    }`}
                  >
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="font-extrabold text-xs">
                          {language === 'vi' ? day.dayNameVi : day.dayNameEn}
                        </span>
                        {day.isToday && (
                          <span className="text-[9px] font-black uppercase px-1.5 py-0.2 rounded bg-amber-500 text-slate-950 font-mono">
                            Hôm nay
                          </span>
                        )}
                      </div>
                      <div className="font-mono text-[11px] text-slate-400">{day.formattedDate}</div>
                    </div>

                    <button
                      onClick={() => handleOpenAddShift(day.dateStr, 'MORNING')}
                      className="p-1 rounded-lg bg-amber-500/20 hover:bg-amber-500 text-amber-400 hover:text-slate-950 transition-all cursor-pointer"
                      title={`Thêm ca trực vào ${day.dayNameVi}`}
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {/* Shifts for this Day */}
                  <div className="p-2.5 space-y-3 flex-1 flex flex-col justify-between">
                    <div className="space-y-3">
                      {/* 1. Morning Shift */}
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between text-[10px] font-bold text-amber-400">
                          <span className="flex items-center gap-1">
                            <Sun className="w-3 h-3" /> Ca Sáng (07-15h)
                          </span>
                          <button
                            onClick={() => handleOpenAddShift(day.dateStr, 'MORNING')}
                            className="text-slate-500 hover:text-amber-400 text-[10px]"
                          >
                            + Thêm
                          </button>
                        </div>

                        {dayShifts.MORNING.length === 0 ? (
                          <div className={`p-2 text-center rounded-xl border border-dashed text-[10px] ${isDark ? 'border-slate-800 text-slate-600' : 'border-slate-300 text-slate-400'}`}>
                            Chưa phân ca
                          </div>
                        ) : (
                          dayShifts.MORNING.map((sch) => (
                            <ShiftCardItem
                              key={sch.id}
                              shift={sch}
                              isDark={isDark}
                              onEdit={() => handleOpenEditShift(sch)}
                              onDelete={() => handleDeleteShift(sch.id, sch.staffName)}
                              onSwap={() => handleOpenSwapModal(sch)}
                            />
                          ))
                        )}
                      </div>

                      {/* 2. Afternoon Shift */}
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between text-[10px] font-bold text-orange-400">
                          <span className="flex items-center gap-1">
                            <Sunset className="w-3 h-3" /> Ca Chiều (15-23h)
                          </span>
                          <button
                            onClick={() => handleOpenAddShift(day.dateStr, 'AFTERNOON')}
                            className="text-slate-500 hover:text-orange-400 text-[10px]"
                          >
                            + Thêm
                          </button>
                        </div>

                        {dayShifts.AFTERNOON.length === 0 ? (
                          <div className={`p-2 text-center rounded-xl border border-dashed text-[10px] ${isDark ? 'border-slate-800 text-slate-600' : 'border-slate-300 text-slate-400'}`}>
                            Chưa phân ca
                          </div>
                        ) : (
                          dayShifts.AFTERNOON.map((sch) => (
                            <ShiftCardItem
                              key={sch.id}
                              shift={sch}
                              isDark={isDark}
                              onEdit={() => handleOpenEditShift(sch)}
                              onDelete={() => handleDeleteShift(sch.id, sch.staffName)}
                              onSwap={() => handleOpenSwapModal(sch)}
                            />
                          ))
                        )}
                      </div>

                      {/* 3. Night Shift */}
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between text-[10px] font-bold text-indigo-400">
                          <span className="flex items-center gap-1">
                            <Moon className="w-3 h-3" /> Ca Đêm (23-07h)
                          </span>
                          <button
                            onClick={() => handleOpenAddShift(day.dateStr, 'NIGHT')}
                            className="text-slate-500 hover:text-indigo-400 text-[10px]"
                          >
                            + Thêm
                          </button>
                        </div>

                        {dayShifts.NIGHT.length === 0 ? (
                          <div className={`p-2 text-center rounded-xl border border-dashed text-[10px] ${isDark ? 'border-slate-800 text-slate-600' : 'border-slate-300 text-slate-400'}`}>
                            Chưa phân ca
                          </div>
                        ) : (
                          dayShifts.NIGHT.map((sch) => (
                            <ShiftCardItem
                              key={sch.id}
                              shift={sch}
                              isDark={isDark}
                              onEdit={() => handleOpenEditShift(sch)}
                              onDelete={() => handleDeleteShift(sch.id, sch.staffName)}
                              onSwap={() => handleOpenSwapModal(sch)}
                            />
                          ))
                        )}
                      </div>

                      {/* 4. 24H Emergency On-Call */}
                      {dayShifts['24H'].length > 0 && (
                        <div className="space-y-1.5">
                          <div className="flex items-center justify-between text-[10px] font-bold text-rose-400">
                            <span className="flex items-center gap-1">
                              <Flame className="w-3 h-3" /> Ca 24h On-Call
                            </span>
                          </div>
                          {dayShifts['24H'].map((sch) => (
                            <ShiftCardItem
                              key={sch.id}
                              shift={sch}
                              isDark={isDark}
                              onEdit={() => handleOpenEditShift(sch)}
                              onDelete={() => handleDeleteShift(sch.id, sch.staffName)}
                              onSwap={() => handleOpenSwapModal(sch)}
                            />
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Day Summary footer */}
                    <div className="pt-2 border-t border-slate-800/40 text-[10px] text-slate-500 flex items-center justify-between">
                      <span>Tổng trực:</span>
                      <span className="font-bold text-amber-500">{totalDayShiftsCount} nhân sự</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* VIEW 2: STAFF-CENTRIC TIMETABLE (Thời Khóa Biểu Theo Từng Y Bác Sĩ & Điều Dưỡng) */}
      {viewMode === 'staff' && (
        <div className={`rounded-3xl border overflow-hidden shadow-sm ${isDark ? 'bg-slate-900/70 border-slate-800' : 'bg-white border-slate-200'}`}>
          <div className="p-4 border-b border-slate-800/60 flex items-center justify-between flex-wrap gap-2">
            <h3 className="font-extrabold text-sm flex items-center gap-2">
              <Users className="w-4 h-4 text-amber-500" />
              <span>Bảng Thời Khóa Biểu Theo Từng Cán Bộ Y Tế (Staff Duty Matrix)</span>
            </h3>
            <span className="text-xs text-slate-500">
              Tổng hợp ca trực và tổng số giờ làm việc trong tuần (Định mức 40-48h/tuần)
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className={`font-bold border-b ${isDark ? 'bg-slate-950 text-slate-300 border-slate-800' : 'bg-slate-100 text-slate-700 border-slate-200'}`}>
                <tr>
                  <th className="py-3 px-4 min-w-[200px]">Y Bác Sĩ / Điều Dưỡng</th>
                  {weekDays.map((d) => (
                    <th key={d.dateStr} className={`py-3 px-3 text-center min-w-[110px] ${d.isToday ? 'text-amber-400 bg-amber-500/10' : ''}`}>
                      <div>{language === 'vi' ? d.dayNameVi : d.dayNameEn}</div>
                      <div className="text-[10px] font-normal text-slate-400 font-mono">{d.formattedDate}</div>
                    </th>
                  ))}
                  <th className="py-3 px-4 text-center min-w-[90px]">Tổng Ca</th>
                  <th className="py-3 px-4 text-center min-w-[100px]">Tổng Giờ</th>
                  <th className="py-3 px-4 text-right min-w-[120px]">Phụ Cấp Trực</th>
                </tr>
              </thead>
              <tbody className={`divide-y ${isDark ? 'divide-slate-800/60' : 'divide-slate-200'}`}>
                {doctors.map((staff) => {
                  const staffStats = weekStats.staffHoursMap[staff.id] || { hours: 0, shifts: 0, nightShifts: 0 };
                  const isDoctor = !staff.name.startsWith('ĐD');
                  const allowance = staffStats.shifts * (isDoctor ? 500000 : 350000) + staffStats.nightShifts * 150000;

                  return (
                    <tr key={staff.id} className={`hover:bg-slate-800/30 transition-colors`}>
                      {/* Staff Info */}
                      <td className="py-3 px-4">
                        <div className="font-bold text-sm">{staff.name}</div>
                        <div className="text-[11px] text-slate-400 flex items-center gap-1">
                          <span>{staff.department}</span> • <span className="text-amber-500 font-mono">{staff.employeeCode || staff.id}</span>
                        </div>
                      </td>

                      {/* 7 Days cells */}
                      {weekDays.map((d) => {
                        const dayStaffShifts = currentWeekSchedules.filter(
                          (s) => s.staffId === staff.id && s.date === d.dateStr
                        );

                        return (
                          <td key={d.dateStr} className={`py-2 px-2 text-center ${d.isToday ? 'bg-amber-500/5' : ''}`}>
                            {dayStaffShifts.length === 0 ? (
                              <span className="text-[10px] px-2 py-0.5 rounded text-slate-500 bg-slate-950/40">
                                Nghỉ
                              </span>
                            ) : (
                              <div className="space-y-1">
                                {dayStaffShifts.map((sch) => {
                                  let bgBadge = 'bg-amber-500/20 text-amber-300 border-amber-500/30';
                                  let shortLabel = 'Sáng';
                                  if (sch.shiftType === 'AFTERNOON') {
                                    bgBadge = 'bg-orange-500/20 text-orange-300 border-orange-500/30';
                                    shortLabel = 'Chiều';
                                  } else if (sch.shiftType === 'NIGHT') {
                                    bgBadge = 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30';
                                    shortLabel = 'Đêm 🌙';
                                  } else if (sch.shiftType === '24H') {
                                    bgBadge = 'bg-rose-500/20 text-rose-300 border-rose-500/30';
                                    shortLabel = '24h 🔥';
                                  }

                                  return (
                                    <div
                                      key={sch.id}
                                      onClick={() => handleOpenEditShift(sch)}
                                      className={`px-1.5 py-0.5 rounded text-[10px] font-bold border cursor-pointer hover:opacity-80 transition-all ${bgBadge}`}
                                      title={`${sch.shiftName} - ${sch.zone}`}
                                    >
                                      {shortLabel}
                                      {sch.isOnCallLead && ' 👑'}
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </td>
                        );
                      })}

                      {/* Summary metrics */}
                      <td className="py-3 px-4 text-center font-bold">
                        <span className="px-2 py-0.5 rounded-lg bg-blue-500/20 text-blue-400 font-mono">
                          {staffStats.shifts} ca
                        </span>
                      </td>

                      <td className="py-3 px-4 text-center">
                        <span
                          className={`px-2 py-0.5 rounded-lg font-bold font-mono ${
                            staffStats.hours > 48
                              ? 'bg-rose-500/20 text-rose-400 border border-rose-500/40'
                              : 'bg-emerald-500/20 text-emerald-400'
                          }`}
                        >
                          {staffStats.hours}h
                        </span>
                      </td>

                      <td className="py-3 px-4 text-right font-black text-emerald-400 font-mono">
                        {allowance.toLocaleString('vi-VN')} đ
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* VIEW 3: DEPARTMENT ROSTER (Lịch Trực Theo Khoa Phòng) */}
      {viewMode === 'department' && (
        <div className="space-y-4">
          {['Hồi Sức Cấp Cứu (ICU)', 'Tim Mạch Can Thiệp', 'Cấp Cứu Ngoại Viện', 'Gây Mê Hồi Sức'].map((dept) => {
            const deptShifts = currentWeekSchedules.filter((s) => s.department.includes(dept) || dept.includes(s.department));

            return (
              <div
                key={dept}
                className={`p-4 rounded-3xl border shadow-sm ${
                  isDark ? 'bg-slate-900/70 border-slate-800' : 'bg-white border-slate-200'
                } space-y-3`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Building className="w-4 h-4 text-amber-500" />
                    <h3 className="font-extrabold text-sm">{dept}</h3>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-blue-500/20 text-blue-400">
                      {deptShifts.length} lượt ca trực tuần
                    </span>
                  </div>

                  <button
                    onClick={() => handleOpenAddShift(weekDays[0].dateStr, 'MORNING')}
                    className="flex items-center gap-1 text-xs font-bold text-amber-500 hover:text-amber-400 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Thêm ca cho khoa</span>
                  </button>
                </div>

                {deptShifts.length === 0 ? (
                  <p className="text-xs text-slate-500 py-2">Chưa có lịch phân ca cho khoa này trong tuần.</p>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
                    {deptShifts.map((sch) => (
                      <ShiftCardItem
                        key={sch.id}
                        shift={sch}
                        isDark={isDark}
                        onEdit={() => handleOpenEditShift(sch)}
                        onDelete={() => handleDeleteShift(sch.id, sch.staffName)}
                        onSwap={() => handleOpenSwapModal(sch)}
                      />
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* MODAL 1: ADD / EDIT SHIFT */}
      {isShiftModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
          <div
            className={`w-full max-w-lg p-6 rounded-3xl border shadow-2xl ${
              isDark ? 'bg-slate-900 border-slate-800 text-white' : 'bg-white border-slate-200 text-slate-900'
            }`}
          >
            <div className="flex items-center justify-between border-b border-slate-800/60 pb-3 mb-4">
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center">
                  <Calendar className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-extrabold text-base">
                    {editingShift ? 'Chỉnh Sửa Ca Trực' : 'Phân Ca Trực Mới (Add Shift)'}
                  </h3>
                  <p className="text-xs text-slate-400">Thời khóa biểu phân bổ nhân sự y tế</p>
                </div>
              </div>
              <button
                onClick={() => setIsShiftModalOpen(false)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveShift} className="space-y-3.5 text-xs">
              {/* Select Staff */}
              <div>
                <label className="font-bold text-slate-300 block mb-1">Bác Sĩ / Điều Dưỡng *</label>
                <select
                  required
                  value={shiftForm.staffId}
                  onChange={(e) => setShiftForm({ ...shiftForm, staffId: e.target.value })}
                  className={`w-full px-3 py-2 rounded-xl border focus:outline-none focus:ring-2 focus:ring-amber-500 font-semibold ${
                    isDark ? 'bg-slate-950 border-slate-800 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'
                  }`}
                >
                  {doctors.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name} ({d.role || d.department}) - {d.employeeCode || d.id}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                {/* Date */}
                <div>
                  <label className="font-bold text-slate-300 block mb-1">Ngày Trực *</label>
                  <input
                    type="date"
                    required
                    value={shiftForm.date}
                    onChange={(e) => setShiftForm({ ...shiftForm, date: e.target.value })}
                    className={`w-full px-3 py-2 rounded-xl border focus:outline-none focus:ring-2 focus:ring-amber-500 ${
                      isDark ? 'bg-slate-950 border-slate-800 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'
                    }`}
                  />
                </div>

                {/* Shift Type */}
                <div>
                  <label className="font-bold text-slate-300 block mb-1">Khung Ca Trực *</label>
                  <select
                    value={shiftForm.shiftType}
                    onChange={(e) => setShiftForm({ ...shiftForm, shiftType: e.target.value as any })}
                    className={`w-full px-3 py-2 rounded-xl border focus:outline-none focus:ring-2 focus:ring-amber-500 font-semibold ${
                      isDark ? 'bg-slate-950 border-slate-800 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'
                    }`}
                  >
                    <option value="MORNING">Ca Sáng (07:00 - 15:00)</option>
                    <option value="AFTERNOON">Ca Chiều (15:00 - 23:00)</option>
                    <option value="NIGHT">Ca Đêm (23:00 - 07:00)</option>
                    <option value="24H">Ca 24h & Cấp Cứu</option>
                  </select>
                </div>
              </div>

              {/* Assigned Zone */}
              <div>
                <label className="font-bold text-slate-300 block mb-1">Khu Vực Phân Bổ *</label>
                <select
                  value={shiftForm.zone}
                  onChange={(e) => setShiftForm({ ...shiftForm, zone: e.target.value })}
                  className={`w-full px-3 py-2 rounded-xl border focus:outline-none focus:ring-2 focus:ring-amber-500 ${
                    isDark ? 'bg-slate-950 border-slate-800 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'
                  }`}
                >
                  {HOSPITAL_ZONES.map((z) => (
                    <option key={z} value={z}>
                      {z}
                    </option>
                  ))}
                </select>
              </div>

              {/* Lead Doctor On-Call toggle */}
              <div className="flex items-center gap-2 p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20">
                <input
                  type="checkbox"
                  id="lead-doctor-check"
                  checked={shiftForm.isOnCallLead}
                  onChange={(e) => setShiftForm({ ...shiftForm, isOnCallLead: e.target.checked })}
                  className="w-4 h-4 rounded text-amber-500 focus:ring-amber-400 cursor-pointer"
                />
                <label htmlFor="lead-doctor-check" className="font-bold text-amber-400 cursor-pointer select-none">
                  Chỉ định làm Trưởng Kíp Trực Lâm Sàng (Lead On-Call Doctor)
                </label>
              </div>

              {/* Status */}
              <div>
                <label className="font-bold text-slate-300 block mb-1">Trạng Thái Điểm Danh</label>
                <select
                  value={shiftForm.status}
                  onChange={(e) => setShiftForm({ ...shiftForm, status: e.target.value as any })}
                  className={`w-full px-3 py-2 rounded-xl border focus:outline-none ${
                    isDark ? 'bg-slate-950 border-slate-800 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'
                  }`}
                >
                  <option value="SCHEDULED">Đã Lên Lịch (Scheduled)</option>
                  <option value="CHECKED_IN">Đã Điểm Danh Có Mặt (Checked-in)</option>
                  <option value="COMPLETED">Đã Hoàn Tất Ca (Completed)</option>
                  <option value="SWAPPED">Đã Đổi Ca (Swapped)</option>
                </select>
              </div>

              {/* Notes */}
              <div>
                <label className="font-bold text-slate-300 block mb-1">Ghi Chú Ca Trực</label>
                <input
                  type="text"
                  value={shiftForm.notes}
                  onChange={(e) => setShiftForm({ ...shiftForm, notes: e.target.value })}
                  placeholder="Ví dụ: Phụ trách buồng hồi sức A, theo dõi bệnh nhân P.101..."
                  className={`w-full px-3 py-2 rounded-xl border focus:outline-none ${
                    isDark ? 'bg-slate-950 border-slate-800 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'
                  }`}
                />
              </div>

              {/* Buttons */}
              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800/60">
                <button
                  type="button"
                  onClick={() => setIsShiftModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold cursor-pointer"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-400 hover:to-orange-500 text-slate-950 font-black shadow-md cursor-pointer"
                >
                  {editingShift ? 'Lưu Thay Đổi' : 'Thêm Vào Lịch Trực'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: SHIFT SWAP (Đổi Ca Trực) */}
      {isSwapModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
          <div
            className={`w-full max-w-lg p-6 rounded-3xl border shadow-2xl ${
              isDark ? 'bg-slate-900 border-slate-800 text-white' : 'bg-white border-slate-200 text-slate-900'
            }`}
          >
            <div className="flex items-center justify-between border-b border-slate-800/60 pb-3 mb-4">
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center">
                  <Shuffle className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-extrabold text-base">Đổi Ca Trực Giữa 2 Nhân Sự</h3>
                  <p className="text-xs text-slate-400">Hoán đổi lịch trực và lưu vết kiểm toán</p>
                </div>
              </div>
              <button
                onClick={() => setIsSwapModalOpen(false)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleExecuteSwap} className="space-y-4 text-xs">
              {/* Shift A */}
              <div>
                <label className="font-bold text-slate-300 block mb-1">Ca Trực 1 (Người xin đổi ca) *</label>
                <select
                  required
                  value={swapShiftA?.id || ''}
                  onChange={(e) => {
                    const found = currentWeekSchedules.find((s) => s.id === e.target.value);
                    setSwapShiftA(found || null);
                  }}
                  className={`w-full px-3 py-2 rounded-xl border font-semibold ${
                    isDark ? 'bg-slate-950 border-slate-800 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'
                  }`}
                >
                  {currentWeekSchedules.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.staffName} ({s.date} - {s.shiftName})
                    </option>
                  ))}
                </select>
              </div>

              {/* Shift B */}
              <div>
                <label className="font-bold text-slate-300 block mb-1">Ca Trực 2 (Người nhận đổi ca) *</label>
                <select
                  required
                  value={swapShiftB?.id || ''}
                  onChange={(e) => {
                    const found = currentWeekSchedules.find((s) => s.id === e.target.value);
                    setSwapShiftB(found || null);
                  }}
                  className={`w-full px-3 py-2 rounded-xl border font-semibold ${
                    isDark ? 'bg-slate-950 border-slate-800 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'
                  }`}
                >
                  {currentWeekSchedules.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.staffName} ({s.date} - {s.shiftName})
                    </option>
                  ))}
                </select>
              </div>

              {/* Swap Reason */}
              <div>
                <label className="font-bold text-slate-300 block mb-1">Lý Do Đổi Ca & Ký Duyệt</label>
                <input
                  type="text"
                  value={swapReason}
                  onChange={(e) => setSwapReason(e.target.value)}
                  placeholder="Ví dụ: Tham dự hội nghị tim mạch / Có ca mổ cấp cứu đột xuất..."
                  className={`w-full px-3 py-2 rounded-xl border ${
                    isDark ? 'bg-slate-950 border-slate-800 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'
                  }`}
                />
              </div>

              {/* Submit buttons */}
              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800/60">
                <button
                  type="button"
                  onClick={() => setIsSwapModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold cursor-pointer"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-400 hover:to-orange-500 text-slate-950 font-black shadow-md cursor-pointer"
                >
                  Xác Nhận Đổi Ca
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

// Sub Component: Shift Card Item inside matrix slot
interface ShiftCardItemProps {
  shift: StaffShiftSchedule;
  isDark: boolean;
  onEdit: () => void;
  onDelete: () => void;
  onSwap: () => void;
}

const ShiftCardItem: React.FC<ShiftCardItemProps> = ({
  shift,
  isDark,
  onEdit,
  onDelete,
  onSwap,
}) => {
  const isDoctor = !shift.staffName.startsWith('ĐD') && !shift.role?.toLowerCase().includes('điều dưỡng');

  let borderStyle = 'border-slate-800 bg-slate-950/80';
  if (shift.shiftType === 'MORNING') borderStyle = isDark ? 'border-amber-500/40 bg-amber-950/20' : 'border-amber-300 bg-amber-50/50';
  else if (shift.shiftType === 'AFTERNOON') borderStyle = isDark ? 'border-orange-500/40 bg-orange-950/20' : 'border-orange-300 bg-orange-50/50';
  else if (shift.shiftType === 'NIGHT') borderStyle = isDark ? 'border-indigo-500/40 bg-indigo-950/30' : 'border-indigo-300 bg-indigo-50/50';
  else if (shift.shiftType === '24H') borderStyle = isDark ? 'border-rose-500/40 bg-rose-950/30' : 'border-rose-300 bg-rose-50/50';

  return (
    <div
      className={`p-2 rounded-xl border text-[11px] space-y-1 transition-all hover:shadow-md group ${borderStyle}`}
    >
      <div className="flex items-start justify-between gap-1">
        <div className="flex items-center gap-1.5 overflow-hidden">
          <div
            className={`w-6 h-6 rounded-lg flex items-center justify-center font-black text-[10px] text-white shrink-0 ${
              isDoctor
                ? 'bg-gradient-to-tr from-blue-600 to-indigo-600'
                : 'bg-gradient-to-tr from-emerald-600 to-teal-600'
            }`}
          >
            {shift.staffName
              .split(' ')
              .map((n) => n[0])
              .slice(-2)
              .join('')}
          </div>
          <div className="truncate">
            <span className="font-extrabold text-slate-100 truncate block text-[11px]">
              {shift.staffName}
            </span>
          </div>
        </div>

        {shift.isOnCallLead && (
          <span
            className="text-[9px] font-black px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-400 border border-amber-500/30 shrink-0"
            title="Trưởng kíp trực lâm sàng"
          >
            👑 Trưởng Kíp
          </span>
        )}
      </div>

      <div className="flex items-center justify-between text-[10px] text-slate-400">
        <span className="truncate text-slate-300">{shift.zone.split('(')[0].trim()}</span>
      </div>

      {shift.notes && (
        <div className="text-[9px] text-slate-400 italic truncate border-t border-slate-800/40 pt-0.5">
          {shift.notes}
        </div>
      )}

      {/* Hover actions */}
      <div className="pt-1 flex items-center justify-between text-[10px] opacity-80 group-hover:opacity-100 transition-opacity">
        <button
          onClick={onEdit}
          className="text-slate-400 hover:text-amber-400 cursor-pointer flex items-center gap-0.5"
          title="Chỉnh sửa ca"
        >
          <Edit2 className="w-2.5 h-2.5" /> Sửa
        </button>

        <button
          onClick={onSwap}
          className="text-slate-400 hover:text-blue-400 cursor-pointer flex items-center gap-0.5"
          title="Đổi ca trực"
        >
          <Shuffle className="w-2.5 h-2.5" /> Đổi
        </button>

        <button
          onClick={onDelete}
          className="text-slate-500 hover:text-rose-400 cursor-pointer"
          title="Xóa ca này"
        >
          <Trash2 className="w-2.5 h-2.5" />
        </button>
      </div>
    </div>
  );
};
