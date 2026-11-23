function startTablePreview() {
  const players = [
    { name: 'Bạn', character: 'Lucky Duke', initials: 'LD', health: 5, cards: 4, equipment: 'Colt .45', sheriff: true },
    { name: 'An', character: 'Bart Cassidy', initials: 'BC', health: 4, cards: 3, equipment: 'Mustang' },
    { name: 'Bình', character: 'Jourdonnais', initials: 'J', health: 4, cards: 4, equipment: 'Colt .45' },
    { name: 'Chi', character: 'Calamity Janet', initials: 'CJ', health: 4, cards: 2, equipment: 'Schofield' },
    { name: 'Duy', character: 'El Gringo', initials: 'EG', health: 3, cards: 3, equipment: 'Colt .45' },
    { name: 'Hà', character: 'Suzy Lafayette', initials: 'SL', health: 4, cards: 4, equipment: 'Barrel' },
    { name: 'Minh', character: 'Willy the Kid', initials: 'WK', health: 4, cards: 3, equipment: 'Colt .45' },
  ];

  const cards = [
    { name: 'BANG!', mark: '✹', type: 'Tấn công', detail: 'Chọn một ghế để xem thao tác nhắm mục tiêu mẫu. Trong ván thật, mục tiêu phải ở trong tầm bắn.' },
    { name: 'Missed!', mark: '◇', type: 'Phản hồi', detail: 'Dùng để né một đòn BANG! nhắm vào bạn.' },
    { name: 'Beer', mark: '♥', type: 'Hồi máu', detail: 'Hồi 1 máu cho chính mình, tối đa bằng máu ban đầu. Beer mất hiệu lực khi chỉ còn hai người.' },
    { name: 'Barrel', mark: '◎', type: 'Trang bị', blue: true, detail: 'Khi bị nhắm bởi BANG!, lật bài kiểm tra. Lá cơ giúp bạn né đòn.' },
  ];

  const seatCount = document.querySelector('#seat-count');
  const seats = document.querySelector('#seats');
  const hand = document.querySelector('#hand');
  const turn = document.querySelector('#turn');
  const detail = document.querySelector('#detail');
  const log = document.querySelector('#log');
  const seatButtons = [];
  const cardButtons = [];
  let activeSeat = 0;
  let selectedCard = null;
  let target = null;

  function makeButton(className, onClick) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = className;
    button.addEventListener('click', onClick);
    return button;
  }

  function addText(parent, tag, value, className) {
    const element = document.createElement(tag);
    element.textContent = value;
    if (className) element.className = className;
    parent.append(element);
  }

  function updateSelection() {
    cardButtons.forEach((button, index) => button.setAttribute('aria-pressed', String(cards[index] === selectedCard)));
    seatButtons.forEach((button, index) => {
      button.classList.toggle('active', index === activeSeat);
      button.setAttribute('aria-pressed', String(index === target));
      button.disabled = index === 0 || activeSeat !== 0 || selectedCard !== cards[0];
    });
    turn.textContent = 'Lượt mẫu · ' + players[activeSeat].name;
    showCardInspector(selectedCard);
    detail.textContent = selectedCard ? 'Bạn đang xem lá ' + selectedCard.name + '.' : 'Chọn một lá trên tay để xem mô tả.';
  }

  function renderSeats() {
    const count = Number(seatCount.value);
    seats.replaceChildren();
    seatButtons.length = 0;
    players.slice(0, count).forEach((player, index) => {
      const angle = Math.PI / 2 + index * 2 * Math.PI / count;
      const button = makeButton('seat', () => {
        target = index;
        updateSelection();
        addText(log, 'li', 'Bạn nhắm BANG! vào ' + player.name + ' trong lượt mẫu.');
        log.lastElementChild.scrollIntoView({ block: 'nearest' });
      });
      button.style.setProperty('--x', (50 + 32 * Math.cos(angle)) + '%');
      button.style.setProperty('--y', (50 + 39 * Math.sin(angle)) + '%');
      addText(button, 'span', player.initials, 'avatar');
      addText(button, 'strong', player.name + (player.sheriff ? ' · ★' : ''));
      addText(button, 'span', player.character, 'seat-meta');
      addText(button, 'span', player.health + ' máu · ' + player.cards + ' lá', 'seat-meta');
      addText(button, 'span', player.equipment, 'seat-meta');
      seatButtons.push(button);
      seats.append(button);
    });
  }

  cards.forEach((card) => {
    const button = makeButton('hand-card', () => {
      selectedCard = selectedCard === card ? null : card;
      target = null;
      updateSelection();
      if (selectedCard) document.getElementById('card-inspector').scrollIntoView({ block: 'nearest' });
    });
    button.setAttribute('aria-controls', 'card-inspector');
    addReadableCard(button, card);
    cardButtons.push(button);
    hand.append(button);
  });

  function reset() {
    activeSeat = 0;
    selectedCard = null;
    target = null;
    log.replaceChildren();
    addText(log, 'li', 'Cảnh sát trưởng đi trước.');
    renderSeats();
    updateSelection();
  }

  seatCount.addEventListener('change', reset);
  document.querySelector('#reset').addEventListener('click', () => {
    seatCount.value = '6';
    reset();
  });
  document.querySelector('#end-turn').addEventListener('click', () => {
    activeSeat = (activeSeat + 1) % seatButtons.length;
    selectedCard = null;
    target = null;
    addText(log, 'li', 'Đến lượt mẫu của ' + players[activeSeat].name + '.');
    updateSelection();
  });

  const requestedSeats = new URLSearchParams(window.location.search).get('seats');
  if (['4', '5', '6', '7'].includes(requestedSeats)) seatCount.value = requestedSeats;
  reset();
}

const tableMode = new URLSearchParams(location.search).get('mode');
if (tableMode === 'practice' && typeof BangPractice === 'undefined') {
  location.replace('../');
} else if (tableMode === 'practice' || tableMode === 'online') {
  startBangPractice(tableMode === 'online');
} else {
  startTablePreview();
}
