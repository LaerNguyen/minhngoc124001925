const express = require('express');
const router = express.Router();
const { register, login, getMe } = require('../controllers/authController');

// Định nghĩa các Routes không cần middleware trước để test cho chạy
router.post('/register', register);
router.post('/login', login);

// Nếu chưa có file middleware, tạm thời bỏ qua hoặc dùng trực tiếp getMe
router.get('/me', getMe);

module.exports = router;