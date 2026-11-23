function renderCharacterPicker(container, { options, selected, disabled, assetPath }, onChoose) {
  const cards = options.map((key) => {
    const info = bangCharacters[key];
    const card = document.createElement('button');
    card.type = 'button';
    card.className = 'character-option';
    card.disabled = Boolean(selected) || disabled;
    card.setAttribute('aria-pressed', String(key === selected));
    card.addEventListener('click', () => onChoose(key));

    const art = document.createElement('img');
    art.src = assetPath + key + '.png';
    art.alt = '';
    const name = document.createElement('strong');
    name.textContent = info.name;
    const health = document.createElement('span');
    health.className = 'character-option-health';
    health.textContent = info.health + ' máu gốc';
    const skill = document.createElement('span');
    skill.textContent = info.detail;
    card.append(art, name, health, skill);
    return card;
  });
  container.replaceChildren(...cards);
}
