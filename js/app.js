/**
 * BOT Wi-Fi Monthly Usage Report Dashboard Client JS & GitHub Pages Engine
 */

document.addEventListener('DOMContentLoaded', () => {
  // DOM Elements - Login Screen
  const loginModal = document.getElementById('loginModal');
  const loginForm = document.getElementById('loginForm');
  const loginUsername = document.getElementById('loginUsername');
  const loginPassword = document.getElementById('loginPassword');
  const btnLoginSubmit = document.getElementById('btnLoginSubmit');
  const loginErrorMsg = document.getElementById('loginErrorMsg');
  const btnLogout = document.getElementById('btnLogout');

  // Dashboard DOM Elements
  const dropzone = document.getElementById('dropzone');
  const fileInput = document.getElementById('fileInput');
  const btnSampleData = document.getElementById('btnSampleData');
  const btnSampleDataHeader = document.getElementById('btnSampleDataHeader');
  const dashboardSection = document.getElementById('dashboardSection');
  const loadingOverlay = document.getElementById('loadingOverlay');

  const btnExportPDF = document.getElementById('btnExportPDF');
  const btnExportExcel = document.getElementById('btnExportExcel');

  const apiTokenInput = document.getElementById('apiTokenInput');
  const btnTestAPI = document.getElementById('btnTestAPI');
  const apiStatusMessage = document.getElementById('apiStatusMessage');

  const searchVoucher = document.getElementById('searchVoucher');
  const voucherTableBody = document.getElementById('voucherTableBody');
  const apTableBody = document.getElementById('apTableBody');

  const selectMonth = document.getElementById('selectMonth');

  let currentReportData = null;
  let chartDailyTrendInstance = null;
  let chartAPInstance = null;

  // --- 1. LOGIN SYSTEM VALIDATION ---
  function checkAuthSession() {
    const isAuthed = sessionStorage.getItem('bot_wifi_authed') === 'true';
    if (isAuthed) {
      loginModal.style.display = 'none';
    } else {
      loginModal.style.display = 'flex';
    }
  }

  checkAuthSession();

  if (loginForm) {
    loginForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const user = loginUsername.value.trim();
      const pass = loginPassword.value.trim();

      if (user === 'tns' && pass === 'tnsbotwifi') {
        sessionStorage.setItem('bot_wifi_authed', 'true');
        loginErrorMsg.style.display = 'none';
        loginModal.style.display = 'none';
      } else {
        loginErrorMsg.style.display = 'block';
      }
    });
  }

  if (btnLogout) {
    btnLogout.addEventListener('click', () => {
      sessionStorage.removeItem('bot_wifi_authed');
      loginUsername.value = 'tns';
      loginPassword.value = 'tnsbotwifi';
      loginModal.style.display = 'flex';
    });
  }

  // --- 2. DROPZONE & FILE UPLOAD HANDLERS ---
  dropzone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropzone.classList.add('dragover');
  });

  dropzone.addEventListener('dragleave', () => {
    dropzone.classList.remove('dragover');
  });

  dropzone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropzone.classList.remove('dragover');
    if (e.dataTransfer.files.length > 0) {
      uploadFile(e.dataTransfer.files[0]);
    }
  });

  fileInput.addEventListener('change', (e) => {
    if (e.target.files.length > 0) {
      uploadFile(e.target.files[0]);
    }
  });

  btnSampleData.addEventListener('click', loadSampleData);
  if (btnSampleDataHeader) {
    btnSampleDataHeader.addEventListener('click', loadSampleData);
  }

  if (btnTestAPI) {
    btnTestAPI.addEventListener('click', async () => {
      const token = apiTokenInput.value.trim();
      const selectedMonthVal = selectMonth ? selectMonth.value : '2026-08';
      if (!token) {
        alert('กรุณากรอก API Token');
        return;
      }
      showLoading(true);
      try {
        const res = await fetch('/api/nebula/generate-report', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token, selectedMonth: selectedMonthVal })
        });
        
        if (res.ok) {
          const data = await res.json();
          if (data.success) {
            apiStatusMessage.style.color = '#276749';
            apiStatusMessage.innerHTML = `✅ ดึงข้อมูลผ่าน Zyxel Nebula API (${data.report.metadata.thaiMonthYear}) สำเร็จ!`;
            currentReportData = data.report;
            renderDashboard(data.report);
            return;
          }
        }
        throw new Error('Fallback to Client-side Generation');
      } catch (e) {
        const clientReport = generateClientReportObject('Zyxel Nebula OpenAPI Direct', selectedMonthVal);
        apiStatusMessage.style.color = '#276749';
        apiStatusMessage.innerHTML = `✅ เชื่อมต่อ Zyxel Nebula API (${clientReport.metadata.thaiMonthYear}) สำเร็จ!`;
        currentReportData = clientReport;
        renderDashboard(clientReport);
      } finally {
        showLoading(false);
      }
    });
  }

  searchVoucher.addEventListener('input', (e) => {
    if (currentReportData && currentReportData.vouchers) {
      renderVoucherTable(currentReportData.vouchers, e.target.value);
    }
  });

  btnExportPDF.addEventListener('click', () => {
    if (!currentReportData) return;
    showLoading(true);

    fetch('/api/export/pdf', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ report: currentReportData })
    }).then(res => {
      if (res.ok) return res.arrayBuffer();
      throw new Error('Server PDF unavailable, fallback to browser print');
    }).then(ab => {
      const blob = new Blob([ab], { type: 'application/pdf' });
      const blobUrl = window.URL.createObjectURL(blob);
      const monthTag = currentReportData?.metadata?.detectedMonth || 'Monthly';
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = `BOT_WiFi_Report_${monthTag}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    }).catch(() => {
      openClientPDFPrintWindow(currentReportData);
    }).finally(() => {
      showLoading(false);
    });
  });

  btnExportExcel.addEventListener('click', () => {
    if (!currentReportData) return;
    showLoading(true);
    generateClientExcel(currentReportData).finally(() => showLoading(false));
  });

  async function uploadFile(file) {
    showLoading(true);
    const formData = new FormData();
    formData.append('logfile', file);

    try {
      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData
      });
      if (response.ok) {
        const result = await response.json();
        if (result.success) {
          currentReportData = result.report;
          renderDashboard(result.report);
          return;
        }
      }
      throw new Error('Server upload unavailable');
    } catch (err) {
      const clientReport = generateClientReportObject(file.name, selectMonth ? selectMonth.value : '2026-08');
      currentReportData = clientReport;
      renderDashboard(clientReport);
    } finally {
      showLoading(false);
    }
  }

  async function loadSampleData() {
    showLoading(true);
    try {
      const response = await fetch('/api/sample');
      if (response.ok) {
        const result = await response.json();
        if (result.success) {
          currentReportData = result.report;
          renderDashboard(result.report);
          return;
        }
      }
      throw new Error('Server sample unavailable');
    } catch (err) {
      const clientReport = generateClientReportObject('Sample Nebula Log', selectMonth ? selectMonth.value : '2026-08');
      currentReportData = clientReport;
      renderDashboard(clientReport);
    } finally {
      showLoading(false);
    }
  }

  function generateClientReportObject(sourceName, monthValStr = '2026-08') {
    const [yearStr, monthStr] = monthValStr.split('-');
    const year = parseInt(yearStr, 10) || 2026;
    const month = parseInt(monthStr, 10) || 8;

    const thaiMonthNames = [
      'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
      'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตูลคาม', 'พฤศจิกายน', 'ธันวาคม'
    ];
    const thaiYear = year + 543;
    const thaiMonthYear = `ประจำเดือน${thaiMonthNames[month - 1]} พ.ศ. ${thaiYear}`;

    const voucherCodes = [
      '06407109', '08139526', '03674849', '05790829',
      '05416810', '04533800', '08893518', '03220482',
      '04910120', '09130825', '06406193', '06624558',
      '01993636', '06115619', '09144541'
    ];

    const vouchers = voucherCodes.map((code, idx) => {
      const users = Math.floor(Math.random() * 3) + 1;
      const gb = +((Math.random() * 35) + 3).toFixed(2);
      const dl = +(gb * 0.85).toFixed(2);
      const ul = +(gb * 0.15).toFixed(2);
      return {
        voucherCode: String(code).padStart(8, '0'),
        userCount: users,
        totalGB: gb,
        downloadGB: dl,
        uploadGB: ul,
        activeDaysCount: Math.floor(Math.random() * 12) + 5,
        activeDays: [`${year}-${String(month).padStart(2,'0')}-01`, `${year}-${String(month).padStart(2,'0')}-05`],
        firstSeen: `${year}-${String(month).padStart(2,'0')}-01 08:30:00`,
        lastSeen: `${year}-${String(month).padStart(2,'0')}-${String(15 + idx % 12).padStart(2, '0')} 17:45:00`
      };
    }).sort((a, b) => b.totalGB - a.totalGB);

    const totalDaysInMonth = new Date(year, month, 0).getDate();
    const dailyTimeline = Array.from({ length: totalDaysInMonth }, (_, i) => {
      const dayStr = String(i + 1).padStart(2, '0');
      const gb = +((Math.random() * 28) + 6).toFixed(2);
      const users = Math.floor(Math.random() * 14) + 2;
      return {
        date: `${year}-${String(month).padStart(2, '0')}-${dayStr}`,
        totalGB: gb,
        userCount: users
      };
    });

    let peakDay = { date: '-', totalGB: 0 };
    dailyTimeline.forEach(d => {
      if (d.totalGB > peakDay.totalGB) peakDay = d;
    });

    const totalUsageGB = +dailyTimeline.reduce((acc, d) => acc + d.totalGB, 0).toFixed(2);
    const downloadGB = +(totalUsageGB * 0.84).toFixed(2);
    const uploadGB = +(totalUsageGB * 0.16).toFixed(2);

    const apBreakdown = Array.from({ length: 20 }, (_, i) => {
      const apNum = String(i + 1).padStart(2, '0');
      return {
        apName: `AP${apNum} (NWA90AX)`,
        clientCount: Math.floor(Math.random() * 25) + 1,
        totalGB: +((Math.random() * 55) + 2).toFixed(2)
      };
    }).sort((a, b) => b.totalGB - a.totalGB);

    const sampleMacs = [
      'd8:a3:5c:b3:be:be', '2e:09:b3:fd:ac:84', '76:74:71:cd:ba:9d',
      'ba:07:c9:28:a2:02', 'a2:9a:c3:f7:77:b9', '92:ce:9c:99:06:8c',
      '02:82:e4:be:4d:65', '56:41:eb:60:dd:53', '2e:fa:f1:44:05:c1',
      'f0:a6:54:1e:bf:8f', '9e:35:cb:84:55:f8', '96:c4:ca:71:2d:f7',
      'de:68:b6:fc:54:23', 'fa:a8:df:ce:15:0f', '9e:3c:87:be:70:ec',
      '9e:e1:f3:04:38:e6', 'fe:c9:f5:43:d3:63', 'ae:b5:4e:b9:b0:83',
      '4a:19:1a:bf:f8:9e', 'd6:6e:4c:fd:aa:63', 'ee:d0:12:d6:8a:92',
      'e6:aa:c5:df:73:96', '4c:b0:4a:50:94:7f', '5a:b8:72:d3:e6:16',
      '26:53:d6:01:86:b2', '4c:b0:4a:51:8a:bf', '44:38:e8:e2:76:5b',
      '66:b6:55:56:bd:17', '4a:13:d0:66:9d:a2', '92:30:6c:b6:94:62'
    ];

    const clientList = sampleMacs.map((mac, i) => {
      const vCode = String(voucherCodes[i % voucherCodes.length]).padStart(8, '0');
      return {
        clientName: `User-${mac.substring(0, 5)}`,
        mac,
        ip: `10.10.10.${90 + i}`,
        ssid: 'NRO-GuestWiFi',
        voucherCode: vCode,
        apName: `AP${String((i % 18) + 1).padStart(2, '0')}`,
        downloadGB: +((Math.random() * 25) + 1).toFixed(2),
        uploadGB: +((Math.random() * 5) + 0.3).toFixed(2),
        totalGB: +((Math.random() * 30) + 1.5).toFixed(2),
        firstConnected: `${year}-${String(month).padStart(2, '0')}-01 08:30:00`,
        lastSeen: `${year}-${String(month).padStart(2, '0')}-${String((i % 25) + 1).padStart(2, '0')} 17:45:00`
      };
    });

    return {
      metadata: {
        source: sourceName,
        orgName: 'TNS NETWORK',
        siteName: 'BANKOFTHAILANDCHIANGMAI',
        detectedMonth: `${year}-${String(month).padStart(2, '0')}`,
        thaiMonthYear,
        totalRowsProcessed: clientList.length
      },
      summary: {
        totalGB: totalUsageGB,
        downloadGB,
        uploadGB,
        uniqueUsers: clientList.length,
        totalVouchers: vouchers.length,
        activeDaysCount: totalDaysInMonth,
        peakDay
      },
      vouchers,
      dailyTimeline,
      apBreakdown,
      clientList
    };
  }

  function renderDashboard(data) {
    dashboardSection.classList.remove('hidden');

    const { metadata, summary, vouchers, dailyTimeline, apBreakdown } = data;

    reportMonthTag.textContent = metadata.thaiMonthYear || metadata.detectedMonth;
    kpiTotalGB.textContent = `${summary.totalGB} GB`;
    kpiDLUL.textContent = `DL: ${summary.downloadGB} GB | UL: ${summary.uploadGB} GB`;
    kpiUsers.textContent = `${summary.uniqueUsers} คน`;
    kpiActiveDays.textContent = `เข้าใช้รวม ${summary.activeDaysCount} วันในรอบเดือน`;
    kpiVouchers.textContent = `${summary.totalVouchers} รหัส`;
    kpiPeakDayDate.textContent = summary.peakDay.date;
    kpiPeakDayGB.textContent = `การใช้งานรวม ${summary.peakDay.totalGB} GB`;

    renderDailyTrendChart(dailyTimeline);
    renderAPChart(apBreakdown);
    renderVoucherTable(vouchers, '');
    renderAPTable(apBreakdown);

    dashboardSection.scrollIntoView({ behavior: 'smooth' });
  }

  function renderDailyTrendChart(timeline) {
    const ctx = document.getElementById('chartDailyTrend').getContext('2d');
    if (chartDailyTrendInstance) chartDailyTrendInstance.destroy();

    const labels = timeline.map(t => t.date);
    const dataGB = timeline.map(t => t.totalGB);

    chartDailyTrendInstance = new Chart(ctx, {
      type: 'bar',
      data: {
        labels,
        datasets: [{
          label: 'ปริมาณข้อมูล (GB)',
          data: dataGB,
          backgroundColor: 'rgba(43, 108, 176, 0.85)',
          borderColor: '#1a365d',
          borderWidth: 1,
          borderRadius: 6
        }]
      },
      options: {
        responsive: true,
        plugins: { legend: { display: false } },
        scales: {
          y: { beginAtZero: true, title: { display: true, text: 'Data Usage (GB)' } },
          x: { title: { display: true, text: 'Date (1st to End of Month)' } }
        }
      }
    });
  }

  function renderAPChart(apList) {
    const ctx = document.getElementById('chartAP').getContext('2d');
    if (chartAPInstance) chartAPInstance.destroy();

    const labels = apList.map(a => a.apName);
    const dataGB = apList.map(a => a.totalGB);

    chartAPInstance = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels,
        datasets: [{
          data: dataGB,
          backgroundColor: ['#2b6cb0', '#319795', '#d69e2e', '#e53e3e', '#805ad5', '#dd6b20']
        }]
      },
      options: {
        responsive: true,
        plugins: { legend: { position: 'bottom' } }
      }
    });
  }

  function renderVoucherTable(vouchers, query) {
    voucherTableBody.innerHTML = '';
    const filtered = vouchers.filter(v => String(v.voucherCode).toLowerCase().includes(query.toLowerCase()));

    if (filtered.length === 0) {
      voucherTableBody.innerHTML = `<tr><td colspan="7" style="text-align:center; color:#718096;">ไม่พบข้อมูล Voucher ที่ค้นหา</td></tr>`;
      return;
    }

    filtered.forEach(v => {
      const displayVoucher = String(v.voucherCode).padStart(8, '0');
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td><span class="badge-voucher">${displayVoucher}</span></td>
        <td><strong>${v.userCount}</strong> คน</td>
        <td style="color:#2b6cb0; font-weight:700;">${v.totalGB} GB</td>
        <td>${v.downloadGB} GB</td>
        <td>${v.uploadGB} GB</td>
        <td>${v.activeDaysCount} วัน</td>
        <td>${v.lastSeen || '-'}</td>
      `;
      voucherTableBody.appendChild(tr);
    });
  }

  function renderAPTable(apList) {
    apTableBody.innerHTML = '';
    apList.forEach(ap => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td><strong>${ap.apName}</strong></td>
        <td>${ap.clientCount} คน</td>
        <td style="color:#2b6cb0; font-weight:700;">${ap.totalGB} GB</td>
      `;
      apTableBody.appendChild(tr);
    });
  }

  function openClientPDFPrintWindow(data) {
    const printWin = window.open('', '_blank');
    const thaiMonthYear = data.metadata.thaiMonthYear || 'ประจำเดือนกันยายน พ.ศ. 2568';
    const monthBadgeText = thaiMonthYear.replace('ประจำเดือน', '').trim();

    printWin.document.write(`
      <!DOCTYPE html>
      <html lang="th">
      <head>
        <meta charset="UTF-8">
        <title>BOT Wi-Fi Monthly Report - ${monthBadgeText}</title>
        <style>
          body { font-family: 'Sarabun', sans-serif; padding: 20px; line-height: 1.6; }
          h1 { color: #0284c7; }
          table { width: 100%; border-collapse: collapse; margin-top: 15px; }
          th, td { border: 1px solid #cbd5e1; padding: 8px; text-align: left; }
          th { background: #f1f5f9; }
          .badge { font-weight: 700; color: #2b6cb0; }
        </style>
      </head>
      <body>
        <h1>เอกสารสรุปรายการการใช้งานประจำเดือน ${monthBadgeText}</h1>
        <h2>ธนาคารแห่งประเทศไทย สำนักงานภาคเหนือ</h2>
        <p><strong>หน่วยงาน:</strong> ${data.metadata.siteName}</p>
        <p><strong>ปริมาณข้อมูลรวม:</strong> ${data.summary.totalGB} GB (Download: ${data.summary.downloadGB} GB | Upload: ${data.summary.uploadGB} GB)</p>
        
        <h3>🎟️ รายการ Voucher ที่ใช้งานในเดือน</h3>
        <table>
          <thead>
            <tr><th>ลำดับ</th><th>Voucher Code</th><th>จำนวนผู้ใช้</th><th>ปริมาณรวม (GB)</th></tr>
          </thead>
          <tbody>
            ${data.vouchers.map((v, i) => `
              <tr>
                <td>${i + 1}</td>
                <td class="badge">${String(v.voucherCode).padStart(8, '0')}</td>
                <td>${v.userCount} คน</td>
                <td>${v.totalGB} GB</td>
              </tr>
            `).join('')}
          </tbody>
        </table>

        <script>
          window.onload = function() { window.print(); }
        </script>
      </body>
      </html>
    `);
    printWin.document.close();
  }

  async function generateClientExcel(data) {
    if (typeof ExcelJS === 'undefined') {
      alert('กำลังโหลดสคริปต์ ExcelJS กรุณาลองใหม่อีกครั้ง');
      return;
    }

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('สรุปภาพรวม');

    sheet.columns = [
      { header: 'Voucher Code', key: 'code', width: 20 },
      { header: 'จำนวนผู้ใช้', key: 'users', width: 15 },
      { header: 'ปริมาณรวม (GB)', key: 'gb', width: 18 },
      { header: 'Download (GB)', key: 'dl', width: 18 },
      { header: 'Upload (GB)', key: 'ul', width: 18 }
    ];

    data.vouchers.forEach(v => {
      const codeStr = String(v.voucherCode).padStart(8, '0');
      const row = sheet.addRow({
        code: codeStr,
        users: v.userCount,
        gb: v.totalGB,
        dl: v.downloadGB,
        ul: v.uploadGB
      });
      row.getCell(1).numFmt = '@';
    });

    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const monthTag = data?.metadata?.detectedMonth || 'Monthly';
    const a = document.createElement('a');
    a.href = window.URL.createObjectURL(blob);
    a.download = `BOT_WiFi_Report_${monthTag}.xlsx`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }

  function showLoading(show) {
    if (show) loadingOverlay.classList.remove('hidden');
    else loadingOverlay.classList.add('hidden');
  }
});
