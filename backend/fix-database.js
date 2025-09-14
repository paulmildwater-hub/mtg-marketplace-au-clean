// fix-database.js - FIXED VERSION
// Run this script to add all missing columns to your database
// Save this file in your backend folder and run: node fix-database.js

const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// Connect to your database
const dbPath = path.join(__dirname, 'mtg_marketplace.db');
console.log('Connecting to database at:', dbPath);

const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Error opening database:', err);
    process.exit(1);
  }
  console.log('Connected to SQLite database');
});

// Function to add column if it doesn't exist
function addColumnIfNotExists(table, column, type, defaultValue = null) {
  return new Promise((resolve, reject) => {
    // First check if column exists
    db.all(`PRAGMA table_info(${table})`, (err, columns) => {
      if (err) {
        console.error(`Error checking table ${table}:`, err);
        reject(err);
        return;
      }
      
      const columnExists = columns.some(col => col.name === column);
      
      if (columnExists) {
        console.log(`✓ Column ${table}.${column} already exists`);
        resolve();
      } else {
        // Add the column - handle CURRENT_TIMESTAMP specially
        let query = `ALTER TABLE ${table} ADD COLUMN ${column} ${type}`;
        
        // For DATETIME columns, we can't use CURRENT_TIMESTAMP as default in ALTER TABLE
        // So we'll add the column without default, then update existing rows
        if (defaultValue && !defaultValue.includes('CURRENT_TIMESTAMP')) {
          query += ` DEFAULT ${defaultValue}`;
        }
        
        db.run(query, (err) => {
          if (err) {
            console.error(`✗ Failed to add ${table}.${column}:`, err.message);
            reject(err);
          } else {
            console.log(`✓ Added column ${table}.${column}`);
            
            // If this was a timestamp column, update existing rows with current time
            if (type.includes('DATETIME') && defaultValue && defaultValue.includes('CURRENT_TIMESTAMP')) {
              db.run(`UPDATE ${table} SET ${column} = datetime('now') WHERE ${column} IS NULL`, (updateErr) => {
                if (updateErr) {
                  console.log(`  Warning: Could not set default timestamp for existing rows:`, updateErr.message);
                } else {
                  console.log(`  ✓ Set current timestamp for existing rows`);
                }
                resolve();
              });
            } else {
              resolve();
            }
          }
        });
      }
    });
  });
}

// Main function to update database
async function updateDatabase() {
  console.log('\n=== Starting Database Update ===\n');
  
  try {
    // Add missing columns to listings table
    console.log('Updating listings table...');
    await addColumnIfNotExists('listings', 'status', 'TEXT', "'active'");
    await addColumnIfNotExists('listings', 'updated_at', 'DATETIME', 'CURRENT_TIMESTAMP');
    await addColumnIfNotExists('listings', 'sold_date', 'DATETIME', null);
    await addColumnIfNotExists('listings', 'set_name', 'TEXT', null);
    await addColumnIfNotExists('listings', 'views', 'INTEGER', '0');
    await addColumnIfNotExists('listings', 'watchers', 'INTEGER', '0');
    
    // Add missing columns to users table
    console.log('\nUpdating users table...');
    await addColumnIfNotExists('users', 'stripe_customer_id', 'TEXT', null);
    
    // Add missing columns to orders table
    console.log('\nUpdating orders table...');
    await addColumnIfNotExists('orders', 'shipping_address', 'TEXT', null);
    await addColumnIfNotExists('orders', 'payment_method', 'TEXT', null);
    await addColumnIfNotExists('orders', 'notes', 'TEXT', null);
    await addColumnIfNotExists('orders', 'tracking_number', 'TEXT', null);
    await addColumnIfNotExists('orders', 'updated_at', 'DATETIME', 'CURRENT_TIMESTAMP');
    await addColumnIfNotExists('orders', 'paid_at', 'DATETIME', null);
    await addColumnIfNotExists('orders', 'shipped_at', 'DATETIME', null);
    await addColumnIfNotExists('orders', 'delivered_at', 'DATETIME', null);
    
    // Create missing tables if they don't exist
    console.log('\nCreating missing tables...');
    
    // Create order_items table if it doesn't exist
    await new Promise((resolve, reject) => {
      db.run(`CREATE TABLE IF NOT EXISTS order_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        order_id INTEGER NOT NULL,
        listing_id INTEGER NOT NULL,
        quantity INTEGER DEFAULT 1,
        price DECIMAL(10,2) NOT NULL,
        FOREIGN KEY (order_id) REFERENCES orders(id),
        FOREIGN KEY (listing_id) REFERENCES listings(id)
      )`, (err) => {
        if (err) {
          console.error('Failed to create order_items table:', err);
          reject(err);
        } else {
          console.log('✓ order_items table ready');
          resolve();
        }
      });
    });
    
    // Verify the fix worked
    console.log('\n=== Verifying Database Structure ===\n');
    
    db.all("PRAGMA table_info(listings)", (err, columns) => {
      if (err) {
        console.error('Error verifying listings table:', err);
        return;
      }
      
      console.log('Listings table columns:');
      columns.forEach(col => {
        console.log(`  - ${col.name} (${col.type})${col.dflt_value ? ` DEFAULT ${col.dflt_value}` : ''}`);
      });
      
      // Check for required columns
      const requiredColumns = ['status', 'updated_at', 'sold_date', 'set_name', 'views', 'watchers'];
      const existingColumns = columns.map(col => col.name);
      const missingColumns = requiredColumns.filter(col => !existingColumns.includes(col));
      
      if (missingColumns.length === 0) {
        console.log('\n✓✓✓ SUCCESS: All required columns exist! You can now list cards.');
      } else {
        console.log('\n✗✗✗ ERROR: Still missing columns:', missingColumns.join(', '));
      }
      
      // Also check orders table
      console.log('\nOrders table columns:');
      db.all("PRAGMA table_info(orders)", (err2, orderColumns) => {
        if (!err2) {
          orderColumns.forEach(col => {
            console.log(`  - ${col.name} (${col.type})${col.dflt_value ? ` DEFAULT ${col.dflt_value}` : ''}`);
          });
        }
        
        console.log('\n=== Database Update Complete ===\n');
        console.log('You can now run your application and list cards successfully!');
        
        db.close((err) => {
          if (err) {
            console.error('Error closing database:', err);
          }
          process.exit(0);
        });
      });
    });
    
  } catch (error) {
    console.error('Database update failed:', error);
    db.close();
    process.exit(1);
  }
}

// Run the update
updateDatabase();