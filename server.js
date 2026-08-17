const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const ParserService = require('./services/parserService');
const ExcelService = require('./services/excelService');
const PDFService = require('./services/pdfService');

const app = express();
const PORT = process.env.PORT || 3000;

// Setup upload storage in memory
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 } // 50MB max file size
});

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// Store latest parsed report in memory cache for quick export
let cachedLatestReport = null;

// History storage directory
const HISTORY_DIR = path.join(__dirname, 'data', 'reports_history');
if (!fs.existsSync(HISTORY_DIR)) {
  fs.mkdirSync(HISTORY_DIR, { recursive: true });
}

/**
 * Endpoint: Upload Zyxel Nebula CSV/Excel Log
 */
app.post('/api/upload', upload.single('logfile'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'กรุณาเลือกไฟล์ CSV หรือ Excel สำหรับอัปโหลด' });
    }

    const reportData = ParserService.parseFile(req.file.buffer, req.file.originalname);
    cachedLatestReport = reportData;

    // Save report to history
    const reportId = `report_${Date.now()}`;
    const historyPath = path.join(HISTORY_DIR, `${reportId}.json`);
    fs.writeFileSync(historyPath, JSON.stringify({
      id: reportId,
      fileName: req.file.originalname,
      createdAt: new Date().toISOString(),
      reportData
    }, null, 2));

    return res.json({
      success: true,
      message: 'ประมวลผลไฟล์สำเร็จ',
      reportId,
      report: reportData
    });
  } catch (err) {
    console.error('Upload Error:', err);
    return res.status(500).json({ error: err.message || 'เกิดข้อผิดพลาดในการประมวลผลไฟล์' });
  }
});

/**
 * Endpoint: Load Sample Nebula Data
 */
app.get('/api/sample', (req, res) => {
  try {
    const samplePath = path.join(__dirname, 'data', 'sample-nebula-logs', 'sample_nebula_export.csv');
    if (!fs.existsSync(samplePath)) {
      return res.status(404).json({ error: 'ไม่พบไฟล์ข้อมูลตัวอย่าง' });
    }

    const buffer = fs.readFileSync(samplePath);
    const reportData = ParserService.parseFile(buffer, 'sample_nebula_export.csv');
    cachedLatestReport = reportData;

    return res.json({
      success: true,
      message: 'โหลดข้อมูลตัวอย่างสำเร็จ',
      report: reportData
    });
  } catch (err) {
    console.error('Sample Error:', err);
    return res.status(500).json({ error: 'ไม่สามารถประมวลผลข้อมูลตัวอย่างได้' });
  }
});

/**
 * Endpoint: Export PDF Monthly Report
 */
app.post('/api/export/pdf', async (req, res) => {
  try {
    const reportData = req.body.report || cachedLatestReport;
    if (!reportData) {
      return res.status(400).json({ error: 'ไม่พบข้อมูลรายงานสำหรับสร้าง PDF' });
    }

    const pdfBuffer = await PDFService.generatePDF(reportData);
    const fileName = `BOT_WiFi_Monthly_Report_${reportData.metadata.detectedMonth || 'Summary'}.pdf`;

    res.status(200);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Length', pdfBuffer.length);
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    return res.end(pdfBuffer, 'binary');
  } catch (err) {
    console.error('PDF Export Error:', err);
    return res.status(500).json({ error: err.message || 'ไม่สามารถสร้างไฟล์ PDF ได้' });
  }
});

/**
 * Endpoint: Export Excel (.xlsx) Monthly Report
 */
app.post('/api/export/excel', async (req, res) => {
  try {
    const reportData = req.body.report || cachedLatestReport;
    if (!reportData) {
      return res.status(400).json({ error: 'ไม่พบข้อมูลรายงานสำหรับสร้าง Excel' });
    }

    const excelBuffer = await ExcelService.generateExcel(reportData);
    const fileName = `BOT_WiFi_Monthly_Report_${reportData.metadata.detectedMonth || 'Summary'}.xlsx`;

    res.status(200);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Length', excelBuffer.length);
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    return res.end(excelBuffer, 'binary');
  } catch (err) {
    console.error('Excel Export Error:', err);
    return res.status(500).json({ error: err.message || 'ไม่สามารถสร้างไฟล์ Excel ได้' });
  }
});

/**
 * Endpoint: Test Zyxel Nebula API Token
 */
app.post('/api/nebula/test-token', async (req, res) => {
  const { token } = req.body;
  if (!token) {
    return res.status(400).json({ success: false, message: 'Missing token' });
  }

  const https = require('https');

  const testReq = https.request({
    hostname: 'api.nebula.zyxel.com',
    path: `/v1/nebula/organizations`,
    method: 'GET',
    headers: {
      'X-ZyxelNebula-API-Key': token,
      'Accept': 'application/json'
    }
  }, (apiRes) => {
    let body = '';
    apiRes.on('data', chunk => body += chunk);
    apiRes.on('end', () => {
      if (apiRes.statusCode === 200) {
        try {
          const orgs = JSON.parse(body);
          const orgName = orgs.length > 0 ? orgs[0].name : 'TNS NETWORK';
          return res.json({
            success: true,
            message: 'Connected Successfully',
            orgName,
            orgs
          });
        } catch (e) {
          return res.json({ success: true, message: 'Connected', orgName: 'TNS NETWORK' });
        }
      } else {
        return res.status(apiRes.statusCode).json({
          success: false,
          statusCode: apiRes.statusCode,
          message: `Header X-ZyxelNebula-API-Key ได้รับแล้ว แต่ Nebula ส่งคืน HTTP ${apiRes.statusCode} (${body || 'Unauthorized'})`
        });
      }
    });
  });

  testReq.on('error', (err) => {
    return res.status(500).json({ success: false, message: err.message });
  });

  testReq.end();
});

/**
 * Endpoint: Generate Monthly Report via Zyxel Nebula OpenAPI
 */
const NebulaApiService = require('./services/nebulaApiService');

app.post('/api/nebula/generate-report', async (req, res) => {
  try {
    const { token, selectedMonth } = req.body;
    const apiToken = token || 'AULtShTXkkke41C2FX';

    const reportData = await NebulaApiService.generateReportFromApi(apiToken, selectedMonth || '2026-08');
    cachedLatestReport = reportData;

    return res.json({
      success: true,
      message: 'ดึงข้อมูลและสร้างรายงานผ่าน Zyxel Nebula OpenAPI สำเร็จ',
      report: reportData
    });
  } catch (err) {
    console.error('Nebula API Report Error:', err);
    return res.status(500).json({ error: err.message || 'เกิดข้อผิดพลาดในการดึงข้อมูลจาก Zyxel Nebula API' });
  }
});

/**
 * Endpoint: Get History List
 */
app.get('/api/history', (req, res) => {
  try {
    const files = fs.readdirSync(HISTORY_DIR).filter(f => f.endsWith('.json'));
    const historyList = files.map(file => {
      const content = JSON.parse(fs.readFileSync(path.join(HISTORY_DIR, file)));
      return {
        id: content.id,
        fileName: content.fileName,
        createdAt: content.createdAt,
        thaiMonthYear: content.reportData.metadata.thaiMonthYear,
        totalGB: content.reportData.summary.totalGB,
        uniqueUsers: content.reportData.summary.uniqueUsers
      };
    }).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    return res.json({ success: true, history: historyList });
  } catch (err) {
    return res.status(500).json({ error: 'ไม่สามารถดึงประวัติรายงานได้' });
  }
});

// Start Server
app.listen(PORT, () => {
  console.log(`====================================================`);
  console.log(`🚀 BOT Wi-Fi Monthly Report Dashboard is Running!`);
  console.log(`🌐 Access UI at: http://localhost:${PORT}`);
  console.log(`====================================================`);
});
