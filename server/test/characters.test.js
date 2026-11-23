const assert = require('node:assert/strict');
const { test } = require('node:test');
const Game = require('../../client/bang/practice-rules');
const { beginTurn } = require('../../client/bang/turn-flow');

function card(key = 'bang', face = 'A♠') {
  return { key, face, id: String(++card.id) };
}
card.id = 0;

function setup(character, seat = 0) {
  const characters = ['bartcassidy', 'blackjack', 'calamityjanet', 'elgringo']
    .filter((name) => name !== character).slice(0, 3);
  characters.splice(seat, 0, character);
  const game = new Game(4, () => 0.5, [], { characters });
  for (const player of game.players) {
    player.hand = [];
    player.equipment = [];
  }
  game.deck = Array.from({ length: 12 }, () => card());
  game.discard = [];
  game.active = 0;
  game.phase = 'play';
  game.characterChoice = null;
  return game;
}

function attack(game, key, from = 0, to = 1) {
  const shot = card(key);
  game.active = from;
  game.players[from].hand.push(shot);
  assert.equal(game.play(from, shot, to), true);
}

test('Bart Cassidy draws three cards after surviving Dynamite', () => {
  const game = setup('bartcassidy');
  game.players[0].equipment.push(card('dynamite'));
  game.deck.push(card('panic', '2♠'));
  beginTurn(game);
  assert.equal(game.chooseCard(0, 'flip'), true);
  assert.equal(game.players[0].health, 2);
  assert.equal(game.players[0].hand.length, 5);
});

test('Black Jack reveals the second card and draws a third only on red', () => {
  for (const face of ['5♦', '5♣']) {
    const game = setup('blackjack');
    game.deck.push(card('panic', face), card('bang', '3♣'));
    beginTurn(game);
    assert.equal(game.players[0].hand.length, face === '5♦' ? 3 : 2);
    assert.match(game.view(1).log.join('\n'), new RegExp(face));
  }
});

test('Calamity Janet can shoot with Missed! and answer Duel with Missed!', () => {
  const game = setup('calamityjanet');
  attack(game, 'missed');
  assert.equal(game.pending.kind, 'bang');
  game.takeHit(1);
  attack(game, 'duel', 1, 0);
  const missed = card('missed');
  game.players[0].hand.push(missed);
  assert.equal(game.play(0, missed), true);
  assert.equal(game.pending.target, 1);
});

test('Duel broadcasts alternating shots and applies damage only after the last response', () => {
  const game = setup('calamityjanet');
  const converted = card('missed');
  const reply = card('bang');
  game.players[0].hand.push(converted);
  game.players[1].hand.push(reply);
  const health = game.players[1].health;
  attack(game, 'duel');
  assert.equal(game.play(1, reply), true);
  assert.equal(game.play(0, converted), true);
  assert.equal(game.players[1].health, health);
  assert.equal(game.takeHit(1), true);
  assert.equal(game.players[1].health, health - 1);
  const events = game.view(2).notices.map(({ visual }) => visual).filter(Boolean);
  assert.deepEqual(events, [
    { kind: 'duel', source: 0, target: 1 },
    { kind: 'duel-shot', source: 1, target: 0 },
    { kind: 'duel-shot', source: 0, target: 1 },
    { kind: 'hit', effect: 'duel', target: 1, amount: 1 },
  ]);
});

test('Only the Cat Balou player can discard equipment, after playing it on the selected seat', () => {
  const game = setup('calamityjanet');
  const mustang = card('mustang');
  const other = card('mustang');
  game.players[1].equipment.push(mustang);
  game.players[2].equipment.push(other);
  assert.equal(game.chooseCard(0, mustang.id), false);
  attack(game, 'catbalou');
  assert.equal(game.view(0).effect.victim, 1);
  assert.equal(game.view(1).effect.victim, undefined);
  assert.equal(game.chooseCard(1, mustang.id), false);
  assert.equal(game.chooseCard(0, other.id), false);
  assert.equal(game.chooseCard(0, mustang.id), true);
  assert.deepEqual(game.players[1].equipment, []);
  assert.deepEqual(game.players[2].equipment, [other]);
  assert.equal(game.chooseCard(0, mustang.id), false);
});

test('El Gringo takes a card from the attacker and never from an opponent in his own Duel', () => {
  const game = setup('elgringo', 1);
  const stolen = card('panic');
  game.players[0].hand.push(stolen);
  attack(game, 'bang');
  game.takeHit(1);
  assert.deepEqual(game.players[1].hand, [stolen]);
  game.players[0].hand.push(card('bang'), card('beer'));
  attack(game, 'duel', 1, 0);
  assert.equal(game.play(0, game.players[0].hand[0]), true);
  assert.equal(game.takeHit(1), true);
  assert.deepEqual(game.players[1].hand, [stolen]);
  assert.equal(game.players[0].hand.length, 1);
});

test('Jesse Jones can take his first card from another player', () => {
  const game = setup('jessejones');
  const stolen = card('panic');
  game.players[1].hand.push(stolen);
  beginTurn(game);
  assert.equal(game.chooseCard(0, 'player-1'), true);
  assert.equal(game.players[0].hand[0], stolen);
  assert.equal(game.players[0].hand.length, 2);
  assert.equal(game.players[1].hand.length, 0);
});

test('Jourdonnais can try his skill separately from an equipped Barrel', () => {
  const game = setup('jourdonnais', 1);
  game.players[1].equipment.push(card('barrel'));
  game.deck.push(card('bang', '5♥'), card('bang', '4♣'));
  attack(game, 'bang');
  assert.equal(game.useBarrel(1, 'jourdonnais'), true);
  assert.equal(game.useBarrel(1, 'jourdonnais'), false);
  assert.equal(game.useBarrel(1), true);
  assert.equal(game.pending, null);
  attack(game, 'gatling');
  assert.equal(game.canUseBarrel(1, 'jourdonnais'), false);
  assert.equal(game.canUseBarrel(1), true);
});

test('Kit Carlson privately keeps two cards and returns the third to the deck', () => {
  const game = setup('kitcarlson');
  const options = [card(), card('panic'), card('beer')];
  game.deck.push(...options);
  beginTurn(game);
  assert.equal(game.view(0).effect.choices.length, 3);
  assert.deepEqual(game.view(1).effect.choices, []);
  assert.equal(game.chooseCard(0, options[0].id), true);
  assert.equal(game.chooseCard(0, options[2].id), true);
  assert.deepEqual(game.players[0].hand, [options[0], options[2]]);
  assert.equal(game.deck.at(-1), options[1]);
});

for (const check of ['barrel', 'jail', 'dynamite']) {
  for (const succeeds of [true, false]) {
    test('Lucky Duke applies only the chosen ' + check + ' result (' + (succeeds ? 'success' : 'failure') + ')', () => {
      const seat = 1;
      const game = setup('luckyduke', seat);
      game.players[seat].equipment.push(card(check));
      const good = card('panic', 'A♥');
      const bad = card('bang', '5♠');
      game.deck.push(good, bad);
      if (check === 'barrel') {
        attack(game, 'bang');
        assert.equal(game.useBarrel(seat), true);
      } else {
        game.active = seat;
        beginTurn(game);
        assert.equal(game.view(seat).effect.kind, check);
        assert.equal(game.chooseCard(seat, 'flip'), true);
      }
      const effect = game.view(seat).effect;
      assert.equal(effect.kind, 'luckyduke');
      assert.deepEqual(game.view(0).effect.choices, effect.choices);
      assert.deepEqual(effect.choices.map(({ face }) => face), ['5♠', 'A♥']);
      assert.notEqual(effect.choices[0].outcome, effect.choices[1].outcome);
      assert.equal(game.chooseCard(0, good.id), false);
      assert.equal(game.chooseCard(seat, (succeeds ? good : bad).id), true);
      assert.ok(game.discard.includes(good) && game.discard.includes(bad));
      assert.equal(game.characterChoice, null);
      if (check === 'barrel') assert.equal(game.pending === null, succeeds);
      if (check === 'jail') assert.equal(game.active, succeeds ? 1 : 2);
      if (check === 'dynamite') {
        assert.equal(game.players[seat].health, succeeds ? 4 : 1);
        assert.equal(Boolean(game.equipment(game.players[2], 'dynamite')), succeeds);
      }
    });
  }
}

test('Lucky Duke draws two cards normally when no check is required', () => {
  const game = setup('luckyduke');
  beginTurn(game);
  assert.equal(game.view(0).effect, null);
  assert.equal(game.players[0].hand.length, 2);
});

test('Dynamite waits for the active player before Jail, and the results are public', () => {
  const game = setup('willythekid', 1);
  game.active = 1;
  game.players[1].equipment.push(card('jail'), card('dynamite'));
  game.deck.push(card('bang', '3♣'), card('bang', 'A♥'));
  beginTurn(game);
  const deckCount = game.deck.length;
  assert.equal(game.view(1).effect.kind, 'dynamite');
  assert.deepEqual(game.view(0).effect.choices, []);
  assert.equal(game.chooseCard(0, 'flip'), false);
  assert.equal(game.deck.length, deckCount);
  assert.equal(game.players[1].hand.length, 0);
  assert.equal(game.chooseCard(1, 'flip'), true);
  assert.equal(game.view(1).effect.kind, 'jail');
  game.botStep();
  assert.equal(game.active, 2);
  const reveals = game.view(0).notices.map(({ visual }) => visual).filter((visual) => visual?.kind === 'hazard-check');
  assert.deepEqual(reveals.map(({ effect, target, face, failed }) => [effect, target, face, failed]), [
    ['dynamite', 1, 'A♥', false], ['jail', 1, '3♣', true],
  ]);
});

test('Paul Regret stacks his distance bonus with Mustang', () => {
  const game = setup('paulregret', 1);
  const [source, paul] = game.players;
  assert.equal(game.distance(source, paul), 2);
  paul.equipment.push(card('mustang'));
  assert.equal(game.distance(source, paul), 3);
});

test('Pedro Ramirez can take the top discard, then draws from the deck', () => {
  const game = setup('pedroramirez');
  const discarded = card('panic');
  const drawn = game.deck.at(-1);
  game.discard.push(discarded);
  beginTurn(game);
  assert.equal(game.chooseCard(0, 'discard'), true);
  assert.deepEqual(game.players[0].hand, [discarded, drawn]);
});

test('Rose Doolan stacks her distance reduction with Scope', () => {
  const game = setup('rosedoolan');
  const [rose, , target] = game.players;
  assert.equal(game.distance(rose, target), 1);
  target.equipment.push(card('mustang'));
  assert.equal(game.distance(rose, target), 2);
  rose.equipment.push(card('scope'));
  assert.equal(game.distance(rose, target), 1);
});

test('Sid Ketchum can discard exactly two cards off-turn to heal', () => {
  const game = setup('sidketchum', 1);
  const sid = game.players[1];
  sid.health--;
  sid.hand.push(card(), card());
  const [first, second] = sid.hand;
  assert.equal(game.heal(1, [first.id, first.id]), false);
  assert.equal(game.heal(1, [first.id, second.id]), true);
  assert.equal(sid.health, sid.maxHealth);
  assert.deepEqual(game.discard, [first, second]);
});

test('Slab requires two dodges for BANG!, though a Barrel heart counts as one', () => {
  const game = setup('slab');
  const missed = card('missed');
  game.players[1].hand.push(missed);
  game.players[1].equipment.push(card('barrel'));
  game.deck.push(card('bang', '5♥'));
  attack(game, 'bang');
  assert.equal(game.view(1).dodgesNeeded, 2);
  assert.equal(game.useBarrel(1), true);
  assert.equal(game.view(1).dodgesNeeded, 1);
  assert.equal(game.play(1, missed), true);
  assert.equal(game.pending, null);
  attack(game, 'gatling');
  assert.equal(game.view(1).dodgesNeeded, 1);
});

test('Suzy Lafayette waits until Duel is over before refilling her empty hand', () => {
  const game = setup('suzylafayette');
  const draw = game.deck.at(-1);
  attack(game, 'duel', 0, 3);
  assert.deepEqual(game.players[0].hand, []);
  assert.equal(game.takeHit(3), true);
  assert.deepEqual(game.players[0].hand, [draw]);
});

test('Vulture Sam inherits hand and equipment from an eliminated player', () => {
  const game = setup('vulturesam', 2);
  const hand = card('panic');
  const equipment = card('barrel');
  const victim = game.players[1];
  victim.health = 1;
  victim.hand.push(hand);
  victim.equipment.push(equipment);
  attack(game, 'bang');
  assert.equal(game.takeHit(1), true);
  assert.deepEqual(game.players[2].hand, [hand, equipment]);
});

test('Willy the Kid can use another BANG! in the same turn without Volcanic', () => {
  const game = setup('willythekid');
  attack(game, 'bang');
  game.takeHit(1);
  attack(game, 'bang');
  assert.equal(game.pending.kind, 'bang');
});
