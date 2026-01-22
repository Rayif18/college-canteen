const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const fs = require('fs');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

const PORT = process.env.PORT || 3000;
const MENU_FILE = path.join(__dirname, 'menu.json');

// Default menu
const defaultMenu = [
  { name: "Samosa", price: 15, orders: 0 },
  { name: "Veg Puff", price: 25, orders: 0 },
  { name: "Cold Drink", price: 30, orders: 0 }
];

// Load menu from file
function loadMenu() {
  if (fs.existsSync(MENU_FILE)) {
    return JSON.parse(fs.readFileSync(MENU_FILE, 'utf8'));
  } else {
    saveMenu(defaultMenu);
    return defaultMenu;
  }
}

// Save menu to file
function saveMenu(menu) {
  fs.writeFileSync(MENU_FILE, JSON.stringify(menu, null, 2));
}

let menu = loadMenu();

app.use(express.static('.'));

io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);

  // Send current menu to new client
  socket.emit('menuUpdate', menu);

  // Handle place order
  socket.on('placeOrder', (orderData) => {
    orderData.forEach((qty, i) => {
      if (qty > 0) {
        menu[i].orders += qty;
      }
    });
    saveMenu(menu);
    io.emit('menuUpdate', menu); // Broadcast to all clients
  });

  // Handle add item
  socket.on('addItem', (item) => {
    menu.push(item);
    saveMenu(menu);
    io.emit('menuUpdate', menu);
  });

  // Handle remove item
  socket.on('removeItem', (index) => {
    menu.splice(index, 1);
    saveMenu(menu);
    io.emit('menuUpdate', menu);
  });

  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
});

server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});