import React, { useState, useEffect, useRef } from 'react';
import {
  Activity,
  Play,
  Square,
  Send,
  Sliders,
  Zap,
  RefreshCw,
} from 'lucide-react';
import { Patient, VitalReading } from '../types';
import { useLanguage } from '../context/LanguageContext';
import { useTheme } from '../context/ThemeContext';

interface TelemetrySimulatorProps {
  patients: Patient[];
  recentReadings: VitalReading[];
  onSendVital: (data: {
    patientId: string;
    heartRate: number;
    spO2?: number;
    bloodPressureSystolic?: number;
    bloodPressureDiastolic?: number;
    timestamp?: string;
  }) => Promise<void>;
}

export const TelemetrySimulator: React.FC<TelemetrySimulatorProps> = ({
  patients,
  recentReadings,
  onSendVital,
}) => {
  const { t, language } = useLanguage();
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  // Manual form state
  const [selectedPatientId, setSelectedPatientId] = useState(patients[0]?.id || 'P101');
  const [heartRate, setHeartRate] = useState<number>(165);
  const [spO2, setSpO2] = useState<number>(92);
  const [systolic, setSystolic] = useState<number>(140);
  const [diastolic, setDiastolic] = useState<number>(90);
  const [isSending, setIsSending] = useState(false);

  // Auto-stream generator state
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamIntervalMs, setStreamIntervalMs] = useState<number>(1500);
  const [anomalyChance, setAnomalyChance] = useState<number>(30); // 30% chance of emergency
  const [sentPacketCount, setSentPacketCount] = useState(0);
  const streamTimerRef = useRef<number | null>(null);

  // Quick preset triggers
  const handlePreset = async (patientId: string, hr: number, spo2Val: number) => {
    setIsSending(true);
    try {
      await onSendVital({
        patientId,
        heartRate: hr,
        spO2: spo2Val,
        bloodPressureSystolic: 135,
        bloodPressureDiastolic: 85,
        timestamp: new Date().toISOString(),
      });
    } finally {
      setIsSending(false);
    }
  };

  const handleManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSending(true);
    try {
      await onSendVital({
        patientId: selectedPatientId,
        heartRate: Number(heartRate),
        spO2: Number(spO2),
        bloodPressureSystolic: Number(systolic),
        bloodPressureDiastolic: Number(diastolic),
        timestamp: new Date().toISOString(),
      });
    } finally {
      setIsSending(false);
    }
  };

  // Streaming generator loop
  useEffect(() => {
    if (isStreaming) {
      const runStreamStep = async () => {
        if (patients.length === 0) return;
        const randomPatient = patients[Math.floor(Math.random() * patients.length)];
        const isSpike = Math.random() * 100 < anomalyChance;

        let generatedBpm: number;
        let generatedSpO2: number;

        if (isSpike) {
          // generate critical value
          const isHigh = Math.random() > 0.4;
          generatedBpm = isHigh ? Math.floor(152 + Math.random() * 35) : Math.floor(28 + Math.random() * 11);
          generatedSpO2 = Math.floor(78 + Math.random() * 10);
        } else {
          // normal range with slight variation
          generatedBpm = Math.floor(68 + Math.random() * 22);
          generatedSpO2 = Math.floor(96 + Math.random() * 4);
        }

        try {
          await onSendVital({
            patientId: randomPatient.id,
            heartRate: generatedBpm,
            spO2: generatedSpO2,
            bloodPressureSystolic: 120 + Math.floor(Math.random() * 20),
            bloodPressureDiastolic: 80 + Math.floor(Math.random() * 10),
            timestamp: new Date().toISOString(),
          });
          setSentPacketCount((prev) => prev + 1);
        } catch (e) {
          console.warn('Stream step error:', e);
        }
      };

      streamTimerRef.current = window.setInterval(runStreamStep, streamIntervalMs);
    } else {
      if (streamTimerRef.current) {
        clearInterval(streamTimerRef.current);
        streamTimerRef.current = null;
      }
    }

    return () => {
      if (streamTimerRef.current) {
        clearInterval(streamTimerRef.current);
      }
    };
  }, [isStreaming, streamIntervalMs, anomalyChance, patients, onSendVital]);

  return (
    <div className="space-y-6">
      {/* 1-CLICK QUICK PRESETS */}
      <div className={`border rounded-2xl p-6 shadow-lg transition-colors ${
        isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'
      }`}>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-600/20 text-emerald-500 flex items-center justify-center font-bold">
              <Zap className="w-4 h-4" />
            </div>
            <div>
              <h3 className={`text-base font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>{t.simPresetsTitle}</h3>
              <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{t.simPresetsDesc}</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <button
            onClick={() => handlePreset('P203', 172, 91)}
            disabled={isSending}
            className={`p-4 rounded-xl border-2 text-left transition-all hover:scale-[1.02] shadow-md group cursor-pointer ${
              isDark
                ? 'bg-gradient-to-br from-red-950/80 to-slate-900 border-red-500/60 hover:border-red-400'
                : 'bg-gradient-to-br from-red-50 to-white border-red-300 hover:border-red-500'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold px-2 py-0.5 rounded bg-red-600 text-white">
                {language === 'vi' ? 'Mã Đỏ: Rung Thất' : 'Code Red: V-Fib'}
              </span>
              <span className="text-xs text-red-500 font-mono font-black">172 BPM</span>
            </div>
            <div className={`font-bold text-sm mt-2 ${isDark ? 'text-white' : 'text-slate-900'}`}>
              {t.room} 203 - Phạm Minh Tuấn
            </div>
            <p className={`text-xs mt-1 line-clamp-1 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
              {language === 'vi' ? 'Nhịp nhanh thất kịch phát nguy kịch' : 'Paroxysmal Ventricular Tachycardia'}
            </p>
          </button>

          <button
            onClick={() => handlePreset('P101', 34, 94)}
            disabled={isSending}
            className={`p-4 rounded-xl border-2 text-left transition-all hover:scale-[1.02] shadow-md group cursor-pointer ${
              isDark
                ? 'bg-gradient-to-br from-purple-950/80 to-slate-900 border-purple-500/60 hover:border-purple-400'
                : 'bg-gradient-to-br from-purple-50 to-white border-purple-300 hover:border-purple-500'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold px-2 py-0.5 rounded bg-purple-600 text-white">
                {language === 'vi' ? 'Mã Đỏ: Nhịp Chậm' : 'Code Red: Brady'}
              </span>
              <span className="text-xs text-purple-500 font-mono font-black">34 BPM</span>
            </div>
            <div className={`font-bold text-sm mt-2 ${isDark ? 'text-white' : 'text-slate-900'}`}>
              {t.room} 101 - Nguyễn Văn Hùng
            </div>
            <p className={`text-xs mt-1 line-clamp-1 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
              {language === 'vi' ? 'Nhịp tim tụt sâu nguy cơ ngừng tim' : 'Severe bradycardia / Arrest risk'}
            </p>
          </button>

          <button
            onClick={() => handlePreset('P305', 135, 78)}
            disabled={isSending}
            className={`p-4 rounded-xl border-2 text-left transition-all hover:scale-[1.02] shadow-md group cursor-pointer ${
              isDark
                ? 'bg-gradient-to-br from-amber-950/80 to-slate-900 border-amber-500/60 hover:border-amber-400'
                : 'bg-gradient-to-br from-amber-50 to-white border-amber-300 hover:border-amber-500'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold px-2 py-0.5 rounded bg-amber-600 text-white">
                {language === 'vi' ? 'Tụt Oxy SpO2' : 'Critical SpO2 Drop'}
              </span>
              <span className="text-xs text-amber-500 font-mono font-black">78% SpO2</span>
            </div>
            <div className={`font-bold text-sm mt-2 ${isDark ? 'text-white' : 'text-slate-900'}`}>
              {t.room} 305 - Đoàn Thúy Vy
            </div>
            <p className={`text-xs mt-1 line-clamp-1 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
              {language === 'vi' ? 'Suy hô hấp cấp tính / Viêm cơ tim' : 'Acute respiratory failure / Hypoxia'}
            </p>
          </button>

          <button
            onClick={() => handlePreset('P102', 76, 99)}
            disabled={isSending}
            className={`p-4 rounded-xl border-2 text-left transition-all hover:scale-[1.02] shadow-md group cursor-pointer ${
              isDark
                ? 'bg-gradient-to-br from-emerald-950/80 to-slate-900 border-emerald-500/50 hover:border-emerald-400'
                : 'bg-gradient-to-br from-emerald-50 to-white border-emerald-300 hover:border-emerald-500'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold px-2 py-0.5 rounded bg-emerald-600 text-white">
                {t.stableStatus}
              </span>
              <span className="text-xs text-emerald-500 font-mono font-black">76 BPM</span>
            </div>
            <div className={`font-bold text-sm mt-2 ${isDark ? 'text-white' : 'text-slate-900'}`}>
              {t.room} 102 - Trần Thị Mai
            </div>
            <p className={`text-xs mt-1 line-clamp-1 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
              {language === 'vi' ? 'Chỉ số sinh tồn ổn định sau phẫu thuật' : 'Stable post-operative vital recovery'}
            </p>
          </button>
        </div>
      </div>

      {/* TWO COLUMNS: CONTINUOUS STREAM GENERATOR & MANUAL INGESTION FORM */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Stream Generator */}
        <div className={`border rounded-2xl p-6 shadow-lg space-y-4 transition-colors ${
          isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'
        }`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <RefreshCw className={`w-5 h-5 ${isStreaming ? 'text-emerald-500 animate-spin' : isDark ? 'text-slate-400' : 'text-slate-500'}`} />
              <h3 className={`text-base font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>{t.autoStreamTitle}</h3>
            </div>
            <span
              className={`text-xs px-2.5 py-1 rounded-full font-bold ${
                isStreaming
                  ? isDark ? 'bg-emerald-950 text-emerald-400 border border-emerald-700' : 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                  : isDark ? 'bg-slate-800 text-slate-400' : 'bg-slate-100 text-slate-600'
              }`}
            >
              {isStreaming
                ? (language === 'vi' ? `Đang phát (${sentPacketCount} gói)` : `Streaming (${sentPacketCount} pkts)`)
                : (language === 'vi' ? 'Đang tạm dừng' : 'Paused')}
            </span>
          </div>

          <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
            {t.autoStreamDesc}
          </p>

          <div className={`space-y-3 p-4 rounded-xl border ${
            isDark ? 'bg-slate-950/80 border-slate-800' : 'bg-slate-50 border-slate-200'
          }`}>
            <div>
              <div className={`flex justify-between text-xs mb-1 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                <span>{t.streamFrequency}</span>
                <strong className="text-emerald-500">{streamIntervalMs / 1000}s</strong>
              </div>
              <input
                type="range"
                min="500"
                max="4000"
                step="250"
                value={streamIntervalMs}
                onChange={(e) => setStreamIntervalMs(Number(e.target.value))}
                className="w-full accent-emerald-500 cursor-pointer"
              />
            </div>

            <div>
              <div className={`flex justify-between text-xs mb-1 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                <span>{t.anomalyChance}</span>
                <strong className="text-red-500">{anomalyChance}%</strong>
              </div>
              <input
                type="range"
                min="0"
                max="100"
                step="5"
                value={anomalyChance}
                onChange={(e) => setAnomalyChance(Number(e.target.value))}
                className="w-full accent-red-500 cursor-pointer"
              />
            </div>
          </div>

          <div className="flex gap-3">
            <button
              id="btn-toggle-stream"
              onClick={() => setIsStreaming(!isStreaming)}
              className={`flex-1 py-3 px-4 rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-2 shadow-lg cursor-pointer ${
                isStreaming
                  ? 'bg-rose-600 hover:bg-rose-500 text-white shadow-rose-950/40'
                  : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-950/40'
              }`}
            >
              {isStreaming ? (
                <>
                  <Square className="w-4 h-4 fill-white" />
                  {t.btnStopStream}
                </>
              ) : (
                <>
                  <Play className="w-4 h-4 fill-white" />
                  {t.btnStartStream}
                </>
              )}
            </button>

            {sentPacketCount > 0 && (
              <button
                onClick={() => setSentPacketCount(0)}
                className={`px-3 py-2 rounded-xl text-xs font-semibold ${
                  isDark ? 'bg-slate-800 hover:bg-slate-700 text-slate-300' : 'bg-slate-200 hover:bg-slate-300 text-slate-700'
                }`}
              >
                {language === 'vi' ? 'Xóa đếm' : 'Reset count'}
              </button>
            )}
          </div>
        </div>

        {/* Manual Custom Ingestion Form */}
        <form
          onSubmit={handleManualSubmit}
          className={`border rounded-2xl p-6 shadow-lg space-y-4 transition-colors ${
            isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'
          }`}
        >
          <div className="flex items-center gap-2">
            <Sliders className="w-5 h-5 text-blue-500" />
            <h3 className={`text-base font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>{t.manualFormTitle}</h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className={`text-xs font-medium block mb-1 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{t.selectPatient}</label>
              <select
                value={selectedPatientId}
                onChange={(e) => setSelectedPatientId(e.target.value)}
                className={`w-full border rounded-xl px-3 py-2 text-xs font-medium focus:outline-none focus:border-blue-500 ${
                  isDark ? 'bg-slate-950 border-slate-700 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'
                }`}
              >
                {patients.map((p) => (
                  <option key={p.id} value={p.id} className={isDark ? 'bg-slate-900 text-white' : 'bg-white text-slate-900'}>
                    {p.roomNumber} - {p.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className={`text-xs font-medium block mb-1 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{t.heartRateInput}</label>
              <input
                type="number"
                min="20"
                max="240"
                value={heartRate}
                onChange={(e) => setHeartRate(Number(e.target.value))}
                className={`w-full border rounded-xl px-3 py-2 text-xs font-mono font-bold focus:outline-none focus:border-blue-500 ${
                  isDark ? 'bg-slate-950 border-slate-700 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'
                }`}
              />
            </div>

            <div>
              <label className={`text-xs font-medium block mb-1 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{t.spO2Input}</label>
              <input
                type="number"
                min="50"
                max="100"
                value={spO2}
                onChange={(e) => setSpO2(Number(e.target.value))}
                className={`w-full border rounded-xl px-3 py-2 text-xs font-mono font-bold focus:outline-none focus:border-blue-500 ${
                  isDark ? 'bg-slate-950 border-slate-700 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'
                }`}
              />
            </div>

            <div>
              <label className={`text-xs font-medium block mb-1 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                {language === 'vi' ? 'Huyết áp (mmHg):' : 'Blood Pressure (mmHg):'}
              </label>
              <div className="flex gap-1 items-center">
                <input
                  type="number"
                  placeholder={language === 'vi' ? 'Tâm thu' : 'Systolic'}
                  value={systolic}
                  onChange={(e) => setSystolic(Number(e.target.value))}
                  className={`w-1/2 border rounded-xl px-2 py-2 text-xs font-mono focus:outline-none focus:border-blue-500 text-center ${
                    isDark ? 'bg-slate-950 border-slate-700 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'
                  }`}
                />
                <span className={isDark ? 'text-slate-500' : 'text-slate-400'}>/</span>
                <input
                  type="number"
                  placeholder={language === 'vi' ? 'Tâm trương' : 'Diastolic'}
                  value={diastolic}
                  onChange={(e) => setDiastolic(Number(e.target.value))}
                  className={`w-1/2 border rounded-xl px-2 py-2 text-xs font-mono focus:outline-none focus:border-blue-500 text-center ${
                    isDark ? 'bg-slate-950 border-slate-700 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'
                  }`}
                />
              </div>
            </div>
          </div>

          <button
            type="submit"
            disabled={isSending}
            className="w-full py-3 bg-blue-600 hover:bg-blue-500 active:scale-95 text-white font-bold text-sm rounded-xl shadow-lg shadow-blue-950/40 transition-all flex items-center justify-center gap-2 cursor-pointer"
          >
            <Send className="w-4 h-4" />
            <span>{isSending ? t.btnAcknowledging : t.btnSendVital}</span>
          </button>
        </form>
      </div>

      {/* REAL-TIME TELEMETRY INGESTION LOG STREAM */}
      <div className={`border rounded-2xl p-6 shadow-lg space-y-3 transition-colors ${
        isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'
      }`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Activity className="w-5 h-5 text-emerald-500" />
            <h3 className={`text-base font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>{t.liveTelemetryTitle}</h3>
          </div>
          <span className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
            {language === 'vi' ? 'Hiển thị 15 bản ghi gần nhất' : 'Showing latest 15 telemetry records'}
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className={`border-b ${isDark ? 'text-slate-400 border-slate-800' : 'text-slate-500 border-slate-200'}`}>
                <th className="pb-2 font-semibold">{t.tableColTime}</th>
                <th className="pb-2 font-semibold">{t.tableColPatient}</th>
                <th className="pb-2 font-semibold">{t.tableColVital}</th>
                <th className="pb-2 font-semibold">SpO2</th>
                <th className="pb-2 font-semibold">{t.tableColStatus}</th>
              </tr>
            </thead>
            <tbody className={`divide-y font-mono ${isDark ? 'divide-slate-800/60' : 'divide-slate-200'}`}>
              {recentReadings.length === 0 ? (
                <tr>
                  <td colSpan={5} className={`py-4 text-center ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                    {t.noVitalsYet}
                  </td>
                </tr>
              ) : (
                recentReadings.slice(0, 15).map((reading) => (
                  <tr
                    key={reading.id}
                    className={`transition-colors ${
                      reading.isAbnormal
                        ? isDark ? 'bg-red-950/20 text-red-300' : 'bg-red-50 text-red-800'
                        : isDark ? 'text-slate-300 hover:bg-slate-800/40' : 'text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <td className={`py-2 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                      {new Date(reading.timestamp).toLocaleTimeString(language === 'vi' ? 'vi-VN' : 'en-US')}
                    </td>
                    <td className={`py-2 font-sans font-medium ${isDark ? 'text-white' : 'text-slate-900'}`}>
                      {reading.roomNumber} - {reading.patientName}
                    </td>
                    <td className="py-2">
                      <span
                        className={`font-black ${
                          reading.heartRate < 50 || reading.heartRate > 120 ? 'text-red-500' : 'text-emerald-500'
                        }`}
                      >
                        {reading.heartRate} BPM
                      </span>
                    </td>
                    <td className={`py-2 ${isDark ? 'text-sky-400' : 'text-sky-600'}`}>{reading.spO2 || 98}%</td>
                    <td className="py-2">
                      {reading.isAbnormal ? (
                        <span className={`px-2 py-0.5 rounded border font-bold text-[11px] ${
                          isDark ? 'bg-red-900/60 text-red-300 border-red-700/50' : 'bg-red-100 text-red-700 border-red-200'
                        }`}>
                          🚨 {reading.abnormalReason || (language === 'vi' ? 'BẤT THƯỜNG' : 'ABNORMAL')}
                        </span>
                      ) : (
                        <span className={`px-2 py-0.5 rounded border font-medium text-[11px] ${
                          isDark ? 'bg-emerald-950 text-emerald-400 border-emerald-800' : 'bg-emerald-100 text-emerald-800 border-emerald-200'
                        }`}>
                          🟢 {language === 'vi' ? 'Bình thường' : 'Normal'}
                        </span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
