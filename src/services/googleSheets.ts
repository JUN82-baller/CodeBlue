import { Doctor, Alert, MedicationSchedule, StaffShiftSchedule } from '../types';

export interface DriveSpreadsheetFile {
  id: string;
  name: string;
  modifiedTime?: string;
  webViewLink?: string;
}

export interface SheetTabInfo {
  sheetId: number;
  title: string;
  index: number;
}

export interface SpreadsheetMetadata {
  spreadsheetId: string;
  title: string;
  spreadsheetUrl: string;
  sheets: SheetTabInfo[];
}

/**
 * List existing Google Spreadsheets in user's Google Drive
 */
export async function listDriveSpreadsheets(accessToken: string): Promise<DriveSpreadsheetFile[]> {
  const query = encodeURIComponent("mimeType = 'application/vnd.google-apps.spreadsheet' and trashed = false");
  const fields = encodeURIComponent('files(id, name, modifiedTime, webViewLink)');
  const url = `https://www.googleapis.com/drive/v3/files?q=${query}&orderBy=modifiedTime%20desc&pageSize=20&fields=${fields}`;

  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Lỗi truy vấn Google Drive (${response.status}): ${errorText}`);
  }

  const data = await response.json();
  return (data.files || []).map((f: any) => ({
    id: f.id,
    name: f.name,
    modifiedTime: f.modifiedTime,
    webViewLink: f.webViewLink || `https://docs.google.com/spreadsheets/d/${f.id}`,
  }));
}

/**
 * Get details & list of tabs in a Google Spreadsheet
 */
export async function getSpreadsheetDetails(
  accessToken: string,
  spreadsheetId: string
): Promise<SpreadsheetMetadata> {
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}?fields=spreadsheetId,properties.title,spreadsheetUrl,sheets.properties(sheetId,title,index)`;

  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Lỗi đọc bảng tính Google Sheets (${response.status}): ${errorText}`);
  }

  const data = await response.json();
  return {
    spreadsheetId: data.spreadsheetId,
    title: data.properties?.title || 'Không có tiêu đề',
    spreadsheetUrl: data.spreadsheetUrl || `https://docs.google.com/spreadsheets/d/${spreadsheetId}`,
    sheets: (data.sheets || []).map((s: any) => ({
      sheetId: s.properties.sheetId,
      title: s.properties.title,
      index: s.properties.index,
    })),
  };
}

/**
 * Ensure specific sheet tab exists or create it
 */
async function ensureSheetTab(
  accessToken: string,
  spreadsheetId: string,
  tabTitle: string
): Promise<void> {
  const details = await getSpreadsheetDetails(accessToken, spreadsheetId);
  const exists = details.sheets.some((s) => s.title.toLowerCase() === tabTitle.toLowerCase());
  if (exists) return;

  // Add sheet tab via batchUpdate
  const batchUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`;
  const response = await fetch(batchUrl, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      requests: [
        {
          addSheet: {
            properties: {
              title: tabTitle,
            },
          },
        },
      ],
    }),
  });

  if (!response.ok) {
    console.warn(`Could not create tab ${tabTitle}:`, await response.text());
  }
}

/**
 * Create a brand new Hospital Master Google Spreadsheet with formatted tabs
 */
export async function createHospitalMasterSpreadsheet(
  accessToken: string,
  title: string = 'Hệ Thống Y Tế ICU - Dữ Liệu Bệnh Viện & Lịch Trực'
): Promise<SpreadsheetMetadata> {
  const createUrl = 'https://sheets.googleapis.com/v4/spreadsheets';

  const payload = {
    properties: {
      title,
    },
    sheets: [
      {
        properties: {
          title: '🗓️ Lịch Trình Ca Trực 24-7',
          gridProperties: { rowCount: 100, columnCount: 15, frozenRowCount: 1 },
        },
      },
      {
        properties: {
          title: '📋 Danh Sách Cán Bộ Y Tế',
          gridProperties: { rowCount: 100, columnCount: 15, frozenRowCount: 1 },
        },
      },
      {
        properties: {
          title: '💊 Lịch Dùng Thuốc BN',
          gridProperties: { rowCount: 100, columnCount: 15, frozenRowCount: 1 },
        },
      },
      {
        properties: {
          title: '🚨 Nhật Ký Cảnh Báo Lâm Sàng',
          gridProperties: { rowCount: 200, columnCount: 15, frozenRowCount: 1 },
        },
      },
    ],
  };

  const response = await fetch(createUrl, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Lỗi tạo bảng tính Google Sheets (${response.status}): ${errorText}`);
  }

  const data = await response.json();
  return {
    spreadsheetId: data.spreadsheetId,
    title: data.properties?.title || title,
    spreadsheetUrl: data.spreadsheetUrl || `https://docs.google.com/spreadsheets/d/${data.spreadsheetId}`,
    sheets: (data.sheets || []).map((s: any) => ({
      sheetId: s.properties?.sheetId || 0,
      title: s.properties?.title || '',
      index: s.properties?.index || 0,
    })),
  };
}

/**
 * Export Medical Staff Directory to Google Sheet
 */
export async function exportStaffToSheet(
  accessToken: string,
  spreadsheetId: string,
  doctors: Doctor[],
  tabName: string = '📋 Danh Sách Cán Bộ Y Tế'
): Promise<{ updatedRows: number }> {
  await ensureSheetTab(accessToken, spreadsheetId, tabName);

  const headerRow = [
    'Mã Nhân Viên',
    'Họ Và Tên',
    'Chức Danh / Vị Trí',
    'Khoa / Phòng Ban',
    'Số Điện Thoại',
    'Email Liên Hệ',
    'Khung Ca Hiện Tại',
    'Vị Trí Phân Bổ',
    'Trực Chính 24/7',
    'Trực Dự Phòng',
    'Số CCHN',
    'Năm Kinh Nghiệm',
    'Ngày Vào Làm',
    'Liên Hệ Khẩn Cấp',
    'Ghi Chú Lâm Sàng',
  ];

  const dataRows = doctors.map((doc) => [
    doc.employeeCode || doc.id,
    doc.name,
    doc.role || 'Bác sĩ',
    doc.department,
    doc.phone,
    doc.email || '',
    doc.shift || 'Ca 24h',
    doc.assignedZone || 'ICU Khu A',
    doc.isOnCall ? 'CÓ (Đang Trực)' : 'KHÔNG',
    doc.isBackup ? 'CÓ (Dự Phòng)' : 'KHÔNG',
    doc.licenseNumber || '',
    doc.experienceYears ? `${doc.experienceYears} năm` : '',
    doc.joinDate || '',
    doc.emergencyContact || '',
    doc.notes || '',
  ]);

  const values = [headerRow, ...dataRows];
  const range = `'${tabName}'!A1:O${values.length + 5}`;

  // Clear existing content then write
  const clearUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/'${tabName}'!A1:Z500:clear`;
  await fetch(clearUrl, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  const updateUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(range)}?valueInputOption=USER_ENTERED`;
  const response = await fetch(updateUrl, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      range,
      majorDimension: 'ROWS',
      values,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Lỗi ghi dữ liệu nhân sự lên Google Sheets (${response.status}): ${errorText}`);
  }

  const result = await response.json();
  return { updatedRows: result.updatedRows || dataRows.length };
}

/**
 * Export Duty Roster / Timetable Schedule to Google Sheet
 */
export async function exportRosterToSheet(
  accessToken: string,
  spreadsheetId: string,
  schedules: StaffShiftSchedule[],
  tabName: string = '🗓️ Lịch Trình Ca Trực 24-7'
): Promise<{ updatedRows: number }> {
  await ensureSheetTab(accessToken, spreadsheetId, tabName);

  const headerRow = [
    'Mã Ca Trực',
    'Ngày Trực',
    'Thứ Trong Tuần',
    'Tên Nhân Viên',
    'Khoa Phòng',
    'Chức Danh',
    'Phân Loại Ca',
    'Tên Khung Giờ',
    'Giờ Bắt Đầu',
    'Giờ Kết Thúc',
    'Khu Vực Phân Bổ',
    'Trưởng Kíp Trực',
    'Trạng Thái Ca',
    'Ghi Chú Điều Phối',
  ];

  const dayNames = ['Chủ Nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy'];

  const dataRows = schedules.map((s) => [
    s.id,
    s.date,
    dayNames[s.dayOfWeek] || `Thứ ${s.dayOfWeek + 1}`,
    s.staffName,
    s.department,
    s.role,
    s.shiftType,
    s.shiftName,
    s.startTime,
    s.endTime,
    s.zone,
    s.isOnCallLead ? '👑 TRƯỞNG KÍP TRỰC' : 'Thành viên kíp',
    s.status === 'CHECKED_IN' ? 'Đã Vào Ca' : s.status === 'COMPLETED' ? 'Đã Hoàn Thành' : s.status === 'SWAPPED' ? 'Đã Đổi Ca' : 'Theo Lịch',
    s.notes || '',
  ]);

  const values = [headerRow, ...dataRows];
  const range = `'${tabName}'!A1:N${values.length + 5}`;

  // Clear existing content
  const clearUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/'${tabName}'!A1:Z500:clear`;
  await fetch(clearUrl, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  const updateUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(range)}?valueInputOption=USER_ENTERED`;
  const response = await fetch(updateUrl, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      range,
      majorDimension: 'ROWS',
      values,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Lỗi ghi thời khóa biểu lên Google Sheets (${response.status}): ${errorText}`);
  }

  const result = await response.json();
  return { updatedRows: result.updatedRows || dataRows.length };
}

/**
 * Export Medication Administration Schedules to Google Sheet
 */
export async function exportMedicationsToSheet(
  accessToken: string,
  spreadsheetId: string,
  medications: MedicationSchedule[],
  tabName: string = '💊 Lịch Dùng Thuốc BN'
): Promise<{ updatedRows: number }> {
  await ensureSheetTab(accessToken, spreadsheetId, tabName);

  const headerRow = [
    'Mã Y Lệnh',
    'Tên Bệnh Nhân',
    'Phòng Bệnh',
    'Số Giường',
    'Tên Thuốc & Hàm Lượng',
    'Liều Lượng',
    'Đường Dùng',
    'Ngày Chỉ Định',
    'Giờ Uống / Tiêm',
    'Tần Suất Dùng',
    'Bác Sĩ Chỉ Định',
    'Điều Dưỡng Phụ Trách',
    'Trạng Thái',
    'Thời Điểm Thực Hiện',
    'Người Đã Cho Thuốc',
    'Chỉ Số Sinh Tồn Trước Uống',
    'Lưu Ý Hướng Dẫn',
  ];

  const dataRows = medications.map((m) => [
    m.id,
    m.patientName,
    m.roomNumber,
    m.bed,
    m.medicationName,
    m.dosage,
    m.route,
    m.scheduledDate,
    m.scheduledTime,
    m.frequency,
    m.prescribedByDoctorName,
    m.assignedNurseName || 'Trực ca Điều dưỡng',
    m.status === 'Administered' ? 'Đã Cho Thuốc' : m.status === 'Missed' ? 'Trễ Giờ' : m.status === 'Held' ? 'Tạm Hoãn' : 'Đang Chờ',
    m.administeredAt ? new Date(m.administeredAt).toLocaleString('vi-VN') : '',
    m.administeredBy || '',
    m.recordedHeartRate ? `Mạch: ${m.recordedHeartRate} bpm, HA: ${m.recordedBloodPressure || 'N/A'}, SpO2: ${m.recordedSpO2 || 'N/A'}%` : (m.preVitalsRequired ? 'Yêu cầu đo trước' : 'Không bắt buộc'),
    m.instructions || '',
  ]);

  const values = [headerRow, ...dataRows];
  const range = `'${tabName}'!A1:Q${values.length + 5}`;

  // Clear existing content
  const clearUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/'${tabName}'!A1:Z500:clear`;
  await fetch(clearUrl, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  const updateUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(range)}?valueInputOption=USER_ENTERED`;
  const response = await fetch(updateUrl, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      range,
      majorDimension: 'ROWS',
      values,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Lỗi ghi lịch dùng thuốc lên Google Sheets (${response.status}): ${errorText}`);
  }

  const result = await response.json();
  return { updatedRows: result.updatedRows || dataRows.length };
}

/**
 * Export Emergency Alert Audit Log to Google Sheet
 */
export async function exportAlertsToSheet(
  accessToken: string,
  spreadsheetId: string,
  alerts: Alert[],
  tabName: string = '🚨 Nhật Ký Cảnh Báo Lâm Sàng'
): Promise<{ updatedRows: number }> {
  await ensureSheetTab(accessToken, spreadsheetId, tabName);

  const headerRow = [
    'Mã Cảnh Báo',
    'Thời Điểm Báo Động',
    'Bệnh Nhân',
    'Phòng Bệnh',
    'Mức Độ Khẩn Cấp',
    'Nhịp Tim (BPM)',
    'SpO2 (%)',
    'Lý Do Báo Động',
    'Trạng Thái',
    'Người Tiếp Nhận',
    'Thời Gian Tiếp Nhận',
    'Người Xử Lý Xong',
    'Thời Gian Xử Lý Xong',
    'Thời Gian Phản Hồi (Giây)',
    'Chuyển Tuyến Dự Phòng',
    'Ghi Chú Xử Trí',
  ];

  const dataRows = alerts.map((a) => [
    a.id,
    new Date(a.createdAt).toLocaleString('vi-VN'),
    a.patientName,
    a.roomNumber,
    a.severity === 'Fatal' ? 'NGUY KỊCH (TỬ VONG)' : a.severity === 'Critical' ? 'BÁO ĐỘNG ĐỎ' : 'CẢNH BÁO',
    a.heartRate,
    a.spO2 || '',
    a.reason,
    a.status === 'Resolved' ? 'Đã Xử Trí' : a.status === 'Acknowledged' ? 'Đang Tiếp Nhận' : 'Chờ Xử Lý',
    a.acknowledgedBy || '',
    a.acknowledgedAt ? new Date(a.acknowledgedAt).toLocaleString('vi-VN') : '',
    a.resolvedBy || '',
    a.resolvedAt ? new Date(a.resolvedAt).toLocaleString('vi-VN') : '',
    a.responseTimeSeconds ? `${a.responseTimeSeconds}s` : '',
    a.escalatedToBackup ? 'CÓ (Đã Leo Thang)' : 'Không',
    a.resolutionNote || '',
  ]);

  const values = [headerRow, ...dataRows];
  const range = `'${tabName}'!A1:P${values.length + 5}`;

  // Clear existing content
  const clearUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/'${tabName}'!A1:Z1000:clear`;
  await fetch(clearUrl, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  const updateUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(range)}?valueInputOption=USER_ENTERED`;
  const response = await fetch(updateUrl, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      range,
      majorDimension: 'ROWS',
      values,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Lỗi ghi nhật ký cảnh báo lên Google Sheets (${response.status}): ${errorText}`);
  }

  const result = await response.json();
  return { updatedRows: result.updatedRows || dataRows.length };
}

/**
 * Import Medical Staff from Google Sheet back into the Application
 */
export async function importStaffFromSheet(
  accessToken: string,
  spreadsheetId: string,
  tabName: string = '📋 Danh Sách Cán Bộ Y Tế'
): Promise<Doctor[]> {
  const readUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/'${encodeURIComponent(tabName)}'!A1:O200`;

  const response = await fetch(readUrl, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Lỗi đọc dữ liệu từ Google Sheets (${response.status}): ${errorText}`);
  }

  const data = await response.json();
  const rows: string[][] = data.values || [];

  if (rows.length < 2) {
    throw new Error('Bảng tính không có dữ liệu nhân sự (ít hơn 2 dòng).');
  }

  // Skip header row
  const parsedDoctors: Doctor[] = [];

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row[1] || row[1].trim() === '') continue; // Skip empty names

    const employeeCode = row[0]?.trim() || `EMP-${Date.now()}-${i}`;
    const name = row[1]?.trim() || 'Nhân sự chưa đặt tên';
    const role = row[2]?.trim() || 'Bác Sĩ Điều Trị';
    const department = row[3]?.trim() || 'Khoa Hồi Sức Cấp Cứu (ICU)';
    const phone = row[4]?.trim() || '0900000000';
    const email = row[5]?.trim() || '';
    const shift = row[6]?.trim() || 'Ca Sáng (07:00 - 15:00)';
    const assignedZone = row[7]?.trim() || 'ICU Khu A';
    const isOnCall = row[8]?.toUpperCase().includes('CÓ') || row[8]?.toUpperCase().includes('TRUE');
    const isBackup = row[9]?.toUpperCase().includes('CÓ') || row[9]?.toUpperCase().includes('TRUE');
    const licenseNumber = row[10]?.trim() || '';
    const experienceYears = parseInt(row[11]?.replace(/\D/g, '') || '5', 10);
    const joinDate = row[12]?.trim() || '';
    const emergencyContact = row[13]?.trim() || '';
    const notes = row[14]?.trim() || '';

    parsedDoctors.push({
      id: `doc-import-${i}-${Date.now()}`,
      employeeCode,
      name,
      role,
      department,
      phone,
      email,
      shift,
      assignedZone,
      isOnCall,
      isBackup,
      licenseNumber,
      experienceYears,
      joinDate,
      emergencyContact,
      notes,
    });
  }

  return parsedDoctors;
}

/**
 * Synchronize all hospital data modules in a single batch operation
 */
export async function syncAllHospitalDataToSheet(
  accessToken: string,
  spreadsheetId: string,
  data: {
    doctors: Doctor[];
    schedules?: StaffShiftSchedule[];
    medications: MedicationSchedule[];
    alerts: Alert[];
  }
): Promise<{ success: boolean; message: string }> {
  // Export in sequence
  await exportStaffToSheet(accessToken, spreadsheetId, data.doctors);

  if (data.schedules && data.schedules.length > 0) {
    await exportRosterToSheet(accessToken, spreadsheetId, data.schedules);
  }

  if (data.medications && data.medications.length > 0) {
    await exportMedicationsToSheet(accessToken, spreadsheetId, data.medications);
  }

  if (data.alerts && data.alerts.length > 0) {
    await exportAlertsToSheet(accessToken, spreadsheetId, data.alerts);
  }

  return {
    success: true,
    message: `Đã đồng bộ thành công ${data.doctors.length} nhân viên, ${data.schedules?.length || 0} ca trực, ${data.medications.length} y lệnh thuốc và ${data.alerts.length} nhật ký cảnh báo lên Google Sheets!`,
  };
}
