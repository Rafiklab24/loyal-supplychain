/**
 * useShipmentValidation Hook
 * 
 * Provides real-time validation state for the shipment wizard.
 * Tracks validation errors, warnings, and user acknowledgments.
 */

import { useState, useMemo, useCallback } from 'react';
import type { ShipmentFormData } from '../components/shipments/wizard/types';
import {
  validateShipment,
  validateCommercialTerms,
  validateLogistics,
  validateFinancials,
  validateProductLines,
  type ValidationResult,
  type ValidationIssue,
} from '../utils/shipmentValidation';

export interface UseShipmentValidationResult {
  // Full validation results
  result: ValidationResult;
  errors: ValidationIssue[];
  warnings: ValidationIssue[];
  
  // Convenience flags
  hasErrors: boolean;
  hasWarnings: boolean;
  hasUnacknowledgedWarnings: boolean;
  
  // Acknowledged warnings tracking
  acknowledgedWarnings: Set<string>;
  acknowledgeWarning: (warningId: string) => void;
  acknowledgeAllWarnings: () => void;
  resetAcknowledgments: () => void;
  
  // Step-specific validation
  commercialTermsValidation: ValidationResult;
  logisticsValidation: ValidationResult;
  financialsValidation: ValidationResult;
  productLinesValidation: ValidationResult;
  
  // Check if can proceed
  canProceed: (requireAcknowledgment?: boolean) => boolean;
}

export function useShipmentValidation(
  formData: Partial<ShipmentFormData>
): UseShipmentValidationResult {
  // Track which warnings have been acknowledged by the user
  const [acknowledgedWarnings, setAcknowledgedWarnings] = useState<Set<string>>(new Set());

  // Run full validation
  const result = useMemo(() => validateShipment(formData), [formData]);

  // Run step-specific validations
  const commercialTermsValidation = useMemo(
    () => validateCommercialTerms(formData),
    [formData]
  );
  
  const logisticsValidation = useMemo(
    () => validateLogistics(formData),
    [formData]
  );
  
  const financialsValidation = useMemo(
    () => validateFinancials(formData),
    [formData]
  );
  
  const productLinesValidation = useMemo(
    () => validateProductLines(formData),
    [formData]
  );

  // Acknowledge a single warning
  const acknowledgeWarning = useCallback((warningId: string) => {
    setAcknowledgedWarnings(prev => {
      const next = new Set(prev);
      next.add(warningId);
      return next;
    });
  }, []);

  // Acknowledge all current warnings
  const acknowledgeAllWarnings = useCallback(() => {
    setAcknowledgedWarnings(prev => {
      const next = new Set(prev);
      for (const warning of result.warnings) {
        next.add(warning.id);
      }
      return next;
    });
  }, [result.warnings]);

  // Reset all acknowledgments (e.g., when data changes significantly)
  const resetAcknowledgments = useCallback(() => {
    setAcknowledgedWarnings(new Set());
  }, []);

  // Compute unacknowledged warnings
  const unacknowledgedWarnings = useMemo(
    () => result.warnings.filter(w => !acknowledgedWarnings.has(w.id)),
    [result.warnings, acknowledgedWarnings]
  );

  // Check if user can proceed
  const canProceed = useCallback(
    (requireAcknowledgment = true): boolean => {
      // Cannot proceed if there are errors
      if (result.errors.length > 0) return false;
      
      // If acknowledgment required, check that all warnings are acknowledged
      if (requireAcknowledgment && unacknowledgedWarnings.length > 0) {
        return false;
      }
      
      return true;
    },
    [result.errors.length, unacknowledgedWarnings.length]
  );

  return {
    result,
    errors: result.errors,
    warnings: result.warnings,
    hasErrors: result.errors.length > 0,
    hasWarnings: result.warnings.length > 0,
    hasUnacknowledgedWarnings: unacknowledgedWarnings.length > 0,
    acknowledgedWarnings,
    acknowledgeWarning,
    acknowledgeAllWarnings,
    resetAcknowledgments,
    commercialTermsValidation,
    logisticsValidation,
    financialsValidation,
    productLinesValidation,
    canProceed,
  };
}

// Export a simpler hook for step-specific validation
export function useStepValidation(
  formData: Partial<ShipmentFormData>,
  step: 'commercial' | 'logistics' | 'financials' | 'products'
): ValidationResult {
  return useMemo(() => {
    switch (step) {
      case 'commercial':
        return validateCommercialTerms(formData);
      case 'logistics':
        return validateLogistics(formData);
      case 'financials':
        return validateFinancials(formData);
      case 'products':
        return validateProductLines(formData);
      default:
        return { valid: true, errors: [], warnings: [] };
    }
  }, [formData, step]);
}



