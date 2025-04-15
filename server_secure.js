// server_secure.js
const express = require('express');
const mysql = require('mysql2');
const path = require('path');
const bodyParser = require('body-parser');
const bcrypt = require('bcrypt');
const xss = require('xss');

const app = express();
const PORT = 3000;

app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));
app.use('/secure', express.static(path.join(__dirname, 'secure')));

const db = mysql.createConnection({
  host: 'localhost',
  user: 'root',
  password: 'Mysql@123',
  database: 'rental_portal',
});

db.connect(err => {
  if (err) throw err;
  console.log('🔐 Secure DB Connected');
});

// Show login
app.get('/secure/login.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'secure', 'login.html'));
});

// Login securely
app.post('/secure/login', (req, res) => {
  const { username, password } = req.body;
  db.query('SELECT * FROM users WHERE username = ?', [username], (err, results) => {
    if (err) return res.send('DB Error');
    if (results.length === 0) return res.send('Invalid username');

    const user = results[0];
    bcrypt.compare(password, user.password, (err, match) => {
      if (match) {
        res.redirect('/secure/home');
      } else {
        res.send('Wrong password');
      }
    });
  });
});

// Add property page
app.get('/secure/add.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'secure', 'add.html'));
});

// Add property securely
app.post('/secure/add', (req, res) => {
  let { title, description, price, owner } = req.body;

  // Escape input to prevent XSS
  title = xss(title);
  description = xss(description);
  owner = xss(owner);

  const query = `INSERT INTO properties (title, description, price, owner) VALUES (?, ?, ?, ?)`;
  db.query(query, [title, description, price, owner], err => {
    if (err) return res.send('Insert failed');
    res.redirect('/secure/home');
  });
});

// Home page
app.get('/secure/home', (req, res) => {
  db.query('SELECT * FROM properties', (err, results) => {
    if (err) return res.send('Load error');

    let html = `<h1>Secure Listings</h1><a href="/secure/add.html">Add Property</a><ul>`;
    results.forEach(p => {
      html += `<li><strong>${p.title}</strong><br>${p.description}<br>₹${p.price}<br>Owner: ${p.owner}</li>`;
    });
    html += '</ul><a href="/secure/login.html">Logout</a>';
    res.send(html);
  });
});

app.listen(PORT, () => {
  console.log(`✅ Secure Server running at http://localhost:${PORT}`);
});
