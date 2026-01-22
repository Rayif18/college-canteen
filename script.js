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
    }
  });

  socket.on('disconnect', () => {
    console.log('Socket disconnected');
  });
});

/* Login Functions */
function loginAsUser() {
  document.getElementById("login").style.display = "none";
  document.getElementById("userSection").style.display = "block";
  loadMenu();
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
        <div>
          <h4>${item.name}</h4>
          <p>₹${item.price}</p>
        </div>
        <input type="number" min="0" value="0" onchange="calculateTotal()" placeholder="Qty">
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
  const orderData = [];
  document.querySelectorAll(".menu-item").forEach(item => {
    const id = item.dataset.id;
    const qty = Number(item.querySelector('input').value);
    if (qty > 0) {
      orderData.push({ id, qty });
    }
  });

  if (orderData.length === 0) {
    showNotification("Please select at least one item.", 'error');
    return;
  }

  const button = document.querySelector('#userSection .btn-success');
  button.disabled = true;
  button.textContent = 'Placing Order...';

  console.log('Emitting placeOrder:', orderData);
  socket.emit('placeOrder', orderData);

  // Reset inputs
  document.querySelectorAll(".menu-item input").forEach(input => input.value = 0);
  calculateTotal();

  setTimeout(() => {
    button.disabled = false;
    button.textContent = 'Place Order 🛒';
    showNotification('Order placed successfully!');
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