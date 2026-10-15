const { GoogleGenerativeAI } = require('@google/generative-ai');
const Product = require('../models/Product');
// [POST] /api/ai/chat
exports.chatWithAI = async (req, res) => {
 try {
 const { message } = req.body;
 if (!message) return res.status(400).json({ success: false, message: 'Vui lòng nhập câuhỏi!' });
 // 1. Lấy dữ liệu sản phẩm mới nhất từ MongoDB Atlas (Kỹ thuật RAG)
 const products = await Product.find().populate('category', 'name').select('namesalePrice originalPrice stock rating description category');
 const productCatalog = products
 .map((p, idx) => `${idx + 1}. Tên: "${p.name}" | Danh mục: ${p.category ?
p.category.name : 'Khác'} | Giá bán: ${Number(p.salePrice).toLocaleString('vi-VN')} đ | Còn
lại: ${p.stock} | Đánh giá: ${p.rating}⭐ | Mô tả: ${p.description}`)
 .join('\n');
 const systemInstruction = `
Bạn là "LHU AI Shopping Assistant" - Trợ lý bán hàng thông minh, thân thiện của Cửa hàng
TMĐT ĐH Lạc Hồng.
DANH SÁCH SẢN PHẨM HIỆN CÓ TRONG KHO:
${productCatalog}
QUY TẮC:
1. Luôn xưng "Em" hoặc "Shop", gọi khách là "Bạn" hoặc "Quý khách".
2. CHỈ gợi ý các sản phẩm có thật trong danh sách trên, nêu rõ giá bán chính xác.
3. Mời khách bấm nút "Thêm giỏ" để đặt hàng.
`;
 const apiKey = process.env.GEMINI_API_KEY;
 // 2. Gọi Google Gemini AI
 if (apiKey && apiKey !== 'AIzaSyDemoKeyYourGeminiApiKeyHere12345') {
 try {
 const genAI = new GoogleGenerativeAI(apiKey);
 const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash',
systemInstruction });
 const result = await model.generateContent(`Khách hàng hỏi: "${message}". Hãy tư
vấn chi tiết.`);
 return res.status(200).json({ success: true, provider: 'Google Gemini 1.5 Flash',
reply: result.response.text() });
 } catch (err) {
 console.warn('Fallback sang chế độ tìm kiếm thông minh.');
 }
 }
 // 3. Chế độ Fallback thông minh dự phòng
 const lowerMsg = message.toLowerCase();
 const matched = products.filter(p => lowerMsg.includes(p.name.toLowerCase()) ||
(lowerMsg.includes('rẻ') && p.salePrice < 300000));
 const list = matched.length > 0 ? matched : products.slice(0, 3);
 let reply = 'Chào Bạn! Shop xin gợi ý các sản phẩm phù hợp nhất cho bạn:\n\n';
 list.forEach(p => {
 reply += `✨ **${p.name}** - Giá: **${Number(p.salePrice).toLocaleString('vi-VN')}đ** (${p.rating}⭐)\n ${p.description}\n\n`;
 });
 reply += 'Bạn có thể bấm vào sản phẩm trên giao diện để đặt mua ngay nhé!';
 res.status(200).json({ success: true, provider: 'Smart Engine', reply });
 } catch (error) {
 res.status(500).json({ success: false, message: error.message });
 }
};