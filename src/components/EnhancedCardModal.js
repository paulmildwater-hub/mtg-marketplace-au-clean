// EnhancedCardModal.js - Card detail view modal
import React from 'react';
import { X, ShoppingCart, Eye, Package, DollarSign, Info, Star } from 'lucide-react';
import { ManaCost } from './ManaSymbols';

function EnhancedCardModal({ selectedCard, onClose, onAddToCart, onViewVersions, formatPrice }) {
  if (!selectedCard) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b z-10">
          <div className="flex justify-between items-center p-4">
            <h2 className="text-2xl font-bold">{selectedCard.name}</h2>
            <button 
              onClick={onClose}
              className="p-2 hover:bg-gray-100 rounded-lg transition"
            >
              <X size={24} />
            </button>
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-6 p-6">
          {/* Card Image */}
          <div>
            {selectedCard.imageUrl || selectedCard.originalImageUrl ? (
              <img 
                src={selectedCard.imageUrl || selectedCard.originalImageUrl}
                alt={selectedCard.name}
                className="w-full rounded-lg shadow-lg"
                onError={(e) => {
                  e.target.src = `https://via.placeholder.com/488x680?text=${encodeURIComponent(selectedCard.name)}`;
                }}
              />
            ) : (
              <div className="w-full aspect-[488/680] bg-gray-100 rounded-lg flex items-center justify-center">
                <div className="text-center">
                  <span className="text-6xl">🎴</span>
                  <p className="mt-4 text-gray-500">No image available</p>
                </div>
              </div>
            )}
          </div>

          {/* Card Details */}
          <div className="space-y-4">
            {/* Price and Stock */}
            <div className="bg-gradient-to-r from-green-50 to-blue-50 rounded-lg p-4">
              <div className="flex justify-between items-start mb-3">
                <div>
                  <div className="text-3xl font-bold text-green-600">
                    {selectedCard.lowestPrice ? 
                      `From ${formatPrice(selectedCard.lowestPrice)}` : 
                      formatPrice(selectedCard.price || 0)
                    }
                  </div>
                  <div className="text-sm text-gray-600 mt-1">Market Price</div>
                </div>
                <div className="text-right">
                  {selectedCard.inStock ? (
                    <div className="flex items-center gap-2 text-green-600">
                      <Package size={20} />
                      <span className="font-semibold">In Stock</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 text-gray-500">
                      <Package size={20} />
                      <span>Out of Stock</span>
                    </div>
                  )}
                  {selectedCard.availableQuantity > 0 && (
                    <div className="text-sm text-gray-600 mt-1">
                      {selectedCard.availableQuantity} available
                    </div>
                  )}
                </div>
              </div>

              {selectedCard.sellerCount > 0 && (
                <div className="text-sm text-gray-600 border-t pt-2 mt-2">
                  Available from {selectedCard.sellerCount} seller{selectedCard.sellerCount > 1 ? 's' : ''}
                </div>
              )}
            </div>

            {/* Card Info */}
            <div className="bg-white border rounded-lg p-4 space-y-3">
              <div className="flex justify-between">
                <span className="text-gray-600">Set:</span>
                <span className="font-semibold">{selectedCard.set || selectedCard.set_name}</span>
              </div>
              
              <div className="flex justify-between">
                <span className="text-gray-600">Rarity:</span>
                <span className={`px-2 py-1 rounded text-xs font-semibold ${
                  selectedCard.rarity === 'mythic' ? 'bg-orange-100 text-orange-800' :
                  selectedCard.rarity === 'rare' ? 'bg-yellow-100 text-yellow-800' :
                  selectedCard.rarity === 'uncommon' ? 'bg-gray-100 text-gray-800' :
                  'bg-blue-100 text-blue-800'
                }`}>
                  {selectedCard.rarity}
                </span>
              </div>

              {selectedCard.type_line && (
                <div className="flex justify-between">
                  <span className="text-gray-600">Type:</span>
                  <span className="font-semibold text-right">{selectedCard.type_line}</span>
                </div>
              )}

				{selectedCard.manaCost && (
				  <div className="flex justify-between items-center">
					<span className="text-gray-600">Mana Cost:</span>
					<ManaCost cost={selectedCard.manaCost} size={20} />
				  </div>
				)}

              {selectedCard.power && selectedCard.toughness && (
                <div className="flex justify-between">
                  <span className="text-gray-600">P/T:</span>
                  <span className="font-semibold">{selectedCard.power}/{selectedCard.toughness}</span>
                </div>
              )}

              {selectedCard.artist && (
                <div className="flex justify-between">
                  <span className="text-gray-600">Artist:</span>
                  <span className="font-semibold">{selectedCard.artist}</span>
                </div>
              )}
            </div>

            {/* Oracle Text */}
            {selectedCard.description && (
              <div className="bg-gray-50 rounded-lg p-4">
                <h3 className="font-semibold mb-2 flex items-center gap-2">
                  <Info size={18} />
                  Oracle Text
                </h3>
                <p className="text-sm text-gray-700 whitespace-pre-line">
                  {selectedCard.description}
                </p>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex gap-3 pt-4">
              <button
                onClick={() => {
                  onClose(); // Close the card modal first
                  setTimeout(() => {
                    onViewVersions(selectedCard.name); // Then open versions modal
                  }, 100); // Small delay to ensure smooth transition
                }}
                className="flex-1 px-4 py-3 border-2 border-purple-600 text-purple-600 rounded-lg hover:bg-purple-50 transition font-semibold flex items-center justify-center gap-2"
              >
                <Eye size={20} />
                View All Versions
              </button>
              
              <button
                onClick={() => {
                  onAddToCart(selectedCard);
                  onClose();
                }}
                disabled={!selectedCard.inStock}
                className={`flex-1 px-4 py-3 rounded-lg font-semibold flex items-center justify-center gap-2 transition ${
                  selectedCard.inStock
                    ? 'bg-blue-600 text-white hover:bg-blue-700'
                    : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                }`}
              >
                <ShoppingCart size={20} />
                {selectedCard.inStock ? 'Add to Cart' : 'Out of Stock'}
              </button>
            </div>

            {/* Additional Info */}
            <div className="text-xs text-gray-500 pt-2">
              <p>Card ID: {selectedCard.id}</p>
              {selectedCard.setCode && <p>Set Code: {selectedCard.setCode}</p>}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default EnhancedCardModal;