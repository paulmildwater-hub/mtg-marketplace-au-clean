-- Enhanced database schema for complete MTG card system
-- Run this to upgrade your database

-- Master card catalog (all MTG cards ever printed)
CREATE TABLE IF NOT EXISTS card_catalog (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    scryfall_id TEXT UNIQUE NOT NULL,
    oracle_id TEXT NOT NULL, -- Groups all printings of same card
    name TEXT NOT NULL,
    mana_cost TEXT,
    cmc DECIMAL(3,1),
    type_line TEXT,
    oracle_text TEXT,
    power TEXT,
    toughness TEXT,
    colors TEXT, -- JSON array
    color_identity TEXT, -- JSON array
    keywords TEXT, -- JSON array
    legalities TEXT, -- JSON object
    reserved BOOLEAN DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Card printings/versions (each physical printing)
CREATE TABLE IF NOT EXISTS card_printings (
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
    
    -- Images
    image_normal TEXT,
    image_large TEXT,
    image_small TEXT,
    image_art_crop TEXT,
    back_image TEXT, -- For double-faced cards
    
    -- Treatments and variations
    frame_version TEXT, -- 1993, 1997, 2003, 2015, future
    frame_effects TEXT, -- showcase, extendedart, fullart, miracle, nyxtouched, etc
    border_color TEXT, -- black, white, borderless, silver, gold
    promo_types TEXT, -- prerelease, stamped, datestamped, etc
    variation_of TEXT, -- References another printing if this is a variant
    
    -- Finishes available
    has_foil BOOLEAN DEFAULT 0,
    has_nonfoil BOOLEAN DEFAULT 1,
    has_etched BOOLEAN DEFAULT 0,
    
    -- Special treatments
    is_oversized BOOLEAN DEFAULT 0,
    is_full_art BOOLEAN DEFAULT 0,
    is_textless BOOLEAN DEFAULT 0,
    is_showcase BOOLEAN DEFAULT 0,
    is_extended_art BOOLEAN DEFAULT 0,
    is_borderless BOOLEAN DEFAULT 0,
    is_promo BOOLEAN DEFAULT 0,
    security_stamp TEXT, -- oval, triangle, acorn, arena
    
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (card_catalog_id) REFERENCES card_catalog(id)
);

-- Price history for each printing/finish combination
CREATE TABLE IF NOT EXISTS price_history (
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
);

-- Enhanced listings table with treatment details
CREATE TABLE IF NOT EXISTS listings_v2 (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    printing_id INTEGER NOT NULL,
    seller_id INTEGER NOT NULL,
    
    -- Condition and treatment
    condition TEXT NOT NULL CHECK(condition IN ('NM', 'LP', 'MP', 'HP', 'DMG')),
    finish TEXT NOT NULL CHECK(finish IN ('nonfoil', 'foil', 'etched')),
    language TEXT DEFAULT 'English',
    is_signed BOOLEAN DEFAULT 0,
    is_altered BOOLEAN DEFAULT 0,
    is_misprint BOOLEAN DEFAULT 0,
    
    -- Pricing
    price DECIMAL(10,2) NOT NULL,
    quantity INTEGER DEFAULT 1,
    
    -- Images
    uses_stock_image BOOLEAN DEFAULT 1,
    custom_front_image TEXT, -- URL/path for non-NM cards
    custom_back_image TEXT, -- URL/path for showing back condition
    additional_images TEXT, -- JSON array of additional image URLs
    
    -- Listing details
    description TEXT,
    status TEXT DEFAULT 'active',
    views INTEGER DEFAULT 0,
    
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    sold_at DATETIME,
    
    FOREIGN KEY (printing_id) REFERENCES card_printings(id),
    FOREIGN KEY (seller_id) REFERENCES users(id)
);

-- User wishlists
CREATE TABLE IF NOT EXISTS wishlists (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    printing_id INTEGER,
    card_name TEXT, -- For generic "any version" wishes
    finish_preference TEXT, -- nonfoil, foil, any
    condition_minimum TEXT DEFAULT 'MP',
    max_price DECIMAL(10,2),
    quantity_wanted INTEGER DEFAULT 1,
    notify_when_available BOOLEAN DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (printing_id) REFERENCES card_printings(id)
);

-- Image uploads tracking
CREATE TABLE IF NOT EXISTS image_uploads (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    listing_id INTEGER,
    user_id INTEGER NOT NULL,
    image_type TEXT CHECK(image_type IN ('listing_front', 'listing_back', 'listing_detail', 'profile', 'verification')),
    
    -- Storage details
    storage_provider TEXT DEFAULT 'cloudinary', -- cloudinary, s3, local
    public_url TEXT NOT NULL,
    thumbnail_url TEXT,
    secure_url TEXT,
    public_id TEXT, -- Cloudinary public_id or S3 key
    
    -- Metadata
    format TEXT,
    width INTEGER,
    height INTEGER,
    bytes INTEGER,
    
    -- Verification
    is_verified BOOLEAN DEFAULT 0,
    verified_at DATETIME,
    verified_by INTEGER,
    
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (listing_id) REFERENCES listings_v2(id),
    FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Collection tracking for users
CREATE TABLE IF NOT EXISTS user_collections (
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
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_card_catalog_name ON card_catalog(name);
CREATE INDEX IF NOT EXISTS idx_card_catalog_oracle ON card_catalog(oracle_id);
CREATE INDEX IF NOT EXISTS idx_printings_card ON card_printings(card_catalog_id);
CREATE INDEX IF NOT EXISTS idx_printings_set ON card_printings(set_code);
CREATE INDEX IF NOT EXISTS idx_listings_printing ON listings_v2(printing_id);
CREATE INDEX IF NOT EXISTS idx_listings_seller ON listings_v2(seller_id);
CREATE INDEX IF NOT EXISTS idx_listings_status ON listings_v2(status);
CREATE INDEX IF NOT EXISTS idx_wishlists_user ON wishlists(user_id);
CREATE INDEX IF NOT EXISTS idx_price_history_printing ON price_history(printing_id, finish);