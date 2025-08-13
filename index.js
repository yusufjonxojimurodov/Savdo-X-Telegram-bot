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
const blockedUsers = {};
const usersInfo = {};

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

function sendAdminMenu(chatId) {
  const text = "Xush kelibsiz, Admin! Quyidagi menyudan tanlang:";
  bot.sendMessage(chatId, text, {
    reply_markup: {
      keyboard: [
        ["Adminga bog‘lanish📲"],
        ["Mahsulot egasidan Shikoyat⚠️"],
        ["Saytdagi Muammolar🐞"],
        ["Saytimizga takliflar📃"],
        ["Savdo X saytida mahsulot sotish🛒"],
        ["Foydalanuvchilar ro'yxati"],
      ],
      resize_keyboard: true,
      one_time_keyboard: true,
    },
  });
}

bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;
  const userName = msg.from.first_name || "Foydalanuvchi";
  const username = msg.from.username || "username yo‘q";

  usersInfo[chatId] = { username, first_name: userName };

  if (blockedUsers[chatId]) {
    bot.sendMessage(
      chatId,
      "Siz blocklangansiz ❌. Faqat /start buyrug‘ini yuborishingiz mumkin."
    );

    bot.sendMessage(
      ADMIN_CHAT_ID,
      `Blocklangan foydalanuvchi @${username} botga xabar yozmoqchi. Blockdan chiqarilsinmi?`,
      {
        reply_markup: {
          inline_keyboard: [
            [{ text: "Yo‘q ❌", callback_data: `deny_${chatId}` }],
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

  if (chatId === ADMIN_CHAT_ID) sendAdminMenu(chatId);
  else sendMainMenu(chatId, userName);

  userStates[chatId] = null;
});

bot.on("message", (msg) => {
  const chatId = msg.chat.id;
  const text = msg.text; // text bo'lmasa undefined
  const username = msg.from.username || msg.from.first_name || "username yo‘q";

  if (blockedUsers[chatId]) return;

  // Agar foydalanuvchi text bo'lmagan xabar yuborsa
  if (!text) {
    bot.sendMessage(
      chatId,
      "Iltimos, menyudan tanlang yoki /start buyrug‘ini yuboring."
    );
    return;
  }

  // Admin javob yozayotgan bo'lsa
  if (chatId === ADMIN_CHAT_ID && adminReplyingTo[chatId]) {
    const target = adminReplyingTo[chatId];

    if (target === "all") {
      Object.keys(usersInfo).forEach((uid) => {
        bot.sendMessage(parseInt(uid), `Admindan xabar:\n\n${text}`);
      });
      bot.sendMessage(chatId, "Xabar barcha foydalanuvchilarga yuborildi ✅");
    } else {
      bot.sendMessage(target, `Admindan xabar:\n\n${text}`);
      bot.sendMessage(chatId, "Xabaringiz foydalanuvchiga yuborildi ✅");
    }

    delete adminReplyingTo[chatId];
    return;
  }

  const userMenus = [
    "Adminga bog‘lanish📲",
    "Mahsulot egasidan Shikoyat⚠️",
    "Saytdagi Muammolar🐞",
    "Saytimizga takliflar📃",
    "Savdo X saytida mahsulot sotish🛒",
  ];
  const adminMenus = [...userMenus, "Foydalanuvchilar ro'yxati"];
  const currentMenus = chatId === ADMIN_CHAT_ID ? adminMenus : userMenus;

  if (currentMenus.includes(text)) {
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
      case "Foydalanuvchilar ro'yxati":
        if (chatId === ADMIN_CHAT_ID) {
          const buttons = Object.entries(usersInfo).map(([id, info]) => {
            return [
              { text: `${info.username} (${id})`, callback_data: `msg_${id}` },
            ];
          });
          buttons.push([
            {
              text: "Barcha foydalanuvchilarga xabar yuborish",
              callback_data: "broadcast_all",
            },
          ]);
          bot.sendMessage(chatId, "Foydalanuvchilar ro'yxati:", {
            reply_markup: { inline_keyboard: buttons },
          });
        }
        break;
    }
    return;
  }

  if (userStates[chatId]) {
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

    bot.sendMessage(chatId, "Xabaringiz adminga yuborildi✅, javobni kuting⌚");
    userStates[chatId] = null;
  }
});

bot.on("callback_query", (callbackQuery) => {
  const data = callbackQuery.data;

  if (data.startsWith("msg_")) {
    const userId = parseInt(data.split("_")[1]);
    adminReplyingTo[callbackQuery.from.id] = userId;
    bot.sendMessage(
      callbackQuery.from.id,
      `Foydalanuvchi @${usersInfo[userId].username} ga xabar yozing:`
    );
  } else if (data === "broadcast_all") {
    adminReplyingTo[callbackQuery.from.id] = "all";
    bot.sendMessage(
      callbackQuery.from.id,
      "Barcha foydalanuvchilarga xabar yozing:"
    );
  } else {
    const [action, userChatId] = data.split("_");
    const chatId = parseInt(userChatId);

    if (action === "accept") {
      const adminChatId = callbackQuery.from.id;
      adminReplyingTo[adminChatId] = chatId;
      bot.sendMessage(
        adminChatId,
        "Siz foydalanuvchini qabul qildingiz. Xabaringizni yozing:"
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
      bot.sendMessage(chatId, "Siz blockdan chiqarildingiz ✅");
      bot.sendMessage(
        ADMIN_CHAT_ID,
        `Foydalanuvchi ${chatId} blockdan chiqarildi`
      );
    } else if (action === "deny") {
      bot.sendMessage(chatId, "Siz blocklangansiz ❌");
      bot.sendMessage(ADMIN_CHAT_ID, `Foydalanuvchi ${chatId} blocklangansiz`);
    }
  }

  bot.answerCallbackQuery(callbackQuery.id);
});

app.listen(PORT, () => {
  console.log(`Server ${PORT} portda ishlayapti ✅`);
});
