// src/components/UserProfile.js
import React, { useState, useEffect } from 'react';
import {
  User,
  Mail,
  Phone,
  MapPin,
  Calendar,
  Package,
  DollarSign,
  Star,
  Edit2,
  Save,
  X,
  Camera,
  Shield,
  Award,
  TrendingUp,
  Activity,
  ChevronRight,
  MessageSquare,
  ShoppingCart,
  Clock,
  CheckCircle
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const API_URL = 'http://localhost:5000/api';

function UserProfile({ userId = null, onClose }) {
  const { user: currentUser, updateProfile } = useAuth();
  const [profile, setProfile] = useState(null);
  const [isOwnProfile, setIsOwnProfile] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');
  const [editForm, setEditForm] = useState({});
  const [userListings, setUserListings] = useState([]);
  const [userStats, setUserStats] = useState({});
  const [recentFeedback, setRecentFeedback] = useState([]);
  const [notification, setNotification] = useState({ show: false, message: '', type: 'success' });

  useEffect(() => {
    const profileUserId = userId || currentUser?.id;
    setIsOwnProfile(!userId || userId === currentUser?.id);
    
    if (profileUserId) {
      fetchUserProfile(profileUserId);
      fetchUserStats(profileUserId);
      fetchUserListings(profileUserId);
      fetchRecentFeedback(profileUserId);
    }
  }, [userId, currentUser]);

  const fetchUserProfile = async (profileId) => {
    setLoading(true);
    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${API_URL}/users/${profileId}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        setProfile(data);
        setEditForm(data);
      } else {
        // Use mock data for demo
        const mockProfile = {
          id: profileId,
          username: isOwnProfile ? currentUser?.username : 'CardTrader123',
          email: isOwnProfile ? currentUser?.email : 'trader@example.com',
          full_name: isOwnProfile ? currentUser?.full_name : 'John Smith',
          address: '123 Main Street',
          city: 'Sydney',
          state: 'NSW',
          postal_code: '2000',
          country: 'Australia',
          phone: '0400 123 456',
          bio: 'Passionate MTG collector and trader. Specializing in vintage and reserved list cards. Always looking for good deals!',
          avatar_url: null,
          seller_rating: 4.8,
          buyer_rating: 4.9,
          total_sales: 156,
          total_purchases: 89,
          member_since: '2023-01-15',
          last_active: new Date().toISOString(),
          verified_seller: true,
          trade_completed: 245
        };
        setProfile(mockProfile);
        setEditForm(mockProfile);
      }
    } catch (error) {
      console.error('Failed to fetch profile:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchUserStats = async (profileId) => {
    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${API_URL}/users/${profileId}/stats`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        setUserStats(data);
      } else {
        // Mock stats
        setUserStats({
          totalValue: 12450.00,
          averageOrderValue: 85.50,
          completionRate: 98.5,
          responseTime: '< 2 hours',
          totalCards: 342,
          uniqueCards: 189
        });
      }
    } catch (error) {
      console.error('Failed to fetch stats:', error);
    }
  };

  const fetchUserListings = async (profileId) => {
    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${API_URL}/users/${profileId}/listings?limit=6`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        setUserListings(data.listings || []);
      } else {
        // Mock listings
        setUserListings([
          { id: 1, card_name: 'Black Lotus', set: 'Alpha', condition: 'NM', price: 45000 },
          { id: 2, card_name: 'Mox Sapphire', set: 'Beta', condition: 'LP', price: 8500 },
          { id: 3, card_name: 'Time Walk', set: 'Unlimited', condition: 'MP', price: 3200 },
          { id: 4, card_name: 'Ancestral Recall', set: 'Beta', condition: 'NM', price: 5600 },
          { id: 5, card_name: 'Underground Sea', set: 'Revised', condition: 'NM', price: 850 },
          { id: 6, card_name: 'Volcanic Island', set: 'Revised', condition: 'LP', price: 750 }
        ]);
      }
    } catch (error) {
      console.error('Failed to fetch listings:', error);
    }
  };

  const fetchRecentFeedback = async (profileId) => {
    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${API_URL}/users/${profileId}/feedback?limit=5`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        setRecentFeedback(data.feedback || []);
      } else {
        // Mock feedback
        setRecentFeedback([
          {
            id: 1,
            from_username: 'BuyerOne',
            rating: 5,
            comment: 'Excellent seller! Cards arrived quickly and in perfect condition.',
            created_at: '2024-03-10',
            type: 'seller'
          },
          {
            id: 2,
            from_username: 'MagicFan',
            rating: 5,
            comment: 'Great communication and fast shipping. Would buy again!',
            created_at: '2024-03-08',
            type: 'seller'
          },
          {
            id: 3,
            from_username: 'CardCollector',
            rating: 4,
            comment: 'Good transaction, cards as described.',
            created_at: '2024-03-05',
            type: 'buyer'
          }
        ]);
      }
    } catch (error) {
      console.error('Failed to fetch feedback:', error);
    }
  };

  const handleSaveProfile = async () => {
    try {
      const result = await updateProfile(editForm);
      if (result.success) {
        setProfile(editForm);
        setIsEditing(false);
        showNotification('Profile updated successfully', 'success');
      } else {
        showNotification(result.error || 'Failed to update profile', 'error');
      }
    } catch (error) {
      console.error('Failed to save profile:', error);
      showNotification('Failed to update profile', 'error');
    }
  };

  const showNotification = (message, type = 'success') => {
    setNotification({ show: true, message, type });
    setTimeout(() => setNotification({ show: false, message: '', type: 'success' }), 3000);
  };

  const formatPrice = (price) => {
    return new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' }).format(price);
  };

  const renderStars = (rating) => {
    return [...Array(5)].map((_, i) => (
      <Star
        key={i}
        size={16}
        className={i < Math.floor(rating) ? 'fill-yellow-400 text-yellow-400' : 'text-gray-300'}
      />
    ));
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-gray-300 border-t-blue-500 rounded-full animate-spin mx-auto mb-4"></div>
          <p>Loading profile...</p>
        </div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <User size={64} className="mx-auto mb-4 text-gray-400" />
          <p className="text-xl text-gray-600">User not found</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Notification */}
      {notification.show && (
        <div className={`fixed top-5 right-5 px-5 py-3 rounded-lg flex items-center gap-2 z-50 shadow-lg ${
          notification.type === 'error' ? 'bg-red-500' : 'bg-green-500'
        } text-white`}>
          {notification.type === 'error' ? <X size={20} /> : <CheckCircle size={20} />}
          {notification.message}
        </div>
      )}

      {/* Header/Cover */}
      <div className="bg-gradient-to-r from-blue-600 to-purple-600 text-white">
        <div className="max-w-7xl mx-auto px-4 py-8">
          <div className="flex justify-between items-start mb-6">
            <div className="flex items-center gap-6">
              {/* Avatar */}
              <div className="relative">
                <div className="w-24 h-24 bg-white rounded-full flex items-center justify-center">
                  {profile.avatar_url ? (
                    <img src={profile.avatar_url} alt={profile.username} className="w-full h-full rounded-full object-cover" />
                  ) : (
                    <User size={48} className="text-gray-400" />
                  )}
                </div>
                {isOwnProfile && isEditing && (
                  <button className="absolute bottom-0 right-0 bg-blue-600 text-white p-2 rounded-full border-2 border-white">
                    <Camera size={16} />
                  </button>
                )}
                {profile.verified_seller && (
                  <div className="absolute -top-2 -right-2 bg-green-500 p-1 rounded-full border-2 border-white">
                    <CheckCircle size={16} />
                  </div>
                )}
              </div>

              {/* User Info */}
              <div>
                <h1 className="text-3xl font-bold mb-1">{profile.username}</h1>
                <p className="text-blue-100 mb-2">{profile.full_name}</p>
                <div className="flex items-center gap-4 text-sm">
                  <span className="flex items-center gap-1">
                    <MapPin size={14} />
                    {profile.city}, {profile.state}
                  </span>
                  <span className="flex items-center gap-1">
                    <Calendar size={14} />
                    Member since {new Date(profile.member_since || profile.created_at).toLocaleDateString('en-AU', { year: 'numeric', month: 'short' })}
                  </span>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-2">
              {isOwnProfile ? (
                <>
                  {isEditing ? (
                    <>
                      <button
                        onClick={handleSaveProfile}
                        className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 flex items-center gap-2"
                      >
                        <Save size={18} />
                        Save
                      </button>
                      <button
                        onClick={() => {
                          setIsEditing(false);
                          setEditForm(profile);
                        }}
                        className="px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600"
                      >
                        Cancel
                      </button>
                    </>
                  ) : (
                    <button
                      onClick={() => setIsEditing(true)}
                      className="px-4 py-2 bg-white text-blue-600 rounded-lg hover:bg-blue-50 flex items-center gap-2"
                    >
                      <Edit2 size={18} />
                      Edit Profile
                    </button>
                  )}
                </>
              ) : (
                <>
                  <button className="px-4 py-2 bg-white text-blue-600 rounded-lg hover:bg-blue-50 flex items-center gap-2">
                    <MessageSquare size={18} />
                    Message
                  </button>
                  <button className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 flex items-center gap-2">
                    <Package size={18} />
                    View Listings
                  </button>
                </>
              )}
              {onClose && (
                <button onClick={onClose} className="p-2 hover:bg-white/20 rounded">
                  <X size={20} />
                </button>
              )}
            </div>
          </div>

          {/* Stats Bar */}
          <div className="grid grid-cols-2 md:grid-cols-6 gap-4 p-4 bg-white/10 rounded-lg backdrop-blur">
            <div className="text-center">
              <div className="text-2xl font-bold">{profile.total_sales}</div>
              <div className="text-xs opacity-90">Total Sales</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold">{profile.total_purchases}</div>
              <div className="text-xs opacity-90">Purchases</div>
            </div>
            <div className="text-center">
              <div className="flex items-center justify-center gap-1">
                {renderStars(profile.seller_rating)}
              </div>
              <div className="text-xs opacity-90">Seller ({profile.seller_rating})</div>
            </div>
            <div className="text-center">
              <div className="flex items-center justify-center gap-1">
                {renderStars(profile.buyer_rating)}
              </div>
              <div className="text-xs opacity-90">Buyer ({profile.buyer_rating})</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold">{userStats.completionRate}%</div>
              <div className="text-xs opacity-90">Completion</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold">{userStats.responseTime}</div>
              <div className="text-xs opacity-90">Response</div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 py-6">
        {/* Tabs */}
        <div className="bg-white rounded-lg shadow mb-6">
          <div className="border-b">
            <div className="flex">
              {['overview', 'listings', 'feedback', 'about'].map(tab => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`px-6 py-3 font-medium capitalize transition ${
                    activeTab === tab
                      ? 'text-blue-600 border-b-2 border-blue-600'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  {tab}
                </button>
              ))}
            </div>
          </div>

          <div className="p-6">
            {/* Overview Tab */}
            {activeTab === 'overview' && (
              <div className="grid md:grid-cols-3 gap-6">
                <div className="md:col-span-2 space-y-6">
                  {/* Bio */}
                  {(profile.bio || isEditing) && (
                    <div>
                      <h3 className="font-semibold mb-3">About</h3>
                      {isEditing ? (
                        <textarea
                          value={editForm.bio || ''}
                          onChange={(e) => setEditForm({ ...editForm, bio: e.target.value })}
                          className="w-full px-3 py-2 border rounded-lg"
                          rows={4}
                          placeholder="Tell others about yourself..."
                        />
                      ) : (
                        <p className="text-gray-600">{profile.bio}</p>
                      )}
                    </div>
                  )}

                  {/* Recent Listings */}
                  <div>
                    <div className="flex justify-between items-center mb-3">
                      <h3 className="font-semibold">Recent Listings</h3>
                      <button className="text-blue-600 hover:text-blue-800 text-sm flex items-center gap-1">
                        View All
                        <ChevronRight size={16} />
                      </button>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      {userListings.slice(0, 4).map(listing => (
                        <div key={listing.id} className="border rounded-lg p-3 hover:shadow transition">
                          <div className="font-medium truncate">{listing.card_name}</div>
                          <div className="text-sm text-gray-600">{listing.set} • {listing.condition}</div>
                          <div className="font-bold text-green-600 mt-2">{formatPrice(listing.price)}</div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Recent Feedback */}
                  <div>
                    <h3 className="font-semibold mb-3">Recent Feedback</h3>
                    <div className="space-y-3">
                      {recentFeedback.slice(0, 3).map(feedback => (
                        <div key={feedback.id} className="border rounded-lg p-3">
                          <div className="flex justify-between items-start mb-2">
                            <div className="flex items-center gap-2">
                              <div className="flex">{renderStars(feedback.rating)}</div>
                              <span className="text-sm font-medium">{feedback.from_username}</span>
                              <span className="text-xs text-gray-500">
                                {new Date(feedback.created_at).toLocaleDateString()}
                              </span>
                            </div>
                            <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">
                              As {feedback.type}
                            </span>
                          </div>
                          <p className="text-sm text-gray-600">{feedback.comment}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Sidebar */}
                <div className="space-y-6">
                  {/* Badges */}
                  <div>
                    <h3 className="font-semibold mb-3">Achievements</h3>
                    <div className="grid grid-cols-3 gap-2">
                      {profile.verified_seller && (
                        <div className="text-center p-2 bg-green-50 rounded-lg">
                          <Shield className="mx-auto text-green-600 mb-1" size={24} />
                          <div className="text-xs">Verified</div>
                        </div>
                      )}
                      {profile.total_sales > 100 && (
                        <div className="text-center p-2 bg-blue-50 rounded-lg">
                          <Award className="mx-auto text-blue-600 mb-1" size={24} />
                          <div className="text-xs">Top Seller</div>
                        </div>
                      )}
                      {profile.trade_completed > 200 && (
                        <div className="text-center p-2 bg-purple-50 rounded-lg">
                          <TrendingUp className="mx-auto text-purple-600 mb-1" size={24} />
                          <div className="text-xs">200+ Trades</div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Quick Stats */}
                  <div>
                    <h3 className="font-semibold mb-3">Statistics</h3>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-gray-600">Total Value Traded</span>
                        <span className="font-medium">{formatPrice(userStats.totalValue)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Average Order</span>
                        <span className="font-medium">{formatPrice(userStats.averageOrderValue)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Total Cards</span>
                        <span className="font-medium">{userStats.totalCards}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Unique Cards</span>
                        <span className="font-medium">{userStats.uniqueCards}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* About Tab */}
            {activeTab === 'about' && (
              <div className="max-w-2xl">
                {isEditing ? (
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium mb-1">Full Name</label>
                      <input
                        type="text"
                        value={editForm.full_name || ''}
                        onChange={(e) => setEditForm({ ...editForm, full_name: e.target.value })}
                        className="w-full px-3 py-2 border rounded-lg"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">Email</label>
                      <input
                        type="email"
                        value={editForm.email || ''}
                        onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                        className="w-full px-3 py-2 border rounded-lg"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">Phone</label>
                      <input
                        type="tel"
                        value={editForm.phone || ''}
                        onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                        className="w-full px-3 py-2 border rounded-lg"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">Address</label>
                      <input
                        type="text"
                        value={editForm.address || ''}
                        onChange={(e) => setEditForm({ ...editForm, address: e.target.value })}
                        className="w-full px-3 py-2 border rounded-lg"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium mb-1">City</label>
                        <input
                          type="text"
                          value={editForm.city || ''}
                          onChange={(e) => setEditForm({ ...editForm, city: e.target.value })}
                          className="w-full px-3 py-2 border rounded-lg"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-1">State</label>
                        <select
                          value={editForm.state || ''}
                          onChange={(e) => setEditForm({ ...editForm, state: e.target.value })}
                          className="w-full px-3 py-2 border rounded-lg"
                        >
                          <option value="NSW">New South Wales</option>
                          <option value="VIC">Victoria</option>
                          <option value="QLD">Queensland</option>
                          <option value="WA">Western Australia</option>
                          <option value="SA">South Australia</option>
                          <option value="TAS">Tasmania</option>
                          <option value="ACT">Australian Capital Territory</option>
                          <option value="NT">Northern Territory</option>
                        </select>
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">Postal Code</label>
                      <input
                        type="text"
                        value={editForm.postal_code || ''}
                        onChange={(e) => setEditForm({ ...editForm, postal_code: e.target.value })}
                        className="w-full px-3 py-2 border rounded-lg"
                      />
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="flex items-center gap-2 text-gray-600">
                      <Mail size={18} />
                      <span>{isOwnProfile ? profile.email : 'Contact via messaging'}</span>
                    </div>
                    {isOwnProfile && profile.phone && (
                      <div className="flex items-center gap-2 text-gray-600">
                        <Phone size={18} />
                        <span>{profile.phone}</span>
                      </div>
                    )}
                    <div className="flex items-center gap-2 text-gray-600">
                      <MapPin size={18} />
                      <span>
                        {profile.address && isOwnProfile && `${profile.address}, `}
                        {profile.city}, {profile.state} {profile.postal_code}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-gray-600">
                      <Clock size={18} />
                      <span>Last active: {new Date(profile.last_active || new Date()).toLocaleDateString()}</span>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default UserProfile;