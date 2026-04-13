const TelegramBot = require('node-telegram-bot-api');
const bot = new TelegramBot(process.env.BOT_TOKEN, { polling: true });

// ===== CONFIG =====
const ADMIN_USER = "Guillermo65";
const ADMIN_PASS = "Guillermito00";

// ===== BASE =====
let users = {};
let sessions = {};
let states = {};
let temp = {};
let products = {};
let keys = {};

// ===== MENUS =====

function menuInicio(id) {
    bot.sendMessage(id, "🔐 Opciones:", {
        reply_markup: {
            keyboard: [["🔐 Login"], ["📝 Registrarse"]],
            resize_keyboard: true
        }
    });
}

function menuAdmin(id) {
    bot.sendMessage(id, "⚙️ Admin", {
        reply_markup: {
            keyboard: [
                ["➕ Crear producto"],
                ["📦 Productos"],
                ["🚪 Cerrar sesión"]
            ],
            resize_keyboard: true
        }
    });
}

// ===== START =====

bot.onText(/\/start/, (msg) => {
    const id = msg.chat.id;

    if (!users[id]) return menuInicio(id);
    if (users[id].isAdmin) return menuAdmin(id);
});

// ===== MENSAJES =====

bot.on("message", (msg) => {
    const id = msg.chat.id;
    const text = msg.text;

    if (!text) return;

    // ===== LOGIN =====

    if (text === "🔐 Login") {
        states[id] = "login_user";
        return bot.sendMessage(id, "👤 Usuario:");
    }

    if (states[id] === "login_user") {
        temp[id] = { user: text };
        states[id] = "login_pass";
        return bot.sendMessage(id, "🔑 Contraseña:");
    }

    if (states[id] === "login_pass") {
        let u = temp[id].user;
        let p = text;

        if (u === ADMIN_USER && p === ADMIN_PASS) {
            users[id] = { username: u, isAdmin: true };
            states[id] = null;
            return bot.sendMessage(id, "👑 Admin activo", menuAdmin(id));
        }

        states[id] = null;
        return bot.sendMessage(id, "❌ Incorrecto");
    }

    // ===== LOGOUT =====

    if (text === "🚪 Cerrar sesión") {
        delete users[id];
        return menuInicio(id);
    }

    if (!users[id] || !users[id].isAdmin) return;

    // ===== CREAR PRODUCTO =====

    if (text === "➕ Crear producto") {
        states[id] = "crear_nombre";
        return bot.sendMessage(id, "📝 Escribe el nombre del producto:");
    }

    if (states[id] === "crear_nombre") {
        temp[id] = { nombre: text };

        return bot.sendMessage(id,
            `✅ Nombre: ${text}\n\n¿Crear producto?`,
            {
                reply_markup: {
                    keyboard: [["✅ Crear producto"], ["❌ Cancelar"]],
                    resize_keyboard: true
                }
            }
        );
    }

    if (text === "✅ Crear producto") {
        let nombre = temp[id].nombre;

        products[nombre] = { variantes: {} };
        keys[nombre] = {};

        states[id] = null;

        return abrirProducto(id, nombre);
    }

    // ===== VER PRODUCTOS =====

    if (text === "📦 Productos") {
        let botones = [["➕ Agregar producto"]];

        Object.keys(products).forEach(p => {
            botones.push([p]);
        });

        botones.push(["⬅️ Atrás"]);

        return bot.sendMessage(id, "📦 Productos\nGestiona tus productos:", {
            reply_markup: { keyboard: botones, resize_keyboard: true }
        });
    }

    // ===== ENTRAR PRODUCTO =====

    if (products[text]) {
        return abrirProducto(id, text);
    }

    function abrirProducto(id, nombre) {
        let p = products[nombre];
        let variantes = Object.keys(p.variantes).length;

        let botones = [
            ["➕ Agregar duración/precio"],
            ["📋 Funciones/descripcion", "🎬 Link video"],
            ["📄 Editar mensaje entrega"],
            ["🚫 Desactivar producto"],
            ["🗑 Eliminar"]
        ];

        for (let d in p.variantes) {
            let precio = p.variantes[d];
            let total = keys[nombre][d]?.length || 0;

            botones.push([`${d} días $${precio} (${total})`]);
        }

        botones.push(["⬅️ Atrás"]);

        bot.sendMessage(id,
            `📦 ${nombre}\n\nVariantes: ${variantes}\n📄 Entrega: Sin configurar`,
            {
                reply_markup: { keyboard: botones, resize_keyboard: true }
            }
        );

        sessions[id] = { producto: nombre };
    }

    // ===== AGREGAR DURACIÓN =====

    if (text === "➕ Agregar duración/precio") {
        states[id] = "duracion";
        return bot.sendMessage(id, "📅 Selecciona duración:", {
            reply_markup: {
                keyboard: [
                    ["1"], ["7"], ["15"], ["30"],
                    ["✏️ Otra"],
                    ["❌ Cancelar"]
                ],
                resize_keyboard: true
            }
        });
    }

    if (states[id] === "duracion") {
        if (text === "✏️ Otra") {
            states[id] = "otra";
            return bot.sendMessage(id, "Escribe días:");
        }

        temp[id] = { duracion: text };
        states[id] = "precio";

        return bot.sendMessage(id,
            `💰 Precio para ${text} días\nEscribe número:`
        );
    }

    if (states[id] === "otra") {
        temp[id] = { duracion: text };
        states[id] = "precio";
        return bot.sendMessage(id, `💰 Precio para ${text} días`);
    }

    if (states[id] === "precio") {
        let { producto } = sessions[id];
        let d = temp[id].duracion;

        products[producto].variantes[d] = text;
        if (!keys[producto][d]) keys[producto][d] = [];

        states[id] = null;

        return abrirProducto(id, producto);
    }

    // ===== ENTRAR VARIANTE =====

    let match = text.match(/^(\d+) días \$(\d+)/);
    if (match) {
        let d = match[1];
        let producto = sessions[id].producto;

        let precio = products[producto].variantes[d];
        let total = keys[producto][d].length;

        sessions[id].duracion = d;

        return bot.sendMessage(id,
            `🔑 ${d} días\nPrecio: $${precio}\nKeys disponibles: ${total}`,
            {
                reply_markup: {
                    keyboard: [
                        ["➕ Agregar keys"],
                        ["✏️ Editar precio"],
                        ["🗑 Eliminar variante"],
                        ["⬅️ Atrás"]
                    ],
                    resize_keyboard: true
                }
            }
        );
    }

    // ===== AGREGAR KEYS =====

    if (text === "➕ Agregar keys") {
        states[id] = "keys";
        return bot.sendMessage(id, "📩 Envía las keys (una por línea)");
    }

    if (states[id] === "keys") {
        let { producto, duracion } = sessions[id];

        let nuevas = text.split("\n");
        keys[producto][duracion].push(...nuevas);

        states[id] = null;

        return bot.sendMessage(id, `✅ ${nuevas.length} keys agregadas`);
    }

    // ===== EDITAR PRECIO =====

    if (text === "✏️ Editar precio") {
        states[id] = "edit_precio";
        return bot.sendMessage(id, "Nuevo precio:");
    }

    if (states[id] === "edit_precio") {
        let { producto, duracion } = sessions[id];

        products[producto].variantes[duracion] = text;
        states[id] = null;

        return bot.sendMessage(id, "✅ Precio actualizado");
    }

    // ===== ELIMINAR VARIANTE =====

    if (text === "🗑 Eliminar variante") {
        let { producto, duracion } = sessions[id];

        delete products[producto].variantes[duracion];
        delete keys[producto][duracion];

        return abrirProducto(id, producto);
    }

    if (text === "⬅️ Atrás") {
        return menuAdmin(id);
    }
});
