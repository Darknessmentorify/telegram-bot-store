const TelegramBot = require("node-telegram-bot-api");

const bot = new TelegramBot(process.env.BOT_TOKEN, { polling: true });

// ADMIN
const ADMIN_USER = "Guillermo65";
const ADMIN_PASS = "Guillermito00.";

// BASE DATOS
let users = {};
let sesiones = {};
let solicitudes = {};
let productos = {};
let state = {};

// MENU PRINCIPAL
function menu(chatId) {
  bot.sendMessage(chatId, "🏠 Menú", {
    reply_markup: {
      keyboard: [
        ["🛒 Productos"],
        ["💰 Mi cuenta"],
        ["📜 Historial"],
        ["🎁 Código Promo"],
        ["🔐 Login"],
        ["📝 Registrarse"]
      ],
      resize_keyboard: true
    }
  });
}

// PANEL ADMIN
function adminMenu(chatId) {
  bot.sendMessage(chatId, "⚙️ Admin", {
    reply_markup: {
      keyboard: [
        ["➕ Crear producto"],
        ["💰 Agregar saldo"],
        ["👥 Usuarios"],
        ["📥 Solicitudes"],
        ["🔓 Cerrar sesión"],
        ["🏠 Menú"]
      ],
      resize_keyboard: true
    }
  });
}

// INICIO
bot.onText(/\/start/, (msg) => {
  menu(msg.chat.id);
});

// MENSAJES
bot.on("message", (msg) => {
  const chatId = msg.chat.id;
  const text = msg.text;

  if (!state[chatId]) state[chatId] = {};

  let s = state[chatId];

  // LOGIN
  if (text === "🔐 Login") {
    s.step = "login_user";
    return bot.sendMessage(chatId, "👤 Usuario:");
  }

  if (s.step === "login_user") {
    s.user = text;
    s.step = "login_pass";
    return bot.sendMessage(chatId, "🔑 Contraseña:");
  }

  if (s.step === "login_pass") {
    s.step = null;

    // ADMIN
    if (s.user === ADMIN_USER && text === ADMIN_PASS) {
      sesiones[chatId] = "admin";
      return adminMenu(chatId);
    }

    // USUARIO
    let u = Object.values(users).find(x => x.username === s.user && x.password === text);

    if (u) {
      sesiones[chatId] = u.username;
      return menu(chatId);
    }

    return bot.sendMessage(chatId, "❌ Datos incorrectos");
  }

  // REGISTRO
  if (text === "📝 Registrarse") {
    s.step = "reg_user";
    return bot.sendMessage(chatId, "👤 Usuario:");
  }

  if (s.step === "reg_user") {
    s.newUser = text;
    s.step = "reg_pass";
    return bot.sendMessage(chatId, "🔑 Contraseña:");
  }

  if (s.step === "reg_pass") {
    solicitudes[chatId] = {
      username: s.newUser,
      password: text
    };

    s.step = null;

    return bot.sendMessage(chatId, "⏳ Solicitud enviada");
  }

  // CERRAR SESIÓN
  if (text === "🔓 Cerrar sesión") {
    delete sesiones[chatId];
    return menu(chatId);
  }

  // ADMIN SOLO
  if (sesiones[chatId] === "admin") {

    // CREAR PRODUCTO
    if (text === "➕ Crear producto") {
      s.step = "crear_producto";
      return bot.sendMessage(chatId, "📦 Nombre del producto:");
    }

    if (s.step === "crear_producto") {
      productos[text] = [];
      s.prod = text;
      s.step = "precio";
      return bot.sendMessage(chatId, "💰 Precio (ej: 10):");
    }

    if (s.step === "precio") {
      productos[s.prod].push(text);
      s.step = null;
      return bot.sendMessage(chatId, "✅ Producto creado");
    }

    // VER USUARIOS
    if (text === "👥 Usuarios") {
      let lista = Object.values(users).map(u => u.username).join("\n") || "sin usuarios";
      return bot.sendMessage(chatId, "👥 Usuarios:\n" + lista);
    }

    // AGREGAR SALDO
    if (text === "💰 Agregar saldo") {
      s.step = "saldo_user";
      return bot.sendMessage(chatId, "👤 Usuario:");
    }

    if (s.step === "saldo_user") {
      s.target = text;
      s.step = "saldo_cant";
      return bot.sendMessage(chatId, "💰 Cantidad:");
    }

    if (s.step === "saldo_cant") {
      let u = Object.values(users).find(x => x.username === s.target);

      if (!u) return bot.sendMessage(chatId, "❌ Usuario no encontrado");

      u.saldo += parseFloat(text);
      s.step = null;

      return bot.sendMessage(chatId, "✅ Saldo agregado");
    }

    // SOLICITUDES
    if (text === "📥 Solicitudes") {
      let lista = Object.entries(solicitudes);

      if (lista.length === 0)
        return bot.sendMessage(chatId, "❌ No hay solicitudes");

      lista.forEach(([id, u]) => {
        bot.sendMessage(chatId, `👤 ${u.username}`, {
          reply_markup: {
            inline_keyboard: [
              [
                { text: "✅ Aceptar", callback_data: "ok_" + id },
                { text: "❌ Rechazar", callback_data: "no_" + id }
              ]
            ]
          }
        });
      });
    }
  }

  // USUARIO NORMAL

  if (text === "💰 Mi cuenta") {
    let u = users[chatId];
    if (!u) return bot.sendMessage(chatId, "❌ No registrado");

    return bot.sendMessage(chatId,
      `💰 Saldo: $${u.saldo}\n👤 ${u.username}`);
  }

  if (text === "🛒 Productos") {
    let keys = Object.keys(productos);

    if (keys.length === 0)
      return bot.sendMessage(chatId, "❌ No hay productos");

    return bot.sendMessage(chatId, "🛒 Productos:\n" + keys.join("\n"));
  }
});

// CALLBACKS
bot.on("callback_query", (q) => {
  const chatId = q.message.chat.id;
  const data = q.data;

  // ACEPTAR
  if (data.startsWith("ok_")) {
    let id = data.replace("ok_", "");
    let u = solicitudes[id];

    users[id] = {
      username: u.username,
      password: u.password,
      saldo: 0
    };

    delete solicitudes[id];

    bot.sendMessage(id, "✅ Aprobado");
    bot.sendMessage(chatId, "✔️ Listo");
  }

  // RECHAZAR
  if (data.startsWith("no_")) {
    let id = data.replace("no_", "");
    delete solicitudes[id];

    bot.sendMessage(id, "❌ Rechazado");
    bot.sendMessage(chatId, "❌ Eliminado");
  }
});

console.log("Bot activo 🚀");
