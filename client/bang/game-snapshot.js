const snapshotCharacters = typeof module !== 'undefined' && module.exports ? require('./characters').characters : bangCharacters;

// Build a separate view for each seat. Keep private hands and choices here.
function makeGameSnapshot(game, index, { responseCards, targetedCards, turnFlow }) {
  const you = game.players[index];
  const effect = game.pending;
  const choice = game.characterChoice;
  const startCheck = turnFlow.pendingStartCheck(game);
  const responseCard = !choice && effect ? responseCards[effect.kind] : null;
  const responding = effect?.target === index && Boolean(responseCard);
  const choices = effect ? game.cardChoices(effect) : [];
  const yourTurn = !choice && !effect && game.active === index && !game.winner
    && (game.phase === 'play' || game.phase === 'discard');
  const visibleChoices = choice && (choice.target === index || choice.kind === 'luckyduke')
    ? turnFlow.characterChoices(game, choice) : [];
  const choiceView = choice ? {
    kind: choice.kind,
    name: snapshotCharacters[choice.kind]?.name ?? 'Sid Ketchum',
    target: choice.target,
    instruction: turnFlow.characterInstruction(choice),
    choices: choice.kind === 'luckyduke'
      ? visibleChoices.map((card) => ({ ...card, outcome: turnFlow.luckyOutcome(choice.check, card.face) }))
      : visibleChoices,
  } : null;
  return {
    index,
    active: game.active,
    winner: game.winner,
    responding,
    responseCard: responding ? responseCard : null,
    effect: choiceView ?? (startCheck ? {
      kind: startCheck,
      target: game.active,
      instruction: startCheck === 'jail' ? 'Lật lá cơ để thoát tù.' : 'Lật 2–9 bích sẽ làm Dynamite phát nổ.',
      choices: game.active === index ? [{ id: 'flip', label: 'Lật bài kiểm tra' }] : [],
    } : null) ?? (effect ? {
      kind: effect.kind,
      target: effect.target,
      source: effect.kind === 'duel' ? effect.opponent : effect.attacker,
      alertId: effect.alertId,
      victim: effect.kind === 'catbalou' && effect.target === index ? effect.victim : undefined,
      instruction: effect.kind === 'catbalou' && effect.target === index
        ? 'Bấm một trang bị trước mặt mục tiêu rồi chọn Hủy, hoặc chọn một lá trong phần bên dưới.' : undefined,
      choices: effect.kind === 'generalstore' || effect.target === index ? choices : [],
    } : null),
    dodgesNeeded: responding && responseCard === 'missed' ? effect.dodges ?? 1 : 0,
    yourTurn,
    discarding: yourTurn && game.phase === 'discard',
    canRescue: responding && you.health === 1 && game.living().length > 2
      && you.hand.some((card) => card.key === 'beer'),
    canUseBarrel: game.canUseBarrel(index),
    canUseJourdonnais: game.canUseBarrel(index, 'jourdonnais'),
    canHeal: game.canHeal(index),
    hand: you.hand.map((card) => {
      const playable = game.canPlay(index, card);
      const effective = game.effectiveCard(you, card.key);
      return {
        ...card,
        playable,
        as: playable && game.phase === 'play' ? effective : card.key,
        targets: playable && !effect && game.phase === 'play' && targetedCards.has(effective)
          ? game.targets(effective).map((target) => game.players.indexOf(target)) : null,
        blockedReason: !playable && yourTurn && game.phase === 'play' && effective === 'bang'
          ? game.bangBlockReason(index) : null,
      };
    }),
    drawCount: game.deck.length,
    discardCount: game.discard.length,
    log: game.log.slice(-50),
    notices: game.notices.map(({ id, message, tone, recipient, personal, visual }) => ({
      id, tone, direct: recipient === index,
      message: recipient === index ? personal ?? message : message,
      visual,
    })),
    players: game.players.map((player, seat) => ({
      name: player.name,
      character: player.character,
      maxHealth: player.maxHealth,
      health: player.health,
      handCount: player.hand.length,
      equipment: player.equipment.map((card) => card.key),
      range: game.range(player),
      role: seat === index || player.role === 'sheriff' || !player.health || game.winner ? player.role : null,
    })),
  };
}

if (typeof module !== 'undefined' && module.exports) module.exports = makeGameSnapshot;
