import React, { useState } from 'react';
import { Package, Check, AlertCircle, DollarSign, Percent, Shield, Info, ChevronRight, FileText, Loader } from 'lucide-react';

const ListingReview = ({ cards, stats, onSubmit, onBack, loading }) => {
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [notes, setNotes] = useState('');
  
  const formatPrice = (price) => {
    return new Intl.NumberFormat('en-AU', { 
      style: 'currency', 
      currency: 'AUD' 
    }).format(price || 0);
  };
  
  const marketplaceFee = stats.estimatedValue * 0.045; // 4.5% fee
  const estimatedProfit = stats.estimatedValue - marketplaceFee;
  
  const getConditionBadge = (condition) => {
    const colors = {
      'NM': 'bg-green-100 text-green-800',
      'LP': 'bg-blue-100 text-blue-800',
      'MP': 'bg-yellow-100 text-yellow-800',
      'HP': 'bg-orange-100 text-orange-800',
      'DMG': 'bg-red-100 text-red-800'
    };
    return colors[condition] || 'bg-gray-100 text-gray-800';
  };

  return (
    <div className="space-y-6">
      {/* Summary Header */}
      <div className="bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg p-6">
        <h2 className="text-2xl font-bold mb-4">Review Your Listings</h2>
        <div className="grid md:grid-cols-4 gap-4">
          <div className="bg-white rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <Package className="text-blue-600" size={20} />
              <span className="text-sm text-gray-600">Total Cards</span>
            </div>
            <div className="text-2xl font-bold">{stats.totalCards}</div>
            <div className="text-xs text-gray-500">{stats.uniqueCards} unique</div>
          </div>
          
          <div className="bg-white rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <DollarSign className="text-green-600" size={20} />
              <span className="text-sm text-gray-600">Total Value</span>
            </div>
            <div className="text-2xl font-bold">{formatPrice(stats.estimatedValue)}</div>
            <div className="text-xs text-gray-500">Market value</div>
          </div>
          
          <div className="bg-white rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <Percent className="text-orange-600" size={20} />
              <span className="text-sm text-gray-600">Marketplace Fee</span>
            </div>
            <div className="text-2xl font-bold">{formatPrice(marketplaceFee)}</div>
            <div className="text-xs text-gray-500">4.5% commission</div>
          </div>
          
          <div className="bg-white rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <Shield className="text-purple-600" size={20} />
              <span className="text-sm text-gray-600">Your Profit</span>
            </div>
            <div className="text-2xl font-bold text-green-600">
              {formatPrice(estimatedProfit)}
            </div>
            <div className="text-xs text-gray-500">After fees</div>
          </div>
        </div>
      </div>
      
      {/* Cards List */}
      <div className="bg-white rounded-lg">
        <div className="p-4 border-b">
          <h3 className="font-semibold">Listing Details ({cards.length} cards)</h3>
        </div>
        
        <div className="max-h-96 overflow-y-auto">
          <table className="w-full">
            <thead className="bg-gray-50 sticky top-0">
              <tr>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-600 uppercase">Card</th>
                <th className="px-4 py-2 text-center text-xs font-medium text-gray-600 uppercase">Set</th>
                <th className="px-4 py-2 text-center text-xs font-medium text-gray-600 uppercase">Condition</th>
                <th className="px-4 py-2 text-center text-xs font-medium text-gray-600 uppercase">Qty</th>
                <th className="px-4 py-2 text-right text-xs font-medium text-gray-600 uppercase">Price Each</th>
                <th className="px-4 py-2 text-right text-xs font-medium text-gray-600 uppercase">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {cards.map(card => (
                <tr key={card.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      {card.imageUrl && (
                        <img 
                          src={card.imageUrl} 
                          alt={card.name}
                          className="w-12 h-16 object-cover rounded"
                        />
                      )}
                      <div>
                        <div className="font-medium">{card.name}</div>
                        {card.foil && (
                          <span className="text-xs bg-purple-100 text-purple-800 px-1 rounded">Foil</span>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-center text-sm">
                    {card.set_name || card.set}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className={`px-2 py-1 text-xs rounded ${getConditionBadge(card.condition)}`}>
                      {card.condition}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center font-medium">
                    {card.quantity}
                  </td>
                  <td className="px-4 py-3 text-right font-medium">
                    {formatPrice(card.userPrice || card.suggestedPrice || card.price)}
                  </td>
                  <td className="px-4 py-3 text-right font-bold text-green-600">
                    {formatPrice((card.userPrice || card.suggestedPrice || card.price) * card.quantity)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      
      {/* Listing Options */}
      <div className="bg-white rounded-lg p-6">
        <h3 className="font-semibold mb-4">Listing Options</h3>
        
        <div className="space-y-3">
          <label className="flex items-start gap-3">
            <input 
              type="checkbox" 
              className="mt-1"
              defaultChecked
            />
            <div>
              <div className="font-medium">Auto-renew listings</div>
              <div className="text-sm text-gray-600">Automatically relist cards after 30 days</div>
            </div>
          </label>
          
          <label className="flex items-start gap-3">
            <input 
              type="checkbox" 
              className="mt-1"
              defaultChecked
            />
            <div>
              <div className="font-medium">Accept offers</div>
              <div className="text-sm text-gray-600">Allow buyers to make offers on your cards</div>
            </div>
          </label>
          
          <label className="flex items-start gap-3">
            <input 
              type="checkbox" 
              className="mt-1"
            />
            <div>
              <div className="font-medium">International shipping</div>
              <div className="text-sm text-gray-600">Ship to countries outside Australia</div>
            </div>
          </label>
        </div>
        
        <div className="mt-4">
          <label className="block text-sm font-medium mb-2">
            Additional Notes (Optional)
          </label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Any special notes about your listings..."
            className="w-full px-3 py-2 border rounded-lg"
            rows={3}
          />
        </div>
      </div>
      
      {/* Terms & Conditions */}
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
        <h3 className="font-semibold mb-3 flex items-center gap-2">
          <FileText size={20} />
          Seller Agreement
        </h3>
        
        <div className="text-sm text-gray-700 space-y-2 mb-4">
          <p>By listing your cards, you agree to:</p>
          <ul className="list-disc list-inside space-y-1 ml-2">
            <li>Accurately describe card conditions</li>
            <li>Ship orders within 2 business days</li>
            <li>Use protective packaging for all cards</li>
            <li>Provide tracking for orders over $50</li>
            <li>Pay a 4.5% marketplace fee on successful sales</li>
            <li>Maintain a positive seller rating above 4.0</li>
          </ul>
        </div>
        
        <label className="flex items-start gap-3">
          <input
            type="checkbox"
            checked={agreedToTerms}
            onChange={(e) => setAgreedToTerms(e.target.checked)}
            className="mt-1"
          />
          <div>
            <div className="font-medium">I agree to the seller terms and conditions</div>
            <div className="text-xs text-gray-600">
              Read full <a href="#" className="text-blue-600 hover:underline">Terms of Service</a> and{' '}
              <a href="#" className="text-blue-600 hover:underline">Seller Agreement</a>
            </div>
          </div>
        </label>
      </div>
      
      {/* Success Expectations */}
      <div className="bg-green-50 border border-green-200 rounded-lg p-6">
        <h3 className="font-semibold mb-3 flex items-center gap-2 text-green-900">
          <Info size={20} />
          What Happens Next?
        </h3>
        
        <div className="grid md:grid-cols-3 gap-4 text-sm">
          <div>
            <div className="font-medium text-green-800 mb-1">1. Instant Listing</div>
            <p className="text-green-700">Your cards go live immediately after submission</p>
          </div>
          <div>
            <div className="font-medium text-green-800 mb-1">2. Email Notifications</div>
            <p className="text-green-700">Get notified when cards sell or receive offers</p>
          </div>
          <div>
            <div className="font-medium text-green-800 mb-1">3. Quick Payment</div>
            <p className="text-green-700">Funds available 24 hours after delivery confirmation</p>
          </div>
        </div>
        
        <div className="mt-4 p-3 bg-white rounded-lg">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs text-gray-600">Estimated time to first sale:</div>
              <div className="font-bold text-green-600">{stats.avgTimeToSell} days</div>
            </div>
            <div className="text-right">
              <div className="text-xs text-gray-600">Success rate for similar listings:</div>
              <div className="font-bold text-green-600">87%</div>
            </div>
          </div>
        </div>
      </div>
      
      {/* Action Buttons */}
      <div className="flex justify-between items-center">
        <button
          onClick={onBack}
          className="px-6 py-3 border border-gray-300 rounded-lg hover:bg-gray-50"
        >
          Back to Pricing
        </button>
        
        <div className="flex items-center gap-4">
          {!agreedToTerms && (
            <div className="text-sm text-red-600 flex items-center gap-2">
              <AlertCircle size={16} />
              Please agree to terms to continue
            </div>
          )}
          
          <button
            onClick={onSubmit}
            disabled={!agreedToTerms || loading || cards.length === 0}
            className="px-8 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-400 font-semibold flex items-center gap-2"
          >
            {loading ? (
              <>
                <Loader className="animate-spin" size={20} />
                Creating Listings...
              </>
            ) : (
              <>
                <Check size={20} />
                List {cards.length} Cards • {formatPrice(estimatedProfit)}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ListingReview;