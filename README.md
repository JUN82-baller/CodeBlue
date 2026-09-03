# Hệ Thống Cảnh Báo Khẩn Cấp Bệnh Viện & Quản Lý Buồng Giường Thời Gian Thực
*(Hospital Emergency Alert & Real-time Bed Management System)*

Ứng dụng web cấp bệnh viện chuyên sâu hỗ trợ giám sát sinh hiệu telemetry, phát hiện và phát tín hiệu báo động đỏ cấp cứu thời gian thực, điều phối buồng giường bệnh nhân, đồng bộ Google Workspace (Gmail, Google Sheets, Google Calendar) và tích hợp Trợ lý quyết định lâm sàng Gemini AI.

---

## 🌟 Tính Năng Nổi Bật (Key Features)

### 1. 🛏️ Quản Lý Buồng Giường & Tiếp Nhận Bệnh Nhân (Bed Occupancy & Admission)
- **Chỉ số công suất buồng giường thời gian thực (KPIs):** Hiển thị trực quan số giường trống, số giường đã có người, tổng số giường của khoa và số giường đang báo động nguy cấp.
- **Huy hiệu tiện ích trên thanh điều hướng (Navbar):** Cập nhật số giường khả dụng mọi lúc (`Trống X/Y giường`) kèm nút bấm mở nhanh modal tiếp nhận bệnh nhân.
- **Sơ đồ mặt bằng buồng bệnh trực quan (Ward Floor Grid):**
  - Phân chia buồng bệnh (Phòng 301, 302, 303, 304, 305...) và từng vị trí giường (Giường A, Giường B, Giường C).
  - Phân loại màu sắc rõ ràng:
    - 🟢 **Giường Trống (Available):** Nút tiếp nhận bệnh nhân nhanh (Admit Patient).
    - 🔵 **Có Bệnh Nhân (Occupied):** Hiển thị thông tin người bệnh, chẩn đoán, telemetry nhịp tim BPM, SpO2, nút phát loa và kích hoạt test khẩn cấp.
    - 🔴 **Báo Động Nguy Cấp (Alert Active):** Viền đỏ nhấp nháy, cảnh báo trực quan lập tức.
- **Modal Tiếp nhận & Điều phối bệnh nhân (Patient Admission Modal):**
  - Nhập thông tin hành chính: Mã BN, Họ tên, Tuổi, Giới tính, Buồng bệnh, Giường bệnh, Bác sĩ phụ trách.
  - Chọn nhanh phác đồ chẩn đoán lâm sàng mẫu: *Nhồi máu cơ tim cấp, Rung nhĩ đáp ứng thất nhanh, Suy hô hấp cấp / Đợt cấp COPD, Đột quỵ thiếu máu não cấp, Sốc nhiễm khuẩn, Chấn thương sọ não...*
  - Khởi tạo chỉ số sinh tồn ban đầu: Nhịp tim, SpO2, Huyết áp tâm thu/tâm trương.
  - Ghi chú lâm sàng, tiền sử dị ứng, tình trạng nhịn ăn / chuyển mổ.
  - Hỗ trợ **Xuất viện (Discharge)** để giải phóng giường ngay lập tức và đồng bộ tự động qua WebSocket.

---

### 2. 🚨 Hệ Thống Báo Động Đỏ & Giám Sát Sinh Hiệu (Code Red Emergency Alerting)
- **Giám sát Telemetry liên tục:** Tự động phát hiện nhịp tim vượt ngưỡng (nhanh/chậm), tụt oxy máu SpO2, huyết áp nguy cấp.
- **Phân loại 3 cấp độ nguy kịch:**
  - **Fatal (Nguy kịch cực độ / Báo động Đỏ):** Nhịp tim $\ge$ 150 BPM (Rung thất/Cuồng thất), $\le$ 40 BPM (Vô tâm thu/Nhịp chậm đe dọa tử vong) hoặc SpO2 $\le$ 80%.
  - **Critical (Nguy cấp):** Vượt ngưỡng cài đặt khẩn cấp.
  - **Warning (Cảnh báo vàng):** Chỉ số dao động ngoài khoảng sinh lý bình thường.
- **Hệ thống âm thanh đa kênh & Phản hồi thực tế:**
  - Còi hú trạm trực điều dưỡng chuẩn tần số kép (Dual-tone siren 880Hz - 980Hz).
  - Chuông điện thoại gọi bác sĩ trực nội viện.
  - **Phát thanh giọng nói tiếng Việt tự động:** Đọc to phòng bệnh, tên bệnh nhân và triệu chứng cấp cứu qua Web Speech API.
  - **Rung phản hồi (Haptic Vibration):** Rung nhịp điệu cấp cứu trên điện thoại di động và máy tính bảng của kíp trực.
- **Cơ chế Leo thang Báo động (Escalation Protocol):**
  - Đếm ngược thời gian phản hồi (mặc định 60 giây).
  - Nếu bác sĩ trực chính không xác nhận (Acknowledge) kịp thời, hệ thống tự động leo thang thông báo đến bác sĩ trực cấp cao hơn hoặc trưởng kíp trực.

---

### 3. 👨‍⚕️ Cổng Bác Sĩ & Điều Phối Lâm Sàng (Doctor Portal)
- Danh sách cảnh báo đang chờ xử lý với thẻ màu phân biệt độ khẩn cấp.
- Tiếp nhận cuộc gọi/cảnh báo (*Xác nhận tiếp nhận*).
- Khám tại giường và hoàn tất xử lý ca bệnh (*Nhập biên bản xử lý lâm sàng*).
- Nút liên lạc khẩn cấp (Quick Contact) gọi điện thoại trực tiếp hoặc mở kênh chat nhanh với trạm điều dưỡng.
- Chế độ phân quyền trực On-call / Off-call của từng bác sĩ trong kíp trực.

---

### 4. 🤖 Trợ Lý Quyết Định Lâm Sàng Gemini AI (Gemini AI Clinical Support)
- Sử dụng mô hình **Gemini AI** để hỗ trợ đưa ra quyết định lâm sàng tức thì.
- **4 Vai trò chuyên sâu:**
  - 🩺 **Bác sĩ Cấp cứu:** Phân tích điện tâm đồ, phác đồ hồi sức tim phổi CPR, sốc điện và thuốc hồi sinh nâng cao.
  - 💊 **Dược sĩ Lâm sàng:** Tra cứu liều lượng, tương tác thuốc chống loạn nhịp và chống đông.
  - 🏥 **Điều phối Chuyển viện:** Hướng dẫn ổn định huyết động trước khi chuyển ICU hoặc can thiệp mạch vành.
  - 📋 **Điều dưỡng Phân luồng:** Quy trình chăm sóc theo dõi sát tại giường bệnh.
- **Phím tắt toàn cục:** Bấm `Ctrl+K` (hoặc `Cmd+K`) ở bất kỳ màn hình nào để mở nhanh trợ lý Gemini AI.

---

### 5. 📅 Lịch Dùng Thuốc & Đồng Bộ Google Calendar (Medication MAR)
- Quản lý lịch cho bệnh nhân dùng thuốc theo từng ca trực sáng, trưa, chiều, tối.
- Ghi nhận hồ sơ điều dưỡng đã thực hiện tiêm / cho uống thuốc (MAR - Medication Administration Record).
- **Tích hợp Google Calendar:** Tự động tạo sự kiện nhắc giờ dùng thuốc trên Google Calendar cá nhân của nhân viên y tế.

---

### 6. 📧 Điều Phối Y Lệnh Khẩn Cấp Qua Gmail & Google Sheets
- **Gmail API Dispatcher:** Tạo và gửi email y lệnh cấp cứu, báo động đỏ hoặc biên bản hội chẩn trực tiếp từ hệ thống đến hộp thư của bác sĩ trực thông qua Google OAuth 2.0.
- **Google Sheets Integration:** Xuất danh sách nhân sự, ca trực và lịch sử các ca báo động sang Google Sheets để làm báo cáo kiểm thảo tử vong hoặc họp giao ban khoa.

---

### 7. 🧪 Bộ Mô Phỏng Telemetry & Nhật Ký Kiểm Toán (Simulator & Audit Log)
- **Bộ mô phỏng nhịp sinh hiệu:** Cho phép giảng viên, sinh viên y khoa hoặc nhân viên diễn tập tạo các tình huống khẩn cấp (Rung thất V-Fib, Nhịp chậm Bradycardia, Suy hô hấp Hypoxia, hoặc Khôi phục nhịp xoang bình thường).
- **Audit Log:** Lưu trữ toàn bộ dấu vết các lần kích hoạt cảnh báo, thời gian bác sĩ tiếp nhận, thời gian xử lý và ghi chú lâm sàng.

---

## 🏗️ Kiến Trúc Công Nghệ (Tech Stack)

| Thành phần | Công nghệ sử dụng |
|---|---|
| **Giao diện (Frontend)** | React 18, TypeScript, Tailwind CSS, Lucide React Icons |
| **Máy chủ (Backend)** | Node.js, Express, WebSocket (`ws`) kết nối thời gian thực hai chiều |
| **Trí tuệ nhân tạo (AI)** | Google GenAI SDK (`@google/genai`) với mô hình Gemini |
| **Không gian làm việc (Workspace)** | Google Workspace OAuth 2.0 (Gmail API, Google Sheets API, Google Calendar) |
| **Âm thanh & Sinh hiệu** | Web Audio API (Synthesized Sirens & Chimes), Web Speech Synthesis, Web Vibration API |

---

## 🚀 Hướng Dẫn Cài Đặt & Chạy Ứng Dụng (Getting Started)

### 1. Yêu cầu môi trường
- Node.js phiên bản 18+ trở lên.
- Trình quản lý gói `npm`.

### 2. Cài đặt mã nguồn
```bash
# Cài đặt các gói phụ thuộc
npm install
```

### 3. Cấu hình biến môi trường
Tạo file `.env` (dựa trên `.env.example`) và điền các khóa cấu hình cần thiết:
```env
# Google Gemini API Key cho trợ lý lâm sàng
GEMINI_API_KEY=your_gemini_api_key_here
```

### 4. Khởi chạy ứng dụng ở chế độ phát triển
```bash
npm run dev
```
Dev server sẽ chạy tại địa chỉ: `http://localhost:3000`

### 5. Đóng gói cho môi trường Production
```bash
npm run build
npm run start
```

---

## 📂 Cấu Trúc Dự Án (Project Structure)

```
├── src/
│   ├── components/
│   │   ├── Navbar.tsx                   # Thanh điều hướng với bộ đếm giường & thông báo
│   │   ├── NurseStationKiosk.tsx        # Trạm trực điều dưỡng & sơ đồ buồng giường
│   │   ├── PatientBedModal.tsx          # Modal tiếp nhận bệnh nhân & phân giường
│   │   ├── DoctorPortal.tsx             # Cổng thông tin bác sĩ trực
│   │   ├── MedicationCalendarManager.tsx# Quản lý phác đồ thuốc & Google Calendar
│   │   ├── AiClinicalAssistant.tsx      # Trợ lý lâm sàng Gemini AI
│   │   ├── GmailDispatcherModal.tsx     # Điều phối email y lệnh khẩn cấp qua Gmail
│   │   ├── GoogleSheetsSyncModal.tsx    # Đồng bộ dữ liệu bảng tính Google Sheets
│   │   ├── TelemetrySimulator.tsx       # Bộ mô phỏng phát tín hiệu sinh tồn
│   │   ├── AlertAuditHistory.tsx        # Nhật ký kiểm toán ca cấp cứu
│   │   ├── SettingsModal.tsx            # Cài đặt ngưỡng sinh tồn và leo thang
│   │   └── QuickContactModal.tsx        # Modal liên hệ khẩn cấp
│   ├── context/
│   │   ├── LanguageContext.tsx          # Đa ngôn ngữ (Tiếng Việt & Tiếng Anh)
│   │   └── ThemeContext.tsx             # Giao diện Sáng / Tối (Light & Dark mode)
│   ├── services/
│   │   ├── websocket.ts                 # Kết nối WebSocket client
│   │   ├── sound.ts                     # Bộ tạo âm thanh còi hú Web Audio API
│   │   ├── voiceAnnouncement.ts         # Phát thanh thông báo khẩn cấp bằng giọng nói
│   │   ├── haptic.ts                    # Rung phản hồi thiết bị di động
│   │   └── notifications.ts             # Thông báo Desktop Notification
│   ├── types.ts                         # Định nghĩa kiểu dữ liệu TypeScript
│   ├── App.tsx                          # Luồng chính và điều phối ứng dụng
│   └── main.tsx                         # Điểm khởi tạo ứng dụng React
├── server.ts                            # Máy chủ Express & WebSocket Server trung tâm
├── metadata.json                        # Khai báo quyền và thông tin ứng dụng
└── package.json                         # Danh sách thư viện và scripts
```

---

## 🔐 Bảo Mật & Đạo Đức Y Tế
- Khóa bí mật API (`GEMINI_API_KEY`) luôn được giữ an toàn tại server-side và không bao giờ gửi ra client.
- Quyền truy cập Gmail và Google Sheets được cấp thông qua luồng OAuth an toàn của Google Identity Services.
- Mọi khuyến nghị từ Trợ lý Gemini AI đều mang tính chất hỗ trợ quyết định lâm sàng (Decision Support) và không thay thế cho y lệnh trực tiếp của bác sĩ chuyên môn.
