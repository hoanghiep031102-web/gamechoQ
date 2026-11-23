const turnCards = typeof module !== 'undefined' && module.exports ? require('./card-catalog').cards : bangCatalog.cards;
const turnCharacters = typeof module !== 'undefined' && module.exports ? require('./characters').characters : bangCharacters;

// Resolve start-of-turn effects before opening the draw and play phases.
function beginTurn(game) {
  game.shot = false;
  game.phase = 'start';
  game.announce('Đến lượt ' + game.players[game.active].name + '.', 'turn', game.active, 'Đến lượt bạn!');
  continueStart(game);
}

function nextTurn(game) {
  if (game.winner) return;
  game.active = game.nextPlayer(game.active);
  beginTurn(game);
}

function continueStart(game) {
  if (game.winner) return;
  if (!pendingStartCheck(game)) startDraw(game, game.active);
}

function pendingStartCheck(game) {
  if (game.phase !== 'start' || game.winner || game.pending || game.characterChoice) return null;
  const player = game.players[game.active];
  if (game.equipment(player, 'dynamite')) return 'dynamite';
  if (game.equipment(player, 'jail')) return 'jail';
  return null;
}

function checkCard(game, index, effect) {
  const player = game.players[index];
  const cards = game.drawMany(player.character === 'luckyduke' ? 2 : 1);
  if (cards.length === 2) {
    game.characterChoice = { kind: 'luckyduke', target: index, cards, check: effect };
    game.announce(player.name + ' lật 2 lá nhờ Lucky Duke.', 'info', index, 'Lucky Duke cho bạn chọn 1 trong 2 kết quả.');
    return;
  }
  game.discard.push(...cards);
  resolveCheck(game, index, effect, cards[0]?.face ?? '');
}

function drawCheckSucceeds(effect, face) {
  return effect === 'dynamite' ? !/^[2-9]♠$/.test(face) : face.endsWith('♥');
}

function luckyOutcome(effect, face) {
  const success = drawCheckSucceeds(effect, face);
  if (effect === 'dynamite') return success ? 'Chuyển Dynamite sang ghế kế' : 'Dynamite nổ · Mất 3 máu';
  if (effect === 'jail') return success ? 'Thoát Jail · Được chơi lượt này' : 'Bị giữ lại · Mất lượt';
  return success ? 'Tính 1 lần né' : 'Lật hụt · Vẫn phải phản hồi';
}

function resolveCheck(game, index, effect, face) {
  const player = game.players[index];
  const name = turnCards[effect]?.name ?? 'Jourdonnais';
  game.log.push(player.name + ' lật ' + (face || 'hết bài') + ' cho ' + name + '.');
  if (effect === 'dynamite') {
    const dynamite = game.equipment(player, 'dynamite');
    if (!drawCheckSucceeds(effect, face)) {
      game.discardEquipment(player, dynamite);
      game.announce('Dynamite phát nổ trước mặt ' + player.name + '!', 'danger', index,
        'Dynamite phát nổ trước mặt bạn!', { kind: 'hazard-check', effect, target: index, face, failed: true });
      if (player.health <= 3 && game.canHeal(index)) {
        game.characterChoice = { kind: 'sid-rescue', target: index };
        return;
      }
      finishDynamite(game, index);
      return;
    }
    player.equipment.splice(player.equipment.indexOf(dynamite), 1);
    const next = game.nextPlayer(index);
    game.players[next].equipment.push(dynamite);
    game.announce('Dynamite chuyển sang ' + game.players[next].name + '.', 'info', next,
      'Dynamite chuyển sang ghế của bạn.', { kind: 'hazard-check', effect, target: index, face, failed: false });
    continueStart(game);
  } else if (effect === 'jail') {
    const escaped = drawCheckSucceeds(effect, face);
    game.discardEquipment(player, game.equipment(player, 'jail'));
    game.announce(player.name + (escaped ? ' thoát Jail.' : ' bị Jail giữ lại và mất lượt.'), escaped ? 'success' : 'danger',
      index, escaped ? 'Bạn thoát Jail và được chơi lượt này.' : 'Bạn bị Jail giữ lại và mất lượt.',
      { kind: 'hazard-check', effect, target: index, face, failed: !escaped });
    if (escaped) startDraw(game, index);
    else nextTurn(game);
  } else if (drawCheckSucceeds(effect, face)) {
    game.blockHit(index, name);
  } else {
    game.announce(player.name + ' lật hụt ' + name + '.');
  }
}

function finishDynamite(game, index) {
  game.characterChoice = null;
  game.damage(game.players[index], 3, undefined, 'dynamite');
  game.refillSuzy();
  if (game.winner) return;
  if (game.players[index].health) continueStart(game);
  else nextTurn(game);
}

function startDraw(game, index) {
  const player = game.players[index];
  if (player.character === 'kitcarlson') {
    const cards = game.drawMany(3);
    if (cards.length > 2) {
      game.phase = 'draw';
      game.characterChoice = { kind: 'kitcarlson', target: index, cards, remaining: 2 };
      return;
    }
    player.hand.push(...cards);
  } else if ((player.character === 'jessejones' && game.living().some((other) => other !== player && other.hand.length))
    || (player.character === 'pedroramirez' && game.discard.length)) {
    game.phase = 'draw';
    game.characterChoice = { kind: player.character, target: index };
    return;
  } else if (player.character === 'blackjack') {
    const cards = game.drawMany(2);
    player.hand.push(...cards);
    const shown = cards[1];
    if (shown) {
      const bonus = /[♥♦]$/.test(shown.face);
      game.announce(player.name + ' công khai ' + turnCards[shown.key].name + ' ' + shown.face
        + (bonus ? ' và rút thêm một lá nhờ Black Jack.' : ' với Black Jack.'));
      if (bonus) game.draw(player, 1);
    }
  } else {
    game.draw(player, 2);
  }
  finishDraw(game, index);
}

function finishDraw(game, index) {
  game.characterChoice = null;
  game.phase = 'play';
  game.log.push(game.players[index].name + ' bắt đầu lượt và rút bài.');
  game.refillSuzy();
}

function characterChoices(game, choice) {
  if (choice.cards) return choice.cards;
  if (choice.kind === 'sid-rescue') return [{ id: 'continue', label: 'Tiếp tục xử lý Dynamite' }];
  const choices = [{ id: 'deck', label: 'Rút từ chồng bài' }];
  if (choice.kind === 'pedroramirez') {
    const top = game.discard.at(-1);
    if (top) choices.push({ id: 'discard', label: 'Lấy lá đã bỏ: ' + turnCards[top.key].name + ' ' + top.face });
  } else {
    game.players.forEach((player, seat) => {
      if (seat !== choice.target && player.health && player.hand.length) {
        choices.push({ id: 'player-' + seat, label: 'Lấy ngẫu nhiên từ tay ' + player.name });
      }
    });
  }
  return choices;
}

function chooseCharacterCard(game, index, id) {
  const choice = game.characterChoice;
  if (choice?.target !== index || !characterChoices(game, choice).some((card) => card.id === id)) return false;
  const player = game.players[index];
  if (choice.kind === 'luckyduke') {
    const selected = choice.cards.find((card) => card.id === id);
    game.discard.push(...choice.cards);
    game.characterChoice = null;
    resolveCheck(game, index, choice.check, selected.face);
  } else if (choice.kind === 'kitcarlson') {
    const [selected] = choice.cards.splice(choice.cards.findIndex((card) => card.id === id), 1);
    player.hand.push(selected);
    if (--choice.remaining === 0) {
      game.deck.push(...choice.cards);
      finishDraw(game, index);
    }
  } else if (choice.kind === 'sid-rescue') {
    finishDynamite(game, index);
  } else {
    const alternate = id === 'discard' ? game.discard.pop()
      : id.startsWith('player-') ? game.randomHandCard(game.players[Number(id.slice(7))]) : null;
    if (alternate) {
      player.hand.push(alternate);
      game.announce(player.name + ' dùng kỹ năng ' + turnCharacters[choice.kind].name + ' để lấy lá đầu.');
    }
    game.draw(player, alternate ? 1 : 2);
    finishDraw(game, index);
  }
  return true;
}

function characterInstruction(choice) {
  if (choice.kind === 'kitcarlson') return 'Chọn ' + choice.remaining + ' lá để giữ. Lá còn lại được đặt lên đầu chồng bài rút.';
  if (choice.kind === 'luckyduke') return 'Chọn 1 kết quả cho ' + turnCards[choice.check].name + '. Sau khi áp dụng kết quả, cả hai lá vào chồng bài bỏ.';
  if (choice.kind === 'sid-rescue') return 'Dynamite sắp gây 3 sát thương. Bạn có thể dùng kỹ năng để hồi máu trước.';
  return 'Chọn nguồn rút lá đầu.';
}

const bangTurnFlow = {
  beginTurn, checkCard, finishDynamite, characterChoices, chooseCharacterCard, characterInstruction,
  drawCheckSucceeds, luckyOutcome,
  pendingStartCheck,
};
if (typeof module !== 'undefined' && module.exports) module.exports = bangTurnFlow;
