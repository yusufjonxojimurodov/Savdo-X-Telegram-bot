require("dotenv").config();
const TelegramBot = require("node-telegram-bot-api");

const token = process.env.BOT_TOKEN;
const ADMIN_CHAT_ID = Number(process.env.ADMIN_CHAT_ID);

const bot = new TelegramBot(token, { polling: true });

// Menyu dizayni — 1 tugma 1 qatorda, Markdown bilan sal chiroyliroq
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

// Foydalanuvchi holatlari
const userStates = {}; // userChatId => holat string yoki null
const adminReplyingTo = {}; // adminChatId => userChatId (admin kimga javob yozmoqda)

// /start buyruq uchun
bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;
  const userName = msg.from.first_name || "Foydalanuvchi";

  sendMainMenu(chatId, userName);
  userStates[chatId] = null;
});

// Asosiy xabarlarni qabul qilish
bot.on("message", (msg) => {
  const chatId = msg.chat.id;
  const text = msg.text;
  const userName = msg.from.first_name || "Foydalanuvchi";
  const username = msg.from.username || "username yo‘q";

  // Agar admin javob yozish rejimida bo‘lsa (foydalanuvchiga xabar yuborish)
  if (adminReplyingTo[chatId]) {
    const userChatId = adminReplyingTo[chatId];

    bot.sendMessage(
      userChatId,
      `Admin sizni qabul qildi va quyidagilarni yozdi:\n\n${text}`
    );

    bot.sendMessage(chatId, "Xabaringiz foydalanuvchiga yuborildi.");

    delete adminReplyingTo[chatId];
    return; // boshqa handlerlarga xabar o‘tmasligi uchun
  }

  if (!userStates[chatId]) {
    if (text === "Adminga bog‘lanish") {
      bot.sendMessage(chatId, "Xabaringizni yozing, men adminga yuboraman.");
      userStates[chatId] = "waiting_admin_message";
    } else if (text === "Mahsulot egasidan Shikoyat") {
      bot.sendMessage(
        chatId,
        "Iltimos, shikoyat qilmoqchi bo‘lgan mahsulot nomini va egasining username'ini yuboring:"
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
        `*Savdo X saytida mahsulot sotish* bo‘yicha:\n\nSavdo X saytida mahsulotni sotish togrsda qonunlar bor va Savdo X saytimizdan foydalanayotganingiz o'z mahsulotingizni sotayotganingiz uchun bizga oyiga 35 ming so'm tolashingiz kerak bo'ladi.Rozi bo‘lsangiz va Savdo X qonunlari bilan tanishishni istasangiz, iltimos, menyulardan _Adminga bog‘lanish_ tugmasini bosib, admin bilan bog‘laning.`,
        { parse_mode: "Markdown" }
      );
      userStates[chatId] = null;
    } else if (text.startsWith("/start")) {
      // Hech narsa qilmasdan ketamiz
    } else {
      bot.sendMessage(
        chatId,
        "Iltimos, menyudan tanlang yoki /start buyrug‘ini yuboring."
      );
    }
  } else {
    // Foydalanuvchi hozir xabar yozmoqda, uni adminga yuboramiz

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

    // Admin chatga yuboramiz inline tugmalar bilan
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

// Admin tugmalar bosganida ishlov beramiz
bot.on("callback_query", (callbackQuery) => {
  const msg = callbackQuery.message;
  const data = callbackQuery.data;

  const [action, userChatId] = data.split("_");
  const chatId = parseInt(userChatId);

  if (action === "accept") {
    // Admin foydalanuvchiga javob yozishi uchun holatga o'tamiz
    const adminChatId = callbackQuery.from.id;
    adminReplyingTo[adminChatId] = chatId;

    bot.sendMessage(
      adminChatId,
      `Siz foydalanuvchini qabul qildingiz.\n\nIltimos, foydalanuvchiga jo'natmoqchi bo'lgan xabaringizni yozing:`
    );
  } else if (action === "reject") {
    bot.sendMessage(chatId, "Admin sizning xabaringizni o‘tkazib yubordi ❌");
    bot.sendMessage(ADMIN_CHAT_ID, "Siz foydalanuvchini o‘tkazdingiz.");
  }

  bot.answerCallbackQuery(callbackQuery.id);
});
