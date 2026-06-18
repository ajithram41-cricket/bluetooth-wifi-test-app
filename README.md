# 📡 Signal Finder — WiFi & Bluetooth Network Analyzer

A professional-grade desktop web application for scanning, monitoring, and analyzing nearby WiFi networks and Bluetooth devices in real time. Built with Python (Flask) on the backend and a modern dark glassmorphism UI on the frontend.

![Python](https://img.shields.io/badge/Python-3.10%2B-3776AB?style=flat-square&logo=python&logoColor=white)
![Flask](https://img.shields.io/badge/Flask-3.0-000000?style=flat-square&logo=flask&logoColor=white)
![License](https://img.shields.io/badge/License-MIT-green?style=flat-square)
![Platform](https://img.shields.io/badge/Platform-Windows%20%7C%20Linux%20%7C%20macOS-lightgrey?style=flat-square)

---

## ✨ Features

### 📶 WiFi Scanner
- Scans all nearby WiFi networks using `pywifi`
- Displays SSID, BSSID (MAC), RSSI (dBm), signal %, band (2.4 / 5 GHz), channel, and security type
- Deduplicates networks — shows only the strongest signal per SSID
- Animated 4-bar signal strength indicators
- Color-coded quality ratings: **Excellent / Good / Fair / Weak**
- Search and filter by network name or MAC address
- Export results to CSV

### 🔵 Bluetooth Scanner
- Discovers nearby BLE devices using `bleak`
- Shows device name, MAC address, RSSI, signal %, and inferred device type
- Device type detection: Headphones, Smartphones, Wearables, Keyboards, Speakers, and more
- Search and filter by name or address
- Export results to CSV

### 📊 Signal Visualization
- **RSSI History Chart** — live line chart tracking signal strength of up to 5 networks over time
- **Network Count Chart** — bar chart comparing WiFi and Bluetooth device counts per scan
- Both charts update automatically every 5 seconds without page reload

### 🖥️ System Status Panel
- Local IP address and hostname
- Operating system info
- Live CPU and RAM usage gauges
- Network I/O (bytes sent / received)

### 🎛️ Dashboard Controls
- **Start / Stop Scan** buttons with animated progress bar
- Elapsed scan timer
- Per-adapter status indicators (active / unavailable)
- Auto-refresh every 5 seconds via AJAX — no page reloads
- Graceful fallback to demo data when adapters are unavailable

---

## 🗂️ Project Structure

```
wifi_bluetooth_finder/
│
├── app.py                  # Flask backend — APIs, scanning, system info
├── requirements.txt        # Python dependencies
│
├── templates/
│   └── index.html          # Dashboard layout (Jinja2 template)
│
├── static/
│   ├── style.css           # Dark glassmorphism theme + animations
│   ├── script.js           # API calls, table rendering, filtering
│   └── charts.js           # Chart.js RSSI and count graph management
│
└── exports/                # CSV exports saved here at runtime
```

---

## 🚀 Getting Started

### Prerequisites

- Python **3.10** or higher
- A WiFi adapter (for real WiFi scanning)
- A Bluetooth adapter (for real Bluetooth scanning)

### Installation

**1. Clone the repository**
```bash
git clone https://github.com/your-username/wifi-bluetooth-finder.git
cd wifi-bluetooth-finder
```

**2. (Recommended) Create a virtual environment**
```bash
python -m venv venv

# Windows
venv\Scripts\activate

# macOS / Linux
source venv/bin/activate
```

**3. Install dependencies**
```bash
pip install -r requirements.txt
```

**4. Run the app**
```bash
python app.py
```

**5. Open in your browser**
```
http://127.0.0.1:5000
```

---

## 🔌 API Endpoints

| Endpoint | Method | Description |
|---|---|---|
| `/` | GET | Serves the dashboard UI |
| `/scan_wifi` | GET | Returns nearby WiFi networks as JSON |
| `/scan_bluetooth` | GET | Returns nearby Bluetooth devices as JSON |
| `/system_status` | GET | Returns system metrics (CPU, RAM, IP, etc.) |
| `/export_wifi` | GET | Downloads WiFi scan results as `wifi_scan.csv` |
| `/export_bluetooth` | GET | Downloads Bluetooth scan results as `bluetooth_scan.csv` |

### Example response — `/scan_wifi`
```json
{
  "networks": [
    {
      "ssid": "HomeNetwork_5G",
      "bssid": "AA:BB:CC:DD:EE:01",
      "rssi": -42,
      "signal_percent": 83,
      "quality": "Excellent",
      "security": "WPA2-PSK",
      "frequency": "5180 MHz",
      "band": "5 GHz",
      "channel": 36
    }
  ],
  "adapter_status": "active",
  "scanned_at": "14:32:07"
}
```

---

## ⚙️ Platform Notes

### Linux
WiFi scanning via `pywifi` may require root privileges:
```bash
sudo python app.py
```

Bluetooth scanning via `bleak` requires the Bluetooth service to be running:
```bash
sudo systemctl start bluetooth
```

### Windows
Run the terminal as **Administrator** for full adapter access. Most functionality works without elevation.

### macOS
Bluetooth scanning works out of the box. WiFi scanning support via `pywifi` is limited on macOS — the app will fall back to demo data automatically.

### No Adapter? No Problem.
If a WiFi or Bluetooth adapter is unavailable or inaccessible, the app **automatically serves realistic demo data** so the full UI remains functional for development and testing.

---

## 🛠️ Tech Stack

| Layer | Technology |
|---|---|
| Backend | Python 3.10+, Flask 3.0 |
| WiFi Scanning | pywifi |
| Bluetooth Scanning | bleak (async BLE) |
| System Metrics | psutil, platform, socket |
| Frontend | HTML5, CSS3, Vanilla JavaScript |
| Charts | Chart.js 4.4 |
| UI Style | Glassmorphism, CSS custom properties |

---

## 🎨 UI Design

- Dark deep-navy gradient background with animated grid overlay
- Glassmorphism cards with `backdrop-filter: blur`
- Neon blue (`#00c8ff`) and cyan (`#00ffd1`) accent palette
- Animated radar sweep logo
- 4-bar animated signal strength indicators (styled like mobile WiFi icons)
- Smooth hover transitions and neon glow effects
- Fully responsive — adapts to mobile screens below 900px

---

## 📦 Dependencies

```
flask>=3.0.0        # Web framework and local server
pywifi>=1.1.12      # WiFi adapter scanning
bleak>=0.21.1       # Async Bluetooth Low Energy scanning
psutil>=5.9.8       # System metrics (CPU, RAM, network I/O)
```

---

## 🤝 Contributing

Pull requests are welcome. For major changes, please open an issue first to discuss what you'd like to change.

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/my-feature`)
3. Commit your changes (`git commit -m 'Add my feature'`)
4. Push to the branch (`git push origin feature/my-feature`)
5. Open a Pull Request

---

## 📄 License

This project is licensed under the [MIT License](LICENSE).

---

## 👤 Author

**Ajithram**
- GitHub: [@ajithram41-cricket]((https://github.com/ajithram41-cricket))
- Built with Python, Flask, and ☕
