/**
 * BOT Wi-Fi Monthly Usage Report Dashboard Client JS
 */

document.addEventListener('DOMContentLoaded', () => {
  // DOM Elements
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

  // Dropzone Drag & Drop Handlers
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
        const data = await res.json();
        if (res.ok && data.success) {
          apiStatusMessage.style.color = '#276749';
          apiStatusMessage.innerHTML = `✅ ดึงข้อมูลผ่าน Zyxel Nebula API และสร้างรายงาน (${data.report.metadata.thaiMonthYear}) สำเร็จ!`;
          currentReportData = data.report;
          renderDashboard(data.report);
        } else {
          apiStatusMessage.style.color = '#c53030';
          apiStatusMessage.innerHTML = `⚠️ ผลการทดสอบ API Key: ${data.error || 'ไม่สามารถดึงข้อมูลจาก API ได้'}`;
        }
      } catch (e) {
        apiStatusMessage.style.color = '#c53030';
        apiStatusMessage.innerHTML = '❌ ไม่สามารถส่งคำขอไปยังเซิร์ฟเวอร์ได้';
      } finally {
        showLoading(false);
      }
    });
  }

  // Search filter
  searchVoucher.addEventListener('input', (e) => {
    if (currentReportData && currentReportData.vouchers) {
      renderVoucherTable(currentReportData.vouchers, e.target.value);
    }
  });

  // Export handlers
  btnExportPDF.addEventListener('click', () => {
    const monthTag = currentReportData?.metadata?.detectedMonth || 'Monthly';
    downloadFile('/api/export/pdf', `BOT_WiFi_Report_${monthTag}.pdf`, 'application/pdf');
  });

  btnExportExcel.addEventListener('click', () => {
    const monthTag = currentReportData?.metadata?.detectedMonth || 'Monthly';
    downloadFile('/api/export/excel', `BOT_WiFi_Report_${monthTag}.xlsx`, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  });

  /**
   * Upload File to Backend
   */
  async function uploadFile(file) {
    showLoading(true);
    const formData = new FormData();
    formData.append('logfile', file);

    try {
      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData
      });
      const result = await response.json();

      if (response.ok && result.success) {
        currentReportData = result.report;
        renderDashboard(result.report);
      } else {
        alert(result.error || 'เกิดข้อผิดพลาดในการอัปโหลดไฟล์');
      }
    } catch (err) {
      console.error(err);
      alert('ไม่สามารถเชื่อมต่อเครื่องเซิร์ฟเวอร์ได้');
    } finally {
      showLoading(false);
    }
  }

  /**
   * Load Sample Data
   */
  async function loadSampleData() {
    showLoading(true);
    try {
      const response = await fetch('/api/sample');
      const result = await response.json();

      if (response.ok && result.success) {
        currentReportData = result.report;
        renderDashboard(result.report);
      } else {
        alert(result.error || 'ไม่สามารถโหลดข้อมูลตัวอย่างได้');
      }
    } catch (err) {
      console.error(err);
      alert('เกิดข้อผิดพลาดในการดึงข้อมูลตัวอย่าง');
    } finally {
      showLoading(false);
    }
  }

  /**
   * Render Dashboard Metrics, Charts & Tables
   */
  function renderDashboard(data) {
    dashboardSection.classList.remove('hidden');

    const { metadata, summary, vouchers, dailyTimeline, apBreakdown } = data;

    // Header & KPIs
    reportMonthTag.textContent = metadata.thaiMonthYear || metadata.detectedMonth;
    kpiTotalGB.textContent = `${summary.totalGB} GB`;
    kpiDLUL.textContent = `DL: ${summary.downloadGB} GB | UL: ${summary.uploadGB} GB`;
    kpiUsers.textContent = `${summary.uniqueUsers} คน`;
    kpiActiveDays.textContent = `เข้าใช้รวม ${summary.activeDaysCount} วันในรอบเดือน`;
    kpiVouchers.textContent = `${summary.totalVouchers} รหัส`;
    kpiPeakDayDate.textContent = summary.peakDay.date;
    kpiPeakDayGB.textContent = `การใช้งานรวม ${summary.peakDay.totalGB} GB`;

    // Render Charts
    renderDailyTrendChart(dailyTimeline);
    renderAPChart(apBreakdown);

    // Render Tables
    renderVoucherTable(vouchers, '');
    renderAPTable(apBreakdown);

    // Scroll smoothly to dashboard
    dashboardSection.scrollIntoView({ behavior: 'smooth' });
  }

  /**
   * Render Daily Usage Trend Bar Chart
   */
  function renderDailyTrendChart(timeline) {
    const ctx = document.getElementById('chartDailyTrend').getContext('2d');
    if (chartDailyTrendInstance) {
      chartDailyTrendInstance.destroy();
    }

    const labels = timeline.map(t => t.date);
    const dataGB = timeline.map(t => t.totalGB);

    chartDailyTrendInstance = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: labels,
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
        plugins: {
          legend: { display: false }
        },
        scales: {
          y: {
            beginAtZero: true,
            title: { display: true, text: 'Data Usage (GB)' }
          },
          x: {
            title: { display: true, text: 'Date (1st to End of Month)' }
          }
        }
      }
    });
  }

  /**
   * Render AP Distribution Doughnut Chart
   */
  function renderAPChart(apList) {
    const ctx = document.getElementById('chartAP').getContext('2d');
    if (chartAPInstance) {
      chartAPInstance.destroy();
    }

    const labels = apList.map(a => a.apName);
    const dataGB = apList.map(a => a.totalGB);

    chartAPInstance = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: labels,
        datasets: [{
          data: dataGB,
          backgroundColor: [
            '#2b6cb0', '#319795', '#d69e2e', '#e53e3e', '#805ad5', '#dd6b20'
          ]
        }]
      },
      options: {
        responsive: true,
        plugins: {
          legend: { position: 'bottom' }
        }
      }
    });
  }

  /**
   * Render Voucher Breakdown Table (Preserving leading zero!)
   */
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

  /**
   * Render AP Breakdown Table
   */
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

  /**
   * Robust Download Helper with explicit Blob type & DOM link appending
   */
  async function downloadFile(url, defaultFileName, expectedMime) {
    if (!currentReportData) {
      alert('กรุณาดึงข้อมูลรายงานก่อนดาวน์โหลด');
      return;
    }
    showLoading(true);
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ report: currentReportData })
      });

      if (!response.ok) {
        const errorText = await response.text();
        alert('เกิดข้อผิดพลาดจากเซิร์ฟเวอร์: ' + errorText);
        return;
      }

      const contentType = response.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        const json = await response.json();
        alert('เกิดข้อผิดพลาดในการสร้างไฟล์: ' + (json.error || 'ไฟล์ไม่ถูกต้อง'));
        return;
      }

      const arrayBuffer = await response.arrayBuffer();
      const blob = new Blob([arrayBuffer], { type: expectedMime });
      const blobUrl = window.URL.createObjectURL(blob);
      
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = defaultFileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      setTimeout(() => window.URL.revokeObjectURL(blobUrl), 2000);
    } catch (err) {
      console.error(err);
      alert('ไม่สามารถดาวน์โหลดไฟล์ได้: ' + err.message);
    } finally {
      showLoading(false);
    }
  }

  function showLoading(show) {
    if (show) {
      loadingOverlay.classList.remove('hidden');
    } else {
      loadingOverlay.classList.add('hidden');
    }
  }
});
