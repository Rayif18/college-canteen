const express = require('express');
const http = require('http');
const socketIo = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

const PORT = process.env.PORT || 3000;

// In-memory menu storage
let menu = [
  { id: 1, name: "Samosa", price: 15, orders: 0 },
  { id: 2, name: "Veg Puff", price: 25, orders: 0 },
  { id: 3, name: "Cold Drink", price: 30, orders: 0 }
];
let nextId = 4;

app.use(express.static('.'));

io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);

  // Send current menu to new client
  socket.emit('menuUpdate', menu);

  // Handle place order
  socket.on('placeOrder', (orderData) => {
    console.log('Received placeOrder:', orderData);
    for (const { id, qty } of orderData) {
      const item = menu.find(item => item.id === parseInt(id));
      if (item) {
        item.orders += qty;
      }
    }
    console.log('Updated menu:', menu);
    io.emit('menuUpdate', menu);
  });

  // Handle add item
  socket.on('addItem', (item) => {
    console.log('Received addItem:', item);
    const newItem = { id: nextId++, ...item };
    menu.push(newItem);
    io.emit('menuUpdate', menu);
  });

  // Handle remove item
  socket.on('removeItem', (id) => {
    console.log('Received removeItem:', id);
    menu = menu.filter(item => item.id !== parseInt(id));
    io.emit('menuUpdate', menu);
  });

  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
});

server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});