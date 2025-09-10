import { handleLoginService } from '../services/auth.service.js';

export const showLogin = (req, res) =>
  res.render('login', { title: 'Đăng nhập', error: null, lastCode: '' });

export const handleLogin = async (req, res) => handleLoginService(req, res);
