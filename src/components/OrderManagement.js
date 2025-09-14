// src/components/OrderManagement.js
import React, { useState, useEffect } from 'react';
import {
  Package,
  Truck,
  CheckCircle,
  AlertCircle,
  Clock,
  DollarSign,
  User,
  MapPin,
  CreditCard,
  FileText,
  Download,
  MessageSquare,
  ChevronRight,
  X,
  Star,
  Shield,
  RefreshCw
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import MessagingSystem from './MessagingSystem';

const API_URL = 'http://localhost:5000/api';

function OrderManagement({ isCheckout = false, cartItems = [], onClose }) {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState(isCheckout ? 'checkout' : 'purchases');
  const [orders, setOrders] = useState([]);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [loading, setLoading] = useState(false);
  const [shippingAddress, setShippingAddress] = useState({
    full_name: user?.full_name || '',
    address: user?.address || '',
    city: user?.city || '',
    state: user?.state || '',
    postal_code: user?.postal_code || '',
    country: user?.country || 'Australia',
    phone: user?.phone || ''
  });
  const [paymentMethod, setPaymentMethod] = useState('card');
  const [orderNotes, setOrderNotes] = useState('');
  const [notification, setNotification] = useState({ show: false, message: '', type: 'success' });
  const [showMessaging, setShowMessaging] = useState(false);
  const [messageRecipient, setMessageRecipient] = useState(null);
  const [orderStep, setOrderStep] = useState(1); // 1: Address, 2: Payment, 3: Review, 4: Complete

  useEffect(() => {
    if (!isCheckout) {
      fetchOrders();
    }
  }, [activeTab]);

  const fetchOrders = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('authToken');
      const endpoint = activeTab === 'purchases' 
        ? `${API_URL}/orders/purchases`
        : `${API_URL}/orders/sales`;
      
      const response = await fetch(endpoint, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        setOrders(data.orders || []);
      }
    } catch (error) {
      console.error('Failed to fetch orders:', error);
    } finally {
      setLoading(false);
    }
  };

  const createOrder = async () => {
    if (!validateShippingAddress()) return;
    
    setLoading(true);
    try {
      const token = localStorage.getItem('authToken');
      
      const orderData = {
        items: cartItems.map(item => ({
          listing_id: item.listing_id || item.id,
          quantity: item.quantity || 1,
          price: item.price
        })),
        shipping_address: shippingAddress,
        payment_method: paymentMethod,
        notes: orderNotes,
        total_amount: calculateTotal()
      };

      const response = await fetch(`${API_URL}/orders`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(orderData)
      });

      if (response.ok) {
        const data = await response.json();
        showNotification('Order placed successfully!', 'success');
        setOrderStep(4);
        setSelectedOrder(data.order);
        // Clear cart after successful order
        if (window.clearCart) {
          window.clearCart();
        }
      } else {
        throw new Error('Failed to create order');
      }
    } catch (error) {
      console.error('Failed to create order:', error);
      showNotification('Failed to place order. Please try again.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const updateOrderStatus = async (orderId, newStatus) => {
    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${API_URL}/orders/${orderId}/status`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ status: newStatus })
      });

      if (response.ok) {
        showNotification(`Order ${newStatus} successfully`, 'success');
        fetchOrders();
        if (selectedOrder?.id === orderId) {
          setSelectedOrder(prev => ({ ...prev, status: newStatus }));
        }
      }
    } catch (error) {
      console.error('Failed to update order status:', error);
      showNotification('Failed to update order status', 'error');
    }
  };

  const cancelOrder = async (orderId) => {
    if (!window.confirm('Are you sure you want to cancel this order?')) return;
    
    await updateOrderStatus(orderId, 'cancelled');
  };

  const validateShippingAddress = () => {
    const required = ['full_name', 'address', 'city', 'state', 'postal_code'];
    for (let field of required) {
      if (!shippingAddress[field]) {
        showNotification(`Please fill in ${field.replace('_', ' ')}`, 'error');
        return false;
      }
    }
    return true;
  };

  const calculateSubtotal = () => {
    return cartItems.reduce((sum, item) => sum + (item.price * (item.quantity || 1)), 0);
  };

  const calculateShipping = () => {
    const subtotal = calculateSubtotal();
    if (subtotal > 100) return 0; // Free shipping over $100
    return 10; // Flat rate shipping
  };

  const calculateTotal = () => {
    return calculateSubtotal() + calculateShipping();
  };

  const showNotification = (message, type = 'success') => {
    setNotification({ show: true, message, type });
    setTimeout(() => setNotification({ show: false, message: '', type: 'success' }), 3000);
  };

  const formatPrice = (price) => {
    return new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' }).format(price);
  };

  const getStatusColor = (status) => {
    const colors = {
      'pending': 'bg-yellow-100 text-yellow-800',
      'paid': 'bg-blue-100 text-blue-800',
      'shipped': 'bg-purple-100 text-purple-800',
      'delivered': 'bg-green-100 text-green-800',
      'cancelled': 'bg-red-100 text-red-800',
      'refunded': 'bg-gray-100 text-gray-800'
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
  };

  const getStatusIcon = (status) => {
    const icons = {
      'pending': <Clock size={16} />,
      'paid': <CreditCard size={16} />,
      'shipped': <Truck size={16} />,
      'delivered': <CheckCircle size={16} />,
      'cancelled': <X size={16} />,
      'refunded': <RefreshCw size={16} />
    };
    return icons[status] || <Package size={16} />;
  };

  const openMessageToSeller = (order) => {
    setMessageRecipient({
      id: order.seller_id,
      username: order.seller_username
    });
    setShowMessaging(true);
  };

  // Checkout Flow Component
  const CheckoutFlow = () => (
    <div className="max-w-4xl mx-auto">
      {/* Progress Steps */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          {[1, 2, 3].map((step) => (
            <React.Fragment key={step}>
              <div className={`flex items-center ${step <= orderStep ? 'text-blue-600' : 'text-gray-400'}`}>
                <div className={`w-10 h-10 rounded-full flex items-center justify-center border-2 ${
                  step <= orderStep 
                    ? 'bg-blue-600 text-white border-blue-600' 
                    : 'bg-white border-gray-300'
                }`}>
                  {step < orderStep ? <CheckCircle size={20} /> : step}
                </div>
                <span className="ml-2 font-medium">
                  {step === 1 ? 'Shipping' : step === 2 ? 'Payment' : 'Review'}
                </span>
              </div>
              {step < 3 && (
                <div className={`flex-1 h-1 mx-4 ${
                  step < orderStep ? 'bg-blue-600' : 'bg-gray-200'
                }`} />
              )}
            </React.Fragment>
          ))}
        </div>
      </div>

{orderStep === 1 && (
  <div className="bg-white rounded-lg p-6 shadow">
    <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
      <MapPin size={20} />
      Shipping Address
    </h2>
    
    <div className="grid md:grid-cols-2 gap-4">
      <div className="md:col-span-2">
        <label className="block text-sm font-medium mb-1">Full Name</label>
        <input
          type="text"
          value={shippingAddress.full_name}
          onChange={(e) => setShippingAddress({ ...shippingAddress, full_name: e.target.value })}
          className="w-full px-3 py-2 border rounded-lg"
          placeholder="John Doe"
        />
      </div>
      
      <div className="md:col-span-2">
        <label className="block text-sm font-medium mb-1">Street Address</label>
        <input
          type="text"
          value={shippingAddress.address}
          onChange={(e) => setShippingAddress({ ...shippingAddress, address: e.target.value })}
          className="w-full px-3 py-2 border rounded-lg"
          placeholder="123 Main Street"
        />
      </div>
      
      <div>
        <label className="block text-sm font-medium mb-1">City</label>
        <input
          type="text"
          value={shippingAddress.city}
          onChange={(e) => setShippingAddress({ ...shippingAddress, city: e.target.value })}
          className="w-full px-3 py-2 border rounded-lg"
          placeholder="Sydney"
        />
      </div>
      
      <div>
        <label className="block text-sm font-medium mb-1">State</label>
        <select
          value={shippingAddress.state}
          onChange={(e) => setShippingAddress({ ...shippingAddress, state: e.target.value })}
          className="w-full px-3 py-2 border rounded-lg"
        >
          <option value="">Select State</option>
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
      
      <div>
        <label className="block text-sm font-medium mb-1">Postal Code</label>
        <input
          type="text"
          value={shippingAddress.postal_code}
          onChange={(e) => setShippingAddress({ ...shippingAddress, postal_code: e.target.value })}
          className="w-full px-3 py-2 border rounded-lg"
          placeholder="2000"
        />
      </div>
      
      <div>
        <label className="block text-sm font-medium mb-1">Phone Number</label>
        <input
          type="tel"
          value={shippingAddress.phone}
          onChange={(e) => setShippingAddress({ ...shippingAddress, phone: e.target.value })}
          className="w-full px-3 py-2 border rounded-lg"
          placeholder="0400 000 000"
        />
      </div>
    </div>
    
    <div className="flex justify-end mt-6">
      <button
        onClick={() => {
          if (validateShippingAddress()) {
            setOrderStep(2);
          }
        }}
        className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
      >
        Continue to Payment
        <ChevronRight className="inline ml-2" size={16} />
      </button>
    </div>
  </div>
)}
      {orderStep === 2 && (
        <div className="bg-white rounded-lg p-6 shadow">
          <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
            <CreditCard size={20} />
            Payment Method
          </h2>
          
          <div className="space-y-4">
            <label className="block p-4 border rounded-lg cursor-pointer hover:bg-gray-50">
              <input
                type="radio"
                name="payment"
                value="card"
                checked={paymentMethod === 'card'}
                onChange={(e) => setPaymentMethod(e.target.value)}
                className="mr-3"
              />
              <span className="font-medium">Credit/Debit Card</span>
              <div className="text-sm text-gray-600 mt-1 ml-6">
                Secure payment via Stripe
              </div>
            </label>
            
            <label className="block p-4 border rounded-lg cursor-pointer hover:bg-gray-50">
              <input
                type="radio"
                name="payment"
                value="paypal"
                checked={paymentMethod === 'paypal'}
                onChange={(e) => setPaymentMethod(e.target.value)}
                className="mr-3"
              />
              <span className="font-medium">PayPal</span>
              <div className="text-sm text-gray-600 mt-1 ml-6">
                Pay with your PayPal account
              </div>
            </label>
            
            <label className="block p-4 border rounded-lg cursor-pointer hover:bg-gray-50">
              <input
                type="radio"
                name="payment"
                value="bank"
                checked={paymentMethod === 'bank'}
                onChange={(e) => setPaymentMethod(e.target.value)}
                className="mr-3"
              />
              <span className="font-medium">Bank Transfer</span>
              <div className="text-sm text-gray-600 mt-1 ml-6">
                Direct bank transfer (1-2 business days)
              </div>
            </label>
          </div>
          
          <div className="bg-blue-50 p-4 rounded-lg mt-6">
            <div className="flex items-center gap-2 text-blue-800">
              <Shield size={20} />
              <span className="font-medium">Secure Payment</span>
            </div>
            <p className="text-sm text-blue-700 mt-1">
              Your payment information is encrypted and secure. We never store your card details.
            </p>
          </div>
          
          <div className="flex justify-between mt-6">
            <button
              onClick={() => setOrderStep(1)}
              className="px-6 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              Back
            </button>
            <button
              onClick={() => setOrderStep(3)}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              Review Order
              <ChevronRight className="inline ml-2" size={16} />
            </button>
          </div>
        </div>
      )}

      {orderStep === 3 && (
        <div className="bg-white rounded-lg p-6 shadow">
          <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
            <FileText size={20} />
            Review Your Order
          </h2>
          
          {/* Order Items */}
          <div className="mb-6">
            <h3 className="font-semibold mb-3">Order Items</h3>
            <div className="space-y-2">
              {cartItems.map((item, index) => (
                <div key={index} className="flex justify-between items-center p-3 bg-gray-50 rounded">
                  <div>
                    <div className="font-medium">{item.card_name}</div>
                    <div className="text-sm text-gray-600">
                      {item.condition} • Qty: {item.quantity || 1}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-bold">{formatPrice(item.price * (item.quantity || 1))}</div>
                    <div className="text-sm text-gray-600">{formatPrice(item.price)} each</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
          
          {/* Shipping Address */}
          <div className="mb-6">
            <h3 className="font-semibold mb-3">Shipping Address</h3>
            <div className="p-3 bg-gray-50 rounded text-sm">
              <p>{shippingAddress.full_name}</p>
              <p>{shippingAddress.address}</p>
              <p>{shippingAddress.city}, {shippingAddress.state} {shippingAddress.postal_code}</p>
              <p>Phone: {shippingAddress.phone}</p>
            </div>
          </div>
          
          {/* Payment Method */}
          <div className="mb-6">
            <h3 className="font-semibold mb-3">Payment Method</h3>
            <div className="p-3 bg-gray-50 rounded text-sm">
              {paymentMethod === 'card' && 'Credit/Debit Card (via Stripe)'}
              {paymentMethod === 'paypal' && 'PayPal'}
              {paymentMethod === 'bank' && 'Bank Transfer'}
            </div>
          </div>
          
          {/* Order Notes */}
          <div className="mb-6">
            <h3 className="font-semibold mb-3">Order Notes (Optional)</h3>
            <textarea
              value={orderNotes}
              onChange={(e) => setOrderNotes(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg"
              rows={3}
              placeholder="Any special instructions for your order..."
            />
          </div>
          
          {/* Order Summary */}
          <div className="border-t pt-4">
            <div className="flex justify-between mb-2">
              <span>Subtotal</span>
              <span>{formatPrice(calculateSubtotal())}</span>
            </div>
            <div className="flex justify-between mb-2">
              <span>Shipping</span>
              <span>
                {calculateShipping() === 0 ? (
                  <span className="text-green-600">FREE</span>
                ) : (
                  formatPrice(calculateShipping())
                )}
              </span>
            </div>
            <div className="flex justify-between font-bold text-lg">
              <span>Total</span>
              <span className="text-green-600">{formatPrice(calculateTotal())}</span>
            </div>
          </div>
          
          <div className="flex justify-between mt-6">
            <button
              onClick={() => setOrderStep(2)}
              className="px-6 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              Back
            </button>
            <button
              onClick={createOrder}
              disabled={loading}
              className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 font-semibold disabled:bg-gray-400"
            >
              {loading ? 'Processing...' : `Place Order • ${formatPrice(calculateTotal())}`}
            </button>
          </div>
        </div>
      )}

      {orderStep === 4 && (
        <div className="bg-white rounded-lg p-8 shadow text-center">
          <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle size={40} className="text-green-600" />
          </div>
          <h2 className="text-2xl font-bold mb-2">Order Placed Successfully!</h2>
          <p className="text-gray-600 mb-6">
            Thank you for your order. We've sent a confirmation email to {user?.email}
          </p>
          
          {selectedOrder && (
            <div className="bg-gray-50 rounded-lg p-4 mb-6 text-left max-w-md mx-auto">
              <div className="flex justify-between mb-2">
                <span className="text-gray-600">Order Number:</span>
                <span className="font-bold">#{selectedOrder.id}</span>
              </div>
              <div className="flex justify-between mb-2">
                <span className="text-gray-600">Total Amount:</span>
                <span className="font-bold">{formatPrice(selectedOrder.total_amount)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Estimated Delivery:</span>
                <span className="font-bold">3-5 business days</span>
              </div>
            </div>
          )}
          
          <div className="flex gap-4 justify-center">
            <button
              onClick={() => {
                setActiveTab('purchases');
                setOrderStep(1);
              }}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              View Orders
            </button>
            <button
              onClick={onClose}
              className="px-6 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              Continue Shopping
            </button>
          </div>
        </div>
      )}
    </div>
  );

  // Orders List Component
  const OrdersList = () => (
    <div className="grid lg:grid-cols-3 gap-6">
      <div className="lg:col-span-2">
        <div className="bg-white rounded-lg shadow">
          <div className="p-4 border-b">
            <div className="flex gap-4">
              <button
                onClick={() => setActiveTab('purchases')}
                className={`pb-2 px-1 font-medium transition ${
                  activeTab === 'purchases' 
                    ? 'text-blue-600 border-b-2 border-blue-600' 
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                My Purchases
              </button>
              <button
                onClick={() => setActiveTab('sales')}
                className={`pb-2 px-1 font-medium transition ${
                  activeTab === 'sales' 
                    ? 'text-blue-600 border-b-2 border-blue-600' 
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                My Sales
              </button>
            </div>
          </div>
          
          <div className="p-4">
            {loading ? (
              <div className="text-center py-8">
                <div className="w-8 h-8 border-4 border-gray-300 border-t-blue-500 rounded-full animate-spin mx-auto mb-4"></div>
                <p>Loading orders...</p>
              </div>
            ) : orders.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <Package size={48} className="mx-auto mb-4 opacity-30" />
                <p>No orders yet</p>
              </div>
            ) : (
              <div className="space-y-4">
                {orders.map(order => (
                  <div
                    key={order.id}
                    onClick={() => setSelectedOrder(order)}
                    className={`border rounded-lg p-4 cursor-pointer transition hover:shadow ${
                      selectedOrder?.id === order.id ? 'border-blue-500 bg-blue-50' : ''
                    }`}
                  >
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <div className="font-semibold">Order #{order.id}</div>
                        <div className="text-sm text-gray-600">
                          {new Date(order.created_at).toLocaleDateString('en-AU')}
                        </div>
                      </div>
                      <span className={`px-2 py-1 rounded-full text-xs font-medium flex items-center gap-1 ${getStatusColor(order.status)}`}>
                        {getStatusIcon(order.status)}
                        {order.status}
                      </span>
                    </div>
                    
                    <div className="text-sm text-gray-600 mb-2">
                      {order.items_count} items • {formatPrice(order.total_amount)}
                    </div>
                    
                    {activeTab === 'purchases' && order.seller_username && (
                      <div className="text-sm text-gray-600">
                        Seller: {order.seller_username}
                      </div>
                    )}
                    
                    {activeTab === 'sales' && order.buyer_username && (
                      <div className="text-sm text-gray-600">
                        Buyer: {order.buyer_username}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
      
      {/* Order Details Sidebar */}
      <div className="lg:col-span-1">
        {selectedOrder ? (
          <div className="bg-white rounded-lg shadow p-4">
            <h3 className="font-semibold mb-4">Order Details</h3>
            
            <div className="space-y-3 text-sm">
              <div>
                <span className="text-gray-600">Order Number:</span>
                <div className="font-semibold">#{selectedOrder.id}</div>
              </div>
              
              <div>
                <span className="text-gray-600">Status:</span>
                <div className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium mt-1 ${getStatusColor(selectedOrder.status)}`}>
                  {getStatusIcon(selectedOrder.status)}
                  {selectedOrder.status}
                </div>
              </div>
              
              <div>
                <span className="text-gray-600">Total Amount:</span>
                <div className="font-semibold text-lg">{formatPrice(selectedOrder.total_amount)}</div>
              </div>
              
              {selectedOrder.tracking_number && (
                <div>
                  <span className="text-gray-600">Tracking:</span>
                  <div className="font-semibold">{selectedOrder.tracking_number}</div>
                </div>
              )}
              
              <div className="border-t pt-3">
                <span className="text-gray-600">Actions:</span>
                <div className="space-y-2 mt-2">
                  {activeTab === 'purchases' && (
                    <>
                      {selectedOrder.status === 'delivered' && (
                        <button className="w-full px-3 py-2 bg-green-600 text-white rounded text-sm hover:bg-green-700">
                          <Star className="inline mr-2" size={16} />
                          Leave Feedback
                        </button>
                      )}
                      <button
                        onClick={() => openMessageToSeller(selectedOrder)}
                        className="w-full px-3 py-2 bg-blue-600 text-white rounded text-sm hover:bg-blue-700"
                      >
                        <MessageSquare className="inline mr-2" size={16} />
                        Message Seller
                      </button>
                      {['pending', 'paid'].includes(selectedOrder.status) && (
                        <button
                          onClick={() => cancelOrder(selectedOrder.id)}
                          className="w-full px-3 py-2 border border-red-600 text-red-600 rounded text-sm hover:bg-red-50"
                        >
                          Cancel Order
                        </button>
                      )}
                    </>
                  )}
                  
                  {activeTab === 'sales' && (
                    <>
                      {selectedOrder.status === 'paid' && (
                        <button
                          onClick={() => updateOrderStatus(selectedOrder.id, 'shipped')}
                          className="w-full px-3 py-2 bg-purple-600 text-white rounded text-sm hover:bg-purple-700"
                        >
                          <Truck className="inline mr-2" size={16} />
                          Mark as Shipped
                        </button>
                      )}
                      <button className="w-full px-3 py-2 bg-gray-600 text-white rounded text-sm hover:bg-gray-700">
                        <Download className="inline mr-2" size={16} />
                        Print Label
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow p-4 text-center text-gray-500">
            <Package size={48} className="mx-auto mb-2 opacity-30" />
            <p>Select an order to view details</p>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50 py-6">
      {/* Notification */}
      {notification.show && (
        <div className={`fixed top-5 right-5 px-5 py-3 rounded-lg flex items-center gap-2 z-50 shadow-lg ${
          notification.type === 'error' ? 'bg-red-500' : 'bg-green-500'
        } text-white`}>
          {notification.type === 'error' ? <AlertCircle size={20} /> : <CheckCircle size={20} />}
          {notification.message}
        </div>
      )}

      <div className="max-w-7xl mx-auto px-4">
        {!isCheckout && (
          <div className="flex justify-between items-center mb-6">
            <h1 className="text-2xl font-bold">Order Management</h1>
            {onClose && (
              <button onClick={onClose} className="p-2 hover:bg-gray-200 rounded">
                <X size={24} />
              </button>
            )}
          </div>
        )}

        {isCheckout ? <CheckoutFlow /> : <OrdersList />}
      </div>

      {/* Messaging Modal */}
      {showMessaging && (
        <MessagingSystem
          isOpen={showMessaging}
          onClose={() => setShowMessaging(false)}
          initialRecipient={messageRecipient}
        />
      )}
    </div>
  );
}

export default OrderManagement;