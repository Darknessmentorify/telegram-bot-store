const TelegramBot = require('node-telegram-bot-api');
const admin = require('firebase-admin');

const serviceAccount = require('./firebase.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

const bot = new TelegramBot('8601185129:AAFqKKcB2BPUc_gGvbtbs7QGc6v-kDQLAuw', { polling: true });

// =======================
// 🧠 MEMORIA TEMPORAL LOGIN
// =======================

const sesiones = {};

// =======================
// 🔐 COMANDO LOGIN
// =======================

bot.onText(/\/login/, (msg) => {
  const id = msg.from.id;

  sesiones[id] = { paso: "usuario" };

  bot.sendMessage(id, "👤 Ingresa tu usuario:");
});

// =======================
// 📩 RESPUESTAS
// =======================

bot.on('message', async (msg) => {
  const id = msg.from.id;
  const text = msg.text;

  if (!sesiones[id]) return;

  // PASO USUARIO
  if (sesiones[id].paso === "usuario") {
    sesiones[id].username = text;
    sesiones[id].paso = "password";

    return bot.sendMessage(id, "🔒 Ingresa tu contraseña:");
  }

  // PASO PASSWORD
  if (sesiones[id].paso === "password") {
    const username = sesiones[id].username;
    const password = text;

    const snapshot = await db.collection('users')
      .where('username', '==', username)
      .where('password', '==', password)
      .get();

    if (snapshot.empty) {
      delete sesiones[id];
      return bot.sendMessage(id, "❌ Datos incorrectos");
    }

    const userDoc = snapshot.docs[0];

    sesiones[id] = {
      logueado: true,
      uid: userDoc.id,
      ...userDoc.data()
    };

    bot.sendMessage(id, "✅ Login exitoso");

    // MENÚ SEGÚN ROL
    if (sesiones[id].rol === "admin") {
      bot.sendMessage(id, "👑 Panel Admin:\n/addsaldo\n/addproducto\n/verusuarios");
    } else {
      bot.sendMessage(id, "👤 Menú:\n/saldo\n/productos");
    }
  }
});

// =======================
// 💰 SALDO
// =======================

bot.onText(/\/saldo/, async (msg) => {
  const id = msg.from.id;

  if (!sesiones[id]?.logueado) {
    return bot.sendMessage(id, "❌ Debes hacer /login");
  }

  const user = await db.collection('users').doc(sesiones[id].uid).get();

  bot.sendMessage(id, "💰 Saldo: $" + user.data().saldo);
});

// =======================
// ➕ AGREGAR SALDO (ADMIN)
// =======================

bot.onText(/\/addsaldo (.+) (.+)/, async (msg, match) => {
  const id = msg.from.id;

  if (!sesiones[id]?.logueado || sesiones[id].rol !== "admin") {
    return bot.sendMessage(id, "❌ No autorizado");
  }

  const username = match[1];
  const amount = parseFloat(match[2]);

  const snapshot = await db.collection('users')
    .where('username', '==', username)
    .get();

  if (snapshot.empty) {
    return bot.sendMessage(id, "❌ Usuario no existe");
  }

  const userDoc = snapshot.docs[0];

  await db.collection('users').doc(userDoc.id).update({
    saldo: admin.firestore.FieldValue.increment(amount)
  });

  bot.sendMessage(id, "✅ Saldo agregado");
});

// =======================
// 🛒 PRODUCTOS
// =======================

bot.onText(/\/productos/, async (msg) => {
  const id = msg.from.id;

  if (!sesiones[id]?.logueado) {
    return bot.sendMessage(id, "❌ Debes hacer /login");
  }

  const snapshot = await db.collection('productos').get();

  let text = "🛒 Productos:\n\n";

  snapshot.forEach(doc => {
    const p = doc.data();
    text += `📦 ${p.nombre} - $${p.precio}\n/comprar_${doc.id}\n\n`;
  });

  bot.sendMessage(id, text);
});

// =======================
// 💳 COMPRAR
// =======================

bot.onText(/\/comprar_(.+)/, async (msg, match) => {
  const id = msg.from.id;

  if (!sesiones[id]?.logueado) {
    return bot.sendMessage(id, "❌ Debes hacer /login");
  }

  const userRef = db.collection('users').doc(sesiones[id].uid);
  const user = await userRef.get();

  const product = await db.collection('productos').doc(match[1]).get();

  const p = product.data();

  if (user.data().saldo < p.precio) {
    return bot.sendMessage(id, "❌ Saldo insuficiente");
  }

  await userRef.update({
    saldo: user.data().saldo - p.precio
  });

  bot.sendMessage(id, "✅ Compra realizada: " + p.nombre);
});

// =======================
// ➕ AGREGAR PRODUCTO
// =======================

bot.onText(/\/addproducto (.+) (.+)/, async (msg, match) => {
  const id = msg.from.id;

  if (!sesiones[id]?.logueado || sesiones[id].rol !== "admin") {
    return bot.sendMessage(id, "❌ No autorizado");
  }

  await db.collection('productos').add({
    nombre: match[1],
    precio: parseFloat(match[2])
  });

  bot.sendMessage(id, "✅ Producto creado");
});
