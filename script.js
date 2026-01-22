const ADMIN_PASSWORD = "canteen123";

let menu = [];
let socket;

// Connect to server
document.addEventListener('DOMContentLoaded', () => {
  socket = io();

  socket.on('menuUpdate', (updatedMenu) => {
    menu = updatedMenu;
    if (document.getElementById("userSection").style.display !== "none") {
      loadMenu();
    }
    if (document.getElementById("adminPanel").style.display !== "none") {
      loadAdminMenu();
    }
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
    alert("Wrong password");
  }
}

function logout() {
  document.getElementById("userSection").style.display = "none";
  document.getElementById("adminPanel").style.display = "none";
  document.getElementById("adminPassSection").style.display = "none";
  document.getElementById("login").style.display = "block";
}

/* User Functions */
function loadMenu() {
  const menuDiv = document.getElementById("menu");
  menuDiv.innerHTML = "";

  menu.forEach((item, i) => {
    menuDiv.innerHTML += `
      <div class="menu-item">
        <div><b>${item.name}</b><br>₹${item.price}</div>
        <input type="number" min="0" value="0" onchange="calculateTotal()">
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
  document.querySelectorAll(".menu-item input").forEach((input, i) => {
    const qty = Number(input.value);
    orderData.push(qty);
    input.value = 0;
  });

  socket.emit('placeOrder', orderData);
  calculateTotal();
  alert("Order placed successfully!");
}

/* Admin Functions */
function addItem() {
  const name = document.getElementById("itemName").value.trim();
  const price = document.getElementById("itemPrice").value;

  if (!name || !price) return alert("Enter item details");

  const item = { name, price: Number(price), orders: 0 };
  socket.emit('addItem', item);

  document.getElementById("itemName").value = "";
  document.getElementById("itemPrice").value = "";
}

function removeItem(index) {
  socket.emit('removeItem', index);
}

function loadAdminMenu() {
  const list = document.getElementById("adminMenu");
  list.innerHTML = "";

  menu.forEach((item, index) => {
    list.innerHTML += `
      <li class="admin-item">
        ${item.name} - ₹${item.price} | Orders: ${item.orders}
        <button onclick="removeItem(${index})">Remove</button>
      </li>`;
  });
}

/* PWA */
if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("service-worker.js");
}