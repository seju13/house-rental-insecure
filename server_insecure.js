const express = require('express');
const mysql = require('mysql2');
const path = require('path');
const bodyParser = require('body-parser');
const fs = require('fs');
const app = express();
const PORT = 3001;
const cookieParser = require('cookie-parser');

app.use(cookieParser());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// Serve static files from insecure folder EXCEPT home.html
app.use('/insecure', (req, res, next) => {
  if (req.path === '/home.html') {
    return next(); // Skip static serving for /home.html
  }
  express.static(path.join(__dirname, 'insecure'))(req, res, next);
});

const db = mysql.createConnection({
  host: 'localhost',
  user: 'root',
  password: 'root123@',
  database: 'house_rental',
});

db.connect(err => {
  if (err) throw err;
  console.log('Insecure DB Connected');
});

app.get('/',(req, res)=>{

  res.sendFile(path.join(__dirname, 'insecure', 'start.html'))
})

// Show login page
app.get('/insecure/login.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'insecure', 'login.html'));
});

// Show register page (served inline as HTML)
app.get('/insecure/register.html', (req, res) => {
  const registerPage = `
  <!DOCTYPE html>
  <html>
  <head>
    <title>Insecure Register</title>
  </head>
  <body>
    <h2>Register</h2>
    <form method="POST" action="/insecure/register">
      <label>Username:</label><br>
      <input type="text" name="username" required><br>
      <label>Password:</label><br>
      <input type="password" name="password" required><br><br>
      <input type="submit" value="Register">
    </form>
    <br>
    <a href="/insecure/login.html">Back to Login</a>
  </body>
  </html>
  `;
  res.send(registerPage);
});

// Register route (vulnerable to SQL injection)
app.post('/insecure/register', (req, res) => {
  const { username, password } = req.body;
  const query = `INSERT INTO users (username, password) VALUES ('${username}', '${password}')`;

  db.query(query, err => {
    if (err) {
      console.log('Register Error:', err);
      return res.redirect('/insecure/error.html?message=' + encodeURIComponent('Registration failed'));
    }
    res.redirect('/insecure/login.html');
  });
});

// Login route (vulnerable to SQL injection)
app.post('/insecure/login', (req, res) => {
  const { username, password } = req.body;
  const query = `SELECT * FROM users WHERE username='${username}' AND password='${password}'`;

  db.query(query, (err, results) => {
    if (err) return res.redirect('/insecure/error.html?message=' + encodeURIComponent('Login Failed!!'));

    console.log("Query Results: ", results);
    if (results.length > 0) {
      res.cookie('loggedIn', 'true');
      res.redirect('/insecure/home.html');
    } else {
      return res.redirect('/insecure/error.html?message=' + encodeURIComponent('Invalid Login..'));
    }
  });
});

// Add property page
app.get('/insecure/add.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'insecure', 'add.html'));
});

// Add property (vulnerable to XSS & SQLi)
app.post('/insecure/add', (req, res) => {
  const { title, description, price, owner } = req.body;
  const query = `INSERT INTO listings (title, description, price, owner) VALUES ('${title}', '${description}', '${price}', '${owner}')`;

  db.query(query, err => {
    console.error('Insert Error:', err);
    if (err) return res.redirect('/insecure/error.html?message=' + encodeURIComponent('Inserting Properties failed'));
    res.redirect('/insecure/home.html');
  });
});


// Show Edit Property Form (vulnerable)
app.get('/insecure/edit/:id', (req, res) => {
  const { id } = req.params;
  const query = `SELECT * FROM listings WHERE id = ${id}`;

  db.query(query, (err, results) => {
    if (err || results.length === 0) {
      return res.redirect('/insecure/error.html?message=' + encodeURIComponent('Edit Failed'));
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
          <h2>🏠 Insecure Rentals</h2>
          <div>
            <a href="/insecure/home.html">Home</a>
            <a href="/insecure/add.html">Add Property</a>
            <a href="/insecure/login.html">Logout</a>
          </div>
        </div>

        <div class="container">
          <h2>Edit Property</h2>
          <form method="POST" action="/insecure/edit/${id}">
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

          <a class="back-link" href="/insecure/home.html">← Back to Home</a>
        </div>

        <footer>
          <p>&copy; 2025 Insecure Rentals Inc. | Made with ❤️ by K</p>
        </footer>
      </body>
      </html>
    `;
    res.send(html);
  });
});


// Process Edit Form (vulnerable to SQLi)
app.post('/insecure/edit/:id', (req, res) => {
  const { id } = req.params;
  const { title, description, price, owner } = req.body;
  const query = `UPDATE listings SET title='${title}', description='${description}', price='${price}', owner='${owner}' WHERE id=${id}`;

  db.query(query, err => {
    if (err) {
      console.log('Update Error:', err);
      return res.redirect('/insecure/error.html?message=' + encodeURIComponent('Update Failed'));
    }
    res.redirect('/insecure/home.html');
  });
});

// Delete Property (vulnerable to SQLi)
app.get('/insecure/delete/:id', (req, res) => {
  const { id } = req.params;
  const query = `DELETE FROM listings WHERE id=${id}`;

  db.query(query, err => {
    if (err) {
      console.log('Delete Error:', err);
      return res.redirect('/insecure/error.html?message=' + encodeURIComponent('Delete Failed'));
    }
    res.redirect('/insecure/home.html');
  });
});

// Home page showing listings
app.get('/insecure/home.html', (req, res) => {
  if (req.cookies.loggedIn !== 'true') {
    return res.redirect('/insecure/login.html');
  }

  db.query('SELECT * FROM listings', (err, results) => {
    if (err) return res.redirect('/insecure/error.html?message=' + encodeURIComponent('Loading Property Failed!!'));

    let html = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <title>Insecure Rental Listings</title>
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
        <h2>🏠 Insecure Rentals</h2>
        <div>
          <a href="/insecure/home.html">Home</a>
          <a href="/insecure/add.html">Add Property</a>
          <a href="/insecure/login.html">Logout</a>
        </div>
      </div>

      <div class="container">
        <h1>Insecure Rental Property Listings</h1>
        <a class="add-btn" href="/insecure/add.html">+ Add New Property</a>
        <ul id="property-list">
    `;

    results.forEach(p => {
      html += `
        <li>
          <strong>${p.title}</strong><br>
          ${p.description}<br>
          ₹${p.price}<br>
          Owner: ${p.owner}<br>
          <a href="/insecure/edit/${p.id}">✏️ Edit</a> |
          <a href="/insecure/delete/${p.id}" onclick="return confirm('Are you sure you want to delete this property?')">🗑️ Delete</a>
        </li>`;
    });

    html += `
        </ul>
      </div>

      <footer>
        <p>&copy; 2025 Insecure Rentals Inc. | Made with ❤️ by K</p>
      </footer>

    </body>
    </html>`;

    res.send(html);
  });
});

// Get listings as JSON
app.get('/insecure/listings', (req, res) => {
  db.query('SELECT * FROM listings', (err, results) => {
    if (err) return res.status(500).json({ error: 'Failed to load properties' });
    res.json(results);
  });
});

// Error page
app.get('/insecure/error.html', (req, res) => {
  const message = req.query.message || 'An unknown error occurred';
  res.send(`
    <html><body><h1>${message}</h1></body></html>
  `);
});

app.listen(PORT, () => {
  console.log(`Insecure Rental Portal running on http://localhost:${PORT}`);
});
