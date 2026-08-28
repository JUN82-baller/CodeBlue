export type AlertSeverity = 'Warning' | 'Critical' | 'Fatal';
export type AlertStatus = 'Pending' | 'Acknowledged' | 'Resolved';

export interface Patient {
  id: string;
  name: string;
  roomNumber: string;
  age: number;
  bed: string;
  diagnosis: string;
  primaryDoctorId?: string;
}

export interface Doctor {
  id: string;
  name: string;
  role?: string;
  department: string;
  phone: string;
  email?: string;
  isOnCall: boolean;
  isBackup: boolean;
  shift?: string;
  connectionId?: string;
  activeGroup?: string;
}

export interface VitalReading {
  id: string;
  patientId: string;
  patientName?: string;
  roomNumber?: string;
  heartRate: number;
  spO2?: number;
  bloodPressureSystolic?: number;
  bloodPressureDiastolic?: number;
  timestamp: string;
  isAbnormal: boolean;
  abnormalReason?: string;
}

export interface Alert {
  id: string;
  patientId: string;
  patientName: string;
  roomNumber: string;
  severity: AlertSeverity;
  status: AlertStatus;
  heartRate: number;
  spO2?: number;
  reason: string;
  createdAt: string;
  acknowledgedAt?: string;
  acknowledgedBy?: string;
  acknowledgedRole?: string;
  resolvedAt?: string;
  resolvedBy?: string;
  resolutionNote?: string;
  responseTimeSeconds?: number;
  escalatedToBackup?: boolean;
  escalatedAt?: string;
}

export interface SystemSettings {
  minNormalHeartRate: number; // e.g. 50
  maxNormalHeartRate: number; // e.g. 120
  criticalLowHeartRate: number; // e.g. 40
  criticalHighHeartRate: number; // e.g. 150
  minSpO2: number; // e.g. 90%
  escalationTimeoutSeconds: number; // e.g. 15s
}

export interface SystemStats {
  totalVitalsProcessed: number;
  totalAlerts: number;
  pendingAlerts: number;
  acknowledgedAlerts: number;
  resolvedAlerts: number;
  avgResponseTimeSeconds: number;
  escalatedAlertsCount: number;
  connectedClients: number;
  connectedDoctors: number;
  connectedNurseStations: number;
  totalMedicationsScheduled?: number;
  totalMedicationsAdministered?: number;
  pendingMedicationsToday?: number;
}

export type MedicationRoute = 'Oral' | 'IV' | 'IM' | 'Subcutaneous' | 'Inhalation' | 'Infusion' | 'Topical';
export type MedicationStatus = 'Scheduled' | 'Administered' | 'Missed' | 'Held' | 'Cancelled';

export interface MedicationSchedule {
  id: string;
  patientId: string;
  patientName: string;
  roomNumber: string;
  bed: string;
  medicationName: string;
  dosage: string;
  route: MedicationRoute;
  scheduledTime: string; // e.g. "08:00" or ISO
  scheduledDate: string; // e.g. "2026-08-27"
  frequency: string; // e.g. "2 lần/ngày (08:00, 20:00)"
  prescribedByDoctorId: string;
  prescribedByDoctorName: string;
  assignedNurseId?: string;
  assignedNurseName?: string;
  instructions: string;
  status: MedicationStatus;
  administeredAt?: string;
  administeredBy?: string;
  administeredRole?: string;
  administerNotes?: string;
  preVitalsRequired?: boolean; // Yêu cầu đo mạch/HA trước khi dùng
  recordedHeartRate?: number;
  recordedBloodPressure?: string;
  googleCalendarEventId?: string;
  googleCalendarSyncedAt?: string;
  googleCalendarHtmlLink?: string;
  createdAt: string;
}

export type WsGroup = 'OnCallDoctors' | 'NurseStationDisplay' | 'Global' | 'AuditLogs' | 'MedicationStation';

export type AiConsultationRole = 'clinical_doctor' | 'pharmacist' | 'transfer_coordinator' | 'triage_nurse';

export interface GroundingSource {
  title?: string;
  uri?: string;
  type?: 'web' | 'maps';
  snippet?: string;
}

export interface AiChatMessage {
  id: string;
  role: 'user' | 'model';
  text: string;
  timestamp: string;
  consultationRole?: AiConsultationRole;
  modelUsed?: string;
  groundingSources?: GroundingSource[];
  webSearchQueries?: string[];
  isError?: boolean;
}

export type WsClientMessage =
  | { type: 'JOIN_GROUP'; group: WsGroup; doctorId?: string; doctorName?: string }
  | { type: 'LEAVE_GROUP'; group: WsGroup }
  | { type: 'PING' };

export type WsServerMessage =
  | { type: 'CONNECTED'; clientId: string; serverTime: string }
  | { type: 'INIT_STATE'; alerts: Alert[]; patients: Patient[]; doctors: Doctor[]; settings: SystemSettings; stats: SystemStats; medications?: MedicationSchedule[] }
  | { type: 'NEW_ALERT'; alert: Alert }
  | { type: 'ALERT_ACKNOWLEDGED'; alert: Alert; acknowledgedBy: string }
  | { type: 'ALERT_RESOLVED'; alert: Alert; resolvedBy: string }
  | { type: 'ALERT_ESCALATED'; alert: Alert; backupDoctorName?: string }
  | { type: 'NEW_VITAL'; reading: VitalReading }
  | { type: 'STATS_UPDATED'; stats: SystemStats }
  | { type: 'DOCTORS_UPDATED'; doctors: Doctor[] }
  | { type: 'PATIENTS_UPDATED'; patients: Patient[] }
  | { type: 'MEDICATIONS_UPDATED'; medications: MedicationSchedule[] }
  | { type: 'MEDICATION_ADMINISTERED'; medication: MedicationSchedule }
  | { type: 'DATA_RESET'; alerts: Alert[]; patients: Patient[]; doctors: Doctor[]; medications?: MedicationSchedule[] };
