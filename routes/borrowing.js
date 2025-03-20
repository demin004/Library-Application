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

// GET /borrowing - Display all active borrowings
router.get('/', isAuthenticated, (req, res) => {
    const sql = `
        SELECT borrowing.*,
               books.title as book_title,
               books.isbn as book_isbn,
               members.name as member_name,
               members.email as member_email
        FROM borrowing
        JOIN books ON borrowing.book_id = books.id
        JOIN members ON borrowing.member_id = members.id
        WHERE borrowing.status = 'borrowed'
        ORDER BY borrowing.borrow_date DESC
    `;
    
    db.all(sql, [], (err, borrowings) => {
        if (err) {
            console.error(err);
            req.session.error_msg = 'Error fetching borrowings';
            return res.redirect('/');
        }
        
        res.render('borrowing/index', {
            title: 'Active Borrowings',
            borrowings,
            user: req.session.user
        });
    });
});

// GET /borrowing/new - Display borrowing form
router.get('/new', isAuthenticated, (req, res) => {
    // Get available books and active members
    const booksSQL = `
        SELECT id, title, isbn, available_copies 
        FROM books 
        WHERE available_copies > 0
        ORDER BY title
    `;
    
    const membersSQL = `
        SELECT id, name, email 
        FROM members 
        WHERE status = 'active'
        ORDER BY name
    `;

    db.all(booksSQL, [], (err, books) => {
        if (err) {
            console.error(err);
            req.session.error_msg = 'Error fetching available books';
            return res.redirect('/borrowing');
        }

        db.all(membersSQL, [], (err, members) => {
            if (err) {
                console.error(err);
                req.session.error_msg = 'Error fetching active members';
                return res.redirect('/borrowing');
            }

            res.render('borrowing/new', {
                title: 'New Borrowing',
                books,
                members,
                user: req.session.user
            });
        });
    });
});

// POST /borrowing/new - Handle new borrowing
router.post('/new', isAuthenticated, (req, res) => {
    const { member_id, book_id, borrow_date, due_date } = req.body;

    // Validation
    let errors = [];
    if (!member_id || !book_id || !borrow_date || !due_date) {
        errors.push('Please fill in all fields');
    }

    const borrowDate = new Date(borrow_date);
    const dueDate = new Date(due_date);
    const today = new Date();

    if (borrowDate > today) {
        errors.push('Borrow date cannot be in the future');
    }
    if (dueDate <= borrowDate) {
        errors.push('Due date must be after borrow date');
    }

    if (errors.length > 0) {
        // Fetch books and members again for the form
        const booksSQL = 'SELECT id, title, isbn FROM books WHERE available_copies > 0';
        const membersSQL = 'SELECT id, name, email FROM members WHERE status = "active"';

        db.all(booksSQL, [], (err, books) => {
            if (err) {
                console.error(err);
                errors.push('Error fetching available books');
            }

            db.all(membersSQL, [], (err, members) => {
                if (err) {
                    console.error(err);
                    errors.push('Error fetching active members');
                }

                return res.render('borrowing/new', {
                    title: 'New Borrowing',
                    errors,
                    books,
                    members,
                    user: req.session.user,
                    formData: req.body
                });
            });
        });
        return;
    }

    // Start a transaction
    db.serialize(() => {
        db.run('BEGIN TRANSACTION');

        // Check if book is available
        db.get('SELECT available_copies FROM books WHERE id = ?', [book_id], (err, book) => {
            if (err) {
                console.error(err);
                db.run('ROLLBACK');
                req.session.error_msg = 'Database error occurred';
                return res.redirect('/borrowing/new');
            }

            if (!book || book.available_copies <= 0) {
                db.run('ROLLBACK');
                req.session.error_msg = 'Book is not available for borrowing';
                return res.redirect('/borrowing/new');
            }

            // Check if member has any overdue books
            const overdueSQL = `
                SELECT COUNT(*) as overdue_count
                FROM borrowing
                WHERE member_id = ?
                AND status = 'borrowed'
                AND due_date < date('now')
            `;

            db.get(overdueSQL, [member_id], (err, result) => {
                if (err) {
                    console.error(err);
                    db.run('ROLLBACK');
                    req.session.error_msg = 'Database error occurred';
                    return res.redirect('/borrowing/new');
                }

                if (result.overdue_count > 0) {
                    db.run('ROLLBACK');
                    req.session.error_msg = 'Member has overdue books and cannot borrow more';
                    return res.redirect('/borrowing/new');
                }

                // Create borrowing record
                const borrowSQL = `
                    INSERT INTO borrowing (
                        member_id, book_id, borrow_date, 
                        due_date, status
                    ) VALUES (?, ?, ?, ?, 'borrowed')
                `;

                db.run(borrowSQL, [member_id, book_id, borrow_date, due_date], (err) => {
                    if (err) {
                        console.error(err);
                        db.run('ROLLBACK');
                        req.session.error_msg = 'Error creating borrowing record';
                        return res.redirect('/borrowing/new');
                    }

                    // Update book available copies
                    const updateSQL = `
                        UPDATE books 
                        SET available_copies = available_copies - 1
                        WHERE id = ?
                    `;

                    db.run(updateSQL, [book_id], (err) => {
                        if (err) {
                            console.error(err);
                            db.run('ROLLBACK');
                            req.session.error_msg = 'Error updating book availability';
                            return res.redirect('/borrowing/new');
                        }

                        db.run('COMMIT');
                        req.session.success_msg = 'Book borrowed successfully';
                        res.redirect('/borrowing');
                    });
                });
            });
        });
    });
});

// GET /borrowing/:id - Display borrowing details
router.get('/:id', isAuthenticated, (req, res) => {
    const borrowingId = req.params.id;
    
    const sql = `
        SELECT borrowing.*,
               books.title as book_title,
               books.isbn as book_isbn,
               members.name as member_name,
               members.email as member_email
        FROM borrowing
        JOIN books ON borrowing.book_id = books.id
        JOIN members ON borrowing.member_id = members.id
        WHERE borrowing.id = ?
    `;

    db.get(sql, [borrowingId], (err, borrowing) => {
        if (err) {
            console.error(err);
            req.session.error_msg = 'Error fetching borrowing details';
            return res.redirect('/borrowing');
        }

        if (!borrowing) {
            req.session.error_msg = 'Borrowing record not found';
            return res.redirect('/borrowing');
        }

        res.render('borrowing/details', {
            title: 'Borrowing Details',
            borrowing,
            user: req.session.user
        });
    });
});

module.exports = router;