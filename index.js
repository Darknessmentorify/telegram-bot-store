const TelegramBot = require("node-telegram-bot-api");
const bot = new TelegramBot(process.env.BOT_TOKEN, { polling: true });

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
        [{ text: "📝 Registrarse", callback_data: "register" }],
        [{ text: "🔐 Login", callback_data: "login" }]
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

  // REGISTRO
  if (data === "register") {
    state.step = "reg_user";
    return bot.sendMessage(chatId, "📝 Crea tu usuario:");
  }

  // LOGIN
  if (data === "login") {
    state.step = "login_user";
    return bot.sendMessage(chatId, "👤 Usuario:");
  }

  // PRODUCTOS
  if (data === "productos") {
    let lista = Object.keys(products);

    if (lista.length === 0)
      return bot.sendMessage(chatId, "❌ No hay productos");

    let botones = lista.map(p => [
      { text: p, callback_data: "ver_" + p }
    ]);

    return bot.sendMessage(chatId, "🛒 Productos:", {
      reply_markup: {
        inline_keyboard: botones
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
        inline_keyboard: botones
      }
    });
  }

  // CUENTA
  if (data === "cuenta") {
    if (!state.username)
      return bot.sendMessage(chatId, "❌ Debes registrarte");

    return bot.sendMessage(chatId,
      `👤 Usuario: ${state.username}\n💰 Saldo: $${state.saldo || 0}`);
  }

  // PANEL ADMIN
  if (data === "panel") {
    if (!state.admin) return;

    return bot.sendMessage(chatId, "⚙️ Admin", {
      reply_markup: {
        inline_keyboard: [
          [{ text: "➕ Crear producto", callback_data: "crear" }],
          [{ text: "💰 Agregar saldo", callback_data: "addsaldo" }],
          [{ text: "👥 Usuarios", callback_data: "usuarios" }]
        ]
      }
    });
  }

  // CREAR PRODUCTO
  if (data === "crear") {
    state.step = "crear_nombre";
    return bot.sendMessage(chatId, "Nombre del producto:");
  }

  // DURACIONES
  if (data.startsWith("dias_")) {
    state.dias = data.replace("dias_", "");
    state.step = "precio";
    return bot.sendMessage(chatId, "Precio:");
  }

  // VER USUARIOS
  if (data === "usuarios" && state.admin) {
    let lista = Object.values(users)
      .map(u => u.username || "sin usuario")
      .join("\n");

    return bot.sendMessage(chatId, "👥 Usuarios:\n" + lista);
  }

  // AGREGAR SALDO
  if (data === "addsaldo" && state.admin) {
    state.step = "saldo_user";
    return bot.sendMessage(chatId, "Usuario:");
  }
});

// ===== MENSAJES =====
bot.on("message", (msg) => {
  const chatId = msg.chat.id;
  if (!users[chatId]) users[chatId] = {};
  let state = users[chatId];

  // REGISTRO
  if (state.step === "reg_user") {
    state.newUser = msg.text;
    state.step = "reg_pass";
    return bot.sendMessage(chatId, "Contraseña:");
  }

  if (state.step === "reg_pass") {
    state.username = state.newUser;
    state.password = msg.text;
    state.saldo = 0;
    state.step = null;

    return bot.sendMessage(chatId, "✅ Registrado");
  }

  // LOGIN
  if (state.step === "login_user") {
    state.loginUser = msg.text;
    state.step = "login_pass";
    return bot.sendMessage(chatId, "Contraseña:");
  }

  if (state.step === "login_pass") {
    if (
      state.loginUser === ADMIN_USER &&
      msg.text === ADMIN_PASS
    ) {
      state.admin = true;
      state.step = null;

      return bot.sendMessage(chatId, "👑 Admin activo", {
        reply_markup: {
          inline_keyboard: [
            [{ text: "⚙️ Panel", callback_data: "panel" }]
          ]
        }
      });
    }

    if (
      state.username === state.loginUser &&
      state.password === msg.text
    ) {
      state.step = null;
      return bot.sendMessage(chatId, "✅ Login correcto");
    }

    return bot.sendMessage(chatId, "❌ Incorrecto");
  }

  // CREAR PRODUCTO
  if (state.step === "crear_nombre") {
    state.producto = msg.text;
    products[state.producto] = [];
    state.step = "elegir_dias";

    return bot.sendMessage(chatId, "Duración:", {
      reply_markup: {
        inline_keyboard: [
          [{ text: "1 día", callback_data: "dias_1" }],
          [{ text: "7 días", callback_data: "dias_7" }],
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

    return bot.sendMessage(chatId, "✅ Guardado");
  }

  // AGREGAR SALDO
  if (state.step === "saldo_user") {
    state.targetUser = msg.text;
    state.step = "saldo_cantidad";
    return bot.sendMessage(chatId, "Cantidad:");
  }

  if (state.step === "saldo_cantidad") {
    let user = Object.values(users)
      .find(u => u.username === state.targetUser);

    if (user) {
      user.saldo = (user.saldo || 0) + Number(msg.text);
      bot.sendMessage(chatId, "✅ Saldo agregado");
    } else {
      bot.sendMessage(chatId, "❌ Usuario no encontrado");
    }

    state.step = null;
  }
});

console.log("Bot activo 🚀");
