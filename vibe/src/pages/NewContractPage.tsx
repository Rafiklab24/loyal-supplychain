/**
 * New Contract Page
 * Renders the Contract Creation Wizard (Redesigned for Proforma Invoice structure)
 * Supports field highlighting from the Field Mapping Manager
 */

import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ContractWizard } from '../components/contracts/wizard/ContractWizard';
import { FieldHighlighter } from '../components/common/FieldHighlighter';

export function NewContractPage() {
  const [searchParams] = useSearchParams();
  const highlightField = searchParams.get('highlight');
  const highlightStep = searchParams.get('step');
  
  const [currentStep, setCurrentStep] = useState(highlightStep ? parseInt(highlightStep) : 1);
  
  // Update step when URL params change
  useEffect(() => {
    if (highlightStep) {
      setCurrentStep(parseInt(highlightStep));
    }
  }, [highlightStep]);
  
  return (
    <>
      <ContractWizard initialStep={currentStep} />
      
      {/* Field Highlighter for mapping audit tool */}
      {highlightField && (
        <FieldHighlighter
          currentStep={currentStep}
          onStepChange={setCurrentStep}
        />
      )}
    </>
  );
}

export default NewContractPage;
