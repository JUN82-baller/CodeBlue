import express from 'express';
import http from 'http';
import path from 'path';
import { WebSocketServer, WebSocket } from 'ws';
import { createServer as createViteServer } from 'vite';
import {
  Alert,
  Doctor,
  MedicationSchedule,
  Patient,
  SystemSettings,
  SystemStats,
  VitalReading,
  WsGroup,
  WsServerMessage,
} from './src/types';

const PORT = 3000;
const app = express();
app.use(express.json());

// In-Memory Database with realistic seed data
const initialPatients: Patient[] = [
  { id: 'P101', name: 'Nguyễn Văn Hùng', roomNumber: 'P.101', age: 68, bed: 'G01', diagnosis: 'Suy tim độ III / Tăng huyết áp' },
  { id: 'P102', name: 'Trần Thị Mai', roomNumber: 'P.102', age: 54, bed: 'G02', diagnosis: 'Hậu phẫu bắc cầu mạch vành' },
  { id: 'P201', name: 'Lê Hoàng Nam', roomNumber: 'P.201', age: 72, bed: 'G01', diagnosis: 'Rung nhĩ kịch phát / COPD' },
  { id: 'P203', name: 'Phạm Minh Tuấn', roomNumber: 'P.203', age: 46, bed: 'G03', diagnosis: 'Nhồi máu cơ tim cấp đang theo dõi' },
  { id: 'P305', name: 'Đoàn Thúy Vy', roomNumber: 'P.305', age: 61, bed: 'G02', diagnosis: 'Viêm cơ tim cấp / Hồi sức tích cực (ICU)' },
  { id: 'P308', name: 'Vũ Quốc Bảo', roomNumber: 'P.308', age: 39, bed: 'G01', diagnosis: 'Rối loạn nhịp thất sau can thiệp' },
];

let patients: Patient[] = [...initialPatients];

const initialDoctors: Doctor[] = [
  {
    id: 'DOC01',
    name: 'BS. CKII. Nguyễn Quốc Trí',
    role: 'Trưởng Ca Trực ICU',
    department: 'Hồi Sức Cấp Cứu (ICU)',
    phone: '0912-345-678',
    email: 'tri.nguyen@hospital.vn',
    isOnCall: true,
    isBackup: false,
    shift: '24h',
  },
  {
    id: 'DOC02',
    name: 'ThS. BS. Phạm Thu Trang',
    role: 'Bác Sĩ Tim Mạch',
    department: 'Tim Mạch Can Thiệp',
    phone: '0988-123-456',
    email: 'trang.pham@hospital.vn',
    isOnCall: true,
    isBackup: false,
    shift: 'Ca Ngày',
  },
  {
    id: 'DOC03',
    name: 'BS. CKI. Lê Hải Đăng',
    role: 'Bác Sĩ Dự Phòng Cấp Cứu',
    department: 'Cấp Cứu Ngoại Viện',
    phone: '0903-888-999',
    email: 'dang.le@hospital.vn',
    isOnCall: false,
    isBackup: true,
    shift: 'Ca Đêm',
  },
  {
    id: 'DOC04',
    name: 'BS. Vũ Đức Anh',
    role: 'Bác Sĩ Nội Khoa',
    department: 'Nội Tim Mạch Tổng Quát',
    phone: '0977-555-111',
    email: 'anh.vu@hospital.vn',
    isOnCall: false,
    isBackup: true,
    shift: '24h',
  },
  {
    id: 'NUR01',
    name: 'ĐD. Đặng Thị Hồng Hạnh',
    role: 'Điều Dưỡng Trưởng Trạm',
    department: 'Trạm Y Tá ICU Trung Tâm',
    phone: '0934-222-333',
    email: 'hanh.dang@hospital.vn',
    isOnCall: true,
    isBackup: false,
    shift: 'Ca Ngày',
  },
];

let doctors: Doctor[] = [...initialDoctors];

const todayDateStr = new Date().toISOString().split('T')[0];

const initialMedications: MedicationSchedule[] = [
  {
    id: 'MED-101',
    patientId: 'P101',
    patientName: 'Nguyễn Văn Hùng',
    roomNumber: 'P.101',
    bed: 'G01',
    medicationName: 'Digoxin 0.25mg',
    dosage: '1 viên (0.25mg)',
    route: 'Oral',
    scheduledTime: '08:00',
    scheduledDate: todayDateStr,
    frequency: '1 lần/ngày (08:00)',
    prescribedByDoctorId: 'DOC01',
    prescribedByDoctorName: 'BS. CKII. Nguyễn Quốc Trí',
    assignedNurseId: 'NUR01',
    assignedNurseName: 'ĐD. Đặng Thị Hồng Hạnh',
    instructions: 'Đo nhịp tim trước khi cho uống. Nếu nhịp tim < 60 bpm ngưng thuốc và báo bác sĩ.',
    preVitalsRequired: true,
    status: 'Scheduled',
    createdAt: new Date(Date.now() - 3600000 * 5).toISOString(),
  },
  {
    id: 'MED-102',
    patientId: 'P101',
    patientName: 'Nguyễn Văn Hùng',
    roomNumber: 'P.101',
    bed: 'G01',
    medicationName: 'Furosemide 20mg/2ml',
    dosage: '1 ống (20mg)',
    route: 'IV',
    scheduledTime: '14:00',
    scheduledDate: todayDateStr,
    frequency: '2 lần/ngày (08:00, 14:00)',
    prescribedByDoctorId: 'DOC01',
    prescribedByDoctorName: 'BS. CKII. Nguyễn Quốc Trí',
    assignedNurseId: 'NUR01',
    assignedNurseName: 'ĐD. Đặng Thị Hồng Hạnh',
    instructions: 'Tiêm tĩnh mạch chậm trong 2 phút. Theo dõi lượng nước tiểu.',
    preVitalsRequired: true,
    status: 'Scheduled',
    createdAt: new Date(Date.now() - 3600000 * 4).toISOString(),
  },
  {
    id: 'MED-103',
    patientId: 'P102',
    patientName: 'Trần Thị Mai',
    roomNumber: 'P.102',
    bed: 'G02',
    medicationName: 'Ceftriaxone 1g',
    dosage: '1 lọ (1g)',
    route: 'Infusion',
    scheduledTime: '09:00',
    scheduledDate: todayDateStr,
    frequency: '1 lần/ngày (09:00)',
    prescribedByDoctorId: 'DOC02',
    prescribedByDoctorName: 'ThS. BS. Phạm Thu Trang',
    assignedNurseId: 'NUR01',
    assignedNurseName: 'ĐD. Đặng Thị Hồng Hạnh',
    instructions: 'Pha với 100ml Natri Clorid 0.9% truyền tĩnh mạch 30 phút.',
    preVitalsRequired: false,
    status: 'Scheduled',
    createdAt: new Date(Date.now() - 3600000 * 3).toISOString(),
  },
  {
    id: 'MED-104',
    patientId: 'P201',
    patientName: 'Lê Hoàng Nam',
    roomNumber: 'P.201',
    bed: 'G01',
    medicationName: 'Amiodarone 150mg/3ml',
    dosage: '1 ống (150mg)',
    route: 'Infusion',
    scheduledTime: '10:00',
    scheduledDate: todayDateStr,
    frequency: 'Mỗi 8 giờ',
    prescribedByDoctorId: 'DOC01',
    prescribedByDoctorName: 'BS. CKII. Nguyễn Quốc Trí',
    assignedNurseId: 'NUR01',
    assignedNurseName: 'ĐD. Đặng Thị Hồng Hạnh',
    instructions: 'Truyền tĩnh mạch qua máy truyền dịch. Theo dõi liên tục điện tâm đồ Monitor.',
    preVitalsRequired: true,
    status: 'Scheduled',
    createdAt: new Date(Date.now() - 3600000 * 2).toISOString(),
  },
  {
    id: 'MED-105',
    patientId: 'P203',
    patientName: 'Phạm Minh Tuấn',
    roomNumber: 'P.203',
    bed: 'G03',
    medicationName: 'Enoxaparin 4000 IU (40mg/0.4ml)',
    dosage: '1 bơm tiêm sẵn thuốc',
    route: 'Subcutaneous',
    scheduledTime: '18:00',
    scheduledDate: todayDateStr,
    frequency: '1 lần/ngày lúc 18:00',
    prescribedByDoctorId: 'DOC02',
    prescribedByDoctorName: 'ThS. BS. Phạm Thu Trang',
    assignedNurseId: 'NUR01',
    assignedNurseName: 'ĐD. Đặng Thị Hồng Hạnh',
    instructions: 'Tiêm dưới da thành bụng trước bên hoặc sau bên. Không xoa bóp vị trí tiêm.',
    preVitalsRequired: false,
    status: 'Scheduled',
    createdAt: new Date(Date.now() - 3600000 * 2).toISOString(),
  },
  {
    id: 'MED-106',
    patientId: 'P308',
    patientName: 'Vũ Quốc Bảo',
    roomNumber: 'P.308',
    bed: 'G01',
    medicationName: 'Paracetamol 500mg',
    dosage: '1 viên (500mg)',
    route: 'Oral',
    scheduledTime: '12:00',
    scheduledDate: todayDateStr,
    frequency: 'Khi đau/sốt hoặc cách 6 giờ',
    prescribedByDoctorId: 'DOC03',
    prescribedByDoctorName: 'BS. CKI. Lê Hải Đăng',
    assignedNurseId: 'NUR01',
    assignedNurseName: 'ĐD. Đặng Thị Hồng Hạnh',
    instructions: 'Uống sau bữa ăn trưa với nhiều nước.',
    preVitalsRequired: false,
    status: 'Scheduled',
    createdAt: new Date(Date.now() - 3600000 * 1).toISOString(),
  },
];

let medications: MedicationSchedule[] = [...initialMedications];

let systemSettings: SystemSettings = {
  minNormalHeartRate: 50,
  maxNormalHeartRate: 120,
  criticalLowHeartRate: 40,
  criticalHighHeartRate: 150,
  minSpO2: 88,
  escalationTimeoutSeconds: 15,
};

let alerts: Alert[] = [];
let vitalReadings: VitalReading[] = [];

// WebSocket Client management
interface ConnectedClient {
  ws: WebSocket;
  id: string;
  groups: Set<WsGroup>;
  doctorId?: string;
  doctorName?: string;
}

const connectedClients = new Map<string, ConnectedClient>();

// Helper to broadcast to specific groups or all
function broadcast(message: WsServerMessage, targetGroup?: WsGroup) {
  const payload = JSON.stringify(message);
  for (const client of connectedClients.values()) {
    if (client.ws.readyState === WebSocket.OPEN) {
      if (!targetGroup || targetGroup === 'Global' || client.groups.has(targetGroup) || client.groups.has('Global')) {
        client.ws.send(payload);
      }
    }
  }
}

// Calculate runtime statistics
function calculateStats(): SystemStats {
  const totalVitals = vitalReadings.length;
  const totalAlerts = alerts.length;
  const pendingAlerts = alerts.filter((a) => a.status === 'Pending').length;
  const acknowledgedAlerts = alerts.filter((a) => a.status === 'Acknowledged').length;
  const resolvedAlerts = alerts.filter((a) => a.status === 'Resolved').length;
  const ackedOrResolved = alerts.filter((a) => a.responseTimeSeconds !== undefined);
  const avgResponseTime =
    ackedOrResolved.length > 0
      ? ackedOrResolved.reduce((sum, a) => sum + (a.responseTimeSeconds || 0), 0) / ackedOrResolved.length
      : 0;
  const escalatedCount = alerts.filter((a) => a.escalatedToBackup).length;

  let docCount = 0;
  let nurseCount = 0;
  for (const client of connectedClients.values()) {
    if (client.groups.has('OnCallDoctors')) docCount++;
    if (client.groups.has('NurseStationDisplay')) nurseCount++;
  }

  const totalMeds = medications.length;
  const adminMeds = medications.filter((m) => m.status === 'Administered').length;
  const pendingMeds = medications.filter((m) => m.status === 'Scheduled').length;

  return {
    totalVitalsProcessed: totalVitals,
    totalAlerts,
    pendingAlerts,
    acknowledgedAlerts,
    resolvedAlerts,
    avgResponseTimeSeconds: parseFloat(avgResponseTime.toFixed(1)),
    escalatedAlertsCount: escalatedCount,
    connectedClients: connectedClients.size,
    connectedDoctors: docCount,
    connectedNurseStations: nurseCount,
    totalMedicationsScheduled: totalMeds,
    totalMedicationsAdministered: adminMeds,
    pendingMedicationsToday: pendingMeds,
  };
}

// Automatic Escalation Timer Loop (Runs every 1 second)
setInterval(() => {
  const now = Date.now();
  let hasEscalations = false;

  for (const alert of alerts) {
    if (alert.status === 'Pending' && !alert.escalatedToBackup) {
      const createdTime = new Date(alert.createdAt).getTime();
      const elapsedSeconds = (now - createdTime) / 1000;

      if (elapsedSeconds >= systemSettings.escalationTimeoutSeconds) {
        alert.escalatedToBackup = true;
        alert.escalatedAt = new Date().toISOString();
        hasEscalations = true;

        const backupDoc = doctors.find((d) => d.isBackup) || doctors[0];

        // Broadcast escalation to ALL channels loudly
        broadcast({
          type: 'ALERT_ESCALATED',
          alert: { ...alert },
          backupDoctorName: backupDoc?.name,
        });
      }
    }
  }

  if (hasEscalations) {
    broadcast({ type: 'STATS_UPDATED', stats: calculateStats() });
  }
}, 1000);

// ==========================================
// REST API ROUTES
// ==========================================

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', uptime: process.uptime(), time: new Date().toISOString() });
});

// Patients API
app.get('/api/patients', (req, res) => {
  res.json(patients);
});

// Doctors / Staff API
app.get('/api/doctors', (req, res) => {
  res.json(doctors);
});

app.post('/api/doctors', (req, res) => {
  const { name, role, department, phone, email, isOnCall, isBackup, shift } = req.body;
  if (!name || !department) {
    res.status(400).json({ error: 'Name and department are required' });
    return;
  }
  const newStaff: Doctor = {
    id: `DOC-${Date.now().toString(36).toUpperCase()}`,
    name,
    role: role || 'Bác Sĩ Trực',
    department,
    phone: phone || '0900-000-000',
    email: email || '',
    isOnCall: isOnCall !== undefined ? !!isOnCall : true,
    isBackup: isBackup !== undefined ? !!isBackup : false,
    shift: shift || '24h',
  };
  doctors.push(newStaff);
  broadcast({ type: 'DOCTORS_UPDATED', doctors: [...doctors] });
  res.status(201).json(newStaff);
});

app.put('/api/doctors/:id', (req, res) => {
  const { id } = req.params;
  const index = doctors.findIndex((d) => d.id === id);
  if (index === -1) {
    res.status(404).json({ error: 'Staff member not found' });
    return;
  }
  doctors[index] = { ...doctors[index], ...req.body, id };
  broadcast({ type: 'DOCTORS_UPDATED', doctors: [...doctors] });
  res.json(doctors[index]);
});

app.delete('/api/doctors/:id', (req, res) => {
  const { id } = req.params;
  if (doctors.length <= 1) {
    res.status(400).json({ error: 'Phải giữ lại ít nhất 1 nhân viên y tế trong danh sách trực' });
    return;
  }
  doctors = doctors.filter((d) => d.id !== id);
  broadcast({ type: 'DOCTORS_UPDATED', doctors: [...doctors] });
  res.json({ success: true, message: 'Deleted staff member', id });
});

app.put('/api/doctors/:id/toggle-oncall', (req, res) => {
  const doc = doctors.find((d) => d.id === req.params.id);
  if (!doc) {
    res.status(404).json({ error: 'Doctor not found' });
    return;
  }
  doc.isOnCall = !doc.isOnCall;
  broadcast({ type: 'DOCTORS_UPDATED', doctors: [...doctors] });
  res.json(doc);
});

// System Settings
app.get('/api/settings', (req, res) => {
  res.json(systemSettings);
});

app.post('/api/settings', (req, res) => {
  systemSettings = { ...systemSettings, ...req.body };
  broadcast({
    type: 'INIT_STATE',
    alerts: [...alerts],
    patients: [...patients],
    doctors: [...doctors],
    settings: systemSettings,
    stats: calculateStats(),
  });
  res.json(systemSettings);
});

// Stats
app.get('/api/stats', (req, res) => {
  res.json(calculateStats());
});

// Core Ingestion Endpoint: POST /api/vitals
app.post('/api/vitals', (req, res) => {
  const { patientId, heartRate, spO2, bloodPressureSystolic, bloodPressureDiastolic, timestamp } = req.body;

  if (!patientId || heartRate === undefined || heartRate === null) {
    res.status(400).json({ error: 'patientId and heartRate are required' });
    return;
  }

  const patient = patients.find((p) => p.id === patientId) || {
    id: patientId,
    name: `Bệnh nhân ${patientId}`,
    roomNumber: 'P.KHY',
    age: 50,
    bed: 'G01',
    diagnosis: 'Chưa phân loại',
  };

  const hr = Number(heartRate);
  const spo2Val = spO2 !== undefined ? Number(spO2) : 98;
  const readingTime = timestamp || new Date().toISOString();

  // Threshold checking logic
  let isAbnormal = false;
  let severity: Alert['severity'] = 'Warning';
  let abnormalReason = '';

  if (hr <= systemSettings.criticalLowHeartRate) {
    isAbnormal = true;
    severity = 'Fatal';
    abnormalReason = `Nhịp tim tụt quá thấp (${hr} bpm <= ${systemSettings.criticalLowHeartRate} bpm) - Nguy cơ ngừng tim!`;
  } else if (hr >= systemSettings.criticalHighHeartRate) {
    isAbnormal = true;
    severity = 'Fatal';
    abnormalReason = `Nhịp tim đập quá nhanh nguy kịch (${hr} bpm >= ${systemSettings.criticalHighHeartRate} bpm) - Cơn nhịp nhanh thất!`;
  } else if (hr < systemSettings.minNormalHeartRate) {
    isAbnormal = true;
    severity = 'Critical';
    abnormalReason = `Nhịp tim chậm (${hr} bpm < ${systemSettings.minNormalHeartRate} bpm)`;
  } else if (hr > systemSettings.maxNormalHeartRate) {
    isAbnormal = true;
    severity = 'Critical';
    abnormalReason = `Nhịp tim tăng cao (${hr} bpm > ${systemSettings.maxNormalHeartRate} bpm)`;
  } else if (spo2Val < systemSettings.minSpO2) {
    isAbnormal = true;
    severity = spo2Val < 82 ? 'Fatal' : 'Critical';
    abnormalReason = `Độ bão hòa oxy SpO2 tụt thấp (${spo2Val}% < ${systemSettings.minSpO2}%)`;
  }

  // Create VitalReading record
  const reading: VitalReading = {
    id: `VR-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    patientId: patient.id,
    patientName: patient.name,
    roomNumber: patient.roomNumber,
    heartRate: hr,
    spO2: spo2Val,
    bloodPressureSystolic,
    bloodPressureDiastolic,
    timestamp: readingTime,
    isAbnormal,
    abnormalReason: isAbnormal ? abnormalReason : undefined,
  };

  vitalReadings.unshift(reading);
  if (vitalReadings.length > 500) {
    vitalReadings = vitalReadings.slice(0, 500); // Prevent memory bloat
  }

  // Broadcast vital reading to anyone monitoring telemetry
  broadcast({ type: 'NEW_VITAL', reading });

  let newAlert: Alert | null = null;

  // If abnormal -> Generate Alert with status Pending
  if (isAbnormal) {
    newAlert = {
      id: `ALT-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      patientId: patient.id,
      patientName: patient.name,
      roomNumber: patient.roomNumber,
      severity,
      status: 'Pending',
      heartRate: hr,
      spO2: spo2Val,
      reason: abnormalReason,
      createdAt: new Date().toISOString(),
      escalatedToBackup: false,
    };

    alerts.unshift(newAlert);
    if (alerts.length > 300) {
      alerts = alerts.slice(0, 300);
    }

    // Broadcast NEW_ALERT to OnCallDoctors, NurseStationDisplay and Global
    broadcast({ type: 'NEW_ALERT', alert: newAlert });
    broadcast({ type: 'STATS_UPDATED', stats: calculateStats() });
  }

  res.status(201).json({
    success: true,
    reading,
    alertGenerated: !!newAlert,
    alert: newAlert,
  });
});

// Query vitals history
app.get('/api/vitals', (req, res) => {
  const { patientId, limit } = req.query;
  let results = [...vitalReadings];
  if (patientId) {
    results = results.filter((v) => v.patientId === patientId);
  }
  const maxLimit = limit ? parseInt(limit as string, 10) : 50;
  res.json(results.slice(0, maxLimit));
});

// Query alerts
app.get('/api/alerts', (req, res) => {
  const { status, severity } = req.query;
  let filtered = [...alerts];
  if (status) {
    filtered = filtered.filter((a) => a.status === status);
  }
  if (severity) {
    filtered = filtered.filter((a) => a.severity === severity);
  }
  res.json(filtered);
});

// Acknowledge Alert (Bác sĩ hoặc Y tá bấm "Đã tiếp nhận")
const handleAlertAcknowledge = (req: any, res: any) => {
  const { id } = req.params;
  const { acknowledgedBy, role, acknowledgedDoctorId } = req.body;

  const alert = alerts.find((a) => a.id === id);
  if (!alert) {
    res.status(404).json({ error: 'Alert not found' });
    return;
  }

  if (alert.status !== 'Pending') {
    res.json({ message: 'Alert was already acknowledged or resolved', alert });
    return;
  }

  const ackTime = new Date();
  const createdTime = new Date(alert.createdAt);
  const responseTimeSec = Math.max(0, parseFloat(((ackTime.getTime() - createdTime.getTime()) / 1000).toFixed(1)));

  alert.status = 'Acknowledged';
  alert.acknowledgedAt = ackTime.toISOString();
  alert.acknowledgedBy = acknowledgedBy || 'Điều Dưỡng / Bác Sĩ Trực';
  alert.acknowledgedRole = role || 'Trực Ca ICU';
  alert.responseTimeSeconds = responseTimeSec;

  // Broadcast ALERT_ACKNOWLEDGED to all channels so popups & sirens turn off immediately!
  broadcast({
    type: 'ALERT_ACKNOWLEDGED',
    alert: { ...alert },
    acknowledgedBy: alert.acknowledgedBy,
  });

  broadcast({ type: 'STATS_UPDATED', stats: calculateStats() });

  res.json({ success: true, alert });
};

app.post('/api/alerts/:id/acknowledge', handleAlertAcknowledge);
app.post('/api/alerts/:id/ack', handleAlertAcknowledge);

// Resolve Alert (Bác sĩ đã đến xử lý xong)
app.post('/api/alerts/:id/resolve', (req, res) => {
  const { id } = req.params;
  const { resolvedBy, resolutionNote } = req.body;

  const alert = alerts.find((a) => a.id === id);
  if (!alert) {
    res.status(404).json({ error: 'Alert not found' });
    return;
  }

  alert.status = 'Resolved';
  alert.resolvedAt = new Date().toISOString();
  alert.resolvedBy = resolvedBy || 'BS. Nguyễn Quốc Trí';
  alert.resolutionNote = resolutionNote || 'Đã tiêm thuốc và ổn định nhịp tim';

  broadcast({
    type: 'ALERT_RESOLVED',
    alert: { ...alert },
    resolvedBy: alert.resolvedBy,
  });

  broadcast({ type: 'STATS_UPDATED', stats: calculateStats() });

  res.json({ success: true, alert });
});

// ==========================================
// MEDICATION SCHEDULE & GOOGLE CALENDAR APIS
// ==========================================

// Get all medication schedules
app.get('/api/medications', (req, res) => {
  const { patientId, date, status } = req.query;
  let filtered = [...medications];

  if (patientId) {
    filtered = filtered.filter((m) => m.patientId === patientId);
  }
  if (date) {
    filtered = filtered.filter((m) => m.scheduledDate === date);
  }
  if (status) {
    filtered = filtered.filter((m) => m.status === status);
  }

  // Sort by scheduledTime ascending
  filtered.sort((a, b) => a.scheduledTime.localeCompare(b.scheduledTime));
  res.json(filtered);
});

// Create new medication schedule / prescription
app.post('/api/medications', (req, res) => {
  const {
    patientId,
    medicationName,
    dosage,
    route,
    scheduledTime,
    scheduledDate,
    frequency,
    prescribedByDoctorId,
    assignedNurseId,
    instructions,
    preVitalsRequired,
  } = req.body;

  if (!patientId || !medicationName || !dosage || !scheduledTime) {
    res.status(400).json({ error: 'Vui lòng điền đủ: Bệnh nhân, Tên thuốc, Liều lượng, và Giờ dùng.' });
    return;
  }

  const patient = patients.find((p) => p.id === patientId);
  if (!patient) {
    res.status(404).json({ error: 'Bệnh nhân không tồn tại.' });
    return;
  }

  const doctor = doctors.find((d) => d.id === prescribedByDoctorId) || doctors[0];
  const nurse = doctors.find((d) => d.id === assignedNurseId);

  const newMed: MedicationSchedule = {
    id: `MED-${Date.now().toString(36).toUpperCase()}`,
    patientId: patient.id,
    patientName: patient.name,
    roomNumber: patient.roomNumber,
    bed: patient.bed,
    medicationName,
    dosage,
    route: route || 'Oral',
    scheduledTime,
    scheduledDate: scheduledDate || new Date().toISOString().split('T')[0],
    frequency: frequency || '1 lần/ngày',
    prescribedByDoctorId: doctor.id,
    prescribedByDoctorName: doctor.name,
    assignedNurseId: nurse?.id,
    assignedNurseName: nurse?.name || 'Điều Dưỡng Trực Ca',
    instructions: instructions || 'Tuân thủ quy trình 5 đúng khi dùng thuốc',
    preVitalsRequired: preVitalsRequired !== undefined ? !!preVitalsRequired : false,
    status: 'Scheduled',
    createdAt: new Date().toISOString(),
  };

  medications.push(newMed);
  broadcast({ type: 'MEDICATIONS_UPDATED', medications: [...medications] });
  broadcast({ type: 'STATS_UPDATED', stats: calculateStats() });

  res.status(201).json(newMed);
});

// Update medication schedule
app.put('/api/medications/:id', (req, res) => {
  const { id } = req.params;
  const index = medications.findIndex((m) => m.id === id);
  if (index === -1) {
    res.status(404).json({ error: 'Không tìm thấy lịch thuốc.' });
    return;
  }

  medications[index] = {
    ...medications[index],
    ...req.body,
    id,
  };

  broadcast({ type: 'MEDICATIONS_UPDATED', medications: [...medications] });
  broadcast({ type: 'STATS_UPDATED', stats: calculateStats() });

  res.json(medications[index]);
});

// Administer Medication (Cho bệnh nhân dùng thuốc & ký nhận)
app.post('/api/medications/:id/administer', (req, res) => {
  const { id } = req.params;
  const { administeredBy, administeredRole, administerNotes, recordedHeartRate, recordedBloodPressure } = req.body;

  const med = medications.find((m) => m.id === id);
  if (!med) {
    res.status(404).json({ error: 'Không tìm thấy lịch thuốc.' });
    return;
  }

  med.status = 'Administered';
  med.administeredAt = new Date().toISOString();
  med.administeredBy = administeredBy || 'ĐD. Đặng Thị Hồng Hạnh';
  med.administeredRole = administeredRole || 'Điều Dưỡng Trực Ca';
  med.administerNotes = administerNotes || 'Đã cho bệnh nhân dùng đúng liều, tình trạng ổn định.';
  if (recordedHeartRate) med.recordedHeartRate = Number(recordedHeartRate);
  if (recordedBloodPressure) med.recordedBloodPressure = recordedBloodPressure;

  broadcast({ type: 'MEDICATION_ADMINISTERED', medication: { ...med } });
  broadcast({ type: 'MEDICATIONS_UPDATED', medications: [...medications] });
  broadcast({ type: 'STATS_UPDATED', stats: calculateStats() });

  res.json({ success: true, medication: med });
});

// Hold / Delay Medication (Tạm hoãn do tình trạng lâm sàng)
app.post('/api/medications/:id/hold', (req, res) => {
  const { id } = req.params;
  const { reason, heldBy } = req.body;

  const med = medications.find((m) => m.id === id);
  if (!med) {
    res.status(404).json({ error: 'Không tìm thấy lịch thuốc.' });
    return;
  }

  med.status = 'Held';
  med.administerNotes = `TẠM HOÃN: ${reason || 'Theo chỉ định bác sĩ'}. Người ghi nhận: ${heldBy || 'Điều dưỡng'}`;

  broadcast({ type: 'MEDICATIONS_UPDATED', medications: [...medications] });
  broadcast({ type: 'STATS_UPDATED', stats: calculateStats() });

  res.json({ success: true, medication: med });
});

// Sync with Google Calendar event record
app.post('/api/medications/:id/sync-gcal', (req, res) => {
  const { id } = req.params;
  const { googleCalendarEventId, googleCalendarHtmlLink } = req.body;

  const med = medications.find((m) => m.id === id);
  if (!med) {
    res.status(404).json({ error: 'Không tìm thấy lịch thuốc.' });
    return;
  }

  med.googleCalendarEventId = googleCalendarEventId;
  med.googleCalendarHtmlLink = googleCalendarHtmlLink;
  med.googleCalendarSyncedAt = new Date().toISOString();

  broadcast({ type: 'MEDICATIONS_UPDATED', medications: [...medications] });

  res.json({ success: true, medication: med });
});

// Delete medication schedule
app.delete('/api/medications/:id', (req, res) => {
  const { id } = req.params;
  medications = medications.filter((m) => m.id !== id);
  broadcast({ type: 'MEDICATIONS_UPDATED', medications: [...medications] });
  broadcast({ type: 'STATS_UPDATED', stats: calculateStats() });
  res.json({ success: true, id });
});

// Google Calendar Auth info config endpoint
app.get('/api/google-calendar/auth-info', (req, res) => {
  res.json({
    clientId: process.env.GOOGLE_CLIENT_ID || process.env.GOOGLE_OAUTH_CLIENT_ID || '',
    scopes: ['https://www.googleapis.com/auth/calendar.events', 'https://www.googleapis.com/auth/calendar'],
  });
});

// Reset Demo Data
app.post('/api/reset-data', (req, res) => {
  alerts = [];
  vitalReadings = [];
  patients = [...initialPatients];
  medications = [...initialMedications];
  broadcast({
    type: 'INIT_STATE',
    alerts: [],
    patients: [...patients],
    doctors: [...doctors],
    medications: [...medications],
    settings: systemSettings,
    stats: calculateStats(),
  });
  res.json({ success: true, message: 'Data reset to initial state' });
});

// ==========================================
// SERVER INITIALIZATION & VITE MIDDLEWARE
// ==========================================
async function startServer() {
  const server = http.createServer(app);
  const wss = new WebSocketServer({ server, path: '/ws' });

  wss.on('connection', (ws, req) => {
    const clientId = `client-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const clientData: ConnectedClient = {
      ws,
      id: clientId,
      groups: new Set<WsGroup>(['Global']),
    };
    connectedClients.set(clientId, clientData);

    // Send connection greeting & initial synchronized snapshot
    const greeting: WsServerMessage = {
      type: 'CONNECTED',
      clientId,
      serverTime: new Date().toISOString(),
    };
    ws.send(JSON.stringify(greeting));

    const initState: WsServerMessage = {
      type: 'INIT_STATE',
      alerts: [...alerts],
      patients: [...patients],
      doctors: [...doctors],
      medications: [...medications],
      settings: systemSettings,
      stats: calculateStats(),
    };
    ws.send(JSON.stringify(initState));

    // Handle messages from client
    ws.on('message', (raw) => {
      try {
        const msg = JSON.parse(raw.toString());
        if (msg.type === 'JOIN_GROUP' && msg.group) {
          clientData.groups.add(msg.group);
          if (msg.doctorId) clientData.doctorId = msg.doctorId;
          if (msg.doctorName) clientData.doctorName = msg.doctorName;
          broadcast({ type: 'STATS_UPDATED', stats: calculateStats() });
        } else if (msg.type === 'LEAVE_GROUP' && msg.group) {
          clientData.groups.delete(msg.group);
          broadcast({ type: 'STATS_UPDATED', stats: calculateStats() });
        } else if (msg.type === 'PING') {
          ws.send(JSON.stringify({ type: 'PONG', serverTime: new Date().toISOString() }));
        }
      } catch (err) {
        console.error('Error handling WS message:', err);
      }
    });

    ws.on('close', () => {
      connectedClients.delete(clientId);
      broadcast({ type: 'STATS_UPDATED', stats: calculateStats() });
    });

    ws.on('error', (error) => {
      console.error(`WebSocket error for ${clientId}:`, error);
      connectedClients.delete(clientId);
    });
  });

  // Vite integration
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`[EmergencyAlert Server] running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
