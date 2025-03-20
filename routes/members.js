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

// GET /members - Display all members
router.get('/', isAuthenticated, (req, res) => {
    const sql = `
        SELECT members.*,
               (SELECT COUNT(*) FROM borrowing 
                WHERE member_id = members.id AND status = 'borrowed') as active_borrowings
        FROM members
        ORDER BY registered_at DESC
    `;
    
    db.all(sql, [], (err, members) => {
        if (err) {
            console.error(err);
            req.session.error_msg = 'Error fetching members';
            return res.redirect('/');
        }
        
        res.render('members/index', {
            title: 'Library Members',
            members,
            user: req.session.user
        });
    });
});

// GET /members/register - Display member registration form
router.get('/register', isAuthenticated, (req, res) => {
    res.render('members/register', {
        title: 'Register New Member',
        user: req.session.user
    });
});

// POST /members/register - Handle member registration
router.post('/register', isAuthenticated, (req, res) => {
    const { name, address, email, phone } = req.body;

    // Validation
    let errors = [];
    if (!name || !address || !email || !phone) {
        errors.push('Please fill in all fields');
    }
    if (!email.match(/^[\w-]+(\.[\w-]+)*@([\w-]+\.)+[a-zA-Z]{2,7}$/)) {
        errors.push('Please enter a valid email address');
    }
    if (!phone.match(/^[0-9+\-\s()]{8,20}$/)) {
        errors.push('Please enter a valid phone number');
    }

    if (errors.length > 0) {
        return res.render('members/register', {
            title: 'Register New Member',
            errors,
            user: req.session.user,
            member: req.body
        });
    }

    // Check if member with email already exists
    db.get('SELECT id FROM members WHERE email = ?', [email], (err, member) => {
        if (err) {
            console.error(err);
            errors.push('Database error occurred');
            return res.render('members/register', {
                title: 'Register New Member',
                errors,
                user: req.session.user,
                member: req.body
            });
        }

        if (member) {
            errors.push('Member with this email already exists');
            return res.render('members/register', {
                title: 'Register New Member',
                errors,
                user: req.session.user,
                member: req.body
            });
        }

        // Insert new member
        const sql = 'INSERT INTO members (name, address, email, phone) VALUES (?, ?, ?, ?)';
        db.run(sql, [name, address, email, phone], (err) => {
            if (err) {
                console.error(err);
                errors.push('Error registering member');
                return res.render('members/register', {
                    title: 'Register New Member',
                    errors,
                    user: req.session.user,
                    member: req.body
                });
            }

            req.session.success_msg = 'Member registered successfully';
            res.redirect('/members');
        });
    });
});

// GET /members/:id - Display member details
router.get('/:id', isAuthenticated, (req, res) => {
    const memberId = req.params.id;
    
    const sql = `
        SELECT members.*,
               (SELECT COUNT(*) FROM borrowing 
                WHERE member_id = members.id AND status = 'borrowed') as active_borrowings
        FROM members
        WHERE members.id = ?
    `;

    db.get(sql, [memberId], (err, member) => {
        if (err) {
            console.error(err);
            req.session.error_msg = 'Error fetching member details';
            return res.redirect('/members');
        }

        if (!member) {
            req.session.error_msg = 'Member not found';
            return res.redirect('/members');
        }

        // Get borrowing history
        const historySql = `
            SELECT borrowing.*, books.title as book_title
            FROM borrowing
            JOIN books ON borrowing.book_id = books.id
            WHERE member_id = ?
            ORDER BY borrow_date DESC
        `;

        db.all(historySql, [memberId], (err, history) => {
            if (err) {
                console.error(err);
                req.session.error_msg = 'Error fetching borrowing history';
                return res.redirect('/members');
            }

            res.render('members/details', {
                title: member.name,
                member,
                history,
                user: req.session.user
            });
        });
    });
});

// GET /members/:id/edit - Display edit form
router.get('/:id/edit', isAuthenticated, (req, res) => {
    const memberId = req.params.id;
    
    db.get('SELECT * FROM members WHERE id = ?', [memberId], (err, member) => {
        if (err) {
            console.error(err);
            req.session.error_msg = 'Error fetching member details';
            return res.redirect('/members');
        }

        if (!member) {
            req.session.error_msg = 'Member not found';
            return res.redirect('/members');
        }

        res.render('members/edit', {
            title: 'Edit Member',
            member,
            user: req.session.user
        });
    });
});

// POST /members/:id/edit - Handle member update
router.post('/:id/edit', isAuthenticated, (req, res) => {
    const memberId = req.params.id;
    const { name, address, phone, status } = req.body;

    // Validation
    let errors = [];
    if (!name || !address || !phone) {
        errors.push('Please fill in all required fields');
    }
    if (!phone.match(/^[0-9+\-\s()]{8,20}$/)) {
        errors.push('Please enter a valid phone number');
    }
    if (status && !['active', 'inactive'].includes(status)) {
        errors.push('Invalid status value');
    }

    if (errors.length > 0) {
        return res.render('members/edit', {
            title: 'Edit Member',
            errors,
            member: { id: memberId, ...req.body },
            user: req.session.user
        });
    }

    // Update member
    const sql = `
        UPDATE members 
        SET name = ?, address = ?, phone = ?, status = ?
        WHERE id = ?
    `;

    db.run(sql, [name, address, phone, status || 'active', memberId], (err) => {
        if (err) {
            console.error(err);
            errors.push('Error updating member');
            return res.render('members/edit', {
                title: 'Edit Member',
                errors,
                member: { id: memberId, ...req.body },
                user: req.session.user
            });
        }

        req.session.success_msg = 'Member updated successfully';
        res.redirect(`/members/${memberId}`);
    });
});

module.exports = router;