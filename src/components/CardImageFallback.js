// src/components/CardImageFallback.js - Simplified and bulletproof
import React from 'react';

const CardImageFallback = ({ 
  card, 
  size = 'normal', 
  className = '', 
  onClick,
  showDebug = false 
}) => {
  // Size configurations
  const sizeConfig = {
    small: { 
      width: 146, 
      height: 204,
    },
    normal: { 
      width: 488, 
      height: 680,
    },
    large: { 
      width: 672, 
      height: 936,
    }
  };

  const config = sizeConfig[size] || sizeConfig.normal;
  
  // Trust the backend - it already processed the image URL correctly
  const imageUrl = card?.imageUrl || card?.image_url || 'https://cards.scryfall.io/back.png';

  return (
    <div className={`relative inline-block ${className}`}>
      <img 
        src={imageUrl}
        alt={card?.name || 'MTG Card'}
        width={config.width}
        height={config.height}
        className={`object-cover rounded ${onClick ? 'cursor-pointer hover:scale-105 transition' : ''}`}
        onError={(e) => {
          // Simple fallback - if image fails, show card back
          if (e.target.src !== 'https://cards.scryfall.io/back.png') {
            e.target.src = 'https://cards.scryfall.io/back.png';
          }
        }}
        onClick={onClick}
        loading="lazy"
      />
      
      {/* Local stock indicator */}
      {card?.isLocalInventory && card?.inStock && (
        <div className="absolute -top-1 -right-1 bg-green-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center shadow-lg">
          ✓
        </div>
      )}
    </div>
  );
};

export default CardImageFallback;