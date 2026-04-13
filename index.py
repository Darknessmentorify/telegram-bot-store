import telebot
from telebot.types import ReplyKeyboardMarkup
import json, os

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
    return json.load(open(DB_FILE))

def save_db():
    json.dump(db, open(DB_FILE, "w"), indent=4)

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
    kb.add("👥 Usuarios", "📊 Estadísticas")
    kb.add("✏️ Bienvenida")
    kb.add("🚪 Salir")
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

    for p in db["products"]:
        kb.add(p)

    kb.add("🚪 Salir")
    bot.send_message(msg.chat.id, "Elige producto:", reply_markup=kb)

@bot.message_handler(func=lambda m: m.text in db["products"])
def producto(msg):
    temp[msg.chat.id] = {"producto": msg.text}
    states[msg.chat.id] = "precio"

    precios = db["products"][msg.text]
    text = "Precios:\n" + "\n".join(precios)

    bot.send_message(msg.chat.id, text + "\nEscribe precio:")

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

    if not db["keys"].get(producto):
        return bot.send_message(msg.chat.id, "❌ Sin stock")

    key = db["keys"][producto].pop(0)

    db["users"][uid]["saldo"] -= precio
    db["purchases"].append(f"{uid} - {producto} - ${precio}")

    save_db()

    bot.send_message(msg.chat.id, f"✅ Compra\n🔑 {key}", reply_markup=menu_user())
    states[msg.chat.id] = None

@bot.message_handler(func=lambda m: m.text == "💰 Saldo")
def saldo(msg):
    uid = str(msg.chat.id)
    bot.send_message(msg.chat.id, f"💰 ${db['users'][uid]['saldo']}\nEscribe monto para recargar")
    states[msg.chat.id] = "recarga"

@bot.message_handler(func=lambda m: states.get(m.chat.id) == "recarga")
def recarga(msg):
    uid = str(msg.chat.id)

    db["recharges"].append({
        "user": uid,
        "monto": int(msg.text)
    })

    save_db()

    states[msg.chat.id] = None
    bot.send_message(msg.chat.id, "⏳ Enviado")

@bot.message_handler(func=lambda m: m.text == "📦 Mis compras")
def compras_user(msg):
    uid = str(msg.chat.id)

    text = "\n".join([c for c in db["purchases"] if uid in c]) or "Sin compras"
    bot.send_message(msg.chat.id, text)

# ================= ADMIN LOGIN =================

@bot.message_handler(commands=['admin'])
def admin(msg):
    states[msg.chat.id] = "login_user"
    bot.send_message(msg.chat.id, "Usuario:")

@bot.message_handler(func=lambda m: states.get(m.chat.id) == "login_user")
def user_admin(msg):
    temp[msg.chat.id] = msg.text
    states[msg.chat.id] = "login_pass"
    bot.send_message(msg.chat.id, "Contraseña:")

@bot.message_handler(func=lambda m: states.get(m.chat.id) == "login_pass")
def pass_admin(msg):
    if temp[msg.chat.id] == ADMIN_USER and msg.text == ADMIN_PASS:
        sessions[msg.chat.id] = True
        bot.send_message(msg.chat.id, "👑 Admin", reply_markup=menu_admin())
    else:
        bot.send_message(msg.chat.id, "❌ Error")

# ================= ADMIN FUNCIONES =================

@bot.message_handler(func=lambda m: m.text == "📦 Productos" and sessions.get(m.chat.id))
def productos(msg):
    states[msg.chat.id] = "crear_producto"
    bot.send_message(msg.chat.id, "Nombre producto:")

@bot.message_handler(func=lambda m: states.get(m.chat.id) == "crear_producto")
def crear_producto(msg):
    db["products"][msg.text] = []
    db["keys"][msg.text] = []
    save_db()
    states[msg.chat.id] = "precio_add"
    temp[msg.chat.id] = msg.text
    bot.send_message(msg.chat.id, "Precio:")

@bot.message_handler(func=lambda m: states.get(m.chat.id) == "precio_add")
def add_price(msg):
    db["products"][temp[msg.chat.id]].append(msg.text)
    save_db()
    states[msg.chat.id] = "key_add"
    bot.send_message(msg.chat.id, "Agrega keys (una por mensaje, escribe FIN para terminar)")

@bot.message_handler(func=lambda m: states.get(m.chat.id) == "key_add")
def add_keys(msg):
    if msg.text == "FIN":
        states[msg.chat.id] = None
        return bot.send_message(msg.chat.id, "✅ Producto listo", reply_markup=menu_admin())

    db["keys"][temp[msg.chat.id]].append(msg.text)
    save_db()

@bot.message_handler(func=lambda m: m.text == "📢 Broadcast" and sessions.get(m.chat.id))
def broadcast(msg):
    states[msg.chat.id] = "broadcast"
    bot.send_message(msg.chat.id, "Mensaje:")

@bot.message_handler(func=lambda m: states.get(m.chat.id) == "broadcast")
def send(msg):
    for u in db["users"]:
        try:
            bot.send_message(u, msg.text)
        except:
            pass
    states[msg.chat.id] = None
    bot.send_message(msg.chat.id, "✅ Enviado")

@bot.message_handler(func=lambda m: m.text == "💰 Recargas" and sessions.get(m.chat.id))
def recargas(msg):
    text = ""
    for i, r in enumerate(db["recharges"]):
        text += f"{i} - {r['user']} - ${r['monto']}\n"
    bot.send_message(msg.chat.id, text + "\nID para aprobar")
    states[msg.chat.id] = "aprobar"

@bot.message_handler(func=lambda m: states.get(m.chat.id) == "aprobar")
def aprobar(msg):
    r = db["recharges"].pop(int(msg.text))
    db["users"][r["user"]]["saldo"] += r["monto"]
    save_db()
    bot.send_message(msg.chat.id, "✅ Aprobado")

@bot.message_handler(func=lambda m: m.text == "📜 Compras" and sessions.get(m.chat.id))
def compras(msg):
    bot.send_message(msg.chat.id, "\n".join(db["purchases"]))

@bot.message_handler(func=lambda m: m.text == "👥 Usuarios" and sessions.get(m.chat.id))
def users(msg):
    bot.send_message(msg.chat.id, f"👥 Total: {len(db['users'])}")

@bot.message_handler(func=lambda m: m.text == "📊 Estadísticas" and sessions.get(m.chat.id))
def stats(msg):
    bot.send_message(msg.chat.id,
        f"📊 Stats\nUsuarios: {len(db['users'])}\nCompras: {len(db['purchases'])}\nProductos: {len(db['products'])}"
    )

@bot.message_handler(func=lambda m: m.text == "✏️ Bienvenida" and sessions.get(m.chat.id))
def bienvenida(msg):
    states[msg.chat.id] = "welcome"
    bot.send_message(msg.chat.id, "Nuevo mensaje:")

@bot.message_handler(func=lambda m: states.get(m.chat.id) == "welcome")
def save_welcome(msg):
    db["welcome"] = msg.text
    save_db()
    states[msg.chat.id] = None
    bot.send_message(msg.chat.id, "✅ Guardado")

# ================= SALIR =================

@bot.message_handler(func=lambda m: m.text == "🚪 Salir")
def salir(msg):
    sessions.pop(msg.chat.id, None)
    bot.send_message(msg.chat.id, "👋", reply_markup=menu_user())

# ================= RUN =================

print("🔥 BOT PRO MAX ACTIVO")
bot.infinity_polling()
