export function showDamagePopup(layerEl, damage) {
  const popup = document.createElement('div');
  popup.className = 'damage-popup';
  popup.textContent = `-${damage}`;
  layerEl.appendChild(popup);
  popup.addEventListener('animationend', () => popup.remove(), { once: true });
}

export function shakeArena(arenaEl) {
  arenaEl.classList.remove('shake');
  void arenaEl.offsetWidth;
  arenaEl.classList.add('shake');
}
