import 'dotenv/config';
import axios from 'axios';


// Không gọi dotenv ở đây; load .env duy nhất ở server.js là đủ
const axiosClient = axios.create({
  baseURL: process.env.API_BASE_URL,  // ví dụ: http://10.10.99.10:8102/api
  timeout: 10_000,
  // headers: { 'Content-Type': 'application/json' }
});

// (tuỳ) gắn API key cho upstream
axiosClient.interceptors.request.use((config) => {
  // const key = process.env.PI_PASSWORD;
  // if (key) config.headers['x-api-key'] = key;
  return config;
});

// Log lỗi gọn, không làm rơi exception
axiosClient.interceptors.response.use(
  (res) => res,
  (err) => {
    const st = err.response?.status;
    const url = err.config?.url;
    console.error('Upstream error:', st || '', url || '', err.message);
    return Promise.reject(err);
  }
);

export default axiosClient;