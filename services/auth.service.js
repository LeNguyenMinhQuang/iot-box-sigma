import axiosClient from '../axios/axiosClient.js';

const ts = () => {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
};

export const handleLoginService = async (req, res) => {
  const code = (req.body.employeeCode || '').trim();
  if (!code) {
    return res.status(400).render('login', {
      title: 'Đăng nhập lại',
      error: 'Vui lòng nhập mã nhân viên!',
      lastCode: ''
    });
  }

  try {
    // 1) VERIFY: GET /verify/{code} → boolean
    const url = `${process.env.VERIFY_PATH}/${code}`;
    const { data: isValid } = await axiosClient.get(url);

    if (!isValid) {
      return res.status(401).render('login', {
        title: 'Đăng nhập',
        error: 'Mã nhân viên không hợp lệ!',
        lastCode: code
      });
    }

    // 2) LOG: POST (không chặn redirect nếu lỗi)
    await axiosClient.post(process.env.CREATE_LOG_PATH, {
      SVNCODE: code,
      Date: ts(),
      Area: process.env.AREA_NAME || ''
    }).catch(() => { /* bỏ qua lỗi log */ });

    // 3) REDIRECT
    return res.redirect(302, process.env.KIOSK_URL);

  } catch (e) {
    const status = e?.response?.status;
    const msg = e?.message || 'Không thể kết nối server!';
    return res.status(502).render('login', {
      title: 'Đăng nhập',
      error: status ? `Lỗi kết nối: ${status} - ${msg}` : `Lỗi kết nối: ${msg}`,
      lastCode: code
    });
  }
}