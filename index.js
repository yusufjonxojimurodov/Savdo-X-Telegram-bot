require("dotenv").config();
const TelegramBot = require("node-telegram-bot-api");
const express = require("express");
const bodyParser = require("body-parser");

const token = process.env.BOT_TOKEN;
const ADMIN_CHAT_ID = Number(process.env.ADMIN_CHAT_ID);
const PORT = process.env.PORT || 3000; 
const URL = process.env.URL || "https://your-domain.com";

const bot = new TelegramBot(token, { webHook: true });
bot.setWebHook(`${URL}/bot${token}`);

const app = express();
app.use(bodyParser.json());

app.post(`/bot${token}`, (req, res) => {
  bot.processUpdate(req.body);
  res.sendStatus(200);
});

const userStates = {};
const adminReplyingTo = {};

function sendMainMenu(chatId, userName) {
  const text = `*Salom ${userName}!* \nSavdo X telegram botiga Xush Kelibsiz!\n\nQuyidagi menyulardan birini tanlang:`;
  const options = {
    parse_mode: "Markdown",
    reply_markup: {
      keyboard: [
        ["Adminga bog‘lanish"],
        ["Mahsulot egasidan Shikoyat"],
        ["Saytdagi Muammolar"],
        ["Saytimizga takliflar"],
        ["Savdo X saytida mahsulot sotish"],
      ],
      resize_keyboard: true,
      one_time_keyboard: true,
    },
  };
  bot.sendMessage(chatId, text, options);
}

bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;
  const userName = msg.from.first_name || "Foydalanuvchi";
  sendMainMenu(chatId, userName);
  userStates[chatId] = null;
});

bot.on("message", (msg) => {
  const chatId = msg.chat.id;
  const text = msg.text;
  const username = msg.from.username || "username yo‘q";

  if (adminReplyingTo[chatId]) {
    const userChatId = adminReplyingTo[chatId];
    bot.sendMessage(userChatId, `Admin javobi:\n\n${text}`);
    bot.sendMessage(chatId, "Xabaringiz foydalanuvchiga yuborildi.");
    delete adminReplyingTo[chatId];
    return;
  }

  if (!userStates[chatId]) {
    if (text === "Adminga bog‘lanish") {
      bot.sendMessage(chatId, "Xabaringizni yozing, men adminga yuboraman.");
      userStates[chatId] = "waiting_admin_message";
    } else if (text === "Mahsulot egasidan Shikoyat") {
      bot.sendMessage(
        chatId,
        "Iltimos, shikoyat qilmoqchi bo‘lgan mahsulot nomi va egasining username'ini yuboring:"
      );
      userStates[chatId] = "waiting_complaint";
    } else if (text === "Saytdagi Muammolar") {
      bot.sendMessage(
        chatId,
        "Saytdagi muammolar haqida yozing, tez orada ko‘rib chiqamiz."
      );
      userStates[chatId] = "waiting_site_issues";
    } else if (text === "Saytimizga takliflar") {
      bot.sendMessage(
        chatId,
        "Takliflaringizni yozing, biz ularga albatta e'tibor beramiz."
      );
      userStates[chatId] = "waiting_suggestions";
    } else if (text === "Savdo X saytida mahsulot sotish") {
      bot.sendMessage(
        chatId,
        `*Savdo X saytida mahsulot sotish* bo‘yicha:\n\nSavdo X saytida mahsulotni sotish to‘g‘risida qonunlar bor va Savdo X saytimizdan foydalanayotganingiz uchun oyiga 35 ming so‘m to‘lashingiz kerak. Rozi bo‘lsangiz, "Adminga bog‘lanish" tugmasini bosing.`,
        { parse_mode: "Markdown" }
      );
      userStates[chatId] = null;
    } else if (text.startsWith("/start")) {
    } else {
      bot.sendMessage(
        chatId,
        "Iltimos, menyudan tanlang yoki /start buyrug‘ini yuboring."
      );
    }
  } else {
    let forwardedMessage = "";
    switch (userStates[chatId]) {
      case "waiting_admin_message":
        forwardedMessage = `Foydalanuvchi @${username} dan adminga xabar:\n\n${text}`;
        break;
      case "waiting_complaint":
        forwardedMessage = `Foydalanuvchi @${username} dan mahsulot egasidan shikoyat:\n\n${text}`;
        break;
      case "waiting_site_issues":
        forwardedMessage = `Foydalanuvchi @${username} dan saytdagi muammolar:\n\n${text}`;
        break;
      case "waiting_suggestions":
        forwardedMessage = `Foydalanuvchi @${username} dan sayt takliflari:\n\n${text}`;
        break;
      default:
        bot.sendMessage(chatId, "Nimadir noto‘g‘ri ketdi, /start ni bosing.");
        userStates[chatId] = null;
        return;
    }

    bot.sendMessage(ADMIN_CHAT_ID, forwardedMessage, {
      reply_markup: {
        inline_keyboard: [
          [
            { text: "Qabul qilaman", callback_data: `accept_${chatId}` },
            { text: "O'tkazaman", callback_data: `reject_${chatId}` },
          ],
        ],
      },
    });

    bot.sendMessage(chatId, "Xabaringiz adminga yuborildi, javobni kuting.");
    userStates[chatId] = null;
  }
});

bot.on("callback_query", (callbackQuery) => {
  const data = callbackQuery.data;
  const [action, userChatId] = data.split("_");
  const chatId = parseInt(userChatId);

  if (action === "accept") {
    const adminChatId = callbackQuery.from.id;
    adminReplyingTo[adminChatId] = chatId;
    bot.sendMessage(
      adminChatId,
      "Siz foydalanuvchini qabul qildingiz.\n\nIltimos, foydalanuvchiga jo'natmoqchi bo'lgan xabaringizni yozing:"
    );
  } else if (action === "reject") {
    bot.sendMessage(chatId, "Admin sizning xabaringizni bekor qildi ❌");
    bot.sendMessage(ADMIN_CHAT_ID, "Siz foydalanuvchini bekor qildingiz.");
  }

  bot.answerCallbackQuery(callbackQuery.id);
});

app.listen(PORT, () => {
  console.log(`Server ${PORT} portda ishlayapti ✅`);
});
