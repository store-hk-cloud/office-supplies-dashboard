# 📊 Office Supplies Data Analysis Dashboard

ระบบ Dashboard วิเคราะห์ข้อมูลการเบิกใช้วัสดุสำนักงาน (Office Supplies Data Analysis Dashboard)  
ออกแบบให้ใช้งานบน **Google Apps Script (GAS)** เป็น Web App  
ดีไซน์สไตล์ Google Looker Studio พร้อมกราฟเชิงโต้ตอบแบบ Real-time

---

## 📁 โครงสร้างโฟลเดอร์ในคอมพิวเตอร์

```
Office Supplies Data Analysis Dashboard/
├── Code.gs                ← Backend: Google Apps Script (Server-side Functions)
├── Index.html             ← Main Layout: HTML Template (หน้าเว็บหลัก)
├── style.html             ← CSS: Custom UI Styling (Looker Studio Theme)
├── javascript.html        ← Frontend: Client-side JS, Chart.js, Mock Data
├── appsscript.json        ← Project Manifest (GAS Configuration)
└── README.md              ← Documentation (ไฟล์นี้)
```

### คำอธิบายแต่ละไฟล์

| ไฟล์ | ประเภท | คำอธิบาย |
|------|--------|----------|
| `Code.gs` | Google Apps Script | ฟังก์ชันฝั่ง Server: `doGet()`, `include()`, `getFileList()`, `getDashboardData()`, ระบบ Cache |
| `Index.html` | HTML Template | โครงสร้างหน้า Dashboard: Header, Scorecards, Charts, Data Table |
| `style.html` | CSS | แต่ง Theme ทั้งหมด (CSS Variables, Card Shadows, Scrollbar, Animations, Responsive) |
| `javascript.html` | JavaScript | Logic ฝั่ง Client: `google.script.run`, Chart.js, Search Filter, Mock Data, Loading States |
| `appsscript.json` | JSON Manifest | ตั้งค่า GAS Project (TimeZone, Runtime, OAuth Scopes, Web App Access) |

---

## 🔧 วิธีทำ HTML Include ใน Google Apps Script

Google Apps Script รองรับการแยกไฟล์ HTML ออกเป็นส่วนย่อยๆ โดยใช้ **`HtmlService.createHtmlOutputFromFile()`**  
ร่วมกับ **Scriptlet Syntax** `<?!= include('filename'); ?>`

### หลักการทำงาน

1. **Code.gs** มีฟังก์ชัน `include(filename)`:
   ```javascript
   function include(filename) {
     return HtmlService.createHtmlOutputFromFile(filename).getContent();
   }
   ```

2. **Index.html** ใช้ Scriptlet เรียกฟังก์ชัน `include()` เพื่อแทรกเนื้อหาจากไฟล์อื่น:
   ```html
   <!-- ดึง CSS -->
   <?!= include('style'); ?>

   <!-- ดึง JavaScript -->
   <?!= include('javascript'); ?>
   ```

3. ฟังก์ชัน `doGet()` ใช้ `HtmlService.createTemplateFromFile("Index")` เพื่อสร้าง Template  
   จากนั้น `.evaluate()` จะประมวลผล Scriptlet `<?!= ... ?>` ทั้งหมด

### ข้อควรระวัง
- ไฟล์ที่ Include ต้องมีนามสกุล `.html` (GAS มองทุกไฟล์เป็น HTML)
- ห้ามใส่ `<script>` หรือ `<style>` ซ้ำซ้อนในไฟล์ Include  
  (เนื้อหาจะถูก inject เข้าไปในตำแหน่งที่เรียกใช้โดยตรง)
- ใช้ `<?!= ... ?>` (unescaped) สำหรับ HTML/CSS/JS  
  ใช้ `<?= ... ?>` (escaped) สำหรับข้อความธรรมดา

### สำหรับการ Preview บนคอมพิวเตอร์ (Standalone)
ในโหมด Preview คอมพิวเตอร์ เราใช้วิธี Fallback:
- **CSS**: `<link rel="stylesheet" href="style.html">`  
- **JS**: `<script src="javascript.html"></script>`

เมื่อ Deploy ขึ้น GAS จริง ให้เปลี่ยนกลับเป็น `<?!= include('style'); ?>` และ `<?!= include('javascript'); ?>`

> 💡 **Tip**: ใน Index.html มี Comment บอกตำแหน่งที่ต้องเปลี่ยนไว้ชัดเจนแล้ว

---

## 🚀 ขั้นตอนการ Deploy เป็น Web App

### Step 1: สร้าง Google Apps Script Project

1. ไปที่ [script.google.com](https://script.google.com)
2. คลิก **"New Project"** (โปรเจกต์ใหม่)
3. จะได้โปรเจกต์เปล่าที่มีไฟล์ `Code.gs` และ `My Function`

### Step 2: อัปโหลดไฟล์ทั้งหมด

1. ลบโค้ดใน `Code.gs` เดิมออกทั้งหมด → วางโค้ดจากไฟล์ `Code.gs` ในโปรเจกต์
2. สร้างไฟล์ใหม่:
   - ไปที่ **File > New > HTML file**
   - สร้างไฟล์ `Index.html` → วางโค้ดจากไฟล์ `Index.html`
   - **⚠️ สำคัญ**: แก้ไขบรรทัด Include ใน `Index.html`:
     - เปลี่ยน `<link rel="stylesheet" href="style.html">` เป็น `<?!= include('style'); ?>`
     - เปลี่ยน `<script src="javascript.html"></script>` เป็น `<?!= include('javascript'); ?>`
   - สร้างไฟล์ `style.html` → วางโค้ดจากไฟล์ `style.html`
   - **⚠️ สำคัญ**: ลบแท็ก `<style>` และ `</style>` ที่ครอบเนื้อหาทั้งหมดออก (GAS Inject เนื้อหาเข้าไปใน `<style>` ที่มีอยู่แล้ว)
   - สร้างไฟล์ `javascript.html` → วางโค้ดจากไฟล์ `javascript.html`
   - **⚠️ สำคัญ**: ลบแท็ก `<script>` และ `</script>` ที่ครอบเนื้อหาทั้งหมดออก
3. ตั้งค่า Manifest:
   - ไปที่ **Project Settings > Show "appsscript.json" manifest**
   - วางเนื้อหาจากไฟล์ `appsscript.json`

### Step 3: ตั้งค่า FOLDER_ID

1. เปิด Google Drive สร้างโฟลเดอร์สำหรับเก็บไฟล์ข้อมูล
2. เข้าไปในโฟลเดอร์ → ดู URL บน Browser:
   ```
   https://drive.google.com/drive/folders/XXXXXXXXXXXXXXXXXXXXXXXXXX
   ```
3. คัดลอกส่วน `XXXXXXXXXXXXXXXXXXXXXXXXXX` → นี่คือ **Folder ID**
4. ในไฟล์ `Code.gs` แก้ไขบรรทัด:
   ```javascript
   var FOLDER_ID = "YOUR_FOLDER_ID_HERE";  // ← เปลี่ยนเป็น Folder ID จริง
   ```

### Step 4: Deploy เป็น Web App

1. คลิก **Deploy > New Deployment**
2. เลือกประเภท: **Web App**
3. ตั้งค่า:
   - **Description**: `Office Supplies Dashboard v1.0`
   - **Execute as**: `User deploying the web app` (USER_DEPLOYING)
   - **Who has access**: `Anyone` (ตามที่ตั้งใน appsscript.json)
4. คลิก **Deploy**
5. Authorize permissions (OAuth Scopes)
6. คัดลอก **Web App URL** ที่ได้ → เปิดใช้งานได้ทันที

### Step 5: ทดสอบ

1. เปิด Web App URL ที่ได้ใน Browser
2. ระบบจะโหลดรายชื่อไฟล์จากโฟลเดอร์ที่ตั้งค่า FOLDER_ID
3. เลือกไฟล์ข้อมูล → Dashboard จะแสดงผลทันที

---

## 📋 รูปแบบการจัดโครงสร้างคอลัมน์ในไฟล์ Excel / Google Sheets

ระบบรองรับ **Dynamic Column Mapping** — หมายความว่าคอลัมน์ไม่จำเป็นต้องเรียงตามลำดับตายตัว  
เพราะระบบจะค้นหาคอลัมน์จากชื่อ Header โดยอัตโนมัติ

### คอลัมน์ที่แนะนำ (Suggested Columns)

| ลำดับ | ชื่อคอลัมน์ (แนะนำ) | ชื่ออื่นที่ใช้แทนกันได้ | ชนิดข้อมูล | ตัวอย่าง |
|:---:|------|------|:---:|---|
| A | **วันที่** | date, วัน, เดือน, year | Date / Text | `2025-07-15` |
| B | **รายการ** | item, สินค้า, product, name, ชื่อ | Text | `กระดาษ A4 80g` |
| C | **หมวดหมู่** | category, ประเภท, type, group | Text | `กระดาษ` |
| D | **แผนก** | department, dept, ฝ่าย, division, ผู้เบิก | Text | `ฝ่ายไอที` |
| E | **จำนวน** | quantity, qty, amount, count | Number | `10` |
| F | **ราคาต่อหน่วย** | unit price, unitprice, ราคา/หน่วย | Number | `120.00` |
| G | **ราคารวม** | total price, total, sum, รวม, มูลค่า | Number | `1200.00` |

### ตัวอย่างข้อมูล (Sample Data)

| วันที่ | รายการ | หมวดหมู่ | แผนก | จำนวน | ราคาต่อหน่วย | ราคารวม |
|------|------|------|------|:---:|:---:|:---:|
| 2025-01-15 | กระดาษ A4 80g | กระดาษ | ฝ่ายไอที | 10 | 120.00 | 1200.00 |
| 2025-01-16 | ปากกาลูกลื่น | เครื่องเขียน | ฝ่ายบุคคล | 50 | 15.00 | 750.00 |
| 2025-01-17 | หมึก HP LaserJet | หมึกพิมพ์ | ฝ่ายบัญชี | 3 | 2500.00 | 7500.00 |
| 2025-02-01 | เก้าอี้สำนักงาน | เฟอร์นิเจอร์ | ฝ่ายธุรการ | 2 | 4500.00 | 9000.00 |
| 2025-02-10 | Microsoft 365 | ซอฟต์แวร์/ไลเซนส์ | ฝ่ายไอที | 5 | 1800.00 | 9000.00 |

### ข้อกำหนดและข้อควรระวัง

1. ✅ **Header ต้องอยู่แถวแรก** — ระบบอ่านแถวที่ 1 เป็นชื่อคอลัมน์
2. ✅ **ข้อมูลเริ่มที่แถวที่ 2** — แถวถัดจาก Header เป็นข้อมูลทั้งหมด
3. ✅ **รองรับทั้งภาษาไทยและอังกฤษ** — ระบบค้นหาคำสำคัญหลายภาษา (ดูตารางด้านบน)
4. ✅ **คอลัมน์ที่จำเป็นขั้นต่ำ**:
   - `รายการ` (item) — ชื่อสิ่งของที่เบิก
   - `จำนวน` (quantity) หรือ `ราคารวม` (totalPrice) — ต้องมีอย่างน้อย 1 คอลัมน์
5. ⚠️ **แถวว่างจะถูกข้ามอัตโนมัติ**
6. ⚠️ **ถ้าไม่มีคอลัมน์วันที่** — ช่องวันที่ในตารางจะแสดงเป็นค่าว่าง
7. ⚠️ **ถ้าไม่มีคอลัมน์หมวดหมู่/แผนก** — จะแสดงเป็น "ไม่ระบุ"
8. 💡 **ถ้ามีทั้ง จำนวน และ ราคาต่อหน่วย แต่ไม่มี ราคารวม** — ระบบจะคำนวณ `ราคารวม = จำนวน × ราคาต่อหน่วย` ให้อัตโนมัติ

### ไฟล์ที่รองรับ

- 📗 **Google Sheets** (Native — ประสิทธิภาพดีที่สุด)
- 📄 **Microsoft Excel** (.xlsx, .xls)
- 📃 **CSV** (Comma-Separated Values)

> 📌 **Tip**: แนะนำให้ใช้ Google Sheets เพราะทำงานร่วมกับ GAS ได้ดีที่สุด และรองรับการอัปเดตข้อมูลแบบ Real-time

---

## 🎨 ฟีเจอร์เด่น

| ฟีเจอร์ | รายละเอียด |
|------|------|
| 📊 **Scorecards (KPI)** | มูลค่ารวม, จำนวนรายการ, สินค้าเบิกสูงสุด, จำนวนหมวดหมู่ |
| 📈 **Bar Chart** | ยอดเบิกตามแผนก (Top 10) — แสดงด้วย Chart.js แบบ Gradient |
| 🍩 **Doughnut Chart** | สัดส่วนตามหมวดหมู่ — แสดงเปอร์เซ็นต์ + มูลค่า |
| 🔍 **Real-time Search** | ค้นหาข้อมูลในตารางแบบทันที (Filter ทุกคอลัมน์) |
| 🔄 **Auto Refresh** | ปุ่มรีเฟรช + เคลียร์ Cache อัตโนมัติ |
| 🎯 **Dynamic Mapping** | จับคู่คอลัมน์อัตโนมัติ ไม่ต้องเรียงลำดับตายตัว |
| 💾 **CacheService** | ลดการเรียกข้อมูลซ้ำ (Cache 5 นาที) |
| 📱 **Responsive** | รองรับทั้ง Desktop, Tablet, Mobile |
| 🧪 **Mock Data** | เปิด Preview บนคอมพิวเตอร์ได้โดยไม่ต้องเชื่อมต่อ GAS |
| 🌐 **Thai Locale** | รองรับรูปแบบวันที่/สกุลเงินไทย (THB) |

---

## 🛠️ Technology Stack

| Layer | Technology |
|------|------|
| **Backend** | Google Apps Script (V8 Runtime) |
| **Frontend** | HTML5, CSS3, Vanilla JavaScript (ES6+) |
| **CSS Framework** | Tailwind CSS (CDN) + Custom CSS Variables |
| **Charts** | Chart.js v4.4.7 |
| **Fonts** | Google Fonts - Sarabun (Thai + Latin) |
| **Data Source** | Google Sheets / Excel / CSV via Google Drive API |
| **Caching** | GAS CacheService (Server-side) |

---

## ⚙️ การตั้งค่าเพิ่มเติม

### เปลี่ยน Cache Duration
ใน `Code.gs`:
```javascript
var CACHE_DURATION_SECONDS = 300; // 5 นาที (เปลี่ยนเป็นค่าที่ต้องการ)
```

### เพิ่ม/ลดจำนวน Mock Data
ใน `javascript.html` แก้ไข loop:
```javascript
for (var i = 0; i < 180; i++) { ... } // เปลี่ยนจำนวน Row ตามต้องการ
```

---

## 📝 License

MIT License — ใช้ได้อิสระทั้งส่วนบุคคลและเชิงพาณิชย์

---

## 👨‍💻 ผู้พัฒนา

พัฒนาโดยใช้ Google Apps Script Best Practices สำหรับองค์กรที่ต้องการระบบ Dashboard แบบ Self-service บน Google Workspace

---

> 🔗 **Tips**: หากต้องการปรับแต่งเพิ่มเติม เช่น เพิ่ม Chart ใหม่, เปลี่ยนสี Theme, เพิ่ม KPI อื่นๆ  
> สามารถแก้ไขได้ที่ไฟล์ `javascript.html` (Logic) และ `style.html` (CSS Variables) ได้โดยตรง