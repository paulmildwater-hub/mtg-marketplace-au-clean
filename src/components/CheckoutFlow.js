// src/components/CheckoutFlow.js
import React, { useState, useEffect } from 'react';
import {
  ShoppingCart,
  CreditCard,
  MapPin,
  Package,
  ArrowRight,
  ArrowLeft,
  CheckCircle,
  AlertCircle,
  Lock,
  Truck,
  DollarSign,
  X,
  Info,
  Shield
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const API_URL = 'http://localhost:5000/api';

function CheckoutFlow({ cartItems, onSuccess, onClose }) {
  const { user } = useAuth();
  const [currentStep, setCurrentStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  
  // Form Data
  const [shippingAddress, setShippingAddress] = useState({
    full_name: user?.full_name || '',
    email: user?.email || '',
    phone: user?.phone || '',
    address: user?.address || '',
    city: user?.city || '',
    state: user?.state || '',
    postal_code: user?.postal_code || '',
    country: 'Australia'
  });

  const [billingAddress, setBillingAddress] = useState({
    same_as_shipping: true,
    ...shippingAddress
  });

  const [paymentMethod, setPaymentMethod] = useState('card');
  const [cardDetails, setCardDetails] = useState({
    number: '',
    name: '',
    expiry: '',
    cvc: '',
    save: false
  });

  const [orderNotes, setOrderNotes] = useState('');
  const [agreedToTerms, setAgreedToTerms] = useState(false);

  // Pricing calculations
  const calculateSubtotal = () => {
    return cartItems.reduce((sum, item) => sum + (item.price * (item.quantity || 1)), 0);
  };

  const calculateShipping = () => {
    const subtotal = calculateSubtotal();
    if (subtotal > 100) return 0; // Free shipping over $100
    if (subtotal > 50) return 7.99; // Reduced shipping $50-100
    return 12.99; // Standard shipping
  };

  const calculateTax = () => {
    // GST calculation for Australia (10%)
    const subtotal = calculateSubtotal();
    return subtotal * 0.10;
  };

  const calculateTotal = () => {
    return calculateSubtotal() + calculateShipping() + calculateTax();
  };

  const formatPrice = (price) => {
    return new Intl.NumberFormat('en-AU', { 
      style: 'currency', 
      currency: 'AUD' 
    }).format(price);
  };

  // Form validation
  const validateShipping = () => {
    const required = ['full_name', 'email', 'phone', 'address', 'city', 'state', 'postal_code'];
    const errors = [];
    
    for (let field of required) {
      if (!shippingAddress[field]) {
        errors.push(`${field.replace('_', ' ')} is required`);
      }
    }
    
    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (shippingAddress.email && !emailRegex.test(shippingAddress.email)) {
      errors.push('Invalid email format');
    }
    
    // Phone validation (Australian format)
    const phoneRegex = /^(\+61|0)[2-478]( ?\d){8}$/;
    if (shippingAddress.phone && !phoneRegex.test(shippingAddress.phone.replace(/\s/g, ''))) {
      errors.push('Invalid phone number format');
    }
    
    if (errors.length > 0) {
      setError(errors.join(', '));
      return false;
    }
    
    return true;
  };

  const validatePayment = () => {
    if (paymentMethod === 'card') {
      if (!cardDetails.number || !cardDetails.name || !cardDetails.expiry || !cardDetails.cvc) {
        setError('Please fill in all card details');
        return false;
      }
      
      // Basic card number validation
      const cardNumber = cardDetails.number.replace(/\s/g, '');
      if (cardNumber.length < 13 || cardNumber.length > 19) {
        setError('Invalid card number');
        return false;
      }
      
      // Expiry validation
      const [month, year] = cardDetails.expiry.split('/');
      if (!month || !year || month > 12 || month < 1) {
        setError('Invalid expiry date');
        return false;
      }
      
      // CVC validation
      if (cardDetails.cvc.length < 3 || cardDetails.cvc.length > 4) {
        setError('Invalid CVC');
        return false;
      }
    }
    
    if (!agreedToTerms) {
      setError('Please agree to the terms and conditions');
      return false;
    }
    
    return true;
  };

  // Format card number with spaces
  const formatCardNumber = (value) => {
    const v = value.replace(/\s+/g, '').replace(/[^0-9]/gi, '');
    const matches = v.match(/\d{4,16}/g);
    const match = (matches && matches[0]) || '';
    const parts = [];
    
    for (let i = 0, len = match.length; i < len; i += 4) {
      parts.push(match.substring(i, i + 4));
    }
    
    return parts.length ? parts.join(' ') : value;
  };

  // Format expiry date
  const formatExpiry = (value) => {
    const v = value.replace(/\s+/g, '').replace(/[^0-9]/gi, '');
    if (v.length >= 2) {
      return v.slice(0, 2) + (v.length > 2 ? '/' + v.slice(2, 4) : '');
    }
    return v;
  };

  // Handle order submission
  const submitOrder = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const token = localStorage.getItem('authToken');
      
      // Prepare order data
      const orderData = {
        items: cartItems.map(item => ({
          listing_id: item.id,
          quantity: item.quantity || 1,
          price: item.price
        })),
        shipping_address: shippingAddress,
        billing_address: billingAddress.same_as_shipping ? shippingAddress : billingAddress,
        payment_method: paymentMethod,
        order_notes: orderNotes,
        subtotal: calculateSubtotal(),
        shipping: calculateShipping(),
        tax: calculateTax(),
        total_amount: calculateTotal()
      };

      // Create order
      const orderResponse = await fetch(`${API_URL}/orders`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(orderData)
      });

      if (!orderResponse.ok) {
        throw new Error('Failed to create order');
      }

      const order = await orderResponse.json();

      // Process payment
      if (paymentMethod === 'card') {
        const paymentData = {
          amount: calculateTotal(),
          orderId: order.order.id,
          paymentMethod: 'card',
          cardDetails: {
            number: cardDetails.number.replace(/\s/g, ''),
            name: cardDetails.name,
            exp_month: cardDetails.expiry.split('/')[0],
            exp_year: '20' + cardDetails.expiry.split('/')[1],
            cvc: cardDetails.cvc
          },
          saveCard: cardDetails.save
        };

        const paymentResponse = await fetch(`${API_URL}/payment/process`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify(paymentData)
        });

        if (!paymentResponse.ok) {
          throw new Error('Payment failed');
        }

        const paymentResult = await paymentResponse.json();
        
        if (paymentResult.success) {
          setCurrentStep(4); // Success step
          if (onSuccess) {
            onSuccess(order.order);
          }
        } else {
          throw new Error(paymentResult.error || 'Payment failed');
        }
      } else {
        // For other payment methods, just show success
        setCurrentStep(4);
        if (onSuccess) {
          onSuccess(order.order);
        }
      }
    } catch (err) {
      console.error('Checkout error:', err);
      setError(err.message || 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Navigation
  const handleNext = () => {
    setError(null);
    
    if (currentStep === 1 && !validateShipping()) {
      return;
    }
    
    if (currentStep === 2 && !validatePayment()) {
      return;
    }
    
    if (currentStep === 3) {
      submitOrder();
      return;
    }
    
    setCurrentStep(currentStep + 1);
  };

  const handleBack = () => {
    setError(null);
    setCurrentStep(currentStep - 1);
  };

  // Step indicator
  const steps = [
    { number: 1, title: 'Shipping', icon: <MapPin size={20} /> },
    { number: 2, title: 'Payment', icon: <CreditCard size={20} /> },
    { number: 3, title: 'Review', icon: <Package size={20} /> },
    { number: 4, title: 'Complete', icon: <CheckCircle size={20} /> }
  ];

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-6xl mx-auto px-4">
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold">Checkout</h1>
          <button 
            onClick={onClose}
            className="p-2 hover:bg-gray-200 rounded-lg"
          >
            <X size={24} />
          </button>
        </div>

        {/* Progress Steps */}
        <div className="mb-8">
          <div className="flex items-center justify-between max-w-3xl mx-auto">
            {steps.map((step, index) => (
              <React.Fragment key={step.number}>
                <div className={`flex flex-col items-center ${
                  step.number <= currentStep ? 'text-blue-600' : 'text-gray-400'
                }`}>
                  <div className={`w-12 h-12 rounded-full flex items-center justify-center border-2 ${
                    step.number < currentStep 
                      ? 'bg-blue-600 text-white border-blue-600' 
                      : step.number === currentStep
                      ? 'bg-white text-blue-600 border-blue-600'
                      : 'bg-white border-gray-300'
                  }`}>
                    {step.number < currentStep ? <CheckCircle size={20} /> : step.icon}
                  </div>
                  <span className="text-sm mt-2 font-medium">{step.title}</span>
                </div>
                {index < steps.length - 1 && (
                  <div className={`flex-1 h-1 mx-4 ${
                    step.number < currentStep ? 'bg-blue-600' : 'bg-gray-200'
                  }`} />
                )}
              </React.Fragment>
            ))}
          </div>
        </div>

        <div className="grid lg:grid-cols-3 gap-8">
          {/* Main Content */}
          <div className="lg:col-span-2">
            {/* Error Message */}
            {error && (
              <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2">
                <AlertCircle size={20} className="text-red-600 mt-0.5" />
                <div className="text-red-800">{error}</div>
              </div>
            )}

            {/* Step 1: Shipping */}
            {currentStep === 1 && (
              <div className="bg-white rounded-lg shadow p-6">
                <h2 className="text-xl font-semibold mb-6 flex items-center gap-2">
                  <Truck size={24} />
                  Shipping Information
                </h2>

                <div className="grid md:grid-cols-2 gap-4">
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium mb-1">Full Name *</label>
                    <input
                      type="text"
                      value={shippingAddress.full_name}
                      onChange={(e) => setShippingAddress({...shippingAddress, full_name: e.target.value})}
                      className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                      placeholder="John Doe"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-1">Email *</label>
                    <input
                      type="email"
                      value={shippingAddress.email}
                      onChange={(e) => setShippingAddress({...shippingAddress, email: e.target.value})}
                      className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                      placeholder="john@example.com"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-1">Phone *</label>
                    <input
                      type="tel"
                      value={shippingAddress.phone}
                      onChange={(e) => setShippingAddress({...shippingAddress, phone: e.target.value})}
                      className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                      placeholder="0400 000 000"
                    />
                  </div>

                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium mb-1">Street Address *</label>
                    <input
                      type="text"
                      value={shippingAddress.address}
                      onChange={(e) => setShippingAddress({...shippingAddress, address: e.target.value})}
                      className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                      placeholder="123 Main Street"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-1">City *</label>
                    <input
                      type="text"
                      value={shippingAddress.city}
                      onChange={(e) => setShippingAddress({...shippingAddress, city: e.target.value})}
                      className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                      placeholder="Sydney"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-1">State *</label>
                    <select
                      value={shippingAddress.state}
                      onChange={(e) => setShippingAddress({...shippingAddress, state: e.target.value})}
                      className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
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
                    <label className="block text-sm font-medium mb-1">Postal Code *</label>
                    <input
                      type="text"
                      value={shippingAddress.postal_code}
                      onChange={(e) => setShippingAddress({...shippingAddress, postal_code: e.target.value})}
                      className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                      placeholder="2000"
                      maxLength="4"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-1">Country</label>
                    <input
                      type="text"
                      value={shippingAddress.country}
                      disabled
                      className="w-full px-3 py-2 border rounded-lg bg-gray-50"
                    />
                  </div>
                </div>

                {/* Shipping Options */}
                <div className="mt-6 p-4 bg-blue-50 rounded-lg">
                  <h3 className="font-medium mb-3">Shipping Options</h3>
                  <div className="space-y-2">
                    <label className="flex items-center justify-between p-3 bg-white rounded border cursor-pointer hover:bg-gray-50">
                      <div className="flex items-center">
                        <input type="radio" name="shipping" defaultChecked className="mr-3" />
                        <div>
                          <div className="font-medium">Standard Shipping</div>
                          <div className="text-sm text-gray-600">5-7 business days</div>
                        </div>
                      </div>
                      <span className="font-medium">
                        {calculateShipping() === 0 ? 'FREE' : formatPrice(calculateShipping())}
                      </span>
                    </label>
                  </div>
                </div>
              </div>
            )}

            {/* Step 2: Payment */}
            {currentStep === 2 && (
              <div className="bg-white rounded-lg shadow p-6">
                <h2 className="text-xl font-semibold mb-6 flex items-center gap-2">
                  <CreditCard size={24} />
                  Payment Information
                </h2>

                {/* Payment Method Selection */}
                <div className="mb-6">
                  <h3 className="font-medium mb-3">Payment Method</h3>
                  <div className="space-y-2">
                    <label className="flex items-center p-3 border rounded-lg cursor-pointer hover:bg-gray-50">
                      <input
                        type="radio"
                        name="payment"
                        value="card"
                        checked={paymentMethod === 'card'}
                        onChange={(e) => setPaymentMethod(e.target.value)}
                        className="mr-3"
                      />
                      <CreditCard size={20} className="mr-2 text-gray-600" />
                      <span>Credit/Debit Card</span>
                    </label>
                    
                    <label className="flex items-center p-3 border rounded-lg cursor-pointer hover:bg-gray-50">
                      <input
                        type="radio"
                        name="payment"
                        value="paypal"
                        checked={paymentMethod === 'paypal'}
                        onChange={(e) => setPaymentMethod(e.target.value)}
                        className="mr-3"
                      />
                      <span>PayPal</span>
                    </label>
                  </div>
                </div>

                {/* Card Details */}
                {paymentMethod === 'card' && (
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium mb-1">Cardholder Name</label>
                      <input
                        type="text"
                        value={cardDetails.name}
                        onChange={(e) => setCardDetails({...cardDetails, name: e.target.value})}
                        className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                        placeholder="John Doe"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium mb-1">Card Number</label>
                      <div className="relative">
                        <input
                          type="text"
                          value={cardDetails.number}
                          onChange={(e) => setCardDetails({...cardDetails, number: formatCardNumber(e.target.value)})}
                          className="w-full px-3 py-2 pr-10 border rounded-lg focus:ring-2 focus:ring-blue-500"
                          placeholder="4242 4242 4242 4242"
                          maxLength="19"
                        />
                        <CreditCard className="absolute right-3 top-3 text-gray-400" size={20} />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium mb-1">Expiry Date</label>
                        <input
                          type="text"
                          value={cardDetails.expiry}
                          onChange={(e) => setCardDetails({...cardDetails, expiry: formatExpiry(e.target.value)})}
                          className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                          placeholder="MM/YY"
                          maxLength="5"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium mb-1">CVC</label>
                        <input
                          type="text"
                          value={cardDetails.cvc}
                          onChange={(e) => setCardDetails({...cardDetails, cvc: e.target.value.replace(/\D/g, '')})}
                          className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                          placeholder="123"
                          maxLength="4"
                        />
                      </div>
                    </div>

                    <label className="flex items-center mt-4">
                      <input
                        type="checkbox"
                        checked={cardDetails.save}
                        onChange={(e) => setCardDetails({...cardDetails, save: e.target.checked})}
                        className="mr-2"
                      />
                      <span className="text-sm">Save this card for future purchases</span>
                    </label>
                  </div>
                )}

                {/* PayPal Notice */}
                {paymentMethod === 'paypal' && (
                  <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                    <div className="flex items-center gap-2 mb-2">
                      <Info size={20} className="text-yellow-600" />
                      <span className="font-medium">PayPal Payment</span>
                    </div>
                    <p className="text-sm text-gray-700">
                      You will be redirected to PayPal to complete your payment after reviewing your order.
                    </p>
                  </div>
                )}

                {/* Billing Address */}
                <div className="mt-6">
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={billingAddress.same_as_shipping}
                      onChange={(e) => setBillingAddress({
                        ...billingAddress,
                        same_as_shipping: e.target.checked
                      })}
                      className="mr-2"
                    />
                    <span className="text-sm">Billing address same as shipping</span>
                  </label>
                </div>

                {/* Terms and Conditions */}
                <div className="mt-6 p-4 bg-gray-50 rounded-lg">
                  <label className="flex items-start">
                    <input
                      type="checkbox"
                      checked={agreedToTerms}
                      onChange={(e) => setAgreedToTerms(e.target.checked)}
                      className="mr-2 mt-1"
                    />
                    <span className="text-sm">
                      I agree to the <a href="#" className="text-blue-600 hover:underline">Terms of Service</a> and{' '}
                      <a href="#" className="text-blue-600 hover:underline">Privacy Policy</a>
                    </span>
                  </label>
                </div>

                {/* Security Badge */}
                <div className="mt-6 p-4 bg-green-50 rounded-lg flex items-center gap-3">
                  <Shield size={24} className="text-green-600" />
                  <div>
                    <p className="font-medium text-sm">Secure & Encrypted</p>
                    <p className="text-xs text-gray-600">
                      Your payment information is protected with bank-level security
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Step 3: Review */}
            {currentStep === 3 && (
              <div className="bg-white rounded-lg shadow p-6">
                <h2 className="text-xl font-semibold mb-6">Review Your Order</h2>

                {/* Order Items */}
                <div className="mb-6">
                  <h3 className="font-medium mb-3">Order Items</h3>
                  <div className="space-y-3">
                    {cartItems.map((item, index) => (
                      <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                        <div className="flex items-center gap-3">
                          {item.image_url && (
                            <img 
                              src={item.image_url} 
                              alt={item.card_name}
                              className="w-12 h-16 object-cover rounded"
                            />
                          )}
                          <div>
                            <div className="font-medium">{item.card_name}</div>
                            <div className="text-sm text-gray-600">
                              {item.condition} • Qty: {item.quantity || 1}
                            </div>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="font-medium">{formatPrice(item.price * (item.quantity || 1))}</div>
                          <div className="text-sm text-gray-600">{formatPrice(item.price)} each</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Shipping Address */}
                <div className="mb-6">
                  <h3 className="font-medium mb-3">Shipping Address</h3>
                  <div className="p-3 bg-gray-50 rounded-lg text-sm">
                    <p className="font-medium">{shippingAddress.full_name}</p>
                    <p>{shippingAddress.address}</p>
                    <p>{shippingAddress.city}, {shippingAddress.state} {shippingAddress.postal_code}</p>
                    <p>Phone: {shippingAddress.phone}</p>
                    <p>Email: {shippingAddress.email}</p>
                  </div>
                </div>

                {/* Payment Method */}
                <div className="mb-6">
                  <h3 className="font-medium mb-3">Payment Method</h3>
                  <div className="p-3 bg-gray-50 rounded-lg text-sm">
                    {paymentMethod === 'card' ? (
                      <div className="flex items-center gap-2">
                        <CreditCard size={16} />
                        <span>Card ending in {cardDetails.number.slice(-4)}</span>
                      </div>
                    ) : (
                      <span>PayPal</span>
                    )}
                  </div>
                </div>

                {/* Order Notes */}
                <div className="mb-6">
                  <h3 className="font-medium mb-3">Order Notes (Optional)</h3>
                  <textarea
                    value={orderNotes}
                    onChange={(e) => setOrderNotes(e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                    rows={3}
                    placeholder="Any special instructions for your order..."
                  />
                </div>
              </div>
            )}

            {/* Step 4: Success */}
            {currentStep === 4 && (
              <div className="bg-white rounded-lg shadow p-8 text-center">
                <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <CheckCircle size={40} className="text-green-600" />
                </div>
                <h2 className="text-2xl font-bold mb-2">Order Placed Successfully!</h2>
                <p className="text-gray-600 mb-6">
                  Thank you for your order. We've sent a confirmation email to {shippingAddress.email}
                </p>
                
                <div className="bg-gray-50 rounded-lg p-4 mb-6 text-left max-w-md mx-auto">
                  <div className="flex justify-between mb-2">
                    <span className="text-gray-600">Order Number:</span>
                    <span className="font-bold">#MTG{Date.now().toString().slice(-6)}</span>
                  </div>
                  <div className="flex justify-between mb-2">
                    <span className="text-gray-600">Total Amount:</span>
                    <span className="font-bold">{formatPrice(calculateTotal())}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Estimated Delivery:</span>
                    <span className="font-bold">5-7 business days</span>
                  </div>
                </div>
                
                <div className="flex gap-4 justify-center">
                  <button
                    onClick={() => window.location.href = '/'}
                    className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                  >
                    Continue Shopping
                  </button>
                  <button
                    onClick={() => window.location.href = '/orders'}
                    className="px-6 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                  >
                    View Orders
                  </button>
                </div>
              </div>
            )}

            {/* Navigation Buttons */}
            {currentStep < 4 && (
              <div className="flex justify-between mt-6">
                <button
                  onClick={currentStep > 1 ? handleBack : onClose}
                  className="px-6 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 flex items-center gap-2"
                >
                  <ArrowLeft size={16} />
                  {currentStep > 1 ? 'Back' : 'Cancel'}
                </button>
                
                <button
                  onClick={handleNext}
                  disabled={loading}
                  className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 flex items-center gap-2"
                >
                  {loading ? (
                    'Processing...'
                  ) : currentStep === 3 ? (
                    <>
                      <Lock size={16} />
                      Place Order • {formatPrice(calculateTotal())}
                    </>
                  ) : (
                    <>
                      Continue
                      <ArrowRight size={16} />
                    </>
                  )}
                </button>
              </div>
            )}
          </div>

          {/* Order Summary Sidebar */}
          {currentStep < 4 && (
            <div className="lg:col-span-1">
              <div className="bg-white rounded-lg shadow p-6 sticky top-4">
                <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                  <ShoppingCart size={20} />
                  Order Summary
                </h3>
                
                {/* Items */}
                <div className="space-y-3 mb-4 max-h-64 overflow-y-auto">
                  {cartItems.map((item, index) => (
                    <div key={index} className="flex justify-between text-sm">
                      <div className="flex-1">
                        <div className="font-medium">{item.card_name}</div>
                        <div className="text-gray-600">
                          {item.condition} • Qty: {item.quantity || 1}
                        </div>
                      </div>
                      <div className="font-medium">
                        {formatPrice(item.price * (item.quantity || 1))}
                      </div>
                    </div>
                  ))}
                </div>
                
                <div className="border-t pt-4 space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Subtotal</span>
                    <span>{formatPrice(calculateSubtotal())}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>Shipping</span>
                    <span>
                      {calculateShipping() === 0 ? (
                        <span className="text-green-600">FREE</span>
                      ) : (
                        formatPrice(calculateShipping())
                      )}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>GST (10%)</span>
                    <span>{formatPrice(calculateTax())}</span>
                  </div>
                  <div className="border-t pt-2 flex justify-between font-bold text-lg">
                    <span>Total</span>
                    <span className="text-green-600">{formatPrice(calculateTotal())}</span>
                  </div>
                </div>
                
                {/* Promo Code */}
                <div className="mt-4 p-3 bg-blue-50 rounded-lg">
                  <div className="flex items-center gap-2 text-blue-800 text-sm">
                    <Info size={16} />
                    <span>Free shipping on orders over $100</span>
                  </div>
                </div>
                
                {/* Security Info */}
                <div className="mt-4 flex items-center gap-2 text-gray-600 text-xs">
                  <Lock size={14} />
                  <span>Secure checkout powered by Stripe</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default CheckoutFlow;