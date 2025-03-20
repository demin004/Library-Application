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

// GET /returns - Display return processing page
router.get('/', isAuthenticated, (req, res) => {
    // Get all active borrowings
    const sql = `
        SELECT borrowing.*,
               books.title as book_title,
               books.isbn as book_isbn,
               members.name as member_name,
               members.email as member_email,
               CASE 
                   WHEN date('now') > borrowing.due_date 
                   THEN julianday(date('now')) - julianday(borrowing.due_date)
                   ELSE 0 
               END as days_overdue
        FROM borrowing
        JOIN books ON borrowing.book_id = books.id
        JOIN members ON borrowing.member_id = members.id
        WHERE borrowing.status = 'borrowed'
        ORDER BY borrowing.due_date ASC
    `;
    
    db.all(sql, [], (err, borrowings) => {
        if (err) {
            console.error(err);
            req.session.error_msg = 'Error fetching active borrowings';
            return res.redirect('/');
        }
        
        res.render('returns/index', {
            title: 'Process Returns',
            borrowings,
            user: req.session.user
        });
    });
});

// GET /returns/search - Search borrowings by book ISBN or member details
router.get('/search', isAuthenticated, (req, res) => {
    const { query } = req.query;
    
    if (!query) {
        return res.redirect('/returns');
    }

    const sql = `
        SELECT borrowing.*,
               books.title as book_title,
               books.isbn as book_isbn,
               members.name as member_name,
               members.email as member_email,
               CASE 
                   WHEN date('now') > borrowing.due_date 
                   THEN julianday(date('now')) - julianday(borrowing.due_date)
                   ELSE 0 
               END as days_overdue
        FROM borrowing
        JOIN books ON borrowing.book_id = books.id
        JOIN members ON borrowing.member_id = members.id
        WHERE borrowing.status = 'borrowed'
        AND (
            books.isbn LIKE ? OR
            books.title LIKE ? OR
            members.name LIKE ? OR
            members.email LIKE ?
        )
        ORDER BY borrowing.due_date ASC
    `;

    const searchPattern = `%${query}%`;
    
    db.all(sql, [searchPattern, searchPattern, searchPattern, searchPattern], (err, borrowings) => {
        if (err) {
            console.error(err);
            req.session.error_msg = 'Error searching borrowings';
            return res.redirect('/returns');
        }
        
        res.render('returns/index', {
            title: 'Process Returns',
            borrowings,
            searchQuery: query,
            user: req.session.user
        });
    });
});

// POST /returns/process/:id - Process a book return
router.post('/process/:id', isAuthenticated, (req, res) => {
    const borrowingId = req.params.id;
    const { condition_notes } = req.body;

    // Start a transaction
    db.serialize(() => {
        db.run('BEGIN TRANSACTION');

        // Get borrowing details
        const borrowingSQL = `
            SELECT borrowing.*, books.id as book_id
            FROM borrowing
            JOIN books ON borrowing.book_id = books.id
            WHERE borrowing.id = ? AND borrowing.status = 'borrowed'
        `;

        db.get(borrowingSQL, [borrowingId], (err, borrowing) => {
            if (err) {
                console.error(err);
                db.run('ROLLBACK');
                req.session.error_msg = 'Database error occurred';
                return res.redirect('/returns');
            }

            if (!borrowing) {
                db.run('ROLLBACK');
                req.session.error_msg = 'Invalid borrowing record or book already returned';
                return res.redirect('/returns');
            }

            // Update borrowing record
            const updateBorrowingSQL = `
                UPDATE borrowing
                SET status = 'returned',
                    return_date = date('now'),
                    condition_notes = ?
                WHERE id = ?
            `;

            db.run(updateBorrowingSQL, [condition_notes || null, borrowingId], (err) => {
                if (err) {
                    console.error(err);
                    db.run('ROLLBACK');
                    req.session.error_msg = 'Error updating borrowing record';
                    return res.redirect('/returns');
                }

                // Update book available copies
                const updateBookSQL = `
                    UPDATE books
                    SET available_copies = available_copies + 1
                    WHERE id = ?
                `;

                db.run(updateBookSQL, [borrowing.book_id], (err) => {
                    if (err) {
                        console.error(err);
                        db.run('ROLLBACK');
                        req.session.error_msg = 'Error updating book availability';
                        return res.redirect('/returns');
                    }

                    // If book needs maintenance based on condition notes
                    if (condition_notes && condition_notes.toLowerCase().includes('damage')) {
                        const maintenanceSQL = `
                            INSERT INTO maintenance (
                                book_id, maintenance_date, description, status
                            ) VALUES (?, date('now'), ?, 'pending')
                        `;

                        db.run(maintenanceSQL, [borrowing.book_id, condition_notes], (err) => {
                            if (err) {
                                console.error(err);
                                db.run('ROLLBACK');
                                req.session.error_msg = 'Error creating maintenance record';
                                return res.redirect('/returns');
                            }

                            db.run('COMMIT');
                            req.session.success_msg = 'Book returned successfully and maintenance record created';
                            res.redirect('/returns');
                        });
                    } else {
                        db.run('COMMIT');
                        req.session.success_msg = 'Book returned successfully';
                        res.redirect('/returns');
                    }
                });
            });
        });
    });
});

// GET /returns/history - View return history
router.get('/history', isAuthenticated, (req, res) => {
    const sql = `
        SELECT borrowing.*,
               books.title as book_title,
               books.isbn as book_isbn,
               members.name as member_name,
               members.email as member_email,
               CASE 
                   WHEN borrowing.return_date > borrowing.due_date 
                   THEN julianday(borrowing.return_date) - julianday(borrowing.due_date)
                   ELSE 0 
               END as days_overdue
        FROM borrowing
        JOIN books ON borrowing.book_id = books.id
        JOIN members ON borrowing.member_id = members.id
        WHERE borrowing.status = 'returned'
        ORDER BY borrowing.return_date DESC
        LIMIT 100
    `;
    
    db.all(sql, [], (err, returns) => {
        if (err) {
            console.error(err);
            req.session.error_msg = 'Error fetching return history';
            return res.redirect('/returns');
        }
        
        res.render('returns/history', {
            title: 'Return History',
            returns,
            user: req.session.user
        });
    });
});

module.exports = router;