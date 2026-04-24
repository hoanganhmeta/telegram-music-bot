const TelegramBot = require("node-telegram-bot-api");
const ytdl = require("ytdl-core");
const axios = require("axios");
const fs = require("fs");
const moment = require("moment-timezone");

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY;
const WEATHER_API_KEY = "deae5206758c44f38b0184151232208";

const bot = new TelegramBot(BOT_TOKEN, { polling: true });
const searchCache = new Map();

console.log("Bot đã chạy! 🚀");

function removeVietnameseTones(str) {
    return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').replace(/[^\w\s]/gi, '');
}

const weatherTranslations = {
    "Sunny": "Trời Nắng ☀️",
    "Mostly sunny": "Nhiều Nắng ☀️",
    "Partly sunny": "Nắng Vài Nơi ⛅",
    "Rain showers": "Mưa Rào 🌧️",
    "T-Storms": "Có Bão ⛈️",
    "Light rain": "Mưa Nhỏ 🌦️",
    "Mostly cloudy": "Trời Nhiều Mây ☁️",
    "Rain": "Trời Mưa 🌧️",
    "Heavy T-Storms": "Bão Lớn ⛈️",
    "Partly cloudy": "Mây Rải Rác ⛅",
    "Mostly clear": "Trời Trong Xanh 🌤️",
    "Cloudy": "Trời Nhiều Mây ☁️",
    "Clear": "Trời Trong Xanh, Không Mây ☀️",
    "Overcast": "Trời U Ám ☁️",
    "Moderate or heavy rain shower": "Mưa Vừa hoặc To 🌧️",
    "Light rain shower": "Mưa Rào Nhẹ 🌦️",
    "Patchy rain nearby": "Mưa Rào Gần Đó 🌦️",
    "Light drizzle": "Mưa Phùn Nhẹ 💧",
    "Drizzle": "Mưa Phùn 💧",
    "Heavy rain": "Mưa Lớn 🌧️",
    "Moderate rain": "Mưa Vừa 🌧️",
    "Snow": "Tuyết ❄️",
    "Light snow": "Tuyết Nhẹ ❄️",
    "Heavy snow": "Tuyết Lớn ❄️",
    "Mist": "Sương Mù 🌫️",
    "Fog": "Sương Mù Dày 🌫️",
    "Freezing fog": "Sương Mù Lạnh Giá 🌫️",
    "Patchy light rain": "Mưa Nhẹ Rải Rác 🌦️",
    "Patchy heavy rain": "Mưa Lớn Rải Rác 🌧️",
    "Patchy snow nearby": "Tuyết Rải Rác Gần Đó ❄️",
    "Thundery outbreaks possible": "Có Khả Năng Có Bão ⛈️",
};

// ============ /start ============
bot.onText(/\/start/, (msg) => {
    const chatId = msg.chat.id;
    const name = msg.from.first_name;
    
    bot.sendMessage(chatId,
        `👋 <b>Chào ${name}!</b>\n\n` +
        `🌡️ <b>Xem thời tiết:</b>\n<code>/thoitiet thanh hoa</code>\n\n` +
        `🎵 <b>Tải nhạc YouTube:</b>\n<code>/sing em cua ngay hom qua</code>\n\n` +
        `/help - Xem hướng dẫn chi tiết`,
        { parse_mode: "HTML" }
    );
});

// ============ /help ============
bot.onText(/\/help/, (msg) => {
    const chatId = msg.chat.id;
    
    bot.sendMessage(chatId,
        `<b>📖 Hướng dẫn sử dụng</b>\n\n` +
        `<b>🌡️ Xem thời tiết:</b>\n<code>/thoitiet [tên thành phố]</code>\nVD: <code>/thoitiet thanh hoá</code>\n\n` +
        `<b>🎵 Tải nhạc YouTube:</b>\n<code>/sing [tên bài hát]</code>\nVD: <code>/sing em cua ngay hom qua</code>\n\n` +
        `<b>⚡ Lệnh khác:</b>\n/start - Giới thiệu\n/help - Hướng dẫn này`,
        { parse_mode: "HTML" }
    );
});

// ============ /thoitiet ============
bot.onText(/\/thoitiet (.+)/, async (msg, match) => {
    const chatId = msg.chat.id;
    const city = match[1].trim();
    const cityNoTone = removeVietnameseTones(city);

    bot.sendChatAction(chatId, "typing");

    try {
        const res = await axios.get(`http://api.weatherapi.com/v1/current.json`, {
            params: { key: WEATHER_API_KEY, q: cityNoTone }
        });
        const w = res.data.current;
        const l = res.data.location;
        const time = moment().tz(l.tz_id).format("HH:mm - DD/MM/YYYY");
        let cond = weatherTranslations[w.condition.text] || w.condition.text;

        if (!weatherTranslations[w.condition.text]) {
            try {
                const tr = await axios.get("https://api.mymemory.translated.net/get", {
                    params: { q: w.condition.text, langpair: "en|vi" }
                });
                cond = tr.data.responseData.translatedText;
            } catch {}
        }

        const text = 
            `<b>🌍 Thời tiết tại ${city}, ${l.country}</b>\n` +
            `<i>📅 ${time}</i>\n\n` +
            `🌡 Nhiệt độ: <b>${w.temp_c}°C</b> (${w.temp_f}°F)\n` +
            `✨ Cảm giác như: <b>${w.feelslike_c}°C</b>\n` +
            `📌 Dự báo: <b>${cond}</b>\n` +
            `🌪️ Gió: ${w.wind_kph} km/h\n` +
            `💧 Độ ẩm: ${w.humidity}%\n` +
            `☁️ Mây: ${w.cloud}%\n` +
            `🌧️ Mưa: ${w.precip_mm} mm\n` +
            `🧬 UV: ${w.uv}`;

        bot.sendMessage(chatId, text, { parse_mode: "HTML" });

    } catch {
        bot.sendMessage(chatId, `❌ Không tìm thấy thời tiết cho "${city}"`);
    }
});

bot.onText(/\/thoitiet$/, (msg) => {
    bot.sendMessage(msg.chat.id, "⚠️ Nhập tên thành phố!\nVD: <code>/thoitiet ha noi</code>", { parse_mode: "HTML" });
});

// ============ /sing ============
bot.onText(/\/sing (.+)/, async (msg, match) => {
    const chatId = msg.chat.id;
    const query = match[1].trim();

    bot.sendChatAction(chatId, "typing");

    try {
        const res = await axios.get("https://www.googleapis.com/youtube/v3/search", {
            params: {
                part: "snippet", q: query, key: YOUTUBE_API_KEY,
                maxResults: 5, type: "video"
            }
        });

        const videos = res.data.items.map((item, i) => ({
            index: i,
            videoId: item.id.videoId,
            title: item.snippet.title,
            channel: item.snippet.channelTitle
        }));

        if (videos.length === 0) {
            return bot.sendMessage(chatId, "❌ Không tìm thấy!");
        }

        searchCache.set(chatId.toString(), videos);

        const keyboard = {
            inline_keyboard: videos.map(v => [{
                text: `🎵 ${v.title.substring(0, 50)}`,
                callback_data: `down_${v.index}`
            }])
        };

        let text = `🔍 <b>Kết quả cho:</b> "${query}"\n\n`;
        text += videos.map(v => `🎵 ${v.title}\n📺 ${v.channel}`).join("\n\n");
        text += `\n\n👇 <b>Chọn bài để tải mp3:</b>`;

        bot.sendMessage(chatId, text, {
            parse_mode: "HTML",
            reply_markup: keyboard
        });

    } catch {
        bot.sendMessage(chatId, "❌ Lỗi tìm kiếm!");
    }
});

bot.onText(/\/sing$/, (msg) => {
    bot.sendMessage(msg.chat.id, "⚠️ Nhập tên bài hát!\nVD: <code>/sing em cua ngay hom qua</code>", { parse_mode: "HTML" });
});

// ============ TẢI MP3 ============
bot.on("callback_query", async (cb) => {
    const chatId = cb.message.chat.id;
    const data = cb.data;

    bot.answerCallbackQuery(cb.id);

    if (!data.startsWith("down_")) return;

    const index = parseInt(data.replace("down_", ""));
    const videos = searchCache.get(chatId.toString());

    if (!videos || !videos[index]) {
        return bot.sendMessage(chatId, "❌ Hết hạn! Tìm lại nhé.");
    }

    const video = videos[index];
    const url = `https://www.youtube.com/watch?v=${video.videoId}`;

    const status = await bot.sendMessage(chatId, `⏳ Đang tải: ${video.title}...`);

    const filePath = `./temp_${video.videoId}.mp3`;

    try {
        const stream = ytdl(url, { filter: "audioonly", quality: "highestaudio" });
        const writer = fs.createWriteStream(filePath);
        stream.pipe(writer);

        writer.on("finish", async () => {
            await bot.sendAudio(chatId, filePath, {
                title: video.title,
                performer: video.channel,
                caption: `🎵 <b>${video.title}</b>\n📺 ${video.channel}`,
                parse_mode: "HTML"
            });
            fs.unlinkSync(filePath);
            bot.deleteMessage(chatId, status.message_id);
        });

        writer.on("error", () => {
            bot.editMessageText("❌ Lỗi tải!", { chat_id: chatId, message_id: status.message_id });
        });

    } catch {
        bot.editMessageText("❌ Không tải được!", { chat_id: chatId, message_id: status.message_id });
    }
});

// Lệnh không xác định
bot.onText(/^\//, (msg) => {
    bot.sendMessage(msg.chat.id, "❌ Lệnh không xác định!\n/help để xem hướng dẫn.");
});
