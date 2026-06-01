const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Hilfsfunktionen zum Lesen/Schreiben der JSON-Dateien
function readUsers() {
  const users = JSON.parse(fs.readFileSync('./data/users.json', 'utf-8'));

  // Falls alte Userdaten noch keine games-Werte haben
  for (const name in users) {
    if (!users[name].wins) users[name].wins = { easy: 0, medium: 0, hard: 0, impossible: 0 };
    if (!users[name].losses) users[name].losses = { easy: 0, medium: 0, hard: 0, impossible: 0 };
    if (users[name].wins.impossible === undefined) users[name].wins.impossible = 0;
    if (users[name].losses.impossible === undefined) users[name].losses.impossible = 0;

    if (!users[name].games) {
      const wins = users[name].wins || { easy: 0, medium: 0, hard: 0 };
      const losses = users[name].losses || { easy: 0, medium: 0, hard: 0 };

      users[name].games = {
        easy: (wins.easy || 0) + (losses.easy || 0),
        medium: (wins.medium || 0) + (losses.medium || 0),
        hard: (wins.hard || 0) + (losses.hard || 0),
        impossible: (wins.impossible || 0) + (losses.impossible || 0)
      };
    }
    if (users[name].games.impossible === undefined) users[name].games.impossible = 0;
  }

  return users;
}
function saveUsers(data) {
  fs.writeFileSync('./data/users.json', JSON.stringify(data, null, 2));
}
function readQuestions() {
  return JSON.parse(fs.readFileSync('./data/questions.json', 'utf-8'));
}
function saveQuestions(data) {
  fs.writeFileSync('./data/questions.json', JSON.stringify(data, null, 2));
}

// ---- USER ROUTES ----

// User einloggen (oder neu erstellen falls nicht vorhanden)
app.post('/api/login', (req, res) => {
  const { username } = req.body;

  if (!username || username.trim() === '') {
    return res.status(400).json({ error: 'Kein Username angegeben' });
  }

  const users = readUsers();

  if (!users[username]) {
    users[username] = {
      username: username,
      gamesPlayed: 0,
      totalQuestions: 0,
      correctAnswers: 0,
      games: { easy: 0, medium: 0, hard: 0, impossible: 0 },
      wins: { easy: 0, medium: 0, hard: 0, impossible: 0 },
      losses: { easy: 0, medium: 0, hard: 0, impossible: 0 }
    };
    saveUsers(users);
  }

  res.json(users[username]);
});

app.get('/api/profile/:username', (req, res) => {
  const users = readUsers();
  const user = users[req.params.username];

  if (!user) {
    return res.status(404).json({ error: 'User nicht gefunden' });
  }

  const accuracy = user.totalQuestions > 0
    ? ((user.correctAnswers / user.totalQuestions) * 100).toFixed(1)
    : 0;

  res.json({ ...user, accuracy });
});

app.post('/api/stats', (req, res) => {
  const { username, correct, total, won, difficulty } = req.body;
  const users = readUsers();

  if (!users[username]) {
    return res.status(404).json({ error: 'User nicht gefunden' });
  }

  users[username].gamesPlayed += 1;
  users[username].totalQuestions += total;
  users[username].correctAnswers += correct;
  users[username].games[difficulty] += 1;

  if (won) {
    users[username].wins[difficulty] += 1;
  } else {
    users[username].losses[difficulty] += 1;
  }

  saveUsers(users);
  res.json({ ok: true });
});


app.get('/api/categories', (req, res) => {
  const questions = readQuestions();
  res.json(Object.keys(questions));
});

app.post('/api/categories', (req, res) => {
  const { category } = req.body;

  if (!category || category.trim() === '') {
    return res.status(400).json({ error: 'Kategorie fehlt' });
  }

  const cleanCategory = category.trim();
  const questions = readQuestions();

  if (!questions[cleanCategory]) {
    questions[cleanCategory] = [];
    saveQuestions(questions);
  }

  res.json({ ok: true, category: cleanCategory });
});

app.get('/api/questions/:category', (req, res) => {
  const questions = readQuestions();
  const category = req.params.category;

  if (!questions[category]) {
    return res.status(404).json({ error: 'Kategorie nicht gefunden' });
  }

  const shuffled = [...questions[category]].sort(() => Math.random() - 0.5);
  res.json(shuffled);
});

app.post('/api/questions/upload', (req, res) => {
  const { category, text } = req.body;

  if (!category || !text) {
    return res.status(400).json({ error: 'Kategorie und Text fehlen' });
  }

  const parsed = [];
  const blocks = text.trim().split(/\n\s*\n/); 

  for (const block of blocks) {
    const lines = block.trim().split('\n').map(l => l.trim()).filter(l => l.length > 0);
    const qLine = lines.find(l => l.startsWith('Q:'));
    if (!qLine) continue;

    const question = qLine.replace('Q:', '').trim();
    const answers = [];

    for (const line of lines) {
      if (line.startsWith('T:')) {
        answers.push({ text: line.replace('T:', '').trim(), correct: true });
      } else if (line.startsWith('F:')) {
        answers.push({ text: line.replace('F:', '').trim(), correct: false });
      }
    }

    if (answers.length >= 2) {
      parsed.push({ id: Date.now() + Math.random(), question, answers });
    }
  }

  if (parsed.length === 0) {
    return res.status(400).json({ error: 'Keine gültigen Fragen gefunden' });
  }

  const questions = readQuestions();
  if (!questions[category]) questions[category] = [];
  questions[category].push(...parsed);
  saveQuestions(questions);

  res.json({ added: parsed.length });
});

app.get('/api/questions/download/:category', (req, res) => {
  const questions = readQuestions();
  const category = req.params.category;

  if (!questions[category]) {
    return res.status(404).json({ error: 'Kategorie nicht gefunden' });
  }

  let output = '';
  for (const q of questions[category]) {
    output += `Q: ${q.question}\n`;
    for (const a of q.answers) {
      output += `${a.correct ? 'T' : 'F'}: ${a.text}\n`;
    }
    output += '\n';
  }

  res.setHeader('Content-Disposition', `attachment; filename="${category}.txt"`);
  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  res.send(output);
});

app.listen(PORT, () => {
  console.log(`Server läuft auf http://localhost:${PORT}`);
});
