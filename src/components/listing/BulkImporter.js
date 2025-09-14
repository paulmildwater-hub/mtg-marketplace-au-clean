import React, { useState, useEffect } from 'react';
import { Upload, Search, AlertCircle, CheckCircle, Package, DollarSign, FileText, Download } from 'lucide-react';
import Papa from 'papaparse';

const BulkImport = ({ onClose, onImportComplete }) => {
  const [importedCards, setImportedCards] = useState([]);
  const [importStatus, setImportStatus] = useState('');
  const [selectedFormat, setSelectedFormat] = useState('auto');
  const [isProcessing, setIsProcessing] = useState(false);
  const [suggestedPrice, setSuggestedPrice] = useState('10.00');
  const [defaultCondition, setDefaultCondition] = useState('NM');
  const [searchResults, setSearchResults] = useState({});
  const [failedCards, setFailedCards] = useState([]);
  const [debugInfo, setDebugInfo] = useState(null);

  const csvFormats = {
    auto: {
      name: 'Auto-Detect',
      description: 'Automatically detect CSV format'
    },
    dragonshield: {
      name: 'DragonShield',
      description: 'DragonShield collection export',
      headers: ['Quantity', 'Name', 'Set Name', 'Card Number', 'Printing', 'Language', 'Price']
    },
    tcgplayer: {
      name: 'TCGPlayer',
      description: 'TCGPlayer collection tracker',
      headers: ['Product Name', 'Set Name', 'Product Line', 'Rarity', 'Number', 'Quantity', 'Foil']
    },
    moxfield: {
      name: 'Moxfield',
      description: 'Moxfield collection export',
      headers: ['Count', 'Name', 'Edition', 'Condition', 'Language', 'Foil', 'Tags', 'Price']
    },
    generic: {
      name: 'Generic CSV',
      description: 'Basic format with Name, Quantity, Set, Price',
      headers: ['Name', 'Quantity', 'Set', 'Price', 'Condition', 'Foil']
    }
  };

  const detectCSVFormat = (headers) => {
    const headerStr = headers.map(h => h.toLowerCase()).join(',');
    
    if (headerStr.includes('card number') && headerStr.includes('printing')) {
      return 'dragonshield';
    } else if (headerStr.includes('product name') && headerStr.includes('product line')) {
      return 'tcgplayer';
    } else if (headerStr.includes('edition') && headerStr.includes('tags')) {
      return 'moxfield';
    }
    
    return 'generic';
  };

  const parseCSVByFormat = (data, format) => {
    const cards = [];
    let detectedFormat = format;

    // Auto-detect format if needed
    if (format === 'auto' && data.length > 0) {
      const headers = Object.keys(data[0]);
      detectedFormat = detectCSVFormat(headers);
      console.log(`Auto-detected format: ${detectedFormat}`);
      setImportStatus(`Detected ${csvFormats[detectedFormat].name} format`);
    }

    data.forEach((row, index) => {
      if (!row || Object.keys(row).length === 0) return;

      let card = {
        id: `csv_${index}_${Date.now()}`,
        source: csvFormats[detectedFormat].name,
        original_data: row
      };

      switch (detectedFormat) {
        case 'dragonshield':
          card.name = row['Name'] || row['Card Name'] || '';
          card.quantity = parseInt(row['Quantity'] || row['Count'] || 1);
          card.set = row['Set Name'] || row['Set'] || row['Edition'] || 'Unknown';
          card.card_number = row['Card Number'] || row['Collector Number'] || '';
          card.foil = (row['Printing'] || '').toLowerCase().includes('foil');
          card.condition = row['Condition'] || defaultCondition;
          card.price = parseFloat(row['Price'] || suggestedPrice);
          card.language = row['Language'] || 'English';
          break;

        case 'tcgplayer':
          card.name = row['Product Name'] || row['Name'] || '';
          card.quantity = parseInt(row['Quantity'] || 1);
          card.set = row['Set Name'] || row['Set'] || 'Unknown';
          card.card_number = row['Number'] || '';
          card.foil = row['Foil'] === 'Foil' || row['Foil'] === 'true';
          card.condition = row['Condition'] || defaultCondition;
          card.price = parseFloat(row['Price'] || row['Market Price'] || suggestedPrice);
          card.rarity = row['Rarity'] || '';
          break;

        case 'moxfield':
          card.name = row['Name'] || '';
          card.quantity = parseInt(row['Count'] || row['Quantity'] || 1);
          card.set = row['Edition'] || row['Set'] || 'Unknown';
          card.condition = row['Condition'] || defaultCondition;
          card.foil = row['Foil'] === 'foil' || row['Foil'] === 'true';
          card.price = parseFloat(row['Price'] || suggestedPrice);
          card.language = row['Language'] || 'English';
          card.tags = row['Tags'] || '';
          break;

        case 'generic':
        default:
          // Flexible parsing for generic format
          card.name = row['Name'] || row['Card Name'] || row['Card'] || 
                     row['name'] || row['card_name'] || row['card'] || '';
          card.quantity = parseInt(
            row['Quantity'] || row['quantity'] || row['Qty'] || 
            row['qty'] || row['Count'] || row['count'] || 1
          );
          card.set = row['Set'] || row['Set Name'] || row['set'] || 
                    row['set_name'] || row['Edition'] || row['edition'] || 'Unknown';
          card.condition = row['Condition'] || row['condition'] || defaultCondition;
          card.price = parseFloat(
            row['Price'] || row['price'] || row['Cost'] || 
            row['cost'] || row['Value'] || row['value'] || suggestedPrice
          );
          card.foil = (row['Foil'] || row['foil'] || row['Finish'] || row['finish'] || '')
                      .toLowerCase().includes('foil');
          card.card_number = row['Number'] || row['Collector Number'] || 
                            row['number'] || row['collector_number'] || '';
          break;
      }

      // Only add cards with valid names
      if (card.name && card.name.trim()) {
        card.name = card.name.trim();
        card.display_name = `${card.name} ${card.foil ? '(Foil)' : ''}`;
        card.needs_verification = true;
        cards.push(card);
      }
    });

    return cards;
  };

  const handleFileUpload = (event) => {
    const file = event.target.files[0];
    if (!file) return;

    setIsProcessing(true);
    setImportStatus('Reading CSV file...');
    setFailedCards([]);
    setDebugInfo(null);

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: async (results) => {
        try {
          // Debug information
          if (results.data.length > 0) {
            const headers = Object.keys(results.data[0]);
            const debugData = {
              headers: headers,
              firstRow: results.data[0],
              totalRows: results.data.length,
              detectedFormat: selectedFormat === 'auto' ? detectCSVFormat(headers) : selectedFormat
            };
            setDebugInfo(debugData);
            console.log('CSV Debug Info:', debugData);
          }

          const cards = parseCSVByFormat(results.data, selectedFormat);
          
          if (cards.length === 0) {
            setImportStatus('No valid cards found in CSV. Check the format and try again.');
            setIsProcessing(false);
            return;
          }

          setImportedCards(cards);
          setImportStatus(`Imported ${cards.length} cards. Fetching card details...`);
          
          // Fetch card details from Scryfall
          await fetchCardDetails(cards);
          
        } catch (error) {
          console.error('Import error:', error);
          setImportStatus(`Error: ${error.message}`);
        } finally {
          setIsProcessing(false);
        }
      },
      error: (error) => {
        console.error('CSV parse error:', error);
        setImportStatus(`Failed to parse CSV: ${error.message}`);
        setIsProcessing(false);
      }
    });
  };

  const fetchCardDetails = async (cards) => {
    const results = {};
    const failed = [];
    let processed = 0;

    for (const card of cards) {
      try {
        // Search for the card on Scryfall
        const searchQuery = card.set && card.set !== 'Unknown' 
          ? `"${card.name}" set:${card.set}`
          : `"${card.name}"`;
          
        const response = await fetch(`/api/cards/search?q=${encodeURIComponent(searchQuery)}&limit=1`);
        
        if (response.ok) {
          const data = await response.json();
          if (data.cards && data.cards.length > 0) {
            const matchedCard = data.cards[0];
            results[card.id] = {
              ...card,
              scryfall_id: matchedCard.id,
              image_url: matchedCard.imageUrl,
              set_name: matchedCard.set_name || card.set,
              verified: true,
              market_price: matchedCard.price
            };
          } else {
            failed.push(card);
          }
        } else {
          failed.push(card);
        }
        
        processed++;
        setImportStatus(`Processing cards: ${processed}/${cards.length}`);
        
        // Add a small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 100));
        
      } catch (error) {
        console.error(`Failed to fetch details for ${card.name}:`, error);
        failed.push(card);
      }
    }

    setSearchResults(results);
    setFailedCards(failed);
    
    const successCount = Object.keys(results).length;
    setImportStatus(
      `Matched ${successCount} cards. ${failed.length > 0 ? `${failed.length} cards need manual review.` : ''}`
    );
  };

  const handleImport = async () => {
    const cardsToImport = [
      ...Object.values(searchResults),
      ...importedCards.filter(card => !searchResults[card.id])
    ].map(card => ({
      card_name: card.name,
      set_name: card.set_name || card.set,
      quantity: card.quantity,
      price: parseFloat(card.price),
      condition: card.condition,
      finish: card.foil ? 'foil' : 'nonfoil',
      scryfall_id: card.scryfall_id,
      image_url: card.image_url,
      description: `Imported from ${card.source}`
    }));

    if (cardsToImport.length === 0) {
      setImportStatus('No cards to import');
      return;
    }

    setIsProcessing(true);
    setImportStatus('Creating listings...');

    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/listings/bulk', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ listings: cardsToImport })
      });

      const result = await response.json();
      
      if (result.success) {
        setImportStatus(`Success! Created ${result.created} listings.`);
        setTimeout(() => {
          onImportComplete && onImportComplete(result);
          onClose && onClose();
        }, 2000);
      } else {
        setImportStatus(`Error: ${result.error}`);
      }
    } catch (error) {
      setImportStatus(`Error: ${error.message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const generateSampleCSV = (format) => {
    const templates = {
      dragonshield: 'Quantity,Name,Set Name,Card Number,Printing,Language,Price\n1,Lightning Bolt,Double Masters,001,Normal,English,5.00\n2,Sol Ring,Commander Legends,001,Foil,English,15.00',
      tcgplayer: 'Product Name,Set Name,Quantity,Foil,Condition,Price\nLightning Bolt,Double Masters,1,Normal,NM,5.00\nSol Ring,Commander Legends,2,Foil,NM,15.00',
      moxfield: 'Count,Name,Edition,Condition,Language,Foil,Price\n1,Lightning Bolt,Double Masters,NM,English,false,5.00\n2,Sol Ring,Commander Legends,NM,English,true,15.00',
      generic: 'Name,Quantity,Set,Price,Condition,Foil\nLightning Bolt,1,Double Masters,5.00,NM,false\nSol Ring,2,Commander Legends,15.00,NM,true'
    };

    const csv = templates[format] || templates.generic;
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `sample_${format}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b">
          <h2 className="text-2xl font-bold">Bulk Import Cards</h2>
          <p className="text-gray-600 mt-1">Import your collection from CSV files</p>
        </div>

        <div className="p-6 space-y-6">
          {/* Format Selection */}
          <div>
            <label className="block text-sm font-medium mb-2">CSV Format</label>
            <select
              value={selectedFormat}
              onChange={(e) => setSelectedFormat(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg"
              disabled={isProcessing}
            >
              {Object.entries(csvFormats).map(([key, format]) => (
                <option key={key} value={key}>
                  {format.name} - {format.description}
                </option>
              ))}
            </select>
            
            {selectedFormat !== 'auto' && (
              <button
                onClick={() => generateSampleCSV(selectedFormat)}
                className="mt-2 text-sm text-blue-600 hover:text-blue-800 flex items-center gap-1"
              >
                <Download className="w-4 h-4" />
                Download sample {csvFormats[selectedFormat].name} CSV
              </button>
            )}
          </div>

          {/* Default Settings */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Default Price (AUD)</label>
              <input
                type="number"
                value={suggestedPrice}
                onChange={(e) => setSuggestedPrice(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg"
                step="0.01"
                min="0"
                disabled={isProcessing}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Default Condition</label>
              <select
                value={defaultCondition}
                onChange={(e) => setDefaultCondition(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg"
                disabled={isProcessing}
              >
                <option value="NM">Near Mint (NM)</option>
                <option value="LP">Lightly Played (LP)</option>
                <option value="MP">Moderately Played (MP)</option>
                <option value="HP">Heavily Played (HP)</option>
              </select>
            </div>
          </div>

          {/* File Upload */}
          <div className="border-2 border-dashed border-gray-300 rounded-lg p-8">
            <div className="text-center">
              <Upload className="mx-auto h-12 w-12 text-gray-400" />
              <div className="mt-4">
                <label htmlFor="file-upload" className="cursor-pointer">
                  <span className="mt-2 block text-sm font-medium text-gray-900">
                    Click to upload CSV file
                  </span>
                  <input
                    id="file-upload"
                    name="file-upload"
                    type="file"
                    className="sr-only"
                    accept=".csv"
                    onChange={handleFileUpload}
                    disabled={isProcessing}
                  />
                </label>
              </div>
            </div>
          </div>

          {/* Debug Info */}
          {debugInfo && (
            <div className="bg-gray-50 p-4 rounded-lg">
              <h3 className="font-medium mb-2">Debug Information</h3>
              <div className="text-sm space-y-1">
                <p>Detected Format: <span className="font-mono">{debugInfo.detectedFormat}</span></p>
                <p>Total Rows: {debugInfo.totalRows}</p>
                <p>Headers: <span className="font-mono text-xs">{debugInfo.headers.join(', ')}</span></p>
              </div>
            </div>
          )}

          {/* Status */}
          {importStatus && (
            <div className={`p-4 rounded-lg flex items-start gap-2 ${
              importStatus.includes('Error') ? 'bg-red-50 text-red-800' : 
              importStatus.includes('Success') ? 'bg-green-50 text-green-800' : 
              'bg-blue-50 text-blue-800'
            }`}>
              {importStatus.includes('Error') ? <AlertCircle className="w-5 h-5 mt-0.5" /> :
               importStatus.includes('Success') ? <CheckCircle className="w-5 h-5 mt-0.5" /> :
               <Package className="w-5 h-5 mt-0.5" />}
              <span>{importStatus}</span>
            </div>
          )}

          {/* Imported Cards Summary */}
          {importedCards.length > 0 && (
            <div className="border rounded-lg p-4">
              <h3 className="font-medium mb-3">Imported Cards ({importedCards.length})</h3>
              <div className="max-h-60 overflow-y-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-2 py-1 text-left">Name</th>
                      <th className="px-2 py-1 text-left">Set</th>
                      <th className="px-2 py-1 text-center">Qty</th>
                      <th className="px-2 py-1 text-right">Price</th>
                      <th className="px-2 py-1 text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {importedCards.slice(0, 50).map((card) => (
                      <tr key={card.id} className="border-t">
                        <td className="px-2 py-1">{card.display_name}</td>
                        <td className="px-2 py-1">{card.set}</td>
                        <td className="px-2 py-1 text-center">{card.quantity}</td>
                        <td className="px-2 py-1 text-right">${card.price.toFixed(2)}</td>
                        <td className="px-2 py-1 text-center">
                          {searchResults[card.id] ? (
                            <span className="text-green-600">✓</span>
                          ) : failedCards.includes(card) ? (
                            <span className="text-red-600">✗</span>
                          ) : (
                            <span className="text-gray-400">...</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {importedCards.length > 50 && (
                  <p className="text-sm text-gray-500 mt-2">
                    And {importedCards.length - 50} more...
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Failed Cards */}
          {failedCards.length > 0 && (
            <div className="border border-red-200 rounded-lg p-4 bg-red-50">
              <h3 className="font-medium text-red-800 mb-2">
                Cards Not Found ({failedCards.length})
              </h3>
              <p className="text-sm text-red-600 mb-2">
                These cards couldn't be matched automatically and will be imported with basic details:
              </p>
              <div className="text-sm space-y-1 max-h-32 overflow-y-auto">
                {failedCards.map(card => (
                  <div key={card.id} className="text-red-700">
                    • {card.name} ({card.set})
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 border-t flex justify-between">
          <button
            onClick={onClose}
            className="px-4 py-2 border rounded-lg hover:bg-gray-50"
            disabled={isProcessing}
          >
            Cancel
          </button>
          <button
            onClick={handleImport}
            disabled={isProcessing || importedCards.length === 0}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isProcessing ? 'Processing...' : `Import ${importedCards.length} Cards`}
          </button>
        </div>
      </div>
    </div>
  );
};

export default BulkImport;