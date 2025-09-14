import React from 'react';

// Use the same proxy approach as card images
const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

// Mana Symbol Component using proxy
export const ManaSymbol = ({ symbol, size = 20 }) => {
  // Clean the symbol - remove curly braces if present
  const cleanSymbol = symbol.replace(/[{}]/g, '').toUpperCase();
  
  // Map common variations to correct Scryfall codes
  const symbolMap = {
    'W': 'W',
    'U': 'U',
    'B': 'B',
    'R': 'R',
    'G': 'G',
    'C': 'C',
    'X': 'X',
    'Y': 'Y',
    'Z': 'Z',
    'T': 'T', // Tap
    'Q': 'Q', // Untap
    'E': 'E', // Energy
    'PW': 'PW', // Planeswalker
    'CHAOS': 'CHAOS', // Planechase
    'S': 'S', // Snow
    // Phyrexian mana
    'P/W': 'PW',
    'P/U': 'PU',
    'P/B': 'PB',
    'P/R': 'PR',
    'P/G': 'PG',
    // Hybrid mana
    'W/U': 'WU',
    'W/B': 'WB',
    'U/B': 'UB',
    'U/R': 'UR',
    'B/R': 'BR',
    'B/G': 'BG',
    'R/G': 'RG',
    'R/W': 'RW',
    'G/W': 'GW',
    'G/U': 'GU',
    // 2-color Phyrexian
    '2/W': '2W',
    '2/U': '2U',
    '2/B': '2B',
    '2/R': '2R',
    '2/G': '2G',
  };
  
  const mappedSymbol = symbolMap[cleanSymbol] || cleanSymbol;
  
  // Use the proxy to load mana symbols
  const symbolUrl = `https://svgs.scryfall.io/card-symbols/${mappedSymbol}.svg`;
  const proxiedUrl = `${API_URL}/api/image-proxy?url=${encodeURIComponent(symbolUrl)}`;
  
  return (
    <img 
      src={proxiedUrl}
      alt={cleanSymbol}
      width={size}
      height={size}
      className="inline-block align-middle"
      style={{ 
        margin: '0 1px',
        filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.1))'
      }}
      onError={(e) => {
        // Fallback to a simple text representation if proxy fails
        const span = document.createElement('span');
        span.className = 'inline-flex items-center justify-center rounded-full bg-gray-300 text-xs font-bold';
        span.style.width = `${size}px`;
        span.style.height = `${size}px`;
        span.style.margin = '0 1px';
        span.textContent = cleanSymbol;
        e.target.parentElement.replaceChild(span, e.target);
      }}
    />
  );
};

export const ManaCost = ({ cost, size = 20 }) => {
  if (!cost) return null;
  
  // Parse mana cost string like "{2}{U}{U}" or "2UU" or just "R"
  let symbols = [];
  
  if (cost.includes('{')) {
    // Format: {2}{U}{U}
    const matches = cost.match(/{([^}]+)}/g);
    if (matches) {
      symbols = matches.map(s => s.replace(/[{}]/g, ''));
    }
  } else {
    // Format: 2UU or WUBRG or just R
    // Split into individual characters, but keep multi-character symbols together
    const costStr = cost.toUpperCase();
    let i = 0;
    while (i < costStr.length) {
      // Check for two-character symbols first
      if (i < costStr.length - 1) {
        const twoChar = costStr.substring(i, i + 2);
        // Check for hybrid mana (W/U, etc.)
        if (twoChar.includes('/')) {
          const nextSlash = costStr.indexOf('/', i + 2);
          if (nextSlash > -1) {
            symbols.push(costStr.substring(i, nextSlash + 2));
            i = nextSlash + 2;
            continue;
          }
        }
        // Check for phyrexian (PW, PU, etc.)
        if (twoChar[0] === 'P' && 'WUBRG'.includes(twoChar[1])) {
          symbols.push(twoChar);
          i += 2;
          continue;
        }
        // Check for 2/W style
        if ('0123456789'.includes(twoChar[0]) && twoChar[1] === '/') {
          if (i + 2 < costStr.length) {
            symbols.push(costStr.substring(i, i + 3));
            i += 3;
            continue;
          }
        }
      }
      // Single character
      symbols.push(costStr[i]);
      i++;
    }
  }
  
  return (
    <div className="inline-flex items-center" style={{ gap: '2px' }}>
      {symbols.map((symbol, index) => (
        <ManaSymbol key={index} symbol={symbol} size={size} />
      ))}
    </div>
  );
};