const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const bodyParser = require('body-parser');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));

let db = new sqlite3.Database(path.join(__dirname, 'sauna.db'), (err) => {
  if (err) {
    console.error('Error opening database:', err);
  } else {
    console.log('Connected to SQLite database');
    initializeDatabase();
  }
});

function initializeDatabase() {
  db.serialize(() => {
    db.run(`
      CREATE TABLE IF NOT EXISTS bookings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        checkIn DATETIME,
        checkOut DATETIME,
        totalPrice REAL,
        guestName TEXT,
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    db.run(`
      CREATE TABLE IF NOT EXISTS expenses (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        bookingId INTEGER,
        person TEXT,
        amount REAL,
        comment TEXT,
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(bookingId) REFERENCES bookings(id)
      )
    `);

    db.run(`
      CREATE TABLE IF NOT EXISTS shares (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        bookingId INTEGER,
        person TEXT,
        totalShare REAL,
        spent REAL DEFAULT 0,
        remaining REAL,
        FOREIGN KEY(bookingId) REFERENCES bookings(id)
      )
    `);
  });
}

// Диагностическая страница
app.get('/test', (req, res) => {
  const clientIP = req.ip || req.connection.remoteAddress;
  res.json({
    status: '✅ Сервер работает!',
    serverIP: '192.168.10.198',
    port: 3000,
    clientIP: clientIP,
    message: 'iPhone может подключиться к серверу',
    timestamp: new Date().toISOString()
  });
});

// API для получения всех бронирований
app.get('/api/bookings', (req, res) => {
  db.all('SELECT * FROM bookings ORDER BY checkIn DESC', (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
    } else {
      res.json(rows);
    }
  });
});

// API для добавления новой брони
app.post('/api/bookings', (req, res) => {
  const { checkIn, checkOut, totalPrice, guestName } = req.body;

  const sql = `INSERT INTO bookings (checkIn, checkOut, totalPrice, guestName)
               VALUES (?, ?, ?, ?)`;

  db.run(sql, [checkIn, checkOut, totalPrice, guestName], function(err) {
    if (err) {
      res.status(500).json({ error: err.message });
    } else {
      const bookingId = this.lastID;
      const shareAmount = totalPrice / 5;
      const people = ['Алина', 'Папа', 'Серега', 'Артем', 'Дом'];

      let insertedCount = 0;
      people.forEach(person => {
        const shareSql = `INSERT INTO shares (bookingId, person, totalShare, remaining)
                          VALUES (?, ?, ?, ?)`;
        db.run(shareSql, [bookingId, person, shareAmount, shareAmount], () => {
          insertedCount++;
          if (insertedCount === people.length) {
            res.json({ id: bookingId, checkIn, checkOut, totalPrice, guestName });
          }
        });
      });
    }
  });
});

// API для получения деталей бронирования и расчетов
app.get('/api/bookings/:id/details', (req, res) => {
  const bookingId = req.params.id;

  db.get('SELECT * FROM bookings WHERE id = ?', [bookingId], (err, booking) => {
    if (err) {
      res.status(500).json({ error: err.message });
    } else {
      db.all('SELECT * FROM shares WHERE bookingId = ? ORDER BY person', [bookingId], (err, shares) => {
        if (err) {
          res.status(500).json({ error: err.message });
        } else {
          db.all('SELECT * FROM expenses WHERE bookingId = ? ORDER BY createdAt DESC', [bookingId], (err, expenses) => {
            if (err) {
              res.status(500).json({ error: err.message });
            } else {
              res.json({ booking, shares, expenses });
            }
          });
        }
      });
    }
  });
});

// API для добавления расхода
app.post('/api/expenses', (req, res) => {
  const { bookingId, person, amount, comment } = req.body;

  const sql = `INSERT INTO expenses (bookingId, person, amount, comment)
               VALUES (?, ?, ?, ?)`;

  db.run(sql, [bookingId, person, amount, comment], function(err) {
    if (err) {
      res.status(500).json({ error: err.message });
    } else {
      // Обновляем остаток в таблице shares
      db.run(
        `UPDATE shares SET spent = spent + ?, remaining = totalShare - (spent + ?)
         WHERE bookingId = ? AND person = ?`,
        [amount, amount, bookingId, person],
        () => {
          res.json({ id: this.lastID, bookingId, person, amount, comment });
        }
      );
    }
  });
});

// API для удаления бронирования
app.delete('/api/bookings/:id', (req, res) => {
  const bookingId = req.params.id;

  db.serialize(() => {
    db.run('DELETE FROM expenses WHERE bookingId = ?', [bookingId]);
    db.run('DELETE FROM shares WHERE bookingId = ?', [bookingId]);
    db.run('DELETE FROM bookings WHERE id = ?', [bookingId], function(err) {
      if (err) {
        res.status(500).json({ error: err.message });
      } else {
        res.json({ success: true });
      }
    });
  });
});

// API для удаления расхода
app.delete('/api/expenses/:id', (req, res) => {
  const expenseId = req.params.id;

  db.get('SELECT * FROM expenses WHERE id = ?', [expenseId], (err, expense) => {
    if (err) {
      res.status(500).json({ error: err.message });
    } else {
      db.run(
        `UPDATE shares SET spent = spent - ?, remaining = totalShare - (spent - ?)
         WHERE bookingId = ? AND person = ?`,
        [expense.amount, expense.amount, expense.bookingId, expense.person],
        () => {
          db.run('DELETE FROM expenses WHERE id = ?', [expenseId], () => {
            res.json({ success: true });
          });
        }
      );
    }
  });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on http://localhost:${PORT}`);
  console.log(`Available on your network: http://192.168.10.198:${PORT}`);
});
