import React, { useState, useMemo } from 'react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  Cell,
} from 'recharts';
import {
  AlertCircle,
  BarChart3,
  Clock,
  Flame,
  Layers,
  Moon,
  ShieldAlert,
  Sun,
  TrendingUp,
  Users,
  Zap,
} from 'lucide-react';
import { Alert } from '../types';
import { useLanguage } from '../context/LanguageContext';
import { useTheme } from '../context/ThemeContext';

interface HourlyAlertChartProps {
  alerts: Alert[];
  selectedHour?: number | null;
  onSelectHour?: (hour: number | null) => void;
}

interface HourlyDataPoint {
  hour: number;
  hourLabel: string;
  displayLabel: string;
  timeWindow: string;
  total: number;
  fatal: number;
  critical: number;
  warning: number;
  pending: number;
  resolved: number;
  acknowledged: number;
  isPeak: boolean;
  alertList: Alert[];
  patientNames: string[];
  rooms: string[];
}

export const HourlyAlertChart: React.FC<HourlyAlertChartProps> = ({
  alerts,
  selectedHour = null,
  onSelectHour,
}) => {
  const { t, language } = useLanguage();
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  const [viewMode, setViewMode] = useState<'24h' | 'active'>('24h');
  const [displayMode, setDisplayMode] = useState<'stacked' | 'total'>('stacked');

  // Compute 24-hour distribution
  const { hourlyData, peakHourInfo, dayShiftCount, nightShiftCount, totalAlertsCount } = useMemo(() => {
    const bins: HourlyDataPoint[] = Array.from({ length: 24 }, (_, h) => {
      const startStr = `${h.toString().padStart(2, '0')}:00`;
      const endStr = `${h.toString().padStart(2, '0')}:59`;
      return {
        hour: h,
        hourLabel: startStr,
        displayLabel: `${h}h`,
        timeWindow: `${startStr} - ${endStr}`,
        total: 0,
        fatal: 0,
        critical: 0,
        warning: 0,
        pending: 0,
        resolved: 0,
        acknowledged: 0,
        isPeak: false,
        alertList: [],
        patientNames: [],
        rooms: [],
      };
    });

    alerts.forEach((alert) => {
      try {
        const date = new Date(alert.createdAt);
        if (!isNaN(date.getTime())) {
          const hour = date.getHours();
          if (hour >= 0 && hour < 24) {
            const bin = bins[hour];
            bin.total += 1;
            if (alert.severity === 'Fatal') bin.fatal += 1;
            else if (alert.severity === 'Critical') bin.critical += 1;
            else if (alert.severity === 'Warning') bin.warning += 1;

            if (alert.status === 'Pending') bin.pending += 1;
            else if (alert.status === 'Acknowledged') bin.acknowledged += 1;
            else if (alert.status === 'Resolved') bin.resolved += 1;

            bin.alertList.push(alert);
            if (alert.patientName && !bin.patientNames.includes(alert.patientName)) {
              bin.patientNames.push(alert.patientName);
            }
            if (alert.roomNumber && !bin.rooms.includes(alert.roomNumber)) {
              bin.rooms.push(alert.roomNumber);
            }
          }
        }
      } catch (err) {
        console.warn('Error parsing alert timestamp:', err);
      }
    });

    // Identify Peak Hour(s)
    let maxCount = 0;
    bins.forEach((b) => {
      if (b.total > maxCount) maxCount = b.total;
    });

    if (maxCount > 0) {
      bins.forEach((b) => {
        if (b.total === maxCount) {
          b.isPeak = true;
        }
      });
    }

    const peakBins = bins.filter((b) => b.isPeak);
    const peakHourInfo = {
      maxCount,
      peakHours: peakBins.map((b) => b.hour),
      peakLabels: peakBins.map((b) => b.timeWindow).join(', '),
      peakFatalCount: peakBins.reduce((sum, b) => sum + b.fatal, 0),
    };

    // Calculate Shift distribution
    let dayCount = 0; // 06:00 to 21:59
    let nightCount = 0; // 22:00 to 05:59
    bins.forEach((b) => {
      if (b.hour >= 6 && b.hour < 22) {
        dayCount += b.total;
      } else {
        nightCount += b.total;
      }
    });

    return {
      hourlyData: bins,
      peakHourInfo,
      dayShiftCount: dayCount,
      nightShiftCount: nightCount,
      totalAlertsCount: alerts.length,
    };
  }, [alerts]);

  // Filtered dataset for rendering based on viewMode
  const chartData = useMemo(() => {
    if (viewMode === 'active') {
      const active = hourlyData.filter((d) => d.total > 0);
      return active.length > 0 ? active : hourlyData;
    }
    return hourlyData;
  }, [hourlyData, viewMode]);

  // Average alerts per active hour
  const activeHoursCount = hourlyData.filter((d) => d.total > 0).length || 1;
  const avgPerHour = (totalAlertsCount / activeHoursCount).toFixed(1);

  // Custom Chart Tooltip
  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data: HourlyDataPoint = payload[0].payload;
      return (
        <div
          className={`p-3.5 rounded-2xl border shadow-2xl text-xs space-y-2 min-w-[220px] backdrop-blur-md transition-all ${
            isDark
              ? 'bg-slate-900/95 border-slate-700 text-slate-100 shadow-black/80'
              : 'bg-white/95 border-slate-200 text-slate-900 shadow-slate-300/80'
          }`}
        >
          {/* Header */}
          <div className="flex items-center justify-between gap-2 border-b border-slate-700/30 pb-2">
            <div className="flex items-center gap-1.5 font-bold text-sm">
              <Clock className="w-4 h-4 text-blue-400" />
              <span>{data.timeWindow}</span>
            </div>
            {data.isPeak && (
              <span className="flex items-center gap-1 text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-400 border border-rose-500/40 animate-pulse">
                <Flame className="w-3 h-3 text-rose-500" />
                {t.peakHourBadge || 'Cao điểm'}
              </span>
            )}
          </div>

          {/* Total & Summary */}
          <div className="flex items-center justify-between text-xs font-semibold">
            <span className={isDark ? 'text-slate-400' : 'text-slate-500'}>
              {language === 'vi' ? 'Tổng số cảnh báo:' : 'Total Alarms:'}
            </span>
            <span className="font-extrabold text-blue-400 text-sm font-mono">{data.total} ca</span>
          </div>

          {/* Severity Breakdown */}
          {data.total > 0 ? (
            <div className="space-y-1 pt-1 border-t border-slate-700/20 text-[11px]">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-rose-400 font-semibold">
                  <span className="w-2 h-2 rounded-full bg-rose-500" />
                  {t.chartFatalSeverity || 'Báo Động Đỏ (Fatal)'}:
                </span>
                <span className="font-bold font-mono">{data.fatal}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-amber-400 font-semibold">
                  <span className="w-2 h-2 rounded-full bg-amber-500" />
                  {t.chartCriticalSeverity || 'Khẩn Cấp (Critical)'}:
                </span>
                <span className="font-bold font-mono">{data.critical}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-yellow-400 font-semibold">
                  <span className="w-2 h-2 rounded-full bg-yellow-400" />
                  {t.chartWarningSeverity || 'Cảnh Báo (Warning)'}:
                </span>
                <span className="font-bold font-mono">{data.warning}</span>
              </div>

              {/* Status breakdown */}
              <div className="flex items-center justify-between pt-1 text-[10px] text-slate-400">
                <span>{language === 'vi' ? 'Đã hoàn tất / Đang chờ:' : 'Resolved / Pending:'}</span>
                <span className="font-mono">
                  <strong className="text-emerald-400">{data.resolved}</strong> /{' '}
                  <strong className="text-rose-400">{data.pending}</strong>
                </span>
              </div>

              {/* Patient and Room tags */}
              {data.rooms.length > 0 && (
                <div className="pt-1.5 text-[10px]">
                  <span className="text-slate-400 block mb-0.5">
                    {language === 'vi' ? 'Phòng ghi nhận sự cố:' : 'Affected Rooms:'}
                  </span>
                  <div className="flex flex-wrap gap-1">
                    {data.rooms.map((r, rIdx) => (
                      <span
                        key={rIdx}
                        className="px-1.5 py-0.2 rounded bg-blue-500/15 text-blue-400 font-mono text-[9px] border border-blue-500/30"
                      >
                        {r}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <p className="text-[11px] text-slate-500 italic">
              {language === 'vi' ? 'Không có sự cố trong khung giờ này' : 'No alarms recorded in this hour'}
            </p>
          )}
        </div>
      );
    }
    return null;
  };

  return (
    <div
      id="hourly-alert-analysis-card"
      className={`border rounded-2xl p-5 shadow-xl transition-all ${
        isDark ? 'bg-slate-900/95 border-slate-800 text-slate-100' : 'bg-white border-slate-200 text-slate-900'
      }`}
    >
      {/* Top Header & Interactive Toggles */}
      <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 pb-4 border-b border-slate-800/40">
        <div className="space-y-1">
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center justify-center w-8 h-8 rounded-xl bg-gradient-to-tr from-rose-600 to-amber-600 text-white shadow-md shadow-rose-950/40">
              <BarChart3 className="w-4 h-4" />
            </div>
            <h3 className="text-base sm:text-lg font-black tracking-tight flex items-center gap-2">
              {t.hourlyChartTitle || 'Phân Bổ Tần Suất Cảnh Báo Theo Giờ Trong Ngày'}
            </h3>
            {peakHourInfo.maxCount > 0 && (
              <span className="flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-black bg-rose-500/20 text-rose-400 border border-rose-500/40 shadow-sm animate-pulse">
                <Flame className="w-3.5 h-3.5 text-rose-500" />
                <span>
                  {t.peakHourBadge || 'Cao Điểm'}: {peakHourInfo.peakLabels} ({peakHourInfo.maxCount} ca)
                </span>
              </span>
            )}
          </div>
          <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
            {t.hourlyChartSubtitle ||
              'Thống kê số lượng cảnh báo theo 24 khung giờ giúp khoa cấp cứu nhận diện thời điểm cao điểm và phân bổ nhân lực trực'}
          </p>
        </div>

        {/* View Mode and Display Mode Selectors */}
        <div className="flex items-center gap-2 flex-wrap self-stretch lg:self-auto justify-end">
          {/* Display Mode (Stacked by Severity vs Total) */}
          <div
            className={`flex items-center gap-1 p-1 rounded-xl border text-xs ${
              isDark ? 'bg-slate-950 border-slate-800' : 'bg-slate-100 border-slate-200'
            }`}
          >
            <button
              id="btn-chart-mode-stacked"
              onClick={() => setDisplayMode('stacked')}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                displayMode === 'stacked'
                  ? 'bg-blue-600 text-white shadow'
                  : isDark
                  ? 'text-slate-400 hover:text-white'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
              title="Phân tầng theo mức độ (Fatal, Critical, Warning)"
            >
              <Layers className="w-3 h-3" />
              <span>{t.chartStackSeverity || 'Phân tầng mức độ'}</span>
            </button>

            <button
              id="btn-chart-mode-total"
              onClick={() => setDisplayMode('total')}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                displayMode === 'total'
                  ? 'bg-blue-600 text-white shadow'
                  : isDark
                  ? 'text-slate-400 hover:text-white'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
              title="Xem tổng số lượng cảnh báo"
            >
              <TrendingUp className="w-3 h-3" />
              <span>{t.chartTotalVolume || 'Tổng số ca'}</span>
            </button>
          </div>

          {/* 24h vs Active Hours View Filter */}
          <div
            className={`flex items-center gap-1 p-1 rounded-xl border text-xs ${
              isDark ? 'bg-slate-950 border-slate-800' : 'bg-slate-100 border-slate-200'
            }`}
          >
            <button
              id="btn-chart-view-24h"
              onClick={() => setViewMode('24h')}
              className={`px-2.5 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                viewMode === '24h'
                  ? 'bg-indigo-600 text-white shadow'
                  : isDark
                  ? 'text-slate-400 hover:text-white'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {t.chartViewAll24h || '24 Giờ'}
            </button>
            <button
              id="btn-chart-view-active"
              onClick={() => setViewMode('active')}
              className={`px-2.5 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                viewMode === 'active'
                  ? 'bg-indigo-600 text-white shadow'
                  : isDark
                  ? 'text-slate-400 hover:text-white'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {t.chartViewActiveOnly || 'Giờ có sự cố'}
            </button>
          </div>
        </div>
      </div>

      {/* Clinical Shift Insights Micro-KPI Banner */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 my-4">
        {/* Peak Window */}
        <div
          className={`p-3 rounded-xl border flex items-center gap-3 transition-colors ${
            isDark ? 'bg-slate-950/60 border-slate-800' : 'bg-slate-50 border-slate-200'
          }`}
        >
          <div className="w-8 h-8 rounded-lg bg-rose-500/20 text-rose-400 flex items-center justify-center font-bold">
            <Flame className="w-4 h-4 text-rose-500" />
          </div>
          <div className="min-w-0">
            <span className={`text-[10px] uppercase font-bold tracking-wider ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
              {t.peakHourBadge || 'Cao Điểm'}
            </span>
            <p className="text-xs font-black truncate text-rose-400">
              {peakHourInfo.maxCount > 0 ? `${peakHourInfo.peakLabels}` : t.peakHourNone || 'Chưa ghi nhận'}
            </p>
          </div>
        </div>

        {/* Day Shift Volume */}
        <div
          className={`p-3 rounded-xl border flex items-center gap-3 transition-colors ${
            isDark ? 'bg-slate-950/60 border-slate-800' : 'bg-slate-50 border-slate-200'
          }`}
        >
          <div className="w-8 h-8 rounded-lg bg-amber-500/20 text-amber-400 flex items-center justify-center font-bold">
            <Sun className="w-4 h-4 text-amber-500" />
          </div>
          <div className="min-w-0">
            <span className={`text-[10px] uppercase font-bold tracking-wider ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
              {t.chartDayShift || 'Ca Ngày (06h-22h)'}
            </span>
            <p className="text-xs font-black truncate text-amber-400 font-mono">
              {dayShiftCount} ca ({totalAlertsCount > 0 ? Math.round((dayShiftCount / totalAlertsCount) * 100) : 0}%)
            </p>
          </div>
        </div>

        {/* Night Shift Volume */}
        <div
          className={`p-3 rounded-xl border flex items-center gap-3 transition-colors ${
            isDark ? 'bg-slate-950/60 border-slate-800' : 'bg-slate-50 border-slate-200'
          }`}
        >
          <div className="w-8 h-8 rounded-lg bg-indigo-500/20 text-indigo-400 flex items-center justify-center font-bold">
            <Moon className="w-4 h-4 text-indigo-400" />
          </div>
          <div className="min-w-0">
            <span className={`text-[10px] uppercase font-bold tracking-wider ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
              {t.chartNightShift || 'Ca Đêm (22h-06h)'}
            </span>
            <p className="text-xs font-black truncate text-indigo-400 font-mono">
              {nightShiftCount} ca ({totalAlertsCount > 0 ? Math.round((nightShiftCount / totalAlertsCount) * 100) : 0}%)
            </p>
          </div>
        </div>

        {/* Average per Hour */}
        <div
          className={`p-3 rounded-xl border flex items-center gap-3 transition-colors ${
            isDark ? 'bg-slate-950/60 border-slate-800' : 'bg-slate-50 border-slate-200'
          }`}
        >
          <div className="w-8 h-8 rounded-lg bg-blue-500/20 text-blue-400 flex items-center justify-center font-bold">
            <TrendingUp className="w-4 h-4 text-blue-400" />
          </div>
          <div className="min-w-0">
            <span className={`text-[10px] uppercase font-bold tracking-wider ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
              {t.chartAvgPerHour || 'Trung bình'}
            </span>
            <p className="text-xs font-black truncate text-blue-400 font-mono">
              {avgPerHour} ca/giờ hoạt động
            </p>
          </div>
        </div>
      </div>

      {/* Main Recharts BarChart Container */}
      <div className="w-full h-72 sm:h-80 pt-2">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={chartData}
            margin={{ top: 15, right: 15, left: -20, bottom: 20 }}
            onClick={(state: any) => {
              if (state && state.activePayload && state.activePayload.length && onSelectHour) {
                const clickedHour = state.activePayload[0].payload.hour;
                onSelectHour(selectedHour === clickedHour ? null : clickedHour);
              }
            }}
          >
            <CartesianGrid
              strokeDasharray="3 3"
              vertical={false}
              stroke={isDark ? '#334155' : '#e2e8f0'}
              opacity={0.6}
            />
            <XAxis
              dataKey="displayLabel"
              tickLine={false}
              stroke={isDark ? '#94a3b8' : '#64748b'}
              fontSize={11}
              fontWeight={600}
              dy={8}
            />
            <YAxis
              allowDecimals={false}
              tickLine={false}
              axisLine={false}
              stroke={isDark ? '#94a3b8' : '#64748b'}
              fontSize={11}
              fontWeight={600}
            />
            <Tooltip content={<CustomTooltip />} cursor={{ fill: isDark ? 'rgba(51, 65, 85, 0.4)' : 'rgba(226, 232, 240, 0.6)' }} />

            {/* Custom Legend */}
            {displayMode === 'stacked' && (
              <Legend
                verticalAlign="top"
                align="right"
                iconType="circle"
                wrapperStyle={{ paddingBottom: '12px', fontSize: '11px', fontWeight: 600 }}
                formatter={(value: string) => {
                  if (value === 'fatal') return t.chartFatalSeverity || 'Báo Động Đỏ (Fatal)';
                  if (value === 'critical') return t.chartCriticalSeverity || 'Khẩn Cấp (Critical)';
                  if (value === 'warning') return t.chartWarningSeverity || 'Cảnh Báo (Warning)';
                  return value;
                }}
              />
            )}

            {/* Render Stacked Severity Bars */}
            {displayMode === 'stacked' ? (
              <>
                <Bar
                  dataKey="warning"
                  name="warning"
                  stackId="alerts"
                  fill="#eab308"
                  radius={[0, 0, 0, 0]}
                  maxBarSize={38}
                />
                <Bar
                  dataKey="critical"
                  name="critical"
                  stackId="alerts"
                  fill="#f97316"
                  radius={[0, 0, 0, 0]}
                  maxBarSize={38}
                />
                <Bar
                  dataKey="fatal"
                  name="fatal"
                  stackId="alerts"
                  fill="#ef4444"
                  radius={[4, 4, 0, 0]}
                  maxBarSize={38}
                />
              </>
            ) : (
              /* Render Total Volume Bars with Peak Hour Highlights */
              <Bar dataKey="total" radius={[6, 6, 0, 0]} maxBarSize={38}>
                {chartData.map((entry, index) => {
                  const isSelected = selectedHour === entry.hour;
                  let fillColor = '#3b82f6'; // standard blue
                  if (entry.isPeak) {
                    fillColor = '#f43f5e'; // rose-500 for peak
                  } else if (entry.fatal > 0) {
                    fillColor = '#ef4444'; // red if contains fatal
                  } else if (entry.critical > 0) {
                    fillColor = '#f97316'; // orange if contains critical
                  }

                  return (
                    <Cell
                      key={`cell-${index}`}
                      fill={fillColor}
                      stroke={isSelected ? '#ffffff' : entry.isPeak ? '#fda4af' : 'none'}
                      strokeWidth={isSelected ? 2 : entry.isPeak ? 1.5 : 0}
                      opacity={selectedHour !== null && !isSelected ? 0.45 : 1}
                      className="transition-all cursor-pointer hover:opacity-80"
                    />
                  );
                })}
              </Bar>
            )}
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Footer Notes & Peak Surge Clinical Action Advice */}
      <div
        className={`mt-3 pt-3 border-t flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 text-xs ${
          isDark ? 'border-slate-800 text-slate-400' : 'border-slate-200 text-slate-500'
        }`}
      >
        <div className="flex items-center gap-2 flex-wrap">
          <span className="flex items-center gap-1.5 font-semibold">
            <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-ping" />
            <strong className="text-rose-400">
              {language === 'vi' ? 'Khuyến nghị lâm sàng:' : 'Clinical Advisory:'}
            </strong>
          </span>
          <span>
            {peakHourInfo.maxCount > 0
              ? language === 'vi'
                ? `Tập trung nhân lực bác sĩ trực & điều dưỡng trong khung giờ cao điểm (${peakHourInfo.peakLabels}) để duy trì thời gian phản hồi < 15 giây.`
                : `Ensure reinforced doctor & nurse station presence during surge window (${peakHourInfo.peakLabels}) to uphold < 15s response SLA.`
              : language === 'vi'
              ? 'Tần suất sự cố đang phân bổ đều trên các ca trực.'
              : 'Alarm incidents are evenly distributed across shift periods.'}
          </span>
        </div>

        {selectedHour !== null && onSelectHour && (
          <button
            onClick={() => onSelectHour(null)}
            className="px-2.5 py-1 rounded-lg bg-blue-600/20 text-blue-400 border border-blue-500/30 text-[11px] font-bold hover:bg-blue-600/30 transition-colors cursor-pointer"
          >
            {language === 'vi' ? 'Bỏ lọc theo giờ' : 'Clear hour filter'}
          </button>
        )}
      </div>
    </div>
  );
};
