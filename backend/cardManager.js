// server/cardManager.js - Complete card database and image management system

const cloudinary = require('cloudinary').v2;
const multer = require('multer');
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const axios = require('axios');
const cron = require('node-cron');

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

// Configure multer for Cloudinary uploads
const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: async (req, file) => {
    return {
      folder: 'mtg-listings',
      format: 'jpg',
      public_id: `${req.user.id}-${Date.now()}`,
      transformation: [
        { width: 1200, height: 1680, crop: 'limit', quality: 'auto:best' },
      ]
    };
  },
});

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

class CardManager {
  constructor(db) {
    this.db = db;
    this.priceCache = new Map();
    this.initializeCardDatabase();
  }

  // Initialize card database with Scryfall bulk data
  async initializeCardDatabase() {
    try {
      // Check if we already have cards
      const cardCount = await this.getCardCount();
      if (cardCount > 0) {
        console.log(`Card database already initialized with ${cardCount} cards`);
        return;
      }

      console.log('Initializing card database from Scryfall...');
      
      // Download bulk data (default cards - includes all treatments)
      const bulkDataResponse = await axios.get('https://api.scryfall.com/bulk-data');
      const defaultCardsData = bulkDataResponse.data.data.find(item => item.type === 'default_cards');
      
      if (defaultCardsData) {
        const cardsResponse = await axios.get(defaultCardsData.download_uri, {
          responseType: 'stream'
        });
        
        // Process the JSON stream
        await this.processCardStream(cardsResponse.data);
      }
      
      console.log('Card database initialization complete');
    } catch (error) {
      console.error('Failed to initialize card database:', error);
    }
  }

  async processCardStream(stream) {
    // This would process the Scryfall bulk data
    // For production, you'd want to implement proper streaming JSON parsing
    // For now, we'll use the API for individual cards
  }

  // Sync card data from Scryfall
  async syncCardFromScryfall(scryfallId) {
    try {
      const response = await axios.get(`https://api.scryfall.com/cards/${scryfallId}`);
      const card = response.data;
      
      // Insert or update card catalog
      await this.upsertCardCatalog(card);
      
      // Insert or update printing
      await this.upsertCardPrinting(card);
      
      // Update prices
      await this.updateCardPrices(card);
      
      return card;
    } catch (error) {
      console.error('Failed to sync card:', error);
      throw error;
    }
  }

  async upsertCardCatalog(card) {
    return new Promise((resolve, reject) => {
      this.db.run(`
        INSERT OR REPLACE INTO card_catalog (
          scryfall_id, oracle_id, name, mana_cost, cmc, type_line,
          oracle_text, power, toughness, colors, color_identity,
          keywords, legalities, reserved
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        card.id,
        card.oracle_id,
        card.name,
        card.mana_cost || null,
        card.cmc || 0,
        card.type_line,
        card.oracle_text || null,
        card.power || null,
        card.toughness || null,
        JSON.stringify(card.colors || []),
        JSON.stringify(card.color_identity || []),
        JSON.stringify(card.keywords || []),
        JSON.stringify(card.legalities || {}),
        card.reserved ? 1 : 0
      ], (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }

  async upsertCardPrinting(card) {
    // Get catalog ID
    const catalogId = await this.getCardCatalogId(card.oracle_id);
    
    // Determine special treatments
    const treatments = this.detectCardTreatments(card);
    
    return new Promise((resolve, reject) => {
      this.db.run(`
        INSERT OR REPLACE INTO card_printings (
          card_catalog_id, scryfall_id, set_code, set_name, collector_number,
          rarity, flavor_text, artist, release_date,
          image_normal, image_large, image_small, image_art_crop, back_image,
          frame_version, frame_effects, border_color, promo_types,
          has_foil, has_nonfoil, has_etched,
          is_oversized, is_full_art, is_textless, is_showcase,
          is_extended_art, is_borderless, is_promo, security_stamp
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        catalogId,
        card.id,
        card.set,
        card.set_name,
        card.collector_number,
        card.rarity,
        card.flavor_text || null,
        card.artist || null,
        card.released_at,
        card.image_uris?.normal || null,
        card.image_uris?.large || null,
        card.image_uris?.small || null,
        card.image_uris?.art_crop || null,
        card.card_faces?.[1]?.image_uris?.normal || null,
        card.frame || '2015',
        JSON.stringify(card.frame_effects || []),
        card.border_color || 'black',
        JSON.stringify(card.promo_types || []),
        card.finishes?.includes('foil') ? 1 : 0,
        card.finishes?.includes('nonfoil') ? 1 : 0,
        card.finishes?.includes('etched') ? 1 : 0,
        card.oversized ? 1 : 0,
        card.full_art ? 1 : 0,
        card.textless ? 1 : 0,
        treatments.is_showcase ? 1 : 0,
        treatments.is_extended_art ? 1 : 0,
        treatments.is_borderless ? 1 : 0,
        card.promo ? 1 : 0,
        card.security_stamp || null
      ], (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }

  detectCardTreatments(card) {
    return {
      is_showcase: card.frame_effects?.includes('showcase') || false,
      is_extended_art: card.frame_effects?.includes('extendedart') || false,
      is_borderless: card.border_color === 'borderless' || false,
      is_retro: card.frame === '1997' || card.frame === '1993',
      is_serialized: card.frame_effects?.includes('serialized') || false,
      has_special_foil: this.detectSpecialFoilType(card)
    };
  }

  detectSpecialFoilType(card) {
    // Detect special foil treatments from set and promo info
    const specialFoilSets = {
      'SLD': 'Secret Lair Foil',
      'MUL': 'Serialized',
      'BRO': 'Schematic',
      'DMU': 'Stained Glass',
      'NEO': 'Neon Ink'
    };
    
    if (card.promo_types?.includes('galaxyfoil')) return 'Galaxy Foil';
    if (card.promo_types?.includes('textured')) return 'Textured Foil';
    if (card.promo_types?.includes('etched')) return 'Etched Foil';
    if (card.frame_effects?.includes('inverted')) return 'Phyrexian Foil';
    
    return specialFoilSets[card.set] || null;
  }

  async updateCardPrices(card) {
    const printingId = await this.getPrintingId(card.id);
    
    const prices = [
      { finish: 'nonfoil', price: card.prices?.aud || card.prices?.usd * 1.55 },
      { finish: 'foil', price: card.prices?.aud_foil || card.prices?.usd_foil * 1.55 }
    ];
    
    for (const priceData of prices) {
      if (priceData.price) {
        await this.insertPriceHistory(printingId, priceData.finish, priceData.price);
      }
    }
  }

  async insertPriceHistory(printingId, finish, price) {
    return new Promise((resolve, reject) => {
      this.db.run(`
        INSERT INTO price_history (printing_id, finish, price_aud, recorded_at)
        VALUES (?, ?, ?, CURRENT_TIMESTAMP)
      `, [printingId, finish, price], (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }

  // Search cards with inventory priority
  async searchCards(query, options = {}) {
    const {
      includeOutOfStock = true,
      sortByAvailability = true,
      page = 1,
      limit = 20
    } = options;
    
    const offset = (page - 1) * limit;
    
    return new Promise((resolve, reject) => {
      // Complex query that prioritizes in-stock items
      const sql = `
        SELECT 
          c.id as catalog_id,
          c.name,
          c.type_line,
          c.mana_cost,
          p.id as printing_id,
          p.scryfall_id,
          p.set_code,
          p.set_name,
          p.collector_number,
          p.rarity,
          p.image_normal,
          p.image_small,
          p.frame_effects,
          p.border_color,
          p.has_foil,
          p.has_nonfoil,
          p.is_showcase,
          p.is_extended_art,
          p.is_borderless,
          COUNT(DISTINCT l.id) as available_listings,
          MIN(l.price) as min_price,
          MAX(l.price) as max_price,
          ph.price_aud as market_price
        FROM card_catalog c
        JOIN card_printings p ON c.id = p.card_catalog_id
        LEFT JOIN listings_v2 l ON p.id = l.printing_id AND l.status = 'active'
        LEFT JOIN (
          SELECT printing_id, finish, price_aud,
                 ROW_NUMBER() OVER (PARTITION BY printing_id, finish ORDER BY recorded_at DESC) as rn
          FROM price_history
        ) ph ON p.id = ph.printing_id AND ph.rn = 1
        WHERE c.name LIKE ?
        GROUP BY p.id
        ORDER BY 
          ${sortByAvailability ? 'available_listings DESC,' : ''}
          c.name ASC,
          p.release_date DESC
        LIMIT ? OFFSET ?
      `;
      
      this.db.all(sql, [`%${query}%`, limit, offset], (err, rows) => {
        if (err) {
          reject(err);
        } else {
          resolve(rows);
        }
      });
    });
  }

  // Get all versions of a card with inventory
  async getCardVersions(cardName, options = {}) {
    return new Promise((resolve, reject) => {
      const sql = `
        SELECT 
          p.*,
          c.name,
          c.type_line,
          c.oracle_text,
          COUNT(DISTINCT CASE WHEN l.finish = 'nonfoil' THEN l.id END) as nonfoil_available,
          COUNT(DISTINCT CASE WHEN l.finish = 'foil' THEN l.id END) as foil_available,
          COUNT(DISTINCT CASE WHEN l.finish = 'etched' THEN l.id END) as etched_available,
          MIN(CASE WHEN l.finish = 'nonfoil' THEN l.price END) as nonfoil_min_price,
          MIN(CASE WHEN l.finish = 'foil' THEN l.price END) as foil_min_price,
          MIN(CASE WHEN l.finish = 'etched' THEN l.price END) as etched_min_price,
          GROUP_CONCAT(DISTINCT l.condition) as available_conditions
        FROM card_catalog c
        JOIN card_printings p ON c.id = p.card_catalog_id
        LEFT JOIN listings_v2 l ON p.id = l.printing_id AND l.status = 'active'
        WHERE c.name = ?
        GROUP BY p.id
        ORDER BY 
          (nonfoil_available + foil_available + etched_available) DESC,
          p.release_date DESC
      `;
      
      this.db.all(sql, [cardName], (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
  }

  // Upload custom images for listings
  async uploadListingImage(listingId, imageFile, imageType = 'front') {
    try {
      const result = await cloudinary.uploader.upload(imageFile.path, {
        folder: 'mtg-listings',
        public_id: `listing-${listingId}-${imageType}-${Date.now()}`,
        transformation: [
          { width: 680, height: 950, crop: 'fill', quality: 'auto:good' }
        ]
      });
      
      // Generate thumbnail
      const thumbnailUrl = cloudinary.url(result.public_id, {
        width: 200,
        height: 280,
        crop: 'fill',
        quality: 'auto:low'
      });
      
      // Save to database
      await this.saveImageRecord({
        listing_id: listingId,
        public_url: result.secure_url,
        thumbnail_url: thumbnailUrl,
        public_id: result.public_id,
        format: result.format,
        width: result.width,
        height: result.height,
        bytes: result.bytes
      });
      
      return {
        url: result.secure_url,
        thumbnail: thumbnailUrl,
        public_id: result.public_id
      };
    } catch (error) {
      console.error('Image upload failed:', error);
      throw error;
    }
  }

  async saveImageRecord(imageData) {
    return new Promise((resolve, reject) => {
      this.db.run(`
        INSERT INTO image_uploads (
          listing_id, user_id, image_type, storage_provider,
          public_url, thumbnail_url, secure_url, public_id,
          format, width, height, bytes
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        imageData.listing_id,
        imageData.user_id,
        imageData.image_type || 'listing_front',
        'cloudinary',
        imageData.public_url,
        imageData.thumbnail_url,
        imageData.secure_url || imageData.public_url,
        imageData.public_id,
        imageData.format,
        imageData.width,
        imageData.height,
        imageData.bytes
      ], (err) => {
        if (err) reject(err);
        else resolve(this.lastID);
      });
    });
  }

  // Helper methods
  async getCardCatalogId(oracleId) {
    return new Promise((resolve, reject) => {
      this.db.get('SELECT id FROM card_catalog WHERE oracle_id = ?', [oracleId], (err, row) => {
        if (err) reject(err);
        else resolve(row?.id);
      });
    });
  }

  async getPrintingId(scryfallId) {
    return new Promise((resolve, reject) => {
      this.db.get('SELECT id FROM card_printings WHERE scryfall_id = ?', [scryfallId], (err, row) => {
        if (err) reject(err);
        else resolve(row?.id);
      });
    });
  }

  async getCardCount() {
    return new Promise((resolve, reject) => {
      this.db.get('SELECT COUNT(*) as count FROM card_catalog', (err, row) => {
        if (err) reject(err);
        else resolve(row?.count || 0);
      });
    });
  }

  // Schedule price updates (run daily)
  schedulePriceUpdates() {
    cron.schedule('0 0 * * *', async () => {
      console.log('Updating card prices...');
      await this.updateAllPrices();
    });
  }

  async updateAllPrices() {
    // This would batch update prices from Scryfall
    // Implementation depends on your specific needs
  }
}

module.exports = { CardManager, upload };