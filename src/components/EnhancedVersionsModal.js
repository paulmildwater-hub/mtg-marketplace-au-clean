// Updated EnhancedVersionsModal.js - Version card rendering with Out of Stock status
import React from 'react';
import { X, Sparkles, Package, Info } from 'lucide-react';

function VersionCard({ 
  version, 
  isSelected, 
  onSelect, 
  formatPrice, 
  selectedFinish, 
  setSelectedFinish 
}) {
  const foilTypes = getFoilType(version);
  const treatmentBadges = getTreatmentBadges(version);
  const displayPrice = version.localPrice || parseFloat(version.prices?.aud) || 0;
  const foilPrice = parseFloat(version.prices?.aud_foil) || 0;
  
  // Helper functions (these should be defined in your component)
  function getFoilType(version) {
    const badges = [];
    if (version.finishes?.includes('etched')) {
      badges.push({ type: 'etched', label: 'Etched Foil', color: 'purple' });
    }
    if (version.promo_types?.includes('textured')) {
      badges.push({ type: 'textured', label: 'Textured Foil', color: 'orange' });
    }
    if (version.finishes?.includes('foil')) {
      badges.push({ type: 'traditional', label: 'Traditional Foil', color: 'blue' });
    }
    return badges;
  }
  
  function getTreatmentBadges(version) {
    const badges = [];
    if (version.promo) badges.push({ label: 'Promo', color: 'purple' });
    if (version.fullArt) badges.push({ label: 'Full Art', color: 'green' });
    if (version.showcase) badges.push({ label: 'Showcase', color: 'blue' });
    if (version.extendedArt) badges.push({ label: 'Extended Art', color: 'yellow' });
    if (version.borderless) badges.push({ label: 'Borderless', color: 'orange' });
    if (version.retro) badges.push({ label: 'Retro Frame', color: 'amber' });
    return badges;
  }

  return (
    <div
      onClick={() => onSelect(version)}
      className={`border rounded-lg hover:shadow-lg transition bg-white relative cursor-pointer ${
        !version.inStock ? 'opacity-75' : ''
      } ${isSelected ? 'border-blue-500 bg-blue-50' : ''}`}
    >
      {/* Stock Status Overlay for Out of Stock items */}
      {!version.inStock && (
        <div className="absolute inset-0 bg-black bg-opacity-10 rounded-lg z-10 pointer-events-none">
          <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-red-600 text-white px-3 py-1 rounded-full text-sm font-bold">
            OUT OF STOCK
          </div>
        </div>
      )}
      
      {/* In Stock Badge - Changed from "Local Stock" */}
      {version.inStock && (
        <div className="absolute top-2 left-2 bg-green-500 text-white px-2 py-1 rounded-lg text-xs font-bold z-20 flex items-center gap-1">
          <Package size={12} />
          In Stock • {version.availableQuantity}
        </div>
      )}
      
      {/* Card Image */}
      <div className="relative">
        {version.imageUrl ? (
          <img
            src={version.imageUrl}
            alt={version.name}
            className="w-full rounded-t-lg"
          />
        ) : (
          <div className="w-full h-48 bg-gray-100 rounded-t-lg flex items-center justify-center">
            <span className="text-2xl">🎴</span>
          </div>
        )}
        
        {/* Foil indicator overlay */}
        {foilTypes.length > 0 && (
          <div className="absolute top-2 right-2 bg-black bg-opacity-75 text-white px-2 py-1 rounded-lg flex items-center gap-1 z-20">
            {foilTypes[0].icon || <Sparkles size={12} />}
            <span className="text-xs font-bold">{foilTypes[0].label}</span>
          </div>
        )}
      </div>
      
      <div className="p-3">
        {/* Set Info */}
        <div className="text-sm font-bold">{version.set}</div>
        <div className="text-xs text-gray-600 mb-2">
          {version.setCode} • #{version.collector_number}
          {version.released_at && (
            <span className="block">{version.released_at}</span>
          )}
        </div>
        
        {/* Treatment Badges */}
        {treatmentBadges.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-2">
            {treatmentBadges.map((badge, idx) => (
              <span 
                key={idx}
                className={`text-xs px-2 py-0.5 rounded bg-${badge.color}-100 text-${badge.color}-800`}
              >
                {badge.label}
              </span>
            ))}
          </div>
        )}
        
        {/* Prices */}
        <div className="border-t pt-2 mb-2">
          <div className="space-y-1">
            {/* Local price if in stock */}
            {version.inStock && version.localPrice && (
              <div className="flex justify-between items-center text-xs">
                <span className="font-bold text-green-600">In Stock:</span>
                <span className="font-bold text-green-600">{formatPrice(version.localPrice)}</span>
              </div>
            )}
            
            {/* Market prices */}
            {displayPrice > 0 && (
              <div className="flex justify-between items-center text-xs">
                <span>Market:</span>
                <span className={version.inStock ? 'text-gray-500 line-through' : 'font-bold'}>
                  {formatPrice(displayPrice)}
                </span>
              </div>
            )}
            
            {foilPrice > 0 && (
              <div className="flex justify-between items-center text-xs">
                <span className="flex items-center gap-1">
                  <Sparkles size={10} />
                  Foil:
                </span>
                <span className="text-blue-600">{formatPrice(foilPrice)}</span>
              </div>
            )}
          </div>
        </div>
        
        {/* Stock Status Message */}
        {!version.inStock && (
          <div className="text-xs text-red-600 font-medium mb-2 text-center">
            Currently unavailable
          </div>
        )}
        
        {/* Seller info for in-stock items */}
        {version.inStock && version.sellerCount > 0 && (
          <div className="text-xs text-gray-600 mb-2">
            From {version.sellerCount} seller{version.sellerCount > 1 ? 's' : ''}
          </div>
        )}
        
        {/* Add to Cart Button */}
        <button 
          disabled={!version.inStock}
          className={`w-full text-white text-sm py-2 rounded transition font-medium ${
            version.inStock 
              ? 'bg-blue-600 hover:bg-blue-700' 
              : 'bg-gray-400 cursor-not-allowed'
          }`}
        >
          {version.inStock ? 'Add to Cart' : 'Out of Stock'}
        </button>
      </div>
    </div>
  );
}

export default VersionCard;