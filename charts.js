/**
 * charts.js — Signal Finder
 * Manages Chart.js instances for RSSI history and network count.
 */

// ─── Shared chart config ──────────────────────────────────────────────
const CHART_DEFAULTS = {
  responsive: true,
  maintainAspectRatio: true,
  animation: { duration: 400 },
  plugins: {
    legend: {
      labels: {
        color: "#7a9bb5",
        font: { size: 11, family: "system-ui" },
        boxWidth: 10,
        padding: 14,
      },
    },
    tooltip: {
      backgroundColor: "rgba(10,22,44,0.95)",
      borderColor: "rgba(0,200,255,0.3)",
      borderWidth: 1,
      titleColor: "#e8f4fc",
      bodyColor: "#7a9bb5",
      padding: 10,
      cornerRadius: 8,
    },
  },
  scales: {
    x: {
      grid:  { color: "rgba(0,200,255,0.06)" },
      ticks: { color: "#3a5570", font: { size: 10 }, maxTicksLimit: 8 },
    },
    y: {
      grid:  { color: "rgba(0,200,255,0.06)" },
      ticks: { color: "#3a5570", font: { size: 10 } },
    },
  },
};

// ─── RSSI History Chart ───────────────────────────────────────────────
let rssiChart = null;
const MAX_HISTORY = 20; // number of data points to keep

// Rolling circular buffer for time labels
const timeLabels = [];

// We track up to 5 networks by SSID (top 5 strongest)
const rssiDatasets = new Map(); // ssid -> { data: [], color }

const COLORS = [
  { line: "#00c8ff", fill: "rgba(0,200,255,0.08)" },
  { line: "#00ffd1", fill: "rgba(0,255,209,0.08)" },
  { line: "#8b5cf6", fill: "rgba(139,92,246,0.08)" },
  { line: "#ffd740", fill: "rgba(255,215,64,0.08)" },
  { line: "#00e676", fill: "rgba(0,230,118,0.08)" },
];
let colorIdx = 0;

function initRSSIChart() {
  const ctx = document.getElementById("rssi-chart").getContext("2d");
  rssiChart = new Chart(ctx, {
    type: "line",
    data: { labels: [], datasets: [] },
    options: {
      ...CHART_DEFAULTS,
      scales: {
        ...CHART_DEFAULTS.scales,
        y: {
          ...CHART_DEFAULTS.scales.y,
          reverse: false,
          title: {
            display: true,
            text: "RSSI (dBm)",
            color: "#3a5570",
            font: { size: 10 },
          },
          suggestedMin: -100,
          suggestedMax: -30,
        },
      },
    },
  });
}

/**
 * Push a new WiFi scan result into the RSSI chart.
 * @param {Array} networks - sorted array from /scan_wifi
 */
function updateRSSIChart(networks) {
  if (!rssiChart) return;

  const now = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  timeLabels.push(now);
  if (timeLabels.length > MAX_HISTORY) timeLabels.shift();

  // Track only top 5 networks
  const topNets = networks.slice(0, 5);

  // Pad existing datasets with null for missing ticks
  for (const [ssid, ds] of rssiDatasets.entries()) {
    const stillPresent = topNets.some((n) => n.ssid === ssid);
    ds.data.push(stillPresent ? null : null);
    if (ds.data.length > MAX_HISTORY) ds.data.shift();
  }

  for (const net of topNets) {
    if (!rssiDatasets.has(net.ssid)) {
      if (rssiDatasets.size >= 5) continue; // max 5 series
      const col = COLORS[colorIdx % COLORS.length];
      colorIdx++;
      rssiDatasets.set(net.ssid, {
        data: new Array(timeLabels.length - 1).fill(null),
        color: col,
      });
    }
    const ds = rssiDatasets.get(net.ssid);
    // Replace the null we pushed above
    ds.data[ds.data.length - 1] = net.rssi;
  }

  // Rebuild Chart.js datasets array
  rssiChart.data.labels = [...timeLabels];
  rssiChart.data.datasets = Array.from(rssiDatasets.entries()).map(([ssid, ds]) => ({
    label: ssid,
    data: [...ds.data],
    borderColor: ds.color.line,
    backgroundColor: ds.color.fill,
    fill: true,
    tension: 0.4,
    pointRadius: 3,
    pointBackgroundColor: ds.color.line,
    borderWidth: 2,
  }));
  rssiChart.update("none");
}

// ─── Network Count Chart ──────────────────────────────────────────────
let countChart = null;
const wifiCountHistory = [];
const btCountHistory   = [];
const countLabels      = [];

function initCountChart() {
  const ctx = document.getElementById("count-chart").getContext("2d");
  countChart = new Chart(ctx, {
    type: "bar",
    data: {
      labels: [],
      datasets: [
        {
          label: "WiFi Networks",
          data: [],
          backgroundColor: "rgba(0,200,255,0.45)",
          borderColor: "#00c8ff",
          borderWidth: 1,
          borderRadius: 4,
        },
        {
          label: "BT Devices",
          data: [],
          backgroundColor: "rgba(139,92,246,0.40)",
          borderColor: "#8b5cf6",
          borderWidth: 1,
          borderRadius: 4,
        },
      ],
    },
    options: {
      ...CHART_DEFAULTS,
      scales: {
        ...CHART_DEFAULTS.scales,
        y: {
          ...CHART_DEFAULTS.scales.y,
          beginAtZero: true,
          title: {
            display: true,
            text: "Device count",
            color: "#3a5570",
            font: { size: 10 },
          },
        },
      },
    },
  });
}

/**
 * Push new scan counts into the count chart.
 */
function updateCountChart(wifiCount, btCount) {
  if (!countChart) return;
  const now = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  countLabels.push(now);
  wifiCountHistory.push(wifiCount);
  btCountHistory.push(btCount);

  if (countLabels.length > MAX_HISTORY) {
    countLabels.shift();
    wifiCountHistory.shift();
    btCountHistory.shift();
  }

  countChart.data.labels = [...countLabels];
  countChart.data.datasets[0].data = [...wifiCountHistory];
  countChart.data.datasets[1].data = [...btCountHistory];
  countChart.update("none");
}

// ─── Tab switching ────────────────────────────────────────────────────
let activeChart = "rssi";

function switchChart(type) {
  activeChart = type;
  document.querySelectorAll(".tab-btn").forEach((b) => b.classList.remove("active"));
  event.target.classList.add("active");

  document.getElementById("rssi-chart").style.display  = type === "rssi"  ? "block" : "none";
  document.getElementById("count-chart").style.display = type === "count" ? "block" : "none";
}

// ─── Init on DOM ready ────────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", () => {
  initRSSIChart();
  initCountChart();
});
