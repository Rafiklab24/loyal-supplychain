import React, { useRef, useEffect } from 'react';
import DatePicker from 'react-datepicker';
import { parse, format, isValid } from 'date-fns';
import 'react-datepicker/dist/react-datepicker.css';

interface DateInputProps {
  value: string; // YYYY-MM-DD format for internal use
  onChange: (value: string) => void;
  className?: string;
  placeholder?: string;
  disabled?: boolean;
  minDate?: Date;
  maxDate?: Date;
  autoFocus?: boolean;
  onKeyDown?: (e: React.KeyboardEvent) => void;
  onBlur?: () => void;
}

/**
 * Custom date input component that always displays DD/MM/YYYY format
 * regardless of browser/OS locale settings.
 * 
 * Internally uses YYYY-MM-DD format for value prop to maintain
 * compatibility with HTML date inputs and database storage.
 */
export const DateInput: React.FC<DateInputProps> = ({
  value,
  onChange,
  className = '',
  placeholder = 'DD/MM/YYYY',
  disabled = false,
  minDate,
  maxDate,
  autoFocus = false,
  onKeyDown,
  onBlur,
}) => {
  const datePickerRef = useRef<DatePicker>(null);

  useEffect(() => {
    if (autoFocus && datePickerRef.current) {
      datePickerRef.current.setFocus();
    }
  }, [autoFocus]);
  // Convert YYYY-MM-DD string to Date object
  const parseValue = (val: string): Date | null => {
    if (!val) return null;
    try {
      // Try parsing as YYYY-MM-DD
      const date = parse(val, 'yyyy-MM-dd', new Date());
      return isValid(date) ? date : null;
    } catch {
      return null;
    }
  };

  // Convert Date object to YYYY-MM-DD string
  const formatValue = (date: Date | null): string => {
    if (!date) return '';
    try {
      return format(date, 'yyyy-MM-dd');
    } catch {
      return '';
    }
  };

  const selectedDate = parseValue(value);

  const handleChange = (date: Date | null) => {
    onChange(formatValue(date));
  };

  return (
    <DatePicker
      ref={datePickerRef}
      selected={selectedDate}
      onChange={handleChange}
      dateFormat="dd/MM/yyyy"
      placeholderText={placeholder}
      disabled={disabled}
      minDate={minDate}
      maxDate={maxDate}
      className={`px-2 py-1 border rounded text-sm focus:ring-2 focus:outline-none ${className}`}
      calendarClassName="shadow-lg border rounded-lg"
      showPopperArrow={false}
      popperPlacement="bottom-start"
      onKeyDown={onKeyDown}
      onBlur={onBlur}
      popperModifiers={[
        {
          name: 'offset',
          options: {
            offset: [0, 4],
          },
          fn: () => ({}),
        },
      ] as any}
    />
  );
};

export default DateInput;

