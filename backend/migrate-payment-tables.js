// backend/migrate-payment-tables.js
// Run this script to add payment-related columns to your database

const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./mtg_marketplace.db');

console.log('Starting payment integration database migration...\n');

db.serialize(() => {
  // Add Stripe customer ID to users table
  db.run(`ALTER TABLE users ADD COLUMN stripe_customer_id TEXT`, (err) => {
    if (err && !err.message.includes('duplicate column')) {
      console.error('Error adding stripe_customer_id:', err);
    } else if (!err) {
      console.log('✅ Added stripe_customer_id to users table');
    }
  });

  // Add PayPal payer ID to users table
  db.run(`ALTER TABLE users ADD COLUMN paypal_payer_id TEXT`, (err) => {
    if (err && !err.message.includes('duplicate column')) {
      console.error('Error adding paypal_payer_id:', err);
    } else if (!err) {
      console.log('✅ Added paypal_payer_id to users table');
    }
  });

  // Add payment fields to orders table
  const orderColumns = [
    { name: 'stripe_payment_intent_id', type: 'TEXT' },
    { name: 'paypal_order_id', type: 'TEXT' },
    { name: 'paypal_capture_id', type: 'TEXT' },
    { name: 'payment_status', type: 'TEXT DEFAULT "pending"' },
    { name: 'refund_amount', type: 'DECIMAL(10,2)' },
    { name: 'refund_reason', type: 'TEXT' },
    { name: 'refunded_at', type: 'DATETIME' },
    { name: 'payment_fee', type: 'DECIMAL(10,2)' },
    { name: 'net_amount', type: 'DECIMAL(10,2)' }
  ];

  orderColumns.forEach(column => {
    db.run(`ALTER TABLE orders ADD COLUMN ${column.name} ${column.type}`, (err) => {
      if (err && !err.message.includes('duplicate column')) {
        console.error(`Error adding ${column.name}:`, err);
      } else if (!err) {
        console.log(`✅ Added ${column.name} to orders table`);
      }
    });
  });

  // Create payment_methods table for saved cards
  db.run(`
    CREATE TABLE IF NOT EXISTS payment_methods (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      stripe_payment_method_id TEXT,
      paypal_billing_agreement_id TEXT,
      type TEXT NOT NULL CHECK(type IN ('card', 'paypal')),
      brand TEXT,
      last4 TEXT,
      exp_month INTEGER,
      exp_year INTEGER,
      is_default BOOLEAN DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id)
    )
  `, (err) => {
    if (err) {
      console.error('Error creating payment_methods table:', err);
    } else {
      console.log('✅ Created payment_methods table');
    }
  });

  // Create payment_logs table for tracking all payment events
  db.run(`
    CREATE TABLE IF NOT EXISTS payment_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id INTEGER,
      user_id INTEGER,
      event_type TEXT NOT NULL,
      payment_method TEXT,
      amount DECIMAL(10,2),
      currency TEXT DEFAULT 'AUD',
      status TEXT,
      provider_reference TEXT,
      error_message TEXT,
      metadata TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (order_id) REFERENCES orders(id),
      FOREIGN KEY (user_id) REFERENCES users(id)
    )
  `, (err) => {
    if (err) {
      console.error('Error creating payment_logs table:', err);
    } else {
      console.log('✅ Created payment_logs table');
    }
  });

  // Create refunds table
  db.run(`
    CREATE TABLE IF NOT EXISTS refunds (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      amount DECIMAL(10,2) NOT NULL,
      reason TEXT,
      status TEXT DEFAULT 'pending',
      stripe_refund_id TEXT,
      paypal_refund_id TEXT,
      processed_at DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (order_id) REFERENCES orders(id),
      FOREIGN KEY (user_id) REFERENCES users(id)
    )
  `, (err) => {
    if (err) {
      console.error('Error creating refunds table:', err);
    } else {
      console.log('✅ Created refunds table');
    }
  });

  // Create disputes table for handling chargebacks
  db.run(`
    CREATE TABLE IF NOT EXISTS disputes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id INTEGER NOT NULL,
      payment_log_id INTEGER,
      dispute_id TEXT NOT NULL UNIQUE,
      reason TEXT,
      status TEXT,
      amount DECIMAL(10,2),
      evidence_submitted BOOLEAN DEFAULT 0,
      resolution TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      resolved_at DATETIME,
      FOREIGN KEY (order_id) REFERENCES orders(id),
      FOREIGN KEY (payment_log_id) REFERENCES payment_logs(id)
    )
  `, (err) => {
    if (err) {
      console.error('Error creating disputes table:', err);
    } else {
      console.log('✅ Created disputes table');
    }
  });

  // Create payout_schedule table for seller payouts
  db.run(`
    CREATE TABLE IF NOT EXISTS payouts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      seller_id INTEGER NOT NULL,
      amount DECIMAL(10,2) NOT NULL,
      currency TEXT DEFAULT 'AUD',
      status TEXT DEFAULT 'pending',
      payout_method TEXT,
      stripe_payout_id TEXT,
      paypal_payout_id TEXT,
      bank_account_id TEXT,
      scheduled_date DATE,
      processed_at DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (seller_id) REFERENCES users(id)
    )
  `, (err) => {
    if (err) {
      console.error('Error creating payouts table:', err);
    } else {
      console.log('✅ Created payouts table');
    }
  });

  // Add indexes for better performance
  const indexes = [
    'CREATE INDEX IF NOT EXISTS idx_payment_methods_user ON payment_methods(user_id)',
    'CREATE INDEX IF NOT EXISTS idx_payment_logs_order ON payment_logs(order_id)',
    'CREATE INDEX IF NOT EXISTS idx_payment_logs_user ON payment_logs(user_id)',
    'CREATE INDEX IF NOT EXISTS idx_refunds_order ON refunds(order_id)',
    'CREATE INDEX IF NOT EXISTS idx_disputes_order ON disputes(order_id)',
    'CREATE INDEX IF NOT EXISTS idx_payouts_seller ON payouts(seller_id)',
    'CREATE INDEX IF NOT EXISTS idx_orders_payment_status ON orders(payment_status)',
    'CREATE INDEX IF NOT EXISTS idx_orders_stripe_intent ON orders(stripe_payment_intent_id)',
    'CREATE INDEX IF NOT EXISTS idx_orders_paypal ON orders(paypal_order_id)'
  ];

  indexes.forEach(indexQuery => {
    db.run(indexQuery, (err) => {
      if (err) {
        console.error('Error creating index:', err);
      } else {
        const indexName = indexQuery.match(/idx_\w+/)[0];
        console.log(`✅ Created index: ${indexName}`);
      }
    });
  });
});

// Wait a bit for all operations to complete
setTimeout(() => {
  console.log('\n✅ Migration complete!');
  console.log('Your database is now ready for payment integration.');
  db.close();
}, 3000);