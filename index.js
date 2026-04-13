const TelegramBot = require('node-telegram-bot-api');
const bot = new TelegramBot(process.env.BOT_TOKEN, { polling: true });

// ===== CONFIG =====
const ADMIN_USER = "Guillermo65";
const ADMIN_PASS = "Guillermito00";

// ===== BASE =====
let users = {};
let pendingUsers = {};
let sessions = {};
let states = {};
let products = {};
let keys = {};

// ===== MENUS =====

function menuInicio(chatId) {
    bot.sendMessage(chatId, "🔐 Opciones:", {
        reply_markup: {
            keyboard: [["🔐 Login"], ["📝 Registrarse"]],
            resize_keyboard: true
        }
    });
}

function menuUser(chatId) {
    bot.sendMessage(chatId, "🏠 Menú", {
        reply_markup: {
            keyboard: [
                ["🛒 Productos"],
                ["💰 Mi cuenta"],
                ["📜 Historial"],
                ["🎁 Código Promo"],
                ["🚪 Cerrar sesión"]
            ],
            resize_keyboard: true
        }
    });
}

function menuAdmin(chatId) {
    bot.sendMessage(chatId, "⚙️ Admin", {
        reply_markup: {
            keyboard: [
                ["➕ Crear producto"],
                ["📦 Productos"],
                ["👥 Usuarios"],
                ["🚪 Cerrar sesión"]
            ],
            resize_keyboard: true
        }
    });
}

// ===== START =====

bot.onText(/\/start/, (msg) => {
    const chatId = msg.chat.id;

    if (!users[chatId]) return menuInicio(chatId);

    if (users[chatId].isAdmin) return menuAdmin(chatId);
    else return menuUser(chatId);
});

// ===== MENSAJES =====

bot.on("message", (msg) => {
    const chatId = msg.chat.id;
    const text = msg.text;

    if (!text) return;

    // ===== LOGIN =====

    if (text === "🔐 Login") {
        states[chatId] = "login_user";
        return bot.sendMessage(chatId, "👤 Usuario:");
    }

    if (states[chatId] === "login_user") {
        sessions[chatId] = { user: text };
        states[chatId] = "login_pass";
        return bot.sendMessage(chatId, "🔑 Contraseña:");
    }

    if (states[chatId] === "login_pass") {
        let u = sessions[chatId].user.trim();
        let p = text.trim();

        if (u === ADMIN_USER && p === ADMIN_PASS) {
            users[chatId] = { username: u, isAdmin: true, saldo: 0 };
            states[chatId] = null;
            bot.sendMessage(chatId, "👑 Admin activo");
            return menuAdmin(chatId);
        }

        for (let id in users) {
            if (users[id].username === u && users[id].password === p) {
                users[chatId] = users[id];
                states[chatId] = null;
                return menuUser(chatId);
            }
        }

        states[chatId] = null;
        return bot.sendMessage(chatId, "❌ Datos incorrectos");
    }

    // ===== REGISTRO =====

    if (text === "📝 Registrarse") {
        states[chatId] = "reg_user";
        return bot.sendMessage(chatId, "👤 Usuario:");
    }

    if (states[chatId] === "reg_user") {
        sessions[chatId] = { user: text };
        states[chatId] = "reg_pass";
        return bot.sendMessage(chatId, "🔑 Contraseña:");
    }

    if (states[chatId] === "reg_pass") {
        let u = sessions[chatId].user;
        let p = text;

        pendingUsers[chatId] = { username: u, password: p, saldo: 0 };

        states[chatId] = null;

        bot.sendMessage(chatId, "⏳ Esperando aprobación");

        return;
    }

    // ===== LOGOUT =====

    if (text === "🚪 Cerrar sesión") {
        delete users[chatId];
        return menuInicio(chatId);
    }

    // ===== ADMIN =====

    if (!users[chatId]) return;
    if (!users[chatId].isAdmin) return;

    // ===== CREAR PRODUCTO =====

    if (text === "➕ Crear producto") {
        states[chatId] = "crear_producto";
        return bot.sendMessage(chatId, "📦 Nombre del producto:");
    }

    if (states[chatId] === "crear_producto") {
        products[text] = { duraciones: {} };
        keys[text] = {};
        sessions[chatId] = { producto: text };

        states[chatId] = "duracion";

        return bot.sendMessage(chatId, "📅 Duración:", {
            reply_markup: {
                keyboard: [
                    ["1 día"], ["7 días"], ["15 días"], ["30 días"],
                    ["✏️ Otra duración"]
                ],
                resize_keyboard: true
            }
        });
    }

    if (states[chatId] === "duracion") {
        if (text === "✏️ Otra duración") {
            states[chatId] = "otra_duracion";
            return bot.sendMessage(chatId, "Escribe días:");
        }

        let d = text.replace(" días", "").replace(" día", "");
        sessions[chatId].duracion = d;
        states[chatId] = "precio";

        return bot.sendMessage(chatId, `💰 Precio para ${d}:`);
    }

    if (states[chatId] === "otra_duracion") {
        sessions[chatId].duracion = text;
        states[chatId] = "precio";
        return bot.sendMessage(chatId, `💰 Precio para ${text}:`);
    }

    if (states[chatId] === "precio") {
        let p = sessions[chatId].producto;
        let d = sessions[chatId].duracion;

        products[p].duraciones[d] = { precio: text };
        if (!keys[p][d]) keys[p][d] = [];

        states[chatId] = "duracion";

        return bot.sendMessage(chatId, "✅ Agregado otra duración o /start");
    }

    // ===== VER PRODUCTOS =====

    if (text === "📦 Productos") {
        let botones = Object.keys(products).map(p => [p]);
        return bot.sendMessage(chatId, "📦 Productos:", {
            reply_markup: { keyboard: botones, resize_keyboard: true }
        });
    }

    // ===== ENTRAR PRODUCTO =====

    if (products[text]) {
        sessions[chatId] = { producto: text };

        let botones = [];

        for (let d in products[text].duraciones) {
            botones.push([`${text}|${d}`]);
        }

        botones.push(["⬅️ Atrás"]);

        return bot.sendMessage(chatId, `📦 ${text}`, {
            reply_markup: { keyboard: botones, resize_keyboard: true }
        });
    }

    // ===== VARIANTE =====

    if (text.includes("|")) {
        let [p, d] = text.split("|");

        sessions[chatId] = { producto: p, duracion: d };

        let total = keys[p][d]?.length || 0;

        return bot.sendMessage(chatId,
            `📦 ${p}\n⏳ ${d} días\n🔑 Keys: ${total}`,
            {
                reply_markup: {
                    keyboard: [["🔑 Agregar keys"], ["⬅️ Atrás"]],
                    resize_keyboard: true
                }
            }
        );
    }

    // ===== AGREGAR KEYS =====

    if (text === "🔑 Agregar keys") {
        states[chatId] = "add_keys";
        return bot.sendMessage(chatId, "Envía keys (una por línea)");
    }

    if (states[chatId] === "add_keys") {
        let { producto, duracion } = sessions[chatId];

        let nuevas = text.split("\n");
        keys[producto][duracion].push(...nuevas);

        states[chatId] = null;

        return bot.sendMessage(chatId,
            `✅ ${nuevas.length} keys agregadas`
        );
    }

    // ===== USUARIOS =====

    if (text === "👥 Usuarios") {
        let lista = Object.values(users)
            .map(u => u.username)
            .join("\n") || "Sin usuarios";

        return bot.sendMessage(chatId, "👥 Usuarios:\n" + lista);
    }

    // ===== ATRÁS =====

    if (text === "⬅️ Atrás") {
        return menuAdmin(chatId);
    }
});
