// src/components/CardHoverPreview.js
import React, { useState, useEffect, useRef } from 'react';
import ReactDOM from 'react-dom';

const CardHoverPreview = ({ card, children, isActive }) => {
  const [showPreview, setShowPreview] = useState(false);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const triggerRef = useRef(null);
  const timeoutRef = useRef(null);

  const handleMouseEnter = (e) => {
    if (!isActive || !card?.imageUrl) return;
    
    // Clear any existing timeout
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    
    // Add slight delay to prevent flickering
    timeoutRef.current = setTimeout(() => {
      const rect = triggerRef.current?.getBoundingClientRect();
      if (!rect) return;

      const previewWidth = 244;
      const previewHeight = 340;
      const padding = 10;
      
      // Calculate viewport dimensions
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;
      const scrollY = window.scrollY;
      const scrollX = window.scrollX;
      
      let x = rect.right + padding + scrollX;
      let y = rect.top + scrollY;
      
      // Check if preview would go off the right edge
      if (x + previewWidth > viewportWidth + scrollX) {
        // Show on the left side instead
        x = rect.left - previewWidth - padding + scrollX;
      }
      
      // Check if preview would go off the bottom
      if (y + previewHeight > viewportHeight + scrollY) {
        // Adjust to fit on screen
        y = Math.max(scrollY + padding, viewportHeight + scrollY - previewHeight - padding);
      }
      
      // Make sure it doesn't go above the viewport
      y = Math.max(scrollY + padding, y);
      
      setPosition({ x, y });
      setShowPreview(true);
    }, 100); // 100ms delay
  };

  const handleMouseLeave = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    setShowPreview(false);
  };

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  return (
    <>
      <div 
        ref={triggerRef}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        style={{ display: 'inline-block' }}
      >
        {children}
      </div>
      
      {showPreview && card?.imageUrl && ReactDOM.createPortal(
        <div
          className="card-hover-preview"
          style={{
            position: 'absolute',
            left: `${position.x}px`,
            top: `${position.y}px`,
            zIndex: 9999,
            pointerEvents: 'none'
          }}
        >
          <div className="bg-white rounded-lg shadow-2xl p-2 border">
            <img 
              src={card.imageUrl || card.originalImageUrl}
              alt={card.name}
              className="w-[244px] h-[340px] object-cover rounded"
              onError={(e) => {
                e.target.src = 'https://via.placeholder.com/244x340?text=No+Image';
              }}
            />
          </div>
        </div>,
        document.body
      )}
    </>
  );
};

export default CardHoverPreview;