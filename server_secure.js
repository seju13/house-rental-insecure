const express = require('express');
const mysql = require('mysql2');
const path = require('path');
const bodyParser = require('body-parser');
const bcrypt = require('bcrypt');
const xss = require('xss');
const helmet = require('helmet');

const app = express();
const PORT = 4000;
const https = require('https');
const fs = require('fs');

app.use('/secure', (req, res, next) => {
  if (req.path === '/home.html') {
    return next(); // Allow route handler to take over
  }
  express.static(path.join(__dirname, 'secure'))(req, res, next);
});

app.use(
  helmet.contentSecurityPolicy({
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      objectSrc: ["'none'"],
      upgradeInsecureRequests: [],
    },
  })
);


app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));


// Middleware



// DB Connection
const db = mysql.createConnection({
  host: 'localhost',
  user: 'root',
  password: 'root123@',
  database: 'house_rental',
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


app.get ('/', (req,res)=>{
  res.sendFile(path.join(__dirname,'secure','start.html'))
})

// Show login page
app.get('/secure/login.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'secure', 'login.html'));
});

// Login securely
app.post('/secure/login', (req, res) => {
  const { username, password } = req.body;

  db.query('SELECT * FROM secureUsers WHERE username = ?', [username], (err, results) => {
    if (err) return res.send('DB Error');
    if (results.length === 0) return res.redirect('/secure/error.html?message=' + encodeURIComponent('Invalid Username!!'));

    const user = results[0];
    bcrypt.compare(password, user.password, (err, match) => {
      if (match) {
        res.redirect('/secure/home.html');
      } else {
        res.redirect('/secure/error.html?message=' + encodeURIComponent('Wrong password!!'))
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

  if (!username || !password) res.redirect('/secure/error.html?message=' + encodeURIComponent('all fields are required!!'));

  const safeUsername = xss(username.trim());

  const invalidPattern = /[<>/"'`;]|script/gi;
  if (invalidPattern.test(safeUsername)) {
    return res.redirect('/secure/error.html?message=' + encodeURIComponent('Invalid characters in username'));
    
  }

  db.query('SELECT * FROM secureUsers WHERE username = ?', [safeUsername], (err, results) => {
    if (err) return  res.redirect('/secure/error.html?message=' + encodeURIComponent('Fetching users failed!!'));
;
    if (results.length > 0) return res.redirect('/secure/error.html?message=' + encodeURIComponent('User already exits!!'));


    bcrypt.hash(password, 10, (err, hash) => {
      if (err) return res.redirect('/secure/error.html?message=' + encodeURIComponent('Password hashing error!! Try again..'));
      ;

      db.query('INSERT INTO secureUsers (username, password) VALUES (?, ?)', [safeUsername, hash], (err) => {
        if (err) return res.redirect('/secure/error.html?message=' + encodeURIComponent('Registration failed!!'));

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
    return res.redirect('/secure/error.html?message=' + encodeURIComponent('All fields Required '));
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
    return res.redirect('/secure/error.html?message=' + encodeURIComponent('Invalid input'));
    ;
  }

  const query = `INSERT INTO properties (title, description, price, owner) VALUES (?, ?, ?, ?)`;
  db.query(query, [title, description, price, owner], err => {
    if (err) {
      console.error(err);
      return res.redirect('/secure/error.html?message=' + encodeURIComponent('Insert Failed!!'));
      
    }
    res.redirect('/secure/home.html');
  });
});


// Get listings as JSON
app.get('/secure/listings', (req, res) => {
  console.log("hitss the listings api")
  db.query('SELECT * FROM properties', (err, results) => {
    if (err) return res.status(500).json({ error: 'Failed to load properties' });
    res.json(results);
  });
});


// Home page with escaped output
app.get('/secure/home.html', (req, res) => {

  // console.log("hitting home.html")

  db.query('SELECT * FROM properties', (err, results) => {
    if (err) res.redirect('/secure/error.html?message=' + encodeURIComponent('Load error!!'));

      let html = `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <title>Secure Rental Listings</title>
        <style>
          body {
            font-family: Arial, sans-serif;
            margin: 0;
            padding: 0;
            background-color: #f5f5f5;
          }
  
          .navbar {
            background-color: #333;
            padding: 15px;
            color: white;
            display: flex;
            justify-content: space-between;
            align-items: center;
          }
  
          .navbar h2 {
            margin: 0;
          }
  
          .navbar a {
            color: white;
            margin-left: 15px;
            text-decoration: none;
          }
  
          .container {
            padding: 20px;
          }
  
          h1 {
            color: #333;
          }
  
          a.add-btn {
            display: inline-block;
            margin-bottom: 20px;
            padding: 10px 15px;
            background-color: #28a745;
            color: white;
            text-decoration: none;
            border-radius: 5px;
          }
  
          ul#property-list {
            list-style-type: none;
            padding: 0;
          }
  
          ul#property-list li {
            background-color: white;
            margin-bottom: 15px;
            padding: 15px;
            border-radius: 5px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
          }
  
          footer {
            background-color: #333;
            color: white;
            text-align: center;
            padding: 10px 0;
            margin-top: 10px;
            bottom: 0;
            width: 100%;
          }
  
          ul#property-list li {
            background-color: white;
            margin-bottom: 15px;
            padding: 15px;
            border-radius: 8px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
            position: relative;
            transition: transform 0.2s ease;
          }
  
          ul#property-list li:hover {
            transform: scale(1.01);
          }
  
          ul#property-list li strong {
            font-size: 18px;
            color: #007bff;
          }
  
          ul#property-list li a {
            text-decoration: none;
            color: #007bff;
            font-weight: 500;
          }
  
          ul#property-list li a:hover {
            text-decoration: underline;
          }
  
          ul#property-list li a + a {
            margin-left: 10px;
          }
  
        </style>
      </head>
      <body>
  
        <div class="navbar">
          <h2>🏠 Secure Rentals</h2>
          <div>
            <a href="/secure/home.html">Home</a>
            <a href="/secure/add.html">Add Property</a>
            <a href="/secure/login.html">Logout</a>
          </div>
        </div>
  
        <div class="container">
          <h1>secure Rental Property Listings</h1>
          <a class="add-btn" href="/secure/add.html">+ Add New Property</a>
          <ul id="property-list">
      `;

      results.forEach(p => {
        html += `
          <li>
            <strong>${p.title}</strong><br>
            ${p.description}<br>
            ₹${p.price}<br>
            Owner: ${p.owner}<br>
            <a href="/secure/edit/${p.id}">✏️ Edit</a> |
            <a href="/secure/delete/${p.id}" onclick="return confirm('Are you sure you want to delete this property?')">🗑️ Delete</a>
          </li>`;
      });
  
      html += `
          </ul>
        </div>
  
        <footer>
          <p>&copy; 2025 secure Rentals Inc. | Made with ❤️ by K</p>
        </footer>
  
      </body>
      </html>`;
  
      res.send(html);
    });
  });


  // Show Edit Property Form (vulnerable)
app.get('/secure/edit/:id', (req, res) => {
  const { id } = req.params;
  const query = `SELECT * FROM properties WHERE id = ${id}`;

  db.query(query, (err, results) => {
    if (err || results.length === 0) {
      return res.redirect('/secure/error.html?message=' + encodeURIComponent('Edit Failed'));
    }

    const property = results[0];
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Edit Property</title>
        <style>
          body {
            font-family: Arial, sans-serif;
            margin: 0;
            padding: 0;
            background-color: #f5f5f5;
          }

          .navbar {
            background-color: #333;
            padding: 15px;
            color: white;
            display: flex;
            justify-content: space-between;
            align-items: center;
          }

          .navbar h2 {
            margin: 0;
          }

          .navbar a {
            color: white;
            margin-left: 15px;
            text-decoration: none;
          }

          .container {
            padding: 30px;
            max-width: 600px;
            margin: auto;
            background-color: white;
            border-radius: 8px;
            box-shadow: 0 2px 6px rgba(0, 0, 0, 0.1);
            margin-top: 40px;
          }

          h1, h2 {
            color: #333;
          }

          label {
            display: block;
            margin-top: 15px;
            font-weight: bold;
          }

          input[type="text"],
          input[type="number"],
          textarea {
            width: 100%;
            padding: 10px;
            margin-top: 5px;
            border: 1px solid #ccc;
            border-radius: 5px;
            box-sizing: border-box;
          }

          input[type="submit"] {
            margin-top: 20px;
            padding: 10px 20px;
            background-color: #007bff;
            border: none;
            color: white;
            font-size: 16px;
            border-radius: 5px;
            cursor: pointer;
          }

          input[type="submit"]:hover {
            background-color: #0056b3;
          }

          a.back-link {
            display: inline-block;
            margin-top: 20px;
            text-decoration: none;
            color: #333;
          }

          a.back-link:hover {
            text-decoration: underline;
          }

          footer {
            background-color: #333;
            color: white;
            text-align: center;
            padding: 10px 0;
            position: fixed;
            bottom: 0;
            width: 100%;
          }
        </style>
      </head>
      <body>
        <div class="navbar">
          <h2>🏠 Secure Rentals</h2>
          <div>
            <a href="/secure/home.html">Home</a>
            <a href="/secure/add.html">Add Property</a>
            <a href="/secure/login.html">Logout</a>
          </div>
        </div>

        <div class="container">
          <h2>Edit Property</h2>
          <form method="POST" action="/secure/edit/${id}">
            <label>Title:</label>
            <input type="text" name="title" value="${property.title}" required>

            <label>Description:</label>
            <textarea name="description" required>${property.description}</textarea>

            <label>Price:</label>
            <input type="number" name="price" value="${property.price}" required>

            <label>Owner:</label>
            <input type="text" name="owner" value="${property.owner}" required>

            <input type="submit" value="Update Property">
          </form>

          <a class="back-link" href="/secure/home.html">← Back to Home</a>
        </div>

        <footer>
          <p>&copy; 2025 Secure Rentals Inc. | Made with ❤️ by K</p>
        </footer>
      </body>
      </html>
    `;
    res.send(html);
  });
});

// Process Edit Form (vulnerable to SQLi)
app.post('/secure/edit/:id', (req, res) => {
  const { id } = req.params;
  const { title, description, price, owner } = req.body;
  const query = `UPDATE properties SET title='${title}', description='${description}', price='${price}', owner='${owner}' WHERE id=${id}`;

  db.query(query, err => {
    if (err) {
      console.log('Update Error:', err);
      return res.redirect('/secure/error.html?message=' + encodeURIComponent('Update Failed'));
    }
    res.redirect('/secure/home.html');
  });
});

// Delete Property (vulnerable to SQLi)
app.get('/secure/delete/:id', (req, res) => {
  const { id } = req.params;
  const query = `DELETE FROM properties WHERE id=${id}`;

  db.query(query, err => {
    if (err) {
      console.log('Delete Error:', err);
      return res.redirect('/secure/error.html?message=' + encodeURIComponent('Delete Failed'));
    }
    res.redirect('/secure/home.html');
  });
});

const options = {
  key: fs.readFileSync('server.key'),
  cert: fs.readFileSync('server.cert'),
};

https.createServer(options, app).listen(PORT, () => {
  console.log(`🔐 Secure HTTPS Server running at https://localhost:${PORT}`);
});


// app.listen(PORT, () => {
//   console.log(`✅ Secure Server running at http://localhost:${PORT}`);
// });
