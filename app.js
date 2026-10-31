/* -----------------------------
   Simple Player Auction App
------------------------------*/

const qs = (sel) => document.querySelector(sel);
const qsa = (sel) => Array.from(document.querySelectorAll(sel));

const state = {
  players: [],       // [{name,type,base}]
  idx: -1,           // current player index
  currentBid: null,
  bidStep: 10,
  teams: [],         // [{name, purse}]
  purseDefault: 100,
  sales: []          // [{Player Name, Player Type, Bid Amount, Team Name}]
};

// Elements
const fileInput = qs('#fileInput');
const teamCountEl = qs('#teamCount');
const teamNamesWrap = qs('#teamNames');
const purseDefaultEl = qs('#purseDefault');
const applyTeamsBtn = qs('#applyTeamsBtn');
const teamsBoard = qs('#teamsBoard');

const playerNameEl = qs('#playerName');
const playerTypeEl = qs('#playerType');
const basePriceEl = qs('#basePrice');
const currentBidEl = qs('#currentBid');

const bidStepEl = qs('#bidStep');
const nextPlayerBtn = qs('#nextPlayerBtn');
const nextBidBtn = qs('#nextBidBtn');
const resetBtn = qs('#resetBtn');
const soldToEl = qs('#soldTo');
const confirmSaleBtn = qs('#confirmSaleBtn');
const downloadBtn = qs('#downloadBtn');
const noticeEl = qs('#notice');
const spinner = qs('#spinner');

/* -----------------------------
   Utilities
------------------------------*/
function showSpinner(show){
  spinner.classList.toggle('hidden', !show);
  spinner.setAttribute('aria-hidden', String(!show));
}

function setNotice(msg, tone='info'){
  noticeEl.textContent = msg || '';
  const colorMap = { info: 'var(--muted)', warn: 'var(--warn)', error: 'var(--danger)', ok: 'var(--success)' };
  noticeEl.style.color = colorMap[tone] || 'var(--muted)';
}

function sanitizeHeader(h){
  return (h||'').toString().trim().toLowerCase();
}

function csvToArray(text){
  // simple CSV parser (handles commas, quotes, and newlines)
  const rows = [];
  let cur = '', inQuotes = false, row = [];
  for (let i=0; i<text.length; i++){
    const c = text[i], n = text[i+1];
    if (c === '"' && inQuotes && n === '"'){ cur += '"'; i++; continue; }
    if (c === '"'){ inQuotes = !inQuotes; continue; }
    if (c === ',' && !inQuotes){ row.push(cur); cur=''; continue; }
    if ((c === '\n' || c === '\r') && !inQuotes){
      if (cur.length || row.length){ row.push(cur); rows.push(row); row=[]; cur=''; }
      continue;
    }
    cur += c;
  }
  if (cur.length || row.length){ row.push(cur); rows.push(row); }
  return rows;
}

function parsePlayersFromRows(rows){
  if (!rows.length) return [];
  const headers = rows[0].map(sanitizeHeader);
  const nameIdx = headers.indexOf('player name');
  const typeIdx = headers.indexOf('player type');
  const baseIdx = headers.indexOf('base price');

  if (nameIdx === -1 || typeIdx === -1 || baseIdx === -1) {
    throw new Error("Missing headers. Required: Player Name, Player Type, Base Price");
  }

  const players = [];
  for (let i=1;i<rows.length;i++){
    const r = rows[i];
    if (!r || !r.length) continue;
    const name = (r[nameIdx] ?? '').trim();
    const type = (r[typeIdx] ?? '').trim();
    const base = Number((r[baseIdx] ?? '').toString().replace(/[^\d.-]/g,''));
    if (!name) continue;
    if (!Number.isFinite(base)) continue;
    players.push({ name, type, base });
  }
  return players;
}

function toCSV(rows){
  const esc = (s) => {
    const str = String(s ?? '');
    return /[",\n]/.test(str) ? `"${str.replace(/"/g,'""')}"` : str;
  };
  return rows.map(r => r.map(esc).join(',')).join('\n');
}

/* -----------------------------
   Rendering
------------------------------*/
function renderTeamNameInputs(){
  const count = parseInt(teamCountEl.value, 10);
  teamNamesWrap.innerHTML = '';
  for (let i=1;i<=count;i++){
    const input = document.createElement('input');
    input.type = 'text';
    input.placeholder = `Team ${i} name`;
    input.id = `teamName_${i}`;
    input.value = state.teams[i-1]?.name ?? '';
    teamNamesWrap.appendChild(input);
  }
}

function renderTeamsBoard(){
  teamsBoard.innerHTML = '';
  state.teams.forEach((t, idx) => {
    const el = document.createElement('div');
    el.className = 'team-card';
    el.innerHTML = `
      <div class="team-name">${t.name || `Team ${idx+1}`}</div>
      <div class="team-purse">Purse: <strong>${t.purse}</strong></div>
    `;
    teamsBoard.appendChild(el);
  });
}

function renderSoldToOptions(){
  soldToEl.innerHTML = `<option value="">— Select Team —</option>`;
  state.teams.forEach((t, i) => {
    const opt = document.createElement('option');
    opt.value = String(i);
    opt.textContent = t.name || `Team ${i+1}`;
    soldToEl.appendChild(opt);
  });
  soldToEl.disabled = state.teams.length === 0;
}

function renderPlayer(){
  const p = state.players[state.idx];
  if (!p){
    playerNameEl.textContent = '—';
    playerTypeEl.textContent = '—';
    basePriceEl.textContent = '—';
    currentBidEl.textContent = '—';
    nextBidBtn.disabled = true;
    confirmSaleBtn.disabled = true;
    return;
  }
  playerNameEl.textContent = p.name;
  playerTypeEl.textContent = p.type || '—';
  basePriceEl.textContent = p.base;
  currentBidEl.textContent = state.currentBid ?? '—';
  nextBidBtn.disabled = false;
  confirmSaleBtn.disabled = false;
}

function updateButtonsEnabled(){
  const hasPlayers = state.players.length > 0;
  nextPlayerBtn.disabled = !hasPlayers;
  nextBidBtn.disabled = !(hasPlayers && state.idx >= 0);
  downloadBtn.disabled = state.sales.length === 0;
}

/* -----------------------------
   Core Logic
------------------------------*/
function resetAuction(full=false){
  if (full){
    state.players = [];
    state.sales = [];
    state.idx = -1;
    state.currentBid = null;
    setNotice('Reset complete. Load a players file to begin.');
  } else {
    state.sales = [];
    state.idx = -1;
    state.currentBid = null;
    setNotice('Auction reset to beginning.');
  }
  renderPlayer();
  renderTeamsBoard();
  updateButtonsEnabled();
}

function nextPlayer(){
  if (state.players.length === 0) { setNotice('Load a players file first.', 'warn'); return; }
  state.idx++;
  if (state.idx >= state.players.length){
    state.idx = state.players.length - 1;
    setNotice('Last player reached.', 'warn');
    return;
  }
  const p = state.players[state.idx];
  state.currentBid = p.base; // start at base price
  setNotice(`Now auctioning: ${p.name}`);
  renderPlayer();
  updateButtonsEnabled();
}

function nextBid(){
  const step = parseInt(bidStepEl.value, 10);
  if (!Number.isFinite(step) || step <= 0){ setNotice('Enter a valid bid increment.', 'error'); return; }
  if (state.idx < 0){ setNotice('Select a player first.', 'warn'); return; }
  state.currentBid += step;
  setNotice(`Bid advanced by ${step}.`);
  renderPlayer();
}

function confirmSale(){
  if (state.idx < 0){ setNotice('No active player.', 'warn'); return; }
  const teamIdx = parseInt(soldToEl.value, 10);
  if (!Number.isFinite(teamIdx)){ setNotice('Select a team to sell to.', 'warn'); return; }
  const team = state.teams[teamIdx];
  if (!team){ setNotice('Invalid team.', 'error'); return; }

  const bid = state.currentBid ?? 0;
  if (bid <= 0){ setNotice('Bid must be greater than zero.', 'error'); return; }
  if (bid > team.purse){
    setNotice(`Insufficient purse. ${team.name} has only ${team.purse}.`, 'error');
    return;
  }

  const p = state.players[state.idx];
  // Record sale
  state.sales.push({
    'Player Name': p.name,
    'Player Type': p.type,
    'Bid Amount': bid,
    'Team Name': team.name
  });
  // Deduct purse
  team.purse -= bid;

  // Advance (optional: keep on same player if desired; here we move on automatically)
  setNotice(`${p.name} sold to ${team.name} for ${bid}.`);
  renderTeamsBoard();
  downloadBtn.disabled = state.sales.length === 0;

  // Move to next player automatically if any left
  if (state.idx < state.players.length - 1){
    state.idx++;
    const np = state.players[state.idx];
    state.currentBid = np.base;
    renderPlayer();
  } else {
    state.idx = state.players.length - 1;
    renderPlayer();
    setNotice('Auction complete. No more players.', 'ok');
  }
}

/* -----------------------------
   File Handling
------------------------------*/
async function handleFile(file){
  if (!file) return;
  showSpinner(true);
  setNotice('Parsing file...');
  try {
    if (file.name.toLowerCase().endsWith('.csv')){
      const text = await file.text();
      const rows = csvToArray(text);
      state.players = parsePlayersFromRows(rows);
    } else {
      if (typeof XLSX === 'undefined') throw new Error('XLSX parser not loaded. Use CSV or keep the CDN script.');
      const data = await file.arrayBuffer();
      const wb = XLSX.read(data, { type: 'array' });
      const first = wb.SheetNames[0];
      const ws = wb.Sheets[first];
      const json = XLSX.utils.sheet_to_json(ws, { defval: '' });
      // Normalize to rows
      const headers = ['Player Name','Player Type','Base Price'];
      const rows = [headers];
      json.forEach(r => {
        rows.push([
          r['Player Name'] ?? r['player name'] ?? r['Name'] ?? '',
          r['Player Type'] ?? r['player type'] ?? r['Type'] ?? '',
          r['Base Price'] ?? r['base price'] ?? r['Base'] ?? ''
        ]);
      });
      state.players = parsePlayersFromRows(rows);
    }

    if (!state.players.length){
      setNotice('No valid players found. Check headers and values.', 'error');
      state.idx = -1; renderPlayer(); return;
    }
    state.idx = 0;
    state.currentBid = state.players[0].base;
    setNotice(`Loaded ${state.players.length} players. Ready to auction!`, 'ok');
    renderPlayer();
    updateButtonsEnabled();
  } catch (e){
    console.error(e);
    setNotice(`Failed to parse file: ${e.message}`, 'error');
  } finally {
    showSpinner(false);
  }
}

/* -----------------------------
   Teams Setup
------------------------------*/
function applyTeams(){
  const count = parseInt(teamCountEl.value, 10);
  const purse = parseInt(purseDefaultEl.value, 10);
  if (!Number.isFinite(purse) || purse <= 0){ setNotice('Enter a valid purse amount.', 'error'); return; }

  const names = [];
  for (let i=1;i<=count;i++){
    const name = (qs(`#teamName_${i}`)?.value ?? '').trim();
    names.push(name || `Team ${i}`);
  }
  state.teams = names.map(n => ({ name: n, purse }));
  state.purseDefault = purse;

  renderTeamsBoard();
  renderSoldToOptions();
  setNotice('Teams applied.');
}

/* -----------------------------
   Download Sales
------------------------------*/
function downloadSalesCSV(){
  if (!state.sales.length) return;
  const headers = ['Player Name','Player Type','Bid Amount','Team Name'];
  const rows = [headers, ...state.sales.map(s => headers.map(h => s[h]))];
  const csv = toCSV(rows);
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  const stamp = new Date().toISOString().replace(/[:.]/g,'-');
  a.download = `auction_sold_${stamp}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/* -----------------------------
   Events
------------------------------*/
fileInput.addEventListener('change', (e) => handleFile(e.target.files[0]));
teamCountEl.addEventListener('change', renderTeamNameInputs);
applyTeamsBtn.addEventListener('click', applyTeams);
bidStepEl.addEventListener('change', () => {
  const v = parseInt(bidStepEl.value, 10);
  if (Number.isFinite(v) && v > 0) state.bidStep = v;
});
nextPlayerBtn.addEventListener('click', nextPlayer);
nextBidBtn.addEventListener('click', nextBid);
confirmSaleBtn.addEventListener('click', confirmSale);
resetBtn.addEventListener('click', () => resetAuction(false));
downloadBtn.addEventListener('click', downloadSalesCSV);

/* -----------------------------
   Init
------------------------------*/
function init(){
  renderTeamNameInputs();
  renderTeamsBoard();
  renderSoldToOptions();
  renderPlayer();
  updateButtonsEnabled();
  setNotice('Load players (CSV/XLSX) to begin.');
}
init();
