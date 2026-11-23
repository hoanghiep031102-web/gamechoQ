function createBoardEffects() {
  const layer = document.getElementById('board-effects');
  const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const flying = new Map();
  const markers = new Map();
  const duelEvents = [];
  let duelTimer;
  let lastSeen;

  function seatPoint(index) {
    const seat = layer.parentElement.querySelector('[data-seat-index="' + index + '"] .seat');
    if (!seat) return null;
    const rect = seat.getBoundingClientRect();
    const board = layer.getBoundingClientRect();
    return { x: rect.left + rect.width / 2 - board.left, y: rect.top + rect.height / 2 - board.top };
  }

  function place(className, point) {
    const node = document.createElement('span');
    node.className = className;
    node.style.left = point.x + 'px';
    node.style.top = point.y + 'px';
    layer.append(node);
    return node;
  }

  function showMarker(visual, destination) {
    markers.get(visual.target)?.remove();
    const variant = visual.effect ? ' from-' + visual.effect : '';
    const node = place('board-marker ' + visual.kind + variant, destination);
    markers.set(visual.target, node);
    const ring = document.createElement('span');
    ring.className = 'board-marker-ring';
    const label = document.createElement('strong');
    label.textContent = visual.kind === 'hit' ? '−' + visual.amount + ' máu'
      : visual.kind === 'duel-shot' ? 'BANG! đáp trả' : practiceCards[visual.kind].name;
    node.append(ring, label);
    setTimeout(() => {
      if (markers.get(visual.target) !== node) return;
      markers.delete(visual.target);
      node.remove();
    }, 950);
  }

  function play(visual) {
    if (visual.kind === 'heal') {
      for (const target of visual.targets) {
        const point = seatPoint(target);
        if (!point) continue;
        const node = place('board-heal', point);
        node.textContent = '+' + visual.amount + ' máu';
        setTimeout(() => node.remove(), 1150);
      }
      return;
    }
    const end = seatPoint(visual.target);
    if (!end) return;
    if (visual.kind === 'duel-shot') {
      const origin = seatPoint(visual.source);
      if (origin && !motion.matches) {
        const flash = place('duel-muzzle', origin);
        setTimeout(() => flash.remove(), 220);
      }
      bangAudio.duelShot();
    }
    if (visual.kind === 'hazard-check') {
      const variant = visual.failed ? visual.effect : 'safe';
      const node = place('hazard-reveal ' + variant, end);
      const face = document.createElement('strong');
      face.textContent = visual.face || 'Hết bài';
      face.classList.toggle('red-suit', /[♥♦]$/.test(visual.face));
      node.append(face);
      const explodes = variant === 'dynamite';
      if (explodes) {
        setTimeout(() => {
          if (!node.isConnected) return;
          node.classList.add('detonated');
          bangAudio.explosion();
        }, 450);
      }
      setTimeout(() => node.remove(), explodes ? 1800 : 1450);
      return;
    }
    flying.get(visual.target)?.remove();
    flying.delete(visual.target);
    const start = Number.isInteger(visual.source) && seatPoint(visual.source);
    if (!start || motion.matches) {
      showMarker(visual, end);
      return;
    }
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const angle = Math.atan2(dy, dx);
    const streak = place('board-streak ' + visual.kind, start);
    const animation = streak.animate?.([
      { transform: 'translate(0, 0) rotate(' + angle + 'rad)', opacity: .45 },
      { transform: 'translate(' + dx + 'px, ' + dy + 'px) rotate(' + angle + 'rad)', opacity: 1 },
    ], { duration: 260, easing: 'cubic-bezier(.2,.65,.25,1)', fill: 'forwards' });
    if (!animation) {
      streak.remove();
      showMarker(visual, end);
      return;
    }
    flying.set(visual.target, streak);
    animation.finished.then(() => {
      if (!streak.isConnected) return;
      flying.delete(visual.target);
      streak.remove();
      showMarker(visual, seatPoint(visual.target) ?? end);
    }, () => streak.remove());
  }

  function playNextDuelEvent() {
    duelTimer = undefined;
    if (!duelEvents.length) return;
    const visual = duelEvents.shift();
    play(visual);
    duelTimer = setTimeout(playNextDuelEvent, visual.kind === 'hit' ? 0 : 310);
  }

  return {
    render(notices) {
      if (lastSeen !== undefined) {
        for (const { id, visual } of notices) {
          if (id <= lastSeen || !visual) continue;
          if (visual.kind === 'duel' || visual.kind === 'duel-shot' || (visual.kind === 'hit' && visual.effect === 'duel')) {
            duelEvents.push(visual);
            if (duelTimer === undefined) playNextDuelEvent();
          } else {
            play(visual);
          }
        }
      }
      lastSeen = Math.max(lastSeen ?? 0, notices.at(-1)?.id ?? 0);
    },
    reset() {
      lastSeen = undefined;
      clearTimeout(duelTimer);
      duelTimer = undefined;
      duelEvents.length = 0;
      flying.clear();
      markers.clear();
      layer.replaceChildren();
    },
  };
}
