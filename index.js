import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import morgan from 'morgan';
import authRouter from './routes/auth.routes.js';

dotenv.config();

// express
const app = express();
const __filename = fileURLToPath(import.meta.url); 
const __dirname = path.dirname(__filename);

// view engine
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');

// Static & parsers
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.urlencoded({ extended: true })); // parse application/x-www-form-urlencoded
app.use(express.json()); // phòng khi cần JSON
app.use(morgan('dev'));

app.use('/', authRouter);

app.use((req, res) => {
  res.status(404).render('layout', {
    title: 'Not Found',
    body: `<div class="card"><h2>404</h2><p>Không tìm thấy trang.</p></div>`
  });
});

app.use((err, req, res, next) => {
  console.error(err);
  const msg = process.env.NODE_ENV === 'production' ? 'Có lỗi xảy ra' : err.message;
  res.status(500).render('layout', {
    title: 'Error',
    body: `<div class="card error"><h2>Lỗi</h2><p>${msg}</p></div>`
  });
});


const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Kiosk login: http://localhost:${PORT}`);
});