import telebot
from telebot.types import ReplyKeyboardMarkup
import json
import os

TOKEN = os.getenv("TOKEN")
bot = telebot.TeleBot(TOKEN)

DB_FILE = "database.json"

# =====================
# DATABASE
# =====================

def load_db():
    if not os.path.exists(DB_FILE):
        return {
            "users": {},
            "products": {},
            "purchases": [],
            "recharges": [],
            "welcome": "👋 Bienvenido a DARKNESS KEYS"
        }
    with open(DB_FILE, "r") as f:
        return json.load(f)

def save_db():
    with open(DB_FILE, "w") as f:
        json.dump(db, f, indent=4)

db = load_db()

# =====================
# ADMIN
# =====================

ADMIN_USER = "Guillermo65"
ADMIN_PASS = "Guillermito00"

sessions = {}
states = {}
temp = {}

# =====================
# MENUS
# =====================

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
    kb.add("👥 Usuarios", "📊 Stats")
    kb.add("✏️ Bienvenida")
    kb.add("🚪 Salir")
    return kb

def cancel_btn():
    kb = ReplyKeyboardMarkup(resize_keyboard=True)
    kb.add("❌ Cancelar")
    return kb

# =====================
# START
# =====================

@bot.message_handler(commands=['start'])
def start(msg):
    user_id = str(msg.chat.id)

    if user_id not in db["users"]:
        db["users"][user_id] = {"saldo": 0}
        save_db()

    bot.send_message(user_id, db["welcome"], reply_markup=menu_user())

# =====================
# USER
# =====================

@bot.message_handler(func=lambda m: m.text == "🛒 Comprar")
def comprar(msg):
    kb = ReplyKeyboardMarkup(resize_keyboard=True)

    for p in db["products"]:
        kb.add(p)

    kb.add("⬅️ Atrás")
    bot.send_message(msg.chat.id, "Elige producto:", reply_markup=kb)

@bot.message_handler(func=lambda m: m.text in db["products"])
def elegir_producto(msg):
    temp[msg.chat.id] = {"producto": msg.text}
    states[msg.chat.id] = "comprar"

    precios = db["products"][msg.text]
    text = "Precios:\n"
    for p in precios:
        text += f"- ${p}\n"

    bot.send_message(msg.chat.id, text + "\nEscribe el precio:")

@bot.message_handler(func=lambda m: states.get(m.chat.id) == "comprar")
def procesar_compra(msg):
    user_id = str(msg.chat.id)
    precio = msg.text

    if precio not in db["products"][temp[msg.chat.id]["producto"]]:
        return bot.send_message(msg.chat.id, "❌ Precio inválido")

    precio = int(precio)

    if db["users"][user_id]["saldo"] < precio:
        return bot.send_message(msg.chat.id, "❌ Saldo insuficiente")

    db["users"][user_id]["saldo"] -= precio

    compra = f"{user_id} - {temp[msg.chat.id]['producto']} - ${precio}"
    db["purchases"].append(compra)

    save_db()

    states[msg.chat.id] = None
    bot.send_message(msg.chat.id, "✅ Compra realizada", reply_markup=menu_user())

@bot.message_handler(func=lambda m: m.text == "💰 Saldo")
def saldo(msg):
    user_id = str(msg.chat.id)
    saldo = db["users"][user_id]["saldo"]

    bot.send_message(msg.chat.id, f"💰 Tu saldo: ${saldo}")

@bot.message_handler(func=lambda m: m.text == "📦 Mis compras")
def mis_compras(msg):
    user_id = str(msg.chat.id)

    text = "📦 Tus compras:\n\n"
    for c in db["purchases"]:
        if user_id in c:
            text += f"• {c}\n"

    bot.send_message(msg.chat.id, text)

# =====================
# ADMIN LOGIN
# =====================

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
        sessions[msg.chat.id] = True
        states[msg.chat.id] = None
        bot.send_message(msg.chat.id, "👑 Admin activo", reply_markup=menu_admin())
    else:
        bot.send_message(msg.chat.id, "❌ Error")

# =====================
# ADMIN PANEL
# =====================

@bot.message_handler(func=lambda m: m.text == "📦 Productos" and sessions.get(m.chat.id))
def admin_products(msg):
    states[msg.chat.id] = "new_product"
    bot.send_message(msg.chat.id, "Nombre producto:", reply_markup=cancel_btn())

@bot.message_handler(func=lambda m: states.get(m.chat.id) == "new_product")
def save_product(msg):
    db["products"][msg.text] = []
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
    text = "Recargas:\n\n"
    for r in db["recharges"]:
        text += f"{r}\n"
    bot.send_message(msg.chat.id, text)

@bot.message_handler(func=lambda m: m.text == "📜 Compras" and sessions.get(m.chat.id))
def compras_admin(msg):
    text = "Compras:\n\n"
    for c in db["purchases"]:
        text += f"{c}\n"
    bot.send_message(msg.chat.id, text)

@bot.message_handler(func=lambda m: m.text == "✏️ Bienvenida" and sessions.get(m.chat.id))
def welcome_edit(msg):
    states[msg.chat.id] = "welcome"
    bot.send_message(msg.chat.id, "Nuevo mensaje:")

@bot.message_handler(func=lambda m: states.get(m.chat.id) == "welcome")
def save_welcome(msg):
    db["welcome"] = msg.text
    save_db()
    states[msg.chat.id] = None
    bot.send_message(msg.chat.id, "✅ Guardado")

# =====================
# SALIR
# =====================

@bot.message_handler(func=lambda m: m.text == "🚪 Salir")
def salir(msg):
    sessions.pop(msg.chat.id, None)
    bot.send_message(msg.chat.id, "👋 Saliste", reply_markup=menu_user())

# =====================

bot.infinity_polling()
