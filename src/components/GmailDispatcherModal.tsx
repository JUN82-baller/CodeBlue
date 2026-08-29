import React, { useState, useEffect } from 'react';
import {
  Mail,
  Send,
  AlertTriangle,
  CheckCircle2,
  X,
  RefreshCw,
  Trash2,
  ExternalLink,
  ShieldAlert,
  UserCheck,
  FileText,
  Clock,
  Sparkles,
  Inbox,
  LogOut,
  ChevronRight,
  Stethoscope,
} from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import { useTheme } from '../context/ThemeContext';
import { Alert, Doctor, MedicationSchedule } from '../types';
import {
  signInWithGoogleSheets,
  signOutGoogle,
  initGoogleAuth,
  getCurrentGoogleUser,
} from '../services/googleAuth';
import {
  sendGmailMessage,
  sendEmergencyRedAlertEmail,
  sendMedicationPrescriptionEmail,
  listRecentGmailMessages,
  trashGmailMessage,
  GmailMessageItem,
} from '../services/gmail';
import { User } from 'firebase/auth';

interface GmailDispatcherModalProps {
  isOpen: boolean;
  onClose: () => void;
  doctors: Doctor[];
  alerts: Alert[];
  medications: MedicationSchedule[];
  prefilledAlert?: Alert | null;
  prefilledDoctor?: Doctor | null;
}

export const GmailDispatcherModal: React.FC<GmailDispatcherModalProps> = ({
  isOpen,
  onClose,
  doctors,
  alerts,
  medications,
  prefilledAlert,
  prefilledDoctor,
}) => {
  const { language } = useLanguage();
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  const [activeTab, setActiveTab] = useState<'compose' | 'history' | 'templates'>('compose');
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);

  // Form Fields
  const [recipientEmail, setRecipientEmail] = useState('');
  const [selectedDoctorId, setSelectedDoctorId] = useState<string>('');
  const [selectedAlertId, setSelectedAlertId] = useState<string>('');
  const [subject, setSubject] = useState('');
  const [bodyText, setBodyText] = useState('');
  const [dispatchType, setDispatchType] = useState<'emergency' | 'prescription' | 'custom'>('emergency');

  // History state
  const [emailHistory, setEmailHistory] = useState<GmailMessageItem[]>([]);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Delete Confirmation Modal State
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  // Initialize Auth
  useEffect(() => {
    if (!isOpen) return;

    const unsubscribe = initGoogleAuth(
      (user, token) => {
        setCurrentUser(user);
        setAccessToken(token);
      },
      () => {
        const u = getCurrentGoogleUser();
        setCurrentUser(u);
      }
    );

    return () => unsubscribe();
  }, [isOpen]);

  // Handle Prefills
  useEffect(() => {
    if (prefilledDoctor) {
      setSelectedDoctorId(prefilledDoctor.id);
      if (prefilledDoctor.email) {
        setRecipientEmail(prefilledDoctor.email);
      }
    }
    if (prefilledAlert) {
      setSelectedAlertId(prefilledAlert.id);
      setDispatchType('emergency');
      setSubject(`🚨 [BÁO ĐỘNG ĐỎ CẤP CỨU] PHÒNG ${prefilledAlert.roomNumber} - BN ${prefilledAlert.patientName}`);
      setBodyText(
        `Kính gửi Bác sĩ trực,\n\nPhát hiện bất thường sinh tồn nghiêm trọng tại Phòng ${prefilledAlert.roomNumber}:\n- Bệnh nhân: ${prefilledAlert.patientName}\n- Mức độ: ${prefilledAlert.severity}\n- Nhịp tim: ${prefilledAlert.heartRate} BPM\n- Lý do: ${prefilledAlert.reason}\n\nĐề nghị tiếp cận buồng bệnh và kích hoạt quy trình cấp cứu ngay lập tức!`
      );
    }
  }, [prefilledDoctor, prefilledAlert, isOpen]);

  // Update recipient email when doctor selection changes
  const handleDoctorChange = (docId: string) => {
    setSelectedDoctorId(docId);
    const doc = doctors.find((d) => d.id === docId);
    if (doc?.email) {
      setRecipientEmail(doc.email);
    }
  };

  // Switch templates
  const applyTemplate = (type: 'emergency' | 'prescription' | 'custom') => {
    setDispatchType(type);
    if (type === 'emergency') {
      const pendingAlert = alerts.find((a) => a.id === selectedAlertId) || alerts[0];
      if (pendingAlert) {
        setSubject(`🚨 [BÁO ĐỘNG ĐỎ ICU] Phòng ${pendingAlert.roomNumber} - ${pendingAlert.patientName}`);
        setBodyText(
          `BÁO ĐỘNG ĐỎ CẤP CỨU LÂM SÀNG\n\nPhòng bệnh: ${pendingAlert.roomNumber}\nBệnh nhân: ${pendingAlert.patientName}\nNhịp tim: ${pendingAlert.heartRate} BPM\nSpO2: ${pendingAlert.spO2 || 90}%\nLý do: ${pendingAlert.reason}\n\nYêu cầu kíp trực xử lý khẩn cấp!`
        );
      } else {
        setSubject(`🚨 [LỆNH ĐIỀU ĐỘNG CẤP CỨU ICU] Bệnh Viện`);
        setBodyText('Thông báo điều động kíp trực cấp cứu khẩn cấp tại Khoa ICU.');
      }
    } else if (type === 'prescription') {
      setSubject(`💊 [BÀN GIAO Y LỆNH THUỐC] Khoa Hồi Sức Cấp Cứu ICU`);
      setBodyText(
        `Danh sách tổng hợp y lệnh thuốc cần thực hiện trong ca trực.\nVui lòng kiểm tra 5 đúng trước khi cho bệnh nhân dùng.`
      );
    } else {
      setSubject(`[THÔNG BÁO NỘI BỘ ICU] Khoa Hồi Sức Cấp Cứu`);
      setBodyText('');
    }
  };

  // Google Login
  const handleGoogleSignIn = async () => {
    setIsAuthenticating(true);
    setStatusMessage(null);
    try {
      const res = await signInWithGoogleSheets();
      if (res) {
        setCurrentUser(res.user);
        setAccessToken(res.accessToken);
        setStatusMessage({
          type: 'success',
          text: language === 'vi' ? 'Đã kết nối tài khoản Gmail thành công!' : 'Connected to Gmail successfully!',
        });
      }
    } catch (err: any) {
      setStatusMessage({
        type: 'error',
        text: err.message || 'Đăng nhập Google thất bại.',
      });
    } finally {
      setIsAuthenticating(false);
    }
  };

  // Google Logout
  const handleLogout = async () => {
    await signOutGoogle();
    setCurrentUser(null);
    setAccessToken(null);
    setEmailHistory([]);
  };

  // Send Email Handler
  const handleSendEmail = async () => {
    if (!recipientEmail || !recipientEmail.includes('@')) {
      setStatusMessage({
        type: 'error',
        text: language === 'vi' ? 'Vui lòng nhập địa chỉ email hợp lệ.' : 'Please enter a valid email address.',
      });
      return;
    }

    if (!subject.trim()) {
      setStatusMessage({
        type: 'error',
        text: language === 'vi' ? 'Vui lòng nhập tiêu đề email.' : 'Please enter an email subject.',
      });
      return;
    }

    if (!accessToken) {
      setStatusMessage({
        type: 'error',
        text: language === 'vi' ? 'Vui lòng đăng nhập Gmail trước khi gửi.' : 'Please sign in with Gmail first.',
      });
      return;
    }

    setIsSending(true);
    setStatusMessage(null);

    try {
      const selectedAlert = alerts.find((a) => a.id === selectedAlertId);
      const selectedDoc = doctors.find((d) => d.id === selectedDoctorId);

      if (dispatchType === 'emergency' && selectedAlert) {
        await sendEmergencyRedAlertEmail(
          accessToken,
          recipientEmail,
          selectedAlert,
          selectedDoc?.name || 'Bác sĩ trực'
        );
      } else if (dispatchType === 'prescription') {
        await sendMedicationPrescriptionEmail(
          accessToken,
          recipientEmail,
          selectedAlert?.patientName || 'Bệnh nhân ICU',
          selectedAlert?.roomNumber || '101',
          medications,
          selectedDoc?.name || 'Bác sĩ điều trị'
        );
      } else {
        const htmlBody = `
          <div style="font-family: Arial, sans-serif; padding: 20px; color: #1e293b;">
            <h2 style="color: #0f766e;">🏥 HỆ THỐNG Y TẾ ICU - THÔNG ĐIỆP LÂM SÀNG</h2>
            <div style="background: #f8fafc; border-left: 4px solid #0f766e; padding: 16px; margin: 16px 0; border-radius: 6px; white-space: pre-wrap; font-size: 14px; line-height: 1.6;">${bodyText}</div>
            <p style="font-size: 12px; color: #64748b;">Được gửi từ Cổng Điều Hành Y Tế Khẩn Cấp ICU</p>
          </div>
        `;
        await sendGmailMessage(accessToken, {
          to: recipientEmail,
          subject,
          bodyHtml: htmlBody,
          bodyText,
        });
      }

      setStatusMessage({
        type: 'success',
        text: language === 'vi' ? `Đã gửi email khẩn cấp đến ${recipientEmail} thành công!` : `Emergency email dispatched to ${recipientEmail}!`,
      });

      // Reset text
      setBodyText('');
      // Reload history if on history
      loadHistory();
    } catch (err: any) {
      setStatusMessage({
        type: 'error',
        text: err.message || 'Lỗi khi gửi Gmail.',
      });
    } finally {
      setIsSending(false);
    }
  };

  // Load History
  const loadHistory = async () => {
    if (!accessToken) return;
    setIsLoadingHistory(true);
    try {
      const msgs = await listRecentGmailMessages(accessToken, 'subject:ICU OR subject:CẤP CỨU OR subject:BÁO ĐỘNG OR to:' + recipientEmail, 15);
      setEmailHistory(msgs);
    } catch (err: any) {
      console.warn('Failed to load Gmail history:', err);
    } finally {
      setIsLoadingHistory(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'history' && accessToken) {
      loadHistory();
    }
  }, [activeTab, accessToken]);

  // Trash Message with Confirmation
  const executeTrashMessage = async (msgId: string) => {
    if (!accessToken) return;
    try {
      await trashGmailMessage(accessToken, msgId);
      setEmailHistory((prev) => prev.filter((m) => m.id !== msgId));
      setDeleteConfirmId(null);
      setStatusMessage({
        type: 'success',
        text: language === 'vi' ? 'Đã chuyển email vào thùng rác Gmail.' : 'Moved message to Gmail Trash.',
      });
    } catch (err: any) {
      setStatusMessage({
        type: 'error',
        text: err.message || 'Lỗi khi xóa thư.',
      });
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fade-in">
      <div
        className={`relative w-full max-w-3xl rounded-2xl shadow-2xl border flex flex-col max-h-[90vh] overflow-hidden ${
          isDark ? 'bg-slate-900 border-slate-700 text-slate-100' : 'bg-white border-slate-200 text-slate-900'
        }`}
      >
        {/* Header */}
        <div className="p-5 border-b border-slate-700/60 flex items-center justify-between bg-gradient-to-r from-red-700/20 via-rose-600/10 to-teal-700/10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-red-600 flex items-center justify-center text-white shadow-lg shadow-red-900/30">
              <Mail className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-black tracking-tight flex items-center gap-2">
                <span>{language === 'vi' ? 'Điều Phối Khẩn Cấp Qua Gmail' : 'Gmail Emergency Dispatcher'}</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-red-500/20 text-red-400 font-bold border border-red-500/30">
                  Google Workspace
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                {language === 'vi'
                  ? 'Gửi thông báo báo động đỏ, lệnh cấp cứu & y lệnh thuốc trực tiếp vào hòm thư Bác sĩ'
                  : 'Dispatch Code Red alerts, emergency calls, and medication schedules via Gmail'}
              </p>
            </div>
          </div>
          <button
            id="btn-close-gmail-modal"
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* User Auth Banner */}
        <div
          className={`px-5 py-3 border-b flex flex-wrap items-center justify-between gap-3 text-xs ${
            isDark ? 'bg-slate-950 border-slate-800' : 'bg-slate-50 border-slate-200'
          }`}
        >
          {currentUser && accessToken ? (
            <div className="flex items-center gap-2.5">
              <div className="w-6 h-6 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold text-[11px] border border-emerald-500/40">
                <UserCheck className="w-3.5 h-3.5" />
              </div>
              <div>
                <span className="text-slate-400">{language === 'vi' ? 'Đã kết nối:' : 'Connected:'} </span>
                <span className="font-bold text-emerald-400">{currentUser.email}</span>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-amber-400 font-medium">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{language === 'vi' ? 'Chưa kết nối Gmail. Đăng nhập để gửi thông báo khẩn cấp:' : 'Gmail not connected. Sign in to dispatch emails:'}</span>
            </div>
          )}

          <div className="flex items-center gap-2">
            {currentUser && accessToken ? (
              <button
                id="btn-gmail-logout"
                onClick={handleLogout}
                className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold flex items-center gap-1 cursor-pointer transition-colors"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>{language === 'vi' ? 'Đổi tài khoản' : 'Sign out'}</span>
              </button>
            ) : (
              <button
                id="btn-gmail-google-signin"
                onClick={handleGoogleSignIn}
                disabled={isAuthenticating}
                className="px-3.5 py-1.5 rounded-xl bg-white hover:bg-slate-100 active:scale-95 text-slate-900 font-bold text-xs shadow transition-all flex items-center gap-2 cursor-pointer border border-slate-300"
              >
                {/* Official Google G Logo */}
                <svg className="w-3.5 h-3.5" viewBox="0 0 48 48">
                  <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
                  <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
                  <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
                  <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
                </svg>
                <span>{isAuthenticating ? 'Đang kết nối...' : 'Sign in with Google'}</span>
              </button>
            )}
          </div>
        </div>

        {/* Tabs Bar */}
        <div className="flex border-b border-slate-800 px-5 pt-2 gap-2 bg-slate-950/40">
          <button
            id="tab-gmail-compose"
            onClick={() => setActiveTab('compose')}
            className={`px-4 py-2 text-xs font-bold rounded-t-xl transition-colors flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'compose'
                ? 'bg-slate-800 text-white border-t-2 border-red-500'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Send className="w-3.5 h-3.5" />
            <span>{language === 'vi' ? 'Soạn Lệnh Gửi' : 'Compose Dispatch'}</span>
          </button>
          <button
            id="tab-gmail-history"
            onClick={() => setActiveTab('history')}
            className={`px-4 py-2 text-xs font-bold rounded-t-xl transition-colors flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'history'
                ? 'bg-slate-800 text-white border-t-2 border-red-500'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Inbox className="w-3.5 h-3.5" />
            <span>{language === 'vi' ? 'Nhật Ký Email Đã Gửi' : 'Dispatched Mail Log'}</span>
          </button>
        </div>

        {/* Status Notification */}
        {statusMessage && (
          <div
            className={`mx-5 mt-3 p-3 rounded-xl flex items-center justify-between gap-2 text-xs font-medium ${
              statusMessage.type === 'success'
                ? 'bg-emerald-950/60 border border-emerald-700/60 text-emerald-300'
                : 'bg-red-950/60 border border-red-700/60 text-red-300'
            }`}
          >
            <div className="flex items-center gap-2">
              {statusMessage.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              ) : (
                <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
              )}
              <span>{statusMessage.text}</span>
            </div>
            <button onClick={() => setStatusMessage(null)} className="text-slate-400 hover:text-white">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Main Content Area */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {activeTab === 'compose' && (
            <div className="space-y-4">
              {/* Type Selection */}
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                  {language === 'vi' ? 'Loại Lệnh Điều Động / Mẫu Nội Dung:' : 'Dispatch Template:'}
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => applyTemplate('emergency')}
                    className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                      dispatchType === 'emergency'
                        ? 'bg-red-950/50 border-red-500 text-white shadow-md'
                        : isDark
                        ? 'bg-slate-800/60 border-slate-700 text-slate-300 hover:bg-slate-800'
                        : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    <div className="flex items-center gap-2 font-bold text-xs text-red-400">
                      <ShieldAlert className="w-4 h-4" />
                      <span>{language === 'vi' ? 'Báo Động Đỏ ICU' : 'Code Red Emergency'}</span>
                    </div>
                    <p className="text-[10px] text-slate-400 mt-1">
                      {language === 'vi' ? 'Gửi định dạng báo động khẩn cấp chuyên sâu' : 'Urgent clinical alert formatting'}
                    </p>
                  </button>

                  <button
                    type="button"
                    onClick={() => applyTemplate('prescription')}
                    className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                      dispatchType === 'prescription'
                        ? 'bg-teal-950/50 border-teal-500 text-white shadow-md'
                        : isDark
                        ? 'bg-slate-800/60 border-slate-700 text-slate-300 hover:bg-slate-800'
                        : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    <div className="flex items-center gap-2 font-bold text-xs text-teal-400">
                      <FileText className="w-4 h-4" />
                      <span>{language === 'vi' ? 'Y Lệnh Dùng Thuốc' : 'Prescription Plan'}</span>
                    </div>
                    <p className="text-[10px] text-slate-400 mt-1">
                      {language === 'vi' ? 'Bảng tổng hợp y lệnh thuốc cho kíp trực' : 'Medication schedule summary table'}
                    </p>
                  </button>

                  <button
                    type="button"
                    onClick={() => applyTemplate('custom')}
                    className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                      dispatchType === 'custom'
                        ? 'bg-blue-950/50 border-blue-500 text-white shadow-md'
                        : isDark
                        ? 'bg-slate-800/60 border-slate-700 text-slate-300 hover:bg-slate-800'
                        : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    <div className="flex items-center gap-2 font-bold text-xs text-blue-400">
                      <Sparkles className="w-4 h-4" />
                      <span>{language === 'vi' ? 'Tùy Chỉnh Tự Do' : 'Custom Message'}</span>
                    </div>
                    <p className="text-[10px] text-slate-400 mt-1">
                      {language === 'vi' ? 'Viết nội dung tùy ý gửi nội bộ' : 'Freely compose custom clinical note'}
                    </p>
                  </button>
                </div>
              </div>

              {/* Target Doctor & Email Selector */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">
                    {language === 'vi' ? 'Bác sĩ / Nhân sự nhận:' : 'Select Doctor / Staff:'}
                  </label>
                  <select
                    id="select-gmail-doctor"
                    value={selectedDoctorId}
                    onChange={(e) => handleDoctorChange(e.target.value)}
                    className={`w-full px-3 py-2 rounded-xl border text-xs font-medium outline-none transition-colors ${
                      isDark
                        ? 'bg-slate-800 border-slate-700 text-white focus:border-red-500'
                        : 'bg-white border-slate-300 text-slate-900 focus:border-red-500'
                    }`}
                  >
                    <option value="">{language === 'vi' ? '-- Chọn Bác sĩ trong danh bạ --' : '-- Choose Doctor --'}</option>
                    {doctors.map((doc) => (
                      <option key={doc.id} value={doc.id}>
                        {doc.name} - {doc.role} {doc.isOnCall ? '👑 (Đang trực)' : ''}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">
                    {language === 'vi' ? 'Địa chỉ Gmail nhận (*):' : 'Recipient Gmail (*):'}
                  </label>
                  <input
                    id="input-gmail-recipient"
                    type="email"
                    placeholder="doctor.icu@hospital.vn hoặc gmail.com"
                    value={recipientEmail}
                    onChange={(e) => setRecipientEmail(e.target.value)}
                    className={`w-full px-3 py-2 rounded-xl border text-xs font-medium outline-none transition-colors ${
                      isDark
                        ? 'bg-slate-800 border-slate-700 text-white focus:border-red-500'
                        : 'bg-white border-slate-300 text-slate-900 focus:border-red-500'
                    }`}
                  />
                </div>
              </div>

              {/* Alert selector if emergency */}
              {dispatchType === 'emergency' && alerts.length > 0 && (
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">
                    {language === 'vi' ? 'Chọn ca cảnh báo cần đính kèm:' : 'Attach Clinical Alert Case:'}
                  </label>
                  <select
                    id="select-gmail-alert"
                    value={selectedAlertId}
                    onChange={(e) => {
                      setSelectedAlertId(e.target.value);
                      const alt = alerts.find((a) => a.id === e.target.value);
                      if (alt) {
                        setSubject(`🚨 [BÁO ĐỘNG ĐỎ ICU] Phòng ${alt.roomNumber} - ${alt.patientName}`);
                      }
                    }}
                    className={`w-full px-3 py-2 rounded-xl border text-xs font-medium outline-none transition-colors ${
                      isDark
                        ? 'bg-slate-800 border-slate-700 text-white focus:border-red-500'
                        : 'bg-white border-slate-300 text-slate-900 focus:border-red-500'
                    }`}
                  >
                    {alerts.map((a) => (
                      <option key={a.id} value={a.id}>
                        Phòng {a.roomNumber} | {a.patientName} - {a.reason} ({a.heartRate} BPM) [{a.status}]
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Subject */}
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">
                  {language === 'vi' ? 'Tiêu đề Email (*):' : 'Email Subject (*):'}
                </label>
                <input
                  id="input-gmail-subject"
                  type="text"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  className={`w-full px-3 py-2 rounded-xl border text-xs font-semibold outline-none transition-colors ${
                    isDark
                      ? 'bg-slate-800 border-slate-700 text-white focus:border-red-500'
                      : 'bg-white border-slate-300 text-slate-900 focus:border-red-500'
                  }`}
                />
              </div>

              {/* Message Body */}
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">
                  {language === 'vi' ? 'Nội dung chi tiết / Ghi chú lâm sàng:' : 'Message Content / Clinical Notes:'}
                </label>
                <textarea
                  id="textarea-gmail-body"
                  rows={4}
                  value={bodyText}
                  onChange={(e) => setBodyText(e.target.value)}
                  placeholder={language === 'vi' ? 'Nhập nội dung thông điệp gửi Bác sĩ...' : 'Enter message content for the doctor...'}
                  className={`w-full px-3 py-2 rounded-xl border text-xs font-normal outline-none transition-colors ${
                    isDark
                      ? 'bg-slate-800 border-slate-700 text-white focus:border-red-500'
                      : 'bg-white border-slate-300 text-slate-900 focus:border-red-500'
                  }`}
                />
              </div>
            </div>
          )}

          {activeTab === 'history' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-400 font-medium">
                  {language === 'vi' ? 'Danh sách email điều phối gần đây từ tài khoản Gmail:' : 'Recent dispatched messages from your Gmail:'}
                </span>
                <button
                  id="btn-gmail-refresh-history"
                  onClick={loadHistory}
                  disabled={isLoadingHistory || !accessToken}
                  className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold flex items-center gap-1 cursor-pointer transition-colors"
                >
                  <RefreshCw className={`w-3 h-3 ${isLoadingHistory ? 'animate-spin' : ''}`} />
                  <span>{language === 'vi' ? 'Làm mới' : 'Refresh'}</span>
                </button>
              </div>

              {isLoadingHistory ? (
                <div className="py-12 text-center text-xs text-slate-400 flex flex-col items-center gap-2">
                  <RefreshCw className="w-5 h-5 animate-spin text-red-500" />
                  <span>{language === 'vi' ? 'Đang truy vấn Gmail API...' : 'Loading from Gmail API...'}</span>
                </div>
              ) : emailHistory.length === 0 ? (
                <div className="py-12 text-center text-xs text-slate-400 bg-slate-950/40 rounded-xl border border-slate-800">
                  <Inbox className="w-8 h-8 mx-auto text-slate-600 mb-2" />
                  <p>{language === 'vi' ? 'Chưa có email điều phối ICU nào được tìm thấy.' : 'No ICU dispatch emails found.'}</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {emailHistory.map((item) => (
                    <div
                      key={item.id}
                      className={`p-3.5 rounded-xl border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                        item.isImportant
                          ? 'bg-red-950/30 border-red-700/60'
                          : isDark
                          ? 'bg-slate-950 border-slate-800'
                          : 'bg-slate-50 border-slate-200'
                      }`}
                    >
                      <div className="space-y-1 flex-1">
                        <div className="flex items-center gap-2">
                          {item.isImportant && (
                            <span className="px-1.5 py-0.5 rounded bg-red-500/20 text-red-400 font-bold text-[9px] border border-red-500/30">
                              KHẨN CẤP
                            </span>
                          )}
                          <h4 className="font-bold text-xs text-slate-100">{item.subject}</h4>
                        </div>
                        <p className="text-[11px] text-slate-400 line-clamp-1">{item.snippet}</p>
                        <div className="flex items-center gap-3 text-[10px] text-slate-500">
                          <span>{language === 'vi' ? 'Gửi đến:' : 'To:'} <strong>{item.to || 'Bác sĩ'}</strong></span>
                          <span>•</span>
                          <span>{item.date ? new Date(item.date).toLocaleString('vi-VN') : ''}</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          id={`btn-trash-mail-${item.id}`}
                          onClick={() => setDeleteConfirmId(item.id)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-red-400 hover:bg-slate-800 transition-colors cursor-pointer"
                          title={language === 'vi' ? 'Xóa vào thùng rác' : 'Trash email'}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-4 border-t border-slate-800 flex items-center justify-between bg-slate-950/60">
          <div className="text-[11px] text-slate-400">
            {dispatchType === 'emergency' ? (
              <span className="text-red-400 font-bold flex items-center gap-1">
                <ShieldAlert className="w-3.5 h-3.5" />
                {language === 'vi' ? 'Email mẫu Báo Động Đỏ tự động chèn chỉ số sinh tồn' : 'Emergency template injects real-time vitals'}
              </span>
            ) : (
              <span>{language === 'vi' ? 'Chuẩn giao thức bảo mật Google Workspace' : 'Google Workspace secure protocol'}</span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              id="btn-cancel-gmail-modal"
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition-colors cursor-pointer"
            >
              {language === 'vi' ? 'Đóng' : 'Close'}
            </button>

            {activeTab === 'compose' && (
              <button
                id="btn-submit-gmail-dispatch"
                onClick={handleSendEmail}
                disabled={isSending || !accessToken}
                className={`px-5 py-2 rounded-xl font-bold text-xs shadow-lg transition-all flex items-center gap-2 cursor-pointer ${
                  !accessToken
                    ? 'bg-slate-700 text-slate-400 cursor-not-allowed'
                    : 'bg-red-600 hover:bg-red-500 text-white shadow-red-950/50 active:scale-95'
                }`}
              >
                <Send className={`w-3.5 h-3.5 ${isSending ? 'animate-bounce' : ''}`} />
                <span>{isSending ? (language === 'vi' ? 'Đang gửi...' : 'Sending...') : (language === 'vi' ? 'Phát Lệnh Gửi Email' : 'Dispatch Email')}</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Mandatory User Confirmation Dialog for Destructive Trash Operation */}
      {deleteConfirmId && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/80">
          <div className={`max-w-md w-full p-6 rounded-2xl border shadow-2xl ${isDark ? 'bg-slate-900 border-slate-700 text-white' : 'bg-white border-slate-200 text-slate-900'}`}>
            <div className="flex items-center gap-3 text-red-500 mb-3">
              <Trash2 className="w-6 h-6" />
              <h3 className="font-bold text-base">{language === 'vi' ? 'Xác nhận xóa thư vào thùng rác?' : 'Trash this email?'}</h3>
            </div>
            <p className="text-xs text-slate-300 mb-5 leading-relaxed">
              {language === 'vi'
                ? 'Bạn có chắc chắn muốn chuyển email điều phối này vào Thùng rác (Trash) trên tài khoản Gmail của bạn không? Hành động này có thể thay đổi dữ liệu hộp thư của bạn.'
                : 'Are you sure you want to move this dispatch email to your Gmail Trash? This action will mutate your mailbox data.'}
            </p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setDeleteConfirmId(null)}
                className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 hover:bg-slate-700 text-xs font-bold transition-colors cursor-pointer"
              >
                {language === 'vi' ? 'Hủy' : 'Cancel'}
              </button>
              <button
                onClick={() => executeTrashMessage(deleteConfirmId)}
                className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-bold transition-colors cursor-pointer"
              >
                {language === 'vi' ? 'Đồng ý xóa' : 'Confirm Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
