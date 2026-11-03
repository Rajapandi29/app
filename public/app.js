const API = "/api";

let selectedProduct = null;

let products = [];

let cart = JSON.parse(
    localStorage.getItem("shopping-cart") || "[]"
);

const $ = id => document.getElementById(id);

function saveCart() {
    localStorage.setItem(
        "shopping-cart",
        JSON.stringify(cart)
    );

    updateCartCount();
}

function updateCartCount() {
    $("cartCount").textContent = cart.reduce(
        (sum, item) => sum + item.quantity,
        0
    );
}

async function apiRequest(path, options = {}) {

    const response = await fetch(`${API}${path}`, {
        ...options,
        headers: {
            "Content-Type": "application/json",
            ...(options.headers || {})
        }
    });

    const result = await response.json();

    if (!response.ok) {
        throw new Error(result.message || "API request failed");
    }

    return result;
}


// 1. Load all products from Cosmos DB through Function App

async function loadProducts() {

    $("productStatus").textContent = "Loading...";

    try {

        const result = await apiRequest("/products");

        products = result.products;

        renderProducts(products);

        $("productStatus").textContent =
            `${products.length} products available`;

    } catch (error) {

        $("productStatus").textContent =
            "Unable to load products";

        console.error(error);

    }

}


// 2. Display product cards

function renderProducts(items) {

    const grid = $("productGrid");

    grid.replaceChildren();

    items.forEach(product => {

        const card = document.createElement("div");

        card.className = "product-card";

        const image = document.createElement("img");

        image.src = product.images?.[0] || "";
        image.alt = product.name;
        image.loading = "lazy";

        image.addEventListener("click", () => {
            openProduct(product.id);
        });

        const content = document.createElement("div");

        content.className = "product-card-content";

        const name = document.createElement("h3");

        name.textContent = product.name;

        const price = document.createElement("p");

        price.className = "price";

        price.textContent =
            `₹${Number(product.price).toLocaleString("en-IN")}`;

        const category = document.createElement("p");

        category.textContent = product.category;

        const button = document.createElement("button");

        button.textContent = "View Product";

        button.addEventListener("click", () => {
            openProduct(product.id);
        });

        content.append(name, category, price, button);

        card.append(image, content);

        grid.appendChild(card);

    });

}


// 3. Product click -> Function App API

async function openProduct(productId) {

    try {

        const result = await apiRequest(
            `/products/${encodeURIComponent(productId)}`
        );

        selectedProduct = result.product;

        $("detailName").textContent =
            selectedProduct.name;

        $("detailPrice").textContent =
            `₹${Number(selectedProduct.price).toLocaleString("en-IN")}`;

        $("detailDescription").textContent =
            selectedProduct.description;

        $("detailStock").textContent =
            `Available stock: ${selectedProduct.stock}`;

        $("detailQuantity").value = 1;

        const gallery = $("imageGallery");

        gallery.replaceChildren();

        const images = selectedProduct.images || [];

        $("mainImage").src = images[0] || "";

        images.forEach(url => {

            const img = document.createElement("img");

            img.src = url;
            img.alt = selectedProduct.name;

            img.addEventListener("click", () => {
                $("mainImage").src = url;
            });

            gallery.appendChild(img);

        });

        $("productModal").style.display = "block";

    } catch (error) {

        alert(error.message);

    }

}


// 4. Add product to cart

function addSelectedToCart(buyNow = false) {

    if (!selectedProduct) return;

    const quantity = Number(
        $("detailQuantity").value
    );

    if (!Number.isInteger(quantity) || quantity < 1) {
        alert("Enter a valid quantity");
        return;
    }

    if (quantity > selectedProduct.stock) {
        alert("Requested quantity is not available");
        return;
    }

    const existing = cart.find(
        item => item.productId === selectedProduct.id
    );

    const newQuantity =
        (existing?.quantity || 0) + quantity;

    if (newQuantity > selectedProduct.stock) {
        alert("Not enough stock available");
        return;
    }

    if (existing) {
        existing.quantity = newQuantity;
    } else {
        cart.push({
            productId: selectedProduct.id,
            quantity
        });
    }

    saveCart();

    $("productModal").style.display = "none";

    if (buyNow) {
        showCart();
        openCheckout();
    } else {
        alert("Product added to cart");
    }

}


// 5. Cart -> API price verification

async function showCart() {

    $("cartModal").style.display = "block";

    await refreshCart();

}

async function refreshCart() {

    const result = await apiRequest("/cart/quote", {
        method: "POST",
        body: JSON.stringify({
            items: cart
        })
    });

    const container = $("cartItems");

    container.replaceChildren();

    result.items.forEach(item => {

        const row = document.createElement("div");

        row.className = "cart-item";

        const name = document.createElement("span");

        name.textContent =
            `${item.name} × ${item.quantity}`;

        const price = document.createElement("strong");

        price.textContent =
            `₹${item.lineTotal.toLocaleString("en-IN")}`;

        const remove = document.createElement("button");

        remove.textContent = "Remove";

        remove.addEventListener("click", () => {

            cart = cart.filter(
                product => product.productId !== item.productId
            );

            saveCart();
            refreshCart();

        });

        row.append(name, price, remove);

        container.appendChild(row);

    });

    $("cartTotal").textContent =
        `Total: ₹${result.total.toLocaleString("en-IN")}`;

}


// 6. Checkout

function openCheckout() {

    if (cart.length === 0) {
        alert("Your cart is empty");
        return;
    }

    $("cartModal").style.display = "none";

    $("checkoutModal").style.display = "block";

}


// 7. Create order through Function App

async function placeOrder(event) {

    event.preventDefault();

    const form = event.target;

    const formData = new FormData(form);

    const customer = Object.fromEntries(
        formData.entries()
    );

    const button = form.querySelector(
        'button[type="submit"]'
    );

    button.disabled = true;

    try {

        const result = await apiRequest("/orders", {
            method: "POST",

            body: JSON.stringify({
                customer,
                items: cart
            })
        });

        $("orderMessage").textContent =
            `Order created! Reference: ${result.orderId}. Payment status: ${result.paymentStatus}`;

        cart = [];

        saveCart();

        form.reset();

    } catch (error) {

        $("orderMessage").textContent =
            error.message;

    } finally {

        button.disabled = false;

    }

}


// 8. Search

$("search").addEventListener("input", event => {

    const term = event.target.value.toLowerCase();

    const filtered = products.filter(product =>
        product.name.toLowerCase().includes(term) ||
        product.category.toLowerCase().includes(term)
    );

    renderProducts(filtered);

});


// Button events

$("refresh").onclick = loadProducts;

$("cartButton").onclick = showCart;

$("shopNow").onclick = () => {
    $("products-section")?.scrollIntoView();
    document.querySelector(".products-section")
        .scrollIntoView({ behavior: "smooth" });
};

$("addToCart").onclick = () => {
    addSelectedToCart(false);
};

$("buyNow").onclick = () => {
    addSelectedToCart(true);
};

$("checkout").onclick = openCheckout;

$("checkoutForm").onsubmit = placeOrder;

$("closeProduct").onclick = () => {
    $("productModal").style.display = "none";
};

$("closeCart").onclick = () => {
    $("cartModal").style.display = "none";
};

$("closeCheckout").onclick = () => {
    $("checkoutModal").style.display = "none";
};

updateCartCount();

loadProducts();