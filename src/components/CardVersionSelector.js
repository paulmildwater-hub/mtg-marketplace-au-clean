// src/components/CardVersionSelector.js
import React, { useState, useEffect } from 'react';
import { X, Sparkles, Package, Info, Check } from 'lucide-react';

function CardVersionSelector({ cardName, isOpen, onClose, onSelectVersion }) {
  const [versions, setVersions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedVersion, setSelectedVersion] = useState(null);
  const [selectedFinish, setSelectedFinish] = useState('nonfoil');
  
  useEffect(() => {
    if (isOpen && cardName) {
      fetchVersions();
    }
  }, [isOpen, cardName]);
  
  const fetchVersions = async () => {
    setLoading(true);
    try {
      const response = await fetch(
        `http://localhost:5000/api/cards/${encodeURIComponent(cardName)}/versions?includeImages=true`
      );
      
      if (response.ok) {
        const data = await response.json();
        setVersions(data.versions || []);
      }
    } catch (error) {
      console.error('Failed to fetch versions:', error);
    } finally {
      setLoading(false);
    }
  };
  
  const formatPrice = (price) => {
    return new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' }).format(price);
  };
  
  const handleSelectVersion = () => {
    if (selectedVersion) {
      onSelectVersion({
        ...selectedVersion,
        selectedFinish: selectedFinish,
        displayName: `${selectedVersion.set} - ${selectedVersion.collector_number} ${selectedFinish === 'foil' ? '(Foil)' : ''}`
      });
      onClose();
    }
  };
  
  const getFinishBadge = (version) => {
    const badges = [];
    
    // Check for special foil types from frame effects
    if (version.frame_effects) {
      if (version.frame_effects.includes('etched')) {
        badges.push({ type: 'etched', label: 'Etched Foil', color: 'purple' });
      }
      if (version.frame_effects.includes('showcase')) {
        badges.push({ type: 'showcase', label: 'Showcase', color: 'blue' });
      }
      if (version.frame_effects.includes('extendedart')) {
        badges.push({ type: 'extended', label: 'Extended Art', color: 'green' });
      }
    }
    
    // Check promo types
    if (version.promo_types) {
      if (version.promo_types.includes('textured')) {
        badges.push({ type: 'textured', label: 'Textured Foil', color: 'orange' });
      }
      if (version.promo_types.includes('galaxy')) {
        badges.push({ type: 'galaxy', label: 'Galaxy Foil', color: 'pink' });
      }
      if (version.promo_types.includes('serialized')) {
        badges.push({ type: 'serialized', label: 'Serialized', color: 'gold' });
      }
    }
    
    // Special sets with unique foils
    const specialFoilSets = {
      'SLD': 'Secret Lair',
      'MUL': 'Multiverse Legends',
      'BRO': 'Brothers War Schematic',
      'DMU': 'Stained Glass',
      'NEO': 'Neon Ink',
      'UNF': 'Galaxy Foil'
    };
    
    if (specialFoilSets[version.setCode]) {
      badges.push({ 
        type: 'special', 
        label: specialFoilSets[version.setCode], 
        color: 'red' 
      });
    }
    
    return badges;
  };
  
  if (!isOpen) return null;
  
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl max-w-6xl w-full max-h-[90vh] overflow-hidden">
        <div className="p-4 border-b bg-gradient-to-r from-blue-50 to-purple-50">
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-2xl font-bold">Select Version: {cardName}</h2>
              <p className="text-sm text-gray-600 mt-1">
                {versions.length} versions found • Select the exact printing you have
              </p>
            </div>
            <button onClick={onClose} className="p-1 hover:bg-white rounded">
              <X size={24} />
            </button>
          </div>
        </div>
        
        <div className="p-4 overflow-y-auto" style={{ maxHeight: 'calc(90vh - 200px)' }}>
          {loading ? (
            <div className="text-center py-8">
              <div className="w-8 h-8 border-4 border-gray-300 border-t-blue-500 rounded-full animate-spin mx-auto mb-4"></div>
              <div>Loading versions...</div>
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
              {versions.map(version => {
                const specialBadges = getFinishBadge(version);
                const isSelected = selectedVersion?.id === version.id;
                
                return (
                  <div
                    key={version.id}
                    onClick={() => setSelectedVersion(version)}
                    className={`border rounded-lg p-3 hover:shadow-lg transition cursor-pointer ${
                      isSelected ? 'border-blue-500 bg-blue-50' : ''
                    }`}
                  >
                    {/* Card Image */}
                    {version.imageUrl ? (
                      <img
                        src={version.imageUrl}
                        alt={version.name}
                        className="w-full rounded mb-2"
                      />
                    ) : (
                      <div className="w-full h-48 bg-gray-100 rounded mb-2 flex items-center justify-center">
                        <span className="text-2xl">🎴</span>
                      </div>
                    )}
                    
                    {/* Set Info */}
                    <div className="text-xs font-bold">{version.set}</div>
                    <div className="text-xs text-gray-600">
                      {version.setCode} • #{version.collector_number}
                    </div>
                    <div className="text-xs text-gray-500">{version.released_at}</div>
                    
                    {/* Treatment Badges */}
                    <div className="flex flex-wrap gap-1 mt-2 mb-2">
                      {version.promo && (
                        <span className="text-xs bg-purple-100 text-purple-800 px-1 rounded">Promo</span>
                      )}
                      {version.fullArt && (
                        <span className="text-xs bg-green-100 text-green-800 px-1 rounded">Full Art</span>
                      )}
                      {version.showcase && (
                        <span className="text-xs bg-blue-100 text-blue-800 px-1 rounded">Showcase</span>
                      )}
                      {version.extendedArt && (
                        <span className="text-xs bg-yellow-100 text-yellow-800 px-1 rounded">Extended</span>
                      )}
                      {version.borderless && (
                        <span className="text-xs bg-orange-100 text-orange-800 px-1 rounded">Borderless</span>
                      )}
                      {specialBadges.map((badge, idx) => (
                        <span key={idx} className={`text-xs bg-${badge.color}-100 text-${badge.color}-800 px-1 rounded`}>
                          {badge.label}
                        </span>
                      ))}
                    </div>
                    
                    {/* Finish Options - Only show if version is selected */}
                    {isSelected && (
                      <div className="mt-3 p-2 bg-white rounded border">
                        <div className="text-xs font-semibold mb-2">Select Finish:</div>
                        <div className="space-y-1">
                          {version.prices?.aud && version.prices.aud !== '0.00' && (
                            <label className="flex items-center gap-2 text-xs cursor-pointer hover:bg-gray-50 p-1 rounded">
                              <input
                                type="radio"
                                name="finish"
                                value="nonfoil"
                                checked={selectedFinish === 'nonfoil'}
                                onChange={(e) => setSelectedFinish(e.target.value)}
                              />
                              <span>Non-foil</span>
                              <span className="ml-auto font-bold text-green-600">
                                {formatPrice(version.prices.aud)}
                              </span>
                            </label>
                          )}
                          {version.prices?.aud_foil && version.prices.aud_foil !== '0.00' && (
                            <label className="flex items-center gap-2 text-xs cursor-pointer hover:bg-gray-50 p-1 rounded">
                              <input
                                type="radio"
                                name="finish"
                                value="foil"
                                checked={selectedFinish === 'foil'}
                                onChange={(e) => setSelectedFinish(e.target.value)}
                              />
                              <span className="flex items-center gap-1">
                                <Sparkles size={10} />
                                Foil
                              </span>
                              <span className="ml-auto font-bold text-green-600">
                                {formatPrice(version.prices.aud_foil)}
                              </span>
                            </label>
                          )}
                          {/* Add special foil options if detected */}
                          {specialBadges.some(b => b.type === 'etched') && (
                            <label className="flex items-center gap-2 text-xs cursor-pointer hover:bg-gray-50 p-1 rounded">
                              <input
                                type="radio"
                                name="finish"
                                value="etched"
                                checked={selectedFinish === 'etched'}
                                onChange={(e) => setSelectedFinish(e.target.value)}
                              />
                              <span>Etched Foil</span>
                              <span className="ml-auto font-bold text-green-600">
                                {formatPrice(version.prices.aud_foil * 1.2)}
                              </span>
                            </label>
                          )}
                        </div>
                      </div>
                    )}
                    
                    {/* Prices Summary */}
                    {!isSelected && (
                      <div className="mt-2 pt-2 border-t">
                        <div className="text-xs">
                          {version.prices?.aud && version.prices.aud !== '0.00' && (
                            <div>Normal: {formatPrice(version.prices.aud)}</div>
                          )}
                          {version.prices?.aud_foil && version.prices.aud_foil !== '0.00' && (
                            <div className="text-blue-600">
                              Foil: {formatPrice(version.prices.aud_foil)}
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
        
        {/* Footer with selection button */}
        <div className="p-4 border-t bg-gray-50">
          <div className="flex justify-between items-center">
            <div className="text-sm text-gray-600">
              {selectedVersion ? (
                <span className="text-green-600 font-medium">
                  Selected: {selectedVersion.set} #{selectedVersion.collector_number} ({selectedFinish})
                </span>
              ) : (
                'Click on a version to select it'
              )}
            </div>
            <button
              onClick={handleSelectVersion}
              disabled={!selectedVersion}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 transition"
            >
              Confirm Selection
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default CardVersionSelector;