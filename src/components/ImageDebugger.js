// src/components/ImageDebugger.js
import React, { useState, useEffect } from 'react';
import { AlertCircle, CheckCircle, XCircle, Info, RefreshCw } from 'lucide-react';

const ImageDebugger = () => {
  const [debugResults, setDebugResults] = useState([]);
  const [testCard, setTestCard] = useState(null);
  const [backendStatus, setBackendStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [imageTests, setImageTests] = useState([]);

  useEffect(() => {
    runDiagnostics();
  }, []);

  const runDiagnostics = async () => {
    setLoading(true);
    const results = [];

    // Test 1: Check if backend is running
    try {
      const response = await fetch('http://localhost:5000/api/health');
      const data = await response.json();
      results.push({
        test: 'Backend Connection',
        status: 'success',
        message: `Backend is running: ${data.status}`,
        details: data
      });
      setBackendStatus(true);
    } catch (error) {
      results.push({
        test: 'Backend Connection',
        status: 'error',
        message: 'Cannot connect to backend at http://localhost:5000',
        details: error.message,
        fix: 'Make sure your backend server is running: cd to backend folder and run "npm start"'
      });
      setBackendStatus(false);
    }

    // Test 2: Direct Scryfall image test
    try {
      await testImageUrl(
        'https://cards.scryfall.io/normal/front/0/0/00000000-0000-0000-0000-000000000000.jpg',
        'Scryfall CDN Direct Access',
        results
      );
    } catch (error) {
      results.push({
        test: 'Scryfall CDN',
        status: 'error',
        message: 'Cannot load images from Scryfall CDN',
        details: error.message,
        fix: 'Check your internet connection or firewall settings'
      });
    }

    // Test 3: Fetch a real card from backend
    if (backendStatus !== false) {
      try {
        const response = await fetch('http://localhost:5000/api/cards/search?q=lightning%20bolt&includeImages=true');
        const data = await response.json();
        
        if (data.cards && data.cards.length > 0) {
          const card = data.cards[0];
          setTestCard(card);
          
          results.push({
            test: 'Backend Card Search',
            status: 'success',
            message: `Found card: ${card.name}`,
            details: {
              hasImageUrl: !!card.imageUrl,
              hasImage_url: !!card.image_url,
              hasOriginalImageUrl: !!card.originalImageUrl,
              imageUrl: card.imageUrl,
              image_url: card.image_url
            }
          });

          // Test the actual image URL from the card
          if (card.imageUrl || card.image_url) {
            const urlToTest = card.imageUrl || card.image_url;
            await testImageUrl(urlToTest, 'Card Image from Backend', results);
          } else {
            results.push({
              test: 'Card Image URL',
              status: 'error',
              message: 'Backend returned card without image URL',
              fix: 'Check processCardImage function in server.js'
            });
          }
        } else {
          results.push({
            test: 'Backend Card Search',
            status: 'warning',
            message: 'No cards returned from search',
            fix: 'Check if Scryfall API is accessible from your backend'
          });
        }
      } catch (error) {
        results.push({
          test: 'Backend Card Search',
          status: 'error',
          message: 'Failed to search cards',
          details: error.message
        });
      }
    }

    // Test 4: Check CORS headers
    try {
      const response = await fetch('http://localhost:5000/api/health');
      const corsHeader = response.headers.get('access-control-allow-origin');
      results.push({
        test: 'CORS Configuration',
        status: corsHeader ? 'success' : 'warning',
        message: corsHeader ? `CORS enabled for: ${corsHeader}` : 'CORS headers not detected',
        fix: !corsHeader ? 'Check CORS configuration in server.js' : null
      });
    } catch (error) {
      // Already handled in backend test
    }

    // Test 5: Test various image URLs
    const testUrls = [
      {
        url: 'https://cards.scryfall.io/normal/front/e/b/eb72cfc8-6235-4951-b1ba-6d315c639743.jpg',
        name: 'Scryfall Normal Image'
      },
      {
        url: 'https://cards.scryfall.io/back.png',
        name: 'Scryfall Card Back'
      },
      {
        url: 'https://via.placeholder.com/488x680?text=Test',
        name: 'Placeholder Service'
      }
    ];

    const imageTestResults = [];
    for (const test of testUrls) {
      const result = await testImageLoadWithDetails(test.url, test.name);
      imageTestResults.push(result);
    }
    setImageTests(imageTestResults);

    setDebugResults(results);
    setLoading(false);
  };

  const testImageUrl = async (url, testName, results) => {
    return new Promise((resolve) => {
      const img = new Image();
      const timeout = setTimeout(() => {
        results.push({
          test: testName,
          status: 'error',
          message: `Image load timeout: ${url}`,
          fix: 'Image took too long to load - check network speed'
        });
        resolve();
      }, 5000);

      img.onload = () => {
        clearTimeout(timeout);
        results.push({
          test: testName,
          status: 'success',
          message: `Successfully loaded image`,
          details: { url, width: img.width, height: img.height }
        });
        resolve();
      };

      img.onerror = () => {
        clearTimeout(timeout);
        results.push({
          test: testName,
          status: 'error',
          message: `Failed to load image`,
          details: { url },
          fix: 'Check if the URL is accessible and CORS is properly configured'
        });
        resolve();
      };

      img.src = url;
    });
  };

  const testImageLoadWithDetails = async (url, name) => {
    return new Promise((resolve) => {
      const startTime = Date.now();
      const img = new Image();
      
      const timeout = setTimeout(() => {
        resolve({
          name,
          url,
          status: 'timeout',
          loadTime: Date.now() - startTime,
          error: 'Load timeout after 5 seconds'
        });
      }, 5000);

      img.onload = () => {
        clearTimeout(timeout);
        resolve({
          name,
          url,
          status: 'success',
          loadTime: Date.now() - startTime,
          dimensions: `${img.width}x${img.height}`
        });
      };

      img.onerror = (error) => {
        clearTimeout(timeout);
        resolve({
          name,
          url,
          status: 'error',
          loadTime: Date.now() - startTime,
          error: 'Failed to load'
        });
      };

      img.src = url;
    });
  };

  const getStatusIcon = (status) => {
    switch(status) {
      case 'success': return <CheckCircle className="text-green-500" size={20} />;
      case 'error': return <XCircle className="text-red-500" size={20} />;
      case 'warning': return <AlertCircle className="text-yellow-500" size={20} />;
      default: return <Info className="text-blue-500" size={20} />;
    }
  };

  const getStatusColor = (status) => {
    switch(status) {
      case 'success': return 'bg-green-50 border-green-200';
      case 'error': return 'bg-red-50 border-red-200';
      case 'warning': return 'bg-yellow-50 border-yellow-200';
      default: return 'bg-blue-50 border-blue-200';
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-6xl mx-auto">
        <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
          <div className="flex justify-between items-center mb-6">
            <div>
              <h1 className="text-2xl font-bold">MTG Marketplace - Image Debugger</h1>
              <p className="text-gray-600 mt-1">Diagnostic tool to identify image loading issues</p>
            </div>
            <button
              onClick={runDiagnostics}
              disabled={loading}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 flex items-center gap-2"
            >
              <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
              {loading ? 'Running...' : 'Re-run Tests'}
            </button>
          </div>

          {loading && (
            <div className="text-center py-8">
              <div className="w-12 h-12 border-4 border-gray-300 border-t-blue-500 rounded-full animate-spin mx-auto mb-4"></div>
              <p>Running diagnostics...</p>
            </div>
          )}

          {!loading && (
            <>
              {/* Test Results */}
              <div className="space-y-4 mb-8">
                <h2 className="text-lg font-semibold">System Tests</h2>
                {debugResults.map((result, index) => (
                  <div key={index} className={`border rounded-lg p-4 ${getStatusColor(result.status)}`}>
                    <div className="flex items-start gap-3">
                      {getStatusIcon(result.status)}
                      <div className="flex-1">
                        <div className="font-medium">{result.test}</div>
                        <div className="text-sm text-gray-600 mt-1">{result.message}</div>
                        {result.details && (
                          <div className="mt-2 p-2 bg-gray-100 rounded text-xs font-mono">
                            <pre>{JSON.stringify(result.details, null, 2)}</pre>
                          </div>
                        )}
                        {result.fix && (
                          <div className="mt-2 p-2 bg-blue-100 rounded text-sm">
                            <strong>Fix:</strong> {result.fix}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Image Load Tests */}
              {imageTests.length > 0 && (
                <div className="mb-8">
                  <h2 className="text-lg font-semibold mb-4">Image Load Tests</h2>
                  <div className="overflow-x-auto">
                    <table className="w-full border-collapse">
                      <thead>
                        <tr className="bg-gray-50">
                          <th className="border p-2 text-left">Image Source</th>
                          <th className="border p-2 text-center">Status</th>
                          <th className="border p-2 text-center">Load Time</th>
                          <th className="border p-2 text-center">Dimensions</th>
                          <th className="border p-2 text-center">Preview</th>
                        </tr>
                      </thead>
                      <tbody>
                        {imageTests.map((test, index) => (
                          <tr key={index}>
                            <td className="border p-2">
                              <div className="font-medium">{test.name}</div>
                              <div className="text-xs text-gray-500 truncate max-w-xs">{test.url}</div>
                            </td>
                            <td className="border p-2 text-center">
                              {test.status === 'success' ? (
                                <span className="text-green-600">✓ Success</span>
                              ) : test.status === 'timeout' ? (
                                <span className="text-yellow-600">⏱ Timeout</span>
                              ) : (
                                <span className="text-red-600">✗ Failed</span>
                              )}
                            </td>
                            <td className="border p-2 text-center">{test.loadTime}ms</td>
                            <td className="border p-2 text-center">{test.dimensions || test.error}</td>
                            <td className="border p-2 text-center">
                              {test.status === 'success' && (
                                <img src={test.url} alt="Test" className="h-16 mx-auto" />
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Test Card Display */}
              {testCard && (
                <div className="mb-8">
                  <h2 className="text-lg font-semibold mb-4">Test Card from Backend</h2>
                  <div className="border rounded-lg p-4 bg-gray-50">
                    <div className="grid md:grid-cols-2 gap-4">
                      <div>
                        <h3 className="font-medium mb-2">Card Data:</h3>
                        <div className="text-sm space-y-1">
                          <div><strong>Name:</strong> {testCard.name}</div>
                          <div><strong>Set:</strong> {testCard.set_name}</div>
                          <div><strong>Has imageUrl:</strong> {testCard.imageUrl ? 'Yes' : 'No'}</div>
                          <div><strong>Has image_url:</strong> {testCard.image_url ? 'Yes' : 'No'}</div>
                        </div>
                        <div className="mt-3">
                          <strong>Image URLs:</strong>
                          <div className="text-xs bg-gray-100 p-2 rounded mt-1 font-mono break-all">
                            <div>imageUrl: {testCard.imageUrl || 'undefined'}</div>
                            <div>image_url: {testCard.image_url || 'undefined'}</div>
                          </div>
                        </div>
                      </div>
                      <div>
                        <h3 className="font-medium mb-2">Image Display Test:</h3>
                        <div className="space-y-2">
                          {(testCard.imageUrl || testCard.image_url) && (
                            <>
                              <div className="text-sm">Using URL: {testCard.imageUrl || testCard.image_url}</div>
                              <img 
                                src={testCard.imageUrl || testCard.image_url}
                                alt={testCard.name}
                                className="h-48 rounded border"
                                onError={(e) => {
                                  e.target.style.border = '2px solid red';
                                  e.target.alt = 'Failed to load image';
                                }}
                                onLoad={(e) => {
                                  e.target.style.border = '2px solid green';
                                }}
                              />
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Recommendations */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h2 className="text-lg font-semibold mb-2 flex items-center gap-2">
                  <Info className="text-blue-600" size={20} />
                  Troubleshooting Steps
                </h2>
                <ol className="list-decimal list-inside space-y-2 text-sm">
                  <li>Ensure your backend server is running on port 5000</li>
                  <li>Check browser console (F12) for any CORS or network errors</li>
                  <li>Verify that processCardImage function in server.js is working correctly</li>
                  <li>Test with browser extensions disabled (especially ad blockers)</li>
                  <li>Try a different browser to isolate browser-specific issues</li>
                  <li>Check if your firewall or antivirus is blocking image requests</li>
                </ol>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default ImageDebugger;