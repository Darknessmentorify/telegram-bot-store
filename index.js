const TelegramBot = require("node-telegram-bot-api");
const bot = new TelegramBot(process.env.BOT_TOKEN, { polling: true });

// BASE DE DATOS
let users = {};
let products = {}; // ahora vacío

// ADMIN
const ADMIN_USER = "Guillermo65";
const ADMIN_PASS = "Guillermito00.";

// START
bot.onText(/\/start/, (msg) => {
  bot.sendMessage(msg.chat.id, "🏠 Menú", {
    reply_markup: {
      keyboard: [
        ["🛒 Productos"],
        ["💰 Mi Cuenta"],
        ["📜 Historial"],
        ["🔐 Login"]
      ],
      resize_keyboard: true
    }
  });
});

// LOGIN
bot.onText(/🔐 Login/, (msg) => {
  users[msg.chat.id] = { step: "login_user" };
  bot.sendMessage(msg.chat.id, "Usuario:");
});

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
      bot.sendMessage(chatId, "✅ Admin activo", {
        reply_markup: {
          keyboard: [
            ["➕ Crear producto"],
            ["📊 Estadísticas"],
            ["🏠 Menú"]
          ],
          resize_keyboard: true
        }
      });
    } else {
      bot.sendMessage(chatId, "❌ Incorrecto");
    }
    state.step = null;
    return;
  }

  // CREAR PRODUCTO
  if (msg.text === "➕ Crear producto" && state.admin) {
    state.step = "crear_nombre";
    bot.sendMessage(chatId, "Nombre del producto:");
    return;
  }

  if (state.step === "crear_nombre") {
    state.newProduct = msg.text;
    products[state.newProduct] = [];
    state.step = "crear_dias";
    bot.sendMessage(chatId, "Duración en días:");
    return;
  }

  if (state.step === "crear_dias") {
    state.dias = msg.text;
    state.step = "crear_precio";
    bot.sendMessage(chatId, "Precio:");
    return;
  }

  if (state.step === "crear_precio") {
    products[state.newProduct].push({
      dias: state.dias,
      precio: msg.text
    });

    bot.sendMessage(chatId, "✅ Producto agregado");

    state.step = null;
    return;
  }

  // VER PRODUCTOS
  if (msg.text === "🛒 Productos") {
    let lista = Object.keys(products);

    if (lista.length === 0) {
      bot.sendMessage(chatId, "No hay productos aún");
      return;
    }

    let botones = lista.map(p => [p]);

    bot.sendMessage(chatId, "Elige producto:", {
      reply_markup: {
        keyboard: [...botones, ["🏠 Menú"]],
        resize_keyboard: true
      }
    });
  }

  // MOSTRAR PRODUCTO
  if (products[msg.text]) {
    let opciones = products[msg.text]
      .map(p => `${p.dias} días - $${p.precio}`)
      .join("\n");

    bot.sendMessage(chatId, `📦 ${msg.text}\n\n${opciones}`);
  }

  // MENÚ
  if (msg.text === "🏠 Menú") {
    bot.sendMessage(chatId, "🏠 Menú", {
      reply_markup: {
        keyboard: [
          ["🛒 Productos"],
          ["💰 Mi Cuenta"],
          ["📜 Historial"],
          ["🔐 Login"]
        ],
        resize_keyboard: true
      }
    });
  }
});

console.log("Bot activo 🚀");
