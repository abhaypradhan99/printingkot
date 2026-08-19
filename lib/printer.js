"use client";

// Generic Web Bluetooth ESC/POS printer driver.
// Most cheap "58mm/80mm mobile Bluetooth printers" (the kind used for
// Zomato/Swiggy style bills) expose a BLE serial-ish service. Exact UUIDs
// vary by chipset, so instead of hardcoding one, we ask the browser to show
// ALL nearby Bluetooth devices, connect, then walk every service/characteristic
// to find one we can write to. This works with the vast majority of these
// printers (common chipsets: BT, SPP-over-BLE clones).

const KNOWN_PRINTER_SERVICES = [
  "000018f0-0000-1000-8000-00805f9b34fb", // common thermal printer service
  "49535343-fe7d-4ae5-8fa9-9fafd205e455", // ISSC / SPP-like service used by many clones
  "0000ff00-0000-1000-8000-00805f9b34fb",
  "0000ffe0-0000-1000-8000-00805f9b34fb",
];

const STORAGE_KEY_PREFIX = "printer_device_id_";

function isWebBluetoothSupported() {
  return typeof navigator !== "undefined" && !!navigator.bluetooth;
}

// stationId lets one browser remember a different paired printer per role
// (e.g. "kitchen" vs "counter") if you open both stations in the same phone
// for testing. In production each station is normally a separate physical phone.
export class BluetoothPrinter {
  constructor(stationId = "default") {
    this.stationId = stationId;
    this.device = null;
    this.characteristic = null;
  }

  get storageKey() {
    return STORAGE_KEY_PREFIX + this.stationId;
  }

  isConnected() {
    return !!(this.device && this.device.gatt && this.device.gatt.connected);
  }

  // Must be called from a direct user click/tap — Web Bluetooth requires a
  // user gesture to open the device picker.
  async requestAndConnect() {
    if (!isWebBluetoothSupported()) {
      throw new Error(
        "This browser doesn't support Web Bluetooth. Use Chrome on Android."
      );
    }
    const device = await navigator.bluetooth.requestDevice({
      acceptAllDevices: true,
      optionalServices: KNOWN_PRINTER_SERVICES,
    });
    await this._connectToDevice(device);
    try {
      localStorage.setItem(this.storageKey, device.id);
    } catch (e) {
      // localStorage may be unavailable in some contexts; safe to ignore
    }
    return device.name || "Printer";
  }

  // Attempts a silent reconnect to a previously paired device, using the
  // Chrome-only navigator.bluetooth.getDevices() permission-persistence API.
  // Falls back to doing nothing (caller should show a "Connect printer"
  // button) if it can't reconnect automatically.
  async tryReconnect() {
    if (!isWebBluetoothSupported() || !navigator.bluetooth.getDevices) {
      return false;
    }
    let savedId;
    try {
      savedId = localStorage.getItem(this.storageKey);
    } catch (e) {
      return false;
    }
    if (!savedId) return false;

    try {
      const devices = await navigator.bluetooth.getDevices();
      const match = devices.find((d) => d.id === savedId);
      if (!match) return false;
      await this._connectToDevice(match);
      return true;
    } catch (e) {
      return false;
    }
  }

  async _connectToDevice(device) {
    this.device = device;
    const server = await device.gatt.connect();
    const services = await server.getPrimaryServices();

    let writableChar = null;
    for (const service of services) {
      const characteristics = await service.getCharacteristics();
      for (const char of characteristics) {
        if (char.properties.write || char.properties.writeWithoutResponse) {
          writableChar = char;
          break;
        }
      }
      if (writableChar) break;
    }

    if (!writableChar) {
      throw new Error(
        "Connected, but couldn't find a writable channel on this printer."
      );
    }
    this.characteristic = writableChar;

    device.addEventListener("gattserverdisconnected", () => {
      this.characteristic = null;
    });
  }

  disconnect() {
    if (this.device && this.device.gatt && this.device.gatt.connected) {
      this.device.gatt.disconnect();
    }
    this.characteristic = null;
  }

  // Sends raw bytes to the printer in small chunks (BLE has a small MTU,
  // typically ~20 bytes per write on older stacks).
  async writeBytes(bytes) {
    if (!this.characteristic) {
      throw new Error("Printer not connected.");
    }
    const chunkSize = 100;
    for (let i = 0; i < bytes.length; i += chunkSize) {
      const chunk = bytes.slice(i, i + chunkSize);
      if (this.characteristic.properties.writeWithoutResponse) {
        await this.characteristic.writeValueWithoutResponse(chunk);
      } else {
        await this.characteristic.writeValue(chunk);
      }
      // small delay so the printer's buffer can keep up
      await new Promise((r) => setTimeout(r, 20));
    }
  }
}
