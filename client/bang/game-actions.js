function applyBangAction(game, seat, { action, cardId, target, choice, cards }) {
  switch (action) {
    case 'play': {
      const card = game.players[seat].hand.find(({ id }) => id === cardId);
      const targetSeat = Number.isInteger(target) ? target : undefined;
      return game.play(seat, card, targetSeat);
    }
    case 'hit':
      return game.takeHit(seat);
    case 'barrel':
      return game.useBarrel(seat);
    case 'jourdonnais':
      return game.useBarrel(seat, 'jourdonnais');
    case 'heal':
      return game.heal(seat, cards);
    case 'discard':
      return game.discardAndEnd(seat, cards);
    case 'choose':
      return game.chooseCard(seat, choice);
    case 'end': {
      const previousPhase = game.phase;
      return game.endTurn(seat) || game.phase !== previousPhase;
    }
    default:
      return false;
  }
}

if (typeof module !== 'undefined' && module.exports) module.exports = applyBangAction;
