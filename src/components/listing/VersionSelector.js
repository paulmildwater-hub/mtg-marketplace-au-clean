import React, { useState, useEffect, useRef } from 'react';
import { 
  Search, Check, X, Loader, ChevronDown, Filter, 
  Sparkles, Package, TrendingUp, Clock, Star,
  AlertCircle, Eye, Grid, List
} from 'lucide-react';

// Mock API URL for demo
const API_URL = 'http://localhost:5000/api';

// Price formatter
const formatPrice = (price) => {
  return new Intl.NumberFormat('en-AU', { 
    style: 'currency', 
    currency: 'AUD' 
  }).format(price || 0);
};

function ImprovedVersionSelector() {
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [selectedCard, setSelectedCard] = useState(null);
  const [versions, setVersions] = useState([]);
  const [loadingVersions, setLoadingVersions] = useState(false);
  const [selectedVersion, setSelectedVersion] = useState(null);
  const [quantity, setQuantity] = useState(1);
  const [condition, setCondition] = useState('NM');
  const [addedCards, setAddedCards] = useState([]);
  
  // View preferences
  const [viewMode, setViewMode] = useState('grid'); // 'grid' or 'list'
  const [groupBySet, setGroupBySet] = useState(false);
  const [filterTreatment, setFilterTreatment] = useState('all');
  const [sortBy, setSortBy] = useState('price-low');
  
  const searchInputRef = useRef(null);
  const searchTimeoutRef = useRef(null);

  // Auto-search as user types
  useEffect(() => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }
    
    if (searchTerm.length >= 2) {
      searchTimeoutRef.current = setTimeout(() => {
        searchCards(searchTerm);
      }, 300);
    } else {
      setSearchResults([]);
    }
    
    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [searchTerm]);

  const searchCards = async (query) => {
    setSearching(true);
    try {
      // Simulated search results for demo
      const mockResults = [
        { id: '1', name: 'Lightning Bolt', set_name: 'Double Masters 2022', imageUrl: 'https://cards.scryfall.io/normal/front/c/e/ce711943-c1a1-43a0-8b89-8d169cfb8e06.jpg' },
        { id: '2', name: 'Lightning Strike', set_name: 'Dominaria United', imageUrl: 'https://cards.scryfall.io/normal/front/1/1/11d0f04e-2bd0-4709-bbe3-fab7119e4f33.jpg' },
        { id: '3', name: 'Lightning Helix', set_name: 'Ravnica Remastered', imageUrl: 'https://cards.scryfall.io/normal/front/5/8/58f25737-7445-4554-a668-d9954c3d2031.jpg' }
      ].filter(card => card.name.toLowerCase().includes(query.toLowerCase()));
      
      setSearchResults(mockResults);
    } catch (error) {
      console.error('Search failed:', error);
    }
    setSearching(false);
  };

  const selectCard = async (card) => {
    setSelectedCard(card);
    setSearchResults([]);
    setSearchTerm(card.name);
    
    // Fetch versions
    setLoadingVersions(true);
    try {
      // Simulated versions for demo
      const mockVersions = generateMockVersions(card.name);
      setVersions(mockVersions);
      
      // Auto-select best value version
      const bestValue = mockVersions.find(v => v.inStock && v.condition === 'NM') || mockVersions[0];
      setSelectedVersion(bestValue);
    } catch (error) {
      console.error('Failed to fetch versions:', error);
    }
    setLoadingVersions(false);
  };

  // Generate mock versions for demo
  const generateMockVersions = (cardName) => {
    const sets = [
      { name: 'Double Masters 2022', code: '2X2', date: '2022-07-08' },
      { name: 'Commander Legends', code: 'CMR', date: '2020-11-20' },
      { name: 'Core Set 2021', code: 'M21', date: '2020-07-03' },
      { name: 'Mystery Booster', code: 'MB1', date: '2019-11-07' },
      { name: 'Ultimate Masters', code: 'UMA', date: '2018-12-07' }
    ];
    
    return sets.map((set, index) => ({
      id: `v${index}`,
      name: cardName,
      set: set.name,
      setCode: set.code,
      collector_number: Math.floor(Math.random() * 300) + 1,
      released_at: set.date,
      rarity: ['common', 'uncommon', 'rare', 'mythic'][Math.floor(Math.random() * 4)],
      imageUrl: `https://cards.scryfall.io/normal/front/${index}/${index}/${index}.jpg`,
      prices: {
        aud: (Math.random() * 50 + 5).toFixed(2),
        aud_foil: (Math.random() * 100 + 10).toFixed(2)
      },
      finishes: ['nonfoil', 'foil'],
      treatments: index === 0 ? ['showcase'] : index === 1 ? ['extended'] : [],
      inStock: Math.random() > 0.3,
      availableQuantity: Math.floor(Math.random() * 10) + 1,
      sellerCount: Math.floor(Math.random() * 5) + 1,
      conditions: ['NM', 'LP', 'MP'],
      lowestPrice: (Math.random() * 50 + 5).toFixed(2)
    }));
  };

  const addToList = () => {
    if (!selectedCard || !selectedVersion) return;
    
    const finish = selectedVersion.finishes.includes('foil') && condition === 'NM' ? 'foil' : 'nonfoil';
    const price = finish === 'foil' ? selectedVersion.prices.aud_foil : selectedVersion.prices.aud;
    
    const newCard = {
      id: `card-${Date.now()}`,
      card_name: selectedCard.name,
      set_name: selectedVersion.set,
      set_code: selectedVersion.setCode,
      collector_number: selectedVersion.collector_number,
      quantity: quantity,
      condition: condition,
      finish: finish,
      price: parseFloat(price),
      image_url: selectedVersion.imageUrl
    };
    
    setAddedCards(prev => [...prev, newCard]);
    
    // Reset form
    setSearchTerm('');
    setSelectedCard(null);
    setVersions([]);
    setSelectedVersion(null);
    setQuantity(1);
    setCondition('NM');
  };

  // Filter and sort versions
  const getDisplayVersions = () => {
    let filtered = [...versions];
    
    // Filter by treatment
    if (filterTreatment !== 'all') {
      filtered = filtered.filter(v => {
        if (filterTreatment === 'regular') return !v.treatments || v.treatments.length === 0;
        if (filterTreatment === 'special') return v.treatments && v.treatments.length > 0;
        return v.treatments && v.treatments.includes(filterTreatment);
      });
    }
    
    // Sort
    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'price-low':
          return parseFloat(a.lowestPrice) - parseFloat(b.lowestPrice);
        case 'price-high':
          return parseFloat(b.lowestPrice) - parseFloat(a.lowestPrice);
        case 'newest':
          return new Date(b.released_at) - new Date(a.released_at);
        case 'oldest':
          return new Date(a.released_at) - new Date(b.released_at);
        default:
          return 0;
      }
    });
    
    return filtered;
  };

  const displayVersions = getDisplayVersions();

  return (
    <div className="max-w-6xl mx-auto p-6">
      <div className="bg-white rounded-lg shadow-lg">
        {/* Header */}
        <div className="p-6 border-b">
          <h2 className="text-2xl font-bold mb-2">Quick Add Cards</h2>
          <p className="text-gray-600">Search for a card and select the exact version you're selling</p>
        </div>

        <div className="p-6">
          {/* Search Bar */}
          <div className="mb-6">
            <div className="relative">
              <Search className="absolute left-3 top-3 text-gray-400" size={20} />
              <input
                ref={searchInputRef}
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search for a card name..."
                className="w-full pl-10 pr-4 py-3 border-2 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-lg"
              />
              {searching && (
                <Loader className="absolute right-3 top-3 animate-spin text-gray-400" size={20} />
              )}
            </div>
            
            {/* Search Results Dropdown */}
            {searchResults.length > 0 && (
              <div className="absolute z-20 w-full max-w-2xl bg-white border-2 rounded-lg shadow-xl mt-2 max-h-96 overflow-y-auto">
                {searchResults.map(card => (
                  <button
                    key={card.id}
                    onClick={() => selectCard(card)}
                    className="w-full px-4 py-3 hover:bg-gray-50 flex items-center gap-4 text-left border-b last:border-b-0"
                  >
                    <img 
                      src={card.imageUrl} 
                      alt={card.name}
                      className="w-16 h-20 object-cover rounded"
                      onError={(e) => e.target.src = 'https://via.placeholder.com/64x89?text=MTG'}
                    />
                    <div className="flex-1">
                      <div className="font-semibold text-lg">{card.name}</div>
                      <div className="text-sm text-gray-600">{card.set_name}</div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Version Selection Area */}
          {selectedCard && (
            <div className="space-y-4">
              {/* Selected Card Info */}
              <div className="bg-blue-50 rounded-lg p-4 flex items-center gap-4">
                <div className="text-blue-600">
                  <Package size={24} />
                </div>
                <div className="flex-1">
                  <div className="font-semibold text-lg">{selectedCard.name}</div>
                  <div className="text-sm text-gray-600">Select version and condition below</div>
                </div>
              </div>

              {/* Filters and View Controls */}
              <div className="flex flex-wrap gap-4 items-center justify-between">
                <div className="flex gap-2">
                  {/* Treatment Filter */}
                  <select
                    value={filterTreatment}
                    onChange={(e) => setFilterTreatment(e.target.value)}
                    className="px-3 py-2 border rounded-lg text-sm"
                  >
                    <option value="all">All Treatments</option>
                    <option value="regular">Regular Only</option>
                    <option value="special">Special Treatments</option>
                    <option value="showcase">Showcase</option>
                    <option value="extended">Extended Art</option>
                  </select>

                  {/* Sort */}
                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value)}
                    className="px-3 py-2 border rounded-lg text-sm"
                  >
                    <option value="price-low">Price: Low to High</option>
                    <option value="price-high">Price: High to Low</option>
                    <option value="newest">Newest First</option>
                    <option value="oldest">Oldest First</option>
                  </select>
                </div>

                {/* View Toggle */}
                <div className="flex items-center gap-1 border rounded-lg">
                  <button
                    onClick={() => setViewMode('grid')}
                    className={`p-2 ${viewMode === 'grid' ? 'bg-blue-600 text-white' : 'text-gray-600 hover:bg-gray-100'}`}
                  >
                    <Grid size={18} />
                  </button>
                  <button
                    onClick={() => setViewMode('list')}
                    className={`p-2 ${viewMode === 'list' ? 'bg-blue-600 text-white' : 'text-gray-600 hover:bg-gray-100'}`}
                  >
                    <List size={18} />
                  </button>
                </div>
              </div>

              {/* Versions Display */}
              {loadingVersions ? (
                <div className="flex justify-center py-8">
                  <Loader className="animate-spin text-blue-600" size={32} />
                </div>
              ) : viewMode === 'grid' ? (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                  {displayVersions.map(version => (
                    <VersionCard
                      key={version.id}
                      version={version}
                      isSelected={selectedVersion?.id === version.id}
                      onSelect={() => setSelectedVersion(version)}
                      formatPrice={formatPrice}
                    />
                  ))}
                </div>
              ) : (
                <VersionList
                  versions={displayVersions}
                  selectedVersion={selectedVersion}
                  onSelect={setSelectedVersion}
                  formatPrice={formatPrice}
                />
              )}

              {/* Add Controls */}
              {selectedVersion && (
                <div className="bg-gray-50 rounded-lg p-4">
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
                    <div>
                      <label className="block text-sm font-medium mb-1">Condition</label>
                      <select
                        value={condition}
                        onChange={(e) => setCondition(e.target.value)}
                        className="w-full px-3 py-2 border rounded-lg"
                      >
                        <option value="NM">Near Mint (NM)</option>
                        <option value="LP">Lightly Played (LP)</option>
                        <option value="MP">Moderately Played (MP)</option>
                        <option value="HP">Heavily Played (HP)</option>
                      </select>
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium mb-1">Quantity</label>
                      <input
                        type="number"
                        min="1"
                        value={quantity}
                        onChange={(e) => setQuantity(parseInt(e.target.value) || 1)}
                        className="w-full px-3 py-2 border rounded-lg"
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium mb-1">Your Price</label>
                      <div className="relative">
                        <span className="absolute left-3 top-2.5 text-gray-500">$</span>
                        <input
                          type="number"
                          step="0.01"
                          defaultValue={selectedVersion.lowestPrice}
                          className="w-full pl-8 pr-3 py-2 border rounded-lg"
                        />
                      </div>
                    </div>
                    
                    <div className="flex items-end">
                      <button
                        onClick={addToList}
                        className="w-full px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 font-semibold"
                      >
                        Add to Listing
                      </button>
                    </div>
                  </div>
                  
                  {/* Market Info */}
                  <div className="flex items-center gap-4 text-sm text-gray-600">
                    <div className="flex items-center gap-1">
                      <TrendingUp size={16} />
                      Market: {formatPrice(selectedVersion.lowestPrice)}
                    </div>
                    {selectedVersion.inStock && (
                      <div className="flex items-center gap-1">
                        <Package size={16} />
                        {selectedVersion.availableQuantity} available
                      </div>
                    )}
                    <div className="flex items-center gap-1">
                      <Clock size={16} />
                      Est. sell time: 7-14 days
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Added Cards List */}
          {addedCards.length > 0 && (
            <div className="mt-6">
              <h3 className="font-semibold mb-3">Added Cards ({addedCards.length})</h3>
              <div className="space-y-2">
                {addedCards.map(card => (
                  <div key={card.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-center gap-3">
                      <img 
                        src={card.image_url} 
                        alt={card.card_name}
                        className="w-12 h-16 object-cover rounded"
                      />
                      <div>
                        <div className="font-medium">{card.card_name}</div>
                        <div className="text-sm text-gray-600">
                          {card.set_name} • {card.condition} • Qty: {card.quantity}
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-bold text-green-600">{formatPrice(card.price)}</div>
                      <button
                        onClick={() => setAddedCards(prev => prev.filter(c => c.id !== card.id))}
                        className="text-sm text-red-600 hover:text-red-800"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Version Card Component
function VersionCard({ version, isSelected, onSelect, formatPrice }) {
  return (
    <div
      onClick={onSelect}
      className={`border-2 rounded-lg p-3 cursor-pointer transition-all ${
        isSelected 
          ? 'border-blue-500 bg-blue-50 shadow-lg transform scale-105' 
          : 'border-gray-200 hover:border-gray-300 hover:shadow'
      } ${!version.inStock ? 'opacity-60' : ''}`}
    >
      {/* Stock Badge */}
      {version.inStock && (
        <div className="absolute -top-2 -right-2 bg-green-500 text-white text-xs px-2 py-1 rounded-full font-bold">
          In Stock
        </div>
      )}
      
      {/* Card Image */}
      <img 
        src={version.imageUrl} 
        alt={version.set}
        className="w-full rounded mb-2"
        onError={(e) => e.target.src = 'https://via.placeholder.com/200x280?text=MTG'}
      />
      
      {/* Set Info */}
      <div className="space-y-1">
        <div className="font-bold text-sm truncate">{version.set}</div>
        <div className="text-xs text-gray-600">#{version.collector_number}</div>
        
        {/* Treatments */}
        {version.treatments && version.treatments.length > 0 && (
          <div className="flex gap-1 flex-wrap">
            {version.treatments.map(treatment => (
              <span key={treatment} className="text-xs bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded">
                {treatment}
              </span>
            ))}
          </div>
        )}
        
        {/* Price */}
        <div className="pt-2 border-t">
          <div className="text-lg font-bold text-green-600">
            {formatPrice(version.lowestPrice)}
          </div>
          {version.prices.aud_foil && (
            <div className="text-xs text-gray-600 flex items-center gap-1">
              <Sparkles size={10} />
              Foil: {formatPrice(version.prices.aud_foil)}
            </div>
          )}
        </div>
        
        {/* Selected Indicator */}
        {isSelected && (
          <div className="flex justify-center mt-2">
            <Check className="text-blue-600" size={20} />
          </div>
        )}
      </div>
    </div>
  );
}

// Version List Component
function VersionList({ versions, selectedVersion, onSelect, formatPrice }) {
  return (
    <div className="border rounded-lg overflow-hidden">
      <table className="w-full">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-4 py-2 text-left text-sm font-medium">Version</th>
            <th className="px-4 py-2 text-left text-sm font-medium">Set</th>
            <th className="px-4 py-2 text-center text-sm font-medium">Stock</th>
            <th className="px-4 py-2 text-right text-sm font-medium">Price</th>
            <th className="px-4 py-2 text-center text-sm font-medium">Select</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {versions.map(version => (
            <tr 
              key={version.id}
              onClick={() => onSelect(version)}
              className={`hover:bg-gray-50 cursor-pointer ${
                selectedVersion?.id === version.id ? 'bg-blue-50' : ''
              }`}
            >
              <td className="px-4 py-2">
                <img 
                  src={version.imageUrl} 
                  alt={version.set}
                  className="w-12 h-16 object-cover rounded"
                />
              </td>
              <td className="px-4 py-2">
                <div className="font-medium">{version.set}</div>
                <div className="text-xs text-gray-600">#{version.collector_number}</div>
              </td>
              <td className="px-4 py-2 text-center">
                {version.inStock ? (
                  <span className="text-green-600 font-medium">
                    {version.availableQuantity}
                  </span>
                ) : (
                  <span className="text-gray-400">Out</span>
                )}
              </td>
              <td className="px-4 py-2 text-right">
                <div className="font-bold">{formatPrice(version.lowestPrice)}</div>
              </td>
              <td className="px-4 py-2 text-center">
                <input
                  type="radio"
                  checked={selectedVersion?.id === version.id}
                  onChange={() => {}}
                  className="w-4 h-4"
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default ImprovedVersionSelector;