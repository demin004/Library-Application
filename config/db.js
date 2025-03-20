const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');
const path = require('path');

// Create database connection
const db = new sqlite3.Database(path.join(__dirname, '../library.db'), (err) => {
    if (err) {
        console.error('Error connecting to database:', err);
        return;
    }
    console.log('Connected to SQLite database');
});

// Initialize database with schema
const initializeDatabase = () => {
    const schemaSQL = fs.readFileSync(path.join(__dirname, '../models/schema.sql'), 'utf8');
    
    // Split the schema into individual statements
    const statements = schemaSQL.split(';').filter(stmt => stmt.trim());
    
    // Execute each statement
    db.serialize(() => {
        statements.forEach(statement => {
            if (statement.trim()) {
                db.run(statement + ';', (err) => {
                    if (err) {
                        console.error('Error executing schema:', err);
                    }
                });
            }
        });
        console.log('Database schema initialized');
    });
};

// Initialize the database
initializeDatabase();

module.exports = db;