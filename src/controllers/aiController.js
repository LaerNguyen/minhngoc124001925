const { GoogleGenerativeAI } = require('@google/generative-ai');
const Product = require('../models/Product');

// [POST] /api/ai/chat
exports.chatWithAI = async (req, res) => {
  try {
    // 1. Kiểm tra nội dung câu hỏi từ client
    const rawMessage = req.body?.message;

    if (typeof rawMessage !== 'string' || !rawMessage.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Vui lòng nhập câu hỏi!'
      });
    }

    const message = rawMessage.trim();
    const lowerMsg = message.toLowerCase();

    // 2. Lấy dữ liệu sản phẩm từ MongoDB Atlas (Kỹ thuật RAG)
    const products = await Product.find()
      .populate('category', 'name')
      .select('name salePrice originalPrice stock rating description category')
      .lean();

    // Chuẩn hóa dữ liệu để tránh lỗi khi trường bị trống
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

    // 3. Xây dựng danh mục sản phẩm đưa vào Context Prompt cho AI
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

DANH SÁCH SẢN PHẨM HIỆN CÓ TRONG CỬA HÀNG:
${productCatalog || 'Hiện chưa có dữ liệu sản phẩm.'}

QUY TẮC PHẢN HỒI:
1. Xưng em hoặc shop, gọi khách là bạn.
2. Chỉ tư vấn các sản phẩm có trong danh sách trên.
3. Tuyệt đối không tự bịa tên sản phẩm, giá bán hoặc số lượng tồn kho.
4. Nếu không có sản phẩm phù hợp với yêu cầu của khách, hãy nói rõ và gợi ý khách xem các sản phẩm khác.
5. Khi nhắc tới giá, hãy ghi rõ đơn vị VNĐ.
6. Mời khách bấm nút Thêm vào giỏ hàng để mua.
7. Trả lời bằng tiếng Việt, thân thiện, lịch sự và ngắn gọn.
`;

    // 4. Ưu tiên sử dụng Google Gemini API
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

        // Tách thành 2 dòng riêng biệt để tránh lỗi cú pháp
        const result = await model.generateContent(message);
        const reply = result.response.text();

        if (reply && reply.trim()) {
          return res.status(200).json({
            success: true,
            provider: 'Google Gemini',
            reply: reply.trim()
          });
        }
      } catch (err) {
        console.error(
          'Gemini API gặp lỗi, chuyển sang cơ chế dự phòng (Fallback):',
          err.message
        );
      }
    }

    // 5. Chế độ dự phòng (Fallback / Smart Engine) khi Gemini gặp sự cố
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
        'Chào bạn! Hiện shop chưa có dữ liệu sản phẩm để tư vấn. Bạn vui lòng thử lại sau nhé!';
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
    console.error('Lỗi hệ thống chatWithAI:', error);

    return res.status(500).json({
      success: false,
      message: 'Trợ lý AI gặp lỗi khi xử lý yêu cầu. Vui lòng thử lại sau.'
    });
  }
};