import { useState, useEffect, useRef, type React } from 'react';
import { useTranslation } from 'react-i18next';
import { useAutocomplete, type AutocompleteResult } from '../../hooks/useAutocomplete';
import { PlusIcon } from '@heroicons/react/24/outline';
import { API_BASE_URL } from '../../config/api';

// Fuzzy match result interface
export interface FuzzyMatchResult {
  id: string;
  name: string;
  score: number;
  country?: string;
}

interface AutocompleteInputProps {
  type: 'product' | 'port' | 'shippingLine' | 'supplier' | 'customer' | 'company' | 'contract' | 'borderCrossing' | 'trademark';
  value: string;
  displayValue?: string;
  onChange: (value: string, displayName?: string) => void;
  onCreateNew?: (name: string) => void;
  onFuzzyMatchFound?: (typedName: string, matches: FuzzyMatchResult[]) => void;
  fuzzyMatchThreshold?: number;
  placeholder?: string;
  className?: string;
  allowCreate?: boolean;
  id?: string;
  'aria-label'?: string;
  'aria-describedby'?: string;
  'aria-required'?: boolean;
  // Allow any data-* attributes to be passed through
  [key: `data-${string}`]: string | undefined;
}

// Type label mappings for "create new" option
const TYPE_LABELS: Record<string, { en: string; ar: string }> = {
  product: { en: 'product', ar: 'منتج' },
  port: { en: 'port', ar: 'ميناء' },
  shippingLine: { en: 'shipping line', ar: 'شركة شحن' },
  supplier: { en: 'supplier', ar: 'مورد' },
  customer: { en: 'customer', ar: 'عميل' },
  company: { en: 'company', ar: 'شركة' },
  contract: { en: 'contract', ar: 'عقد' },
  borderCrossing: { en: 'border crossing', ar: 'معبر حدودي' },
  trademark: { en: 'trademark', ar: 'علامة تجارية' },
};

export function AutocompleteInput({
  type,
  value,
  displayValue,
  onChange,
  onCreateNew,
  onFuzzyMatchFound,
  fuzzyMatchThreshold = 0.7,
  placeholder,
  className = '',
  allowCreate = false,
  id,
  'aria-label': ariaLabel,
  'aria-describedby': ariaDescribedBy,
  'aria-required': ariaRequired,
  ...dataProps
}: AutocompleteInputProps) {
  const { i18n } = useTranslation();
  const isArabic = i18n.language === 'ar';
  const [inputValue, setInputValue] = useState(displayValue || value || '');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [hasUserModified, setHasUserModified] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listboxRef = useRef<HTMLDivElement>(null);
  
  const inputId = id || `autocomplete-${type}-${Math.random().toString(36).substr(2, 9)}`;
  const listboxId = `${inputId}-listbox`;
  
  const { data: suggestions, isLoading } = useAutocomplete(
    type === 'company' ? 'supplier' : type as 'product' | 'port' | 'shippingLine' | 'supplier' | 'customer' | 'contract' | 'borderCrossing' | 'trademark', 
    inputValue || ''
  );

  // Helper to check if a value is a UUID
  const isUUID = (str: string): boolean => {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    return uuidRegex.test(str);
  };

  // Check if the typed value already exists in suggestions
  const exactMatch = suggestions?.find(
    (s) => s.value.toLowerCase() === inputValue.toLowerCase()
  );
  const showCreateOption = allowCreate && inputValue.length >= 2 && !exactMatch && !isLoading;

  useEffect(() => {
    // Update input value based on displayValue prop if provided
    if (displayValue) {
      setInputValue(displayValue);
      setHasUserModified(false);
    } else if (value && !isUUID(value)) {
      setInputValue(value);
      setHasUserModified(false);
    } else if (!value) {
      setInputValue('');
      setHasUserModified(false);
    }
  }, [value, displayValue]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setShowSuggestions(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setInputValue(newValue);
    setShowSuggestions(true);
    setHasUserModified(true);
    setSelectedIndex(-1);
    
    // Only clear the ID immediately if user completely clears the field
    if (newValue === '') {
      onChange('', '');
      setHasUserModified(false);
    }
    // Otherwise, don't clear the ID yet - wait for blur or selection
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!shouldShowDropdown) return;

    const totalOptions = (suggestions?.length || 0) + (showCreateOption ? 1 : 0);

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex(prev => (prev < totalOptions - 1 ? prev + 1 : prev));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex(prev => (prev > 0 ? prev - 1 : -1));
        break;
      case 'Enter':
        e.preventDefault();
        if (selectedIndex >= 0 && selectedIndex < (suggestions?.length || 0)) {
          handleSuggestionClick(suggestions![selectedIndex]);
        } else if (selectedIndex === (suggestions?.length || 0) && showCreateOption) {
          handleCreateNew();
        }
        break;
      case 'Escape':
        e.preventDefault();
        setShowSuggestions(false);
        setSelectedIndex(-1);
        inputRef.current?.blur();
        break;
    }
  };

  const handleBlur = () => {
    // When user leaves the field without selecting from dropdown
    // If they modified the input but didn't select, we need to handle this
    setTimeout(async () => {
      if (hasUserModified && inputValue !== displayValue) {
        // User typed something different but didn't select from dropdown
        if (inputValue === '') {
          onChange('', '');
        } else {
          // For ports and shipping lines - allow freeform text entry (new entries can be created)
          // Send the typed name as the "id" - backend will handle creating new port if needed
          if (type === 'port' || type === 'shippingLine') {
            // Use special prefix to indicate this is a new entry to be created
            onChange(`new:${inputValue}`, inputValue);
          } else if (type === 'supplier' || type === 'customer' || type === 'company') {
            // For company types (supplier, customer, buyer):
            // Check for fuzzy matches before allowing new entry
            if (onFuzzyMatchFound && inputValue.length >= 2) {
              try {
                const token = localStorage.getItem('auth_token');
                const companyType = type === 'company' ? 'supplier' : type;
                const response = await fetch(
                  `${API_BASE_URL}/companies/fuzzy-match?name=${encodeURIComponent(inputValue)}&type=${companyType}&threshold=${fuzzyMatchThreshold}&limit=5`,
                  {
                    headers: {
                      'Content-Type': 'application/json',
                      ...(token ? { Authorization: `Bearer ${token}` } : {}),
                    },
                  }
                );
                
                if (response.ok) {
                  const data = await response.json();
                  const matches: FuzzyMatchResult[] = (data.matches || []).map((m: any) => ({
                    id: m.id,
                    name: m.name,
                    score: m.score,
                    country: m.country,
                  }));
                  
                  if (matches.length > 0) {
                    // Found fuzzy matches - let parent component handle the decision
                    console.log(`🔍 AutocompleteInput (${type}): Found ${matches.length} fuzzy matches for "${inputValue}"`);
                    onFuzzyMatchFound(inputValue, matches);
                    // Keep the typed value visible while modal is shown
                    return;
                  }
                }
              } catch (err) {
                console.warn('Fuzzy match check failed:', err);
              }
            }
            
            // No fuzzy matches found OR no callback provided - allow creating new entry
            console.log(`✅ AutocompleteInput (${type}): No fuzzy matches for "${inputValue}", allowing new entry`);
            onChange(`new:${inputValue}`, inputValue);
          } else {
            // For other types (product, contract, etc.), keep the typed value but clear the ID
            onChange('', inputValue);
          }
        }
      }
      setHasUserModified(false);
    }, 200); // Small delay to allow click on suggestion to register first
  };

  const handleSuggestionClick = (suggestion: AutocompleteResult) => {
    // For port, shippingLine, company, product types, use ID; for others, use value (name)
    const valueToSend = suggestion.id || suggestion.value;
    const displayName = suggestion.value;
    
    setInputValue(displayName); // Display the name
    setHasUserModified(false); // Reset modification flag
    onChange(valueToSend || displayName, displayName); // Send ID and name
    setShowSuggestions(false);
  };

  const handleCreateNew = () => {
    if (onCreateNew && inputValue) {
      onCreateNew(inputValue);
      setShowSuggestions(false);
    }
  };

  const hasSuggestions = suggestions && suggestions.length > 0;
  const shouldShowDropdown = showSuggestions && (hasSuggestions || showCreateOption);

  return (
    <div ref={wrapperRef} className="relative">
      <input
        ref={inputRef}
        id={inputId}
        type="text"
        value={inputValue}
        onChange={handleInputChange}
        onFocus={() => setShowSuggestions(true)}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        className={className}
        role="combobox"
        aria-expanded={shouldShowDropdown}
        aria-autocomplete="list"
        aria-controls={listboxId}
        aria-label={ariaLabel || placeholder}
        aria-describedby={ariaDescribedBy}
        aria-required={ariaRequired}
        aria-activedescendant={selectedIndex >= 0 ? `${listboxId}-option-${selectedIndex}` : undefined}
        {...dataProps}
      />

      {shouldShowDropdown && (
        <div
          ref={listboxRef}
          id={listboxId}
          role="listbox"
          className="absolute z-10 w-full mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md shadow-lg max-h-60 overflow-auto"
          aria-label={ariaLabel || `Suggestions for ${type}`}
        >
          {isLoading ? (
            <div className="px-4 py-2 text-sm text-gray-500" role="status" aria-live="polite">
              Loading...
            </div>
          ) : (
            <>
              {/* Suggestions list */}
              {suggestions?.map((suggestion, index) => (
                <button
                  key={suggestion.id || index}
                  id={`${listboxId}-option-${index}`}
                  onClick={() => handleSuggestionClick(suggestion)}
                  role="option"
                  aria-selected={selectedIndex === index}
                  className={`w-full text-left px-4 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 focus:outline-none focus:bg-gray-100 dark:focus:bg-gray-700 ${
                    selectedIndex === index ? 'bg-gray-100 dark:bg-gray-700' : ''
                  }`}
                >
                  {type === 'contract' ? (
                    // Special layout for contracts
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-gray-900 dark:text-white">{suggestion.value}</span>
                        {suggestion.status && (
                          <span className={`text-xs px-2 py-0.5 rounded ${
                            suggestion.status === 'ACTIVE' 
                              ? 'bg-green-100 text-green-800' 
                              : 'bg-gray-100 text-gray-800'
                          }`}>
                            {suggestion.status}
                          </span>
                        )}
                      </div>
                      {(suggestion.buyer_name || suggestion.seller_name) && (
                        <div className="text-xs text-gray-500 dark:text-gray-400">
                          {suggestion.buyer_name && <span>Buyer: {suggestion.buyer_name}</span>}
                          {suggestion.buyer_name && suggestion.seller_name && <span className="mx-1">•</span>}
                          {suggestion.seller_name && <span>Seller: {suggestion.seller_name}</span>}
                        </div>
                      )}
                    </div>
                  ) : type === 'product' ? (
                    // Special layout for products
                    <div className="flex justify-between items-center">
                      <div>
                        <span className="text-gray-900 dark:text-white">{suggestion.value}</span>
                        {(suggestion as any).sku && (
                          <span className="ml-2 text-xs text-gray-400">{(suggestion as any).sku}</span>
                        )}
                      </div>
                      {(suggestion as any).category_type && (
                        <span className="text-xs px-2 py-0.5 bg-emerald-50 text-emerald-700 rounded">
                          {(suggestion as any).category_type}
                        </span>
                      )}
                    </div>
                  ) : (
                    // Default layout for other types
                    <div className="flex justify-between items-center">
                      <span className="text-gray-900 dark:text-white">{suggestion.value}</span>
                      {suggestion.country && (
                        <span className="text-xs text-gray-500 dark:text-gray-400">
                          {suggestion.country}
                        </span>
                      )}
                      {suggestion.frequency > 0 && (
                        <span className="text-xs text-gray-500 dark:text-gray-400">
                          ({suggestion.frequency})
                        </span>
                      )}
                    </div>
                  )}
                </button>
              ))}

              {/* Create new option */}
              {showCreateOption && (
                <>
                  {hasSuggestions && (
                    <div className="border-t border-gray-200 dark:border-gray-700" />
                  )}
                  <button
                    id={`${listboxId}-option-${suggestions?.length || 0}`}
                    onClick={handleCreateNew}
                    role="option"
                    aria-selected={selectedIndex === (suggestions?.length || 0)}
                    className={`w-full text-left px-4 py-2 text-sm hover:bg-emerald-50 dark:hover:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 flex items-center gap-2 focus:outline-none focus:bg-emerald-50 dark:focus:bg-emerald-900/20 ${
                      selectedIndex === (suggestions?.length || 0) ? 'bg-emerald-50 dark:bg-emerald-900/20' : ''
                    }`}
                  >
                    <PlusIcon className="h-4 w-4" aria-hidden="true" />
                    <span>
                      {isArabic ? (
                        <>إنشاء {TYPE_LABELS[type]?.ar || type} جديد: "<strong>{inputValue}</strong>"</>
                      ) : (
                        <>Create "<strong>{inputValue}</strong>" as new {TYPE_LABELS[type]?.en || type}</>
                      )}
                    </span>
                  </button>
                </>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
