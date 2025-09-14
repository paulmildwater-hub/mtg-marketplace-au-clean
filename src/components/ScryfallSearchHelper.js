// ScryfallSearchHelper.js - Advanced search query builder for Scryfall-like syntax
import React, { useState } from 'react';
import { Search, Plus, X, Info, ChevronDown, ChevronUp } from 'lucide-react';

// Mana Symbol Component with proper Scryfall URLs
const ManaSymbol = ({ symbol, size = 20 }) => {
  // Clean the symbol - remove curly braces if present
  const cleanSymbol = symbol.replace(/[{}]/g, '');
  
  return (
    <img 
      src={`https://svgs.scryfall.io/card-symbols/${cleanSymbol}.svg`}
      alt={cleanSymbol}
      width={size}
      height={size}
      className="inline-block mx-0.5"
      onError={(e) => {
        // Fallback to a styled span if image fails
        e.target.style.display = 'none';
        const span = document.createElement('span');
        span.className = 'inline-flex items-center justify-center rounded-full bg-gray-300 text-xs font-bold mx-0.5';
        span.style.width = `${size}px`;
        span.style.height = `${size}px`;
        span.textContent = cleanSymbol;
        e.target.parentElement.replaceChild(span, e.target);
      }}
    />
  );
};

// Parse mana cost string into symbols
const ManaCost = ({ cost, size = 20 }) => {
  if (!cost) return null;
  
  // Parse mana cost string like "{2}{U}{U}" or "2UU"
  let symbols = [];
  
  if (cost.includes('{')) {
    // Format: {2}{U}{U}
    symbols = cost.match(/{([^}]+)}/g)?.map(s => s.replace(/[{}]/g, '')) || [];
  } else {
    // Format: 2UU or WUBRG
    symbols = cost.match(/\d+|[WUBRGCXYZPST]/g) || [];
  }
  
  return (
    <div className="inline-flex items-center">
      {symbols.map((symbol, index) => (
        <ManaSymbol key={index} symbol={symbol} size={size} />
      ))}
    </div>
  );
};

// Advanced search helper component
const ScryfallSearchHelper = ({ onSearch, onClose }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [showHelp, setShowHelp] = useState(false);
  const [filters, setFilters] = useState({
    name: '',
    oracle: '',
    type: '',
    colors: [],
    colorIdentity: [],
    manaValue: '',
    power: '',
    toughness: '',
    loyalty: '',
    set: '',
    rarity: '',
    artist: '',
    format: '',
    legal: '',
    banned: '',
    restricted: ''
  });

  // Build Scryfall query from filters
  const buildQuery = () => {
    let queryParts = [];
    
    // Name
    if (filters.name) {
      queryParts.push(`"${filters.name}"`);
    }
    
    // Oracle text
    if (filters.oracle) {
      queryParts.push(`o:"${filters.oracle}"`);
    }
    
    // Type
    if (filters.type) {
      queryParts.push(`t:${filters.type}`);
    }
    
    // Colors
    if (filters.colors.length > 0) {
      if (filters.colorMode === 'exactly') {
        queryParts.push(`c=${filters.colors.join('')}`);
      } else if (filters.colorMode === 'including') {
        queryParts.push(`c>=${filters.colors.join('')}`);
      } else {
        queryParts.push(`c:${filters.colors.join('')}`);
      }
    }
    
    // Color Identity
    if (filters.colorIdentity.length > 0) {
      queryParts.push(`id:${filters.colorIdentity.join('')}`);
    }
    
    // Mana Value (CMC)
    if (filters.manaValue) {
      queryParts.push(`mv${filters.manaValue}`);
    }
    
    // Power
    if (filters.power) {
      queryParts.push(`pow${filters.power}`);
    }
    
    // Toughness
    if (filters.toughness) {
      queryParts.push(`tou${filters.toughness}`);
    }
    
    // Set
    if (filters.set) {
      queryParts.push(`s:${filters.set}`);
    }
    
    // Rarity
    if (filters.rarity) {
      queryParts.push(`r:${filters.rarity}`);
    }
    
    // Artist
    if (filters.artist) {
      queryParts.push(`a:"${filters.artist}"`);
    }
    
    // Format legality
    if (filters.format && filters.legal) {
      queryParts.push(`f:${filters.format}`);
    }
    
    return queryParts.join(' ');
  };

  const handleColorToggle = (color, type = 'colors') => {
    setFilters(prev => ({
      ...prev,
      [type]: prev[type].includes(color) 
        ? prev[type].filter(c => c !== color)
        : [...prev[type], color]
    }));
  };

  const handleSearch = () => {
    const query = searchQuery || buildQuery();
    if (query) {
      onSearch(query);
      onClose();
    }
  };

  const searchExamples = [
    { query: 't:creature cmc<=2', desc: 'Creatures with mana value 2 or less' },
    { query: 'c:wu t:instant', desc: 'White or blue instants' },
    { query: 'o:"draw a card" cmc<3', desc: 'Cards that draw with CMC < 3' },
    { query: 't:legendary t:creature c>=ubg', desc: 'Legendary creatures with Sultai colors' },
    { query: 'a:"Rebecca Guay"', desc: 'Cards illustrated by Rebecca Guay' },
    { query: 'f:standard r:mythic', desc: 'Standard-legal mythic rares' },
    { query: 'o:deathtouch o:lifelink', desc: 'Cards with deathtouch AND lifelink' },
    { query: 'pow>=7 tou>=7', desc: 'Big creatures (7/7 or larger)' }
  ];

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b sticky top-0 bg-white z-10">
          <div className="flex justify-between items-center">
            <h2 className="text-2xl font-bold">Advanced Card Search</h2>
            <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded">
              <X size={24} />
            </button>
          </div>
        </div>

        <div className="p-6">
          {/* Direct Query Input */}
          <div className="mb-6">
            <label className="block text-sm font-medium mb-2">
              Scryfall Query (Advanced)
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                placeholder='e.g., t:creature c:rg cmc<=3 o:"when ~ enters"'
                className="flex-1 px-3 py-2 border rounded-lg"
              />
              <button
                onClick={() => setShowHelp(!showHelp)}
                className="px-3 py-2 border rounded-lg hover:bg-gray-50"
              >
                <Info size={20} />
              </button>
            </div>
          </div>

          {/* Query Examples */}
          {showHelp && (
            <div className="mb-6 p-4 bg-blue-50 rounded-lg">
              <h3 className="font-semibold mb-3">Search Examples</h3>
              <div className="grid md:grid-cols-2 gap-2 text-sm">
                {searchExamples.map((example, i) => (
                  <div 
                    key={i}
                    className="p-2 bg-white rounded cursor-pointer hover:bg-gray-50"
                    onClick={() => setSearchQuery(example.query)}
                  >
                    <code className="text-xs text-blue-600">{example.query}</code>
                    <div className="text-gray-600 text-xs mt-1">{example.desc}</div>
                  </div>
                ))}
              </div>
              
              <div className="mt-4 text-xs text-gray-600">
                <h4 className="font-semibold mb-2">Common Operators:</h4>
                <div className="grid grid-cols-2 gap-1">
                  <div>• <code>t:</code> type (creature, instant, etc.)</div>
                  <div>• <code>c:</code> colors (w, u, b, r, g)</div>
                  <div>• <code>o:</code> oracle text contains</div>
                  <div>• <code>mv:</code> mana value {'(=, <, >, <=, >=)'}</div>
                  <div>• <code>pow:</code> power</div>
                  <div>• <code>tou:</code> toughness</div>
                  <div>• <code>r:</code> rarity (c, u, r, m)</div>
                  <div>• <code>s:</code> set code</div>
                  <div>• <code>a:</code> artist name</div>
                  <div>• <code>f:</code> format legal in</div>
                </div>
              </div>
            </div>
          )}

          {/* Visual Filter Builder */}
          <div className="space-y-4">
            <h3 className="font-semibold">Or Build Your Query:</h3>
            
            {/* Card Name */}
            <div>
              <label className="block text-sm font-medium mb-1">Card Name Contains</label>
              <input
                type="text"
                value={filters.name}
                onChange={(e) => setFilters({...filters, name: e.target.value})}
                placeholder="e.g., Lightning"
                className="w-full px-3 py-2 border rounded-lg"
              />
            </div>

            {/* Oracle Text */}
            <div>
              <label className="block text-sm font-medium mb-1">Oracle Text Contains</label>
              <input
                type="text"
                value={filters.oracle}
                onChange={(e) => setFilters({...filters, oracle: e.target.value})}
                placeholder='e.g., "draw a card"'
                className="w-full px-3 py-2 border rounded-lg"
              />
            </div>

            {/* Type Line */}
            <div>
              <label className="block text-sm font-medium mb-1">Type</label>
              <input
                type="text"
                value={filters.type}
                onChange={(e) => setFilters({...filters, type: e.target.value})}
                placeholder="e.g., creature, legendary, artifact"
                className="w-full px-3 py-2 border rounded-lg"
              />
            </div>

            {/* Colors */}
            <div>
              <label className="block text-sm font-medium mb-1">Colors</label>
              <div className="flex items-center gap-4">
                <div className="flex gap-2">
                  {['W', 'U', 'B', 'R', 'G'].map(color => (
                    <button
                      key={color}
                      onClick={() => handleColorToggle(color)}
                      className={`p-2 rounded border-2 transition ${
                        filters.colors.includes(color) 
                          ? 'border-blue-500 bg-blue-50' 
                          : 'border-gray-300 hover:bg-gray-50'
                      }`}
                    >
                      <ManaSymbol symbol={color} size={24} />
                    </button>
                  ))}
                  <button
                    onClick={() => handleColorToggle('C')}
                    className={`p-2 rounded border-2 transition ${
                      filters.colors.includes('C') 
                        ? 'border-blue-500 bg-blue-50' 
                        : 'border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    <ManaSymbol symbol="C" size={24} />
                  </button>
                </div>
                
                <select 
                  value={filters.colorMode || 'any'}
                  onChange={(e) => setFilters({...filters, colorMode: e.target.value})}
                  className="px-2 py-1 border rounded text-sm"
                >
                  <option value="any">Any of these</option>
                  <option value="exactly">Exactly these</option>
                  <option value="including">At least these</option>
                </select>
              </div>
            </div>

            {/* Mana Value */}
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Mana Value</label>
                <input
                  type="text"
                  value={filters.manaValue}
                  onChange={(e) => setFilters({...filters, manaValue: e.target.value})}
                  placeholder="e.g., =3, <4, >=2"
                  className="w-full px-3 py-2 border rounded-lg"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-1">Power</label>
                <input
                  type="text"
                  value={filters.power}
                  onChange={(e) => setFilters({...filters, power: e.target.value})}
                  placeholder="e.g., >=4"
                  className="w-full px-3 py-2 border rounded-lg"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-1">Toughness</label>
                <input
                  type="text"
                  value={filters.toughness}
                  onChange={(e) => setFilters({...filters, toughness: e.target.value})}
                  placeholder="e.g., >3"
                  className="w-full px-3 py-2 border rounded-lg"
                />
              </div>
            </div>

            {/* Set and Rarity */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Set</label>
                <input
                  type="text"
                  value={filters.set}
                  onChange={(e) => setFilters({...filters, set: e.target.value})}
                  placeholder="e.g., NEO, DMU"
                  className="w-full px-3 py-2 border rounded-lg"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-1">Rarity</label>
                <select 
                  value={filters.rarity}
                  onChange={(e) => setFilters({...filters, rarity: e.target.value})}
                  className="w-full px-3 py-2 border rounded-lg"
                >
                  <option value="">Any Rarity</option>
                  <option value="c">Common</option>
                  <option value="u">Uncommon</option>
                  <option value="r">Rare</option>
                  <option value="m">Mythic Rare</option>
                </select>
              </div>
            </div>
          </div>

          {/* Search Buttons */}
          <div className="flex gap-2 mt-6">
            <button
              onClick={handleSearch}
              className="flex-1 px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-semibold"
            >
              <Search className="inline mr-2" size={20} />
              Search Cards
            </button>
            <button
              onClick={() => {
                setSearchQuery('');
                setFilters({
                  name: '',
                  oracle: '',
                  type: '',
                  colors: [],
                  colorIdentity: [],
                  manaValue: '',
                  power: '',
                  toughness: '',
                  loyalty: '',
                  set: '',
                  rarity: '',
                  artist: '',
                  format: '',
                  legal: '',
                  banned: '',
                  restricted: ''
                });
              }}
              className="px-4 py-3 border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              Clear
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ScryfallSearchHelper;
export { ManaCost, ManaSymbol };