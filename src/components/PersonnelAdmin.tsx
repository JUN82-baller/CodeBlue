import React, { useState } from 'react';
import {
  Briefcase,
  Check,
  Edit2,
  Mail,
  Phone,
  Plus,
  Search,
  Shield,
  Trash2,
  UserCheck,
  UserPlus,
  Users,
  X,
  Clock,
  Building,
} from 'lucide-react';
import { Doctor } from '../types';
import { useLanguage } from '../context/LanguageContext';
import { useTheme } from '../context/ThemeContext';

interface PersonnelAdminProps {
  doctors: Doctor[];
  onStaffUpdated?: () => void;
}

export const PersonnelAdmin: React.FC<PersonnelAdminProps> = ({ doctors, onStaffUpdated }) => {
  const { t, language } = useLanguage();
  const { theme } = useTheme();

  const [searchTerm, setSearchTerm] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ON_CALL' | 'BACKUP' | 'OFF_DUTY'>('ALL');

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingStaff, setEditingStaff] = useState<Doctor | null>(null);
  const [deletingStaff, setDeletingStaff] = useState<{ id: string; name: string } | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Form State
  const [formData, setFormData] = useState({
    name: '',
    role: '',
    department: 'Hồi Sức Cấp Cứu (ICU)',
    phone: '',
    email: '',
    shift: 'Ca 24h',
    dutyType: 'ON_CALL' as 'ON_CALL' | 'BACKUP' | 'OFF_DUTY',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState('');

  const departments = [
    'Hồi Sức Cấp Cứu (ICU)',
    'Tim Mạch Can Thiệp',
    'Cấp Cứu Ngoại Viện',
    'Nội Tim Mạch Tổng Quát',
    'Trạm Y Tá ICU Trung Tâm',
    'Gây Mê Hồi Sức',
  ];

  const shifts = ['Ca Ngày (07:00 - 15:00)', 'Ca Chiều (15:00 - 23:00)', 'Ca Đêm (23:00 - 07:00)', 'Ca 24h'];

  const openAddModal = () => {
    setEditingStaff(null);
    setFormData({
      name: '',
      role: language === 'vi' ? 'Bác Sĩ Cấp Cứu' : 'Emergency Physician',
      department: 'Hồi Sức Cấp Cứu (ICU)',
      phone: '09' + Math.floor(10000000 + Math.random() * 90000000),
      email: '',
      shift: 'Ca 24h',
      dutyType: 'ON_CALL',
    });
    setFormError('');
    setIsModalOpen(true);
  };

  const openEditModal = (staff: Doctor) => {
    setEditingStaff(staff);
    setFormData({
      name: staff.name,
      role: staff.role || (language === 'vi' ? 'Bác Sĩ Trực' : 'On-Call Physician'),
      department: staff.department,
      phone: staff.phone,
      email: staff.email || '',
      shift: staff.shift || 'Ca 24h',
      dutyType: staff.isOnCall ? 'ON_CALL' : staff.isBackup ? 'BACKUP' : 'OFF_DUTY',
    });
    setFormError('');
    setIsModalOpen(true);
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

    const payload = {
      name: formData.name.trim(),
      role: formData.role.trim(),
      department: formData.department,
      phone: formData.phone.trim(),
      email: formData.email.trim(),
      shift: formData.shift,
      isOnCall: formData.dutyType === 'ON_CALL',
      isBackup: formData.dutyType === 'BACKUP',
    };

    try {
      if (editingStaff) {
        // Edit existing
        const res = await fetch(`/api/doctors/${editingStaff.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        if (!res.ok) throw new Error('Failed to update staff');
      } else {
        // Create new
        const res = await fetch('/api/doctors', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        if (!res.ok) throw new Error('Failed to create staff');
      }

      setIsModalOpen(false);
      if (onStaffUpdated) onStaffUpdated();
    } catch (err: any) {
      setFormError(err.message || 'Error saving staff');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteStaffClick = (id: string, name: string) => {
    if (doctors.length <= 1) {
      setErrorMessage(t.cannotDeleteLastStaff);
      return;
    }
    setDeletingStaff({ id, name });
  };

  const handleConfirmDelete = async () => {
    if (!deletingStaff) return;
    const { id } = deletingStaff;

    try {
      const res = await fetch(`/api/doctors/${id}`, { method: 'DELETE' });
      if (!res.ok) {
        const errorData = await res.json();
        setErrorMessage(errorData.error || 'Failed to delete');
        return;
      }
      setDeletingStaff(null);
      if (onStaffUpdated) onStaffUpdated();
    } catch (err: any) {
      console.error('Error deleting staff', err);
      setErrorMessage(err.message || 'Error deleting staff');
    }
  };

  const handleToggleOnCall = async (id: string) => {
    try {
      await fetch(`/api/doctors/${id}/toggle-oncall`, { method: 'PUT' });
      if (onStaffUpdated) onStaffUpdated();
    } catch (err) {
      console.error('Error toggling oncall status', err);
    }
  };

  // Filter staff list
  const filteredDoctors = doctors.filter((doc) => {
    const matchSearch =
      doc.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      doc.department.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (doc.role && doc.role.toLowerCase().includes(searchTerm.toLowerCase())) ||
      doc.phone.includes(searchTerm);

    const matchDept = departmentFilter === 'ALL' || doc.department === departmentFilter;

    let matchStatus = true;
    if (statusFilter === 'ON_CALL') matchStatus = doc.isOnCall;
    else if (statusFilter === 'BACKUP') matchStatus = doc.isBackup;
    else if (statusFilter === 'OFF_DUTY') matchStatus = !doc.isOnCall && !doc.isBackup;

    return matchSearch && matchDept && matchStatus;
  });

  const onCallCount = doctors.filter((d) => d.isOnCall).length;
  const backupCount = doctors.filter((d) => d.isBackup).length;

  const isDark = theme === 'dark';

  return (
    <div className="space-y-6">
      {/* Top Banner / Header */}
      <div
        className={`p-6 rounded-2xl border shadow-lg flex flex-col md:flex-row items-start md:items-center justify-between gap-4 ${
          isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'
        }`}
      >
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-blue-600/20 text-blue-500 flex items-center justify-center font-bold">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <h2 className={`text-xl font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>{t.adminTitle}</h2>
              <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{t.adminSubtitle}</p>
            </div>
          </div>
        </div>

        {/* Quick Stats & Add Button */}
        <div className="flex items-center gap-3 flex-wrap">
          <div
            className={`px-3 py-1.5 rounded-xl border text-xs font-semibold flex items-center gap-2 ${
              isDark ? 'bg-slate-950 border-slate-800 text-slate-300' : 'bg-slate-50 border-slate-200 text-slate-700'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>
              {language === 'vi' ? 'Trực chính: ' : 'On-Call: '}
              <strong className="text-emerald-500">{onCallCount}</strong>
            </span>
            <span className="text-slate-400">•</span>
            <span>
              {language === 'vi' ? 'Dự phòng: ' : 'Backup: '}
              <strong className="text-amber-500">{backupCount}</strong>
            </span>
          </div>

          <button
            onClick={openAddModal}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-md shadow-blue-900/30 cursor-pointer"
          >
            <UserPlus className="w-4 h-4" />
            <span>{t.btnAddStaff}</span>
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div
        className={`p-4 rounded-2xl border flex flex-col md:flex-row items-center justify-between gap-3 ${
          isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'
        }`}
      >
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder={language === 'vi' ? 'Tìm theo tên, chức vụ, hotline...' : 'Search staff by name, role, phone...'}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className={`w-full rounded-xl pl-9 pr-4 py-2 text-xs focus:outline-none focus:border-blue-500 border ${
              isDark ? 'bg-slate-950 border-slate-800 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'
            }`}
          />
        </div>

        <div className="flex items-center gap-2 w-full md:w-auto overflow-x-auto no-scrollbar">
          {/* Department Filter */}
          <select
            value={departmentFilter}
            onChange={(e) => setDepartmentFilter(e.target.value)}
            className={`rounded-xl px-3 py-2 text-xs font-semibold focus:outline-none border cursor-pointer ${
              isDark ? 'bg-slate-950 border-slate-800 text-slate-300' : 'bg-slate-50 border-slate-300 text-slate-700'
            }`}
          >
            <option value="ALL">{language === 'vi' ? 'Tất cả khoa phòng' : 'All Departments'}</option>
            {departments.map((dept) => (
              <option key={dept} value={dept}>
                {dept}
              </option>
            ))}
          </select>

          {/* Status Filter */}
          <div
            className={`flex items-center p-1 rounded-xl border ${
              isDark ? 'bg-slate-950 border-slate-800' : 'bg-slate-50 border-slate-200'
            }`}
          >
            {(['ALL', 'ON_CALL', 'BACKUP'] as const).map((st) => (
              <button
                key={st}
                onClick={() => setStatusFilter(st)}
                className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all whitespace-nowrap ${
                  statusFilter === st
                    ? 'bg-blue-600 text-white shadow-sm'
                    : isDark
                    ? 'text-slate-400 hover:text-white'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {st === 'ALL'
                  ? language === 'vi'
                    ? 'Tất cả'
                    : 'All'
                  : st === 'ON_CALL'
                  ? t.staffOnCallStatus
                  : t.staffBackupStatus}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Staff Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredDoctors.map((staff) => {
          const isOnCall = staff.isOnCall;
          const isBackup = staff.isBackup;

          return (
            <div
              key={staff.id}
              className={`p-5 rounded-2xl border transition-all shadow-sm hover:shadow-md flex flex-col justify-between ${
                isDark
                  ? isOnCall
                    ? 'bg-slate-900/90 border-blue-600/40 ring-1 ring-blue-600/20'
                    : 'bg-slate-900 border-slate-800'
                  : isOnCall
                  ? 'bg-blue-50/50 border-blue-200 ring-1 ring-blue-300/30'
                  : 'bg-white border-slate-200'
              }`}
            >
              <div>
                {/* Header with status badge */}
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-11 h-11 rounded-2xl flex items-center justify-center font-black text-sm ${
                        isOnCall
                          ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                          : isBackup
                          ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                          : isDark
                          ? 'bg-slate-800 text-slate-400'
                          : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      {staff.name
                        .split(' ')
                        .filter(Boolean)
                        .slice(-1)[0]?.[0] || 'BS'}
                    </div>
                    <div>
                      <h3 className={`font-bold text-sm leading-tight ${isDark ? 'text-white' : 'text-slate-900'}`}>
                        {staff.name}
                      </h3>
                      <div className="text-[11px] text-blue-500 font-semibold mt-0.5">
                        {staff.role || (language === 'vi' ? 'Bác sĩ điều trị' : 'Clinical Doctor')}
                      </div>
                    </div>
                  </div>

                  <span
                    className={`text-[10px] px-2.5 py-0.5 rounded-full font-extrabold tracking-wide uppercase border ${
                      isOnCall
                        ? 'bg-emerald-950/80 text-emerald-300 border-emerald-700/50 animate-pulse'
                        : isBackup
                        ? 'bg-amber-950/80 text-amber-300 border-amber-700/50'
                        : isDark
                        ? 'bg-slate-800 text-slate-400 border-slate-700'
                        : 'bg-slate-100 text-slate-500 border-slate-200'
                    }`}
                  >
                    {isOnCall ? t.staffOnCallStatus : isBackup ? t.staffBackupStatus : t.staffOffDutyStatus}
                  </span>
                </div>

                {/* Details info */}
                <div className={`mt-4 space-y-2 text-xs ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
                  <div className="flex items-center gap-2">
                    <Building className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span className="truncate">{staff.department}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Phone className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    <span className="font-mono font-bold text-emerald-500">{staff.phone}</span>
                  </div>
                  {staff.email && (
                    <div className="flex items-center gap-2">
                      <Mail className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span className="truncate text-slate-400">{staff.email}</span>
                    </div>
                  )}
                  <div className="flex items-center gap-2">
                    <Clock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span>{staff.shift || 'Ca 24h'}</span>
                  </div>
                </div>
              </div>

              {/* Actions Footer */}
              <div
                className={`mt-5 pt-3 border-t flex items-center justify-between gap-2 ${
                  isDark ? 'border-slate-800/80' : 'border-slate-100'
                }`}
              >
                <button
                  onClick={() => handleToggleOnCall(staff.id)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors flex items-center gap-1 cursor-pointer border ${
                    isOnCall
                      ? isDark
                        ? 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700'
                        : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-200'
                      : 'bg-emerald-600 hover:bg-emerald-500 text-white border-emerald-600'
                  }`}
                  title="Chuyển trạng thái trực ca"
                >
                  <UserCheck className="w-3.5 h-3.5" />
                  <span>{isOnCall ? (language === 'vi' ? 'Hạ Ca Trực' : 'Set Off-Duty') : language === 'vi' ? 'Bật Trực Chính' : 'Set On-Call'}</span>
                </button>

                <div className="flex items-center gap-1">
                  <button
                    onClick={() => openEditModal(staff)}
                    className={`p-2 rounded-xl text-xs transition-colors cursor-pointer ${
                      isDark
                        ? 'text-slate-400 hover:text-white hover:bg-slate-800'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                    }`}
                    title={t.btnEditStaff}
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>

                  <button
                    onClick={() => handleDeleteStaffClick(staff.id, staff.name)}
                    className="p-2 rounded-xl text-xs text-rose-400 hover:text-rose-300 hover:bg-rose-950/40 transition-colors cursor-pointer"
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

      {filteredDoctors.length === 0 && (
        <div
          className={`p-12 text-center rounded-2xl border ${
            isDark ? 'bg-slate-900 border-slate-800 text-slate-400' : 'bg-white border-slate-200 text-slate-500'
          }`}
        >
          <Users className="w-10 h-10 mx-auto text-slate-500 mb-3" />
          <p className="font-semibold text-sm">
            {language === 'vi' ? 'Không tìm thấy nhân viên nào phù hợp bộ lọc' : 'No medical staff matching filter'}
          </p>
        </div>
      )}

      {/* Add / Edit Staff Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div
            className={`w-full max-w-lg rounded-2xl border p-6 shadow-2xl relative animate-in fade-in duration-200 ${
              isDark ? 'bg-slate-900 border-slate-800 text-white' : 'bg-white border-slate-200 text-slate-900'
            }`}
          >
            {/* Header */}
            <div className={`flex items-center justify-between border-b pb-4 ${isDark ? 'border-slate-800' : 'border-slate-200'}`}>
              <div className="flex items-center gap-2">
                <Shield className="w-5 h-5 text-blue-500" />
                <h3 className="text-base font-bold">
                  {editingStaff ? t.editStaffModalTitle : t.addStaffModalTitle}
                </h3>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className={`p-1.5 rounded-xl hover:bg-slate-800/40 ${isDark ? 'text-slate-400 hover:text-white' : 'text-slate-500 hover:text-slate-800'}`}
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {formError && (
              <div className="mt-3 p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-rose-400 text-xs font-semibold">
                {formError}
              </div>
            )}

            {/* Form */}
            <form onSubmit={handleSaveStaff} className="space-y-3.5 mt-4 text-xs">
              <div>
                <label className={`block font-semibold mb-1 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                  {t.staffName} <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  placeholder="VD: BS. CKII. Trần Đức Nam"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className={`w-full rounded-xl px-3.5 py-2.5 text-xs font-semibold focus:outline-none focus:border-blue-500 border ${
                    isDark ? 'bg-slate-950 border-slate-700 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'
                  }`}
                  required
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className={`block font-semibold mb-1 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                    {t.staffRole}
                  </label>
                  <input
                    type="text"
                    placeholder="VD: Trưởng Ca Trực Cấp Cứu"
                    value={formData.role}
                    onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                    className={`w-full rounded-xl px-3.5 py-2.5 text-xs font-semibold focus:outline-none focus:border-blue-500 border ${
                      isDark ? 'bg-slate-950 border-slate-700 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'
                    }`}
                  />
                </div>

                <div>
                  <label className={`block font-semibold mb-1 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                    {t.staffPhone} <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="text"
                    placeholder="VD: 0912-345-678"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className={`w-full rounded-xl px-3.5 py-2.5 text-xs font-mono font-bold focus:outline-none focus:border-blue-500 border ${
                      isDark ? 'bg-slate-950 border-slate-700 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'
                    }`}
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className={`block font-semibold mb-1 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                    {t.staffDepartment}
                  </label>
                  <select
                    value={formData.department}
                    onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                    className={`w-full rounded-xl px-3.5 py-2.5 text-xs font-semibold focus:outline-none focus:border-blue-500 border cursor-pointer ${
                      isDark ? 'bg-slate-950 border-slate-700 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'
                    }`}
                  >
                    {departments.map((d) => (
                      <option key={d} value={d} className={isDark ? 'bg-slate-900 text-white' : 'bg-white text-slate-900'}>
                        {d}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className={`block font-semibold mb-1 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                    {t.staffShift}
                  </label>
                  <select
                    value={formData.shift}
                    onChange={(e) => setFormData({ ...formData, shift: e.target.value })}
                    className={`w-full rounded-xl px-3.5 py-2.5 text-xs font-semibold focus:outline-none focus:border-blue-500 border cursor-pointer ${
                      isDark ? 'bg-slate-950 border-slate-700 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'
                    }`}
                  >
                    {shifts.map((sh) => (
                      <option key={sh} value={sh} className={isDark ? 'bg-slate-900 text-white' : 'bg-white text-slate-900'}>
                        {sh}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className={`block font-semibold mb-1 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                  {t.staffEmail}
                </label>
                <input
                  type="email"
                  placeholder="VD: bacsi.nam@hospital.vn"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className={`w-full rounded-xl px-3.5 py-2.5 text-xs font-semibold focus:outline-none focus:border-blue-500 border ${
                    isDark ? 'bg-slate-950 border-slate-700 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'
                  }`}
                />
              </div>

              {/* Duty Assignment Radio */}
              <div>
                <label className={`block font-semibold mb-1.5 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                  {t.staffStatus}
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, dutyType: 'ON_CALL' })}
                    className={`p-2.5 rounded-xl border text-center font-bold transition-all flex flex-col items-center justify-center gap-1 ${
                      formData.dutyType === 'ON_CALL'
                        ? 'bg-emerald-600/20 border-emerald-500 text-emerald-400 ring-1 ring-emerald-500/40'
                        : isDark
                        ? 'bg-slate-950 border-slate-800 text-slate-400'
                        : 'bg-slate-50 border-slate-200 text-slate-600'
                    }`}
                  >
                    <span className="w-2 h-2 rounded-full bg-emerald-400" />
                    <span>{t.staffOnCallStatus}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, dutyType: 'BACKUP' })}
                    className={`p-2.5 rounded-xl border text-center font-bold transition-all flex flex-col items-center justify-center gap-1 ${
                      formData.dutyType === 'BACKUP'
                        ? 'bg-amber-600/20 border-amber-500 text-amber-400 ring-1 ring-amber-500/40'
                        : isDark
                        ? 'bg-slate-950 border-slate-800 text-slate-400'
                        : 'bg-slate-50 border-slate-200 text-slate-600'
                    }`}
                  >
                    <span className="w-2 h-2 rounded-full bg-amber-400" />
                    <span>{t.staffBackupStatus}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, dutyType: 'OFF_DUTY' })}
                    className={`p-2.5 rounded-xl border text-center font-bold transition-all flex flex-col items-center justify-center gap-1 ${
                      formData.dutyType === 'OFF_DUTY'
                        ? 'bg-slate-800 border-slate-600 text-white'
                        : isDark
                        ? 'bg-slate-950 border-slate-800 text-slate-400'
                        : 'bg-slate-50 border-slate-200 text-slate-600'
                    }`}
                  >
                    <span className="w-2 h-2 rounded-full bg-slate-500" />
                    <span>{t.staffOffDutyStatus}</span>
                  </button>
                </div>
              </div>

              {/* Actions */}
              <div className={`pt-4 border-t flex items-center justify-end gap-2 ${isDark ? 'border-slate-800' : 'border-slate-200'}`}>
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className={`px-4 py-2.5 rounded-xl font-bold ${
                    isDark ? 'bg-slate-800 hover:bg-slate-700 text-slate-300' : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                  }`}
                >
                  {t.btnCancel}
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-bold flex items-center gap-1.5 shadow-md shadow-blue-900/30 cursor-pointer"
                >
                  <Check className="w-4 h-4" />
                  <span>{isSubmitting ? t.btnSavingStaff : t.btnSaveStaff}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal (iFrame safe, replaces window.confirm) */}
      {deletingStaff && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-150">
          <div
            className={`w-full max-w-md rounded-2xl border p-6 shadow-2xl space-y-4 ${
              isDark ? 'bg-slate-900 border-slate-800 text-white' : 'bg-white border-slate-200 text-slate-900'
            }`}
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-rose-500/20 text-rose-500 flex items-center justify-center font-bold">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-rose-500">
                  {language === 'vi' ? 'Xác nhận xóa nhân sự' : 'Confirm Staff Removal'}
                </h3>
                <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                  {language === 'vi' ? 'Hành động không thể hoàn tác' : 'This action cannot be undone'}
                </p>
              </div>
            </div>

            <p className={`text-xs leading-relaxed ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
              {language === 'vi'
                ? `Bạn có chắc chắn muốn xóa nhân viên "${deletingStaff.name}" khỏi danh sách nhân sự trực cấp cứu không?`
                : `Are you sure you want to remove "${deletingStaff.name}" from the active medical duty roster?`}
            </p>

            <div className={`pt-3 border-t flex items-center justify-end gap-2 ${isDark ? 'border-slate-800' : 'border-slate-200'}`}>
              <button
                type="button"
                onClick={() => setDeletingStaff(null)}
                className={`px-4 py-2 rounded-xl text-xs font-bold ${
                  isDark ? 'bg-slate-800 hover:bg-slate-700 text-slate-300' : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                }`}
              >
                {t.btnCancel}
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-md shadow-rose-950/50 cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>{language === 'vi' ? 'Xóa Nhân Viên' : 'Delete Staff'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Error Alert Modal (iFrame safe, replaces window.alert) */}
      {errorMessage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-150">
          <div
            className={`w-full max-w-md rounded-2xl border p-6 shadow-2xl space-y-4 ${
              isDark ? 'bg-slate-900 border-slate-800 text-white' : 'bg-white border-slate-200 text-slate-900'
            }`}
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-500 flex items-center justify-center font-bold">
                <Shield className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-amber-500">
                  {language === 'vi' ? 'Thông báo hệ thống' : 'System Notice'}
                </h3>
              </div>
            </div>

            <p className={`text-xs leading-relaxed ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
              {errorMessage}
            </p>

            <div className={`pt-3 border-t flex items-center justify-end ${isDark ? 'border-slate-800' : 'border-slate-200'}`}>
              <button
                type="button"
                onClick={() => setErrorMessage(null)}
                className="px-5 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold cursor-pointer"
              >
                {language === 'vi' ? 'Đã hiểu' : 'OK'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
