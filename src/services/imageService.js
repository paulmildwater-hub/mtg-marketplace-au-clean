// src/services/imageService.js
class ImageService {
  constructor() {
    this.imageCache = new Map();
    this.pendingRequests = new Map();
  }

  // Get card image with caching
  async getCardImage(card, size = 'normal') {
    const cacheKey = `${card.id || card.name}_${size}`;
    
    // Check cache first
    if (this.imageCache.has(cacheKey)) {
      return this.imageCache.get(cacheKey);
    }

    // Check if request is already pending
    if (this.pendingRequests.has(cacheKey)) {
      return this.pendingRequests.get(cacheKey);
    }

    // Create new request
    const imagePromise = this.fetchCardImage(card, size);
    this.pendingRequests.set(cacheKey, imagePromise);

    try {
      const imageUrl = await imagePromise;
      this.imageCache.set(cacheKey, imageUrl);
      this.pendingRequests.delete(cacheKey);
      return imageUrl;
    } catch (error) {
      this.pendingRequests.delete(cacheKey);
      throw error;
    }
  }

  async fetchCardImage(card, size) {
    // Try different strategies to get the image
    const strategies = [
      () => this.getDirectImageUrl(card, size),
      () => this.getScryfallImageById(card.id, size),
      () => this.getScryfallImageByName(card.name, size),
      () => this.getGathererImage(card.multiverseid),
      () => this.getCardBack()
    ];

    for (const strategy of strategies) {
      try {
        const url = await strategy();
        if (url && await this.validateImageUrl(url)) {
          return url;
        }
      } catch (error) {
        continue; // Try next strategy
      }
    }

    return this.getCardBack();
  }

  getDirectImageUrl(card, size) {
    if (card?.imageUrl) return card.imageUrl;
    if (card?.image_uris?.[size]) return card.image_uris[size];
    if (card?.card_faces?.[0]?.image_uris?.[size]) {
      return card.card_faces[0].image_uris[size];
    }
    return null;
  }

  async getScryfallImageById(cardId, size) {
    if (!cardId || !cardId.match(/^[a-f0-9-]{36}$/i)) return null;
    
    try {
      const response = await fetch(`https://api.scryfall.com/cards/${cardId}`);
      if (response.ok) {
        const data = await response.json();
        return data.image_uris?.[size] || data.image_uris?.normal;
      }
    } catch (error) {
      console.error('Scryfall ID fetch failed:', error);
    }
    return null;
  }

  async getScryfallImageByName(cardName, size) {
    if (!cardName) return null;
    
    try {
      const response = await fetch(
        `https://api.scryfall.com/cards/named?fuzzy=${encodeURIComponent(cardName)}`
      );
      if (response.ok) {
        const data = await response.json();
        return data.image_uris?.[size] || data.image_uris?.normal;
      }
    } catch (error) {
      console.error('Scryfall name fetch failed:', error);
    }
    return null;
  }

  getGathererImage(multiverseid) {
    if (!multiverseid) return null;
    return `https://gatherer.wizards.com/Handlers/Image.ashx?multiverseid=${multiverseid}&type=card`;
  }

  getCardBack() {
    return 'https://cards.scryfall.io/normal/back/0/0/0000000000000000000000000000000000000000.jpg';
  }

  async validateImageUrl(url) {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => resolve(true);
      img.onerror = () => resolve(false);
      img.src = url;
      
      // Timeout after 5 seconds
      setTimeout(() => resolve(false), 5000);
    });
  }

  // Preload images for better performance
  preloadImages(cards, size = 'small') {
    cards.forEach(card => {
      this.getCardImage(card, size).catch(() => {
        // Silently fail for preloading
      });
    });
  }

  // Clear cache if it gets too large
  clearCache() {
    if (this.imageCache.size > 500) {
      const entriesToKeep = 250;
      const entries = Array.from(this.imageCache.entries());
      this.imageCache = new Map(entries.slice(-entriesToKeep));
    }
  }
}

export default new ImageService();