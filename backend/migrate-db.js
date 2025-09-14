// backend/migrate-db.js
// Run this file to add the enhanced card database tables

const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./mtg_marketplace.db');

console.log('Starting database migration for enhanced card system...\n');

db.serialize(() => {
  // First, let's check what tables already exist
  db.all("SELECT name FROM sqlite_master WHERE type='table'", (err, tables) => {
    if (err) {
      console.error('Error checking tables:', err);
      return;
    }
    console.log('Existing tables:', tables.map(t => t.name).join(', '));
    console.log('\nCreating new tables...\n');
  });

  // Create all the new tables
  const queries = [
    // Master card catalog
    `CREATE TABLE IF NOT EXISTS card_catalog (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      scryfall_id TEXT UNIQUE NOT NULL,
      oracle_id TEXT NOT NULL,
      name TEXT NOT NULL,
      mana_cost TEXT,
      cmc DECIMAL(3,1),
      type_line TEXT,
      oracle_text TEXT,
      power TEXT,
      toughness TEXT,
      colors TEXT,
      color_identity TEXT,
      keywords TEXT,
      legalities TEXT,
      reserved BOOLEAN DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`,

    // Card printings/versions
    `CREATE TABLE IF NOT EXISTS card_printings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      card_catalog_id INTEGER NOT NULL,
      scryfall_id TEXT UNIQUE NOT NULL,
      set_code TEXT NOT NULL,
      set_name TEXT NOT NULL,
      collector_number TEXT NOT NULL,
      rarity TEXT,
      flavor_text TEXT,
      artist TEXT,
      release_date DATE,
      image_normal TEXT,
      image_large TEXT,
      image_small TEXT,
      image_art_crop TEXT,
      back_image TEXT,
      frame_version TEXT,
      frame_effects TEXT,
      border_color TEXT,
      promo_types TEXT,
      variation_of TEXT,
      has_foil BOOLEAN DEFAULT 0,
      has_nonfoil BOOLEAN DEFAULT 1,
      has_etched BOOLEAN DEFAULT 0,
      is_oversized BOOLEAN DEFAULT 0,
      is_full_art BOOLEAN DEFAULT 0,
      is_textless BOOLEAN DEFAULT 0,
      is_showcase BOOLEAN DEFAULT 0,
      is_extended_art BOOLEAN DEFAULT 0,
      is_borderless BOOLEAN DEFAULT 0,
      is_promo BOOLEAN DEFAULT 0,
      security_stamp TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (card_catalog_id) REFERENCES card_catalog(id)
    )`,

    // Price history
    `CREATE TABLE IF NOT EXISTS price_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      printing_id INTEGER NOT NULL,
      finish TEXT NOT NULL CHECK(finish IN ('nonfoil', 'foil', 'etched')),
      price_aud DECIMAL(10,2),
      price_usd DECIMAL(10,2),
      market_price DECIMAL(10,2),
      buylist_price DECIMAL(10,2),
      recorded_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      source TEXT DEFAULT 'scryfall',
      FOREIGN KEY (printing_id) REFERENCES card_printings(id)
    )`,

    // Enhanced listings
    `CREATE TABLE IF NOT EXISTS listings_v2 (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      printing_id INTEGER NOT NULL,
      seller_id INTEGER NOT NULL,
      condition TEXT NOT NULL CHECK(condition IN ('NM', 'LP', 'MP', 'HP', 'DMG')),
      finish TEXT NOT NULL CHECK(finish IN ('nonfoil', 'foil', 'etched')),
      language TEXT DEFAULT 'English',
      is_signed BOOLEAN DEFAULT 0,
      is_altered BOOLEAN DEFAULT 0,
      is_misprint BOOLEAN DEFAULT 0,
      price DECIMAL(10,2) NOT NULL,
      quantity INTEGER DEFAULT 1,
      uses_stock_image BOOLEAN DEFAULT 1,
      custom_front_image TEXT,
      custom_back_image TEXT,
      additional_images TEXT,
      description TEXT,
      status TEXT DEFAULT 'active',
      views INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      sold_at DATETIME,
      FOREIGN KEY (printing_id) REFERENCES card_printings(id),
      FOREIGN KEY (seller_id) REFERENCES users(id)
    )`,

    // Wishlists
    `CREATE TABLE IF NOT EXISTS wishlists (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      printing_id INTEGER,
      card_name TEXT,
      finish_preference TEXT,
      condition_minimum TEXT DEFAULT 'MP',
      max_price DECIMAL(10,2),
      quantity_wanted INTEGER DEFAULT 1,
      notify_when_available BOOLEAN DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id),
      FOREIGN KEY (printing_id) REFERENCES card_printings(id)
    )`,

    // Image uploads
    `CREATE TABLE IF NOT EXISTS image_uploads (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      listing_id INTEGER,
      user_id INTEGER NOT NULL,
      image_type TEXT CHECK(image_type IN ('listing_front', 'listing_back', 'listing_detail', 'profile', 'verification')),
      storage_provider TEXT DEFAULT 'cloudinary',
      public_url TEXT NOT NULL,
      thumbnail_url TEXT,
      secure_url TEXT,
      public_id TEXT,
      format TEXT,
      width INTEGER,
      height INTEGER,
      bytes INTEGER,
      is_verified BOOLEAN DEFAULT 0,
      verified_at DATETIME,
      verified_by INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (listing_id) REFERENCES listings_v2(id),
      FOREIGN KEY (user_id) REFERENCES users(id)
    )`,

    // User collections
    `CREATE TABLE IF NOT EXISTS user_collections (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      printing_id INTEGER NOT NULL,
      quantity_owned INTEGER DEFAULT 1,
      quantity_for_trade INTEGER DEFAULT 0,
      finish TEXT,
      condition TEXT,
      purchase_price DECIMAL(10,2),
      acquired_date DATE,
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id),
      FOREIGN KEY (printing_id) REFERENCES card_printings(id),
      UNIQUE(user_id, printing_id, finish, condition)
    )`
  ];

  // Create indexes
  const indexes = [
    'CREATE INDEX IF NOT EXISTS idx_card_catalog_name ON card_catalog(name)',
    'CREATE INDEX IF NOT EXISTS idx_card_catalog_oracle ON card_catalog(oracle_id)',
    'CREATE INDEX IF NOT EXISTS idx_printings_card ON card_printings(card_catalog_id)',
    'CREATE INDEX IF NOT EXISTS idx_printings_set ON card_printings(set_code)',
    'CREATE INDEX IF NOT EXISTS idx_listings_printing ON listings_v2(printing_id)',
    'CREATE INDEX IF NOT EXISTS idx_listings_seller ON listings_v2(seller_id)',
    'CREATE INDEX IF NOT EXISTS idx_listings_status ON listings_v2(status)',
    'CREATE INDEX IF NOT EXISTS idx_wishlists_user ON wishlists(user_id)',
    'CREATE INDEX IF NOT EXISTS idx_price_history_printing ON price_history(printing_id, finish)'
  ];

  let completedQueries = 0;
  const totalQueries = queries.length + indexes.length;

  // Run table creation queries
  queries.forEach((query, index) => {
    const tableName = query.match(/CREATE TABLE IF NOT EXISTS (\w+)/)[1];
    
    db.run(query, (err) => {
      if (err) {
        console.error(`❌ Error creating table ${tableName}:`, err.message);
      } else {
        console.log(`✅ Created/verified table: ${tableName}`);
      }
      
      completedQueries++;
      
      // If all table queries are done, create indexes
      if (completedQueries === queries.length) {
        console.log('\nCreating indexes...\n');
        
        indexes.forEach((indexQuery) => {
          const indexName = indexQuery.match(/idx_\w+/)[0];
          
          db.run(indexQuery, (err) => {
            if (err) {
              console.error(`❌ Error creating index ${indexName}:`, err.message);
            } else {
              console.log(`✅ Created index: ${indexName}`);
            }
            
            completedQueries++;
            
            if (completedQueries === totalQueries) {
              console.log('\n🎉 Migration complete! Your database is ready for the enhanced card system.');
              console.log('\nNext steps:');
              console.log('1. Create cardManager.js in your backend folder');
              console.log('2. Add the new routes to server.js');
              console.log('3. Install required packages: npm install cloudinary multer multer-storage-cloudinary node-cron');
              
              // Check final table count
              db.all("SELECT name FROM sqlite_master WHERE type='table'", (err, tables) => {
                if (!err) {
                  console.log('\nTotal tables in database:', tables.length);
                  console.log('Tables:', tables.map(t => t.name).join(', '));
                }
                db.close();
              });
            }
          });
        });
      }
    });
  });
});