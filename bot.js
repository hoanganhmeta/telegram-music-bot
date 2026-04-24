const TelegramBot = require("node-telegram-bot-api");
const ytdl = require("ytdl-core");
const axios = require("axios");
const fs = require("fs");

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY;

const bot = new TelegramBot(BOT_TOKEN, { polling: true });

// Lưu kết quả tìm kiếm tạm
const searchCache = new Map();

console.log("Bot nhạc đã chạy! 🎵");

// Lệnh /start
bot.onText(/\/start/, (msg) => {
    const chatId = msg.chat.id;
    const name = msg.from.first_name;
    
    bot.sendMessage(chatId, 
        `👋 Chào ${name}!\n\n` +
        `🎵 Tôi là Bot Tải Nhạc YouTube\n\n` +
        `📝 Cách dùng:\n` +
        `<code>/sing ten bai hat</code>\n` +
        `VD: <code>/sing em cua ngay hom qua</code>\n\n` +
        `⚡ Bot sẽ tải và gửi file mp3 trực tiếp!`,
        { parse_mode: "HTML" }
    );
});

// Lệnh /sing
bot.onText(/\/sing (.+)/, async (msg, match) => {
    const chatId = msg.chat.id;
    const query = match[1].trim();

    if (!query) {
        return bot.sendMessage(chatId, "⚠️ Nhập tên bài hát!\nVD: /sing em cua ngay hom qua");
    }

    bot.sendChatAction(chatId, "typing");

    try {
        // Tìm kiếm YouTube
        const searchUrl = "https://www.googleapis.com/youtube/v3/search";
        const response = await axios.get(searchUrl, {
            params: {
                part: "snippet",
                q: query,
                key: YOUTUBE_API_KEY,
                maxResults: 5,
                type: "video"
            }
        });

        const videos = response.data.items.map((item, i) => ({
            index: i,
            videoId: item.id.videoId,
            title: item.snippet.title,
            channel: item.snippet.channelTitle
        }));

        if (videos.length === 0) {
            return bot.sendMessage(chatId, "❌ Không tìm thấy kết quả!");
        }

        // Lưu cache
        searchCache.set(chatId.toString(), videos);

        // Tạo nút chọn
        const keyboard = {
            inline_keyboard: videos.map(v => [{
                text: `🎵 ${v.title.substring(0, 50)}`,
                callback_data: `download_${v.index}`
            }])
        };

        let text = `🔍 <b>Kết quả tìm kiếm:</b> "${query}"\n\n`;
        text += videos.map(v => `🎵 ${v.title}\n📺 ${v.channel}`).join("\n\n");
        text += `\n\n👇 <b>Chọn bài để tải mp3:</b>`;

        await bot.sendMessage(chatId, text, {
            parse_mode: "HTML",
            reply_markup: keyboard
        });

    } catch (error) {
        console.error(error);
        bot.sendMessage(chatId, "❌ Lỗi tìm kiếm! Thử lại sau.");
    }
});

// Xử lý nút bấm tải nhạc
bot.on("callback_query", async (callbackQuery) => {
    const chatId = callbackQuery.message.chat.id;
    const data = callbackQuery.data;
    const messageId = callbackQuery.message.message_id;

    bot.answerCallbackQuery(callbackQuery.id);

    if (!data.startsWith("download_")) return;

    const index = parseInt(data.replace("download_", ""));
    const videos = searchCache.get(chatId.toString());

    if (!videos || !videos[index]) {
        return bot.sendMessage(chatId, "❌ Phiên tìm kiếm hết hạn! Tìm lại nhé.");
    }

    const video = videos[index];
    const videoUrl = `https://www.youtube.com/watch?v=${video.videoId}`;

    // Gửi thông báo đang tải
    const statusMsg = await bot.sendMessage(chatId, `⏳ Đang tải: ${video.title}...`);

    try {
        const filePath = `./temp_${video.videoId}.mp3`;

        // Tải audio từ YouTube
        const stream = ytdl(videoUrl, {
            filter: "audioonly",
            quality: "highestaudio"
        });

        const writeStream = fs.createWriteStream(filePath);
        stream.pipe(writeStream);

        writeStream.on("finish", async () => {
            // Gửi file mp3
            await bot.sendAudio(chatId, filePath, {
                title: video.title,
                performer: video.channel,
                caption: `🎵 <b>${video.title}</b>\n📺 ${video.channel}`,
                parse_mode: "HTML"
            });

            // Xóa file tạm
            fs.unlinkSync(filePath);

            // Xóa tin nhắn "đang tải"
            bot.deleteMessage(chatId, statusMsg.message_id);
        });

        writeStream.on("error", (err) => {
            console.error(err);
            bot.editMessageText("❌ Lỗi tải nhạc! Thử lại sau.", {
                chat_id: chatId,
                message_id: statusMsg.message_id
            });
        });

    } catch (error) {
        console.error(error);
        bot.editMessageText("❌ Lỗi tải nhạc! Có thể video quá dài hoặc bị chặn.", {
            chat_id: chatId,
            message_id: statusMsg.message_id
        });
    }
});

// Lệnh /help
bot.onText(/\/help/, (msg) => {
    const chatId = msg.chat.id;
    bot.sendMessage(chatId,
        `<b>📖 Hướng dẫn:</b>\n\n` +
        `<code>/sing ten bai hat</code> - Tìm và tải mp3\n` +
        `<code>/start</code> - Giới thiệu\n` +
        `<code>/help</code> - Hướng dẫn này\n\n` +
        `⚡ <b>Tính năng:</b>\n` +
        `- Tìm kiếm bài hát YouTube\n` +
        `- Hiện danh sách 5 kết quả\n` +
        `- Tải file mp3 chất lượng cao\n` +
        `- Gửi trực tiếp qua Telegram`,
        { parse_mode: "HTML" }
    );
});
