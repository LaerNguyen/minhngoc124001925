const { GoogleGenerativeAI } = require('@google/generative-ai');
const Product = require('../models/Product');

// [POST] /api/ai/chat
exports.chatWithAI = async (req, res) => {
  try {
    // 1. Kiểm tra nội dung khách hàng
    const rawMessage = req.body?.message;

    if (typeof rawMessage !== 'string' || !rawMessage.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Vui lòng nhập câu hỏi!'
      });
    }

    const message = rawMessage.trim();
    const lowerMsg = message.toLowerCase();

    // 2. Lấy dữ liệu sản phẩm từ MongoDB
    // Lưu ý: phải có khoảng trắng giữa các tên trường
    const products = await Product.find()
      .populate('category', 'name')
      .select('name salePrice originalPrice stock rating description category')
      .lean();

    // Chuẩn hóa dữ liệu để tránh lỗi khi trường bị thiếu
    const safeProducts = products.map((p) => ({
      ...p,
      name: typeof p.name === 'string' ? p.name : '',
      salePrice: Number(p.salePrice) || 0,
      stock: Number(p.stock) || 0,
      rating: Number(p.rating) || 0,
      description:
        typeof p.description === 'string' ? p.description : 'Chưa có mô tả',
      categoryName:
        typeof p.category?.name === 'string'
          ? p.category.name
          : 'Khác'
    }));

    // 3. Tạo danh sách sản phẩm cho Gemini
    const productCatalog = safeProducts
      .filter((p) => p.name)
      .map((p, idx) =>
        `${idx + 1}. Tên: "${p.name}"` +
        ` | Danh mục: ${p.categoryName}` +
        ` | Giá bán: ${p.salePrice.toLocaleString('vi-VN')} đ` +
        ` | Tồn kho: ${p.stock}` +
        ` | Đánh giá: ${p.rating} sao` +
        ` | Mô tả: ${p.description}`
      )
      .join('\n');

    const systemInstruction = `
Bạn là LHU AI Shopping Assistant của Cửa hàng TMĐT Đại học Lạc Hồng.

DANH SÁCH SẢN PHẨM:
${productCatalog || 'Hiện chưa có dữ liệu sản phẩm.'}

QUY TẮC:
1. Xưng em hoặc shop, gọi khách là bạn.
2. Chỉ tư vấn sản phẩm có trong danh sách.
3. Không tự bịa tên, giá bán hoặc số lượng tồn kho.
4. Nếu không có sản phẩm phù hợp, hãy nói rõ và hỏi thêm nhu cầu.
5. Nếu khách hỏi giá, hãy ghi giá bằng VNĐ.
6. Mời khách bấm nút Thêm giỏ để đặt hàng.
7. Trả lời bằng tiếng Việt, thân thiện và dễ hiểu.
`;

    // 4. Ưu tiên sử dụng Google Gemini
    const apiKey = process.env.GEMINI_API_KEY;

    if (
      apiKey &&
      !apiKey.includes('YourGeminiApiKeyHere') &&
      apiKey !== 'YOUR_GEMINI_API_KEY'
    ) {
      try {
        const genAI = new GoogleGenerativeAI(apiKey);

        const model = genAI.getGenerativeModel({
          model: 'gemini-1.5-flash',
          systemInstruction
        });

        const result = await model.generateContent(message);const reply = result.response.text();

        if (reply && reply.trim()) {
          return res.status(200).json({
            success: true,
            provider: 'Google Gemini',
            reply: reply.trim()
          });
        }
      } catch (err) {
        console.error(
          'Gemini API lỗi, chuyển sang chế độ dự phòng:',
          err.message
        );
      }
    }

    // 5. Chế độ dự phòng khi Gemini không khả dụng
    const validProducts = safeProducts.filter(
      (p) => p.name && p.salePrice >= 0
    );

    const matched = validProducts.filter((p) => {
      const productName = p.name.toLowerCase();

      return (
        lowerMsg.includes(productName) ||
        (lowerMsg.includes('rẻ') && p.salePrice < 300000)
      );
    });

    const list = (matched.length ? matched : validProducts).slice(0, 3);

    let reply;

    if (!list.length) {
      reply =
        'Chào bạn! Hiện shop chưa có dữ liệu sản phẩm để tư vấn. ' +
        'Bạn vui lòng thử lại sau nhé!';
    } else {
      reply = matched.length
        ? 'Chào bạn! Đây là sản phẩm phù hợp với câu hỏi của bạn:\n\n'
        : 'Chào bạn! Shop xin giới thiệu một số sản phẩm hiện có:\n\n';

      list.forEach((p) => {
        reply +=
          `• ${p.name}\n` +
          `Giá: ${p.salePrice.toLocaleString('vi-VN')} đ\n` +
          `Đánh giá: ${p.rating} sao\n` +
          `Mô tả: ${p.description}\n\n`;
      });

      reply += 'Bạn có thể chọn sản phẩm và bấm Thêm giỏ để đặt hàng nhé!';
    }

    return res.status(200).json({
      success: true,
      provider: 'Smart Engine',
      reply
    });
  } catch (error) {
    console.error('Lỗi chatWithAI:', error);

    return res.status(500).json({
      success: false,
      message: 'Trợ lý AI gặp lỗi khi xử lý yêu cầu. Vui lòng thử lại sau.'
    });
  }
};
