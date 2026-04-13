const TelegramBot = require("node-telegram-bot-api");
const bot = new TelegramBot(process.env.BOT_TOKEN, { polling: true });

let users = {};
let products = {};

const ADMIN_USER = "Guillermo65";
const ADMIN_PASS = "Guillermito00.";

// START
bot.onText(/\/start/, (msg) => {
  bot.sendMessage(msg.chat.id, "🏠 Menú", {
    reply_markup: {
      inline_keyboard: [
        [{ text: "🛒 Productos", callback_data: "productos" }],
        [{ text: "🔐 Login Admin", callback_data: "login" }]
      ]
    }
  });
});

// BOTONES
bot.on("callback_query", (query) => {
  const chatId = query.message.chat.id;
  const data = query.data;

  if (!users[chatId]) users[chatId] = {};
  let state = users[chatId];

  // LOGIN
  if (data === "login") {
    state.step = "login_user";
    bot.sendMessage(chatId, "Usuario:");
  }

  // PRODUCTOS
  if (data === "productos") {
    let botones = Object.keys(products).map(p => [
      { text: p, callback_data: "ver_" + p }
    ]);

    bot.sendMessage(chatId, "Elige producto:", {
      reply_markup: {
        inline_keyboard: [
          ...botones,
          [{ text: "⬅️ Atrás", callback_data: "menu" }]
        ]
      }
    });
  }

  // VER PRODUCTO
  if (data.startsWith("ver_")) {
    let nombre = data.replace("ver_", "");

    let botones = products[nombre].map((p, i) => [
      {
        text: `${p.dias} días - $${p.precio}`,
        callback_data: "nada"
      }
    ]);

    bot.sendMessage(chatId, `📦 ${nombre}`, {
      reply_markup: {
        inline_keyboard: [
          ...botones,
          [{ text: "⬅️ Atrás", callback_data: "productos" }]
        ]
      }
    });
  }

  // MENU
  if (data === "menu") {
    bot.sendMessage(chatId, "🏠 Menú", {
      reply_markup: {
        inline_keyboard: [
          [{ text: "🛒 Productos", callback_data: "productos" }],
          [{ text: "🔐 Login Admin", callback_data: "login" }]
        ]
      }
    });
  }

  // PANEL ADMIN
  if (data === "panel") {
    bot.sendMessage(chatId, "⚙️ Panel Admin", {
      reply_markup: {
        inline_keyboard: [
          [{ text: "➕ Crear producto", callback_data: "crear" }],
          [{ text: "⬅️ Menú", callback_data: "menu" }]
        ]
      }
    });
  }

  // CREAR PRODUCTO
  if (data === "crear") {
    state.step = "crear_nombre";
    bot.sendMessage(chatId, "Nombre del producto:");
  }

  // DURACIONES
  if (data.startsWith("dias_")) {
    let dias = data.replace("dias_", "");
    state.dias = dias;
    state.step = "precio";
    bot.sendMessage(chatId, `Precio para ${dias} días:`);
  }
});

// MENSAJES
bot.on("message", (msg) => {
  const chatId = msg.chat.id;
  if (!users[chatId]) users[chatId] = {};
  let state = users[chatId];

  // LOGIN USER
  if (state.step === "login_user") {
    state.username = msg.text;
    state.step = "login_pass";
    bot.sendMessage(chatId, "Contraseña:");
    return;
  }

  // LOGIN PASS
  if (state.step === "login_pass") {
    if (
      state.username === ADMIN_USER &&
      msg.text === ADMIN_PASS
    ) {
      state.admin = true;
      state.step = null;

      bot.sendMessage(chatId, "✅ Admin activo", {
        reply_markup: {
          inline_keyboard: [
            [{ text: "➕ Crear producto", callback_data: "crear" }]
          ]
        }
      });
    } else {
      bot.sendMessage(chatId, "❌ Incorrecto");
    }
    return;
  }

  // CREAR NOMBRE
  if (state.step === "crear_nombre") {
    state.producto = msg.text;
    products[state.producto] = [];

    state.step = "elegir_dias";

    bot.sendMessage(chatId, "Selecciona duración:", {
      reply_markup: {
        inline_keyboard: [
          [{ text: "1 día", callback_data: "dias_1" }],
          [{ text: "7 días", callback_data: "dias_7" }],
          [{ text: "15 días", callback_data: "dias_15" }],
          [{ text: "30 días", callback_data: "dias_30" }]
        ]
      }
    });
    return;
  }

  // PRECIO
  if (state.step === "precio") {
    products[state.producto].push({
      dias: state.dias,
      precio: msg.text
    });

    bot.sendMessage(chatId, "✅ Precio agregado");

    state.step = null;
    return;
  }
});

console.log("Bot activo 🚀");
