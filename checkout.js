// Checkout.js - Handles the Stripe payment process

// Initialize variables
let cart = [];
let orderData = {
    items: [],
    subtotal: 0,
    shipping: 0,
    pointsUsed: 0,
    pointsDiscount: 0,
    total: 0
};
let stripe;
let elements;
let paymentIntentId;
let clientSecret;

// Initialize page on load
document.addEventListener('DOMContentLoaded', async function() {
    // Load cart from localStorage
    loadCart();

    // If cart is empty, redirect to cart page
    if (cart.length === 0) {
        window.location.href = 'cart.html';
        return;
    }

    // Calculate order totals
    calculateOrderTotals();

    // Display order summary
    renderOrderSummary();

    // Initialize Stripe
    try {
        await initializeStripe();
    } catch (error) {
        showMessage(error.message, 'error');
    }
});

// Load cart from localStorage
function loadCart() {
    const savedCart = localStorage.getItem('eAspirantCart');
    if (savedCart) {
        cart = JSON.parse(savedCart);
    } else {
        cart = [];
    }

    // Get points discount if applied on cart page
    const pointsData = localStorage.getItem('eAspirantPointsDiscount');
    if (pointsData) {
        const { pointsUsed, pointsDiscount } = JSON.parse(pointsData);
        orderData.pointsUsed = pointsUsed || 0;
        orderData.pointsDiscount = pointsDiscount || 0;
    }
}

// Calculate order totals
function calculateOrderTotals() {
    // Calculate subtotal
    orderData.subtotal = cart.reduce((total, item) => total + (item.price * item.quantity), 0);

    // Calculate shipping
    orderData.shipping = orderData.subtotal > 200 ? 0 : 30; // Free shipping for orders over 200

    // Calculate total (with points discount if applied)
    orderData.total = orderData.subtotal + orderData.shipping - orderData.pointsDiscount;

    // Make sure total is not negative
    if (orderData.total < 0) orderData.total = 0;

    // Prepare items for order
    orderData.items = cart.map(item => ({
        title: item.title,
        price: item.price,
        quantity: item.quantity
    }));
}

// Render order summary
function renderOrderSummary() {
    const orderItemsContainer = document.getElementById('orderItems');
    const subtotalElement = document.getElementById('summarySubtotal');
    const shippingElement = document.getElementById('summaryShipping');
    const pointsDiscountRow = document.getElementById('pointsDiscountRow');
    const pointsDiscountElement = document.getElementById('summaryPointsDiscount');
    const totalElement = document.getElementById('summaryTotal');

    // Display order items
    let orderItemsHTML = '';
    cart.forEach(item => {
        orderItemsHTML += `
            <li class="summary-item">
                <span>${item.title} × ${item.quantity}</span>
                <span>₹${(item.price * item.quantity).toFixed(2)}</span>
            </li>
        `;
    });
    orderItemsContainer.innerHTML = orderItemsHTML;

    // Display order totals
    subtotalElement.textContent = `₹${orderData.subtotal.toFixed(2)}`;
    shippingElement.textContent = orderData.shipping === 0 ? 'FREE' : `₹${orderData.shipping.toFixed(2)}`;

    // Display points discount if applied
    if (orderData.pointsDiscount > 0) {
        pointsDiscountRow.style.display = 'flex';
        pointsDiscountElement.textContent = `-₹${orderData.pointsDiscount.toFixed(2)}`;
    }

    // Display total
    totalElement.textContent = `₹${orderData.total.toFixed(2)}`;
}

// Initialize Stripe
async function initializeStripe() {
    try {
        // Get your publishable key
        const publishableKey = 'pk_test_51R8HicQ9YFhYWC0XbKfUytOY7TAxgovlPo8PRdqkLIuBm0ziVxC8nL6V4RUx05hy1dUQNIv6P3a2p6Un1fn4hIM7006tr9Fj2x';

        // Make sure we have a valid key
        if (!publishableKey || publishableKey.includes('your_stripe_publishable_key')) {
            throw new Error('Please set your Stripe publishable key');
        }

        // Create Stripe instance
        stripe = Stripe(publishableKey);

        // Don't create payment intent if total is zero
        if (orderData.total <= 0) {
            showMessage('Cannot process a zero amount payment', 'error');
            return;
        }

        // Set up the pay now button handler
        document.getElementById('submit').addEventListener('click', handleCheckoutRedirect);

        console.log('Stripe initialized successfully');
    } catch (error) {
        console.error('Stripe initialization error:', error);
        showMessage(`Stripe initialization error: ${error.message}`, 'error');
    }
}


// Handle form submission
async function handleCheckoutRedirect(e) {
    e.preventDefault();
    setLoading(true);

    try {
        // Create checkout session
        const response = await fetch('/api/create-payment-intent', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                amount: orderData.total,
                productName: "E-Aspirant Purchase",
                metadata: {
                    cartItems: JSON.stringify(orderData.items.map(item => ({
                        title: item.title,
                        quantity: item.quantity
                    })))
                }
            })
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Failed to create checkout session');
        }

        const { url } = await response.json();

        // Redirect to Stripe Checkout
        window.location.href = url;
    } catch (error) {
        console.error('Checkout error:', error);
        showMessage(`Payment error: ${error.message}`);
        setLoading(false);
    }
}


// Save order to database
async function saveOrder() {
    try {
        // Get user ID from localStorage if available (logged in user)
        const userData = localStorage.getItem('eAspirantUser');
        const userId = userData ? JSON.parse(userData).id : null;

        const orderPayload = {
            userId,
            items: orderData.items,
            subtotal: orderData.subtotal,
            shipping: orderData.shipping,
            pointsUsed: orderData.pointsUsed,
            pointsDiscount: orderData.pointsDiscount,
            total: orderData.total,
            paymentId: paymentIntentId
        };

        const response = await fetch('/api/orders', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(orderPayload)
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Failed to save order');
        }

        return await response.json();
    } catch (error) {
        console.error('Save order error:', error);
        throw error;
    }
}

// Show error message
function showMessage(messageText, type = 'error') {
    const messageElement = document.getElementById('payment-message');
    messageElement.textContent = messageText;
    messageElement.style.display = 'block';

    if (type === 'error') {
        messageElement.style.color = 'var(--danger)';
    } else {
        messageElement.style.color = 'var(--success)';
    }

    setTimeout(() => {
        messageElement.style.display = 'none';
    }, 5000);
}

// Set loading state
function setLoading(isLoading) {
    const submitButton = document.getElementById('submit');
    const buttonText = document.getElementById('button-text');
    const spinner = document.getElementById('spinner');

    if (isLoading) {
        submitButton.disabled = true;
        spinner.style.display = 'inline-block';
        buttonText.textContent = 'Processing...';
    } else {
        submitButton.disabled = false;
        spinner.style.display = 'none';
        buttonText.textContent = 'Pay Now';
    }
}