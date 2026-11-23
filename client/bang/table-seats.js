function createSeatRenderer({ get, element, button, online, onTarget, equipmentDiscardId, onEquipmentDiscard }) {
  const equipmentDialog = get('equipment-detail');
  const discardButton = get('equipment-discard');
  let inspectedEquipment;

  function updateEquipmentAction() {
    const id = inspectedEquipment && equipmentDiscardId(inspectedEquipment.index, inspectedEquipment.key);
    discardButton.hidden = !id;
  }

  discardButton.addEventListener('click', () => {
    if (!equipmentDialog.open || !inspectedEquipment) return;
    const id = equipmentDiscardId(inspectedEquipment.index, inspectedEquipment.key);
    if (!id) return;
    equipmentDialog.close();
    onEquipmentDiscard(id);
  });
  const ringPositions = {
    4: [[3, 2], [2, 1], [1, 2], [2, 3]],
    5: [[3, 2], [3, 1], [1, 1], [1, 3], [3, 3]],
    6: [[3, 2], [3, 1], [1, 1], [1, 2], [1, 3], [3, 3]],
    7: [[3, 2], [3, 1], [2, 1], [1, 1], [1, 3], [2, 3], [3, 3]],
  };

  function inspectEquipment(holder, index, key) {
    const info = practiceCards[key];
    inspectedEquipment = { index, key };
    updateEquipmentAction();
    const art = get('equipment-art');
    art.classList.remove('illustrated');
    art.replaceChildren(element('span', info.mark, 'mark'));
    addCardArt(art, info.name);
    get('equipment-holder').textContent = 'Đang đặt trước ' + holder;
    get('equipment-name').textContent = info.name;
    get('equipment-description').textContent = info.detail;
    equipmentDialog.showModal();
  }

  function inspectCharacter(player) {
    const info = practiceCharacters[player.character];
    get('character-art').src = 'assets/characters/' + player.character + '.png';
    get('character-holder').textContent = player.name + ' · ' + player.maxHealth + ' máu tối đa';
    get('character-name').textContent = info.name;
    get('character-description').textContent = info.detail;
    get('character-detail').showModal();
  }

  function renderSeat(player, index, ownSeat, count, targets, activeSeat) {
    const zone = element('article', '', 'player-zone');
    zone.dataset.seatIndex = index;
    const offset = (index - ownSeat + count) % count;
    const [row, column] = ringPositions[count][offset];
    zone.style.setProperty('--seat-row', row);
    zone.style.setProperty('--seat-column', column);
    zone.classList.toggle('eliminated', player.health === 0);
    zone.classList.toggle('own-seat', index === ownSeat);
    zone.classList.toggle('active', index === activeSeat);

    const name = online && index === ownSeat ? player.name + ' (Bạn)' : player.name;
    const seat = button('seat', () => onTarget(index));
    seat.title = name;
    seat.classList.toggle('targetable', targets.has(index));
    seat.disabled = !targets.has(index);
    const badge = element('span', player.role === 'sheriff' ? '★' : String(index + 1), 'avatar');
    badge.setAttribute('aria-hidden', 'true');
    const heading = element('span', '', 'seat-heading');
    heading.append(
      element('strong', name, 'seat-name'),
      element('span', practiceRoles[player.role] ?? 'Vai trò ẩn', 'seat-meta'),
    );
    seat.append(badge, heading);
    const character = button('character-chip', () => inspectCharacter(player));
    const portrait = element('img', '', 'character-thumb');
    portrait.alt = '';
    portrait.src = 'assets/characters/' + player.character + '.png';
    character.append(portrait, element('span', practiceCharacters[player.character].name));
    zone.append(
      seat,
      character,
      element('p', player.health ? player.health + '/' + player.maxHealth + ' máu · ' + player.handCount + ' lá · Tầm bắn ' + player.range : 'Đã bị loại', 'seat-stats'),
    );

    if (player.equipment.length) {
      const equipment = element('div', '', 'seat-equipment');
      equipment.setAttribute('role', 'group');
      equipment.setAttribute('aria-label', 'Các lá trước mặt ' + player.name);
      player.equipment.forEach((key) => {
        const info = practiceCards[key];
        const tile = button('equipment-tile', () => inspectEquipment(player.name, index, key));
        tile.setAttribute('aria-label', info.name + ' trước mặt ' + player.name);
        tile.classList.toggle('effect-tile', key === 'jail' || key === 'dynamite');
        const thumb = element('span', '', 'card equipment-thumb blue');
        thumb.setAttribute('aria-hidden', 'true');
        thumb.append(element('span', info.mark, 'mark'));
        addCardArt(thumb, info.name);
        tile.append(thumb, element('span', info.name, 'equipment-name'));
        if (info.range) tile.append(element('span', 'Tầm bắn ' + info.range, 'equipment-range'));
        equipment.append(tile);
      });
      zone.append(equipment);
    }
    return zone;
  }

  return { renderSeat, inspectCharacter, updateEquipmentAction };
}
