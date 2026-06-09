// App State
const state = {
    isAuthenticated: false,
    data: [],
    hierarchy: {},
    selections: {
        year: '',
        make: '',
        model: '',
        engine: ''
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
    model: document.getElementById('model-select'),
    engine: document.getElementById('engine-select')
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
    state.selections = { year: '', make: '', model: '', engine: '' };
    updateDropdowns();
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
        alert("Failed to load battery database.");
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
    
    resetDropdownsFrom('engine');
    resultsContainer.classList.add('hidden');
}

function populateEngines(model) {
    const { year, make } = state.selections;
    if (!model || !year || !make) return resetDropdownsFrom('engine');
    
    const rows = state.hierarchy[year][make][model];
    
    selects.engine.innerHTML = '<option value="">Select Engine/Trim...</option>';
    
    let hasValidEngines = false;
    
    rows.forEach((row, index) => {
        const engineDesc = row.Engine || row.Notes || 'All Engines / Standard';
        if (engineDesc) hasValidEngines = true;
        const opt = document.createElement('option');
        opt.value = index; // Use index to reference the exact row later
        opt.textContent = engineDesc;
        selects.engine.appendChild(opt);
    });
    
    selects.engine.disabled = false;
    
    // Auto-select if there's only one option
    if (rows.length === 1) {
        selects.engine.value = 0;
        handleEngineChange({ target: { value: 0 } });
    } else {
        selects.engine.focus();
        resultsContainer.classList.add('hidden');
    }
}

function resetDropdownsFrom(level) {
    if (level === 'make') {
        selects.make.innerHTML = '<option value="">Select Year First</option>';
        selects.make.disabled = true;
        selects.model.innerHTML = '<option value="">Select Make First</option>';
        selects.model.disabled = true;
        selects.engine.innerHTML = '<option value="">Select Model First</option>';
        selects.engine.disabled = true;
    } else if (level === 'model') {
        selects.model.innerHTML = '<option value="">Select Make First</option>';
        selects.model.disabled = true;
        selects.engine.innerHTML = '<option value="">Select Model First</option>';
        selects.engine.disabled = true;
    } else if (level === 'engine') {
        selects.engine.innerHTML = '<option value="">Select Model First</option>';
        selects.engine.disabled = true;
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
        populateEngines(state.selections.model);
    });
    
    selects.engine.addEventListener('change', handleEngineChange);
}

function handleEngineChange(e) {
    state.selections.engine = e.target.value;
    
    if (state.selections.engine === '') {
        resultsContainer.classList.add('hidden');
        return;
    }
    
    const { year, make, model, engine } = state.selections;
    const row = state.hierarchy[year][make][model][engine];
    
    displayResult(row);
}

// Rendering
function displayResult(row) {
    const { Battery, Location, Reset, Aux, Difficult, Notes, AGM, 'Start-Stop': StartStop, Hybrid } = row;
    
    let badgesHtml = '';
    
    if (Location) {
        badgesHtml += `<div class="badge location"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg> Loc: ${Location}</div>`;
    }
    
    if (AGM && AGM.toLowerCase() === 'yes') {
        badgesHtml += `<div class="badge agm"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg> AGM Recommended</div>`;
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
    
    if (Hybrid) {
        badgesHtml += `<div class="badge note">Hybrid: ${Hybrid}</div>`;
    }
    
    if (Notes) {
        badgesHtml += `<div class="badge note">Note: ${Notes}</div>`;
    }

    const html = `
        <div class="glass-card battery-result-card">
            <div class="battery-label">Required Battery Size</div>
            <div class="battery-size">${Battery || 'Check Manual'}</div>
            <div class="vehicle-info">${state.selections.year} ${state.selections.make} ${state.selections.model}</div>
            
            ${badgesHtml ? `<div class="badges-container">${badgesHtml}</div>` : ''}
        </div>
    `;
    
    resultsContainer.innerHTML = html;
    resultsContainer.classList.remove('hidden');
    
    // Smooth scroll to results on mobile
    if (window.innerWidth < 768) {
        resultsContainer.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
}

// Start App
document.addEventListener('DOMContentLoaded', init);
