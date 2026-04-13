const TelegramBot = require("node-telegram-bot-api");
const bot = new TelegramBot(process.env.BOT_TOKEN, { polling: true });

// BASE DE DATOS (temporal)
let users = {};
let products = {};

// ADMIN
const ADMIN_USER = "Guillermo65";
const ADMIN_PASS = "Guillermito00.";

// ===== MENÚ =====
function menu(chatId) {
  bot.sendMessage(chatId, "🏠 Menú", {
    reply_markup: {
      inline_keyboard: [
        [{ text: "🛒 Productos", callback_data: "productos" }],
        [{ text: "💰 Mi cuenta", callback_data: "cuenta" }],
        [{ text: "📜 Historial", callback_data: "historial" }],
        [{ text: "🎁 Código Promo", callback_data: "promo" }],
        [{ text: "🔐 Login Admin", callback_data: "login" }]
      ]
    }
  });
}

// START
bot.onText(/\/start/, (msg) => {
  menu(msg.chat.id);
});

// ===== BOTONES =====
bot.on("callback_query", (q) => {
  const chatId = q.message.chat.id;
  const data = q.data;

  if (!users[chatId]) users[chatId] = {};
  let state = users[chatId];

  // MENÚ
  if (data === "menu") return menu(chatId);

  // LOGIN
  if (data === "login") {
    state.step = "login_user";
    return bot.sendMessage(chatId, "👤 Usuario:");
  }

  // PANEL ADMIN
  if (data === "panel") {
    return bot.sendMessage(chatId, "⚙️ Panel Admin", {
      reply_markup: {
        inline_keyboard: [
          [{ text: "➕ Crear producto", callback_data: "crear" }],
          [{ text: "👥 Usuarios", callback_data: "usuarios" }],
          [{ text: "📊 Estadísticas", callback_data: "stats" }],
          [{ text: "⬅️ Menú", callback_data: "menu" }]
        ]
      }
    });
  }

  // CREAR PRODUCTO
  if (data === "crear") {
    state.step = "crear_nombre";
    return bot.sendMessage(chatId, "📦 Nombre del producto:");
  }

  // SELECCIONAR DÍAS
  if (data.startsWith("dias_")) {
    state.dias = data.replace("dias_", "");
    state.step = "precio";
    return bot.sendMessage(chatId, `💰 Precio para ${state.dias} días:`);
  }

  // AGREGAR MÁS
  if (data === "add_more") {
    state.step = "elegir_dias";
    return bot.sendMessage(chatId, "📅 Selecciona duración:", {
      reply_markup: {
        inline_keyboard: [
          [{ text: "1 día", callback_data: "dias_1" }],
          [{ text: "7 días", callback_data: "dias_7" }],
          [{ text: "15 días", callback_data: "dias_15" }],
          [{ text: "30 días", callback_data: "dias_30" }]
        ]
      }
    });
  }

  // TERMINAR PRODUCTO
  if (data === "finish_product") {
    state.step = null;
    return bot.sendMessage(chatId, "✅ Producto creado", {
      reply_markup: {
        inline_keyboard: [
          [{ text: "🛒 Ver productos", callback_data: "productos" }]
        ]
      }
    });
  }

  // PRODUCTOS
  if (data === "productos") {
    let lista = Object.keys(products);

    if (lista.length === 0) {
      return bot.sendMessage(chatId, "❌ No hay productos");
    }

    let botones = lista.map(p => [
      { text: p, callback_data: "ver_" + p }
    ]);

    return bot.sendMessage(chatId, "🛒 Elige producto:", {
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

    let botones = products[nombre].map(p => [
      { text: `${p.dias} días - $${p.precio}`, callback_data: "buy" }
    ]);

    return bot.sendMessage(chatId, `📦 ${nombre}`, {
      reply_markup: {
        inline_keyboard: [
          ...botones,
          [{ text: "⬅️ Atrás", callback_data: "productos" }]
        ]
      }
    });
  }

  // CUENTA
  if (data === "cuenta") {
    if (!state.saldo) state.saldo = 10;

    return bot.sendMessage(chatId,
      `💰 Saldo: $${state.saldo}\n👤 Usuario: ${chatId}`, {
      reply_markup: {
        inline_keyboard: [
          [{ text: "⬅️ Menú", callback_data: "menu" }]
        ]
      }
    });
  }

  // HISTORIAL
  if (data === "historial") {
    return bot.sendMessage(chatId, "📜 Aún no tienes compras", {
      reply_markup: {
        inline_keyboard: [
          [{ text: "⬅️ Menú", callback_data: "menu" }]
        ]
      }
    });
  }

  // PROMO
  if (data === "promo") {
    return bot.sendMessage(chatId, "🎁 Sistema de promo (próximamente)", {
      reply_markup: {
        inline_keyboard: [
          [{ text: "⬅️ Menú", callback_data: "menu" }]
        ]
      }
    });
  }

  // USUARIOS ADMIN
  if (data === "usuarios" && state.admin) {
    let lista = Object.keys(users)
      .map(id => `user_${id}`)
      .join("\n");

    return bot.sendMessage(chatId, `👥 Usuarios:\n${lista}`);
  }

  // ESTADÍSTICAS
  if (data === "stats" && state.admin) {
    return bot.sendMessage(chatId,
      `📊 Usuarios: ${Object.keys(users).length}\n💰 Ventas: $0`);
  }
});

// ===== MENSAJES =====
bot.on("message", (msg) => {
  const chatId = msg.chat.id;
  if (!users[chatId]) users[chatId] = {};
  let state = users[chatId];

  // LOGIN USER
  if (state.step === "login_user") {
    state.username = msg.text;
    state.step = "login_pass";
    return bot.sendMessage(chatId, "🔑 Contraseña:");
  }

  // LOGIN PASS
  if (state.step === "login_pass") {
    if (
      state.username === ADMIN_USER &&
      msg.text === ADMIN_PASS
    ) {
      state.admin = true;
      state.step = null;

      return bot.sendMessage(chatId, "✅ Admin activo", {
        reply_markup: {
          inline_keyboard: [
            [{ text: "⚙️ Panel", callback_data: "panel" }]
          ]
        }
      });
    } else {
      return bot.sendMessage(chatId, "❌ Incorrecto");
    }
  }

  // CREAR PRODUCTO
  if (state.step === "crear_nombre") {
    state.producto = msg.text;
    products[state.producto] = [];
    state.step = "elegir_dias";

    return bot.sendMessage(chatId, "📅 Selecciona duración:", {
      reply_markup: {
        inline_keyboard: [
          [{ text: "1 día", callback_data: "dias_1" }],
          [{ text: "7 días", callback_data: "dias_7" }],
          [{ text: "15 días", callback_data: "dias_15" }],
          [{ text: "30 días", callback_data: "dias_30" }]
        ]
      }
    });
  }

  // PRECIO
  if (state.step === "precio") {
    products[state.producto].push({
      dias: state.dias,
      precio: msg.text
    });

    state.step = null;

    return bot.sendMessage(chatId, "✅ Precio agregado", {
      reply_markup: {
        inline_keyboard: [
          [{ text: "➕ Agregar otra duración", callback_data: "add_more" }],
          [{ text: "✅ Terminar", callback_data: "finish_product" }]
        ]
      }
    });
  }
});

console.log("Bot activo 🚀");
