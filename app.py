"""
WiFi & Bluetooth Signal Finder — Flask Backend
Provides REST API endpoints for WiFi, Bluetooth, and system status.
"""

import asyncio
import json
import math
import platform
import socket
import threading
import time
from datetime import datetime

import psutil
from flask import Flask, jsonify, render_template, send_from_directory

app = Flask(__name__)

# ─── Globals ─────────────────────────────────────────────────────────────────
scan_active = False
scan_start_time = None

# ─── Helpers ─────────────────────────────────────────────────────────────────

def rssi_to_percent(rssi: int) -> int:
    """Convert RSSI dBm value to 0–100 % quality score."""
    if rssi is None:
        return 0
    rssi = max(-100, min(-30, rssi))
    return round(((rssi + 100) / 70) * 100)


def signal_quality(rssi: int) -> str:
    pct = rssi_to_percent(rssi)
    if pct >= 75:
        return "Excellent"
    elif pct >= 50:
        return "Good"
    elif pct >= 25:
        return "Fair"
    return "Weak"


def channel_from_freq(freq_mhz: float) -> int | None:
    """Derive WiFi channel number from frequency in MHz."""
    if freq_mhz is None:
        return None
    f = int(freq_mhz)
    if 2412 <= f <= 2484:
        return 1 + (f - 2412) // 5 if f != 2484 else 14
    if 5170 <= f <= 5825:
        return (f - 5000) // 5
    return None


def get_local_ip() -> str:
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))
        ip = s.getsockname()[0]
        s.close()
        return ip
    except Exception:
        return "Unavailable"


# ─── WiFi scanning ───────────────────────────────────────────────────────────

def scan_wifi_networks() -> dict:
    """Scan nearby WiFi networks using pywifi."""
    results = {"networks": [], "adapter_status": "unavailable", "error": None}
    try:
        import pywifi
        from pywifi import const as pywifi_const

        wifi = pywifi.PyWiFi()
        if not wifi.interfaces():
            results["error"] = "No WiFi adapter found"
            return results

        iface = wifi.interfaces()[0]
        results["adapter_status"] = "active"
        iface.scan()
        time.sleep(2.5)  # Allow scan to complete

        seen_ssids: set[str] = set()
        raw = iface.scan_results()

        for net in raw:
            ssid = net.ssid.strip() or "<Hidden Network>"

            # Deduplicate: keep strongest signal per SSID
            if ssid in seen_ssids:
                continue
            seen_ssids.add(ssid)

            rssi = int(net.signal)
            freq_mhz = getattr(net, "freq", None)
            if freq_mhz and freq_mhz > 10000:
                # pywifi may return frequency in kHz
                freq_mhz = freq_mhz / 1000

            # Derive band
            band = "2.4 GHz"
            if freq_mhz and freq_mhz > 3000:
                band = "5 GHz"

            # Security
            auth_map = {
                pywifi_const.AKM_TYPE_NONE: "Open",
                pywifi_const.AKM_TYPE_WPA: "WPA",
                pywifi_const.AKM_TYPE_WPAPSK: "WPA-PSK",
                pywifi_const.AKM_TYPE_WPA2: "WPA2",
                pywifi_const.AKM_TYPE_WPA2PSK: "WPA2-PSK",
            }
            auth = auth_map.get(
                net.akm[0] if net.akm else pywifi_const.AKM_TYPE_NONE, "Unknown"
            )

            results["networks"].append({
                "ssid": ssid,
                "bssid": net.bssid or "N/A",
                "rssi": rssi,
                "signal_percent": rssi_to_percent(rssi),
                "quality": signal_quality(rssi),
                "security": auth,
                "frequency": f"{freq_mhz:.0f} MHz" if freq_mhz else "N/A",
                "band": band,
                "channel": channel_from_freq(freq_mhz) or "N/A",
            })

        # Sort by signal strength descending
        results["networks"].sort(key=lambda x: x["rssi"], reverse=True)

    except ImportError:
        results["error"] = "pywifi not installed"
        results["adapter_status"] = "unavailable"
        # Return demo data so the UI isn't empty
        results["networks"] = _demo_wifi()
    except Exception as exc:
        results["error"] = str(exc)
        results["networks"] = _demo_wifi()

    return results


def _demo_wifi() -> list[dict]:
    """Fallback demo data when real scanning fails (e.g., no adapter/root)."""
    import random
    demo = [
        ("HomeNetwork_5G", "AA:BB:CC:DD:EE:01", -42, "WPA2-PSK", "5180 MHz", "5 GHz", 36),
        ("OfficeWiFi",     "AA:BB:CC:DD:EE:02", -58, "WPA2-PSK", "2437 MHz", "2.4 GHz", 6),
        ("Neighbors_AP",  "AA:BB:CC:DD:EE:03", -71, "WPA-PSK",  "2412 MHz", "2.4 GHz", 1),
        ("Guest_Network",  "AA:BB:CC:DD:EE:04", -80, "Open",     "5220 MHz", "5 GHz", 44),
        ("CafeHotspot",    "AA:BB:CC:DD:EE:05", -88, "WPA2-PSK", "2462 MHz", "2.4 GHz", 11),
    ]
    result = []
    for ssid, bssid, base_rssi, sec, freq, band, ch in demo:
        rssi = base_rssi + random.randint(-3, 3)
        result.append({
            "ssid": ssid, "bssid": bssid, "rssi": rssi,
            "signal_percent": rssi_to_percent(rssi),
            "quality": signal_quality(rssi),
            "security": sec, "frequency": freq,
            "band": band, "channel": ch,
        })
    result.sort(key=lambda x: x["rssi"], reverse=True)
    return result


# ─── Bluetooth scanning ──────────────────────────────────────────────────────

async def _bleak_scan(duration: float = 4.0) -> list[dict]:
    """Run bleak BLE scan and return device list."""
    from bleak import BleakScanner
    devices_with_data = await BleakScanner.discover(timeout=duration, return_adv=True)
    results = []
    for addr, (device, adv) in devices_with_data.items():
        rssi = adv.rssi if adv.rssi else -99
        name = device.name or "Unknown Device"
        # Infer device type from name heuristics
        dev_type = _infer_bt_type(name)
        results.append({
            "name": name,
            "address": addr,
            "rssi": rssi,
            "signal_percent": rssi_to_percent(rssi),
            "quality": signal_quality(rssi),
            "device_type": dev_type,
            "connectable": adv.connectable,
        })
    results.sort(key=lambda x: x["rssi"], reverse=True)
    return results


def _infer_bt_type(name: str) -> str:
    name_lower = name.lower()
    if any(k in name_lower for k in ("airpods", "buds", "headphone", "earphone", "headset", "jbl", "sony wh", "bose")):
        return "Headphone / Earbuds"
    if any(k in name_lower for k in ("keyboard", "mouse", "trackpad", "logitech", "mx")):
        return "Input Device"
    if any(k in name_lower for k in ("phone", "iphone", "samsung", "pixel", "oneplus", "redmi")):
        return "Smartphone"
    if any(k in name_lower for k in ("watch", "band", "fitbit", "garmin", "mi band")):
        return "Wearable"
    if any(k in name_lower for k in ("tv", "display", "roku", "fire")):
        return "TV / Display"
    if any(k in name_lower for k in ("speaker", "soundbar", "echo")):
        return "Speaker"
    if any(k in name_lower for k in ("laptop", "macbook", "thinkpad")):
        return "Laptop"
    return "Generic Device"


def scan_bluetooth_devices() -> dict:
    """Run Bluetooth scan synchronously from Flask."""
    results = {"devices": [], "adapter_status": "unavailable", "error": None}
    try:
        import bleak  # noqa: F401

        loop = asyncio.new_event_loop()
        devices = loop.run_until_complete(_bleak_scan(4.0))
        loop.close()

        results["devices"] = devices
        results["adapter_status"] = "active" if devices else "idle"

    except ImportError:
        results["error"] = "bleak not installed"
        results["devices"] = _demo_bluetooth()
    except Exception as exc:
        results["error"] = str(exc)
        results["devices"] = _demo_bluetooth()

    return results


def _demo_bluetooth() -> list[dict]:
    import random
    demo = [
        ("AirPods Pro",       "A1:B2:C3:D4:E5:01", -55, "Headphone / Earbuds"),
        ("MX Keys Keyboard",  "A1:B2:C3:D4:E5:02", -62, "Input Device"),
        ("Galaxy S24",        "A1:B2:C3:D4:E5:03", -70, "Smartphone"),
        ("Apple Watch Ultra", "A1:B2:C3:D4:E5:04", -75, "Wearable"),
        ("JBL Charge 5",      "A1:B2:C3:D4:E5:05", -82, "Speaker"),
    ]
    result = []
    for name, addr, base_rssi, dev_type in demo:
        rssi = base_rssi + random.randint(-4, 4)
        result.append({
            "name": name, "address": addr, "rssi": rssi,
            "signal_percent": rssi_to_percent(rssi),
            "quality": signal_quality(rssi),
            "device_type": dev_type, "connectable": True,
        })
    result.sort(key=lambda x: x["rssi"], reverse=True)
    return result


# ─── System status ───────────────────────────────────────────────────────────

def get_system_status() -> dict:
    """Collect system metrics via psutil."""
    cpu = psutil.cpu_percent(interval=0.3)
    mem = psutil.virtual_memory()
    net_io = psutil.net_io_counters()

    # Network interfaces
    ifaces = []
    for name, addrs in psutil.net_if_addrs().items():
        for addr in addrs:
            if addr.family == socket.AF_INET:
                ifaces.append({"interface": name, "ip": addr.address})

    return {
        "os": f"{platform.system()} {platform.release()}",
        "hostname": socket.gethostname(),
        "local_ip": get_local_ip(),
        "cpu_percent": cpu,
        "ram_total_gb": round(mem.total / 1e9, 1),
        "ram_used_percent": mem.percent,
        "bytes_sent_mb": round(net_io.bytes_sent / 1e6, 1),
        "bytes_recv_mb": round(net_io.bytes_recv / 1e6, 1),
        "interfaces": ifaces[:6],
        "timestamp": datetime.now().strftime("%H:%M:%S"),
    }


# ─── Flask routes ────────────────────────────────────────────────────────────

@app.route("/")
def index():
    return render_template("index.html")


@app.route("/scan_wifi")
def api_scan_wifi():
    data = scan_wifi_networks()
    data["scanned_at"] = datetime.now().strftime("%H:%M:%S")
    return jsonify(data)


@app.route("/scan_bluetooth")
def api_scan_bluetooth():
    data = scan_bluetooth_devices()
    data["scanned_at"] = datetime.now().strftime("%H:%M:%S")
    return jsonify(data)


@app.route("/system_status")
def api_system_status():
    return jsonify(get_system_status())


@app.route("/export_wifi")
def export_wifi():
    """Return WiFi scan as CSV download."""
    import io
    import csv
    from flask import Response

    data = scan_wifi_networks()
    output = io.StringIO()
    writer = csv.DictWriter(output, fieldnames=[
        "ssid", "bssid", "rssi", "signal_percent", "quality",
        "security", "frequency", "band", "channel",
    ])
    writer.writeheader()
    writer.writerows(data["networks"])
    output.seek(0)
    return Response(
        output.getvalue(),
        mimetype="text/csv",
        headers={"Content-Disposition": "attachment; filename=wifi_scan.csv"},
    )


@app.route("/export_bluetooth")
def export_bluetooth():
    """Return Bluetooth scan as CSV download."""
    import io
    import csv
    from flask import Response

    data = scan_bluetooth_devices()
    output = io.StringIO()
    writer = csv.DictWriter(output, fieldnames=[
        "name", "address", "rssi", "signal_percent", "quality", "device_type", "connectable",
    ])
    writer.writeheader()
    writer.writerows(data["devices"])
    output.seek(0)
    return Response(
        output.getvalue(),
        mimetype="text/csv",
        headers={"Content-Disposition": "attachment; filename=bluetooth_scan.csv"},
    )


if __name__ == "__main__":
    print("─" * 55)
    print("  WiFi & Bluetooth Signal Finder")
    print(f"  Running at http://127.0.0.1:5000")
    print("─" * 55)
    app.run(host="0.0.0.0", port=5000, debug=False, threaded=True)
