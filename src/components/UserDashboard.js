// src/components/UserDashboard.js
import React, { useState, useEffect, useCallback } from 'react';
import { 
  Package, 
  DollarSign, 
  TrendingUp, 
  Edit2, 
  Trash2, 
  Eye, 
  EyeOff,
  Search,
  Filter,
  X,
  CheckCircle,
  AlertCircle,
  Clock,
  Archive,
  BarChart,
  Users,
  Star,
  MessageSquare,
  RefreshCw,
  Download,
  Upload,
  Settings,
  Bell,
  ShoppingCart,
  Target,
  Activity,
  Zap,
  Calendar,
  ArrowUp,
  ArrowDown,
  Camera,
  FileText,
  TrendingDown,
  ChevronRight,
  Info,
  CreditCard,
  Percent,
  Shield
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const API_URL = 'http://localhost:5000/api';

function UserDashboard({ onBack, needsRefresh }) {
  const { user } = useAuth();
  
  // Main state
  const [activeTab, setActiveTab] = useState('overview');
  const [activeListingTab, setActiveListingTab] = useState('active');
  const [listings, setListings] = useState([]);
  const [filteredListings, setFilteredListings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  
  // Enhanced stats
  const [stats, setStats] = useState({
    totalListings: 0,
    activeListings: 0,
    soldListings: 0,
    totalRevenue: 0,
    avgPrice: 0,
    totalViews: 0,
    conversionRate: 0,
    avgResponseTime: '< 2 hrs',
    repeatBuyers: 0,
    totalOrders: 0,
    pendingOrders: 0,
    monthlyRevenue: 0,
    monthlyGrowth: 0,
    watchlistAdditions: 0
  });

  // Analytics data
  const [priceAnalytics, setPriceAnalytics] = useState([]);
  const [salesHistory, setSalesHistory] = useState([]);
  const [topPerformers, setTopPerformers] = useState([]);
  const [recentActivity, setRecentActivity] = useState([]);
  
  // Filters and search
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCondition, setFilterCondition] = useState('all');
  const [sortBy, setSortBy] = useState('date-desc');
  const [dateRange, setDateRange] = useState('30days');
  
  // Modals
  const [showEditModal, setShowEditModal] = useState(false);
  const [showBulkUpload, setShowBulkUpload] = useState(false);
  const [showPricingTool, setShowPricingTool] = useState(false);
  const [editingListing, setEditingListing] = useState(null);
  
  // Notifications
  const [notification, setNotification] = useState({ show: false, message: '', type: 'success' });
  const [alerts, setAlerts] = useState([]);

  // Fetch user listings
  const fetchUserListings = async () => {
    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${API_URL}/listings/user`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        console.log('Fetched listings:', data.listings?.length || 0);
        
        if (data.listings && data.listings.length > 0) {
          setListings(data.listings);
        } else {
          // Check if this is a new user with no listings yet
          console.log('No listings found for user');
          setListings([]);
        }
      } else {
        console.error('Failed to fetch listings, status:', response.status);
        setListings([]);
      }
    } catch (error) {
      console.error('Failed to fetch listings:', error);
      setListings([]);
    }
  };

  // Fetch dashboard stats
  const fetchDashboardStats = async () => {
    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${API_URL}/dashboard/stats`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        setStats(prev => ({
          ...prev,
          ...data,
          totalListings: listings.length,
          activeListings: listings.filter(l => l.status === 'active').length,
          soldListings: listings.filter(l => l.status === 'sold').length
        }));
      }
    } catch (error) {
      console.error('Failed to fetch stats:', error);
    }
  };

  // Main data fetch function
  const fetchDashboardData = async () => {
    console.log('Fetching dashboard data...');
    setLoading(true);
    
    try {
      await fetchUserListings();
      await fetchDashboardStats();
      showNotification('Dashboard data loaded', 'success');
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
      showNotification('Failed to load some data', 'error');
    } finally {
      setLoading(false);
    }
  };

  // Fetch recent activity
  const fetchRecentActivity = async () => {
    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${API_URL}/dashboard/activity`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (response.ok) {
        const data = await response.json();
        setRecentActivity(data.activity || []);
        if (data.alerts && data.alerts.length > 0) {
          setAlerts(data.alerts);
        }
      }
    } catch (error) {
      console.error('Failed to fetch activity:', error);
    }
  };

  // Initial load - fetch data when component mounts
  useEffect(() => {
    console.log('UserDashboard mounted, checking for refresh needs...');
    
    // Always fetch fresh data on mount
    fetchDashboardData();
    
    // Check if we need to refresh from another component
    if (window.dashboardNeedsRefresh) {
      console.log('Dashboard refresh flag detected!');
      window.dashboardNeedsRefresh = false;
    }
    
    // Set up activity polling
    const interval = setInterval(fetchRecentActivity, 30000);
    return () => clearInterval(interval);
  }, []); // Empty dependency array - only run on mount

  // Watch for refresh needs from props
  useEffect(() => {
    if (needsRefresh) {
      console.log('Refresh needed from props');
      handleRefresh();
    }
  }, [needsRefresh]);

  // Check for refresh flag on every render
  useEffect(() => {
    if (window.dashboardNeedsRefresh) {
      console.log('Global refresh flag detected, refreshing dashboard...');
      fetchDashboardData().then(() => {
        window.dashboardNeedsRefresh = false;
      });
    }
  });

  // Filter and sort listings whenever dependencies change
  useEffect(() => {
    filterAndSortListings();
  }, [listings, searchTerm, filterCondition, sortBy, activeListingTab]);

  // Update stats when listings change
  useEffect(() => {
    setStats(prev => ({
      ...prev,
      totalListings: listings.length,
      activeListings: listings.filter(l => l.status === 'active').length,
      soldListings: listings.filter(l => l.status === 'sold').length,
      totalViews: listings.reduce((sum, l) => sum + (l.views || 0), 0)
    }));
  }, [listings]);

  const handleRefresh = async () => {
    setRefreshing(true);
    showNotification('Refreshing dashboard...', 'info');
    await fetchDashboardData();
    showNotification('Dashboard updated', 'success');
    setRefreshing(false);
  };

  const filterAndSortListings = () => {
    let filtered = [...listings];

    // Filter by status tab
    if (activeListingTab !== 'all') {
      filtered = filtered.filter(l => l.status === activeListingTab);
    }

    // Search filter
    if (searchTerm) {
      filtered = filtered.filter(l => 
        l.card_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        l.set?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        l.set_name?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Condition filter
    if (filterCondition !== 'all') {
      filtered = filtered.filter(l => l.condition === filterCondition);
    }

    // Sorting
    switch (sortBy) {
      case 'date-desc':
        filtered.sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));
        break;
      case 'date-asc':
        filtered.sort((a, b) => new Date(a.created_at || 0) - new Date(b.created_at || 0));
        break;
      case 'price-desc':
        filtered.sort((a, b) => (b.price || 0) - (a.price || 0));
        break;
      case 'price-asc':
        filtered.sort((a, b) => (a.price || 0) - (b.price || 0));
        break;
      case 'views':
        filtered.sort((a, b) => (b.views || 0) - (a.views || 0));
        break;
      case 'watchers':
        filtered.sort((a, b) => (b.watchers || 0) - (a.watchers || 0));
        break;
    }

    setFilteredListings(filtered);
  };

  const handleEditListing = (listing) => {
    setEditingListing({ ...listing });
    setShowEditModal(true);
  };

  const handleUpdateListing = async () => {
    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${API_URL}/listings/${editingListing.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(editingListing)
      });

      if (response.ok) {
        setListings(prev => prev.map(l => 
          l.id === editingListing.id ? editingListing : l
        ));
        showNotification('Listing updated successfully', 'success');
        setShowEditModal(false);
      } else {
        showNotification('Failed to update listing', 'error');
      }
    } catch (error) {
      console.error('Failed to update listing:', error);
      showNotification('Failed to update listing', 'error');
    }
  };

  const handleDeleteListing = async (id) => {
    if (!window.confirm('Are you sure you want to delete this listing?')) return;

    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${API_URL}/listings/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (response.ok) {
        setListings(prev => prev.filter(l => l.id !== id));
        showNotification('Listing deleted successfully', 'success');
      } else {
        showNotification('Failed to delete listing', 'error');
      }
    } catch (error) {
      showNotification('Failed to delete listing', 'error');
    }
  };

  const handleTogglePause = async (listing) => {
    const newStatus = listing.status === 'active' ? 'paused' : 'active';
    
    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${API_URL}/listings/${listing.id}/status`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ status: newStatus })
      });

      if (response.ok) {
        setListings(prev => prev.map(l => 
          l.id === listing.id ? { ...l, status: newStatus } : l
        ));
        showNotification(
          `Listing ${newStatus === 'active' ? 'activated' : 'paused'}`,
          'success'
        );
      } else {
        showNotification('Failed to update status', 'error');
      }
    } catch (error) {
      showNotification('Failed to update status', 'error');
    }
  };

  const exportData = async (format) => {
    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${API_URL}/dashboard/export?format=${format}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `dashboard-export-${Date.now()}.${format}`;
        a.click();
        showNotification('Export completed', 'success');
      }
    } catch (error) {
      showNotification('Export failed', 'error');
    }
  };

  const showNotification = (message, type = 'success') => {
    setNotification({ show: true, message, type });
    setTimeout(() => setNotification({ show: false, message: '', type: 'success' }), 3000);
  };

  const formatPrice = (price) => {
    return new Intl.NumberFormat('en-AU', { 
      style: 'currency', 
      currency: 'AUD' 
    }).format(price || 0);
  };

  const getStatusColor = (status) => {
    const colors = {
      'active': 'bg-green-100 text-green-800',
      'sold': 'bg-blue-100 text-blue-800',
      'paused': 'bg-yellow-100 text-yellow-800',
      'expired': 'bg-gray-100 text-gray-800'
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
  };

  const getConditionColor = (condition) => {
    const colors = {
      'NM': 'bg-green-50 text-green-700 border-green-200',
      'LP': 'bg-blue-50 text-blue-700 border-blue-200',
      'MP': 'bg-yellow-50 text-yellow-700 border-yellow-200',
      'HP': 'bg-orange-50 text-orange-700 border-orange-200',
      'DMG': 'bg-red-50 text-red-700 border-red-200'
    };
    return colors[condition] || 'bg-gray-50 text-gray-700 border-gray-200';
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Notification */}
      {notification.show && (
        <div className={`fixed top-5 right-5 px-5 py-3 rounded-lg flex items-center gap-2 z-50 shadow-lg ${
          notification.type === 'error' ? 'bg-red-500' : 
          notification.type === 'info' ? 'bg-blue-500' : 'bg-green-500'
        } text-white`}>
          {notification.type === 'error' ? <AlertCircle size={20} /> : 
           notification.type === 'info' ? <Info size={20} /> : <CheckCircle size={20} />}
          {notification.message}
        </div>
      )}

      <div className="max-w-7xl mx-auto p-6">
        {/* Header */}
        <div className="mb-6">
          <div className="flex justify-between items-center mb-4">
            <button 
              onClick={onBack}
              className="text-blue-600 hover:text-blue-800 flex items-center gap-2"
            >
              ← Back to Marketplace
            </button>
            
            <div className="flex gap-2">
              <button
                onClick={handleRefresh}
                disabled={refreshing || loading}
                className="px-3 py-1.5 border rounded-lg hover:bg-gray-50 flex items-center gap-2"
              >
                <RefreshCw size={16} className={refreshing ? 'animate-spin' : ''} />
                Refresh
              </button>
              <button
                onClick={() => exportData('csv')}
                className="px-3 py-1.5 border rounded-lg hover:bg-gray-50 flex items-center gap-2"
              >
                <Download size={16} />
                Export
              </button>
              <button
                onClick={() => {
                  // Navigate to sell cards page
                  if (window.navigateHome) {
                    window.navigateHome();
                    setTimeout(() => {
                      const sellButton = document.querySelector('[data-sell-cards-button]');
                      if (sellButton) sellButton.click();
                    }, 100);
                  }
                }}
                className="px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2"
              >
                <Upload size={16} />
                Add Listings
              </button>
            </div>
          </div>
          
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold">Seller Dashboard</h1>
              <p className="text-gray-600 mt-1">
                Welcome back, {user?.username || 'Seller'}! 
                {listings.length === 0 && ' Start by adding some listings.'}
              </p>
            </div>
            <div className="text-right">
              <div className="text-sm text-gray-600">Seller Rating</div>
              <div className="flex items-center gap-1">
                {[...Array(5)].map((_, i) => (
                  <Star 
                    key={i} 
                    size={16} 
                    className={i < Math.floor(user?.seller_rating || 4.5) ? 
                      'fill-yellow-400 text-yellow-400' : 'text-gray-300'}
                  />
                ))}
                <span className="text-sm ml-1">{user?.seller_rating || 4.5}</span>
              </div>
              <div className="text-xs text-gray-500 mt-1">
                {stats.totalListings} listings • {stats.activeListings} active
              </div>
            </div>
          </div>
        </div>

        {/* Main Tabs */}
        <div className="bg-white rounded-lg shadow mb-6">
          <div className="border-b">
            <div className="flex">
              <button
                onClick={() => setActiveTab('overview')}
                className={`px-6 py-3 font-medium ${
                  activeTab === 'overview' 
                    ? 'text-blue-600 border-b-2 border-blue-600' 
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Overview
              </button>
              <button
                onClick={() => setActiveTab('listings')}
                className={`px-6 py-3 font-medium ${
                  activeTab === 'listings' 
                    ? 'text-blue-600 border-b-2 border-blue-600' 
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Listings ({listings.length})
              </button>
              <button
                onClick={() => setActiveTab('analytics')}
                className={`px-6 py-3 font-medium ${
                  activeTab === 'analytics' 
                    ? 'text-blue-600 border-b-2 border-blue-600' 
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Analytics
              </button>
              <button
                onClick={() => setActiveTab('tools')}
                className={`px-6 py-3 font-medium ${
                  activeTab === 'tools' 
                    ? 'text-blue-600 border-b-2 border-blue-600' 
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Tools
              </button>
            </div>
          </div>

          <div className="p-6">
            {/* Overview Tab */}
            {activeTab === 'overview' && (
              <div className="space-y-6">
                {/* Stats Grid */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2">
                      <DollarSign className="text-green-600" size={20} />
                      <span className={`text-xs flex items-center gap-1 ${
                        stats.monthlyGrowth > 0 ? 'text-green-600' : 'text-red-600'
                      }`}>
                        {stats.monthlyGrowth > 0 ? <ArrowUp size={12} /> : <ArrowDown size={12} />}
                        {Math.abs(stats.monthlyGrowth)}%
                      </span>
                    </div>
                    <div className="text-2xl font-bold">{formatPrice(stats.monthlyRevenue)}</div>
                    <div className="text-xs text-gray-600">Monthly Revenue</div>
                  </div>
                  
                  <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2">
                      <Package className="text-blue-600" size={20} />
                      <span className="text-xs text-gray-500">{stats.activeListings} active</span>
                    </div>
                    <div className="text-2xl font-bold">{stats.totalListings}</div>
                    <div className="text-xs text-gray-600">Total Listings</div>
                  </div>
                  
                  <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2">
                      <Eye className="text-purple-600" size={20} />
                      <span className="text-xs text-green-600">+{stats.watchlistAdditions} today</span>
                    </div>
                    <div className="text-2xl font-bold">{stats.totalViews}</div>
                    <div className="text-xs text-gray-600">Total Views</div>
                  </div>
                  
                  <div className="bg-gradient-to-br from-orange-50 to-orange-100 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2">
                      <Target className="text-orange-600" size={20} />
                      <span className="text-xs text-gray-500">{stats.avgResponseTime}</span>
                    </div>
                    <div className="text-2xl font-bold">{stats.conversionRate}%</div>
                    <div className="text-xs text-gray-600">Conversion Rate</div>
                  </div>
                </div>

                {/* Quick Actions Grid */}
                <div className="grid md:grid-cols-3 gap-4">
                  <div className="bg-white border rounded-lg p-4">
                    <h3 className="font-semibold mb-3 flex items-center gap-2">
                      <MessageSquare size={18} />
                      Recent Messages
                    </h3>
                    {listings.length > 0 ? (
                      <div className="space-y-2 text-sm">
                        <div className="p-2 bg-gray-50 rounded">
                          <div className="font-medium">System</div>
                          <div className="text-xs text-gray-600">Your listings are now live!</div>
                        </div>
                      </div>
                    ) : (
                      <div className="text-sm text-gray-500">No messages yet</div>
                    )}
                  </div>

                  <div className="bg-white border rounded-lg p-4">
                    <h3 className="font-semibold mb-3 flex items-center gap-2">
                      <TrendingUp size={18} />
                      Top Performing
                    </h3>
                    {listings.filter(l => l.status === 'active').length > 0 ? (
                      <div className="space-y-2 text-sm">
                        {listings
                          .filter(l => l.status === 'active')
                          .sort((a, b) => (b.views || 0) - (a.views || 0))
                          .slice(0, 3)
                          .map(listing => (
                            <div key={listing.id} className="flex justify-between items-center">
                              <span className="truncate">{listing.card_name}</span>
                              <span className="text-xs text-gray-600">{listing.views || 0} views</span>
                            </div>
                          ))}
                      </div>
                    ) : (
                      <div className="text-sm text-gray-500">No active listings yet</div>
                    )}
                  </div>

                  <div className="bg-white border rounded-lg p-4">
                    <h3 className="font-semibold mb-3 flex items-center gap-2">
                      <Activity size={18} />
                      Recent Activity
                    </h3>
                    {listings.length > 0 ? (
                      <div className="space-y-2 text-sm">
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                          <span className="text-xs text-gray-600">{listings.length} new listings added</span>
                        </div>
                      </div>
                    ) : (
                      <div className="text-sm text-gray-500">No recent activity</div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Listings Tab */}
            {activeTab === 'listings' && (
              <div>
                {/* Listing Tabs */}
                <div className="flex gap-4 mb-4">
                  <button
                    onClick={() => setActiveListingTab('active')}
                    className={`px-3 py-1 rounded ${
                      activeListingTab === 'active' 
                        ? 'bg-blue-100 text-blue-600' 
                        : 'text-gray-600 hover:bg-gray-100'
                    }`}
                  >
                    Active ({listings.filter(l => l.status === 'active').length})
                  </button>
                  <button
                    onClick={() => setActiveListingTab('sold')}
                    className={`px-3 py-1 rounded ${
                      activeListingTab === 'sold' 
                        ? 'bg-blue-100 text-blue-600' 
                        : 'text-gray-600 hover:bg-gray-100'
                    }`}
                  >
                    Sold ({listings.filter(l => l.status === 'sold').length})
                  </button>
                  <button
                    onClick={() => setActiveListingTab('paused')}
                    className={`px-3 py-1 rounded ${
                      activeListingTab === 'paused' 
                        ? 'bg-blue-100 text-blue-600' 
                        : 'text-gray-600 hover:bg-gray-100'
                    }`}
                  >
                    Paused ({listings.filter(l => l.status === 'paused').length})
                  </button>
                  <button
                    onClick={() => setActiveListingTab('all')}
                    className={`px-3 py-1 rounded ${
                      activeListingTab === 'all' 
                        ? 'bg-blue-100 text-blue-600' 
                        : 'text-gray-600 hover:bg-gray-100'
                    }`}
                  >
                    All ({listings.length})
                  </button>
                </div>

                {/* Search and Filters */}
                <div className="flex gap-3 mb-4">
                  <div className="flex-1 relative">
                    <Search className="absolute left-3 top-3 text-gray-400" size={18} />
                    <input
                      type="text"
                      placeholder="Search listings..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="w-full pl-10 pr-3 py-2 border rounded-lg"
                    />
                  </div>
                  
                  <select
                    value={filterCondition}
                    onChange={(e) => setFilterCondition(e.target.value)}
                    className="px-3 py-2 border rounded-lg"
                  >
                    <option value="all">All Conditions</option>
                    <option value="NM">Near Mint</option>
                    <option value="LP">Lightly Played</option>
                    <option value="MP">Moderately Played</option>
                    <option value="HP">Heavily Played</option>
                    <option value="DMG">Damaged</option>
                  </select>
                  
                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value)}
                    className="px-3 py-2 border rounded-lg"
                  >
                    <option value="date-desc">Newest First</option>
                    <option value="date-asc">Oldest First</option>
                    <option value="price-desc">Price: High to Low</option>
                    <option value="price-asc">Price: Low to High</option>
                    <option value="views">Most Viewed</option>
                    <option value="watchers">Most Watched</option>
                  </select>
                </div>

                {/* Listings Table */}
                <div className="overflow-x-auto">
                  {loading ? (
                    <div className="p-8 text-center">
                      <div className="w-8 h-8 border-4 border-gray-300 border-t-blue-500 rounded-full animate-spin mx-auto mb-4"></div>
                      <div>Loading listings...</div>
                    </div>
                  ) : filteredListings.length === 0 ? (
                    <div className="p-8 text-center text-gray-500">
                      <Package size={48} className="mx-auto mb-4 opacity-50" />
                      <div className="text-lg mb-2">No listings found</div>
                      {listings.length === 0 ? (
                        <div>
                          <p className="mb-4">Start selling cards to see them here!</p>
                          <button
                            onClick={() => {
                              if (window.navigateHome) {
                                window.navigateHome();
                                setTimeout(() => {
                                  const sellButton = document.querySelector('[data-sell-cards-button]');
                                  if (sellButton) sellButton.click();
                                }, 100);
                              }
                            }}
                            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                          >
                            Add Your First Listing
                          </button>
                        </div>
                      ) : (
                        <p>Try adjusting your filters</p>
                      )}
                    </div>
                  ) : (
                    <table className="w-full">
                      <thead className="bg-gray-50 border-b">
                        <tr>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase">Card</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase">Set</th>
                          <th className="px-4 py-3 text-center text-xs font-medium text-gray-600 uppercase">Condition</th>
                          <th className="px-4 py-3 text-center text-xs font-medium text-gray-600 uppercase">Qty</th>
                          <th className="px-4 py-3 text-right text-xs font-medium text-gray-600 uppercase">Price</th>
                          <th className="px-4 py-3 text-center text-xs font-medium text-gray-600 uppercase">Status</th>
                          <th className="px-4 py-3 text-center text-xs font-medium text-gray-600 uppercase">Views</th>
                          <th className="px-4 py-3 text-center text-xs font-medium text-gray-600 uppercase">Watchers</th>
                          <th className="px-4 py-3 text-center text-xs font-medium text-gray-600 uppercase">Date</th>
                          <th className="px-4 py-3 text-center text-xs font-medium text-gray-600 uppercase">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {filteredListings.map((listing) => (
                          <tr key={listing.id} className="hover:bg-gray-50 transition">
                            <td className="px-4 py-3">
                              <div className="font-medium">{listing.card_name}</div>
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-600">
                              {listing.set_name || listing.set || 'Unknown Set'}
                            </td>
                            <td className="px-4 py-3 text-center">
                              <span className={`px-2 py-1 text-xs rounded border ${getConditionColor(listing.condition)}`}>
                                {listing.condition}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-center">{listing.quantity}</td>
                            <td className="px-4 py-3 text-right font-medium">{formatPrice(listing.price)}</td>
                            <td className="px-4 py-3 text-center">
                              <span className={`px-2 py-1 text-xs rounded-full ${getStatusColor(listing.status)}`}>
                                {listing.status}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-center">
                              <div className="flex items-center justify-center gap-1">
                                <Eye size={14} className="text-gray-400" />
                                <span className="text-sm">{listing.views || 0}</span>
                              </div>
                            </td>
                            <td className="px-4 py-3 text-center">
                              <div className="flex items-center justify-center gap-1">
                                <Users size={14} className="text-gray-400" />
                                <span className="text-sm">{listing.watchers || 0}</span>
                              </div>
                            </td>
                            <td className="px-4 py-3 text-center text-sm text-gray-600">
                              {new Date(listing.created_at).toLocaleDateString()}
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex items-center justify-center gap-1">
                                {listing.status !== 'sold' && (
                                  <>
                                    <button
                                      onClick={() => handleEditListing(listing)}
                                      className="p-1 hover:bg-blue-100 rounded text-blue-600"
                                      title="Edit"
                                    >
                                      <Edit2 size={16} />
                                    </button>
                                    <button
                                      onClick={() => handleTogglePause(listing)}
                                      className="p-1 hover:bg-yellow-100 rounded text-yellow-600"
                                      title={listing.status === 'active' ? 'Pause' : 'Activate'}
                                    >
                                      {listing.status === 'active' ? <EyeOff size={16} /> : <Eye size={16} />}
                                    </button>
                                  </>
                                )}
                                <button
                                  onClick={() => handleDeleteListing(listing.id)}
                                  className="p-1 hover:bg-red-100 rounded text-red-600"
                                  title="Delete"
                                >
                                  <Trash2 size={16} />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>
            )}

            {/* Analytics Tab */}
            {activeTab === 'analytics' && (
              <div className="space-y-6">
                <div className="grid md:grid-cols-2 gap-6">
                  <div className="bg-white border rounded-lg p-4">
                    <h3 className="font-semibold mb-4">Revenue Trend</h3>
                    <div className="h-64 bg-gray-50 rounded flex items-center justify-center text-gray-400">
                      <BarChart size={48} />
                      <span className="ml-2">Chart visualization coming soon</span>
                    </div>
                  </div>
                  
                  <div className="bg-white border rounded-lg p-4">
                    <h3 className="font-semibold mb-4">Performance Metrics</h3>
                    <div className="space-y-3">
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-600">Total Listings</span>
                        <span className="font-medium">{stats.totalListings}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-600">Active Listings</span>
                        <span className="font-medium">{stats.activeListings}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-600">Total Views</span>
                        <span className="font-medium">{stats.totalViews}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-600">Average Price</span>
                        <span className="font-medium">{formatPrice(stats.avgPrice)}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Tools Tab */}
            {activeTab === 'tools' && (
              <div className="grid md:grid-cols-3 gap-6">
                <button
                  className="bg-white border rounded-lg p-6 hover:shadow-lg transition text-left"
                >
                  <DollarSign className="text-blue-600 mb-3" size={24} />
                  <h3 className="font-semibold mb-2">Pricing Tool</h3>
                  <p className="text-sm text-gray-600">Automatically adjust prices based on market conditions</p>
                </button>
                
                <button
                  onClick={() => {
                    if (window.navigateHome) {
                      window.navigateHome();
                      setTimeout(() => {
                        const sellButton = document.querySelector('[data-sell-cards-button]');
                        if (sellButton) sellButton.click();
                      }, 100);
                    }
                  }}
                  className="bg-white border rounded-lg p-6 hover:shadow-lg transition text-left"
                >
                  <Upload className="text-green-600 mb-3" size={24} />
                  <h3 className="font-semibold mb-2">Bulk Upload</h3>
                  <p className="text-sm text-gray-600">Import multiple cards from CSV or text format</p>
                </button>
                
                <button
                  className="bg-white border rounded-lg p-6 hover:shadow-lg transition text-left"
                >
                  <FileText className="text-indigo-600 mb-3" size={24} />
                  <h3 className="font-semibold mb-2">Reports</h3>
                  <p className="text-sm text-gray-600">Generate sales and tax reports</p>
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Edit Modal */}
        {showEditModal && editingListing && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl max-w-md w-full">
              <div className="p-6 border-b">
                <div className="flex justify-between items-center">
                  <h2 className="text-xl font-bold">Edit Listing</h2>
                  <button
                    onClick={() => setShowEditModal(false)}
                    className="p-1 hover:bg-gray-100 rounded"
                  >
                    <X size={24} />
                  </button>
                </div>
              </div>

              <div className="p-6">
                <div className="mb-4">
                  <label className="block text-sm font-medium mb-2">Card Name</label>
                  <input
                    type="text"
                    value={editingListing.card_name}
                    disabled
                    className="w-full px-3 py-2 border rounded-lg bg-gray-50"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div>
                    <label className="block text-sm font-medium mb-2">Condition</label>
                    <select
                      value={editingListing.condition}
                      onChange={(e) => setEditingListing({...editingListing, condition: e.target.value})}
                      className="w-full px-3 py-2 border rounded-lg"
                    >
                      <option value="NM">Near Mint</option>
                      <option value="LP">Lightly Played</option>
                      <option value="MP">Moderately Played</option>
                      <option value="HP">Heavily Played</option>
                      <option value="DMG">Damaged</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2">Quantity</label>
                    <input
                      type="number"
                      min="1"
                      value={editingListing.quantity}
                      onChange={(e) => setEditingListing({...editingListing, quantity: parseInt(e.target.value)})}
                      className="w-full px-3 py-2 border rounded-lg"
                    />
                  </div>
                </div>

                <div className="mb-4">
                  <label className="block text-sm font-medium mb-2">Price (AUD)</label>
                  <div className="relative">
                    <span className="absolute left-3 top-3 text-gray-500">$</span>
                    <input
                      type="number"
                      step="0.01"
                      value={editingListing.price}
                      onChange={(e) => setEditingListing({...editingListing, price: parseFloat(e.target.value)})}
                      className="w-full pl-8 pr-3 py-2 border rounded-lg"
                    />
                  </div>
                </div>

                <div className="mb-6">
                  <label className="block text-sm font-medium mb-2">Description (Optional)</label>
                  <textarea
                    value={editingListing.description || ''}
                    onChange={(e) => setEditingListing({...editingListing, description: e.target.value})}
                    rows={3}
                    className="w-full px-3 py-2 border rounded-lg"
                    placeholder="Any additional details about the card..."
                  />
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={() => setShowEditModal(false)}
                    className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleUpdateListing}
                    className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                  >
                    Save Changes
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default UserDashboard;