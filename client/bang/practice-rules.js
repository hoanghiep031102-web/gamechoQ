const { cards: engineCards, ranks: practiceRanks } =
  typeof module !== 'undefined' && module.exports ? require('./card-catalog') : bangCatalog;
const { characters: engineCharacters, shuffleBang: shufflePractice } =
  typeof module !== 'undefined' && module.exports ? require('./characters') : { characters: bangCharacters, shuffleBang };

const turnFlow = typeof module !== 'undefined' && module.exports ? require('./turn-flow') : bangTurnFlow;
const makeBangSnapshot = typeof module !== 'undefined' && module.exports ? require('./game-snapshot') : makeGameSnapshot;
const runBangBotTurn = typeof module !== 'undefined' && module.exports ? require('./bot-turn') : runBotTurn;

const engineRoles = typeof module !== 'undefined' && module.exports ? require('./characters').roles : bangRoles;

const targetedCards = new Set(['bang', 'jail', 'panic', 'catbalou', 'duel']);
const responseCards = { bang: 'missed', gatling: 'missed', indians: 'bang', duel: 'bang' };

class BangPractice {
  constructor(count, random = Math.random, names = [], options = {}) {
    this.random = random;
    const assigned = options.characters;
    if (assigned && (assigned.length !== count || new Set(assigned).size !== count
      || assigned.some((character) => !Object.hasOwn(engineCharacters, character)))) {
      throw new Error('Mỗi ghế cần một nhân vật hợp lệ và khác nhau.');
    }
    const characters = assigned ?? shufflePractice(Object.keys(engineCharacters), random);
    const roles = ['renegade', 'outlaw', 'outlaw'];
    if (count >= 5) roles.push('deputy');
    if (count >= 6) roles.push('outlaw');
    if (count === 7) roles.push('deputy');
    this.players = ['sheriff', ...shufflePractice(roles, random)].map((role, index) => {
      const character = characters[index];
      const health = engineCharacters[character].health + Number(role === 'sheriff');
      return { name: names[index] ?? (index ? 'Máy ' + index : 'Bạn'), role, character,
        maxHealth: health, health, hand: [], equipment: [] };
    });
    this.deck = shufflePractice(Object.entries(practiceRanks).flatMap(([key, ranks]) =>
      ranks.split(' ').map((face, index) => ({ key, id: key + '-' + index, face }))), random);
    this.discard = [];
    this.log = [];
    this.notices = [];
    this.noticeId = 0;
    this.pending = null;
    this.characterChoice = null;
    this.winner = null;
    this.active = 0;
    this.players.forEach((player) => this.draw(player, player.health));
    turnFlow.beginTurn(this);
  }

  announce(message, tone = 'info', recipient, personal, visual) {
    if (message) this.log.push(message);
    this.notices.push({ id: ++this.noticeId, message, tone, recipient, personal, visual });
    if (this.notices.length > 12) this.notices.shift();
    return this.noticeId;
  }

  nextCard() {
    if (!this.deck.length) this.deck = shufflePractice(this.discard.splice(0), this.random);
    return this.deck.pop();
  }

  draw(player, count) {
    player.hand.push(...this.drawMany(count));
  }

  drawMany(count) {
    const cards = [];
    for (let i = 0; i < count; i++) {
      const card = this.nextCard();
      if (!card) break;
      cards.push(card);
    }
    return cards;
  }

  randomHandCard(player) {
    return player.hand.splice(Math.floor(this.random() * player.hand.length), 1)[0];
  }

  refillSuzy() {
    if (this.pending || this.characterChoice || this.winner) return;
    const suzy = this.living().find((player) => player.character === 'suzylafayette');
    if (suzy && !suzy.hand.length) {
      this.draw(suzy, 1);
      if (suzy.hand.length) this.announce(suzy.name + ' rút một lá nhờ Suzy Lafayette.');
    }
  }

  living() {
    return this.players.filter((player) => player.health > 0);
  }

  equipment(player, key) {
    return player.equipment.find((card) => card.key === key);
  }

  weapon(player) {
    return player.equipment.find((card) => engineCards[card.key].range);
  }

  range(player) {
    return engineCards[this.weapon(player)?.key]?.range ?? 1;
  }

  distance(source, target, alive = this.living()) {
    const gap = Math.abs(alive.indexOf(source) - alive.indexOf(target));
    const circular = Math.min(gap, alive.length - gap);
    return Math.max(1, circular - Number(Boolean(this.equipment(source, 'scope')))
      - Number(source.character === 'rosedoolan')
      + Number(Boolean(this.equipment(target, 'mustang'))) + Number(target.character === 'paulregret'));
  }

  targets(key = 'bang') {
    const alive = this.living();
    const player = this.players[this.active];
    const others = alive.filter((target) => target !== player);
    if (key === 'jail') {
      return others.filter((target) => target.role !== 'sheriff' && !this.equipment(target, 'jail'));
    }
    if (key === 'duel') return others;
    if (key === 'panic' || key === 'catbalou') {
      return others.filter((target) => (target.hand.length || target.equipment.length)
        && (key === 'catbalou' || this.distance(player, target, alive) === 1));
    }
    return others.filter((target) => this.distance(player, target, alive) <= this.range(player));
  }

  nextPlayer(index) {
    do {
      index = (index + 1) % this.players.length;
    } while (!this.players[index].health);
    return index;
  }

  clockwiseFrom(index) {
    const order = [index];
    for (let next = this.nextPlayer(index); next !== index; next = this.nextPlayer(next)) order.push(next);
    return order;
  }

  openStore(index) {
    const queue = this.clockwiseFrom(index);
    const cards = [];
    for (let i = 0; i < queue.length; i++) {
      const card = this.nextCard();
      if (!card) break;
      cards.push(card);
    }
    this.announce(this.players[index].name + ' mở General Store và lật ' + cards.length + ' lá.');
    if (cards.length) this.pending = { kind: 'generalstore', target: queue.shift(), queue, cards };
  }

  cardChoices(effect) {
    if (effect.kind === 'generalstore') return effect.cards;
    if (effect.kind !== 'panic' && effect.kind !== 'catbalou') return [];

    const victim = this.players[effect.victim];
    return [...(victim.hand.length ? [{ id: 'hand' }] : []), ...victim.equipment];
  }

  chooseCard(index, id) {
    if (this.characterChoice) return turnFlow.chooseCharacterCard(this, index, id);
    const startCheck = turnFlow.pendingStartCheck(this);
    if (startCheck) {
      if (index !== this.active || id !== 'flip') return false;
      turnFlow.checkCard(this, index, startCheck);
      return true;
    }
    const effect = this.pending;
    if (this.winner || effect?.target !== index || !this.cardChoices(effect).some((card) => card.id === id)) return false;

    const player = this.players[index];
    if (effect.kind === 'generalstore') {
      const [card] = effect.cards.splice(effect.cards.findIndex((card) => card.id === id), 1);
      player.hand.push(card);
      this.announce(player.name + ' chọn ' + engineCards[card.key].name + ' từ General Store.');
      this.advanceEffect();
      this.refillSuzy();
      return true;
    }

    const victim = this.players[effect.victim];
    const fromHand = id === 'hand';
    const source = fromHand ? victim.hand : victim.equipment;
    const card = fromHand ? this.randomHandCard(victim) : source.splice(source.findIndex((card) => card.id === id), 1)[0];
    const label = fromHand ? 'một lá trên tay' : engineCards[card.key].name;
    if (effect.kind === 'panic') {
      player.hand.push(card);
      this.announce(player.name + ' lấy ' + label + ' của ' + victim.name + '.', 'danger', effect.victim,
        player.name + ' dùng Panic! lấy ' + label + ' của bạn.');
    } else {
      this.discard.push(card);
      this.announce(victim.name + ' bỏ ' + label + ' do Cat Balou.', 'danger', effect.victim,
        player.name + ' dùng Cat Balou khiến bạn bỏ ' + label + '.');
    }
    this.pending = null;
    this.refillSuzy();
    return true;
  }

  advanceEffect() {
    const effect = this.pending;
    if (this.winner || !effect.queue?.length || effect.cards?.length === 0) {
      this.pending = null;
      return;
    }
    effect.target = effect.queue.shift();
    effect.triedBarrel = false;
    if (effect.kind === 'gatling' || effect.kind === 'indians') {
      this.announce(null, 'danger', undefined, undefined, {
        kind: effect.kind, source: effect.attacker, target: effect.target,
      });
    }
  }

  view(index) {
    return makeBangSnapshot(this, index, { responseCards, targetedCards, turnFlow });
  }

  effectiveCard(player, key) {
    if (player.character !== 'calamityjanet') return key;
    if (this.pending) {
      const needed = responseCards[this.pending.kind];
      if ((key === 'bang' && needed === 'missed') || (key === 'missed' && needed === 'bang')) return needed;
      return key;
    }
    return key === 'missed' ? 'bang' : key;
  }

  bangBlockReason(index) {
    const player = this.players[index];
    if (this.shot && player.character !== 'willythekid' && this.weapon(player)?.key !== 'volcanic') {
      return 'Bạn đã đánh một lá BANG! trong lượt này.';
    }
    if (!this.targets().length) {
      return 'Không có mục tiêu trong tầm bắn ' + this.range(player) + '.';
    }
    return '';
  }

  canPlay(index, card) {
    const player = this.players[index];
    if (!card || !player.hand.includes(card) || this.winner || this.characterChoice) return false;
    const key = this.effectiveCard(player, card.key);
    if (this.pending) return this.pending.target === index && key === responseCards[this.pending.kind];
    if (this.active !== index || this.phase === 'start' || this.phase === 'draw') return false;
    if (this.phase === 'discard') return player.hand.length > player.health;
    if (key === 'beer') return true;
    if (key === 'bang') return !this.bangBlockReason(index);
    if (targetedCards.has(key)) return this.targets(key).length > 0;
    if (engineCards[key].blue) return !this.equipment(player, key);
    return key !== 'missed';
  }

  removeCard(player, card) {
    player.hand.splice(player.hand.indexOf(card), 1);
    this.discard.push(card);
  }

  discardEquipment(player, card) {
    player.equipment.splice(player.equipment.indexOf(card), 1);
    this.discard.push(card);
  }

  play(index, card, target) {
    if (!this.canPlay(index, card)) return false;
    const player = this.players[index];
    const key = this.phase === 'discard' ? card.key : this.effectiveCard(player, card.key);
    if (!this.pending && this.phase === 'play' && targetedCards.has(key)
      && !this.targets(key).includes(this.players[target])) return false;
    if (!this.pending && this.phase === 'play' && engineCards[card.key].blue) {
      const recipient = card.key === 'jail' ? this.players[target] : player;
      player.hand.splice(player.hand.indexOf(card), 1);
      const currentWeapon = engineCards[card.key].range && this.weapon(player);
      if (currentWeapon) this.discardEquipment(player, currentWeapon);
      recipient.equipment.push(card);
      const name = engineCards[card.key].name;
      const message = recipient === player ? player.name + ' đặt ' + name + ' trước mặt mình.'
        : player.name + ' đặt ' + name + ' trước ' + recipient.name + '.';
      if (card.key === 'jail') this.announce(message, 'danger', target, player.name + ' đặt Jail trước mặt bạn.');
      else this.announce(message);
      this.refillSuzy();
      return true;
    }
    if (!this.pending && this.phase === 'play' && card.key === 'generalstore') {
      player.hand.splice(player.hand.indexOf(card), 1);
      this.openStore(index);
      this.discard.push(card);
      this.refillSuzy();
      return true;
    }
    this.removeCard(player, card);
    if (this.pending) {
      if (key === 'missed') {
        this.blockHit(index, card.key === 'missed' ? 'Missed!' : 'BANG! dùng như Missed!');
        return true;
      }
      const source = this.pending.kind === 'duel' ? this.pending.opponent : this.pending.attacker;
      const response = card.key === 'missed' ? 'Missed! dùng như BANG!' : 'BANG!';
      const visual = this.pending.kind === 'duel' ? { kind: 'duel-shot', source: index, target: source } : undefined;
      this.announce(player.name + ' bỏ ' + response + ' để đáp trả.', 'success', source, player.name + ' đã đáp trả bằng ' + response + '.', visual);
      if (this.pending.kind === 'duel') {
        const other = this.pending.opponent;
        this.pending.opponent = index;
        this.pending.target = other;
      } else {
        this.advanceEffect();
      }
    } else if (this.phase === 'discard') {
      this.log.push(player.name + ' bỏ một lá bài.');
    } else if (key === 'bang') {
      this.shot = true;
      this.pending = { kind: 'bang', attacker: index, target, dodges: player.character === 'slab' ? 2 : 1 };
      const attack = card.key === 'missed' ? 'Missed! như BANG!' : 'BANG!';
      this.pending.alertId = this.announce(player.name + ' dùng ' + attack + ' nhắm vào ' + this.players[target].name + '.', 'danger', target,
        player.name + ' vừa dùng ' + attack + ' nhắm vào bạn.', { kind: 'bang', source: index, target });
    } else if (card.key === 'duel') {
      this.pending = { kind: 'duel', attacker: index, opponent: index, target };
      this.pending.alertId = this.announce(player.name + ' thách đấu ' + this.players[target].name + '.', 'danger', target,
        player.name + ' thách đấu bạn bằng Duel.', { kind: 'duel', source: index, target });
    } else if (card.key === 'gatling' || card.key === 'indians') {
      const queue = this.clockwiseFrom(index).slice(1);
      this.pending = { kind: card.key, attacker: index, target: queue.shift(), queue };
      this.announce(player.name + ' dùng ' + engineCards[card.key].name + ' lên cả bàn.', 'danger', undefined, undefined,
        { kind: card.key, source: index, target: this.pending.target });
    } else if (card.key === 'panic' || card.key === 'catbalou') {
      this.pending = { kind: card.key, target: index, victim: target };
      const name = engineCards[card.key].name;
      this.announce(player.name + ' dùng ' + name + ' nhắm vào ' + this.players[target].name + '.', 'danger', target,
        player.name + ' dùng ' + name + ' nhắm vào bạn.');
    } else if (card.key === 'beer') {
      if (player.health < player.maxHealth && this.living().length > 2) {
        player.health++;
        this.announce(player.name + ' hồi 1 máu bằng Beer.', 'success', undefined, undefined,
          { kind: 'heal', targets: [index], amount: 1 });
      } else {
        this.announce(player.name + ' dùng Beer. Máu không đổi.');
      }
    } else if (card.key === 'saloon') {
      const healed = this.living().filter((target) => target.health < target.maxHealth);
      for (const target of healed) target.health++;
      const visual = healed.length ? { kind: 'heal', targets: healed.map((target) => this.players.indexOf(target)), amount: 1 } : undefined;
      this.announce(player.name + ' dùng Saloon. Mọi người còn sống hồi tối đa 1 máu.', 'success', undefined, undefined, visual);
    } else {
      this.draw(player, engineCards[card.key].draw);
      this.announce(player.name + ' dùng ' + engineCards[card.key].name + '.');
    }
    this.refillSuzy();
    return true;
  }

  takeHit(index) {
    const effect = this.pending;
    if (this.characterChoice || effect?.target !== index || !responseCards[effect.kind]) return false;
    const shooter = effect.attacker === index ? undefined : this.players[effect.attacker];
    this.damage(this.players[index], 1, shooter, effect.kind);
    this.advanceEffect();
    this.refillSuzy();
    if (!this.winner && !this.players[this.active].health) {
      this.active = this.nextPlayer(this.active);
      turnFlow.beginTurn(this);
    }
    return true;
  }

  canUseBarrel(index, source = 'barrel') {
    if (this.characterChoice || this.pending?.target !== index || responseCards[this.pending.kind] !== 'missed') return false;
    const player = this.players[index];
    if (source === 'jourdonnais') {
      return this.pending.kind === 'bang' && player.character === 'jourdonnais' && !this.pending.triedJourdonnais;
    }
    return !this.pending.triedBarrel && Boolean(this.equipment(player, 'barrel'));
  }

  useBarrel(index, source = 'barrel') {
    if ((source !== 'barrel' && source !== 'jourdonnais') || !this.canUseBarrel(index, source)) return false;
    if (source === 'barrel') this.pending.triedBarrel = true;
    else this.pending.triedJourdonnais = true;
    turnFlow.checkCard(this, index, source);
    return true;
  }

  blockHit(index, method) {
    const player = this.players[index];
    const effect = this.pending;
    if ((effect.dodges ?? 1) > 1) {
      effect.dodges--;
      this.announce(player.name + ' dùng ' + method + '. Vẫn cần thêm một lần né.', 'info', index,
        'Bạn đã né một lần. Cần thêm một lần né để tránh đòn của Slab.');
      return;
    }
    this.announce(player.name + ' né đòn bằng ' + method, 'success', effect.attacker,
      player.name + ' đã né đòn của bạn bằng ' + method,
      { kind: 'missed', target: index });
    this.advanceEffect();
    this.refillSuzy();
  }

  canHeal(index) {
    const player = this.players[index];
    return !this.winner && player.character === 'sidketchum' && player.health > 0
      && player.health < player.maxHealth && player.hand.length >= 2;
  }

  heal(index, ids) {
    if (!this.canHeal(index) || !Array.isArray(ids) || ids.length !== 2 || ids[0] === ids[1]) return false;
    const player = this.players[index];
    const cards = ids.map((id) => player.hand.find((card) => card.id === id));
    if (!cards.every(Boolean)) return false;
    cards.forEach((card) => this.removeCard(player, card));
    player.health++;
    this.announce(player.name + ' bỏ hai lá và hồi 1 máu nhờ Sid Ketchum.', 'success', undefined, undefined,
      { kind: 'heal', targets: [index], amount: 1 });
    if (this.characterChoice?.kind === 'sid-rescue' && this.characterChoice.target === index
      && (player.health > 3 || !this.canHeal(index))) turnFlow.finishDynamite(this, index);
    return true;
  }

  damage(player, amount, shooter, effect) {
    const suffered = amount;
    const neededBeer = Math.max(0, amount - player.health + 1);
    const beers = player.hand.filter((card) => card.key === 'beer');
    if (neededBeer && beers.length >= neededBeer && this.living().length > 2) {
      beers.slice(0, neededBeer).forEach((card) => this.removeCard(player, card));
      this.announce(player.name + ' dùng Beer để sống sót.', 'success', undefined, undefined,
        { kind: 'heal', targets: [this.players.indexOf(player)], amount: neededBeer });
      amount -= neededBeer;
    }
    if (amount > 0) this.announce(player.name + ' mất ' + amount + ' máu.', 'danger', this.players.indexOf(player),
      'Bạn mất ' + amount + ' máu' + (shooter ? ' do đòn của ' + shooter.name : '') + '.',
      effect ? { kind: 'hit', effect, target: this.players.indexOf(player), amount } : undefined);
    player.health = Math.max(0, player.health - amount);
    if (player.health > 0) {
      if (player.character === 'bartcassidy') {
        const before = player.hand.length;
        this.draw(player, suffered);
        const drawn = player.hand.length - before;
        if (drawn) this.announce(player.name + ' rút ' + drawn + ' lá nhờ Bart Cassidy.');
      }
      if (player.character === 'elgringo' && shooter) {
        const count = Math.min(suffered, shooter.hand.length);
        for (let i = 0; i < count; i++) player.hand.push(this.randomHandCard(shooter));
        if (count) this.announce(player.name + ' lấy ' + count + ' lá ngẫu nhiên từ tay ' + shooter.name + ' nhờ El Gringo.');
      }
      return;
    }

    this.eliminate(player, shooter);
  }

  eliminate(player, shooter) {
    this.announce(player.name + ' bị loại. Vai trò: ' + engineRoles[player.role] + '.', 'elimination', this.players.indexOf(player),
      'Bạn đã bị loại. Vai trò của bạn là ' + engineRoles[player.role] + '.');
    const inheritance = [...player.hand.splice(0), ...player.equipment.splice(0)];
    const vulture = this.living().find((candidate) => candidate.character === 'vulturesam');
    if (vulture) {
      vulture.hand.push(...inheritance);
      if (inheritance.length) this.announce(vulture.name + ' nhận ' + inheritance.length + ' lá nhờ Vulture Sam.');
    } else {
      this.discard.push(...inheritance);
    }
    const alive = this.living();
    if (!this.players[0].health) {
      this.winner = alive.length === 1 && alive[0].role === 'renegade' ? 'renegade' : 'outlaw';
    } else if (alive.every(({ role }) => role === 'sheriff' || role === 'deputy')) {
      this.winner = 'sheriff';
    }
    if (this.winner) {
      this.announce('Ván kết thúc. ' + engineRoles[this.winner] + ' thắng!', 'success');
      return;
    }
    if (!shooter) return;

    if (player.role === 'outlaw') this.draw(shooter, 3);
    if (shooter.role === 'sheriff' && player.role === 'deputy') {
      this.discard.push(...shooter.hand.splice(0), ...shooter.equipment.splice(0));
    }
  }

  forfeit(index) {
    const player = this.players[index];
    if (!player?.health || this.winner) return false;
    this.announce(player.name + ' đã rời ván và bị xử thua.');
    player.health = 0;
    this.eliminate(player);
    const choice = this.characterChoice;
    if (choice?.target === index) {
      if (choice.cards) {
        if (choice.kind === 'kitcarlson') this.deck.push(...choice.cards);
        else this.discard.push(...choice.cards);
      }
      this.characterChoice = null;
    }
    const effect = this.pending;
    if (effect?.queue) effect.queue = effect.queue.filter((seat) => seat !== index);
    if (effect && (effect.victim === index || effect.kind === 'duel'
      && (effect.target === index || effect.opponent === index))) {
      this.pending = null;
    } else if (effect?.target === index) {
      this.advanceEffect();
    }
    if (!this.winner && this.active === index) {
      if (this.characterChoice?.cards) this.discard.push(...this.characterChoice.cards);
      this.characterChoice = null;
      if (this.pending?.cards) this.discard.push(...this.pending.cards);
      this.pending = null;
      this.active = this.nextPlayer(index);
      turnFlow.beginTurn(this);
    }
    this.refillSuzy();
    return true;
  }

  discardAndEnd(index, ids) {
    if (this.active !== index || this.phase !== 'discard' || this.pending || this.characterChoice || this.winner) return false;
    const player = this.players[index];
    const excess = player.hand.length - player.health;
    if (excess <= 0 || !Array.isArray(ids) || ids.length !== excess || new Set(ids).size !== excess) return false;
    const cards = ids.map((id) => player.hand.find((card) => card.id === id));
    if (!cards.every(Boolean)) return false;
    for (const card of cards) this.removeCard(player, card);
    this.log.push(player.name + ' bỏ ' + cards.length + ' lá bài cuối lượt.');
    return this.endTurn(index);
  }

  endTurn(index) {
    if (this.winner || this.pending || this.characterChoice || this.active !== index
      || (this.phase !== 'play' && this.phase !== 'discard')) return false;
    const player = this.players[index];
    if (player.hand.length > player.health) {
      this.phase = 'discard';
      return false;
    }
    this.active = this.nextPlayer(this.active);
    turnFlow.beginTurn(this);
    return true;
  }

  botStep() {
    runBangBotTurn(this, turnFlow);
  }
}

if (typeof module !== 'undefined' && module.exports) module.exports = BangPractice;
