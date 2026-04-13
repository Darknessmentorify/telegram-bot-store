const TelegramBot = require('node-telegram-bot-api');
const bot = new TelegramBot(process.env.BOT_TOKEN, { polling: true });

// ================= BASE DE DATOS =================
let users = {};
let pendingUsers = {};
let products = {};
let sessions = {};
let states = {};
let keys = {}; // keys por producto

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
        bot.sendMessage(chatId, "👋 Bienvenido\n\nPulsa registrar:", {
            reply_markup: {
                keyboard: [["📝 Registrarse"]],
                resize_keyboard: true
            }
        });
    } else {
        menuPrincipal(chatId);
    }
});

// ================= REGISTRO =================

bot.on("message", (msg) => {
    const chatId = msg.chat.id;
    const text = msg.text;

    if (text === "📝 Registrarse") {
        states[chatId] = "registro_user";
        bot.sendMessage(chatId, "👤 Usuario:");
    }

    else if (states[chatId] === "registro_user") {
        pendingUsers[chatId] = { username: text };
        states[chatId] = "registro_pass";
        bot.sendMessage(chatId, "🔑 Contraseña:");
    }

    else if (states[chatId] === "registro_pass") {
        pendingUsers[chatId].password = text;
        pendingUsers[chatId].saldo = 0;

        bot.sendMessage(chatId, "⏳ Esperando aprobación del admin");

        for (let id in users) {
            if (users[id].isAdmin) {
                bot.sendMessage(id,
                    `📥 Nuevo registro:\n${pendingUsers[chatId].username}`,
                    {
                        reply_markup: {
                            inline_keyboard: [
                                [
                                    { text: "✅ Aprobar", callback_data: "ap_" + chatId },
                                    { text: "❌ Rechazar", callback_data: "re_" + chatId }
                                ]
                            ]
                        }
                    }
                );
            }
        }

        states[chatId] = null;
    }

    // ================= LOGIN =================

    else if (text === "🔐 Login") {
        states[chatId] = "login_user";
        bot.sendMessage(chatId, "👤 Usuario:");
    }

    else if (states[chatId] === "login_user") {
        sessions[chatId] = { user: text };
        states[chatId] = "login_pass";
        bot.sendMessage(chatId, "🔑 Contraseña:");
    }

    else if (states[chatId] === "login_pass") {
        let u = sessions[chatId].user;

        if (u === ADMIN_USER && text === ADMIN_PASS) {
            users[chatId] = { username: u, isAdmin: true, saldo: 0 };
            bot.sendMessage(chatId, "👑 Admin logueado");
            menuAdmin(chatId);
        } else {
            let found = false;
            for (let id in users) {
                if (users[id].username === u && users[id].password === text) {
                    users[chatId] = users[id];
                    found = true;
                }
            }

            if (found) {
                bot.sendMessage(chatId, "✅ Login correcto");
                menuPrincipal(chatId);
            } else {
                bot.sendMessage(chatId, "❌ Datos incorrectos");
            }
        }

        states[chatId] = null;
    }

    // ================= LOGOUT =================

    else if (text === "🚪 Cerrar sesión") {
        delete users[chatId];
        bot.sendMessage(chatId, "🚪 Sesión cerrada");
    }

    // ================= CREAR PRODUCTO =================

    else if (text === "➕ Crear producto") {
        states[chatId] = "crear_producto";
        bot.sendMessage(chatId, "📦 Nombre del producto:");
    }

    else if (states[chatId] === "crear_producto") {
        products[text] = { duraciones: {}, activo: true };
        keys[text] = [];
        sessions[chatId] = { producto: text };

        states[chatId] = "duracion";
        bot.sendMessage(chatId, "📅 Elige duración:", {
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

    else if (states[chatId] === "duracion") {
        let dias = text.replace(" días", "").replace(" día", "");

        if (text === "✏️ Otra duración") {
            states[chatId] = "otra_duracion";
            bot.sendMessage(chatId, "✏️ Escribe días:");
        } else {
            sessions[chatId].duracion = dias;
            states[chatId] = "precio";
            bot.sendMessage(chatId, `💰 Precio para ${dias} días:`);
        }
    }

    else if (states[chatId] === "otra_duracion") {
        sessions[chatId].duracion = text;
        states[chatId] = "precio";
        bot.sendMessage(chatId, `💰 Precio para ${text} días:`);
    }

    else if (states[chatId] === "precio") {
        let p = sessions[chatId].producto;
        let d = sessions[chatId].duracion;

        products[p].duraciones[d] = { precio: text, ventas: 0 };

        bot.sendMessage(chatId, "✅ Precio agregado");

        states[chatId] = "duracion";
        bot.sendMessage(chatId, "➕ Puedes agregar otra duración o /start");
    }

    // ================= VER PRODUCTOS ADMIN =================

    else if (text === "📦 Productos") {
        let botones = [];

        for (let p in products) {
            botones.push([p]);
        }

        bot.sendMessage(chatId, "📦 Productos:", {
            reply_markup: { keyboard: botones, resize_keyboard: true }
        });
    }

    // ================= ABRIR PRODUCTO =================

    else if (products[text]) {
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

        bot.sendMessage(chatId,
            `📦 ${text}\n\nVariantes: ${Object.keys(p.duraciones).length}`,
            {
                reply_markup: { keyboard: botones, resize_keyboard: true }
            }
        );

        sessions[chatId] = { producto: text };
    }

    // ================= AGREGAR KEYS =================

    else if (text === "🔑 Agregar keys") {
        states[chatId] = "add_keys";
        bot.sendMessage(chatId, "🔑 Envía keys (una por línea):");
    }

    else if (states[chatId] === "add_keys") {
        let p = sessions[chatId].producto;
        let nuevas = text.split("\n");

        keys[p].push(...nuevas);

        bot.sendMessage(chatId, `✅ Keys agregadas: ${nuevas.length}`);
        states[chatId] = null;
    }

    // ================= USUARIOS =================

    else if (text === "👥 Usuarios") {
        let botones = [];

        for (let id in users) {
            botones.push([users[id].username]);
        }

        bot.sendMessage(chatId, "👥 Usuarios:", {
            reply_markup: { keyboard: botones, resize_keyboard: true }
        });
    }

    else if (Object.values(users).find(u => u.username === text)) {
        sessions[chatId] = { targetUser: text };

        bot.sendMessage(chatId, `👤 ${text}`, {
            reply_markup: {
                keyboard: [
                    ["💰 Agregar saldo"],
                    ["🔑 Cambiar contraseña"],
                    ["✏️ Cambiar nombre"],
                    ["🗑 Eliminar usuario"],
                    ["⬅️ Volver"]
                ],
                resize_keyboard: true
            }
        });
    }

    else if (text === "💰 Agregar saldo") {
        states[chatId] = "saldo_user";
        bot.sendMessage(chatId, "👤 Usuario:");
    }

    else if (states[chatId] === "saldo_user") {
        sessions[chatId] = { userSaldo: text };
        states[chatId] = "saldo_cantidad";
        bot.sendMessage(chatId, "💰 Cantidad:");
    }

    else if (states[chatId] === "saldo_cantidad") {
        for (let id in users) {
            if (users[id].username === sessions[chatId].userSaldo) {
                users[id].saldo += parseInt(text);
                bot.sendMessage(chatId, "✅ Saldo agregado");
            }
        }
        states[chatId] = null;
    }
});

// ================= APROBACIÓN =================

bot.on("callback_query", (q) => {
    let chatId = q.message.chat.id;
    let data = q.data;

    if (data.startsWith("ap_")) {
        let id = data.split("_")[1];
        users[id] = pendingUsers[id];

        bot.sendMessage(id, "✅ Registro aprobado");
        delete pendingUsers[id];
    }

    if (data.startsWith("re_")) {
        let id = data.split("_")[1];
        bot.sendMessage(id, "❌ Registro rechazado");
        delete pendingUsers[id];
    }
});
