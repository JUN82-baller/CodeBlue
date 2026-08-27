import React, { useState, useMemo } from 'react';
import {
  Activity,
  AlertOctagon,
  AlertTriangle,
  ArrowUpDown,
  CheckCircle2,
  Clock,
  Download,
  FileSpreadsheet,
  Filter,
  Heart,
  Search,
  ShieldAlert,
  User,
  X,
} from 'lucide-react';
import { Alert, SystemStats } from '../types';
import { useLanguage } from '../context/LanguageContext';
import { useTheme } from '../context/ThemeContext';

interface AlertAuditHistoryProps {
  alerts: Alert[];
  stats: SystemStats | null;
}

export const AlertAuditHistory: React.FC<AlertAuditHistoryProps> = ({ alerts, stats }) => {
  const { t, language } = useLanguage();
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'Pending' | 'Acknowledged' | 'Resolved'>('ALL');
  const [severityFilter, setSeverityFilter] = useState<'ALL' | 'Fatal' | 'Critical' | 'Warning'>('ALL');
  const [selectedAlert, setSelectedAlert] = useState<Alert | null>(null);

  // Filtered alert list
  const filteredAlerts = useMemo(() => {
    return alerts.filter((alert) => {
      const matchSearch =
        alert.patientName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        alert.roomNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
        alert.id.toLowerCase().includes(searchTerm.toLowerCase());

      const matchStatus = statusFilter === 'ALL' || alert.status === statusFilter;
      const matchSeverity = severityFilter === 'ALL' || alert.severity === severityFilter;

      return matchSearch && matchStatus && matchSeverity;
    });
  }, [alerts, searchTerm, statusFilter, severityFilter]);

  // Export to CSV
  const exportToCSV = () => {
    const headers = language === 'vi' ? [
      'Mã Alert',
      'Phòng',
      'Bệnh nhân',
      'Mã BN',
      'Mức độ',
      'Nhịp tim (BPM)',
      'SpO2 (%)',
      'Lý do cảnh báo',
      'Thời gian phát hiện',
      'Trạng thái',
      'Thời gian tiếp nhận',
      'Người tiếp nhận',
      'Thời gian phản hồi (s)',
      'Chuyển dự phòng',
      'Thời gian giải quyết',
      'Ghi chú xử lý',
    ] : [
      'Alert ID',
      'Room',
      'Patient Name',
      'Patient ID',
      'Severity',
      'Heart Rate (BPM)',
      'SpO2 (%)',
      'Reason',
      'Detected At',
      'Status',
      'Acknowledged At',
      'Acknowledged By',
      'Response Time (s)',
      'Escalated To Backup',
      'Resolved At',
      'Resolution Notes',
    ];

    const rows = filteredAlerts.map((a) => [
      a.id,
      a.roomNumber,
      `"${a.patientName}"`,
      a.patientId,
      a.severity,
      a.heartRate,
      a.spO2 || '',
      `"${a.reason}"`,
      a.createdAt,
      a.status,
      a.acknowledgedAt || '',
      `"${a.acknowledgedBy || ''}"`,
      a.responseTimeSeconds !== undefined ? a.responseTimeSeconds : '',
      a.escalatedToBackup ? (language === 'vi' ? 'Có' : 'Yes') : (language === 'vi' ? 'Không' : 'No'),
      a.resolvedAt || '',
      `"${a.resolutionNote || ''}"`,
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `alert-audit-log-${new Date().toISOString().substring(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
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
            <span>{t.statVitalsProcessed}</span>
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

      {/* FILTER & SEARCH BAR */}
      <div className={`border rounded-2xl p-4 shadow-lg flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4 ${
        isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'
      }`}>
        {/* Search */}
        <div className="relative flex-1">
          <Search className={`w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 ${isDark ? 'text-slate-400' : 'text-slate-400'}`} />
          <input
            type="text"
            placeholder={t.searchPlaceholder}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className={`w-full border rounded-xl pl-9 pr-4 py-2 text-xs focus:outline-none focus:border-blue-500 ${
              isDark ? 'bg-slate-950 border-slate-700 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'
            }`}
          />
        </div>

        {/* Status Filters */}
        <div className="flex items-center gap-2 overflow-x-auto">
          <div className={`flex items-center gap-1 p-1 rounded-xl border text-xs ${
            isDark ? 'bg-slate-950 border-slate-800' : 'bg-slate-100 border-slate-200'
          }`}>
            {(['ALL', 'Pending', 'Acknowledged', 'Resolved'] as const).map((st) => (
              <button
                key={st}
                onClick={() => setStatusFilter(st)}
                className={`px-3 py-1.5 rounded-lg font-bold transition-all whitespace-nowrap ${
                  statusFilter === st
                    ? 'bg-blue-600 text-white shadow'
                    : isDark
                    ? 'text-slate-400 hover:text-white'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {st === 'ALL'
                  ? t.filterAll
                  : st === 'Pending'
                  ? t.filterPending
                  : st === 'Acknowledged'
                  ? t.filterAck
                  : t.filterResolved}
              </button>
            ))}
          </div>

          {/* Export CSV Button */}
          <button
            onClick={exportToCSV}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5 border whitespace-nowrap shadow cursor-pointer ${
              isDark
                ? 'bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white border-slate-700'
                : 'bg-white hover:bg-slate-50 text-slate-700 hover:text-slate-900 border-slate-300'
            }`}
            title="Download CSV audit log"
          >
            <Download className="w-3.5 h-3.5" />
            <span>{t.btnExportCSV}</span>
          </button>
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
                <th className="py-3 px-4">{t.colAlertId}</th>
                <th className="py-3 px-4">{t.colRoomPatient}</th>
                <th className="py-3 px-4">{t.colVitals}</th>
                <th className="py-3 px-4">{t.colSeverity}</th>
                <th className="py-3 px-4">{t.colDetectedTime}</th>
                <th className="py-3 px-4">{t.colAckBy}</th>
                <th className="py-3 px-4">{t.colResponseTimeSec}</th>
                <th className="py-3 px-4">{t.colStatus}</th>
                <th className="py-3 px-4 text-right">{t.colDetails}</th>
              </tr>
            </thead>

            <tbody className={`divide-y ${isDark ? 'divide-slate-800/60' : 'divide-slate-200'}`}>
              {filteredAlerts.length === 0 ? (
                <tr>
                  <td colSpan={9} className={`py-8 text-center ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                    {t.noAlertsFound}
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
                          ? t.filterAck
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
