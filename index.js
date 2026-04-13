const TelegramBot = require("node-telegram-bot-api");
const bot = new TelegramBot(process.env.BOT_TOKEN, { polling: true });

const ADMIN_USER = "Guillermo65";
const ADMIN_PASS = "Guillermito00.";

let users = {};
let sesiones = {};
let solicitudes = {};
let productos = {};
let state = {};

// MENU
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

// ADMIN MENU
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

bot.onText(/\/start/, (msg) => menu(msg.chat.id));

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

    if (s.user === ADMIN_USER && text === ADMIN_PASS) {
      sesiones[chatId] = "admin";
      return adminMenu(chatId);
    }

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

  // LOGOUT
  if (text === "🔓 Cerrar sesión") {
    delete sesiones[chatId];
    return menu(chatId);
  }

  // ADMIN
  if (sesiones[chatId] === "admin") {

    // CREAR PRODUCTO
    if (text === "➕ Crear producto") {
      s.step = "prod_name";
      return bot.sendMessage(chatId, "📦 Nombre del producto:");
    }

    if (s.step === "prod_name") {
      productos[text] = {};
      s.prod = text;
      s.step = "duracion_menu";

      return bot.sendMessage(chatId, "⏱ Selecciona duración:", {
        reply_markup: {
          inline_keyboard: [
            [{ text: "1 día", callback_data: "dur_1" }],
            [{ text: "7 días", callback_data: "dur_7" }],
            [{ text: "15 días", callback_data: "dur_15" }],
            [{ text: "30 días", callback_data: "dur_30" }],
            [{ text: "Otra duración", callback_data: "dur_custom" }]
          ]
        }
      });
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

    // VER USUARIOS
    if (text === "👥 Usuarios") {
      let botones = Object.entries(users).map(([id, u]) => [
        { text: u.username, callback_data: "user_" + id }
      ]);

      return bot.sendMessage(chatId, "👥 Usuarios:", {
        reply_markup: { inline_keyboard: botones }
      });
    }
  }

  // USUARIO NORMAL
  if (text === "💰 Mi cuenta") {
    let u = users[chatId];
    if (!u) return bot.sendMessage(chatId, "❌ No registrado");

    return bot.sendMessage(chatId, `💰 $${u.saldo}\n👤 ${u.username}`);
  }

  if (text === "🛒 Productos") {
    let lista = Object.keys(productos);
    if (lista.length === 0) return bot.sendMessage(chatId, "❌ Vacío");

    return bot.sendMessage(chatId, "🛒 Productos:\n" + lista.join("\n"));
  }
});

// CALLBACKS
bot.on("callback_query", (q) => {
  const chatId = q.message.chat.id;
  const data = q.data;

  let s = state[chatId];

  // DURACIONES
  if (data.startsWith("dur_")) {
    let dur = data.replace("dur_", "");

    if (dur === "custom") {
      s.step = "custom_dur";
      return bot.sendMessage(chatId, "✏️ Escribe los días:");
    }

    s.tempDur = dur;
    s.step = "precio";

    return bot.sendMessage(chatId, `💰 Precio para ${dur} días:`);
  }

  // USUARIOS CLICK
  if (data.startsWith("user_")) {
    let id = data.replace("user_", "");

    return bot.sendMessage(chatId, "⚙️ Opciones:", {
      reply_markup: {
        inline_keyboard: [
          [{ text: "💰 Saldo", callback_data: "saldo_" + id }],
          [{ text: "✏️ Cambiar pass", callback_data: "pass_" + id }],
          [{ text: "👤 Cambiar user", callback_data: "name_" + id }],
          [{ text: "🗑 Eliminar", callback_data: "del_" + id }]
        ]
      }
    });
  }

  // APROBAR
  if (data.startsWith("ok_")) {
    let id = data.replace("ok_", "");
    let u = solicitudes[id];

    users[id] = { username: u.username, password: u.password, saldo: 0 };
    delete solicitudes[id];

    bot.sendMessage(id, "✅ Aprobado");
    bot.sendMessage(chatId, "✔️ Listo");
  }

  if (data.startsWith("no_")) {
    let id = data.replace("no_", "");
    delete solicitudes[id];

    bot.sendMessage(id, "❌ Rechazado");
    bot.sendMessage(chatId, "❌ Eliminado");
  }
});

// EXTRA STEPS
bot.on("message", (msg) => {
  const chatId = msg.chat.id;
  let s = state[chatId];

  if (!s) return;

  if (s.step === "custom_dur") {
    s.tempDur = msg.text;
    s.step = "precio";
    return bot.sendMessage(chatId, "💰 Precio:");
  }

  if (s.step === "precio") {
    productos[s.prod][s.tempDur] = msg.text;
    s.step = null;

    return bot.sendMessage(chatId, "✅ Precio agregado");
  }
});

console.log("Bot PRO activo 🚀");
