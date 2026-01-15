/**
 * DocumentPermissionsModal Component
 * Manage per-document access control
 */

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  XMarkIcon,
  ShieldCheckIcon,
  UserIcon,
  BuildingOffice2Icon,
  UserGroupIcon,
  TrashIcon,
  PlusIcon,
} from '@heroicons/react/24/outline';
import { Spinner } from '../common/Spinner';
import { Badge } from '../common/Badge';
import {
  getDocumentPermissions,
  addDocumentPermission,
  removeDocumentPermission,
  type DocumentPermission,
  type Document,
} from '../../services/documents';
import { apiClient } from '../../services/api';

interface DocumentPermissionsModalProps {
  isOpen: boolean;
  onClose: () => void;
  document: Document;
}

type PermissionLevel = 'view' | 'download' | 'edit' | 'delete' | 'manage';
type GrantType = 'user' | 'branch' | 'role';

const PERMISSION_LEVELS: PermissionLevel[] = ['view', 'download', 'edit', 'delete', 'manage'];
const ROLE_OPTIONS = ['admin', 'manager', 'operator', 'viewer', 'finance'];

export function DocumentPermissionsModal({
  isOpen,
  onClose,
  document,
}: DocumentPermissionsModalProps) {
  const { i18n } = useTranslation();
  const isRtl = i18n.language === 'ar';
  const queryClient = useQueryClient();

  const [showAddForm, setShowAddForm] = useState(false);
  const [grantType, setGrantType] = useState<GrantType>('user');
  const [selectedUserId, setSelectedUserId] = useState('');
  const [selectedBranchId, setSelectedBranchId] = useState('');
  const [selectedRole, setSelectedRole] = useState('');
  const [permissionLevel, setPermissionLevel] = useState<PermissionLevel>('view');

  // Fetch permissions
  const { data: permissions = [], isLoading } = useQuery({
    queryKey: ['document-permissions', document.id],
    queryFn: () => getDocumentPermissions(document.id),
    enabled: isOpen && !!document.id,
  });

  // Fetch users for dropdown
  const { data: usersData } = useQuery({
    queryKey: ['users-list'],
    queryFn: async () => {
      const response = await apiClient.get('/users');
      return response.data.users || response.data || [];
    },
    enabled: isOpen && grantType === 'user',
  });

  // Fetch branches for dropdown
  const { data: branchesData } = useQuery({
    queryKey: ['branches-list'],
    queryFn: async () => {
      const response = await apiClient.get('/branches');
      return response.data.branches || response.data || [];
    },
    enabled: isOpen && grantType === 'branch',
  });

  // Add permission mutation
  const addMutation = useMutation({
    mutationFn: async (data: { user_id?: string; branch_id?: string; role?: string; permission: PermissionLevel }) => {
      return addDocumentPermission(document.id, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['document-permissions', document.id] });
      resetForm();
    },
  });

  // Remove permission mutation
  const removeMutation = useMutation({
    mutationFn: (permissionId: string) => removeDocumentPermission(document.id, permissionId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['document-permissions', document.id] });
    },
  });

  const resetForm = () => {
    setShowAddForm(false);
    setGrantType('user');
    setSelectedUserId('');
    setSelectedBranchId('');
    setSelectedRole('');
    setPermissionLevel('view');
  };

  const handleAddPermission = () => {
    const data: { user_id?: string; branch_id?: string; role?: string; permission: PermissionLevel } = {
      permission: permissionLevel,
    };

    if (grantType === 'user' && selectedUserId) {
      data.user_id = selectedUserId;
    } else if (grantType === 'branch' && selectedBranchId) {
      data.branch_id = selectedBranchId;
    } else if (grantType === 'role' && selectedRole) {
      data.role = selectedRole;
    } else {
      return; // Invalid selection
    }

    addMutation.mutate(data);
  };

  const handleRemovePermission = (permissionId: string) => {
    if (!confirm(isRtl ? 'هل أنت متأكد من إزالة هذا الإذن؟' : 'Are you sure you want to remove this permission?')) {
      return;
    }
    removeMutation.mutate(permissionId);
  };

  const getPermissionColor = (level: PermissionLevel) => {
    switch (level) {
      case 'view': return 'gray';
      case 'download': return 'blue';
      case 'edit': return 'yellow';
      case 'delete': return 'red';
      case 'manage': return 'purple';
      default: return 'gray';
    }
  };

  const getPermissionLabel = (level: PermissionLevel) => {
    const labels: Record<PermissionLevel, { en: string; ar: string }> = {
      view: { en: 'View', ar: 'عرض' },
      download: { en: 'Download', ar: 'تحميل' },
      edit: { en: 'Edit', ar: 'تعديل' },
      delete: { en: 'Delete', ar: 'حذف' },
      manage: { en: 'Manage', ar: 'إدارة' },
    };
    return labels[level]?.[isRtl ? 'ar' : 'en'] || level;
  };

  const getGranteeDisplay = (perm: DocumentPermission) => {
    if (perm.user_id) {
      return {
        icon: <UserIcon className="h-5 w-5" />,
        label: perm.user_name || perm.username || 'User',
        type: isRtl ? 'مستخدم' : 'User',
      };
    }
    if (perm.branch_id) {
      return {
        icon: <BuildingOffice2Icon className="h-5 w-5" />,
        label: perm.branch_name || 'Branch',
        type: isRtl ? 'فرع' : 'Branch',
      };
    }
    if (perm.role) {
      return {
        icon: <UserGroupIcon className="h-5 w-5" />,
        label: perm.role,
        type: isRtl ? 'دور' : 'Role',
      };
    }
    return {
      icon: <UserIcon className="h-5 w-5" />,
      label: 'Unknown',
      type: '',
    };
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex min-h-full items-center justify-center p-4">
        {/* Backdrop */}
        <div
          className="fixed inset-0 bg-black/50 transition-opacity"
          onClick={onClose}
        />

        {/* Modal */}
        <div className="relative w-full max-w-2xl bg-white rounded-xl shadow-2xl">
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-100 rounded-lg">
                <ShieldCheckIcon className="h-6 w-6 text-purple-600" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-gray-900">
                  {isRtl ? 'صلاحيات المستند' : 'Document Permissions'}
                </h2>
                <p className="text-sm text-gray-500 truncate max-w-sm">
                  {document.original_filename || document.filename}
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <XMarkIcon className="h-6 w-6" />
            </button>
          </div>

          {/* Body */}
          <div className="px-6 py-4 max-h-[60vh] overflow-y-auto">
            {/* Add Permission Button */}
            {!showAddForm && (
              <button
                onClick={() => setShowAddForm(true)}
                className="w-full mb-4 px-4 py-3 border-2 border-dashed border-gray-300 rounded-lg text-gray-600 hover:border-blue-400 hover:text-blue-600 hover:bg-blue-50 transition-colors flex items-center justify-center gap-2"
              >
                <PlusIcon className="h-5 w-5" />
                {isRtl ? 'إضافة إذن جديد' : 'Add New Permission'}
              </button>
            )}

            {/* Add Permission Form */}
            {showAddForm && (
              <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <h3 className="text-sm font-semibold text-blue-900 mb-4">
                  {isRtl ? 'إضافة إذن جديد' : 'Add New Permission'}
                </h3>

                <div className="grid grid-cols-2 gap-4 mb-4">
                  {/* Grant Type */}
                  <div>
                    <label className="block text-xs text-gray-600 mb-1">
                      {isRtl ? 'منح إلى' : 'Grant To'}
                    </label>
                    <select
                      value={grantType}
                      onChange={(e) => setGrantType(e.target.value as GrantType)}
                      className="w-full text-sm border border-gray-300 rounded-md px-3 py-2 focus:ring-blue-500 focus:border-blue-500"
                    >
                      <option value="user">{isRtl ? 'مستخدم' : 'User'}</option>
                      <option value="branch">{isRtl ? 'فرع' : 'Branch'}</option>
                      <option value="role">{isRtl ? 'دور' : 'Role'}</option>
                    </select>
                  </div>

                  {/* Permission Level */}
                  <div>
                    <label className="block text-xs text-gray-600 mb-1">
                      {isRtl ? 'مستوى الإذن' : 'Permission Level'}
                    </label>
                    <select
                      value={permissionLevel}
                      onChange={(e) => setPermissionLevel(e.target.value as PermissionLevel)}
                      className="w-full text-sm border border-gray-300 rounded-md px-3 py-2 focus:ring-blue-500 focus:border-blue-500"
                    >
                      {PERMISSION_LEVELS.map((level) => (
                        <option key={level} value={level}>
                          {getPermissionLabel(level)}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Grantee Selection */}
                <div className="mb-4">
                  {grantType === 'user' && (
                    <div>
                      <label className="block text-xs text-gray-600 mb-1">
                        {isRtl ? 'اختر المستخدم' : 'Select User'}
                      </label>
                      <select
                        value={selectedUserId}
                        onChange={(e) => setSelectedUserId(e.target.value)}
                        className="w-full text-sm border border-gray-300 rounded-md px-3 py-2 focus:ring-blue-500 focus:border-blue-500"
                      >
                        <option value="">{isRtl ? '-- اختر --' : '-- Select --'}</option>
                        {usersData?.map((user: any) => (
                          <option key={user.id} value={user.id}>
                            {user.name || user.username}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  {grantType === 'branch' && (
                    <div>
                      <label className="block text-xs text-gray-600 mb-1">
                        {isRtl ? 'اختر الفرع' : 'Select Branch'}
                      </label>
                      <select
                        value={selectedBranchId}
                        onChange={(e) => setSelectedBranchId(e.target.value)}
                        className="w-full text-sm border border-gray-300 rounded-md px-3 py-2 focus:ring-blue-500 focus:border-blue-500"
                      >
                        <option value="">{isRtl ? '-- اختر --' : '-- Select --'}</option>
                        {branchesData?.map((branch: any) => (
                          <option key={branch.id} value={branch.id}>
                            {branch.name || branch.name_ar}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  {grantType === 'role' && (
                    <div>
                      <label className="block text-xs text-gray-600 mb-1">
                        {isRtl ? 'اختر الدور' : 'Select Role'}
                      </label>
                      <select
                        value={selectedRole}
                        onChange={(e) => setSelectedRole(e.target.value)}
                        className="w-full text-sm border border-gray-300 rounded-md px-3 py-2 focus:ring-blue-500 focus:border-blue-500"
                      >
                        <option value="">{isRtl ? '-- اختر --' : '-- Select --'}</option>
                        {ROLE_OPTIONS.map((role) => (
                          <option key={role} value={role}>
                            {role.charAt(0).toUpperCase() + role.slice(1)}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>

                {/* Form Actions */}
                <div className="flex items-center justify-end gap-3">
                  <button
                    onClick={resetForm}
                    className="px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-md transition-colors"
                  >
                    {isRtl ? 'إلغاء' : 'Cancel'}
                  </button>
                  <button
                    onClick={handleAddPermission}
                    disabled={addMutation.isPending || (
                      (grantType === 'user' && !selectedUserId) ||
                      (grantType === 'branch' && !selectedBranchId) ||
                      (grantType === 'role' && !selectedRole)
                    )}
                    className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                  >
                    {addMutation.isPending ? (
                      <>
                        <Spinner size="sm" />
                        {isRtl ? 'جاري الإضافة...' : 'Adding...'}
                      </>
                    ) : (
                      <>
                        <PlusIcon className="h-4 w-4" />
                        {isRtl ? 'إضافة' : 'Add'}
                      </>
                    )}
                  </button>
                </div>

                {addMutation.isError && (
                  <p className="mt-2 text-xs text-red-600">
                    {(addMutation.error as any)?.message || (isRtl ? 'فشل في إضافة الإذن' : 'Failed to add permission')}
                  </p>
                )}
              </div>
            )}

            {/* Permissions List */}
            <div>
              <h3 className="text-sm font-semibold text-gray-700 mb-3">
                {isRtl ? 'الصلاحيات الحالية' : 'Current Permissions'}
              </h3>

              {isLoading ? (
                <div className="flex justify-center py-8">
                  <Spinner size="md" />
                </div>
              ) : permissions.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <ShieldCheckIcon className="h-12 w-12 mx-auto mb-2 text-gray-300" />
                  <p className="text-sm">
                    {isRtl ? 'لا توجد صلاحيات محددة' : 'No permissions assigned'}
                  </p>
                  <p className="text-xs mt-1">
                    {isRtl ? 'أضف صلاحيات للتحكم في الوصول' : 'Add permissions to control access'}
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {permissions.map((perm) => {
                    const grantee = getGranteeDisplay(perm);
                    return (
                      <div
                        key={perm.id}
                        className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors group"
                      >
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-white rounded-lg border border-gray-200 text-gray-500">
                            {grantee.icon}
                          </div>
                          <div>
                            <div className="text-sm font-medium text-gray-900">
                              {grantee.label}
                            </div>
                            <div className="text-xs text-gray-500">
                              {grantee.type}
                              {perm.granted_by_name && (
                                <span className="ms-2">
                                  • {isRtl ? 'منحها' : 'Granted by'} {perm.granted_by_name}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <Badge color={getPermissionColor(perm.permission) as any} size="sm">
                            {getPermissionLabel(perm.permission)}
                          </Badge>
                          <button
                            onClick={() => handleRemovePermission(perm.id)}
                            disabled={removeMutation.isPending}
                            className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded opacity-0 group-hover:opacity-100 transition-all"
                            title={isRtl ? 'إزالة' : 'Remove'}
                          >
                            <TrashIcon className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end px-6 py-4 border-t border-gray-200 bg-gray-50 rounded-b-xl">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              {isRtl ? 'إغلاق' : 'Close'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default DocumentPermissionsModal;

