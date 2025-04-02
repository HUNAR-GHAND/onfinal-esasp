// cart.js - Add this to a separate file and include it in both pages

// Cart data structure
let cart = [];
let userPoints = 1000; // Example user points, in real app this would come from user profile

// Initialize cart from localStorage on page load
document.addEventListener('DOMContentLoaded', function() {
    loadCart();
    updateCartCounter();

    // If we're on the cart page, render the cart items
    if (document.getElementById('cartItems')) {
        renderCart();
        document.getElementById('availablePoints').textContent = userPoints;
    }

    // Add event listeners to "Add to Cart" buttons if on the books page
    const addToCartButtons = document.querySelectorAll('.book-link');
    addToCartButtons.forEach(button => {
        button.addEventListener('click', function(e) {
            e.preventDefault();
            const bookItem = this.closest('.book-item');
            const book = {
                id: generateId(),
                title: bookItem.querySelector('h3').textContent,
                author: bookItem.querySelector('p').textContent,
                price: parseFloat(bookItem.querySelector('.book-price').textContent.replace('₹', '')),
                image: bookItem.querySelector('img').src,
                quantity: 1
            };
            addToCart(book);
            showNotification(`${book.title} added to cart`);
        });
    });
});

// Generate a simple ID for items
function generateId() {
    return '_' + Math.random().toString(36).substr(2, 9);
}

// Add item to cart
function addToCart(item) {
    // Check if item already exists in cart
    const existingItemIndex = cart.findIndex(cartItem =>
        cartItem.title === item.title && cartItem.author === item.author);

    if (existingItemIndex > -1) {
        // If item exists, increase quantity
        cart[existingItemIndex].quantity += 1;
    } else {
        // Otherwise add new item
        cart.push(item);
    }

    // Save cart to localStorage and update UI
    saveCart();
    updateCartCounter();
}

// Remove item from cart
function removeFromCart(itemId) {
    cart = cart.filter(item => item.id !== itemId);
    saveCart();
    updateCartCounter();
    renderCart();
}

// Update item quantity
function updateQuantity(itemId, change) {
    const itemIndex = cart.findIndex(item => item.id === itemId);
    if (itemIndex > -1) {
        // Make sure quantity doesn't go below 1
        const newQuantity = cart[itemIndex].quantity + change;
        if (newQuantity < 1) return;

        cart[itemIndex].quantity = newQuantity;
        saveCart();
        renderCart();
    }
}

// Save cart to localStorage
function saveCart() {
    localStorage.setItem('eAspirantCart', JSON.stringify(cart));
}

// Load cart from localStorage
function loadCart() {
    const savedCart = localStorage.getItem('eAspirantCart');
    if (savedCart) {
        cart = JSON.parse(savedCart);
    }
}

// Update cart counter badge
function updateCartCounter() {
    const counter = document.getElementById('cartCounter');
    if (counter) {
        const itemCount = cart.reduce((total, item) => total + item.quantity, 0);
        counter.textContent = itemCount;
    }
}

// Render cart items and summary on cart page
function renderCart() {
    const cartItemsContainer = document.getElementById('cartItems');
    const subtotalElement = document.getElementById('subtotal');
    const shippingElement = document.getElementById('shipping');
    const totalElement = document.getElementById('total');

    if (!cartItemsContainer) return;

    if (cart.length === 0) {
        // Show empty cart message
        cartItemsContainer.innerHTML = `
            <div class="empty-cart">
                <i class="fas fa-shopping-cart fa-3x"></i>
                <h2>Your cart is empty</h2>
                <p>Looks like you haven't added any books to your cart yet.</p>
                <a href="books.html" class="continue-shopping">
                    <i class="fas fa-arrow-left"></i> Continue Shopping
                </a>
            </div>
        `;

        // Hide points section when cart is empty
        const pointsSection = document.getElementById('pointsSection');
        if (pointsSection) pointsSection.style.display = 'none';

        // Reset totals
        subtotalElement.textContent = '₹0.00';
        shippingElement.textContent = '₹0.00';
        totalElement.textContent = '₹0.00';
        return;
    }

    // Show points section
    const pointsSection = document.getElementById('pointsSection');
    if (pointsSection) pointsSection.style.display = 'block';

    // Calculate subtotal
    const subtotal = cart.reduce((total, item) => total + (item.price * item.quantity), 0);
    const shipping = subtotal > 200 ? 0 : 30; // Free shipping for orders over 200
    const total = subtotal + shipping;

    // Update summary
    subtotalElement.textContent = `₹${subtotal.toFixed(2)}`;
    shippingElement.textContent = shipping === 0 ? 'FREE' : `₹${shipping.toFixed(2)}`;
    totalElement.textContent = `₹${total.toFixed(2)}`;

    // Render each cart item
    let cartItemsHTML = '';
    cart.forEach(item => {
        cartItemsHTML += `
            <div class="cart-item" data-id="${item.id}">
                <div class="item-image">
                    <img src="${item.image}" alt="${item.title}">
                </div>
                <div class="item-details">
                    <h3>${item.title}</h3>
                    <p>${item.author}</p>
                    <p class="item-price">₹${item.price.toFixed(2)}</p>
                </div>
                <div class="item-quantity">
                    <button onclick="updateQuantity('${item.id}', -1)">-</button>
                    <span>${item.quantity}</span>
                    <button onclick="updateQuantity('${item.id}', 1)">+</button>
                </div>
                <div class="item-total">
                    ₹${(item.price * item.quantity).toFixed(2)}
                </div>
                <button class="remove-item" onclick="removeFromCart('${item.id}')">
                    <i class="fas fa-trash"></i>
                </button>
            </div>
        `;
    });

    cartItemsHTML += `
        <div style="text-align: right; margin-top: 1rem;">
            <a href="books.html" class="continue-shopping">
                <i class="fas fa-arrow-left"></i> Continue Shopping
            </a>
        </div>
    `;

    cartItemsContainer.innerHTML = cartItemsHTML;
}

// Apply points to get discount
function usePoints() {
    const pointsInput = document.getElementById('pointsToUse');
    const pointsToUse = parseInt(pointsInput.value);

    // Validate points input
    if (isNaN(pointsToUse) || pointsToUse <= 0) {
        showNotification('Please enter a valid number of points', 'error');
        return;
    }

    if (pointsToUse > userPoints) {
        showNotification('You don\'t have enough points', 'error');
        return;
    }

    // Calculate discount (1 point = 0.1 rupee)
    const discount = pointsToUse * 0.1;

    // Get current total
    const subtotal = parseFloat(document.getElementById('subtotal').textContent.replace('₹', ''));
    const shipping = document.getElementById('shipping').textContent === 'FREE' ?
        0 : parseFloat(document.getElementById('shipping').textContent.replace('₹', ''));
    const total = subtotal + shipping;

    // Make sure discount doesn't exceed total
    const finalDiscount = Math.min(discount, total);
    const finalTotal = total - finalDiscount;

    // Update UI
    document.getElementById('pointsDiscountRow').style.display = 'table-row';
    document.getElementById('finalTotalRow').style.display = 'table-row';
    document.getElementById('pointsDiscount').textContent = `-₹${finalDiscount.toFixed(2)}`;
    document.getElementById('finalTotal').textContent = `₹${finalTotal.toFixed(2)}`;

    // Disable points input after use
    pointsInput.disabled = true;
    document.getElementById('usePointsBtn').disabled = true;

    showNotification(`${pointsToUse} points applied successfully!`);
}

// Show notification
function showNotification(message, type = 'success') {
    // Create notification element if it doesn't exist
    let notification = document.querySelector('.notification');
    if (!notification) {
        notification = document.createElement('div');
        notification.className = 'notification';
        document.body.appendChild(notification);
    }

    // Set message and type
    notification.textContent = message;
    notification.className = `notification ${type === 'error' ? 'error' : 'success'}`;

    // Add show class to trigger animation
    setTimeout(() => {
        notification.classList.add('show');
    }, 10);

    // Hide after 3 seconds
    setTimeout(() => {
        notification.classList.remove('show');
    }, 3000);
}

// Proceed to payment
function proceedToPayment() {
    if (cart.length === 0) {
        showNotification('Your cart is empty', 'error');
        return;
    }

    // In a real application, this would redirect to a payment page
    // For now, just show a notification
    showNotification('Redirecting to payment gateway...');

    // Simulate redirect
    setTimeout(() => {
        alert('This would normally redirect to a payment gateway.');
    }, 1500);
}

// Clear cart (for testing)
function clearCart() {
    cart = [];
    saveCart();
    updateCartCounter();
    if (document.getElementById('cartItems')) {
        renderCart();
    }
}