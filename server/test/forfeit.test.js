const assert = require('node:assert/strict');
const { test } = require('node:test');
const Game = require('../../client/bang/practice-rules');

function setup() {
  return new Game(4, () => .5, [], {
    characters: ['bartcassidy', 'luckyduke', 'kitcarlson', 'vulturesam'],
  });
}

test('forfeit eliminates immediately despite Beer and inherits cards without rewarding an attacker', () => {
  const game = setup();
  game.players[1].hand.push({ id: 'rescue', key: 'beer', face: '6♥' });
  const count = game.players[1].hand.length;
  const inherited = game.players[3].hand.length;
  assert.equal(game.forfeit(1), true);
  assert.equal(game.players[1].health, 0);
  assert.equal(game.players[3].hand.length, inherited + count);
  assert.equal(game.forfeit(1), false);
});

test('forfeiting sheriff ends the game', () => {
  const game = setup();
  game.forfeit(0);
  assert.equal(game.winner, 'outlaw');
});

test('forfeiting a Duel participant releases the remaining player', () => {
  const game = setup();
  game.pending = { kind: 'duel', attacker: 0, opponent: 0, target: 1 };
  game.forfeit(1);
  assert.equal(game.pending, null);
});

test('forfeiting current player skips to a living seat', () => {
  const game = setup();
  game.active = 1;
  game.forfeit(1);
  assert.equal(game.active, 2);
  assert.equal(game.characterChoice?.target, 2);
});

test('forfeiting General Store selector advances the choice', () => {
  const game = setup();
  game.openStore(0);
  game.chooseCard(0, game.pending.cards[0].id);
  assert.equal(game.pending.target, 1);
  game.forfeit(1);
  assert.equal(game.pending.target, 2);
});
