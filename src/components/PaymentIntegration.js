// src/components/PaymentIntegration.js
import React, { useState, useEffect } from 'react';
import {
  CreditCard,
  Lock,
  AlertCircle,
  CheckCircle,
  Shield,
  Loader,
  X,
  ChevronDown,
  Info
} from 'lucide-react';
import {
  Elements,
  CardElement,
  useStripe,
  useElements
} from '@stripe/react-stripe-js';
import { loadStripe } from '@stripe/stripe-js';
import { PayPalButtons, PayPalScriptProvider } from '@paypal/react-paypal-js';

// Initialize Stripe - use your publishable key from .env
const stripePromise = loadStripe(process.env.REACT_APP_STRIPE_PUBLISHABLE_KEY || 'pk_test_placeholder');

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

// Stripe Card Form Component
function StripeCardForm({ amount, orderId, onSuccess, onError, saveCard, setSaveCard }) {
  const stripe = useStripe();
  const elements = useElements();
  const [processing, setProcessing] = useState(false);
  const [cardholderName, setCardholderName] = useState('');
  const [error, setError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!stripe || !elements) return;
    
    setProcessing(true);
    setError(null);
    
    try {
      // Create payment intent on server
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${API_URL}/payment/create-intent`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ amount, orderId })
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to create payment intent');
      }
      
      const { clientSecret } = data;
      
      // Confirm the payment
      const result = await stripe.confirmCardPayment(clientSecret, {
        payment_method: {
          card: elements.getElement(CardElement),
          billing_details: {
            name: cardholderName
          }
        },
        setup_future_usage: saveCard ? 'off_session' : null
      });
      
      if (result.error) {
        setError(result.error.message);
        if (onError) onError(result.error);
      } else {
        if (result.paymentIntent.status === 'succeeded') {
          // Save card if requested
          if (saveCard) {
            const saveResponse = await fetch(`${API_URL}/payment/save-card`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
              },
              body: JSON.stringify({
                paymentMethodId: result.paymentIntent.payment_method
              })
            });
            
            if (!saveResponse.ok) {
              console.error('Failed to save card for future use');
            }
          }
          
          if (onSuccess) {
            onSuccess(result.paymentIntent);
          }
        }
      }
    } catch (err) {
      console.error('Payment error:', err);
      setError(err.message);
      if (onError) onError(err);
    } finally {
      setProcessing(false);
    }
  };

  const cardElementOptions = {
    style: {
      base: {
        fontSize: '16px',
        color: '#424770',
        '::placeholder': {
          color: '#aab7c4',
        },
      },
      invalid: {
        color: '#9e2146',
      },
    },
  };

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium mb-2">Cardholder Name</label>
        <input
          type="text"
          value={cardholderName}
          onChange={(e) => setCardholderName(e.target.value)}
          className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
          placeholder="John Doe"
          required
        />
      </div>
      
      <div>
        <label className="block text-sm font-medium mb-2">Card Details</label>
        <div className="p-3 border rounded-lg">
          <CardElement options={cardElementOptions} />
        </div>
      </div>
      
      <label className="flex items-center cursor-pointer">
        <input
          type="checkbox"
          checked={saveCard}
          onChange={(e) => setSaveCard(e.target.checked)}
          className="mr-2"
        />
        <span className="text-sm">Save this card for future purchases</span>
      </label>
      
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-start gap-2">
          <AlertCircle size={20} className="text-red-600 mt-0.5" />
          <div className="text-sm text-red-800">{error}</div>
        </div>
      )}
      
      <button
        onClick={handleSubmit}
        disabled={!stripe || processing || !cardholderName}
        className="w-full bg-green-600 text-white py-3 rounded-lg font-semibold hover:bg-green-700 disabled:bg-gray-400 transition flex items-center justify-center gap-2"
      >
        {processing ? (
          <>
            <Loader className="animate-spin" size={20} />
            Processing...
          </>
        ) : (
          <>
            <Lock size={20} />
            Pay ${amount.toFixed(2)} AUD
          </>
        )}
      </button>
    </div>
  );
}

// Main Payment Component
function PaymentIntegration({ amount, orderId, cartItems, onSuccess, onError, onClose }) {
  const [paymentMethod, setPaymentMethod] = useState('card');
  const [savedCards, setSavedCards] = useState([]);
  const [selectedCard, setSelectedCard] = useState(null);
  const [useNewCard, setUseNewCard] = useState(true);
  const [saveCard, setSaveCard] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchSavedCards();
  }, []);

  const fetchSavedCards = async () => {
    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${API_URL}/payment/saved-cards`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        setSavedCards(data.cards || []);
      }
    } catch (error) {
      console.error('Failed to fetch saved cards:', error);
    }
  };

  const handleStripeSuccess = (paymentIntent) => {
    setSuccess(true);
    if (onSuccess) {
      onSuccess({
        paymentIntentId: paymentIntent.id,
        method: 'stripe'
      });
    }
  };

  const handlePayPalApprove = async (data) => {
    setProcessing(true);
    setError(null);
    
    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${API_URL}/payment/capture-paypal`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          paypalOrderId: data.orderID,
          orderId: orderId
        })
      });
      
      const result = await response.json();
      
      if (result.success) {
        setSuccess(true);
        if (onSuccess) {
          onSuccess({
            captureId: result.captureId,
            method: 'paypal'
          });
        }
      } else {
        throw new Error(result.error || 'PayPal payment failed');
      }
    } catch (err) {
      setError(err.message);
      if (onError) onError(err);
    } finally {
      setProcessing(false);
    }
  };

  const createPayPalOrder = async () => {
    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${API_URL}/payment/create-paypal-order`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          amount,
          orderId,
          items: cartItems.map(item => ({
            name: item.card_name,
            price: item.price,
            quantity: item.quantity || 1
          }))
        })
      });
      
      const result = await response.json();
      
      if (result.success) {
        return result.orderId;
      } else {
        throw new Error(result.error);
      }
    } catch (error) {
      console.error('Failed to create PayPal order:', error);
      throw error;
    }
  };

  const handleSavedCardPayment = async () => {
    if (!selectedCard) {
      setError('Please select a card');
      return;
    }
    
    setProcessing(true);
    setError(null);
    
    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${API_URL}/payment/charge-saved-card`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          paymentMethodId: selectedCard,
          amount,
          orderId
        })
      });
      
      const result = await response.json();
      
      if (result.success) {
        setSuccess(true);
        if (onSuccess) {
          onSuccess({
            paymentIntentId: result.paymentIntentId,
            method: 'stripe'
          });
        }
      } else {
        throw new Error(result.error || 'Payment failed');
      }
    } catch (err) {
      setError(err.message);
      if (onError) onError(err);
    } finally {
      setProcessing(false);
    }
  };

  const formatPrice = (price) => {
    return new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' }).format(price);
  };

  if (success) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-xl max-w-md w-full p-8 text-center">
          <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle size={40} className="text-green-600" />
          </div>
          <h2 className="text-2xl font-bold mb-2">Payment Successful!</h2>
          <p className="text-gray-600 mb-4">
            Your payment of {formatPrice(amount)} has been processed successfully.
          </p>
          <p className="text-sm text-gray-500">
            Order #{orderId}
          </p>
          <button
            onClick={onClose}
            className="mt-6 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Continue
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b flex justify-between items-center">
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Lock size={20} />
            Secure Payment
          </h2>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded">
            <X size={24} />
          </button>
        </div>
        
        <div className="p-6">
          {/* Payment Amount */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
            <div className="flex justify-between items-center">
              <span className="text-gray-700">Amount to Pay:</span>
              <span className="text-2xl font-bold text-blue-600">{formatPrice(amount)}</span>
            </div>
          </div>

          {/* Error Message */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6 flex items-start gap-2">
              <AlertCircle size={20} className="text-red-600 mt-0.5" />
              <div className="flex-1">
                <p className="text-red-800 font-medium">Payment Error</p>
                <p className="text-red-600 text-sm">{error}</p>
              </div>
            </div>
          )}

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
                <span className="flex items-center gap-2">
                  <div className="w-20 h-5 bg-blue-600 rounded px-2 text-white text-xs flex items-center justify-center">PayPal</div>
                </span>
              </label>
            </div>
          </div>

          {/* Saved Cards */}
          {paymentMethod === 'card' && savedCards.length > 0 && (
            <div className="mb-6">
              <h3 className="font-medium mb-3">Saved Cards</h3>
              <div className="space-y-2">
                {savedCards.map(card => (
                  <label key={card.id} className="flex items-center p-3 border rounded-lg cursor-pointer hover:bg-gray-50">
                    <input
                      type="radio"
                      name="savedCard"
                      checked={!useNewCard && selectedCard === card.id}
                      onChange={() => {
                        setUseNewCard(false);
                        setSelectedCard(card.id);
                      }}
                      className="mr-3"
                    />
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <CreditCard size={16} />
                        <span>•••• {card.last4}</span>
                      </div>
                      <div className="text-sm text-gray-600">
                        {card.brand} • Expires {card.exp_month}/{card.exp_year}
                      </div>
                    </div>
                  </label>
                ))}
                
                <label className="flex items-center p-3 border rounded-lg cursor-pointer hover:bg-gray-50">
                  <input
                    type="radio"
                    name="savedCard"
                    checked={useNewCard}
                    onChange={() => setUseNewCard(true)}
                    className="mr-3"
                  />
                  <span>Use a new card</span>
                </label>
              </div>
              
              {!useNewCard && selectedCard && (
                <button
                  onClick={handleSavedCardPayment}
                  disabled={processing}
                  className="w-full mt-4 bg-green-600 text-white py-3 rounded-lg font-semibold hover:bg-green-700 disabled:bg-gray-400 transition flex items-center justify-center gap-2"
                >
                  {processing ? (
                    <>
                      <Loader className="animate-spin" size={20} />
                      Processing...
                    </>
                  ) : (
                    <>
                      <Lock size={20} />
                      Pay with Saved Card
                    </>
                  )}
                </button>
              )}
            </div>
          )}

          {/* Payment Forms */}
          {paymentMethod === 'card' && useNewCard && (
            <Elements stripe={stripePromise}>
              <StripeCardForm
                amount={amount}
                orderId={orderId}
                onSuccess={handleStripeSuccess}
                onError={onError}
                saveCard={saveCard}
                setSaveCard={setSaveCard}
              />
            </Elements>
          )}

          {paymentMethod === 'paypal' && (
            <div>
              <div className="mb-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <Info size={20} className="text-yellow-600" />
                  <span className="font-medium">PayPal Payment</span>
                </div>
                <p className="text-sm text-gray-700">
                  You will be redirected to PayPal to complete your payment securely.
                </p>
              </div>
              
              <PayPalScriptProvider
                options={{
                  "client-id": process.env.REACT_APP_PAYPAL_CLIENT_ID || "test",
                  currency: "AUD"
                }}
              >
                <PayPalButtons
                  style={{ layout: 'vertical' }}
                  createOrder={createPayPalOrder}
                  onApprove={handlePayPalApprove}
                  onError={(err) => {
                    setError('PayPal payment failed');
                    if (onError) onError(err);
                  }}
                />
              </PayPalScriptProvider>
            </div>
          )}

          {/* Security Badge */}
          <div className="mt-6 bg-gray-50 p-4 rounded-lg flex items-center gap-3">
            <Shield size={24} className="text-green-600" />
            <div>
              <p className="font-medium text-sm">Secure & Encrypted</p>
              <p className="text-xs text-gray-600">
                Your payment information is protected with bank-level security
              </p>
            </div>
          </div>

          {/* Terms */}
          <p className="text-xs text-gray-500 text-center mt-4">
            By completing this purchase, you agree to our Terms of Service and Privacy Policy
          </p>
        </div>
      </div>
    </div>
  );
}

export default PaymentIntegration;