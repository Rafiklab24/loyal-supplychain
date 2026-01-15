/**
 * Branch Assignment Modal
 * 
 * Allows admins to assign branches to users for data isolation.
 * Users will only see data from their assigned branches.
 */

import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { 
  XMarkIcon, 
  BuildingOffice2Icon,
  CheckIcon,
  ExclamationTriangleIcon,
} from '@heroicons/react/24/outline';

interface Branch {
  id: string;
  name: string;
  name_ar?: string;
  branch_type: string;
  country?: string;
  city?: string;
  parent_id?: string;
  parent_name?: string;
}

interface UserBranch {
  branch_id: string;
  name: string;
  name_ar?: string;
  branch_type: string;
  access_level: string;
}

interface BranchAssignmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
  userName: string;
  userRole: string;
  currentBranches: UserBranch[];
  onSuccess: () => void;
}

import { API_BASE_URL } from '../../config/api';

export function BranchAssignmentModal({
  isOpen,
  onClose,
  userId,
  userName,
  userRole,
  currentBranches,
  onSuccess,
}: BranchAssignmentModalProps) {
  const { t, i18n } = useTranslation();
  const isArabic = i18n.language === 'ar';
  
  const [branches, setBranches] = useState<Branch[]>([]);
  const [selectedBranchIds, setSelectedBranchIds] = useState<string[]>([]);
  const [accessLevel, setAccessLevel] = useState<'full' | 'read_only'>('full');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Check if user has global access
  const hasGlobalAccess = userRole === 'Admin' || userRole === 'Exec';

  // Load all available branches
  useEffect(() => {
    if (!isOpen) return;
    
    const fetchBranches = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch(`${API_BASE_URL}/auth/branches`, {
          headers: {
            Authorization: `Bearer ${localStorage.getItem('auth_token')}`,
          },
        });

        if (!response.ok) throw new Error('Failed to fetch branches');

        const data = await response.json();
        setBranches(data.branches || []);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchBranches();
  }, [isOpen]);

  // Initialize selected branches from current assignments
  useEffect(() => {
    if (currentBranches) {
      setSelectedBranchIds(currentBranches.map(b => b.branch_id));
    }
  }, [currentBranches]);

  const handleToggleBranch = (branchId: string) => {
    setSelectedBranchIds(prev => 
      prev.includes(branchId)
        ? prev.filter(id => id !== branchId)
        : [...prev, branchId]
    );
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);

    try {
      const response = await fetch(`${API_BASE_URL}/auth/users/${userId}/branches`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('auth_token')}`,
        },
        body: JSON.stringify({
          branch_ids: selectedBranchIds,
          access_level: accessLevel,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || 'Failed to save branch assignments');
      }

      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  // Group branches by parent (regions vs warehouses)
  const regionBranches = branches.filter(b => b.branch_type === 'region');
  const getChildBranches = (parentId: string) => 
    branches.filter(b => b.parent_id === parentId);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <BuildingOffice2Icon className="h-6 w-6 text-blue-600" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">
                {t('users.assignBranches', 'Assign Branches')}
              </h2>
              <p className="text-sm text-gray-500">{userName}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <XMarkIcon className="h-5 w-5 text-gray-500" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* Global Access Warning */}
          {hasGlobalAccess && (
            <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-lg flex items-start gap-3">
              <ExclamationTriangleIcon className="h-5 w-5 text-amber-600 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-amber-800">
                  {t('users.globalAccessNote', 'Global Access Role')}
                </p>
                <p className="text-sm text-amber-700 mt-1">
                  {t('users.globalAccessDescription', 
                    `Users with ${userRole} role have automatic access to all branches. Branch assignments are not required.`
                  )}
                </p>
              </div>
            </div>
          )}

          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
              {error}
            </div>
          )}

          {/* Access Level Selector */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {t('users.accessLevel', 'Access Level')}
            </label>
            <div className="flex gap-4">
              <label className={`flex items-center gap-2 px-4 py-2 border rounded-lg cursor-pointer transition-colors ${
                accessLevel === 'full' 
                  ? 'border-blue-600 bg-blue-50 text-blue-700' 
                  : 'border-gray-300 hover:bg-gray-50'
              }`}>
                <input
                  type="radio"
                  name="accessLevel"
                  value="full"
                  checked={accessLevel === 'full'}
                  onChange={() => setAccessLevel('full')}
                  className="sr-only"
                />
                <CheckIcon className={`h-4 w-4 ${accessLevel === 'full' ? 'opacity-100' : 'opacity-0'}`} />
                <span className="text-sm font-medium">
                  {t('users.fullAccess', 'Full Access')}
                </span>
              </label>
              <label className={`flex items-center gap-2 px-4 py-2 border rounded-lg cursor-pointer transition-colors ${
                accessLevel === 'read_only' 
                  ? 'border-blue-600 bg-blue-50 text-blue-700' 
                  : 'border-gray-300 hover:bg-gray-50'
              }`}>
                <input
                  type="radio"
                  name="accessLevel"
                  value="read_only"
                  checked={accessLevel === 'read_only'}
                  onChange={() => setAccessLevel('read_only')}
                  className="sr-only"
                />
                <CheckIcon className={`h-4 w-4 ${accessLevel === 'read_only' ? 'opacity-100' : 'opacity-0'}`} />
                <span className="text-sm font-medium">
                  {t('users.readOnly', 'Read Only')}
                </span>
              </label>
            </div>
          </div>

          {/* Branch Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-3">
              {t('users.selectBranches', 'Select Branches')}
            </label>
            
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
              </div>
            ) : (
              <div className="space-y-4">
                {regionBranches.map(region => {
                  const children = getChildBranches(region.id);
                  const isRegionSelected = selectedBranchIds.includes(region.id);
                  
                  return (
                    <div key={region.id} className="border border-gray-200 rounded-lg overflow-hidden">
                      {/* Region Header */}
                      <label className={`flex items-center gap-3 p-4 cursor-pointer transition-colors ${
                        isRegionSelected ? 'bg-blue-50' : 'bg-gray-50 hover:bg-gray-100'
                      }`}>
                        <input
                          type="checkbox"
                          checked={isRegionSelected}
                          onChange={() => handleToggleBranch(region.id)}
                          className="h-4 w-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                        />
                        <div className="flex-1">
                          <p className="font-medium text-gray-900">
                            {isArabic ? (region.name_ar || region.name) : region.name}
                          </p>
                          <p className="text-xs text-gray-500">
                            {region.country} • {t('users.region', 'Region')}
                          </p>
                        </div>
                        {isRegionSelected && (
                          <span className="text-xs text-blue-600 bg-blue-100 px-2 py-1 rounded">
                            {t('users.includesAllWarehouses', 'Includes all warehouses')}
                          </span>
                        )}
                      </label>
                      
                      {/* Child Warehouses */}
                      {children.length > 0 && (
                        <div className="border-t border-gray-200 bg-white p-3 space-y-2">
                          {children.map(warehouse => {
                            const isWarehouseSelected = selectedBranchIds.includes(warehouse.id);
                            const isDisabled = isRegionSelected; // Disabled if region is selected
                            
                            return (
                              <label 
                                key={warehouse.id}
                                className={`flex items-center gap-3 px-3 py-2 rounded cursor-pointer transition-colors ${
                                  isWarehouseSelected || isRegionSelected
                                    ? 'bg-blue-50' 
                                    : 'hover:bg-gray-50'
                                } ${isDisabled ? 'opacity-50' : ''}`}
                              >
                                <input
                                  type="checkbox"
                                  checked={isWarehouseSelected || isRegionSelected}
                                  disabled={isDisabled}
                                  onChange={() => !isDisabled && handleToggleBranch(warehouse.id)}
                                  className="h-4 w-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500 disabled:opacity-50"
                                />
                                <div>
                                  <p className="text-sm text-gray-900">
                                    {isArabic ? (warehouse.name_ar || warehouse.name) : warehouse.name}
                                  </p>
                                  <p className="text-xs text-gray-500">
                                    {warehouse.city || warehouse.branch_type}
                                  </p>
                                </div>
                              </label>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Selected Summary */}
          {selectedBranchIds.length > 0 && (
            <div className="mt-4 p-3 bg-gray-50 rounded-lg">
              <p className="text-sm text-gray-600">
                <strong>{selectedBranchIds.length}</strong>{' '}
                {t('users.branchesSelected', 'branch(es) selected')}
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
          >
            {t('common.cancel', 'Cancel')}
          </button>
          <button
            onClick={handleSave}
            disabled={saving || hasGlobalAccess}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
          >
            {saving && (
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
            )}
            {t('common.save', 'Save')}
          </button>
        </div>
      </div>
    </div>
  );
}

export default BranchAssignmentModal;

