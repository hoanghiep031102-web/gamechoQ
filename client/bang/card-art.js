const cardArtFiles = Object.fromEntries(Object.entries(bangCatalog.cards).map(([key, card]) => [card.name, key + '.png']));

function addCardArt(container, name) {
  const filename = cardArtFiles[name];
  if (!filename) return;

  const image = document.createElement('img');
  image.alt = '';
  image.className = 'card-art';
  image.addEventListener('load', () => {
    if (image.parentNode === container) container.classList.add('illustrated');
  }, { once: true });
  image.addEventListener('error', () => image.remove(), { once: true });
  container.append(image);
  image.src = 'assets/cards/' + filename;
}

function addReadableCard(button, card, face) {
  const art = document.createElement('span');
  art.className = card.blue ? 'card hand-art blue' : 'card hand-art';
  art.setAttribute('aria-hidden', 'true');
  const mark = document.createElement('span');
  mark.className = 'mark';
  mark.textContent = card.mark;
  art.append(mark);
  addCardArt(art, card.name);

  const caption = document.createElement('span');
  caption.className = 'hand-card-caption';
  const name = document.createElement('strong');
  name.textContent = card.name;
  const metadata = document.createElement('small');
  metadata.textContent = face ? card.type + ' · ' + face : card.type;
  caption.append(name, metadata);
  button.append(art, caption);
}

function showCardInspector(card, face) {
  const inspector = document.getElementById('card-inspector');
  inspector.hidden = !card;
  if (!card) return;
  const actualFace = document.getElementById('card-inspector-face');
  actualFace.textContent = face ? 'Giá trị trong ván · ' + face : '';
  actualFace.hidden = !face;
  if (inspector.dataset.card === card.name) return;

  inspector.dataset.card = card.name;
  const art = document.getElementById('card-inspector-art');
  art.classList.remove('illustrated');
  art.classList.toggle('blue', Boolean(card.blue));
  const mark = document.createElement('span');
  mark.className = 'mark';
  mark.textContent = card.mark;
  art.replaceChildren(mark);
  addCardArt(art, card.name);
  document.getElementById('card-inspector-type').textContent = card.type;
  document.getElementById('card-inspector-name').textContent = card.name;
  document.getElementById('card-inspector-description').textContent = card.detail;
}

function showDrawAnimation(cards) {
  if (!cards.length) return;
  bangAudio.deal(cards.length);
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  const pile = document.getElementById('deck-back').getBoundingClientRect();
  const positions = cards.map((card) => card.getBoundingClientRect());
  cards.forEach((card, index) => {
    const destination = positions[index];
    const x = pile.left + pile.width / 2 - destination.left - destination.width / 2;
    const y = pile.top + pile.height / 2 - destination.top - destination.height / 2;
    const animation = card.animate?.([
      { opacity: 0, translate: x + 'px ' + y + 'px', rotate: '-12deg', scale: .52 },
      { opacity: 1, translate: '0 0', rotate: '0deg', scale: 1 },
    ], {
      duration: 330,
      delay: Math.min(index, 6) * 65,
      easing: 'cubic-bezier(.2,.7,.3,1)',
      fill: 'backwards',
    });
    if (!animation) return;
    card.disabled = true;
    card.classList.add('dealing');
    const finish = () => {
      card.disabled = false;
      card.classList.remove('dealing');
    };
    animation.finished.then(finish, finish);
  });
}
