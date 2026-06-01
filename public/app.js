let currentUser = null;

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

const diffConfig = {
  easy: { label: 'Leicht', chance: 50 },
  medium: { label: 'Medium', chance: 60 },
  hard: { label: 'Schwer', chance: 80 },
  impossible: { label: 'Unmoeglich', chance: 90 }
};

function showPage(id) {
  document.querySelectorAll('.page').forEach(page => page.classList.remove('active'));
  document.getElementById(id).classList.add('active');
}

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

  await loadCategories();
  showPage('menuPage');
}

async function loadCategories() {
  const res = await fetch('/api/categories');
  const cats = await res.json();

  const grid = document.getElementById('categoryGrid');
  grid.innerHTML = '';

  cats.forEach(cat => {
    const btn = document.createElement('button');
    btn.className = 'category-btn';
    btn.textContent = cat;

    if (cat === selectedCategory) {
      btn.classList.add('selected');
    }

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

async function createEmptyCategory() {
  const input = document.getElementById('newCategoryInput');
  const questionsInput = document.getElementById('newCategoryQuestions');
  const category = input.value.trim();
  const text = questionsInput.value.trim();

  if (!category) {
    alert('Bitte einen Kategorienamen eingeben!');
    return;
  }

  const url = text ? '/api/questions/upload' : '/api/categories';
  const body = text ? { category, text } : { category };

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });

  const data = await res.json();
  if (!res.ok) {
    alert('Fehler: ' + data.error);
    return;
  }

  selectedCategory = category;
  input.value = '';
  questionsInput.value = '';
  await loadCategories();
}

async function startGame() {
  if (!selectedCategory) {
    alert('Bitte eine Kategorie waehlen!');
    return;
  }

  const res = await fetch('/api/questions/' + encodeURIComponent(selectedCategory));
  if (!res.ok) {
    alert('Fehler beim Laden der Fragen');
    return;
  }

  questions = await res.json();
  if (questions.length === 0) {
    alert('Diese Kategorie hat noch keine Fragen. Lade zuerst Fragen hoch.');
    showPage('uploadPage');
    document.getElementById('uploadCategory').value = selectedCategory;
    return;
  }

  currentIndex = 0;
  playerScore = 0;
  botScore = 0;
  playerCorrect = 0;

  showPage('gamePage');
  renderQuestion();
}

function renderQuestion() {
  if (currentIndex >= questions.length) {
    endGame();
    return;
  }

  alreadyAnswered = false;
  const q = questions[currentIndex];
  const total = questions.length;

  document.getElementById('progressFill').style.width = (currentIndex / total * 100) + '%';
  document.getElementById('questionMeta').textContent =
    'Frage ' + (currentIndex + 1) + ' / ' + total + ' - ' + selectedCategory + ' - ' + diffConfig[selectedDifficulty].label;

  document.getElementById('questionText').textContent = q.question;

  const shuffled = [...q.answers].sort(() => Math.random() - 0.5);
  const letters = ['A', 'B', 'C', 'D'];
  const grid = document.getElementById('answersGrid');
  grid.innerHTML = '';

  shuffled.forEach((ans, i) => {
    const btn = document.createElement('button');
    btn.className = 'answer-btn';
    btn.dataset.correct = ans.correct;
    btn.innerHTML = '<span class="answer-letter">' + letters[i] + '</span><span>' + ans.text + '</span>';
    btn.onclick = () => handleAnswer(btn, shuffled);
    grid.appendChild(btn);
  });

  document.getElementById('playerScoreVal').textContent = playerScore;
  document.getElementById('botScoreVal').textContent = botScore;
  document.getElementById('roundInfo').textContent = '';

  const fb = document.getElementById('feedback');
  fb.className = 'feedback';
  fb.textContent = '';

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
        handleAnswer(null, shuffledAnswers);
      }
    }
  }, 1000);
}

function updateTimerUI() {
  document.getElementById('timerNum').textContent = timeLeft;
  document.getElementById('timerFill').style.width = (timeLeft / 10 * 100) + '%';

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
  const bot = botDecide(shuffledAnswers);
  const botRight = bot.correct;

  const pPoints = playerRight ? 100 + timeLeft * 10 : 0;
  const bPoints = botRight ? 100 + Math.floor(Math.random() * 50) : 0;

  playerScore += pPoints;
  botScore += bPoints;
  if (playerRight) playerCorrect++;

  document.querySelectorAll('.answer-btn').forEach(btn => {
    btn.disabled = true;
    if (btn.dataset.correct === 'true') {
      btn.classList.add('correct');
    } else if (btn === clickedBtn) {
      btn.classList.add('wrong');
    }
  });

  document.getElementById('playerScoreVal').textContent = playerScore;
  document.getElementById('botScoreVal').textContent = botScore;

  if (pPoints > 0) showPointsPopup('+' + pPoints, '#00c896', 'playerScoreBox');
  if (bPoints > 0) showPointsPopup('+' + bPoints, '#e94560', 'botScoreBox');

  const difference = playerScore - botScore;
  const diffText = difference >= 0 ? '+' + difference : difference;
  document.getElementById('roundInfo').textContent =
    'Bot Antwort: ' + bot.answer.text + ' | Punkte Unterschied: ' + diffText;

  const fb = document.getElementById('feedback');
  if (clickedBtn === null) {
    fb.textContent = 'Zeit abgelaufen!';
    fb.className = 'feedback wrong show';
  } else if (playerRight) {
    fb.textContent = 'Richtig!';
    fb.className = 'feedback correct show';
  } else {
    fb.textContent = 'Falsch!';
    fb.className = 'feedback wrong show';
  }

  setTimeout(() => {
    currentIndex++;
    renderQuestion();
  }, 2200);
}

function botDecide(shuffledAnswers) {
  const chance = diffConfig[selectedDifficulty].chance;
  const roll = Math.floor(Math.random() * 100) + 1;
  const correctAnswer = shuffledAnswers.find(a => a.correct);

  if (roll <= chance) {
    return { correct: true, answer: correctAnswer };
  }

  const wrongAnswers = shuffledAnswers.filter(a => !a.correct);
  const randomWrong = wrongAnswers[Math.floor(Math.random() * wrongAnswers.length)];
  return { correct: false, answer: randomWrong || correctAnswer };
}

function showPointsPopup(text, color, boxId) {
  const box = document.getElementById(boxId).getBoundingClientRect();
  const el = document.createElement('div');
  el.className = 'points-popup';
  el.textContent = text;
  el.style.color = color;
  el.style.left = (box.left + box.width / 2 - 20) + 'px';
  el.style.top = (box.top - 10 + window.scrollY) + 'px';
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 1300);
}

async function endGame() {
  const won = playerScore > botScore;
  const total = questions.length;

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

  const accuracy = total > 0 ? Math.round(playerCorrect / total * 100) : 0;
  const diff = playerScore - botScore;

  document.getElementById('resultTitle').textContent = won ? 'Gewonnen!' : 'Verloren!';
  document.getElementById('resultTitle').style.color = won ? '#00c896' : '#e94560';
  document.getElementById('resPlayerScore').textContent = playerScore;
  document.getElementById('resBotScore').textContent = botScore;
  document.getElementById('resDiffPoints').textContent = diff >= 0 ? '+' + diff : diff;
  document.getElementById('resCorrect').textContent = playerCorrect + ' / ' + total;
  document.getElementById('resAccuracy').textContent = accuracy + '%';
  document.getElementById('resDiff').textContent = diffConfig[selectedDifficulty].label;
  document.getElementById('resCategory').textContent = selectedCategory;
  document.getElementById('progressFill').style.width = '100%';

  showPage('resultPage');
}

async function loadProfile() {
  const res = await fetch('/api/profile/' + encodeURIComponent(currentUser.username));
  if (!res.ok) {
    alert('Profil laden fehlgeschlagen');
    return;
  }

  const u = await res.json();

  document.getElementById('profileName').textContent = u.username;
  document.getElementById('profileAvatar').textContent = u.username.substring(0, 2).toUpperCase();
  document.getElementById('profileAccuracy').textContent = u.accuracy + '%';
  document.getElementById('profileGames').textContent = u.gamesPlayed;
  document.getElementById('profileGamesEasy').textContent = u.games.easy;
  document.getElementById('profileGamesMedium').textContent = u.games.medium;
  document.getElementById('profileGamesHard').textContent = u.games.hard;
  document.getElementById('profileWinsEasy').textContent = u.wins.easy;
  document.getElementById('profileWinsMedium').textContent = u.wins.medium;
  document.getElementById('profileWinsHard').textContent = u.wins.hard;
  document.getElementById('profileAnswers').textContent = u.correctAnswers + ' / ' + u.totalQuestions;

  showPage('profilePage');
}

async function uploadQuestions() {
  const category = document.getElementById('uploadCategory').value.trim();
  const text = document.getElementById('uploadText').value.trim();

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
  selectedCategory = category;
  document.getElementById('uploadCategory').value = '';
  document.getElementById('uploadText').value = '';
  await loadCategories();
  showPage('menuPage');
}

function downloadQuestions() {
  const category = document.getElementById('downloadCategory').value.trim();
  if (!category) {
    alert('Bitte Kategorie eingeben!');
    return;
  }

  window.open('/api/questions/download/' + encodeURIComponent(category), '_blank');
}

document.getElementById('usernameInput').addEventListener('keydown', e => {
  if (e.key === 'Enter') login();
});
