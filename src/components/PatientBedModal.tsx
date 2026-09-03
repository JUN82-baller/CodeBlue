import React, { useState, useEffect } from 'react';
import {
  X,
  UserPlus,
  Bed,
  Heart,
  Activity,
  AlertTriangle,
  UserCheck,
  Stethoscope,
  Sparkles,
  LogOut,
  FileText,
  Clock,
} from 'lucide-react';
import { Patient, Doctor, WardBedSlot } from '../types';

interface PatientBedModalProps {
  isOpen: boolean;
  onClose: () => void;
  beds: WardBedSlot[];
  patients: Patient[];
  doctors: Doctor[];
  isDark: boolean;
  language: 'vi' | 'en';
  preselectedBed?: { roomNumber: string; bed: string } | null;
  editingPatient?: Patient | null;
  onSavePatient: (patientData: any) => Promise<boolean>;
  onDischargePatient?: (patientId: string) => Promise<boolean>;
}

export const PatientBedModal: React.FC<PatientBedModalProps> = ({
  isOpen,
  onClose,
  beds,
  patients,
  doctors,
  isDark,
  language,
  preselectedBed,
  editingPatient,
  onSavePatient,
  onDischargePatient,
}) => {
  const [name, setName] = useState('');
  const [age, setAge] = useState<number | string>(55);
  const [gender, setGender] = useState<'Nam' | 'Nữ' | 'Khác'>('Nam');
  const [roomNumber, setRoomNumber] = useState('P.101');
  const [bed, setBed] = useState('G01');
  const [diagnosis, setDiagnosis] = useState('');
  const [primaryDoctorId, setPrimaryDoctorId] = useState('');
  const [notes, setNotes] = useState('');
  const [initialHeartRate, setInitialHeartRate] = useState<number | string>(76);
  const [initialSpO2, setInitialSpO2] = useState<number | string>(98);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [showDischargeConfirm, setShowDischargeConfirm] = useState(false);

  // Common clinical diagnosis templates for fast prefilling
  const templates = [
    {
      label: language === 'vi' ? 'Hội chứng vành cấp / NSTEMI' : 'Acute Coronary Syndrome / NSTEMI',
      diagnosis: 'Hội chứng vành cấp không ST chênh lên (NSTEMI) / Tăng huyết áp độ II',
      hr: 88,
      spo2: 96,
      notes: 'Bệnh nhân đau ngực sau xương ức giờ thứ 3. Cần làm Troponin I và theo dõi monitor liên tục.',
    },
    {
      label: language === 'vi' ? 'Suy hô hấp cấp / Đợt cấp COPD' : 'Acute Respiratory Failure / COPD',
      diagnosis: 'Đợt cấp bệnh phổi tắc nghẽn mạn tính (AE-COPD) / Suy hô hấp độ II',
      hr: 104,
      spo2: 91,
      notes: 'Thở oxy kính 3L/phút. Cần khí dung giãn phế quản và đo khí máu động mạch.',
    },
    {
      label: language === 'vi' ? 'Hậu phẫu bắc cầu mạch vành' : 'Post-CABG Heart Surgery',
      diagnosis: 'Hậu phẫu bắc cầu động mạch vành (CABG) ngày thứ 1 / Hồi sức tim',
      hr: 78,
      spo2: 99,
      notes: 'Dẫn lưu màng ngoài tim và trung thất ra ít. Kiểm tra điện giải đồ và áp lực tĩnh mạch trung tâm CVP.',
    },
    {
      label: language === 'vi' ? 'Rối loạn nhịp thất / Ngất' : 'Ventricular Arrhythmia / Syncope',
      diagnosis: 'Cơn nhịp nhanh kịch phát trên thất (SVT) / Rung nhĩ cơn',
      hr: 135,
      spo2: 97,
      notes: 'Bệnh nhân có tiền sử ngất, đang cài đặt telemetery và chuẩn bị sốc điện chuyển nhịp nếu huyết động không ổn định.',
    },
  ];

  // Preset standard rooms & beds
  const standardRooms = ['P.101', 'P.102', 'P.201', 'P.203', 'P.305', 'P.308'];
  const standardBeds = ['G01', 'G02', 'G03', 'G04'];

  useEffect(() => {
    if (!isOpen) return;

    setErrorMsg('');
    setShowDischargeConfirm(false);

    if (editingPatient) {
      setName(editingPatient.name || '');
      setAge(editingPatient.age || 50);
      setGender(editingPatient.gender || 'Nam');
      setRoomNumber(editingPatient.roomNumber || 'P.101');
      setBed(editingPatient.bed || 'G01');
      setDiagnosis(editingPatient.diagnosis || '');
      setPrimaryDoctorId(editingPatient.primaryDoctorId || doctors[0]?.id || 'DOC01');
      setNotes(editingPatient.notes || '');
      setInitialHeartRate(editingPatient.initialHeartRate || 75);
      setInitialSpO2(editingPatient.initialSpO2 || 98);
    } else if (preselectedBed) {
      setName('');
      setAge(52);
      setGender('Nam');
      setRoomNumber(preselectedBed.roomNumber);
      setBed(preselectedBed.bed);
      setDiagnosis('Hồi sức cấp cứu và theo dõi huyết động');
      setPrimaryDoctorId(doctors[0]?.id || 'DOC01');
      setNotes('');
      setInitialHeartRate(78);
      setInitialSpO2(98);
    } else {
      // Find the first available bed
      const firstAvailable = beds.find((b) => b.status === 'available');
      if (firstAvailable) {
        setRoomNumber(firstAvailable.roomNumber);
        setBed(firstAvailable.bed);
      } else {
        setRoomNumber('P.101');
        setBed('G01');
      }
      setName('');
      setAge(50);
      setGender('Nam');
      setDiagnosis('Theo dõi hồi sức tích cực (ICU)');
      setPrimaryDoctorId(doctors[0]?.id || 'DOC01');
      setNotes('');
      setInitialHeartRate(76);
      setInitialSpO2(98);
    }
  }, [isOpen, editingPatient, preselectedBed, beds, doctors]);

  if (!isOpen) return null;

  // Check if chosen bed is occupied by someone else
  const currentOccupant = patients.find(
    (p) =>
      p.roomNumber.trim().toLowerCase() === roomNumber.trim().toLowerCase() &&
      p.bed.trim().toLowerCase() === bed.trim().toLowerCase() &&
      (!editingPatient || p.id !== editingPatient.id)
  );

  const applyTemplate = (tmpl: (typeof templates)[0]) => {
    setDiagnosis(tmpl.diagnosis);
    setInitialHeartRate(tmpl.hr);
    setInitialSpO2(tmpl.spo2);
    setNotes(tmpl.notes);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    if (!name.trim()) {
      setErrorMsg(language === 'vi' ? 'Vui lòng nhập họ và tên bệnh nhân' : 'Please enter patient name');
      return;
    }

    if (currentOccupant) {
      setErrorMsg(
        language === 'vi'
          ? `Giường ${bed} tại phòng ${roomNumber} hiện đang có bệnh nhân "${currentOccupant.name}" nằm. Vui lòng chọn giường khác!`
          : `Bed ${bed} in room ${roomNumber} is currently occupied by "${currentOccupant.name}". Please pick another bed!`
      );
      return;
    }

    try {
      setLoading(true);
      const payload: any = {
        name: name.trim(),
        roomNumber: roomNumber.trim(),
        bed: bed.trim(),
        age: Number(age) || 50,
        gender,
        diagnosis: diagnosis.trim() || 'Theo dõi hồi sức',
        primaryDoctorId: primaryDoctorId || doctors[0]?.id || 'DOC01',
        notes: notes.trim(),
        initialHeartRate: Number(initialHeartRate) || 75,
        initialSpO2: Number(initialSpO2) || 98,
      };

      if (editingPatient) {
        payload.id = editingPatient.id;
      }

      const success = await onSavePatient(payload);
      if (success) {
        onClose();
      }
    } catch (err: any) {
      setErrorMsg(err?.message || 'Có lỗi xảy ra khi lưu thông tin bệnh nhân');
    } finally {
      setLoading(false);
    }
  };

  const handleDischarge = async () => {
    if (!editingPatient || !onDischargePatient) return;
    try {
      setLoading(true);
      const success = await onDischargePatient(editingPatient.id);
      if (success) {
        onClose();
      }
    } catch (err: any) {
      setErrorMsg(err?.message || 'Có lỗi xảy ra khi xuất viện');
    } finally {
      setLoading(false);
    }
  };

  const isEditing = !!editingPatient;

  return (
    <div
      id="patient-bed-modal-overlay"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fadeIn"
      onClick={onClose}
    >
      <div
        id="patient-bed-modal-dialog"
        className={`relative w-full max-w-2xl max-h-[92vh] flex flex-col rounded-2xl shadow-2xl border transition-all ${
          isDark ? 'bg-slate-900 border-slate-700 text-white' : 'bg-white border-slate-200 text-slate-900'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          className={`flex items-center justify-between px-6 py-4 border-b ${
            isDark ? 'border-slate-800 bg-slate-900/60' : 'border-slate-100 bg-slate-50'
          }`}
        >
          <div className="flex items-center gap-3">
            <div
              className={`p-2.5 rounded-xl border ${
                isEditing
                  ? 'bg-blue-500/10 text-blue-500 border-blue-500/20'
                  : 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20'
              }`}
            >
              {isEditing ? <UserCheck className="w-5 h-5" /> : <UserPlus className="w-5 h-5" />}
            </div>
            <div>
              <h2 className="text-lg font-bold">
                {isEditing
                  ? language === 'vi'
                    ? `Cập Nhật Bệnh Nhân: ${editingPatient.name}`
                    : `Edit Patient: ${editingPatient.name}`
                  : language === 'vi'
                  ? 'Tiếp Nhận Bệnh Nhân Vào Giường'
                  : 'Admit Patient to Bed'}
              </h2>
              <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                {language === 'vi'
                  ? 'Phân bổ giường bệnh, chẩn đoán ban đầu và kết nối monitor sinh tồn ICU'
                  : 'Assign hospital bed, clinical diagnosis and connect ICU telemetry monitor'}
              </p>
            </div>
          </div>

          <button
            id="btn-close-patient-bed-modal"
            onClick={onClose}
            className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
              isDark ? 'hover:bg-slate-800 text-slate-400' : 'hover:bg-slate-100 text-slate-500'
            }`}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-5">
          {errorMsg && (
            <div className="p-3.5 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-500 text-xs font-medium flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 flex-shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Quick Clinical Diagnosis Templates */}
          {!isEditing && (
            <div
              className={`p-3 rounded-xl border ${
                isDark ? 'bg-slate-950/60 border-slate-800' : 'bg-slate-50 border-slate-200'
              }`}
            >
              <div className="flex items-center gap-1.5 text-xs font-semibold mb-2 text-indigo-400">
                <Sparkles className="w-3.5 h-3.5" />
                <span>
                  {language === 'vi' ? 'Mẫu chẩn đoán nhanh (Tự điền chỉ số):' : 'Quick Clinical Templates:'}
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {templates.map((tmpl, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => applyTemplate(tmpl)}
                    className={`text-left p-2 rounded-lg border text-xs transition-colors cursor-pointer flex items-center justify-between ${
                      isDark
                        ? 'bg-slate-900/80 hover:bg-indigo-950/40 border-slate-700 hover:border-indigo-500/40 text-slate-300'
                        : 'bg-white hover:bg-indigo-50 border-slate-200 hover:border-indigo-300 text-slate-700'
                    }`}
                  >
                    <span className="font-medium truncate mr-1">{tmpl.label}</span>
                    <span className="text-[10px] text-indigo-500 font-mono flex-shrink-0">{tmpl.hr} bpm</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Bed & Room Selection Section */}
          <div
            className={`p-4 rounded-xl border ${
              isDark ? 'bg-slate-950/80 border-slate-800' : 'bg-slate-50 border-slate-200'
            }`}
          >
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-blue-500">
                <Bed className="w-4 h-4" />
                <span>{language === 'vi' ? 'Vị Trí Buồng & Giường Điều Trị' : 'Ward Room & Bed Assignment'}</span>
              </div>

              {/* Status Badge of the selected bed */}
              {currentOccupant ? (
                <span className="text-xs px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-400 border border-rose-500/30 flex items-center gap-1 font-semibold">
                  <AlertTriangle className="w-3 h-3" />
                  {language === 'vi' ? `Đã có: ${currentOccupant.name}` : `Occupied by: ${currentOccupant.name}`}
                </span>
              ) : (
                <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center gap-1 font-semibold">
                  <UserCheck className="w-3 h-3" />
                  {language === 'vi' ? 'Giường còn trống' : 'Bed Available'}
                </span>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Room select */}
              <div>
                <label className={`block text-xs font-semibold mb-1 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                  {language === 'vi' ? 'Phòng bệnh' : 'Room Number'} *
                </label>
                <div className="flex gap-2">
                  <select
                    id="select-patient-room"
                    value={roomNumber}
                    onChange={(e) => setRoomNumber(e.target.value)}
                    className={`flex-1 px-3 py-2 text-xs rounded-lg border font-mono font-bold focus:outline-none focus:border-blue-500 ${
                      isDark ? 'bg-slate-900 border-slate-700 text-white' : 'bg-white border-slate-300 text-slate-900'
                    }`}
                  >
                    {standardRooms.map((r) => (
                      <option key={r} value={r}>
                        Phòng {r}
                      </option>
                    ))}
                  </select>
                  <input
                    type="text"
                    placeholder="Tùy biến"
                    value={roomNumber}
                    onChange={(e) => setRoomNumber(e.target.value)}
                    className={`w-24 px-2 py-2 text-xs rounded-lg border font-mono focus:outline-none focus:border-blue-500 ${
                      isDark ? 'bg-slate-900 border-slate-700 text-white' : 'bg-white border-slate-300 text-slate-900'
                    }`}
                  />
                </div>
              </div>

              {/* Bed select */}
              <div>
                <label className={`block text-xs font-semibold mb-1 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                  {language === 'vi' ? 'Giường bệnh' : 'Bed Code'} *
                </label>
                <div className="flex gap-2">
                  <select
                    id="select-patient-bed"
                    value={bed}
                    onChange={(e) => setBed(e.target.value)}
                    className={`flex-1 px-3 py-2 text-xs rounded-lg border font-mono font-bold focus:outline-none focus:border-blue-500 ${
                      isDark ? 'bg-slate-900 border-slate-700 text-white' : 'bg-white border-slate-300 text-slate-900'
                    }`}
                  >
                    {standardBeds.map((b) => (
                      <option key={b} value={b}>
                        Giường {b}
                      </option>
                    ))}
                  </select>
                  <input
                    type="text"
                    placeholder="Tùy biến"
                    value={bed}
                    onChange={(e) => setBed(e.target.value)}
                    className={`w-24 px-2 py-2 text-xs rounded-lg border font-mono focus:outline-none focus:border-blue-500 ${
                      isDark ? 'bg-slate-900 border-slate-700 text-white' : 'bg-white border-slate-300 text-slate-900'
                    }`}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Patient Personal Details */}
          <div className="space-y-3">
            <div className="text-xs font-bold uppercase tracking-wider text-slate-400">
              {language === 'vi' ? 'Thông Tin Hành Chính' : 'Administrative Information'}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="sm:col-span-2">
                <label className={`block text-xs font-semibold mb-1 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                  {language === 'vi' ? 'Họ và tên bệnh nhân' : 'Patient Full Name'} *
                </label>
                <input
                  id="input-patient-name"
                  type="text"
                  required
                  placeholder={language === 'vi' ? 'Ví dụ: Nguyễn Văn Hoàng' : 'e.g., John Doe'}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className={`w-full px-3 py-2 text-xs rounded-lg border focus:outline-none focus:border-blue-500 ${
                    isDark ? 'bg-slate-900 border-slate-700 text-white' : 'bg-white border-slate-300 text-slate-900'
                  }`}
                />
              </div>

              <div>
                <label className={`block text-xs font-semibold mb-1 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                  {language === 'vi' ? 'Tuổi' : 'Age'}
                </label>
                <input
                  id="input-patient-age"
                  type="number"
                  min="1"
                  max="120"
                  value={age}
                  onChange={(e) => setAge(e.target.value)}
                  className={`w-full px-3 py-2 text-xs rounded-lg border focus:outline-none focus:border-blue-500 ${
                    isDark ? 'bg-slate-900 border-slate-700 text-white' : 'bg-white border-slate-300 text-slate-900'
                  }`}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className={`block text-xs font-semibold mb-1 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                  {language === 'vi' ? 'Giới tính' : 'Gender'}
                </label>
                <div className="flex gap-2">
                  {(['Nam', 'Nữ', 'Khác'] as const).map((g) => (
                    <button
                      key={g}
                      type="button"
                      onClick={() => setGender(g)}
                      className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-semibold border transition-colors cursor-pointer ${
                        gender === g
                          ? 'bg-blue-600 text-white border-blue-500'
                          : isDark
                          ? 'bg-slate-900 border-slate-700 text-slate-300 hover:bg-slate-800'
                          : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-100'
                      }`}
                    >
                      {g}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className={`block text-xs font-semibold mb-1 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                  {language === 'vi' ? 'Bác sĩ phụ trách' : 'Primary Doctor'}
                </label>
                <select
                  id="select-patient-doctor"
                  value={primaryDoctorId}
                  onChange={(e) => setPrimaryDoctorId(e.target.value)}
                  className={`w-full px-3 py-2 text-xs rounded-lg border focus:outline-none focus:border-blue-500 ${
                    isDark ? 'bg-slate-900 border-slate-700 text-white' : 'bg-white border-slate-300 text-slate-900'
                  }`}
                >
                  {doctors.map((doc) => (
                    <option key={doc.id} value={doc.id}>
                      {doc.name} ({doc.department || doc.specialty || 'ICU'})
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Clinical Diagnosis & Initial Vitals */}
          <div className="space-y-3">
            <div className="text-xs font-bold uppercase tracking-wider text-slate-400">
              {language === 'vi' ? 'Chẩn Đoán Lâm Sàng & Chỉ Số Đầu Vào' : 'Clinical Diagnosis & Baseline Vitals'}
            </div>

            <div>
              <label className={`block text-xs font-semibold mb-1 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                {language === 'vi' ? 'Chẩn đoán xác định / Lý do vào ICU' : 'Diagnosis / Reason for ICU'} *
              </label>
              <textarea
                id="input-patient-diagnosis"
                required
                rows={2}
                placeholder={
                  language === 'vi'
                    ? 'Ví dụ: Hội chứng vành cấp / Suy tim cấp Killip II...'
                    : 'e.g. Acute Coronary Syndrome / Acute Heart Failure...'
                }
                value={diagnosis}
                onChange={(e) => setDiagnosis(e.target.value)}
                className={`w-full px-3 py-2 text-xs rounded-lg border focus:outline-none focus:border-blue-500 ${
                  isDark ? 'bg-slate-900 border-slate-700 text-white' : 'bg-white border-slate-300 text-slate-900'
                }`}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className={`block text-xs font-semibold mb-1 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                  {language === 'vi' ? 'Nhịp tim ban đầu (BPM)' : 'Initial Heart Rate (BPM)'}
                </label>
                <div className="relative">
                  <input
                    id="input-patient-hr"
                    type="number"
                    min="30"
                    max="220"
                    value={initialHeartRate}
                    onChange={(e) => setInitialHeartRate(e.target.value)}
                    className={`w-full pl-8 pr-3 py-2 text-xs rounded-lg border font-mono font-bold focus:outline-none focus:border-blue-500 ${
                      isDark ? 'bg-slate-900 border-slate-700 text-white' : 'bg-white border-slate-300 text-slate-900'
                    }`}
                  />
                  <Heart className="w-4 h-4 text-rose-500 absolute left-2.5 top-2.5" />
                </div>
              </div>

              <div>
                <label className={`block text-xs font-semibold mb-1 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                  {language === 'vi' ? 'Độ bão hòa oxy SpO2 (%)' : 'Initial SpO2 (%)'}
                </label>
                <div className="relative">
                  <input
                    id="input-patient-spo2"
                    type="number"
                    min="50"
                    max="100"
                    value={initialSpO2}
                    onChange={(e) => setInitialSpO2(e.target.value)}
                    className={`w-full pl-8 pr-3 py-2 text-xs rounded-lg border font-mono font-bold focus:outline-none focus:border-blue-500 ${
                      isDark ? 'bg-slate-900 border-slate-700 text-white' : 'bg-white border-slate-300 text-slate-900'
                    }`}
                  />
                  <Activity className="w-4 h-4 text-cyan-400 absolute left-2.5 top-2.5" />
                </div>
              </div>
            </div>

            <div>
              <label className={`block text-xs font-semibold mb-1 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                {language === 'vi' ? 'Ghi chú điều trị / Tiền sử dị ứng' : 'Treatment Notes / Allergies'}
              </label>
              <textarea
                id="input-patient-notes"
                rows={2}
                placeholder={
                  language === 'vi'
                    ? 'Ví dụ: Dị ứng Penicillin. Đang dùng kháng đông tiêm dưới da...'
                    : 'e.g. Penicillin allergy. On anticoagulants...'
                }
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className={`w-full px-3 py-2 text-xs rounded-lg border focus:outline-none focus:border-blue-500 ${
                  isDark ? 'bg-slate-900 border-slate-700 text-white' : 'bg-white border-slate-300 text-slate-900'
                }`}
              />
            </div>
          </div>

          {/* Discharge Patient Section (Only if editing) */}
          {isEditing && (
            <div
              className={`p-3.5 rounded-xl border ${
                isDark ? 'bg-rose-950/20 border-rose-900/30' : 'bg-rose-50/50 border-rose-200'
              }`}
            >
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-bold text-rose-500 flex items-center gap-1.5">
                    <LogOut className="w-4 h-4" />
                    <span>{language === 'vi' ? 'Xuất viện & Giải phóng giường' : 'Discharge & Free Bed'}</span>
                  </h4>
                  <p className={`text-[11px] mt-0.5 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                    {language === 'vi'
                      ? 'Chuyển bệnh nhân ra khỏi danh sách theo dõi ICU và cập nhật giường sang trạng thái TRỐNG.'
                      : 'Remove patient from active ICU telemetry and mark bed as AVAILABLE.'}
                  </p>
                </div>

                {!showDischargeConfirm ? (
                  <button
                    type="button"
                    onClick={() => setShowDischargeConfirm(true)}
                    className="px-3 py-1.5 text-xs font-bold bg-rose-600 hover:bg-rose-500 text-white rounded-lg transition-colors cursor-pointer"
                  >
                    {language === 'vi' ? 'Xuất viện' : 'Discharge'}
                  </button>
                ) : (
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setShowDischargeConfirm(false)}
                      className="px-2.5 py-1 text-xs rounded-md border border-slate-600 text-slate-300 hover:bg-slate-800"
                    >
                      {language === 'vi' ? 'Hủy' : 'Cancel'}
                    </button>
                    <button
                      type="button"
                      onClick={handleDischarge}
                      disabled={loading}
                      className="px-3 py-1 text-xs font-bold bg-rose-600 hover:bg-rose-500 text-white rounded-md transition-colors cursor-pointer"
                    >
                      {language === 'vi' ? 'Xác nhận' : 'Confirm'}
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Footer Actions */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800/40">
            <button
              type="button"
              onClick={onClose}
              className={`px-4 py-2 text-xs font-semibold rounded-xl transition-colors cursor-pointer ${
                isDark ? 'text-slate-400 hover:text-white' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {language === 'vi' ? 'Đóng' : 'Close'}
            </button>

            <button
              id="btn-submit-patient-bed"
              type="submit"
              disabled={loading || !!currentOccupant}
              className={`px-5 py-2 text-xs font-bold rounded-xl text-white transition-all shadow-md flex items-center gap-2 cursor-pointer disabled:opacity-50 ${
                isEditing
                  ? 'bg-blue-600 hover:bg-blue-500 shadow-blue-500/20'
                  : 'bg-emerald-600 hover:bg-emerald-500 shadow-emerald-500/20'
              }`}
            >
              <Bed className="w-4 h-4" />
              <span>
                {loading
                  ? language === 'vi'
                    ? 'Đang xử lý...'
                    : 'Saving...'
                  : isEditing
                  ? language === 'vi'
                    ? 'Cập Nhật Hồ Sơ'
                    : 'Save Changes'
                  : language === 'vi'
                  ? 'Tiếp Nhận Vào Giường Này'
                  : 'Admit to This Bed'}
              </span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
