const TelegramBot = require('node-telegram-bot-api');
const bot = new TelegramBot(process.env.BOT_TOKEN, { polling: true });

// ================= BASE =================
let users = {};
let pendingUsers = {};
let products = {};
let sessions = {};
let states = {};
let keys = {};

const ADMIN_USER = "Guillermo65";
const ADMIN_PASS = "Guillermito00";

// ================= MENUS =================

function menuPrincipal(chatId) {
    bot.sendMessage(chatId, "🏠 Menú", {
        reply_markup: {
            keyboard: [
                ["🛒 Productos"],
                ["💰 Mi cuenta", "📜 Historial"],
                ["🎁 Código Promo"],
                ["🔐 Login", "🚪 Cerrar sesión"]
            ],
            resize_keyboard: true
        }
    });
}

function menuLogin(chatId) {
    bot.sendMessage(chatId, "🔐 Opciones:", {
        reply_markup: {
            keyboard: [
                ["🔐 Login"],
                ["📝 Registrarse"]
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
                ["💰 Agregar saldo"],
                ["👥 Usuarios"],
                ["🚪 Cerrar sesión"]
            ],
            resize_keyboard: true
        }
    });
}

// ================= START =================

bot.onText(/\/start/, (msg) => {
    const chatId = msg.chat.id;

    if (!users[chatId]) {
        menuLogin(chatId); // 🔥 AQUÍ ESTÁ EL ARREGLO
    } else {
        if (users[chatId].isAdmin) {
            menuAdmin(chatId);
        } else {
            menuPrincipal(chatId);
        }
    }
});

// ================= MENSAJES =================

bot.on("message", (msg) => {
    const chatId = msg.chat.id;
    const text = msg.text;

    if (!text) return;

    // ================= REGISTRO =================

    if (text === "📝 Registrarse") {
        states[chatId] = "reg_user";
        return bot.sendMessage(chatId, "👤 Usuario:");
    }

    if (states[chatId] === "reg_user") {
        pendingUsers[chatId] = { username: text };
        states[chatId] = "reg_pass";
        return bot.sendMessage(chatId, "🔑 Contraseña:");
    }

    if (states[chatId] === "reg_pass") {
        pendingUsers[chatId].password = text;
        pendingUsers[chatId].saldo = 0;

        bot.sendMessage(chatId, "⏳ Esperando aprobación...");

        // Notificar admin
        for (let id in users) {
            if (users[id].isAdmin) {
                bot.sendMessage(id,
                    `📥 Nuevo usuario: ${pendingUsers[chatId].username}`,
                    {
                        reply_markup: {
                            inline_keyboard: [[
                                { text: "✅ Aprobar", callback_data: "ap_" + chatId },
                                { text: "❌ Rechazar", callback_data: "re_" + chatId }
                            ]]
                        }
                    }
                );
            }
        }

        states[chatId] = null;
        return;
    }

    // ================= LOGIN =================

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
        let u = sessions[chatId].user;

        // ADMIN
        if (u === ADMIN_USER && text === ADMIN_PASS) {
            users[chatId] = { username: u, isAdmin: true, saldo: 0 };
            bot.sendMessage(chatId, "👑 Admin logueado");
            menuAdmin(chatId);
        } else {
            let encontrado = false;

            for (let id in users) {
                if (users[id].username === u && users[id].password === text) {
                    users[chatId] = users[id];
                    encontrado = true;
                }
            }

            if (encontrado) {
                bot.sendMessage(chatId, "✅ Login correcto");
                menuPrincipal(chatId);
            } else {
                bot.sendMessage(chatId, "❌ Datos incorrectos");
                menuLogin(chatId);
            }
        }

        states[chatId] = null;
        return;
    }

    // ================= LOGOUT =================

    if (text === "🚪 Cerrar sesión") {
        delete users[chatId];
        bot.sendMessage(chatId, "🚪 Sesión cerrada");
        return menuLogin(chatId); // 🔥 IMPORTANTE
    }

    // ================= CREAR PRODUCTO =================

    if (text === "➕ Crear producto") {
        states[chatId] = "crear_producto";
        return bot.sendMessage(chatId, "📦 Nombre del producto:");
    }

    if (states[chatId] === "crear_producto") {
        products[text] = { duraciones: {}, activo: true };
        keys[text] = [];

        sessions[chatId] = { producto: text };

        states[chatId] = "duracion";

        return bot.sendMessage(chatId, "📅 Elige duración:", {
            reply_markup: {
                keyboard: [
                    ["1 día", "7 días"],
                    ["15 días", "30 días"],
                    ["✏️ Otra duración"]
                ],
                resize_keyboard: true
            }
        });
    }

    if (states[chatId] === "duracion") {
        if (text === "✏️ Otra duración") {
            states[chatId] = "otra_duracion";
            return bot.sendMessage(chatId, "✏️ Escribe días:");
        }

        let dias = text.replace(" días", "").replace(" día", "");
        sessions[chatId].duracion = dias;
        states[chatId] = "precio";

        return bot.sendMessage(chatId, `💰 Precio para ${dias} días:`);
    }

    if (states[chatId] === "otra_duracion") {
        sessions[chatId].duracion = text;
        states[chatId] = "precio";
        return bot.sendMessage(chatId, `💰 Precio para ${text} días:`);
    }

    if (states[chatId] === "precio") {
        let p = sessions[chatId].producto;
        let d = sessions[chatId].duracion;

        products[p].duraciones[d] = { precio: text, ventas: 0 };

        bot.sendMessage(chatId, "✅ Precio agregado");

        states[chatId] = "duracion";
        return bot.sendMessage(chatId, "➕ Agrega otra duración o /start");
    }

    // ================= PRODUCTOS ADMIN =================

    if (text === "📦 Productos") {
        let botones = [];

        for (let p in products) {
            botones.push([p]);
        }

        return bot.sendMessage(chatId, "📦 Productos:", {
            reply_markup: { keyboard: botones, resize_keyboard: true }
        });
    }

    if (products[text]) {
        let p = products[text];
        let botones = [];

        botones.push(["➕ Agregar duración/precio"]);
        botones.push(["🔑 Agregar keys"]);
        botones.push(["🚫 Desactivar producto"]);
        botones.push(["🗑 Eliminar"]);

        for (let d in p.duraciones) {
            botones.push([`${d} días - $${p.duraciones[d].precio}`]);
        }

        botones.push(["⬅️ Atrás"]);

        sessions[chatId] = { producto: text };

        return bot.sendMessage(chatId,
            `📦 ${text}\n\nVariantes: ${Object.keys(p.duraciones).length}`,
            {
                reply_markup: { keyboard: botones, resize_keyboard: true }
            }
        );
    }

    // ================= KEYS =================

    if (text === "🔑 Agregar keys") {
        states[chatId] = "add_keys";
        return bot.sendMessage(chatId, "🔑 Envía keys (una por línea):");
    }

    if (states[chatId] === "add_keys") {
        let p = sessions[chatId].producto;
        let nuevas = text.split("\n");

        keys[p].push(...nuevas);

        states[chatId] = null;
        return bot.sendMessage(chatId, `✅ ${nuevas.length} keys agregadas`);
    }

    // ================= USUARIOS =================

    if (text === "👥 Usuarios") {
        let botones = [];

        for (let id in users) {
            botones.push([users[id].username]);
        }

        return bot.sendMessage(chatId, "👥 Usuarios:", {
            reply_markup: { keyboard: botones, resize_keyboard: true }
        });
    }
});

// ================= CALLBACK =================

bot.on("callback_query", (q) => {
    let data = q.data;

    if (data.startsWith("ap_")) {
        let id = data.split("_")[1];
        users[id] = pendingUsers[id];
        delete pendingUsers[id];
        bot.sendMessage(id, "✅ Aprobado");
    }

    if (data.startsWith("re_")) {
        let id = data.split("_")[1];
        delete pendingUsers[id];
        bot.sendMessage(id, "❌ Rechazado");
    }
});
