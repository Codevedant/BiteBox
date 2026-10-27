const foodCurrency = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 });
const detailCart = readDetailCart();
let selectedFood = null;

function readDetailCart() {
  try {
    const cart = JSON.parse(localStorage.getItem("bitebox-cart") || "[]");
    return Array.isArray(cart) ? cart : [];
  } catch {
    return [];
  }
}

function detailEscape(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  })[character]);
}

function updateCartCount() {
  document.getElementById("detailCartCount").textContent =
    detailCart.reduce((total, item) => total + (Number(item.quantity) || 0), 0);
}

function showFoodError(message) {
  document.getElementById("foodDetail").innerHTML = `
    <div class="food-detail-error">
      <span class="eyebrow"><span class="eyebrow-line"></span> A LITTLE MIX-UP</span>
      <h1>We couldn't find that bite.</h1>
      <p>${detailEscape(message)}</p>
      <a class="button button-dark" href="index.html#menu">Back to the menu <span>←</span></a>
    </div>`;
}

function renderFood(food) {
  selectedFood = food;
  document.title = `${food.name} — BiteBox`;
  document.getElementById("foodDetail").innerHTML = `
    <div class="food-detail-image-wrap">
      <img class="food-detail-image" src="${detailEscape(food.imageUrl || "")}" alt="${detailEscape(food.name)}">
      ${food.badge ? `<span class="food-badge">${detailEscape(food.badge)}</span>` : ""}
    </div>
    <section class="food-detail-copy" aria-labelledby="foodTitle">
      <div class="eyebrow"><span class="eyebrow-line"></span> ${detailEscape(food.category)}</div>
      <h1 id="foodTitle">${detailEscape(food.name)}</h1>
      <div class="food-detail-meta"><span class="food-detail-price">${foodCurrency.format(Number(food.price))}</span><span class="food-detail-separator">·</span><span class="food-detail-diet">${food.isVegetarian ? "Vegetarian" : "Non-vegetarian"}</span></div>
      <p class="food-detail-description">${detailEscape(food.description)}</p>
      <div class="food-detail-rule"></div>
      <p class="food-detail-note">The details you need before your first bite.</p>
      <div class="food-detail-actions">
        <div class="detail-quantity" aria-label="Quantity">
          <button type="button" id="quantityDown" aria-label="Decrease quantity">−</button>
          <span id="quantityValue" aria-live="polite">1</span>
          <button type="button" id="quantityUp" aria-label="Increase quantity">+</button>
        </div>
        <button class="button button-dark food-add-button" id="addFood" type="button">Add to cart <span>＋</span></button>
      </div>
      <p class="food-detail-added" id="foodAdded" role="status" aria-live="polite"></p>
      <a class="food-continue-link" href="index.html#menu">Keep exploring the menu <span>↗</span></a>
    </section>`;
  document.getElementById("quantityDown").addEventListener("click", () => changeDetailQuantity(-1));
  document.getElementById("quantityUp").addEventListener("click", () => changeDetailQuantity(1));
  document.getElementById("addFood").addEventListener("click", addDetailFoodToCart);
}

let quantity = 1;
function changeDetailQuantity(change) {
  quantity = Math.max(1, Math.min(20, quantity + change));
  document.getElementById("quantityValue").textContent = quantity;
}

function addDetailFoodToCart() {
  if (!selectedFood) return;
  const existing = detailCart.find((item) => String(item.id) === String(selectedFood.id));
  if (existing) existing.quantity += quantity;
  else detailCart.push({ id: selectedFood.id, quantity, item: selectedFood });
  localStorage.setItem("bitebox-cart", JSON.stringify(detailCart));
  updateCartCount();
  const added = document.getElementById("foodAdded");
  added.textContent = `${quantity} × ${selectedFood.name} added to your cart.`;
  quantity = 1;
  document.getElementById("quantityValue").textContent = quantity;
}

async function loadFood() {
  updateCartCount();
  const id = new URLSearchParams(window.location.search).get("id");
  if (!id) {
    showFoodError("Choose a food item from the menu to see its details.");
    return;
  }

  let menu;
  try {
    const response = await fetch("/api/menu");
    if (!response.ok) throw new Error("The menu service is unavailable.");
    menu = await response.json();
  } catch {
    menu = window.BITEBOX_SAMPLE_MENU;
  }
  const food = menu.find((item) => String(item.id) === id);
  if (!food) {
    showFoodError("This item may have been removed from the menu.");
    return;
  }
  renderFood(food);
}

loadFood();
