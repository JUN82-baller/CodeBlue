import React, { useRef, useState } from 'react';
import {
  Activity,
  Calendar,
  Clock,
  FileSpreadsheet,
  Laptop,
  Moon,
  Pill,
  Radio,
  Sliders,
  Sparkles,
  Stethoscope,
  Sun,
  Users,
  Mail,
} from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import { useTheme } from '../context/ThemeContext';

interface NavbarProps {
  activeTab: 'doctor' | 'nurse' | 'medication' | 'ai' | 'simulator' | 'audit' | 'settings';
  setActiveTab: (tab: 'doctor' | 'nurse' | 'medication' | 'ai' | 'simulator' | 'audit' | 'settings') => void;
  onOpenSettings: () => void;
  onOpenGoogleSheets?: () => void;
  onOpenGmail?: () => void;
  isConnected: boolean;
  pendingAlertsCount: number;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  setActiveTab,
  onOpenSettings,
  onOpenGoogleSheets,
  onOpenGmail,
  isConnected,
  pendingAlertsCount,
}) => {
  const { language, t } = useLanguage();
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === 'dark';

  // Mouse & Touch Drag-to-Scroll handlers for Navigation Bar (Nhấn giữ kéo qua)
  const navRef = useRef<HTMLElement>(null);
  const isDownRef = useRef(false);
  const startXRef = useRef(0);
  const scrollLeftRef = useRef(0);
  const hasDraggedRef = useRef(false);
  const [isDragging, setIsDragging] = useState(false);

  const handleMouseDown = (e: React.MouseEvent) => {
    if (!navRef.current) return;
    isDownRef.current = true;
    startXRef.current = e.pageX - navRef.current.offsetLeft;
    scrollLeftRef.current = navRef.current.scrollLeft;
    hasDraggedRef.current = false;
  };

  const handleMouseLeave = () => {
    isDownRef.current = false;
    setIsDragging(false);
  };

  const handleMouseUp = () => {
    isDownRef.current = false;
    setTimeout(() => {
      hasDraggedRef.current = false;
      setIsDragging(false);
    }, 60);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDownRef.current || !navRef.current) return;
    e.preventDefault();
    const x = e.pageX - navRef.current.offsetLeft;
    const walk = (x - startXRef.current) * 1.5;
    if (Math.abs(walk) > 3) {
      hasDraggedRef.current = true;
      setIsDragging(true);
    }
    navRef.current.scrollLeft = scrollLeftRef.current - walk;
  };

  // Touch drag support for mobile / touchpads
  const handleTouchStart = (e: React.TouchEvent) => {
    if (!navRef.current || e.touches.length === 0) return;
    isDownRef.current = true;
    startXRef.current = e.touches[0].pageX - navRef.current.offsetLeft;
    scrollLeftRef.current = navRef.current.scrollLeft;
    hasDraggedRef.current = false;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDownRef.current || !navRef.current || e.touches.length === 0) return;
    const x = e.touches[0].pageX - navRef.current.offsetLeft;
    const walk = (x - startXRef.current) * 1.5;
    if (Math.abs(walk) > 3) {
      hasDraggedRef.current = true;
      setIsDragging(true);
    }
    navRef.current.scrollLeft = scrollLeftRef.current - walk;
  };

  const handleTouchEnd = () => {
    isDownRef.current = false;
    setTimeout(() => {
      hasDraggedRef.current = false;
      setIsDragging(false);
    }, 60);
  };

  // Mouse wheel horizontal scroll support
  const handleWheel = (e: React.WheelEvent) => {
    if (!navRef.current) return;
    if (Math.abs(e.deltaX) > 0) {
      navRef.current.scrollLeft += e.deltaX;
    } else if (Math.abs(e.deltaY) > 0) {
      navRef.current.scrollLeft += e.deltaY;
    }
  };

  const handleTabClick = (tab: NavbarProps['activeTab']) => {
    if (hasDraggedRef.current) return;
    setActiveTab(tab);
  };

  return (
    <header
      className={`sticky top-0 z-40 border-b shadow-md transition-colors duration-200 ${
        isDark
          ? 'bg-slate-900/95 backdrop-blur-md text-white border-slate-800'
          : 'bg-white/95 backdrop-blur-md text-slate-900 border-slate-200 shadow-slate-200/50'
      }`}
    >
      <div className="max-w-7xl mx-auto px-3 sm:px-5 lg:px-8">
        <div className="flex items-center justify-between min-h-16 py-2 gap-3 flex-wrap lg:flex-nowrap">
          {/* Logo & System Title */}
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-tr from-red-600 to-rose-500 text-white shadow-md shadow-red-900/30">
              <Activity className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className={`font-extrabold text-sm sm:text-base tracking-tight flex items-center gap-1.5 ${isDark ? 'text-white' : 'text-slate-900'}`}>
                  {t.appTitle}
                  <span className="text-[10px] sm:text-xs px-2 py-0.5 rounded-full font-bold bg-red-500/20 text-red-500 border border-red-500/30">
                    {t.icuCall}
                  </span>
                </span>
                {/* Real-time Status Badge */}
                <div
                  className={`hidden sm:flex items-center gap-1.5 text-[11px] px-2 py-0.5 rounded-full font-medium ${
                    isConnected
                      ? isDark
                        ? 'bg-emerald-950/60 text-emerald-400 border border-emerald-700/40'
                        : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                      : isDark
                      ? 'bg-rose-950/60 text-rose-400 border border-rose-700/40'
                      : 'bg-rose-50 text-rose-700 border border-rose-200'
                  }`}
                >
                  <span className={`w-1.5 h-1.5 rounded-full ${isConnected ? 'bg-emerald-500 animate-ping' : 'bg-rose-500'}`} />
                  {isConnected ? t.statusOnline : t.statusReconnecting}
                </div>
              </div>
              <p className={`text-[11px] hidden md:block ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{t.appSubTitle}</p>
            </div>
          </div>

          {/* Center Navigation Controls - Drag-to-scroll with Transparent Glass Container */}
          <nav
            ref={navRef}
            onMouseDown={handleMouseDown}
            onMouseLeave={handleMouseLeave}
            onMouseUp={handleMouseUp}
            onMouseMove={handleMouseMove}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
            onWheel={handleWheel}
            className={`flex items-center gap-1.5 p-1 rounded-2xl border overflow-x-auto no-scrollbar select-none transition-all duration-150 ${
              isDragging ? 'cursor-grabbing scale-[0.99] shadow-inner' : 'cursor-grab hover:shadow-xs'
            } ${
              isDark
                ? 'bg-slate-950/40 sm:bg-slate-900/30 backdrop-blur-md border-slate-800/40 hover:border-slate-700/50'
                : 'bg-slate-100/60 sm:bg-white/40 backdrop-blur-md border-slate-200/60 hover:border-slate-300/80'
            }`}
            style={{
              scrollbarWidth: 'none',
              msOverflowStyle: 'none',
              WebkitOverflowScrolling: 'touch',
            }}
          >
            <button
              id="tab-doctor-portal"
              onClick={() => handleTabClick('doctor')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all whitespace-nowrap select-none ${
                activeTab === 'doctor'
                  ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md shadow-blue-900/30'
                  : isDark
                  ? 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
              }`}
            >
              <Stethoscope className="w-3.5 h-3.5" />
              <span>{t.tabDoctor}</span>
              {pendingAlertsCount > 0 && (
                <span className="px-1.5 py-0.2 bg-red-500 text-white rounded-full text-[10px] font-extrabold animate-pulse">
                  {pendingAlertsCount}
                </span>
              )}
            </button>

            <button
              id="tab-nurse-kiosk"
              onClick={() => handleTabClick('nurse')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all whitespace-nowrap select-none ${
                activeTab === 'nurse'
                  ? 'bg-gradient-to-r from-red-600 to-rose-600 text-white shadow-md shadow-red-950/40'
                  : isDark
                  ? 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
              }`}
            >
              <Laptop className="w-3.5 h-3.5" />
              <span>{t.tabNurse}</span>
              {pendingAlertsCount > 0 && (
                <span className="w-2 h-2 rounded-full bg-red-400 animate-ping" />
              )}
            </button>

            {/* Medication Schedule & Google Calendar Sync Tab */}
            <button
              id="tab-medication-calendar"
              onClick={() => handleTabClick('medication')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all whitespace-nowrap select-none ${
                activeTab === 'medication'
                  ? 'bg-gradient-to-r from-cyan-600 to-blue-600 text-white shadow-md shadow-blue-900/30'
                  : isDark
                  ? 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
              }`}
            >
              <Calendar className="w-3.5 h-3.5" />
              <span>{t.tabMedicationCalendar}</span>
            </button>

            {/* Gemini AI Clinical Assistant Tab */}
            <button
              id="tab-ai-assistant"
              onClick={() => handleTabClick('ai')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all whitespace-nowrap select-none ${
                activeTab === 'ai'
                  ? 'bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 text-white shadow-md shadow-purple-950/40 animate-pulse'
                  : isDark
                  ? 'text-indigo-400 hover:text-indigo-200 hover:bg-indigo-950/30 border border-indigo-500/20'
                  : 'text-indigo-700 hover:text-indigo-900 hover:bg-indigo-50/60 border border-indigo-200/60'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-300 animate-spin" />
              <span>{t.tabAiAssistant}</span>
              <span className="text-[9px] px-1 py-0.2 rounded font-bold bg-amber-400/30 text-amber-300 uppercase">
                AI
              </span>
            </button>

            <button
              id="tab-simulator"
              onClick={() => handleTabClick('simulator')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all whitespace-nowrap select-none ${
                activeTab === 'simulator'
                  ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-md shadow-emerald-950/40'
                  : isDark
                  ? 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
              }`}
            >
              <Radio className="w-3.5 h-3.5" />
              <span>{t.tabSimulator}</span>
            </button>

            <button
              id="tab-audit-log"
              onClick={() => handleTabClick('audit')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all whitespace-nowrap select-none ${
                activeTab === 'audit'
                  ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-md shadow-purple-950/40'
                  : isDark
                  ? 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
              }`}
            >
              <Clock className="w-3.5 h-3.5" />
              <span>{t.tabAudit}</span>
            </button>
          </nav>

          {/* Right Action: Google Sheets Sync, Quick Theme & Settings */}
          <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
            {onOpenGoogleSheets && (
              <button
                id="btn-google-sheets-sync"
                onClick={onOpenGoogleSheets}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer ${
                  isDark
                    ? 'bg-emerald-950/40 hover:bg-emerald-900/60 text-emerald-400 border border-emerald-500/30 hover:border-emerald-500/50 backdrop-blur-md'
                    : 'bg-emerald-50/80 hover:bg-emerald-100 text-emerald-700 border border-emerald-300/80 backdrop-blur-md'
                }`}
                title={language === 'vi' ? 'Đồng bộ Google Sheets' : 'Google Sheets Sync'}
              >
                <FileSpreadsheet className="w-4 h-4 text-emerald-500" />
                <span className="hidden md:inline">Google Sheets</span>
              </button>
            )}

            {onOpenGmail && (
              <button
                id="btn-gmail-dispatcher"
                onClick={onOpenGmail}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer ${
                  isDark
                    ? 'bg-rose-950/40 hover:bg-rose-900/60 text-rose-400 border border-rose-500/30 hover:border-rose-500/50 backdrop-blur-md'
                    : 'bg-rose-50/80 hover:bg-rose-100 text-rose-700 border border-rose-300/80 backdrop-blur-md'
                }`}
                title={language === 'vi' ? 'Gửi Email / Y Lệnh Khẩn Cấp qua Gmail' : 'Emergency Dispatch via Gmail'}
              >
                <Mail className="w-4 h-4 text-rose-500" />
                <span className="hidden md:inline">Gmail</span>
              </button>
            )}

            <button
              id="btn-quick-theme-toggle"
              onClick={toggleTheme}
              className={`p-2 rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer flex items-center justify-center ${
                isDark
                  ? 'bg-slate-800/60 hover:bg-slate-700/80 text-amber-400 border border-slate-700/50 hover:text-amber-300 backdrop-blur-md'
                  : 'bg-white/70 hover:bg-white text-indigo-600 border border-slate-300/60 shadow-slate-200/40 backdrop-blur-md'
              }`}
              title={isDark ? (language === 'vi' ? 'Chuyển sang giao diện Sáng' : 'Switch to Light mode') : (language === 'vi' ? 'Chuyển sang giao diện Tối' : 'Switch to Dark mode')}
            >
              {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>

            <button
              id="btn-settings-toggle"
              onClick={onOpenSettings}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer ${
                isDark
                  ? 'bg-slate-800/60 hover:bg-slate-700/80 text-slate-200 border border-slate-700/50 hover:text-white backdrop-blur-md'
                  : 'bg-white/70 hover:bg-white text-slate-700 border border-slate-300/60 shadow-slate-200/40 backdrop-blur-md'
              }`}
              title={t.settingsTitle}
            >
              <Sliders className="w-4 h-4 text-blue-500" />
              <span className="hidden sm:inline">{language === 'vi' ? 'Cài Đặt' : 'Settings'}</span>
            </button>
          </div>
        </div>
      </div>
    </header>
  );
};
