// src/services/usbIds.service.js
// Parse file usb.ids -> Map tra cứu VID/PID. ESM.

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Cho phép đổi đường dẫn qua env
const IDS_PATH = process.env.USB_IDS_PATH || path.join(__dirname, '../../data/usb.ids');

let vendorMap = null; // Map<string VID, { name: string, products: Map<string PID, string> }>

export async function loadUsbIds(filePath = IDS_PATH) {
  const text = await fs.readFile(filePath, 'utf8');
  const lines = text.split(/\r?\n/);

  const vMap = new Map();
  let currentVid = null;

  for (const raw of lines) {
    const line = raw.replace(/\t+/g, '\t'); // normalize tabs
    if (!line || line.startsWith('#')) continue;

    // Vendor line: "VVVV  Vendor Name"
    // Product line: "\tPPPP  Product Name"
    const vendorMatch = line.match(/^([0-9A-Fa-f]{4})\s{2,}(.+)$/);
    const productMatch = line.match(/^\t([0-9A-Fa-f]{4})\s{2,}(.+)$/);

    if (vendorMatch) {
      const [, vid, vname] = vendorMatch;
      currentVid = vid.toUpperCase();
      if (!vMap.has(currentVid)) {
        vMap.set(currentVid, { name: vname.trim(), products: new Map() });
      }
      continue;
    }
    if (productMatch && currentVid) {
      const [, pid, pname] = productMatch;
      vMap.get(currentVid).products.set(pid.toUpperCase(), pname.trim());
      continue;
    }

    // Bỏ qua các section khác: classes, HID, audio..., comments
  }

  vendorMap = vMap;
  return vendorMap;
}

export function isUsbIdsLoaded() {
  return vendorMap instanceof Map;
}

export async function ensureUsbIds() {
  if (!isUsbIdsLoaded()) {
    try { await loadUsbIds(); } catch { vendorMap = new Map(); }
  }
  return vendorMap;
}

export function lookupVendor(vid) {
  if (!vendorMap || !vid) return '';
  const v = vendorMap.get(String(vid).toUpperCase());
  return v ? v.name : '';
}

export function lookupProduct(vid, pid) {
  if (!vendorMap || !vid || !pid) return '';
  const v = vendorMap.get(String(vid).toUpperCase());
  if (!v) return '';
  const p = v.products.get(String(pid).toUpperCase());
  return p || '';
}
