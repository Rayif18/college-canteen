const ADMIN_PASSWORD = "canteen123";

let menu = [];
let socket;

// Connect to server
document.addEventListener('DOMContentLoaded', () => {
  socket = io();

  socket.on('connect', () => {
    console.log('Socket connected');
  });

  socket.on('menuUpdate', (updatedMenu) => {
    console.log('Menu updated:', updatedMenu);
    menu = updatedMenu;
    if (document.getElementById("userSection").style.display !== "none") {
      loadMenu();
    }
    if (document.getElementById("adminPanel").style.display !== "none") {
      loadAdminMenu();
      // update admin orders view if present
      if (typeof loadAdminOrders === 'function') loadAdminOrders();
    }
  });

  socket.on('ordersUpdate', (orders) => {
    console.log('📦 ORDERS RECEIVED FROM SERVER:', orders);
    window.allOrders = orders;
    console.log('✅ window.allOrders set to:', window.allOrders);
  });

  socket.on('orderConfirmed', (order) => {
    console.log('Order confirmed:', order);
    showNotification(`✅ Order placed successfully! (#${order.orderId})`);
    // Clear the menu items after successful order
    document.querySelectorAll('.menu-item input').forEach(i => i.value = 0);
    calculateTotal();
    // request updated history
    if (window.currentUser && window.currentUser.email) {
      socket.emit('requestUserHistory', window.currentUser.email);
    }
  });

  socket.on('userHistory', (history) => {
    console.log('User history received:', history);
    window.userHistory = history;
    renderUserHistory();
  });

  socket.on('disconnect', () => {
    console.log('Socket disconnected');
  });

  // handle server-provided session/token after user login
  socket.on('userLogged', payload => {
    if (!payload) return;
    window.currentUser = payload.user;
    if (payload.token) setCookie('canteen_token', payload.token, 365);
    showNotification(`Logged in as ${payload.user.name}`);
  });

  socket.on('sessionResumed', payload => {
    if (!payload) return;
    window.currentUser = payload.user;
    window.userHistory = payload.history || [];
    renderUserHistory();
    showNotification(`Welcome back, ${payload.user.name}`);
    if (document.getElementById('userLoginSection').style.display !== 'none') {
      document.getElementById('userLoginSection').style.display = 'none';
      document.getElementById('userSection').style.display = 'block';
      loadMenu();
    }
  });
});

/* Login Functions */
function loginAsUser() {
  document.getElementById("login").style.display = "none";
  document.getElementById("userLoginSection").style.display = "block";
}

function submitUserLogin() {
  const name = document.getElementById('userName').value.trim();
  const email = document.getElementById('userEmail').value.trim().toLowerCase();
  
  // Validate name
  if (!name) {
    showNotification('Please enter your name', 'error');
    return;
  }
  
  // Validate email format (strict RFC5322-like pattern)
  // Must have: text@domain.extension (e.g., user@gmail.com)
  const emailRegex = /^[a-zA-Z0-9._%-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  
  if (!email) {
    showNotification('Please enter your email', 'error');
    return;
  }
  
  if (!emailRegex.test(email)) {
    showNotification('Please enter a valid email address (e.g., user@gmail.com)', 'error');
    return;
  }

  const user = { name, email };
  window.currentUser = user;

  // Notify server about user (for server-side persistence and token)
  if (socket && socket.connected) socket.emit('userLogin', user);

  // Show menu immediately
  document.getElementById('userLoginSection').style.display = 'none';
  document.getElementById('userSection').style.display = 'block';
  loadMenu();
}

// Restore session token from cookie and resume session with server
document.addEventListener('DOMContentLoaded', () => {
  try {
    const token = getCookie('canteen_token');
    if (token && socket && socket.connected) {
      socket.emit('resumeSession', token);
    }
  } catch (e) {}
});

// cookie helpers
function setCookie(name, value, days) {
  const expires = new Date(Date.now() + (days||365)*24*60*60*1000).toUTCString();
  document.cookie = `${name}=${value}; expires=${expires}; path=/`;
}
function getCookie(name) {
  const m = document.cookie.match(new RegExp('(^| )' + name + '=([^;]+)'));
  return m ? m[2] : null;
}

function loginAsAdmin() {
  document.getElementById("login").style.display = "none";
  document.getElementById("adminPassSection").style.display = "block";
}

function adminLogin() {
  if (document.getElementById("adminPass").value === ADMIN_PASSWORD) {
    document.getElementById("adminPassSection").style.display = "none";
    document.getElementById("adminPanel").style.display = "block";
    loadAdminMenu();
  } else {
    showNotification("Wrong password", 'error');
  }
}

function logout() {
  // Hide all sections
  document.getElementById("userSection").style.display = "none";
  document.getElementById("adminPassSection").style.display = "none";
  document.getElementById("adminPanel").style.display = "none";
  // Show login
  document.getElementById("login").style.display = "block";
  // Reset admin password field
  document.getElementById("adminPass").value = "";
}

function showNotification(message, type = 'success') {
  const notification = document.getElementById('notification');
  notification.textContent = message;
  notification.className = `notification ${type}`;
  notification.style.display = 'block';
  setTimeout(() => {
    notification.style.display = 'none';
  }, 3000);
}

/* User Functions */
function loadMenu() {
  const menuDiv = document.getElementById("menu");
  menuDiv.innerHTML = "";

  menu.forEach((item, i) => {
    menuDiv.innerHTML += `
      <div class="menu-item" data-id="${item.id}">
        <div class="meta">
          <h4>🍔 ${item.name}</h4>
          <p class="price" style="color:var(--primary);font-weight:600;font-size:1rem;">₹${item.price}</p>
        </div>
        <input type="number" min="0" max="99" value="0" oninput="calculateTotal()" placeholder="Qty" class="qty-input">
      </div>`;
  });
}

function calculateTotal() {
  let total = 0;
  document.querySelectorAll(".menu-item input").forEach((input, i) => {
    total += input.value * menu[i].price;
  });
  document.getElementById("total").innerText = total;
}

function placeOrder() {
  const orderItems = [];
  document.querySelectorAll('.menu-item').forEach(item => {
    const id = item.dataset.id;
    const qty = Number(item.querySelector('input').value) || 0;
    if (qty > 0) orderItems.push({ id, qty });
  });

  if (orderItems.length === 0) {
    showNotification('Please select at least one item.', 'error');
    return;
  }

  // Store order items for confirmation
  window.pendingOrderItems = orderItems;
  
  // Show confirmation modal
  showOrderConfirmation(orderItems);
}

function showOrderConfirmation(orderItems) {
  const itemsHtml = orderItems.map(item => {
    const menuItem = menu.find(m => m.id === parseInt(item.id));
    if (!menuItem) return '';
    const subtotal = menuItem.price * item.qty;
    return `
      <div class="confirm-item">
        <div class="confirm-item-name">${item.qty} × ${menuItem.name}</div>
        <div class="confirm-item-price">₹${menuItem.price} each = <strong>₹${subtotal}</strong></div>
      </div>
    `;
  }).join('');
  
  const total = orderItems.reduce((sum, item) => {
    const menuItem = menu.find(m => m.id === parseInt(item.id));
    return sum + (menuItem ? menuItem.price * item.qty : 0);
  }, 0);
  
  document.getElementById('confirmOrderItems').innerHTML = itemsHtml;
  document.getElementById('confirmOrderTotal').textContent = '₹' + total;
  document.getElementById('confirmOrderModal').style.display = 'flex';
}

function cancelOrderConfirmation() {
  document.getElementById('confirmOrderModal').style.display = 'none';
  window.pendingOrderItems = null;
  showNotification('Order cancelled', 'error');
}

function confirmOrderPlacement() {
  if (!window.pendingOrderItems || window.pendingOrderItems.length === 0) {
    showNotification('No items to order', 'error');
    return;
  }

  const button = document.querySelector('#userSection .btn-success');
  button.disabled = true;
  button.textContent = '⏳ Placing Order...';

  const user = window.currentUser;
  if (!user || !user.email) {
    showNotification('Please login first.', 'error');
    button.disabled = false;
    button.textContent = '🛒 Place Order';
    document.getElementById('confirmOrderModal').style.display = 'none';
    return;
  }

  const payload = { items: window.pendingOrderItems, user };
  socket.emit('placeOrder', payload);
  
  document.getElementById('confirmOrderModal').style.display = 'none';
  window.pendingOrderItems = null;

  setTimeout(() => {
    button.disabled = false;
    button.textContent = '🛒 Place Order';
  }, 1000);
}

/* Admin Functions */
function addItem() {
  const name = document.getElementById("itemName").value.trim();
  const price = Number(document.getElementById("itemPrice").value);

  if (!name) {
    showNotification('Please enter item name.', 'error');
    return;
  }
  
  if (!price || price <= 0) {
    showNotification('Please enter a valid price (must be greater than 0).', 'error');
    return;
  }
  
  if (price > 10000) {
    showNotification('Price seems too high. Please enter a realistic price.', 'error');
    return;
  }

  const item = { name, price: Number(price), orders: 0 };
  socket.emit('addItem', item);

  document.getElementById("itemName").value = "";
  document.getElementById("itemPrice").value = "";
  showNotification(`✅ Item '${name}' added successfully!`);
}

function removeItem(id) {
  if (confirm('Are you sure you want to remove this item? This action cannot be undone.')) {
    socket.emit('removeItem', id);
    showNotification('Item removed successfully');
  }
}

function switchAdminTab(tabName) {
  try {
    // Hide ALL tabs - set display:none
    document.getElementById('menuTab').style.display = 'none';
    document.getElementById('ordersTab').style.display = 'none';
    document.getElementById('statsTab').style.display = 'none';
    
    // Remove active class from all tab buttons
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    
    // Show selected tab - set display:block
    const selectedTab = document.getElementById(tabName + 'Tab');
    if (selectedTab) {
      selectedTab.style.display = 'block';
    }
    
    // Add active class to clicked button
    if (event && event.target) {
      event.target.classList.add('active');
    }
    
    // Load data for the tab
    if (tabName === 'orders') {
      console.log('📦 Loading orders');
      loadAdminOrders();
    } else if (tabName === 'stats') {
      console.log('📊 Loading stats');
      updateStatistics();
    }
  } catch (e) {
    console.error('Error in switchAdminTab:', e);
  }
}

function loadAdminMenu() {
  const list = document.getElementById("adminMenu");
  list.innerHTML = "";

  menu.forEach((item, index) => {
    list.innerHTML += `
      <li class="admin-item" data-id="${item.id}">
        <div>
          <strong>${item.name}</strong> - ₹${item.price} | Orders: <span class="order-count">${item.orders}</span>
        </div>
        <button onclick="removeItem('${item.id}')">Remove</button>
      </li>`;
  });
}

function loadAdminOrders() {
  console.log('🔄 loadAdminOrders CALLED');
  console.log('📊 window.allOrders =', window.allOrders);
  
  const container = document.getElementById('adminOrders');
  console.log('📌 container element =', container);
  
  if (!container) {
    console.error('❌ adminOrders container NOT FOUND!');
    return;
  }
  
  const orders = window.allOrders;
  console.log('📋 orders data =', orders);
  
  if (!orders || orders.length === 0) {
    console.log('⚠️ No orders to display');
    container.innerHTML = '<p style="text-align:center;color:#999;">No orders yet</p>';
    return;
  }
  
  console.log('✅ Processing ' + orders.length + ' orders');
  let html = '';
  orders.forEach((order, idx) => {
    console.log('  Order ' + idx + ':', order);
    const itemsList = order.items.map(it => `${it.qty}x ${it.name} (₹${it.price})`).join(', ');
    const orderDate = new Date(order.timestamp).toLocaleString();
    html += `
      <div class="order-card" style="background:#fff;border:1px solid #ddd;padding:15px;margin:10px 0;border-radius:8px;">
        <div style="display:flex;justify-content:space-between;margin-bottom:10px;border-bottom:1px solid #eee;padding-bottom:10px;">
          <strong>Order #${order.orderId}</strong>
          <span style="color:#666;font-size:0.9em;">${orderDate}</span>
        </div>
        <div style="margin:8px 0;">
          <strong>${order.user.name}</strong><br>
          <small style="color:#666;">${order.user.email}</small>
        </div>
        <div style="margin:8px 0;color:#555;">
          ${itemsList}
        </div>
        <div style="margin-top:10px;font-size:1.1em;font-weight:bold;">
          Total: ₹${order.total}
        </div>
      </div>`;
  });
  console.log('💾 Rendering HTML to container');
  container.innerHTML = html;
  console.log('✅ Orders rendered successfully');
}

function renderUserHistory() {
  const hist = window.userHistory || [];
  let container = document.getElementById('userHistory');
  if (!container) {
    container = document.createElement('div');
    container.id = 'userHistory';
    document.getElementById('userSection').appendChild(container);
  }
  if (hist.length === 0) {
    container.innerHTML = '<h3 style="margin-top:30px;">📋 Your Order History</h3><p style="color:var(--muted);">No orders yet. Place your first order!</p>';
    return;
  }
  container.innerHTML = '<h3 style="margin-top:30px;">📋 Your Previous Orders</h3>' + hist.map(o => {
    const items = o.items.map(it => `${it.qty}x ${it.name}`).join(', ');
    const timestamp = new Date(o.timestamp).toLocaleDateString();
    return `
      <div style="padding:12px;background:#f9fafb;border-radius:8px;margin-bottom:10px;border-left:4px solid var(--accent);">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
          <strong>Order #${o.orderId}</strong>
          <span style="font-size:0.85rem;color:var(--muted);">${timestamp}</span>
        </div>
        <div style="font-size:0.9rem;color:#374151;">📦 ${items}</div>
        <div style="font-weight:600;color:var(--primary);margin-top:8px;">₹${o.total}</div>
      </div>`;
  }).join('');
}

function showAdminReceipt(orderId) {
  const order = window.allOrders.find(o => o.orderId === orderId);
  if (!order) {
    showNotification('Order not found', 'error');
    return;
  }

  const modal = document.getElementById('receiptModal');
  const content = document.getElementById('receiptContent');
  
  const items = order.items.map(it => `
    <div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid #eee;">
      <span>${it.qty} x ${it.name}</span>
      <span>₹${it.price} each (₹${it.qty * it.price})</span>
    </div>
  `).join('');
  
  content.innerHTML = `
    <div style="padding:20px;max-width:500px;">
      <h3 style="text-align:center;margin-bottom:20px;">📄 Receipt</h3>
      <div style="border:2px solid #333;padding:15px;border-radius:5px;">
        <h4 style="margin-top:0;text-align:center;">Order #${order.orderId}</h4>
        <p style="text-align:center;color:#666;margin-bottom:15px;">${new Date(order.timestamp).toLocaleString()}</p>
        <hr>
        <p><strong>Customer Name:</strong> ${order.user.name}</p>
        <p><strong>Email:</strong> ${order.user.email}</p>
        <hr>
        <h4>Items:</h4>
        ${items}
        <hr>
        <div style="display:flex;justify-content:space-between;font-size:1.1em;font-weight:bold;margin-top:15px;">
          <span>Total Amount:</span>
          <span>₹${order.total}</span>
        </div>
        <div style="text-align:center;margin-top:20px;color:#666;font-size:0.9em;">
          <p>Thank you for your order!</p>
        </div>
      </div>
      <div style="margin-top:20px;display:flex;gap:10px;justify-content:center;">
        <button class="btn btn-primary" onclick="printAdminReceipt(${order.orderId})">🖨️ Print</button>
        <button class="btn btn-secondary" onclick="closeAdminReceipt()">Close</button>
      </div>
    </div>
  `;
  
  modal.style.display = 'flex';
}

function closeAdminReceipt() {
  document.getElementById('receiptModal').style.display = 'none';
}

function printAdminReceipt(orderId) {
  const order = window.allOrders.find(o => o.orderId === orderId);
  if (!order) {
    showNotification('Order not found', 'error');
    return;
  }
  
  const items = order.items.map(it => `
    <tr>
      <td>${it.qty}</td>
      <td>${it.name}</td>
      <td>₹${it.price}</td>
      <td>₹${it.qty * it.price}</td>
    </tr>
  `).join('');
  
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>Receipt - Order #${order.orderId}</title>
      <style>
        * { margin: 0; padding: 0; }
        body { font-family: Arial, sans-serif; padding: 20px; }
        .receipt { max-width: 500px; margin: 0 auto; border: 2px solid #000; padding: 20px; }
        h2 { text-align: center; margin-bottom: 10px; }
        .order-header { text-align: center; margin-bottom: 20px; border-bottom: 2px solid #000; padding-bottom: 10px; }
        .details { margin: 15px 0; }
        table { width: 100%; border-collapse: collapse; margin: 15px 0; }
        th { border-bottom: 2px solid #000; padding: 8px; text-align: left; }
        td { padding: 8px; border-bottom: 1px solid #ddd; }
        .total { font-size: 18px; font-weight: bold; text-align: right; margin-top: 15px; border-top: 2px solid #000; padding-top: 10px; }
        .footer { text-align: center; margin-top: 20px; font-size: 12px; color: #666; }
        @media print { body { margin: 0; padding: 0; } }
      </style>
    </head>
    <body>
      <div class="receipt">
        <h2>RECEIPT</h2>
        <div class="order-header">
          <div><strong>Order #${order.orderId}</strong></div>
          <div>${new Date(order.timestamp).toLocaleString()}</div>
        </div>
        <div class="details">
          <p><strong>Customer:</strong> ${order.user.name}</p>
          <p><strong>Email:</strong> ${order.user.email}</p>
        </div>
        <table>
          <thead>
            <tr>
              <th>Qty</th>
              <th>Item</th>
              <th>Price</th>
              <th>Amount</th>
            </tr>
          </thead>
          <tbody>
            ${items}
          </tbody>
        </table>
        <div class="total">
          Total Amount: ₹${order.total}
        </div>
        <div class="footer">
          <p>Thank you for your order!</p>
          <p>College Mini Canteen</p>
        </div>
      </div>
    </body>
    </html>
  `;
  
  setTimeout(() => { w.print(); }, 500);
}

function updateStatistics() {
  // Placeholder - statistics tab not used in this version
}
if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("service-worker.js")
    .then(registration => {
      console.log('Service Worker registered');

      // Check for updates
      registration.addEventListener('updatefound', () => {
        const newWorker = registration.installing;
        newWorker.addEventListener('statechange', () => {
          if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
            // New version available
            showUpdateNotification();
          }
        });
      });

      // If there's already a waiting service worker, show update prompt
      if (registration.waiting) {
        showUpdateNotification();
      }
    })
    .catch(error => {
      console.log('Service Worker registration failed:', error);
    });

  // Listen for messages from service worker
  navigator.serviceWorker.addEventListener('message', event => {
    if (event.data && event.data.type === 'SKIP_WAITING') {
      window.location.reload();
    }
    if (event.data && event.data.type === 'REFRESH_PAGE') {
      console.log('Service worker updated, refreshing page...');
      window.location.reload();
    }
  });
}

function showUpdateNotification() {
  const notification = document.getElementById('notification');
  notification.textContent = 'New version available! Click to update.';
  notification.className = 'notification update';
  notification.style.display = 'block';
  notification.style.cursor = 'pointer';
  notification.onclick = () => {
    // Tell the service worker to skip waiting
    navigator.serviceWorker.ready.then(registration => {
      if (registration.waiting) {
        registration.waiting.postMessage({ type: 'SKIP_WAITING' });
      }
    });
  };

  // Auto-hide after 10 seconds
  setTimeout(() => {
    if (notification.className.includes('update')) {
      notification.style.display = 'none';
    }
  }, 10000);
}