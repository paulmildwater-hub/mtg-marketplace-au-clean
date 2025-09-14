import React, { useState, useEffect } from 'react';
import { DollarSign, TrendingUp, TrendingDown, Info, Percent, Target, AlertCircle, ChevronRight } from 'lucide-react';

function PricingEngine({ cards, selectedCards, onUpdate, onContinue, onBack }) {
  const [pricingStrategy, setPricingStrategy] = useState('competitive');
  const [bulkAdjustment, setBulkAdjustment] = useState(0);
  const [customPrices, setCustomPrices] = useState({});
  const [marketAnalysis, setMarketAnalysis] = useState({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Initialize custom prices with suggested prices
    const initialPrices = {};
    cards.forEach(card => {
      if (selectedCards.has(card.id)) {
        initialPrices[card.id] = card.suggestedPrice || card.marketPrice || 10;
      }
    });
    setCustomPrices(initialPrices);
    
    // Fetch market analysis for each card
    fetchMarketAnalysis();
  }, [cards, selectedCards]);

  const fetchMarketAnalysis = async () => {
    setLoading(true);
    const analysis = {};
    
    for (const card of cards) {
      if (selectedCards.has(card.id)) {
        try {
          const response = await fetch(
            `http://localhost:5000/api/market/analysis?card=${encodeURIComponent(card.name)}`
          );
          const data = await response.json();
          analysis[card.id] = data;
        } catch (error) {
          console.error('Failed to fetch market analysis:', error);
        }
      }
    }
    
    setMarketAnalysis(analysis);
    setLoading(false);
  };

  const applyPricingStrategy = () => {
    const updatedPrices = {};
    
    cards.forEach(card => {
      if (selectedCards.has(card.id)) {
        const basePrice = parseFloat(card.marketPrice || card.suggestedPrice || 10);
        const analysis = marketAnalysis[card.id];
        let adjustedPrice = basePrice;
        
        switch (pricingStrategy) {
          case 'competitive':
            // Price 5% below market
            adjustedPrice = basePrice * 0.95;
            break;
          case 'premium':
            // Price at market for NM, slight premium for special treatments
            adjustedPrice = card.condition === 'NM' ? basePrice : basePrice * 0.9;
            if (card.finish === 'foil') adjustedPrice *= 1.05;
            break;
          case 'quick-sale':
            // Price 15% below market for quick movement
            adjustedPrice = basePrice * 0.85;
            break;
          case 'market':
            // Price at current market rate
            adjustedPrice = basePrice;
            break;
          case 'undercut':
            // Price just below lowest competitor if known
            if (analysis?.priceRange?.min) {
              adjustedPrice = analysis.priceRange.min - 0.01;
            } else {
              adjustedPrice = basePrice * 0.9;
            }
            break;
        }
        
        // Apply bulk adjustment
        if (bulkAdjustment !== 0) {
          adjustedPrice *= (1 + bulkAdjustment / 100);
        }
        
        updatedPrices[card.id] = Math.max(0.25, adjustedPrice).toFixed(2);
      }
    });
    
    setCustomPrices(updatedPrices);
  };

  const updateCardPrice = (cardId, price) => {
    setCustomPrices(prev => ({
      ...prev,
      [cardId]: price
    }));
  };

  const handleContinue = () => {
    // Update cards with final prices
    const updatedCards = cards.map(card => {
      if (selectedCards.has(card.id)) {
        return {
          ...card,
          userPrice: parseFloat(customPrices[card.id] || card.suggestedPrice || 10),
          finalPrice: parseFloat(customPrices[card.id] || card.suggestedPrice || 10)
        };
      }
      return card;
    });
    
    onUpdate(updatedCards);
    onContinue();
  };

  const calculateTotalValue = () => {
    return cards
      .filter(c => selectedCards.has(c.id))
      .reduce((sum, card) => {
        const price = parseFloat(customPrices[card.id] || 0);
        return sum + (price * card.quantity);
      }, 0);
  };

  const calculateProfit = () => {
    const total = calculateTotalValue();
    const fees = total * 0.045; // 4.5% marketplace fee
    return total - fees;
  };

  return (
    <div className="space-y-6">
      {/* Pricing Strategy */}
      <div className="bg-white rounded-lg shadow-sm p-6">
        <h3 className="font-semibold mb-4 flex items-center gap-2">
          <Target size={20} />
          Pricing Strategy
        </h3>
        
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-4">
          {[
            { value: 'competitive', label: 'Competitive', desc: '5% below market' },
            { value: 'market', label: 'Market Rate', desc: 'Current market price' },
            { value: 'quick-sale', label: 'Quick Sale', desc: '15% below market' },
            { value: 'premium', label: 'Premium', desc: 'Quality pricing' },
            { value: 'undercut', label: 'Undercut', desc: 'Beat lowest price' },
            { value: 'custom', label: 'Custom', desc: 'Set manually' }
          ].map(strategy => (
            <button
              key={strategy.value}
              onClick={() => {
                setPricingStrategy(strategy.value);
                if (strategy.value !== 'custom') {
                  applyPricingStrategy();
                }
              }}
              className={`p-3 border rounded-lg text-left transition ${
                pricingStrategy === strategy.value
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-gray-200 hover:bg-gray-50'
              }`}
            >
              <div className="font-medium text-sm">{strategy.label}</div>
              <div className="text-xs text-gray-600">{strategy.desc}</div>
            </button>
          ))}
        </div>
        
        {/* Bulk Adjustment */}
        <div className="flex items-center gap-4 p-3 bg-gray-50 rounded-lg">
          <Percent size={18} className="text-gray-600" />
          <span className="text-sm font-medium">Bulk Adjustment:</span>
          <input
            type="range"
            min="-30"
            max="30"
            value={bulkAdjustment}
            onChange={(e) => setBulkAdjustment(parseInt(e.target.value))}
            className="flex-1"
          />
          <span className={`text-sm font-bold min-w-[60px] text-right ${
            bulkAdjustment > 0 ? 'text-green-600' : 
            bulkAdjustment < 0 ? 'text-red-600' : 'text-gray-600'
          }`}>
            {bulkAdjustment > 0 ? '+' : ''}{bulkAdjustment}%
          </span>
          <button
            onClick={applyPricingStrategy}
            className="px-3 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-700"
          >
            Apply
          </button>
        </div>
      </div>

      {/* Individual Card Pricing */}
      <div className="bg-white rounded-lg shadow-sm">
        <div className="p-4 border-b">
          <h3 className="font-semibold flex items-center gap-2">
            <DollarSign size={20} />
            Individual Pricing
          </h3>
        </div>
        
        <div className="max-h-96 overflow-y-auto">
          {cards.filter(c => selectedCards.has(c.id)).map(card => {
            const analysis = marketAnalysis[card.id];
            const currentPrice = parseFloat(customPrices[card.id] || 0);
            const marketPrice = parseFloat(card.marketPrice || card.suggestedPrice || 0);
            const priceDiff = ((currentPrice - marketPrice) / marketPrice * 100).toFixed(1);
            
            return (
              <div key={card.id} className="p-4 border-b hover:bg-gray-50">
                <div className="flex items-center gap-4">
                  {card.image_url && (
                    <img 
                      src={card.image_url} 
                      alt={card.name}
                      className="w-12 h-16 object-cover rounded"
                    />
                  )}
                  
                  <div className="flex-1">
                    <div className="font-medium">{card.name}</div>
                    <div className="text-sm text-gray-600">
                      {card.set_name} • {card.condition} • Qty: {card.quantity}
                      {card.finish === 'foil' && ' • Foil'}
                    </div>
                    
                    {analysis && (
                      <div className="flex items-center gap-4 mt-1 text-xs text-gray-500">
                        <span>Market: ${marketPrice.toFixed(2)}</span>
                        {analysis.activeListings > 0 && (
                          <span>{analysis.activeListings} competing listings</span>
                        )}
                        {analysis.priceRange && (
                          <span>Range: ${analysis.priceRange.min.toFixed(2)} - ${analysis.priceRange.max.toFixed(2)}</span>
                        )}
                      </div>
                    )}
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <div className="text-right mr-2">
                      <div className="text-xs text-gray-500">Your Price</div>
                      <div className="flex items-center gap-1">
                        <span className="text-lg font-bold">$</span>
                        <input
                          type="number"
                          step="0.01"
                          min="0.25"
                          value={customPrices[card.id] || ''}
                          onChange={(e) => updateCardPrice(card.id, e.target.value)}
                          className="w-20 px-2 py-1 border rounded text-lg font-bold text-center"
                        />
                      </div>
                      {priceDiff !== '0.0' && (
                        <div className={`text-xs flex items-center justify-end gap-1 mt-1 ${
                          priceDiff > 0 ? 'text-green-600' : 'text-red-600'
                        }`}>
                          {priceDiff > 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                          {priceDiff > 0 ? '+' : ''}{priceDiff}% vs market
                        </div>
                      )}
                    </div>
                    
                    <div className="text-right">
                      <div className="text-xs text-gray-500">Total</div>
                      <div className="text-lg font-bold text-green-600">
                        ${(currentPrice * card.quantity).toFixed(2)}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Summary */}
      <div className="bg-gradient-to-r from-blue-50 to-green-50 rounded-lg p-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
          <div>
            <div className="text-2xl font-bold text-blue-600">
              {cards.filter(c => selectedCards.has(c.id)).length}
            </div>
            <div className="text-sm text-gray-600">Unique Cards</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-purple-600">
              {cards.filter(c => selectedCards.has(c.id)).reduce((sum, c) => sum + c.quantity, 0)}
            </div>
            <div className="text-sm text-gray-600">Total Cards</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-orange-600">
              ${calculateTotalValue().toFixed(2)}
            </div>
            <div className="text-sm text-gray-600">Total Value</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-green-600">
              ${calculateProfit().toFixed(2)}
            </div>
            <div className="text-sm text-gray-600">Est. Profit (after fees)</div>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <div className="flex justify-between items-center">
        <button 
          onClick={onBack}
          className="px-6 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
        >
          Back
        </button>
        
        <button
          onClick={handleContinue}
          className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 font-semibold"
        >
          Review Listings
          <ChevronRight size={18} className="inline ml-1" />
        </button>
      </div>
    </div>
  );
}

export default PricingEngine;