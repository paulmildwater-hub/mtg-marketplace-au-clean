// src/services/CardImageService.js
class CardImageService {
  constructor() {
    this.imageCache = new Map();
    this.fallbackImages = {
      small: 'https://via.placeholder.com/146x204?text=MTG+Card',
      normal: 'https://via.placeholder.com/488x680?text=MTG+Card',
      large: 'https://via.placeholder.com/672x936?text=MTG+Card'
    };
  }

  /**
   * Get the best available image URL for a card
   * Priority: Local cached → Scryfall → Gatherer → Fallback
   */
  async getCardImage(card, size = 'normal') {
    const cacheKey = `${card.id || card.name}_${size}`;
    
    // Check cache first
    if (this.imageCache.has(cacheKey)) {
      return this.imageCache.get(cacheKey);
    }

    // Try different image sources in order
    let imageUrl = null;

    // 1. Try Scryfall images (most reliable)
    if (card.scryfall_id || card.id) {
      imageUrl = await this.getScryfallImage(card, size);
    }

    // 2. Try card.imageUrl if provided
    if (!imageUrl && card.imageUrl) {
      imageUrl = card.imageUrl;
    }

    // 3. Try to fetch from Scryfall by name
    if (!imageUrl && card.name) {
      imageUrl = await this.fetchScryfallImageByName(card.name, size);
    }

    // 4. Try Gatherer as backup
    if (!imageUrl && card.multiverse_id) {
      imageUrl = this.getGathererImage(card.multiverse_id);
    }

    // 5. Use fallback
    if (!imageUrl) {
      imageUrl = this.fallbackImages[size] || this.fallbackImages.normal;
    }

    // Cache the result
    this.imageCache.set(cacheKey, imageUrl);
    return imageUrl;
  }

  async getScryfallImage(card, size = 'normal') {
    const sizeMap = {
      small: 'small',
      normal: 'normal',
      large: 'large',
      art_crop: 'art_crop',
      border_crop: 'border_crop'
    };

    try {
      // If we have image_uris directly
      if (card.image_uris) {
        return card.image_uris[sizeMap[size]] || card.image_uris.normal;
      }

      // If it's a double-faced card
      if (card.card_faces && card.card_faces[0]?.image_uris) {
        return card.card_faces[0].image_uris[sizeMap[size]] || card.card_faces[0].image_uris.normal;
      }

      // Fetch from Scryfall API if we have an ID
      if (card.scryfall_id || card.id) {
        const response = await fetch(`https://api.scryfall.com/cards/${card.scryfall_id || card.id}`);
        if (response.ok) {
          const data = await response.json();
          if (data.image_uris) {
            return data.image_uris[sizeMap[size]] || data.image_uris.normal;
          }
        }
      }
    } catch (error) {
      console.error('Error fetching Scryfall image:', error);
    }
    
    return null;
  }

  async fetchScryfallImageByName(cardName, size = 'normal') {
    try {
      // Try exact match first
      let response = await fetch(
        `https://api.scryfall.com/cards/named?exact=${encodeURIComponent(cardName)}`
      );
      
      // If exact match fails, try fuzzy
      if (!response.ok) {
        response = await fetch(
          `https://api.scryfall.com/cards/named?fuzzy=${encodeURIComponent(cardName)}`
        );
      }
      
      if (response.ok) {
        const data = await response.json();
        const sizeMap = {
          small: 'small',
          normal: 'normal', 
          large: 'large'
        };
        
        if (data.image_uris) {
          return data.image_uris[sizeMap[size]] || data.image_uris.normal;
        }
        if (data.card_faces?.[0]?.image_uris) {
          return data.card_faces[0].image_uris[sizeMap[size]] || data.card_faces[0].image_uris.normal;
        }
      }
    } catch (error) {
      console.error('Error fetching card by name:', error);
    }
    
    return null;
  }

  getGathererImage(multiverseId) {
    if (!multiverseId) return null;
    return `https://gatherer.wizards.com/Handlers/Image.ashx?multiverseid=${multiverseId}&type=card`;
  }

  /**
   * Preload images for better performance
   */
  preloadImages(cards) {
    cards.forEach(card => {
      if (card.imageUrl || card.image_uris?.normal) {
        const img = new Image();
        img.src = card.imageUrl || card.image_uris.normal;
      }
    });
  }

  /**
   * Clear cache to free memory
   */
  clearCache() {
    this.imageCache.clear();
  }
}

// Export singleton instance
export default new CardImageService();