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

// State va ro'yxatlar
const userStates = {};
const adminReplyingTo = {};
const blockedUsers = {};

// Foydalanuvchi menyusi
function sendMainMenu(chatId, userName) {
  const text = `*Salom ${userName}!* \nSavdo X telegram botiga Xush Kelibsiz😊!\n\nQuyidagi menyulardan birini tanlang:\n\nOgohlantirish⚠️ \nSavdo X Botimiz test rejimda ishlamoqda noqulayliklar uchun uzr so‘raymiz☹️`;
  const options = {
    parse_mode: "Markdown",
    reply_markup: {
      keyboard: [
        ["Adminga bog‘lanish📲"],
        ["Mahsulot egasidan Shikoyat⚠️"],
        ["Saytdagi Muammolar🐞"],
        ["Saytimizga takliflar📃"],
        ["Savdo X saytida mahsulot sotish🛒"],
      ],
      resize_keyboard: true,
      one_time_keyboard: true,
    },
  };
  bot.sendMessage(chatId, text, options);
}

// /start
bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;
  const userName = msg.from.first_name || "Foydalanuvchi";

  // Admin menyusi
  if (chatId === ADMIN_CHAT_ID) {
    const text = "Xush kelibsiz, Admin! Quyidagi menyudan tanlang:";
    bot.sendMessage(chatId, text, {
      reply_markup: {
        keyboard: [["Foydalanuvchilar ro'yxati"], ["Boshqa admin menyu"]],
        resize_keyboard: true,
        one_time_keyboard: true,
      },
    });
  } else {
    sendMainMenu(chatId, userName);
  }
  userStates[chatId] = null;
});

// message handler
bot.on("message", (msg) => {
  const chatId = msg.chat.id;
  const text = msg.text;
  const username = msg.from.username || msg.from.first_name || "username yo‘q";

  // Agar foydalanuvchi blocklangan bo'lsa
  if (blockedUsers[chatId]) {
    bot.sendMessage(
      ADMIN_CHAT_ID,
      `Blocklangan foydalanuvchi @${username} botga xabar yozmoqchi.\nBlockdan chiqarilsinmi?`,
      {
        reply_markup: {
          inline_keyboard: [
            [{ text: "Yoq ❌", callback_data: `deny_${chatId}` }],
            [
              {
                text: "Blockdan chiqarish ✅",
                callback_data: `unblock_${chatId}`,
              },
            ],
          ],
        },
      }
    );
    return;
  }

  // Admin foydalanuvchilarga xabar yozayotgan bo'lsa
  if (chatId === ADMIN_CHAT_ID && adminReplyingTo[chatId]) {
    const userChatId = adminReplyingTo[chatId];
    bot.sendMessage(userChatId, `Admin javobi:\n\n${text}`);
    bot.sendMessage(chatId, "Xabaringiz foydalanuvchiga yuborildi.");
    delete adminReplyingTo[chatId];
    return;
  }

  // Foydalanuvchi menyusini tanlaganida eski state'ni reset qilish
  const menus = [
    "Adminga bog‘lanish📲",
    "Mahsulot egasidan Shikoyat⚠️",
    "Saytdagi Muammolar🐞",
    "Saytimizga takliflar📃",
    "Savdo X saytida mahsulot sotish🛒",
  ];
  if (menus.includes(text)) userStates[chatId] = null;

  // Foydalanuvchi menyulari
  if (!userStates[chatId]) {
    switch (text) {
      case "Adminga bog‘lanish📲":
        bot.sendMessage(
          chatId,
          "Xabaringizni yozing📝, men adminga yuboraman."
        );
        userStates[chatId] = "waiting_admin_message";
        break;
      case "Mahsulot egasidan Shikoyat⚠️":
        bot.sendMessage(
          chatId,
          "Iltimos, shikoyat qilmoqchi bo‘lgan mahsulot nomi va egasining username'ini yuboring:"
        );
        userStates[chatId] = "waiting_complaint";
        break;
      case "Saytdagi Muammolar🐞":
        bot.sendMessage(
          chatId,
          "Saytdagi muammolar haqida yozing📝, tez orada ko‘rib chiqamiz👀."
        );
        userStates[chatId] = "waiting_site_issues";
        break;
      case "Saytimizga takliflar📃":
        bot.sendMessage(
          chatId,
          "Takliflaringizni yozing, biz ularga albatta e'tibor beramiz😊."
        );
        userStates[chatId] = "waiting_suggestions";
        break;
      case "Savdo X saytida mahsulot sotish🛒":
        bot.sendMessage(
          chatId,
          `*Savdo X saytida mahsulot sotish* bo‘yicha:\n\nSavdo X saytida mahsulotni sotish to‘g‘risida qonunlar bor❗ va Savdo X saytimizdan foydalanayotganingiz uchun oyiga 35 ming so‘m💵 to‘lashingiz kerak. Rozi bo‘lsangiz, "Adminga bog‘lanish📞" tugmasini bosing.`,
          { parse_mode: "Markdown" }
        );
        break;
      default:
        bot.sendMessage(
          chatId,
          "Iltimos, menyudan tanlang yoki /start buyrug‘ini yuboring."
        );
    }
  } else {
    // foydalanuvchi xabar yuboradi va adminga forward qilinadi
    let forwardedMessage = "";
    switch (userStates[chatId]) {
      case "waiting_admin_message":
        forwardedMessage = `Foydalanuvchi @${username}👤 dan adminga xabar:\n\n${text}`;
        break;
      case "waiting_complaint":
        forwardedMessage = `Foydalanuvchi @${username}👤 dan mahsulot egasidan shikoyat:\n\n${text}`;
        break;
      case "waiting_site_issues":
        forwardedMessage = `Foydalanuvchi @${username}👤 dan saytdagi muammolar:\n\n${text}`;
        break;
      case "waiting_suggestions":
        forwardedMessage = `Foydalanuvchi @${username}👤 dan sayt takliflari:\n\n${text}`;
        break;
      default:
        bot.sendMessage(chatId, "Nimadir noto‘g‘ri ketdi☹️, /start ni bosing.");
        userStates[chatId] = null;
        return;
    }

    bot.sendMessage(ADMIN_CHAT_ID, forwardedMessage, {
      reply_markup: {
        inline_keyboard: [
          [
            { text: "Qabul qilaman✅", callback_data: `accept_${chatId}` },
            { text: "Bekor qilaman❌", callback_data: `reject_${chatId}` },
            { text: "Block qilaman🚫", callback_data: `block_${chatId}` },
          ],
        ],
      },
    });

    bot.sendMessage(
      chatId,
      "Xabaringiz adminga yuborildi✅, javobni kuting⌚."
    );
    userStates[chatId] = null;
  }
});

// callback_query handler
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
    bot.sendMessage(ADMIN_CHAT_ID, "Siz foydalanuvchini bekor qildingiz❌.");
  } else if (action === "block") {
    blockedUsers[chatId] = true;
    bot.sendMessage(chatId, "Siz block qilindingiz ❌");
    bot.sendMessage(ADMIN_CHAT_ID, `Foydalanuvchi ${chatId} block qilindi`);
  } else if (action === "unblock") {
    delete blockedUsers[chatId];
    bot.sendMessage(
      chatId,
      "Siz blockdan chiqarildingiz ✅\nBot qonunlariga rioya qiling!"
    );
    bot.sendMessage(
      ADMIN_CHAT_ID,
      `Foydalanuvchi ${chatId} blockdan chiqarildi`
    );
  } else if (action === "deny") {
    bot.sendMessage(chatId, "Siz blocklangansiz ❌");
    bot.sendMessage(ADMIN_CHAT_ID, `Foydalanuvchi ${chatId} blocklangansiz`);
  } else if (action === "message") {
    adminReplyingTo[callbackQuery.from.id] = chatId;
    bot.sendMessage(
      callbackQuery.from.id,
      "Xabar yozing, foydalanuvchiga yuboriladi:"
    );
  }

  bot.answerCallbackQuery(callbackQuery.id);
});

// server
app.listen(PORT, () => {
  console.log(`Server ${PORT} portda ishlayapti ✅`);
});
