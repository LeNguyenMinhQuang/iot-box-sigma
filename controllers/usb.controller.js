// // controllers/usb.controller.js
// import { listUsbDevices } from '../services/usb.service.js';

// /**
//  * Render view con 'usb.ejs' rồi nhét vào layout.ejs để hợp với codebase hiện tại.
//  * Kết quả: res.render('layout', { title, body: <html của usb.ejs> })
//  */
// // thêm helper gộp/lọc
// function condenseDevices(devs) {
//   // Bỏ hub/thiết bị hệ thống ồn ào, giữ barcode/scanner
//   const skipClass = new Set(['USB', 'HIDClass', 'Keyboard', 'Mouse', 'Camera', 'Bluetooth']);
//   const keepByName = /barcode|scanner/i;

//   // Chỉ giữ dòng có VID:PID và
//   //  - tên có "barcode|scanner", hoặc
//   //  - class KHÔNG nằm trong skipClass
//   const filtered = devs.filter(d => {
//     const hasVidPid = (d.vendorId && d.productId);
//     const name = `${d.product || ''} ${d.manufacturer || ''}`;
//     if (!hasVidPid) return false;
//     if (keepByName.test(name)) return true;
//     return !skipClass.has(d.classCode || '');
//   });

//   // Gộp theo VID:PID + product (đếm số interface)
//   const map = new Map();
//   for (const d of filtered) {
//     const key = `${d.vendorId}:${d.productId}|${(d.product || '').toLowerCase()}`;
//     const cur = map.get(key) || { ...d, count: 0 };
//     cur.count += 1;
//     // prefer manufacturer/product có nghĩa
//     if (d.manufacturer && d.manufacturer !== '(unknown)') cur.manufacturer = d.manufacturer;
//     if (d.product && d.product !== '(unknown)') cur.product = d.product;
//     map.set(key, cur);
//   }
//   // Sắp xếp theo VID:PID
//   return Array.from(map.values()).sort((a, b) =>
//     `${a.vendorId}:${a.productId}`.localeCompare(`${b.vendorId}:${b.productId}`)
//   );
// }

// export async function renderUsbPage(req, res, next) {
//   try {
//     const compact = req.query.compact === '1';
//     const devices = await listUsbDevices();
//     const rows = compact ? condenseDevices(devices) : devices;

//     res.render('usb', { devices: rows, compact }, (err, html) => {
//       if (err) return next(err);
//       res.render('layout', { title: 'USB Devices', body: html });
//     });
//   } catch (err) { next(err); }
// }

// export async function apiUsbDevices(req, res, next) {
//   try {
//     const compact = req.query.compact === '1';
//     const devices = await listUsbDevices();
//     const rows = compact ? condenseDevices(devices) : devices;
//     res.json({ count: rows.length, devices: rows });
//   } catch (err) { next(err); }
// }

// controllers/usb.controller.js
import { listUsbDevices } from '../services/usb.service.js';
import {
  ensureUsbIds,
  lookupVendor,
  lookupProduct,
  // loadUsbIds, // nếu muốn thêm route /usb/reload-ids thì import hàm này
} from '../services/usbIds.service.js';

/**
 * Gộp & lọc cho chế độ "compact".
 * Bỏ bớt hub/thiết bị hệ thống ồn ào, nhưng vẫn giữ barcode/scanner.
 */
function condenseDevices(devs) {
  const skipClass = new Set(['USB', 'HIDClass', 'Keyboard', 'Mouse', 'Camera', 'Bluetooth']);
  const keepByName = /barcode|scanner/i;

  const filtered = devs.filter(d => {
    const hasVidPid = (d.vendorId && d.productId);
    const name = `${d.product || ''} ${d.manufacturer || ''}`;
    if (!hasVidPid) return false;
    if (keepByName.test(name)) return true;
    return !skipClass.has(d.classCode || '');
  });

  const map = new Map();
  for (const d of filtered) {
    const key = `${(d.vendorId || '').toUpperCase()}:${(d.productId || '').toUpperCase()}|${(d.product || '').toLowerCase()}`;
    const cur = map.get(key) || { ...d, count: 0 };
    cur.count += 1;

    if (d.manufacturer && d.manufacturer !== '(unknown)') cur.manufacturer = d.manufacturer;
    if (d.product && d.product !== '(unknown)') cur.product = d.product;

    map.set(key, cur);
  }

  return Array.from(map.values()).sort((a, b) =>
    `${a.vendorId}:${a.productId}`.localeCompare(`${b.vendorId}:${b.productId}`)
  );
}

/**
 * Enrich: dùng usb.ids để map VID/PID -> tên hãng & model chuẩn.
 * Ưu tiên tên từ usb.ids, nếu không có thì giữ nguyên giá trị gốc.
 */
function enrichWithUsbIds(devs) {
  return devs.map(d => {
    const vid = (d.vendorId || '').toUpperCase();
    const pid = (d.productId || '').toUpperCase();
    const vName = lookupVendor(vid);
    const pName = lookupProduct(vid, pid);
    return {
      ...d,
      manufacturer: vName || d.manufacturer,   // ưu tiên hãng từ usb.ids
      product: pName || d.product,             // ưu tiên model từ usb.ids
    };
  });
}

export async function renderUsbPage(req, res, next) {
  try {
    const compact = req.query.compact === '1';

    // Lấy danh sách thiết bị
    const devices = await listUsbDevices();

    // Đảm bảo usb.ids đã load (từ data/usb.ids hoặc đường dẫn bạn cấu hình)
    await ensureUsbIds();

    // Enrich dữ liệu
    const enriched = enrichWithUsbIds(devices);

    // Áp dụng chế độ compact (nếu có)
    const rows = compact ? condenseDevices(enriched) : enriched;

    // Render view con rồi bọc vào layout hiện có của project
    res.render('usb', { devices: rows, compact }, (err, html) => {
      if (err) return next(err);
      res.render('layout', { title: 'USB Devices', body: html });
    });
  } catch (err) {
    next(err);
  }
}

export async function apiUsbDevices(req, res, next) {
  try {
    const compact = req.query.compact === '1';

    const devices = await listUsbDevices();
    await ensureUsbIds();
    const enriched = enrichWithUsbIds(devices);

    const rows = compact ? condenseDevices(enriched) : enriched;
    res.json({ count: rows.length, devices: rows });
  } catch (err) {
    next(err);
  }
}
