import React, { useState, useEffect } from 'react';
import { 
  Grid, 
  List, 
  ShoppingCart, 
  Package, 
  Star, 
  ChevronUp,
  ChevronDown,
  Plus,
  Minus,
  AlertCircle,
  Sparkles,
  Clock,
  Filter
} from 'lucide-react';
import { ManaCost } from './ManaSymbols';
import CardHoverPreview from './CardHoverPreview';
import CardImageFallback from './CardImageFallback';

const CardListView = ({ 
  cards, 
  onAddToCart, 
  onCardClick,
  formatPrice,
  loading = false
}) => {
  const [viewMode, setViewMode] = useState('list'); // 'list' or 'grid'
  const [sortColumn, setSortColumn] = useState('stock');
  const [sortDirection, setSortDirection] = useState('desc');
  const [quantities, setQuantities] = useState({});
  const [expandedCards, setExpandedCards] = useState(new Set());
  const [allVersions, setAllVersions] = useState({});
  const [loadingVersions, setLoadingVersions] = useState({});
  const [filterSet, setFilterSet] = useState('all');
  const [uniqueSets, setUniqueSets] = useState([]);

  // Group cards by name and fetch all versions
  useEffect(() => {
    fetchAllVersions();
  }, [cards]);

  const fetchAllVersions = async () => {
    // Get unique card names
    const uniqueNames = [...new Set(cards.map(c => c.name))];
    
    for (const cardName of uniqueNames) {
      if (!allVersions[cardName] && !loadingVersions[cardName]) {
        setLoadingVersions(prev => ({ ...prev, [cardName]: true }));
        
        try {
          const response = await fetch(
            `http://localhost:5000/api/cards/${encodeURIComponent(cardName)}/versions?includeImages=true`
          );
          const data = await response.json();
          
          // Merge with any existing local inventory data
          const versionsWithStock = data.versions.map(version => {
            // Check if we have local stock for this version
            const localStock = cards.find(c => 
              c.name === cardName && 
              (c.set_name === version.set || c.setCode === version.setCode)
            );
            
            return {
              ...version,
              inStock: localStock?.inStock || false,
              availableQuantity: localStock?.availableQuantity || 0,
              sellerCount: localStock?.sellerCount || 0,
              lowestPrice: localStock?.lowestPrice || version.prices?.aud || version.prices?.usd * 1.55 || 0,
              isLocalInventory: localStock?.isLocalInventory || false
            };
          });
          
          setAllVersions(prev => ({ ...prev, [cardName]: versionsWithStock }));
          
          // Extract unique sets
          const sets = [...new Set(versionsWithStock.map(v => v.set))];
          setUniqueSets(prev => [...new Set([...prev, ...sets])]);
        } catch (error) {
          console.error(`Failed to fetch versions for ${cardName}:`, error);
          // Fallback to just the searched card
          setAllVersions(prev => ({ ...prev, [cardName]: cards.filter(c => c.name === cardName) }));
        }
        
        setLoadingVersions(prev => ({ ...prev, [cardName]: false }));
      }
    }
  };

  // Get display cards (all versions or just searched ones)
  const getDisplayCards = () => {
    let displayCards = [];
    
    // Get unique card names from search results
    const uniqueNames = [...new Set(cards.map(c => c.name))];
    
    uniqueNames.forEach(cardName => {
      const versions = allVersions[cardName] || cards.filter(c => c.name === cardName);
      
      versions.forEach(version => {
        // Apply set filter if not 'all'
        if (filterSet !== 'all' && version.set !== filterSet) {
          return;
        }
        
        displayCards.push({
          ...version,
          id: version.id || `${cardName}-${version.set}-${version.collector_number}`,
          uniqueId: `${cardName}-${version.set}-${version.collector_number || Math.random()}`,
          name: cardName,
          displayName: `${cardName} (${version.set})`,
          cardBaseName: cardName
        });
      });
    });
    
    return displayCards;
  };

  // Sort cards
  const sortCards = (cardsToSort) => {
    return [...cardsToSort].sort((a, b) => {
      // Always prioritize in-stock items
      if (a.inStock && !b.inStock) return -1;
      if (!a.inStock && b.inStock) return 1;
      
      let aVal, bVal;
      
      switch(sortColumn) {
        case 'name':
          aVal = a.displayName.toLowerCase();
          bVal = b.displayName.toLowerCase();
          break;
        case 'price':
          aVal = a.lowestPrice || a.price || 0;
          bVal = b.lowestPrice || b.price || 0;
          break;
        case 'set':
          aVal = (a.set || a.set_name || '').toLowerCase();
          bVal = (b.set || b.set_name || '').toLowerCase();
          break;
        case 'stock':
          aVal = a.availableQuantity || 0;
          bVal = b.availableQuantity || 0;
          break;
        default:
          aVal = (a.inStock ? 1000 : 0) + (a.availableQuantity || 0);
          bVal = (b.inStock ? 1000 : 0) + (b.availableQuantity || 0);
      }
      
      if (sortDirection === 'asc') {
        return aVal > bVal ? 1 : -1;
      } else {
        return aVal < bVal ? 1 : -1;
      }
    });
  };

  const displayCards = sortCards(getDisplayCards());

  // Handle sorting
  const handleSort = (column) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(column);
      setSortDirection('asc');
    }
  };

  // Handle quantity changes
  const updateQuantity = (cardId, change) => {
    setQuantities(prev => ({
      ...prev,
      [cardId]: Math.max(1, (prev[cardId] || 1) + change)
    }));
  };

  // Get condition badge color
  const getConditionColor = (condition) => {
    const colors = {
      'NM': 'bg-green-100 text-green-800 border-green-200',
      'LP': 'bg-blue-100 text-blue-800 border-blue-200',
      'MP': 'bg-yellow-100 text-yellow-800 border-yellow-200',
      'HP': 'bg-orange-100 text-orange-800 border-orange-200',
      'DMG': 'bg-red-100 text-red-800 border-red-200'
    };
    return colors[condition] || 'bg-gray-100 text-gray-800 border-gray-200';
  };

  const getRarityColor = (rarity) => {
    const colors = {
      'mythic': 'text-orange-600 font-bold',
      'rare': 'text-yellow-600 font-bold',
      'uncommon': 'text-gray-600',
      'common': 'text-gray-500'
    };
    return colors[rarity] || 'text-gray-500';
  };

  // List View Component
  const ListView = () => (
    <div className="bg-white rounded-lg shadow overflow-hidden">
      {/* Filter Bar */}
      <div className="p-3 border-b bg-gray-50 flex items-center gap-4">
        <div className="flex items-center gap-2">
          <Filter size={16} className="text-gray-600" />
          <span className="text-sm font-medium">Filter by Set:</span>
        </div>
        <select
          value={filterSet}
          onChange={(e) => setFilterSet(e.target.value)}
          className="px-3 py-1 text-sm border rounded"
        >
          <option value="all">All Sets</option>
          {uniqueSets.sort().map(set => (
            <option key={set} value={set}>{set}</option>
          ))}
        </select>
        <div className="ml-auto text-sm text-gray-600">
          {displayCards.length} versions available
        </div>
      </div>
      
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50 border-b sticky top-0 z-10">
            <tr>
              <th className="p-3 text-left">Card</th>
              <th 
                className="p-3 text-left cursor-pointer hover:bg-gray-100"
                onClick={() => handleSort('name')}
              >
                <div className="flex items-center gap-1">
                  Name / Version
                  {sortColumn === 'name' && (
                    sortDirection === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />
                  )}
                </div>
              </th>
              <th 
                className="p-3 text-left cursor-pointer hover:bg-gray-100"
                onClick={() => handleSort('set')}
              >
                <div className="flex items-center gap-1">
                  Set Details
                  {sortColumn === 'set' && (
                    sortDirection === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />
                  )}
                </div>
              </th>
              <th className="p-3 text-center">Mana Cost</th>
              <th className="p-3 text-center">Treatments</th>
              <th 
                className="p-3 text-center cursor-pointer hover:bg-gray-100"
                onClick={() => handleSort('stock')}
              >
                <div className="flex items-center justify-center gap-1">
                  Stock
                  {sortColumn === 'stock' && (
                    sortDirection === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />
                  )}
                </div>
              </th>
              <th 
                className="p-3 text-right cursor-pointer hover:bg-gray-100"
                onClick={() => handleSort('price')}
              >
                <div className="flex items-center justify-end gap-1">
                  Price
                  {sortColumn === 'price' && (
                    sortDirection === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />
                  )}
                </div>
              </th>
              <th className="p-3 text-center">Qty</th>
              <th className="p-3 text-center">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {displayCards.map((card) => {
              const qty = quantities[card.uniqueId] || 1;
              const inStock = card.inStock || card.availableQuantity > 0;
              const nonfoilPrice = card.prices?.aud || card.lowestPrice || card.price || 0;
              const foilPrice = card.prices?.aud_foil || 0;
              
              return (
                <tr 
                  key={card.uniqueId} 
                  className={`hover:bg-gray-50 transition ${!inStock ? 'opacity-60' : ''}`}
                >
                  <td className="p-3">
                    <CardHoverPreview card={card} isActive={true}>
                      <CardImageFallback 
                        card={card}
                        size="small"
                        onClick={() => onCardClick(card)}
                        showDebug={false}
                      />
                    </CardHoverPreview>
                  </td>
                  
                  <td className="p-3">
                    <CardHoverPreview card={card} isActive={true}>
                      <div 
                        className="font-semibold text-blue-600 hover:text-blue-800 cursor-pointer inline-block"
                        onClick={() => onCardClick(card)}
                      >
                        {card.name}
                      </div>
                    </CardHoverPreview>
                    <div className={`text-sm ${getRarityColor(card.rarity)}`}>
                      {card.rarity}
                    </div>
                    <div className="text-xs text-gray-500 mt-1">
                      {card.type_line || card.type}
                    </div>
                  </td>
                  
                  <td className="p-3">
                    <div className="text-sm font-medium">{card.set || card.set_name}</div>
                    <div className="text-xs text-gray-500">
                      {card.setCode && `${card.setCode} • `}
                      #{card.collector_number}
                    </div>
                    {card.released_at && (
                      <div className="text-xs text-gray-400">{card.released_at}</div>
                    )}
                  </td>
                  
                  <td className="p-3 text-center">
                    {card.manaCost || card.mana_cost ? (
                      <ManaCost cost={card.manaCost || card.mana_cost} size={16} />
                    ) : (
                      <span className="text-gray-400">—</span>
                    )}
                  </td>
                  
                  <td className="p-3 text-center">
                    <div className="flex flex-wrap gap-1 justify-center">
                      {card.promo && (
                        <span className="text-xs bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded">Promo</span>
                      )}
                      {card.fullArt && (
                        <span className="text-xs bg-green-100 text-green-700 px-1.5 py-0.5 rounded">Full Art</span>
                      )}
                      {card.showcase && (
                        <span className="text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded">Showcase</span>
                      )}
                      {card.borderless && (
                        <span className="text-xs bg-orange-100 text-orange-700 px-1.5 py-0.5 rounded">Borderless</span>
                      )}
                      {card.extendedArt && (
                        <span className="text-xs bg-yellow-100 text-yellow-700 px-1.5 py-0.5 rounded">Extended</span>
                      )}
                    </div>
                  </td>
                  
                  <td className="p-3 text-center">
                    {card.isLocalInventory && inStock ? (
                      <div className="inline-flex items-center gap-1 px-2 py-1 bg-green-100 text-green-800 rounded-full text-xs font-bold">
                        <Package size={12} />
                        Local • {card.availableQuantity}
                      </div>
                    ) : inStock ? (
                      <div>
                        <div className="font-semibold text-green-600">
                          {card.availableQuantity || 'Available'}
                        </div>
                        {card.sellerCount > 0 && (
                          <div className="text-xs text-gray-500">
                            from {card.sellerCount} seller{card.sellerCount > 1 ? 's' : ''}
                          </div>
                        )}
                      </div>
                    ) : (
                      <span className="text-red-500 font-medium">Out of Stock</span>
                    )}
                  </td>
                  
                  <td className="p-3 text-right">
                    {inStock ? (
                      <div>
                        <div className="font-bold text-lg text-green-600">
                          {formatPrice(nonfoilPrice)}
                        </div>
                        {foilPrice > 0 && (
                          <div className="text-xs text-blue-600 flex items-center justify-end gap-1">
                            <Sparkles size={10} />
                            Foil: {formatPrice(foilPrice)}
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="font-bold text-gray-400">
                        {formatPrice(nonfoilPrice)}
                      </div>
                    )}
                  </td>
                  
                  <td className="p-3">
                    <div className="flex items-center justify-center gap-1">
                      <button
                        onClick={() => updateQuantity(card.uniqueId, -1)}
                        className="p-1 hover:bg-gray-200 rounded"
                        disabled={!inStock}
                      >
                        <Minus size={14} />
                      </button>
                      <input
                        type="number"
                        value={qty}
                        onChange={(e) => setQuantities(prev => ({
                          ...prev,
                          [card.uniqueId]: parseInt(e.target.value) || 1
                        }))}
                        className="w-12 text-center border rounded"
                        min="1"
                        disabled={!inStock}
                      />
                      <button
                        onClick={() => updateQuantity(card.uniqueId, 1)}
                        className="p-1 hover:bg-gray-200 rounded"
                        disabled={!inStock}
                      >
                        <Plus size={14} />
                      </button>
                    </div>
                  </td>
                  
                  <td className="p-3">
                    <button
                      onClick={() => {
                        const cartCard = { ...card, quantity: qty };
                        onAddToCart(cartCard);
                      }}
                      disabled={!inStock}
                      className={`p-2 rounded transition ${
                        inStock 
                          ? 'text-white bg-blue-600 hover:bg-blue-700' 
                          : 'text-gray-400 bg-gray-200 cursor-not-allowed'
                      }`}
                      title={inStock ? "Add to cart" : "Out of stock"}
                    >
                      <ShoppingCart size={16} />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );

  // Grid View Component
  const GridView = () => (
    <div>
      {/* Filter Bar */}
      <div className="mb-4 p-3 bg-white rounded-lg shadow flex items-center gap-4">
        <div className="flex items-center gap-2">
          <Filter size={16} className="text-gray-600" />
          <span className="text-sm font-medium">Filter by Set:</span>
        </div>
        <select
          value={filterSet}
          onChange={(e) => setFilterSet(e.target.value)}
          className="px-3 py-1 text-sm border rounded"
        >
          <option value="all">All Sets</option>
          {uniqueSets.sort().map(set => (
            <option key={set} value={set}>{set}</option>
          ))}
        </select>
        <div className="ml-auto text-sm text-gray-600">
          {displayCards.length} versions available
        </div>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {displayCards.map(card => {
          const inStock = card.inStock || card.availableQuantity > 0;
          const isLocalStock = card.isLocalInventory === true;
          const nonfoilPrice = card.prices?.aud || card.lowestPrice || card.price || 0;
          const foilPrice = card.prices?.aud_foil || 0;
          
          return (
            <div 
              key={card.uniqueId} 
              className={`bg-white rounded-xl shadow-lg overflow-hidden transition-all duration-200 hover:-translate-y-1 hover:shadow-xl cursor-pointer group relative ${!inStock ? 'opacity-90' : ''}`}
              onClick={() => onCardClick(card)}
            >
              {isLocalStock && inStock && (
                <div className="absolute top-2 left-2 z-20 bg-green-500 text-white px-2 py-1 rounded-lg text-xs font-bold flex items-center gap-1 shadow-lg">
                  <Package size={12} />
                  Local Stock
                </div>
              )}
              
              <div className="relative h-64 overflow-hidden bg-gray-100">
                {!inStock && (
                  <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center z-10">
                    <div className="bg-red-600 text-white px-4 py-2 rounded-lg font-bold text-lg shadow-lg">
                      OUT OF STOCK
                    </div>
                  </div>
                )}
                
                <CardImageFallback 
                  card={card}
                  size="normal"
                  className="w-full h-full"
                  showDebug={false}
                />
                
                <span className={`absolute bottom-3 left-3 px-2 py-1 rounded-full text-xs font-semibold ${
                  card.rarity === 'mythic' ? 'bg-orange-600 text-white' :
                  card.rarity === 'rare' ? 'bg-yellow-500 text-black' :
                  card.rarity === 'uncommon' ? 'bg-gray-500 text-white' :
                  'bg-gray-400 text-white'
                } z-10`}>
                  {card.rarity}
                </span>
                
                <div className="absolute top-3 right-3 bg-black/70 text-white px-2 py-1 rounded text-xs z-10">
                  {card.set || card.set_name}
                </div>
              </div>
              
              <div className="p-4">
                <div className="flex justify-between items-start mb-2">
                  <h3 className="font-bold text-base truncate pr-2 flex-1">{card.name}</h3>
                </div>
                
                <div className="text-xs text-gray-600 mb-2">
                  {card.setCode} • #{card.collector_number}
                </div>
                
                {/* Treatments */}
                <div className="flex flex-wrap gap-1 mb-2">
                  {card.promo && (
                    <span className="text-xs bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded">Promo</span>
                  )}
                  {card.fullArt && (
                    <span className="text-xs bg-green-100 text-green-700 px-1.5 py-0.5 rounded">Full Art</span>
                  )}
                  {card.showcase && (
                    <span className="text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded">Showcase</span>
                  )}
                </div>
                
                <p className="text-gray-600 text-sm mb-1 truncate">
                  {card.type || card.type_line}
                </p>
                
                {card.manaCost && (
                  <div className="text-gray-500 text-sm mb-3 flex items-center gap-1">
                    <span>Cost:</span>
                    <ManaCost cost={card.manaCost} size={16} />
                  </div>
                )}
                
                <div className="border-t pt-2">
                  <div className="flex justify-between items-center mb-2">
                    <div>
                      {inStock ? (
                        <>
                          <div className="font-bold text-lg text-green-600">
                            {formatPrice(nonfoilPrice)}
                          </div>
                          {foilPrice > 0 && (
                            <div className="text-xs text-blue-600 flex items-center gap-1">
                              <Sparkles size={10} />
                              Foil: {formatPrice(foilPrice)}
                            </div>
                          )}
                        </>
                      ) : (
                        <>
                          <div className="font-bold text-lg text-gray-500">
                            {formatPrice(nonfoilPrice)}
                          </div>
                          <div className="text-xs text-red-600 font-medium">Out of Stock</div>
                        </>
                      )}
                    </div>
                    {inStock && card.availableQuantity > 0 && (
                      <div className="text-xs text-gray-600">
                        {card.availableQuantity} available
                      </div>
                    )}
                  </div>
                  
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      if (inStock) {
                        onAddToCart(card);
                      }
                    }}
                    disabled={!inStock}
                    className={`w-full px-4 py-2 rounded-lg text-sm font-medium transition ${
                      inStock 
                        ? 'bg-blue-600 text-white hover:bg-blue-700' 
                        : 'bg-gray-400 text-white cursor-not-allowed'
                    }`}
                  >
                    {inStock ? 'Add to Cart' : 'Out of Stock'}
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );

  if (loading) {
    return (
      <div className="flex justify-center items-center py-12">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-gray-300 border-t-blue-500 rounded-full animate-spin mx-auto mb-4"></div>
          <div className="text-gray-600">Loading all versions...</div>
        </div>
      </div>
    );
  }

  if (displayCards.length === 0) {
    return (
      <div className="text-center py-12 text-gray-600">
        <AlertCircle size={48} className="mx-auto mb-4 opacity-50" />
        <div className="text-xl mb-2">No cards found</div>
        <div>Try adjusting your search or filters</div>
      </div>
    );
  }

  return (
    <div>
      {/* View mode toggle */}
      <div className="flex justify-between items-center mb-4">
        <div className="text-sm text-gray-600">
          {displayCards.length} versions found • {displayCards.filter(c => c.inStock).length} in stock
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-600">View:</span>
          <div className="flex items-center border rounded-lg overflow-hidden">
            <button
              onClick={() => setViewMode('list')}
              className={`p-2 ${viewMode === 'list' ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
              title="List view"
            >
              <List size={18} />
            </button>
            <button
              onClick={() => setViewMode('grid')}
              className={`p-2 ${viewMode === 'grid' ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
              title="Grid view"
            >
              <Grid size={18} />
            </button>
          </div>
        </div>
      </div>

      {/* Render selected view */}
      {viewMode === 'list' ? <ListView /> : <GridView />}
    </div>
  );
};

export default CardListView;