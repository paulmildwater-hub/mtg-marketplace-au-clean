import React, { useState, useEffect } from 'react';
import { 
  Search, 
  X, 
  ChevronDown,
  ChevronUp,
  Package,
  Filter
} from 'lucide-react';

// Mana Symbol Component
const ManaSymbol = ({ symbol, size = 20 }) => {
  const cleanSymbol = symbol.replace(/[{}]/g, '').toUpperCase();
  
  return (
    <img 
      src={`https://svgs.scryfall.io/card-symbols/${cleanSymbol}.svg`}
      alt={cleanSymbol}
      width={size}
      height={size}
      className="inline-block"
      onError={(e) => {
        e.target.style.display = 'none';
        const span = document.createElement('span');
        span.className = 'inline-flex items-center justify-center rounded-full bg-gray-300 text-xs font-bold';
        span.style.width = `${size}px`;
        span.style.height = `${size}px`;
        span.textContent = cleanSymbol;
        e.target.parentElement.replaceChild(span, e.target);
      }}
    />
  );
};

const EnhancedSearchBar = ({ 
  onSearch, 
  onSortChange, 
  onFilterChange,
  totalResults = 0,
  isLoading = false,
  apiUrl = 'http://localhost:5000/api'
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState('relevance');
  const [showFilters, setShowFilters] = useState(false);
  
  const [filters, setFilters] = useState({
    inStockOnly: false,
    priceMin: '',
    priceMax: '',
    conditions: [],
    name: '',
    oracle: '',
    type: '',
    set: '',
    artist: '',
    colors: [],
    colorMode: ':',
    manaValue: '',
    manaValueOp: '=',
    power: '',
    powerOp: '=',
    toughness: '',
    toughnessOp: '=',
    rarity: []
  });

  const buildQuery = () => {
    let queryParts = [];
    
    if (searchTerm) {
      queryParts.push(searchTerm);
    }
    
    if (filters.name) {
      queryParts.push(`"${filters.name}"`);
    }
    
    if (filters.oracle) {
      queryParts.push(`o:"${filters.oracle}"`);
    }
    
    if (filters.type) {
      filters.type.split(' ').forEach(type => {
        if (type) queryParts.push(`t:${type}`);
      });
    }
    
    if (filters.colors.length > 0) {
      const colorString = filters.colors.join('');
      queryParts.push(`c${filters.colorMode}${colorString}`);
    }
    
    if (filters.manaValue) {
      queryParts.push(`cmc${filters.manaValueOp}${filters.manaValue}`);
    }
    
    if (filters.power) {
      queryParts.push(`pow${filters.powerOp}${filters.power}`);
    }
    
    if (filters.toughness) {
      queryParts.push(`tou${filters.toughnessOp}${filters.toughness}`);
    }
    
    if (filters.set) {
      queryParts.push(`s:${filters.set}`);
    }
    
    filters.rarity.forEach(r => {
      const rarityMap = {
        'common': 'c',
        'uncommon': 'u',
        'rare': 'r',
        'mythic': 'm'
      };
      queryParts.push(`r:${rarityMap[r] || r}`);
    });
    
    if (filters.artist) {
      queryParts.push(`a:"${filters.artist}"`);
    }
    
    return queryParts.join(' ');
  };

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      const query = buildQuery();
      const finalQuery = query || searchTerm;
      
      if (finalQuery || searchTerm === '') {
        onSearch(finalQuery, sortBy, {
          ...filters,
          query: finalQuery,
          searchTerm: searchTerm
        });
      }
    }, 300);
    
    return () => clearTimeout(timeoutId);
  }, [searchTerm, filters, sortBy]);

  const handleSortChange = (newSort) => {
    setSortBy(newSort);
    onSortChange(newSort);
  };

  const handleFilterChange = (filterType, value) => {
    const newFilters = { ...filters };
    
    if (filterType === 'conditions' || filterType === 'rarity') {
      if (newFilters[filterType].includes(value)) {
        newFilters[filterType] = newFilters[filterType].filter(v => v !== value);
      } else {
        newFilters[filterType] = [...newFilters[filterType], value];
      }
    } else if (filterType === 'colors') {
      if (newFilters.colors.includes(value)) {
        newFilters.colors = newFilters.colors.filter(v => v !== value);
      } else {
        newFilters.colors = [...newFilters.colors, value];
      }
    } else {
      newFilters[filterType] = value;
    }
    
    setFilters(newFilters);
    onFilterChange(newFilters);
  };

  const clearFilters = () => {
    const clearedFilters = {
      inStockOnly: false,
      priceMin: '',
      priceMax: '',
      conditions: [],
      name: '',
      oracle: '',
      type: '',
      set: '',
      artist: '',
      colors: [],
      colorMode: ':',
      manaValue: '',
      manaValueOp: '=',
      power: '',
      powerOp: '=',
      toughness: '',
      toughnessOp: '=',
      rarity: []
    };
    setFilters(clearedFilters);
    setSearchTerm('');
    onFilterChange(clearedFilters);
  };

  const activeFilterCount = () => {
    let count = 0;
    if (filters.inStockOnly) count++;
    if (filters.priceMin || filters.priceMax) count++;
    if (filters.conditions.length) count++;
    if (filters.rarity.length) count++;
    if (filters.colors.length) count++;
    if (filters.name) count++;
    if (filters.oracle) count++;
    if (filters.type) count++;
    if (filters.set) count++;
    if (filters.manaValue) count++;
    if (filters.power || filters.toughness) count++;
    return count;
  };

  return (
    <div className="bg-white shadow-sm">
      {/* Main Search Bar */}
      <div className="max-w-7xl mx-auto px-4 py-4">
        <div className="flex items-center gap-3">
          {/* Search Input */}
          <div className="flex-1 relative">
            <Search size={20} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder='Search cards... (e.g., "Lightning Bolt" or t:creature c:rg)'
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-10 py-3 border-2 border-gray-200 rounded-lg focus:border-blue-500 focus:outline-none text-lg"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                <X size={20} />
              </button>
            )}
          </div>

          {/* Sort Dropdown */}
          <select
            value={sortBy}
            onChange={(e) => handleSortChange(e.target.value)}
            className="px-4 py-3 border-2 border-gray-200 rounded-lg hover:bg-gray-50 min-w-[180px] cursor-pointer"
          >
            <option value="relevance">Best Match</option>
            <option value="stock">In Stock First</option>
            <option value="price-low">Price: Low to High</option>
            <option value="price-high">Price: High to Low</option>
            <option value="name">Alphabetical</option>
            <option value="newest">Newest First</option>
            <option value="popular">Most Popular</option>
          </select>

          {/* Filter Toggle Button */}
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`flex items-center gap-2 px-4 py-3 border-2 rounded-lg transition ${
              showFilters || activeFilterCount() > 0 
                ? 'border-blue-500 bg-blue-50' 
                : 'border-gray-200 hover:bg-gray-50'
            }`}
          >
            <Filter size={18} />
            <span className="font-medium">Filters</span>
            {activeFilterCount() > 0 && (
              <span className="bg-blue-600 text-white text-xs px-2 py-0.5 rounded-full">
                {activeFilterCount()}
              </span>
            )}
            {showFilters ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>
        </div>

        {/* Results count and status */}
        <div className="flex justify-between items-center mt-3">
          <div className="text-sm text-gray-600">
            {isLoading ? (
              <span className="flex items-center gap-2">
                <div className="w-4 h-4 border-2 border-gray-300 border-t-blue-500 rounded-full animate-spin"></div>
                Searching the multiverse...
              </span>
            ) : searchTerm || activeFilterCount() > 0 ? (
              <span>{totalResults} results {searchTerm && `for "${searchTerm}"`}</span>
            ) : (
              <span>Popular Commander Cards</span>
            )}
          </div>
        </div>
      </div>

      {/* Expanded Filters Section - Now inline as part of the page */}
      {showFilters && (
        <div className="border-t bg-gray-50">
          <div className="max-w-7xl mx-auto px-4 py-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-semibold text-lg">Advanced Filters</h3>
              <button
                onClick={clearFilters}
                className="text-sm text-blue-600 hover:text-blue-800 font-medium"
              >
                Clear All Filters
              </button>
            </div>

            <div className="grid md:grid-cols-3 lg:grid-cols-4 gap-6">
              {/* Quick Filters */}
              <div className="bg-white p-4 rounded-lg">
                <h4 className="font-medium text-sm mb-3">Quick Filters</h4>
                <label className="flex items-center cursor-pointer hover:bg-gray-50 p-2 rounded">
                  <input
                    type="checkbox"
                    checked={filters.inStockOnly}
                    onChange={(e) => handleFilterChange('inStockOnly', e.target.checked)}
                    className="mr-3"
                  />
                  <Package size={16} className="mr-2 text-green-600" />
                  <span className="text-sm">In Stock Only</span>
                </label>
              </div>

              {/* Price Range */}
              <div className="bg-white p-4 rounded-lg">
                <h4 className="font-medium text-sm mb-3">Price Range (AUD)</h4>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    placeholder="Min"
                    value={filters.priceMin}
                    onChange={(e) => handleFilterChange('priceMin', e.target.value)}
                    className="w-24 px-2 py-1 text-sm border rounded"
                  />
                  <span className="text-gray-500">-</span>
                  <input
                    type="number"
                    placeholder="Max"
                    value={filters.priceMax}
                    onChange={(e) => handleFilterChange('priceMax', e.target.value)}
                    className="w-24 px-2 py-1 text-sm border rounded"
                  />
                </div>
              </div>

              {/* Colors */}
              <div className="bg-white p-4 rounded-lg">
                <h4 className="font-medium text-sm mb-3">Colors</h4>
                <div className="flex items-center gap-1 mb-2">
                  {['W', 'U', 'B', 'R', 'G'].map(color => (
                    <button
                      key={color}
                      onClick={() => handleFilterChange('colors', color)}
                      className={`p-1.5 rounded border-2 transition ${
                        filters.colors.includes(color) 
                          ? 'border-blue-500 bg-blue-50' 
                          : 'border-gray-200 hover:bg-gray-50'
                      }`}
                      title={
                        color === 'W' ? 'White' :
                        color === 'U' ? 'Blue' :
                        color === 'B' ? 'Black' :
                        color === 'R' ? 'Red' :
                        'Green'
                      }
                    >
                      <ManaSymbol symbol={color} size={20} />
                    </button>
                  ))}
                  <button
                    onClick={() => handleFilterChange('colors', 'C')}
                    className={`p-1.5 rounded border-2 transition ${
                      filters.colors.includes('C') 
                        ? 'border-blue-500 bg-blue-50' 
                        : 'border-gray-200 hover:bg-gray-50'
                    }`}
                    title="Colorless"
                  >
                    <ManaSymbol symbol="C" size={20} />
                  </button>
                </div>
                <select 
                  value={filters.colorMode}
                  onChange={(e) => handleFilterChange('colorMode', e.target.value)}
                  className="w-full px-2 py-1 text-sm border rounded"
                >
                  <option value=":">Any of these</option>
                  <option value="=">Exactly these</option>
                  <option value=">=">At least these</option>
                </select>
              </div>

              {/* Rarity */}
              <div className="bg-white p-4 rounded-lg">
                <h4 className="font-medium text-sm mb-3">Rarity</h4>
                <div className="space-y-1">
                  {['common', 'uncommon', 'rare', 'mythic'].map(rarity => (
                    <label key={rarity} className="flex items-center text-sm cursor-pointer hover:bg-gray-50 p-1 rounded">
                      <input
                        type="checkbox"
                        checked={filters.rarity.includes(rarity)}
                        onChange={() => handleFilterChange('rarity', rarity)}
                        className="mr-2"
                      />
                      <span className="capitalize">{rarity}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Card Type */}
              <div className="bg-white p-4 rounded-lg">
                <h4 className="font-medium text-sm mb-3">Card Type</h4>
                <input
                  type="text"
                  value={filters.type}
                  onChange={(e) => handleFilterChange('type', e.target.value)}
                  placeholder="e.g., creature artifact"
                  className="w-full px-2 py-1 text-sm border rounded"
                />
              </div>

              {/* Oracle Text */}
              <div className="bg-white p-4 rounded-lg">
                <h4 className="font-medium text-sm mb-3">Oracle Text</h4>
                <input
                  type="text"
                  value={filters.oracle}
                  onChange={(e) => handleFilterChange('oracle', e.target.value)}
                  placeholder='e.g., "draw a card"'
                  className="w-full px-2 py-1 text-sm border rounded"
                />
              </div>

              {/* Set */}
              <div className="bg-white p-4 rounded-lg">
                <h4 className="font-medium text-sm mb-3">Set Code</h4>
                <input
                  type="text"
                  value={filters.set}
                  onChange={(e) => handleFilterChange('set', e.target.value.toUpperCase())}
                  placeholder="e.g., NEO, DMU"
                  className="w-full px-2 py-1 text-sm border rounded uppercase"
                />
              </div>

              {/* Mana Value */}
              <div className="bg-white p-4 rounded-lg">
                <h4 className="font-medium text-sm mb-3">Mana Value</h4>
                <div className="flex gap-1">
                  <select 
                    value={filters.manaValueOp}
                    onChange={(e) => handleFilterChange('manaValueOp', e.target.value)}
                    className="px-1 py-1 text-sm border rounded"
                  >
                    <option value="=">=</option>
                    <option value="<">&lt;</option>
                    <option value=">">&gt;</option>
                    <option value="<=">&le;</option>
                    <option value=">=">&ge;</option>
                  </select>
                  <input
                    type="number"
                    value={filters.manaValue}
                    onChange={(e) => handleFilterChange('manaValue', e.target.value)}
                    placeholder="3"
                    className="w-16 px-2 py-1 text-sm border rounded"
                  />
                </div>
              </div>

              {/* Power */}
              <div className="bg-white p-4 rounded-lg">
                <h4 className="font-medium text-sm mb-3">Power</h4>
                <div className="flex gap-1">
                  <select 
                    value={filters.powerOp}
                    onChange={(e) => handleFilterChange('powerOp', e.target.value)}
                    className="px-1 py-1 text-sm border rounded"
                  >
                    <option value="=">=</option>
                    <option value="<">&lt;</option>
                    <option value=">">&gt;</option>
                    <option value="<=">&le;</option>
                    <option value=">=">&ge;</option>
                  </select>
                  <input
                    type="number"
                    value={filters.power}
                    onChange={(e) => handleFilterChange('power', e.target.value)}
                    placeholder="2"
                    className="w-16 px-2 py-1 text-sm border rounded"
                  />
                </div>
              </div>

              {/* Toughness */}
              <div className="bg-white p-4 rounded-lg">
                <h4 className="font-medium text-sm mb-3">Toughness</h4>
                <div className="flex gap-1">
                  <select 
                    value={filters.toughnessOp}
                    onChange={(e) => handleFilterChange('toughnessOp', e.target.value)}
                    className="px-1 py-1 text-sm border rounded"
                  >
                    <option value="=">=</option>
                    <option value="<">&lt;</option>
                    <option value=">">&gt;</option>
                    <option value="<=">&le;</option>
                    <option value=">=">&ge;</option>
                  </select>
                  <input
                    type="number"
                    value={filters.toughness}
                    onChange={(e) => handleFilterChange('toughness', e.target.value)}
                    placeholder="3"
                    className="w-16 px-2 py-1 text-sm border rounded"
                  />
                </div>
              </div>

              {/* Conditions */}
              <div className="bg-white p-4 rounded-lg">
                <h4 className="font-medium text-sm mb-3">Card Condition</h4>
                <div className="space-y-1">
                  {['NM', 'LP', 'MP', 'HP'].map(condition => (
                    <label key={condition} className="flex items-center text-sm cursor-pointer hover:bg-gray-50 p-1 rounded">
                      <input
                        type="checkbox"
                        checked={filters.conditions.includes(condition)}
                        onChange={() => handleFilterChange('conditions', condition)}
                        className="mr-2"
                      />
                      <span>
                        {condition === 'NM' ? 'Near Mint' : 
                         condition === 'LP' ? 'Lightly Played' :
                         condition === 'MP' ? 'Moderately Played' :
                         'Heavily Played'}
                      </span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default EnhancedSearchBar;