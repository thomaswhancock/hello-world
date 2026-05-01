const DEFAULT_TICKERS = ['AAPL', 'MSFT', 'GOOGL', 'AMZN', 'TSLA'];
const STORAGE_KEY_TICKERS = 'dashboard_tickers';
const STORAGE_KEY_APIKEY  = 'finnhub_api_key';
const REFRESH_INTERVAL_MS = 30000;

let tickers = [];
let apiKey   = '';
let refreshTimer = null;

// ── DOM refs ──────────────────────────────────────────────────────────────────
const stockGrid     = document.getElementById('stockGrid');
const apiKeyBanner  = document.getElementById('apiKeyBanner');
const apiKeyInput   = document.getElementById('apiKeyInput');
const saveKeyBtn    = document.getElementById('saveKeyBtn');
const tickerInput   = document.getElementById('tickerInput');
const addStockBtn   = document.getElementById('addStockBtn');
const addError      = document.getElementById('addError');
const refreshBtn    = document.getElementById('refreshBtn');
const lastUpdated   = document.getElementById('lastUpdated');

// ── Init ──────────────────────────────────────────────────────────────────────
function init() {
  apiKey  = localStorage.getItem(STORAGE_KEY_APIKEY) || '';
  tickers = JSON.parse(localStorage.getItem(STORAGE_KEY_TICKERS) || 'null') || [...DEFAULT_TICKERS];

  if (apiKey) {
    apiKeyBanner.classList.add('hidden');
  } else {
    apiKeyInput.value = '';
  }

  renderCards();
  fetchAll();
  scheduleRefresh();
}

// ── Persistence ───────────────────────────────────────────────────────────────
function saveTickers() {
  localStorage.setItem(STORAGE_KEY_TICKERS, JSON.stringify(tickers));
}

// ── API ───────────────────────────────────────────────────────────────────────
async function fetchQuote(symbol) {
  const url = `https://finnhub.io/api/v1/quote?symbol=${encodeURIComponent(symbol)}&token=${encodeURIComponent(apiKey)}`;
  const res  = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  if (data.c === 0 && data.pc === 0) throw new Error('Unknown symbol');
  return data;
}

async function fetchAll() {
  if (!apiKey) return;
  refreshBtn.disabled = true;
  await Promise.all(tickers.map(t => fetchAndUpdate(t)));
  refreshBtn.disabled = false;
  lastUpdated.textContent = `Updated ${new Date().toLocaleTimeString()}`;
}

async function fetchAndUpdate(symbol) {
  setCardLoading(symbol, true);
  try {
    const data = await fetchQuote(symbol);
    updateCard(symbol, data);
  } catch (e) {
    setCardError(symbol, e.message);
  }
}

// ── Rendering ─────────────────────────────────────────────────────────────────
function renderCards() {
  stockGrid.innerHTML = '';
  tickers.forEach(t => stockGrid.appendChild(createCard(t)));
}

function createCard(symbol) {
  const card = document.createElement('div');
  card.className = 'stock-card loading';
  card.dataset.symbol = symbol;
  card.innerHTML = `
    <button class="stock-remove" title="Remove" data-symbol="${symbol}">&times;</button>
    <div class="stock-ticker">${symbol}</div>
    <div class="stock-price">—</div>
    <div class="stock-change muted">Loading…</div>
    <div class="stock-meta"></div>
  `;
  card.querySelector('.stock-remove').addEventListener('click', () => removeStock(symbol));
  return card;
}

function updateCard(symbol, data) {
  const card = stockGrid.querySelector(`[data-symbol="${symbol}"]`);
  if (!card) return;

  const change  = data.d ?? 0;
  const changePct = data.dp ?? 0;
  const dir     = change >= 0 ? 'up' : 'down';
  const sign    = change >= 0 ? '+' : '';

  card.className = `stock-card ${dir}`;
  card.querySelector('.stock-price').textContent  = `$${data.c.toFixed(2)}`;
  card.querySelector('.stock-change').textContent = `${sign}${change.toFixed(2)} (${sign}${changePct.toFixed(2)}%)`;
  card.querySelector('.stock-change').className   = `stock-change ${dir}`;
  card.querySelector('.stock-meta').innerHTML     = `
    <span>Open</span>   <span>$${data.o.toFixed(2)}</span>
    <span>High</span>   <span>$${data.h.toFixed(2)}</span>
    <span>Low</span>    <span>$${data.l.toFixed(2)}</span>
    <span>Prev</span>   <span>$${data.pc.toFixed(2)}</span>
  `;
}

function setCardLoading(symbol, loading) {
  const card = stockGrid.querySelector(`[data-symbol="${symbol}"]`);
  if (!card) return;
  if (loading) card.classList.add('loading');
  else card.classList.remove('loading');
}

function setCardError(symbol, msg) {
  const card = stockGrid.querySelector(`[data-symbol="${symbol}"]`);
  if (!card) return;
  card.className = 'stock-card error-card';
  card.querySelector('.stock-price').textContent  = '—';
  card.querySelector('.stock-change').textContent = '';
  card.querySelector('.stock-meta').innerHTML     = `<span class="stock-error">${msg}</span>`;
}

// ── Add / Remove ──────────────────────────────────────────────────────────────
function addStock(symbol) {
  symbol = symbol.trim().toUpperCase();
  addError.textContent = '';

  if (!symbol) return;
  if (tickers.includes(symbol)) {
    addError.textContent = `${symbol} is already on the dashboard.`;
    return;
  }

  tickers.push(symbol);
  saveTickers();
  stockGrid.appendChild(createCard(symbol));
  fetchAndUpdate(symbol);
  tickerInput.value = '';
}

function removeStock(symbol) {
  tickers = tickers.filter(t => t !== symbol);
  saveTickers();
  const card = stockGrid.querySelector(`[data-symbol="${symbol}"]`);
  if (card) card.remove();
}

// ── Auto-refresh ──────────────────────────────────────────────────────────────
function scheduleRefresh() {
  clearInterval(refreshTimer);
  refreshTimer = setInterval(fetchAll, REFRESH_INTERVAL_MS);
}

// ── Event listeners ───────────────────────────────────────────────────────────
saveKeyBtn.addEventListener('click', () => {
  const key = apiKeyInput.value.trim();
  if (!key) return;
  apiKey = key;
  localStorage.setItem(STORAGE_KEY_APIKEY, key);
  apiKeyBanner.classList.add('hidden');
  fetchAll();
});

refreshBtn.addEventListener('click', () => {
  fetchAll();
  scheduleRefresh();
});

addStockBtn.addEventListener('click', () => addStock(tickerInput.value));

tickerInput.addEventListener('keydown', e => {
  if (e.key === 'Enter') addStock(tickerInput.value);
});

// ── Start ─────────────────────────────────────────────────────────────────────
init();
