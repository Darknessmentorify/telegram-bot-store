import telebot
import json
import os

TOKEN = os.getenv("TOKEN")
bot = telebot.TeleBot(TOKEN)

ADMIN_USER = "Guillermo65"
ADMIN_PASS = "Guillermito00."

DB_FILE = "database.json"

# ======================
# DATABASE
# ======================

def load_db():
    if not os.path.exists(DB_FILE):
        return {"users": {}, "products": {}, "keys": {}, "purchases": []}
    with open(DB_FILE, "r") as f:
        return json.load(f)

def save_db():
    with open(DB_FILE, "w") as f:
        json.dump(db, f, indent=4)

db = load_db()

states = {}
sessions = {}
temp = {}

# ======================
# MENUS
# ======================

def menu_login():
    kb = telebot.types.ReplyKeyboardMarkup(resize_keyboard=True)
    kb.add("🔐 Login")
    return kb

def menu_user():
    kb = telebot.types.ReplyKeyboardMarkup(resize_keyboard=True)
    kb.add("🛒 Comprar", "💰 Saldo")
    kb.add("📜 Mis compras")
    kb.add("🚪 Salir")
    return kb

def menu_admin():
    kb = telebot.types.ReplyKeyboardMarkup(resize_keyboard=True)
    kb.add("📦 Productos", "💰 Recargar usuario")
    kb.add("📊 Estadísticas", "📢 Broadcast")
    kb.add("🚪 Salir")
    return kb

def btn_back():
    kb = telebot.types.ReplyKeyboardMarkup(resize_keyboard=True)
    kb.add("⬅️ Atrás")
    return kb

# ======================
# START
# ======================

@bot.message_handler(commands=['start'])
def start(msg):
    uid = str(msg.chat.id)

    if uid not in db["users"]:
        db["users"][uid] = {"saldo": 0}
        save_db()

    bot.send_message(msg.chat.id, "Bienvenido", reply_markup=menu_user())

# ======================
# ADMIN LOGIN
# ======================

@bot.message_handler(func=lambda m: m.text == "/admin")
def admin_login(msg):
    states[msg.chat.id] = "admin_user"
    bot.send_message(msg.chat.id, "Usuario:")

@bot.message_handler(func=lambda m: states.get(m.chat.id) == "admin_user")
def admin_user(msg):
    temp[msg.chat.id] = {"user": msg.text}
    states[msg.chat.id] = "admin_pass"
    bot.send_message(msg.chat.id, "Contraseña:")

@bot.message_handler(func=lambda m: states.get(m.chat.id) == "admin_pass")
def admin_pass(msg):
    if temp[msg.chat.id]["user"] == ADMIN_USER and msg.text == ADMIN_PASS:
        bot.send_message(msg.chat.id, "Admin activo", reply_markup=menu_admin())
    else:
        bot.send_message(msg.chat.id, "Error")

    states[msg.chat.id] = None

# ======================
# PRODUCTOS ADMIN
# ======================

@bot.message_handler(func=lambda m: m.text == "📦 Productos")
def productos(msg):
    kb = telebot.types.ReplyKeyboardMarkup(resize_keyboard=True)
    kb.add("➕ Crear producto")

    for p in db["products"]:
        kb.add(p)

    kb.add("⬅️ Atrás")
    bot.send_message(msg.chat.id, "Productos:", reply_markup=kb)

@bot.message_handler(func=lambda m: m.text == "➕ Crear producto")
def crear_producto(msg):
    states[msg.chat.id] = "new_product"
    bot.send_message(msg.chat.id, "Nombre del producto:")

@bot.message_handler(func=lambda m: states.get(m.chat.id) == "new_product")
def save_producto(msg):
    db["products"][msg.text] = {}
    db["keys"][msg.text] = {}
    save_db()

    states[msg.chat.id] = None
    bot.send_message(msg.chat.id, "Producto creado")

# ======================
# AGREGAR DURACIONES
# ======================

@bot.message_handler(func=lambda m: m.text in db["products"])
def abrir_producto(msg):
    sessions[msg.chat.id] = {"producto": msg.text}

    kb = telebot.types.ReplyKeyboardMarkup(resize_keyboard=True)

    kb.add("➕ Agregar duración")

    for d in db["products"][msg.text]:
        precio = db["products"][msg.text][d]
        stock = len(db["keys"][msg.text].get(d, []))
        kb.add(f"{d} días - ${precio} ({stock})")

    kb.add("⬅️ Atrás")

    bot.send_message(msg.chat.id, "Producto:", reply_markup=kb)

@bot.message_handler(func=lambda m: m.text == "➕ Agregar duración")
def add_duracion(msg):
    states[msg.chat.id] = "duracion"
    bot.send_message(msg.chat.id, "Días:")

@bot.message_handler(func=lambda m: states.get(m.chat.id) == "duracion")
def set_duracion(msg):
    temp[msg.chat.id] = {"d": msg.text}
    states[msg.chat.id] = "precio"
    bot.send_message(msg.chat.id, "Precio:")

@bot.message_handler(func=lambda m: states.get(m.chat.id) == "precio")
def set_precio(msg):
    p = sessions[msg.chat.id]["producto"]
    d = temp[msg.chat.id]["d"]

    db["products"][p][d] = float(msg.text)
    db["keys"][p][d] = []
    save_db()

    states[msg.chat.id] = None
    bot.send_message(msg.chat.id, "Duración agregada")

# ======================
# KEYS
# ======================

@bot.message_handler(func=lambda m: "días -" in m.text)
def abrir_variante(msg):
    p = sessions[msg.chat.id]["producto"]
    d = msg.text.split(" ")[0]

    sessions[msg.chat.id]["duracion"] = d

    kb = telebot.types.ReplyKeyboardMarkup(resize_keyboard=True)
    kb.add("🔑 Agregar keys")
    kb.add("⬅️ Atrás")

    bot.send_message(msg.chat.id, f"{p} {d}", reply_markup=kb)

@bot.message_handler(func=lambda m: m.text == "🔑 Agregar keys")
def add_keys(msg):
    states[msg.chat.id] = "keys"
    bot.send_message(msg.chat.id, "Envía keys (una por línea):")

@bot.message_handler(func=lambda m: states.get(m.chat.id) == "keys")
def save_keys_handler(msg):
    p = sessions[msg.chat.id]["producto"]
    d = sessions[msg.chat.id]["duracion"]

    nuevas = msg.text.split("\n")
    db["keys"][p][d].extend(nuevas)
    save_db()

    states[msg.chat.id] = None
    bot.send_message(msg.chat.id, f"{len(nuevas)} keys agregadas")

# ======================
# COMPRAR
# ======================

@bot.message_handler(func=lambda m: m.text == "🛒 Comprar")
def comprar(msg):
    kb = telebot.types.ReplyKeyboardMarkup(resize_keyboard=True)

    for p in db["products"]:
        kb.add(p)

    bot.send_message(msg.chat.id, "Elige producto:", reply_markup=kb)

@bot.message_handler(func=lambda m: m.text in db["products"])
def elegir_producto_user(msg):
    sessions[msg.chat.id] = {"producto": msg.text}

    kb = telebot.types.ReplyKeyboardMarkup(resize_keyboard=True)

    for d in db["products"][msg.text]:
        kb.add(d)

    bot.send_message(msg.chat.id, "Duración:", reply_markup=kb)

@bot.message_handler(func=lambda m: m.chat.id in sessions and m.text.isdigit())
def comprar_final(msg):
    uid = str(msg.chat.id)
    p = sessions[msg.chat.id]["producto"]
    d = msg.text

    precio = db["products"][p][d]

    if db["users"][uid]["saldo"] < precio:
        return bot.send_message(msg.chat.id, "Saldo insuficiente")

    if not db["keys"][p][d]:
        return bot.send_message(msg.chat.id, "Sin stock")

    key = db["keys"][p][d].pop(0)

    db["users"][uid]["saldo"] -= precio
    db["purchases"].append(f"{uid} - {p} {d}")

    save_db()

    bot.send_message(msg.chat.id, f"✅ Compra\n🔑 {key}")

# ======================
# SALDO
# ======================

@bot.message_handler(func=lambda m: m.text == "💰 Saldo")
def saldo(msg):
    uid = str(msg.chat.id)
    bot.send_message(msg.chat.id, f"Saldo: ${db['users'][uid]['saldo']}")

# ======================
# HISTORIAL
# ======================

@bot.message_handler(func=lambda m: m.text == "📜 Mis compras")
def historial(msg):
    uid = str(msg.chat.id)
    data = [x for x in db["purchases"] if uid in x]

    bot.send_message(msg.chat.id, "\n".join(data) or "Sin compras")

# ======================
# RECARGA ADMIN
# ======================

@bot.message_handler(func=lambda m: m.text == "💰 Recargar usuario")
def recarga(msg):
    states[msg.chat.id] = "rec_user"
    bot.send_message(msg.chat.id, "ID usuario:")

@bot.message_handler(func=lambda m: states.get(m.chat.id) == "rec_user")
def rec_user(msg):
    temp[msg.chat.id] = {"id": msg.text}
    states[msg.chat.id] = "rec_monto"
    bot.send_message(msg.chat.id, "Monto:")

@bot.message_handler(func=lambda m: states.get(m.chat.id) == "rec_monto")
def rec_monto(msg):
    uid = temp[msg.chat.id]["id"]

    db["users"][uid]["saldo"] += float(msg.text)
    save_db()

    states[msg.chat.id] = None
    bot.send_message(msg.chat.id, "Recarga exitosa")

# ======================
# STATS
# ======================

@bot.message_handler(func=lambda m: m.text == "📊 Estadísticas")
def stats(msg):
    bot.send_message(msg.chat.id,
        f"Usuarios: {len(db['users'])}\nCompras: {len(db['purchases'])}"
    )

# ======================
# BROADCAST
# ======================

@bot.message_handler(func=lambda m: m.text == "📢 Broadcast")
def bc(msg):
    states[msg.chat.id] = "bc"
    bot.send_message(msg.chat.id, "Mensaje:")

@bot.message_handler(func=lambda m: states.get(m.chat.id) == "bc")
def send_bc(msg):
    for u in db["users"]:
        try:
            bot.send_message(u, msg.text)
        except:
            pass

    states[msg.chat.id] = None
    bot.send_message(msg.chat.id, "Enviado")

# ======================

bot.infinity_polling()
