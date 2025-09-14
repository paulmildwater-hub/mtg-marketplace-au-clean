import React, { useState, useRef } from 'react';
import { Camera, Upload, Loader, Check, AlertCircle } from 'lucide-react';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

const CardScanner = ({ onCardsDetected }) => {
  const [scanning, setScanning] = useState(false);
  const [preview, setPreview] = useState(null);
  const [detectedCard, setDetectedCard] = useState(null);
  const [error, setError] = useState(null);
  const fileInputRef = useRef(null);
  const [confidence, setConfidence] = useState(0);

  const handleImageUpload = async (file) => {
    setScanning(true);
    setError(null);
    
    // Create preview
    const reader = new FileReader();
    reader.onloadend = () => {
      setPreview(reader.result);
    };
    reader.readAsDataURL(file);
    
    const formData = new FormData();
    formData.append('image', file);
    
    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${API_URL}/vision/scan-card`, {
        method: 'POST',
        body: formData,
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (!response.ok) {
        throw new Error('Failed to scan card');
      }
      
      const data = await response.json();
      
      if (data.card) {
        setDetectedCard(data.card);
        setConfidence(data.confidence || 0.9);
        
        // Auto-add if high confidence
        if (data.confidence > 0.8) {
          const enrichedCard = {
            id: `scan-${Date.now()}-${Math.random()}`,
            ...data.card,
            quantity: 1,
            condition: data.condition || 'NM',
            language: data.language || 'English',
            foil: data.foil || false,
            suggestedPrice: null,
            userPrice: null,
            selected: true,
            source: 'scan'
          };
          
          setTimeout(() => {
            onCardsDetected([enrichedCard]);
            resetScanner();
          }, 1500);
        }
      } else {
        throw new Error('No card detected in image');
      }
    } catch (error) {
      console.error('Scan failed:', error);
      setError(error.message || 'Failed to scan card. Please try again.');
    } finally {
      setScanning(false);
    }
  };

  const resetScanner = () => {
    setPreview(null);
    setDetectedCard(null);
    setConfidence(0);
    setError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith('image/')) {
      handleImageUpload(file);
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
  };

  return (
    <div className="bg-white rounded-lg p-6">
      <div className="flex justify-between items-center mb-4">
        <h3 className="font-semibold text-lg">Scan Cards with Camera/Photo</h3>
        <div className="text-sm text-gray-600">
          <span className="flex items-center gap-1">
            <Camera size={16} />
            Take photo or upload image
          </span>
        </div>
      </div>

      {!preview ? (
        <div 
          className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-blue-400 transition"
          onDrop={handleDrop}
          onDragOver={handleDragOver}
        >
          <Camera size={48} className="mx-auto mb-4 text-gray-400" />
          <p className="text-gray-600 mb-4">
            Drag & drop a card photo here, or click to select
          </p>
          
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            onChange={(e) => e.target.files[0] && handleImageUpload(e.target.files[0])}
            className="hidden"
          />
          
          <div className="flex gap-3 justify-center">
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={scanning}
              className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition flex items-center gap-2"
            >
              <Camera size={20} />
              Take Photo
            </button>
            
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={scanning}
              className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition flex items-center gap-2"
            >
              <Upload size={20} />
              Upload Image
            </button>
          </div>
          
          <div className="mt-6 text-xs text-gray-500">
            <p>Tips for best results:</p>
            <ul className="mt-2 space-y-1">
              <li>• Place card on flat, contrasting surface</li>
              <li>• Ensure good lighting (avoid shadows)</li>
              <li>• Keep card straight and centered</li>
              <li>• Capture entire card in frame</li>
            </ul>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="relative">
            <img 
              src={preview} 
              alt="Scanned card" 
              className="w-full max-w-md mx-auto rounded-lg shadow-lg"
            />
            
            {scanning && (
              <div className="absolute inset-0 bg-black bg-opacity-50 rounded-lg flex items-center justify-center">
                <div className="text-center text-white">
                  <Loader className="animate-spin mx-auto mb-2" size={32} />
                  <p>Analyzing card...</p>
                </div>
              </div>
            )}
            
            {detectedCard && !scanning && (
              <div className="absolute bottom-4 left-4 right-4 bg-white rounded-lg p-3 shadow-lg">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Check className="text-green-600" size={20} />
                    <span className="font-semibold">Card Detected!</span>
                  </div>
                  <div className="text-sm">
                    Confidence: {(confidence * 100).toFixed(0)}%
                  </div>
                </div>
                <div className="text-sm">
                  <p className="font-medium">{detectedCard.name}</p>
                  <p className="text-gray-600">{detectedCard.set}</p>
                  <p className="text-gray-500">Condition: {detectedCard.condition || 'NM'}</p>
                </div>
              </div>
            )}
          </div>
          
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-start gap-2">
              <AlertCircle size={20} className="text-red-600 mt-0.5" />
              <div>
                <p className="text-red-800 font-medium">Scan Failed</p>
                <p className="text-red-600 text-sm">{error}</p>
              </div>
            </div>
          )}
          
          <div className="flex gap-3 justify-center">
            {detectedCard && !scanning && (
              <button
                onClick={() => {
                  const enrichedCard = {
                    id: `scan-${Date.now()}-${Math.random()}`,
                    ...detectedCard,
                    quantity: 1,
                    condition: 'NM',
                    language: 'English',
                    foil: false,
                    suggestedPrice: null,
                    userPrice: null,
                    selected: true,
                    source: 'scan'
                  };
                  onCardsDetected([enrichedCard]);
                  resetScanner();
                }}
                className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
              >
                Add Card
              </button>
            )}
            
            <button
              onClick={resetScanner}
              className="px-6 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              {detectedCard ? 'Scan Another' : 'Try Again'}
            </button>
          </div>
        </div>
      )}
      
      {/* Batch scanning hint */}
      <div className="mt-6 p-4 bg-blue-50 rounded-lg">
        <div className="flex items-start gap-2">
          <Camera size={20} className="text-blue-600 mt-0.5" />
          <div className="text-sm">
            <p className="font-medium text-blue-900">Pro Tip: Batch Scanning</p>
            <p className="text-blue-700 mt-1">
              You can scan multiple cards quickly. Each detected card will be automatically added to your list.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CardScanner;