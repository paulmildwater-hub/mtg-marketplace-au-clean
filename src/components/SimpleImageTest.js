// src/components/SimpleImageTest.js
import React, { useState } from 'react';

const SimpleImageTest = () => {
  const [testResults, setTestResults] = useState({});
  
  // Test URLs - from most likely to work to least likely
  const testImages = [
    {
      name: 'Static Card Back',
      url: 'https://cards.scryfall.io/back.png',
      description: 'Scryfall card back (should always work)'
    },
    {
      name: 'Lightning Bolt (Direct URL)',
      url: 'https://cards.scryfall.io/normal/front/e/b/eb72cfc8-6235-4951-b1ba-6d315c639743.jpg',
      description: 'Direct Scryfall CDN URL'
    },
    {
      name: 'Placeholder Service',
      url: 'https://via.placeholder.com/200x280?text=MTG+Card',
      description: 'External placeholder service'
    },
    {
      name: 'Local Test (if backend running)',
      url: 'http://localhost:5000/api/health',
      description: 'Tests if backend is accessible'
    }
  ];

  const handleImageLoad = (name, success, error = null) => {
    setTestResults(prev => ({
      ...prev,
      [name]: { success, error: error?.message || null }
    }));
  };

  const testBackendCard = async () => {
    try {
      const response = await fetch('http://localhost:5000/api/cards/search?q=black%20lotus');
      const data = await response.json();
      
      if (data.cards && data.cards[0]) {
        const card = data.cards[0];
        console.log('Backend returned card:', card);
        
        // Log all image-related fields
        console.log('Image fields:', {
          imageUrl: card.imageUrl,
          image_url: card.image_url,
          originalImageUrl: card.originalImageUrl
        });
        
        // Try to display the image
        const imgUrl = card.imageUrl || card.image_url || card.originalImageUrl;
        if (imgUrl) {
          const img = new Image();
          img.onload = () => {
            console.log('✅ Successfully loaded image from backend:', imgUrl);
            alert('Image loaded successfully! Check console for details.');
          };
          img.onerror = () => {
            console.error('❌ Failed to load image from backend:', imgUrl);
            alert('Failed to load image! Check console for details.');
          };
          img.src = imgUrl;
        } else {
          console.error('❌ No image URL found in card data');
          alert('No image URL in card data! Check console.');
        }
      }
    } catch (error) {
      console.error('Failed to fetch from backend:', error);
      alert('Backend fetch failed! Is your server running on port 5000?');
    }
  };

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">MTG Image Loading Test</h1>
      
      <div className="mb-8 bg-yellow-50 border border-yellow-200 rounded-lg p-4">
        <h2 className="font-bold mb-2">Instructions:</h2>
        <ol className="list-decimal list-inside space-y-1 text-sm">
          <li>Open browser console (F12 → Console tab)</li>
          <li>Look for any red error messages below</li>
          <li>Check if images load with green checkmarks</li>
          <li>Click "Test Backend" to check your server</li>
        </ol>
      </div>

      <div className="grid gap-4 mb-6">
        {testImages.map((test) => (
          <div key={test.name} className="border rounded-lg p-4">
            <div className="flex items-start gap-4">
              <div className="flex-shrink-0">
                <img
                  src={test.url}
                  alt={test.name}
                  className="w-32 h-44 object-cover rounded border-2 border-gray-300"
                  onLoad={() => {
                    console.log(`✅ Loaded: ${test.name}`);
                    handleImageLoad(test.name, true);
                  }}
                  onError={(e) => {
                    console.error(`❌ Failed: ${test.name}`, test.url);
                    handleImageLoad(test.name, false, new Error('Failed to load'));
                  }}
                />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold">{test.name}</h3>
                <p className="text-sm text-gray-600 mb-2">{test.description}</p>
                <div className="text-xs font-mono bg-gray-100 p-2 rounded break-all">
                  {test.url}
                </div>
                <div className="mt-2">
                  {testResults[test.name] ? (
                    testResults[test.name].success ? (
                      <span className="text-green-600 font-semibold">✅ Loaded Successfully</span>
                    ) : (
                      <span className="text-red-600 font-semibold">❌ Failed to Load</span>
                    )
                  ) : (
                    <span className="text-gray-400">Loading...</span>
                  )}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="space-y-4">
        <button
          onClick={testBackendCard}
          className="w-full px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-semibold"
        >
          Test Backend Card Fetch
        </button>

        <button
          onClick={() => {
            console.clear();
            console.log('%c=== Starting Fresh Debug Session ===', 'color: blue; font-size: 16px; font-weight: bold');
            console.log('1. Testing basic image loading...');
            window.location.reload();
          }}
          className="w-full px-4 py-3 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
        >
          Clear Console & Reload
        </button>
      </div>

      <div className="mt-8 bg-gray-50 rounded-lg p-4">
        <h2 className="font-bold mb-2">Common Issues & Fixes:</h2>
        <ul className="space-y-2 text-sm">
          <li className="flex items-start gap-2">
            <span className="text-red-500">•</span>
            <div>
              <strong>CORS errors:</strong> Check that your backend has proper CORS headers
            </div>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-red-500">•</span>
            <div>
              <strong>404 errors:</strong> The image URL is incorrect or image doesn't exist
            </div>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-red-500">•</span>
            <div>
              <strong>Backend not responding:</strong> Make sure server.js is running on port 5000
            </div>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-red-500">•</span>
            <div>
              <strong>Images blocked:</strong> Check ad blockers or browser extensions
            </div>
          </li>
        </ul>
      </div>
    </div>
  );
};

export default SimpleImageTest;