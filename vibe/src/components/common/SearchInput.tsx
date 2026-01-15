import { MagnifyingGlassIcon } from '@heroicons/react/24/outline';

interface SearchInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  'aria-label'?: string;
  id?: string;
}

export function SearchInput({ 
  value, 
  onChange, 
  placeholder = 'Search...',
  'aria-label': ariaLabel,
  id,
}: SearchInputProps) {
  const inputId = id || `search-input-${Math.random().toString(36).substr(2, 9)}`;
  
  return (
    <div className="relative">
      <label htmlFor={inputId} className="sr-only">
        {ariaLabel || placeholder}
      </label>
      <div className="absolute inset-y-0 start-0 ps-3 flex items-center pointer-events-none" aria-hidden="true">
        <MagnifyingGlassIcon className="h-5 w-5 text-gray-400" />
      </div>
      <input
        id={inputId}
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label={ariaLabel || placeholder}
        className="block w-full ps-10 pe-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
      />
    </div>
  );
}

