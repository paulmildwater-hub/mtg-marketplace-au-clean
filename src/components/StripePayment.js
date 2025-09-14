// src/components/StripePayment.js
import React, { useState, useEffect } from 'react';
import {
  Elements,
  CardElement,
  useStripe,
  useElements
} from '@stripe/react-stripe-js';
import { loadStripe } from '@stripe/stripe-js';
import { Lock, CreditCard, AlertCircle } from 'lucide-react';

// Initialize Stripe - use your publishable key
const stripePromise = loadStripe(process.env.REACT_APP_STRIPE_PUBLISHABLE_KEY || 'pk_test_your_key_here');

const CARD_ELEMENT_OPTIONS = {
  style: {
    base: {
      color: '#32325d',
      fontFamily: '"Helvetica Neue", Helvetica, sans-serif',
      fontSmoothing: 'antialiased',
      fontSize: '16px',
      '::placeholder': {
        color: '#aab7c4'
      }
    },
    invalid: {
      color: '#fa755a',
      iconColor: '#fa755a'
    }
  }
};

function CheckoutForm({ amount, orderId, onSuccess, onError }) {
  const stripe = useStripe();
  const elements = useElements();
  const [error, setError] = useState(null);
  const [processing, setProcessing] = useState(false);
  const [saveCard, setSaveCard] = useState(false);
  const [billingDetails, setBillingDetails] = useState({
    name: '',
    email: '',
    address: {
      line1: '',
      city: '',
      state: '',
      postal_code: '',
      country: 'AU'
    }
  });

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (!stripe || !elements) {
      return;
    }

    setProcessing(true);
    setError(null);

    try {
      // Create payment intent on your server
      const token = localStorage.getItem('authToken');
      const response = await fetch('/api/payment/create-intent', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          amount,
          orderId,
          saveCard
        })
      });

      const { clientSecret, error: serverError } = await response.json();

      if (serverError) {
        throw new Error(serverError);
      }

      // Confirm the payment
      const result = await stripe.confirmCardPayment(clientSecret, {
        payment_method: {
          card: elements.getElement(CardElement),
          billing_details: billingDetails
        },
        setup_future_usage: saveCard ? 'off_session' : null
      });

      if (result.error) {
        setError(result.error.message);
        if (onError) onError(result.error);
      } else {
        if (result.paymentIntent.status === 'succeeded') {
          if (onSuccess) onSuccess(result.paymentIntent);
        }
      }
    } catch (err) {
      setError(err.message);
      if (onError) onError(err);
    } finally {
      setProcessing(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium mb-2">Cardholder Name</label>
        <input
          type="text"
          value={billingDetails.name}
          onChange={(e) => setBillingDetails({
            ...billingDetails,
            name: e.target.value
          })}
          className="w-full px-3 py-2 border rounded-lg"
          required
        />
      </div>

      <div>
        <label className="block text-sm font-medium mb-2">Email</label>
        <input
          type="email"
          value={billingDetails.email}
          onChange={(e) => setBillingDetails({
            ...billingDetails,
            email: e.target.value
          })}
          className="w-full px-3 py-2 border rounded-lg"
          required
        />
      </div>

      <div>
        <label className="block text-sm font-medium mb-2">Card Details</label>
        <div className="p-3 border rounded-lg">
          <CardElement options={CARD_ELEMENT_OPTIONS} />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium mb-2">Billing Address</label>
        <input
          type="text"
          placeholder="Address Line 1"
          value={billingDetails.address.line1}
          onChange={(e) => setBillingDetails({
            ...billingDetails,
            address: { ...billingDetails.address, line1: e.target.value }
          })}
          className="w-full px-3 py-2 border rounded-lg mb-2"
          required
        />
        <div className="grid grid-cols-2 gap-2">
          <input
            type="text"
            placeholder="City"
            value={billingDetails.address.city}
            onChange={(e) => setBillingDetails({
              ...billingDetails,
              address: { ...billingDetails.address, city: e.target.value }
            })}
            className="px-3 py-2 border rounded-lg"
            required
          />
          <input
            type="text"
            placeholder="State"
            value={billingDetails.address.state}
            onChange={(e) => setBillingDetails({
              ...billingDetails,
              address: { ...billingDetails.address, state: e.target.value }
            })}
            className="px-3 py-2 border rounded-lg"
            required
          />
        </div>
        <input
          type="text"
          placeholder="Postal Code"
          value={billingDetails.address.postal_code}
          onChange={(e) => setBillingDetails({
            ...billingDetails,
            address: { ...billingDetails.address, postal_code: e.target.value }
          })}
          className="w-full px-3 py-2 border rounded-lg mt-2"
          required
        />
      </div>

      <div className="flex items-center">
        <input
          type="checkbox"
          id="saveCard"
          checked={saveCard}
          onChange={(e) => setSaveCard(e.target.checked)}
          className="mr-2"
        />
        <label htmlFor="saveCard" className="text-sm">
          Save this card for future purchases
        </label>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-start gap-2">
          <AlertCircle size={20} className="text-red-600 mt-0.5" />
          <div className="text-sm text-red-800">{error}</div>
        </div>
      )}

      <button
        type="submit"
        disabled={!stripe || processing}
        className="w-full bg-green-600 text-white py-3 rounded-lg font-semibold hover:bg-green-700 disabled:bg-gray-400 transition flex items-center justify-center gap-2"
      >
        {processing ? (
          <>Processing...</>
        ) : (
          <>
            <Lock size={20} />
            Pay ${amount.toFixed(2)} AUD
          </>
        )}
      </button>

      <div className="text-xs text-gray-500 text-center flex items-center justify-center gap-2">
        <Lock size={14} />
        Secured by Stripe
      </div>
    </form>
  );
}

export default function StripePayment({ amount, orderId, onSuccess, onError }) {
  return (
    <Elements stripe={stripePromise}>
      <CheckoutForm
        amount={amount}
        orderId={orderId}
        onSuccess={onSuccess}
        onError={onError}
      />
    </Elements>
  );
}