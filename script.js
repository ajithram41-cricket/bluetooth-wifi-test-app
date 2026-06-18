/**
 * script.js — Signal Finder
 * Handles all API calls, table rendering, filtering, and UI state.
 */

// ─── State ────────────────────────────────────────────────────────────
const state = {
  scanning:    false,
  intervalId:  null,
  startTs:     null,
  timerId:     null,
  wifiData:    [],
  btData:      [],
};

// ─── DOM refs ─────────────────────────────────────────────────────────
const $ = (id) => document.getElementById(id);

// ─── Scan control ─────────────────────────────────────────────────────
function startScan() {
  if (state.scanning) return;
  state.scanning = true;
  state.startTs  = Date.now();

  $("btn-start").disabled = true;
  $("btn-stop").disabled  = false;

  setStatus("active", "Scanning networks…");
  startProgressBar();
  startTimer();

  // First fetch immediately
  runScanCycle();
  // Then every 5 seconds
  state.intervalId = setInterval(runScanCycle, 5000);
}

function stopScan() {
  if (!state.scanning) return;
  state.scanning = false;

  clearInterval(state.intervalId);
  clearInterval(state.timerId);
  state.intervalId = null;

  $("btn-start").disabled = false;
  $("btn-stop").disabled  = true;

  setStatus("idle", "Scan stopped. Press Start Scan to resume.");
  stopProgressBar();
  $("scan-timer").textContent = "";
}

// ─── Progress bar animation ───────────────────────────────────────────
function startProgressBar() {
  const bar = $("progress-bar");
  bar.style.transition = "none";
  bar.style.width = "0%";
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      bar.style.transition = "width 5s linear";
      bar.style.width = "100%";
    });
  });
}
function stopProgressBar() {
  const bar = $("progress-bar");
  bar.style.transition = "none";
  bar.style.width = "0%";
}

// ─── Elapsed timer ────────────────────────────────────────────────────
function startTimer() {
  state.timerId = setInterval(() => {
    if (!state.startTs) return;
    const sec = Math.floor((Date.now() - state.startTs) / 1000);
    const m = String(Math.floor(sec / 60)).padStart(2, "0");
    const s = String(sec % 60).padStart(2, "0");
    $("scan-timer").textContent = `${m}:${s}`;
  }, 1000);
}

// ─── Status bar ───────────────────────────────────────────────────────
function setStatus(mode, msg) {
  const dot  = $("pulse-dot");
  const text = $("status-text");
  text.textContent = msg;
  if (mode === "active") {
    dot.classList.add("active");
  } else {
    dot.classList.remove("active");
  }
}

// ─── Main scan cycle ──────────────────────────────────────────────────
async function runScanCycle() {
  setStatus("active", "Refreshing scan…");
  startProgressBar();

  await Promise.all([
    fetchWiFi(),
    fetchBluetooth(),
    fetchSystemStatus(),
  ]);
}

// ─── WiFi ─────────────────────────────────────────────────────────────
async function fetchWiFi() {
  showLoading("wifi");
  try {
    const res  = await fetch("/scan_wifi");
    const data = await res.json();
    state.wifiData = data.networks || [];

    renderWifiTable(state.wifiData);
    updateWifiMeta(data);
    updateRSSIChart(state.wifiData);
    updateCountChart(state.wifiData.length, state.btData.length);

    $("wifi-badge").textContent      = state.wifiData.length;
    $("header-wifi-count").textContent = state.wifiData.length;
  } catch (err) {
    showError("wifi", `WiFi scan failed: ${err.message}`);
  }
}

function updateWifiMeta(data) {
  $("wifi-scan-time").textContent = `Last scan: ${data.scanned_at || "—"}`;
  const adapterEl = $("wifi-adapter-status");
  adapterEl.textContent = `adapter: ${data.adapter_status || "unknown"}`;
  adapterEl.style.color = data.adapter_status === "active" ? "var(--green)" : "var(--red)";

  if (data.error) {
    console.warn("[WiFi] Using demo data:", data.error);
  }
}

function renderWifiTable(networks) {
  const tbody  = $("wifi-tbody");
  const empty  = $("wifi-empty");
  const table  = $("wifi-table");
  const filter = $("wifi-search").value.toLowerCase();

  const filtered = networks.filter(
    (n) => n.ssid.toLowerCase().includes(filter) || n.bssid.toLowerCase().includes(filter)
  );

  if (filtered.length === 0) {
    empty.style.display = "flex";
    table.style.display = "none";
    empty.querySelector("p").innerHTML =
      filter
        ? `No networks match "<strong>${filter}</strong>".`
        : "No WiFi networks found.<br>Press <strong>Start Scan</strong> to begin.";
    return;
  }

  empty.style.display = "none";
  table.style.display = "table";

  tbody.innerHTML = filtered
    .map((n) => `
      <tr>
        <td class="ssid" title="${esc(n.ssid)}">${esc(n.ssid)}</td>
        <td>${signalBars(n.quality)} <span style="font-size:0.72rem;color:var(--text-dim);margin-left:4px">${n.signal_percent}%</span></td>
        <td><span class="rssi-val rssi-${n.quality.toLowerCase()}">${n.rssi} dBm</span></td>
        <td><span class="sec-badge ${n.security === 'Open' ? 'sec-open' : 'sec-secured'}">${esc(n.security)}</span></td>
        <td style="color:var(--text-dim)">${esc(n.band)}</td>
        <td style="font-family:var(--font-mono);color:var(--text-secondary)">${n.channel}</td>
        <td>${qualityBadge(n.quality)}</td>
      </tr>`)
    .join("");
}

// ─── Bluetooth ────────────────────────────────────────────────────────
async function fetchBluetooth() {
  showLoading("bt");
  try {
    const res  = await fetch("/scan_bluetooth");
    const data = await res.json();
    state.btData = data.devices || [];

    renderBtTable(state.btData);
    updateBtMeta(data);
    updateCountChart(state.wifiData.length, state.btData.length);

    $("bt-badge").textContent        = state.btData.length;
    $("header-bt-count").textContent = state.btData.length;
  } catch (err) {
    showError("bt", `Bluetooth scan failed: ${err.message}`);
  }
}

function updateBtMeta(data) {
  $("bt-scan-time").textContent = `Last scan: ${data.scanned_at || "—"}`;
  const adapterEl = $("bt-adapter-status");
  adapterEl.textContent = `adapter: ${data.adapter_status || "unknown"}`;
  adapterEl.style.color = data.adapter_status === "active" ? "var(--green)" : "var(--red)";
}

function renderBtTable(devices) {
  const tbody  = $("bt-tbody");
  const empty  = $("bt-empty");
  const table  = $("bt-table");
  const filter = $("bt-search").value.toLowerCase();

  const filtered = devices.filter(
    (d) => d.name.toLowerCase().includes(filter) || d.address.toLowerCase().includes(filter)
  );

  if (filtered.length === 0) {
    empty.style.display = "flex";
    table.style.display = "none";
    empty.querySelector("p").innerHTML =
      filter
        ? `No devices match "<strong>${filter}</strong>".`
        : "No Bluetooth devices found.<br>Press <strong>Start Scan</strong> to begin.";
    return;
  }

  empty.style.display = "none";
  table.style.display = "table";

  tbody.innerHTML = filtered
    .map((d) => `
      <tr>
        <td class="ssid" title="${esc(d.name)}">${esc(d.name)}</td>
        <td style="font-family:var(--font-mono);font-size:0.72rem;color:var(--text-dim)">${esc(d.address)}</td>
        <td>${signalBars(d.quality)} <span style="font-size:0.72rem;color:var(--text-dim);margin-left:4px">${d.signal_percent}%</span></td>
        <td><span class="rssi-val rssi-${d.quality.toLowerCase()}">${d.rssi} dBm</span></td>
        <td style="color:var(--text-secondary)">${esc(d.device_type)}</td>
        <td>${qualityBadge(d.quality)}</td>
      </tr>`)
    .join("");
}

// ─── System status ────────────────────────────────────────────────────
async function fetchSystemStatus() {
  try {
    const res  = await fetch("/system_status");
    const data = await res.json();

    $("sys-ip").textContent       = data.local_ip;
    $("sys-hostname").textContent = data.hostname;
    $("sys-os").textContent       = data.os;
    $("sys-time").textContent     = data.timestamp;
    $("header-ip").textContent    = data.local_ip;

    // CPU gauge
    const cpu = data.cpu_percent || 0;
    $("cpu-fill").style.width = `${cpu}%`;
    $("cpu-val").textContent  = `${cpu.toFixed(0)}%`;

    // RAM gauge
    const ram = data.ram_used_percent || 0;
    $("ram-fill").style.width = `${ram}%`;
    $("ram-val").textContent  = `${ram.toFixed(0)}%`;

    $("net-sent").textContent = data.bytes_sent_mb;
    $("net-recv").textContent = data.bytes_recv_mb;
  } catch (err) {
    console.warn("[System] Failed to fetch status:", err.message);
  }
}

// ─── Filter tables ────────────────────────────────────────────────────
function filterTable(type) {
  if (type === "wifi") renderWifiTable(state.wifiData);
  else               renderBtTable(state.btData);
}

// ─── Export CSV ───────────────────────────────────────────────────────
function exportCSV(type) {
  const link = document.createElement("a");
  link.href = `/export_${type}`;
  link.download = `${type}_scan.csv`;
  link.click();
}

// ─── UI helpers ───────────────────────────────────────────────────────
function showLoading(type) {
  const tbody = $(type === "wifi" ? "wifi-tbody" : "bt-tbody");
  const empty = $(type === "wifi" ? "wifi-empty" : "bt-empty");
  const table = $(type === "wifi" ? "wifi-table" : "bt-table");
  empty.style.display = "none";
  table.style.display = "table";
  tbody.innerHTML = `<tr class="loading-row"><td colspan="7"><span class="spinner"></span> Scanning…</td></tr>`;
}

function showError(type, msg) {
  const empty = $(type === "wifi" ? "wifi-empty" : "bt-empty");
  const table = $(type === "wifi" ? "wifi-table" : "bt-table");
  empty.style.display = "flex";
  table.style.display = "none";
  empty.querySelector("p").innerHTML = `<span style="color:var(--red)">${esc(msg)}</span>`;
}

function esc(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function signalBars(quality) {
  const q = quality.toLowerCase();
  return `<div class="signal-bars bars-${q}">
    <div class="bar"></div>
    <div class="bar"></div>
    <div class="bar"></div>
    <div class="bar"></div>
  </div>`;
}

function qualityBadge(quality) {
  const q = quality.toLowerCase();
  return `<span class="quality-badge q-${q}">${quality}</span>`;
}

// ─── Init: load system status immediately on page load ────────────────
document.addEventListener("DOMContentLoaded", () => {
  fetchSystemStatus();
});
