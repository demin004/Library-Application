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

// GET /maintenance - Display all maintenance records
router.get('/', isAuthenticated, (req, res) => {
    const sql = `
        SELECT maintenance.*,
               books.title as book_title,
               books.isbn as book_isbn
        FROM maintenance
        JOIN books ON maintenance.book_id = books.id
        ORDER BY 
            CASE maintenance.status
                WHEN 'pending' THEN 1
                WHEN 'in_progress' THEN 2
                WHEN 'completed' THEN 3
            END,
            maintenance.maintenance_date DESC
    `;
    
    db.all(sql, [], (err, records) => {
        if (err) {
            console.error(err);
            req.session.error_msg = 'Error fetching maintenance records';
            return res.redirect('/');
        }
        
        res.render('maintenance/index', {
            title: 'Book Maintenance',
            records,
            user: req.session.user
        });
    });
});

// GET /maintenance/new - Display new maintenance record form
router.get('/new', isAuthenticated, (req, res) => {
    // Get all books
    const sql = `
        SELECT id, title, isbn 
        FROM books 
        ORDER BY title
    `;
    
    db.all(sql, [], (err, books) => {
        if (err) {
            console.error(err);
            req.session.error_msg = 'Error fetching books';
            return res.redirect('/maintenance');
        }

        res.render('maintenance/new', {
            title: 'New Maintenance Record',
            books,
            user: req.session.user
        });
    });
});

// POST /maintenance/new - Create new maintenance record
router.post('/new', isAuthenticated, (req, res) => {
    const { book_id, maintenance_date, description } = req.body;

    // Validation
    let errors = [];
    if (!book_id || !maintenance_date || !description) {
        errors.push('Please fill in all fields');
    }

    if (errors.length > 0) {
        // Get books again for the form
        db.all('SELECT id, title, isbn FROM books ORDER BY title', [], (err, books) => {
            if (err) {
                console.error(err);
                errors.push('Error fetching books');
            }

            return res.render('maintenance/new', {
                title: 'New Maintenance Record',
                errors,
                books,
                user: req.session.user,
                formData: req.body
            });
        });
        return;
    }

    // Insert maintenance record
    const sql = `
        INSERT INTO maintenance (
            book_id, maintenance_date, description, status
        ) VALUES (?, ?, ?, 'pending')
    `;

    db.run(sql, [book_id, maintenance_date, description], (err) => {
        if (err) {
            console.error(err);
            req.session.error_msg = 'Error creating maintenance record';
            return res.redirect('/maintenance/new');
        }

        req.session.success_msg = 'Maintenance record created successfully';
        res.redirect('/maintenance');
    });
});

// GET /maintenance/:id - Display maintenance record details
router.get('/:id', isAuthenticated, (req, res) => {
    const maintenanceId = req.params.id;
    
    const sql = `
        SELECT maintenance.*,
               books.title as book_title,
               books.isbn as book_isbn
        FROM maintenance
        JOIN books ON maintenance.book_id = books.id
        WHERE maintenance.id = ?
    `;

    db.get(sql, [maintenanceId], (err, record) => {
        if (err) {
            console.error(err);
            req.session.error_msg = 'Error fetching maintenance record';
            return res.redirect('/maintenance');
        }

        if (!record) {
            req.session.error_msg = 'Maintenance record not found';
            return res.redirect('/maintenance');
        }

        res.render('maintenance/details', {
            title: 'Maintenance Details',
            record,
            user: req.session.user
        });
    });
});

// POST /maintenance/:id/update - Update maintenance record status
router.post('/:id/update', isAuthenticated, (req, res) => {
    const maintenanceId = req.params.id;
    const { status, notes } = req.body;

    // Validation
    if (!status || !['pending', 'in_progress', 'completed'].includes(status)) {
        req.session.error_msg = 'Invalid status value';
        return res.redirect(`/maintenance/${maintenanceId}`);
    }

    // Update maintenance record
    const sql = `
        UPDATE maintenance 
        SET status = ?,
            description = CASE 
                WHEN ? IS NOT NULL AND ? != ''
                THEN description || char(10) || datetime('now') || ': ' || ?
                ELSE description
            END
        WHERE id = ?
    `;

    db.run(sql, [status, notes, notes, notes, maintenanceId], (err) => {
        if (err) {
            console.error(err);
            req.session.error_msg = 'Error updating maintenance record';
            return res.redirect(`/maintenance/${maintenanceId}`);
        }

        // If maintenance is completed, update book status
        if (status === 'completed') {
            const updateBookSQL = `
                UPDATE books
                SET available_copies = available_copies + 1
                WHERE id = (
                    SELECT book_id 
                    FROM maintenance 
                    WHERE id = ?
                )
                AND available_copies < total_copies
            `;

            db.run(updateBookSQL, [maintenanceId], (err) => {
                if (err) {
                    console.error(err);
                    req.session.error_msg = 'Error updating book availability';
                    return res.redirect(`/maintenance/${maintenanceId}`);
                }

                req.session.success_msg = 'Maintenance record updated and book restored to circulation';
                res.redirect('/maintenance');
            });
        } else {
            req.session.success_msg = 'Maintenance record updated successfully';
            res.redirect('/maintenance');
        }
    });
});

// GET /maintenance/history/:bookId - View maintenance history for a specific book
router.get('/history/:bookId', isAuthenticated, (req, res) => {
    const bookId = req.params.bookId;
    
    const sql = `
        SELECT maintenance.*,
               books.title as book_title,
               books.isbn as book_isbn
        FROM maintenance
        JOIN books ON maintenance.book_id = books.id
        WHERE maintenance.book_id = ?
        ORDER BY maintenance.maintenance_date DESC
    `;

    db.all(sql, [bookId], (err, records) => {
        if (err) {
            console.error(err);
            req.session.error_msg = 'Error fetching maintenance history';
            return res.redirect('/maintenance');
        }

        if (records.length === 0) {
            req.session.error_msg = 'No maintenance history found for this book';
            return res.redirect('/maintenance');
        }

        res.render('maintenance/history', {
            title: `Maintenance History - ${records[0].book_title}`,
            records,
            user: req.session.user
        });
    });
});

module.exports = router;