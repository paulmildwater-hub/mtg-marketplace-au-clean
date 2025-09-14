// server.js - Updated backend with proper Scryfall ID handling and AUD pricing
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const axios = require('axios');
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const rateLimit = require('express-rate-limit');
const multer = require('multer');
const Tesseract = require('tesseract.js');
const vision = require('@google-cloud/vision');

const app = express();
const PORT = process.env.PORT || 5000;

// JWT Secret
const JWT_SECRET = process.env.JWT_SECRET || crypto.randomBytes(64).toString('hex');

// Configure multer for file uploads
const storage = multer.memoryStorage();
const upload = multer({ 
  storage: storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'), false);
    }
  }
});

// CORS configuration
const corsOptions = {
  origin: process.env.NODE_ENV === 'production' 
    ? process.env.FRONTEND_URL 
    : ['http://localhost:3000', 'http://localhost:3001'],
  credentials: true,
  optionsSuccessStatus: 200
};

// Middleware
app.use(cors(corsOptions));
app.use(express.json({ limit: '50mb' }));
app.use(express.text({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Security headers
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  if (process.env.NODE_ENV === 'production') {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }
  next();
});

// Rate limiting
const apiLimiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 100,
  handler: (req, res) => {
    res.status(429).json({ 
      error: 'Too many requests, please try again later' 
    });
  }
});

const paymentLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  handler: (req, res) => {
    res.status(429).json({ 
      error: 'Too many payment attempts, please try again later' 
    });
  }
});

app.use('/api/payment', paymentLimiter);
app.use('/api/', apiLimiter);

// Database setup
const dbPath = './mtg_marketplace.db';
const dbExists = fs.existsSync(dbPath);

if (!dbExists) {
  console.log('Creating new database...');
}

const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Error opening database:', err);
    process.exit(1);
  } else {
    console.log('Connected to SQLite database');
    initializeDatabase();
  }
});

// Initialize database tables with proper schema
function initializeDatabase() {
  db.serialize(() => {
    db.run('PRAGMA foreign_keys = ON');
    db.run('PRAGMA journal_mode = WAL');

    // Users table
    db.run(`CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      full_name TEXT,
      address TEXT,
      city TEXT,
      state TEXT,
      postal_code TEXT,
      country TEXT DEFAULT 'Australia',
      phone TEXT,
      bio TEXT,
      avatar_url TEXT,
      seller_rating REAL DEFAULT 0,
      buyer_rating REAL DEFAULT 0,
      total_sales INTEGER DEFAULT 0,
      total_purchases INTEGER DEFAULT 0,
      stripe_customer_id TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      last_login DATETIME,
      UNIQUE(username COLLATE NOCASE),
      UNIQUE(email COLLATE NOCASE)
    )`);

    // Updated Listings table with proper fields
    db.run(`CREATE TABLE IF NOT EXISTS listings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      card_id TEXT NOT NULL,
      card_name TEXT NOT NULL,
      set_name TEXT,
      set_code TEXT,
      collector_number TEXT,
      seller_id INTEGER NOT NULL,
      price DECIMAL(10,2) NOT NULL,
      condition TEXT NOT NULL,
      quantity INTEGER DEFAULT 1,
      finish TEXT DEFAULT 'nonfoil',
      image_url TEXT,
      description TEXT,
      status TEXT DEFAULT 'active' CHECK(status IN ('active', 'paused', 'sold')),
      views INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      sold_date DATETIME,
      FOREIGN KEY (seller_id) REFERENCES users(id) ON DELETE CASCADE
    )`);

    // Add sales_analytics table for tracking trending cards
    db.run(`CREATE TABLE IF NOT EXISTS sales_analytics (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      card_name TEXT NOT NULL,
      card_id TEXT,
      set_name TEXT,
      listing_id INTEGER,
      seller_id INTEGER,
      buyer_id INTEGER,
      sale_price DECIMAL(10,2),
      sale_date DATETIME DEFAULT CURRENT_TIMESTAMP,
      views_before_sale INTEGER DEFAULT 0,
      FOREIGN KEY (listing_id) REFERENCES listings(id),
      FOREIGN KEY (seller_id) REFERENCES users(id),
      FOREIGN KEY (buyer_id) REFERENCES users(id)
    )`);

    // Add view_analytics table for tracking card views
    db.run(`CREATE TABLE IF NOT EXISTS view_analytics (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      card_name TEXT NOT NULL,
      card_id TEXT,
      viewer_id INTEGER,
      view_date DATETIME DEFAULT CURRENT_TIMESTAMP,
      search_query TEXT,
      FOREIGN KEY (viewer_id) REFERENCES users(id)
    )`);

    // Add new columns to existing listings table if they don't exist
    db.run(`ALTER TABLE listings ADD COLUMN set_code TEXT`, (err) => {
      if (err && !err.message.includes('duplicate column')) {
        console.log('Note: set_code column already exists or error:', err.message);
      }
    });
    
    db.run(`ALTER TABLE listings ADD COLUMN collector_number TEXT`, (err) => {
      if (err && !err.message.includes('duplicate column')) {
        console.log('Note: collector_number column already exists or error:', err.message);
      }
    });
    
    db.run(`ALTER TABLE listings ADD COLUMN finish TEXT DEFAULT 'nonfoil'`, (err) => {
      if (err && !err.message.includes('duplicate column')) {
        console.log('Note: finish column already exists or error:', err.message);
      }
    });

    // Create indexes
    db.run(`CREATE INDEX IF NOT EXISTS idx_listings_card_name ON listings(card_name)`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_listings_seller_id ON listings(seller_id)`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_listings_status ON listings(status)`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_listings_card_id ON listings(card_id)`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_sales_card_name ON sales_analytics(card_name)`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_sales_date ON sales_analytics(sale_date)`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_views_card_name ON view_analytics(card_name)`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_views_date ON view_analytics(view_date)`);

    console.log('Database initialization complete');
  });
}

// Cache configuration
const cache = new Map();
const CACHE_DURATION = 1000 * 60 * 60; // 1 hour
let lastRequestTime = 0;
const MIN_REQUEST_INTERVAL = 100;

// Image cache
const imageCache = new Map();
const IMAGE_CACHE_DURATION = 1000 * 60 * 60 * 24; // 24 hours

// Currency exchange rate cache (update daily)
let AUD_EXCHANGE_RATE = 1.55; // Default fallback
let EXCHANGE_RATE_LAST_UPDATED = 0;

// Function to update exchange rate
async function updateExchangeRate() {
  try {
    // In production, you'd use a real exchange rate API
    // For now, we'll use a more realistic rate
    AUD_EXCHANGE_RATE = 1.52; // More accurate as of 2024
    EXCHANGE_RATE_LAST_UPDATED = Date.now();
  } catch (error) {
    console.error('Failed to update exchange rate:', error);
  }
}

// Update exchange rate on startup and every 24 hours
updateExchangeRate();
setInterval(updateExchangeRate, 24 * 60 * 60 * 1000);

// Utility functions
async function rateLimitedFetch(url, options = {}) {
  const now = Date.now();
  const timeSinceLastRequest = now - lastRequestTime;
  
  if (timeSinceLastRequest < MIN_REQUEST_INTERVAL) {
    await new Promise(resolve => setTimeout(resolve, MIN_REQUEST_INTERVAL - timeSinceLastRequest));
  }
  
  lastRequestTime = Date.now();
  
  try {
    const response = await axios.get(url, {
      timeout: 10000,
      headers: {
        'User-Agent': 'MTGAustraliaMarketplace/1.0',
        ...options.headers
      },
      ...options
    });
    return response;
  } catch (error) {
    console.error('Fetch error:', error.message);
    throw error;
  }
}

function processCardImage(card) {
  if (!card) {
    return `http://localhost:${PORT}/api/image-proxy?url=${encodeURIComponent('https://cards.scryfall.io/back.png')}`;
  }

  let originalUrl = null;

  if (card.image_uris) {
    originalUrl = card.image_uris.normal || 
                  card.image_uris.large || 
                  card.image_uris.small || 
                  card.image_uris.png;
  }
  
  if (!originalUrl && card.card_faces && Array.isArray(card.card_faces) && card.card_faces.length > 0) {
    const face = card.card_faces[0];
    if (face && face.image_uris) {
      originalUrl = face.image_uris.normal || 
                    face.image_uris.large || 
                    face.image_uris.small || 
                    face.image_uris.png;
    }
  }
  
  if (!originalUrl && card.id && typeof card.id === 'string' && card.id.length >= 2) {
    const firstChar = card.id.charAt(0);
    const secondChar = card.id.charAt(1);
    originalUrl = `https://cards.scryfall.io/normal/front/${firstChar}/${secondChar}/${card.id}.jpg`;
  }
  
  if (!originalUrl) {
    originalUrl = 'https://cards.scryfall.io/back.png';
  }

  return `http://localhost:${PORT}/api/image-proxy?url=${encodeURIComponent(originalUrl)}`;
}

function normalizeCardData(card) {
  const imageUrl = processCardImage(card);
  
  // Use actual AUD prices when available, otherwise convert with current rate
  const audPrice = card.prices?.aud 
    ? parseFloat(card.prices.aud) 
    : (card.prices?.usd ? parseFloat(card.prices.usd) * AUD_EXCHANGE_RATE : null);
    
  const audFoilPrice = card.prices?.aud_foil 
    ? parseFloat(card.prices.aud_foil)
    : (card.prices?.usd_foil ? parseFloat(card.prices.usd_foil) * AUD_EXCHANGE_RATE : null);
  
  return {
    ...card,
    imageUrl: imageUrl,
    image_url: imageUrl,
    originalImageUrl: imageUrl,
    prices: {
      ...card.prices,
      aud: audPrice,
      aud_foil: audFoilPrice
    }
  };
}

// Track card views
async function trackCardView(cardName, cardId, viewerId = null, searchQuery = null) {
  return new Promise((resolve) => {
    db.run(
      `INSERT INTO view_analytics (card_name, card_id, viewer_id, search_query) 
       VALUES (?, ?, ?, ?)`,
      [cardName, cardId, viewerId, searchQuery],
      (err) => {
        if (err) console.error('Failed to track view:', err);
        resolve();
      }
    );
  });
}

// Track sales
async function trackSale(listingId, buyerId, salePrice) {
  return new Promise((resolve) => {
    db.get(
      'SELECT card_name, card_id, set_name, seller_id, views FROM listings WHERE id = ?',
      [listingId],
      (err, listing) => {
        if (!err && listing) {
          db.run(
            `INSERT INTO sales_analytics (
              card_name, card_id, set_name, listing_id, 
              seller_id, buyer_id, sale_price, views_before_sale
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              listing.card_name,
              listing.card_id,
              listing.set_name,
              listingId,
              listing.seller_id,
              buyerId,
              salePrice,
              listing.views || 0
            ],
            (insertErr) => {
              if (insertErr) console.error('Failed to track sale:', insertErr);
              resolve();
            }
          );
        } else {
          resolve();
        }
      }
    );
  });
}

// Authentication middleware
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid or expired token' });
    }
    req.user = user;
    next();
  });
};

// ============= IMAGE PROXY ENDPOINT =============
app.get('/api/image-proxy', async (req, res) => {
  const { url } = req.query;
  
  if (!url) {
    return res.status(400).send('URL parameter required');
  }

  const cached = imageCache.get(url);
  if (cached && Date.now() - cached.timestamp < IMAGE_CACHE_DURATION) {
    res.set('Content-Type', cached.contentType);
    res.set('Cache-Control', 'public, max-age=86400');
    return res.send(cached.data);
  }

  try {
    const response = await axios.get(url, {
      responseType: 'arraybuffer',
      timeout: 10000,
      headers: {
        'User-Agent': 'MTGAustraliaMarketplace/1.0'
      }
    });

    const contentType = response.headers['content-type'] || 'image/jpeg';
    const imageBuffer = Buffer.from(response.data);

    imageCache.set(url, {
      data: imageBuffer,
      contentType: contentType,
      timestamp: Date.now()
    });

    if (imageCache.size > 500) {
      const entries = Array.from(imageCache.entries());
      const oldEntries = entries
        .filter(([_, value]) => Date.now() - value.timestamp > IMAGE_CACHE_DURATION)
        .map(([key]) => key);
      oldEntries.forEach(key => imageCache.delete(key));
    }

    res.set('Content-Type', contentType);
    res.set('Cache-Control', 'public, max-age=86400');
    res.send(imageBuffer);
  } catch (error) {
    console.error('Image proxy error:', error.message);
    res.redirect('https://via.placeholder.com/488x680?text=Image+Not+Available');
  }
});

// ============= AUTHENTICATION ROUTES =============
app.post('/api/auth/register', async (req, res) => {
  const { username, email, password, full_name } = req.body;

  if (!username || !email || !password) {
    return res.status(400).json({ error: 'Username, email, and password are required' });
  }

  if (password.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters' });
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return res.status(400).json({ error: 'Invalid email format' });
  }

  try {
    const existingUser = await new Promise((resolve, reject) => {
      db.get(
        'SELECT id FROM users WHERE LOWER(username) = LOWER(?) OR LOWER(email) = LOWER(?)',
        [username, email],
        (err, row) => {
          if (err) reject(err);
          else resolve(row);
        }
      );
    });

    if (existingUser) {
      return res.status(400).json({ error: 'Username or email already exists' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const userId = await new Promise((resolve, reject) => {
      db.run(
        'INSERT INTO users (username, email, password_hash, full_name) VALUES (?, ?, ?, ?)',
        [username, email, hashedPassword, full_name || username],
        function(err) {
          if (err) reject(err);
          else resolve(this.lastID);
        }
      );
    });

    const token = jwt.sign(
      { id: userId, username, email },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      message: 'Registration successful',
      token,
      user: {
        id: userId,
        username,
        email,
        full_name: full_name || username
      }
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Failed to register user' });
  }
});

app.post('/api/auth/login', async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password required' });
  }

  try {
    const user = await new Promise((resolve, reject) => {
      db.get(
        'SELECT * FROM users WHERE LOWER(username) = LOWER(?) OR LOWER(email) = LOWER(?)',
        [username, username],
        (err, row) => {
          if (err) reject(err);
          else resolve(row);
        }
      );
    });

    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const validPassword = await bcrypt.compare(password, user.password_hash);
    if (!validPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    db.run('UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = ?', [user.id]);

    const token = jwt.sign(
      { id: user.id, username: user.username, email: user.email },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    delete user.password_hash;

    res.json({
      message: 'Login successful',
      token,
      user
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
});

// ============= CARD SEARCH ROUTES WITH PROPER PRICING =============
app.get('/api/cards/search', async (req, res) => {
  try {
    const { 
      q, 
      page = 1, 
      includeImages = 'false',
      sortBy = 'relevance',
      minPrice,
      maxPrice,
      inStock,
      searchTerm
    } = req.query;
    
    if (!q) {
      return res.status(400).json({ error: 'Search query required' });
    }
    
    // Track search view
    const userId = req.headers.authorization ? 
      jwt.decode(req.headers.authorization.split(' ')[1])?.id : null;
    
    const cacheKey = `search_${q}_${page}_${sortBy}`;
    const cached = cache.get(cacheKey);
    
    if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
      return res.json(cached.data);
    }

    const searchPattern = `%${q.replace(/"/g, '')}%`;
    const localCards = await new Promise((resolve) => {
      db.all(
        `SELECT 
          l.*,
          COUNT(*) as total_listings,
          MIN(l.price) as lowest_price,
          SUM(l.quantity) as total_quantity,
          GROUP_CONCAT(DISTINCT l.seller_id) as sellers
        FROM listings l
        WHERE LOWER(l.card_name) LIKE LOWER(?) AND l.status = 'active'
        GROUP BY l.card_name
        ORDER BY COUNT(*) DESC, MIN(l.price) ASC`,
        [searchPattern],
        (err, rows) => {
          if (err) {
            console.error('Database error:', err);
            resolve([]);
          } else {
            resolve(rows || []);
          }
        }
      );
    });

    let scryfallCards = [];
    
    try {
      const response = await rateLimitedFetch(
        `https://api.scryfall.com/cards/search?q=${encodeURIComponent(q)}&unique=cards&order=edhrec&dir=desc&page=${page}`
      );
      scryfallCards = response.data?.data || [];
    } catch (error) {
      console.error('Scryfall search error:', error.message);
    }

    const processedCards = await Promise.all(scryfallCards.slice(0, 20).map(async (card) => {
      const normalizedCard = normalizeCardData(card);
      
      // Track view
      await trackCardView(card.name, card.id, userId, q);
      
      const stockInfo = await new Promise((resolve) => {
        db.get(
          `SELECT 
            COUNT(DISTINCT l.id) as total_listings,
            SUM(l.quantity) as total_quantity,
            MIN(l.price) as lowest_price,
            COUNT(DISTINCT l.seller_id) as seller_count
           FROM listings l
           WHERE LOWER(l.card_name) = LOWER(?) AND l.status = 'active'`,
          [card.name],
          (err, row) => {
            if (!err && row && row.total_listings > 0) {
              resolve(row);
            } else {
              resolve({ total_listings: 0, total_quantity: 0, lowest_price: null, seller_count: 0 });
            }
          }
        );
      });
      
      // Use proper AUD price from normalized data
      const basePrice = normalizedCard.prices?.aud || 10;
      const hasLocalStock = stockInfo.total_quantity > 0;
      
      return {
        id: card.id,
        name: card.name,
        set: card.set_name,
        set_name: card.set_name,
        setCode: card.set,
        rarity: card.rarity,
        imageUrl: normalizedCard.imageUrl,
        image_url: normalizedCard.image_url,
        originalImageUrl: normalizedCard.originalImageUrl,
        price: basePrice,
        lowestPrice: stockInfo.lowest_price || basePrice,
        availableQuantity: parseInt(stockInfo.total_quantity) || 0,
        sellerCount: parseInt(stockInfo.seller_count) || 0,
        description: card.oracle_text || card.card_faces?.[0]?.oracle_text || '',
        manaCost: card.mana_cost || '',
        cmc: card.cmc,
        type: card.type_line || '',
        type_line: card.type_line || '',
        artist: card.artist || '',
        power: card.power || null,
        toughness: card.toughness || null,
        colors: card.colors || [],
        color_identity: card.color_identity || [],
        inStock: hasLocalStock,
        isLocalInventory: hasLocalStock,
        condition: 'NM'
      };
    }));

    for (const localCard of localCards) {
      const alreadyIncluded = processedCards.some(
        pc => pc.name.toLowerCase() === localCard.card_name.toLowerCase()
      );
      
      if (!alreadyIncluded) {
        const localImageUrl = localCard.image_url 
          ? `http://localhost:${PORT}/api/image-proxy?url=${encodeURIComponent(localCard.image_url)}`
          : `http://localhost:${PORT}/api/image-proxy?url=${encodeURIComponent('https://cards.scryfall.io/back.png')}`;
        
        processedCards.unshift({
          id: `local-${localCard.id}`,
          name: localCard.card_name,
          set: localCard.set_name || 'Unknown Set',
          set_name: localCard.set_name || 'Unknown Set',
          setCode: 'LOCAL',
          rarity: 'unknown',
          imageUrl: localImageUrl,
          image_url: localImageUrl,
          originalImageUrl: localImageUrl,
          price: parseFloat(localCard.lowest_price),
          lowestPrice: parseFloat(localCard.lowest_price),
          availableQuantity: parseInt(localCard.total_quantity),
          sellerCount: localCard.sellers ? localCard.sellers.split(',').length : 1,
          description: localCard.description || '',
          manaCost: '',
          type_line: '',
          inStock: true,
          isLocalInventory: true,
          condition: 'NM'
        });
      }
    }

    processedCards.sort((a, b) => {
      if (a.inStock && !b.inStock) return -1;
      if (!a.inStock && b.inStock) return 1;
      return (b.lowestPrice || b.price) - (a.lowestPrice || a.price);
    });

    const transformedData = {
      cards: processedCards,
      hasMore: false,
      totalCards: processedCards.length
    };

    cache.set(cacheKey, {
      data: transformedData,
      timestamp: Date.now()
    });

    res.json(transformedData);
  } catch (error) {
    console.error('Search error:', error.message);
    res.status(500).json({ error: 'Failed to search cards' });
  }
});

// ============= ENHANCED TRENDING CARDS ENDPOINT =============
app.get('/api/cards/popular', async (req, res) => {
  try {
    const cacheKey = 'trending_cards_enhanced';
    const cached = cache.get(cacheKey);
    
    // Cache for 15 minutes for trending data
    if (cached && Date.now() - cached.timestamp < (15 * 60 * 1000)) {
      return res.json(cached.data);
    }

    // Enhanced trending algorithm combining multiple signals
    const trendingData = await new Promise((resolve) => {
      db.all(
        `WITH trending_base AS (
          SELECT 
            card_name,
            COUNT(DISTINCT CASE WHEN type = 'sale' THEN id END) as sale_count,
            COUNT(DISTINCT CASE WHEN type = 'view' THEN id END) as view_count,
            COUNT(DISTINCT CASE WHEN type = 'search' THEN id END) as search_count,
            AVG(price) as avg_price,
            MAX(recent_date) as last_activity,
            -- Calculate trend velocity (acceleration of interest)
            CAST(julianday('now') - julianday(MIN(recent_date)) AS REAL) as days_active,
            COUNT(*) * 1.0 / NULLIF(CAST(julianday('now') - julianday(MIN(recent_date)) AS REAL), 0) as activity_velocity
          FROM (
            -- Sales in last 3 days (highest weight)
            SELECT 
              card_name, 
              id, 
              sale_price as price, 
              sale_date as recent_date,
              'sale' as type
            FROM sales_analytics 
            WHERE sale_date > datetime('now', '-3 days')
            
            UNION ALL
            
            -- Views in last 24 hours (medium weight)
            SELECT 
              v.card_name,
              v.id,
              COALESCE(l.price, 10) as price,
              v.view_date as recent_date,
              'view' as type
            FROM view_analytics v
            LEFT JOIN (
              SELECT card_name, AVG(price) as price 
              FROM listings 
              WHERE status = 'active' 
              GROUP BY card_name
            ) l ON LOWER(l.card_name) = LOWER(v.card_name)
            WHERE v.view_date > datetime('now', '-1 day')
            
            UNION ALL
            
            -- Search queries in last 2 days (lower weight)
            SELECT 
              v.card_name,
              v.id,
              10 as price,
              v.view_date as recent_date,
              'search' as type
            FROM view_analytics v
            WHERE v.search_query IS NOT NULL 
              AND v.view_date > datetime('now', '-2 days')
          ) trending
          GROUP BY card_name
        )
        SELECT 
          card_name,
          sale_count,
          view_count,
          search_count,
          avg_price,
          last_activity,
          activity_velocity,
          -- Calculate trending score with weighted factors
          (
            (sale_count * 100) +                    -- Heavy weight for actual sales
            (view_count * 5) +                       -- Medium weight for views
            (search_count * 2) +                     -- Low weight for searches
            (activity_velocity * 50) +               -- Reward velocity of interest
            (CASE 
              WHEN last_activity > datetime('now', '-1 hour') THEN 50
              WHEN last_activity > datetime('now', '-6 hours') THEN 25
              WHEN last_activity > datetime('now', '-12 hours') THEN 10
              ELSE 0
            END)                                      -- Recency bonus
          ) as trending_score
        FROM trending_base
        WHERE sale_count > 0 OR view_count > 5      -- Minimum threshold
        ORDER BY trending_score DESC
        LIMIT 20`,
        [],
        (err, rows) => {
          if (err) {
            console.error('Trending query error:', err);
            resolve([]);
          } else {
            resolve(rows || []);
          }
        }
      );
    });

    let cards = [];
    
    // If we have trending data, fetch those cards
    if (trendingData.length > 0) {
      const topCards = trendingData.slice(0, 12);
      
      for (const trendData of topCards) {
        try {
          const response = await rateLimitedFetch(
            `https://api.scryfall.com/cards/named?fuzzy=${encodeURIComponent(trendData.card_name)}`
          );
          
          if (response.data) {
            const card = response.data;
            const normalizedCard = normalizeCardData(card);
            
            // Get local stock info
            const stockInfo = await new Promise((resolve) => {
              db.get(
                `SELECT 
                  COUNT(DISTINCT l.id) as total_listings,
                  SUM(l.quantity) as total_quantity,
                  MIN(l.price) as lowest_price,
                  MAX(l.price) as highest_price,
                  AVG(l.price) as avg_price,
                  COUNT(DISTINCT l.seller_id) as seller_count
                FROM listings l
                WHERE LOWER(l.card_name) = LOWER(?) AND l.status = 'active'`,
                [trendData.card_name],
                (err, row) => {
                  if (!err && row && row.total_listings > 0) {
                    resolve(row);
                  } else {
                    resolve({ 
                      total_listings: 0, 
                      total_quantity: 0, 
                      lowest_price: null, 
                      highest_price: null,
                      avg_price: null,
                      seller_count: 0 
                    });
                  }
                }
              );
            });
            
            cards.push({
              id: card.id,
              name: card.name,
              set: card.set_name,
              set_name: card.set_name,
              setCode: card.set,
              rarity: card.rarity,
              imageUrl: normalizedCard.imageUrl,
              image_url: normalizedCard.image_url,
              originalImageUrl: normalizedCard.originalImageUrl,
              price: stockInfo.lowest_price || normalizedCard.prices?.aud || trendData.avg_price || 10,
              lowestPrice: stockInfo.lowest_price || normalizedCard.prices?.aud || trendData.avg_price || 10,
              highestPrice: stockInfo.highest_price,
              avgPrice: stockInfo.avg_price,
              availableQuantity: parseInt(stockInfo.total_quantity) || 0,
              sellerCount: parseInt(stockInfo.seller_count) || 0,
              description: card.oracle_text || card.card_faces?.[0]?.oracle_text || '',
              manaCost: card.mana_cost || '',
              cmc: card.cmc,
              type: card.type_line || '',
              type_line: card.type_line || '',
              artist: card.artist || '',
              inStock: stockInfo.total_quantity > 0,
              isLocalInventory: stockInfo.total_quantity > 0,
              trending: true,
              trendingStats: {
                sales: trendData.sale_count || 0,
                views: trendData.view_count || 0,
                searches: trendData.search_count || 0,
                score: Math.round(trendData.trending_score || 0),
                velocity: trendData.activity_velocity || 0,
                lastActivity: trendData.last_activity
              }
            });
          }
        } catch (error) {
          console.error(`Failed to fetch card ${trendData.card_name}:`, error.message);
        }
      }
    }
    
    // If we don't have enough trending cards, add some popular staples
    if (cards.length < 12) {
      const popularStaples = [
        'Sol Ring',
        'Lightning Bolt', 
        'Swords to Plowshares',
        'Counterspell',
        'Birds of Paradise',
        'Dark Ritual',
        'Path to Exile',
        'Brainstorm',
        'Cultivate',
        'Demonic Tutor',
        'Mana Crypt',
        'Rhystic Study'
      ];
      
      const neededCards = 12 - cards.length;
      const cardsToFetch = popularStaples
        .filter(name => !cards.some(c => c.name === name))
        .slice(0, neededCards);
      
      for (const cardName of cardsToFetch) {
        try {
          const response = await rateLimitedFetch(
            `https://api.scryfall.com/cards/named?fuzzy=${encodeURIComponent(cardName)}`
          );
          
          if (response.data) {
            const card = response.data;
            const normalizedCard = normalizeCardData(card);
            
            const stockInfo = await new Promise((resolve) => {
              db.get(
                `SELECT 
                  COUNT(DISTINCT l.id) as total_listings,
                  SUM(l.quantity) as total_quantity,
                  MIN(l.price) as lowest_price,
                  COUNT(DISTINCT l.seller_id) as seller_count
                FROM listings l
                WHERE LOWER(l.card_name) = LOWER(?) AND l.status = 'active'`,
                [cardName],
                (err, row) => {
                  if (!err && row && row.total_listings > 0) {
                    resolve(row);
                  } else {
                    resolve({ total_listings: 0, total_quantity: 0, lowest_price: null, seller_count: 0 });
                  }
                }
              );
            });
            
            cards.push({
              id: card.id,
              name: card.name,
              set: card.set_name,
              set_name: card.set_name,
              setCode: card.set,
              rarity: card.rarity,
              imageUrl: normalizedCard.imageUrl,
              image_url: normalizedCard.image_url,
              originalImageUrl: normalizedCard.originalImageUrl,
              price: stockInfo.lowest_price || normalizedCard.prices?.aud || 10,
              lowestPrice: stockInfo.lowest_price || normalizedCard.prices?.aud || 10,
              availableQuantity: parseInt(stockInfo.total_quantity) || 0,
              sellerCount: parseInt(stockInfo.seller_count) || 0,
              description: card.oracle_text || card.card_faces?.[0]?.oracle_text || '',
              manaCost: card.mana_cost || '',
              cmc: card.cmc,
              type: card.type_line || '',
              type_line: card.type_line || '',
              artist: card.artist || '',
              inStock: stockInfo.total_quantity > 0,
              isLocalInventory: stockInfo.total_quantity > 0,
              trending: false,
              popular: true
            });
          }
        } catch (error) {
          console.error(`Failed to fetch staple ${cardName}:`, error.message);
        }
      }
    }

    const transformedData = { 
      cards: cards.slice(0, 12),
      trending: true,
      lastUpdated: new Date().toISOString()
    };

    cache.set(cacheKey, {
      data: transformedData,
      timestamp: Date.now()
    });

    res.json(transformedData);
  } catch (error) {
    console.error('Trending cards error:', error.message);
    
    // Fallback to some default popular cards
    const fallbackCards = [];
    const defaultCards = ['Sol Ring', 'Lightning Bolt', 'Counterspell', 'Birds of Paradise'];
    
    for (const cardName of defaultCards) {
      try {
        const response = await rateLimitedFetch(
          `https://api.scryfall.com/cards/named?fuzzy=${encodeURIComponent(cardName)}`
        );
        if (response.data) {
          const card = response.data;
          const normalizedCard = normalizeCardData(card);
          fallbackCards.push({
            id: card.id,
            name: card.name,
            set: card.set_name,
            set_name: card.set_name,
            setCode: card.set,
            rarity: card.rarity,
            imageUrl: normalizedCard.imageUrl,
            image_url: normalizedCard.image_url,
            price: normalizedCard.prices?.aud || 10,
            lowestPrice: normalizedCard.prices?.aud || 10,
            trending: false
          });
        }
      } catch (err) {
        console.error(`Failed to fetch fallback card ${cardName}:`, err.message);
      }
    }
    
    res.json({ cards: fallbackCards, trending: false });
  }
});

// ============= CARD RECOGNITION ENDPOINT =============
app.post('/api/cards/recognize', upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No image provided' });
    }

    // Use Tesseract.js for OCR
    const { data: { text } } = await Tesseract.recognize(
      req.file.buffer,
      'eng',
      {
        logger: m => console.log(m)
      }
    );

    // Extract card name from OCR text (simplified - you'd want more sophisticated parsing)
    const lines = text.split('\n').filter(line => line.trim().length > 0);
    const potentialCardName = lines[0]; // Assume first line is card name

    if (!potentialCardName || potentialCardName.length < 3) {
      return res.json({
        success: false,
        message: 'Could not identify card. Please try a clearer image or enter manually.',
        needsManualReview: true
      });
    }

    // Try to match with Scryfall
    try {
      const response = await rateLimitedFetch(
        `https://api.scryfall.com/cards/named?fuzzy=${encodeURIComponent(potentialCardName)}`
      );

      if (response.data) {
        const card = response.data;
        const normalizedCard = normalizeCardData(card);

        return res.json({
          success: true,
          card: {
            id: card.id,
            name: card.name,
            set: card.set_name,
            setCode: card.set,
            imageUrl: normalizedCard.imageUrl,
            prices: normalizedCard.prices,
            confidence: 0.8 // You could calculate this based on OCR confidence
          }
        });
      }
    } catch (error) {
      console.error('Scryfall lookup failed:', error);
    }

    return res.json({
      success: false,
      message: 'Card recognized but not found in database. Manual review required.',
      recognizedText: potentialCardName,
      needsManualReview: true
    });

  } catch (error) {
    console.error('Card recognition error:', error);
    res.status(500).json({ 
      error: 'Failed to recognize card',
      needsManualReview: true 
    });
  }
});

app.get('/api/cards/:name/versions', async (req, res) => {
  try {
    const { name } = req.params;
    const { includeImages = 'false' } = req.query;
    
    const response = await rateLimitedFetch(
      `https://api.scryfall.com/cards/search?q=!"${encodeURIComponent(name)}"&unique=prints&order=released`
    );
    
    const versions = response.data.data.map(card => {
      const normalizedCard = normalizeCardData(card);
      
      return {
        id: card.id,
        name: card.name,
        set: card.set_name,
        setCode: card.set,
        rarity: card.rarity,
        imageUrl: normalizedCard.imageUrl,
        image_url: normalizedCard.image_url,
        collector_number: card.collector_number,
        released_at: card.released_at,
        prices: {
          usd: card.prices?.usd || null,
          usd_foil: card.prices?.usd_foil || null,
          aud: normalizedCard.prices?.aud || null,
          aud_foil: normalizedCard.prices?.aud_foil || null
        },
        promo: card.promo || false,
        variation: card.variation || false,
        fullArt: card.full_art || false,
        extendedArt: card.extended_art || false,
        borderless: card.border_color === 'borderless',
        showcase: card.frame_effects?.includes('showcase') || false,
        foilOnly: card.finishes?.length === 1 && card.finishes[0] === 'foil',
        finishes: card.finishes || ['nonfoil'],
        frame_effects: card.frame_effects || [],
        promo_types: card.promo_types || []
      };
    });
    
    res.json({
      cardName: name,
      totalVersions: versions.length,
      versions: versions.sort((a, b) => new Date(b.released_at) - new Date(a.released_at))
    });
    
  } catch (error) {
    console.error('Versions fetch error:', error.message);
    res.status(500).json({ error: 'Failed to fetch card versions' });
  }
});

// ============= FIXED LISTING ROUTES =============
app.post('/api/listings/bulk', authenticateToken, async (req, res) => {
  try {
    const { listings } = req.body;
    const seller_id = req.user.id;
    
    if (!listings || !Array.isArray(listings)) {
      return res.status(400).json({ error: 'Invalid listings data' });
    }
    
    let successCount = 0;
    let failureCount = 0;
    const errors = [];
    const createdListings = [];
    
    for (const listing of listings) {
      // Validate required fields
      if (!listing.card_name || !listing.price || listing.price <= 0) {
        failureCount++;
        errors.push({ 
          card: listing.card_name || 'Unknown', 
          error: 'Missing required fields or invalid price' 
        });
        continue;
      }
      
      try {
        // Use the proper Scryfall ID from version selection
        const cardId = listing.scryfall_id || listing.card_id;
        
        if (!cardId || cardId.startsWith('temp_')) {
          // If no proper ID, try to fetch from Scryfall
          try {
            const response = await rateLimitedFetch(
              `https://api.scryfall.com/cards/named?fuzzy=${encodeURIComponent(listing.card_name)}`
            );
            listing.scryfall_id = response.data.id;
            listing.image_url = response.data.image_uris?.normal;
          } catch (fetchError) {
            console.error('Failed to fetch card data for:', listing.card_name);
            // Continue with temporary ID if fetch fails
            listing.scryfall_id = cardId || `temp_${Date.now()}_${Math.random()}`;
          }
        }
        
        const listingId = await new Promise((resolve, reject) => {
          db.run(
            `INSERT INTO listings (
              card_id, card_name, set_name, set_code, collector_number,
              seller_id, price, condition, quantity, finish,
              image_url, description, status
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              listing.scryfall_id || cardId,
              listing.card_name,
              listing.set_name || 'Unknown Set',
              listing.set_code || null,
              listing.collector_number || null,
              seller_id,
              parseFloat(listing.price),
              listing.condition || 'NM',
              parseInt(listing.quantity) || 1,
              listing.finish || 'nonfoil',
              listing.image_url || '',
              listing.description || `${listing.set_name || 'Unknown Set'} - ${listing.condition || 'NM'} Condition`,
              'active'
            ],
            function(err) {
              if (err) {
                reject(err);
              } else {
                resolve(this.lastID);
              }
            }
          );
        });
        
        createdListings.push({
          id: listingId,
          card_name: listing.card_name,
          price: listing.price
        });
        successCount++;
      } catch (err) {
        console.error(`Failed to insert ${listing.card_name}:`, err.message);
        errors.push({ card: listing.card_name, error: err.message });
        failureCount++;
      }
    }
    
    res.json({ 
      success: true,
      created: successCount,
      failed: failureCount,
      message: `Successfully created ${successCount} listings`,
      listings: createdListings,
      errors: errors
    });
    
  } catch (error) {
    console.error('Bulk listing error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to create listings',
      details: error.message 
    });
  }
});

app.get('/api/listings', (req, res) => {
  const { card_name, min_price, max_price, condition, status = 'active', limit = 100 } = req.query;
  let query = 'SELECT * FROM listings WHERE 1=1';
  const params = [];

  if (card_name) {
    query += ' AND card_name LIKE ?';
    params.push(`%${card_name}%`);
  }
  if (min_price) {
    query += ' AND price >= ?';
    params.push(min_price);
  }
  if (max_price) {
    query += ' AND price <= ?';
    params.push(max_price);
  }
  if (condition) {
    query += ' AND condition = ?';
    params.push(condition);
  }
  if (status) {
    query += ' AND status = ?';
    params.push(status);
  }

  query += ' ORDER BY created_at DESC LIMIT ?';
  params.push(parseInt(limit));

  db.all(query, params, (err, rows) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    res.json({ listings: rows || [] });
  });
});

app.get('/api/listings/user', authenticateToken, (req, res) => {
  const userId = req.user.id;
  
  db.all(
    'SELECT * FROM listings WHERE seller_id = ? ORDER BY created_at DESC',
    [userId],
    (err, listings) => {
      if (err) {
        console.error('Error fetching user listings:', err);
        return res.status(500).json({ error: 'Failed to fetch listings' });
      }
      
      res.json({ listings: listings || [] });
    }
  );
});

app.put('/api/listings/:id', authenticateToken, (req, res) => {
  const listingId = req.params.id;
  const userId = req.user.id;
  const { condition, quantity, price, description } = req.body;
  
  const updates = [];
  const values = [];
  
  if (condition !== undefined) {
    updates.push('condition = ?');
    values.push(condition);
  }
  if (quantity !== undefined) {
    updates.push('quantity = ?');
    values.push(quantity);
  }
  if (price !== undefined) {
    updates.push('price = ?');
    values.push(price);
  }
  if (description !== undefined) {
    updates.push('description = ?');
    values.push(description);
  }
  
  if (updates.length === 0) {
    return res.status(400).json({ error: 'No fields to update' });
  }
  
  values.push(listingId);
  values.push(userId);
  
  db.run(
    `UPDATE listings SET ${updates.join(', ')}, updated_at = CURRENT_TIMESTAMP 
     WHERE id = ? AND seller_id = ?`,
    values,
    function(err) {
      if (err) {
        console.error('Error updating listing:', err);
        return res.status(500).json({ error: 'Failed to update listing' });
      }
      
      res.json({ message: 'Listing updated successfully' });
    }
  );
});

app.put('/api/listings/:id/status', authenticateToken, (req, res) => {
  const listingId = req.params.id;
  const userId = req.user.id;
  const { status } = req.body;
  
  if (!['active', 'paused', 'sold'].includes(status)) {
    return res.status(400).json({ error: 'Invalid status' });
  }
  
  // If marking as sold, track the sale
  if (status === 'sold') {
    db.get(
      'SELECT price FROM listings WHERE id = ? AND seller_id = ?',
      [listingId, userId],
      async (err, listing) => {
        if (!err && listing) {
          await trackSale(listingId, null, listing.price);
        }
      }
    );
  }
  
  db.run(
    `UPDATE listings SET status = ?, updated_at = CURRENT_TIMESTAMP 
     WHERE id = ? AND seller_id = ?`,
    [status, listingId, userId],
    function(err) {
      if (err) {
        console.error('Error updating listing status:', err);
        return res.status(500).json({ error: 'Failed to update status' });
      }
      
      if (this.changes === 0) {
        return res.status(404).json({ error: 'Listing not found or unauthorized' });
      }
      
      res.json({ message: 'Status updated successfully' });
    }
  );
});

app.delete('/api/listings/:id', authenticateToken, (req, res) => {
  const listingId = req.params.id;
  const userId = req.user.id;
  
  db.run(
    'DELETE FROM listings WHERE id = ? AND seller_id = ?',
    [listingId, userId],
    function(err) {
      if (err) {
        console.error('Error deleting listing:', err);
        return res.status(500).json({ error: 'Failed to delete listing' });
      }
      
      if (this.changes === 0) {
        return res.status(404).json({ error: 'Listing not found or unauthorized' });
      }
      
      res.json({ message: 'Listing deleted successfully' });
    }
  );
});

// ============= MARKET ANALYSIS =============
app.get('/api/market/analysis', authenticateToken, async (req, res) => {
  try {
    const { card } = req.query;
    
    if (!card) {
      return res.status(400).json({ error: 'Card name required' });
    }
    
    // Get local market data
    const marketData = await new Promise((resolve) => {
      db.all(
        `SELECT 
          price,
          condition,
          quantity,
          created_at
        FROM listings
        WHERE LOWER(card_name) = LOWER(?) AND status = 'active'
        ORDER BY price ASC`,
        [card],
        (err, rows) => {
          if (err) {
            console.error('Market analysis error:', err);
            resolve([]);
          } else {
            resolve(rows || []);
          }
        }
      );
    });
    
    // Calculate statistics
    const prices = marketData.map(l => parseFloat(l.price));
    const avgPrice = prices.length > 0 ? prices.reduce((a, b) => a + b, 0) / prices.length : 0;
    const minPrice = prices.length > 0 ? Math.min(...prices) : 0;
    const maxPrice = prices.length > 0 ? Math.max(...prices) : 0;
    const medianPrice = prices.length > 0 ? prices[Math.floor(prices.length / 2)] : 0;
    
    res.json({
      cardName: card,
      activeListings: marketData.length,
      priceRange: {
        min: minPrice,
        max: maxPrice,
        average: avgPrice,
        median: medianPrice
      },
      conditionBreakdown: {
        NM: marketData.filter(l => l.condition === 'NM').length,
        LP: marketData.filter(l => l.condition === 'LP').length,
        MP: marketData.filter(l => l.condition === 'MP').length,
        HP: marketData.filter(l => l.condition === 'HP').length,
        DMG: marketData.filter(l => l.condition === 'DMG').length
      },
      totalQuantity: marketData.reduce((sum, l) => sum + parseInt(l.quantity), 0),
      recentSales: [], // Would need a sales table to track this
      priceHistory: [] // Would need price history tracking
    });
    
  } catch (error) {
    console.error('Market analysis error:', error);
    res.status(500).json({ error: 'Failed to analyze market' });
  }
});

// ============= DASHBOARD STATS =============
app.get('/api/dashboard/stats', authenticateToken, async (req, res) => {
  const userId = req.user.id;
  
  try {
    const stats = await Promise.all([
      new Promise((resolve) => {
        db.get('SELECT COUNT(*) as count FROM listings WHERE seller_id = ?', [userId], (err, row) => {
          resolve(row?.count || 0);
        });
      }),
      new Promise((resolve) => {
        db.get("SELECT COUNT(*) as count FROM listings WHERE seller_id = ? AND status = 'active'", [userId], (err, row) => {
          resolve(row?.count || 0);
        });
      }),
      new Promise((resolve) => {
        db.get("SELECT COUNT(*) as count FROM listings WHERE seller_id = ? AND status = 'sold'", [userId], (err, row) => {
          resolve(row?.count || 0);
        });
      }),
      new Promise((resolve) => {
        db.get("SELECT COALESCE(SUM(price * quantity), 0) as total FROM listings WHERE seller_id = ? AND status = 'sold'", [userId], (err, row) => {
          resolve(row?.total || 0);
        });
      }),
      new Promise((resolve) => {
        db.get('SELECT AVG(price) as avg FROM listings WHERE seller_id = ?', [userId], (err, row) => {
          resolve(row?.avg || 0);
        });
      })
    ]);
    
    res.json({
      totalListings: stats[0],
      activeListings: stats[1],
      soldListings: stats[2],
      totalRevenue: stats[3],
      avgPrice: stats[4],
      totalViews: 0,
      monthlyRevenue: stats[3], // Would need date filtering for real monthly data
      monthlyGrowth: 0,
      conversionRate: stats[0] > 0 ? ((stats[2] / stats[0]) * 100).toFixed(1) : 0
    });
  } catch (error) {
    console.error('Error fetching stats:', error);
    res.status(500).json({ error: 'Failed to fetch statistics' });
  }
});

// ============= HEALTH CHECK =============
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    database: 'Connected',
    authentication: 'Enabled',
    version: '1.0.0',
    imageProxy: 'Enabled',
    exchangeRate: `1 USD = ${AUD_EXCHANGE_RATE.toFixed(2)} AUD`
  });
});

// ============= ERROR HANDLING =============
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

// ============= START SERVER =============
const server = app.listen(PORT, () => {
  console.log('================================================');
  console.log(`🎴 MTG Australia Marketplace Backend`);
  console.log(`🚀 Server: http://localhost:${PORT}`);
  console.log(`❤️ Health: http://localhost:${PORT}/api/health`);
  console.log(`🗄️ Database: ${dbPath}`);
  console.log(`🔐 Auth: Enabled (JWT)`);
  console.log(`🖼️ Images: Proxied through local server`);
  console.log(`💱 Exchange Rate: 1 USD = ${AUD_EXCHANGE_RATE.toFixed(2)} AUD`);
  console.log(`📈 Trending: Enhanced with velocity tracking`);
  console.log('================================================');
  console.log('');
  console.log('📌 Image Proxy is ACTIVE at:');
  console.log(`   http://localhost:${PORT}/api/image-proxy`);
  console.log('   All Scryfall images will be served through this proxy');
  console.log('📷 Card Recognition API Available at:');
  console.log(`   POST http://localhost:${PORT}/api/cards/recognize`);
  console.log('================================================');
});

// ============= GRACEFUL SHUTDOWN =============
process.on('SIGTERM', () => {
  console.log('SIGTERM received, closing server...');
  server.close(() => {
    db.close();
    console.log('Server closed');
    process.exit(0);
  });
});

module.exports = app;