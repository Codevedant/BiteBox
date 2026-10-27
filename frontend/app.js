const state = { menu: [], cart: loadCart(), category: "All", search: "", user: loadUser(), authMode: "login" };
const currency = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 });
const accountModal = bootstrap.Modal.getOrCreateInstance(document.getElementById("accountModal"));
const cartModal = bootstrap.Modal.getOrCreateInstance(document.getElementById("cartModal"));
const trackingModal = bootstrap.Modal.getOrCreateInstance(document.getElementById("trackingModal"));

function loadCart() {
  try { return JSON.parse(localStorage.getItem("bitebox-cart") || "[]"); }
  catch { return []; }
}
function loadUser() {
  try { return JSON.parse(localStorage.getItem("bitebox-user") || "null"); }
  catch { return null; }
}
function saveCart() { localStorage.setItem("bitebox-cart", JSON.stringify(state.cart)); }
function money(amount) { return currency.format(Number(amount)); }
function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  })[character]);
}

async function request(url, options = {}) {
  const headers = { "Content-Type": "application/json", ...(options.headers || {}) };
  const token = localStorage.getItem("bitebox-token");
  if (token) headers.Authorization = `Bearer ${token}`;
  const response = await fetch(url, { ...options, headers });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || "Something went wrong. Please try again.");
  return data;
}

async function loadMenu() {
  try {
    state.menu = await request("/api/menu");
    document.getElementById("menuNote").textContent = "";
  } catch (error) {
    state.menu = window.BITEBOX_SAMPLE_MENU;
    document.getElementById("menuNote").textContent = "Showing a sample menu while we reconnect. Your real menu will appear here.";
    console.warn("Menu API unavailable; showing the sample menu.", error.message);
  }
  renderCategories();
  renderMenu();
  syncCart();
}

function renderCategories() {
  const categories = ["All", ...new Set(state.menu.map((item) => item.category))];
  document.getElementById("categories").innerHTML = categories.map((category) =>
    `<button class="category-chip${state.category === category ? " active" : ""}" type="button" data-category="${escapeHtml(category)}">${escapeHtml(category)}</button>`
  ).join("");
}

function renderMenu() {
  const filtered = state.menu.filter((item) =>
    (state.category === "All" || item.category === state.category) &&
    `${item.name} ${item.description} ${item.category}`.toLowerCase().includes(state.search.toLowerCase())
  );
  const grid = document.getElementById("menuGrid");
  if (!filtered.length) {
    grid.innerHTML = '<div class="empty-menu">No bites found. Try another search.</div>';
    return;
  }
  grid.innerHTML = filtered.map((item) => `
    <article class="food-card">
      <div class="food-image-wrap">
        <a class="food-image-link" href="food.html?id=${encodeURIComponent(item.id)}" aria-label="View details for ${escapeHtml(item.name)}"><img class="food-image" src="${escapeHtml(item.imageUrl || "")}" alt="${escapeHtml(item.name)}" loading="lazy"></a>
        ${item.badge ? `<span class="food-badge">${escapeHtml(item.badge)}</span>` : ""}
        ${item.isVegetarian ? '<span class="veg-mark" aria-label="Vegetarian"></span>' : ""}
      </div>
      <div class="food-card-body">
        <div class="food-category">${escapeHtml(item.category)}</div>
        <h3 class="food-name"><a href="food.html?id=${encodeURIComponent(item.id)}">${escapeHtml(item.name)}</a></h3>
        <p class="food-description">${escapeHtml(item.description)}</p>
        <div class="food-card-bottom"><span class="food-price">${money(item.price)}</span><button class="add-button" type="button" data-add="${escapeHtml(item.id)}">＋ Add</button></div>
      </div>
    </article>`).join("");
}

function syncCart() {
  const count = state.cart.reduce((total, item) => total + item.quantity, 0);
  document.getElementById("cartCount").textContent = count;
  renderCart();
}

function renderCart() {
  const cartItems = document.getElementById("cartItems");
  const cartFooter = document.getElementById("cartFooter");
  const checkoutForm = document.getElementById("checkoutForm");
  const cart = state.cart.map((entry) => ({ ...entry, item: state.menu.find((menuItem) => String(menuItem.id) === String(entry.id)) || entry.item }))
    .filter((entry) => entry.item);
  const total = cart.reduce((sum, entry) => sum + Number(entry.item.price) * entry.quantity, 0);
  if (!cart.length) {
    cartItems.innerHTML = '<div class="cart-empty">Your cart is looking a little hungry.<br>Find something delicious to add.</div>';
    cartFooter.innerHTML = "";
    checkoutForm.classList.add("d-none");
    return;
  }
  cartItems.innerHTML = cart.map(({ id, quantity, item }) => `
    <div class="cart-line">
      <img class="cart-thumb" src="${escapeHtml(item.imageUrl || "")}" alt="">
      <div class="cart-line-info"><strong>${escapeHtml(item.name)}</strong><small>${money(item.price)} each</small></div>
      <div class="quantity-control"><button type="button" data-quantity="${escapeHtml(id)}" data-change="-1" aria-label="Remove one ${escapeHtml(item.name)}">−</button><span>${quantity}</span><button type="button" data-quantity="${escapeHtml(id)}" data-change="1" aria-label="Add one ${escapeHtml(item.name)}">+</button></div>
    </div>`).join("");
  cartFooter.innerHTML = `<div><div class="cart-total-label">Subtotal</div><div class="cart-total">${money(total)}</div></div>`;
  checkoutForm.classList.remove("d-none");
}

function addToCart(id) {
  const item = state.menu.find((menuItem) => String(menuItem.id) === String(id));
  if (!item) return;
  const existing = state.cart.find((entry) => String(entry.id) === String(id));
  if (existing) existing.quantity += 1;
  else state.cart.push({ id: item.id, quantity: 1, item });
  saveCart();
  syncCart();
  showToast(`${item.name} added to your cart`);
}

function changeQuantity(id, change) {
  const entry = state.cart.find((item) => String(item.id) === String(id));
  if (!entry) return;
  entry.quantity += change;
  if (entry.quantity <= 0) state.cart = state.cart.filter((item) => String(item.id) !== String(id));
  saveCart();
  syncCart();
}

function showToast(message) {
  const toast = document.getElementById("toastMessage");
  toast.textContent = message;
  toast.classList.add("show");
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => toast.classList.remove("show"), 2400);
}

function setAuthMode(mode) {
  state.authMode = mode;
  document.querySelectorAll("[data-auth-mode]").forEach((button) => button.classList.toggle("active", button.dataset.authMode === mode));
  const nameLabel = document.getElementById("nameLabel");
  nameLabel.classList.toggle("d-none", mode !== "register");
  nameLabel.querySelector("input").required = mode === "register";
  document.querySelector("#accountForm [name=password]").autocomplete = mode === "register" ? "new-password" : "current-password";
  document.getElementById("accountSubmit").innerHTML = `${mode === "register" ? "Create my account" : "Log in"} <span>→</span>`;
  document.getElementById("authError").textContent = "";
}

function openAccount() {
  if (state.user) {
    if (confirm(`You're signed in as ${state.user.name}. Sign out?`)) {
      state.user = null;
      localStorage.removeItem("bitebox-user");
      localStorage.removeItem("bitebox-token");
      document.getElementById("loginNav").textContent = "Log in";
      showToast("You’ve been signed out");
    }
    return;
  }
  setAuthMode("login");
  accountModal.show();
}

document.getElementById("categories").addEventListener("click", (event) => {
  const button = event.target.closest("[data-category]");
  if (!button) return;
  state.category = button.dataset.category;
  renderCategories();
  renderMenu();
});
document.getElementById("menuSearch").addEventListener("input", (event) => {
  state.search = event.target.value.trim();
  renderMenu();
});
document.getElementById("menuGrid").addEventListener("click", (event) => {
  const button = event.target.closest("[data-add]");
  if (button) addToCart(button.dataset.add);
});
document.getElementById("cartItems").addEventListener("click", (event) => {
  const button = event.target.closest("[data-quantity]");
  if (button) changeQuantity(button.dataset.quantity, Number(button.dataset.change));
});
document.getElementById("cartNav").addEventListener("click", () => cartModal.show());
document.getElementById("loginNav").addEventListener("click", openAccount);
document.getElementById("trackNav").addEventListener("click", () => {
  document.getElementById("trackingContent").innerHTML = "";
  document.getElementById("trackError").textContent = "";
  trackingModal.show();
});
document.querySelectorAll("[data-auth-mode]").forEach((button) => button.addEventListener("click", () => setAuthMode(button.dataset.authMode)));

document.getElementById("accountForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  const submit = document.getElementById("accountSubmit");
  const payload = Object.fromEntries(new FormData(form));
  submit.disabled = true;
  document.getElementById("authError").textContent = "";
  try {
    const result = await request(`/api/auth/${state.authMode}`, { method: "POST", body: JSON.stringify(payload) });
    state.user = result.user;
    localStorage.setItem("bitebox-user", JSON.stringify(result.user));
    localStorage.setItem("bitebox-token", result.token);
    document.getElementById("loginNav").textContent = `Hi, ${result.user.name.split(" ")[0]}`;
    accountModal.hide();
    form.reset();
    showToast(state.authMode === "register" ? "Your BiteBox account is ready!" : "Welcome back!");
  } catch (error) {
    document.getElementById("authError").textContent = error.message;
  } finally {
    submit.disabled = false;
  }
});

document.getElementById("checkoutForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!state.user) {
    cartModal.hide();
    accountModal.show();
    document.getElementById("authError").textContent = "Log in or create an account to place your order.";
    return;
  }
  const form = event.currentTarget;
  const submit = form.querySelector("button[type=submit]");
  submit.disabled = true;
  document.getElementById("checkoutError").textContent = "";
  try {
    const result = await request("/api/orders", {
      method: "POST",
      body: JSON.stringify({ address: new FormData(form).get("address"), items: state.cart.map(({ id, quantity }) => ({ id, quantity })) })
    });
    state.cart = [];
    saveCart();
    syncCart();
    form.reset();
    cartModal.hide();
    renderTracking(result);
    trackingModal.show();
  } catch (error) {
    document.getElementById("checkoutError").textContent = error.message;
  } finally {
    submit.disabled = false;
  }
});

function renderTracking(order) {
  const statusSteps = ["Confirmed", "Preparing", "On the way", "Delivered"];
  const currentStep = statusSteps.indexOf(order.status);
  document.getElementById("trackingContent").innerHTML = `
    <div class="tracking-card">
      <div class="tracking-number">Order #${escapeHtml(order.id)} · ${new Date(order.createdAt || Date.now()).toLocaleString()}</div>
      <div class="tracking-status">${escapeHtml(order.status)}</div>
      <div class="tracking-steps">${statusSteps.map((step, index) => `<div class="tracking-step${index <= currentStep ? " done" : ""}">${escapeHtml(step)}</div>`).join("")}</div>
      <div class="tracking-summary">${(order.items || []).map((item) => `${escapeHtml(item.quantity)} × ${escapeHtml(item.name)}`).join("<br>")}<br><br><strong>Total · ${money(order.total)}</strong><br>${escapeHtml(order.deliveryAddress || "")}</div>
    </div>`;
}

document.getElementById("trackForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  const orderId = new FormData(event.currentTarget).get("orderId");
  const errorElement = document.getElementById("trackError");
  errorElement.textContent = "";
  try {
    const order = await request(`/api/orders/${encodeURIComponent(orderId)}`);
    renderTracking(order);
  } catch (error) {
    errorElement.textContent = error.message;
  }
});

if (state.user) document.getElementById("loginNav").textContent = `Hi, ${state.user.name.split(" ")[0]}`;
loadMenu();
