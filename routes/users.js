const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const db = require('../config/db');

// Middleware to check if user is authenticated
const isAuthenticated = (req, res, next) => {
    if (req.session.user) {
        return next();
    }
    req.session.error_msg = 'Please log in to access this resource';
    res.redirect('/users/login');
};

// GET /users/register - Display registration form
router.get('/register', (req, res) => {
    res.render('users/register', {
        title: 'User Registration',
        user: req.session.user
    });
});

// POST /users/register - Handle user registration
router.post('/register', async (req, res) => {
    const { username, email, password, confirm_password } = req.body;
    let errors = [];

    // Validation
    if (!username || !email || !password || !confirm_password) {
        errors.push('Please fill in all fields');
    }
    if (password !== confirm_password) {
        errors.push('Passwords do not match');
    }
    if (password.length < 6) {
        errors.push('Password should be at least 6 characters');
    }

    if (errors.length > 0) {
        return res.render('users/register', {
            title: 'User Registration',
            errors,
            username,
            email
        });
    }

    try {
        // Check if user already exists
        db.get('SELECT id FROM users WHERE username = ? OR email = ?', [username, email], async (err, user) => {
            if (err) throw err;
            
            if (user) {
                errors.push('Username or email already registered');
                return res.render('users/register', {
                    title: 'User Registration',
                    errors,
                    username,
                    email
                });
            }

            // Hash password
            const salt = await bcrypt.genSalt(10);
            const hashedPassword = await bcrypt.hash(password, salt);

            // Insert new user
            const sql = 'INSERT INTO users (username, email, password) VALUES (?, ?, ?)';
            db.run(sql, [username, email, hashedPassword], (err) => {
                if (err) throw err;
                
                req.session.success_msg = 'You are now registered and can log in';
                res.redirect('/users/login');
            });
        });
    } catch (err) {
        console.error(err);
        res.render('users/register', {
            title: 'User Registration',
            errors: ['Server error occurred'],
            username,
            email
        });
    }
});

// GET /users/login - Display login form
router.get('/login', (req, res) => {
    res.render('users/login', {
        title: 'Login',
        user: req.session.user
    });
});

// POST /users/login - Handle login
router.post('/login', (req, res) => {
    const { username, password } = req.body;

    // Validate input
    if (!username || !password) {
        return res.render('users/login', {
            title: 'Login',
            errors: ['Please fill in all fields'],
            username
        });
    }

    // Check user credentials
    db.get('SELECT * FROM users WHERE username = ?', [username], async (err, user) => {
        if (err) throw err;

        if (!user) {
            return res.render('users/login', {
                title: 'Login',
                errors: ['Invalid credentials'],
                username
            });
        }

        // Compare password
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.render('users/login', {
                title: 'Login',
                errors: ['Invalid credentials'],
                username
            });
        }

        // Set session
        req.session.user = {
            id: user.id,
            username: user.username,
            email: user.email
        };
        res.redirect('/');
    });
});

// GET /users/logout - Handle logout
router.get('/logout', (req, res) => {
    req.session.destroy((err) => {
        if (err) throw err;
        res.redirect('/users/login');
    });
});

// GET /users/profile - Display user profile
router.get('/profile', isAuthenticated, (req, res) => {
    res.render('users/profile', {
        title: 'User Profile',
        user: req.session.user
    });
});

module.exports = router;