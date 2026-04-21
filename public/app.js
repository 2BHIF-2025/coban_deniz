// Aktueller eingeloggter User
let currentUser = null;

// Spielzustand
let questions = [];
let currentIndex = 0;
let playerScore = 0;
let botScore = 0;
let playerCorrect = 0;
let selectedCategory = null;
let selectedDifficulty = 'easy';
let timerInterval = null;
let timeLeft = 10;
let alreadyAnswered = false;

// Bot Schwierigkeit: Schwellwert ab dem der Bot richtig antwortet (1-10, roll >= threshold)
const diffConfig = {
  easy:   { label: 'Leicht', threshold: 6 },  // 50% (6,7,8,9,10 = 5 von 10)
  medium: { label: 'Medium', threshold: 5 },  // 60% (5..10 = 6 von 10)
  hard:   { label: 'Schwer', threshold: 3 },  // 80% (3..10 = 8 von 10)
};

// ---- SEITEN WECHSELN ----
function showPage(id) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.getElementById(id).classList.add('active');
}

// ---- LOGIN ----
async function login() {
  const username = document.getElementById('usernameInput').value.trim();
  if (!username) {
    alert('Bitte einen Username eingeben!');
    return;
  }

  const res = await fetch('/api/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username })
  });

  if (!res.ok) {
    alert('Fehler beim Login');
    return;
  }

  currentUser = await res.json();
  document.getElementById('navUser').textContent = 'Eingeloggt als: ' + currentUser.username;
  document.getElementById('navbar').style.display = 'flex';

  loadCategories();
  showPage('menuPage');
}

// ---- MENU ----
async function loadCategories() {
  const res = await fetch('/api/categories');
  const cats = await res.json();

  const grid = document.getElementById('categoryGrid');
  grid.innerHTML = '';

  cats.forEach(cat => {
    const btn = document.createElement('button');
    btn.className = 'category-btn';
    btn.textContent = cat;
    btn.onclick = () => {
      selectedCategory = cat;
      document.querySelectorAll('.category-btn').forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
    };
    grid.appendChild(btn);
  });
}

function selectDifficulty(diff, btn) {
  selectedDifficulty = diff;
  document.querySelectorAll('.diff-btn').forEach(b => b.classList.remove('selected'));
  btn.classList.add('selected');
}

async function startGame() {
  if (!selectedCategory) {
    alert('Bitte eine Kategorie wählen!');
    return;
  }

  const res = await fetch('/api/questions/' + selectedCategory);
  if (!res.ok) {
    alert('Fehler beim Laden der Fragen');
    return;
  }

  questions = await res.json();
  currentIndex = 0;
  playerScore = 0;
  botScore = 0;
  playerCorrect = 0;

  showPage('gamePage');
  renderQuestion();
}

// ---- GAME ----
function renderQuestion() {
  if (currentIndex >= questions.length) {
    endGame();
    return;
  }

  alreadyAnswered = false;
  const q = questions[currentIndex];
  const total = questions.length;

  // Progress Bar
  document.getElementById('progressFill').style.width = (currentIndex / total * 100) + '%';

  // Meta
  document.getElementById('questionMeta').textContent =
    `Frage ${currentIndex + 1} / ${total}  •  ${selectedCategory}  •  ${diffConfig[selectedDifficulty].label}`;

  // Frage
  document.getElementById('questionText').textContent = q.question;

  // Antworten shufflen und anzeigen
  const shuffled = [...q.answers].sort(() => Math.random() - 0.5);
  const letters = ['A', 'B', 'C', 'D'];
  const grid = document.getElementById('answersGrid');
  grid.innerHTML = '';

  shuffled.forEach((ans, i) => {
    const btn = document.createElement('button');
    btn.className = 'answer-btn';
    btn.dataset.correct = ans.correct;
    btn.innerHTML = `<span class="answer-letter">${letters[i]}</span>${ans.text}`;
    btn.onclick = () => handleAnswer(btn, shuffled);
    grid.appendChild(btn);
  });

  // Scores
  document.getElementById('playerScoreVal').textContent = playerScore;
  document.getElementById('botScoreVal').textContent = botScore;

  // Feedback verstecken
  const fb = document.getElementById('feedback');
  fb.className = 'feedback';
  fb.textContent = '';

  // Timer starten
  startTimer(shuffled);
}

function startTimer(shuffledAnswers) {
  clearInterval(timerInterval);
  timeLeft = 10;
  updateTimerUI();

  timerInterval = setInterval(() => {
    timeLeft--;
    updateTimerUI();

    if (timeLeft <= 0) {
      clearInterval(timerInterval);
      if (!alreadyAnswered) {
        // Zeit abgelaufen = falsch
        handleAnswer(null, shuffledAnswers);
      }
    }
  }, 1000);
}

function updateTimerUI() {
  document.getElementById('timerNum').textContent = timeLeft;
  document.getElementById('timerFill').style.width = (timeLeft / 10 * 100) + '%';

  // Farbe wechseln wenn wenig Zeit
  const fill = document.getElementById('timerFill');
  if (timeLeft <= 3) {
    fill.style.background = '#e94560';
    document.getElementById('timerNum').style.color = '#e94560';
  } else {
    fill.style.background = '#ffb400';
    document.getElementById('timerNum').style.color = '#ffb400';
  }
}

function handleAnswer(clickedBtn, shuffledAnswers) {
  if (alreadyAnswered) return;
  alreadyAnswered = true;
  clearInterval(timerInterval);

  const playerRight = clickedBtn !== null && clickedBtn.dataset.correct === 'true';
  const botRight = botDecide();

  // Punkte: 100 Basispunkte + Zeitbonus (wie Kahoot)
  const pPoints = playerRight ? 100 + timeLeft * 10 : 0;
  const bPoints = botRight   ? 100 + Math.floor(Math.random() * 50) : 0;

  playerScore += pPoints;
  botScore    += bPoints;
  if (playerRight) playerCorrect++;

  // Antworten einfärben
  document.querySelectorAll('.answer-btn').forEach(btn => {
    btn.disabled = true;
    if (btn.dataset.correct === 'true') {
      btn.classList.add('correct');
    } else if (btn === clickedBtn) {
      btn.classList.add('wrong');
    }
  });

  // Score Update + Popup anzeigen
  document.getElementById('playerScoreVal').textContent = playerScore;
  document.getElementById('botScoreVal').textContent    = botScore;

  if (pPoints > 0) showPointsPopup('+' + pPoints, '#00c896', 'playerScoreBox');
  if (bPoints > 0) showPointsPopup('+' + bPoints, '#e94560', 'botScoreBox');

  // Feedback
  const fb = document.getElementById('feedback');
  if (clickedBtn === null) {
    fb.textContent = '⏱ Zeit abgelaufen!';
    fb.className = 'feedback wrong show';
  } else if (playerRight) {
    fb.textContent = '✅ Richtig!';
    fb.className = 'feedback correct show';
  } else {
    fb.textContent = '❌ Falsch!';
    fb.className = 'feedback wrong show';
  }

  // 2 Sekunden warten dann nächste Frage
  setTimeout(() => {
    currentIndex++;
    renderQuestion();
  }, 2000);
}

function botDecide() {
  // Zufallszahl 1-10, ab Schwellwert = richtig
  const roll = Math.floor(Math.random() * 10) + 1;
  return roll >= diffConfig[selectedDifficulty].threshold;
}

function showPointsPopup(text, color, boxId) {
  const box = document.getElementById(boxId).getBoundingClientRect();
  const el = document.createElement('div');
  el.className = 'points-popup';
  el.textContent = text;
  el.style.color = color;
  el.style.left = (box.left + box.width / 2 - 20) + 'px';
  el.style.top  = (box.top - 10 + window.scrollY) + 'px';
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 1300);
}

// ---- ENDE ----
async function endGame() {
  const won = playerScore > botScore;
  const total = questions.length;

  // Stats an Server schicken
  await fetch('/api/stats', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      username: currentUser.username,
      correct: playerCorrect,
      total: total,
      won: won,
      difficulty: selectedDifficulty
    })
  });

  // Ergebnis anzeigen
  const accuracy = total > 0 ? Math.round(playerCorrect / total * 100) : 0;

  document.getElementById('resultTitle').textContent = won ? '🏆 Gewonnen!' : '💀 Verloren!';
  document.getElementById('resultTitle').style.color = won ? '#00c896' : '#e94560';
  document.getElementById('resPlayerScore').textContent = playerScore;
  document.getElementById('resBotScore').textContent    = botScore;
  document.getElementById('resCorrect').textContent     = playerCorrect + ' / ' + total;
  document.getElementById('resAccuracy').textContent    = accuracy + '%';
  document.getElementById('resDiff').textContent        = diffConfig[selectedDifficulty].label;
  document.getElementById('resCategory').textContent    = selectedCategory;

  showPage('resultPage');
}

// ---- PROFIL ----
async function loadProfile() {
  const res = await fetch('/api/profile/' + currentUser.username);
  if (!res.ok) {
    alert('Profil laden fehlgeschlagen');
    return;
  }

  const u = await res.json();

  document.getElementById('profileName').textContent     = u.username;
  document.getElementById('profileAccuracy').textContent = u.accuracy + '%';
  document.getElementById('profileGames').textContent    = u.gamesPlayed;
  document.getElementById('profileWinsEasy').textContent   = u.wins.easy;
  document.getElementById('profileWinsMedium').textContent = u.wins.medium;
  document.getElementById('profileWinsHard').textContent   = u.wins.hard;
  document.getElementById('profileAnswers').textContent =
    u.correctAnswers + ' / ' + u.totalQuestions;

  showPage('profilePage');
}

// ---- UPLOAD ----
async function uploadQuestions() {
  const category = document.getElementById('uploadCategory').value.trim();
  const text     = document.getElementById('uploadText').value.trim();

  if (!category || !text) {
    alert('Bitte Kategorie und Fragen eingeben!');
    return;
  }

  const res = await fetch('/api/questions/upload', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ category, text })
  });

  const data = await res.json();

  if (!res.ok) {
    alert('Fehler: ' + data.error);
    return;
  }

  alert(data.added + ' Fragen erfolgreich hochgeladen!');
  document.getElementById('uploadCategory').value = '';
  document.getElementById('uploadText').value = '';
  loadCategories(); // Kategorien neu laden
}

function downloadQuestions() {
  const category = document.getElementById('downloadCategory').value.trim();
  if (!category) {
    alert('Bitte Kategorie eingeben!');
    return;
  }
  window.open('/api/questions/download/' + encodeURIComponent(category), '_blank');
}

// Enter zum Einloggen
document.getElementById('usernameInput').addEventListener('keydown', e => {
  if (e.key === 'Enter') login();
});
