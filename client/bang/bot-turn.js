const botCards = typeof module !== 'undefined' && module.exports ? require('./card-catalog').cards : bangCatalog.cards;

function runBotTurn(game, turnFlow) {
  if (turnFlow.pendingStartCheck(game)) {
    game.chooseCard(game.active, 'flip');
    return;
  }
  if (game.characterChoice) {
    const choice = game.characterChoice;
    const index = choice.target;
    const cards = turnFlow.characterChoices(game, choice);
    if (choice.kind === 'sid-rescue' && game.heal(index, game.players[index].hand.slice(0, 2).map((card) => card.id))) return;
    let selected = cards[0];
    if (choice.kind === 'luckyduke') {
      selected = cards.find((card) => turnFlow.drawCheckSucceeds(choice.check, card.face)) ?? selected;
    } else if (choice.kind === 'jessejones' || choice.kind === 'pedroramirez') {
      selected = cards[1] ?? selected;
    }
    turnFlow.chooseCharacterCard(game, index, selected.id);
    return;
  }
  if (game.pending) {
    const index = game.pending.target;
    const choice = game.cardChoices(game.pending)[0];
    if (choice) {
      game.chooseCard(index, choice.id);
      return;
    }
    if (game.useBarrel(index)) return;
    if (game.useBarrel(index, 'jourdonnais')) return;
    const response = game.players[index].hand.find((card) => game.canPlay(index, card));
    if (response) game.play(index, response);
    else if (game.players[index].health === 1
      && game.heal(index, game.players[index].hand.slice(0, 2).map((card) => card.id))) return;
    else game.takeHit(index);
    return;
  }
  const player = game.players[game.active];
  if (game.phase === 'discard') {
    if (player.hand.length > player.health) game.play(game.active, player.hand[0]);
    else game.endTurn(game.active);
    return;
  }
  if (player.health <= 2 && game.heal(game.active, player.hand.slice(0, 2).map((card) => card.id))) return;
  const support = player.hand.find((card) => {
    if (!game.canPlay(game.active, card)) return false;
    const info = botCards[card.key];
    if (info.range) return !game.weapon(player) || info.range > game.range(player);
    if (card.key === 'saloon') return player.health < player.maxHealth;
    if (card.key === 'beer') return player.health < player.maxHealth && game.living().length > 2;
    return info.draw || ['beer', 'scope', 'mustang', 'barrel', 'dynamite', 'generalstore', 'gatling', 'indians'].includes(card.key);
  });
  if (support) {
    game.play(game.active, support);
    return;
  }
  const bang = player.hand.find((card) => game.effectiveCard(player, card.key) === 'bang');
  const candidates = game.targets().filter((target) => player.role !== 'deputy' || target.role !== 'sheriff');
  const sheriff = candidates.find((target) => target.role === 'sheriff');
  const target = player.role === 'outlaw' && sheriff
    ? sheriff : candidates[Math.floor(game.random() * candidates.length)];
  if (target && game.play(game.active, bang, game.players.indexOf(target))) return;
  const interaction = player.hand.find((card) => ['jail', 'panic', 'catbalou', 'duel'].includes(card.key)
    && game.canPlay(game.active, card) && (card.key !== 'duel' || bang));
  if (interaction) {
    const legal = game.targets(interaction.key);
    const target = legal.find((candidate) => candidate.role !== 'sheriff') ?? legal[0];
    if (game.play(game.active, interaction, game.players.indexOf(target))) return;
  }
  game.endTurn(game.active);
}

if (typeof module !== 'undefined' && module.exports) module.exports = runBotTurn;
