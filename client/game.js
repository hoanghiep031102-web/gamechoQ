/**
 * BANG! – Board Game UI
 * game.js: state management, UI interactions, dice, card modal, log
 *
 * Designed to plug into an external client via the GameBridge API
 * (window.GameBridge), or run standalone in demo mode.
 */

'use strict';

/* ============================================================
   CONSTANTS
============================================================ */
const PLAYER_COUNT = 5; // 4 or 5
const CLASS_ACTIVE = 'active-turn';
const CLASS_HIDDEN = 'hidden';

/* Sample card data for demo mode */
const DEMO_MONSTER = {
  emoji: '🐉',
  name: 'Rồng Đỏ Hung Dữ',
  type: 'Quái vật',
  text: 'Khi bị tấn công, tung 1 xúc xắc. Nếu kết quả ≥ 4, quái phản đòn gây 2 sát thương cho người tấn công.',
  stats: { atk: 8, vp: 3 },
  hp: 8, maxHp: 8,
};

const DEMO_PARTY_CARDS = [
  { emoji: '🗡', name: 'Chiến Binh', type: 'Nhân vật', text: 'Hành động: Gây 2 sát thương cho quái.', stats: { atk: 2 } },
  { emoji: '🏹', name: 'Cung Thủ', type: 'Nhân vật', text: 'Hành động: Bắn xa, gây 1 sát thương. Không bị phản đòn.', stats: { atk: 1 } },
  { emoji: '🔮', name: 'Phù Thủy', type: 'Nhân vật', text: 'Hành động: Gây 2 sát thương ngẫu nhiên cho bất kỳ mục tiêu.', stats: { atk: 2 } },
  { emoji: '🌿', name: 'Thầy Thuốc', type: 'Nhân vật', text: 'Hành động: Hồi 2 HP cho một nhân vật trong đội.', stats: {} },
  { emoji: '🛡', name: 'Hiệp Sĩ', type: 'Nhân vật', text: 'Bị động: Giảm 1 sát thương phản đòn nhận vào.', stats: { def: 1 } },
];

/* ============================================================
   STATE
============================================================ */
const state = {
  currentPlayer: 0,
  actionsLeft: 3,
  phase: 'action', // draw | action | end
  monster: { ...DEMO_MONSTER },
  players: Array.from({ length: PLAYER_COUNT }, (_, i) => ({
    id: i,
    name: `Người chơi ${i + 1}`,
    vp: 0,
    handCount: 5,
    party: [],    // up to 6 slots
    slain: [],    // monster tokens
  })),
  log: [],
};

/* ============================================================
   DOM REFS
============================================================ */
const $ = id => document.getElementById(id);
const $$ = sel => document.querySelectorAll(sel);

const refs = {
  board: $('board'),
  currentPlayerName: $('currentPlayerName'),
  actionsLeft: $('actionsLeft'),
  endTurnBtn: $('endTurnBtn'),
  turnBadge: $('turnBadge'),
  phaseSteps: $$('.phase-step'),

  // Monster
  activeMonster: $('activeMonster'),
  monsterHpBar: $('monsterHpBar'),
  monsterHp: $('monsterHp'),

  // Decks
  mainDeckCount: $('mainDeckCount'),
  monsterDeckCount: $('monsterDeckCount'),
  challengeDeckCount: $('challengeDeckCount'),
  mainDeck: $('mainDeck'),
  monsterDeck: $('monsterDeck'),
  challengeDeck: $('challengeDeck'),
  discardPile: $('discardPile'),

  // Dice
  diceOverlay: $('diceOverlay'),
  diceFaces: $('diceFaces'),
  diceContext: $('diceContext'),
  rollBtn: $('rollBtn'),
  closeDiceBtn: $('closeDiceBtn'),

  // Card modal
  cardModal: $('cardModal'),
  closeCardModal: $('closeCardModal'),
  modalArt: $('modalArt'),
  modalName: $('modalName'),
  modalType: $('modalType'),
  modalText: $('modalText'),
  modalStats: $('modalStats'),
  modalActions: $('modalActions'),

  // Log
  logPanel: $('logPanel'),
  logList: $('logList'),
  logToggle: $('logToggle'),
  logHeader: document.querySelector('.log-header'),

  // Toast
  toastContainer: $('toastContainer'),
};

/* ============================================================
   INIT
============================================================ */
function init() {
  renderHud();
  renderAllPlayers();
  renderMonster(state.monster);
  bindEvents();
  addLog('Trò chơi bắt đầu. Chúc may mắn!', 'system');
  highlightActivePlayer();

  // Pre-populate demo party cards for player 0
  spawnDemoCards();
}

function spawnDemoCards() {
  // Give player 0 a couple of cards to make UI look alive
  const p0party = $('p0-party');
  if (!p0party) return;
  const slots = p0party.querySelectorAll('.card-slot');
  DEMO_PARTY_CARDS.slice(0, 3).forEach((card, i) => {
    if (slots[i]) renderPartyCardInSlot(slots[i], card, 0);
  });
}

/* ============================================================
   RENDER – HUD
============================================================ */
function renderHud() {
  const p = state.players[state.currentPlayer];
  refs.currentPlayerName.textContent = p.name;
  refs.actionsLeft.textContent = state.actionsLeft;

  refs.phaseSteps.forEach(el => {
    el.classList.toggle('active', el.dataset.phase === state.phase);
  });
}

/* ============================================================
   RENDER – PLAYERS
============================================================ */
function renderAllPlayers() {
  state.players.forEach((p, i) => {
    const nameEl = $(`p${i}-name`);
    const vpEl   = $(`p${i}-vp`);
    const handEl = $(`p${i}-hand-count`);
    if (nameEl) nameEl.textContent = p.name;
    if (vpEl)   vpEl.textContent   = p.vp;
    if (handEl) handEl.textContent = `(${p.handCount})`;
  });
}

function highlightActivePlayer() {
  $$('.player-zone').forEach((zone, i) => {
    zone.classList.toggle(CLASS_ACTIVE, Number(zone.dataset.player) === state.currentPlayer);
  });
}

/* ============================================================
   RENDER – PARTY CARD IN SLOT
============================================================ */
function renderPartyCardInSlot(slot, card, playerIdx) {
  slot.classList.remove('empty');
  slot.classList.add('has-card');
  slot.innerHTML = '';

  const inner = document.createElement('div');
  inner.style.cssText = `
    width:100%; height:100%; border-radius:6px;
    background: linear-gradient(160deg, #1C1408 0%, #2C1E0A 100%);
    border: 1px solid #4A2E12;
    display:flex; flex-direction:column; align-items:center;
    justify-content:space-between; padding:4px 2px;
    cursor:pointer; overflow:hidden; position:relative;
  `;

  const art = document.createElement('div');
  art.style.cssText = 'font-size:24px; line-height:1;';
  art.textContent = card.emoji;

  const name = document.createElement('div');
  name.style.cssText = `
    font-family:'Cinzel',serif; font-size:7px; font-weight:600;
    color:#E8D5A3; text-align:center; line-height:1.2; padding:0 2px;
    white-space:nowrap; overflow:hidden; text-overflow:ellipsis; width:100%;
  `;
  name.textContent = card.name;

  const statsRow = document.createElement('div');
  statsRow.style.cssText = 'display:flex; gap:2px; align-items:center;';
  if (card.stats?.atk) {
    const s = document.createElement('span');
    s.style.cssText = 'font-size:8px; padding:1px 3px; background:rgba(139,32,32,0.5); color:#FF8C8C; border-radius:2px;';
    s.textContent = `⚔${card.stats.atk}`;
    statsRow.appendChild(s);
  }
  if (card.stats?.def) {
    const s = document.createElement('span');
    s.style.cssText = 'font-size:8px; padding:1px 3px; background:rgba(26,59,107,0.5); color:#88AAFF; border-radius:2px;';
    s.textContent = `🛡${card.stats.def}`;
    statsRow.appendChild(s);
  }

  inner.appendChild(art);
  inner.appendChild(name);
  inner.appendChild(statsRow);
  slot.appendChild(inner);

  inner.addEventListener('click', () => openCardModal(card, playerIdx));
}

/* ============================================================
   RENDER – MONSTER
============================================================ */
function renderMonster(monster) {
  const slot = refs.activeMonster;
  if (!monster) {
    slot.innerHTML = `
      <div class="monster-card placeholder">
        <div class="monster-art">🐲</div>
        <div class="monster-name">Chưa có quái</div>
        <div class="monster-stats"></div>
      </div>`;
    refs.monsterHp.textContent = '—';
    refs.monsterHpBar.style.width = '100%';
    return;
  }

  slot.innerHTML = `
    <div class="monster-card" id="monsterCardEl">
      <div class="monster-art">${monster.emoji}</div>
      <div class="monster-name">${monster.name}</div>
      <div class="monster-stats">
        <span class="stat atk">⚔ ${monster.stats.atk}</span>
        <span class="stat vp">VP ${monster.stats.vp}</span>
      </div>
    </div>`;

  const pct = Math.max(0, (monster.hp / monster.maxHp) * 100);
  refs.monsterHpBar.style.width = pct + '%';
  refs.monsterHp.textContent = `${monster.hp}/${monster.maxHp}`;

  $('monsterCardEl')?.addEventListener('click', () => {
    openCardModal({
      emoji: monster.emoji,
      name: monster.name,
      type: 'Quái vật',
      text: monster.text,
      stats: monster.stats,
    }, null, [
      { label: '⚔ Tấn công', action: () => attackMonster() },
    ]);
  });
}

/* ============================================================
   CARD MODAL
============================================================ */
function openCardModal(card, playerIdx, extraActions = []) {
  refs.modalArt.textContent   = card.emoji || '🃏';
  refs.modalName.textContent  = card.name;
  refs.modalType.textContent  = card.type;
  refs.modalText.textContent  = card.text;

  // Stats
  refs.modalStats.innerHTML = '';
  if (card.stats) {
    Object.entries(card.stats).forEach(([k, v]) => {
      const chip = document.createElement('span');
      chip.className = `stat ${k}`;
      const labels = { atk: '⚔', vp: 'VP', def: '🛡', hp: '❤' };
      chip.textContent = `${labels[k] || k} ${v}`;
      refs.modalStats.appendChild(chip);
    });
  }

  // Actions
  refs.modalActions.innerHTML = '';
  extraActions.forEach(ea => {
    const btn = document.createElement('button');
    btn.className = 'btn-gold';
    btn.textContent = ea.label;
    btn.addEventListener('click', () => {
      closeModal();
      ea.action();
    });
    refs.modalActions.appendChild(btn);
  });

  refs.cardModal.classList.remove(CLASS_HIDDEN);
}

function closeModal() {
  refs.cardModal.classList.add(CLASS_HIDDEN);
}

/* ============================================================
   DICE
============================================================ */
let diceResolver = null;

function rollDice(numDice = 1, context = '') {
  return new Promise(resolve => {
    diceResolver = resolve;
    refs.diceFaces.innerHTML = '';
    for (let i = 0; i < numDice; i++) {
      const die = document.createElement('div');
      die.className = 'die';
      die.id = `die${i}`;
      die.textContent = '?';
      refs.diceFaces.appendChild(die);
    }
    refs.diceContext.textContent = context || 'Tung xúc xắc...';
    refs.diceOverlay.classList.remove(CLASS_HIDDEN);
  });
}

function performRoll() {
  const dice = refs.diceFaces.querySelectorAll('.die');
  const results = [];
  dice.forEach(die => {
    die.classList.add('rolling');
    const val = Math.floor(Math.random() * 6) + 1;
    results.push(val);
    setTimeout(() => {
      die.textContent = val;
      die.classList.remove('rolling');
    }, 500);
  });
  setTimeout(() => {
    if (diceResolver) { diceResolver(results); diceResolver = null; }
    showToast(`🎲 Kết quả: ${results.join(', ')}`, 'info');
    addLog(`Tung xúc xắc → ${results.join(', ')}`, 'action');
  }, 600);
}

/* ============================================================
   GAME ACTIONS
============================================================ */
function attackMonster() {
  if (!spendAction()) return;
  rollDice(2, '⚔ Tấn công quái vật – tung 2 xúc xắc!').then(([r1, r2]) => {
    const total = r1 + r2;
    const dmg = total >= 8 ? 4 : total >= 6 ? 3 : total >= 4 ? 2 : 1;
    state.monster.hp = Math.max(0, state.monster.hp - dmg);
    addLog(`${state.players[state.currentPlayer].name} gây ${dmg} sát thương! (Tung: ${r1}+${r2}=${total})`, 'action');
    renderMonster(state.monster);

    if (state.monster.hp <= 0) {
      slayMonster();
    }
    closeDice();
  });
}

function slayMonster() {
  const p = state.players[state.currentPlayer];
  const vp = state.monster.stats.vp || 1;
  p.vp += vp;
  p.slain.push({ emoji: state.monster.emoji, vp });
  renderAllPlayers();
  renderSlainTokens(state.currentPlayer);
  addLog(`${p.name} đã hạ ${state.monster.name}! (+${vp} VP)`, 'system');
  showToast(`⚔ ${p.name} đã hạ quái! +${vp} VP`, 'success');
  // Reset monster to placeholder
  state.monster = null;
  renderMonster(null);
}

function renderSlainTokens(playerIdx) {
  const p = state.players[playerIdx];
  const el = $(`p${playerIdx}-slain`);
  if (!el) return;
  el.innerHTML = p.slain.map(t => `
    <div class="slain-token" title="${t.name} (${t.vp}VP)">${t.emoji}</div>
  `).join('');
}

function endTurn() {
  const prev = state.currentPlayer;
  state.currentPlayer = (state.currentPlayer + 1) % PLAYER_COUNT;
  state.actionsLeft = 3;
  state.phase = 'draw';

  const p = state.players[state.currentPlayer];
  addLog(`— Lượt của ${p.name} —`, 'system');
  showToast(`🎴 Lượt của ${p.name}`, 'info');

  renderHud();
  highlightActivePlayer();

  // Simulate draw phase transition
  setTimeout(() => {
    state.phase = 'action';
    renderHud();
  }, 800);
}

function spendAction() {
  if (state.actionsLeft <= 0) {
    showToast('Bạn đã hết hành động!', 'danger');
    return false;
  }
  state.actionsLeft--;
  refs.actionsLeft.textContent = state.actionsLeft;
  return true;
}

/* ============================================================
   UI HELPERS
============================================================ */
function showToast(msg, type = 'info') {
  const t = document.createElement('div');
  t.className = `toast ${type}`;
  t.textContent = msg;
  refs.toastContainer.appendChild(t);
  setTimeout(() => t.remove(), 3200);
}

function addLog(msg, type = '') {
  state.log.push({ msg, type });
  const li = document.createElement('li');
  li.className = `log-entry ${type}`;
  li.textContent = msg;
  refs.logList.appendChild(li);
  refs.logList.scrollTop = refs.logList.scrollHeight;
}

function closeDice() {
  refs.diceOverlay.classList.add(CLASS_HIDDEN);
}

/* ============================================================
   EVENT BINDINGS
============================================================ */
function bindEvents() {
  // End turn
  refs.endTurnBtn.addEventListener('click', endTurn);

  // Dice
  refs.rollBtn.addEventListener('click', performRoll);
  refs.closeDiceBtn.addEventListener('click', closeDice);

  // Card modal close
  refs.closeCardModal.addEventListener('click', closeModal);
  refs.cardModal.addEventListener('click', e => {
    if (e.target === refs.cardModal) closeModal();
  });

  // Log toggle
  refs.logHeader.addEventListener('click', () => {
    const list = refs.logList;
    list.style.display = list.style.display === 'none' ? '' : 'none';
    refs.logToggle.textContent = list.style.display === 'none' ? '▼' : '▲';
  });

  // Deck clicks – draw a card (demo)
  refs.mainDeck.addEventListener('click', () => {
    addLog(`${state.players[state.currentPlayer].name} rút 1 bài.`, 'action');
    showToast('🃏 Rút 1 bài từ bộ bài chính');
    const count = parseInt(refs.mainDeckCount.textContent) - 1;
    refs.mainDeckCount.textContent = `${Math.max(0, count)} bài`;
  });

  refs.monsterDeck.addEventListener('click', () => {
    if (state.monster && state.monster.hp > 0) {
      showToast('Đã có quái đang hoạt động!', 'danger');
      return;
    }
    // Demo: spawn new monster
    state.monster = { ...DEMO_MONSTER, hp: DEMO_MONSTER.maxHp };
    renderMonster(state.monster);
    addLog('Một quái vật mới xuất hiện!', 'danger');
    showToast('🐉 Quái vật mới xuất hiện!', 'danger');
    const count = parseInt(refs.monsterDeckCount.textContent) - 1;
    refs.monsterDeckCount.textContent = `${Math.max(0, count)} quái`;
  });

  refs.challengeDeck.addEventListener('click', () => {
    rollDice(1, '🎲 Thử thách – ai thắng?').then(([r]) => {
      const msg = r >= 4 ? 'Thử thách thành công!' : 'Thử thách thất bại!';
      showToast(msg, r >= 4 ? 'success' : 'danger');
      addLog(msg, r >= 4 ? 'action' : 'danger');
      closeDice();
    });
  });

  // Empty party slot click – demo add card
  refs.board.addEventListener('click', e => {
    const slot = e.target.closest('.card-slot.empty');
    if (!slot) return;
    const zone = slot.closest('.player-zone');
    if (!zone) return;
    const pIdx = Number(zone.dataset.player);
    if (pIdx !== state.currentPlayer) {
      showToast('Chỉ chơi bài trong lượt của mình!', 'danger');
      return;
    }
    if (!spendAction()) return;

    // Assign a random demo card
    const remaining = DEMO_PARTY_CARDS.filter(c =>
      !Array.from($(`p${pIdx}-party`).querySelectorAll('[data-card-name]'))
           .map(el => el.dataset.cardName).includes(c.name)
    );
    const card = remaining[Math.floor(Math.random() * remaining.length)];
    if (!card) { showToast('Không còn bài để chơi!'); return; }

    renderPartyCardInSlot(slot, card, pIdx);
    addLog(`${state.players[pIdx].name} chơi ${card.name} vào đội hình.`, 'action');
    showToast(`✨ ${card.name} tham gia đội!`);
  });
}

/* ============================================================
   GAME BRIDGE (external client API)
   Other modules can call window.GameBridge.* to control board
============================================================ */
window.GameBridge = {
  /** Update a player's VP display */
  setPlayerVP(playerIdx, vp) {
    state.players[playerIdx].vp = vp;
    const el = $(`p${playerIdx}-vp`);
    if (el) el.textContent = vp;
  },
  /** Set active player */
  setCurrentPlayer(idx) {
    state.currentPlayer = idx;
    renderHud();
    highlightActivePlayer();
  },
  /** Update monster */
  setMonster(monsterData) {
    state.monster = monsterData;
    renderMonster(monsterData);
  },
  /** Log a message */
  log: addLog,
  /** Show toast */
  toast: showToast,
  /** Open dice roller, returns Promise<number[]> */
  rollDice,
  /** Get full game state snapshot */
  getState: () => JSON.parse(JSON.stringify(state)),
};

/* ============================================================
   BOOTSTRAP
============================================================ */
document.addEventListener('DOMContentLoaded', init);