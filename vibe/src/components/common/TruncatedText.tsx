import React, { useRef, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useProductTranslation } from '../../hooks/useProductTranslation';

interface TruncatedTextProps {
  text: string | null | undefined;
  className?: string;
  maxWidth?: string;
  children?: React.ReactNode;
  /** Custom tooltip text (if different from text prop) */
  tooltipText?: string;
}

/**
 * A component that displays text with truncation and shows a styled tooltip
 * on hover when the text is truncated or when text is longer than 25 chars.
 * 
 * Usage:
 * <TruncatedText text="Very long text here..." maxWidth="180px" />
 * 
 * Or with custom content:
 * <TruncatedText text="tooltip text">
 *   <CustomComponent />
 * </TruncatedText>
 */
export function TruncatedText({ text, className = '', maxWidth = '180px', children, tooltipText }: TruncatedTextProps) {
  const textRef = useRef<HTMLDivElement>(null);
  const [showTooltip, setShowTooltip] = useState(false);
  const [tooltipPosition, setTooltipPosition] = useState({ top: 0, left: 0 });
  
  // Get translated text for the tooltip (same translation as TranslatedProductText uses)
  const translatedText = useProductTranslation(text);

  // Use custom tooltip text, or translated text, or original text
  const tooltipContent = tooltipText || translatedText || text || '—';
  const displayText = text || '—';
  
  // Consider text that needs tooltip: either long text or overflowing
  const textLength = (text || '').length;
  const isLongText = textLength > 25;

  const checkIfTruncated = useCallback(() => {
    if (!textRef.current) return false;
    const el = textRef.current;
    return el.scrollWidth > el.clientWidth;
  }, []);

  const handleMouseEnter = useCallback(() => {
    // Show tooltip for long text or truncated text
    if (isLongText || checkIfTruncated()) {
      if (textRef.current) {
        const rect = textRef.current.getBoundingClientRect();
        setTooltipPosition({
          top: rect.top - 8,
          left: rect.left + rect.width / 2,
        });
        setShowTooltip(true);
      }
    }
  }, [isLongText, checkIfTruncated]);

  const handleMouseLeave = useCallback(() => {
    setShowTooltip(false);
  }, []);

  // Tooltip component rendered via portal to escape overflow constraints
  const tooltip = showTooltip ? createPortal(
    <div 
      className="fixed z-[9999] px-3 py-2 text-sm bg-gray-900 text-white rounded-lg shadow-xl 
                 max-w-[400px] break-words whitespace-pre-wrap animate-fade-in pointer-events-none
                 border border-gray-700"
      style={{
        top: tooltipPosition.top,
        left: tooltipPosition.left,
        transform: 'translate(-50%, -100%)',
      }}
    >
      {tooltipContent}
      {/* Arrow pointing down */}
      <div 
        className="absolute w-2.5 h-2.5 bg-gray-900 rotate-45 border-r border-b border-gray-700"
        style={{
          bottom: '-6px',
          left: '50%',
          transform: 'translateX(-50%)',
        }}
      />
    </div>,
    document.body
  ) : null;

  return (
    <div 
      className="relative w-full"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <div
        ref={textRef}
        className={`truncate ${className}`}
        style={{ maxWidth }}
        title={isLongText ? tooltipContent : undefined} // Native fallback
      >
        {children || displayText}
      </div>
      {tooltip}
    </div>
  );
}

export default TruncatedText;
