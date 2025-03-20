const express = require('express');
const router = express.Router();
const db = require('../config/db');

// Middleware to check if user is authenticated
const isAuthenticated = (req, res, next) => {
    if (req.session.user) {
        return next();
    }
    req.session.error_msg = 'Please log in to access this resource';
    res.redirect('/users/login');
};

// GET /books - Display all books
router.get('/', isAuthenticated, (req, res) => {
    const sql = `
        SELECT books.*, 
               (SELECT COUNT(*) FROM borrowing 
                WHERE book_id = books.id AND status = 'borrowed') as borrowed_count
        FROM books
        ORDER BY created_at DESC
    `;
    
    db.all(sql, [], (err, books) => {
        if (err) {
            console.error(err);
            req.session.error_msg = 'Error fetching books';
            return res.redirect('/');
        }
        
        res.render('books/index', {
            title: 'Library Books',
            books,
            user: req.session.user
        });
    });
});

// GET /books/register - Display book registration form
router.get('/register', isAuthenticated, (req, res) => {
    res.render('books/register', {
        title: 'Register New Book',
        user: req.session.user
    });
});

// POST /books/register - Handle book registration
router.post('/register', isAuthenticated, (req, res) => {
    const {
        isbn,
        title,
        author,
        publisher,
        publication_year,
        total_copies
    } = req.body;

    // Validation
    let errors = [];
    if (!isbn || !title || !author || !publisher || !publication_year || !total_copies) {
        errors.push('Please fill in all fields');
    }
    if (isNaN(publication_year) || publication_year < 1000 || publication_year > new Date().getFullYear()) {
        errors.push('Please enter a valid publication year');
    }
    if (isNaN(total_copies) || total_copies < 1) {
        errors.push('Please enter a valid number of copies');
    }

    if (errors.length > 0) {
        return res.render('books/register', {
            title: 'Register New Book',
            errors,
            user: req.session.user,
            book: req.body
        });
    }

    // Check if book with ISBN already exists
    db.get('SELECT id FROM books WHERE isbn = ?', [isbn], (err, book) => {
        if (err) {
            console.error(err);
            errors.push('Database error occurred');
            return res.render('books/register', {
                title: 'Register New Book',
                errors,
                user: req.session.user,
                book: req.body
            });
        }

        if (book) {
            errors.push('Book with this ISBN already exists');
            return res.render('books/register', {
                title: 'Register New Book',
                errors,
                user: req.session.user,
                book: req.body
            });
        }

        // Insert new book
        const sql = `
            INSERT INTO books (
                isbn, title, author, publisher, 
                publication_year, total_copies, available_copies
            ) VALUES (?, ?, ?, ?, ?, ?, ?)
        `;
        
        db.run(sql, [
            isbn,
            title,
            author,
            publisher,
            publication_year,
            total_copies,
            total_copies // Initially, available copies equals total copies
        ], (err) => {
            if (err) {
                console.error(err);
                errors.push('Error registering book');
                return res.render('books/register', {
                    title: 'Register New Book',
                    errors,
                    user: req.session.user,
                    book: req.body
                });
            }

            req.session.success_msg = 'Book registered successfully';
            res.redirect('/books');
        });
    });
});

// GET /books/:id - Display book details
router.get('/:id', isAuthenticated, (req, res) => {
    const bookId = req.params.id;
    
    const sql = `
        SELECT books.*,
               (SELECT COUNT(*) FROM borrowing 
                WHERE book_id = books.id AND status = 'borrowed') as borrowed_count
        FROM books
        WHERE books.id = ?
    `;

    db.get(sql, [bookId], (err, book) => {
        if (err) {
            console.error(err);
            req.session.error_msg = 'Error fetching book details';
            return res.redirect('/books');
        }

        if (!book) {
            req.session.error_msg = 'Book not found';
            return res.redirect('/books');
        }

        // Get borrowing history
        const historySql = `
            SELECT borrowing.*, members.name as member_name
            FROM borrowing
            JOIN members ON borrowing.member_id = members.id
            WHERE book_id = ?
            ORDER BY borrow_date DESC
        `;

        db.all(historySql, [bookId], (err, history) => {
            if (err) {
                console.error(err);
                req.session.error_msg = 'Error fetching borrowing history';
                return res.redirect('/books');
            }

            res.render('books/details', {
                title: book.title,
                book,
                history,
                user: req.session.user
            });
        });
    });
});

// GET /books/:id/edit - Display edit form
router.get('/:id/edit', isAuthenticated, (req, res) => {
    const bookId = req.params.id;
    
    db.get('SELECT * FROM books WHERE id = ?', [bookId], (err, book) => {
        if (err) {
            console.error(err);
            req.session.error_msg = 'Error fetching book details';
            return res.redirect('/books');
        }

        if (!book) {
            req.session.error_msg = 'Book not found';
            return res.redirect('/books');
        }

        res.render('books/edit', {
            title: 'Edit Book',
            book,
            user: req.session.user
        });
    });
});

// POST /books/:id/edit - Handle book update
router.post('/:id/edit', isAuthenticated, (req, res) => {
    const bookId = req.params.id;
    const {
        title,
        author,
        publisher,
        publication_year,
        total_copies
    } = req.body;

    // Validation
    let errors = [];
    if (!title || !author || !publisher || !publication_year || !total_copies) {
        errors.push('Please fill in all fields');
    }
    if (isNaN(publication_year) || publication_year < 1000 || publication_year > new Date().getFullYear()) {
        errors.push('Please enter a valid publication year');
    }
    if (isNaN(total_copies) || total_copies < 1) {
        errors.push('Please enter a valid number of copies');
    }

    if (errors.length > 0) {
        return res.render('books/edit', {
            title: 'Edit Book',
            errors,
            book: { id: bookId, ...req.body },
            user: req.session.user
        });
    }

    // Update book
    const sql = `
        UPDATE books 
        SET title = ?, author = ?, publisher = ?, 
            publication_year = ?, total_copies = ?
        WHERE id = ?
    `;

    db.run(sql, [
        title,
        author,
        publisher,
        publication_year,
        total_copies,
        bookId
    ], (err) => {
        if (err) {
            console.error(err);
            errors.push('Error updating book');
            return res.render('books/edit', {
                title: 'Edit Book',
                errors,
                book: { id: bookId, ...req.body },
                user: req.session.user
            });
        }

        req.session.success_msg = 'Book updated successfully';
        res.redirect(`/books/${bookId}`);
    });
});

module.exports = router;