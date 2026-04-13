import telebot
from telebot.types import ReplyKeyboardMarkup
import json
import os

# ================= CONFIG =================

TOKEN = os.getenv("TOKEN")

if not TOKEN:
    print("❌ TOKEN NO DETECTADO")
    exit()

bot = telebot.TeleBot(TOKEN)

DB_FILE = "database.json"

# ================= DATABASE =================

def load_db():
    if not os.path.exists(DB_FILE):
        return {
            "users": {},
            "products": {},
            "keys": {},
            "purchases": [],
            "recharges": [],
            "welcome": "Bienvenido"
        }
    with open(DB_FILE, "r") as f:
        return json.load(f)

def save_db():
    with open(DB_FILE, "w") as f:
        json.dump(db, f, indent=4)

db = load_db()

# ================= ADMIN =================

ADMIN_USER = "Guillermo65"
ADMIN_PASS = "Guillermito00"

sessions = {}
states = {}
temp = {}

# ================= MENUS =================

def menu_user():
    kb = ReplyKeyboardMarkup(resize_keyboard=True)
    kb.add("🛒 Comprar", "💰 Saldo")
    kb.add("📦 Mis compras")
    kb.add("🚪 Salir")
    return kb

def menu_admin():
    kb = ReplyKeyboardMarkup(resize_keyboard=True)
    kb.add("📦 Productos", "📢 Broadcast")
    kb.add("💰 Recargas", "📜 Compras")
    kb.add("✏️ Bienvenida")
    kb.add("🚪 Salir")
    return kb

def cancel():
    kb = ReplyKeyboardMarkup(resize_keyboard=True)
    kb.add("❌ Cancelar")
    return kb

# ================= START =================

@bot.message_handler(commands=['start'])
def start(msg):
    uid = str(msg.chat.id)

    if uid not in db["users"]:
        db["users"][uid] = {"saldo": 0}
        save_db()

    bot.send_message(uid, db["welcome"], reply_markup=menu_user())

# ================= USER =================

@bot.message_handler(func=lambda m: m.text == "🛒 Comprar")
def comprar(msg):
    kb = ReplyKeyboardMarkup(resize_keyboard=True)

    if not db["products"]:
        return bot.send_message(msg.chat.id, "❌ No hay productos aún")

    for p in db["products"]:
        kb.add(p)

    kb.add("🚪 Salir")
    bot.send_message(msg.chat.id, "Elige producto:", reply_markup=kb)

@bot.message_handler(func=lambda m: m.text in db["products"])
def producto(msg):
    temp[msg.chat.id] = {"producto": msg.text}
    states[msg.chat.id] = "precio"

    precios = db["products"][msg.text]

    if not precios:
        return bot.send_message(msg.chat.id, "❌ Sin precios definidos")

    text = "Precios disponibles:\n"
    for p in precios:
        text += f"- {p}\n"

    bot.send_message(msg.chat.id, text + "\nEscribe el precio exacto:")

@bot.message_handler(func=lambda m: states.get(m.chat.id) == "precio")
def comprar_precio(msg):
    uid = str(msg.chat.id)
    producto = temp[msg.chat.id]["producto"]
    precio = msg.text

    if precio not in db["products"][producto]:
        return bot.send_message(msg.chat.id, "❌ Precio inválido")

    precio = int(precio)

    if db["users"][uid]["saldo"] < precio:
        return bot.send_message(msg.chat.id, "❌ Saldo insuficiente")

    if producto not in db["keys"] or not db["keys"][producto]:
        return bot.send_message(msg.chat.id, "❌ Sin stock")

    key = db["keys"][producto].pop(0)

    db["users"][uid]["saldo"] -= precio
    db["purchases"].append(f"{uid} - {producto} - ${precio}")

    save_db()

    bot.send_message(msg.chat.id, f"✅ Compra exitosa\n\n🔑 {key}", reply_markup=menu_user())
    states[msg.chat.id] = None

@bot.message_handler(func=lambda m: m.text == "💰 Saldo")
def saldo(msg):
    uid = str(msg.chat.id)
    saldo = db["users"][uid]["saldo"]

    bot.send_message(msg.chat.id, f"💰 Tu saldo: ${saldo}\n\n¿Deseas recargar? Escribe monto")

    states[msg.chat.id] = "recarga"

@bot.message_handler(func=lambda m: states.get(m.chat.id) == "recarga")
def pedir_recarga(msg):
    uid = str(msg.chat.id)

    if not msg.text.isdigit():
        return bot.send_message(msg.chat.id, "❌ Solo números")

    monto = int(msg.text)

    db["recharges"].append({
        "user": uid,
        "monto": monto
    })

    save_db()

    states[msg.chat.id] = None
    bot.send_message(msg.chat.id, "⏳ Recarga enviada, espera aprobación")

@bot.message_handler(func=lambda m: m.text == "📦 Mis compras")
def compras_user(msg):
    uid = str(msg.chat.id)

    text = "📦 Tus compras:\n\n"

    for c in db["purchases"]:
        if uid in c:
            text += c + "\n"

    bot.send_message(msg.chat.id, text if text != "📦 Tus compras:\n\n" else "Sin compras")

# ================= ADMIN LOGIN =================

@bot.message_handler(commands=['admin'])
def admin(msg):
    states[msg.chat.id] = "admin_user"
    bot.send_message(msg.chat.id, "Usuario:")

@bot.message_handler(func=lambda m: states.get(m.chat.id) == "admin_user")
def admin_user(msg):
    temp[msg.chat.id] = msg.text
    states[msg.chat.id] = "admin_pass"
    bot.send_message(msg.chat.id, "Contraseña:")

@bot.message_handler(func=lambda m: states.get(m.chat.id) == "admin_pass")
def admin_pass(msg):
    if temp[msg.chat.id] == ADMIN_USER and msg.text == ADMIN_PASS:
        sessions[msg.chat.id] = True
        states[msg.chat.id] = None
        bot.send_message(msg.chat.id, "👑 Admin activo", reply_markup=menu_admin())
    else:
        bot.send_message(msg.chat.id, "❌ Datos incorrectos")

# ================= ADMIN FUNCIONES =================

@bot.message_handler(func=lambda m: m.text == "📦 Productos" and sessions.get(m.chat.id))
def productos(msg):
    states[msg.chat.id] = "crear_producto"
    bot.send_message(msg.chat.id, "Nombre del producto:")

@bot.message_handler(func=lambda m: states.get(m.chat.id) == "crear_producto")
def save_producto(msg):
    db["products"][msg.text] = []
    db["keys"][msg.text] = []
    save_db()

    states[msg.chat.id] = None
    bot.send_message(msg.chat.id, "✅ Producto creado", reply_markup=menu_admin())

@bot.message_handler(func=lambda m: m.text == "📢 Broadcast" and sessions.get(m.chat.id))
def broadcast(msg):
    states[msg.chat.id] = "broadcast"
    bot.send_message(msg.chat.id, "Mensaje:")

@bot.message_handler(func=lambda m: states.get(m.chat.id) == "broadcast")
def send_all(msg):
    for u in db["users"]:
        try:
            bot.send_message(u, msg.text)
        except:
            pass

    states[msg.chat.id] = None
    bot.send_message(msg.chat.id, "✅ Enviado")

@bot.message_handler(func=lambda m: m.text == "💰 Recargas" and sessions.get(m.chat.id))
def recargas(msg):
    text = "💰 Recargas:\n\n"

    for i, r in enumerate(db["recharges"]):
        text += f"{i} - {r['user']} - ${r['monto']}\n"

    bot.send_message(msg.chat.id, text + "\nEscribe ID para aprobar")

    states[msg.chat.id] = "aprobar"

@bot.message_handler(func=lambda m: states.get(m.chat.id) == "aprobar")
def aprobar(msg):
    i = int(msg.text)

    r = db["recharges"].pop(i)

    db["users"][r["user"]]["saldo"] += r["monto"]

    save_db()

    bot.send_message(msg.chat.id, "✅ Recarga aprobada")

@bot.message_handler(func=lambda m: m.text == "📜 Compras" and sessions.get(m.chat.id))
def compras_admin(msg):
    text = "📜 Compras:\n\n"

    for c in db["purchases"]:
        text += c + "\n"

    bot.send_message(msg.chat.id, text)

@bot.message_handler(func=lambda m: m.text == "✏️ Bienvenida" and sessions.get(m.chat.id))
def bienvenida(msg):
    states[msg.chat.id] = "welcome"
    bot.send_message(msg.chat.id, "Nuevo mensaje:")

@bot.message_handler(func=lambda m: states.get(m.chat.id) == "welcome")
def save_welcome(msg):
    db["welcome"] = msg.text
    save_db()

    states[msg.chat.id] = None
    bot.send_message(msg.chat.id, "✅ Actualizado")

# ================= SALIR =================

@bot.message_handler(func=lambda m: m.text == "🚪 Salir")
def salir(msg):
    sessions.pop(msg.chat.id, None)
    bot.send_message(msg.chat.id, "👋 Menú", reply_markup=menu_user())

# ================= RUN =================

print("✅ BOT ONLINE")
bot.infinity_polling()
