import React, { useState } from 'react';
import { 
  FileUp, Loader, Info, Download, ChevronDown, 
  Shield, Package, FileText, Database, Check
} from 'lucide-react';

const BulkImporter = ({ onImportComplete, showNotification }) => {
  const [importMethod, setImportMethod] = useState('text');
  const [selectedFormat, setSelectedFormat] = useState('generic');
  const [bulkText, setBulkText] = useState('');
  const [csvFile, setCsvFile] = useState(null);
  const [importing, setImporting] = useState(false);
  const [showFormatHelp, setShowFormatHelp] = useState(false);
  
  const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

  // Database format definitions
  const databaseFormats = {
    dragonshield: {
      name: 'DragonShield',
      icon: '🛡️',
      description: 'DragonShield Card Manager export',
      columns: {
        name: 'Card Name',
        quantity: 'Quantity',
        set: 'Set Name',
        setCode: 'Set Code',
        number: 'Card Number',
        condition: 'Condition',
        language: 'Language',
        foil: 'Printing',
        price: 'Card Price'
      }
    },
    tcgplayer: {
      name: 'TCGPlayer',
      icon: '🎴',
      description: 'TCGPlayer collection export',
      columns: {
        name: 'Name',
        quantity: 'Quantity',
        set: 'Set',
        number: 'Number',
        condition: 'Condition',
        language: 'Language',
        foil: 'Foil',
        price: 'Market Price'
      }
    },
    deckbox: {
      name: 'Deckbox',
      icon: '📦',
      description: 'Deckbox.org CSV export',
      columns: {
        name: 'Name',
        quantity: 'Count',
        set: 'Edition',
        number: 'Card Number',
        condition: 'Condition',
        language: 'Language',
        foil: 'Foil',
        price: 'Price'
      }
    },
    moxfield: {
      name: 'Moxfield',
      icon: '⚡',
      description: 'Moxfield collection export',
      columns: {
        name: 'Name',
        quantity: 'Quantity',
        set: 'Set',
        setCode: 'Set Code',
        number: 'Collector Number',
        condition: 'Condition',
        language: 'Language',
        foil: 'Foil',
        price: 'Purchase Price'
      }
    },
    archidekt: {
      name: 'Archidekt',
      icon: '🏛️',
      description: 'Archidekt collection export',
      columns: {
        name: 'Name',
        quantity: 'Quantity',
        set: 'Edition',
        number: 'Collector Number',
        condition: 'Condition',
        foil: 'Foil'
      }
    },
    tappedout: {
      name: 'TappedOut',
      icon: '🎯',
      description: 'TappedOut inventory export',
      columns: {
        name: 'Name',
        quantity: 'Qty',
        set: 'Set',
        foil: 'Foil'
      }
    },
    mtggoldfish: {
      name: 'MTGGoldfish',
      icon: '🐠',
      description: 'MTGGoldfish collection CSV',
      columns: {
        name: 'Card',
        quantity: 'Quantity',
        set: 'Set',
        setCode: 'Set ID',
        foil: 'Foil',
        price: 'Price'
      }
    },
    cardsphere: {
      name: 'Cardsphere',
      icon: '🌐',
      description: 'Cardsphere have list',
      columns: {
        name: 'Name',
        quantity: 'Quantity',
        set: 'Edition',
        condition: 'Condition',
        foil: 'Foil'
      }
    },
    echomtg: {
      name: 'EchoMTG',
      icon: '📊',
      description: 'EchoMTG collection export',
      columns: {
        name: 'Name',
        quantity: 'Quantity',
        set: 'Set',
        number: 'Number',
        condition: 'Condition',
        language: 'Language',
        foil: 'Foil'
      }
    },
    generic: {
      name: 'Generic CSV',
      icon: '📄',
      description: 'Custom CSV with flexible columns',
      columns: {
        name: ['Card Name', 'Name', 'Card'],
        quantity: ['Quantity', 'Qty', 'Count', 'Amount'],
        set: ['Set', 'Edition', 'Set Name'],
        setCode: ['Set Code', 'Set ID'],
        number: ['Collector Number', 'Card Number', 'Number', '#'],
        condition: ['Condition', 'Grade'],
        language: ['Language', 'Lang'],
        foil: ['Foil', 'Finish', 'Printing'],
        price: ['Price', 'Value', 'Cost']
      }
    }
  };

  // Parse CSV based on selected format
  const parseCSVByFormat = (csvData, format) => {
    const formatConfig = databaseFormats[format];
    const cards = [];
    
    csvData.forEach(row => {
      // Skip empty rows
      if (!row || Object.keys(row).length === 0) return;
      
      // Map columns based on format
      const card = {};
      
      // Handle flexible column names for generic format
      if (format === 'generic') {
        // Name
        const nameColumns = formatConfig.columns.name;
        card.name = nameColumns.reduce((val, col) => val || row[col], '');
        
        // Quantity
        const qtyColumns = formatConfig.columns.quantity;
        card.quantity = parseInt(qtyColumns.reduce((val, col) => val || row[col], 1));
        
        // Set
        const setColumns = formatConfig.columns.set;
        card.set = setColumns.reduce((val, col) => val || row[col], '');
        
        // Other fields
        const numberColumns = formatConfig.columns.number;
        card.number = numberColumns.reduce((val, col) => val || row[col], '');
        
        const conditionColumns = formatConfig.columns.condition;
        card.condition = conditionColumns.reduce((val, col) => val || row[col], 'NM');
        
        const foilColumns = formatConfig.columns.foil;
        const foilValue = foilColumns.reduce((val, col) => val || row[col], '');
        card.foil = foilValue && (foilValue.toLowerCase() === 'yes' || foilValue.toLowerCase() === 'foil' || foilValue === '1');
        
        const priceColumns = formatConfig.columns.price;
        card.price = parseFloat(priceColumns.reduce((val, col) => val || row[col], 0));
      } else {
        // Standard format mapping
        card.name = row[formatConfig.columns.name] || '';
        card.quantity = parseInt(row[formatConfig.columns.quantity]) || 1;
        card.set = row[formatConfig.columns.set] || '';
        card.setCode = row[formatConfig.columns.setCode] || '';
        card.number = row[formatConfig.columns.number] || '';
        card.condition = row[formatConfig.columns.condition] || 'NM';
        card.language = row[formatConfig.columns.language] || 'English';
        
        const foilValue = row[formatConfig.columns.foil];
        card.foil = foilValue && (foilValue.toLowerCase() === 'yes' || foilValue.toLowerCase() === 'foil' || foilValue === '1');
        
        card.price = parseFloat(row[formatConfig.columns.price]) || 0;
      }
      
      // Normalize condition codes
      const conditionMap = {
        'near mint': 'NM',
        'nearmint': 'NM',
        'mint': 'NM',
        'nm': 'NM',
        'lightly played': 'LP',
        'lightlyplayed': 'LP',
        'lp': 'LP',
        'moderately played': 'MP',
        'moderatelyplayed': 'MP',
        'mp': 'MP',
        'heavily played': 'HP',
        'heavilyplayed': 'HP',
        'hp': 'HP',
        'damaged': 'DMG',
        'dmg': 'DMG'
      };
      
      const conditionLower = (card.condition || 'NM').toLowerCase();
      card.condition = conditionMap[conditionLower] || 'NM';
      
      if (card.name) {
        cards.push(card);
      }
    });
    
    return cards;
  };

  // Process imported cards
  const processImportedCards = async (parsedCards) => {
    setImporting(true);
    const newCards = [];
    const errors = [];
    
    for (const parsedCard of parsedCards) {
      try {
        // Try to fetch card data from API
        const response = await fetch(`${API_URL}/cards/search?q=${encodeURIComponent(parsedCard.name)}&limit=1`);
        const data = await response.json();
        
        if (data.cards && data.cards.length > 0) {
          const apiCard = data.cards[0];
          
          newCards.push({
            id: `card-${Date.now()}-${Math.random()}`,
            card_name: parsedCard.name,
            name: parsedCard.name,
            scryfall_id: apiCard.id,
            set_name: parsedCard.set || apiCard.set_name,
            set_code: parsedCard.setCode || apiCard.setCode,
            collector_number: parsedCard.number || apiCard.collector_number,
            quantity: parsedCard.quantity || 1,
            condition: parsedCard.condition || 'NM',
            finish: parsedCard.foil ? 'foil' : 'nonfoil',
            language: parsedCard.language || 'English',
            suggestedPrice: parseFloat(apiCard.price || parsedCard.price || 0),
            marketPrice: parseFloat(apiCard.price || 0),
            userPrice: parsedCard.price || null,
            image_url: apiCard.imageUrl,
            selected: true
          });
        } else {
          // Card not found in API, add with minimal data
          newCards.push({
            id: `card-${Date.now()}-${Math.random()}`,
            card_name: parsedCard.name,
            name: parsedCard.name,
            scryfall_id: `import-${Date.now()}`,
            set_name: parsedCard.set || 'Unknown',
            set_code: parsedCard.setCode || '',
            collector_number: parsedCard.number || '',
            quantity: parsedCard.quantity || 1,
            condition: parsedCard.condition || 'NM',
            finish: parsedCard.foil ? 'foil' : 'nonfoil',
            language: parsedCard.language || 'English',
            suggestedPrice: parsedCard.price || 0,
            userPrice: parsedCard.price || 0,
            selected: true,
            needsReview: true
          });
          
          errors.push(`Could not find: ${parsedCard.name}`);
        }
      } catch (error) {
        console.error(`Failed to process ${parsedCard.name}:`, error);
        errors.push(`Error processing: ${parsedCard.name}`);
      }
    }
    
    setImporting(false);
    
    if (errors.length > 0 && errors.length < 10) {
      showNotification(`Imported ${newCards.length} cards. ${errors.length} cards need review.`, 'info');
    } else {
      showNotification(`Successfully imported ${newCards.length} cards!`, 'success');
    }
    
    onImportComplete(newCards);
  };

  // Handle CSV file upload
  const handleCSVUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;
    
    setCsvFile(file);
    
    // Check if Papa Parse is available
    let Papa;
    try {
      Papa = require('papaparse');
    } catch (e) {
      // Fallback to basic CSV parsing
      const text = await file.text();
      const lines = text.split('\n');
      const headers = lines[0].split(',').map(h => h.trim());
      const data = [];
      
      for (let i = 1; i < lines.length; i++) {
        if (lines[i].trim()) {
          const values = lines[i].split(',').map(v => v.trim());
          const row = {};
          headers.forEach((header, index) => {
            row[header] = values[index] || '';
          });
          data.push(row);
        }
      }
      
      const cards = parseCSVByFormat(data, selectedFormat);
      await processImportedCards(cards);
      return;
    }
    
    // Use Papa Parse if available
    Papa.parse(file, {
      header: true,
      complete: async (results) => {
        const cards = parseCSVByFormat(results.data, selectedFormat);
        await processImportedCards(cards);
      },
      error: (error) => {
        showNotification('Failed to parse CSV file', 'error');
        console.error('CSV parse error:', error);
      }
    });
  };

  // Generate sample CSV template
  const downloadTemplate = () => {
    const format = databaseFormats[selectedFormat];
    const headers = format.name === 'Generic CSV' 
      ? ['Card Name', 'Quantity', 'Set', 'Condition', 'Foil', 'Price']
      : Object.values(format.columns).filter(col => typeof col === 'string');
    
    const sampleData = [
      headers.join(','),
      '"Lightning Bolt",4,"Limited Edition Alpha","NM","No",25.00',
      '"Black Lotus",1,"Limited Edition Beta","LP","No",45000.00',
      '"Sol Ring",2,"Commander","NM","Yes",5.50'
    ];
    
    const csvContent = sampleData.join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `mtg-import-template-${selectedFormat}.csv`;
    a.click();
  };

  return (
    <div className="bg-white rounded-lg p-6 shadow-lg">
      <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
        <Database size={20} />
        Bulk Import Cards
      </h3>
      
      {/* Database Format Selection */}
      <div className="mb-4">
        <label className="block text-sm font-medium mb-2">Select Your Card Database</label>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-2">
          {Object.entries(databaseFormats).map(([key, format]) => (
            <button
              key={key}
              onClick={() => setSelectedFormat(key)}
              className={`p-3 border rounded-lg text-center transition ${
                selectedFormat === key 
                  ? 'border-blue-500 bg-blue-50' 
                  : 'border-gray-200 hover:bg-gray-50'
              }`}
            >
              <div className="text-2xl mb-1">{format.icon}</div>
              <div className="text-sm font-medium">{format.name}</div>
            </button>
          ))}
        </div>
        <p className="text-xs text-gray-500 mt-2">
          {databaseFormats[selectedFormat].description}
        </p>
      </div>

      {/* Import Method Toggle */}
      <div className="flex gap-2 mb-4">
        <button
          onClick={() => setImportMethod('text')}
          className={`px-4 py-2 rounded-lg ${
            importMethod === 'text' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700'
          }`}
        >
          Text List
        </button>
        <button
          onClick={() => setImportMethod('csv')}
          className={`px-4 py-2 rounded-lg ${
            importMethod === 'csv' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700'
          }`}
        >
          CSV Upload
        </button>
      </div>

      {importMethod === 'text' ? (
        // Text Import
        <>
          <div className="mb-4">
            <label className="block text-sm font-medium mb-2">
              Paste your card list
            </label>
            <textarea
              value={bulkText}
              onChange={(e) => setBulkText(e.target.value)}
              className="w-full h-48 px-3 py-2 border rounded-lg font-mono text-sm"
              placeholder="4x Lightning Bolt [LEA]
2 Black Lotus
Sol Ring [CMD]
Birds of Paradise"
            />
            <div className="text-xs text-gray-500 mt-1">
              Format: [quantity]x Card Name [SET] or just Card Name
            </div>
          </div>
          
          <button
            onClick={async () => {
              // Process text import
              const lines = bulkText.trim().split('\n');
              const cards = [];
              
              for (const line of lines) {
                const match = line.match(/^(\d+)?\s*x?\s*(.+?)(?:\s*\[([A-Z0-9]+)\])?$/i);
                if (match) {
                  cards.push({
                    name: match[2].trim(),
                    quantity: parseInt(match[1]) || 1,
                    setCode: match[3] || ''
                  });
                }
              }
              
              await processImportedCards(cards);
              setBulkText('');
            }}
            disabled={importing || !bulkText.trim()}
            className="w-full px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-400 flex items-center justify-center gap-2"
          >
            {importing ? (
              <>
                <Loader className="animate-spin" size={18} />
                Importing...
              </>
            ) : (
              <>
                <FileUp size={18} />
                Import Cards
              </>
            )}
          </button>
        </>
      ) : (
        // CSV Import
        <>
          <div className="mb-4">
            <label className="block text-sm font-medium mb-2">
              Upload {databaseFormats[selectedFormat].name} Export
            </label>
            <input
              type="file"
              accept=".csv"
              onChange={handleCSVUpload}
              className="hidden"
              id="csv-upload"
            />
            <label
              htmlFor="csv-upload"
              className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center cursor-pointer hover:bg-gray-50 block"
            >
              <FileUp className="mx-auto mb-2 text-gray-400" size={32} />
              <p className="text-sm text-gray-600">
                {csvFile ? csvFile.name : `Click to upload ${databaseFormats[selectedFormat].name} CSV`}
              </p>
              <p className="text-xs text-gray-500 mt-2">
                Supported formats: CSV exports from {databaseFormats[selectedFormat].name}
              </p>
            </label>
          </div>

          {/* Template Download */}
          <div className="p-3 bg-blue-50 rounded-lg mb-4">
            <div className="flex items-start gap-2">
              <Info className="text-blue-600 mt-0.5" size={16} />
              <div className="flex-1">
                <p className="text-sm text-blue-800 font-medium">Need a template?</p>
                <p className="text-xs text-blue-700 mt-1">
                  Download a sample CSV file formatted for {databaseFormats[selectedFormat].name}
                </p>
                <button
                  onClick={downloadTemplate}
                  className="text-xs text-blue-600 hover:text-blue-800 underline mt-2 flex items-center gap-1"
                >
                  <Download size={12} />
                  Download CSV Template
                </button>
              </div>
            </div>
          </div>

          {/* Format Help */}
          <button
            onClick={() => setShowFormatHelp(!showFormatHelp)}
            className="text-sm text-gray-600 hover:text-gray-800 flex items-center gap-1 mb-4"
          >
            <Info size={14} />
            Column mapping for {databaseFormats[selectedFormat].name}
            <ChevronDown size={14} className={`transform transition ${showFormatHelp ? 'rotate-180' : ''}`} />
          </button>
          
          {showFormatHelp && (
            <div className="mb-4 p-3 bg-gray-50 rounded-lg text-xs">
              <p className="font-medium mb-2">Expected columns:</p>
              <ul className="space-y-1">
                {Object.entries(databaseFormats[selectedFormat].columns).map(([key, col]) => (
                  <li key={key}>
                    • <span className="font-medium">{key}:</span> {Array.isArray(col) ? col.join(' or ') : col}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default BulkImporter;