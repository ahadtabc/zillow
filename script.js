// App State and Data
let orders = JSON.parse(localStorage.getItem('zillow_orders')) || [];
let products = JSON.parse(localStorage.getItem('zillow_products')) || [
    { name: "Car", rate: 2000 },
    { name: "Bike", rate: 500 },
    { name: "Camera", rate: 800 }
];

// DOM Elements
const splashScreen = document.getElementById('splash-screen');
const app = document.getElementById('app');
const themeToggle = document.getElementById('theme-toggle');
const sunIcon = document.querySelector('.sun-icon');
const moonIcon = document.querySelector('.moon-icon');
const navItems = document.querySelectorAll('.nav-item');
const views = document.querySelectorAll('.view');
const orderForm = document.getElementById('order-form');
const productSelect = document.getElementById('product-select');
const ordersList = document.getElementById('orders-list');
const completedList = document.getElementById('completed-list');
const ratesList = document.getElementById('rates-list');
const addRateForm = document.getElementById('add-rate-form');
const editOrderIdInput = document.getElementById('edit-order-id');
const formTitle = document.getElementById('form-title');
const submitBtn = document.getElementById('submit-btn');

// Modal Elements
const imageModal = document.getElementById('image-modal');
const modalImg = document.getElementById('modal-img');
const modalCaption = document.getElementById('modal-caption');
const closeModal = document.querySelector('.close-modal');

// Calendar State
let currentCalDate = new Date();
let selectedDateStr = null;

// --- Initialization ---

window.addEventListener('DOMContentLoaded', () => {
    // Splash Logic
    setTimeout(() => {
        splashScreen.style.opacity = '0';
        setTimeout(() => {
            splashScreen.classList.add('hidden');
            app.classList.remove('hidden');
        }, 300); // fade out duration
    }, 500); // 0.5s splash

    // Theme Logic
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'dark') {
        document.body.classList.add('dark-mode');
        sunIcon.classList.remove('hidden');
        moonIcon.classList.add('hidden');
    }

    renderProducts();
    checkExpiredOrders();
    renderOrders();
    renderSettings();
    startAlarmClock();

    // Init Calendar
    document.getElementById('cal-prev').addEventListener('click', () => changeMonth(-1));
    document.getElementById('cal-next').addEventListener('click', () => changeMonth(1));
});

// --- Theme Toggle ---

themeToggle.addEventListener('click', () => {
    document.body.classList.toggle('dark-mode');
    const isDark = document.body.classList.contains('dark-mode');
    localStorage.setItem('theme', isDark ? 'dark' : 'light');

    if (isDark) {
        sunIcon.classList.remove('hidden');
        moonIcon.classList.add('hidden');
    } else {
        sunIcon.classList.add('hidden');
        moonIcon.classList.remove('hidden');
    }
});

// --- Navigation ---

navItems.forEach(item => {
    item.addEventListener('click', () => {
        const targetId = item.getAttribute('data-target');

        // Reset Edit Form if moving away from Add Order
        if (targetId !== 'add-order') {
            resetOrderForm();
        }

        // Update Nav UI
        navItems.forEach(nav => nav.classList.remove('active'));
        item.classList.add('active');

        // Show View
        views.forEach(view => {
            view.classList.remove('active');
            if (view.id === targetId) {
                view.classList.add('active');
                if (targetId === 'calendar') renderCalendar();
            }
        });
    });
});

function navTo(targetId) {
    document.querySelector(`.nav-item[data-target="${targetId}"]`).click();
}

window.toggleSubView = (elementId) => {
    // Hide all embedded sections first
    const allEmbedded = document.querySelectorAll('.embedded-section');
    const target = document.getElementById(elementId);

    const isHidden = target.classList.contains('hidden');

    // Hide all
    allEmbedded.forEach(el => el.classList.add('hidden'));

    if (isHidden) {
        target.classList.remove('hidden');
        if (elementId === 'embedded-completed') renderCompletedOrders();
        if (elementId === 'embedded-earnings') renderEarnings();
    }
}

// --- Data & Rendering ---

function renderProducts() {
    productSelect.innerHTML = '<option value="" disabled selected>Select Product</option>';
    products.forEach(p => {
        const option = document.createElement('option');
        option.value = p.name;
        option.textContent = `${p.name} (₹${p.rate}/12hr)`;
        productSelect.appendChild(option);
    });
}

function renderOrders() {
    const ordersList = document.getElementById('orders-list');
    if (!ordersList) return;

    ordersList.innerHTML = '';

    const activeOrders = orders.filter(o => o.status !== 'completed');

    if (activeOrders.length === 0) {
        ordersList.innerHTML = `
        <div class="empty-state">
            <p>No active rentals.</p>
            <button class="btn-primary" onclick="navTo('add-order')">Add First Order</button>
        </div>`;
        return;
    }

    // Sort by End Date Ascending (Ending Soonest First)
    activeOrders.sort((a, b) => new Date(a.endDate) - new Date(b.endDate));

    let lastHeaderDate = null;
    const now = new Date();
    const today = new Date(now);
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    let totalEarnings = 0;

    activeOrders.forEach(order => {
        const start = new Date(order.startDate);
        const end = new Date(order.endDate);
        const endDayCheck = new Date(end);
        endDayCheck.setHours(0, 0, 0, 0);

        // --- Date Header Logic ---
        let headerText = '';
        if (endDayCheck.getTime() === today.getTime()) {
            headerText = "Today";
        } else if (endDayCheck.getTime() === tomorrow.getTime()) {
            headerText = "Tomorrow";
        } else {
            // e.g., "Monday, Dec 12"
            headerText = end.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
        }

        if (headerText !== lastHeaderDate) {
            const header = document.createElement('div');
            header.className = 'orders-date-header';
            header.textContent = `Ends: ${headerText}`;
            ordersList.appendChild(header);
            lastHeaderDate = headerText;
        }

        // Calculate Duration & Cost
        const diffTime = Math.abs(end - start);
        const diffUnits = Math.ceil(diffTime / (1000 * 60 * 60 * 12));

        // Exact Duration Calculation
        const totalHrs = Math.floor(diffTime / (1000 * 60 * 60));
        const dDays = Math.floor(totalHrs / 24);
        const dHours = totalHrs % 24;
        const durationStr = `${dDays} Day(s), ${dHours} Hour(s)`;

        const product = products.find(p => p.name === order.productName);
        const rate = product ? product.rate : 0;
        let totalCost = diffUnits * rate;

        // Manual Override
        if (order.manualCost) {
            totalCost = parseFloat(order.manualCost);
        }

        totalEarnings += totalCost;

        const isEndingSoon = (end - now) < (24 * 60 * 60 * 1000) && (end > now); // Less than 24h
        const isCompleted = order.status === 'completed';

        const card = document.createElement('div');
        card.className = `order-card ${isEndingSoon ? 'priority' : ''} ${isCompleted ? 'completed' : ''}`;

        // Format Dates
        const dateOpts = { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' };

        let proofHtml = '';
        if (order.proofData) {
            proofHtml = `
            <div class="proof-attachment">
                 <span class="proof-name" onclick="viewProof('${order.proofData}', '${order.proofName}')">📄 ${order.proofName}</span>
                 <button onclick="downloadProof('${order.proofData}', '${order.proofName}')" class="btn-download-modern">
                    <svg viewBox="0 0 24 24"><path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"/></svg> Download
                 </button>
            </div>`;
        } else if (order.proofName) {
            proofHtml = `<div class="order-detail">📄 ${order.proofName} (No File)</div>`;
        }

        if (order.altProofData) {
            proofHtml += `
            <div class="proof-attachment">
                 <span class="proof-name" onclick="viewProof('${order.altProofData}', '${order.altProofName}')">📄 ${order.altProofName}</span>
                 <button onclick="downloadProof('${order.altProofData}', '${order.altProofName}')" class="btn-download-modern">
                    <svg viewBox="0 0 24 24"><path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"/></svg> Download
                 </button>
            </div>`;
        } else if (order.altProofName) {
            proofHtml += `<div class="order-detail">📄 ${order.altProofName} (No File)</div>`;
        }

        let actionButtons = '';
        if (!isCompleted) {
            actionButtons = `
            <div class="action-row">
                <a href="tel:${order.phone1}" class="btn-sm btn-call">📞 Call</a>
                ${order.phone2 ? `<a href="tel:${order.phone2}" class="btn-sm btn-call" style="background-color: var(--primary);">📞 Alt</a>` : ''}
                ${order.phone3 ? `<a href="tel:${order.phone3}" class="btn-sm btn-call" style="background-color: #673AB7;">📞 Alt 2</a>` : ''}
                <button class="btn-sm btn-delete-active" onclick="deleteOrder('${order.id}')">🗑 Delete</button>
                <button class="btn-sm btn-edit" onclick="editOrder('${order.id}')">✏ Edit</button>
                <button class="btn-sm btn-complete" onclick="completeOrder('${order.id}')">✔ Complete</button>
            </div>`;
        } else {
            actionButtons = `
            <div class="action-row">
                <button class="btn-sm" style="color:red; border-color:red;" onclick="deleteOrder('${order.id}')">Delete History</button>
            </div>`;
        }

        card.innerHTML = `
            <h3>${order.productName}</h3>
            <div class="price-tag" onclick="quickEditPrice('${order.id}')" title="Click to edit">₹${totalCost} ${order.manualCost ? '(Edited)' : ''} ✎</div>
            <div class="order-detail">👤 ${order.userName}</div>
            <div class="order-detail">📍 ${order.location}</div>
            <div class="order-detail">📅 ${start.toLocaleDateString('en-US', dateOpts)} ➝ ${end.toLocaleDateString('en-US', dateOpts)}</div>
         
            <div class="order-detail">⏳${durationStr}</div>
            ${order.extra ? `<div class="order-detail">📝 ${order.extra}</div>` : ''}
            ${proofHtml}
            ${actionButtons}
        `;

        ordersList.appendChild(card);
    });

    const totalEl = document.getElementById('total-earnings-amount');
    // Active orders total is usually distinct, but keeping existing logic if needed. 
    // In this app, 'Total Revenue' (in Earnings view) is for completed only.
    // The dashboard header total might be for 'Expected' revenue from active. 
    // Let's assume dashboard total logic remains for Active Project Revenue.
    if (totalEl) totalEl.textContent = `₹${totalEarnings}`;
}

function resetMonthlyFilter() {
    const picker = document.getElementById('monthly-month-picker');
    if (picker) picker.value = '';
    renderEarnings();
}

function resetProductFilter() {
    const picker = document.getElementById('product-month-picker');
    if (picker) picker.value = '';
    renderEarnings();
}

function renderEarnings() {
    // Use ONLY completed orders for all earnings calculations
    const completedOrders = orders.filter(o => o.status === 'completed');

    // --- Report / Main Filter State ---
    const reportPicker = document.getElementById('report-month-picker');
    const reportClearBtn = document.getElementById('report-clear-filter');
    let reportFilterStr = 'all';

    if (reportPicker && reportClearBtn) {
        if (reportPicker.value) {
            reportClearBtn.style.display = 'block';
            const [year, month] = reportPicker.value.split('-');
            const dateObj = new Date(year, month - 1);
            reportFilterStr = dateObj.toLocaleString('default', { month: 'long', year: 'numeric' });
        } else {
            reportClearBtn.style.display = 'none';
        }
    }

    // --- Product Breakdown Filter State ---
    const productPicker = document.getElementById('product-month-picker');
    const productClearBtn = document.getElementById('product-clear-filter');
    let productFilterStr = 'all';

    if (productPicker && productClearBtn) {
        if (productPicker.value) {
            productClearBtn.style.display = 'block';
            const [year, month] = productPicker.value.split('-');
            const dateObj = new Date(year, month - 1);
            productFilterStr = dateObj.toLocaleString('default', { month: 'long', year: 'numeric' });
        } else {
            productClearBtn.style.display = 'none';
        }
    }

    // --- Monthly Breakdown Filter State ---
    const monthlyPicker = document.getElementById('monthly-month-picker');
    const monthlyClearBtn = document.getElementById('monthly-clear-filter');
    let monthlyFilterStr = 'all';

    if (monthlyPicker && monthlyClearBtn) {
        if (monthlyPicker.value) {
            monthlyClearBtn.style.display = 'block';
            const [year, month] = monthlyPicker.value.split('-');
            const dateObj = new Date(year, month - 1);
            monthlyFilterStr = dateObj.toLocaleString('default', { month: 'long', year: 'numeric' });
        } else {
            monthlyClearBtn.style.display = 'none';
        }
    }

    // --- Product Days Breakdown Filter State ---
    const productDaysPicker = document.getElementById('product-days-month-picker');
    const productDaysClearBtn = document.getElementById('product-days-clear-filter');
    let productDaysFilterStr = 'all';

    if (productDaysPicker && productDaysClearBtn) {
        if (productDaysPicker.value) {
            productDaysClearBtn.style.display = 'block';
            const [year, month] = productDaysPicker.value.split('-');
            const dateObj = new Date(year, month - 1);
            productDaysFilterStr = dateObj.toLocaleString('default', { month: 'long', year: 'numeric' });
        } else {
            productDaysClearBtn.style.display = 'none';
        }
    }

    let monthlyTotals = {};
    let productTotals = {};
    let productDurationTotals = {};
    let totalRevenue = 0;

    // 1. Calculate Stats
    completedOrders.forEach(order => {
        const s = new Date(order.startDate);
        const e = new Date(order.endDate);
        const diffUnits = Math.ceil(Math.abs(e - s) / (1000 * 60 * 60 * 12));
        const p = products.find(prod => prod.name === order.productName);
        let cost = diffUnits * (p ? p.rate : 0);

        if (order.manualCost) {
            cost = parseFloat(order.manualCost);
        }

        const m = e.toLocaleString('default', { month: 'long', year: 'numeric' });

        // Total Revenue: Filtered by Main/Report Filter
        if (reportFilterStr === 'all' || m === reportFilterStr) {
            totalRevenue += cost;
        }

        // Monthly Breakdown Logic:
        // If 'all', collect everything.
        // If filtered, only collect if month matches.
        if (monthlyFilterStr === 'all' || m === monthlyFilterStr) {
            if (!monthlyTotals[m]) monthlyTotals[m] = 0;
            monthlyTotals[m] += cost;
        }

        // Product Breakdown Logic:
        // If 'all', collect everything.
        // If filtered, only collect if month matches.
        if (productFilterStr === 'all' || m === productFilterStr) {
            const prodName = order.productName;
            if (!productTotals[prodName]) productTotals[prodName] = 0;
            productTotals[prodName] += cost;
        }

        // Product Duration Logic
        if (productDaysFilterStr === 'all' || m === productDaysFilterStr) {
            const prodNameForDuration = order.productName;
            if (!productDurationTotals[prodNameForDuration]) productDurationTotals[prodNameForDuration] = 0;
            productDurationTotals[prodNameForDuration] += Math.abs(e - s);
        }
    });

    const earningsEl = document.getElementById('cash-total-amount');
    if (earningsEl) earningsEl.textContent = `₹${totalRevenue}`;

    // Render Monthly Stats
    const monthlyContainer = document.getElementById('monthly-stats');
    if (monthlyContainer) {
        monthlyContainer.innerHTML = '';
        if (Object.keys(monthlyTotals).length === 0) {
            monthlyContainer.innerHTML = '<div style="color:var(--text-secondary);">No data</div>';
        } else {
            if (monthlyFilterStr !== 'all') {
                monthlyContainer.innerHTML = '<div style="color:var(--text-secondary); font-style:italic;">Filtered by ' + monthlyFilterStr + '</div>';
            }
            for (const [key, value] of Object.entries(monthlyTotals)) {
                const item = document.createElement('div');
                item.className = 'stat-item';
                item.innerHTML = `<span>${key}</span><span>₹${value}</span>`;
                monthlyContainer.appendChild(item);
            }
        }
    }

    // Render Product Stats
    const productContainer = document.getElementById('product-stats');
    if (productContainer) {
        productContainer.innerHTML = '';
        if (Object.keys(productTotals).length === 0) {
            productContainer.innerHTML = '<div style="color:var(--text-secondary);">No data</div>';
        } else {
            if (productFilterStr !== 'all') {
                productContainer.innerHTML = '<div style="color:var(--text-secondary); font-style:italic;">Filtered by ' + productFilterStr + '</div>';
            }
            const sortedProducts = Object.entries(productTotals).sort((a, b) => b[1] - a[1]);
            sortedProducts.forEach(([name, val]) => {
                const item = document.createElement('div');
                item.className = 'stat-item';
                item.innerHTML = `<span>${name}</span><span>₹${val}</span>`;
                productContainer.appendChild(item);
            });
        }
    }

    // Render Product Days Stats
    const productDaysContainer = document.getElementById('product-days-stats');
    if (productDaysContainer) {
        productDaysContainer.innerHTML = '';
        if (Object.keys(productDurationTotals).length === 0) {
            productDaysContainer.innerHTML = '<div style="color:var(--text-secondary);">No data</div>';
        } else {
            if (productDaysFilterStr !== 'all') {
                productDaysContainer.innerHTML = '<div style="color:var(--text-secondary); font-style:italic;">Filtered by ' + productDaysFilterStr + '</div>';
            }
            const sortedDurations = Object.entries(productDurationTotals).sort((a, b) => b[1] - a[1]);
            sortedDurations.forEach(([name, ms]) => {
                const totalHrs = Math.floor(ms / (1000 * 60 * 60));
                const dDays = Math.floor(totalHrs / 24);
                const dHours = totalHrs % 24;
                const durationStr = `${dDays}d ${dHours}h`;

                const item = document.createElement('div');
                item.className = 'stat-item';
                item.innerHTML = `<span>${name}</span><span>${durationStr}</span>`;
                productDaysContainer.appendChild(item);
            });
        }
    }
}

function resetProductDaysFilter() {
    const picker = document.getElementById('product-days-month-picker');
    if (picker) picker.value = '';
    renderEarnings();
}

function resetReportFilter() {
    const picker = document.getElementById('report-month-picker');
    if (picker) picker.value = '';
    renderEarnings();
}

function resetHistoryFilter() {
    const picker = document.getElementById('history-month-picker');
    if (picker) picker.value = '';
    renderCompletedOrders();
}

function renderCompletedOrders() {
    completedList.innerHTML = '';
    let completedOrders = orders.filter(o => o.status === 'completed');

    // --- History Filter Logic ---
    const picker = document.getElementById('history-month-picker');
    const clearBtn = document.getElementById('history-clear-filter');

    if (picker && clearBtn) {
        if (picker.value) {
            clearBtn.style.display = 'block';
            const [year, month] = picker.value.split('-');
            const dateObj = new Date(year, month - 1);
            const filterStr = dateObj.toLocaleString('default', { month: 'long', year: 'numeric' });

            // Filter by End Date Month
            completedOrders = completedOrders.filter(o => {
                const e = new Date(o.endDate);
                const m = e.toLocaleString('default', { month: 'long', year: 'numeric' });
                return m === filterStr;
            });
            clearBtn.style.display = 'none';
        }
    }

    // Update Count Display
    const countDisplay = document.getElementById('history-count-display');
    if (countDisplay) {
        if (completedOrders.length === 0) {
            countDisplay.innerHTML = `<span class="count-badge">Total: 0</span>`;
        } else {
            const productCounts = {};
            completedOrders.forEach(o => {
                productCounts[o.productName] = (productCounts[o.productName] || 0) + 1;
            });

            const countHtml = Object.entries(productCounts)
                .sort((a, b) => b[1] - a[1])
                .map(([name, count]) => `<span class="count-badge">${name}: ${count}</span>`)
                .join('');

            countDisplay.innerHTML = countHtml;
        }
    }

    if (completedOrders.length === 0) {
        completedList.innerHTML = `
        <div class="empty-state">
            <p>No completed rentals found for this period.</p>
        </div>`;
        return;
    }

    // Sort by most recent end date
    completedOrders.sort((a, b) => new Date(b.endDate) - new Date(a.endDate));

    completedOrders.forEach(order => {
        const start = new Date(order.startDate);
        const end = new Date(order.endDate);
        const diffUnits = Math.ceil(Math.abs(end - start) / (1000 * 60 * 60 * 12));

        // Exact Duration Calculation
        const diffTime = Math.abs(end - start);
        const totalHrs = Math.floor(diffTime / (1000 * 60 * 60));
        const dDays = Math.floor(totalHrs / 24);
        const dHours = totalHrs % 24;
        const durationStr = `${dDays} Day(s), ${dHours} Hour(s)`;

        const product = products.find(p => p.name === order.productName);
        let totalCost = diffUnits * (product ? product.rate : 0);

        if (order.manualCost) {
            totalCost = parseFloat(order.manualCost);
        }

        const dateOpts = { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' };

        let proofHtml = '';
        if (order.proofData) {
            proofHtml = `
            <div class="proof-attachment">
                 <span class="proof-name" onclick="viewProof('${order.proofData}', '${order.proofName}')">📄 ${order.proofName}</span>
                 <button onclick="downloadProof('${order.proofData}', '${order.proofName}')" class="btn-download-modern">
                    <svg viewBox="0 0 24 24"><path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"/></svg> Download
                 </button>
            </div>`;
        } else if (order.proofName) {
            proofHtml = `<div class="order-detail">📄 ${order.proofName} (No File)</div>`;
        }

        if (order.altProofData) {
            proofHtml += `
            <div class="proof-attachment">
                 <span class="proof-name" onclick="viewProof('${order.altProofData}', '${order.altProofName}')">📄 ${order.altProofName}</span>
                 <a href="#" onclick="downloadProof('${order.altProofData}', '${order.altProofName}'); return false;" class="btn-sm">⬇</a>
            </div>`;
        } else if (order.altProofName) {
            proofHtml += `<div class="order-detail">📄 ${order.altProofName} (No File)</div>`;
        }

        const card = document.createElement('div');
        card.className = 'order-card completed';
        card.innerHTML = `
            <h3>${order.productName}</h3>
            <div class="price-tag">₹${totalCost}</div>
            <div class="order-detail">👤 ${order.userName}</div>
            <div class="order-detail">📍 ${order.location}</div>
            <div class="order-detail">📅 ${start.toLocaleDateString('en-US', dateOpts)} ➝ ${end.toLocaleDateString('en-US', dateOpts)}</div>
            <div class="order-detail">⏳ ${diffUnits} Unit(s) (12hr)</div>
            <div class="order-detail">⏱ ${durationStr}</div>
            ${order.extra ? `<div class="order-detail">📝 ${order.extra}</div>` : ''}
            ${proofHtml}
            <div class="action-row">
                <a href="tel:${order.phone1}" class="btn-sm btn-call">📞 ${order.phone1}</a>
                ${order.phone2 ? `<a href="tel:${order.phone2}" class="btn-sm btn-call">📞 ${order.phone2}</a>` : ''}
                ${order.phone3 ? `<a href="tel:${order.phone3}" class="btn-sm btn-call">📞 ${order.phone3}</a>` : ''}
                <button class="btn-sm" style="color:red; border-color:red;" onclick="deleteOrder('${order.id}')">Delete History</button>
            </div>
        `;
        completedList.appendChild(card);
    });
}

function renderSettings() {
    ratesList.innerHTML = '';
    if (products.length === 0) {
        ratesList.innerHTML = '<p style="color:var(--text-secondary); font-size:0.9rem;">No products added.</p>';
        return;
    }
    products.forEach((p, index) => {
        const div = document.createElement('div');
        div.style.display = 'flex';
        div.style.justifyContent = 'space-between';
        div.style.alignItems = 'center';
        div.style.padding = '8px 0';
        div.style.borderBottom = '1px solid var(--border)';
        div.innerHTML = `
            <span>${p.name}</span>
            <div style="display:flex; align-items:center; gap:10px;">
                <span>₹${p.rate}</span>
                <button onclick="deleteProduct(${index})" style="background:none; border:none; cursor:pointer;">❌</button>
            </div>
        `;
        ratesList.appendChild(div);
    });
}

window.deleteProduct = (index) => {
    if (confirm('Warning: Are you sure you want to delete this product?')) {
        products.splice(index, 1);
        localStorage.setItem('zillow_products', JSON.stringify(products));
        renderSettings();
        renderProducts();
    }
}

// --- Order Creation & Updating ---

function checkExpiredOrders() {
    const now = new Date();
    let updated = false;
    orders.forEach(order => {
        if (order.status !== 'completed') {
            const end = new Date(order.endDate);
            if (end < now) {
                order.status = 'completed';
                updated = true;
            }
        }
    });

    if (updated) {
        localStorage.setItem('zillow_orders', JSON.stringify(orders));
    }
}

// Helper to read file
const fileInput = document.getElementById('proof-file');
const fileNameDisplay = document.getElementById('file-name-display');
let currentFileBase64 = null;

const altFileInput = document.getElementById('alt-proof-file');
const altFileNameDisplay = document.getElementById('alt-file-name-display');
let currentAltFileBase64 = null;

fileInput.addEventListener('change', (e) => {
    if (e.target.files.length > 0) {
        const file = e.target.files[0];
        fileNameDisplay.textContent = file.name;

        const reader = new FileReader();
        reader.onloadend = () => {
            currentFileBase64 = reader.result;
        };
        reader.readAsDataURL(file);
    } else {
        fileNameDisplay.textContent = '';
        currentFileBase64 = null;
    }
});

altFileInput.addEventListener('change', (e) => {
    if (e.target.files.length > 0) {
        const file = e.target.files[0];
        altFileNameDisplay.textContent = file.name;

        const reader = new FileReader();
        reader.onloadend = () => {
            currentAltFileBase64 = reader.result;
        };
        reader.readAsDataURL(file);
    } else {
        altFileNameDisplay.textContent = '';
        currentAltFileBase64 = null;
    }
});

orderForm.addEventListener('submit', (e) => {
    e.preventDefault();

    const editId = editOrderIdInput.value;

    // Form Values
    const productName = productSelect.value;
    const userName = document.getElementById('user-name').value;
    const location = document.getElementById('location').value;
    const proofName = document.getElementById('proof-name').value;
    const altProofName = document.getElementById('alt-proof-name').value;
    const phone1 = document.getElementById('phone-1').value;
    const phone2 = document.getElementById('phone-2').value;
    const phone3 = document.getElementById('phone-3').value;
    const startDate = document.getElementById('start-date').value;
    const endDate = document.getElementById('end-date').value;
    const extra = document.getElementById('extra-details').value;
    const manualCost = document.getElementById('manual-amount').value;

    if (editId) {
        // Update Existing Order
        const orderIndex = orders.findIndex(o => o.id === editId);
        if (orderIndex > -1) {
            orders[orderIndex] = {
                ...orders[orderIndex], // keep other props like 'createdAt' or 'status'
                productName, userName, location, proofName, altProofName, phone1, phone2, phone3, startDate, endDate, extra, manualCost
            };
            // Only update proof if a new one was selected
            if (currentFileBase64) {
                orders[orderIndex].proofData = currentFileBase64;
            }
            if (currentAltFileBase64) {
                orders[orderIndex].altProofData = currentAltFileBase64;
            }
        }
    } else {
        // Create New Order
        const id = Date.now().toString(36) + Math.random().toString(36).substr(2);
        const newOrder = {
            id,
            status: 'active',
            productName,
            userName,
            location,
            proofName,
            proofData: currentFileBase64,
            altProofName,
            altProofData: currentAltFileBase64,
            phone1,
            phone2,
            phone3,
            startDate,
            endDate,
            extra,
            manualCost,
            createdAt: new Date().toISOString()
        };
        orders.push(newOrder);
    }

    localStorage.setItem('zillow_orders', JSON.stringify(orders));
    renderOrders();
    resetOrderForm();
    navTo('dashboard');
});

function resetOrderForm() {
    orderForm.reset();
    editOrderIdInput.value = '';
    currentFileBase64 = null;
    fileNameDisplay.textContent = '';
    currentAltFileBase64 = null;
    altFileNameDisplay.textContent = '';
    formTitle.textContent = 'New Rental';
    submitBtn.textContent = 'Create Order';
}

// --- Dashboard Actions ---

window.deleteOrder = (id) => {
    if (confirm('Are you sure you want to delete this order? This action cannot be undone.')) {
        orders = orders.filter(o => o.id !== id);
        localStorage.setItem('zillow_orders', JSON.stringify(orders));
        renderOrders();
        renderEarnings();
        if (typeof renderCompletedOrders === 'function') renderCompletedOrders();
    }
}

window.editOrder = (id) => {
    const order = orders.find(o => o.id === id);
    if (!order) return;

    // Populate Form
    document.getElementById('product-select').value = order.productName;
    document.getElementById('user-name').value = order.userName;
    document.getElementById('location').value = order.location;
    document.getElementById('proof-name').value = order.proofName || '';
    document.getElementById('alt-proof-name').value = order.altProofName || '';
    document.getElementById('phone-1').value = order.phone1;
    document.getElementById('phone-2').value = order.phone2 || '';
    document.getElementById('phone-3').value = order.phone3 || '';
    document.getElementById('start-date').value = order.startDate;
    document.getElementById('end-date').value = order.endDate;
    document.getElementById('extra-details').value = order.extra || '';
    document.getElementById('manual-amount').value = order.manualCost || '';

    // Set Edit Mode
    editOrderIdInput.value = id;
    formTitle.textContent = 'Edit Rental';
    submitBtn.textContent = 'Update Order';

    // Don't reset file input visually, but keep old data logic (handled in submit)
    fileNameDisplay.textContent = 'Keep existing or upload new';
    altFileNameDisplay.textContent = order.altProofName ? 'Keep existing or upload new' : '';

    navTo('add-order');
}

window.completeOrder = (id) => {
    if (confirm('Mark this order as completed?')) {
        const order = orders.find(o => o.id === id);
        if (order) {
            order.status = 'completed';
            localStorage.setItem('zillow_orders', JSON.stringify(orders));
            renderOrders();
            renderCompletedOrders();
        }
    }
}

// --- PDF Report Generation ---
window.generatePDFReport = () => {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    let completedOrders = orders.filter(o => o.status === 'completed'); // Use let for reassignment

    if (completedOrders.length === 0) {
        alert("No completed orders to generate report.");
        return;
    }

    // --- Check Main/Report Filter ---
    const reportPicker = document.getElementById('report-month-picker');
    let reportFilterStr = 'all';
    if (reportPicker && reportPicker.value) {
        const [year, month] = reportPicker.value.split('-');
        const dateObj = new Date(year, month - 1);
        reportFilterStr = dateObj.toLocaleString('default', { month: 'long', year: 'numeric' });

        // Filter Orders for PDF
        completedOrders = completedOrders.filter(o => {
            const e = new Date(o.endDate);
            const m = e.toLocaleString('default', { month: 'long', year: 'numeric' });
            return m === reportFilterStr;
        });

        if (completedOrders.length === 0) {
            alert(`No completed orders found for ${reportFilterStr}.`);
            return;
        }
    }

    // --- Prepare Data ---
    const monthlyTotals = {};
    const productBreakdown = {}; // Key: Month -> { ProductName: Total }
    const productDurationTotals = {};

    completedOrders.forEach(order => {
        const e = new Date(order.endDate);
        const m = e.toLocaleString('default', { month: 'long', year: 'numeric' });

        // Calculate Cost
        const start = new Date(order.startDate);
        const diffUnits = Math.ceil(Math.abs(e - start) / (1000 * 60 * 60 * 12));
        const p = products.find(prod => prod.name === order.productName);
        let cost = diffUnits * (p ? p.rate : 0);
        if (order.manualCost) cost = parseFloat(order.manualCost);

        // Aggregate Monthly
        if (!monthlyTotals[m]) monthlyTotals[m] = 0;
        monthlyTotals[m] += cost;

        // Aggregate Product
        if (!productBreakdown[m]) productBreakdown[m] = {};
        if (!productBreakdown[m][order.productName]) productBreakdown[m][order.productName] = 0;
        productBreakdown[m][order.productName] += cost;

        // Aggregate Duration
        if (!productDurationTotals[order.productName]) productDurationTotals[order.productName] = 0;
        productDurationTotals[order.productName] += Math.abs(e - start);
    });

    // Sort Months (Newest First)
    const sortedMonths = Object.keys(monthlyTotals).sort((a, b) => new Date(b) - new Date(a));

    // --- PDF Content ---
    let title = "Earnings Report";
    if (reportFilterStr !== 'all') {
        title += ` - ${reportFilterStr}`;
    }

    const dateStr = new Date().toLocaleDateString();

    doc.setFontSize(20);
    doc.text(title, 14, 22);

    doc.setFontSize(11);
    doc.setTextColor(100);
    doc.text(`Generated on: ${dateStr}`, 14, 30);

    let finalY = 35;

    // 1. Monthly Summary Table
    doc.setFontSize(14);
    doc.setTextColor(0);
    doc.text("Monthly Earnings Summary", 14, finalY + 10);

    const monthlyTableData = sortedMonths.map(month => [month, `Rs ${monthlyTotals[month]}`]);

    doc.autoTable({
        startY: finalY + 15,
        head: [['Month', 'Total Revenue']],
        body: monthlyTableData,
        theme: 'grid',
        headStyles: { fillColor: [0, 106, 255] }, // Primary color
    });

    finalY = doc.lastAutoTable.finalY + 15;

    // 2. Product Monthly Breakdown
    doc.text("Product Monthly Breakdown", 14, finalY);

    const productTableData = [];
    sortedMonths.forEach(month => {
        // Add Month Header Row
        // productTableData.push([{ content: month, colSpan: 2, styles: { fontStyle: 'bold', fillColor: [240, 240, 240] } }]);

        const productsInMonth = productBreakdown[month];
        Object.entries(productsInMonth).forEach(([prodName, amount]) => {
            productTableData.push([month, prodName, `Rs ${amount}`]);
        });
    });

    doc.autoTable({
        startY: finalY + 5,
        head: [['Month', 'Product', 'Revenue']],
        body: productTableData,
        theme: 'striped',
        headStyles: { fillColor: [68, 138, 255] },
        columnStyles: {
            0: { fontStyle: 'bold' }
        }
    });

    finalY = doc.lastAutoTable.finalY + 15;

    // 3. Product Days Breakdown
    doc.text("Product Days Breakdown", 14, finalY);

    const durationTableData = Object.entries(productDurationTotals)
        .sort((a, b) => b[1] - a[1]) // Sort by duration desc
        .map(([name, ms]) => {
            const totalHrs = Math.floor(ms / (1000 * 60 * 60));
            const dDays = Math.floor(totalHrs / 24);
            const dHours = totalHrs % 24;
            return [name, `${dDays}d ${dHours}h`];
        });

    doc.autoTable({
        startY: finalY + 5,
        head: [['Product', 'Total Duration']],
        body: durationTableData,
        theme: 'striped',
        headStyles: { fillColor: [0, 150, 136] }, // Different color (Teal)
    });

    // Save
    doc.save(`Earnings_Report_${new Date().toISOString().split('T')[0]}.pdf`);
};

// --- Proof Viewing ---

window.viewProof = (dataUrl, name) => {
    modalImg.src = dataUrl;
    modalCaption.textContent = name;
    imageModal.classList.remove('hidden');
}

window.downloadProof = (dataUrl, name) => {
    const link = document.createElement('a');
    link.href = dataUrl;
    link.download = name || 'proof-of-id';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

// Modal Close Logic
closeModal.onclick = () => { imageModal.classList.add('hidden'); }
imageModal.onclick = (e) => {
    if (e.target === imageModal) imageModal.classList.add('hidden');
}


// --- Settings Logic ---

addRateForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const name = document.getElementById('new-product-name').value;
    const rate = Number(document.getElementById('new-product-rate').value);

    if (name && rate) {
        products.push({ name, rate });
        localStorage.setItem('zillow_products', JSON.stringify(products));
        renderSettings();
        renderProducts(); // Update dropdown
        addRateForm.reset();
    }
});

// --- Alarm / Reminder System ---

let alertedOrders = JSON.parse(localStorage.getItem('zillow_alerted_orders')) || [];

function startAlarmClock() {
    setInterval(() => {
        const now = new Date();
        orders.forEach(order => {
            if (order.status === 'completed') return; // Don't alert completed

            const end = new Date(order.endDate);
            if (end <= now && !alertedOrders.includes(order.id)) {
                // Trigger Alert
                alert(`Reminder: Rental for ${order.productName} by ${order.userName} has ended!`);

                // Track alerted to avoid spam
                alertedOrders.push(order.id);
                localStorage.setItem('zillow_alerted_orders', JSON.stringify(alertedOrders));

                renderOrders();
            }
        });
    }, 10000); // Check every 10 seconds
}

// --- Enhanced Calendar Logic ---

window.changeMonth = (offset) => {
    currentCalDate.setMonth(currentCalDate.getMonth() + offset);
    renderCalendar();
    document.getElementById('cal-selected-orders').innerHTML = ''; // clear details
}

function renderCalendar() {
    const grid = document.getElementById('calendar-grid');
    const monthYearEl = document.getElementById('cal-month-year');

    // Set Header
    monthYearEl.textContent = currentCalDate.toLocaleString('default', { month: 'long', year: 'numeric' });

    grid.innerHTML = '';
    grid.className = 'calendar-grid';

    const currentMonth = currentCalDate.getMonth();
    const currentYear = currentCalDate.getFullYear();

    const firstDay = new Date(currentYear, currentMonth, 1).getDay();
    const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();

    // Headers
    ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].forEach(d => {
        const h = document.createElement('div');
        h.className = 'cal-day-header';
        h.textContent = d;
        grid.appendChild(h);
    });

    // Empty cells
    for (let i = 0; i < firstDay; i++) {
        grid.appendChild(document.createElement('div'));
    }

    // Days
    for (let d = 1; d <= daysInMonth; d++) {
        const cell = document.createElement('div');
        cell.className = 'cal-day';
        cell.textContent = d;

        const dateStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;

        // Identify Sunday
        const dateObj = new Date(currentYear, currentMonth, d);
        if (dateObj.getDay() === 0) {
            cell.classList.add('sunday');
        }

        // Highlight Today
        const now = new Date();
        if (d === now.getDate() && currentMonth === now.getMonth() && currentYear === now.getFullYear()) {
            cell.classList.add('today');
        }

        // Highlight Selected
        if (selectedDateStr === dateStr) {
            cell.classList.add('selected');
        }

        // Check for Events
        // We want to show indicator if ANY order covers this day
        // Cover = startDate <= day AND endDate >= day
        // Need to parse range carefully
        const dayStart = new Date(currentYear, currentMonth, d, 0, 0, 0).getTime();
        const dayEnd = new Date(currentYear, currentMonth, d, 23, 59, 59).getTime();

        const dayOrders = orders.filter(o => {
            const os = new Date(o.startDate).getTime();
            const oe = new Date(o.endDate).getTime();
            return (os <= dayEnd && oe >= dayStart);
        });

        if (dayOrders.length > 0) {
            cell.classList.add('has-event');
            // If all are completed, use different color
            if (dayOrders.every(o => o.status === 'completed')) {
                cell.classList.add('has-event-completed');
            }
        }

        // Click Handler
        cell.addEventListener('click', () => {
            // Update Selected UI
            document.querySelectorAll('.cal-day').forEach(c => c.classList.remove('selected'));
            cell.classList.add('selected');
            selectedDateStr = dateStr;

            renderCalendarDetails(dayOrders, d, currentMonth, currentYear);
        });

        grid.appendChild(cell);
    }
}

function renderCalendarDetails(dayOrders, day, month, year) {
    const container = document.getElementById('cal-selected-orders');
    container.innerHTML = '';

    if (dayOrders.length === 0) {
        container.innerHTML = `<p style="color:var(--text-secondary); padding:10px;">No rentals on ${day}/${month + 1}/${year}</p>`;
        return;
    }

    dayOrders.forEach(order => {
        const item = document.createElement('div');
        const isActive = order.status !== 'completed';
        item.className = `cal-order-item ${isActive ? 'active' : 'completed'}`;

        item.innerHTML = `
            <div class="cal-order-info">
                <div class="cal-order-title">${order.productName}</div>
                <div class="cal-order-sub">${order.userName}</div>
            </div>
            <div class="cal-order-sub">
                ${isActive ? 'Active' : 'Done'}
            </div>
        `;
        container.appendChild(item);
    });
}

window.quickEditPrice = (id) => {
    const order = orders.find(o => o.id === id);
    if (!order) return;

    const currentVal = order.manualCost || "";
    const input = prompt("Enter new Total Amount (₹):\nLeave empty to reset to auto-calculation.", currentVal);

    if (input === null) return; // Cancelled

    if (input.trim() === "") {
        delete order.manualCost; // Reset
    } else {
        const val = parseFloat(input);
        if (!isNaN(val)) {
            order.manualCost = val.toString();
        } else {
            alert("Invalid number");
            return;
        }
    }

    localStorage.setItem('zillow_orders', JSON.stringify(orders));
    renderOrders();
    renderEarnings();
    if (typeof renderCompletedOrders === 'function') renderCompletedOrders();
}

// --- Settings Navigation ---
document.addEventListener('DOMContentLoaded', () => {
    const settingsBtn = document.getElementById('settings-btn');
    if (settingsBtn) {
        settingsBtn.addEventListener('click', () => {
            // Hide all views
            const views = document.querySelectorAll('.view');
            views.forEach(view => view.classList.remove('active'));

            // Show Settings
            const settingsView = document.getElementById('app-settings');
            if (settingsView) settingsView.classList.add('active');

            // Deselect Bottom Nav
            const navItems = document.querySelectorAll('.nav-item');
            navItems.forEach(nav => nav.classList.remove('active'));
        });
    }
});
