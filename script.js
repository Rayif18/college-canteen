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
    console.log('Orders updated:', orders);
    window.allOrders = orders;
    // update admin orders list if admin panel shown
    if (document.getElementById('adminPanel').style.display !== 'none') {
      loadAdminOrders();
    }
    // if current user, request history update
    if (window.currentUser && window.currentUser.email) {
      socket.emit('requestUserHistory', window.currentUser.email);
    }
  });

  socket.on('orderConfirmed', (order) => {
    console.log('Order confirmed:', order);
    showNotification(`Order confirmed (#${order.orderId})`);
    // show a basic receipt
    showReceipt(order);
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
});

/* Login Functions */
function loginAsUser() {
  document.getElementById("login").style.display = "none";
  document.getElementById("userLoginSection").style.display = "block";
}

function submitUserLogin() {
  const name = document.getElementById('userName').value.trim();
  const email = document.getElementById('userEmail').value.trim().toLowerCase();
  if (!name || !email) {
    showNotification('Enter name and email', 'error');
    return;
  }

  const user = { name, email };
  // Save locally for future reference
  localStorage.setItem('canteenUser', JSON.stringify(user));
  window.currentUser = user;

  // Notify server about user (for history tracking)
  if (socket && socket.connected) socket.emit('userLogin', user);

  // Show menu
  document.getElementById('userLoginSection').style.display = 'none';
  document.getElementById('userSection').style.display = 'block';
  loadMenu();
  // Request order history for this user
  if (socket && socket.connected) socket.emit('requestUserHistory', user.email);
}

// Restore stored user on load
document.addEventListener('DOMContentLoaded', () => {
  try {
    const stored = localStorage.getItem('canteenUser');
    if (stored) {
      window.currentUser = JSON.parse(stored);
    }
  } catch (e) {}
});

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
        <div>
          <h4>${item.name}</h4>
          <p>₹${item.price}</p>
        </div>
        <input type="number" min="0" value="0" oninput="calculateTotal()" placeholder="Qty">
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

  const button = document.querySelector('#userSection .btn-success');
  button.disabled = true;
  button.textContent = 'Placing Order...';

  // Build payload including user info
  const user = window.currentUser || JSON.parse(localStorage.getItem('canteenUser') || 'null');
  if (!user) {
    showNotification('Please login with name and email first.', 'error');
    button.disabled = false;
    button.textContent = 'Place Order 🛒';
    return;
  }

  const payload = { items: orderItems, user };
  console.log('Emitting placeOrder payload:', payload);
  socket.emit('placeOrder', payload);

  setTimeout(() => {
    button.disabled = false;
    button.textContent = 'Place Order 🛒';
    // do not immediately clear inputs - wait for orderConfirmed to reset after receipt shown
  }, 1000);
}

/* Admin Functions */
function addItem() {
  const name = document.getElementById("itemName").value.trim();
  const price = document.getElementById("itemPrice").value;

  if (!name || !price) {
    showNotification("Enter item details.", 'error');
    return;
  }

  const item = { name, price: Number(price), orders: 0 };
  socket.emit('addItem', item);

  document.getElementById("itemName").value = "";
  document.getElementById("itemPrice").value = "";
  showNotification('Item added successfully!');
}

function removeItem(id) {
  socket.emit('removeItem', id);
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
  const containerId = 'adminOrders';
  let container = document.getElementById(containerId);
  if (!container) {
    // create container below adminMenu
    container = document.createElement('div');
    container.id = containerId;
    container.style.marginTop = '20px';
    document.getElementById('adminPanel').appendChild(container);
  }
  const orders = window.allOrders || [];
  if (orders.length === 0) {
    container.innerHTML = '<h3>No orders yet</h3>';
    return;
  }
  container.innerHTML = '<h3>All Orders</h3>' + orders.map(o => {
    const items = o.items.map(it => `${it.qty} x ${it.name} (₹${it.price})`).join('<br>');
    return `
      <div class="card" style="padding:10px;margin-bottom:10px;">
        <strong>Order #${o.orderId}</strong> — ${new Date(o.timestamp).toLocaleString()}<br>
        <strong>${o.user.name}</strong> &lt;${o.user.email}&gt;<br>
        ${items}<br>
        <strong>Total: ₹${o.total}</strong>
      </div>`;
  }).join('');
}

function renderUserHistory() {
  const hist = window.userHistory || [];
  let container = document.getElementById('userHistory');
  if (!container) {
    container = document.createElement('div');
    container.id = 'userHistory';
    container.style.marginTop = '20px';
    document.getElementById('userSection').appendChild(container);
  }
  if (hist.length === 0) {
    container.innerHTML = '<h3>Your Orders</h3><p>No previous orders.</p>';
    return;
  }
  container.innerHTML = '<h3>Your Orders</h3>' + hist.map(o => {
    const items = o.items.map(it => `${it.qty} x ${it.name} (₹${it.price})`).join('<br>');
    return `
      <div class="card" style="padding:10px;margin-bottom:10px;">
        <strong>Order #${o.orderId}</strong> — ${new Date(o.timestamp).toLocaleString()}<br>
        ${items}<br>
        <strong>Total: ₹${o.total}</strong>
      </div>`;
  }).join('');
}

function showReceipt(order) {
  // simple popup-style receipt
  const receipt = document.createElement('div');
  receipt.className = 'card';
  receipt.style.position = 'fixed';
  receipt.style.left = '50%';
  receipt.style.top = '10%';
  receipt.style.transform = 'translateX(-50%)';
  receipt.style.zIndex = 2000;
  receipt.style.maxWidth = '600px';
  receipt.innerHTML = `
    <h3>Receipt — Order #${order.orderId}</h3>
    <p><strong>${order.user.name}</strong> &lt;${order.user.email}&gt;</p>
    <div>${order.items.map(it => `<div>${it.qty} x ${it.name} — ₹${it.price} each</div>`).join('')}</div>
    <h4>Total: ₹${order.total}</h4>
    <button class="btn btn-primary" id="closeReceipt">Close</button>
  `;
  document.body.appendChild(receipt);
  document.getElementById('closeReceipt').onclick = () => {
    receipt.remove();
    // clear inputs and refresh menu after receipt
    document.querySelectorAll('.menu-item input').forEach(i => i.value = 0);
    calculateTotal();
  };
}

/* PWA */
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