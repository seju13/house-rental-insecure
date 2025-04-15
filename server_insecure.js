// server_insecure.js
const express = require('express');
const mysql = require('mysql2');
const path = require('path');
const bodyParser = require('body-parser');

const app = express();
const PORT = 3001;

app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));
app.use('/insecure', express.static(path.join(__dirname, 'insecure')));

const db = mysql.createConnection({
  host: 'localhost',
  user: 'root',
  password: 'Mysql@123',
  database: 'rental_portal',
});

db.connect(err => {
  if (err) throw err;
  console.log('🧨 Insecure DB Connected');
});

// Show login page
app.get('/insecure/login.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'insecure', 'login.html'));
});

// Login route (vulnerable to SQL injection)
app.post('/insecure/login', (req, res) => {
  const { username, password } = req.body;
  const query = `SELECT * FROM users WHERE username='${username}' AND password='${password}'`;
  
  db.query(query, [username, password], (err, results) => {
  if (err) return res.send('Error!');
  console.log("Query Results: ", results);
  if (results.length > 0) res.redirect('/insecure/home');
  else res.send('Invalid login');
});
});

// Add property page
app.get('/insecure/add.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'insecure', 'add.html'));
});

// Add property (vulnerable to XSS & SQLi)
app.post('/insecure/add', (req, res) => {
  const { title, description, price, owner } = req.body;
  const query = `INSERT INTO properties (title, description, price, owner) VALUES ('${title}', '${description}', '${price}', '${owner}')`;

  db.query(query, err => {
    if (err) return res.send('Insert failed');
    res.redirect('/insecure/home');
  });
});

// Home page showing listings
app.get('/insecure/home', (req, res) => {
  db.query('SELECT * FROM properties', (err, results) => {
    if (err) return res.send('Load error');

    let html = `<h1>Insecure Listings</h1><a href="/insecure/add.html">Add Property</a><ul>`;
    results.forEach(p => {
      html += `<li><strong>${p.title}</strong><br>${p.description}<br>₹${p.price}<br>Owner: ${p.owner}</li>`;
    });
    html += '</ul><a href="/insecure/login.html">Logout</a>';
    res.send(html);
  });
});

app.listen(PORT, () => {
  console.log(`🚨 Insecure Server running at http://localhost:${PORT}`);
});
