import React, { useState, useEffect, useRef } from 'react';
import {
  Phone,
  PhoneCall,
  PhoneOff,
  Mic,
  MicOff,
  Volume2,
  VolumeX,
  Grid,
  Send,
  MessageSquare,
  X,
  Radio,
  User,
  Clock,
  CheckCheck,
  AlertTriangle,
  Heart,
  Bed,
  Sparkles,
  Zap,
  Activity,
  ShieldAlert,
  Mail,
} from 'lucide-react';
import { Alert, Doctor, Patient } from '../types';
import { useLanguage } from '../context/LanguageContext';
import { useTheme } from '../context/ThemeContext';
import {
  startPhoneRingbackTone,
  stopPhoneRingbackTone,
  playCallConnectedTone,
  playCallEndTone,
  playDtmfTone,
  playMessageSentTone,
  playMessageReceivedTone,
} from '../services/sound';

interface QuickContactModalProps {
  isOpen: boolean;
  onClose: () => void;
  alert: Alert | null;
  currentDoctor: Doctor;
  patients: Patient[];
  doctors: Doctor[];
  initialMode?: 'call' | 'message';
  onOpenGmail?: (alert: Alert) => void;
}

interface ChatMessage {
  id: string;
  sender: 'doctor' | 'nurse' | 'codeblue' | 'backup';
  senderName: string;
  senderRole: string;
  text: string;
  timestamp: string;
}

interface TranscriptLine {
  id: string;
  speaker: string;
  text: string;
  time: string;
  isDoctor?: boolean;
}

export const QuickContactModal: React.FC<QuickContactModalProps> = ({
  isOpen,
  onClose,
  alert,
  currentDoctor,
  patients,
  doctors,
  initialMode = 'call',
  onOpenGmail,
}) => {
  const { t, language } = useLanguage();
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  const [activeTab, setActiveTab] = useState<'call' | 'message'>(initialMode);
  const [selectedTarget, setSelectedTarget] = useState<'nurse' | 'codeblue' | 'backup' | 'anesthesia'>('nurse');

  // Call state
  const [callState, setCallState] = useState<'idle' | 'calling' | 'connected' | 'ended'>('idle');
  const [callSeconds, setCallSeconds] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [isSpeakerOn, setIsSpeakerOn] = useState(true);
  const [showKeypad, setShowKeypad] = useState(false);
  const [keypadInput, setKeypadInput] = useState('');
  const [transcript, setTranscript] = useState<TranscriptLine[]>([]);

  // Messaging state
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const chatBottomRef = useRef<HTMLDivElement>(null);

  // Sync initial mode
  useEffect(() => {
    if (isOpen) {
      setActiveTab(initialMode);
    }
  }, [isOpen, initialMode]);

  // Setup initial mock messages & transcript tailored to this active alert
  useEffect(() => {
    if (!alert) return;

    const patient = patients.find((p) => p.id === alert.patientId);
    const room = alert.roomNumber || patient?.roomNumber || 'ICU';
    const patientName = alert.patientName || patient?.name || 'Bệnh nhân';

    const nowStr = new Date().toLocaleTimeString(language === 'vi' ? 'vi-VN' : 'en-US', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });

    if (language === 'vi') {
      setMessages([
        {
          id: 'm1',
          sender: 'nurse',
          senderName: 'Đ/D Trực Nguyễn Lan Anh',
          senderRole: 'Trạm Y Tá ICU #201',
          text: `🚨 Cảnh báo khẩn: Bệnh nhân ${patientName} (Phòng ${room}) nhịp tim ${alert.heartRate} BPM, dấu hiệu ${alert.reason}! Đã phát tín hiệu đến BS trực.`,
          timestamp: alert.createdAt ? new Date(alert.createdAt).toLocaleTimeString('vi-VN') : nowStr,
        },
      ]);
    } else {
      setMessages([
        {
          id: 'm1',
          sender: 'nurse',
          senderName: 'Nurse Lan Anh (RN)',
          senderRole: 'ICU Station #201',
          text: `🚨 Critical Alert: Patient ${patientName} (Room ${room}) telemetry at ${alert.heartRate} BPM (${alert.reason})! Dispatched alarm to On-Call Physician.`,
          timestamp: alert.createdAt ? new Date(alert.createdAt).toLocaleTimeString('en-US') : nowStr,
        },
      ]);
    }
  }, [alert, language, patients]);

  // Call timer effect
  useEffect(() => {
    let interval: number | null = null;
    if (callState === 'connected') {
      interval = window.setInterval(() => {
        setCallSeconds((prev) => prev + 1);
      }, 1000);
    } else if (callState === 'idle') {
      setCallSeconds(0);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [callState]);

  // Scroll chat to bottom
  useEffect(() => {
    if (activeTab === 'message') {
      chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isTyping, activeTab]);

  // Auto clean up call sounds when closing modal
  useEffect(() => {
    if (!isOpen) {
      stopPhoneRingbackTone();
      setCallState('idle');
      setCallSeconds(0);
      setShowKeypad(false);
      setKeypadInput('');
    }
  }, [isOpen]);

  if (!isOpen || !alert) return null;

  const patient = patients.find((p) => p.id === alert.patientId);
  const room = alert.roomNumber || patient?.roomNumber || 'ICU';
  const patientName = alert.patientName || patient?.name || (language === 'vi' ? 'Bệnh nhân' : 'Patient');
  const backupDoc = doctors.find((d) => d.isBackup || !d.isOnCall) || doctors[1] || currentDoctor;

  // Format call duration MM:SS
  const formatDuration = (sec: number) => {
    const mins = Math.floor(sec / 60);
    const s = sec % 60;
    return `${mins.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  // Get recipient display details
  const getTargetInfo = () => {
    switch (selectedTarget) {
      case 'nurse':
        return {
          title: language === 'vi' ? 'Trạm Y Tá Trực Trung Tâm' : 'Central ICU Nurse Station',
          subtitle: language === 'vi' ? 'Hotline nội bộ Ext #201 • Trực 24/7' : 'Internal Hotline Ext #201 • 24/7 Active',
          phone: '#201 (ICU Kiosk)',
          role: language === 'vi' ? 'Điều dưỡng trưởng ca trực' : 'Charge Nurse On-Duty',
          avatarBg: 'bg-emerald-600/20 text-emerald-500 border-emerald-500/30',
        };
      case 'codeblue':
        return {
          title: language === 'vi' ? 'Đội Cấp Cứu Phản Ứng Nhanh (Code Blue)' : 'Rapid Response Team (Code Blue)',
          subtitle: language === 'vi' ? 'Hotline Báo Động Đỏ Toàn Viện Ext #999' : 'Hospital-wide Code Blue Ext #999',
          phone: '#999 (Code Blue)',
          role: language === 'vi' ? 'Bác sĩ & Điều dưỡng hồi sức cấp cứu' : 'Resuscitation & Crash Team',
          avatarBg: 'bg-red-600/20 text-red-500 border-red-500/30',
        };
      case 'backup':
        return {
          title: backupDoc ? backupDoc.name : (language === 'vi' ? 'BS. Đặng Thùy Trang' : 'Dr. Dang Thuy Trang'),
          subtitle: language === 'vi' ? `Bác sĩ dự phòng • ${backupDoc?.department || 'ICU'}` : `Backup Physician • ${backupDoc?.department || 'ICU'}`,
          phone: backupDoc?.phone || '0912-334-455',
          role: language === 'vi' ? 'Bác Sĩ Chuyên Khoa Hồi Sức' : 'ICU Attending Specialist',
          avatarBg: 'bg-purple-600/20 text-purple-500 border-purple-500/30',
        };
      case 'anesthesia':
        return {
          title: language === 'vi' ? 'Khoa Gây Mê & Dược Lâm Sàng' : 'Anesthesia & Pharmacy Dispatch',
          subtitle: language === 'vi' ? 'Phòng chuẩn bị thuốc khẩn cấp Ext #108' : 'Emergency Med & Anesthesia Ext #108',
          phone: '#108 (Pharmacy)',
          role: language === 'vi' ? 'Dược sĩ trực hồi sức cấp cứu' : 'Clinical ICU Pharmacist',
          avatarBg: 'bg-sky-600/20 text-sky-500 border-sky-500/30',
        };
    }
  };

  const targetInfo = getTargetInfo();

  // START CALL HANDLER
  const handleStartCall = () => {
    setCallState('calling');
    setCallSeconds(0);
    setTranscript([]);
    startPhoneRingbackTone();

    // After 2.5s simulate phone answer
    setTimeout(() => {
      stopPhoneRingbackTone();
      playCallConnectedTone();
      setCallState('connected');

      // Auto greet line from the recipient
      const nowTime = new Date().toLocaleTimeString(language === 'vi' ? 'vi-VN' : 'en-US');
      let initialResponse = '';
      if (selectedTarget === 'nurse') {
        initialResponse =
          language === 'vi'
            ? `Trạm điều dưỡng ICU nghe! Chúng tôi đã thấy báo động phòng ${room} của bệnh nhân ${patientName} (${alert.heartRate} BPM, ${alert.reason}). Đang điều dưỡng có mặt tại giường bệnh!`
            : `ICU Nurse Station answering! We see telemetry alarm for Room ${room} - ${patientName} (${alert.heartRate} BPM, ${alert.reason}). Nurse is at bedside!`;
      } else if (selectedTarget === 'codeblue') {
        initialResponse =
          language === 'vi'
            ? `Đội Cấp Cứu Code Blue nghe! Nhận lệnh khẩn cấp phòng ${room} - BN ${patientName}. Xe cấp cứu crash cart và máy sốc điện đang được đẩy đến!`
            : `Code Blue Rapid Response responding! Emergency order received for Room ${room} - ${patientName}. Crash cart and defibrillator en route!`;
      } else if (selectedTarget === 'backup') {
        initialResponse =
          language === 'vi'
            ? `Tôi là ${backupDoc.name} nghe! Đã nhận được cảnh báo leo thang phòng ${room}. Tôi đang mặc áo vô khuẩn vào hỗ trợ ngay!`
            : `Dr. ${backupDoc.name} on the line! Received escalation for Room ${room}. Scrubbing in to assist immediately!`;
      } else {
        initialResponse =
          language === 'vi'
            ? `Dược lâm sàng nghe! Đã sẵn sàng các ống thuốc cấp cứu cho phòng ${room} (${patientName}). Bác sĩ cần loại thuốc nào?`
            : `ICU Pharmacy responding! Ready with emergency ampoules for Room ${room} (${patientName}). What medications do you need?`;
      }

      setTranscript([
        {
          id: 't-init',
          speaker: targetInfo.title,
          text: initialResponse,
          time: nowTime,
          isDoctor: false,
        },
      ]);
    }, 2400);
  };

  // END CALL HANDLER
  const handleEndCall = () => {
    stopPhoneRingbackTone();
    playCallEndTone();
    setCallState('ended');
    setTimeout(() => {
      setCallState('idle');
      setCallSeconds(0);
    }, 1800);
  };

  // VERBAL DIRECTIVE BUTTONS (Doctor speaks in call)
  const handleVerbalOrder = (orderTextVi: string, orderTextEn: string) => {
    if (callState !== 'connected') return;

    const docText = language === 'vi' ? orderTextVi : orderTextEn;
    const nowTime = new Date().toLocaleTimeString(language === 'vi' ? 'vi-VN' : 'en-US');

    // Add doctor transcript line
    setTranscript((prev) => [
      ...prev,
      {
        id: `t-doc-${Date.now()}`,
        speaker: currentDoctor.name,
        text: docText,
        time: nowTime,
        isDoctor: true,
      },
    ]);

    // Simulated reply from recipient
    setTimeout(() => {
      let replyText = '';
      if (orderTextVi.includes('sốc điện') || orderTextEn.includes('defibrillator')) {
        replyText =
          language === 'vi'
            ? 'Đã hiểu! Đã dán bản cực khử rung tim và sạc sẵn 150 Joules biphasic!'
            : 'Acknowledged! Pads applied, charging defibrillator to 150J biphasic!';
      } else if (orderTextVi.includes('Adrenaline') || orderTextEn.includes('Adrenaline') || orderTextVi.includes('Atropine')) {
        replyText =
          language === 'vi'
            ? 'Đã bẻ ống thuốc, chuẩn bị bơm tiêm tĩnh mạch sẵn sàng chờ lệnh tiêm của bác sĩ!'
            : 'Ampoule drawn into syringe, IV push ready on your direct count!';
      } else if (orderTextVi.includes('phòng ngay') || orderTextEn.includes('en route')) {
        replyText =
          language === 'vi'
            ? 'Rõ! Đội ngũ điều dưỡng đang giữ thông thoáng đường thở và lắp máy đo SpO2 liên tục.'
            : 'Roger that! Airway patent, high-flow O2 running, continuous monitoring active.';
      } else {
        replyText =
          language === 'vi'
            ? 'Đã tiếp nhận toàn bộ y lệnh! Điều dưỡng đang thực hiện chính xác tại giường bệnh.'
            : 'Directives received and confirmed! Executing immediately at bedside.';
      }

      playMessageReceivedTone();
      setTranscript((prev) => [
        ...prev,
        {
          id: `t-reply-${Date.now()}`,
          speaker: targetInfo.title,
          text: replyText,
          time: new Date().toLocaleTimeString(language === 'vi' ? 'vi-VN' : 'en-US'),
          isDoctor: false,
        },
      ]);
    }, 1400);
  };

  // SEND TEXT MESSAGE HANDLER
  const handleSendMessage = (textToSend?: string) => {
    const text = (textToSend || inputMessage).trim();
    if (!text) return;

    playMessageSentTone();
    const nowTime = new Date().toLocaleTimeString(language === 'vi' ? 'vi-VN' : 'en-US');

    const newMsg: ChatMessage = {
      id: `msg-${Date.now()}`,
      sender: 'doctor',
      senderName: currentDoctor.name,
      senderRole: language === 'vi' ? 'Bác Sĩ Trực Ca' : 'On-Call Attending',
      text,
      timestamp: nowTime,
    };

    setMessages((prev) => [...prev, newMsg]);
    setInputMessage('');
    setIsTyping(true);

    // Simulated instant reply from nurse/code blue team
    setTimeout(() => {
      setIsTyping(false);
      playMessageReceivedTone();

      let reply = '';
      if (text.includes('sốc điện') || text.toLowerCase().includes('defib')) {
        reply =
          language === 'vi'
            ? `⚡ Đã bật máy phá rung tim tại Phòng ${room}! Gel dẫn điện và bản cực đã sẵn sàng.`
            : `⚡ Bedside defibrillator powered on in Room ${room}! Pads and conductive gel ready.`;
      } else if (text.includes('Adrenaline') || text.includes('Epinephrine') || text.includes('Atropine')) {
        reply =
          language === 'vi'
            ? `💉 Đã lấy sẵn 1mg thuốc tiêm qua đường truyền tĩnh mạch ngoại vi phòng ${room}.`
            : `💉 1mg IV medication prepared via peripheral line in Room ${room}.`;
      } else if (text.includes('đang đến') || text.toLowerCase().includes('en route')) {
        reply =
          language === 'vi'
            ? `🏃 Đã rõ! Điều dưỡng Lan Anh & Mai đang túc trực bên giường BN ${patientName}.`
            : `🏃 Roger! Nurses Lan Anh & Mai are standing by patient ${patientName}.`;
      } else {
        reply =
          language === 'vi'
            ? `✅ Trạm ICU đã nhận lệnh cho phòng ${room}: "${text}". Đang tiến hành can thiệp khẩn!`
            : `✅ ICU station confirmed order for Room ${room}: "${text}". Rapid intervention underway!`;
      }

      const nurseReply: ChatMessage = {
        id: `reply-${Date.now()}`,
        sender: selectedTarget === 'codeblue' ? 'codeblue' : selectedTarget === 'backup' ? 'backup' : 'nurse',
        senderName: targetInfo.title,
        senderRole: targetInfo.role,
        text: reply,
        timestamp: new Date().toLocaleTimeString(language === 'vi' ? 'vi-VN' : 'en-US'),
      };

      setMessages((prev) => [...prev, nurseReply]);
    }, 1200);
  };

  // Quick message template chips
  const messageTemplates = [
    {
      vi: `⚡ Chuẩn bị sẵn máy sốc điện và xe cấp cứu tại phòng ${room}!`,
      en: `⚡ Deploy defibrillator and crash cart to Room ${room}!`,
    },
    {
      vi: `💉 Lấy sẵn 1 ống Adrenaline 1mg và đường truyền IV cho BN ${patientName}!`,
      en: `💉 Prepare 1mg Epinephrine IV ampoule for ${patientName}!`,
    },
    {
      vi: `🏃 Tôi đang chạy vào phòng ${room} ngay trong 15 giây!`,
      en: `🏃 I am en route to Room ${room} now in 15 seconds!`,
    },
    {
      vi: `🩺 Cho thở oxy mask 10L/phút và đo lại huyết áp ngay!`,
      en: `🩺 Apply 10L/min O2 mask and recheck blood pressure!`,
    },
    {
      vi: `🚨 Kích hoạt báo động Code Blue huy động thêm 2 điều dưỡng hỗ trợ!`,
      en: `🚨 Trigger Code Blue alert and dispatch 2 backup nurses!`,
    },
  ];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md animate-fadeIn"
      onClick={onClose}
    >
      <div
        className={`w-full max-w-3xl rounded-3xl border shadow-2xl overflow-hidden flex flex-col max-h-[92vh] transition-all ${
          isDark ? 'bg-slate-900 border-slate-700 text-white' : 'bg-white border-slate-200 text-slate-900'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* MODAL HEADER WITH ACTIVE ALERT BADGE */}
        <div
          className={`p-4 sm:p-5 border-b relative ${
            isDark ? 'bg-gradient-to-r from-red-950/90 via-slate-900 to-slate-950 border-slate-800' : 'bg-gradient-to-r from-red-50 via-white to-slate-50 border-slate-200'
          }`}
        >
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-red-600 text-white flex items-center justify-center shadow-lg shadow-red-600/30 shrink-0">
                <PhoneCall className="w-6 h-6 animate-pulse" />
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-lg sm:text-xl font-black tracking-tight">{t.quickContactTitle}</h3>
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-black uppercase bg-red-600 text-white flex items-center gap-1 shadow-sm">
                    <ShieldAlert className="w-3.5 h-3.5" />
                    {alert.severity === 'Fatal' ? t.codeRed : t.criticalAlert}
                  </span>
                </div>
                <p className={`text-xs mt-0.5 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                  {t.quickContactSubtitle}
                </p>
              </div>
            </div>

            <button
              onClick={onClose}
              className={`p-2 rounded-xl border transition-colors ${
                isDark ? 'border-slate-800 hover:bg-slate-800 text-slate-400 hover:text-white' : 'border-slate-200 hover:bg-slate-100 text-slate-600 hover:text-slate-900'
              }`}
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* ACTIVE ALERT PATIENT STRIP */}
          <div
            className={`mt-3 p-2.5 sm:p-3 rounded-2xl border flex flex-wrap items-center justify-between gap-3 text-xs ${
              isDark ? 'bg-slate-950/80 border-red-500/40 text-slate-200' : 'bg-red-50/80 border-red-200 text-slate-800'
            }`}
          >
            <div className="flex items-center gap-2">
              <Bed className="w-4 h-4 text-blue-500" />
              <span className="font-bold text-sm text-blue-500">
                {t.room} {room}
              </span>
              <span className="font-semibold text-sm">
                • {patientName} ({patient?.age || 62}{language === 'vi' ? 't' : 'yo'})
              </span>
            </div>

            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1 font-bold text-red-500">
                <Heart className="w-4 h-4 animate-ping" />
                <span className="text-sm font-black font-mono">{alert.heartRate} BPM</span>
              </div>
              {alert.spO2 !== undefined && (
                <div className="font-bold text-sky-500">SpO2: {alert.spO2}%</div>
              )}
              <span className="text-[11px] opacity-75 italic max-w-[200px] truncate">"{alert.reason}"</span>
            </div>
          </div>
        </div>

        {/* TABS: PHONE CALL VS MESSAGING */}
        <div className={`flex border-b px-4 ${isDark ? 'border-slate-800 bg-slate-950/50' : 'border-slate-200 bg-slate-50'}`}>
          <button
            id="tab-quick-call"
            onClick={() => setActiveTab('call')}
            className={`flex items-center gap-2 py-3 px-4 text-xs sm:text-sm font-bold border-b-2 transition-all cursor-pointer ${
              activeTab === 'call'
                ? 'border-red-500 text-red-500'
                : isDark
                ? 'border-transparent text-slate-400 hover:text-slate-200'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <Phone className="w-4 h-4" />
            <span>{t.tabPhoneCall}</span>
            {callState === 'connected' && (
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            )}
          </button>

          <button
            id="tab-quick-message"
            onClick={() => setActiveTab('message')}
            className={`flex items-center gap-2 py-3 px-4 text-xs sm:text-sm font-bold border-b-2 transition-all cursor-pointer ${
              activeTab === 'message'
                ? 'border-blue-500 text-blue-500'
                : isDark
                ? 'border-transparent text-slate-400 hover:text-slate-200'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <MessageSquare className="w-4 h-4" />
            <span>{t.tabMessaging}</span>
            <span className="px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-blue-500/20 text-blue-500">
              {messages.length}
            </span>
          </button>

          {onOpenGmail && (
            <button
              id="btn-quick-contact-gmail"
              onClick={() => {
                onClose();
                onOpenGmail(alert);
              }}
              className={`ml-auto my-auto flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                isDark
                  ? 'bg-rose-950/40 hover:bg-rose-900/60 text-rose-400 border border-rose-500/30'
                  : 'bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200'
              }`}
              title={language === 'vi' ? 'Gửi email Gmail cảnh báo khẩn cấp' : 'Dispatch Emergency Gmail Alert'}
            >
              <Mail className="w-3.5 h-3.5 text-rose-500" />
              <span>Gmail Dispatch</span>
            </button>
          )}
        </div>

        {/* RECIPIENT SELECTOR BAR */}
        <div className={`p-3 border-b flex items-center gap-2 overflow-x-auto ${isDark ? 'border-slate-800 bg-slate-950/30' : 'border-slate-100 bg-slate-50/50'}`}>
          <span className={`text-[11px] font-semibold shrink-0 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
            {t.contactTargetLabel}
          </span>
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setSelectedTarget('nurse')}
              disabled={callState === 'connected'}
              className={`px-3 py-1 rounded-xl text-xs font-bold transition-all shrink-0 border cursor-pointer ${
                selectedTarget === 'nurse'
                  ? 'bg-emerald-600 text-white border-emerald-500 shadow-sm'
                  : isDark
                  ? 'bg-slate-800/80 text-slate-300 border-slate-700 hover:bg-slate-700'
                  : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
              }`}
            >
              🏥 {t.contactNurseStation}
            </button>
            <button
              onClick={() => setSelectedTarget('codeblue')}
              disabled={callState === 'connected'}
              className={`px-3 py-1 rounded-xl text-xs font-bold transition-all shrink-0 border cursor-pointer ${
                selectedTarget === 'codeblue'
                  ? 'bg-red-600 text-white border-red-500 shadow-sm'
                  : isDark
                  ? 'bg-slate-800/80 text-slate-300 border-slate-700 hover:bg-slate-700'
                  : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
              }`}
            >
              🚨 {t.contactCodeBlue}
            </button>
            <button
              onClick={() => setSelectedTarget('backup')}
              disabled={callState === 'connected'}
              className={`px-3 py-1 rounded-xl text-xs font-bold transition-all shrink-0 border cursor-pointer ${
                selectedTarget === 'backup'
                  ? 'bg-purple-600 text-white border-purple-500 shadow-sm'
                  : isDark
                  ? 'bg-slate-800/80 text-slate-300 border-slate-700 hover:bg-slate-700'
                  : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
              }`}
            >
              👨‍⚕️ {t.contactBackupDoctor} ({backupDoc?.name?.split(' ').pop()})
            </button>
            <button
              onClick={() => setSelectedTarget('anesthesia')}
              disabled={callState === 'connected'}
              className={`px-3 py-1 rounded-xl text-xs font-bold transition-all shrink-0 border cursor-pointer ${
                selectedTarget === 'anesthesia'
                  ? 'bg-sky-600 text-white border-sky-500 shadow-sm'
                  : isDark
                  ? 'bg-slate-800/80 text-slate-300 border-slate-700 hover:bg-slate-700'
                  : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
              }`}
            >
              💊 {t.contactAnesthesia}
            </button>
          </div>
        </div>

        {/* TAB 1: PHONE CALL SIMULATION */}
        {activeTab === 'call' && (
          <div className="p-4 sm:p-6 overflow-y-auto flex-1 space-y-6">
            {/* CALLER ID BOX */}
            <div
              className={`p-6 rounded-3xl border flex flex-col items-center justify-center text-center relative overflow-hidden transition-all ${
                callState === 'connected'
                  ? isDark
                    ? 'bg-gradient-to-b from-emerald-950/40 via-slate-900 to-slate-950 border-emerald-500/50 shadow-xl'
                    : 'bg-gradient-to-b from-emerald-50 via-white to-slate-50 border-emerald-300 shadow-lg'
                  : callState === 'calling'
                  ? isDark
                    ? 'bg-gradient-to-b from-amber-950/40 via-slate-900 to-slate-950 border-amber-500/50 shadow-xl'
                    : 'bg-gradient-to-b from-amber-50 via-white to-slate-50 border-amber-300 shadow-lg'
                  : isDark
                  ? 'bg-slate-950/70 border-slate-800'
                  : 'bg-slate-50 border-slate-200'
              }`}
            >
              {/* Pulsing ring visualizer during calling / connected */}
              {callState === 'calling' && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <div className="w-36 h-36 rounded-full border-2 border-amber-500/40 animate-ping" />
                  <div className="w-48 h-48 rounded-full border border-amber-500/20 animate-pulse" />
                </div>
              )}

              {callState === 'connected' && (
                <div className="absolute top-4 right-4 flex items-center gap-1 text-emerald-500 text-xs font-mono font-bold bg-emerald-500/10 border border-emerald-500/30 px-2.5 py-1 rounded-full">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  <span>{formatDuration(callSeconds)}</span>
                </div>
              )}

              {/* Avatar Icon */}
              <div
                className={`w-20 h-20 rounded-3xl flex items-center justify-center border text-2xl font-bold shadow-xl mb-3 relative z-10 transition-all ${
                  targetInfo.avatarBg
                } ${callState === 'calling' ? 'scale-105' : ''}`}
              >
                {selectedTarget === 'nurse' && '🏥'}
                {selectedTarget === 'codeblue' && '🚨'}
                {selectedTarget === 'backup' && '👨‍⚕️'}
                {selectedTarget === 'anesthesia' && '💊'}
              </div>

              <h4 className={`text-lg sm:text-xl font-black ${isDark ? 'text-white' : 'text-slate-900'}`}>
                {targetInfo.title}
              </h4>
              <p className={`text-xs mt-0.5 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                {targetInfo.subtitle}
              </p>
              <div className="mt-1 font-mono text-xs font-semibold text-blue-500">
                {targetInfo.phone}
              </div>

              {/* Status text */}
              <div className="mt-4">
                {callState === 'idle' && (
                  <span className={`text-xs font-medium ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                    {language === 'vi' ? 'Sẵn sàng kết nối đường truyền trực tiếp' : 'Ready to establish emergency audio link'}
                  </span>
                )}
                {callState === 'calling' && (
                  <div className="flex items-center gap-2 text-amber-500 font-bold text-sm animate-pulse">
                    <Radio className="w-4 h-4 animate-spin" />
                    <span>{t.btnCalling}</span>
                  </div>
                )}
                {callState === 'connected' && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-center gap-2 text-emerald-500 font-black text-sm">
                      <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping" />
                      <span>{t.btnInCall} • {isSpeakerOn ? t.speakerActive : t.speakerOff}</span>
                    </div>

                    {/* Audio Waveform Animation Bars */}
                    <div className="flex items-center justify-center gap-1 h-6">
                      {[40, 75, 95, 60, 85, 100, 70, 50, 90, 65, 80, 45].map((height, i) => (
                        <div
                          key={i}
                          className="w-1 bg-emerald-500 rounded-full animate-pulse"
                          style={{
                            height: `${height}%`,
                            animationDelay: `${i * 0.1}s`,
                            animationDuration: '0.8s',
                          }}
                        />
                      ))}
                    </div>
                  </div>
                )}
                {callState === 'ended' && (
                  <span className="text-xs font-bold text-red-400">
                    {language === 'vi' ? 'Cuộc gọi đã kết thúc' : 'Call disconnected'}
                  </span>
                )}
              </div>

              {/* CALL CONTROLS */}
              <div className="mt-6 flex items-center justify-center gap-3 sm:gap-4 flex-wrap z-10">
                {callState === 'idle' ? (
                  <button
                    id="btn-trigger-hotline-call"
                    onClick={handleStartCall}
                    className="px-6 py-3.5 bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white font-black text-sm rounded-2xl shadow-lg shadow-emerald-950/50 flex items-center gap-2.5 transition-all cursor-pointer"
                  >
                    <PhoneCall className="w-5 h-5" />
                    <span>{t.btnStartCall}</span>
                  </button>
                ) : (
                  <>
                    {/* Mute toggle */}
                    <button
                      onClick={() => setIsMuted(!isMuted)}
                      className={`p-3.5 rounded-2xl border transition-all cursor-pointer ${
                        isMuted
                          ? 'bg-red-500/20 text-red-500 border-red-500/40'
                          : isDark
                          ? 'bg-slate-800 text-slate-200 border-slate-700 hover:bg-slate-700'
                          : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
                      }`}
                      title={isMuted ? t.callMuted : t.callUnmuted}
                    >
                      {isMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
                    </button>

                    {/* Speakerphone toggle */}
                    <button
                      onClick={() => setIsSpeakerOn(!isSpeakerOn)}
                      className={`p-3.5 rounded-2xl border transition-all cursor-pointer ${
                        isSpeakerOn
                          ? 'bg-blue-500/20 text-blue-500 border-blue-500/40'
                          : isDark
                          ? 'bg-slate-800 text-slate-200 border-slate-700 hover:bg-slate-700'
                          : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
                      }`}
                      title={isSpeakerOn ? t.speakerActive : t.speakerOff}
                    >
                      {isSpeakerOn ? <Volume2 className="w-5 h-5" /> : <VolumeX className="w-5 h-5" />}
                    </button>

                    {/* Keypad toggle */}
                    <button
                      onClick={() => setShowKeypad(!showKeypad)}
                      className={`p-3.5 rounded-2xl border transition-all cursor-pointer ${
                        showKeypad
                          ? 'bg-purple-500/20 text-purple-500 border-purple-500/40'
                          : isDark
                          ? 'bg-slate-800 text-slate-200 border-slate-700 hover:bg-slate-700'
                          : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
                      }`}
                      title="Keypad"
                    >
                      <Grid className="w-5 h-5" />
                    </button>

                    {/* Hang Up Button */}
                    <button
                      id="btn-hangup-call"
                      onClick={handleEndCall}
                      className="px-6 py-3.5 bg-red-600 hover:bg-red-500 active:scale-95 text-white font-black text-sm rounded-2xl shadow-lg shadow-red-950/50 flex items-center gap-2 transition-all cursor-pointer"
                    >
                      <PhoneOff className="w-5 h-5" />
                      <span>{t.btnEndCall}</span>
                    </button>
                  </>
                )}
              </div>

              {/* KEYPAD POPUP */}
              {showKeypad && (
                <div
                  className={`mt-4 p-4 rounded-2xl border w-full max-w-xs transition-all ${
                    isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200 shadow-md'
                  }`}
                >
                  <div className="font-mono text-center text-sm font-bold mb-2 h-6 text-emerald-500">
                    {keypadInput || 'DTMF Dialing'}
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    {['1', '2', '3', '4', '5', '6', '7', '8', '9', '*', '0', '#'].map((k) => (
                      <button
                        key={k}
                        onClick={() => {
                          playDtmfTone(k);
                          setKeypadInput((prev) => prev + k);
                        }}
                        className={`py-2 rounded-xl text-xs font-mono font-bold border cursor-pointer active:scale-95 ${
                          isDark ? 'bg-slate-800 hover:bg-slate-700 text-white border-slate-700' : 'bg-slate-100 hover:bg-slate-200 text-slate-800 border-slate-200'
                        }`}
                      >
                        {k}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* LIVE VERBAL DIRECTIVES & DIALOGUE TRANSCRIPT */}
            {callState === 'connected' && (
              <div className="space-y-4">
                {/* 1-Tap Verbal Directives */}
                <div>
                  <div className="flex items-center gap-1.5 text-xs font-bold mb-2 text-emerald-500">
                    <Sparkles className="w-4 h-4" />
                    <span>{t.quickVerbalOrders}</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <button
                      onClick={() =>
                        handleVerbalOrder(
                          `Yêu cầu chuẩn bị máy sốc điện tại phòng ${room} ngay!`,
                          `Prepare bedside defibrillator in Room ${room} immediately!`
                        )
                      }
                      className={`p-2.5 rounded-xl border text-left text-xs font-semibold flex items-center gap-2 transition-all hover:scale-[1.01] cursor-pointer ${
                        isDark ? 'bg-slate-950 hover:bg-slate-800 border-slate-800 text-slate-200' : 'bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-800'
                      }`}
                    >
                      <span className="text-red-500 font-bold">⚡</span>
                      <span>{language === 'vi' ? 'Chuẩn bị máy phá rung tim' : 'Prepare defibrillator'}</span>
                    </button>

                    <button
                      onClick={() =>
                        handleVerbalOrder(
                          `Lấy sẵn ống tiêm Adrenaline 1mg qua đường truyền IV!`,
                          `Prepare 1mg Epinephrine IV injection ready!`
                        )
                      }
                      className={`p-2.5 rounded-xl border text-left text-xs font-semibold flex items-center gap-2 transition-all hover:scale-[1.01] cursor-pointer ${
                        isDark ? 'bg-slate-950 hover:bg-slate-800 border-slate-800 text-slate-200' : 'bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-800'
                      }`}
                    >
                      <span className="text-purple-500 font-bold">💉</span>
                      <span>{language === 'vi' ? 'Lấy ống tiêm Adrenaline 1mg' : 'Draw 1mg Epinephrine IV'}</span>
                    </button>

                    <button
                      onClick={() =>
                        handleVerbalOrder(
                          `Bác sĩ đang di chuyển đến phòng ${room} trong 15 giây!`,
                          `Doctor entering Room ${room} in 15 seconds!`
                        )
                      }
                      className={`p-2.5 rounded-xl border text-left text-xs font-semibold flex items-center gap-2 transition-all hover:scale-[1.01] cursor-pointer ${
                        isDark ? 'bg-slate-950 hover:bg-slate-800 border-slate-800 text-slate-200' : 'bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-800'
                      }`}
                    >
                      <span className="text-emerald-500 font-bold">🏃</span>
                      <span>{language === 'vi' ? 'Bác sĩ đến phòng ngay lập tức' : 'Physician en route to room'}</span>
                    </button>

                    <button
                      onClick={() =>
                        handleVerbalOrder(
                          `Huy động đội Code Blue và kiểm tra đường thở cho bệnh nhân!`,
                          `Mobilize Code Blue team and secure patient airway!`
                        )
                      }
                      className={`p-2.5 rounded-xl border text-left text-xs font-semibold flex items-center gap-2 transition-all hover:scale-[1.01] cursor-pointer ${
                        isDark ? 'bg-slate-950 hover:bg-slate-800 border-slate-800 text-slate-200' : 'bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-800'
                      }`}
                    >
                      <span className="text-amber-500 font-bold">🚨</span>
                      <span>{language === 'vi' ? 'Kích hoạt Code Blue toàn khoa' : 'Activate Code Blue protocol'}</span>
                    </button>
                  </div>
                </div>

                {/* Simulated Speech Transcript Box */}
                <div
                  className={`p-4 rounded-2xl border space-y-3 ${
                    isDark ? 'bg-slate-950/90 border-slate-800' : 'bg-slate-50 border-slate-200'
                  }`}
                >
                  <div className="flex items-center justify-between text-xs font-bold border-b pb-2 text-slate-400">
                    <span className="flex items-center gap-1.5">
                      <Radio className="w-3.5 h-3.5 text-emerald-500" />
                      {t.simulatedSpeechTranscript}
                    </span>
                    <span className="font-mono text-[11px] text-emerald-500">Live Audio Stream</span>
                  </div>

                  <div className="space-y-2.5 max-h-48 overflow-y-auto pr-1">
                    {transcript.map((line) => (
                      <div
                        key={line.id}
                        className={`text-xs p-2.5 rounded-xl ${
                          line.isDoctor
                            ? isDark
                              ? 'bg-blue-950/50 border border-blue-800/40 text-blue-200 ml-4'
                              : 'bg-blue-50 border border-blue-200 text-blue-900 ml-4'
                            : isDark
                            ? 'bg-slate-900 border border-slate-800 text-slate-200 mr-4'
                            : 'bg-white border border-slate-200 text-slate-800 mr-4'
                        }`}
                      >
                        <div className="flex items-center justify-between font-bold text-[11px] mb-1 opacity-75">
                          <span>{line.speaker}</span>
                          <span className="font-mono">{line.time}</span>
                        </div>
                        <p className="font-medium leading-relaxed">{line.text}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB 2: MESSAGING & ICU DISPATCH CHAT */}
        {activeTab === 'message' && (
          <div className="flex flex-col flex-1 min-h-[380px] max-h-[500px] overflow-hidden">
            {/* 1-TAP RAPID RESPONSE TEMPLATES */}
            <div className={`p-2.5 border-b overflow-x-auto ${isDark ? 'bg-slate-950/60 border-slate-800' : 'bg-slate-50 border-slate-200'}`}>
              <div className="flex items-center gap-1.5 text-[11px] font-bold text-blue-500 mb-1.5 px-1">
                <Zap className="w-3.5 h-3.5" />
                <span>{t.quickMessageTemplates}</span>
              </div>
              <div className="flex items-center gap-1.5">
                {messageTemplates.map((tmpl, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleSendMessage(language === 'vi' ? tmpl.vi : tmpl.en)}
                    className={`px-3 py-1 rounded-xl text-xs font-semibold shrink-0 border transition-all cursor-pointer active:scale-95 ${
                      isDark
                        ? 'bg-slate-900 hover:bg-slate-800 text-slate-200 border-slate-700'
                        : 'bg-white hover:bg-slate-100 text-slate-800 border-slate-200'
                    }`}
                  >
                    {language === 'vi' ? tmpl.vi : tmpl.en}
                  </button>
                ))}
              </div>
            </div>

            {/* CHAT MESSAGES LOG */}
            <div className="flex-1 p-4 overflow-y-auto space-y-3.5">
              {messages.map((msg) => {
                const isMine = msg.sender === 'doctor';
                return (
                  <div
                    key={msg.id}
                    className={`flex flex-col ${isMine ? 'items-end' : 'items-start'}`}
                  >
                    <div className="flex items-center gap-1.5 mb-1 px-1">
                      <span className={`text-[11px] font-bold ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                        {msg.senderName}
                      </span>
                      <span className="text-[10px] text-slate-500">({msg.senderRole})</span>
                    </div>

                    <div
                      className={`max-w-[85%] p-3.5 rounded-2xl text-xs leading-relaxed shadow-sm ${
                        isMine
                          ? 'bg-blue-600 text-white rounded-tr-none'
                          : isDark
                          ? 'bg-slate-800 text-slate-100 rounded-tl-none border border-slate-700'
                          : 'bg-slate-100 text-slate-900 rounded-tl-none border border-slate-200'
                      }`}
                    >
                      <p className="font-medium whitespace-pre-wrap">{msg.text}</p>
                      <div
                        className={`flex items-center justify-end gap-1 text-[10px] mt-1.5 ${
                          isMine ? 'text-blue-200' : 'text-slate-400'
                        }`}
                      >
                        <Clock className="w-3 h-3" />
                        <span>{msg.timestamp}</span>
                        {isMine && <CheckCheck className="w-3.5 h-3.5 ml-0.5 text-blue-200" />}
                      </div>
                    </div>
                  </div>
                );
              })}

              {/* Typing indicator */}
              {isTyping && (
                <div className="flex items-center gap-2 text-xs text-slate-400 italic px-2">
                  <span className="w-2 h-2 rounded-full bg-blue-500 animate-ping" />
                  <span>{t.nurseTyping}</span>
                </div>
              )}

              <div ref={chatBottomRef} />
            </div>

            {/* MESSAGE INPUT BOX */}
            <div className={`p-3 border-t ${isDark ? 'bg-slate-950 border-slate-800' : 'bg-white border-slate-200'}`}>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleSendMessage();
                }}
                className="flex items-center gap-2"
              >
                <input
                  type="text"
                  placeholder={t.inputMessagePlaceholder}
                  value={inputMessage}
                  onChange={(e) => setInputMessage(e.target.value)}
                  className={`flex-1 rounded-xl px-4 py-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 border ${
                    isDark ? 'bg-slate-900 border-slate-700 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'
                  }`}
                />
                <button
                  id="btn-send-quick-directive"
                  type="submit"
                  disabled={!inputMessage.trim()}
                  className="px-4 py-2.5 bg-blue-600 hover:bg-blue-500 active:scale-95 text-white font-bold text-xs rounded-xl shadow-md transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-40"
                >
                  <Send className="w-4 h-4" />
                  <span className="hidden sm:inline">{t.btnSendMsg}</span>
                </button>
              </form>
            </div>
          </div>
        )}

        {/* MODAL FOOTER */}
        <div className={`p-3 border-t flex items-center justify-between text-xs ${isDark ? 'bg-slate-950/80 border-slate-800 text-slate-400' : 'bg-slate-50 border-slate-200 text-slate-600'}`}>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            <span>{currentDoctor.name} ({t.dutyDoctor})</span>
          </div>
          <button
            onClick={onClose}
            className={`px-4 py-1.5 rounded-xl border text-xs font-bold transition-colors ${
              isDark ? 'border-slate-700 hover:bg-slate-800 text-slate-300' : 'border-slate-300 hover:bg-slate-200 text-slate-700'
            }`}
          >
            {t.btnCancel}
          </button>
        </div>
      </div>
    </div>
  );
};
