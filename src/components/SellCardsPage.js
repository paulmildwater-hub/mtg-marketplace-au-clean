import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  Upload, Camera, Wand2, Search, Plus, Minus, X, Check,
  AlertCircle, Package, DollarSign, TrendingUp, Eye,
  Sparkles, Shield, Zap, Info, ChevronRight, Loader,
  BarChart, Settings, Save, RefreshCw, FileText, Copy,
  ChevronDown, ChevronUp, Grid, List, FileUp, Image,
  Filter, Clock, Star, Database, Download
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import PricingEngine from './listing/PricingEngine';
import ListingReview from './listing/ListingReview';
import CardHoverPreview from './CardHoverPreview';
import Papa from 'papaparse';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

function SellCardsPage({ onBack }) {
  const { user } = useAuth();
  const [step, setStep] = useState(1);
  const [cards, setCards] = useState([]);
  const [selectedCards, setSelectedCards] = useState(new Set());
  const [loading, setLoading] = useState(false);
  const [notification, setNotification] = useState(null);
  const fileInputRef = useRef(null);
  const csvInputRef = useRef(null);
  
  // Upload method state
  const [uploadMethod, setUploadMethod] = useState('quick');
  
  // Stats
  const [stats, setStats] = useState({
    totalCards: 0,
    uniqueCards: 0,
    estimatedValue: 0,
    estimatedProfit: 0,
    avgTimeToSell: 14
  });

  // Calculate stats whenever cards change
  useEffect(() => {
    const selected = cards.filter(c => selectedCards.has(c.id));
    const totalValue = selected.reduce((sum, card) => 
      sum + (card.suggestedPrice || 0) * card.quantity, 0
    );
    const commission = totalValue * 0.045;
    
    setStats({
      totalCards: selected.reduce((sum, c) => sum + c.quantity, 0),
      uniqueCards: selected.length,
      estimatedValue: totalValue,
      estimatedProfit: totalValue - commission,
      avgTimeToSell: calculateAvgTimeToSell(selected)
    });
  }, [cards, selectedCards]);

  const calculateAvgTimeToSell = (cards) => {
    const avgPrice = cards.reduce((sum, c) => sum + (c.suggestedPrice || 0), 0) / cards.length;
    if (avgPrice < 10) return 7;
    if (avgPrice < 50) return 14;
    if (avgPrice < 100) return 21;
    return 28;
  };

  // ========== IMPROVED QUICK ADD METHOD WITH LIST VIEW DEFAULT ==========
  const QuickAddCard = () => {
    const [searchTerm, setSearchTerm] = useState('');
    const [searchResults, setSearchResults] = useState([]);
    const [searching, setSearching] = useState(false);
    const [selectedCard, setSelectedCard] = useState(null);
    const [versions, setVersions] = useState([]);
    const [loadingVersions, setLoadingVersions] = useState(false);
    const [selectedVersion, setSelectedVersion] = useState(null);
    const [quantity, setQuantity] = useState(1);
    const [condition, setCondition] = useState('NM');
    const [userPrice, setUserPrice] = useState('');
    const [finish, setFinish] = useState('nonfoil');
    
    // View and filter states - DEFAULT TO LIST VIEW
    const [viewMode, setViewMode] = useState('list'); // Changed from 'grid' to 'list'
    const [filterTreatment, setFilterTreatment] = useState('all');
    const [sortBy, setSortBy] = useState('best-value');
    const [showOnlyInStock, setShowOnlyInStock] = useState(false);
    
    // Refs for better UX
    const searchTimeoutRef = useRef(null);
    const searchInputRef = useRef(null);
    
    // Auto-search with debounce
    useEffect(() => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
      
      if (searchTerm.length >= 2 && !selectedCard) {
        searchTimeoutRef.current = setTimeout(() => {
          searchCards(searchTerm);
        }, 300);
      } else if (searchTerm.length === 0) {
        setSearchResults([]);
      }
      
      return () => {
        if (searchTimeoutRef.current) {
          clearTimeout(searchTimeoutRef.current);
        }
      };
    }, [searchTerm, selectedCard]);
    
    const searchCards = async (query) => {
      setSearching(true);
      try {
        const response = await fetch(`${API_URL}/cards/search?q=${encodeURIComponent(query)}&limit=8`);
        const data = await response.json();
        setSearchResults(data.cards || []);
      } catch (error) {
        console.error('Search failed:', error);
        setSearchResults([]);
      }
      setSearching(false);
    };
    
    const selectCard = async (card) => {
      setSelectedCard(card);
      setSearchResults([]);
      setSearchTerm(card.name);
      
      // Fetch versions with enhanced data
      setLoadingVersions(true);
      try {
        const response = await fetch(`${API_URL}/cards/${encodeURIComponent(card.name)}/versions?includeImages=true`);
        const data = await response.json();
        
        if (data.versions && data.versions.length > 0) {
          // Check local inventory for each version
          const enhancedVersions = await Promise.all(data.versions.map(async (version) => {
            try {
              const inventoryResponse = await fetch(
                `${API_URL}/listings?card_name=${encodeURIComponent(card.name)}&set_code=${version.setCode}&status=active`
              );
              const inventoryData = await inventoryResponse.json();
              
              const hasLocalStock = inventoryData.listings && inventoryData.listings.length > 0;
              const lowestLocalPrice = hasLocalStock 
                ? Math.min(...inventoryData.listings.map(l => l.price))
                : null;
              
              // Calculate market price and suggested price
              const marketPrice = version.prices?.aud || (version.prices?.usd * 1.55) || 0;
              const suggestedPrice = lowestLocalPrice 
                ? lowestLocalPrice * 0.95 // Undercut local competition by 5%
                : marketPrice;
              
              // Detect special treatments
              const treatments = [];
              if (version.promo) treatments.push('promo');
              if (version.fullArt) treatments.push('full-art');
              if (version.showcase) treatments.push('showcase');
              if (version.extendedArt) treatments.push('extended');
              if (version.borderless) treatments.push('borderless');
              if (version.frame_effects?.includes('etched')) treatments.push('etched');
              
              return {
                ...version,
                inStock: hasLocalStock,
                localInventoryCount: inventoryData.listings ? inventoryData.listings.length : 0,
                lowestLocalPrice: lowestLocalPrice,
                marketPrice: marketPrice,
                suggestedPrice: suggestedPrice,
                treatments: treatments,
                score: calculateVersionScore(version, hasLocalStock, marketPrice)
              };
            } catch (error) {
              console.error('Error enhancing version:', error);
              return {
                ...version,
                inStock: false,
                marketPrice: version.prices?.aud || 0,
                suggestedPrice: version.prices?.aud || 0,
                treatments: [],
                score: 0
              };
            }
          }));
          
          setVersions(enhancedVersions);
          
          // Auto-select best version
          const bestVersion = enhancedVersions.sort((a, b) => b.score - a.score)[0];
          if (bestVersion) {
            setSelectedVersion(bestVersion);
            setUserPrice(bestVersion.suggestedPrice?.toFixed(2) || '');
          }
        }
      } catch (error) {
        console.error('Failed to fetch versions:', error);
        setVersions([]);
      }
      setLoadingVersions(false);
    };
    
    const calculateVersionScore = (version, hasStock, price) => {
      let score = 0;
      
      // Prioritize in-stock items
      if (hasStock) score += 100;
      
      // Newer releases score higher
      const releaseDate = new Date(version.released_at);
      const monthsOld = (Date.now() - releaseDate) / (1000 * 60 * 60 * 24 * 30);
      score += Math.max(0, 50 - monthsOld);
      
      // Price factor (lower is better for competition)
      if (price > 0 && price < 100) score += 20;
      
      // Special treatments add value
      if (version.promo) score += 10;
      if (version.showcase || version.extendedArt || version.borderless) score += 15;
      
      return score;
    };
    
    const addCardToList = () => {
      if (!selectedCard || !selectedVersion) {
        showNotification('Please select a card and version', 'error');
        return;
      }
      
      const finalPrice = userPrice || selectedVersion.suggestedPrice;
      
      const newCard = {
        id: `card-${Date.now()}-${Math.random()}`,
        card_name: selectedCard.name,
        name: selectedCard.name,
        scryfall_id: selectedVersion.id,
        set_name: selectedVersion.set,
        set_code: selectedVersion.setCode,
        collector_number: selectedVersion.collector_number,
        quantity: quantity,
        condition: condition,
        finish: finish,
        language: 'English',
        suggestedPrice: parseFloat(finalPrice),
        marketPrice: selectedVersion.marketPrice,
        userPrice: parseFloat(finalPrice),
        image_url: selectedVersion.imageUrl || selectedVersion.image_url,
        selected: true,
        version_selected: true,
        treatments: selectedVersion.treatments || [],
        rarity: selectedVersion.rarity
      };
      
      setCards(prev => [...prev, newCard]);
      setSelectedCards(prev => new Set([...prev, newCard.id]));
      
      // Reset form
      resetQuickAddForm();
      
      showNotification(`Added ${newCard.name} (${newCard.set_name})`, 'success');
    };
    
    const resetQuickAddForm = () => {
      setSearchTerm('');
      setSelectedCard(null);
      setVersions([]);
      setSelectedVersion(null);
      setQuantity(1);
      setCondition('NM');
      setUserPrice('');
      setFinish('nonfoil');
      searchInputRef.current?.focus();
    };
    
    // Filter and sort versions
    const getDisplayVersions = () => {
      let filtered = [...versions];
      
      // Filter by stock
      if (showOnlyInStock) {
        filtered = filtered.filter(v => v.inStock);
      }
      
      // Filter by treatment
      if (filterTreatment !== 'all') {
        filtered = filtered.filter(v => {
          if (filterTreatment === 'regular') return v.treatments.length === 0;
          if (filterTreatment === 'special') return v.treatments.length > 0;
          return v.treatments.includes(filterTreatment);
        });
      }
      
      // Sort
      filtered.sort((a, b) => {
        switch (sortBy) {
          case 'best-value':
            return b.score - a.score;
          case 'price-low':
            return (a.marketPrice || 0) - (b.marketPrice || 0);
          case 'price-high':
            return (b.marketPrice || 0) - (a.marketPrice || 0);
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
      <div className="bg-white rounded-lg p-6 shadow-lg">
        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <Search size={20} />
          Quick Add Cards
        </h3>
        
        {/* Search Bar */}
        <div className="mb-4">
          <label className="block text-sm font-medium mb-2">Search for Card</label>
          <div className="relative">
            <Search className="absolute left-3 top-3 text-gray-400" size={18} />
            <input
              ref={searchInputRef}
              type="text"
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                if (selectedCard && e.target.value !== selectedCard.name) {
                  setSelectedCard(null);
                  setVersions([]);
                  setSelectedVersion(null);
                }
              }}
              placeholder="Type card name (e.g., Lightning Bolt)..."
              className="w-full pl-10 pr-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
              autoFocus
            />
            
            {searching && (
              <Loader className="absolute right-3 top-3 animate-spin text-gray-400" size={18} />
            )}
            
            {selectedCard && (
              <button
                onClick={resetQuickAddForm}
                className="absolute right-3 top-2.5 text-gray-400 hover:text-gray-600"
              >
                <X size={20} />
              </button>
            )}
          </div>
          
          {/* Search Results Dropdown */}
          {searchResults.length > 0 && !selectedCard && (
            <div className="absolute z-20 w-full max-w-2xl bg-white border rounded-lg shadow-xl mt-1 max-h-64 overflow-y-auto">
              {searchResults.map(card => (
                <button
                  key={card.id}
                  onClick={() => selectCard(card)}
                  className="w-full px-4 py-2 hover:bg-gray-50 flex items-center gap-3 text-left border-b last:border-b-0"
                >
                  {card.imageUrl && (
                    <img 
                      src={card.imageUrl} 
                      alt={card.name} 
                      className="w-12 h-16 object-cover rounded"
                      onError={(e) => {
                        e.target.onerror = null;
                        e.target.src = 'https://via.placeholder.com/48x67?text=MTG';
                      }}
                    />
                  )}
                  <div className="flex-1">
                    <div className="font-medium">{card.name}</div>
                    <div className="text-sm text-gray-600">{card.set_name}</div>
                  </div>
                  {card.inStock && (
                    <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded">
                      In Stock
                    </span>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
        
        {/* Version Selection */}
        {selectedCard && (
          <div className="space-y-4">
            {/* Selected Card Header */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 flex items-center gap-3">
              <Package className="text-blue-600" size={20} />
              <div className="flex-1">
                <div className="font-semibold">{selectedCard.name}</div>
                <div className="text-sm text-gray-600">Select version and details below</div>
              </div>
            </div>
            
            {/* Filters and View Controls */}
            {versions.length > 0 && (
              <div className="flex flex-wrap gap-2 items-center justify-between">
                <div className="flex gap-2">
                  {/* Treatment Filter */}
                  <select
                    value={filterTreatment}
                    onChange={(e) => setFilterTreatment(e.target.value)}
                    className="px-2 py-1 text-sm border rounded"
                  >
                    <option value="all">All Versions</option>
                    <option value="regular">Regular Only</option>
                    <option value="special">Special Treatments</option>
                    <option value="promo">Promos</option>
                    <option value="showcase">Showcase</option>
                    <option value="extended">Extended Art</option>
                    <option value="borderless">Borderless</option>
                  </select>
                  
                  {/* Sort */}
                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value)}
                    className="px-2 py-1 text-sm border rounded"
                  >
                    <option value="best-value">Best Value</option>
                    <option value="price-low">Price: Low to High</option>
                    <option value="price-high">Price: High to Low</option>
                    <option value="newest">Newest First</option>
                    <option value="oldest">Oldest First</option>
                  </select>
                  
                  {/* Stock Filter */}
                  <label className="flex items-center gap-1 px-2 py-1 text-sm">
                    <input
                      type="checkbox"
                      checked={showOnlyInStock}
                      onChange={(e) => setShowOnlyInStock(e.target.checked)}
                      className="w-3 h-3"
                    />
                    <span>In Stock Only</span>
                  </label>
                </div>
                
                {/* View Toggle */}
                <div className="flex items-center gap-1 border rounded">
                  <button
                    onClick={() => setViewMode('list')}
                    className={`p-1.5 ${viewMode === 'list' ? 'bg-blue-600 text-white' : 'text-gray-600'}`}
                  >
                    <List size={16} />
                  </button>
                  <button
                    onClick={() => setViewMode('grid')}
                    className={`p-1.5 ${viewMode === 'grid' ? 'bg-blue-600 text-white' : 'text-gray-600'}`}
                  >
                    <Grid size={16} />
                  </button>
                </div>
              </div>
            )}
            
            {/* Versions Display */}
            {loadingVersions ? (
              <div className="flex justify-center py-8">
                <Loader className="animate-spin text-blue-600" size={32} />
              </div>
            ) : displayVersions.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                No versions found matching your criteria
              </div>
            ) : viewMode === 'list' ? (
              // List View with Hover Preview
              <div className="border rounded-lg max-h-96 overflow-y-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 sticky top-0">
                    <tr>
                      <th className="px-3 py-2 text-left">Version</th>
                      <th className="px-3 py-2 text-left">Set</th>
                      <th className="px-3 py-2 text-center">Stock</th>
                      <th className="px-3 py-2 text-right">Price</th>
                      <th className="px-3 py-2 text-center">Select</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {displayVersions.map(version => (
                      <tr
                        key={version.id}
                        onClick={() => {
                          setSelectedVersion(version);
                          setUserPrice(version.suggestedPrice?.toFixed(2) || '');
                        }}
                        className={`hover:bg-gray-50 cursor-pointer ${
                          selectedVersion?.id === version.id ? 'bg-blue-50' : ''
                        }`}
                      >
                        <td className="px-3 py-2">
                          <CardHoverPreview card={version} isActive={true}>
                            <img
                              src={version.imageUrl || version.image_url}
                              alt={version.set}
                              className="w-10 h-14 object-cover rounded cursor-pointer"
                              onError={(e) => {
                                e.target.onerror = null;
                                e.target.src = 'https://via.placeholder.com/40x56?text=MTG';
                              }}
                            />
                          </CardHoverPreview>
                        </td>
                        <td className="px-3 py-2">
                          <CardHoverPreview card={version} isActive={true}>
                            <div className="cursor-pointer">
                              <div className="font-medium">{version.set}</div>
                              <div className="text-xs text-gray-600">#{version.collector_number}</div>
                            </div>
                          </CardHoverPreview>
                        </td>
                        <td className="px-3 py-2 text-center">
                          {version.inStock ? (
                            <span className="text-green-600 font-medium">✓</span>
                          ) : (
                            <span className="text-gray-400">-</span>
                          )}
                        </td>
                        <td className="px-3 py-2 text-right">
                          <div className="font-bold">${version.suggestedPrice?.toFixed(2)}</div>
                        </td>
                        <td className="px-3 py-2 text-center">
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
            ) : (
              // Grid View (existing grid view code)
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 max-h-96 overflow-y-auto p-1">
                {displayVersions.map(version => (
                  <div
                    key={version.id}
                    onClick={() => {
                      setSelectedVersion(version);
                      setUserPrice(version.suggestedPrice?.toFixed(2) || '');
                    }}
                    className={`relative border-2 rounded-lg p-2 cursor-pointer transition-all ${
                      selectedVersion?.id === version.id
                        ? 'border-blue-500 bg-blue-50 shadow-lg'
                        : 'border-gray-200 hover:border-gray-300 hover:shadow'
                    } ${!version.inStock ? 'opacity-60' : ''}`}
                  >
                    {/* Badges */}
                    {version.inStock && (
                      <div className="absolute -top-2 -right-2 bg-green-500 text-white text-xs px-2 py-0.5 rounded-full font-bold z-10">
                        In Stock
                      </div>
                    )}
                    
                    {/* Card Image with Hover */}
                    <CardHoverPreview card={version} isActive={true}>
                      <img
                        src={version.imageUrl || version.image_url}
                        alt={version.set}
                        className="w-full rounded mb-2 cursor-pointer"
                        onError={(e) => {
                          e.target.onerror = null;
                          e.target.src = 'https://via.placeholder.com/200x280?text=MTG';
                        }}
                      />
                    </CardHoverPreview>
                    
                    {/* Version Info */}
                    <div className="space-y-1">
                      <div className="font-bold text-xs truncate">{version.set}</div>
                      <div className="text-xs text-gray-600">#{version.collector_number}</div>
                      
                      {/* Treatments */}
                      {version.treatments && version.treatments.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {version.treatments.slice(0, 2).map(treatment => (
                            <span key={treatment} className="text-xs bg-purple-100 text-purple-700 px-1 rounded">
                              {treatment}
                            </span>
                          ))}
                          {version.treatments.length > 2 && (
                            <span className="text-xs text-gray-500">+{version.treatments.length - 2}</span>
                          )}
                        </div>
                      )}
                      
                      {/* Price */}
                      <div className="pt-1 border-t">
                        <div className="text-sm font-bold text-green-600">
                          ${version.suggestedPrice?.toFixed(2) || '0.00'}
                        </div>
                        {version.marketPrice !== version.suggestedPrice && (
                          <div className="text-xs text-gray-500">
                            Market: ${version.marketPrice?.toFixed(2)}
                          </div>
                        )}
                      </div>
                      
                      {/* Selected Indicator */}
                      {selectedVersion?.id === version.id && (
                        <div className="absolute top-1 left-1">
                          <Check className="text-blue-600 bg-white rounded-full" size={20} />
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
            
            {/* Add Controls */}
            {selectedVersion && (
              <div className="bg-gray-50 rounded-lg p-4 space-y-4">
                <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                  <div>
                    <label className="block text-xs font-medium mb-1">Condition</label>
                    <select
                      value={condition}
                      onChange={(e) => setCondition(e.target.value)}
                      className="w-full px-2 py-1 text-sm border rounded"
                    >
                      <option value="NM">Near Mint</option>
                      <option value="LP">Lightly Played</option>
                      <option value="MP">Moderately Played</option>
                      <option value="HP">Heavily Played</option>
                      <option value="DMG">Damaged</option>
                    </select>
                  </div>
                  
                  <div>
                    <label className="block text-xs font-medium mb-1">Finish</label>
                    <select
                      value={finish}
                      onChange={(e) => setFinish(e.target.value)}
                      className="w-full px-2 py-1 text-sm border rounded"
                    >
                      <option value="nonfoil">Non-foil</option>
                      {selectedVersion.finishes?.includes('foil') && (
                        <option value="foil">Foil</option>
                      )}
                      {selectedVersion.finishes?.includes('etched') && (
                        <option value="etched">Etched Foil</option>
                      )}
                    </select>
                  </div>
                  
                  <div>
                    <label className="block text-xs font-medium mb-1">Quantity</label>
                    <input
                      type="number"
                      min="1"
                      value={quantity}
                      onChange={(e) => setQuantity(parseInt(e.target.value) || 1)}
                      className="w-full px-2 py-1 text-sm border rounded"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-xs font-medium mb-1">Your Price (AUD)</label>
                    <div className="relative">
                      <span className="absolute left-2 top-1 text-gray-500 text-sm">$</span>
                      <input
                        type="number"
                        step="0.01"
                        value={userPrice}
                        onChange={(e) => setUserPrice(e.target.value)}
                        className="w-full pl-6 pr-2 py-1 text-sm border rounded"
                      />
                    </div>
                  </div>
                  
                  <div className="flex items-end">
                    <button
                      onClick={addCardToList}
                      className="w-full px-3 py-1.5 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 font-medium"
                    >
                      Add to List
                    </button>
                  </div>
                </div>
                
                {/* Market Info */}
                <div className="flex flex-wrap gap-4 text-xs text-gray-600">
                  <div className="flex items-center gap-1">
                    <TrendingUp size={14} />
                    Market: ${selectedVersion.marketPrice?.toFixed(2)}
                  </div>
                  {selectedVersion.lowestLocalPrice && (
                    <div className="flex items-center gap-1">
                      <DollarSign size={14} />
                      Lowest local: ${selectedVersion.lowestLocalPrice.toFixed(2)}
                    </div>
                  )}
                  {selectedVersion.inStock && (
                    <div className="flex items-center gap-1">
                      <Package size={14} />
                      {selectedVersion.localInventoryCount} competing listings
                    </div>
                  )}
                  <div className="flex items-center gap-1">
                    <Clock size={14} />
                    Est. sell time: 7-14 days
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  // ========== ENHANCED BULK IMPORT WITH MULTIPLE DATABASE SUPPORT ==========
  const BulkImportCards = () => {
    const [bulkText, setBulkText] = useState('');
    const [csvFile, setCsvFile] = useState(null);
    const [importing, setImporting] = useState(false);
    const [importFormat, setImportFormat] = useState('text');
    const [csvSource, setCsvSource] = useState('generic');
    
    // Database format specifications
    const databaseFormats = {
      dragonshield: {
        name: 'DragonShield',
        icon: '🛡️',
        columns: ['Folder Name', 'Quantity', 'Trade Quantity', 'Card Name', 'Set Code', 'Set Name', 'Card Number', 'Condition', 'Printing', 'Language', 'Price Bought', 'Date Bought', 'LOW', 'MID', 'MARKET'],
        mapping: {
          name: 'Card Name',
          quantity: 'Quantity',
          set: 'Set Name',
          setCode: 'Set Code',
          number: 'Card Number',
          condition: 'Condition',
          language: 'Language',
          foil: 'Printing',
          price: 'MARKET'
        }
      },
      moxfield: {
        name: 'Moxfield',
        icon: '📦',
        columns: ['Count', 'Tradelist Count', 'Name', 'Edition', 'Condition', 'Language', 'Foil', 'Tags', 'Last Modified', 'Collector Number', 'Alter', 'Proxy', 'Purchase Price'],
        mapping: {
          name: 'Name',
          quantity: 'Count',
          set: 'Edition',
          condition: 'Condition',
          language: 'Language',
          foil: 'Foil',
          number: 'Collector Number',
          price: 'Purchase Price'
        }
      },
      tcgplayer: {
        name: 'TCGPlayer',
        icon: '🃏',
        columns: ['Quantity', 'Name', 'Simple Name', 'Set', 'Card Number', 'Set Code', 'Printing', 'Condition', 'Language', 'Rarity', 'Product ID', 'SKU', 'Price', 'Price Each'],
        mapping: {
          name: 'Name',
          quantity: 'Quantity',
          set: 'Set',
          setCode: 'Set Code',
          number: 'Card Number',
          condition: 'Condition',
          language: 'Language',
          foil: 'Printing',
          price: 'Price Each'
        }
      },
      archidekt: {
        name: 'Archidekt',
        icon: '🏛️',
        columns: ['Quantity', 'Name', 'Edition', 'Condition', 'Language', 'Foil', 'Category', 'CMC', 'Color', 'Rarity'],
        mapping: {
          name: 'Name',
          quantity: 'Quantity',
          set: 'Edition',
          condition: 'Condition',
          language: 'Language',
          foil: 'Foil'
        }
      },
      deckbox: {
        name: 'Deckbox',
        icon: '📚',
        columns: ['Count', 'Name', 'Edition', 'Card Number', 'Condition', 'Language', 'Foil', 'Signed', 'Artist Proof', 'Altered Art', 'Misprint', 'Promo', 'Textless', 'My Price'],
        mapping: {
          name: 'Name',
          quantity: 'Count',
          set: 'Edition',
          number: 'Card Number',
          condition: 'Condition',
          language: 'Language',
          foil: 'Foil',
          price: 'My Price'
        }
      },
      generic: {
        name: 'Generic CSV',
        icon: '📄',
        columns: ['Card Name', 'Quantity', 'Set', 'Condition', 'Foil', 'Price'],
        mapping: {
          name: 'Card Name',
          quantity: 'Quantity',
          set: 'Set',
          condition: 'Condition',
          foil: 'Foil',
          price: 'Price'
        }
      }
    };
    
    const handleCSVUpload = (event) => {
      const file = event.target.files[0];
      if (file && file.type === 'text/csv') {
        setCsvFile(file);
        
        Papa.parse(file, {
          header: true,
          complete: (results) => {
            // Auto-detect CSV format
            const headers = Object.keys(results.data[0] || {});
            let detectedFormat = 'generic';
            
            for (const [format, spec] of Object.entries(databaseFormats)) {
              const matchingColumns = spec.columns.filter(col => 
                headers.some(h => h.toLowerCase() === col.toLowerCase())
              );
              if (matchingColumns.length >= spec.columns.length * 0.7) {
                detectedFormat = format;
                break;
              }
            }
            
            setCsvSource(detectedFormat);
            showNotification(`Detected ${databaseFormats[detectedFormat].name} format`, 'info');
            processCSVData(results.data, detectedFormat);
          },
          error: (error) => {
            showNotification('Failed to parse CSV file', 'error');
            console.error('CSV parse error:', error);
          }
        });
      } else {
        showNotification('Please upload a valid CSV file', 'error');
      }
    };
    
    const processCSVData = async (csvData, format) => {
      setImporting(true);
      const newCards = [];
      const mapping = databaseFormats[format].mapping;
      
      for (const row of csvData) {
        // Skip empty rows
        if (!row[mapping.name]) continue;
        
        const cardName = row[mapping.name];
        const quantity = parseInt(row[mapping.quantity]) || 1;
        const set = row[mapping.set] || '';
        const setCode = row[mapping.setCode] || '';
        const condition = normalizeCondition(row[mapping.condition] || 'NM');
        const language = row[mapping.language] || 'English';
        const collectorNumber = row[mapping.number] || '';
        
        // Handle foil detection
        let finish = 'nonfoil';
        if (mapping.foil) {
          const foilValue = row[mapping.foil]?.toLowerCase();
          if (foilValue === 'foil' || foilValue === 'true' || foilValue === '1' || foilValue === 'yes') {
            finish = 'foil';
          } else if (foilValue === 'etched') {
            finish = 'etched';
          }
        }
        
        // Get price if available
        const price = row[mapping.price] ? parseFloat(row[mapping.price].replace(/[^0-9.-]/g, '')) : null;
        
        try {
          const response = await fetch(`${API_URL}/cards/search?q=${encodeURIComponent(cardName)}&limit=1`);
          const data = await response.json();
          
          if (data.cards && data.cards.length > 0) {
            const card = data.cards[0];
            
            newCards.push({
              id: `card-${Date.now()}-${Math.random()}`,
              card_name: cardName,
              name: cardName,
              scryfall_id: card.id,
              set_name: set || card.set_name,
              set_code: setCode || card.setCode,
              collector_number: collectorNumber || card.collector_number,
              quantity: quantity,
              condition: condition,
              finish: finish,
              language: language,
              suggestedPrice: price || parseFloat(card.price || 0),
              marketPrice: parseFloat(card.price || 0),
              userPrice: price,
              image_url: card.imageUrl,
              selected: true,
              importSource: databaseFormats[format].name
            });
          } else {
            // Card not found, add with minimal info
            newCards.push({
              id: `card-${Date.now()}-${Math.random()}`,
              card_name: cardName,
              name: cardName,
              scryfall_id: `temp-${Date.now()}`,
              set_name: set || 'Unknown',
              set_code: setCode,
              collector_number: collectorNumber,
              quantity: quantity,
              condition: condition,
              finish: finish,
              language: language,
              suggestedPrice: price || 0,
              userPrice: price,
              selected: true,
              needsReview: true,
              importSource: databaseFormats[format].name
            });
          }
        } catch (error) {
          console.error(`Failed to fetch data for ${cardName}:`, error);
        }
      }
      
      setCards(prev => [...prev, ...newCards]);
      newCards.forEach(card => {
        setSelectedCards(prev => new Set([...prev, card.id]));
      });
      
      setImporting(false);
      showNotification(`Imported ${newCards.length} cards from ${databaseFormats[format].name}`, 'success');
      setCsvFile(null);
      if (csvInputRef.current) {
        csvInputRef.current.value = '';
      }
    };
    
    const normalizeCondition = (condition) => {
      const conditionMap = {
        'near mint': 'NM',
        'nm': 'NM',
        'mint': 'NM',
        'lightly played': 'LP',
        'lp': 'LP',
        'excellent': 'LP',
        'moderately played': 'MP',
        'mp': 'MP',
        'good': 'MP',
        'heavily played': 'HP',
        'hp': 'HP',
        'played': 'HP',
        'damaged': 'DMG',
        'dmg': 'DMG',
        'poor': 'DMG'
      };
      
      return conditionMap[condition.toLowerCase()] || 'NM';
    };
    
    const processBulkText = async () => {
      if (!bulkText.trim()) {
        showNotification('Please enter some cards', 'error');
        return;
      }
      
      setImporting(true);
      const lines = bulkText.trim().split('\n');
      const newCards = [];
      
      for (const line of lines) {
        const match = line.match(/^(\d+)?\s*x?\s*(.+?)(?:\s*\[([A-Z0-9]+)\])?$/i);
        
        if (match) {
          const quantity = parseInt(match[1]) || 1;
          const cardName = match[2].trim();
          const setCode = match[3] || '';
          
          try {
            const response = await fetch(`${API_URL}/cards/search?q=${encodeURIComponent(cardName)}&limit=1`);
            const data = await response.json();
            
            if (data.cards && data.cards.length > 0) {
              const card = data.cards[0];
              
              newCards.push({
                id: `card-${Date.now()}-${Math.random()}`,
                card_name: cardName,
                name: cardName,
                scryfall_id: card.id,
                set_name: card.set_name,
                set_code: setCode || card.setCode,
                collector_number: card.collector_number,
                quantity: quantity,
                condition: 'NM',
                finish: 'nonfoil',
                language: 'English',
                suggestedPrice: parseFloat(card.price || 0),
                marketPrice: parseFloat(card.price || 0),
                image_url: card.imageUrl,
                selected: true
              });
            }
          } catch (error) {
            console.error(`Failed to fetch data for ${cardName}:`, error);
            newCards.push({
              id: `card-${Date.now()}-${Math.random()}`,
              card_name: cardName,
              name: cardName,
              scryfall_id: `temp-${Date.now()}`,
              set_name: 'Unknown',
              set_code: setCode,
              quantity: quantity,
              condition: 'NM',
              finish: 'nonfoil',
              language: 'English',
              suggestedPrice: 0,
              selected: true
            });
          }
        }
      }
      
      setCards(prev => [...prev, ...newCards]);
      newCards.forEach(card => {
        setSelectedCards(prev => new Set([...prev, card.id]));
      });
      
      setImporting(false);
      setBulkText('');
      showNotification(`Imported ${newCards.length} cards`, 'success');
    };
    
    return (
      <div className="bg-white rounded-lg p-6 shadow-lg">
        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <FileUp size={20} />
          Bulk Import Cards
        </h3>
        
        <div className="flex gap-2 mb-4">
          <button
            onClick={() => setImportFormat('text')}
            className={`px-4 py-2 rounded-lg ${
              importFormat === 'text' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700'
            }`}
          >
            Text List
          </button>
          {Papa && (
            <button
              onClick={() => setImportFormat('csv')}
              className={`px-4 py-2 rounded-lg ${
                importFormat === 'csv' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700'
              }`}
            >
              CSV Upload
            </button>
          )}
        </div>
        
        {importFormat === 'text' ? (
          <>
            <div className="mb-4">
              <label className="block text-sm font-medium mb-2">
                Paste your card list
              </label>
              <textarea
                value={bulkText}
                onChange={(e) => setBulkText(e.target.value)}
                className="w-full h-48 px-3 py-2 border rounded-lg font-mono text-sm"
                placeholder="4x Lightning Bolt [LEA]
2 Black Lotus
Sol Ring [CMD]
Birds of Paradise"
              />
              <div className="text-xs text-gray-500 mt-1">
                Format: [quantity]x Card Name [SET] or just Card Name
              </div>
            </div>
            
            <button
              onClick={processBulkText}
              disabled={importing || !bulkText.trim()}
              className="w-full px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-400 flex items-center justify-center gap-2"
            >
              {importing ? (
                <>
                  <Loader className="animate-spin" size={18} />
                  Importing...
                </>
              ) : (
                <>
                  <Upload size={18} />
                  Import Cards
                </>
              )}
            </button>
          </>
        ) : (
          <>
            {/* Database Source Selection */}
            <div className="mb-4">
              <label className="block text-sm font-medium mb-2">
                Select Your Database Source
              </label>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                {Object.entries(databaseFormats).map(([key, format]) => (
                  <button
                    key={key}
                    onClick={() => setCsvSource(key)}
                    className={`p-3 border rounded-lg text-left transition ${
                      csvSource === key ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:bg-gray-50'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-2xl">{format.icon}</span>
                      <div>
                        <div className="font-medium text-sm">{format.name}</div>
                        {key !== 'generic' && (
                          <div className="text-xs text-gray-500">Direct import</div>
                        )}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
            
            <div className="mb-4">
              <label className="block text-sm font-medium mb-2">
                Upload CSV File from {databaseFormats[csvSource].name}
              </label>
              <input
                ref={csvInputRef}
                type="file"
                accept=".csv"
                onChange={handleCSVUpload}
                className="hidden"
              />
              <div
                onClick={() => csvInputRef.current?.click()}
                className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center cursor-pointer hover:bg-gray-50"
              >
                <Database className="mx-auto mb-2 text-gray-400" size={32} />
                <p className="text-sm text-gray-600">
                  {csvFile ? csvFile.name : `Click to upload ${databaseFormats[csvSource].name} CSV file`}
                </p>
                <p className="text-xs text-gray-500 mt-2">
                  Export your collection from {databaseFormats[csvSource].name} and upload here
                </p>
              </div>
            </div>
            
            {csvFile && (
              <button
                onClick={() => {
                  setCsvFile(null);
                  if (csvInputRef.current) {
                    csvInputRef.current.value = '';
                  }
                }}
                className="w-full px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
              >
                Clear File
              </button>
            )}
            
            {/* Help Section */}
            <div className="mt-4 p-3 bg-blue-50 rounded-lg">
              <div className="flex items-start gap-2">
                <Info className="text-blue-600 mt-0.5" size={16} />
                <div className="text-sm text-blue-800">
                  <p className="font-medium mb-1">How to export from {databaseFormats[csvSource].name}:</p>
                  {csvSource === 'dragonshield' && (
                    <ol className="text-xs space-y-1 ml-4">
                      <li>1. Open DragonShield app</li>
                      <li>2. Go to your collection</li>
                      <li>3. Click Export → CSV</li>
                      <li>4. Upload the file here</li>
                    </ol>
                  )}
                  {csvSource === 'moxfield' && (
                    <ol className="text-xs space-y-1 ml-4">
                      <li>1. Go to your Moxfield collection</li>
                      <li>2. Click Tools → Export</li>
                      <li>3. Select CSV format</li>
                      <li>4. Upload the file here</li>
                    </ol>
                  )}
                  {csvSource === 'tcgplayer' && (
                    <ol className="text-xs space-y-1 ml-4">
                      <li>1. Go to TCGPlayer collection</li>
                      <li>2. Click Export Collection</li>
                      <li>3. Choose CSV format</li>
                      <li>4. Upload the file here</li>
                    </ol>
                  )}
                  {csvSource === 'generic' && (
                    <p className="text-xs">Use columns: Card Name, Quantity, Set, Condition, Foil, Price</p>
                  )}
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    );
  };

  // ========== ENHANCED PHOTO UPLOAD WITH OCR ==========
  const PhotoUploadCards = () => {
    const [uploadedImages, setUploadedImages] = useState([]);
    const [processing, setProcessing] = useState(false);
    const [recognitionResults, setRecognitionResults] = useState([]);
    
    const handleImageUpload = (event) => {
      const files = Array.from(event.target.files);
      
      files.forEach(file => {
        if (file.type.startsWith('image/')) {
          const reader = new FileReader();
          reader.onload = (e) => {
            setUploadedImages(prev => [...prev, {
              id: `img-${Date.now()}-${Math.random()}`,
              url: e.target.result,
              file: file,
              name: file.name,
              processed: false,
              recognized: null
            }]);
          };
          reader.readAsDataURL(file);
        }
      });
    };
    
    const processImages = async () => {
      setProcessing(true);
      const newCards = [];
      
      for (const img of uploadedImages) {
        try {
          // Create FormData for image upload
          const formData = new FormData();
          formData.append('image', img.file);
          
          // Send to backend for OCR processing
          const token = localStorage.getItem('authToken');
          const response = await fetch(`${API_URL}/cards/recognize`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${token}`
            },
            body: formData
          });
          
          if (response.ok) {
            const result = await response.json();
            
            if (result.success && result.card) {
              // Card successfully recognized
              const card = result.card;
              
              newCards.push({
                id: `card-${Date.now()}-${Math.random()}`,
                card_name: card.name,
                name: card.name,
                scryfall_id: card.id,
                set_name: card.set,
                set_code: card.setCode,
                quantity: 1,
                condition: 'NM', // Default, user can change
                finish: 'nonfoil', // Default, user can change
                language: 'English',
                suggestedPrice: card.prices?.aud || 0,
                marketPrice: card.prices?.aud || 0,
                image_url: card.imageUrl,
                selected: true,
                confidence: result.confidence || 0.8,
                needsReview: result.confidence < 0.9
              });
              
              // Update image status
              setUploadedImages(prev => prev.map(image => 
                image.id === img.id 
                  ? { ...image, processed: true, recognized: card.name }
                  : image
              ));
            } else if (result.recognizedText) {
              // Partial recognition - need manual confirmation
              showNotification(`Recognized text: "${result.recognizedText}" - Manual review required`, 'info');
              
              // Try fuzzy search with recognized text
              const searchResponse = await fetch(
                `${API_URL}/cards/search?q=${encodeURIComponent(result.recognizedText)}&limit=1`
              );
              const searchData = await searchResponse.json();
              
              if (searchData.cards && searchData.cards.length > 0) {
                const card = searchData.cards[0];
                
                newCards.push({
                  id: `card-${Date.now()}-${Math.random()}`,
                  card_name: card.name,
                  name: card.name,
                  scryfall_id: card.id,
                  set_name: card.set_name,
                  quantity: 1,
                  condition: 'NM',
                  finish: 'nonfoil',
                  language: 'English',
                  suggestedPrice: parseFloat(card.price || 0),
                  marketPrice: parseFloat(card.price || 0),
                  image_url: card.imageUrl,
                  selected: true,
                  needsReview: true,
                  confidence: 0.5
                });
              }
            } else {
              // Failed to recognize
              showNotification(`Could not recognize card from ${img.name}`, 'error');
            }
          } else {
            // Fallback for failed recognition
            showNotification(`Failed to process ${img.name}`, 'error');
          }
        } catch (error) {
          console.error(`Failed to process image ${img.name}:`, error);
          showNotification(`Error processing ${img.name}`, 'error');
        }
      }
      
      if (newCards.length > 0) {
        setCards(prev => [...prev, ...newCards]);
        newCards.forEach(card => {
          setSelectedCards(prev => new Set([...prev, card.id]));
        });
        
        showNotification(`Added ${newCards.length} cards from photos`, 'success');
        
        // Clear successfully processed images
        setUploadedImages(prev => prev.filter(img => !img.processed));
      }
      
      setProcessing(false);
    };
    
    const removeImage = (imgId) => {
      setUploadedImages(prev => prev.filter(img => img.id !== imgId));
    };
    
    return (
      <div className="bg-white rounded-lg p-6 shadow-lg">
        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <Camera size={20} />
          Photo Upload with Card Recognition
        </h3>
        
        <div className="mb-4">
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept="image/*"
            onChange={handleImageUpload}
            className="hidden"
          />
          <div
            onClick={() => fileInputRef.current?.click()}
            className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center cursor-pointer hover:bg-gray-50"
          >
            <Camera className="mx-auto mb-2 text-gray-400" size={32} />
            <p className="text-sm text-gray-600">
              Click to upload card photos or drag & drop
            </p>
            <p className="text-xs text-gray-500 mt-2">
              Our AI will automatically recognize your cards
            </p>
          </div>
        </div>
        
        {uploadedImages.length > 0 && (
          <div className="mb-4">
            <div className="grid grid-cols-3 md:grid-cols-4 gap-3">
              {uploadedImages.map(img => (
                <div key={img.id} className="relative group">
                  <img
                    src={img.url}
                    alt={img.name}
                    className="w-full h-32 object-cover rounded-lg"
                  />
                  {img.processed && (
                    <div className="absolute inset-0 bg-green-500 bg-opacity-20 rounded-lg flex items-center justify-center">
                      <Check className="text-white" size={32} />
                    </div>
                  )}
                  {img.recognized && (
                    <div className="absolute bottom-0 left-0 right-0 bg-black bg-opacity-75 text-white text-xs p-1 rounded-b-lg truncate">
                      {img.recognized}
                    </div>
                  )}
                  <button
                    onClick={() => removeImage(img.id)}
                    className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition"
                  >
                    <X size={14} />
                  </button>
                </div>
              ))}
            </div>
            
            <button
              onClick={processImages}
              disabled={processing}
              className="w-full mt-4 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:bg-gray-400 flex items-center justify-center gap-2"
            >
              {processing ? (
                <>
                  <Loader className="animate-spin" size={18} />
                  Recognizing Cards...
                </>
              ) : (
                <>
                  <Wand2 size={18} />
                  Recognize {uploadedImages.length} Image{uploadedImages.length > 1 ? 's' : ''}
                </>
              )}
            </button>
          </div>
        )}
        
        <div className="p-3 bg-green-50 rounded-lg">
          <div className="flex items-start gap-2">
            <Check className="text-green-600 mt-0.5" size={16} />
            <div className="text-sm text-green-800">
              <p className="font-medium">AI-Powered Recognition</p>
              <p className="text-xs mt-1">
                Our system uses advanced OCR and image recognition to identify your cards automatically. 
                For best results, take clear photos with good lighting.
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // ========== CARD LIST MANAGEMENT ==========
  const CardListManager = () => {
    const handleQuantityChange = (cardId, delta) => {
      setCards(prev => prev.map(card => 
        card.id === cardId 
          ? { ...card, quantity: Math.max(1, card.quantity + delta) }
          : card
      ));
    };
    
    const handleConditionChange = (cardId, condition) => {
      setCards(prev => prev.map(card => 
        card.id === cardId ? { ...card, condition } : card
      ));
    };
    
    const toggleCardSelection = (cardId) => {
      setSelectedCards(prev => {
        const newSet = new Set(prev);
        if (newSet.has(cardId)) {
          newSet.delete(cardId);
        } else {
          newSet.add(cardId);
        }
        return newSet;
      });
    };
    
    const removeCard = (cardId) => {
      setCards(prev => prev.filter(c => c.id !== cardId));
      setSelectedCards(prev => {
        const newSet = new Set(prev);
        newSet.delete(cardId);
        return newSet;
      });
    };
    
    return (
      <div className="bg-white rounded-lg shadow-lg">
        <div className="p-4 border-b flex justify-between items-center">
          <h3 className="font-semibold">Your Cards ({cards.length})</h3>
          <div className="flex gap-2">
            <button
              onClick={() => setSelectedCards(new Set(cards.map(c => c.id)))}
              className="text-sm px-3 py-1 border rounded hover:bg-gray-50"
            >
              Select All
            </button>
            <button
              onClick={() => setSelectedCards(new Set())}
              className="text-sm px-3 py-1 border rounded hover:bg-gray-50"
            >
              Clear Selection
            </button>
          </div>
        </div>
        
        <div className="max-h-96 overflow-y-auto">
          {cards.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              <Package size={48} className="mx-auto mb-4 opacity-50" />
              <p>No cards added yet</p>
              <p className="text-sm mt-2">Use one of the methods above to add cards</p>
            </div>
          ) : (
            <div className="divide-y">
              {cards.map(card => (
                <div key={card.id} className="p-4 hover:bg-gray-50">
                  <div className="flex items-center gap-4">
                    <input
                      type="checkbox"
                      checked={selectedCards.has(card.id)}
                      onChange={() => toggleCardSelection(card.id)}
                      className="w-4 h-4"
                    />
                    
                    {card.image_url && (
                      <CardHoverPreview card={card} isActive={true}>
                        <img 
                          src={card.image_url} 
                          alt={card.name}
                          className="w-16 h-20 object-cover rounded cursor-pointer"
                        />
                      </CardHoverPreview>
                    )}
                    
                    <div className="flex-1">
                      <CardHoverPreview card={card} isActive={true}>
                        <div className="font-medium cursor-pointer hover:text-blue-600">
                          {card.name || card.card_name}
                          {card.needsReview && (
                            <span className="ml-2 text-xs bg-yellow-100 text-yellow-800 px-2 py-0.5 rounded">
                              Needs Review
                            </span>
                          )}
                          {card.confidence && card.confidence < 0.9 && (
                            <span className="ml-2 text-xs bg-orange-100 text-orange-800 px-2 py-0.5 rounded">
                              {Math.round(card.confidence * 100)}% confident
                            </span>
                          )}
                          {card.importSource && (
                            <span className="ml-2 text-xs bg-blue-100 text-blue-800 px-2 py-0.5 rounded">
                              {card.importSource}
                            </span>
                          )}
                        </div>
                      </CardHoverPreview>
                      <div className="text-sm text-gray-600">
                        {card.set_name} • #{card.collector_number}
                      </div>
                      <div className="text-xs text-gray-500">
                        {card.finish === 'foil' && '✨ Foil • '}
                        {card.finish === 'etched' && '✨ Etched Foil • '}
                        {card.condition} • {card.language || 'English'}
                      </div>
                    </div>
                    
                    <select
                      value={card.condition}
                      onChange={(e) => handleConditionChange(card.id, e.target.value)}
                      className="px-2 py-1 border rounded text-sm"
                    >
                      <option value="NM">Near Mint</option>
                      <option value="LP">Lightly Played</option>
                      <option value="MP">Moderately Played</option>
                      <option value="HP">Heavily Played</option>
                      <option value="DMG">Damaged</option>
                    </select>
                    
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleQuantityChange(card.id, -1)}
                        className="p-1 hover:bg-gray-200 rounded"
                      >
                        <Minus size={16} />
                      </button>
                      <input
                        type="number"
                        value={card.quantity}
                        onChange={(e) => {
                          const newQty = parseInt(e.target.value) || 1;
                          handleQuantityChange(card.id, newQty - card.quantity);
                        }}
                        className="w-12 text-center border rounded"
                        min="1"
                      />
                      <button
                        onClick={() => handleQuantityChange(card.id, 1)}
                        className="p-1 hover:bg-gray-200 rounded"
                      >
                        <Plus size={16} />
                      </button>
                    </div>
                    
                    <div className="text-right">
                      <div className="font-bold text-green-600">
                        ${(card.suggestedPrice || 0).toFixed(2)}
                      </div>
                      <div className="text-xs text-gray-500">Each</div>
                    </div>
                    
                    <button
                      onClick={() => removeCard(card.id)}
                      className="p-1 hover:bg-red-100 rounded text-red-500"
                    >
                      <X size={18} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  };

  // Submit listings
  const submitListings = async () => {
    const selectedCardsList = cards.filter(c => selectedCards.has(c.id));
    
    if (selectedCardsList.length === 0) {
      showNotification('Please select cards to list', 'error');
      return;
    }
    
    setLoading(true);
    
    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${API_URL}/listings/bulk`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          listings: selectedCardsList.map(card => ({
            scryfall_id: card.scryfall_id,
            card_id: card.scryfall_id,
            card_name: card.card_name || card.name,
            set_name: card.set_name,
            set_code: card.set_code,
            collector_number: card.collector_number,
            condition: card.condition,
            finish: card.finish,
            quantity: card.quantity,
            price: card.userPrice || card.suggestedPrice,
            language: card.language || 'English',
            description: card.description,
            image_url: card.image_url
          }))
        })
      });
      
      if (response.ok) {
        const result = await response.json();
        showNotification(
          `Successfully listed ${result.created} cards!`,
          'success'
        );
        
        setTimeout(() => {
          window.dashboardNeedsRefresh = true;
          onBack();
        }, 2000);
      } else {
        throw new Error('Failed to create listings');
      }
    } catch (error) {
      showNotification('Failed to create listings', 'error');
    } finally {
      setLoading(false);
    }
  };

  const showNotification = (message, type = 'info') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 3000);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {notification && (
        <div className={`fixed top-4 right-4 px-4 py-3 rounded-lg shadow-lg z-50 flex items-center gap-2 ${
          notification.type === 'error' ? 'bg-red-500' : 
          notification.type === 'success' ? 'bg-green-500' : 'bg-blue-500'
        } text-white`}>
          {notification.type === 'error' ? <AlertCircle size={20} /> : 
           notification.type === 'success' ? <Check size={20} /> : <Info size={20} />}
          {notification.message}
        </div>
      )}

      <div className="max-w-7xl mx-auto p-6">
        {/* Header */}
        <div className="mb-6">
          <button onClick={onBack} className="text-blue-600 hover:text-blue-800 mb-4">
            ← Back to Marketplace
          </button>
          
          <div className="flex justify-between items-start">
            <div>
              <h1 className="text-3xl font-bold mb-2">List Your Cards</h1>
              <p className="text-gray-600">Choose your preferred method to add cards</p>
            </div>
            
            <div className="bg-white rounded-lg shadow p-4 min-w-[250px]">
              <div className="text-sm text-gray-600 mb-1">Estimated Profit</div>
              <div className="text-3xl font-bold text-green-600">
                ${stats.estimatedProfit.toFixed(2)}
              </div>
              <div className="text-xs text-gray-500 mt-1">
                After 4.5% marketplace fee
              </div>
              <div className="grid grid-cols-2 gap-2 mt-3 pt-3 border-t text-xs">
                <div>
                  <div className="text-gray-600">Cards</div>
                  <div className="font-bold">{stats.totalCards}</div>
                </div>
                <div>
                  <div className="text-gray-600">Avg. Sale Time</div>
                  <div className="font-bold">{stats.avgTimeToSell} days</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Progress Steps */}
        <div className="mb-8">
          <div className="flex items-center justify-between max-w-2xl">
            {[
              { num: 1, label: 'Add Cards' },
              { num: 2, label: 'Set Prices' },
              { num: 3, label: 'Review & List' }
            ].map((s, idx) => (
              <React.Fragment key={s.num}>
                <div 
                  className={`flex items-center cursor-pointer ${
                    step >= s.num ? 'text-blue-600' : 'text-gray-400'
                  }`}
                  onClick={() => setStep(s.num)}
                >
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center border-2 ${
                    step >= s.num 
                      ? 'bg-blue-600 text-white border-blue-600' 
                      : 'bg-white border-gray-300'
                  }`}>
                    {step > s.num ? <Check size={20} /> : s.num}
                  </div>
                  <span className="ml-2 font-medium">{s.label}</span>
                </div>
                {idx < 2 && (
                  <div className={`flex-1 h-1 mx-4 ${
                    step > s.num ? 'bg-blue-600' : 'bg-gray-200'
                  }`} />
                )}
              </React.Fragment>
            ))}
          </div>
        </div>

        {/* Step 1: Add Cards */}
        {step === 1 && (
          <div>
            {/* Upload Method Selection */}
            <div className="mb-6">
              <h2 className="text-lg font-semibold mb-3">Choose Upload Method</h2>
              <div className="grid md:grid-cols-3 gap-4">
                <button
                  onClick={() => setUploadMethod('quick')}
                  className={`p-4 border-2 rounded-lg text-left transition ${
                    uploadMethod === 'quick' 
                      ? 'border-blue-500 bg-blue-50' 
                      : 'border-gray-200 hover:bg-gray-50'
                  }`}
                >
                  <Search className="mb-2 text-blue-600" size={24} />
                  <h3 className="font-semibold">Quick Add</h3>
                  <p className="text-sm text-gray-600 mt-1">
                    Search and select specific card versions
                  </p>
                </button>
                
                <button
                  onClick={() => setUploadMethod('bulk')}
                  className={`p-4 border-2 rounded-lg text-left transition ${
                    uploadMethod === 'bulk' 
                      ? 'border-blue-500 bg-blue-50' 
                      : 'border-gray-200 hover:bg-gray-50'
                  }`}
                >
                  <FileUp className="mb-2 text-green-600" size={24} />
                  <h3 className="font-semibold">Bulk Import</h3>
                  <p className="text-sm text-gray-600 mt-1">
                    Import from DragonShield, Moxfield, TCGPlayer & more
                  </p>
                </button>
                
                <button
                  onClick={() => setUploadMethod('photo')}
                  className={`p-4 border-2 rounded-lg text-left transition ${
                    uploadMethod === 'photo' 
                      ? 'border-blue-500 bg-blue-50' 
                      : 'border-gray-200 hover:bg-gray-50'
                  }`}
                >
                  <Camera className="mb-2 text-purple-600" size={24} />
                  <h3 className="font-semibold">Photo Upload</h3>
                  <p className="text-sm text-gray-600 mt-1">
                    AI-powered card recognition from photos
                  </p>
                </button>
              </div>
            </div>

            {/* Selected Method Component */}
            {uploadMethod === 'quick' && <QuickAddCard />}
            {uploadMethod === 'bulk' && <BulkImportCards />}
            {uploadMethod === 'photo' && <PhotoUploadCards />}
            
            {/* Card List */}
            <div className="mt-6">
              <CardListManager />
            </div>

            {/* Continue Button */}
            <div className="flex justify-end mt-6">
              <button
                onClick={() => setStep(2)}
                disabled={cards.length === 0}
                className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 flex items-center gap-2"
              >
                Continue to Pricing
                <ChevronRight size={20} />
              </button>
            </div>
          </div>
        )}

        {/* Step 2: Set Prices */}
        {step === 2 && (
          <PricingEngine
            cards={cards}
            selectedCards={selectedCards}
            onUpdate={(updatedCards) => setCards(updatedCards)}
            onContinue={() => setStep(3)}
            onBack={() => setStep(1)}
          />
        )}

        {/* Step 3: Review & List */}
        {step === 3 && (
          <ListingReview
            cards={cards.filter(c => selectedCards.has(c.id))}
            stats={stats}
            onSubmit={submitListings}
            onBack={() => setStep(2)}
            loading={loading}
          />
        )}
      </div>
    </div>
  );
}

export default SellCardsPage;