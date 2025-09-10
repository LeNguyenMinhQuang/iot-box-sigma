// services/usb.service.js
// ESM, hoạt động trên Linux (sysfs/lsusb) và Windows (PowerShell/WMIC).
import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import { execFile } from 'child_process';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

/* -------------------- Helpers chung -------------------- */
function safeParseJson(s) {
  if (!s) return [];
  let data = s.trim();
  // Loại BOM
  if (data.charCodeAt(0) === 0xFEFF) data = data.slice(1);
  // Nếu có warning trước JSON, cắt đến kí tự '[' hoặc '{' đầu tiên
  const iA = data.indexOf('[');
  const iB = data.indexOf('{');
  const start =
    iA === -1 ? iB : iB === -1 ? iA : Math.min(iA, iB);
  if (start > 0) data = data.slice(start);
  try {
    const j = JSON.parse(data);
    return Array.isArray(j) ? j : (j ? [j] : []);
  } catch {
    return [];
  }
}

function isWSL() {
  return process.platform === 'linux' && (
    process.env.WSL_INTEROP ||
    process.env.WSL_DISTRO_NAME ||
    (os.release() || '').toLowerCase().includes('microsoft')
  );
}

/* -------------------- Linux -------------------- */
async function readIfExists(filePath) {
  try { return (await fs.readFile(filePath, 'utf8')).trim(); } catch { return ''; }
}

async function listFromSysfs() {
  const base = '/sys/bus/usb/devices';
  let entries;
  try { entries = await fs.readdir(base, { withFileTypes: true }); } catch { return []; }

  const out = [];
  for (const e of entries) {
    if (!e.isDirectory() || !e.name.includes('-')) continue;
    const dir = path.join(base, e.name);

    const idVendor = await readIfExists(path.join(dir, 'idVendor'));
    const idProduct = await readIfExists(path.join(dir, 'idProduct'));
    if (!idVendor || !idProduct) continue;

    const manufacturer = await readIfExists(path.join(dir, 'manufacturer'));
    const product = await readIfExists(path.join(dir, 'product'));
    const serial = await readIfExists(path.join(dir, 'serial'));
    const speed = await readIfExists(path.join(dir, 'speed'));
    const bus = await readIfExists(path.join(dir, 'busnum'));
    const device = await readIfExists(path.join(dir, 'devnum'));
    const classCode = await readIfExists(path.join(dir, 'bDeviceClass'));

    out.push({
      bus, device,
      vendorId: idVendor, productId: idProduct,
      manufacturer: manufacturer || '(unknown)',
      product: product || '(unknown)',
      serial: serial || '',
      speed: speed || '',
      classCode: classCode || '',
      sysfsNode: e.name
    });
  }

  out.sort((a, b) => {
    const ak = `${(a.bus || '').padStart(3, '0')}-${(a.device || '').padStart(3, '0')}`;
    const bk = `${(b.bus || '').padStart(3, '0')}-${(b.device || '').padStart(3, '0')}`;
    return ak.localeCompare(bk);
  });
  return out;
}

async function listFromLsusb() {
  try {
    const { stdout } = await execFileAsync('lsusb', []);
    return stdout
      .split('\n')
      .map(s => s.trim())
      .filter(Boolean)
      .map(line => {
        const m = line.match(/^Bus\s+(\d+)\s+Device\s+(\d+):\s+ID\s+([0-9a-fA-F]{4}):([0-9a-fA-F]{4})\s+(.*)$/);
        if (!m) return null;
        const [, bus, device, vendorId, productId, rest] = m;
        return {
          bus, device, vendorId, productId,
          manufacturer: '',
          product: rest || '',
          serial: '',
          speed: '',
          classCode: '',
          sysfsNode: ''
        };
      })
      .filter(Boolean);
  } catch {
    return [];
  }
}

/* -------------------- Windows -------------------- */
// Bắt cả USB & HID (chuột/bàn phím/ barcode scanner dạng HID)
async function listWin_PnpDevice() {
  const ps = `
    $d = Get-PnpDevice -PresentOnly |
      Where-Object { $_.InstanceId -match '^(USB|HID)\\\\' -or $_.Class -in @('HIDClass','Mouse','Keyboard') } |
      Select-Object InstanceId, FriendlyName, Name, Class, Manufacturer;
    $d | ConvertTo-Json -Depth 3
  `.replace(/\r?\n/g, ' ');

  try {
    const { stdout } = await execFileAsync(
      'powershell.exe',
      ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', ps],
      { maxBuffer: 10 * 1024 * 1024 }
    );
    const list = safeParseJson(stdout);
    return list.map(x => {
      const id = x.InstanceId || '';
      const m = id.match(/VID_([0-9A-Fa-f]{4}).*PID_([0-9A-Fa-f]{4})/);
      return {
        bus: '', device: '',
        vendorId: m ? m[1] : '',
        productId: m ? m[2] : '',
        manufacturer: x.Manufacturer || '(unknown)',
        product: x.FriendlyName || x.Name || '(unknown)',
        serial: '',
        speed: '',
        classCode: x.Class || '',
        sysfsNode: ''
      };
    });
  } catch {
    return [];
  }
}

async function listWin_Win32PnP() {
  const ps = `
    $items = Get-CimInstance Win32_PnPEntity |
      Where-Object { $_.DeviceID -match '^(USB|HID)\\\\' } |
      Select-Object DeviceID, Name, Manufacturer, ClassGuid;
    $items | ConvertTo-Json -Depth 3
  `.replace(/\r?\n/g, ' ');

  try {
    const { stdout } = await execFileAsync(
      'powershell.exe',
      ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', ps],
      { maxBuffer: 10 * 1024 * 1024 }
    );
    const list = safeParseJson(stdout);
    return list.map(x => {
      const id = x.DeviceID || '';
      const m = id.match(/VID_([0-9A-Fa-f]{4}).*PID_([0-9A-Fa-f]{4})/);
      return {
        bus: '', device: '',
        vendorId: m ? m[1] : '',
        productId: m ? m[2] : '',
        manufacturer: x.Manufacturer || '(unknown)',
        product: x.Name || '(unknown)',
        serial: '',
        speed: '',
        classCode: x.ClassGuid || '',
        sysfsNode: ''
      };
    });
  } catch {
    return [];
  }
}

// Fallback rất cũ (nếu PowerShell bị chặn/cmdlet thiếu)
async function listWin_Wmic() {
  try {
    const { stdout } = await execFileAsync(
      'wmic',
      ['path', 'Win32_PnPEntity', 'where', "\"DeviceID like 'USB%' or DeviceID like 'HID%'\"", 'get', 'DeviceID,Name,Manufacturer', '/format:csv'],
      { maxBuffer: 10 * 1024 * 1024 }
    );
    const lines = stdout.split(/\r?\n/).slice(1).filter(Boolean);
    return lines.map(l => {
      const parts = l.split(',');
      const deviceId = (parts[2] || '').trim();
      const name = (parts[3] || '').trim();
      const manu = (parts[4] || '').trim();
      const m = deviceId.match(/VID_([0-9A-Fa-f]{4}).*PID_([0-9A-Fa-f]{4})/);
      return {
        bus: '', device: '',
        vendorId: m ? m[1] : '',
        productId: m ? m[2] : '',
        manufacturer: manu || '(unknown)',
        product: name || '(unknown)',
        serial: '',
        speed: '',
        classCode: '',
        sysfsNode: ''
      };
    }).filter(x => x.product || x.vendorId || x.productId);
  } catch {
    return [];
  }
}

/* -------------------- Public API -------------------- */
export async function listUsbDevices() {
  try {
    // Windows native hoặc chạy trong WSL (nhưng vẫn muốn đọc thiết bị của host Windows)
    if (process.platform === 'win32' || isWSL()) {
      let list = await listWin_PnpDevice();
      if (!list.length) list = await listWin_Win32PnP();
      if (!list.length) list = await listWin_Wmic();
      return list;
    }

    // Linux
    if (process.platform === 'linux') {
      const sys = await listFromSysfs();
      if (sys.length) return sys;
      const ls = await listFromLsusb();
      return ls;
    }

    // (Có thể bổ sung macOS sau: system_profiler SPUSBDataType -> JSON)
    return [];
  } catch (e) {
    console.error('[usb] error:', e);
    return [];
  }
}
