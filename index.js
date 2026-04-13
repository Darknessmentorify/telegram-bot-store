const TelegramBot = require('node-telegram-bot-api');
const bot = new TelegramBot(process.env.BOT_TOKEN, { polling: true });

// ===== CONFIG =====
const ADMIN_USER = "Guillermo65";
const ADMIN_PASS = "Guillermito00";

// ===== BASE =====
let users = {};
let states = {};
let temp = {};
let products = {};
let keys = {};
let sessions = {};

// ===== MENUS =====

function menuInicio(id) {
    bot.sendMessage(id, "🔐 Opciones:", {
        reply_markup: {
            keyboard: [["🔐 Login"], ["📝 Registrarse"]],
            resize_keyboard: true
        }
    });
}

function panelAdmin(id) {
    sessions[id] = { menu: "admin" };

    bot.sendMessage(id,
        `🛠 Panel de Administración
📅 Días activos: 15 días

Elige una opción:`,
        {
            reply_markup: {
                keyboard: [
                    ["📦 Productos", "📢 Broadcast", "🎁 Crear Promo"],
                    ["💳 Pagos", "📊 Estadísticas"],
                    ["👥 Usuarios", "📝 Registros", "🧾 Compras"],
                    ["💰 Recargas", "✏️ Bienvenida"],
                    ["⬅️ Atrás"],
                    ["🔒 Solo yo admin"]
                ],
                resize_keyboard: true
            }
        }
    );
}

function mostrarProductos(id) {
    sessions[id] = { menu: "productos" };

    let botones = [["➕ Crear producto"]];

    Object.keys(products).forEach(p => {
        botones.push([p]);
    });

    botones.push(["⬅️ Volver"]);

    bot.sendMessage(id, "📦 Productos:", {
        reply_markup: { keyboard: botones, resize_keyboard: true }
    });
}

function abrirProducto(id, nombre) {
    sessions[id] = { menu: "producto", producto: nombre };

    let p = products[nombre];

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

    botones.push(["⬅️ Volver"]);

    bot.sendMessage(id,
        `📦 ${nombre}\n\nVariantes: ${Object.keys(p.variantes).length}`,
        {
            reply_markup: { keyboard: botones, resize_keyboard: true }
        }
    );
}

function abrirVariante(id, producto, d) {
    sessions[id] = { menu: "variante", producto, duracion: d };

    let precio = products[producto].variantes[d];
    let total = keys[producto][d].length;

    bot.sendMessage(id,
        `🔑 ${d} días\nPrecio: $${precio}\nKeys disponibles: ${total}`,
        {
            reply_markup: {
                keyboard: [
                    ["➕ Agregar keys"],
                    ["✏️ Editar precio"],
                    ["🗑 Eliminar variante"],
                    ["⬅️ Volver"]
                ],
                resize_keyboard: true
            }
        }
    );
}

// ===== START =====

bot.onText(/\/start/, (msg) => {
    const id = msg.chat.id;

    if (!users[id]) return menuInicio(id);
    if (users[id].isAdmin) return panelAdmin(id);
});

// ===== MENSAJES =====

bot.on("message", (msg) => {
    const id = msg.chat.id;
    const text = msg.text;

    if (!text) return;

    // ===== VOLVER GLOBAL =====
    if (text === "⬅️ Volver" || text === "⬅️ Atrás") {

        let s = sessions[id];

        if (!s) return panelAdmin(id);

        if (s.menu === "variante") {
            return abrirProducto(id, s.producto);
        }

        if (s.menu === "producto") {
            return mostrarProductos(id);
        }

        if (s.menu === "productos") {
            return panelAdmin(id);
        }

        return panelAdmin(id);
    }

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

        states[id] = null;

        if (u === ADMIN_USER && p === ADMIN_PASS) {
            users[id] = { username: u, isAdmin: true };
            return bot.sendMessage(id, "👑 Admin activo", panelAdmin(id));
        }

        return bot.sendMessage(id, "❌ Datos incorrectos");
    }

    if (!users[id] || !users[id].isAdmin) return;

    // ===== PANEL =====

    if (text === "📦 Productos") return mostrarProductos(id);

    // ===== CREAR PRODUCTO =====

    if (text === "➕ Crear producto") {
        states[id] = "crear_nombre";
        return bot.sendMessage(id, "📝 Escribe el nombre:");
    }

    if (states[id] === "crear_nombre") {

        if (text.includes("Crear") || text.includes("Cancelar")) return;

        temp[id] = { nombre: text };
        states[id] = "confirmar";

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

    if (states[id] === "confirmar") {

        if (text === "❌ Cancelar") {
            states[id] = null;
            return panelAdmin(id);
        }

        if (text === "✅ Crear producto") {
            let nombre = temp[id].nombre;

            products[nombre] = { variantes: {} };
            keys[nombre] = {};

            states[id] = null;

            return abrirProducto(id, nombre);
        }
    }

    // ===== ENTRAR PRODUCTO =====

    if (products[text]) {
        return abrirProducto(id, text);
    }

    // ===== AGREGAR DURACIÓN =====

    if (text === "➕ Agregar duración/precio") {
        states[id] = "duracion";
        return bot.sendMessage(id, "📅 Duración:", {
            reply_markup: {
                keyboard: [
                    ["1", "7", "15", "30"],
                    ["✏️ Otra duración"],
                    ["❌ Cancelar"]
                ],
                resize_keyboard: true
            }
        });
    }

    if (states[id] === "duracion") {

        if (text === "✏️ Otra duración") {
            states[id] = "otra";
            return bot.sendMessage(id, "Escribe días:");
        }

        temp[id] = { duracion: text };
        states[id] = "precio";

        return bot.sendMessage(id, `💰 Precio para ${text} días:`);
    }

    if (states[id] === "otra") {
        temp[id] = { duracion: text };
        states[id] = "precio";
        return bot.sendMessage(id, `💰 Precio para ${text} días:`);
    }

    if (states[id] === "precio") {
        let { producto } = sessions[id];
        let d = temp[id].duracion;

        products[producto].variantes[d] = text;
        keys[producto][d] = [];

        states[id] = null;

        return abrirProducto(id, producto);
    }

    // ===== VARIANTE =====

    let match = text.match(/^(\d+) días \$(\d+)/);

    if (match) {
        let d = match[1];
        let producto = sessions[id].producto;

        return abrirVariante(id, producto, d);
    }

    // ===== KEYS =====

    if (text === "➕ Agregar keys") {
        states[id] = "keys";
        return bot.sendMessage(id, "📩 Envía keys (una por línea):");
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

});
