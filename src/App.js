// App.js - Simplified without complex image handling
import React, { useState, useEffect, useCallback } from 'react';
import { ShoppingCart, User, X, CheckCircle, AlertCircle, TrendingUp, Package, DollarSign, Eye, LogOut, BarChart, MessageSquare } from 'lucide-react';
import SellCardsPage from './components/SellCardsPage';
import AuthModal from './components/AuthModal';
import { AuthProvider, useAuth } from './context/AuthContext';
import UserDashboard from './components/UserDashboard';
import MessagingSystem from './components/MessagingSystem';
import OrderManagement from './components/OrderManagement';
import UserProfile from './components/UserProfile';
import CheckoutFlow from './components/CheckoutFlow';
import EnhancedCardModal from './components/EnhancedCardModal';
import EnhancedSearchBar from './components/EnhancedSearchBar';
import { ManaCost } from './components/ManaSymbols';
import CardListView from './components/CardListView';

// API configuration
const API_URL = 'http://localhost:5000/api';

// Main App Component wrapped with auth
function MTGMarketplaceContent() {
  const [searchTerm, setSearchTerm] = useState('');
  const [cards, setCards] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [cart, setCart] = useState([]);
  const [notification, setNotification] = useState({ show: false, message: '', type: 'success' });
  const [popularCards, setPopularCards] = useState([]);
  const [loadingPopular, setLoadingPopular] = useState(true);
  const [showSellPage, setShowSellPage] = useState(false);
  const [showVersionsModal, setShowVersionsModal] = useState(false);
  const [versionsCardName, setVersionsCardName] = useState('');
  const [selectedCard, setSelectedCard] = useState(null);
  const [versions, setVersions] = useState([]);
  const [loadingVersions, setLoadingVersions] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [showDashboard, setShowDashboard] = useState(false);
  const [showMessaging, setShowMessaging] = useState(false);
  const [showOrders, setShowOrders] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [profileUserId, setProfileUserId] = useState(null);
  const [showCheckout, setShowCheckout] = useState(false);

  // New state for enhanced search
  const [sortBy, setSortBy] = useState('relevance');
  const [filters, setFilters] = useState({
    inStockOnly: false,
    priceMin: '',
    priceMax: '',
    conditions: [],
    sets: [],
    rarity: [],
    colors: [],
    types: []
  });

  // Get auth context
  const { user, logout, isAuthenticated } = useAuth();

  // Setup global functions for navigation between components
  useEffect(() => {
    window.openDashboard = () => {
      setShowDashboard(true);
      window.dashboardNeedsRefresh = true;
    };
    
    window.navigateHome = () => {
      setShowSellPage(false);
      setShowDashboard(false);
      setShowOrders(false);
      setShowProfile(false);
      setShowCheckout(false);
      setShowMessaging(false);
    };

    window.clearCart = () => {
      setCart([]);
    };
    
    return () => {
      delete window.openDashboard;
      delete window.navigateHome;
      delete window.clearCart;
    };
  }, []);

  // Cleanup notification timeout on unmount
  useEffect(() => {
    return () => {
      if (window.notificationTimeout) {
        clearTimeout(window.notificationTimeout);
        window.notificationTimeout = null;
      }
    };
  }, []);

  // Fetch popular cards on mount
  useEffect(() => {
    fetchPopularCards();
  }, []);

  // Function to open profile
  const openUserProfile = (userId = null) => {
    setProfileUserId(userId);
    setShowProfile(true);
  };

  const fetchPopularCards = async () => {
    try {
      setLoadingPopular(true);
      
      const response = await fetch(`${API_URL}/cards/popular?includeImages=true`);
      
      if (response.ok) {
        const data = await response.json();
        setPopularCards(data.cards || []);
      } else {
        setPopularCards([]);
      }
    } catch (err) {
      console.error('Failed to fetch popular cards:', err);
      setPopularCards([]);
    } finally {
      setLoadingPopular(false);
    }
  };

  const searchCards = useCallback(async (query, sort = 'relevance', filterOptions = {}) => {
    if (!query || query.trim().length < 2) {
      setCards([]);
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);
    
    try {
      const params = new URLSearchParams({
        q: query,
        includeImages: 'true',
        sortBy: sort,
        searchTerm: filterOptions.searchTerm || query
      });

      if (filterOptions.priceMin) params.append('minPrice', filterOptions.priceMin);
      if (filterOptions.priceMax) params.append('maxPrice', filterOptions.priceMax);
      if (filterOptions.inStockOnly) params.append('inStock', 'true');
      
      const response = await fetch(`${API_URL}/cards/search?${params}`);
      
      if (!response.ok) {
        throw new Error(`Search failed: ${response.status}`);
      }

      const data = await response.json();
      setCards(data.cards || []);
      
      if (data.cards.length === 0) {
        setError(`No cards found for "${query}"`);
      }
    } catch (err) {
      console.error('Search error:', err);
      setError('Failed to search cards. Make sure the backend server is running on port 5000.');
      setCards([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleSearch = useCallback((term, sort, filterOptions) => {
    setSearchTerm(term);
    setSortBy(sort);
    setFilters(filterOptions);
    
    if (term) {
      searchCards(term, sort, filterOptions);
    } else {
      setCards([]);
    }
  }, [searchCards]);

  const formatPrice = (price) => {
    return new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' }).format(price);
  };

  const addToCart = (card) => {
    setCart(prev => [...prev, { ...card, cartId: Date.now() + Math.random() }]);
    
    if (window.notificationTimeout) {
      clearTimeout(window.notificationTimeout);
    }
    
    setNotification({ show: true, message: `Added ${card.name} to cart!`, type: 'success' });
    
    window.notificationTimeout = setTimeout(() => {
      setNotification({ show: false, message: '', type: 'success' });
      window.notificationTimeout = null;
    }, 3000);
  };

  const removeFromCart = (index) => {
    setCart(prev => prev.filter((_, i) => i !== index));
  };

  const handleViewVersions = async (cardName) => {
    setVersionsCardName(cardName);
    setShowVersionsModal(true);
    setLoadingVersions(true);
    
    try {
      const response = await fetch(
        `${API_URL}/cards/${encodeURIComponent(cardName)}/versions?includeImages=true`
      );
      const data = await response.json();
      setVersions(data.versions || []);
    } catch (error) {
      console.error('Failed to fetch versions:', error);
      setVersions([]);
    } finally {
      setLoadingVersions(false);
    }
  };

  const handleCardClick = (card) => {
    setSelectedCard(card);
  };

  const handleSellCardsClick = () => {
    if (!isAuthenticated) {
      setNotification({ 
        show: true, 
        message: 'Please login to sell cards',
        type: 'error'
      });
      setShowAuthModal(true);
      setTimeout(() => setNotification({ show: false, message: '', type: 'success' }), 3000);
      return;
    }
    setShowSellPage(true);
  };
  
  const handleDashboardClick = () => {
    if (!isAuthenticated) {
      setNotification({ 
        show: true, 
        message: 'Please login to access your dashboard',
        type: 'error'
      });
      setShowAuthModal(true);
      setTimeout(() => setNotification({ show: false, message: '', type: 'success' }), 3000);
      return;
    }
    setShowDashboard(true);
  };

  // Display either search results or popular cards
  const displayCards = searchTerm ? cards : popularCards;
  const isLoading = searchTerm ? loading : loadingPopular;
  
  // PAGE ROUTING
  if (showSellPage) {
    return <SellCardsPage onBack={() => setShowSellPage(false)} />;
  }

  if (showDashboard) {
    return <UserDashboard onBack={() => setShowDashboard(false)} needsRefresh={window.dashboardNeedsRefresh} />;
  }
  
  if (showOrders) {
    return <OrderManagement isCheckout={false} cartItems={cart} onClose={() => setShowOrders(false)} />;
  }

  if (showProfile) {
    return <UserProfile userId={profileUserId} onClose={() => setShowProfile(false)} />;
  }
  
  if (showCheckout) {
    return (
      <CheckoutFlow
        cartItems={cart}
        onSuccess={(order) => {
          setCart([]);
          setNotification({ 
            show: true, 
            message: `Order #${order.id} placed successfully!`,
            type: 'success'
          });
          setTimeout(() => setNotification({ show: false, message: '', type: 'success' }), 5000);
          setShowCheckout(false);
        }}
        onClose={() => setShowCheckout(false)}
      />
    );
  }

  // MAIN RETURN - Homepage view
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Notification */}
      {notification.show && (
        <div className={`fixed top-5 right-5 px-5 py-3 rounded-lg flex items-center gap-2 z-50 shadow-lg ${
          notification.type === 'error' ? 'bg-red-500' : 
          notification.type === 'info' ? 'bg-blue-500' : 'bg-green-500'
        } text-white`}>
          {notification.type === 'error' ? <AlertCircle size={20} /> : <CheckCircle size={20} />}
          {notification.message}
        </div>
      )}

      {/* Header */}
      <header className="bg-gradient-to-r from-blue-700 to-purple-600 text-white py-4 shadow-lg">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-2xl font-bold flex items-center gap-2">
                🎴 MTG Australia
              </h1>
              <p className="text-sm opacity-90">Australia's Premier Magic: The Gathering Marketplace</p>
            </div>
            
            <div className="flex items-center gap-4">
              <button 
                onClick={handleSellCardsClick}
                className="flex items-center gap-2 hover:bg-white/10 px-3 py-2 rounded-lg transition"
                data-sell-cards-button
              >
                <Package size={20} />
                <span className="hidden lg:inline">Sell Cards</span>
              </button>
              
              {isAuthenticated && (
                <>
                  <button 
                    onClick={() => setShowOrders(true)}
                    className="flex items-center gap-2 hover:bg-white/10 px-3 py-2 rounded-lg transition"
                  >
                    <Package size={20} />
                    <span className="hidden lg:inline">Orders</span>
                  </button>
                  
                  <button 
                    onClick={() => setShowMessaging(true)}
                    className="flex items-center gap-2 hover:bg-white/10 px-3 py-2 rounded-lg transition"
                  >
                    <MessageSquare size={20} />
                    <span className="hidden lg:inline">Messages</span>
                  </button>
                  
                  <button 
                    onClick={() => openUserProfile()}
                    className="flex items-center gap-2 hover:bg-white/10 px-3 py-2 rounded-lg transition"
                  >
                    <User size={20} />
                    <span className="hidden lg:inline">Profile</span>
                  </button>
                  
                  <button
                    onClick={handleDashboardClick}
                    className="flex items-center gap-2 hover:bg-white/10 px-3 py-2 rounded-lg transition"
                  >
                    <BarChart size={20} />
                    <span className="hidden lg:inline">Dashboard</span>
                  </button>
                </>
              )}
              
              <button
                onClick={() => {
                  if (cart.length === 0) {
                    setNotification({ show: true, message: 'Your cart is empty', type: 'info' });
                    setTimeout(() => setNotification({ show: false, message: '', type: 'success' }), 3000);
                  } else if (!isAuthenticated) {
                    setNotification({ show: true, message: 'Please login to checkout', type: 'error' });
                    setShowAuthModal(true);
                    setTimeout(() => setNotification({ show: false, message: '', type: 'success' }), 3000);
                  } else {
                    setShowCheckout(true);
                  }
                }}
                className="relative flex items-center gap-2 hover:bg-white/10 px-3 py-2 rounded-lg transition"
              >
                <ShoppingCart size={20} />
                {cart.length > 0 && (
                  <span className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full w-5 h-5 text-xs flex items-center justify-center font-bold">
                    {cart.length}
                  </span>
                )}
                <span className="hidden lg:inline">Cart</span>
              </button>
              
              {isAuthenticated ? (
                <div className="flex items-center gap-3 border-l pl-3 ml-2">
                  <span className="text-sm hidden md:inline">Hi, {user.username}!</span>
                  <button 
                    onClick={logout}
                    className="text-sm hover:bg-white/10 px-2 py-1 rounded transition"
                  >
                    <LogOut size={16} />
                  </button>
                </div>
              ) : (
                <button 
                  onClick={() => setShowAuthModal(true)}
                  className="flex items-center gap-2 hover:bg-white/10 px-3 py-2 rounded-lg transition"
                >
                  <User size={20} />
                  <span>Login</span>
                </button>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Hero Section - Only show when not searching */}
      {!searchTerm && (
        <div className="bg-gradient-to-b from-purple-600 to-blue-700 text-white py-12">
          <div className="max-w-7xl mx-auto px-4 text-center">
            <h2 className="text-4xl font-bold mb-4">Find Your Next Card</h2>
            <p className="text-xl opacity-90 mb-8">Search from millions of Magic cards with live pricing</p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-3xl mx-auto">
              <div className="bg-white/10 backdrop-blur rounded-lg p-4">
                <TrendingUp className="mx-auto mb-2" size={32} />
                <div className="font-bold text-lg">Live Prices</div>
                <div className="text-sm opacity-90">Real-time AUD pricing</div>
              </div>
              <div className="bg-white/10 backdrop-blur rounded-lg p-4">
                <Package className="mx-auto mb-2" size={32} />
                <div className="font-bold text-lg">User Marketplace</div>
                <div className="text-sm opacity-90">Buy & sell with locals</div>
              </div>
              <div className="bg-white/10 backdrop-blur rounded-lg p-4">
                <DollarSign className="mx-auto mb-2" size={32} />
                <div className="font-bold text-lg">Best Deals</div>
                <div className="text-sm opacity-90">Compare prices easily</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Enhanced Search Bar */}
      <EnhancedSearchBar
        onSearch={handleSearch}
        onSortChange={(sort) => {
          setSortBy(sort);
          if (searchTerm) {
            searchCards(searchTerm, sort, filters);
          }
        }}
        onFilterChange={(newFilters) => {
          setFilters(newFilters);
          if (searchTerm) {
            searchCards(searchTerm, sortBy, newFilters);
          }
        }}
        totalResults={cards.length}
        isLoading={loading}
        apiUrl={API_URL}
      />

      {/* Cards Display with CardListView */}
      <div className="max-w-7xl mx-auto p-8">
        {isLoading && (
          <div className="text-center py-12">
            <div className="w-12 h-12 border-4 border-gray-300 border-t-blue-500 rounded-full animate-spin mx-auto mb-4"></div>
            <div className="text-gray-600">Loading cards...</div>
          </div>
        )}

        {!isLoading && !error && displayCards.length > 0 && (
          <CardListView
            cards={displayCards}
            onAddToCart={addToCart}
            onViewVersions={handleViewVersions}
            onCardClick={handleCardClick}
            formatPrice={formatPrice}
            loading={isLoading}
          />
        )}

        {!isLoading && !error && displayCards.length === 0 && searchTerm && (
          <div className="text-center py-12 text-gray-600">
            <div className="text-5xl mb-4">🔍</div>
            <div className="text-xl mb-2">No cards found for "{searchTerm}"</div>
            <div>Try different search terms or check your spelling</div>
          </div>
        )}

        {!isLoading && !searchTerm && popularCards.length === 0 && (
          <div className="text-center py-12 text-gray-600">
            <div className="text-5xl mb-4">🎴</div>
            <div className="text-xl mb-2">Loading popular cards...</div>
            <div>Please wait while we fetch the latest cards</div>
          </div>
        )}

        {error && (
          <div className="text-center py-12">
            <div className="text-5xl mb-4">⚠️</div>
            <div className="text-xl text-red-600 mb-2">Error loading cards</div>
            <div className="text-gray-600">{error}</div>
            <button 
              onClick={() => {
                setError(null);
                if (searchTerm) {
                  searchCards(searchTerm, sortBy, filters);
                } else {
                  fetchPopularCards();
                }
              }}
              className="mt-4 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
            >
              Try Again
            </button>
          </div>
        )}
      </div>

      {/* Cart Sidebar */}
      {cart.length > 0 && (
        <div className="fixed bottom-4 right-4 bg-white rounded-xl shadow-2xl p-4 w-80 max-w-[calc(100vw-2rem)] z-40">
          <div className="flex justify-between items-center mb-3">
            <h3 className="font-semibold flex items-center gap-2">
              <ShoppingCart size={20} /> Cart
            </h3>
            <span className="bg-green-500 text-white text-xs px-2 py-1 rounded-full">
              {cart.length} {cart.length === 1 ? 'item' : 'items'}
            </span>
          </div>
          
          <div className="max-h-48 overflow-y-auto mb-4">
            {cart.map((item, index) => (
              <div key={item.cartId} className="flex justify-between items-center mb-2 p-2 bg-gray-50 rounded hover:bg-gray-100 transition">
                <span className="font-medium text-sm truncate flex-1 pr-2">{item.name}</span>
                <span className="font-bold text-sm mr-2">{formatPrice(item.price)}</span>
                <button
                  onClick={() => removeFromCart(index)}
                  className="bg-red-500 text-white rounded w-6 h-6 flex items-center justify-center hover:bg-red-600 transition-colors"
                >
                  <X size={14} />
                </button>
              </div>
            ))}
          </div>
          
          <div className="border-t pt-3">
            <div className="flex justify-between mb-3">
              <span className="font-semibold">Total:</span>
              <span className="font-bold text-lg text-green-600">
                {formatPrice(cart.reduce((sum, item) => sum + parseFloat(item.price), 0))}
              </span>
            </div>
            <button 
              onClick={() => {
                if (!isAuthenticated) {
                  setNotification({ show: true, message: 'Please login to checkout', type: 'error' });
                  setShowAuthModal(true);
                  setTimeout(() => setNotification({ show: false, message: '', type: 'success' }), 3000);
                } else if (cart.length === 0) {
                  setNotification({ show: true, message: 'Your cart is empty', type: 'error' });
                  setTimeout(() => setNotification({ show: false, message: '', type: 'success' }), 3000);
                } else {
                  setShowCheckout(true);
                }
              }}
              className="w-full bg-green-500 text-white py-3 rounded-lg font-medium hover:bg-green-600 transition-colors"
            >
              Proceed to Checkout
            </button>
          </div>
        </div>
      )}
      
      {/* Messaging Modal */}
      {showMessaging && (
        <MessagingSystem
          isOpen={showMessaging}
          onClose={() => setShowMessaging(false)}
        />
      )}

      {/* Versions Modal */}
      {showVersionsModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-6xl w-full max-h-[90vh] overflow-hidden">
            <div className="p-4 border-b bg-gradient-to-r from-blue-50 to-purple-50">
              <div className="flex justify-between items-center">
                <h2 className="text-2xl font-bold">All Versions of {versionsCardName}</h2>
                <button onClick={() => setShowVersionsModal(false)} className="p-1 hover:bg-white rounded">
                  <X size={24} />
                </button>
              </div>
              <div className="text-sm text-gray-600 mt-2">
                {versions.length} versions found
              </div>
            </div>
            
            <div className="p-4 overflow-y-auto" style={{ maxHeight: 'calc(90vh - 120px)' }}>
              {loadingVersions ? (
                <div className="text-center py-8">
                  <div className="w-8 h-8 border-4 border-gray-300 border-t-blue-500 rounded-full animate-spin mx-auto mb-4"></div>
                  <div>Loading versions...</div>
                </div>
              ) : (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                  {versions.map(version => (
                    <div
                      key={version.id}
                      className="border rounded-lg p-3 hover:shadow-lg transition cursor-pointer"
                      onClick={() => {
                        addToCart(version);
                        setShowVersionsModal(false);
                      }}
                    >
                      <img
                        src={version.imageUrl || version.image_url || 'https://cards.scryfall.io/back.png'}
                        alt={version.name}
                        className="w-full rounded mb-2"
                        onError={(e) => {
                          e.target.onerror = null;
                          e.target.src = 'https://cards.scryfall.io/back.png';
                        }}
                      />
                      <div className="text-xs font-bold">{version.set}</div>
                      <div className="text-xs text-gray-600">#{version.collector_number}</div>
                      <div className="text-xs text-gray-500">{version.released_at}</div>
                      
                      <div className="flex flex-wrap gap-1 mt-2">
                        {version.promo && <span className="text-xs bg-purple-100 px-1 rounded">Promo</span>}
                        {version.fullArt && <span className="text-xs bg-green-100 px-1 rounded">Full Art</span>}
                        {version.showcase && <span className="text-xs bg-blue-100 px-1 rounded">Showcase</span>}
                        {version.extendedArt && <span className="text-xs bg-yellow-100 px-1 rounded">Extended</span>}
                      </div>
                      
                      <div className="mt-2">
                        <div className="font-bold text-green-600">
                          {formatPrice(version.prices?.aud || 0)}
                        </div>
                        {version.prices?.aud_foil && version.prices.aud_foil !== '0.00' && (
                          <div className="text-xs text-gray-600">
                            Foil: {formatPrice(version.prices.aud_foil)}
                          </div>
                        )}
                      </div>
                      
                      <button className="w-full mt-2 bg-blue-600 text-white text-xs py-1 rounded hover:bg-blue-700">
                        Add to Cart
                      </button>
                    </div>
                  ))}
                </div>
              )}
              {!loadingVersions && versions.length === 0 && (
                <div className="text-center py-8 text-gray-600">
                  No versions found. Try searching for the card first.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Enhanced Card Detail Modal */}
      {selectedCard && (
        <EnhancedCardModal
          selectedCard={selectedCard}
          onClose={() => setSelectedCard(null)}
          onAddToCart={addToCart}
          onViewVersions={handleViewVersions}
          formatPrice={formatPrice}
        />
      )}

      {/* Auth Modal */}
      {showAuthModal && <AuthModal onClose={() => setShowAuthModal(false)} />}
    </div>
  );
}

// Main App Component with Auth Provider
function MTGMarketplace() {
  return (
    <AuthProvider>
      <MTGMarketplaceContent />
    </AuthProvider>
  );
}

export default MTGMarketplace;