const initialState = () => ({
  over: false,
  player: {
    name: "ファイアウルフ",
    hp: 130,
    maxHp: 130,
    moves: [
      { name: "ひっかく", min: 12, max: 20 },
      { name: "ほのおのキバ", min: 18, max: 28 },
      { name: "かみつく", min: 10, max: 24 },
      { name: "まもる", min: 0, max: 0, guard: true }
    ]
  },
  enemy: {
    name: "スライムキング",
    hp: 120,
    maxHp: 120,
    moves: [
      { name: "たいあたり", min: 10, max: 18 },
      { name: "どくのいき", min: 12, max: 22 },
      { name: "スライムショット", min: 8, max: 25 }
    ]
  }
});

let state = initialState();

const els = {
  playerName: document.getElementById("player-name"),
  enemyName: document.getElementById("enemy-name"),
  playerHp: document.getElementById("player-hp"),
  enemyHp: document.getElementById("enemy-hp"),
  playerHpFill: document.getElementById("player-hp-fill"),
  enemyHpFill: document.getElementById("enemy-hp-fill"),
  playerStatus: document.getElementById("player-status"),
  enemyStatus: document.getElementById("enemy-status"),
  actions: document.getElementById("actions"),
  log: document.getElementById("battle-log"),
  resetBtn: document.getElementById("reset-btn")
};

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function appendLog(message) {
  const li = document.createElement("li");
  li.textContent = message;
  els.log.prepend(li);
}

function updateBars() {
  const playerRate = Math.max(0, state.player.hp / state.player.maxHp) * 100;
  const enemyRate = Math.max(0, state.enemy.hp / state.enemy.maxHp) * 100;

  els.playerHp.textContent = `HP: ${Math.max(0, state.player.hp)} / ${state.player.maxHp}`;
  els.enemyHp.textContent = `HP: ${Math.max(0, state.enemy.hp)} / ${state.enemy.maxHp}`;

  els.playerHpFill.style.width = `${playerRate}%`;
  els.enemyHpFill.style.width = `${enemyRate}%`;

  els.playerHpFill.style.background = playerRate <= 30 ? "var(--danger)" : "linear-gradient(90deg, var(--accent), #84cc16)";
  els.enemyHpFill.style.background = enemyRate <= 30 ? "var(--danger)" : "linear-gradient(90deg, var(--accent), #84cc16)";
}

function setActionDisabled(disabled) {
  [...els.actions.querySelectorAll("button")].forEach((btn) => {
    btn.disabled = disabled;
  });
}

function enemyTurn(playerGuarded) {
  if (state.over || state.enemy.hp <= 0) return;
  const move = state.enemy.moves[randomInt(0, state.enemy.moves.length - 1)];
  let damage = randomInt(move.min, move.max);
  if (playerGuarded) {
    damage = Math.floor(damage * 0.35);
  }
  state.player.hp -= damage;
  appendLog(`${state.enemy.name} の ${move.name}！ ${damage} ダメージを受けた！`);
}

function checkGameOver() {
  if (state.enemy.hp <= 0) {
    state.over = true;
    appendLog("勝利！ スライムキングを倒した！");
    els.playerStatus.textContent = "状態: 勝利";
    els.enemyStatus.textContent = "状態: ひんし";
    setActionDisabled(true);
    return true;
  }

  if (state.player.hp <= 0) {
    state.over = true;
    appendLog("敗北… ファイアウルフは力尽きた。もう一度挑戦しよう！");
    els.playerStatus.textContent = "状態: ひんし";
    els.enemyStatus.textContent = "状態: 勝利";
    setActionDisabled(true);
    return true;
  }

  return false;
}

function onPlayerAction(move) {
  if (state.over) return;

  setActionDisabled(true);
  let guarded = false;

  if (move.guard) {
    guarded = true;
    appendLog(`${state.player.name} は ${move.name} で防御を固めた！`);
  } else {
    const damage = randomInt(move.min, move.max);
    state.enemy.hp -= damage;
    appendLog(`${state.player.name} の ${move.name}！ ${damage} ダメージ！`);
  }

  updateBars();
  if (checkGameOver()) return;

  setTimeout(() => {
    enemyTurn(guarded);
    updateBars();
    checkGameOver();
    if (!state.over) {
      els.playerStatus.textContent = "状態: 通常";
      els.enemyStatus.textContent = "状態: 通常";
      setActionDisabled(false);
    }
  }, 550);
}

function renderActions() {
  els.actions.innerHTML = "";
  state.player.moves.forEach((move) => {
    const button = document.createElement("button");
    button.textContent = move.name;
    button.addEventListener("click", () => onPlayerAction(move));
    els.actions.appendChild(button);
  });
}

function resetGame() {
  state = initialState();
  els.log.innerHTML = "";
  els.playerName.textContent = state.player.name;
  els.enemyName.textContent = state.enemy.name;
  els.playerStatus.textContent = "状態: 通常";
  els.enemyStatus.textContent = "状態: 通常";
  renderActions();
  updateBars();
  setActionDisabled(false);
  appendLog("バトル開始！ 技を選んで敵を倒そう。");
}

els.resetBtn.addEventListener("click", resetGame);
resetGame();
