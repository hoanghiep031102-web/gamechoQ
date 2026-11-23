function createGameNotices() {
  const banner = document.getElementById('response-banner');
  const title = document.getElementById('response-title');
  const emblem = document.getElementById('response-emblem');
  const label = document.getElementById('response-label');
  const instructions = document.getElementById('response-instructions');
  const jump = document.getElementById('response-jump');
  const stack = document.getElementById('event-toasts');
  const turnNotice = document.getElementById('turn-notice');
  const visible = new Map();
  let lastSeen;
  let lastPrompt;
  let turnTimeout;
  const symbols = { danger: '✹', elimination: '✹', success: '✓', info: '✦' };

  function clearTurnNotice() {
    clearTimeout(turnTimeout);
    turnNotice.replaceChildren();
  }

  function removeToast(node) {
    clearTimeout(visible.get(node));
    visible.delete(node);
    node.remove();
  }

  function reset() {
    lastSeen = undefined;
    lastPrompt = undefined;
    banner.hidden = true;
    clearTurnNotice();
    bangAudio.clearNotice();
    for (const node of visible.keys()) removeToast(node);
  }

  function showToast(event) {
    if (visible.size === 3) removeToast(visible.keys().next().value);
    const node = document.createElement('div');
    const life = event.direct ? 8000 : 5500;
    node.className = 'event-toast ' + event.tone + (event.direct ? ' direct' : '');
    node.style.setProperty('--notice-life', life + 'ms');
    const icon = document.createElement('span');
    icon.className = 'notice-emblem';
    icon.setAttribute('aria-hidden', 'true');
    icon.textContent = symbols[event.tone] ?? symbols.info;
    const message = document.createElement('p');
    message.textContent = event.message;
    node.append(icon, message);
    stack.append(node);
    visible.set(node, setTimeout(() => {
      node.classList.add('leaving');
      visible.set(node, setTimeout(() => removeToast(node), 220));
    }, life));
  }

  function renderPrompt(state) {
    const { effect } = state;
    const ownAction = effect?.target === state.index && !state.winner;
    banner.hidden = !ownAction;
    if (!ownAction) {
      lastPrompt = undefined;
      return;
    }

    const name = effect.name ?? practiceCards[effect.kind].name;
    const source = state.players[effect.source]?.name;
    const responseName = practiceCards[state.responseCard]?.name;
    let heading = name;
    let guidance = effect.instruction ?? 'Chọn một lá trong số các lá bên dưới.';
    let destination = 'effect-panel';
    if (responseName) {
      heading = source ? source + ' dùng ' + name : name;
      const options = [];
      if (state.hand.some((card) => card.playable && card.as === state.responseCard)) {
        options.push(state.responseCard === 'bang' ? 'Bỏ một lá BANG!' : 'Dùng Missed! để né');
      }
      if (state.canUseBarrel) options.push('Dùng Barrel');
      if (state.canUseJourdonnais) options.push('Dùng kỹ năng Jourdonnais');
      if (state.canHeal) options.push('Hồi máu bằng Sid Ketchum');
      options.push(state.canRescue ? 'Uống Beer để sống sót' : 'Chịu đòn');
      guidance = options.join(' · ');
      if (state.dodgesNeeded > 1) guidance = 'Cần ' + state.dodgesNeeded + ' lần né · ' + guidance;
      destination = 'quick-response';
    }
    if (state.paused) guidance = 'Tạm dừng. Đang chờ người chơi kết nối lại.';
    banner.classList.toggle('under-attack', Boolean(responseName));
    const caption = responseName ? 'Cần phản hồi' : 'Đến lượt bạn chọn bài';
    if (label.textContent !== caption) label.textContent = caption;
    emblem.textContent = responseName ? symbols.danger : symbols.info;
    if (title.textContent !== heading) title.textContent = heading;
    if (instructions.textContent !== guidance) instructions.textContent = guidance;
    jump.hidden = effect.choices.some((choice) => choice.id === 'flip');
    jump.textContent = responseName ? 'Đến phần phản hồi' : 'Đến phần chọn bài';
    jump.dataset.destination = destination;
    const promptKey = [effect.kind, effect.source, effect.alertId].join(':');
    if (promptKey === lastPrompt || state.paused) return;
    lastPrompt = promptKey;
    return responseName ? 'danger' : 'info';
  }

  jump.addEventListener('click', () => {
    const destination = document.getElementById(jump.dataset.destination);
    destination?.scrollIntoView({ block: 'start' });
    destination?.focus({ preventScroll: true });
  });

  return {
    reset,
    render(state) {
      const promptSound = renderPrompt(state);
      const events = state.notices;
      const promptId = state.effect?.target === state.index ? state.effect.alertId : undefined;
      const latestTurn = state.winner ? undefined : events.findLast((event) => event.tone === 'turn');
      const turn = latestTurn?.id > (lastSeen ?? 0) ? latestTurn : undefined;
      const incoming = lastSeen === undefined ? [] : events.filter(({ id, message, tone }) =>
        message && tone !== 'turn' && id > lastSeen && id !== promptId).slice(-3);
      incoming.forEach(showToast);
      if (turn) {
        clearTurnNotice();
        const message = document.createElement('strong');
        message.textContent = turn.message;
        turnNotice.replaceChildren(message);
        turnTimeout = setTimeout(clearTurnNotice, 2200);
      } else if (state.winner && turnNotice.firstChild) clearTurnNotice();
      const relevant = incoming.findLast((event) => event.direct) ?? incoming.at(-1);
      const healed = events.some(({ id, visual }) => lastSeen !== undefined && id > lastSeen && visual?.kind === 'heal');
      const sound = healed ? 'heal' : promptSound ?? (turn?.direct ? 'turn' : relevant?.tone);
      if (sound) bangAudio.notice(sound);
      lastSeen = Math.max(lastSeen ?? 0, events.at(-1)?.id ?? 0);
    },
  };
}
