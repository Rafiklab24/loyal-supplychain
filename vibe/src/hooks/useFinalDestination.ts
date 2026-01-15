/**
 * Hook for resolving final destination information from shipments
 * 
 * When final_destination.type === 'branch', the name field may not be populated
 * when loading from the database. This hook looks up the branch name from branch_id.
 */

import i18n from 'i18next';
import { useBranches } from './useBranches';

interface FinalDestination {
  type?: 'branch' | 'customer' | 'consignment';
  name?: string;
  branch_id?: string;
  warehouse_id?: string;
  delivery_place?: string;
  address?: string;
  selling_price?: string;
}

interface ResolvedFinalDestination {
  /** The resolved owner name (branch name, customer name, or consignment text) */
  ownerName: string;
  /** The type label in the current language */
  typeLabel: string;
  /** The delivery location (warehouse, address, etc.) */
  deliveryPlace: string;
  /** Combined display string for destination */
  displayText: string;
  /** Whether the final destination is valid/set */
  isSet: boolean;
}

/**
 * Hook that resolves final destination information, looking up branch names from IDs
 */
export function useFinalDestination(finalDestination?: FinalDestination | null): ResolvedFinalDestination {
  const { data: branchesData } = useBranches();
  const isArabic = i18n.language === 'ar';
  
  // Default empty result
  const emptyResult: ResolvedFinalDestination = {
    ownerName: '',
    typeLabel: '',
    deliveryPlace: '',
    displayText: '',
    isSet: false,
  };
  
  if (!finalDestination?.type) {
    return emptyResult;
  }
  
  const destType = finalDestination.type;
  const deliveryPlace = finalDestination.delivery_place || finalDestination.address || '';
  
  let ownerName = finalDestination.name || '';
  let typeLabel = '';
  
  if (destType === 'branch') {
    typeLabel = isArabic ? 'فرع' : 'Branch';
    
    // If no name but we have branch_id, look it up from branchesData
    if (!ownerName && finalDestination.branch_id && branchesData?.branches) {
      const branch = branchesData.branches.find(b => b.id === finalDestination.branch_id);
      if (branch) {
        ownerName = isArabic ? (branch.name_ar || branch.name) : branch.name;
      }
    }
  } else if (destType === 'customer') {
    typeLabel = isArabic ? 'عميل خارجي' : 'External Customer';
  } else if (destType === 'consignment') {
    typeLabel = isArabic ? 'بضائع بالأمانة' : 'Consignment';
    // For consignment, provide default text if no name
    if (!ownerName) {
      ownerName = isArabic ? 'بالأمانة - لم يتحدد المالك' : 'Consignment - Owner TBD';
    }
  }
  
  // Build display text
  let displayText = '';
  if (ownerName && deliveryPlace) {
    displayText = `${ownerName} → ${deliveryPlace}`;
  } else if (ownerName) {
    displayText = ownerName;
  } else if (deliveryPlace) {
    displayText = deliveryPlace;
  }
  
  return {
    ownerName,
    typeLabel,
    deliveryPlace,
    displayText,
    isSet: !!(ownerName || deliveryPlace),
  };
}

/**
 * Helper function to get branch name from ID (non-hook version for use in callbacks)
 * Must be called with pre-fetched branches data
 */
export function resolveBranchName(
  branchId: string | undefined,
  branches: Array<{ id: string; name: string; name_ar?: string }> | undefined,
  isArabic: boolean = false
): string {
  if (!branchId || !branches) return '';
  const branch = branches.find(b => b.id === branchId);
  if (!branch) return '';
  return isArabic ? (branch.name_ar || branch.name) : branch.name;
}

/**
 * Get the final owner/destination display from a shipment's final_destination
 * Non-hook version for use when branches are already available
 */
export function getFinalDestinationDisplay(
  finalDestination: FinalDestination | null | undefined,
  branches: Array<{ id: string; name: string; name_ar?: string }> | undefined,
  isArabic: boolean = false
): { ownerName: string; deliveryPlace: string; displayText: string } {
  if (!finalDestination?.type) {
    return { ownerName: '', deliveryPlace: '', displayText: '' };
  }
  
  const deliveryPlace = finalDestination.delivery_place || finalDestination.address || '';
  let ownerName = finalDestination.name || '';
  
  // For branch type, look up the branch name if not set
  if (finalDestination.type === 'branch' && !ownerName && finalDestination.branch_id) {
    ownerName = resolveBranchName(finalDestination.branch_id, branches, isArabic);
  } else if (finalDestination.type === 'consignment' && !ownerName) {
    ownerName = isArabic ? 'بالأمانة - لم يتحدد المالك' : 'Consignment - Owner TBD';
  }
  
  let displayText = '';
  if (ownerName && deliveryPlace) {
    displayText = `${ownerName} → ${deliveryPlace}`;
  } else if (ownerName) {
    displayText = ownerName;
  } else if (deliveryPlace) {
    displayText = deliveryPlace;
  }
  
  return { ownerName, deliveryPlace, displayText };
}

