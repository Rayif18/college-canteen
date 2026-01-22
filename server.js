const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const mongoose = require('mongoose');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

const PORT = process.env.PORT || 3000;
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/canteen'; // Replace with your MongoDB Atlas URI

// Connect to MongoDB
mongoose.connect(MONGODB_URI)
.then(() => console.log('Connected to MongoDB'))
.catch(err => console.error('MongoDB connection error:', err));

// Menu Schema
const menuSchema = new mongoose.Schema({
  name: String,
  price: Number,
  orders: { type: Number, default: 0 }
});

const MenuItem = mongoose.model('MenuItem', menuSchema);

// Initialize default menu if empty
async function initializeMenu() {
  const count = await MenuItem.countDocuments();
  if (count === 0) {
    const defaultItems = [
      { name: "Samosa", price: 15, orders: 0 },
      { name: "Veg Puff", price: 25, orders: 0 },
      { name: "Cold Drink", price: 30, orders: 0 }
    ];
    await MenuItem.insertMany(defaultItems);
    console.log('Default menu initialized');
  }
}

initializeMenu();

app.use(express.static('.'));

io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);

  // Send current menu to new client
  MenuItem.find().then(menu => {
    socket.emit('menuUpdate', menu);
  }).catch(err => console.error('Error fetching menu:', err));

  // Handle place order
  socket.on('placeOrder', async (orderData) => {
    console.log('Received placeOrder:', orderData);
    try {
      for (const { id, qty } of orderData) {
        await MenuItem.findByIdAndUpdate(id, { $inc: { orders: qty } });
      }
      const updatedMenu = await MenuItem.find();
      console.log('Updated menu:', updatedMenu);
      io.emit('menuUpdate', updatedMenu);
    } catch (err) {
      console.error('Error placing order:', err);
    }
  });

  // Handle add item
  socket.on('addItem', async (item) => {
    console.log('Received addItem:', item);
    try {
      const newItem = new MenuItem(item);
      await newItem.save();
      const updatedMenu = await MenuItem.find();
      io.emit('menuUpdate', updatedMenu);
    } catch (err) {
      console.error('Error adding item:', err);
    }
  });

  // Handle remove item
  socket.on('removeItem', async (id) => {
    console.log('Received removeItem:', id);
    try {
      await MenuItem.findByIdAndDelete(id);
      const updatedMenu = await MenuItem.find();
      io.emit('menuUpdate', updatedMenu);
    } catch (err) {
      console.error('Error removing item:', err);
    }
  });

  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
});

server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});