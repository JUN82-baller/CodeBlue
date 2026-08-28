import React, { useState, useEffect, useRef } from 'react';
import Markdown from 'react-markdown';
import {
  Bot,
  Brain,
  Check,
  ChevronDown,
  Copy,
  ExternalLink,
  Flame,
  Globe,
  HelpCircle,
  Hospital,
  Info,
  MapPin,
  Maximize2,
  Minimize2,
  Navigation,
  Pill,
  RefreshCw,
  Send,
  Sparkles,
  Stethoscope,
  Trash2,
  User,
  Users,
  Zap,
} from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import { useTheme } from '../context/ThemeContext';
import {
  AiChatMessage,
  AiConsultationRole,
  GroundingSource,
  MedicationSchedule,
  Patient,
  VitalReading,
} from '../types';
import { sendAiConsultation } from '../services/geminiAi';

interface AiClinicalAssistantProps {
  patients: Patient[];
  medications: MedicationSchedule[];
  recentVitals?: Record<string, VitalReading>;
  initialSelectedPatientId?: string;
  initialRole?: AiConsultationRole;
  isFloatingDrawer?: boolean;
  onCloseFloating?: () => void;
}

const roleConfigs: Record<
  AiConsultationRole,
  {
    titleVi: string;
    titleEn: string;
    icon: React.ReactNode;
    color: string;
    descriptionVi: string;
    descriptionEn: string;
    defaultSearch: boolean;
    defaultMaps: boolean;
  }
> = {
  clinical_doctor: {
    titleVi: 'Bác Sĩ Cố Vấn Cấp Cứu ICU',
    titleEn: 'ICU Clinical Consultant',
    icon: <Stethoscope className="w-4 h-4" />,
    color: 'from-blue-600 to-indigo-600 text-blue-400 border-blue-500/30',
    descriptionVi: 'Phác đồ ACLS, rối loạn nhịp tim, sốc tim, suy hô hấp & cấp cứu khẩn cấp',
    descriptionEn: 'ACLS protocols, arrhythmias, cardiogenic shock & emergency critical care',
    defaultSearch: false,
    defaultMaps: false,
  },
  pharmacist: {
    titleVi: 'Dược Sĩ Lâm Sàng & An Toàn Thuốc',
    titleEn: 'Clinical Pharmacist & Safety',
    icon: <Pill className="w-4 h-4" />,
    color: 'from-emerald-600 to-teal-600 text-emerald-400 border-emerald-500/30',
    descriptionVi: 'Tương tác thuốc, chỉnh liều suy thận/gan, độc tính & tương thích truyền dịch',
    descriptionEn: 'Drug interactions, renal/hepatic dosing, toxicity & IV compatibility',
    defaultSearch: true,
    defaultMaps: false,
  },
  transfer_coordinator: {
    titleVi: 'Điều Phối Chuyển Tuyến & Tìm Viện',
    titleEn: 'Emergency Transfer Coordinator',
    icon: <Hospital className="w-4 h-4" />,
    color: 'from-rose-600 to-red-600 text-rose-400 border-rose-500/30',
    descriptionVi: 'Tìm viện tuyến trên (Cathlab, đột quỵ, hồi sức) & bản đồ dẫn đường',
    descriptionEn: 'Find tertiary referral centers (Cathlab, Stroke, ICU) & maps routing',
    defaultSearch: false,
    defaultMaps: true,
  },
  triage_nurse: {
    titleVi: 'Điều Dưỡng Phân Loại Sinh Tồn',
    titleEn: 'Triage & Rapid Response Nurse',
    icon: <Zap className="w-4 h-4" />,
    color: 'from-amber-600 to-orange-600 text-amber-400 border-amber-500/30',
    descriptionVi: 'Đánh giá chỉ số sinh hiệu (MEWS), can thiệp tại giường & chuẩn bị cấp cứu',
    descriptionEn: 'Early warning vitals (MEWS score), bedside intervention & triage steps',
    defaultSearch: false,
    defaultMaps: false,
  },
};

export const AiClinicalAssistant: React.FC<AiClinicalAssistantProps> = ({
  patients,
  medications,
  recentVitals = {},
  initialSelectedPatientId,
  initialRole = 'clinical_doctor',
  isFloatingDrawer = false,
  onCloseFloating,
}) => {
  const { language } = useLanguage();
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  const [activeRole, setActiveRole] = useState<AiConsultationRole>(initialRole);
  const [selectedModel, setSelectedModel] = useState<string>('gemini-3.7-flash');
  const [useSearch, setUseSearch] = useState<boolean>(false);
  const [useMaps, setUseMaps] = useState<boolean>(false);
  const [selectedPatientId, setSelectedPatientId] = useState<string>(initialSelectedPatientId || '');
  const [userLocation, setUserLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [locationStatus, setLocationStatus] = useState<string>('');

  const [messages, setMessages] = useState<AiChatMessage[]>([]);
  const [inputText, setInputText] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Initialize initial welcoming message per role
  useEffect(() => {
    if (messages.length === 0) {
      const welcomeText =
        activeRole === 'clinical_doctor'
          ? language === 'vi'
            ? 'Chào Bác sĩ! Tôi là Trợ Lý Cố Vấn Cấp Cứu ICU & Tim Mạch hỗ trợ bởi Gemini AI. Tôi có thể hỗ trợ bác sĩ phân tích điện tâm đồ, gợi ý phác đồ hồi sinh tim phổi nâng cao (ACLS), xử trí loạn nhịp tim hoặc liều lượng thuốc vận mạch. Bác sĩ có thể gắn hồ sơ bệnh nhân để tôi phân tích trực tiếp.'
            : 'Welcome Doctor! I am your ICU & Cardiology Emergency Assistant powered by Gemini. I can assist with ACLS protocols, arrhythmia management, hemodynamic stabilization, and inotropes. You can link a patient profile for real-time telemetry analysis.'
          : activeRole === 'pharmacist'
          ? language === 'vi'
            ? 'Chào Dược sĩ và Bác sĩ! Tôi là Dược Sĩ Lâm Sàng hỗ trợ tra cứu tương tác thuốc nguy hiểm, chống chỉ định, tính toán liều lượng thuốc theo chức năng thận (eGFR) và dung dịch pha truyền an toàn với Google Search Grounding.'
            : 'Hello Clinical Team! I am your Clinical Pharmacist Assistant. Ask me about drug-drug interactions, dose adjustments in organ failure, and IV compatibility powered by real-time Search Grounding.'
          : activeRole === 'transfer_coordinator'
          ? language === 'vi'
            ? 'Chào Bộ phận Cấp cứu! Tôi là Điều Phối Viên Chuyển Tuyến Cấp Cứu. Tôi có thể sử dụng Google Maps Grounding để tìm kiếm các Bệnh viện tuyến trên (Trung tâm Can thiệp Tim Mạch Cathlab, Đột quỵ Não, ICU) gần nhất kèm lộ trình và hướng dẫn chuẩn bị bệnh nhân.'
            : 'Emergency Transfer Assistant ready. I use Google Maps Grounding to locate nearby tertiary referral centers, Cathlab units, and stroke centers with live directions.'
          : language === 'vi'
          ? 'Chào Điều dưỡng! Tôi là Trợ Lý Phân Loại Sinh Tồn & Cảnh Báo Sớm. Hãy nhập chỉ số Mạch, Huyết áp, SpO2 để tôi tính thang điểm MEWS và hướng dẫn xử trí tức thời tại giường.'
          : 'Triage Nurse Assistant active. Input vital signs to calculate MEWS scores and receive immediate bedside intervention protocols.';

      setMessages([
        {
          id: 'welcome-msg',
          role: 'model',
          text: welcomeText,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          consultationRole: activeRole,
          modelUsed: selectedModel,
        },
      ]);
    }
  }, [activeRole, language]);

  // Adjust defaults when role changes
  const handleRoleChange = (newRole: AiConsultationRole) => {
    setActiveRole(newRole);
    if (newRole === 'pharmacist') {
      setUseSearch(true);
      setUseMaps(false);
    } else if (newRole === 'transfer_coordinator') {
      setUseMaps(true);
      setUseSearch(false);
      requestLocation();
    } else {
      setUseSearch(false);
      setUseMaps(false);
    }
  };

  // Geolocation detector for Maps Grounding
  const requestLocation = () => {
    if ('geolocation' in navigator) {
      setLocationStatus('Đang lấy vị trí...');
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setUserLocation({
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
          });
          setLocationStatus('Đã có tọa độ GPS');
        },
        (err) => {
          console.warn('Geolocation error:', err);
          // Default fallback to Ho Chi Minh City coordinates for medical demo
          setUserLocation({ latitude: 10.7769, longitude: 106.7009 });
          setLocationStatus('Vị trí mặc định (TP.HCM / Hà Nội)');
        }
      );
    }
  };

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  // Get attached patient info
  const selectedPatient = patients.find((p) => p.id === selectedPatientId);
  const patientVitals = selectedPatientId ? recentVitals[selectedPatientId] : undefined;
  const patientMeds = selectedPatientId
    ? medications.filter((m) => m.patientId === selectedPatientId).map((m) => `${m.medicationName} (${m.dosage})`)
    : [];

  const handleSendMessage = async (textToSend?: string) => {
    const query = (textToSend || inputText).trim();
    if (!query || isLoading) return;

    const userMessage: AiChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      text: query,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInputText('');
    setIsLoading(true);

    try {
      // Build conversation payload
      const historyPayload = [...messages, userMessage].map((m) => ({
        role: m.role,
        text: m.text,
      }));

      const patientContextData = selectedPatient
        ? {
            patientId: selectedPatient.id,
            patientName: selectedPatient.name,
            roomNumber: selectedPatient.roomNumber,
            bed: selectedPatient.bed,
            age: selectedPatient.age,
            diagnosis: selectedPatient.diagnosis,
            heartRate: patientVitals?.heartRate,
            spO2: patientVitals?.spO2,
            medications: patientMeds,
          }
        : undefined;

      const response = await sendAiConsultation(historyPayload, {
        role: activeRole,
        modelPreference: selectedModel,
        useSearch,
        useMaps,
        userLocation: userLocation || undefined,
        patientContext: patientContextData,
      });

      const modelMessage: AiChatMessage = {
        id: `ai-${Date.now()}`,
        role: 'model',
        text: response.text,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        consultationRole: activeRole,
        modelUsed: response.modelUsed || selectedModel,
        groundingSources: response.groundingSources,
        webSearchQueries: response.webSearchQueries,
      };

      setMessages((prev) => [...prev, modelMessage]);
    } catch (err: any) {
      const errorMessage: AiChatMessage = {
        id: `error-${Date.now()}`,
        role: 'model',
        text: `⚠️ **Lỗi kết nối AI**: ${err.message || 'Không thể nhận phản hồi'}\n\nVui lòng kiểm tra lại cấu hình kết nối hoặc thử lại.`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        isError: true,
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopyText = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleClearHistory = () => {
    setMessages([]);
  };

  // Quick prompt presets based on role
  const quickPromptsByRole: Record<AiConsultationRole, string[]> = {
    clinical_doctor: [
      'Phác đồ cấp cứu Rung thất / Nhịp nhanh thất vô mạch theo ACLS 2026',
      'Hướng dẫn xử trí Nhịp tim chậm xoang nặng < 40 BPM kèm tụt huyết áp',
      'Xử trí Cơn nhịp nhanh kịch phát trên thất (SVT) đáp ứng thất nhanh 170 BPM',
      'Liều lượng và cách dùng Noradrenaline trong sốc tim',
    ],
    pharmacist: [
      'Kiểm tra tương tác giữa Digoxin 0.25mg và Amiodarone 150mg',
      'Chỉnh liều Enoxaparin trên bệnh nhân suy thận eGFR < 30 mL/phút',
      'Dấu hiệu ngộ độc Digoxin và thuốc kháng độc đặc hiệu (DigiFab)',
      'Tương thích dung dịch pha tiêm Furosemide và Ceftriaxone',
    ],
    transfer_coordinator: [
      'Tìm trung tâm Tim mạch Can thiệp Cathlab 24/7 gần nhất có chỉ đường',
      'Tìm Bệnh viện tuyến trên có khoa Hồi sức Cấp cứu ICU chuyên sâu',
      'Tiêu chuẩn chuyển viện an toàn cho bệnh nhân Nhồi máu cơ tim cấp',
      'Quy trình bàn giao hồ sơ và kiểm tra sinh hiệu trên xe cấp cứu 115',
    ],
    triage_nurse: [
      'Cách tính điểm cảnh báo sớm MEWS khi Nhịp tim 135 BPM, SpO2 89%',
      'Quy trình chuẩn bị máy khử rung tim và xe Crash Cart tại giường',
      'Hướng dẫn tư thế và liệu pháp oxy cho bệnh nhân Phù phổi cấp',
      'Các bước điều dưỡng ưu tiên khi phát hiện Báo động Đỏ tim mạch',
    ],
  };

  const currentPrompts = quickPromptsByRole[activeRole] || quickPromptsByRole.clinical_doctor;

  return (
    <div
      className={`flex flex-col h-full rounded-2xl border shadow-xl overflow-hidden transition-all ${
        isDark
          ? 'bg-slate-900/95 border-slate-800 text-slate-100 shadow-slate-950/60'
          : 'bg-white border-slate-200 text-slate-900 shadow-slate-200/80'
      }`}
    >
      {/* Top Header */}
      <div
        className={`px-4 py-3 border-b flex flex-wrap items-center justify-between gap-3 ${
          isDark ? 'bg-slate-950/80 border-slate-800' : 'bg-slate-50 border-slate-200'
        }`}
      >
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 via-indigo-600 to-purple-600 text-white shadow-md shadow-indigo-900/30">
            <Bot className="w-5 h-5 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="font-extrabold text-sm sm:text-base tracking-tight flex items-center gap-1.5">
                {language === 'vi' ? 'Trợ Lý Y Khoa AI & Quyết Định Lâm Sàng' : 'Gemini Clinical AI Decision Support'}
                <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 flex items-center gap-1">
                  <Sparkles className="w-3 h-3 text-indigo-400" />
                  Gemini
                </span>
              </h2>
            </div>
            <p className={`text-[11px] ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
              {roleConfigs[activeRole].descriptionVi}
            </p>
          </div>
        </div>

        {/* Model, Grounding & Clear Action Buttons */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Model Selector Pill */}
          <div className="flex items-center gap-1">
            <select
              id="select-ai-model"
              value={selectedModel}
              onChange={(e) => setSelectedModel(e.target.value)}
              className={`text-xs font-semibold px-2.5 py-1.5 rounded-lg border cursor-pointer transition-all ${
                isDark
                  ? 'bg-slate-800 border-slate-700 text-slate-200 hover:bg-slate-700'
                  : 'bg-white border-slate-300 text-slate-800 hover:bg-slate-100'
              }`}
            >
              <option value="gemini-3.7-flash">⚡ Gemini 3.7 Flash (Chuẩn)</option>
              <option value="gemini-3.5-flash">🔍 Gemini 3.5 Flash (Search/Maps)</option>
              <option value="gemini-3.1-flash-lite">🚀 Gemini 3.1 Flash-Lite (Nhanh)</option>
            </select>
          </div>

          {/* Google Search Grounding Toggle Button */}
          <button
            id="toggle-search-grounding"
            onClick={() => {
              setUseSearch(!useSearch);
              if (!useSearch) setUseMaps(false);
            }}
            className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all border cursor-pointer ${
              useSearch
                ? 'bg-blue-600/20 text-blue-400 border-blue-500 shadow-sm shadow-blue-900/30'
                : isDark
                ? 'bg-slate-800/80 text-slate-400 border-slate-700 hover:text-slate-200'
                : 'bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200'
            }`}
            title="Sử dụng Google Search Grounding để cập nhật thông tin y khoa mới nhất"
          >
            <Globe className="w-3.5 h-3.5" />
            <span>Search</span>
            {useSearch && <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-ping" />}
          </button>

          {/* Google Maps Grounding Toggle Button */}
          <button
            id="toggle-maps-grounding"
            onClick={() => {
              const nextState = !useMaps;
              setUseMaps(nextState);
              if (nextState) {
                setUseSearch(false);
                requestLocation();
              }
            }}
            className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all border cursor-pointer ${
              useMaps
                ? 'bg-rose-600/20 text-rose-400 border-rose-500 shadow-sm shadow-rose-900/30'
                : isDark
                ? 'bg-slate-800/80 text-slate-400 border-slate-700 hover:text-slate-200'
                : 'bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200'
            }`}
            title="Sử dụng Google Maps Grounding tìm bệnh viện & trung tâm can thiệp gần nhất"
          >
            <MapPin className="w-3.5 h-3.5" />
            <span>Maps</span>
            {useMaps && <span className="w-1.5 h-1.5 rounded-full bg-rose-400 animate-ping" />}
          </button>

          {/* Clear History */}
          <button
            id="btn-clear-chat-history"
            onClick={handleClearHistory}
            className={`p-1.5 rounded-lg text-xs transition-all border cursor-pointer ${
              isDark
                ? 'bg-slate-800 text-slate-400 border-slate-700 hover:text-rose-400 hover:bg-slate-700'
                : 'bg-slate-100 text-slate-500 border-slate-200 hover:text-rose-600 hover:bg-slate-200'
            }`}
            title={language === 'vi' ? 'Xóa hội thoại' : 'Clear chat'}
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>

          {/* Close if floating */}
          {isFloatingDrawer && onCloseFloating && (
            <button
              id="btn-close-ai-drawer"
              onClick={onCloseFloating}
              className={`p-1.5 rounded-lg text-xs transition-all border cursor-pointer ${
                isDark
                  ? 'bg-slate-800 text-slate-400 border-slate-700 hover:text-white'
                  : 'bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200'
              }`}
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* Role Navigation Bar & Patient Linker Bar */}
      <div
        className={`px-4 py-2 border-b flex flex-wrap items-center justify-between gap-2 text-xs ${
          isDark ? 'bg-slate-950/40 border-slate-800/80' : 'bg-slate-100/70 border-slate-200'
        }`}
      >
        {/* Role Selector Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
          {(Object.keys(roleConfigs) as AiConsultationRole[]).map((roleKey) => {
            const cfg = roleConfigs[roleKey];
            const isSelected = activeRole === roleKey;
            return (
              <button
                key={roleKey}
                id={`role-btn-${roleKey}`}
                onClick={() => handleRoleChange(roleKey)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-bold transition-all whitespace-nowrap cursor-pointer ${
                  isSelected
                    ? `bg-gradient-to-r ${cfg.color} text-white shadow-md`
                    : isDark
                    ? 'bg-slate-800/80 text-slate-300 hover:bg-slate-700 border border-slate-700/60'
                    : 'bg-white text-slate-700 hover:bg-slate-200 border border-slate-200'
                }`}
              >
                {cfg.icon}
                <span>{cfg.titleVi}</span>
              </button>
            );
          })}
        </div>

        {/* Patient Context Linker */}
        <div className="flex items-center gap-2">
          <span className={`text-[11px] font-semibold flex items-center gap-1 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
            <User className="w-3 h-3 text-blue-400" />
            {language === 'vi' ? 'Hồ sơ BN:' : 'Patient:'}
          </span>
          <select
            id="select-attached-patient"
            value={selectedPatientId}
            onChange={(e) => setSelectedPatientId(e.target.value)}
            className={`text-xs font-semibold px-2.5 py-1 rounded-lg border cursor-pointer transition-all ${
              selectedPatientId
                ? 'bg-blue-600/20 text-blue-400 border-blue-500/50 font-bold'
                : isDark
                ? 'bg-slate-800 border-slate-700 text-slate-300'
                : 'bg-white border-slate-300 text-slate-700'
            }`}
          >
            <option value="">-- {language === 'vi' ? 'Chung (Không gắn bệnh nhân)' : 'General Consultation'} --</option>
            {patients.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} ({p.roomNumber} - {p.diagnosis})
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Selected Patient Live Telemetry Summary Pill (if selected) */}
      {selectedPatient && (
        <div
          className={`px-4 py-2 border-b flex items-center justify-between text-xs flex-wrap gap-2 animate-fadeIn ${
            isDark ? 'bg-blue-950/30 border-blue-900/40 text-blue-200' : 'bg-blue-50 border-blue-200 text-blue-900'
          }`}
        >
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
            <span className="font-bold">{selectedPatient.name}</span>
            <span className="px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-400 font-mono text-[10px]">
              {selectedPatient.roomNumber} - Giường {selectedPatient.bed}
            </span>
            <span className={`text-[11px] ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
              Chẩn đoán: {selectedPatient.diagnosis}
            </span>
          </div>
          <div className="flex items-center gap-3 font-mono text-[11px]">
            {patientVitals && (
              <>
                <span className="flex items-center gap-1 font-bold text-rose-400">
                  HR: {patientVitals.heartRate} BPM
                </span>
                <span className="flex items-center gap-1 font-bold text-cyan-400">
                  SpO2: {patientVitals.spO2}%
                </span>
              </>
            )}
            {patientMeds.length > 0 && (
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-800/60 text-slate-300 border border-slate-700">
                {patientMeds.length} thuốc đang dùng
              </span>
            )}
          </div>
        </div>
      )}

      {/* Messages Scrollable Thread */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 no-scrollbar">
        {messages.map((msg) => {
          const isUser = msg.role === 'user';
          return (
            <div
              key={msg.id}
              className={`flex gap-3 text-xs sm:text-sm ${isUser ? 'justify-end' : 'justify-start'}`}
            >
              {/* AI Avatar */}
              {!isUser && (
                <div className="flex-shrink-0 flex items-center justify-center w-8 h-8 rounded-xl bg-gradient-to-tr from-indigo-600 to-purple-600 text-white shadow-md mt-1">
                  <Bot className="w-4 h-4" />
                </div>
              )}

              {/* Message Bubble */}
              <div
                className={`max-w-[85%] sm:max-w-[78%] rounded-2xl p-4 shadow-md transition-all ${
                  isUser
                    ? isDark
                      ? 'bg-blue-600 text-white rounded-tr-sm'
                      : 'bg-blue-600 text-white rounded-tr-sm'
                    : msg.isError
                    ? 'bg-rose-950/40 text-rose-200 border border-rose-800/60 rounded-tl-sm'
                    : isDark
                    ? 'bg-slate-800/90 text-slate-100 border border-slate-700/70 rounded-tl-sm'
                    : 'bg-slate-50 text-slate-800 border border-slate-200/90 rounded-tl-sm'
                }`}
              >
                {/* Header info for AI response */}
                {!isUser && (
                  <div className="flex items-center justify-between gap-2 pb-2 mb-2 border-b border-slate-700/30 text-[11px]">
                    <div className="flex items-center gap-1.5 font-bold text-indigo-400">
                      <Brain className="w-3.5 h-3.5" />
                      <span>
                        {msg.consultationRole
                          ? roleConfigs[msg.consultationRole]?.titleVi
                          : 'Cố Vấn Gemini AI'}
                      </span>
                      {msg.modelUsed && (
                        <span className="text-[10px] px-1.5 py-0.2 rounded bg-indigo-500/20 text-indigo-300 font-mono">
                          {msg.modelUsed}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-slate-400">
                      <span>{msg.timestamp}</span>
                      <button
                        onClick={() => handleCopyText(msg.id, msg.text)}
                        className="hover:text-white transition-colors cursor-pointer p-0.5"
                        title="Sao chép nội dung"
                      >
                        {copiedId === msg.id ? (
                          <Check className="w-3.5 h-3.5 text-emerald-400" />
                        ) : (
                          <Copy className="w-3.5 h-3.5" />
                        )}
                      </button>
                    </div>
                  </div>
                )}

                {/* Message Body with Markdown */}
                <div className="prose prose-invert prose-sm max-w-none leading-relaxed space-y-2 break-words">
                  <Markdown>{msg.text}</Markdown>
                </div>

                {/* Grounding Sources (Search & Maps Citations) */}
                {msg.groundingSources && msg.groundingSources.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-slate-700/40 text-[11px] space-y-2">
                    <div className="font-bold flex items-center gap-1.5 text-blue-400">
                      <Sparkles className="w-3 h-3" />
                      <span>{language === 'vi' ? 'Nguồn Dữ Liệu Thực Tế (Grounding Sources):' : 'Real-time Grounding Sources:'}</span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {msg.groundingSources.map((source, sIdx) => {
                        const isMap = source.type === 'maps';
                        return (
                          <a
                            key={sIdx}
                            href={source.uri}
                            target="_blank"
                            rel="noopener noreferrer"
                            className={`flex items-start gap-2 p-2 rounded-xl border transition-all hover:scale-[1.01] ${
                              isMap
                                ? isDark
                                  ? 'bg-rose-950/30 border-rose-800/40 text-rose-300 hover:bg-rose-900/40'
                                  : 'bg-rose-50 border-rose-200 text-rose-800 hover:bg-rose-100'
                                : isDark
                                ? 'bg-slate-900/60 border-slate-700/60 text-blue-300 hover:bg-slate-700/50'
                                : 'bg-blue-50 border-blue-200 text-blue-800 hover:bg-blue-100'
                            }`}
                          >
                            {isMap ? (
                              <MapPin className="w-4 h-4 text-rose-400 flex-shrink-0 mt-0.5" />
                            ) : (
                              <Globe className="w-4 h-4 text-blue-400 flex-shrink-0 mt-0.5" />
                            )}
                            <div className="min-w-0 flex-1">
                              <p className="font-bold truncate">{source.title || (isMap ? 'Bệnh Viện Cấp Cứu' : 'Tài Liệu Y Khoa')}</p>
                              {source.snippet && (
                                <p className="text-[10px] line-clamp-1 opacity-80">{source.snippet}</p>
                              )}
                              <p className="text-[9px] opacity-60 truncate underline flex items-center gap-1 mt-0.5">
                                {isMap ? 'Xem trên Google Maps' : 'Xem tài liệu nguồn'}
                                <ExternalLink className="w-2.5 h-2.5 inline" />
                              </p>
                            </div>
                          </a>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* User timestamp */}
                {isUser && (
                  <div className="text-right text-[10px] text-blue-200/80 mt-1">
                    {msg.timestamp}
                  </div>
                )}
              </div>

              {/* User Avatar */}
              {isUser && (
                <div className="flex-shrink-0 flex items-center justify-center w-8 h-8 rounded-xl bg-gradient-to-tr from-blue-600 to-cyan-600 text-white shadow-md mt-1">
                  <User className="w-4 h-4" />
                </div>
              )}
            </div>
          );
        })}

        {/* Loading Indicator */}
        {isLoading && (
          <div className="flex gap-3 items-center text-xs text-slate-400">
            <div className="flex items-center justify-center w-8 h-8 rounded-xl bg-indigo-600/30 text-indigo-400 animate-pulse">
              <Brain className="w-4 h-4 animate-spin" />
            </div>
            <div className="flex items-center gap-2 p-3 rounded-xl bg-slate-800/40 border border-slate-700/40">
              <span className="w-2 h-2 rounded-full bg-indigo-500 animate-ping" />
              <span>
                {useMaps
                  ? 'Gemini đang tra cứu cơ sở y tế trên Google Maps...'
                  : useSearch
                  ? 'Gemini đang tìm kiếm phác đồ và tài liệu y khoa thời gian thực...'
                  : 'Gemini AI đang phân tích dữ liệu lâm sàng và phác đồ...'}
              </span>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Suggested Quick Prompt Starters */}
      <div
        className={`px-4 py-2 border-t flex items-center gap-1.5 overflow-x-auto no-scrollbar text-xs ${
          isDark ? 'bg-slate-950/60 border-slate-800' : 'bg-slate-100/80 border-slate-200'
        }`}
      >
        <span className={`text-[11px] font-semibold whitespace-nowrap flex items-center gap-1 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
          <Zap className="w-3 h-3 text-amber-400" />
          {language === 'vi' ? 'Gợi ý nhanh:' : 'Quick Prompts:'}
        </span>
        {currentPrompts.map((prompt, pIdx) => (
          <button
            key={pIdx}
            id={`quick-prompt-${pIdx}`}
            onClick={() => handleSendMessage(prompt)}
            disabled={isLoading}
            className={`px-2.5 py-1 rounded-full text-[11px] whitespace-nowrap transition-all border cursor-pointer flex-shrink-0 ${
              isDark
                ? 'bg-slate-800/80 hover:bg-slate-700 text-slate-300 border-slate-700 hover:text-white'
                : 'bg-white hover:bg-slate-200 text-slate-700 border-slate-300'
            }`}
          >
            {prompt}
          </button>
        ))}
      </div>

      {/* Message Input Form */}
      <div
        className={`p-3 border-t ${
          isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'
        }`}
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSendMessage();
          }}
          className="flex items-center gap-2"
        >
          <input
            ref={inputRef}
            id="input-ai-chat"
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder={
              activeRole === 'clinical_doctor'
                ? 'Nhập tình trạng cấp cứu, rối loạn nhịp, hoặc câu hỏi lâm sàng...'
                : activeRole === 'pharmacist'
                ? 'Tra cứu thuốc, tương tác liều dùng, dung dịch pha tiêm...'
                : activeRole === 'transfer_coordinator'
                ? 'Tìm bệnh viện can thiệp tim mạch / đột quỵ gần nhất...'
                : 'Nhập mạch, SpO2, huyết áp để phân loại MEWS...'
            }
            disabled={isLoading}
            className={`flex-1 px-4 py-2.5 text-xs sm:text-sm rounded-xl border focus:outline-none focus:ring-2 transition-all ${
              isDark
                ? 'bg-slate-950 border-slate-800 text-white placeholder-slate-500 focus:ring-blue-500 focus:border-blue-500'
                : 'bg-slate-50 border-slate-300 text-slate-900 placeholder-slate-400 focus:ring-blue-500 focus:border-blue-500'
            }`}
          />
          <button
            id="btn-send-ai-message"
            type="submit"
            disabled={!inputText.trim() || isLoading}
            className={`flex items-center justify-center px-4 py-2.5 rounded-xl font-bold text-xs sm:text-sm text-white transition-all shadow-md cursor-pointer ${
              !inputText.trim() || isLoading
                ? 'bg-slate-700 opacity-50 cursor-not-allowed'
                : 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 shadow-blue-900/30'
            }`}
          >
            <Send className="w-4 h-4 mr-1" />
            <span>{language === 'vi' ? 'Gửi' : 'Send'}</span>
          </button>
        </form>
      </div>
    </div>
  );
};
