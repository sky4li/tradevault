/* ═══════════════════════════════════════════
   TRADEVAULT — script.js
   Full app logic: Auth, Journal, Dashboard,
   Calendar, Accounts, Risk Tools, Settings
═══════════════════════════════════════════ */

/* ── CONFIG: Replace with your Supabase credentials ── */
const SUPABASE_URL = https://xwpxhucapgichdcazpay.supabase.co;
const SUPABASE_ANON_KEY = eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh3cHhodWNhcGdpY2hkY2F6cGF5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgwNDkxNjksImV4cCI6MjA5MzYyNTE2OX0.xSscCqW8coYMQo3kTGv4i0kcMXTSec9o892TZEnrSbE;

const { createClient } = supabase;
const sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

/* ── STATE ── */
let currentUser = null;
let trades = [];
let accounts = [];
let transfers = [];
let charts = {};
let calendarDate = new Date();
let editingTradeId = null;
let editingAccountId = null;

/* ══════════════════════════════════════════
   INIT
══════════════════════════════════════════ */
document.addEventListener('DOMContentLoaded', async () => {
  applyTheme();
  setupModalClosers();
  setupNavigation();
  setupSidebar();
  setupAuthTabs();
  setupRiskTools();
  setupCalendarNav();
  setupTransferTypeToggle();

 enterApp();
});

/* ══════════════════════════════════════════
   THEME
══════════════════════════════════════════ */
function applyTheme() {
  const saved = localStorage.getItem('theme') || 'dark';
  document.documentElement.setAttribute('data-theme', saved);
  const cb = document.getElementById('theme-checkbox');
  if (cb) cb.checked = saved === 'light';
}

function toggleTheme() {
  const current = document.documentElement.getAttribute('data-theme');
  const next = current === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', next);
  localStorage.setItem('theme', next);
  const cb = document.getElementById('theme-checkbox');
  if (cb) cb.checked = next === 'light';
  rebuildCharts();
}

document.getElementById('theme-toggle').addEventListener('click', toggleTheme);
document.getElementById('theme-checkbox')?.addEventListener('change', toggleTheme);



/* ══════════════════════════════════════════
   NAVIGATION
══════════════════════════════════════════ */
function setupNavigation() {
  document.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', e => {
      e.preventDefault();
      const page = item.dataset.page;
      navigateTo(page);
      if (window.innerWidth <= 768) closeSidebar();
    });
  });
  document.getElementById('add-trade-btn').addEventListener('click', () => openTradeModal());
}

function navigateTo(page) {
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  document.querySelector(`[data-page="${page}"]`)?.classList.add('active');
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.getElementById(`page-${page}`)?.classList.add('active');
  const titles = { dashboard: 'Dashboard', journal: 'Trade Journal', calendar: 'Calendar', accounts: 'Accounts', risk: 'Risk Tools', settings: 'Settings' };
  document.getElementById('page-title').textContent = titles[page] || page;

  if (page === 'dashboard') renderDashboard();
  if (page === 'calendar') renderCalendar();
  if (page === 'accounts') renderAccounts();
}

/* ══════════════════════════════════════════
   SIDEBAR
══════════════════════════════════════════ */
function setupSidebar() {
  document.getElementById('menu-btn').addEventListener('click', () => {
    document.getElementById('sidebar').classList.add('open');
  });
  document.getElementById('sidebar-close').addEventListener('click', closeSidebar);
}
function closeSidebar() {
  document.getElementById('sidebar').classList.remove('open');
}

/* ══════════════════════════════════════════
   MODAL HELPERS
══════════════════════════════════════════ */
function setupModalClosers() {
  document.querySelectorAll('[data-modal]').forEach(btn => {
    btn.addEventListener('click', () => closeModal(btn.dataset.modal));
  });
  document.querySelectorAll('.modal-overlay').forEach(overlay => {
    overlay.addEventListener('click', e => {
      if (e.target === overlay) closeModal(overlay.id);
    });
  });
}
function openModal(id) {
  document.getElementById(id)?.classList.remove('hidden');
}
function closeModal(id) {
  document.getElementById(id)?.classList.add('hidden');
}

/* ══════════════════════════════════════════
   DATA LOADING
══════════════════════════════════════════ */
async function loadData() {
  if (!currentUser) return;
  await Promise.all([loadTrades(), loadAccounts(), loadTransfers()]);
  populateAccountSelects();
  renderTrades();
  renderDashboard();
}

async function loadTrades() {
  const { data, error } = await sb.from('trades')
    .select('*')
    .eq('user_id', currentUser.id)
    .order('date', { ascending: false });
  if (!error) trades = data || [];
}

async function loadAccounts() {
  const { data, error } = await sb.from('accounts')
    .select('*')
    .eq('user_id', currentUser.id)
    .order('created_at', { ascending: true });
  if (!error) accounts = data || [];
}

async function loadTransfers() {
  const { data, error } = await sb.from('transfers')
    .select('*')
    .eq('user_id', currentUser.id)
    .order('created_at', { ascending: false });
  if (!error) transfers = data || [];
}

/* ══════════════════════════════════════════
   TRADE MODAL
══════════════════════════════════════════ */
function openTradeModal(trade = null) {
  editingTradeId = trade?.id || null;
  document.getElementById('trade-modal-title').textContent = trade ? 'Edit Trade' : 'New Trade';
  document.getElementById('trade-id').value = trade?.id || '';

  // Set defaults
  const now = new Date();
  now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
  document.getElementById('t-date').value = trade?.date ? trade.date.slice(0, 16) : now.toISOString().slice(0, 16);
  document.getElementById('t-account').value = trade?.account_id || '';
  document.getElementById('t-pair').value = trade?.pair || '';
  document.getElementById('t-session').value = trade?.session || 'London';
  document.getElementById('t-direction').value = trade?.direction || 'Buy';
  document.getElementById('t-result').value = trade?.result || 'Win';
  document.getElementById('t-entry').value = trade?.entry_price || '';
  document.getElementById('t-sl').value = trade?.stop_loss || '';
  document.getElementById('t-tp').value = trade?.take_profit || '';
  document.getElementById('t-risk-pct').value = trade?.risk_pct || '';
  document.getElementById('t-lot').value = trade?.lot_size || '';
  document.getElementById('t-rr').value = trade?.rr_ratio || '';
  document.getElementById('t-pnl').value = trade?.pnl || '';
  document.getElementById('t-notes').value = trade?.notes || '';
  document.getElementById('t-emotion-before').value = trade?.emotion_before || 'Calm';
  document.getElementById('t-emotion-after').value = trade?.emotion_after || 'Satisfied';

  const setup = trade?.setup_checklist || {};
  document.getElementById('ck-trend').checked = setup.trend || false;
  document.getElementById('ck-structure').checked = setup.structure || false;
  document.getElementById('ck-entry').checked = setup.entry || false;
  document.getElementById('ck-session').checked = setup.session || false;
  document.getElementById('ck-news').checked = setup.news || false;

  const mistakes = trade?.mistake_checklist || {};
  document.getElementById('mk-early').checked = mistakes.early || false;
  document.getElementById('mk-revenge').checked = mistakes.revenge || false;
  document.getElementById('mk-oversize').checked = mistakes.oversize || false;
  document.getElementById('mk-moved-sl').checked = mistakes.moved_sl || false;
  document.getElementById('mk-fomo').checked = mistakes.fomo || false;

  // Screenshots
  const beforePrev = document.getElementById('before-preview');
  const afterPrev = document.getElementById('after-preview');
  beforePrev.innerHTML = trade?.screenshot_before ? `<img src="${trade.screenshot_before}" />` : '';
  afterPrev.innerHTML = trade?.screenshot_after ? `<img src="${trade.screenshot_after}" />` : '';

  openModal('trade-modal');
}

document.getElementById('save-trade-btn').addEventListener('click', async () => {
  const pair = document.getElementById('t-pair').value.trim();
  const date = document.getElementById('t-date').value;
  const accountId = document.getElementById('t-account').value;

  if (!pair || !date) return showToast('Pair and date are required', 'error');

  const setup_checklist = {
    trend: document.getElementById('ck-trend').checked,
    structure: document.getElementById('ck-structure').checked,
    entry: document.getElementById('ck-entry').checked,
    session: document.getElementById('ck-session').checked,
    news: document.getElementById('ck-news').checked
  };
  const mistake_checklist = {
    early: document.getElementById('mk-early').checked,
    revenge: document.getElementById('mk-revenge').checked,
    oversize: document.getElementById('mk-oversize').checked,
    moved_sl: document.getElementById('mk-moved-sl').checked,
    fomo: document.getElementById('mk-fomo').checked
  };

  const tradeData = {
    user_id: currentUser.id,
    account_id: accountId || null,
    date,
    pair: pair.toUpperCase(),
    session: document.getElementById('t-session').value,
    direction: document.getElementById('t-direction').value,
    result: document.getElementById('t-result').value,
    entry_price: parseFloat(document.getElementById('t-entry').value) || null,
    stop_loss: parseFloat(document.getElementById('t-sl').value) || null,
    take_profit: parseFloat(document.getElementById('t-tp').value) || null,
    risk_pct: parseFloat(document.getElementById('t-risk-pct').value) || null,
    lot_size: parseFloat(document.getElementById('t-lot').value) || null,
    rr_ratio: parseFloat(document.getElementById('t-rr').value) || null,
    pnl: parseFloat(document.getElementById('t-pnl').value) || null,
    notes: document.getElementById('t-notes').value.trim(),
    emotion_before: document.getElementById('t-emotion-before').value,
    emotion_after: document.getElementById('t-emotion-after').value,
    setup_checklist,
    mistake_checklist
  };

  // Handle screenshots
  const beforeFile = document.getElementById('t-before-screenshot').files[0];
  const afterFile = document.getElementById('t-after-screenshot').files[0];
  if (beforeFile) tradeData.screenshot_before = await uploadScreenshot(beforeFile);
  if (afterFile) tradeData.screenshot_after = await uploadScreenshot(afterFile);

  let error;
  if (editingTradeId) {
    ({ error } = await sb.from('trades').update(tradeData).eq('id', editingTradeId));
  } else {
    ({ error } = await sb.from('trades').insert(tradeData));
  }

  if (error) return showToast('Error saving trade: ' + error.message, 'error');

  showToast(editingTradeId ? 'Trade updated!' : 'Trade saved!', 'success');
  closeModal('trade-modal');
  await loadTrades();
  renderTrades();
  renderDashboard();
});

async function uploadScreenshot(file) {
  const ext = file.name.split('.').pop();
  const path = `${currentUser.id}/${Date.now()}.${ext}`;
  const { data, error } = await sb.storage.from('screenshots').upload(path, file);
  if (error) return null;
  const { data: { publicUrl } } = sb.storage.from('screenshots').getPublicUrl(path);
  return publicUrl;
}

async function deleteTrade(id) {
  if (!confirm('Delete this trade?')) return;
  const { error } = await sb.from('trades').delete().eq('id', id);
  if (error) return showToast('Error deleting trade', 'error');
  showToast('Trade deleted', 'info');
  await loadTrades();
  renderTrades();
  renderDashboard();
}

function viewTrade(id) {
  const t = trades.find(tr => tr.id === id);
  if (!t) return;
  const account = accounts.find(a => a.id === t.account_id);
  const pnlClass = t.pnl > 0 ? 'pnl-pos' : t.pnl < 0 ? 'pnl-neg' : '';
  const setup = t.setup_checklist || {};
  const mistakes = t.mistake_checklist || {};
  document.getElementById('view-trade-title').textContent = `${t.pair} — ${t.result}`;
  document.getElementById('view-trade-body').innerHTML = `
    <div class="trade-detail-grid">
      <div class="detail-item"><div class="detail-item-label">Date</div><div class="detail-item-value">${fmtDate(t.date)}</div></div>
      <div class="detail-item"><div class="detail-item-label">Pair</div><div class="detail-item-value">${t.pair}</div></div>
      <div class="detail-item"><div class="detail-item-label">Account</div><div class="detail-item-value">${account?.name || '—'}</div></div>
      <div class="detail-item"><div class="detail-item-label">Session</div><div class="detail-item-value">${t.session || '—'}</div></div>
      <div class="detail-item"><div class="detail-item-label">Direction</div><div class="detail-item-value"><span class="badge badge-${t.direction?.toLowerCase()}">${t.direction}</span></div></div>
      <div class="detail-item"><div class="detail-item-label">Result</div><div class="detail-item-value"><span class="badge badge-${t.result?.toLowerCase()}">${t.result}</span></div></div>
      <div class="detail-item"><div class="detail-item-label">Entry</div><div class="detail-item-value mono">${t.entry_price ?? '—'}</div></div>
      <div class="detail-item"><div class="detail-item-label">Stop Loss</div><div class="detail-item-value mono">${t.stop_loss ?? '—'}</div></div>
      <div class="detail-item"><div class="detail-item-label">Take Profit</div><div class="detail-item-value mono">${t.take_profit ?? '—'}</div></div>
      <div class="detail-item"><div class="detail-item-label">RR Ratio</div><div class="detail-item-value">${t.rr_ratio ? t.rr_ratio + 'R' : '—'}</div></div>
      <div class="detail-item"><div class="detail-item-label">Lot Size</div><div class="detail-item-value">${t.lot_size ?? '—'}</div></div>
      <div class="detail-item"><div class="detail-item-label">Risk %</div><div class="detail-item-value">${t.risk_pct ? t.risk_pct + '%' : '—'}</div></div>
      <div class="detail-item"><div class="detail-item-label">P&L</div><div class="detail-item-value ${pnlClass}">${t.pnl != null ? fmtCurrency(t.pnl) : '—'}</div></div>
      <div class="detail-item"><div class="detail-item-label">Emotion Before</div><div class="detail-item-value">${t.emotion_before || '—'}</div></div>
      <div class="detail-item"><div class="detail-item-label">Emotion After</div><div class="detail-item-value">${t.emotion_after || '—'}</div></div>
    </div>
    ${t.notes ? `<div class="detail-section-title">Notes</div><p style="font-size:0.9rem;color:var(--text-secondary);line-height:1.7">${t.notes}</p>` : ''}
    <div class="detail-section-title">Setup Checklist</div>
    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:8px;font-size:0.85rem">
      ${Object.entries(setup).map(([k,v]) => `<span style="color:${v?'var(--green)':'var(--text-muted)'}">${v?'✓':'✗'} ${k.charAt(0).toUpperCase()+k.slice(1)}</span>`).join('')}
    </div>
    <div class="detail-section-title">Mistake Checklist</div>
    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:8px;font-size:0.85rem">
      ${Object.entries(mistakes).map(([k,v]) => `<span style="color:${v?'var(--red)':'var(--text-muted)'}">${v?'✗':'✓'} ${k.charAt(0).toUpperCase()+k.slice(1).replace(/_/g,' ')}</span>`).join('')}
    </div>
    ${(t.screenshot_before || t.screenshot_after) ? `
    <div class="detail-section-title">Screenshots</div>
    <div class="detail-screenshots">
      ${t.screenshot_before ? `<div class="detail-screenshot-wrap"><label>Before Trade</label><img src="${t.screenshot_before}" onclick="window.open(this.src,'_blank')" /></div>` : ''}
      ${t.screenshot_after ? `<div class="detail-screenshot-wrap"><label>After Trade</label><img src="${t.screenshot_after}" onclick="window.open(this.src,'_blank')" /></div>` : ''}
    </div>` : ''}
  `;
  openModal('view-trade-modal');
}

/* ══════════════════════════════════════════
   RENDER TRADES TABLE
══════════════════════════════════════════ */
function renderTrades() {
  const search = document.getElementById('journal-search')?.value?.toLowerCase() || '';
  const filterResult = document.getElementById('journal-filter-result')?.value || '';
  const filterSession = document.getElementById('journal-filter-session')?.value || '';

  let filtered = trades.filter(t => {
    const matchSearch = !search || t.pair.toLowerCase().includes(search) || (t.notes || '').toLowerCase().includes(search);
    const matchResult = !filterResult || t.result === filterResult;
    const matchSession = !filterSession || t.session === filterSession;
    return matchSearch && matchResult && matchSession;
  });

  const tbody = document.getElementById('trades-body');
  if (!filtered.length) {
    tbody.innerHTML = `<tr class="empty-row"><td colspan="11">No trades found.</td></tr>`;
    return;
  }
  tbody.innerHTML = filtered.map(t => {
    const pnlClass = t.pnl > 0 ? 'pnl-pos' : t.pnl < 0 ? 'pnl-neg' : '';
    return `
    <tr>
      <td>${fmtDate(t.date)}</td>
      <td><strong>${t.pair}</strong></td>
      <td>${t.session || '—'}</td>
      <td><span class="badge badge-${t.direction?.toLowerCase()}">${t.direction || '—'}</span></td>
      <td class="mono">${t.entry_price ?? '—'}</td>
      <td class="mono">${t.stop_loss ?? '—'}</td>
      <td class="mono">${t.take_profit ?? '—'}</td>
      <td>${t.rr_ratio ? t.rr_ratio + 'R' : '—'}</td>
      <td class="${pnlClass}">${t.pnl != null ? fmtCurrency(t.pnl) : '—'}</td>
      <td><span class="badge badge-${t.result?.toLowerCase()}">${t.result || '—'}</span></td>
      <td>
        <div class="table-actions">
          <button class="btn-ghost btn-sm" onclick="viewTrade('${t.id}')">View</button>
          <button class="btn-ghost btn-sm" onclick="openTradeModal(trades.find(x=>x.id==='${t.id}'))">Edit</button>
          <button class="btn-danger btn-sm" onclick="deleteTrade('${t.id}')">Del</button>
        </div>
      </td>
    </tr>`;
  }).join('');
}

// Filters
['journal-search', 'journal-filter-result', 'journal-filter-session'].forEach(id => {
  document.getElementById(id)?.addEventListener('input', renderTrades);
  document.getElementById(id)?.addEventListener('change', renderTrades);
});

/* ══════════════════════════════════════════
   DASHBOARD
══════════════════════════════════════════ */
function getFilteredTrades() {
  const acctId = document.getElementById('dash-account-select')?.value;
  return acctId && acctId !== 'all' ? trades.filter(t => t.account_id === acctId) : trades;
}

function renderDashboard() {
  const t = getFilteredTrades();
  const wins = t.filter(x => x.result === 'Win');
  const losses = t.filter(x => x.result === 'Loss');
  const total = t.length;
  const winRate = total ? ((wins.length / total) * 100).toFixed(1) : 0;
  const netPnl = t.reduce((s, x) => s + (x.pnl || 0), 0);
  const grossWin = wins.reduce((s, x) => s + (x.pnl || 0), 0);
  const grossLoss = Math.abs(losses.reduce((s, x) => s + (x.pnl || 0), 0));
  const pf = grossLoss > 0 ? (grossWin / grossLoss).toFixed(2) : wins.length > 0 ? '∞' : '0.00';
  const avgRR = t.filter(x => x.rr_ratio).length ? (t.filter(x => x.rr_ratio).reduce((s, x) => s + (x.rr_ratio || 0), 0) / t.filter(x => x.rr_ratio).length).toFixed(2) : '0.00';
  const avgWin = wins.length ? (grossWin / wins.length) : 0;
  const avgLoss = losses.length ? (grossLoss / losses.length) : 0;
  const maxWin = wins.length ? Math.max(...wins.map(x => x.pnl || 0)) : 0;
  const maxLoss = losses.length ? Math.abs(Math.min(...losses.map(x => x.pnl || 0))) : 0;

  // Streaks
  let streak = 0, bestStreak = 0, tempStreak = 0;
  const sorted = [...t].sort((a, b) => new Date(a.date) - new Date(b.date));
  let lastResult = null;
  for (const tr of sorted) {
    if (tr.result === 'Win') {
      if (lastResult === 'Win') { tempStreak++; } else tempStreak = 1;
      bestStreak = Math.max(bestStreak, tempStreak);
    } else if (tr.result === 'Loss') {
      if (lastResult === 'Loss') { tempStreak++; } else tempStreak = 1;
    } else tempStreak = 0;
    lastResult = tr.result;
  }
  // Current streak
  let cur = 0, curType = '';
  for (let i = sorted.length - 1; i >= 0; i--) {
    const r = sorted[i].result;
    if (r === 'BE') { cur = 0; break; }
    if (!curType) curType = r;
    if (r === curType) cur++;
    else break;
  }

  document.getElementById('stat-pnl').textContent = fmtCurrency(netPnl);
  document.getElementById('stat-pnl').className = 'stat-value ' + (netPnl >= 0 ? 'green' : 'red');
  document.getElementById('stat-winrate').textContent = winRate + '%';
  document.getElementById('stat-trades').textContent = total + ' trades';
  document.getElementById('stat-pf').textContent = pf;
  document.getElementById('stat-rr').textContent = avgRR + 'R';
  document.getElementById('stat-avgwin').textContent = fmtCurrency(avgWin);
  document.getElementById('stat-wins').textContent = wins.length + ' wins';
  document.getElementById('stat-avgloss').textContent = fmtCurrency(avgLoss);
  document.getElementById('stat-losses').textContent = losses.length + ' losses';
  document.getElementById('stat-maxwin').textContent = fmtCurrency(maxWin);
  document.getElementById('stat-maxloss').textContent = fmtCurrency(maxLoss);
  document.getElementById('stat-streak').textContent = cur;
  document.getElementById('stat-streak-type').textContent = cur ? curType + 's' : '—';
  document.getElementById('stat-beststreak').textContent = bestStreak;

  buildCharts(t);
}

document.getElementById('dash-account-select')?.addEventListener('change', renderDashboard);

function buildCharts(t) {
  const isDark = document.documentElement.getAttribute('data-theme') !== 'light';
  const gridColor = isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)';
  const textColor = isDark ? '#7a8599' : '#5a6478';

  Chart.defaults.color = textColor;
  Chart.defaults.borderColor = gridColor;

  // Equity Curve
  const sorted = [...t].sort((a, b) => new Date(a.date) - new Date(b.date));
  let running = 0;
  const eqLabels = sorted.map(x => fmtDate(x.date, 'short'));
  const eqData = sorted.map(x => { running += (x.pnl || 0); return running; });
  buildChart('equity-chart', 'line', {
    labels: eqLabels,
    datasets: [{
      label: 'Equity',
      data: eqData,
      borderColor: '#00d4aa',
      backgroundColor: 'rgba(0,212,170,0.08)',
      fill: true,
      tension: 0.4,
      pointRadius: eqData.length > 30 ? 0 : 3,
    }]
  }, { scales: { y: { grid: { color: gridColor } }, x: { grid: { display: false }, ticks: { maxTicksLimit: 8 } } }, plugins: { legend: { display: false } } });

  // Win / Loss Pie
  const wins = t.filter(x => x.result === 'Win').length;
  const losses = t.filter(x => x.result === 'Loss').length;
  const bes = t.filter(x => x.result === 'BE').length;
  buildChart('winloss-chart', 'doughnut', {
    labels: ['Wins', 'Losses', 'Break Even'],
    datasets: [{ data: [wins, losses, bes], backgroundColor: ['#10d078', '#f53b5c', '#4da6ff'], borderWidth: 0, hoverOffset: 8 }]
  }, { plugins: { legend: { position: 'bottom' } } });

  // Monthly P&L
  const monthMap = {};
  sorted.forEach(x => {
    const key = x.date.slice(0, 7);
    monthMap[key] = (monthMap[key] || 0) + (x.pnl || 0);
  });
  const mKeys = Object.keys(monthMap).sort();
  buildChart('monthly-chart', 'bar', {
    labels: mKeys,
    datasets: [{
      label: 'P&L',
      data: mKeys.map(k => monthMap[k]),
      backgroundColor: mKeys.map(k => monthMap[k] >= 0 ? 'rgba(16,208,120,0.7)' : 'rgba(245,59,92,0.7)'),
      borderRadius: 6,
    }]
  }, { plugins: { legend: { display: false } }, scales: { x: { grid: { display: false } }, y: { grid: { color: gridColor } } } });

  // Session Performance
  const sessions = ['London', 'New York', 'Asia', 'Other'];
  const sessionPnl = sessions.map(s => t.filter(x => x.session === s).reduce((sum, x) => sum + (x.pnl || 0), 0));
  buildChart('session-chart', 'bar', {
    labels: sessions,
    datasets: [{ label: 'P&L', data: sessionPnl, backgroundColor: ['rgba(0,212,170,0.7)', 'rgba(77,166,255,0.7)', 'rgba(255,181,71,0.7)', 'rgba(180,180,180,0.5)'], borderRadius: 6 }]
  }, { plugins: { legend: { display: false } }, scales: { x: { grid: { display: false } }, y: { grid: { color: gridColor } } } });

  // Pair Performance
  const pairMap = {};
  t.forEach(x => { pairMap[x.pair] = (pairMap[x.pair] || 0) + (x.pnl || 0); });
  const pairEntries = Object.entries(pairMap).sort((a, b) => Math.abs(b[1]) - Math.abs(a[1])).slice(0, 8);
  buildChart('pair-chart', 'bar', {
    labels: pairEntries.map(([k]) => k),
    datasets: [{ label: 'P&L', data: pairEntries.map(([, v]) => v), backgroundColor: pairEntries.map(([, v]) => v >= 0 ? 'rgba(16,208,120,0.7)' : 'rgba(245,59,92,0.7)'), borderRadius: 6 }]
  }, { indexAxis: 'y', plugins: { legend: { display: false } }, scales: { x: { grid: { color: gridColor } }, y: { grid: { display: false } } } });
}

function buildChart(canvasId, type, data, options = {}) {
  const ctx = document.getElementById(canvasId);
  if (!ctx) return;
  if (charts[canvasId]) { charts[canvasId].destroy(); }
  charts[canvasId] = new Chart(ctx, {
    type,
    data,
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: { duration: 400 },
      ...options
    }
  });
}

function rebuildCharts() {
  if (document.getElementById('page-dashboard').classList.contains('active')) renderDashboard();
}

/* ══════════════════════════════════════════
   CALENDAR
══════════════════════════════════════════ */
function setupCalendarNav() {
  document.getElementById('cal-prev').addEventListener('click', () => {
    calendarDate.setMonth(calendarDate.getMonth() - 1);
    renderCalendar();
  });
  document.getElementById('cal-next').addEventListener('click', () => {
    calendarDate.setMonth(calendarDate.getMonth() + 1);
    renderCalendar();
  });
  document.getElementById('cal-detail-close').addEventListener('click', () => {
    document.getElementById('cal-day-detail').classList.add('hidden');
  });
}

function renderCalendar() {
  const y = calendarDate.getFullYear();
  const m = calendarDate.getMonth();
  document.getElementById('cal-month-label').textContent =
    new Date(y, m, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  const grid = document.getElementById('calendar-grid');
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const firstDay = new Date(y, m, 1).getDay();
  const daysInMonth = new Date(y, m + 1, 0).getDate();
  const today = new Date();

  let html = days.map(d => `<div class="cal-header-cell">${d}</div>`).join('');

  for (let i = 0; i < firstDay; i++) html += `<div class="cal-day empty"></div>`;

  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    const dayTrades = trades.filter(t => t.date?.startsWith(dateStr));
    const pnl = dayTrades.reduce((s, t) => s + (t.pnl || 0), 0);
    const isToday = today.getFullYear() === y && today.getMonth() === m && today.getDate() === d;
    html += `
      <div class="cal-day ${isToday ? 'today' : ''}" onclick="showCalDay('${dateStr}')">
        <div class="cal-day-num">${d}</div>
        ${dayTrades.length ? `
          <div class="cal-pnl ${pnl >= 0 ? 'pos' : 'neg'}">${fmtCurrency(pnl)}</div>
          <div class="cal-count">${dayTrades.length} trade${dayTrades.length > 1 ? 's' : ''}</div>
        ` : ''}
      </div>`;
  }

  grid.innerHTML = html;
}

function showCalDay(dateStr) {
  const dayTrades = trades.filter(t => t.date?.startsWith(dateStr));
  const detail = document.getElementById('cal-day-detail');
  document.getElementById('cal-detail-date').textContent =
    new Date(dateStr + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

  if (!dayTrades.length) {
    document.getElementById('cal-detail-trades').innerHTML = '<p style="color:var(--text-muted);font-style:italic">No trades on this day.</p>';
  } else {
    document.getElementById('cal-detail-trades').innerHTML = dayTrades.map(t => {
      const pnlClass = t.pnl > 0 ? 'pnl-pos' : t.pnl < 0 ? 'pnl-neg' : '';
      return `
        <div style="display:flex;align-items:center;gap:12px;padding:10px 0;border-bottom:1px solid var(--border)">
          <strong>${t.pair}</strong>
          <span class="badge badge-${t.direction?.toLowerCase()}">${t.direction}</span>
          <span class="badge badge-${t.result?.toLowerCase()}">${t.result}</span>
          <span class="${pnlClass}" style="margin-left:auto;font-family:var(--font-mono)">${t.pnl != null ? fmtCurrency(t.pnl) : '—'}</span>
          <button class="btn-ghost btn-sm" onclick="viewTrade('${t.id}')">View</button>
        </div>`;
    }).join('');
  }
  detail.classList.remove('hidden');
}

/* ══════════════════════════════════════════
   ACCOUNTS
══════════════════════════════════════════ */
document.getElementById('add-account-btn').addEventListener('click', () => openAccountModal());

function openAccountModal(account = null) {
  editingAccountId = account?.id || null;
  document.getElementById('account-modal-title').textContent = account ? 'Edit Account' : 'New Account';
  document.getElementById('account-id').value = account?.id || '';
  document.getElementById('a-name').value = account?.name || '';
  document.getElementById('a-broker').value = account?.broker || '';
  document.getElementById('a-starting').value = account?.starting_balance || '';
  document.getElementById('a-balance').value = account?.balance || '';
  document.getElementById('a-currency').value = account?.currency || 'USD';
  openModal('account-modal');
}

document.getElementById('save-account-btn').addEventListener('click', async () => {
  const name = document.getElementById('a-name').value.trim();
  if (!name) return showToast('Account name is required', 'error');
  const data = {
    user_id: currentUser.id,
    name,
    broker: document.getElementById('a-broker').value.trim(),
    starting_balance: parseFloat(document.getElementById('a-starting').value) || 0,
    balance: parseFloat(document.getElementById('a-balance').value) || 0,
    currency: document.getElementById('a-currency').value
  };
  let error;
  if (editingAccountId) {
    ({ error } = await sb.from('accounts').update(data).eq('id', editingAccountId));
  } else {
    ({ error } = await sb.from('accounts').insert(data));
  }
  if (error) return showToast('Error: ' + error.message, 'error');
  showToast(editingAccountId ? 'Account updated!' : 'Account created!', 'success');
  closeModal('account-modal');
  await loadAccounts();
  renderAccounts();
  populateAccountSelects();
});

async function deleteAccount(id) {
  if (!confirm('Delete this account?')) return;
  const { error } = await sb.from('accounts').delete().eq('id', id);
  if (error) return showToast('Error', 'error');
  showToast('Account deleted', 'info');
  await loadAccounts();
  renderAccounts();
  populateAccountSelects();
}

function renderAccounts() {
  const grid = document.getElementById('accounts-grid');
  if (!accounts.length) {
    grid.innerHTML = '<div class="empty-state">No accounts yet. Create your first account.</div>';
  } else {
    grid.innerHTML = accounts.map(a => {
      const diff = a.balance - a.starting_balance;
      const pct = a.starting_balance ? ((diff / a.starting_balance) * 100).toFixed(1) : 0;
      const isPos = diff >= 0;
      return `
        <div class="account-card">
          <div class="account-card-header">
            <div>
              <div class="account-name">${a.name}</div>
              <div class="account-broker">${a.broker || 'No broker'}</div>
            </div>
            <span style="font-size:0.75rem;color:var(--text-muted)">${a.currency}</span>
          </div>
          <div class="account-balance">${fmtCurrency(a.balance)}</div>
          <div class="account-meta">
            Starting: ${fmtCurrency(a.starting_balance)}
            <span class="pnl-indicator" style="margin-left:8px;color:${isPos?'var(--green)':'var(--red)'}">
              ${isPos?'▲':'▼'} ${fmtCurrency(Math.abs(diff))} (${pct}%)
            </span>
          </div>
          <div class="account-actions">
            <button class="btn-ghost btn-sm" onclick="openAccountModal(accounts.find(x=>x.id==='${a.id}'))">Edit</button>
            <button class="btn-ghost btn-sm" onclick="openTransferModal('${a.id}')">Transfer</button>
            <button class="btn-danger btn-sm" onclick="deleteAccount('${a.id}')">Delete</button>
          </div>
        </div>`;
    }).join('');
  }

  const tbody = document.getElementById('transfers-body');
  if (!transfers.length) {
    tbody.innerHTML = '<tr class="empty-row"><td colspan="6">No transfers yet.</td></tr>';
  } else {
    tbody.innerHTML = transfers.map(tr => {
      const fromAcct = accounts.find(a => a.id === tr.from_account_id);
      const toAcct = accounts.find(a => a.id === tr.to_account_id);
      return `<tr>
        <td>${fmtDate(tr.created_at)}</td>
        <td><span class="badge ${tr.type==='Deposit'?'badge-win':tr.type==='Withdrawal'?'badge-loss':'badge-be'}">${tr.type}</span></td>
        <td>${fromAcct?.name || '—'}</td>
        <td>${toAcct?.name || '—'}</td>
        <td class="mono">${fmtCurrency(tr.amount)}</td>
        <td style="color:var(--text-secondary)">${tr.note || '—'}</td>
      </tr>`;
    }).join('');
  }
}

// Transfer Modal
function openTransferModal(fromId = '') {
  populateTransferSelects();
  document.getElementById('tr-from').value = fromId;
  openModal('transfer-modal');
}

function setupTransferTypeToggle() {
  document.getElementById('tr-type')?.addEventListener('change', (e) => {
    document.getElementById('tr-to-group').style.display = e.target.value === 'Transfer' ? 'block' : 'none';
  });
}

function populateTransferSelects() {
  const opts = accounts.map(a => `<option value="${a.id}">${a.name}</option>`).join('');
  document.getElementById('tr-from').innerHTML = '<option value="">Select account</option>' + opts;
  document.getElementById('tr-to').innerHTML = '<option value="">Select account</option>' + opts;
  document.getElementById('tr-to-group').style.display = 'none';
}

document.getElementById('save-transfer-btn').addEventListener('click', async () => {
  const type = document.getElementById('tr-type').value;
  const fromId = document.getElementById('tr-from').value;
  const toId = document.getElementById('tr-to').value;
  const amount = parseFloat(document.getElementById('tr-amount').value);
  const note = document.getElementById('tr-note').value;

  if (!fromId || !amount) return showToast('Select account and amount', 'error');

  const { error } = await sb.from('transfers').insert({
    user_id: currentUser.id,
    type,
    from_account_id: fromId || null,
    to_account_id: type === 'Transfer' ? toId || null : null,
    amount,
    note
  });
  if (error) return showToast('Error: ' + error.message, 'error');

  // Update balances
  const fromAcct = accounts.find(a => a.id === fromId);
  if (fromAcct) {
    const newBal = type === 'Deposit' ? fromAcct.balance + amount : fromAcct.balance - amount;
    await sb.from('accounts').update({ balance: newBal }).eq('id', fromId);
  }
  if (type === 'Transfer' && toId) {
    const toAcct = accounts.find(a => a.id === toId);
    if (toAcct) await sb.from('accounts').update({ balance: toAcct.balance + amount }).eq('id', toId);
  }

  showToast('Transfer completed!', 'success');
  closeModal('transfer-modal');
  await Promise.all([loadAccounts(), loadTransfers()]);
  renderAccounts();
});

function populateAccountSelects() {
  const opts = `<option value="">Select account</option>` + accounts.map(a => `<option value="${a.id}">${a.name}</option>`).join('');
  document.getElementById('t-account').innerHTML = opts;
  const dashOpts = `<option value="all">All Accounts</option>` + accounts.map(a => `<option value="${a.id}">${a.name}</option>`).join('');
  document.getElementById('dash-account-select').innerHTML = dashOpts;
}

/* ══════════════════════════════════════════
   RISK TOOLS
══════════════════════════════════════════ */
function setupRiskTools() {
  document.getElementById('calc-size-btn')?.addEventListener('click', () => {
    const balance = parseFloat(document.getElementById('r-balance').value);
    const risk = parseFloat(document.getElementById('r-risk-pct').value) / 100;
    const sl = parseFloat(document.getElementById('r-sl-pips').value);
    const pipVal = parseFloat(document.getElementById('r-pip-value').value);
    if (!balance || !risk || !sl || !pipVal) return;
    const riskAmt = balance * risk;
    const lots = riskAmt / (sl * pipVal);
    document.getElementById('size-result').innerHTML =
      `Risk Amount: <strong style="color:var(--accent)">${fmtCurrency(riskAmt)}</strong><br>Lot Size: <strong style="color:var(--accent)">${lots.toFixed(2)}</strong>`;
  });

  document.getElementById('calc-rr-btn')?.addEventListener('click', () => {
    const entry = parseFloat(document.getElementById('rr-entry').value);
    const sl = parseFloat(document.getElementById('rr-sl').value);
    const tp = parseFloat(document.getElementById('rr-tp').value);
    if (!entry || !sl || !tp) return;
    const risk = Math.abs(entry - sl);
    const reward = Math.abs(tp - entry);
    const rr = (reward / risk).toFixed(2);
    document.getElementById('rr-result').innerHTML =
      `Risk: <strong>${risk.toFixed(5)}</strong> | Reward: <strong>${reward.toFixed(5)}</strong><br>RR: <strong style="color:var(--accent)">${rr}R</strong>`;
  });

  document.getElementById('calc-dd-btn')?.addEventListener('click', () => {
    const peak = parseFloat(document.getElementById('dd-peak').value);
    const curr = parseFloat(document.getElementById('dd-current').value);
    if (!peak || !curr) return;
    const dd = ((peak - curr) / peak * 100).toFixed(2);
    document.getElementById('dd-result').innerHTML =
      `Drawdown: <strong style="color:${dd > 10 ? 'var(--red)' : 'var(--yellow)'}">${dd}%</strong> (${fmtCurrency(peak - curr)})`;
  });

  // Daily loss tracker
  updateDailyLossTracker();
  document.getElementById('daily-limit')?.addEventListener('input', updateDailyLossTracker);
}

function updateDailyLossTracker() {
  const today = new Date().toISOString().slice(0, 10);
  const todayLoss = trades
    .filter(t => t.date?.startsWith(today) && t.pnl < 0)
    .reduce((s, t) => s + Math.abs(t.pnl || 0), 0);
  const limit = parseFloat(document.getElementById('daily-limit')?.value) || 0;
  const pct = limit > 0 ? Math.min((todayLoss / limit) * 100, 100) : 0;

  document.getElementById('daily-loss-amount').textContent = fmtCurrency(todayLoss);
  document.getElementById('daily-loss-bar').style.width = pct + '%';
  document.getElementById('daily-loss-pct').textContent = `${pct.toFixed(1)}% of limit used`;
}

/* ══════════════════════════════════════════
   SETTINGS
══════════════════════════════════════════ */
document.getElementById('save-profile-btn')?.addEventListener('click', async () => {
  const name = document.getElementById('settings-name').value.trim();
  const { error } = await sb.auth.updateUser({ data: { full_name: name } });
  if (error) return showToast('Error updating profile', 'error');
  showToast('Profile updated!', 'success');
  loadUserProfile();
});

document.getElementById('change-pwd-btn')?.addEventListener('click', async () => {
  const pwd = document.getElementById('new-password').value;
  const confirm = document.getElementById('confirm-password').value;
  if (pwd !== confirm) return showToast('Passwords do not match', 'error');
  if (pwd.length < 6) return showToast('Password too short', 'error');
  const { error } = await sb.auth.updateUser({ password: pwd });
  if (error) return showToast('Error: ' + error.message, 'error');
  showToast('Password updated!', 'success');
  document.getElementById('new-password').value = '';
  document.getElementById('confirm-password').value = '';
});

document.getElementById('save-prefs-btn')?.addEventListener('click', () => {
  const currency = document.getElementById('currency-select').value;
  const defaultRisk = document.getElementById('default-risk').value;
  localStorage.setItem('currency', currency);
  localStorage.setItem('defaultRisk', defaultRisk);
  showToast('Preferences saved!', 'success');
});

/* ══════════════════════════════════════════
   TOAST
══════════════════════════════════════════ */
function showToast(msg, type = 'info') {
  const toast = document.getElementById('toast');
  toast.textContent = msg;
  toast.className = `toast ${type}`;
  toast.classList.remove('hidden');
  clearTimeout(toast._timer);
  toast._timer = setTimeout(() => toast.classList.add('hidden'), 3000);
}

/* ══════════════════════════════════════════
   UTILS
══════════════════════════════════════════ */
function fmtCurrency(val) {
  const currency = localStorage.getItem('currency') || 'USD';
  const symbols = { USD: '$', EUR: '€', GBP: '£', JPY: '¥' };
  const sym = symbols[currency] || '$';
  if (val == null) return '—';
  return `${val < 0 ? '-' : ''}${sym}${Math.abs(val).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function fmtDate(dateStr, style = 'default') {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  if (style === 'short') return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}
