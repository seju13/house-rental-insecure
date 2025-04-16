const express = require('express');
const mysql = require('mysql2');
const path = require('path');
const bodyParser = require('body-parser');
const bcrypt = require('bcrypt');
const xss = require('xss');
const helmet = require('helmet');

const app = express();
const PORT = 3000;

// Middleware
app.use(helmet());
app.use(helmet.contentSecurityPolicy({
  directives: {
    defaultSrc: ["'self'"],
    scriptSrc: ["'self'"],
    objectSrc: ["'none'"],
    upgradeInsecureRequests: [],
  }
}));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));
app.use('/secure', express.static(path.join(__dirname, 'secure')));

// DB Connection
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

// Escape HTML for output
function escapeHTML(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// Show login page
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

// Show register page
app.get('/secure/register.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'secure', 'register.html'));
});

// Register securely
app.post('/secure/register', (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) return res.send('All fields are required');

  const safeUsername = xss(username.trim());

  const invalidPattern = /[<>/"'`;]|script/gi;
  if (invalidPattern.test(safeUsername)) {
    return res.send('Invalid characters in username');
  }

  db.query('SELECT * FROM users WHERE username = ?', [safeUsername], (err, results) => {
    if (err) return res.send('Database error');
    if (results.length > 0) return res.send('User already exists');

    bcrypt.hash(password, 10, (err, hash) => {
      if (err) return res.send('Hashing error');

      db.query('INSERT INTO users (username, password) VALUES (?, ?)', [safeUsername, hash], (err) => {
        if (err) return res.send('Registration failed');
        res.redirect('/secure/login.html');
      });
    });
  });
});

// Show add property page
app.get('/secure/add.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'secure', 'add.html'));
});

// Add property securely
app.post('/secure/add', (req, res) => {
  let { title, description, price, owner } = req.body;

  if (!title || !description || !price || !owner) {
    return res.send('All fields required');
  }

  // Sanitize input
  title = xss(title.trim());
  description = xss(description.trim());
  owner = xss(owner.trim());
  price = parseFloat(price);

  if (isNaN(price) || price < 0) {
    return res.send('Invalid price');
  }

  // Check for malicious patterns
  const invalidPattern = /[<>/"'`;]|script/gi;
  if (invalidPattern.test(title) || invalidPattern.test(description) || invalidPattern.test(owner)) {
    return res.send('Invalid input: disallowed characters detected');
  }

  const query = `INSERT INTO properties (title, description, price, owner) VALUES (?, ?, ?, ?)`;
  db.query(query, [title, description, price, owner], err => {
    if (err) {
      console.error(err);
      return res.send('Insert failed');
    }
    res.redirect('/secure/home');
  });
});

// Home page with escaped output
app.get('/secure/home', (req, res) => {
  db.query('SELECT * FROM properties', (err, results) => {
    if (err) return res.send('Load error');

    let html = `<h1>Secure Listings</h1><a href="/secure/add.html">Add Property</a><ul>`;
    results.forEach(p => {
      html += `<li>
        <strong>${escapeHTML(p.title)}</strong><br>
        ${escapeHTML(p.description)}<br>
        ₹${escapeHTML(p.price.toString())}<br>
        Owner: ${escapeHTML(p.owner)}
      </li>`;
    });
    html += '</ul><a href="/secure/login.html">Logout</a>';
    res.send(html);
  });
});

app.listen(PORT, () => {
  console.log(`✅ Secure Server running at http://localhost:${PORT}`);
});
