import React, { useState, useMemo } from 'react';
import {
  Activity,
  AlertOctagon,
  AlertTriangle,
  ArrowUpDown,
  BarChart3,
  Building2,
  CheckCircle2,
  ChevronDown,
  Clock,
  DoorClosed,
  Download,
  FileSpreadsheet,
  FileText,
  Filter,
  Heart,
  RotateCcw,
  Search,
  ShieldAlert,
  SlidersHorizontal,
  User,
  X,
} from 'lucide-react';
import { Alert, SystemStats } from '../types';
import { useLanguage } from '../context/LanguageContext';
import { useTheme } from '../context/ThemeContext';
import { HourlyAlertChart } from './HourlyAlertChart';

interface AlertAuditHistoryProps {
  alerts: Alert[];
  stats: SystemStats | null;
  onOpenGoogleSheets?: () => void;
}

export const AlertAuditHistory: React.FC<AlertAuditHistoryProps> = ({ alerts, stats, onOpenGoogleSheets }) => {
  const { t, language } = useLanguage();
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const [searchTerm, setSearchTerm] = useState('');
  const [roomFilter, setRoomFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'Pending' | 'Acknowledged' | 'Resolved'>('ALL');
  const [severityFilter, setSeverityFilter] = useState<'ALL' | 'Fatal' | 'Critical' | 'Warning'>('ALL');
  const [selectedHourFilter, setSelectedHourFilter] = useState<number | null>(null);
  const [selectedAlert, setSelectedAlert] = useState<Alert | null>(null);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [exportNotification, setExportNotification] = useState<string | null>(null);

  // Dynamic unique room numbers with incident counts
  const roomStats = useMemo(() => {
    const roomCountMap: Record<string, number> = {};
    alerts.forEach((a) => {
      if (a.roomNumber) {
        roomCountMap[a.roomNumber] = (roomCountMap[a.roomNumber] || 0) + 1;
      }
    });
    const rooms = Object.keys(roomCountMap).sort((a, b) =>
      a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' })
    );
    return { rooms, roomCountMap };
  }, [alerts]);

  // Severity counts
  const severityCounts = useMemo(() => {
    const counts = { Fatal: 0, Critical: 0, Warning: 0 };
    alerts.forEach((a) => {
      if (a.severity === 'Fatal') counts.Fatal += 1;
      else if (a.severity === 'Critical') counts.Critical += 1;
      else if (a.severity === 'Warning') counts.Warning += 1;
    });
    return counts;
  }, [alerts]);

  // Status counts
  const statusCounts = useMemo(() => {
    const counts = { Pending: 0, Acknowledged: 0, Resolved: 0 };
    alerts.forEach((a) => {
      if (a.status === 'Pending') counts.Pending += 1;
      else if (a.status === 'Acknowledged') counts.Acknowledged += 1;
      else if (a.status === 'Resolved') counts.Resolved += 1;
    });
    return counts;
  }, [alerts]);

  // Filtered alert list
  const filteredAlerts = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();

    return alerts.filter((alert) => {
      const matchSearch =
        !term ||
        alert.patientName.toLowerCase().includes(term) ||
        alert.roomNumber.toLowerCase().includes(term) ||
        alert.patientId.toLowerCase().includes(term) ||
        alert.id.toLowerCase().includes(term) ||
        alert.reason.toLowerCase().includes(term) ||
        (alert.acknowledgedBy && alert.acknowledgedBy.toLowerCase().includes(term)) ||
        (alert.resolvedBy && alert.resolvedBy.toLowerCase().includes(term)) ||
        (alert.resolutionNote && alert.resolutionNote.toLowerCase().includes(term));

      const matchRoom = roomFilter === 'ALL' || alert.roomNumber === roomFilter;
      const matchStatus = statusFilter === 'ALL' || alert.status === statusFilter;
      const matchSeverity = severityFilter === 'ALL' || alert.severity === severityFilter;

      let matchHour = true;
      if (selectedHourFilter !== null) {
        try {
          const alertDate = new Date(alert.createdAt);
          matchHour = !isNaN(alertDate.getTime()) && alertDate.getHours() === selectedHourFilter;
        } catch {
          matchHour = true;
        }
      }

      return matchSearch && matchRoom && matchStatus && matchSeverity && matchHour;
    });
  }, [alerts, searchTerm, roomFilter, statusFilter, severityFilter, selectedHourFilter]);

  // Check if any filter is active
  const hasActiveFilters =
    searchTerm.trim() !== '' ||
    roomFilter !== 'ALL' ||
    severityFilter !== 'ALL' ||
    statusFilter !== 'ALL' ||
    selectedHourFilter !== null;

  // Reset all filters
  const handleResetFilters = () => {
    setSearchTerm('');
    setRoomFilter('ALL');
    setSeverityFilter('ALL');
    setStatusFilter('ALL');
    setSelectedHourFilter(null);
  };

  // Helper for RFC 4180 CSV escaping
  const escapeCSV = (val: string | number | boolean | undefined | null) => {
    if (val === null || val === undefined) return '""';
    const str = String(val);
    return `"${str.replace(/"/g, '""')}"`;
  };

  const triggerDownload = (filename: string, content: string, rowCount: number) => {
    const blob = new Blob(['\uFEFF' + content], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    const msg = language === 'vi'
      ? `Đã xuất ${rowCount} bản ghi cảnh báo thành công: ${filename}`
      : `Successfully exported ${rowCount} alert records: ${filename}`;
    setExportNotification(msg);
    setTimeout(() => setExportNotification(null), 5000);
  };

  // Export to CSV - Filtered View or Full Archive
  const exportAlertsToCSV = (exportMode: 'filtered' | 'all') => {
    setShowExportMenu(false);
    const targetAlerts = exportMode === 'filtered' ? filteredAlerts : alerts;

    const headers = language === 'vi' ? [
      'Mã Cảnh Báo (Alert ID)',
      'Phòng Bệnh',
      'Họ Tên Bệnh Nhân',
      'Mã Hồ Sơ BN',
      'Mức Độ Nguy Kịch',
      'Nhịp Tim (BPM)',
      'SpO2 (%)',
      'Lý Do / Chẩn Đoán Cảnh Báo',
      'Thời Gian Phát Hiện (ISO)',
      'Thời Gian Phát Hiện (Địa Phương)',
      'Trạng Thái Hiện Tại',
      'Thời Gian Tiếp Nhận',
      'Người Tiếp Nhận',
      'Thời Gian Phản Hồi (Giây)',
      'Đạt Chuẩn SLA (<15 Giây)',
      'Tự Động Leo Thang BS Dự Phòng',
      'Thời Gian Hoàn Tất Xử Lý',
      'Bác Sĩ / Điều Dưỡng Xử Lý',
      'Ghi Chú & Can Thiệp Lâm Sàng',
    ] : [
      'Alert ID',
      'Room Number',
      'Patient Name',
      'Patient ID',
      'Severity',
      'Heart Rate (BPM)',
      'SpO2 (%)',
      'Trigger Reason / Diagnosis',
      'Detection Timestamp (ISO)',
      'Detection Timestamp (Local)',
      'Current Status',
      'Acknowledged Timestamp',
      'Acknowledged By',
      'Response Time (Seconds)',
      'SLA Compliance (<15s)',
      'Escalated To Backup Physician',
      'Resolved Timestamp',
      'Resolved By',
      'Clinical Notes & Interventions',
    ];

    const rows = targetAlerts.map((a) => {
      let formattedTime = '';
      try {
        formattedTime = new Date(a.createdAt).toLocaleString(language === 'vi' ? 'vi-VN' : 'en-US');
      } catch {
        formattedTime = a.createdAt;
      }

      const isSlaMet = a.responseTimeSeconds !== undefined && a.responseTimeSeconds <= 15;
      const slaStr = a.responseTimeSeconds !== undefined
        ? (isSlaMet ? (language === 'vi' ? 'ĐẠT (<15s)' : 'PASS (<15s)') : (language === 'vi' ? 'QUÁ HẠN' : 'BREACHED'))
        : (language === 'vi' ? 'Chưa tiếp nhận' : 'Pending');

      return [
        escapeCSV(a.id),
        escapeCSV(a.roomNumber),
        escapeCSV(a.patientName),
        escapeCSV(a.patientId),
        escapeCSV(a.severity),
        a.heartRate !== undefined ? a.heartRate : '',
        a.spO2 !== undefined ? a.spO2 : '',
        escapeCSV(a.reason),
        escapeCSV(a.createdAt),
        escapeCSV(formattedTime),
        escapeCSV(a.status),
        escapeCSV(a.acknowledgedAt || ''),
        escapeCSV(a.acknowledgedBy || ''),
        a.responseTimeSeconds !== undefined ? a.responseTimeSeconds : '',
        escapeCSV(slaStr),
        escapeCSV(a.escalatedToBackup ? (language === 'vi' ? 'Có' : 'Yes') : (language === 'vi' ? 'Không' : 'No')),
        escapeCSV(a.resolvedAt || ''),
        escapeCSV(a.resolvedBy || a.acknowledgedBy || ''),
        escapeCSV(a.resolutionNote || ''),
      ].join(',');
    });

    const csvContent = [headers.join(','), ...rows].join('\r\n');
    const dateStr = new Date().toISOString().substring(0, 10);
    const filename = `icu-alert-audit-${exportMode === 'filtered' ? 'filtered' : 'full-archive'}-${dateStr}.csv`;
    triggerDownload(filename, csvContent, targetAlerts.length);
  };

  // Export Hourly & Shift Analytics Summary CSV
  const exportAnalyticsSummaryCSV = () => {
    setShowExportMenu(false);
    const hourlyBins = Array.from({ length: 24 }, (_, h) => {
      const start = `${h.toString().padStart(2, '0')}:00`;
      const end = `${h.toString().padStart(2, '0')}:59`;
      return {
        hour: h,
        window: `${start} - ${end}`,
        shift: h >= 6 && h < 22 ? (language === 'vi' ? 'Ca Ngày (06h-22h)' : 'Day Shift (06h-22h)') : (language === 'vi' ? 'Ca Đêm (22h-06h)' : 'Night Shift (22h-06h)'),
        total: 0,
        fatal: 0,
        critical: 0,
        warning: 0,
        resolved: 0,
        pending: 0,
        slaMetCount: 0,
      };
    });

    alerts.forEach((a) => {
      try {
        const d = new Date(a.createdAt);
        const h = d.getHours();
        if (h >= 0 && h < 24) {
          const bin = hourlyBins[h];
          bin.total += 1;
          if (a.severity === 'Fatal') bin.fatal += 1;
          else if (a.severity === 'Critical') bin.critical += 1;
          else if (a.severity === 'Warning') bin.warning += 1;

          if (a.status === 'Resolved') bin.resolved += 1;
          else if (a.status === 'Pending') bin.pending += 1;

          if (a.responseTimeSeconds !== undefined && a.responseTimeSeconds <= 15) {
            bin.slaMetCount += 1;
          }
        }
      } catch {}
    });

    const headers = language === 'vi' ? [
      'Khung Giờ',
      'Ca Trực',
      'Tổng Số Cảnh Báo',
      'Báo Động Đỏ (Fatal)',
      'Khẩn Cấp (Critical)',
      'Cảnh Báo (Warning)',
      'Đã Hoàn Tất Xử Lý',
      'Đang Chờ Xử Lý',
      'Tỷ Lệ Đạt SLA Phản Hồi (<15s)',
    ] : [
      'Time Window',
      'Shift',
      'Total Alarms',
      'Fatal (Code Red)',
      'Critical',
      'Warning',
      'Resolved',
      'Pending',
      'SLA Response Compliance (<15s)',
    ];

    const rows = hourlyBins.map((b) => {
      const slaRate = b.total > 0 ? `${Math.round((b.slaMetCount / b.total) * 100)}%` : 'N/A';
      return [
        escapeCSV(b.window),
        escapeCSV(b.shift),
        b.total,
        b.fatal,
        b.critical,
        b.warning,
        b.resolved,
        b.pending,
        escapeCSV(slaRate),
      ].join(',');
    });

    const csvContent = [headers.join(','), ...rows].join('\r\n');
    const dateStr = new Date().toISOString().substring(0, 10);
    const filename = `icu-hourly-shift-analytics-${dateStr}.csv`;
    triggerDownload(filename, csvContent, 24);
  };

  return (
    <div className="space-y-6">
      {/* STATS OVERVIEW CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className={`border rounded-2xl p-5 shadow-lg transition-colors ${
          isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'
        }`}>
          <div className={`flex items-center justify-between text-xs font-semibold uppercase ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
            <span>{t.statTotalAlerts}</span>
            <ShieldAlert className="w-4 h-4 text-blue-500" />
          </div>
          <div className={`text-3xl font-black mt-2 ${isDark ? 'text-white' : 'text-slate-900'}`}>{stats?.totalAlerts || alerts.length}</div>
          <div className={`text-xs mt-1 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
            {language === 'vi' ? 'Đang chờ: ' : 'Pending: '}
            <strong className="text-red-500">{stats?.pendingAlerts || 0}</strong> •{' '}
            {language === 'vi' ? 'Đã xong: ' : 'Resolved: '}
            <strong className="text-emerald-500">{stats?.resolvedAlerts || 0}</strong>
          </div>
        </div>

        <div className={`border rounded-2xl p-5 shadow-lg transition-colors ${
          isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'
        }`}>
          <div className={`flex items-center justify-between text-xs font-semibold uppercase ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
            <span>{t.statAvgResponseTime}</span>
            <Clock className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="text-3xl font-black text-emerald-500 mt-2 font-mono">
            {stats?.avgResponseTimeSeconds || 0}s
          </div>
          <div className={`text-xs mt-1 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
            {language === 'vi' ? 'Mục tiêu phản hồi cấp cứu: ' : 'Target response benchmark: '}
            <strong className={isDark ? 'text-slate-300' : 'text-slate-700'}>&lt; 15s</strong>
          </div>
        </div>

        <div className={`border rounded-2xl p-5 shadow-lg transition-colors ${
          isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'
        }`}>
          <div className={`flex items-center justify-between text-xs font-semibold uppercase ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
            <span>{t.statEscalationRate}</span>
            <AlertTriangle className="w-4 h-4 text-amber-500" />
          </div>
          <div className="text-3xl font-black text-amber-500 mt-2 font-mono">
            {stats && stats.totalAlerts > 0
              ? `${Math.round((stats.escalatedAlertsCount / stats.totalAlerts) * 100)}%`
              : '0%'}
          </div>
          <div className={`text-xs mt-1 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
            {language === 'vi' ? 'Số ca chuyển BS dự phòng: ' : 'Escalated cases: '}
            <strong className={isDark ? 'text-slate-200' : 'text-slate-800'}>{stats?.escalatedAlertsCount || 0}</strong>
          </div>
        </div>

        <div className={`border rounded-2xl p-5 shadow-lg transition-colors ${
          isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'
        }`}>
          <div className={`flex items-center justify-between text-xs font-semibold uppercase ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
            <span>{t.statTotalPackets}</span>
            <Activity className="w-4 h-4 text-purple-500" />
          </div>
          <div className="text-3xl font-black text-purple-500 mt-2 font-mono">
            {stats?.totalVitalsProcessed || 0}
          </div>
          <div className={`text-xs mt-1 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
            {language === 'vi' ? 'Gói telemetry đã tiếp nhận' : 'Telemetry packets processed'}
          </div>
        </div>
      </div>

      {/* HOURLY ALERT FREQUENCY & PEAK HOUR SURGE CHART */}
      <HourlyAlertChart
        alerts={alerts}
        selectedHour={selectedHourFilter}
        onSelectHour={setSelectedHourFilter}
      />

      {/* ACTIVE HOUR FILTER BADGE (IF SELECTED) */}
      {selectedHourFilter !== null && (
        <div className={`flex items-center justify-between px-4 py-2.5 rounded-xl border text-xs animate-in fade-in duration-200 ${
          isDark ? 'bg-indigo-950/50 border-indigo-800/80 text-indigo-200' : 'bg-indigo-50 border-indigo-200 text-indigo-800'
        }`}>
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-indigo-400 shrink-0" />
            <span>
              {language === 'vi'
                ? `Đang lọc danh sách sự cố theo khung giờ: `
                : `Filtering audit log for time window: `}
              <strong className="font-mono font-bold">
                {selectedHourFilter.toString().padStart(2, '0')}:00 - {selectedHourFilter.toString().padStart(2, '0')}:59
              </strong>{' '}
              ({filteredAlerts.length} {language === 'vi' ? 'cảnh báo' : 'alerts'})
            </span>
          </div>
          <button
            onClick={() => setSelectedHourFilter(null)}
            className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-indigo-600/30 hover:bg-indigo-600/50 text-white text-[11px] font-bold transition-all cursor-pointer"
          >
            <X className="w-3 h-3" />
            <span>{language === 'vi' ? 'Xem tất cả' : 'Clear filter'}</span>
          </button>
        </div>
      )}

      {/* EXPORT NOTIFICATION TOAST */}
      {exportNotification && (
        <div className={`p-4 rounded-2xl border shadow-xl flex items-center justify-between gap-3 animate-in fade-in slide-in-from-top-2 duration-300 ${
          isDark ? 'bg-emerald-950/80 border-emerald-800 text-emerald-200' : 'bg-emerald-50 border-emerald-300 text-emerald-900'
        }`}>
          <div className="flex items-center gap-2.5">
            <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
            <span className="text-xs font-semibold">{exportNotification}</span>
          </div>
          <button
            onClick={() => setExportNotification(null)}
            className="p-1 hover:bg-emerald-800/30 rounded-lg text-emerald-400 hover:text-emerald-200 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* FILTER & SEARCH CONTROL PANEL */}
      <div className={`border rounded-2xl p-4 shadow-lg space-y-3 ${
        isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'
      }`}>
        {/* Top Controls Row */}
        <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-2.5">
          {/* Compact Search Bar */}
          <div className="relative flex-1 min-w-[220px]">
            <Search className={`w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none ${
              isDark ? 'text-slate-400' : 'text-slate-400'
            }`} />
            <input
              id="input-search-audit"
              type="text"
              placeholder={t.searchPlaceholder}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className={`w-full h-8.5 border rounded-lg pl-8 pr-8 text-xs transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500/50 ${
                isDark
                  ? 'bg-slate-950 border-slate-700 text-white placeholder:text-slate-500'
                  : 'bg-slate-50 border-slate-300 text-slate-900 placeholder:text-slate-400'
              }`}
            />
            {searchTerm && (
              <button
                id="btn-clear-search"
                onClick={() => setSearchTerm('')}
                className={`absolute right-2 top-1/2 -translate-y-1/2 p-0.5 rounded transition-colors cursor-pointer ${
                  isDark ? 'text-slate-400 hover:text-white hover:bg-slate-800' : 'text-slate-500 hover:text-slate-900 hover:bg-slate-200'
                }`}
                title={language === 'vi' ? 'Xóa tìm kiếm' : 'Clear search'}
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>

          {/* Compact Filter Dropdowns & Export Action Group */}
          <div className="flex items-center gap-1.5 flex-wrap sm:flex-nowrap">
            {/* Room Filter */}
            <div className={`flex items-center gap-1.5 px-2 h-8.5 rounded-lg border text-xs shrink-0 ${
              roomFilter !== 'ALL'
                ? (isDark ? 'bg-indigo-950/50 border-indigo-700 text-indigo-200' : 'bg-indigo-50 border-indigo-300 text-indigo-900')
                : (isDark ? 'bg-slate-950 border-slate-700 text-slate-300' : 'bg-slate-50 border-slate-300 text-slate-700')
            }`}>
              <DoorClosed className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
              <select
                id="select-filter-room"
                value={roomFilter}
                onChange={(e) => setRoomFilter(e.target.value)}
                className="bg-transparent font-medium text-xs focus:outline-none cursor-pointer pr-1"
              >
                <option value="ALL" className={isDark ? 'bg-slate-900 text-white' : 'bg-white text-slate-900'}>
                  {t.filterAllRooms || 'Tất cả phòng'}
                </option>
                {roomStats.rooms.map((rm) => (
                  <option
                    key={rm}
                    value={rm}
                    className={isDark ? 'bg-slate-900 text-white' : 'bg-white text-slate-900'}
                  >
                    {rm} ({roomStats.roomCountMap[rm]})
                  </option>
                ))}
              </select>
            </div>

            {/* Severity Filter */}
            <div className={`flex items-center gap-1.5 px-2 h-8.5 rounded-lg border text-xs shrink-0 ${
              severityFilter !== 'ALL'
                ? (isDark ? 'bg-rose-950/50 border-rose-700 text-rose-200' : 'bg-rose-50 border-rose-300 text-rose-900')
                : (isDark ? 'bg-slate-950 border-slate-700 text-slate-300' : 'bg-slate-50 border-slate-300 text-slate-700')
            }`}>
              <ShieldAlert className="w-3.5 h-3.5 text-rose-400 shrink-0" />
              <select
                id="select-filter-severity"
                value={severityFilter}
                onChange={(e) => setSeverityFilter(e.target.value as any)}
                className="bg-transparent font-medium text-xs focus:outline-none cursor-pointer pr-1"
              >
                <option value="ALL" className={isDark ? 'bg-slate-900 text-white' : 'bg-white text-slate-900'}>
                  {t.filterAllSeverities || 'Tất cả mức độ'}
                </option>
                <option value="Fatal" className={isDark ? 'bg-slate-900 text-rose-400' : 'bg-white text-rose-600'}>
                  🔴 {t.filterFatal || 'Báo Động Đỏ'} ({severityCounts.Fatal})
                </option>
                <option value="Critical" className={isDark ? 'bg-slate-900 text-amber-400' : 'bg-white text-amber-600'}>
                  🟠 {t.filterCritical || 'Khẩn Cấp'} ({severityCounts.Critical})
                </option>
                <option value="Warning" className={isDark ? 'bg-slate-900 text-yellow-400' : 'bg-white text-yellow-600'}>
                  🟡 {t.filterWarning || 'Cảnh Báo'} ({severityCounts.Warning})
                </option>
              </select>
            </div>

            {/* Status Filter */}
            <div className={`flex items-center gap-1.5 px-2 h-8.5 rounded-lg border text-xs shrink-0 ${
              statusFilter !== 'ALL'
                ? (isDark ? 'bg-emerald-950/50 border-emerald-700 text-emerald-200' : 'bg-emerald-50 border-emerald-300 text-emerald-900')
                : (isDark ? 'bg-slate-950 border-slate-700 text-slate-300' : 'bg-slate-50 border-slate-300 text-slate-700')
            }`}>
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              <select
                id="select-filter-status"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as any)}
                className="bg-transparent font-medium text-xs focus:outline-none cursor-pointer pr-1"
              >
                <option value="ALL" className={isDark ? 'bg-slate-900 text-white' : 'bg-white text-slate-900'}>
                  {t.filterAllStatus || 'Tất cả trạng thái'}
                </option>
                <option value="Pending" className={isDark ? 'bg-slate-900 text-rose-400' : 'bg-white text-rose-600'}>
                  ⏳ {t.filterPending || 'Đang chờ'} ({statusCounts.Pending})
                </option>
                <option value="Acknowledged" className={isDark ? 'bg-slate-900 text-amber-400' : 'bg-white text-amber-600'}>
                  ⚡ {t.filterAcknowledged || 'Đã tiếp nhận'} ({statusCounts.Acknowledged})
                </option>
                <option value="Resolved" className={isDark ? 'bg-slate-900 text-emerald-400' : 'bg-white text-emerald-600'}>
                  ✅ {t.filterResolved || 'Đã hoàn tất'} ({statusCounts.Resolved})
                </option>
              </select>
            </div>

            {/* Compact Export CSV Button Group */}
            <div className="relative shrink-0">
              <div className="flex items-center h-8.5">
                <button
                  id="btn-export-csv-quick"
                  onClick={() => exportAlertsToCSV('filtered')}
                  className={`h-full px-2.5 rounded-l-lg text-xs font-semibold transition-colors flex items-center gap-1.5 border border-r-0 whitespace-nowrap cursor-pointer ${
                    isDark
                      ? 'bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white border-slate-700'
                      : 'bg-white hover:bg-slate-50 text-slate-700 hover:text-slate-900 border-slate-300'
                  }`}
                  title={language === 'vi' ? 'Xuất CSV dữ liệu đang lọc' : 'Export current filtered CSV'}
                >
                  <Download className="w-3.5 h-3.5 text-blue-400" />
                  <span>CSV</span>
                  <span className="px-1 py-0.2 rounded text-[10px] bg-blue-500/20 text-blue-400 font-mono font-bold">
                    {filteredAlerts.length}
                  </span>
                </button>

                <button
                  id="btn-export-csv-dropdown-toggle"
                  onClick={() => setShowExportMenu(!showExportMenu)}
                  className={`h-full px-1.5 rounded-r-lg text-xs font-bold transition-colors flex items-center border whitespace-nowrap cursor-pointer ${
                    isDark
                      ? 'bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white border-slate-700'
                      : 'bg-white hover:bg-slate-50 text-slate-700 hover:text-slate-900 border-slate-300'
                  }`}
                  title={language === 'vi' ? 'Tùy chọn xuất báo cáo' : 'Export options'}
                >
                  <ChevronDown className="w-3 h-3" />
                </button>
              </div>

              {/* Dropdown Menu Popup */}
              {showExportMenu && (
                <>
                  <div
                    className="fixed inset-0 z-20"
                    onClick={() => setShowExportMenu(false)}
                  />
                  <div className={`absolute right-0 mt-1.5 w-72 rounded-xl border shadow-2xl p-2 z-30 space-y-1 text-xs animate-in fade-in zoom-in-95 duration-150 ${
                    isDark ? 'bg-slate-900 border-slate-700 text-slate-100 shadow-black/80' : 'bg-white border-slate-200 text-slate-900 shadow-slate-300/80'
                  }`}>
                    <div className={`px-3 py-1 text-[10px] font-bold uppercase tracking-wider border-b ${
                      isDark ? 'text-slate-400 border-slate-800' : 'text-slate-500 border-slate-100'
                    }`}>
                      {language === 'vi' ? 'Định dạng Báo Cáo & Lưu Trữ' : 'Audit & Export Reporting'}
                    </div>

                    {/* Option 1: Filtered alerts */}
                    <button
                      id="btn-export-opt-filtered"
                      onClick={() => exportAlertsToCSV('filtered')}
                      className={`w-full text-left px-2.5 py-2 rounded-lg flex items-center justify-between transition-colors cursor-pointer ${
                        isDark ? 'hover:bg-slate-800 text-slate-200' : 'hover:bg-slate-100 text-slate-800'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <FileSpreadsheet className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                        <div>
                          <div className="font-bold">
                            {language === 'vi' ? 'Danh sách theo bộ lọc' : 'Current Filtered View'}
                          </div>
                          <div className={`text-[10px] ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                            {language === 'vi' ? 'Xuất các dòng đang hiển thị' : 'Export currently visible rows'}
                          </div>
                        </div>
                      </div>
                      <span className="font-mono font-bold text-[11px] text-blue-400">
                        {filteredAlerts.length} ca
                      </span>
                    </button>

                    {/* Option 2: Full database archive */}
                    <button
                      id="btn-export-opt-all"
                      onClick={() => exportAlertsToCSV('all')}
                      className={`w-full text-left px-2.5 py-2 rounded-lg flex items-center justify-between transition-colors cursor-pointer ${
                        isDark ? 'hover:bg-slate-800 text-slate-200' : 'hover:bg-slate-100 text-slate-800'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <FileText className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                        <div>
                          <div className="font-bold">
                            {language === 'vi' ? 'Toàn bộ lịch sử (Lưu trữ)' : 'Full Audit Archive'}
                          </div>
                          <div className={`text-[10px] ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                            {language === 'vi' ? 'Tất cả dữ liệu cảnh báo ICU' : 'All historical alerts recorded'}
                          </div>
                        </div>
                      </div>
                      <span className="font-mono font-bold text-[11px] text-emerald-400">
                        {alerts.length} ca
                      </span>
                    </button>

                    {/* Option 3: Hourly & Shift Summary Analytics */}
                    <button
                      id="btn-export-opt-analytics"
                      onClick={exportAnalyticsSummaryCSV}
                      className={`w-full text-left px-2.5 py-2 rounded-lg flex items-center justify-between transition-colors cursor-pointer ${
                        isDark ? 'hover:bg-slate-800 text-slate-200' : 'hover:bg-slate-100 text-slate-800'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <BarChart3 className="w-3.5 h-3.5 text-purple-400 shrink-0" />
                        <div>
                          <div className="font-bold">
                            {language === 'vi' ? 'Báo cáo tổng hợp theo ca & giờ' : 'Shift & Hourly Summary'}
                          </div>
                          <div className={`text-[10px] ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                            {language === 'vi' ? '24 khung giờ, ca trực & tỷ lệ SLA' : '24h breakdown & SLA rates'}
                          </div>
                        </div>
                      </div>
                      <span className="font-mono font-bold text-[11px] text-purple-400">
                        24 giờ
                      </span>
                    </button>

                    {/* Option 4: Google Sheets Cloud Sync */}
                    {onOpenGoogleSheets && (
                      <button
                        id="btn-export-opt-sheets"
                        onClick={() => {
                          setShowExportMenu(false);
                          onOpenGoogleSheets();
                        }}
                        className={`w-full text-left px-2.5 py-2 rounded-lg flex items-center justify-between transition-colors cursor-pointer border-t ${
                          isDark ? 'hover:bg-emerald-950/40 text-emerald-300 border-slate-800' : 'hover:bg-emerald-50 text-emerald-800 border-slate-100'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                          <div>
                            <div className="font-bold">
                              {language === 'vi' ? 'Đồng bộ Google Sheets' : 'Google Sheets Sync'}
                            </div>
                            <div className={`text-[10px] ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                              {language === 'vi' ? 'Xuất / Cập nhật bảng tính đám mây' : 'Sync alerts to cloud spreadsheet'}
                            </div>
                          </div>
                        </div>
                        <span className="font-mono font-bold text-[11px] text-emerald-400">
                          Cloud
                        </span>
                      </button>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Active Filter Chips & Clear-All Status Bar */}
        <div className={`pt-2.5 border-t flex flex-wrap items-center justify-between gap-2 text-xs ${
          isDark ? 'border-slate-800 text-slate-400' : 'border-slate-100 text-slate-500'
        }`}>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-[11px]">
              {language === 'vi'
                ? `Hiển thị ${filteredAlerts.length} / ${alerts.length} sự cố cảnh báo`
                : `Showing ${filteredAlerts.length} of ${alerts.length} incidents`}
            </span>

            {/* Search Query Chip */}
            {searchTerm.trim() && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-blue-500/15 text-blue-400 border border-blue-500/30 text-[11px]">
                <Search className="w-3 h-3" />
                <span className="font-medium">"{searchTerm.trim()}"</span>
                <button onClick={() => setSearchTerm('')} className="hover:text-blue-200 ml-0.5 cursor-pointer">
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}

            {/* Room Filter Chip */}
            {roomFilter !== 'ALL' && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-indigo-500/15 text-indigo-400 border border-indigo-500/30 text-[11px]">
                <DoorClosed className="w-3 h-3" />
                <span className="font-medium">{roomFilter}</span>
                <button onClick={() => setRoomFilter('ALL')} className="hover:text-indigo-200 ml-0.5 cursor-pointer">
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}

            {/* Severity Filter Chip */}
            {severityFilter !== 'ALL' && (
              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[11px] border ${
                severityFilter === 'Fatal'
                  ? 'bg-rose-500/15 text-rose-400 border-rose-500/30'
                  : severityFilter === 'Critical'
                  ? 'bg-amber-500/15 text-amber-400 border-amber-500/30'
                  : 'bg-yellow-500/15 text-yellow-400 border-yellow-500/30'
              }`}>
                <ShieldAlert className="w-3 h-3" />
                <span className="font-medium">
                  {severityFilter === 'Fatal'
                    ? t.filterFatal
                    : severityFilter === 'Critical'
                    ? t.filterCritical
                    : t.filterWarning}
                </span>
                <button onClick={() => setSeverityFilter('ALL')} className="hover:opacity-75 ml-0.5 cursor-pointer">
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}

            {/* Status Filter Chip */}
            {statusFilter !== 'ALL' && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 text-[11px]">
                <CheckCircle2 className="w-3 h-3" />
                <span className="font-medium">{statusFilter}</span>
                <button onClick={() => setStatusFilter('ALL')} className="hover:text-emerald-200 ml-0.5 cursor-pointer">
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}

            {/* Hour Filter Chip */}
            {selectedHourFilter !== null && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-purple-500/15 text-purple-400 border border-purple-500/30 text-[11px]">
                <Clock className="w-3 h-3" />
                <span className="font-medium">{selectedHourFilter.toString().padStart(2, '0')}:00</span>
                <button onClick={() => setSelectedHourFilter(null)} className="hover:text-purple-200 ml-0.5 cursor-pointer">
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}
          </div>

          {/* Reset All Filters Button */}
          {hasActiveFilters && (
            <button
              id="btn-reset-all-filters"
              onClick={handleResetFilters}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                isDark
                  ? 'bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700'
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-700 hover:text-slate-900 border border-slate-300'
              }`}
            >
              <RotateCcw className="w-3 h-3" />
              <span>{t.resetFilters || 'Đặt lại bộ lọc'}</span>
            </button>
          )}
        </div>
      </div>

      {/* AUDIT TABLE */}
      <div className={`border rounded-2xl shadow-lg overflow-hidden ${
        isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'
      }`}>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className={`border-b font-semibold uppercase tracking-wider text-[11px] ${
              isDark ? 'bg-slate-950/80 text-slate-400 border-slate-800' : 'bg-slate-50 text-slate-500 border-slate-200'
            }`}>
              <tr>
                <th className="py-3 px-4">Mã Cảnh Báo</th>
                <th className="py-3 px-4">{t.tableColPatient}</th>
                <th className="py-3 px-4">{t.tableColVital}</th>
                <th className="py-3 px-4">{t.tableColReason}</th>
                <th className="py-3 px-4">{t.tableColTime}</th>
                <th className="py-3 px-4">{t.acknowledgedBy}</th>
                <th className="py-3 px-4">{t.tableColResponse}</th>
                <th className="py-3 px-4">{t.tableColStatus}</th>
                <th className="py-3 px-4 text-right">{t.tableColActions}</th>
              </tr>
            </thead>

            <tbody className={`divide-y ${isDark ? 'divide-slate-800/60' : 'divide-slate-200'}`}>
              {filteredAlerts.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center">
                    <div className="flex flex-col items-center justify-center gap-3">
                      <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${
                        isDark ? 'bg-slate-800/80 text-slate-500' : 'bg-slate-100 text-slate-400'
                      }`}>
                        <Search className="w-6 h-6" />
                      </div>
                      <div>
                        <div className={`font-bold text-sm ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                          {language === 'vi' ? 'Không tìm thấy sự cố cảnh báo nào phù hợp' : 'No matching alert incidents found'}
                        </div>
                        <div className={`text-xs mt-0.5 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                          {language === 'vi'
                            ? 'Thử thay đổi từ khóa tìm kiếm, phòng bệnh, hoặc đặt lại các bộ lọc'
                            : 'Try adjusting your search terms, room number, or resetting active filters'}
                        </div>
                      </div>
                      {hasActiveFilters && (
                        <button
                          id="btn-empty-state-reset-filters"
                          onClick={handleResetFilters}
                          className="mt-1 flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs shadow-lg transition-colors cursor-pointer"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                          <span>{t.resetFilters || 'Đặt lại bộ lọc'}</span>
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ) : (
                filteredAlerts.map((alert) => (
                  <tr
                    key={alert.id}
                    id={`audit-row-${alert.id}`}
                    onClick={() => setSelectedAlert(alert)}
                    className={`transition-colors cursor-pointer ${
                      isDark ? 'hover:bg-slate-800/50' : 'hover:bg-slate-50'
                    }`}
                  >
                    <td className={`py-3.5 px-4 font-mono font-bold ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>{alert.id}</td>
                    <td className="py-3.5 px-4">
                      <div className={`font-bold text-sm ${isDark ? 'text-white' : 'text-slate-900'}`}>{alert.patientName}</div>
                      <div className={`text-[11px] ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                        {alert.roomNumber} • {t.patientCode} {alert.patientId}
                      </div>
                    </td>
                    <td className="py-3.5 px-4 font-mono">
                      <div className="font-bold text-red-500">{alert.heartRate} BPM</div>
                      {alert.spO2 !== undefined && (
                        <div className={`text-[11px] ${isDark ? 'text-sky-400' : 'text-sky-600'}`}>SpO2: {alert.spO2}%</div>
                      )}
                    </td>
                    <td className="py-3.5 px-4">
                      <span
                        className={`px-2 py-0.5 rounded font-bold text-[11px] ${
                          alert.severity === 'Fatal'
                            ? isDark ? 'bg-red-900/60 text-red-300 border border-red-700/50' : 'bg-red-100 text-red-700 border border-red-200'
                            : alert.severity === 'Critical'
                            ? isDark ? 'bg-amber-900/60 text-amber-300 border border-amber-700/50' : 'bg-amber-100 text-amber-700 border border-amber-200'
                            : isDark ? 'bg-yellow-900/40 text-yellow-300' : 'bg-yellow-100 text-yellow-700'
                        }`}
                      >
                        {alert.severity === 'Fatal' ? t.codeRed : t.criticalAlert}
                      </span>
                    </td>
                    <td className={`py-3.5 px-4 ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
                      {new Date(alert.createdAt).toLocaleTimeString(language === 'vi' ? 'vi-VN' : 'en-US')}{' '}
                      <span className={`text-[10px] block ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                        {new Date(alert.createdAt).toLocaleDateString(language === 'vi' ? 'vi-VN' : 'en-US')}
                      </span>
                    </td>
                    <td className={`py-3.5 px-4 ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
                      {alert.acknowledgedBy ? (
                        <div>
                          <strong className={`font-medium ${isDark ? 'text-white' : 'text-slate-900'}`}>{alert.acknowledgedBy}</strong>
                          {alert.acknowledgedRole && (
                            <span className={`text-[10px] block ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{alert.acknowledgedRole}</span>
                          )}
                        </div>
                      ) : (
                        <span className={`italic ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{language === 'vi' ? 'Chưa tiếp nhận' : 'Unacknowledged'}</span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 font-mono">
                      {alert.responseTimeSeconds !== undefined ? (
                        <span
                          className={`font-bold ${
                            alert.responseTimeSeconds <= 15 ? 'text-emerald-500' : 'text-amber-500'
                          }`}
                        >
                          {alert.responseTimeSeconds}s
                        </span>
                      ) : (
                        <span className={isDark ? 'text-slate-500' : 'text-slate-400'}>-</span>
                      )}
                    </td>
                    <td className="py-3.5 px-4">
                      <span
                        className={`px-2.5 py-1 rounded-full font-bold text-[11px] inline-flex items-center gap-1 ${
                          alert.status === 'Pending'
                            ? isDark ? 'bg-red-950 text-red-400 border border-red-700 animate-pulse' : 'bg-red-100 text-red-700 border border-red-300 animate-pulse'
                            : alert.status === 'Acknowledged'
                            ? isDark ? 'bg-amber-950 text-amber-300 border border-amber-700' : 'bg-amber-100 text-amber-800 border border-amber-300'
                            : isDark ? 'bg-emerald-950 text-emerald-400 border border-emerald-800' : 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                        }`}
                      >
                        <span
                          className={`w-1.5 h-1.5 rounded-full ${
                            alert.status === 'Pending'
                              ? 'bg-red-500'
                              : alert.status === 'Acknowledged'
                              ? 'bg-amber-500'
                              : 'bg-emerald-500'
                          }`}
                        />
                        {alert.status === 'Pending'
                          ? t.filterPending
                          : alert.status === 'Acknowledged'
                          ? t.filterAcknowledged
                          : t.filterResolved}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <button className="text-blue-500 hover:text-blue-600 font-semibold text-xs">{t.btnViewTimeline}</button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* TIMELINE AUDIT MODAL */}
      {selectedAlert && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className={`border rounded-3xl p-6 max-w-xl w-full shadow-2xl space-y-5 animate-in fade-in zoom-in-95 duration-200 ${
            isDark ? 'bg-slate-900 border-slate-800 text-white' : 'bg-white border-slate-200 text-slate-900'
          }`}>
            {/* Header */}
            <div className={`flex items-center justify-between border-b pb-4 ${isDark ? 'border-slate-800' : 'border-slate-200'}`}>
              <div>
                <span className={`text-xs font-mono ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>ID: {selectedAlert.id}</span>
                <h3 className={`text-xl font-bold mt-0.5 ${isDark ? 'text-white' : 'text-slate-900'}`}>
                  Audit Timeline: {selectedAlert.patientName} ({selectedAlert.roomNumber})
                </h3>
              </div>
              <button
                onClick={() => setSelectedAlert(null)}
                className={`p-1.5 rounded-xl ${isDark ? 'text-slate-400 hover:text-white hover:bg-slate-800' : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100'}`}
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Alert Summary Box */}
            <div className={`p-4 rounded-2xl border space-y-2 ${isDark ? 'bg-slate-950 border-slate-800' : 'bg-slate-50 border-slate-200'}`}>
              <div className="flex justify-between items-center text-xs">
                <span className={isDark ? 'text-slate-400' : 'text-slate-500'}>{language === 'vi' ? 'Chỉ số kích hoạt:' : 'Trigger Vitals:'}</span>
                <span className="font-bold text-red-500">{selectedAlert.heartRate} BPM (SpO2: {selectedAlert.spO2 || 98}%)</span>
              </div>
              <p className={`text-sm font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>{selectedAlert.reason}</p>
            </div>

            {/* Audit Step Timeline */}
            <div className={`space-y-4 relative before:absolute before:left-3.5 before:top-2 before:bottom-2 before:w-0.5 ${
              isDark ? 'before:bg-slate-800' : 'before:bg-slate-200'
            }`}>
              {/* Step 1: Trigger */}
              <div className="flex items-start gap-4 relative">
                <div className="w-7 h-7 rounded-full bg-red-600 flex items-center justify-center text-white text-xs font-bold shrink-0 z-10">
                  1
                </div>
                <div>
                  <div className={`font-bold text-sm ${isDark ? 'text-white' : 'text-slate-900'}`}>
                    {language === 'vi' ? 'Phát Hiện Chỉ Số Bất Thường' : 'Vital Abnormality Detected'}
                  </div>
                  <div className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                    {language === 'vi' ? 'Phát hiện lúc ' : 'Recorded at '}
                    {new Date(selectedAlert.createdAt).toLocaleString(language === 'vi' ? 'vi-VN' : 'en-US')}
                  </div>
                  <div className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                    {language === 'vi'
                      ? 'Phát cảnh báo đồng thời đến bác sĩ trực ca và trạm điều dưỡng.'
                      : 'Dispatched emergency alert to On-Duty Doctors and Nurse Station Kiosk.'}
                  </div>
                </div>
              </div>

              {/* Step 2: Escalation (if happened) */}
              {selectedAlert.escalatedToBackup && (
                <div className="flex items-start gap-4 relative">
                  <div className="w-7 h-7 rounded-full bg-amber-600 flex items-center justify-center text-white text-xs font-bold shrink-0 z-10">
                    2
                  </div>
                  <div>
                    <div className="font-bold text-amber-500 text-sm">
                      {language === 'vi' ? 'Tự Động Chuyển Bác Sĩ Dự Phòng' : 'Automatic Escalation to Backup Doctor'}
                    </div>
                    <div className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                      {language === 'vi'
                        ? 'Do vượt quá thời gian chờ, hệ thống đã leo thang gửi thông báo khẩn cấp đến bác sĩ dự phòng.'
                        : 'Escalation triggered after timeout: dispatched alert to secondary on-call backup doctor.'}
                    </div>
                  </div>
                </div>
              )}

              {/* Step 3: Acknowledge */}
              <div className="flex items-start gap-4 relative">
                <div
                  className={`w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0 z-10 ${
                    selectedAlert.acknowledgedAt ? 'bg-emerald-600' : isDark ? 'bg-slate-700 text-slate-400' : 'bg-slate-300 text-slate-600'
                  }`}
                >
                  3
                </div>
                <div>
                  <div className={`font-bold text-sm ${isDark ? 'text-white' : 'text-slate-900'}`}>
                    {language === 'vi' ? 'Tiếp Nhận Xử Lý' : 'Doctor Acknowledgment'}
                  </div>
                  {selectedAlert.acknowledgedAt ? (
                    <div className={`text-xs ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
                      {language === 'vi' ? 'Người tiếp nhận: ' : 'Acknowledged by: '}
                      <strong className={isDark ? 'text-white' : 'text-slate-900'}>{selectedAlert.acknowledgedBy}</strong>{' '}
                      {language === 'vi' ? 'lúc ' : 'at '}
                      {new Date(selectedAlert.acknowledgedAt).toLocaleTimeString(language === 'vi' ? 'vi-VN' : 'en-US')} (
                      {language === 'vi' ? 'Phản hồi trong ' : 'Response time: '}
                      <strong className="text-emerald-500">{selectedAlert.responseTimeSeconds}s</strong>).
                    </div>
                  ) : (
                    <div className="text-xs text-amber-500 italic">
                      {language === 'vi' ? 'Đang chờ nhân viên y tế bấm tiếp nhận...' : 'Awaiting clinical response...'}
                    </div>
                  )}
                </div>
              </div>

              {/* Step 4: Resolve */}
              <div className="flex items-start gap-4 relative">
                <div
                  className={`w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0 z-10 ${
                    selectedAlert.resolvedAt ? 'bg-blue-600' : isDark ? 'bg-slate-700 text-slate-400' : 'bg-slate-300 text-slate-600'
                  }`}
                >
                  4
                </div>
                <div>
                  <div className={`font-bold text-sm ${isDark ? 'text-white' : 'text-slate-900'}`}>
                    {language === 'vi' ? 'Hoàn Tất Xử Lý Lâm Sàng' : 'Clinical Resolution'}
                  </div>
                  {selectedAlert.resolvedAt ? (
                    <div className={`text-xs ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
                      {language === 'vi' ? 'Bác sĩ khám: ' : 'Resolved by: '}
                      <strong className={isDark ? 'text-white' : 'text-slate-900'}>{selectedAlert.resolvedBy}</strong>{' '}
                      {language === 'vi' ? 'lúc ' : 'at '}
                      {new Date(selectedAlert.resolvedAt).toLocaleTimeString(language === 'vi' ? 'vi-VN' : 'en-US')}
                      <div className={`text-xs mt-1 italic ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                        "{selectedAlert.resolutionNote || (language === 'vi' ? 'Bệnh nhân đã ổn định' : 'Patient stabilized')}"
                      </div>
                    </div>
                  ) : (
                    <div className={`text-xs ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                      {language === 'vi' ? 'Chưa hoàn tất can thiệp lâm sàng.' : 'Clinical intervention pending completion.'}
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                onClick={() => setSelectedAlert(null)}
                className={`px-5 py-2 font-bold text-xs rounded-xl ${
                  isDark ? 'bg-slate-800 hover:bg-slate-700 text-white' : 'bg-slate-200 hover:bg-slate-300 text-slate-800'
                }`}
              >
                {t.btnClose}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
