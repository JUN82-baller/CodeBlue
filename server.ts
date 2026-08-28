import express from 'express';
import http from 'http';
import path from 'path';
import { WebSocketServer, WebSocket } from 'ws';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI } from '@google/genai';
import {
  Alert,
  Doctor,
  GroundingSource,
  MedicationAdministrationRecord,
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

// Initialize GoogleGenAI client
let geminiClient: GoogleGenAI | null = null;
function getGeminiClient(): GoogleGenAI {
  if (!geminiClient) {
    const apiKey = process.env.GEMINI_API_KEY || '';
    geminiClient = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });
  }
  return geminiClient;
}

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

const createSeedDate = (hoursAgo: number, minutesAgo: number = 0) => {
  const d = new Date();
  d.setHours(d.getHours() - hoursAgo);
  d.setMinutes(d.getMinutes() - minutesAgo);
  return d.toISOString();
};

const initialMedicationAdministrationLogs: MedicationAdministrationRecord[] = [
  {
    id: 'MAR-LOG-01',
    medicationScheduleId: 'MED-101',
    medicationName: 'Digoxin 0.25mg',
    dosage: '1 viên (0.25mg)',
    route: 'Oral',
    patientId: 'P101',
    patientName: 'Nguyễn Văn Hùng',
    roomNumber: 'P.101',
    bed: 'G01',
    administeredAt: createSeedDate(3, 10),
    administeredBy: 'ĐD. Đặng Thị Hồng Hạnh',
    administeredStaffId: 'NUR01',
    administeredRole: 'Điều Dưỡng Trưởng Trạm',
    administerNotes: 'Đã kiểm tra 5 đúng. Nhịp tim và huyết áp đều ổn định trước khi cho uống thuốc.',
    recordedHeartRate: 74,
    recordedBloodPressure: '125/80',
    recordedSpO2: 97,
    recordedTemperature: 36.8,
    prescribedByDoctorName: 'BS. CKII. Nguyễn Quốc Trí',
    vitalsEvaluation: 'Normal',
  },
  {
    id: 'MAR-LOG-02',
    medicationScheduleId: 'MED-102',
    medicationName: 'Furosemide 20mg/2ml',
    dosage: '1 ống (20mg)',
    route: 'IV',
    patientId: 'P101',
    patientName: 'Nguyễn Văn Hùng',
    roomNumber: 'P.101',
    bed: 'G01',
    administeredAt: createSeedDate(5, 30),
    administeredBy: 'ĐD. Đặng Thị Hồng Hạnh',
    administeredStaffId: 'NUR01',
    administeredRole: 'Điều Dưỡng Trưởng Trạm',
    administerNotes: 'Tiêm tĩnh mạch chậm 2 phút. Bệnh nhân êm, không chóng mặt hay buồn nôn.',
    recordedHeartRate: 82,
    recordedBloodPressure: '135/85',
    recordedSpO2: 96,
    recordedTemperature: 37.0,
    prescribedByDoctorName: 'BS. CKII. Nguyễn Quốc Trí',
    vitalsEvaluation: 'Normal',
  },
  {
    id: 'MAR-LOG-03',
    medicationScheduleId: 'MED-103',
    medicationName: 'Ceftriaxone 1g',
    dosage: '1 lọ (1g)',
    route: 'Infusion',
    patientId: 'P102',
    patientName: 'Trần Thị Mai',
    roomNumber: 'P.102',
    bed: 'G02',
    administeredAt: createSeedDate(2, 15),
    administeredBy: 'ThS. BS. Phạm Thu Trang',
    administeredStaffId: 'DOC02',
    administeredRole: 'Bác Sĩ Tim Mạch Can Thiệp',
    administerNotes: 'Pha 100ml Natri Clorid 0.9% truyền tĩnh mạch 30 phút, không phản ứng dị ứng thuốc.',
    recordedHeartRate: 68,
    recordedBloodPressure: '118/76',
    recordedSpO2: 98,
    recordedTemperature: 36.6,
    prescribedByDoctorName: 'ThS. BS. Phạm Thu Trang',
    vitalsEvaluation: 'Normal',
  },
  {
    id: 'MAR-LOG-04',
    medicationScheduleId: 'MED-104',
    medicationName: 'Amiodarone 150mg/3ml',
    dosage: '1 ống (150mg)',
    route: 'Infusion',
    patientId: 'P201',
    patientName: 'Lê Hoàng Nam',
    roomNumber: 'P.201',
    bed: 'G01',
    administeredAt: createSeedDate(1, 45),
    administeredBy: 'BS. CKII. Nguyễn Quốc Trí',
    administeredStaffId: 'DOC01',
    administeredRole: 'Trưởng Ca Trực ICU',
    administerNotes: 'Pha bơm tiêm điện duy trì tốc độ chuẩn, theo dõi monitor liên tục, nhịp xoang đã phục hồi.',
    recordedHeartRate: 108,
    recordedBloodPressure: '115/72',
    recordedSpO2: 95,
    recordedTemperature: 36.9,
    prescribedByDoctorName: 'BS. CKII. Nguyễn Quốc Trí',
    vitalsEvaluation: 'Warning',
  },
  {
    id: 'MAR-LOG-05',
    medicationScheduleId: 'MED-105',
    medicationName: 'Enoxaparin 4000 IU (40mg/0.4ml)',
    dosage: '1 bơm tiêm sẵn',
    route: 'Subcutaneous',
    patientId: 'P203',
    patientName: 'Phạm Minh Tuấn',
    roomNumber: 'P.203',
    bed: 'G03',
    administeredAt: createSeedDate(4, 20),
    administeredBy: 'ĐD. Đặng Thị Hồng Hạnh',
    administeredStaffId: 'NUR01',
    administeredRole: 'Điều Dưỡng Trưởng Trạm',
    administerNotes: 'Tiêm dưới da thành bụng trước bên trái, không xoa bóp, không có dấu hiệu bầm máu.',
    recordedHeartRate: 76,
    recordedBloodPressure: '122/78',
    recordedSpO2: 98,
    recordedTemperature: 36.7,
    prescribedByDoctorName: 'ThS. BS. Phạm Thu Trang',
    vitalsEvaluation: 'Normal',
  },
  {
    id: 'MAR-LOG-06',
    medicationScheduleId: 'MED-106',
    medicationName: 'Paracetamol 500mg',
    dosage: '1 viên (500mg)',
    route: 'Oral',
    patientId: 'P308',
    patientName: 'Vũ Quốc Bảo',
    roomNumber: 'P.308',
    bed: 'G01',
    administeredAt: createSeedDate(0, 40),
    administeredBy: 'BS. CKI. Lê Hải Đăng',
    administeredStaffId: 'DOC03',
    administeredRole: 'Bác Sĩ Dự Phòng Cấp Cứu',
    administerNotes: 'Bệnh nhân sốt nhẹ 37.8°C và đau vết mổ sau can thiệp, đã cho uống thuốc với nước ấm.',
    recordedHeartRate: 86,
    recordedBloodPressure: '120/80',
    recordedSpO2: 99,
    recordedTemperature: 37.8,
    prescribedByDoctorName: 'BS. CKI. Lê Hải Đăng',
    vitalsEvaluation: 'Normal',
  },
];

let medicationAdministrationLogs: MedicationAdministrationRecord[] = [...initialMedicationAdministrationLogs];

let systemSettings: SystemSettings = {
  minNormalHeartRate: 50,
  maxNormalHeartRate: 120,
  criticalLowHeartRate: 40,
  criticalHighHeartRate: 150,
  minSpO2: 88,
  escalationTimeoutSeconds: 15,
};

const initialSeedAlerts: Alert[] = [
  {
    id: 'ALT-SEED-01',
    patientId: 'P101',
    patientName: 'Nguyễn Văn Hùng',
    roomNumber: 'P.101',
    severity: 'Fatal',
    status: 'Resolved',
    heartRate: 185,
    spO2: 84,
    reason: 'Rung thất cấp (V-Fib) - Nhịp tim 185 BPM, SpO2 84%',
    createdAt: createSeedDate(1, 15),
    acknowledgedAt: createSeedDate(1, 14),
    acknowledgedBy: 'BS. CKII. Nguyễn Quốc Trí',
    acknowledgedRole: 'Bác Sĩ Trực Cấp Cứu',
    responseTimeSeconds: 7,
    escalatedToBackup: false,
    resolvedAt: createSeedDate(1, 5),
    resolvedBy: 'BS. CKII. Nguyễn Quốc Trí',
    resolutionNote: 'Đã sốc điện phá rung 200J và tiêm Amiodarone 150mg tĩnh mạch. Nhịp xoang đã phục hồi.',
  },
  {
    id: 'ALT-SEED-02',
    patientId: 'P102',
    patientName: 'Trần Thị Mai',
    roomNumber: 'P.102',
    severity: 'Critical',
    status: 'Resolved',
    heartRate: 36,
    spO2: 91,
    reason: 'Nhịp tim chậm nguy hiểm 36 BPM kèm tụt HA',
    createdAt: createSeedDate(1, 40),
    acknowledgedAt: createSeedDate(1, 39),
    acknowledgedBy: 'ThS. BS. Phạm Thu Trang',
    acknowledgedRole: 'Bác Sĩ Hồi Sức',
    responseTimeSeconds: 11,
    escalatedToBackup: false,
    resolvedAt: createSeedDate(1, 20),
    resolvedBy: 'ThS. BS. Phạm Thu Trang',
    resolutionNote: 'Đã tiêm Atropine 0.5mg IV. Nhịp tim tăng lên 68 BPM ổn định.',
  },
  {
    id: 'ALT-SEED-03',
    patientId: 'P203',
    patientName: 'Phạm Minh Tuấn',
    roomNumber: 'P.203',
    severity: 'Critical',
    status: 'Resolved',
    heartRate: 142,
    spO2: 86,
    reason: 'Thiếu oxy cấp (SpO2 86%) & Nhịp nhanh 142 BPM',
    createdAt: createSeedDate(2, 10),
    acknowledgedAt: createSeedDate(2, 9),
    acknowledgedBy: 'ĐD. Đặng Thị Hồng Hạnh',
    acknowledgedRole: 'Điều Dưỡng Trưởng Trạm',
    responseTimeSeconds: 9,
    escalatedToBackup: false,
    resolvedAt: createSeedDate(1, 55),
    resolvedBy: 'BS. CKI. Lê Hải Đăng',
    resolutionNote: 'Tăng oxy mask có túi 10L/phút, SpO2 tăng lên 96%.',
  },
  {
    id: 'ALT-SEED-04',
    patientId: 'P308',
    patientName: 'Vũ Quốc Bảo',
    roomNumber: 'P.308',
    severity: 'Warning',
    status: 'Resolved',
    heartRate: 124,
    spO2: 95,
    reason: 'Nhịp nhanh xoang nhẹ sau mổ 124 BPM',
    createdAt: createSeedDate(3, 20),
    acknowledgedAt: createSeedDate(3, 19),
    acknowledgedBy: 'BS. CKII. Nguyễn Quốc Trí',
    acknowledgedRole: 'Bác Sĩ Trực',
    responseTimeSeconds: 14,
    escalatedToBackup: false,
    resolvedAt: createSeedDate(3, 0),
    resolvedBy: 'BS. CKII. Nguyễn Quốc Trí',
    resolutionNote: 'Bệnh nhân đau vết mổ, đã cho giảm đau Paracetamol 1g.',
  },
  {
    id: 'ALT-SEED-05',
    patientId: 'P101',
    patientName: 'Nguyễn Văn Hùng',
    roomNumber: 'P.101',
    severity: 'Critical',
    status: 'Resolved',
    heartRate: 158,
    spO2: 88,
    reason: 'Cơn rung nhĩ đáp ứng thất nhanh 158 BPM',
    createdAt: createSeedDate(5, 5),
    acknowledgedAt: createSeedDate(5, 4),
    acknowledgedBy: 'BS. CKII. Nguyễn Quốc Trí',
    acknowledgedRole: 'Bác Sĩ Trực',
    responseTimeSeconds: 12,
    escalatedToBackup: false,
    resolvedAt: createSeedDate(4, 45),
    resolvedBy: 'BS. CKII. Nguyễn Quốc Trí',
    resolutionNote: 'Kiểm soát tần số thất bằng Metoprolol 5mg IV.',
  },
  {
    id: 'ALT-SEED-06',
    patientId: 'P203',
    patientName: 'Phạm Minh Tuấn',
    roomNumber: 'P.203',
    severity: 'Fatal',
    status: 'Resolved',
    heartRate: 172,
    spO2: 82,
    reason: 'Cơn nhịp nhanh thất vô mạch - Báo động Đỏ ICU',
    createdAt: createSeedDate(5, 45),
    acknowledgedAt: createSeedDate(5, 44),
    acknowledgedBy: 'BS. Anh Vũ',
    acknowledgedRole: 'Bác Sĩ Dự Phòng',
    responseTimeSeconds: 18,
    escalatedToBackup: true,
    resolvedAt: createSeedDate(5, 20),
    resolvedBy: 'BS. Anh Vũ',
    resolutionNote: 'Đã kích hoạt Code Blue, phá rung đồng bộ 100J thành công.',
  },
  {
    id: 'ALT-SEED-07',
    patientId: 'P102',
    patientName: 'Trần Thị Mai',
    roomNumber: 'P.102',
    severity: 'Warning',
    status: 'Resolved',
    heartRate: 46,
    spO2: 96,
    reason: 'Nhịp tim chậm 46 BPM khi nghỉ ngơi',
    createdAt: createSeedDate(8, 30),
    acknowledgedAt: createSeedDate(8, 29),
    acknowledgedBy: 'ThS. BS. Phạm Thu Trang',
    acknowledgedRole: 'Bác Sĩ Trực',
    responseTimeSeconds: 8,
    escalatedToBackup: false,
    resolvedAt: createSeedDate(8, 10),
    resolvedBy: 'ThS. BS. Phạm Thu Trang',
    resolutionNote: 'Theo dõi thêm, chưa cần can thiệp thuốc.',
  },
  {
    id: 'ALT-SEED-08',
    patientId: 'P308',
    patientName: 'Vũ Quốc Bảo',
    roomNumber: 'P.308',
    severity: 'Critical',
    status: 'Resolved',
    heartRate: 138,
    spO2: 89,
    reason: 'Suy hô hấp nhẹ và nhịp nhanh 138 BPM',
    createdAt: createSeedDate(11, 15),
    acknowledgedAt: createSeedDate(11, 14),
    acknowledgedBy: 'BS. CKI. Lê Hải Đăng',
    acknowledgedRole: 'Bác Sĩ Trực',
    responseTimeSeconds: 10,
    escalatedToBackup: false,
    resolvedAt: createSeedDate(11, 0),
    resolvedBy: 'BS. CKI. Lê Hải Đăng',
    resolutionNote: 'Thở oxy cannula 3L/phút, SpO2 cải thiện lên 97%.',
  },
  {
    id: 'ALT-SEED-09',
    patientId: 'P101',
    patientName: 'Nguyễn Văn Hùng',
    roomNumber: 'P.101',
    severity: 'Warning',
    status: 'Resolved',
    heartRate: 122,
    spO2: 94,
    reason: 'Tăng nhịp tim sau vận động nhẹ 122 BPM',
    createdAt: createSeedDate(14, 50),
    acknowledgedAt: createSeedDate(14, 49),
    acknowledgedBy: 'ĐD. Đặng Thị Hồng Hạnh',
    acknowledgedRole: 'Điều Dưỡng Trực',
    responseTimeSeconds: 6,
    escalatedToBackup: false,
    resolvedAt: createSeedDate(14, 30),
    resolvedBy: 'BS. CKII. Nguyễn Quốc Trí',
    resolutionNote: 'Bệnh nhân nghỉ ngơi tại giường, mạch trở về 82 BPM.',
  },
  {
    id: 'ALT-SEED-10',
    patientId: 'P203',
    patientName: 'Phạm Minh Tuấn',
    roomNumber: 'P.203',
    severity: 'Fatal',
    status: 'Resolved',
    heartRate: 190,
    spO2: 80,
    reason: 'Rung thất tái phát - Huyết áp tụt kẹp',
    createdAt: createSeedDate(16, 20),
    acknowledgedAt: createSeedDate(16, 19),
    acknowledgedBy: 'BS. CKII. Nguyễn Quốc Trí',
    acknowledgedRole: 'Bác Sĩ Trực',
    responseTimeSeconds: 5,
    escalatedToBackup: false,
    resolvedAt: createSeedDate(16, 0),
    resolvedBy: 'BS. CKII. Nguyễn Quốc Trí',
    resolutionNote: 'Hồi sinh tim phổi nâng cao (ACLS), sốc điện 200J và đặt đường truyền trung tâm.',
  },
  {
    id: 'ALT-SEED-11',
    patientId: 'P102',
    patientName: 'Trần Thị Mai',
    roomNumber: 'P.102',
    severity: 'Critical',
    status: 'Resolved',
    heartRate: 38,
    spO2: 92,
    reason: 'Bloc nhĩ thất độ III - Nhịp thoát bộ nối 38 BPM',
    createdAt: createSeedDate(20, 10),
    acknowledgedAt: createSeedDate(20, 9),
    acknowledgedBy: 'ThS. BS. Phạm Thu Trang',
    acknowledgedRole: 'Bác Sĩ Trực',
    responseTimeSeconds: 9,
    escalatedToBackup: false,
    resolvedAt: createSeedDate(19, 50),
    resolvedBy: 'ThS. BS. Phạm Thu Trang',
    resolutionNote: 'Chuẩn bị đặt máy tạo nhịp tạm thời cấp cứu.',
  },
];

let alerts: Alert[] = [...initialSeedAlerts];
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
  const {
    administeredBy,
    administeredRole,
    administeredStaffId,
    administerNotes,
    recordedHeartRate,
    recordedBloodPressure,
    recordedSpO2,
    recordedTemperature,
  } = req.body;

  const med = medications.find((m) => m.id === id);
  if (!med) {
    res.status(404).json({ error: 'Không tìm thấy lịch thuốc.' });
    return;
  }

  const adminTime = new Date().toISOString();
  med.status = 'Administered';
  med.administeredAt = adminTime;
  med.administeredBy = administeredBy || 'ĐD. Đặng Thị Hồng Hạnh';
  med.administeredRole = administeredRole || 'Điều Dưỡng Trực Ca';
  med.administerNotes = administerNotes || 'Đã cho bệnh nhân dùng đúng liều, tình trạng ổn định.';
  if (recordedHeartRate) med.recordedHeartRate = Number(recordedHeartRate);
  if (recordedBloodPressure) med.recordedBloodPressure = recordedBloodPressure;
  if (recordedSpO2) med.recordedSpO2 = Number(recordedSpO2);
  if (recordedTemperature) med.recordedTemperature = Number(recordedTemperature);

  // Evaluate vitals
  let vitalsEvaluation: 'Normal' | 'Warning' | 'Critical' = 'Normal';
  const hr = Number(recordedHeartRate);
  const spo2 = Number(recordedSpO2);
  if ((hr && (hr < 50 || hr > 130)) || (spo2 && spo2 < 90)) {
    vitalsEvaluation = 'Critical';
  } else if ((hr && (hr < 60 || hr > 105)) || (spo2 && spo2 < 95)) {
    vitalsEvaluation = 'Warning';
  }

  // Create audit administration record
  const logRecord: MedicationAdministrationRecord = {
    id: `MAR-LOG-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    medicationScheduleId: med.id,
    medicationName: med.medicationName,
    dosage: med.dosage,
    route: med.route,
    patientId: med.patientId,
    patientName: med.patientName,
    roomNumber: med.roomNumber,
    bed: med.bed,
    administeredAt: adminTime,
    administeredBy: med.administeredBy,
    administeredStaffId: administeredStaffId || med.assignedNurseId,
    administeredRole: med.administeredRole,
    administerNotes: med.administerNotes,
    recordedHeartRate: med.recordedHeartRate,
    recordedBloodPressure: med.recordedBloodPressure,
    recordedSpO2: med.recordedSpO2,
    recordedTemperature: med.recordedTemperature,
    prescribedByDoctorName: med.prescribedByDoctorName,
    vitalsEvaluation,
  };

  medicationAdministrationLogs.unshift(logRecord);
  if (medicationAdministrationLogs.length > 500) {
    medicationAdministrationLogs = medicationAdministrationLogs.slice(0, 500);
  }

  broadcast({ type: 'MEDICATION_ADMINISTERED', medication: { ...med }, logRecord });
  broadcast({ type: 'MEDICATIONS_UPDATED', medications: [...medications] });
  broadcast({ type: 'MEDICATION_HISTORY_UPDATED', history: [...medicationAdministrationLogs] });
  broadcast({ type: 'STATS_UPDATED', stats: calculateStats() });

  res.json({ success: true, medication: med, logRecord });
});

// Query Medication Administration History Logs
app.get('/api/medications-history', (req, res) => {
  const { patientId, medicationName, staffName, search, limit } = req.query;
  let filtered = [...medicationAdministrationLogs];

  if (patientId) {
    filtered = filtered.filter((l) => l.patientId === patientId);
  }
  if (medicationName) {
    filtered = filtered.filter((l) =>
      l.medicationName.toLowerCase().includes((medicationName as string).toLowerCase())
    );
  }
  if (staffName) {
    filtered = filtered.filter((l) =>
      l.administeredBy.toLowerCase().includes((staffName as string).toLowerCase())
    );
  }
  if (search) {
    const q = (search as string).toLowerCase();
    filtered = filtered.filter(
      (l) =>
        l.medicationName.toLowerCase().includes(q) ||
        l.patientName.toLowerCase().includes(q) ||
        l.roomNumber.toLowerCase().includes(q) ||
        l.administeredBy.toLowerCase().includes(q) ||
        (l.administerNotes && l.administerNotes.toLowerCase().includes(q))
    );
  }

  // Sort descending by administeredAt
  filtered.sort((a, b) => new Date(b.administeredAt).getTime() - new Date(a.administeredAt).getTime());

  const maxLimit = limit ? parseInt(limit as string, 10) : 100;
  res.json(filtered.slice(0, maxLimit));
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

// ==========================================
// GEMINI CLINICAL AI & GROUNDING APIS
// ==========================================
const systemInstructionsByRole: Record<string, string> = {
  clinical_doctor: `Bạn là Bác Sĩ Cố Vấn Hồi Sức Cấp Cứu ICU & Tim Mạch Lâm Sàng (Senior ICU & Emergency Cardiology Consultant).
Nhiệm vụ: Cung cấp hỗ trợ quyết định lâm sàng khẩn cấp (Clinical Decision Support), hướng dẫn xử trí theo phác đồ cấp cứu hồi sinh tim phổi nâng cao (ACLS Guidelines), xử trí rối loạn nhịp tim nguy hiểm (Rung nhĩ, Rung thất, Cơn nhịp nhanh kịch phát trên thất SVT, Nhịp nhanh thất VT, Nhịp chậm xoang nặng, Block AV các độ), xử trí suy hô hấp cấp, tụt SpO2, sốc tim và phù phổi cấp.
Định dạng trả lời:
- Gạch đầu dòng rõ ràng, phân cấp ưu tiên hành động A-B-C (Đường thở - Hô hấp - Tuần hoàn).
- Phác đồ thuốc và liều lượng rõ ràng (ví dụ: Adrenaline 1mg IV, Amiodarone 300mg pha truyền, Atropine 0.5-1mg IV bolus, Sốc điện đồng bộ/không đồng bộ Joules).
- Cảnh báo chống chỉ định và dấu hiệu sinh tồn cần theo dõi sát.
- Sử dụng tiếng Việt chuẩn y khoa, giọng điệu chuyên nghiệp, súc tích và khẩn cấp.`,

  pharmacist: `Bạn là Dược Sĩ Lâm Sàng Bệnh Viện (Clinical Pharmacist & Drug Safety Specialist).
Nhiệm vụ: Tra cứu chính xác dược lý học, liều dùng người lớn/suy thận (eGFR)/suy gan/người cao tuổi, tương tác thuốc nguy hiểm (Drug-Drug Interactions), chống chỉ định, đường dùng (IV bolus, IV truyền chậm, Tiêm dưới da, Uống), tốc độ pha truyền và dung dịch tương thích (NaCl 0.9%, Glucose 5%).
Định dạng trả lời:
- Bảng hoặc danh sách phân tích tương tác và mức độ nghiêm trọng.
- Khuyến nghị điều chỉnh liều hoặc thuốc thay thế an toàn.
- Thời điểm dùng thuốc và các chỉ số sinh tồn cần kiểm tra trước khi dùng (ví dụ: đếm nhịp tim trước khi dùng Digoxin, đo huyết áp trước khi dùng thuốc hạ áp/lợi tiểu).`,

  transfer_coordinator: `Bạn là Điều Phối Viên Chuyển Tuyến Cấp Cứu & Tìm Cơ Sở Y Tế Chuyên Sâu (Emergency Medical Transfer Coordinator).
Nhiệm vụ: Tìm kiếm các bệnh viện tuyến trên, trung tâm tim mạch can thiệp (Cathlab 24/7), trung tâm đột quỵ não, hồi sức tích cực ICU lân cận phù hợp với tình trạng cấp cứu của bệnh nhân.
Cung cấp:
1. Danh sách cơ sở y tế tuyến trên gần nhất và thế mạnh chuyên môn.
2. Tiêu chuẩn chỉ định chuyển viện an toàn (Transfer Eligibility Criteria).
3. Các bước ổn định bệnh nhân trước khi chuyển (đường truyền, thở oxy, monitor di động, thuốc cấp cứu mang theo).
4. Đường link và thông tin địa điểm cụ thể.`,

  triage_nurse: `Bạn là Điều Dưỡng Trưởng Trạm Phân Loại Sinh Tồn & Xử Trí Tức Thì (Triage & ICU Charge Nurse).
Nhiệm vụ: Đánh giá nhanh tình trạng người bệnh dựa trên chỉ số sinh tồn (Mạch, Huyết áp, SpO2, Nhịp thở, Điểm cảnh báo sớm MEWS). Đưa ra các hành động điều dưỡng tức thì tại giường: tư thế nằm (Fowler, nằm đầu bằng, nghiêng an toàn), cung cấp oxy (cannula, mask có túi thở lại, thở máy không xâm lấn BiPAP), kiểm tra đường truyền tĩnh mạch, chuẩn bị máy khử rung tim (Defibrillator) và xe tiêm cấp cứu Crash Cart trong khi chờ bác sĩ đến.`
};

app.post('/api/ai/chat', async (req, res) => {
  try {
    const {
      messages,
      role = 'clinical_doctor',
      modelPreference = 'gemini-3.7-flash',
      useSearch = false,
      useMaps = false,
      userLocation,
      patientContext,
    } = req.body;

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      res.status(400).json({ error: 'messages array is required' });
      return;
    }

    const aiClient = getGeminiClient();

    let baseInstruction = systemInstructionsByRole[role] || systemInstructionsByRole.clinical_doctor;
    if (patientContext) {
      baseInstruction += `\n\n[HỒ SƠ BỆNH NHÂN HIỆN TẠI ĐANG THEO DÕI]:
- Họ và tên: ${patientContext.patientName || 'N/A'} (Mã BN: ${patientContext.patientId || 'N/A'}, Phòng: ${patientContext.roomNumber || 'N/A'}, Giường: ${patientContext.bed || 'N/A'})
- Tuổi: ${patientContext.age || 'N/A'}
- Chẩn đoán: ${patientContext.diagnosis || 'Chưa xác định'}
- Chỉ số hiện tại: Nhịp tim ${patientContext.heartRate ? patientContext.heartRate + ' BPM' : 'N/A'} | SpO2: ${patientContext.spO2 ? patientContext.spO2 + '%' : 'N/A'}
- Thuốc đang điều trị: ${patientContext.medications && patientContext.medications.length ? patientContext.medications.join(', ') : 'Chưa ghi nhận'}
Hãy dựa trên thông tin lâm sàng thực tế này để đưa ra chỉ định chính xác nhất.`;
    }

    let selectedModel = modelPreference;
    let tools: any[] | undefined = undefined;
    let toolConfig: any = undefined;

    if (useMaps) {
      selectedModel = 'gemini-3.5-flash';
      tools = [{ googleMaps: {} }];
      if (userLocation && userLocation.latitude && userLocation.longitude) {
        toolConfig = {
          retrievalConfig: {
            latLng: {
              latitude: Number(userLocation.latitude),
              longitude: Number(userLocation.longitude),
            },
          },
        };
      }
    } else if (useSearch) {
      selectedModel = modelPreference || 'gemini-3.5-flash';
      tools = [{ googleSearch: {} }];
    }

    // Format conversation history for Gemini API
    const formattedContents = messages.map((m: any) => ({
      role: m.role === 'user' ? 'user' : 'model',
      parts: [{ text: typeof m.text === 'string' ? m.text : String(m.text || '') }],
    }));

    const response = await aiClient.models.generateContent({
      model: selectedModel,
      contents: formattedContents,
      config: {
        systemInstruction: baseInstruction,
        ...(tools ? { tools } : {}),
        ...(toolConfig ? { toolConfig } : {}),
      },
    });

    const text = response.text || 'Đã tiếp nhận yêu cầu lâm sàng.';
    const groundingChunksRaw = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
    const webSearchQueries = response.candidates?.[0]?.groundingMetadata?.webSearchQueries || [];

    const groundingSources: GroundingSource[] = [];
    for (const chunk of groundingChunksRaw) {
      if ((chunk as any).web) {
        groundingSources.push({
          title: (chunk as any).web.title || 'Nguồn y khoa trực tuyến',
          uri: (chunk as any).web.uri,
          type: 'web',
        });
      } else if ((chunk as any).maps) {
        groundingSources.push({
          title: (chunk as any).maps.title || 'Cơ sở Y tế trên Google Maps',
          uri: (chunk as any).maps.uri,
          type: 'maps',
          snippet: (chunk as any).maps.placeAnswerSources?.reviewSnippets?.[0] || '',
        });
      }
    }

    res.json({
      text,
      modelUsed: selectedModel,
      groundingSources,
      webSearchQueries,
    });
  } catch (error: any) {
    console.error('Error generating AI clinical consultation:', error);
    res.status(500).json({
      error: error?.message || 'Lỗi khi kết nối với Gemini AI Assistant',
      fallbackMessage:
        'Không thể lấy phản hồi từ mô hình AI. Vui lòng kiểm tra lại phác đồ cấp cứu tại trạm hoặc liên hệ Bác sĩ Trưởng ca trực ICU.',
    });
  }
});

// Reset Demo Data
app.post('/api/reset-data', (req, res) => {
  alerts = [];
  vitalReadings = [];
  patients = [...initialPatients];
  medications = [...initialMedications];
  medicationAdministrationLogs = [...initialMedicationAdministrationLogs];
  broadcast({
    type: 'INIT_STATE',
    alerts: [],
    patients: [...patients],
    doctors: [...doctors],
    medications: [...medications],
    medicationHistory: [...medicationAdministrationLogs],
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
      medicationHistory: [...medicationAdministrationLogs],
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
