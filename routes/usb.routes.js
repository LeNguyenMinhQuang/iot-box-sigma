// routes/usb.routes.js
import { Router } from 'express';
import { renderUsbPage, apiUsbDevices } from '../controllers/usb.controller.js';

const router = Router();

router.get('/', renderUsbPage);       // GET /usb  -> trang bảng thiết bị
router.get('/api', apiUsbDevices);    // GET /usb/api -> JSON

export default router;
