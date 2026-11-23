const assert = require('node:assert/strict');
const { test } = require('node:test');
const Game = require('../../client/bang/practice-rules');
const applyAction = require('../../client/bang/game-actions');

function setup() {
  return new Game(4, () => 0.5, [], { characters: ['willythekid', 'slab', 'luckyduke', 'rosedoolan'] });
}

test('ending an over-limit turn asks for exactly the excess cards and discards them together', () => {
  const game = setup();
  const player = game.players[0];
  const original = [...player.hand];
  assert.equal(game.view(0).notices.find(({ tone }) => tone === 'turn').message, 'Đến lượt bạn!');
  assert.equal(original.length, player.health + 2);
  assert.equal(applyAction(game, 0, { action: 'end' }), true);
  assert.equal(game.view(0).discarding, true);
  assert.equal(game.view(1).discarding, false);
  const chosen = [original[0], original.at(-1)];
  assert.equal(applyAction(game, 0, { action: 'discard', cards: chosen.map(({ id }) => id) }), true);
  assert.deepEqual(player.hand, original.slice(1, -1));
  assert.deepEqual(game.discard, chosen);
  assert.equal(game.active, 1);
  assert.equal(game.view(0).notices.findLast(({ tone }) => tone === 'turn').message, 'Đến lượt ' + game.players[1].name + '.');
  assert.equal(game.view(1).notices.findLast(({ tone }) => tone === 'turn').message, 'Đến lượt bạn!');
});

test('discard batches reject wrong timing, seats, counts, duplicates, and cards without mutating the hand', () => {
  const game = setup();
  const original = [...game.players[0].hand];
  const [first, second, third] = original.map(({ id }) => id);
  const discard = (seat, cards) => applyAction(game, seat, { action: 'discard', cards });
  assert.equal(discard(0, [first, second]), false);
  applyAction(game, 0, { action: 'end' });
  assert.equal(discard(1, [first, second]), false);
  for (const cards of [[first], [first, first], [first, 'missing'], [first, second, third], null]) {
    assert.equal(discard(0, cards), false);
  }
  assert.deepEqual(game.players[0].hand, original);
  assert.deepEqual(game.discard, []);
  assert.equal(game.active, 0);
});
