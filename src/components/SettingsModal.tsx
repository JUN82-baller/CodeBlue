import React, { useState } from 'react';
import {
  Bell,
  Check,
  Globe,
  Moon,
  Palette,
  RotateCcw,
  Save,
  Sliders,
  Stethoscope,
  Sun,
  Users,
  Volume2,
  VolumeX,
  X,
  Zap,
} from 'lucide-react';
import { Doctor, SystemSettings } from '../types';
import { useLanguage } from '../context/LanguageContext';
import { useTheme } from '../context/ThemeContext';
import { playDoctorAlertChime } from '../services/sound';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: SystemSettings;
  onSaveSettings: (newSettings: SystemSettings) => Promise<void>;
  onResetData: () => void;
  onNavigateToStaffAdmin?: () => void;
  soundEnabled?: boolean;
  setSoundEnabled?: (enabled: boolean) => void;
  hasNotificationPermission?: boolean;
  onRequestNotification?: () => void;
  doctors?: Doctor[];
  selectedDoctorId?: string;
  setSelectedDoctorId?: (id: string) => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  settings,
  onSaveSettings,
  onResetData,
  onNavigateToStaffAdmin,
  soundEnabled = true,
  setSoundEnabled,
  hasNotificationPermission = false,
  onRequestNotification,
  doctors = [],
  selectedDoctorId,
  setSelectedDoctorId,
}) => {
  const { t, language, setLanguage } = useLanguage();
  const { theme, setTheme } = useTheme();

  const [activeSubTab, setActiveSubTab] = useState<'general' | 'thresholds'>('general');
  const [formData, setFormData] = useState<SystemSettings>(settings);
  const [isSaving, setIsSaving] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      await onSaveSettings(formData);
      onClose();
    } finally {
      setIsSaving(false);
    }
  };

  const isDark = theme === 'dark';

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div
        className={`w-full max-w-xl max-h-[92vh] flex flex-col rounded-3xl p-5 sm:p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-200 border ${
          isDark ? 'bg-slate-900 border-slate-800 text-white' : 'bg-white border-slate-200 text-slate-900'
        }`}
      >
        {/* Header */}
        <div className={`flex items-center justify-between border-b pb-3.5 ${isDark ? 'border-slate-800' : 'border-slate-200'}`}>
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-blue-600/20 text-blue-500 flex items-center justify-center shadow-inner">
              <Sliders className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold">{t.settingsTitle}</h3>
              <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                {language === 'vi'
                  ? 'Giao diện, âm thanh, thông báo & ngưỡng cảnh báo ICU'
                  : 'Appearance, audio, notifications & ICU alarm thresholds'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className={`p-1.5 rounded-xl transition-colors cursor-pointer ${
              isDark ? 'text-slate-400 hover:text-white hover:bg-slate-800' : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Selector */}
        <div
          className={`flex items-center p-1 rounded-2xl border ${
            isDark ? 'bg-slate-950 border-slate-800' : 'bg-slate-50 border-slate-200'
          }`}
        >
          <button
            type="button"
            onClick={() => setActiveSubTab('general')}
            className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
              activeSubTab === 'general'
                ? 'bg-blue-600 text-white shadow-md'
                : isDark
                ? 'text-slate-400 hover:text-white'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Palette className="w-3.5 h-3.5" />
            <span>{t.tabGeneralSettings}</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveSubTab('thresholds')}
            className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
              activeSubTab === 'thresholds'
                ? 'bg-blue-600 text-white shadow-md'
                : isDark
                ? 'text-slate-400 hover:text-white'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Zap className="w-3.5 h-3.5" />
            <span>{t.tabThresholdSettings}</span>
          </button>
        </div>

        {/* Content Body with scrolling */}
        <div className="overflow-y-auto flex-1 pr-1 space-y-5 text-xs">
          {activeSubTab === 'general' && (
            <div className="space-y-4">
              {/* Theme Toggle Section */}
              <div>
                <label className={`block font-bold mb-2 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                  {t.themeMode}
                </label>
                <div className="grid grid-cols-2 gap-2.5">
                  {/* Dark Mode */}
                  <button
                    type="button"
                    onClick={() => setTheme('dark')}
                    className={`p-3.5 rounded-2xl border text-left transition-all flex flex-col justify-between cursor-pointer ${
                      theme === 'dark'
                        ? 'bg-slate-950 border-blue-500 ring-2 ring-blue-500/40 text-white'
                        : isDark
                        ? 'bg-slate-950/60 border-slate-800 text-slate-400 hover:text-slate-200'
                        : 'bg-slate-100 border-slate-200 text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="w-7 h-7 rounded-xl bg-indigo-500/20 text-indigo-400 flex items-center justify-center">
                        <Moon className="w-3.5 h-3.5" />
                      </div>
                      {theme === 'dark' && <Check className="w-4 h-4 text-blue-400" />}
                    </div>
                    <div className="mt-2.5">
                      <div className="font-bold text-xs text-slate-100">{t.themeDark}</div>
                      <div className="text-[10px] text-slate-400 mt-0.5">
                        {language === 'vi' ? 'Độ tương phản cao màn hình ICU' : 'High contrast ICU monitor'}
                      </div>
                    </div>
                  </button>

                  {/* Light Mode */}
                  <button
                    type="button"
                    onClick={() => setTheme('light')}
                    className={`p-3.5 rounded-2xl border text-left transition-all flex flex-col justify-between cursor-pointer ${
                      theme === 'light'
                        ? 'bg-blue-50/80 border-blue-500 ring-2 ring-blue-500/40 text-blue-900'
                        : isDark
                        ? 'bg-slate-950/60 border-slate-800 text-slate-400 hover:text-slate-200'
                        : 'bg-slate-50 border-slate-200 text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="w-7 h-7 rounded-xl bg-amber-500/20 text-amber-500 flex items-center justify-center">
                        <Sun className="w-3.5 h-3.5" />
                      </div>
                      {theme === 'light' && <Check className="w-4 h-4 text-blue-600" />}
                    </div>
                    <div className="mt-2.5">
                      <div className="font-bold text-xs text-slate-900">{t.themeLight}</div>
                      <div className="text-[10px] text-slate-500 mt-0.5">
                        {language === 'vi' ? 'Sáng sủa, chuẩn lâm sàng' : 'Crisp clinical day mode'}
                      </div>
                    </div>
                  </button>
                </div>
              </div>

              {/* Language Selection Section */}
              <div>
                <label className={`block font-bold mb-2 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                  {t.languageTitle}
                </label>
                <div className="grid grid-cols-2 gap-2.5">
                  <button
                    type="button"
                    onClick={() => setLanguage('vi')}
                    className={`p-3 rounded-2xl border text-left transition-all flex items-center justify-between cursor-pointer ${
                      language === 'vi'
                        ? isDark
                          ? 'bg-red-950/40 border-red-500 ring-2 ring-red-500/40 text-white'
                          : 'bg-red-50 border-red-500 ring-2 ring-red-500/40 text-red-900'
                        : isDark
                        ? 'bg-slate-950/60 border-slate-800 text-slate-400 hover:text-slate-200'
                        : 'bg-slate-50 border-slate-200 text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <span className="text-xl">🇻🇳</span>
                      <div>
                        <div className="font-bold text-xs">{t.langVietnamese}</div>
                        <div className="text-[10px] opacity-75">Tiếng Việt</div>
                      </div>
                    </div>
                    {language === 'vi' && <Check className="w-4 h-4 text-red-500" />}
                  </button>

                  <button
                    type="button"
                    onClick={() => setLanguage('en')}
                    className={`p-3 rounded-2xl border text-left transition-all flex items-center justify-between cursor-pointer ${
                      language === 'en'
                        ? isDark
                          ? 'bg-blue-950/40 border-blue-500 ring-2 ring-blue-500/40 text-white'
                          : 'bg-blue-50 border-blue-500 ring-2 ring-blue-500/40 text-blue-900'
                        : isDark
                        ? 'bg-slate-950/60 border-slate-800 text-slate-400 hover:text-slate-200'
                        : 'bg-slate-50 border-slate-200 text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <span className="text-xl">🇬🇧</span>
                      <div>
                        <div className="font-bold text-xs">{t.langEnglish}</div>
                        <div className="text-[10px] opacity-75">English</div>
                      </div>
                    </div>
                    {language === 'en' && <Check className="w-4 h-4 text-blue-500" />}
                  </button>
                </div>
              </div>

              {/* Sound & Siren Alerts Section */}
              <div
                className={`p-3.5 rounded-2xl border ${
                  isDark ? 'bg-slate-950 border-slate-800' : 'bg-slate-50 border-slate-200'
                }`}
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-8 h-8 rounded-xl flex items-center justify-center ${
                        soundEnabled
                          ? 'bg-emerald-500/20 text-emerald-400'
                          : 'bg-slate-500/20 text-slate-400'
                      }`}
                    >
                      {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
                    </div>
                    <div>
                      <div className={`font-bold text-xs ${isDark ? 'text-white' : 'text-slate-900'}`}>
                        {language === 'vi' ? 'Âm thanh cảnh báo & Còi hú' : 'Audio Alarms & Siren'}
                      </div>
                      <div className={`text-[10px] ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                        {language === 'vi'
                          ? 'Phát chuông báo động đỏ và còi trạm y tá khi có biến cố'
                          : 'Play emergency chimes & nurse station siren during code red'}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {/* Sound Test Button */}
                    <button
                      type="button"
                      id="btn-settings-test-sound"
                      onClick={() => playDoctorAlertChime()}
                      className={`px-2.5 py-1.5 rounded-xl border text-[11px] font-bold transition-all flex items-center gap-1 cursor-pointer ${
                        isDark
                          ? 'bg-slate-900 border-slate-700 text-slate-200 hover:bg-slate-800 hover:text-white'
                          : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-100'
                      }`}
                      title={t.testSound}
                    >
                      <Volume2 className="w-3 h-3 text-blue-500" />
                      <span>{t.testSound}</span>
                    </button>

                    {/* Toggle Button */}
                    {setSoundEnabled && (
                      <button
                        type="button"
                        id="btn-settings-toggle-sound"
                        onClick={() => setSoundEnabled(!soundEnabled)}
                        className={`px-3 py-1.5 rounded-xl font-bold text-[11px] transition-all cursor-pointer ${
                          soundEnabled
                            ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm'
                            : isDark
                            ? 'bg-slate-800 text-slate-400 hover:text-slate-200'
                            : 'bg-slate-200 text-slate-600 hover:bg-slate-300'
                        }`}
                      >
                        {soundEnabled ? (language === 'vi' ? 'Đang BẬT' : 'ON') : (language === 'vi' ? 'Đã TẮT' : 'OFF')}
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Desktop Push Notification Section */}
              <div
                className={`p-3.5 rounded-2xl border flex items-center justify-between gap-3 ${
                  isDark ? 'bg-slate-950 border-slate-800' : 'bg-slate-50 border-slate-200'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`w-8 h-8 rounded-xl flex items-center justify-center ${
                      hasNotificationPermission
                        ? 'bg-emerald-500/20 text-emerald-400'
                        : 'bg-amber-500/20 text-amber-500'
                    }`}
                  >
                    <Bell className="w-4 h-4" />
                  </div>
                  <div>
                    <div className={`font-bold text-xs ${isDark ? 'text-white' : 'text-slate-900'}`}>
                      {language === 'vi' ? 'Thông báo đẩy màn hình (Web Push)' : 'Desktop Web Push Notifications'}
                    </div>
                    <div className={`text-[10px] ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                      {hasNotificationPermission
                        ? language === 'vi'
                          ? 'Đã cho phép: Nhận cảnh báo nổi khi đang mở tab khác'
                          : 'Enabled: Receive popup alerts even when viewing other tabs'
                        : language === 'vi'
                        ? 'Chưa bật thông báo nổi ngoài trình duyệt'
                        : 'Not enabled for background alerts'}
                    </div>
                  </div>
                </div>

                {hasNotificationPermission ? (
                  <span className="text-[11px] font-bold px-2.5 py-1 rounded-lg bg-emerald-500/20 text-emerald-500 border border-emerald-500/30 flex items-center gap-1">
                    <Check className="w-3 h-3" />
                    <span>{language === 'vi' ? 'Đã bật' : 'Active'}</span>
                  </span>
                ) : onRequestNotification ? (
                  <button
                    type="button"
                    id="btn-settings-request-push"
                    onClick={onRequestNotification}
                    className="px-3 py-1.5 bg-amber-600 hover:bg-amber-500 text-white rounded-xl font-bold text-[11px] transition-colors cursor-pointer flex items-center gap-1 shadow-sm"
                  >
                    <Bell className="w-3 h-3" />
                    <span>{language === 'vi' ? 'Bật thông báo' : 'Enable Push'}</span>
                  </button>
                ) : null}
              </div>

              {/* Duty Doctor Switcher (If multiple doctors) */}
              {doctors.length > 0 && selectedDoctorId && setSelectedDoctorId && (
                <div
                  className={`p-3.5 rounded-2xl border flex items-center justify-between gap-3 ${
                    isDark ? 'bg-slate-950 border-slate-800' : 'bg-slate-50 border-slate-200'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-xl bg-blue-500/20 text-blue-400 flex items-center justify-center">
                      <Stethoscope className="w-4 h-4" />
                    </div>
                    <div>
                      <div className={`font-bold text-xs ${isDark ? 'text-white' : 'text-slate-900'}`}>
                        {language === 'vi' ? 'Hồ sơ bác sĩ thao tác' : 'Active Doctor Profile'}
                      </div>
                      <div className={`text-[10px] ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                        {language === 'vi'
                          ? 'Chọn danh tính bác sĩ hiển thị và tiếp nhận ca'
                          : 'Select doctor identity for alert triage & actions'}
                      </div>
                    </div>
                  </div>

                  <select
                    id="select-doctor-settings"
                    value={selectedDoctorId}
                    onChange={(e) => setSelectedDoctorId(e.target.value)}
                    className={`px-3 py-1.5 rounded-xl border text-xs font-semibold focus:outline-none cursor-pointer ${
                      isDark
                        ? 'bg-slate-900 border-slate-700 text-white'
                        : 'bg-white border-slate-300 text-slate-900'
                    }`}
                  >
                    {doctors.map((doc) => (
                      <option
                        key={doc.id}
                        value={doc.id}
                        className={isDark ? 'bg-slate-900 text-white' : 'bg-white text-slate-900'}
                      >
                        {doc.name} {doc.isOnCall ? t.onDutyTag : t.backupTag}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Quick Link to Personnel Admin */}
              {onNavigateToStaffAdmin && (
                <div
                  className={`p-3.5 rounded-2xl border flex items-center justify-between gap-3 ${
                    isDark ? 'bg-slate-950 border-slate-800' : 'bg-slate-50 border-slate-200'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-xl bg-purple-500/20 text-purple-400 flex items-center justify-center">
                      <Users className="w-4 h-4" />
                    </div>
                    <div>
                      <div className={`font-bold text-xs ${isDark ? 'text-white' : 'text-slate-900'}`}>
                        {t.tabPersonnelAdmin}
                      </div>
                      <div className={`text-[10px] ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                        {language === 'vi'
                          ? 'Quản lý bác sĩ, điều dưỡng trực ca và danh bạ'
                          : 'Manage hospital doctors, nurses & duty rosters'}
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onNavigateToStaffAdmin();
                    }}
                    className="px-3 py-1.5 bg-purple-600 hover:bg-purple-500 text-white rounded-xl font-bold text-xs transition-colors cursor-pointer"
                  >
                    {language === 'vi' ? 'Mở Quản Lý' : 'Open Admin'}
                  </button>
                </div>
              )}
            </div>
          )}

          {activeSubTab === 'thresholds' && (
            <form onSubmit={handleSubmit} className="space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className={`font-semibold block mb-1 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                    {t.critLowHR}
                  </label>
                  <input
                    type="number"
                    value={formData.criticalLowHeartRate}
                    onChange={(e) => setFormData({ ...formData, criticalLowHeartRate: Number(e.target.value) })}
                    className={`w-full rounded-xl px-3 py-2 font-mono font-bold border focus:outline-none focus:border-blue-500 ${
                      isDark ? 'bg-slate-950 border-slate-700 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'
                    }`}
                  />
                  <span className="text-[10px] text-slate-500">{t.critLowHRDesc}</span>
                </div>

                <div>
                  <label className={`font-semibold block mb-1 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                    {t.critHighHR}
                  </label>
                  <input
                    type="number"
                    value={formData.criticalHighHeartRate}
                    onChange={(e) => setFormData({ ...formData, criticalHighHeartRate: Number(e.target.value) })}
                    className={`w-full rounded-xl px-3 py-2 font-mono font-bold border focus:outline-none focus:border-blue-500 ${
                      isDark ? 'bg-slate-950 border-slate-700 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'
                    }`}
                  />
                  <span className="text-[10px] text-slate-500">{t.critHighHRDesc}</span>
                </div>

                <div>
                  <label className={`font-semibold block mb-1 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                    {t.minNormalHR}
                  </label>
                  <input
                    type="number"
                    value={formData.minNormalHeartRate}
                    onChange={(e) => setFormData({ ...formData, minNormalHeartRate: Number(e.target.value) })}
                    className={`w-full rounded-xl px-3 py-2 font-mono font-bold border focus:outline-none focus:border-blue-500 ${
                      isDark ? 'bg-slate-950 border-slate-700 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'
                    }`}
                  />
                  <span className="text-[10px] text-slate-500">{language === 'vi' ? 'Mặc định: 50 BPM' : 'Default: 50 BPM'}</span>
                </div>

                <div>
                  <label className={`font-semibold block mb-1 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                    {t.maxNormalHR}
                  </label>
                  <input
                    type="number"
                    value={formData.maxNormalHeartRate}
                    onChange={(e) => setFormData({ ...formData, maxNormalHeartRate: Number(e.target.value) })}
                    className={`w-full rounded-xl px-3 py-2 font-mono font-bold border focus:outline-none focus:border-blue-500 ${
                      isDark ? 'bg-slate-950 border-slate-700 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'
                    }`}
                  />
                  <span className="text-[10px] text-slate-500">{language === 'vi' ? 'Mặc định: 120 BPM' : 'Default: 120 BPM'}</span>
                </div>

                <div>
                  <label className={`font-semibold block mb-1 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                    {t.minSpO2}
                  </label>
                  <input
                    type="number"
                    value={formData.minSpO2}
                    onChange={(e) => setFormData({ ...formData, minSpO2: Number(e.target.value) })}
                    className={`w-full rounded-xl px-3 py-2 font-mono font-bold border focus:outline-none focus:border-blue-500 ${
                      isDark ? 'bg-slate-950 border-slate-700 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'
                    }`}
                  />
                  <span className="text-[10px] text-slate-500">{language === 'vi' ? 'Mặc định: 88%' : 'Default: 88%'}</span>
                </div>

                <div>
                  <label className={`font-semibold block mb-1 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                    {t.escalationTimeout}
                  </label>
                  <input
                    type="number"
                    value={formData.escalationTimeoutSeconds}
                    onChange={(e) => setFormData({ ...formData, escalationTimeoutSeconds: Number(e.target.value) })}
                    className={`w-full rounded-xl px-3 py-2 font-mono font-bold border focus:outline-none focus:border-blue-500 ${
                      isDark ? 'bg-slate-950 border-slate-700 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'
                    }`}
                  />
                  <span className="text-[10px] text-slate-500">{t.escalationTimeoutDesc}</span>
                </div>
              </div>

              <div className={`pt-3 border-t flex items-center justify-end gap-2 ${isDark ? 'border-slate-800' : 'border-slate-200'}`}>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-bold flex items-center gap-1.5 shadow cursor-pointer"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>{isSaving ? t.btnSaving : t.btnSaveSettings}</span>
                </button>
              </div>
            </form>
          )}
        </div>

        {/* Footer actions */}
        <div className={`pt-3 border-t flex items-center justify-between ${isDark ? 'border-slate-800' : 'border-slate-200'}`}>
          <button
            type="button"
            onClick={onResetData}
            className="text-xs text-rose-400 hover:text-rose-300 flex items-center gap-1 font-semibold cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>{t.btnResetDefaultData}</span>
          </button>

          <button
            type="button"
            onClick={onClose}
            className={`px-4 py-2 rounded-xl font-bold text-xs cursor-pointer ${
              isDark ? 'bg-slate-800 hover:bg-slate-700 text-slate-300' : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
            }`}
          >
            {t.btnClose}
          </button>
        </div>
      </div>
    </div>
  );
};
