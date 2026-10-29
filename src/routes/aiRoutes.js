const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config();

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// --- KHAI BÁO CÁC ROUTE KHÁC (ví dụ) ---
// const productRoutes = require('./src/routes/productRoutes');
// app.use('/api/products', productRoutes);

// --- NẠP ROUTE AI CHATBOT (QUAN TRỌNG) ---
const aiRoutes = require('./src/routes/aiRoutes');
app.use('/api/ai', aiRoutes);

// Khởi động server & kết nối CSDL
const PORT = process.env.PORT || 5000;
mongoose
  .connect(process.env.MONGODB_URI)
  .then(() => {
    console.log('Đã kết nối thành công với MongoDB Atlas!');
    app.listen(PORT, () => {
      console.log(`Server đang lắng nghe tại cổng ${PORT}`);
    });
  })
  .catch((err) => {
    console.error('Lỗi kết nối CSDL:', err.message);
  });