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
    "Sunny": "Trời Nắng ☀️", "Mostly sunny": "Nhiều Nắng ☀️",
    "Partly sunny": "Nắng Vài Nơi ⛅", "Rain showers": "Mưa Rào 🌧️",
    "T-Storms": "Có Bão ⛈️", "Light rain": "Mưa Nhỏ 🌦️",
    "Mostly cloudy": "Trời Nhiều Mây ☁️", "Rain": "Trời Mưa 🌧️",
    "Heavy T-Storms": "Bão Lớn ⛈️", "Partly cloudy": "Mây Rải Rác ⛅",
    "Mostly clear": "Trời Trong Xanh 🌤️", "Cloudy": "Trời Nhiều Mây ☁️",
    "Clear": "Trời Trong Xanh ☀️", "Overcast": "Trời U Ám ☁️",
    "Moderate or heavy rain shower": "Mưa Vừa hoặc To 🌧️",
    "Light rain shower": "Mưa Rào Nhẹ 🌦️",
    "Light drizzle": "Mưa Phùn Nhẹ 💧", "Drizzle": "Mưa Phùn 💧",
    "Heavy rain": "Mưa Lớn 🌧️", "Moderate rain": "Mưa Vừa 🌧️",
    "Snow": "Tuyết ❄️", "Light snow": "Tuyết Nhẹ ❄️", "Heavy snow": "Tuyết Lớn ❄️",
    "Mist": "Sương Mù 🌫️", "Fog": "Sương Mù Dày 🌫️",
    "Freezing fog": "Sương Mù Lạnh Giá 🌫️",
};

// START
bot.onText(/\/start/, (msg) => {
    bot.sendMessage(msg.chat.id,
        `👋 <b>Chào ${msg.from.first_name}!</b>\n\n` +
        `🌡️ <code>/thoitiet thanh hoa</code>\n` +
        `🎵 <code>/sing em cua ngay hom qua</code>\n\n` +
        `/help - Xem hướng dẫn`,
        { parse_mode: "HTML" }
    );
});

// HELP
bot.onText(/\/help/, (msg) => {
    bot.sendMessage(msg.chat.id,
        `<b>📖 Hướng dẫn</b>\n\n` +
        `<b>🌡️ Thời tiết:</b> <code>/thoitiet ten thanh pho</code>\n` +
        `<b>🎵 Tải nhạc:</b> <code>/sing ten bai hat</code>\n\n` +
        `/start - Giới thiệu`,
        { parse_mode: "HTML" }
    );
});

// THOITIET
bot.onText(/\/thoitiet (.+)/, async (msg, match) => {
    const chatId = msg.chat.id;
    const city = match[1].trim();
    const cityNoTone = removeVietnameseTones(city);
    bot.sendChatAction(chatId, "typing");
    try {
        const res = await axios.get("http://api.weatherapi.com/v1/current.json", {
            params: { key: WEATHER_API_KEY, q: cityNoTone }
        });
        const w = res.data.current;
        const l = res.data.location;
        const time = moment().tz(l.tz_id).format("HH:mm - DD/MM/YYYY");
        let cond = weatherTranslations[w.condition.text] || w.condition.text;
        const text =
            `<b>🌍 ${city}, ${l.country}</b>\n<i>📅 ${time}</i>\n\n` +
            `🌡 Nhiệt độ: <b>${w.temp_c}°C</b>\n` +
            `✨ Cảm giác: <b>${w.feelslike_c}°C</b>\n` +
            `📌 ${cond}\n` +
            `💧 Ẩm: ${w.humidity}% | ☁️ Mây: ${w.cloud}%\n` +
            `🌪️ Gió: ${w.wind_kph} km/h | 🧬 UV: ${w.uv}`;
        bot.sendMessage(chatId, text, { parse_mode: "HTML" });
    } catch {
        bot.sendMessage(chatId, `❌ Không tìm thấy "${city}"`);
    }
});

bot.onText(/\/thoitiet$/, (msg) => {
    bot.sendMessage(msg.chat.id, "⚠️ <code>/thoitiet ha noi</code>", { parse_mode: "HTML" });
});

// SING
bot.onText(/\/sing (.+)/, async (msg, match) => {
    const chatId = msg.chat.id;
    const query = match[1].trim();
    bot.sendChatAction(chatId, "typing");
    try {
        const res = await axios.get("https://www.googleapis.com/youtube/v3/search", {
            params: { part: "snippet", q: query, key: YOUTUBE_API_KEY, maxResults: 5, type: "video" }
        });
        const videos = res.data.items.map((v, i) => ({
            index: i, videoId: v.id.videoId, title: v.snippet.title, channel: v.snippet.channelTitle
        }));
        if (videos.length === 0) return bot.sendMessage(chatId, "❌ Không tìm thấy!");
        searchCache.set(chatId.toString(), videos);
        const keyboard = {
            inline_keyboard: videos.map(v => [{ text: `🎵 ${v.title.substring(0, 50)}`, callback_data: `dl_${v.index}` }])
        };
        let text = `🔍 <b>"${query}"</b>\n\n` + videos.map(v => `🎵 ${v.title}\n📺 ${v.channel}`).join("\n\n");
        text += `\n\n👇 Chọn bài để tải mp3:`;
        bot.sendMessage(chatId, text, { parse_mode: "HTML", reply_markup: keyboard });
    } catch {
        bot.sendMessage(chatId, "❌ Lỗi tìm kiếm!");
    }
});

bot.onText(/\/sing$/, (msg) => {
    bot.sendMessage(msg.chat.id, "⚠️ <code>/sing em cua ngay hom qua</code>", { parse_mode: "HTML" });
});

// CALLBACK TẢI MP3
bot.on("callback_query", async (cb) => {
    const chatId = cb.message.chat.id;
    const data = cb.data;
    bot.answerCallbackQuery(cb.id);
    if (!data.startsWith("dl_")) return;
    const index = parseInt(data.replace("dl_", ""));
    const videos = searchCache.get(chatId.toString());
    if (!videos || !videos[index]) return bot.sendMessage(chatId, "❌ Hết hạn, tìm lại nhé!");
    const v = videos[index];
    const url = `https://www.youtube.com/watch?v=${v.videoId}`;
    const st = await bot.sendMessage(chatId, `⏳ Đang tải: ${v.title}...`);
    const fp = `./temp_${v.videoId}.mp3`;
    try {
        const stream = ytdl(url, { filter: "audioonly", quality: "highestaudio" });
        const writer = fs.createWriteStream(fp);
        stream.pipe(writer);
        writer.on("finish", async () => {
            await bot.sendAudio(chatId, fp, { title: v.title, performer: v.channel, caption: `🎵 ${v.title}\n📺 ${v.channel}`, parse_mode: "HTML" });
            fs.unlinkSync(fp);
            bot.deleteMessage(chatId, st.message_id);
        });
        writer.on("error", () => bot.editMessageText("❌ Lỗi!", { chat_id: chatId, message_id: st.message_id }));
    } catch {
        bot.editMessageText("❌ Không tải được!", { chat_id: chatId, message_id: st.message_id });
    }
});
