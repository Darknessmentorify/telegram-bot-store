const TelegramBot = require('node-telegram-bot-api');
const admin = require('firebase-admin');

// 🔥 CARGAR FIREBASE
const serviceAccount = require('./firebase.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

// 🔑 TOKEN DE TU BOT
const bot = new TelegramBot('8601185129:AAFqKKcB2BPUc_gGvbtbs7QGc6v-kDQLAuw', { polling: true });

// 👑 ID DEL ADMIN (tu ID de Telegram)
const ADMIN_ID = 123456789;

// =======================
// 👤 REGISTRO / LOGIN
// =======================

bot.onText(/\/start/, async (msg) => {
  const id = msg.from.id;

  const userRef = db.collection('users').doc(String(id));
  const user = await userRef.get();

  if (!user.exists) {
    await userRef.set({
      username: msg.from.username || "user",
      saldo: 0,
      password: "1234"
    });

    bot.sendMessage(id, "✅ Cuenta creada\nUsuario: " + msg.from.username + "\nContraseña: 1234");
  } else {
    bot.sendMessage(id, "👋 Bienvenido de nuevo");
  }
});

// =======================
// 💰 VER SALDO
// =======================

bot.onText(/\/saldo/, async (msg) => {
  const id = msg.from.id;

  const user = await db.collection('users').doc(String(id)).get();

  bot.sendMessage(id, "💰 Tu saldo: $" + user.data().saldo);
});

// =======================
// ➕ ADMIN AGREGA SALDO
// =======================

bot.onText(/\/addsaldo (.+) (.+)/, async (msg, match) => {
  if (msg.from.id !== ADMIN_ID) return;

  const userId = match[1];
  const amount = parseFloat(match[2]);

  const userRef = db.collection('users').doc(userId);
  const user = await userRef.get();

  if (!user.exists) {
    return bot.sendMessage(msg.chat.id, "❌ Usuario no existe");
  }

  await userRef.update({
    saldo: admin.firestore.FieldValue.increment(amount)
  });

  bot.sendMessage(msg.chat.id, "✅ Saldo agregado");
});

// =======================
// 🛒 PRODUCTOS
// =======================

bot.onText(/\/productos/, async (msg) => {
  const snapshot = await db.collection('productos').get();

  if (snapshot.empty) {
    return bot.sendMessage(msg.chat.id, "❌ No hay productos");
  }

  let text = "🛒 Productos:\n\n";

  snapshot.forEach(doc => {
    const p = doc.data();
    text += `📦 ${p.nombre} - $${p.precio}\n/comprar_${doc.id}\n\n`;
  });

  bot.sendMessage(msg.chat.id, text);
});

// =======================
// 💳 COMPRAR
// =======================

bot.onText(/\/comprar_(.+)/, async (msg, match) => {
  const id = msg.from.id;
  const productId = match[1];

  const userRef = db.collection('users').doc(String(id));
  const user = await userRef.get();

  const productRef = db.collection('productos').doc(productId);
  const product = await productRef.get();

  if (!product.exists) {
    return bot.sendMessage(id, "❌ Producto no existe");
  }

  const p = product.data();

  if (user.data().saldo < p.precio) {
    return bot.sendMessage(id, "❌ Saldo insuficiente");
  }

  // descontar saldo
  await userRef.update({
    saldo: user.data().saldo - p.precio
  });

  bot.sendMessage(id, "✅ Compra exitosa\n📦 " + p.nombre);
});

// =======================
// ➕ ADMIN CREA PRODUCTO
// =======================

bot.onText(/\/addproducto (.+) (.+)/, async (msg, match) => {
  if (msg.from.id !== ADMIN_ID) return;

  const nombre = match[1];
  const precio = parseFloat(match[2]);

  await db.collection('productos').add({
    nombre,
    precio
  });

  bot.sendMessage(msg.chat.id, "✅ Producto agregado");
});
