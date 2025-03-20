const express = require('express');
const session = require('express-session');
const SQLiteStore = require('connect-sqlite3')(session);
const path = require('path');
const db = require('./config/db');

const app = express();

// Middleware
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Session configuration
app.use(session({
    store: new SQLiteStore({
        db: 'sessions.db',
        dir: './config'
    }),
    secret: 'your-secret-key',
    resave: false,
    saveUninitialized: false,
    cookie: {
        maxAge: 1000 * 60 * 60 * 24 // 24 hours
    }
}));

// Flash messages and user middleware
app.use((req, res, next) => {
    res.locals.success_msg = req.session.success_msg;
    res.locals.error_msg = req.session.error_msg;
    res.locals.user = req.session.user || null;
    delete req.session.success_msg;
    delete req.session.error_msg;
    next();
});

// Import routes
const usersRouter = require('./routes/users');
const booksRouter = require('./routes/books');
const membersRouter = require('./routes/members');
const borrowingRouter = require('./routes/borrowing');
const returnsRouter = require('./routes/returns');
const maintenanceRouter = require('./routes/maintenance');

// Use routes
app.use('/users', usersRouter);
app.use('/books', booksRouter);
app.use('/members', membersRouter);
app.use('/borrowing', borrowingRouter);
app.use('/returns', returnsRouter);
app.use('/maintenance', maintenanceRouter);

// Home route
app.get('/', (req, res) => {
    res.render('index', {
        title: 'Library Management System',
        user: req.session.user || null
    });
});

// Error handling middleware
app.use((req, res, next) => {
    res.status(404).render('error', {
        title: '404 Not Found',
        message: 'Page not found'
    });
});

app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).render('error', {
        title: '500 Server Error',
        message: 'Something went wrong!'
    });
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});

module.exports = app;