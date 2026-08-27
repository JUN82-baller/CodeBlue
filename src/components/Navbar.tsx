import React, { useRef, useState } from 'react';
import {
  Activity,
  Calendar,
  Clock,
  Laptop,
  Moon,
  Pill,
  Radio,
  Sliders,
  Stethoscope,
  Sun,
  Users,
} from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import { useTheme } from '../context/ThemeContext';

interface NavbarProps {
  activeTab: 'doctor' | 'nurse' | 'medication' | 'simulator' | 'audit' | 'admin' | 'settings';
  setActiveTab: (tab: 'doctor' | 'nurse' | 'medication' | 'simulator' | 'audit' | 'admin' | 'settings') => void;
  onOpenSettings: () => void;
  isConnected: boolean;
  pendingAlertsCount: number;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  setActiveTab,
  onOpenSettings,
  isConnected,
  pendingAlertsCount,
}) => {
  const { language, t } = useLanguage();
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === 'dark';

  // Mouse Drag-to-Scroll handlers for Navigation Bar
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
    if (Math.abs(walk) > 4) {
      hasDraggedRef.current = true;
      setIsDragging(true);
    }
    navRef.current.scrollLeft = scrollLeftRef.current - walk;
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

          {/* Center Navigation Controls - Drag-to-scroll with no scrollbar */}
          <nav
            ref={navRef}
            onMouseDown={handleMouseDown}
            onMouseLeave={handleMouseLeave}
            onMouseUp={handleMouseUp}
            onMouseMove={handleMouseMove}
            className={`flex items-center gap-1 p-1 rounded-2xl border overflow-x-auto no-scrollbar shadow-inner select-none transition-all ${
              isDragging ? 'cursor-grabbing' : 'cursor-grab'
            } ${
              isDark ? 'bg-slate-950/80 border-slate-800/80' : 'bg-slate-100 border-slate-200'
            }`}
          >
            <button
              id="tab-doctor-portal"
              onClick={() => handleTabClick('doctor')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all whitespace-nowrap select-none ${
                activeTab === 'doctor'
                  ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md shadow-blue-900/30'
                  : isDark
                  ? 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
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
                  ? 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
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
                  ? 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
              }`}
            >
              <Calendar className="w-3.5 h-3.5" />
              <span>{t.tabMedicationCalendar}</span>
            </button>

            <button
              id="tab-simulator"
              onClick={() => handleTabClick('simulator')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all whitespace-nowrap select-none ${
                activeTab === 'simulator'
                  ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-md shadow-emerald-950/40'
                  : isDark
                  ? 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
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
                  ? 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
              }`}
            >
              <Clock className="w-3.5 h-3.5" />
              <span>{t.tabAudit}</span>
            </button>

            {/* Admin Personnel Management Tab */}
            <button
              id="tab-staff-admin"
              onClick={() => handleTabClick('admin')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all whitespace-nowrap select-none ${
                activeTab === 'admin'
                  ? 'bg-gradient-to-r from-violet-600 to-indigo-600 text-white shadow-md shadow-indigo-900/30'
                  : isDark
                  ? 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
              }`}
            >
              <Users className="w-3.5 h-3.5" />
              <span>{t.tabStaffAdmin}</span>
            </button>
          </nav>

          {/* Right Action: Clean Settings & Theme Toggle Button */}
          <div className="flex items-center gap-2">
            <button
              id="btn-quick-theme-toggle"
              onClick={toggleTheme}
              className={`p-2 rounded-xl text-xs font-bold transition-all shadow-sm cursor-pointer flex items-center justify-center ${
                isDark
                  ? 'bg-slate-800 hover:bg-slate-700 text-amber-400 border border-slate-700/80 hover:text-amber-300'
                  : 'bg-white hover:bg-slate-50 text-indigo-600 border border-slate-300/80 shadow-slate-200/60'
              }`}
              title={isDark ? (language === 'vi' ? 'Chuyển sang giao diện Sáng' : 'Switch to Light mode') : (language === 'vi' ? 'Chuyển sang giao diện Tối' : 'Switch to Dark mode')}
            >
              {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>

            <button
              id="btn-settings-toggle"
              onClick={onOpenSettings}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all shadow-sm cursor-pointer ${
                isDark
                  ? 'bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700/80 hover:text-white'
                  : 'bg-white hover:bg-slate-50 text-slate-700 border border-slate-300/80 shadow-slate-200/60'
              }`}
              title={t.settingsTitle}
            >
              <Sliders className="w-4 h-4 text-blue-500" />
              <span>{language === 'vi' ? 'Cài Đặt' : 'Settings'}</span>
            </button>
          </div>
        </div>
      </div>
    </header>
  );
};
