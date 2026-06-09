// App State
const state = {
    isAuthenticated: false,
    data: [],
    hierarchy: {},
    selections: {
        year: '',
        make: '',
        model: ''
    }
};

// DOM Elements
const views = {
    auth: document.getElementById('auth-view'),
    dashboard: document.getElementById('dashboard-view')
};

const auth = {
    form: document.getElementById('login-form'),
    input: document.getElementById('password-input'),
    error: document.getElementById('login-error')
};

const selects = {
    year: document.getElementById('year-select'),
    make: document.getElementById('make-select'),
    model: document.getElementById('model-select')
};

const resultsContainer = document.getElementById('results-container');
const logoutBtn = document.getElementById('logout-btn');

// Initialization
async function init() {
    checkAuth();
    auth.form.addEventListener('submit', handleLogin);
    logoutBtn.addEventListener('click', handleLogout);

    if (state.isAuthenticated) {
        await loadData();
    }
}

// Authentication
function checkAuth() {
    const isAuth = sessionStorage.getItem('dify_auth') === 'true';
    if (isAuth) {
        state.isAuthenticated = true;
        showView('dashboard');
    } else {
        showView('auth');
    }
}

async function handleLogin(e) {
    e.preventDefault();
    const pw = auth.input.value.trim();
    // Simple frontend gate
    if (pw === 'battery123' || pw === 'admin') {
        sessionStorage.setItem('dify_auth', 'true');
        state.isAuthenticated = true;
        auth.error.textContent = '';
        auth.input.value = '';
        showView('dashboard');
        await loadData();
    } else {
        auth.error.textContent = 'Invalid access code';
    }
}

function handleLogout() {
    sessionStorage.removeItem('dify_auth');
    state.isAuthenticated = false;
    showView('auth');
    // reset dashboard
    resultsContainer.classList.add('hidden');
    selects.year.value = '';
    state.selections = { year: '', make: '', model: '' };
    resetDropdownsFrom('make');
}

function showView(viewName) {
    Object.values(views).forEach(v => v.classList.remove('active'));
    views[viewName].classList.add('active');
}

// Data Handling
async function loadData() {
    try {
        const response = await fetch('data.json');
        const rawData = await response.json();
        
        state.data = rawData;
        buildHierarchy();
        setupEventListeners();
        populateYears();
        
    } catch (error) {
        console.error("Failed to load data", error);
        alert("Failed to load battery database: " + error.message + " | " + error.stack);
    }
}

function buildHierarchy() {
    // Structure: year -> make -> model -> [rows]
    const h = {};
    
    state.data.forEach(row => {
        const y = row.Year;
        const mk = row.Make;
        const md = row.Model;
        
        if (!y || !mk || !md) return; // skip malformed
        
        if (!h[y]) h[y] = {};
        if (!h[y][mk]) h[y][mk] = {};
        if (!h[y][mk][md]) h[y][mk][md] = [];
        
        h[y][mk][md].push(row);
    });
    
    state.hierarchy = h;
}

// UI Population
function populateYears() {
    const years = Object.keys(state.hierarchy).sort((a, b) => b - a); // Descending
    
    selects.year.innerHTML = '<option value="">Select Year...</option>';
    years.forEach(y => {
        const opt = document.createElement('option');
        opt.value = y;
        opt.textContent = y;
        selects.year.appendChild(opt);
    });
    
    selects.year.disabled = false;
}

function populateMakes(year) {
    if (!year) return resetDropdownsFrom('make');
    
    const makes = Object.keys(state.hierarchy[year]).sort();
    
    selects.make.innerHTML = '<option value="">Select Make...</option>';
    makes.forEach(mk => {
        const opt = document.createElement('option');
        opt.value = mk;
        opt.textContent = mk;
        selects.make.appendChild(opt);
    });
    
    selects.make.disabled = false;
    selects.make.focus();
    
    resetDropdownsFrom('model');
    resultsContainer.classList.add('hidden');
}

function populateModels(make) {
    const { year } = state.selections;
    if (!make || !year) return resetDropdownsFrom('model');
    
    const models = Object.keys(state.hierarchy[year][make]).sort();
    
    selects.model.innerHTML = '<option value="">Select Model...</option>';
    models.forEach(md => {
        const opt = document.createElement('option');
        opt.value = md;
        opt.textContent = md;
        selects.model.appendChild(opt);
    });
    
    selects.model.disabled = false;
    selects.model.focus();
    
    resultsContainer.classList.add('hidden');
}

function resetDropdownsFrom(level) {
    if (level === 'make') {
        selects.make.innerHTML = '<option value="">Select Year First</option>';
        selects.make.disabled = true;
        selects.model.innerHTML = '<option value="">Select Make First</option>';
        selects.model.disabled = true;
    } else if (level === 'model') {
        selects.model.innerHTML = '<option value="">Select Make First</option>';
        selects.model.disabled = true;
    }
}

// Event Listeners
function setupEventListeners() {
    selects.year.addEventListener('change', (e) => {
        state.selections.year = e.target.value;
        populateMakes(state.selections.year);
    });
    
    selects.make.addEventListener('change', (e) => {
        state.selections.make = e.target.value;
        populateModels(state.selections.make);
    });
    
    selects.model.addEventListener('change', (e) => {
        state.selections.model = e.target.value;
        if (state.selections.model) {
            displayAllResults();
        } else {
            resultsContainer.classList.add('hidden');
        }
    });
    
    // Add event delegation for click-to-copy
    resultsContainer.addEventListener('click', (e) => {
        const batterySizeElem = e.target.closest('.battery-size');
        if (batterySizeElem) {
            const textToCopy = batterySizeElem.textContent.trim();
            if (textToCopy === 'Copied!' || textToCopy === 'Check Manual') return;
            navigator.clipboard.writeText(textToCopy).then(() => {
                const originalText = textToCopy;
                batterySizeElem.textContent = 'Copied!';
                batterySizeElem.classList.add('copied');
                setTimeout(() => {
                    batterySizeElem.textContent = originalText;
                    batterySizeElem.classList.remove('copied');
                }, 1500);
            }).catch(err => {
                console.error('Failed to copy', err);
            });
        }
    });
}

// Rendering
function displayAllResults() {
    const { year, make, model } = state.selections;
    const rows = state.hierarchy[year][make][model];
    
    if (!rows || rows.length === 0) {
        resultsContainer.innerHTML = '<p>No data found.</p>';
        resultsContainer.classList.remove('hidden');
        return;
    }

    // Check if all trims use the exact same battery
    const firstBattery = rows[0].Battery;
    const isSameBattery = rows.every(r => r.Battery === firstBattery);
    
    let html = '';
    
    if (isSameBattery && rows.length > 1) {
        html += `
            <div class="glass-card success-alert" style="margin-bottom: 20px; text-align: center; border-left: 4px solid var(--primary-color);">
                <h3 style="margin:0; color: var(--text-color);">All Trims/Engines Use The Same Battery</h3>
                <p style="margin: 5px 0 0 0; opacity: 0.8;">No matter the variation, the required battery is identical.</p>
            </div>
        `;
    }

    html += `<div class="battery-results-grid">`;

    rows.forEach(row => {
        const { Battery, Location, Reset, Aux, Difficult, Notes, AGM, 'Start-Stop': StartStop, Hybrid, Difference, Diesel, Engine } = row;
        
        let badgesHtml = '';
        
        let diffText = Difference || '';
        if (Diesel === 'Yes' || Diesel === 'Y') diffText = diffText ? diffText + ' / Diesel' : 'Diesel';
        if (Hybrid === 'Yes' || Hybrid === 'Y') diffText = diffText ? diffText + ' / Hybrid' : 'Hybrid';

        if (diffText) {
            badgesHtml += `<div class="badge primary-badge" style="background: rgba(46, 204, 113, 0.2); color: #2ecc71; border: 1px solid rgba(46, 204, 113, 0.3);"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2v20"/><path d="m17 5-5-3-5 3"/><path d="m7 19 5 3 5-3"/></svg> ${diffText}</div>`;
        }
        
        if (AGM) {
            badgesHtml += `<div class="badge agm"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg> AGM: ${AGM}</div>`;
        }
        
        if (Location) {
            badgesHtml += `<div class="badge location"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg> Loc: ${Location}</div>`;
        }
        
        if (Difficult) {
            badgesHtml += `<div class="badge difficult"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg> Difficult Install: ${Difficult}</div>`;
        }
        
        if (Reset) {
            badgesHtml += `<div class="badge note"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg> Reset Required: ${Reset}</div>`;
        }
        
        if (Aux) {
            badgesHtml += `<div class="badge aux"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="7" width="20" height="11" rx="2" ry="2"/><line x1="22" y1="11" x2="22" y2="13"/></svg> Aux Battery: ${Aux}</div>`;
        }
        
        if (StartStop) {
            badgesHtml += `<div class="badge note">Start-Stop: ${StartStop}</div>`;
        }
        
        if (Notes) {
            badgesHtml += `<div class="badge note">Note: ${Notes}</div>`;
        }
        
        const engineDesc = Engine || 'All Engines / Standard';

        html += `
            <div class="glass-card battery-result-card" style="margin-bottom: 15px;">
                <div class="engine-title" style="font-weight: 600; font-size: 1.1rem; margin-bottom: 8px;">${engineDesc}</div>
                <div class="battery-label">Required Battery Size (Click to Copy)</div>
                <div class="battery-size clickable-battery" title="Click to copy">${Battery || 'Check Manual'}</div>
                <div class="vehicle-info">${year} ${make} ${model}</div>
                
                ${badgesHtml ? `<div class="badges-container">${badgesHtml}</div>` : ''}
            </div>
        `;
    });

    html += `</div>`;
    
    resultsContainer.innerHTML = html;
    resultsContainer.classList.remove('hidden');
    
    // Smooth scroll to results on mobile
    if (window.innerWidth < 768) {
        resultsContainer.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
}

// Start App
document.addEventListener('DOMContentLoaded', init);
