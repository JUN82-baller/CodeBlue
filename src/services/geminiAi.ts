import { AiChatMessage, AiConsultationRole, GroundingSource } from '../types';

export interface PatientContextData {
  patientId?: string;
  patientName?: string;
  roomNumber?: string;
  bed?: string;
  age?: number;
  diagnosis?: string;
  heartRate?: number;
  spO2?: number;
  medications?: string[];
}

export interface ConsultationResponse {
  text: string;
  modelUsed?: string;
  groundingSources?: GroundingSource[];
  webSearchQueries?: string[];
}

export async function sendAiConsultation(
  messages: Array<{ role: 'user' | 'model'; text: string }>,
  options: {
    role?: AiConsultationRole;
    modelPreference?: string;
    useSearch?: boolean;
    useMaps?: boolean;
    userLocation?: { latitude: number; longitude: number };
    patientContext?: PatientContextData;
  }
): Promise<ConsultationResponse> {
  const response = await fetch('/api/ai/chat', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      messages,
      role: options.role || 'clinical_doctor',
      modelPreference: options.modelPreference || 'gemini-3.7-flash',
      useSearch: !!options.useSearch,
      useMaps: !!options.useMaps,
      userLocation: options.userLocation,
      patientContext: options.patientContext,
    }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || errorData.fallbackMessage || 'Không thể kết nối với dịch vụ Gemini AI');
  }

  return response.json();
}
