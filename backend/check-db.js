// backend/check-db.js
const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./mtg_marketplace.db');

console.log('Checking database structure...\n');

// Check listings table structure
db.all("PRAGMA table_info(listings)", (err, columns) => {
  if (err) {
    console.error('Error checking table:', err);
    return;
  }
  
  console.log('Listings table columns:');
  columns.forEach(col => {
    console.log(`  - ${col.name} (${col.type})`);
  });
  
  // Check if we need to add missing columns
  const columnNames = columns.map(col => col.name);
  const requiredColumns = ['set_name', 'views', 'watchers', 'updated_at', 'sold_date'];
  const missingColumns = requiredColumns.filter(col => !columnNames.includes(col));
  
  if (missingColumns.length > 0) {
    console.log('\nMissing columns detected:', missingColumns);
    console.log('Adding missing columns...');
    
    missingColumns.forEach(column => {
      let query = '';
      switch(column) {
        case 'set_name':
          query = 'ALTER TABLE listings ADD COLUMN set_name TEXT';
          break;
        case 'views':
          query = 'ALTER TABLE listings ADD COLUMN views INTEGER DEFAULT 0';
          break;
        case 'watchers':
          query = 'ALTER TABLE listings ADD COLUMN watchers INTEGER DEFAULT 0';
          break;
        case 'updated_at':
          query = 'ALTER TABLE listings ADD COLUMN updated_at DATETIME DEFAULT CURRENT_TIMESTAMP';
          break;
        case 'sold_date':
          query = 'ALTER TABLE listings ADD COLUMN sold_date DATETIME';
          break;
      }
      
      db.run(query, (err) => {
        if (err && !err.message.includes('duplicate column')) {
          console.error(`Failed to add ${column}:`, err.message);
        } else {
          console.log(`✓ Added column: ${column}`);
        }
      });
    });
  } else {
    console.log('\n✓ All required columns exist');
  }
  
  // Count existing listings
  db.get("SELECT COUNT(*) as count FROM listings", (err, result) => {
    if (!err) {
      console.log(`\nTotal listings in database: ${result.count}`);
    }
  });
  
  setTimeout(() => {
    db.close();
  }, 2000);
});