import React, { useState, useEffect } from 'react';
import {
  FileSpreadsheet,
  X,
  Plus,
  RefreshCw,
  ExternalLink,
  CheckCircle2,
  AlertTriangle,
  Download,
  Upload,
  Calendar,
  Users,
  Pill,
  ShieldAlert,
  LogOut,
  FolderOpen,
  Check,
  Search,
  Sparkles,
} from 'lucide-react';
import { User } from 'firebase/auth';
import { Doctor, Alert, MedicationSchedule, StaffShiftSchedule } from '../types';
import {
  initGoogleAuth,
  signInWithGoogleSheets,
  signOutGoogle,
  getGoogleAccessToken,
  getCurrentGoogleUser,
} from '../services/googleAuth';
import {
  listDriveSpreadsheets,
  createHospitalMasterSpreadsheet,
  getSpreadsheetDetails,
  exportStaffToSheet,
  exportRosterToSheet,
  exportMedicationsToSheet,
  exportAlertsToSheet,
  importStaffFromSheet,
  syncAllHospitalDataToSheet,
  DriveSpreadsheetFile,
  SpreadsheetMetadata,
} from '../services/googleSheets';
import { useLanguage } from '../context/LanguageContext';
import { useTheme } from '../context/ThemeContext';

interface GoogleSheetsSyncModalProps {
  isOpen: boolean;
  onClose: () => void;
  doctors: Doctor[];
  alerts: Alert[];
  medications: MedicationSchedule[];
  schedules?: StaffShiftSchedule[];
  onStaffImported?: (newDoctors: Doctor[]) => void;
  onToastMessage?: (msg: string, type?: 'success' | 'warning' | 'error') => void;
}

export const GoogleSheetsSyncModal: React.FC<GoogleSheetsSyncModalProps> = ({
  isOpen,
  onClose,
  doctors,
  alerts,
  medications,
  schedules = [],
  onStaffImported,
  onToastMessage,
}) => {
  const { language } = useLanguage();
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  // Auth State
  const [currentUser, setCurrentUser] = useState<User | null>(getCurrentGoogleUser());
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  // Sheets & Drive State
  const [driveFiles, setDriveFiles] = useState<DriveSpreadsheetFile[]>([]);
  const [isLoadingFiles, setIsLoadingFiles] = useState(false);
  const [activeSpreadsheet, setActiveSpreadsheet] = useState<SpreadsheetMetadata | null>(null);
  const [selectedSpreadsheetId, setSelectedSpreadsheetId] = useState<string>('');
  const [searchDriveQuery, setSearchDriveQuery] = useState('');

  // Action states
  const [syncingAction, setSyncingAction] = useState<string | null>(null);
  const [isCreatingNew, setIsCreatingNew] = useState(false);
  const [newSheetTitle, setNewSheetTitle] = useState(
    'Hệ Thống Y Tế ICU - Dữ Liệu Bệnh Viện & Lịch Trực'
  );

  // Confirmation Modal for Destructive / Mutating Actions
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    title: string;
    description: string;
    confirmLabel: string;
    onConfirm: () => Promise<void>;
  } | null>(null);

  // Initialize Auth listener on open
  useEffect(() => {
    if (!isOpen) return;

    const unsubscribe = initGoogleAuth(
      (user, token) => {
        setCurrentUser(user);
        setAccessToken(token);
      },
      () => {
        setCurrentUser(null);
        setAccessToken(null);
      }
    );

    // Check if token already present
    getGoogleAccessToken().then((tok) => {
      if (tok) {
        setAccessToken(tok);
        setCurrentUser(getCurrentGoogleUser());
      }
    });

    return () => unsubscribe();
  }, [isOpen]);

  // Load drive spreadsheets when authenticated
  useEffect(() => {
    if (accessToken && isOpen) {
      loadDriveFiles(accessToken);
    }
  }, [accessToken, isOpen]);

  const loadDriveFiles = async (token: string) => {
    setIsLoadingFiles(true);
    try {
      const files = await listDriveSpreadsheets(token);
      setDriveFiles(files);
      if (files.length > 0 && !selectedSpreadsheetId) {
        setSelectedSpreadsheetId(files[0].id);
        fetchSpreadsheetDetails(token, files[0].id);
      }
    } catch (err: any) {
      console.warn('Failed to load drive files:', err);
    } finally {
      setIsLoadingFiles(false);
    }
  };

  const fetchSpreadsheetDetails = async (token: string, sheetId: string) => {
    try {
      const details = await getSpreadsheetDetails(token, sheetId);
      setActiveSpreadsheet(details);
    } catch (err) {
      console.warn('Could not fetch sheet details:', err);
    }
  };

  const handleLogin = async () => {
    setIsLoggingIn(true);
    try {
      const result = await signInWithGoogleSheets();
      if (result) {
        setCurrentUser(result.user);
        setAccessToken(result.accessToken);
        onToastMessage?.('Đã kết nối tài khoản Google thành công!', 'success');
        loadDriveFiles(result.accessToken);
      }
    } catch (err: any) {
      console.error('Login failed:', err);
      onToastMessage?.(err.message || 'Đăng nhập Google thất bại.', 'error');
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleSignOut = async () => {
    await signOutGoogle();
    setCurrentUser(null);
    setAccessToken(null);
    setActiveSpreadsheet(null);
    setDriveFiles([]);
    onToastMessage?.('Đã ngắt kết nối tài khoản Google.', 'success');
  };

  const handleSelectSpreadsheet = async (sheetId: string) => {
    setSelectedSpreadsheetId(sheetId);
    if (!accessToken) return;
    try {
      const details = await getSpreadsheetDetails(accessToken, sheetId);
      setActiveSpreadsheet(details);
      onToastMessage?.(`Đã chọn bảng tính: ${details.title}`, 'success');
    } catch (err: any) {
      onToastMessage?.('Không thể tải thông tin bảng tính này.', 'error');
    }
  };

  const handleCreateNewSpreadsheet = async () => {
    if (!accessToken) return;
    setIsCreatingNew(true);
    try {
      const newSheet = await createHospitalMasterSpreadsheet(accessToken, newSheetTitle);
      setActiveSpreadsheet(newSheet);
      setSelectedSpreadsheetId(newSheet.spreadsheetId);
      setDriveFiles((prev) => [
        {
          id: newSheet.spreadsheetId,
          name: newSheet.title,
          modifiedTime: new Date().toISOString(),
          webViewLink: newSheet.spreadsheetUrl,
        },
        ...prev,
      ]);
      onToastMessage?.(`Đã tạo mới bảng tính Google Sheets: "${newSheet.title}"`, 'success');
    } catch (err: any) {
      onToastMessage?.(err.message || 'Lỗi tạo bảng tính mới.', 'error');
    } finally {
      setIsCreatingNew(false);
    }
  };

  // Safe Action Trigger with Confirmation Dialog
  const triggerSafeAction = (
    title: string,
    description: string,
    confirmLabel: string,
    actionFn: () => Promise<void>
  ) => {
    setConfirmDialog({
      isOpen: true,
      title,
      description,
      confirmLabel,
      onConfirm: async () => {
        setConfirmDialog(null);
        await actionFn();
      },
    });
  };

  // Sync All Data
  const handleSyncAll = () => {
    if (!accessToken || !selectedSpreadsheetId) return;
    triggerSafeAction(
      'Ghi Đè Toàn Bộ Dữ Liệu Lên Google Sheets',
      `Thao tác này sẽ đồng bộ và cập nhật 4 tab: Danh Sách Cán Bộ (${doctors.length}), Lịch Trực 24/7 (${schedules.length}), Lịch Dùng Thuốc (${medications.length}) và Nhật Ký Cảnh Báo (${alerts.length}) vào bảng tính "${activeSpreadsheet?.title || 'đã chọn'}". Bạn có chắc chắn muốn thực hiện?`,
      'Đồng Ý Đồng Bộ Tất Cả',
      async () => {
        setSyncingAction('all');
        try {
          const res = await syncAllHospitalDataToSheet(accessToken, selectedSpreadsheetId, {
            doctors,
            schedules,
            medications,
            alerts,
          });
          onToastMessage?.(res.message, 'success');
        } catch (err: any) {
          onToastMessage?.(err.message || 'Lỗi đồng bộ dữ liệu.', 'error');
        } finally {
          setSyncingAction(null);
        }
      }
    );
  };

  // Export Staff
  const handleExportStaff = () => {
    if (!accessToken || !selectedSpreadsheetId) return;
    triggerSafeAction(
      'Xuất Danh Sách Cán Bộ Lên Google Sheets',
      `Ghi đè tab "📋 Danh Sách Cán Bộ Y Tế" với ${doctors.length} hồ sơ nhân viên y tế hiện tại. Tiếp tục?`,
      'Ghi Dữ Liệu Nhân Sự',
      async () => {
        setSyncingAction('export-staff');
        try {
          const res = await exportStaffToSheet(accessToken, selectedSpreadsheetId, doctors);
          onToastMessage?.(`Đã xuất thành công ${res.updatedRows} hồ sơ cán bộ lên Google Sheets!`, 'success');
        } catch (err: any) {
          onToastMessage?.(err.message || 'Lỗi xuất nhân sự.', 'error');
        } finally {
          setSyncingAction(null);
        }
      }
    );
  };

  // Export Roster
  const handleExportRoster = () => {
    if (!accessToken || !selectedSpreadsheetId) return;
    triggerSafeAction(
      'Xuất Thời Khóa Biểu Lịch Trực Lên Google Sheets',
      `Ghi đè tab "🗓️ Lịch Trình Ca Trực 24-7" với ${schedules.length} ca trực kíp lâm sàng. Tiếp tục?`,
      'Ghi Thời Khóa Biểu',
      async () => {
        setSyncingAction('export-roster');
        try {
          const res = await exportRosterToSheet(accessToken, selectedSpreadsheetId, schedules);
          onToastMessage?.(`Đã xuất ${res.updatedRows} ca trực lên Google Sheets!`, 'success');
        } catch (err: any) {
          onToastMessage?.(err.message || 'Lỗi xuất lịch trực.', 'error');
        } finally {
          setSyncingAction(null);
        }
      }
    );
  };

  // Export Medications
  const handleExportMedications = () => {
    if (!accessToken || !selectedSpreadsheetId) return;
    triggerSafeAction(
      'Xuất Lịch Cấp Thuốc Lên Google Sheets',
      `Ghi đè tab "💊 Lịch Dùng Thuốc BN" với ${medications.length} y lệnh dùng thuốc. Tiếp tục?`,
      'Ghi Lịch Dùng Thuốc',
      async () => {
        setSyncingAction('export-medications');
        try {
          const res = await exportMedicationsToSheet(accessToken, selectedSpreadsheetId, medications);
          onToastMessage?.(`Đã xuất ${res.updatedRows} y lệnh thuốc lên Google Sheets!`, 'success');
        } catch (err: any) {
          onToastMessage?.(err.message || 'Lỗi xuất lịch thuốc.', 'error');
        } finally {
          setSyncingAction(null);
        }
      }
    );
  };

  // Export Alerts
  const handleExportAlerts = () => {
    if (!accessToken || !selectedSpreadsheetId) return;
    triggerSafeAction(
      'Xuất Nhật Ký Cảnh Báo Lâm Sàng',
      `Lưu trữ ${alerts.length} bản ghi cảnh báo cấp cứu vào tab "🚨 Nhật Ký Cảnh Báo Lâm Sàng". Tiếp tục?`,
      'Lưu Nhật Ký Cảnh Báo',
      async () => {
        setSyncingAction('export-alerts');
        try {
          const res = await exportAlertsToSheet(accessToken, selectedSpreadsheetId, alerts);
          onToastMessage?.(`Đã xuất ${res.updatedRows} bản ghi cảnh báo lên Google Sheets!`, 'success');
        } catch (err: any) {
          onToastMessage?.(err.message || 'Lỗi xuất cảnh báo.', 'error');
        } finally {
          setSyncingAction(null);
        }
      }
    );
  };

  // Import Staff from Sheet
  const handleImportStaff = () => {
    if (!accessToken || !selectedSpreadsheetId) return;
    triggerSafeAction(
      'Nhập Dữ Liệu Nhân Sự Từ Google Sheets',
      `Hệ thống sẽ đọc dữ liệu từ tab "📋 Danh Sách Cán Bộ Y Tế" trong Google Sheets và cập nhật danh sách nhân sự ứng dụng. Bạn có muốn tiếp tục?`,
      'Đồng Ý Nhập Dữ Liệu',
      async () => {
        setSyncingAction('import-staff');
        try {
          const importedDocs = await importStaffFromSheet(accessToken, selectedSpreadsheetId);
          if (onStaffImported) {
            onStaffImported(importedDocs);
          }
          onToastMessage?.(`Đã nhập thành công ${importedDocs.length} cán bộ từ Google Sheets!`, 'success');
        } catch (err: any) {
          onToastMessage?.(err.message || 'Lỗi đọc dữ liệu nhân sự.', 'error');
        } finally {
          setSyncingAction(null);
        }
      }
    );
  };

  if (!isOpen) return null;

  const filteredDriveFiles = driveFiles.filter((f) =>
    f.name.toLowerCase().includes(searchDriveQuery.toLowerCase())
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fadeIn">
      <div
        className={`w-full max-w-4xl max-h-[90vh] rounded-3xl shadow-2xl border flex flex-col overflow-hidden ${
          isDark ? 'bg-slate-900 border-slate-800 text-white' : 'bg-white border-slate-200 text-slate-900'
        }`}
      >
        {/* Modal Header */}
        <div
          className={`p-6 border-b flex items-center justify-between gap-4 ${
            isDark ? 'bg-slate-950/60 border-slate-800' : 'bg-slate-50 border-slate-200'
          }`}
        >
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shadow-sm">
              <FileSpreadsheet className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-black">
                  {language === 'vi' ? 'Đồng Bộ Google Sheets Bệnh Viện' : 'Hospital Google Sheets Sync'}
                </h2>
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                  Google Workspace API
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                {language === 'vi'
                  ? 'Sao lưu, xuất và nhập hai chiều Thời khóa biểu ca trực 24/7, Danh bạ nhân sự, Lịch thuốc & Báo động'
                  : 'Two-way sync for 24/7 Rosters, Medical Staff, Medication Doses & Emergency Audit Logs'}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className={`p-2 rounded-xl transition-colors cursor-pointer ${
              isDark ? 'hover:bg-slate-800 text-slate-400 hover:text-white' : 'hover:bg-slate-200 text-slate-500'
            }`}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Section 1: Authentication State */}
          {!currentUser ? (
            <div
              className={`p-8 rounded-3xl border text-center space-y-5 ${
                isDark ? 'bg-slate-950/40 border-slate-800' : 'bg-slate-50 border-slate-200'
              }`}
            >
              <div className="w-16 h-16 mx-auto rounded-3xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 shadow-inner">
                <FileSpreadsheet className="w-8 h-8" />
              </div>
              <div className="max-w-md mx-auto space-y-1.5">
                <h3 className="text-lg font-extrabold">
                  {language === 'vi' ? 'Kết Nối Tài Khoản Google Workspace' : 'Connect Google Workspace Account'}
                </h3>
                <p className="text-xs text-slate-400 leading-relaxed">
                  {language === 'vi'
                    ? 'Đăng nhập bằng tài khoản Google để tạo bảng tính mới trên Google Drive hoặc đồng bộ trực tiếp vào các Google Sheets có sẵn của bạn.'
                    : 'Sign in with your Google account to create new spreadsheets on Google Drive or sync directly to existing Google Sheets.'}
                </p>
              </div>

              {/* Official Google Sign-in Button per Workspace Skill */}
              <div className="flex justify-center pt-2">
                <button
                  onClick={handleLogin}
                  disabled={isLoggingIn}
                  className="flex items-center gap-3 px-6 py-3 rounded-2xl bg-white hover:bg-slate-50 text-slate-800 font-bold text-sm shadow-lg border border-slate-300 transition-all hover:scale-[1.02] active:scale-[0.98] cursor-pointer disabled:opacity-50"
                >
                  <svg version="1.1" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" className="w-5 h-5">
                    <path
                      fill="#EA4335"
                      d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
                    />
                    <path
                      fill="#4285F4"
                      d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
                    />
                    <path
                      fill="#34A853"
                      d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
                    />
                  </svg>
                  <span>
                    {isLoggingIn
                      ? language === 'vi'
                        ? 'Đang kết nối Google...'
                        : 'Connecting Google...'
                      : language === 'vi'
                      ? 'Đăng nhập bằng tài khoản Google'
                      : 'Sign in with Google'}
                  </span>
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Authenticated Account Info Bar */}
              <div
                className={`p-4 rounded-2xl border flex items-center justify-between flex-wrap gap-3 ${
                  isDark ? 'bg-slate-950/60 border-slate-800' : 'bg-slate-50 border-slate-200'
                }`}
              >
                <div className="flex items-center gap-3">
                  {currentUser.photoURL ? (
                    <img
                      src={currentUser.photoURL}
                      alt={currentUser.displayName || 'Google User'}
                      referrerPolicy="no-referrer"
                      className="w-10 h-10 rounded-full border-2 border-emerald-500/50 object-cover"
                    />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-emerald-600 text-white font-bold flex items-center justify-center">
                      {(currentUser.displayName || currentUser.email || 'G').charAt(0).toUpperCase()}
                    </div>
                  )}
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm">{currentUser.displayName || 'Người dùng Google'}</span>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center gap-1">
                        <Check className="w-3 h-3" /> Đã xác thực
                      </span>
                    </div>
                    <p className="text-xs text-slate-400">{currentUser.email}</p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => accessToken && loadDriveFiles(accessToken)}
                    disabled={isLoadingFiles}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border transition-colors cursor-pointer ${
                      isDark
                        ? 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700'
                        : 'bg-white hover:bg-slate-100 text-slate-700 border-slate-300'
                    }`}
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isLoadingFiles ? 'animate-spin' : ''}`} />
                    <span>Làm mới Drive</span>
                  </button>
                  <button
                    onClick={handleSignOut}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-rose-500/20 hover:bg-rose-500/30 text-rose-400 border border-rose-500/30 transition-colors cursor-pointer"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    <span>Đăng xuất</span>
                  </button>
                </div>
              </div>

              {/* Section 2: Choose / Create Target Spreadsheet */}
              <div
                className={`p-5 rounded-3xl border space-y-4 ${
                  isDark ? 'bg-slate-950/30 border-slate-800' : 'bg-slate-50/70 border-slate-200'
                }`}
              >
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <h3 className="font-extrabold text-sm flex items-center gap-2">
                    <FolderOpen className="w-4 h-4 text-amber-400" />
                    <span>Bảng Tính Đích Trên Google Drive (Target Spreadsheet)</span>
                  </h3>

                  {activeSpreadsheet && (
                    <a
                      href={activeSpreadsheet.spreadsheetUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1.5 text-xs font-bold text-emerald-400 hover:text-emerald-300 bg-emerald-500/10 hover:bg-emerald-500/20 px-3 py-1 rounded-xl border border-emerald-500/30 transition-colors"
                    >
                      <FileSpreadsheet className="w-3.5 h-3.5" />
                      <span>Mở Trong Google Sheets</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                </div>

                {/* Grid: Create New vs Select Existing */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Option A: Create New Spreadsheet */}
                  <div
                    className={`p-4 rounded-2xl border space-y-3 ${
                      isDark ? 'bg-slate-900/80 border-slate-800' : 'bg-white border-slate-200'
                    }`}
                  >
                    <div className="flex items-center gap-2 text-xs font-bold text-emerald-400">
                      <Sparkles className="w-4 h-4" />
                      <span>Tạo Mới Bảng Tính Mẫu Chuẩn Bệnh Viện</span>
                    </div>
                    <p className="text-[11px] text-slate-400">
                      Tự động khởi tạo đầy đủ 4 tab dữ liệu chuẩn kèm định dạng tiêu đề, màu sắc & khóa hàng tiêu đề.
                    </p>
                    <input
                      type="text"
                      value={newSheetTitle}
                      onChange={(e) => setNewSheetTitle(e.target.value)}
                      placeholder="Tên bảng tính..."
                      className={`w-full px-3 py-2 rounded-xl text-xs border font-medium outline-none ${
                        isDark ? 'bg-slate-950 border-slate-700 text-white' : 'bg-slate-50 border-slate-300'
                      }`}
                    />
                    <button
                      onClick={handleCreateNewSpreadsheet}
                      disabled={isCreatingNew}
                      className="w-full flex items-center justify-center gap-2 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs shadow-md transition-all cursor-pointer disabled:opacity-50"
                    >
                      <Plus className="w-4 h-4" />
                      <span>{isCreatingNew ? 'Đang khởi tạo trên Google Drive...' : 'Tạo Bảng Tính Mới Ngay'}</span>
                    </button>
                  </div>

                  {/* Option B: Pick from existing Drive sheets */}
                  <div
                    className={`p-4 rounded-2xl border space-y-3 ${
                      isDark ? 'bg-slate-900/80 border-slate-800' : 'bg-white border-slate-200'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-xs font-bold text-cyan-400">
                        <FileSpreadsheet className="w-4 h-4" />
                        <span>Chọn Bảng Tính Đã Có Trên Google Drive</span>
                      </div>
                      <span className="text-[10px] text-slate-400 font-semibold">{driveFiles.length} tệp</span>
                    </div>

                    <div className="relative">
                      <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
                      <input
                        type="text"
                        value={searchDriveQuery}
                        onChange={(e) => setSearchDriveQuery(e.target.value)}
                        placeholder="Tìm kiếm bảng tính trong Drive..."
                        className={`w-full pl-8 pr-3 py-1.5 rounded-xl text-xs border outline-none ${
                          isDark ? 'bg-slate-950 border-slate-700 text-white' : 'bg-slate-50 border-slate-300'
                        }`}
                      />
                    </div>

                    <div className="max-h-28 overflow-y-auto space-y-1 pr-1">
                      {filteredDriveFiles.length === 0 ? (
                        <p className="text-[11px] text-slate-400 text-center py-3">
                          {isLoadingFiles ? 'Đang quét Google Drive...' : 'Không tìm thấy bảng tính phù hợp'}
                        </p>
                      ) : (
                        filteredDriveFiles.map((file) => (
                          <button
                            key={file.id}
                            onClick={() => handleSelectSpreadsheet(file.id)}
                            className={`w-full text-left p-2 rounded-xl text-xs flex items-center justify-between gap-2 transition-all cursor-pointer ${
                              selectedSpreadsheetId === file.id
                                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-bold'
                                : isDark
                                ? 'hover:bg-slate-800 text-slate-300'
                                : 'hover:bg-slate-100 text-slate-700'
                            }`}
                          >
                            <span className="truncate">{file.name}</span>
                            {selectedSpreadsheetId === file.id && (
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                            )}
                          </button>
                        ))
                      )}
                    </div>
                  </div>
                </div>

                {/* Selected Active Sheet Status */}
                {activeSpreadsheet && (
                  <div
                    className={`p-3 rounded-2xl border flex items-center justify-between flex-wrap gap-2 text-xs ${
                      isDark ? 'bg-emerald-950/20 border-emerald-800/40' : 'bg-emerald-50 border-emerald-200'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                      <span className="font-bold text-emerald-300">Bảng tính đang liên kết:</span>
                      <span className="font-semibold text-white truncate max-w-xs">{activeSpreadsheet.title}</span>
                      <span className="text-[11px] text-slate-400">({activeSpreadsheet.sheets.length} tabs)</span>
                    </div>

                    <div className="flex items-center gap-1.5 flex-wrap">
                      {activeSpreadsheet.sheets.map((tab) => (
                        <span
                          key={tab.sheetId}
                          className="px-2 py-0.5 rounded-lg text-[10px] font-semibold bg-slate-800 text-slate-300 border border-slate-700"
                        >
                          {tab.title}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Section 3: High-Speed Sync Actions */}
              <div className="space-y-4">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <h3 className="font-extrabold text-sm flex items-center gap-2">
                    <RefreshCw className="w-4 h-4 text-blue-400" />
                    <span>Các Phân Hệ Đồng Bộ Hai Chiều (Two-Way Sync Actions)</span>
                  </h3>

                  <button
                    onClick={handleSyncAll}
                    disabled={!selectedSpreadsheetId || syncingAction !== null}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-600 hover:from-emerald-500 hover:to-cyan-500 text-white font-extrabold text-xs shadow-lg shadow-emerald-950/40 cursor-pointer disabled:opacity-50"
                  >
                    <Sparkles className="w-4 h-4" />
                    <span>
                      {syncingAction === 'all'
                        ? 'Đang đồng bộ tất cả...'
                        : '⚡ Đồng Bộ Toàn Bộ Dữ Liệu Bệnh Viện (1-Click Master Sync)'}
                    </span>
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Module 1: Duty Timetable */}
                  <div
                    className={`p-4 rounded-2xl border space-y-3 flex flex-col justify-between ${
                      isDark ? 'bg-slate-900/60 border-slate-800' : 'bg-white border-slate-200'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 font-bold text-xs text-amber-400">
                          <Calendar className="w-4 h-4" />
                          <span>Thời Khóa Biểu & Lịch Trình Ca Trực 24/7</span>
                        </div>
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-300">
                          {schedules.length} Ca Trực
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-400 mt-1">
                        Xuất ma trận phân ca 4 khung giờ, cán bộ trực chính 24/7, trưởng kíp trực và buồng phân bổ vào tab riêng.
                      </p>
                    </div>

                    <button
                      onClick={handleExportRoster}
                      disabled={!selectedSpreadsheetId || syncingAction !== null}
                      className="w-full flex items-center justify-center gap-2 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs shadow-sm cursor-pointer disabled:opacity-50"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>{syncingAction === 'export-roster' ? 'Đang xuất lịch...' : 'Xuất Lịch Trực Lên Google Sheets'}</span>
                    </button>
                  </div>

                  {/* Module 2: Staff Directory & Two-Way Import */}
                  <div
                    className={`p-4 rounded-2xl border space-y-3 flex flex-col justify-between ${
                      isDark ? 'bg-slate-900/60 border-slate-800' : 'bg-white border-slate-200'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 font-bold text-xs text-blue-400">
                          <Users className="w-4 h-4" />
                          <span>Danh Bạ & Hồ Sơ Nhân Sự Y Tế</span>
                        </div>
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-500/20 text-blue-300">
                          {doctors.length} Cán Bộ
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-400 mt-1">
                        Đồng bộ hồ sơ bác sĩ & điều dưỡng, số CCHN, số điện thoại, kinh nghiệm và ca trực mặc định.
                      </p>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <button
                        onClick={handleExportStaff}
                        disabled={!selectedSpreadsheetId || syncingAction !== null}
                        className="flex items-center justify-center gap-1.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs shadow-sm cursor-pointer disabled:opacity-50"
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span>Xuất Nhân Sự</span>
                      </button>
                      <button
                        onClick={handleImportStaff}
                        disabled={!selectedSpreadsheetId || syncingAction !== null}
                        className="flex items-center justify-center gap-1.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs border border-slate-700 cursor-pointer disabled:opacity-50"
                      >
                        <Upload className="w-3.5 h-3.5 text-emerald-400" />
                        <span>Nhập Từ Sheet</span>
                      </button>
                    </div>
                  </div>

                  {/* Module 3: Medication Schedules */}
                  <div
                    className={`p-4 rounded-2xl border space-y-3 flex flex-col justify-between ${
                      isDark ? 'bg-slate-900/60 border-slate-800' : 'bg-white border-slate-200'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 font-bold text-xs text-cyan-400">
                          <Pill className="w-4 h-4" />
                          <span>Lịch Cấp Thuốc Bệnh Nhân ICU</span>
                        </div>
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-cyan-500/20 text-cyan-300">
                          {medications.length} Y Lệnh
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-400 mt-1">
                        Lưu trữ lịch uống thuốc, đường dùng (IV/Oral), liều lượng, giờ cho thuốc và nhật ký thực hiện của điều dưỡng.
                      </p>
                    </div>

                    <button
                      onClick={handleExportMedications}
                      disabled={!selectedSpreadsheetId || syncingAction !== null}
                      className="w-full flex items-center justify-center gap-2 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs shadow-sm cursor-pointer disabled:opacity-50"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>{syncingAction === 'export-medications' ? 'Đang xuất...' : 'Xuất Lịch Thuốc Lên Google Sheets'}</span>
                    </button>
                  </div>

                  {/* Module 4: Emergency Alert Logs */}
                  <div
                    className={`p-4 rounded-2xl border space-y-3 flex flex-col justify-between ${
                      isDark ? 'bg-slate-900/60 border-slate-800' : 'bg-white border-slate-200'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 font-bold text-xs text-rose-400">
                          <ShieldAlert className="w-4 h-4" />
                          <span>Nhật Ký Cảnh Báo Lâm Sàng & Cấp Cứu</span>
                        </div>
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/20 text-rose-300">
                          {alerts.length} Bản Ghi
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-400 mt-1">
                        Lưu trữ audit trail sự kiện sinh tồn nguy kịch, thời gian bác sĩ tiếp nhận và ghi chú xử trí lâm sàng.
                      </p>
                    </div>

                    <button
                      onClick={handleExportAlerts}
                      disabled={!selectedSpreadsheetId || syncingAction !== null}
                      className="w-full flex items-center justify-center gap-2 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs shadow-sm cursor-pointer disabled:opacity-50"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>{syncingAction === 'export-alerts' ? 'Đang xuất...' : 'Lưu Trữ Nhật Ký Cảnh Báo Lên Sheet'}</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div
          className={`p-4 border-t flex items-center justify-between flex-wrap gap-3 ${
            isDark ? 'bg-slate-950 border-slate-800' : 'bg-slate-100 border-slate-200'
          }`}
        >
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <ShieldAlert className="w-4 h-4 text-emerald-400" />
            <span>Kết nối bảo mật qua Google Identity Services & Google Sheets API v4</span>
          </div>

          <button
            onClick={onClose}
            className={`px-5 py-2 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
              isDark ? 'bg-slate-800 hover:bg-slate-700 text-slate-200' : 'bg-slate-200 hover:bg-slate-300 text-slate-700'
            }`}
          >
            Đóng Cửa Sổ
          </button>
        </div>
      </div>

      {/* Explicit User Confirmation Dialog (MANDATORY per Workspace Integration Skill) */}
      {confirmDialog && confirmDialog.isOpen && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fadeIn">
          <div
            className={`w-full max-w-md p-6 rounded-3xl border shadow-2xl space-y-4 ${
              isDark ? 'bg-slate-900 border-slate-800 text-white' : 'bg-white border-slate-200 text-slate-900'
            }`}
          >
            <div className="w-12 h-12 rounded-2xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400">
              <AlertTriangle className="w-6 h-6" />
            </div>

            <div className="space-y-1">
              <h3 className="text-base font-black">{confirmDialog.title}</h3>
              <p className="text-xs text-slate-400 leading-relaxed">{confirmDialog.description}</p>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setConfirmDialog(null)}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
                  isDark ? 'bg-slate-800 hover:bg-slate-700 text-slate-300' : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                }`}
              >
                Hủy Bỏ
              </button>
              <button
                onClick={confirmDialog.onConfirm}
                className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs shadow-md cursor-pointer"
              >
                {confirmDialog.confirmLabel}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
