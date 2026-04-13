const TelegramBot = require('node-telegram-bot-api');

const token = process.env.BOT_TOKEN;

const bot = new TelegramBot(token, { polling: true });

// Cuando alguien escribe cualquier cosa
bot.on('message', (msg) => {
    bot.sendMessage(msg.chat.id, "Bot activo 🚀");
});

// Comando /start
bot.onText(/\/start/, (msg) => {
    bot.sendMessage(msg.chat.id, "Bienvenido 🔥");
});
