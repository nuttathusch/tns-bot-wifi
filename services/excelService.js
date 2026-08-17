const ExcelJS = require('exceljs');

/**
 * Service to generate formatted Excel reports (.xlsx)
 */
class ExcelService {
  /**
   * Create an Excel workbook from parsed report data
   * @param {Object} reportData 
   * @returns {Promise<Buffer>}
   */
  static async generateExcel(reportData) {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'TNS Network - BOT Wi-Fi System';
    workbook.created = new Date();

    const { metadata, summary, vouchers, dailyTimeline, apBreakdown, clientList } = reportData;

    // --- Sheet 1: สรุปภาพรวมประจำเดือน ---
    const sheetSummary = workbook.addWorksheet('สรุปภาพรวม');
    sheetSummary.views = [{ showGridLines: true }];

    // Header styling
    sheetSummary.mergeCells('A1:E2');
    const titleCell = sheetSummary.getCell('A1');
    titleCell.value = `รายงานสรุปการใช้งาน Wi-Fi ประจำเดือน (${metadata.thaiMonthYear})\nธนาคารแห่งประเทศไทย (Bank of Thailand)`;
    titleCell.font = { name: 'Segoe UI', size: 14, bold: true, color: { argb: 'FFFFFFFF' } };
    titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1A365D' } }; // Navy Blue
    titleCell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };

    sheetSummary.addRow([]);

    // KPI Cards Table
    sheetSummary.addRow(['ตัวชี้วัดสำคัญ (Monthly KPI Metrics)', '', '', '', '']);
    sheetSummary.mergeCells('A4:E4');
    sheetSummary.getCell('A4').font = { bold: true, size: 11, color: { argb: 'FF1A365D' } };

    const kpiRows = [
      ['ปริมาณการใช้งานข้อมูลรวม (Total Data Usage)', `${summary.totalGB} GB`],
      ['ปริมาณการดาวน์โหลด (Download Usage)', `${summary.downloadGB} GB`],
      ['ปริมาณการอัปโหลด (Upload Usage)', `${summary.uploadGB} GB`],
      ['จำนวนผู้ใช้งาน/อุปกรณ์ทั้งหมด (Total Users/Devices)', `${summary.uniqueUsers} คน`],
      ['จำนวน Voucher ที่เปิดใช้งาน (Active Vouchers)', `${summary.totalVouchers} รหัส`],
      ['จำนวนวันที่เข้าใช้งานรวม (Active Days Count)', `${summary.activeDaysCount} วัน`],
      ['วันที่การใช้งานสูงสุด (Peak Traffic Day)', `${summary.peakDay.date} (${summary.peakDay.totalGB} GB)`]
    ];

    kpiRows.forEach(kRow => {
      const row = sheetSummary.addRow([kRow[0], kRow[1]]);
      row.getCell(1).font = { bold: true };
      row.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF7FAFC' } };
      row.getCell(2).font = { bold: true, color: { argb: 'FF2B6CB0' } };
    });

    sheetSummary.addRow([]);

    // AP Breakdown Table
    sheetSummary.addRow(['สรุปแยกตามอุปกรณ์ Access Point (AP Breakdown)', '', '']);
    sheetSummary.mergeCells('A14:C14');
    sheetSummary.getCell('A14').font = { bold: true, size: 11, color: { argb: 'FF1A365D' } };

    const apHeaderRow = sheetSummary.addRow(['ชื่ออุปกรณ์ AP (Location)', 'การใช้งานรวม (GB)', 'จำนวนผู้เข้าใช้ (คน)']);
    apHeaderRow.eachCell(cell => {
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2D3748' } };
      cell.alignment = { horizontal: 'center' };
    });

    apBreakdown.forEach(ap => {
      sheetSummary.addRow([ap.apName, ap.totalGB, ap.clientCount]);
    });

    sheetSummary.getColumn(1).width = 45;
    sheetSummary.getColumn(2).width = 25;
    sheetSummary.getColumn(3).width = 25;


    // --- Sheet 2: รายละเอียดตาม Voucher ---
    const sheetVoucher = workbook.addWorksheet('สรุปราย Voucher');
    sheetVoucher.views = [{ showGridLines: true }];

    const vHeaderRow = sheetVoucher.addRow([
      'รหัส Voucher', 'จำนวนผู้ใช้ (คน)', 'การใช้งานรวม (GB)',
      'Download (GB)', 'Upload (GB)', 'จำนวนวันที่เปิดใช้ (วัน)', 'วันที่เข้าใช้งาน'
    ]);
    vHeaderRow.eachCell(cell => {
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1A365D' } };
      cell.alignment = { horizontal: 'center' };
    });

    vouchers.forEach(v => {
      const displayCode = String(v.voucherCode).padStart(8, '0');
      const row = sheetVoucher.addRow([
        displayCode,
        v.userCount,
        v.totalGB,
        v.downloadGB,
        v.uploadGB,
        v.activeDaysCount,
        v.activeDays.join(', ')
      ]);
      row.getCell(1).numFmt = '@'; // Force text format for leading zero!
    });

    sheetVoucher.getColumn(1).width = 20;
    sheetVoucher.getColumn(2).width = 18;
    sheetVoucher.getColumn(3).width = 20;
    sheetVoucher.getColumn(4).width = 16;
    sheetVoucher.getColumn(5).width = 16;
    sheetVoucher.getColumn(6).width = 22;
    sheetVoucher.getColumn(7).width = 40;


    // --- Sheet 3: สรุปการใช้งานรายวัน ---
    const sheetDaily = workbook.addWorksheet('สรุปรายวัน');
    sheetDaily.views = [{ showGridLines: true }];

    const dHeaderRow = sheetDaily.addRow(['วันที่ (Date)', 'ปริมาณการใช้งานรวม (GB)', 'จำนวนผู้เข้าใช้งาน (คน)']);
    dHeaderRow.eachCell(cell => {
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2B6CB0' } };
      cell.alignment = { horizontal: 'center' };
    });

    dailyTimeline.forEach(d => {
      sheetDaily.addRow([d.date, d.totalGB, d.userCount]);
    });

    sheetDaily.getColumn(1).width = 20;
    sheetDaily.getColumn(2).width = 25;
    sheetDaily.getColumn(3).width = 22;


    // --- Sheet 4: รายชื่อผู้ใช้งาน (Client Logs) ---
    const sheetClient = workbook.addWorksheet('รายชื่อผู้ใช้งาน');
    sheetClient.views = [{ showGridLines: true }];

    const cHeaderRow = sheetClient.addRow([
      'ชื่ออุปกรณ์/ผู้ใช้', 'MAC Address', 'IP Address', 'Voucher Code',
      'SSID', 'AP Location', 'Download (GB)', 'Upload (GB)', 'Total (GB)', 'เข้าใช้ครั้งแรก', 'เข้าดูล่าสุด'
    ]);
    cHeaderRow.eachCell(cell => {
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4A5568' } };
      cell.alignment = { horizontal: 'center' };
    });

    clientList.forEach(c => {
      sheetClient.addRow([
        c.clientName, c.mac, c.ip, c.voucherCode,
        c.ssid, c.apName, c.downloadGB, c.uploadGB, c.totalGB,
        c.firstConnected, c.lastSeen
      ]);
    });

    sheetClient.getColumn(1).width = 22;
    sheetClient.getColumn(2).width = 20;
    sheetClient.getColumn(3).width = 16;
    sheetClient.getColumn(4).width = 18;
    sheetClient.getColumn(5).width = 18;
    sheetClient.getColumn(6).width = 22;
    sheetClient.getColumn(7).width = 15;
    sheetClient.getColumn(8).width = 15;
    sheetClient.getColumn(9).width = 15;
    sheetClient.getColumn(10).width = 22;
    sheetClient.getColumn(11).width = 22;

    const buffer = await workbook.xlsx.writeBuffer();
    return buffer;
  }
}

module.exports = ExcelService;
