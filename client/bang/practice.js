const practiceCards = bangCatalog.cards;
const practiceCharacters = bangCharacters;
const practiceRoles = bangRoles;

function startBangPractice(online = false) {
  const get = (id) => document.getElementById(id);
  const seats = get('seats');
  const ownSeatSlot = get('own-seat-slot');
  const playOnTable = get('play-on-table');
  const hand = get('hand');
  const handCards = new Map();
  const log = get('log');
  const detail = get('detail');
  const seatCount = get('seat-count');
  const endTurn = get('end-turn');
  const useCard = get('use-card');
  const takeHit = get('take-hit');
  const useBarrel = get('use-barrel');
  const useJourdonnais = get('use-jourdonnais');
  const healSelect = get('heal-select');
  const healConfirm = get('heal-confirm');
  const healCards = new Set();
  const characterSelect = get('practice-character');
  const cardChoiceDialog = get('card-choice-dialog');
  const discardDialog = get('discard-dialog');
  const discardConfirm = get('discard-confirm');
  const discardCards = new Set();
  const discardOptions = get('discard-options');
  const notices = createGameNotices();
  const boardEffects = createBoardEffects();
  let game;
  let practiceSeat;
  let state;
  let selectedId;
  let timer;
  let previousLog = [];
  let error = '';
  let sendOnlineAction;
  let choicePromptOpen = false;
  let displayedCards = '';
  let displayedDiscardHand = '';
  let submittingDiscard = false;
  let choosingHeal = false;

  get('mode-label').textContent = online ? 'PHÒNG ONLINE' : 'CHƠI VỚI MÁY';
  get('practice-actions').hidden = false;
  get('character-summary').hidden = false;
  seats.closest('.table').classList.add('live-table');
  ownSeatSlot.hidden = false;
  playOnTable.hidden = false;
  seatCount.value = '4';
  const goals = {
    sheriff: 'Loại hết Tội phạm và Kẻ phản bội.',
    deputy: 'Bảo vệ Cảnh sát trưởng và giúp họ thắng.',
    outlaw: 'Loại Cảnh sát trưởng.',
    renegade: 'Trở thành người duy nhất còn lại.',
  };
  const results = {
    sheriff: 'Phe Cảnh sát thắng',
    outlaw: 'Phe Tội phạm thắng',
    renegade: 'Kẻ phản bội thắng',
  };

  function element(tag, value, className) {
    const node = document.createElement(tag);
    node.textContent = value;
    if (className) node.className = className;
    return node;
  }

  function button(className, action) {
    const node = element('button', '', className);
    node.type = 'button';
    node.addEventListener('click', action);
    return node;
  }

  const { renderSeat, inspectCharacter, updateEquipmentAction } = createSeatRenderer({
    get, element, button, online, onTarget: (index) => act('play', index),
    equipmentDiscardId(index, key) {
      const effect = state?.effect;
      if (state?.paused || state?.winner || effect?.kind !== 'catbalou'
        || effect.target !== state.index || effect.victim !== index) return undefined;
      return effect.choices.find((card) => card.key === key)?.id;
    },
    onEquipmentDiscard: (id) => act('choose', id),
  });

  function act(action, value, cardId = selectedId) {
    if (!state || state.paused) return;
    const request = {
      version: state.version, action, cardId,
      target: action === 'play' ? value : undefined,
      choice: action === 'choose' ? value : undefined,
      cards: action === 'heal' || action === 'discard' ? value : undefined,
    };
    if (online) {
      sendOnlineAction(request);
    } else {
      applyBangAction(game, practiceSeat, request);
      updatePractice();
    }
    selectedId = undefined;
    choosingHeal = false;
    healCards.clear();
    render();
  }

  function renderQuickResponse() {
    const { responding, responseCard, paused, dodgesNeeded, effect } = state;
    get('quick-response').hidden = !responding;
    if (!responding) return;
    get('quick-response-title').textContent = 'Phản hồi ' + practiceCards[effect.kind].name
      + (dodgesNeeded > 1 ? ' · Cần ' + dodgesNeeded + ' lần né' : '');
    const buttons = [];
    const shown = new Set();
    for (const card of state.hand) {
      if (!card.playable || card.as !== responseCard || shown.has(card.key)) continue;
      shown.add(card.key);
      const option = button('primary', () => act('play', undefined, card.id));
      const name = practiceCards[card.key].name;
      const responseName = practiceCards[responseCard].name;
      option.textContent = card.key !== responseCard ? 'Dùng ' + name + ' như ' + responseName
        : (responseCard === 'bang' ? 'Bỏ ' : 'Dùng ') + name;
      option.disabled = Boolean(paused);
      buttons.push(option);
    }
    get('quick-response-cards').replaceChildren(...buttons);
  }

  function renderDiscard() {
    const required = state?.discarding ? state.hand.length - state.players[state.index].health : 0;
    if (required <= 0) {
      discardCards.clear();
      displayedDiscardHand = '';
    }
    if (required <= 0 || state.paused || get('role-reveal').open) {
      if (discardDialog.open) discardDialog.close();
      return;
    }

    const handIds = state.hand.map(({ id }) => id);
    for (const id of discardCards) if (!handIds.includes(id)) discardCards.delete(id);
    while (discardCards.size > required) discardCards.delete([...discardCards].at(-1));
    const handKey = JSON.stringify(handIds);
    if (handKey !== displayedDiscardHand) {
      displayedDiscardHand = handKey;
      discardOptions.replaceChildren(...state.hand.map((card) => {
        const node = button('hand-card', () => {
          if (discardCards.has(card.id)) discardCards.delete(card.id);
          else discardCards.add(card.id);
          get('discard-feedback').textContent = '';
          renderDiscard();
        });
        node.dataset.card = card.id;
        addReadableCard(node, practiceCards[card.key], card.face);
        return node;
      }));
    }
    get('discard-instruction').textContent = 'Chọn ' + required + ' lá để bỏ. Cuối lượt, bạn chỉ được giữ tối đa '
      + state.players[state.index].health + ' lá bằng số máu hiện tại.';
    for (const node of discardOptions.children) {
      const selected = discardCards.has(node.dataset.card);
      node.setAttribute('aria-pressed', String(selected));
      node.disabled = submittingDiscard || (!selected && discardCards.size === required);
    }
    discardConfirm.disabled = submittingDiscard || discardCards.size !== required;
    discardConfirm.textContent = 'Bỏ bài và kết thúc lượt · ' + discardCards.size + '/' + required;
    if (!discardDialog.open) {
      get('discard-feedback').textContent = '';
      discardDialog.showModal();
    }
  }

  function renderEffect(effect, players, ownSeat, paused) {
    const panel = get('effect-panel');
    const canChoose = effect?.target === ownSeat && !paused;
    const hasCards = Boolean(effect?.choices.length) && ['generalstore', 'kitcarlson', 'luckyduke'].includes(effect.kind);
    const showDialog = hasCards && canChoose && !get('role-reveal').open;
    if (!showDialog && cardChoiceDialog.open) cardChoiceDialog.close();
    if (!showDialog) displayedCards = '';
    panel.hidden = showDialog || !effect?.choices.length || effect.choices.some((card) => card.id === 'flip');
    if (showDialog) {
      get('card-choice-title').textContent = effect.name ?? practiceCards[effect.kind].name;
      get('card-choice-instruction').textContent = effect.instruction ?? 'Chọn một lá để đưa vào tay.';
      const cardKey = JSON.stringify([effect.kind, effect.choices]);
      if (cardKey !== displayedCards) {
        displayedCards = cardKey;
        const options = get('card-choice-options');
        options.replaceChildren(...effect.choices.map((card) => {
          const node = button('hand-card', () => act('choose', card.id));
          const info = practiceCards[card.key];
          addReadableCard(node, info, card.face);
          node.append(element('span', card.outcome ?? info.detail, 'card-choice-outcome'));
          return node;
        }));
        if (cardChoiceDialog.open) options.querySelector('button')?.focus();
      }
      if (!cardChoiceDialog.open) cardChoiceDialog.showModal();
    }
    if (panel.hidden) {
      choicePromptOpen = false;
      return;
    }

    get('effect-title').textContent = (effect.name ?? practiceCards[effect.kind].name) + ' · ' +
      (effect.target === ownSeat ? 'Chọn bài' : 'Chờ ' + players[effect.target].name + ' chọn bài');
    const instructions = get('effect-instructions');
    instructions.textContent = effect.instruction ?? '';
    instructions.hidden = !effect.instruction;
    get('effect-choices').replaceChildren(...effect.choices.map((card) => {
      const info = practiceCards[card.key];
      const node = button(hasCards ? 'hand-card' : '', () => act('choose', card.id));
      node.disabled = !canChoose;
      if (hasCards) {
        addReadableCard(node, info, card.face);
      } else {
        node.textContent = card.label ?? info?.name ?? 'Một lá ngẫu nhiên từ tay đối thủ';
      }
      return node;
    }));
    if (canChoose && !choicePromptOpen) panel.scrollIntoView({ block: 'nearest' });
    choicePromptOpen = canChoose;
  }

  function renderHand() {
    const focusedCard = document.activeElement?.dataset.card;
    const incoming = [];
    const next = state.hand.map((card) => {
      let node = handCards.get(card.id);
      if (!node) {
        const info = practiceCards[card.key];
        node = button('hand-card', () => {
          if (choosingHeal) {
            if (healCards.has(card.id)) healCards.delete(card.id);
            else if (healCards.size < 2) healCards.add(card.id);
            render();
            return;
          }
          selectedId = card.id === selectedId ? undefined : card.id;
          error = '';
          render();
          if (selectedId) {
            const selected = state.hand.find(({ id }) => id === selectedId);
            const panel = selected?.targets?.length || selected?.blockedReason ? 'target-picker' : 'card-inspector';
            get(panel).scrollIntoView({ block: 'nearest' });
          }
        });
        node.dataset.card = card.id;
        node.setAttribute('aria-controls', 'card-inspector');
        addReadableCard(node, info, card.face);
        handCards.set(card.id, node);
        incoming.push(node);
      }
      node.setAttribute('aria-pressed', String(choosingHeal ? healCards.has(card.id) : selectedId === card.id));
      node.title = card.as !== card.key ? 'Dùng như ' + practiceCards[card.as].name : practiceCards[card.key].name;
      return node;
    });
    const present = new Set(state.hand.map((card) => card.id));
    for (const id of handCards.keys()) {
      if (!present.has(id)) handCards.delete(id);
    }
    if (hand.children.length !== next.length || next.some((node, i) => hand.children[i] !== node)) {
      hand.replaceChildren(...next);
      handCards.get(focusedCard)?.focus({ preventScroll: true });
    }
    hand.classList.toggle('fan-hand', next.length > 1 && next.length <= 7);
    next.forEach((node, index) => {
      const offset = index - (next.length - 1) / 2;
      node.style.setProperty('--fan-angle', (offset * 2) + 'deg');
      node.style.setProperty('--fan-depth', (offset * offset * 1.4) + 'px');
    });
    showDrawAnimation(incoming);
  }

  function render() {
    if (!state) return;
    updateEquipmentAction();
    const { players, index: ownSeat, winner, effect, responding, yourTurn, discarding, paused = false } = state;
    const you = players[ownSeat];
    if (!state.canHeal || paused) {
      choosingHeal = false;
      healCards.clear();
    }
    for (const id of healCards) if (!state.hand.some((card) => card.id === id)) healCards.delete(id);
    const character = practiceCharacters[you.character];
    const selected = state.hand.find((card) => card.id === selectedId);
    const playable = selected?.playable && !paused && !choosingHeal;
    const chooseTarget = playable && selected.targets?.length > 0;
    const targets = new Set(chooseTarget ? selected.targets : []);

    get('turn').textContent = winner
      ? results[winner]
      : effect ? (effect.name ?? practiceCards[effect.kind].name) + ' · ' + players[effect.target].name
        : 'Lượt · ' + players[state.active].name;
    get('your-role').textContent = practiceRoles[you.role];
    get('role-goal').textContent = goals[you.role];
    get('your-character').textContent = character.name;
    get('character-ability').textContent = character.detail;
    get('draw-pile').textContent = 'Bài rút · ' + state.drawCount;
    get('discard-pile').textContent = 'Bài bỏ · ' + state.discardCount;
    notices.render(state);

    const activeSeat = winner ? undefined : effect?.target ?? state.active;
    const opponents = [];
    for (let offset = 1; offset < players.length; offset++) {
      const index = (ownSeat + offset) % players.length;
      opponents.push(renderSeat(players[index], index, ownSeat, players.length, targets, activeSeat));
    }
    seats.replaceChildren(...opponents);
    ownSeatSlot.replaceChildren(renderSeat(you, ownSeat, ownSeat, players.length, targets, activeSeat));
    boardEffects.render(state.notices);

    renderHand();
    renderQuickResponse();
    const targetPicker = get('target-picker');
    const blockedReason = !paused && selected?.blockedReason;
    targetPicker.hidden = !chooseTarget && !blockedReason;
    get('target-hint').textContent = chooseTarget ? 'Chọn mục tiêu cho ' + practiceCards[selected.as].name : blockedReason || '';
    get('target-buttons').replaceChildren(...Array.from(targets, (index) => {
      const target = button('', () => act('play', index));
      target.textContent = players[index].name;
      return target;
    }));
    renderEffect(effect, players, ownSeat, paused);
    renderDiscard();
    showCardInspector(selected && practiceCards[selected.key], selected?.face);

    endTurn.disabled = !yourTurn || paused;
    useCard.disabled = !playable || chooseTarget;
    useCard.textContent = discarding || state.responseCard === 'bang' ? 'Bỏ lá đã chọn'
      : selected && selected.as !== selected.key ? 'Dùng như ' + practiceCards[selected.as].name : 'Đánh lá này';
    const flip = effect?.choices.find((choice) => choice.id === 'flip');
    playOnTable.disabled = flip ? paused : !playable || chooseTarget || discarding || responding;
    playOnTable.textContent = flip?.label ?? (chooseTarget ? 'Chọn mục tiêu' : 'Đánh bài');
    takeHit.hidden = !responding;
    takeHit.disabled = paused;
    useBarrel.hidden = !state.canUseBarrel;
    useBarrel.disabled = paused;
    useJourdonnais.hidden = !state.canUseJourdonnais;
    useJourdonnais.disabled = paused;
    healSelect.hidden = !state.canHeal;
    healSelect.disabled = paused;
    healSelect.textContent = choosingHeal ? 'Hủy chọn bài hồi máu' : 'Dùng Sid Ketchum';
    healConfirm.hidden = !choosingHeal;
    healConfirm.disabled = healCards.size !== 2;
    healConfirm.textContent = 'Hồi 1 máu · ' + healCards.size + '/2 lá';
    takeHit.textContent = state.canRescue ? 'Uống Beer để sống sót' : 'Chịu đòn';
    if (error) detail.textContent = error;
    else if (paused) detail.textContent = 'Tạm dừng. Đang chờ người chơi kết nối lại.';
    else if (winner) detail.textContent = online ? 'Ván đã kết thúc. Chủ phòng có thể mở ván mới.' : 'Ván đã kết thúc. Bấm Đặt lại để chơi tiếp.';
    else if (choosingHeal) detail.textContent = 'Chọn đúng hai lá trên tay để hồi 1 máu.';
    else if (responding) {
      if (state.responseCard === 'bang') detail.textContent = 'Bỏ một lá BANG! hoặc chịu đòn.';
      else if (state.dodgesNeeded > 1) detail.textContent = 'Cần thêm ' + state.dodgesNeeded + ' lần né để tránh đòn của Slab.';
      else detail.textContent = state.canUseBarrel || state.canUseJourdonnais
        ? 'Thử lật bài để né, dùng Missed! hoặc chịu đòn.'
        : 'Dùng Missed! để né hoặc chấp nhận mất máu.';
    } else if (effect) detail.textContent = effect.target === ownSeat
      ? effect.instruction ?? 'Chọn một lá trong số các lá bên dưới.'
      : 'Đang chờ ' + players[effect.target].name + ' chọn bài.';
    else if (discarding) detail.textContent = 'Bỏ thêm ' + (state.hand.length - you.health) + ' lá, rồi kết thúc lượt.';
    else if (chooseTarget) detail.textContent = 'Chọn một người đang được đánh dấu để dùng ' + practiceCards[selected.as].name + '.';
    else if (selected && !playable) detail.textContent = selected.blockedReason || 'Chưa thể dùng lá này.';
    else if (selected) detail.textContent = 'Bạn có thể đánh lá này.';
    else detail.textContent = 'Chọn một lá trên tay để xem cách dùng.';

    if (state.log.length !== previousLog.length || state.log.some((message, i) => message !== previousLog[i])) {
      log.replaceChildren(...state.log.map((message) => element('li', message)));
      log.scrollTop = log.scrollHeight;
      previousLog = state.log;
    }
  }

  function updatePractice() {
    state = game.view(practiceSeat);
    const waitingForYou = state.yourTurn || state.effect?.target === practiceSeat;
    if (timer === undefined && !state.winner && !waitingForYou) {
      timer = setTimeout(() => {
        timer = undefined;
        game.botStep();
        updatePractice();
        render();
      }, 475);
    }
  }

  function reset() {
    clearTimeout(timer);
    timer = undefined;
    selectedId = undefined;
    choosingHeal = false;
    healCards.clear();
    handCards.clear();
    notices.reset();
    boardEffects.reset();
    const count = Number(seatCount.value);
    practiceSeat = Math.floor(Math.random() * count);
    const names = Array.from({ length: count }, (_, index) =>
      index === practiceSeat ? 'Bạn' : 'Máy ' + ((index - practiceSeat + count) % count));
    state = undefined;
    renderEffect(null, [], practiceSeat, false);
    renderDiscard();
    const options = { seat: practiceSeat, character: characterSelect.value };
    const offers = dealCharacterOffers(count, Math.random, options);
    const draft = get('practice-draft');
    renderCharacterPicker(get('practice-draft-options'), {
      options: offers[practiceSeat], assetPath: 'assets/characters/',
    }, (character) => {
      const characters = offers.map((pair, index) => index === practiceSeat ? character : pair[Math.floor(Math.random() * 2)]);
      draft.close();
      game = new BangPractice(count, Math.random, names, { characters });
      updatePractice();
      render();
    });
    if (!draft.open) draft.showModal();
  }

  useCard.addEventListener('click', () => act('play'));
  playOnTable.addEventListener('click', () => {
    if (state?.effect?.choices.some((choice) => choice.id === 'flip')) act('choose', 'flip');
    else act('play');
  });
  takeHit.addEventListener('click', () => act('hit'));
  useBarrel.addEventListener('click', () => act('barrel'));
  useJourdonnais.addEventListener('click', () => act('jourdonnais'));
  healSelect.addEventListener('click', () => {
    choosingHeal = !choosingHeal;
    selectedId = undefined;
    healCards.clear();
    render();
  });
  healConfirm.addEventListener('click', () => act('heal', [...healCards]));
  get('your-character').addEventListener('click', () => {
    if (state) inspectCharacter(state.players[state.index]);
  });
  endTurn.addEventListener('click', () => act('end'));
  cardChoiceDialog.addEventListener('cancel', (event) => event.preventDefault());
  discardDialog.addEventListener('cancel', (event) => event.preventDefault());
  discardConfirm.addEventListener('click', () => {
    submittingDiscard = online;
    act('discard', [...discardCards]);
  });
  if (online) {
    const reveal = get('role-reveal');
    const revealKey = 'bang-role-reveal';
    const seatId = readBangSession()?.seatId;
    let acknowledged;
    let revealed;
    try {
      acknowledged = sessionStorage.getItem(revealKey);
    } catch {
      // The current page still remembers the acknowledgement.
    }
    reveal.addEventListener('close', () => {
      if (reveal.open) return;
      acknowledged = revealed;
      try {
        sessionStorage.setItem(revealKey, acknowledged);
      } catch {
        // Storage is optional for the role dialog.
      }
      render();
    });
    seatCount.disabled = true;
    get('reset').hidden = true;
    endTurn.disabled = true;
    get('your-role').textContent = 'Đang nhận vai…';
    get('role-goal').textContent = '';
    detail.textContent = 'Đang nhận dữ liệu từ phòng…';
    sendOnlineAction = connectBangTable((nextState) => {
      if (state?.match !== nextState.match) {
        selectedId = undefined;
        choosingHeal = false;
        healCards.clear();
        handCards.clear();
        discardCards.clear();
        notices.reset();
        boardEffects.reset();
      }
      state = nextState;
      submittingDiscard = false;
      seatCount.value = String(state.players.length);
      error = '';
      const role = state.players[state.index].role;
      const matchKey = seatId + ':' + state.match;
      if (!state.winner && role && matchKey !== acknowledged && matchKey !== revealed) {
        revealed = matchKey;
        get('role-reveal-name').textContent = practiceRoles[role];
        get('role-reveal-goal').textContent = goals[role];
        const character = practiceCharacters[state.players[state.index].character];
        get('role-reveal-character').textContent = character.name;
        get('role-reveal-ability').textContent = character.detail;
        get('role-reveal-visibility').textContent = role === 'sheriff'
          ? 'Cả bàn biết vai trò này. Bạn đi trước.'
          : 'Vai trò này được giữ kín khi bạn còn trong ván.';
        if (!reveal.open) reveal.showModal();
      }
      render();
    }, (message, pause) => {
      error = message;
      submittingDiscard = false;
      if (pause && state) state = { ...state, paused: true };
      if (state) render();
      else detail.textContent = message;
      if (discardDialog.open) get('discard-feedback').textContent = message;
    });
  } else {
    get('practice-draft').addEventListener('cancel', (event) => event.preventDefault());
    get('practice-character-label').hidden = false;
    for (const [key, info] of Object.entries(practiceCharacters)) {
      const option = element('option', info.name);
      option.value = key;
      characterSelect.append(option);
    }
    seatCount.addEventListener('change', reset);
    get('reset').addEventListener('click', reset);
    reset();
  }
}
