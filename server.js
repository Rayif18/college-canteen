const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const fs = require('fs');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

const PORT = process.env.PORT || 3000;
const DATA_FILE = path.join(__dirname, 'data.json');

// Default data
let data = {
  nextOrderId: 1,
  users: [],
  orders: [],
  menu: [
    { id: 1, name: 'Samosa', price: 15, orders: 0 },
    { id: 2, name: 'Veg Puff', price: 25, orders: 0 },
    { id: 3, name: 'Cold Drink', price: 30, orders: 0 }
  ]
};

function loadData() {
  try {
    if (fs.existsSync(DATA_FILE)) {
      const raw = fs.readFileSync(DATA_FILE, 'utf8');
      data = JSON.parse(raw);
      console.log('Loaded data from', DATA_FILE);
    } else {
      saveData();
    }
  } catch (err) {
    console.error('Error loading data:', err);
  }
}

function saveData() {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf8');
  } catch (err) {
    console.error('Error saving data:', err);
  }
}

loadData();

app.use(express.static('.'));

io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);

  // Send current menu and orders to new client
  socket.emit('menuUpdate', data.menu);
  socket.emit('ordersUpdate', data.orders);

  // Register user login (stores user if new)
  socket.on('userLogin', (user) => {
    if (!user || !user.email) return;
    const email = user.email.toLowerCase();
    const exists = data.users.find(u => u.email === email);
    if (!exists) {
      // create user with token
      const token = (Date.now().toString(36) + Math.random().toString(36).slice(2,8));
      data.users.push({ name: user.name, email, token });
      saveData();
      user.token = token;
    } else {
      // ensure user has token
      if (!exists.token) {
        exists.token = (Date.now().toString(36) + Math.random().toString(36).slice(2,8));
        saveData();
      }
      user.token = exists.token;
    }
    // Add socket to a room for this user so we can push updates to all their devices
    socket.join(`user:${email}`);
    console.log('User logged in and joined room:', email);
    // Send current history immediately
    const history = data.orders.filter(o => (o.user && o.user.email === email));
    socket.emit('userHistory', history);
    // send back user data and token for client persistence
    socket.emit('userLogged', { user: { name: user.name, email }, token: user.token });
  });

  socket.on('resumeSession', (token) => {
    if (!token) return;
    const u = data.users.find(x => x.token === token);
    if (!u) return;
    const email = u.email;
    socket.join(`user:${email}`);
    const history = data.orders.filter(o => (o.user && o.user.email === email));
    socket.emit('sessionResumed', { user: { name: u.name, email: u.email }, history });
  });

  socket.on('requestUserHistory', (email) => {
    if (!email) return;
    const history = data.orders.filter(o => (o.user && o.user.email === email.toLowerCase()));
    socket.emit('userHistory', history);
  });

  // Handle place order with user info
  socket.on('placeOrder', (payload) => {
    // payload expected: { items: [{id,qty}], user: {name,email}, total }
    try {
      const { items, user } = payload || {};
      if (!items || !Array.isArray(items) || !user) return;

      // Build order details with prices
      let total = 0;
      const itemDetails = items.map(it => {
        const menuItem = data.menu.find(m => m.id === parseInt(it.id));
        const qty = Number(it.qty) || 0;
        const price = menuItem ? menuItem.price : 0;
        if (menuItem) menuItem.orders += qty;
        total += price * qty;
        return { id: parseInt(it.id), name: menuItem ? menuItem.name : 'Unknown', price, qty };
      });

      const order = {
        orderId: data.nextOrderId++,
        user: { name: user.name, email: user.email.toLowerCase() },
        items: itemDetails,
        total,
        timestamp: new Date().toISOString()
      };

      data.orders.push(order);
      saveData();

      // Notify ordering client with receipt
      socket.emit('orderConfirmed', order);

      // Broadcast updates
      io.emit('menuUpdate', data.menu);
      io.emit('ordersUpdate', data.orders);

      // Push updated history to all devices of this user (room)
      io.to(`user:${order.user.email}`).emit('userHistory', data.orders.filter(o => o.user.email === order.user.email));

      console.log('Order placed:', order.orderId);
    } catch (err) {
      console.error('Error processing order:', err);
    }
  });

  // Handle add item
  socket.on('addItem', (item) => {
    console.log('Received addItem:', item);
    const newId = data.menu.reduce((max, it) => Math.max(max, it.id), 0) + 1;
    const newItem = { id: newId, name: item.name, price: Number(item.price), orders: 0 };
    data.menu.push(newItem);
    saveData();
    io.emit('menuUpdate', data.menu);
  });

  // Handle remove item
  socket.on('removeItem', (id) => {
    console.log('Received removeItem:', id);
    data.menu = data.menu.filter(item => item.id !== parseInt(id));
    saveData();
    io.emit('menuUpdate', data.menu);
  });

  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
});

server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});