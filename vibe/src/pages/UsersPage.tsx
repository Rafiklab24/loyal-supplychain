import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { PlusIcon, UserIcon, ShieldCheckIcon, PencilIcon, TrashIcon, BuildingOffice2Icon, ExclamationTriangleIcon, AdjustmentsHorizontalIcon, CheckIcon, XMarkIcon, Cog6ToothIcon, Bars3Icon } from '@heroicons/react/24/outline';
import { useAuth } from '../contexts/AuthContext';
import { Button } from '../components/common/Button';
import { BranchAssignmentModal } from '../components/users/BranchAssignmentModal';
import { API_BASE_URL } from '../config/api';
import { SHIPMENT_COLUMN_CONFIG, DEFAULT_SHIPMENT_COLUMNS, UserPreferences } from '../hooks/useUserPreferences';

// Module access type
type ModuleAccess = Record<string, boolean> | null;

interface UserBranch {
  id: string;
  name: string;
  name_ar?: string;
  branch_type: string;
  access_level: string;
}

interface User {
  id: string;
  username: string;
  name: string;
  role: string;           // Primary role (legacy)
  roles?: string[];       // All assigned roles (new multi-role)
  email?: string;
  phone?: string;
  created_at: string;
  branches?: UserBranch[];
  module_access?: ModuleAccess;  // Per-user module access overrides
}

const VALID_ROLES = [
  'Admin',
  'Exec',
  'Correspondence',
  'Logistics',
  'Procurement',
  'Inventory',
  'Clearance',
  'Accounting',
  'Cafe',
  'Bookkeeper',
];

// Role descriptions for tooltips (long version for tooltip)
const ROLE_FULL_DESCRIPTIONS: Record<string, string> = {
  Admin: 'Full access to all modules + user management',
  Exec: 'Read-only access to all modules for oversight',
  Correspondence: 'View contracts, shipments, and cafe menu',
  Logistics: 'Full: Contracts, Shipments, Land Transport | Read: Dashboard, Products',
  Procurement: 'Full: Contracts, Products | Read: Shipments, Dashboard',
  Inventory: 'Full: Land Transport, Products, Inventory, Quality | Read: Contracts, Shipments',
  Clearance: 'Full: Customs | Read: Contracts, Shipments, Dashboard',
  Accounting: 'Full: Finance, Accounting | Read: Contracts, Shipments, Customs',
  Cafe: 'Full: Cafe menu only',
  Bookkeeper: 'Full: Cash Box | Read: Dashboard, Accounting',
};

export function UsersPage() {
  const { i18n } = useTranslation();
  const isArabic = i18n.language === 'ar';
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  
  // Branch assignment modal state
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [showBranchModal, setShowBranchModal] = useState(false);
  
  // Edit user modal state
  const [showEditModal, setShowEditModal] = useState(false);
  const [userToEdit, setUserToEdit] = useState<User | null>(null);
  
  // Delete confirmation state
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [userToDelete, setUserToDelete] = useState<User | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  
  // Module access modal state
  const [showModuleAccessModal, setShowModuleAccessModal] = useState(false);
  const [userForModuleAccess, setUserForModuleAccess] = useState<User | null>(null);
  
  // UI Preferences modal state
  const [showUIPreferencesModal, setShowUIPreferencesModal] = useState(false);
  const [userForUIPreferences, setUserForUIPreferences] = useState<User | null>(null);
  
  // Main admin check
  const [isMainAdmin, setIsMainAdmin] = useState(false);

  // Check if current user is admin
  if (currentUser?.role !== 'Admin') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <ShieldCheckIcon className="mx-auto h-12 w-12 text-red-500" />
          <h1 className="mt-4 text-2xl font-bold text-gray-900">Access Denied</h1>
          <p className="mt-2 text-gray-600">You need Admin privileges to access this page.</p>
        </div>
      </div>
    );
  }

  // Fetch users
  const fetchUsers = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`${API_BASE_URL}/auth/users`, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('auth_token')}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch users');
      }

      const data = await response.json();
      setUsers(data.users || data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Check if current user is main admin
  const checkMainAdmin = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/auth/is-main-admin`, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('auth_token')}`,
        },
      });
      if (response.ok) {
        const data = await response.json();
        setIsMainAdmin(data.isMainAdmin);
      }
    } catch (err) {
      console.error('Failed to check main admin status:', err);
    }
  };

  // Load users on mount
  useEffect(() => {
    fetchUsers();
    checkMainAdmin();
  }, []);

  // Delete user handler
  const handleDeleteUser = async () => {
    if (!userToDelete) return;
    
    setDeleteLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/auth/users/${userToDelete.id}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${localStorage.getItem('auth_token')}`,
        },
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to delete user');
      }

      setSuccess(`User "${userToDelete.name}" deleted successfully!`);
      fetchUsers();
      setTimeout(() => setSuccess(null), 5000);
    } catch (err: any) {
      setError(err.message);
      setTimeout(() => setError(null), 5000);
    } finally {
      setDeleteLoading(false);
      setShowDeleteConfirm(false);
      setUserToDelete(null);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="bg-white shadow rounded-lg mb-6">
          <div className="px-6 py-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <UserIcon className="h-8 w-8 text-primary-600" />
              <div>
                <h1 className="text-2xl font-bold text-gray-900">User Management</h1>
                <p className="text-sm text-gray-600">Manage system users and permissions</p>
              </div>
            </div>
            <Button
              onClick={() => setShowCreateModal(true)}
              variant="primary"
              className="flex items-center gap-2"
            >
              <PlusIcon className="h-5 w-5" />
              Create New User
            </Button>
          </div>
        </div>

        {/* Success/Error Messages */}
        {success && (
          <div className="mb-6 bg-green-50 border border-green-200 rounded-lg p-4">
            <p className="text-green-800">{success}</p>
          </div>
        )}

        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4">
            <p className="text-red-800">{error}</p>
          </div>
        )}

        {/* Users List */}
        <div className="bg-white shadow rounded-lg overflow-hidden">
          {loading ? (
            <div className="p-8 text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto"></div>
              <p className="mt-2 text-gray-600">Loading users...</p>
            </div>
          ) : users.length === 0 ? (
            <div className="p-8 text-center">
              <UserIcon className="mx-auto h-12 w-12 text-gray-400" />
              <p className="mt-2 text-gray-600">No users found. Create your first user!</p>
            </div>
          ) : (
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    User
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Username
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Role
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Branches
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Contact
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Created
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {users.map((user) => {
                  const hasGlobalAccess = user.role === 'Admin' || user.role === 'Exec';
                  const branchCount = user.branches?.length || 0;
                  
                  return (
                  <tr key={user.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="h-10 w-10 rounded-full bg-primary-100 flex items-center justify-center">
                          <span className="text-primary-600 font-semibold">
                            {user.name?.charAt(0).toUpperCase() || 'U'}
                          </span>
                        </div>
                        <div className="ml-4">
                          <div className="text-sm font-medium text-gray-900">{user.name}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">{user.username}</div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-wrap gap-1">
                        {(user.roles && user.roles.length > 0 ? user.roles : [user.role]).map((role, idx) => (
                          <span 
                            key={idx}
                            title={ROLE_FULL_DESCRIPTIONS[role] || role}
                            className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full cursor-help ${
                              role === 'Admin' 
                                ? 'bg-purple-100 text-purple-800'
                                : role === 'Exec'
                                ? 'bg-amber-100 text-amber-800'
                                : role === 'Logistics'
                                ? 'bg-blue-100 text-blue-800'
                                : role === 'Accounting'
                                ? 'bg-emerald-100 text-emerald-800'
                                : role === 'Clearance'
                                ? 'bg-indigo-100 text-indigo-800'
                                : role === 'Procurement'
                                ? 'bg-cyan-100 text-cyan-800'
                                : role === 'Inventory'
                                ? 'bg-orange-100 text-orange-800'
                                : role === 'Cafe'
                                ? 'bg-pink-100 text-pink-800'
                                : 'bg-green-100 text-green-800'
                            }`}
                          >
                            {role}
                          </span>
                        ))}
                        {/* Show indicator if user has custom module access overrides */}
                        {user.module_access && Object.keys(user.module_access).length > 0 && (
                          <span 
                            title={`Custom access: ${Object.entries(user.module_access).map(([k, v]) => `${k}: ${v ? '✓' : '✗'}`).join(', ')}`}
                            className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-violet-100 text-violet-800 cursor-help"
                          >
                            <AdjustmentsHorizontalIcon className="w-3 h-3 mr-1" />
                            {Object.keys(user.module_access).length}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      {hasGlobalAccess ? (
                        <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-amber-700 bg-amber-50 rounded">
                          <BuildingOffice2Icon className="h-3 w-3" />
                          Global Access
                        </span>
                      ) : branchCount > 0 ? (
                        <div className="flex flex-wrap gap-1 max-w-xs">
                          {user.branches?.slice(0, 2).map((branch) => (
                            <span 
                              key={branch.id}
                              className="inline-flex items-center px-2 py-0.5 text-xs font-medium text-blue-700 bg-blue-50 rounded"
                            >
                              {isArabic ? (branch.name_ar || branch.name) : branch.name}
                            </span>
                          ))}
                          {branchCount > 2 && (
                            <span className="inline-flex items-center px-2 py-0.5 text-xs font-medium text-gray-600 bg-gray-100 rounded">
                              +{branchCount - 2} more
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="text-xs text-gray-400 italic">
                          No branches assigned
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {user.email || user.phone || '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {new Date(user.created_at).toLocaleDateString('en-GB')}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <button
                        onClick={() => {
                          setUserToDelete(user);
                          setShowDeleteConfirm(true);
                        }}
                        className="text-red-600 hover:text-red-900 p-1.5 rounded hover:bg-red-50 transition-colors"
                        title="Delete user"
                        disabled={user.id === currentUser?.id}
                      >
                        <TrashIcon className="h-5 w-5" />
                      </button>
                      <button
                        onClick={() => {
                          setUserToEdit(user);
                          setShowEditModal(true);
                        }}
                        className="text-primary-600 hover:text-primary-900 p-1.5 rounded hover:bg-primary-50 transition-colors mx-1"
                        title="Edit user"
                      >
                        <PencilIcon className="h-5 w-5" />
                      </button>
                      <button
                        onClick={() => {
                          setUserForModuleAccess(user);
                          setShowModuleAccessModal(true);
                        }}
                        className="text-violet-600 hover:text-violet-900 p-1.5 rounded hover:bg-violet-50 transition-colors mx-1"
                        title="Module access"
                      >
                        <AdjustmentsHorizontalIcon className="h-5 w-5" />
                      </button>
                      <button
                        onClick={() => {
                          setUserForUIPreferences(user);
                          setShowUIPreferencesModal(true);
                        }}
                        className="text-teal-600 hover:text-teal-900 p-1.5 rounded hover:bg-teal-50 transition-colors mx-1"
                        title="UI preferences"
                      >
                        <Cog6ToothIcon className="h-5 w-5" />
                      </button>
                      <button
                        onClick={() => {
                          setSelectedUser(user);
                          setShowBranchModal(true);
                        }}
                        className="text-blue-600 hover:text-blue-900 p-1.5 rounded hover:bg-blue-50 transition-colors"
                        title="Assign branches"
                      >
                        <BuildingOffice2Icon className="h-5 w-5" />
                      </button>
                    </td>
                  </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Create User Modal */}
      {showCreateModal && (
        <CreateUserModal
          onClose={() => setShowCreateModal(false)}
          onSuccess={(message) => {
            setSuccess(message);
            setShowCreateModal(false);
            fetchUsers();
            setTimeout(() => setSuccess(null), 5000);
          }}
          onError={(message) => {
            setError(message);
            setTimeout(() => setError(null), 5000);
          }}
        />
      )}

      {/* Branch Assignment Modal */}
      {showBranchModal && selectedUser && (
        <BranchAssignmentModal
          isOpen={showBranchModal}
          onClose={() => {
            setShowBranchModal(false);
            setSelectedUser(null);
          }}
          userId={selectedUser.id}
          userName={selectedUser.name}
          userRole={selectedUser.role}
          currentBranches={selectedUser.branches?.map(b => ({
            branch_id: b.id || (b as any).branch_id,
            name: b.name,
            name_ar: b.name_ar,
            branch_type: b.branch_type,
            access_level: b.access_level || 'full',
          })) || []}
          onSuccess={() => {
            setSuccess('Branch assignments updated successfully!');
            fetchUsers();
            setTimeout(() => setSuccess(null), 5000);
          }}
        />
      )}

      {/* Edit User Modal */}
      {showEditModal && userToEdit && (
        <EditUserModal
          user={userToEdit}
          isMainAdmin={isMainAdmin}
          onClose={() => {
            setShowEditModal(false);
            setUserToEdit(null);
          }}
          onSuccess={(message) => {
            setSuccess(message);
            setShowEditModal(false);
            setUserToEdit(null);
            fetchUsers();
            setTimeout(() => setSuccess(null), 5000);
          }}
          onError={(message) => {
            setError(message);
            setTimeout(() => setError(null), 5000);
          }}
        />
      )}

      {/* Module Access Modal */}
      {showModuleAccessModal && userForModuleAccess && (
        <ModuleAccessModal
          user={userForModuleAccess}
          onClose={() => {
            setShowModuleAccessModal(false);
            setUserForModuleAccess(null);
          }}
          onSuccess={(message) => {
            setSuccess(message);
            setShowModuleAccessModal(false);
            setUserForModuleAccess(null);
            fetchUsers();
            setTimeout(() => setSuccess(null), 5000);
          }}
          onError={(message) => {
            setError(message);
            setTimeout(() => setError(null), 5000);
          }}
        />
      )}

      {/* UI Preferences Modal */}
      {showUIPreferencesModal && userForUIPreferences && (
        <UIPreferencesModal
          user={userForUIPreferences}
          onClose={() => {
            setShowUIPreferencesModal(false);
            setUserForUIPreferences(null);
          }}
          onSuccess={(message) => {
            setSuccess(message);
            setShowUIPreferencesModal(false);
            setUserForUIPreferences(null);
            fetchUsers();
            setTimeout(() => setSuccess(null), 5000);
          }}
          onError={(message) => {
            setError(message);
            setTimeout(() => setError(null), 5000);
          }}
        />
      )}

      {/* Delete Confirmation Dialog */}
      {showDeleteConfirm && userToDelete && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
            <div className="px-6 py-4 border-b border-gray-200 flex items-center gap-3">
              <div className="p-2 bg-red-100 rounded-full">
                <ExclamationTriangleIcon className="h-6 w-6 text-red-600" />
              </div>
              <h2 className="text-xl font-bold text-gray-900">Delete User</h2>
            </div>
            <div className="px-6 py-4">
              <p className="text-gray-700">
                Are you sure you want to delete the user <strong>{userToDelete.name}</strong> ({userToDelete.username})?
              </p>
              <p className="mt-2 text-sm text-gray-500">
                This action cannot be undone. All data associated with this user will be preserved but the user will no longer be able to log in.
              </p>
            </div>
            <div className="px-6 py-4 bg-gray-50 rounded-b-lg flex gap-3 justify-end">
              <Button
                type="button"
                onClick={() => {
                  setShowDeleteConfirm(false);
                  setUserToDelete(null);
                }}
                variant="secondary"
                disabled={deleteLoading}
              >
                Cancel
              </Button>
              <Button
                type="button"
                onClick={handleDeleteUser}
                variant="danger"
                isLoading={deleteLoading}
              >
                Delete User
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Create User Modal Component
function CreateUserModal({
  onClose,
  onSuccess,
  onError,
}: {
  onClose: () => void;
  onSuccess: (message: string) => void;
  onError: (message: string) => void;
}) {
  const [formData, setFormData] = useState({
    username: '',
    password: '',
    name: '',
    roles: ['Logistics'] as string[],
    email: '',
    phone: '',
  });
  const [loading, setLoading] = useState(false);

  const toggleRole = (role: string) => {
    setFormData(prev => ({
      ...prev,
      roles: prev.roles.includes(role)
        ? prev.roles.filter(r => r !== role)
        : [...prev.roles, role]
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (formData.roles.length === 0) {
      onError('Please select at least one role');
      return;
    }
    
    setLoading(true);

    try {
      const response = await fetch(`${API_BASE_URL}/auth/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('auth_token')}`,
        },
        body: JSON.stringify({
          ...formData,
          role: formData.roles[0], // Primary role for backward compatibility
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to create user');
      }

      const data = await response.json();
      onSuccess(`User "${data.user.username}" created successfully!`);
    } catch (err: any) {
      onError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-lg w-full mx-4 max-h-[90vh] overflow-y-auto">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-xl font-bold text-gray-900">Create New User</h2>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-4 space-y-4">
          {/* Username */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Username *
            </label>
            <input
              type="text"
              required
              value={formData.username}
              onChange={(e) => setFormData({ ...formData, username: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              placeholder="john.doe"
            />
          </div>

          {/* Password */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Password *
            </label>
            <input
              type="password"
              required
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              placeholder="••••••••"
              minLength={6}
            />
            <p className="mt-1 text-xs text-gray-500">Minimum 6 characters</p>
          </div>

          {/* Full Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Full Name *
            </label>
            <input
              type="text"
              required
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              placeholder="John Doe"
            />
          </div>

          {/* Roles - Multi-select */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Roles * <span className="text-gray-500 font-normal">(select one or more)</span>
            </label>
            <div className="space-y-2">
              {VALID_ROLES.map((role) => (
                <label
                  key={role}
                  className={`flex items-start gap-3 p-2 rounded-lg border cursor-pointer transition-colors ${
                    formData.roles.includes(role)
                      ? 'bg-primary-50 border-primary-500'
                      : 'bg-white border-gray-200 hover:bg-gray-50'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={formData.roles.includes(role)}
                    onChange={() => toggleRole(role)}
                    className="h-4 w-4 mt-0.5 text-primary-600 rounded focus:ring-primary-500 flex-shrink-0"
                  />
                  <div className="flex-1 min-w-0">
                    <span className={`text-sm font-semibold ${formData.roles.includes(role) ? 'text-primary-700' : 'text-gray-800'}`}>
                      {role}
                    </span>
                    <p className="text-xs text-gray-500">{ROLE_FULL_DESCRIPTIONS[role]}</p>
                  </div>
                </label>
              ))}
            </div>
            {formData.roles.length === 0 && (
              <p className="mt-1 text-xs text-red-500">Please select at least one role</p>
            )}
          </div>

          {/* Email (Optional) */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Email
            </label>
            <input
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              placeholder="john.doe@example.com"
            />
          </div>

          {/* Phone (Optional) */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Phone
            </label>
            <input
              type="tel"
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              placeholder="+1234567890"
            />
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-4">
            <Button
              type="button"
              onClick={onClose}
              variant="secondary"
              className="flex-1"
              disabled={loading}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              className="flex-1"
              isLoading={loading}
              disabled={formData.roles.length === 0}
            >
              Create User
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

// All available modules for access control
const AVAILABLE_MODULES = [
  { key: 'shipments', label: 'Shipments', labelAr: 'الشحنات', icon: '🚢' },
  { key: 'contracts', label: 'Contracts', labelAr: 'العقود', icon: '📄' },
  { key: 'products', label: 'Products', labelAr: 'المنتجات', icon: '📦' },
  { key: 'finance', label: 'Finance', labelAr: 'المالية', icon: '💰' },
  { key: 'customs', label: 'Customs', labelAr: 'التخليص الجمركي', icon: '🏛️' },
  { key: 'land_transport', label: 'Land Transport', labelAr: 'النقل البري', icon: '🚛' },
  { key: 'companies', label: 'Companies', labelAr: 'الشركات', icon: '🏢' },
  { key: 'analytics', label: 'Analytics', labelAr: 'التحليلات', icon: '📊' },
  { key: 'accounting', label: 'Accounting', labelAr: 'المحاسبة', icon: '📒' },
  { key: 'inventory', label: 'Inventory', labelAr: 'المخزون', icon: '📋' },
  { key: 'quality', label: 'Quality', labelAr: 'الجودة', icon: '✅' },
  { key: 'cafe', label: 'Cafeteria', labelAr: 'الكافتيريا', icon: '☕' },
  { key: 'cashbox', label: 'Cash Box', labelAr: 'صندوق النقد', icon: '💵' },
] as const;

// Module Access Modal Component
function ModuleAccessModal({
  user,
  onClose,
  onSuccess,
  onError,
}: {
  user: User;
  onClose: () => void;
  onSuccess: (message: string) => void;
  onError: (message: string) => void;
}) {
  const { i18n } = useTranslation();
  const isArabic = i18n.language === 'ar';
  
  // Initialize module access state from user's current settings
  // null = use role default, true = explicitly granted, false = explicitly denied
  const [moduleAccess, setModuleAccess] = useState<Record<string, boolean | null>>(() => {
    const initial: Record<string, boolean | null> = {};
    AVAILABLE_MODULES.forEach(m => {
      initial[m.key] = user.module_access?.[m.key] ?? null;
    });
    return initial;
  });
  const [loading, setLoading] = useState(false);

  // Cycle through: null (default) -> true (granted) -> false (denied) -> null
  const cycleAccess = (moduleKey: string) => {
    setModuleAccess(prev => {
      const current = prev[moduleKey];
      if (current === null) return { ...prev, [moduleKey]: true };
      if (current === true) return { ...prev, [moduleKey]: false };
      return { ...prev, [moduleKey]: null };
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Build module_access object - only include non-null values
      const moduleAccessPayload: Record<string, boolean> = {};
      Object.entries(moduleAccess).forEach(([key, value]) => {
        if (value !== null) {
          moduleAccessPayload[key] = value;
        }
      });

      // If all values are null (default), send null to clear overrides
      const finalPayload = Object.keys(moduleAccessPayload).length > 0 ? moduleAccessPayload : null;

      const response = await fetch(`${API_BASE_URL}/auth/users/${user.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('auth_token')}`,
        },
        body: JSON.stringify({ module_access: finalPayload }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to update module access');
      }

      onSuccess(`Module access updated for "${user.name}"`);
    } catch (err: any) {
      onError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Count overrides
  const grantedCount = Object.values(moduleAccess).filter(v => v === true).length;
  const deniedCount = Object.values(moduleAccess).filter(v => v === false).length;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        <div className="px-6 py-4 border-b border-gray-200 bg-gradient-to-r from-violet-50 to-purple-50">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-violet-100 rounded-lg">
              <AdjustmentsHorizontalIcon className="h-6 w-6 text-violet-600" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900">
                {isArabic ? 'صلاحيات الوصول' : 'Module Access'}
              </h2>
              <p className="text-sm text-gray-600">
                {user.name} <span className="text-gray-400">@{user.username}</span>
              </p>
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="px-6 py-4">
            {/* Legend */}
            <div className="mb-4 p-3 bg-gray-50 rounded-lg border border-gray-200">
              <p className="text-sm font-medium text-gray-700 mb-2">
                {isArabic ? 'انقر للتبديل بين:' : 'Click to toggle between:'}
              </p>
              <div className="flex flex-wrap gap-3 text-sm">
                <span className="inline-flex items-center gap-1.5 px-2 py-1 bg-gray-100 text-gray-600 rounded">
                  <span className="w-4 h-4 rounded border-2 border-gray-300 bg-white flex items-center justify-center text-xs">—</span>
                  {isArabic ? 'حسب الدور (افتراضي)' : 'Role Default'}
                </span>
                <span className="inline-flex items-center gap-1.5 px-2 py-1 bg-emerald-50 text-emerald-700 rounded">
                  <CheckIcon className="w-4 h-4" />
                  {isArabic ? 'مسموح' : 'Granted'}
                </span>
                <span className="inline-flex items-center gap-1.5 px-2 py-1 bg-red-50 text-red-700 rounded">
                  <XMarkIcon className="w-4 h-4" />
                  {isArabic ? 'محظور' : 'Denied'}
                </span>
              </div>
            </div>

            {/* Module Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {AVAILABLE_MODULES.map((module) => {
                const value = moduleAccess[module.key];
                const isDefault = value === null;
                const isGranted = value === true;
                const isDenied = value === false;

                return (
                  <button
                    key={module.key}
                    type="button"
                    onClick={() => cycleAccess(module.key)}
                    className={`
                      p-3 rounded-lg border-2 text-left transition-all
                      ${isDefault ? 'border-gray-200 bg-white hover:border-gray-300' : ''}
                      ${isGranted ? 'border-emerald-500 bg-emerald-50 hover:bg-emerald-100' : ''}
                      ${isDenied ? 'border-red-500 bg-red-50 hover:bg-red-100' : ''}
                    `}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xl">{module.icon}</span>
                      <span className={`
                        w-6 h-6 rounded-full flex items-center justify-center text-sm font-bold
                        ${isDefault ? 'bg-gray-200 text-gray-500' : ''}
                        ${isGranted ? 'bg-emerald-500 text-white' : ''}
                        ${isDenied ? 'bg-red-500 text-white' : ''}
                      `}>
                        {isDefault && '—'}
                        {isGranted && <CheckIcon className="w-4 h-4" />}
                        {isDenied && <XMarkIcon className="w-4 h-4" />}
                      </span>
                    </div>
                    <p className={`mt-1 text-sm font-medium ${isDenied ? 'line-through text-red-600' : 'text-gray-900'}`}>
                      {isArabic ? module.labelAr : module.label}
                    </p>
                    <p className="text-xs text-gray-500">
                      {isDefault && (isArabic ? 'حسب الدور' : 'Role default')}
                      {isGranted && (isArabic ? 'مسموح يدوياً' : 'Manually granted')}
                      {isDenied && (isArabic ? 'محظور يدوياً' : 'Manually denied')}
                    </p>
                  </button>
                );
              })}
            </div>

            {/* Summary */}
            {(grantedCount > 0 || deniedCount > 0) && (
              <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                <p className="text-sm text-amber-800">
                  <strong>{isArabic ? 'تجاوزات مخصصة:' : 'Custom overrides:'}</strong>{' '}
                  {grantedCount > 0 && (
                    <span className="text-emerald-700">
                      {grantedCount} {isArabic ? 'مسموح' : 'granted'}
                    </span>
                  )}
                  {grantedCount > 0 && deniedCount > 0 && ', '}
                  {deniedCount > 0 && (
                    <span className="text-red-700">
                      {deniedCount} {isArabic ? 'محظور' : 'denied'}
                    </span>
                  )}
                </p>
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 flex gap-3 justify-end">
            <Button
              type="button"
              onClick={onClose}
              variant="secondary"
              disabled={loading}
            >
              {isArabic ? 'إلغاء' : 'Cancel'}
            </Button>
            <Button
              type="submit"
              variant="primary"
              isLoading={loading}
            >
              {isArabic ? 'حفظ التغييرات' : 'Save Changes'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

// UI Preferences Modal Component
function UIPreferencesModal({
  user,
  onClose,
  onSuccess,
  onError,
}: {
  user: User;
  onClose: () => void;
  onSuccess: (message: string) => void;
  onError: (message: string) => void;
}) {
  const { i18n } = useTranslation();
  const isArabic = i18n.language === 'ar';
  
  const [loading, setLoading] = useState(false);
  const [fetchingPrefs, setFetchingPrefs] = useState(true);
  const [hideTasks, setHideTasks] = useState(false);
  const [columnOrder, setColumnOrder] = useState<string[]>(DEFAULT_SHIPMENT_COLUMNS);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);

  // Fetch current preferences
  useEffect(() => {
    const fetchPreferences = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/auth/users/${user.id}/preferences`, {
          headers: {
            Authorization: `Bearer ${localStorage.getItem('auth_token')}`,
          },
        });
        if (response.ok) {
          const data = await response.json();
          const prefs: UserPreferences = data.preferences || {};
          setHideTasks(prefs.dashboard?.hide_tasks || false);
          setColumnOrder(prefs.shipments_columns?.order || DEFAULT_SHIPMENT_COLUMNS);
        }
      } catch (err) {
        console.error('Failed to fetch preferences:', err);
      } finally {
        setFetchingPrefs(false);
      }
    };
    fetchPreferences();
  }, [user.id]);

  // Drag and drop handlers
  const handleDragStart = (index: number) => {
    setDraggedIndex(index);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === index) return;
    
    const newOrder = [...columnOrder];
    const [removed] = newOrder.splice(draggedIndex, 1);
    newOrder.splice(index, 0, removed);
    setColumnOrder(newOrder);
    setDraggedIndex(index);
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
  };

  // Toggle column visibility
  const toggleColumn = (columnKey: string) => {
    if (columnOrder.includes(columnKey)) {
      setColumnOrder(columnOrder.filter(c => c !== columnKey));
    } else {
      setColumnOrder([...columnOrder, columnKey]);
    }
  };

  // Reset to defaults
  const resetToDefaults = () => {
    setHideTasks(false);
    setColumnOrder(DEFAULT_SHIPMENT_COLUMNS);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const preferences: UserPreferences = {
        dashboard: {
          hide_tasks: hideTasks,
        },
        shipments_columns: {
          order: columnOrder,
        },
      };

      const response = await fetch(`${API_BASE_URL}/auth/users/${user.id}/preferences`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('auth_token')}`,
        },
        body: JSON.stringify({ preferences }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to update preferences');
      }

      onSuccess(`UI preferences updated for "${user.name}"`);
    } catch (err: any) {
      onError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const allColumns = Object.keys(SHIPMENT_COLUMN_CONFIG);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        <div className="px-6 py-4 border-b border-gray-200 bg-gradient-to-r from-teal-50 to-cyan-50">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-teal-100 rounded-lg">
              <Cog6ToothIcon className="h-6 w-6 text-teal-600" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900">
                {isArabic ? 'تفضيلات الواجهة' : 'UI Preferences'}
              </h2>
              <p className="text-sm text-gray-600">
                {user.name} <span className="text-gray-400">@{user.username}</span>
              </p>
            </div>
          </div>
        </div>

        {fetchingPrefs ? (
          <div className="p-8 text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-600 mx-auto"></div>
            <p className="mt-2 text-gray-600">{isArabic ? 'جاري التحميل...' : 'Loading preferences...'}</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <div className="px-6 py-4 space-y-6">
              {/* Dashboard Settings */}
              <div>
                <h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
                  <span className="w-6 h-6 rounded bg-teal-100 text-teal-700 flex items-center justify-center text-xs font-bold">1</span>
                  {isArabic ? 'إعدادات لوحة التحكم' : 'Dashboard Settings'}
                </h3>
                <label className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg border border-gray-200 cursor-pointer hover:bg-gray-100 transition-colors">
                  <input
                    type="checkbox"
                    checked={hideTasks}
                    onChange={(e) => setHideTasks(e.target.checked)}
                    className="h-5 w-5 text-teal-600 rounded focus:ring-teal-500"
                  />
                  <div>
                    <span className="text-sm font-medium text-gray-900">
                      {isArabic ? 'إخفاء قسم المهام' : 'Hide Tasks Section'}
                    </span>
                    <p className="text-xs text-gray-500">
                      {isArabic ? 'إخفاء قسم المهام من لوحة التحكم الرئيسية' : 'Hide the Tasks section from the main dashboard'}
                    </p>
                  </div>
                </label>
              </div>

              {/* Shipments Column Order */}
              <div>
                <h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
                  <span className="w-6 h-6 rounded bg-teal-100 text-teal-700 flex items-center justify-center text-xs font-bold">2</span>
                  {isArabic ? 'أعمدة جدول الشحنات' : 'Shipments Table Columns'}
                </h3>
                <p className="text-xs text-gray-500 mb-3">
                  {isArabic ? 'اسحب لإعادة الترتيب، انقر لإظهار/إخفاء' : 'Drag to reorder, click to show/hide'}
                </p>
                
                {/* Active columns (draggable) */}
                <div className="space-y-1 mb-4">
                  <p className="text-xs font-medium text-gray-700 mb-2">
                    {isArabic ? 'الأعمدة المرئية:' : 'Visible columns:'}
                  </p>
                  {columnOrder.map((colKey, index) => {
                    const config = SHIPMENT_COLUMN_CONFIG[colKey];
                    if (!config) return null;
                    return (
                      <div
                        key={colKey}
                        draggable
                        onDragStart={() => handleDragStart(index)}
                        onDragOver={(e) => handleDragOver(e, index)}
                        onDragEnd={handleDragEnd}
                        className={`
                          flex items-center gap-2 p-2 bg-white border rounded-lg cursor-move
                          ${draggedIndex === index ? 'border-teal-500 bg-teal-50' : 'border-gray-200 hover:border-gray-300'}
                        `}
                      >
                        <Bars3Icon className="h-4 w-4 text-gray-400 flex-shrink-0" />
                        <span className="text-sm font-medium text-gray-900 flex-1">
                          {isArabic ? config.labelAr : config.label}
                        </span>
                        <button
                          type="button"
                          onClick={() => toggleColumn(colKey)}
                          className="text-red-500 hover:text-red-700 p-1"
                          title={isArabic ? 'إخفاء' : 'Hide'}
                        >
                          <XMarkIcon className="h-4 w-4" />
                        </button>
                      </div>
                    );
                  })}
                </div>

                {/* Hidden columns */}
                {allColumns.filter(c => !columnOrder.includes(c)).length > 0 && (
                  <div>
                    <p className="text-xs font-medium text-gray-700 mb-2">
                      {isArabic ? 'الأعمدة المخفية:' : 'Hidden columns:'}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {allColumns.filter(c => !columnOrder.includes(c)).map((colKey) => {
                        const config = SHIPMENT_COLUMN_CONFIG[colKey];
                        if (!config) return null;
                        return (
                          <button
                            key={colKey}
                            type="button"
                            onClick={() => toggleColumn(colKey)}
                            className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-gray-600 bg-gray-100 rounded hover:bg-gray-200 transition-colors"
                          >
                            <PlusIcon className="h-3 w-3" />
                            {isArabic ? config.labelAr : config.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              {/* Reset button */}
              <button
                type="button"
                onClick={resetToDefaults}
                className="text-sm text-gray-500 hover:text-gray-700 underline"
              >
                {isArabic ? 'إعادة التعيين إلى الافتراضي' : 'Reset to defaults'}
              </button>
            </div>

            {/* Actions */}
            <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 flex gap-3 justify-end">
              <Button
                type="button"
                onClick={onClose}
                variant="secondary"
                disabled={loading}
              >
                {isArabic ? 'إلغاء' : 'Cancel'}
              </Button>
              <Button
                type="submit"
                variant="primary"
                isLoading={loading}
              >
                {isArabic ? 'حفظ التفضيلات' : 'Save Preferences'}
              </Button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

// Edit User Modal Component
function EditUserModal({
  user,
  isMainAdmin,
  onClose,
  onSuccess,
  onError,
}: {
  user: User;
  isMainAdmin: boolean;
  onClose: () => void;
  onSuccess: (message: string) => void;
  onError: (message: string) => void;
}) {
  // Get initial roles from user - prefer roles array, fallback to single role
  const initialRoles = (user.roles && user.roles.length > 0) 
    ? user.roles 
    : (user.role ? [user.role] : ['Logistics']);
  
  const [formData, setFormData] = useState({
    username: user.username || '',
    name: user.name || '',
    roles: initialRoles as string[],
    email: user.email || '',
    phone: user.phone || '',
    newPassword: '',
  });
  const [loading, setLoading] = useState(false);

  const toggleRole = (role: string) => {
    setFormData(prev => ({
      ...prev,
      roles: prev.roles.includes(role)
        ? prev.roles.filter(r => r !== role)
        : [...prev.roles, role]
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (formData.roles.length === 0) {
      onError('Please select at least one role');
      return;
    }
    
    setLoading(true);

    try {
      // Build the update payload
      const updatePayload: Record<string, any> = {
        name: formData.name,
        roles: formData.roles,
      };
      
      if (formData.email) updatePayload.email = formData.email;
      if (formData.phone) updatePayload.phone = formData.phone;
      
      // Only main admin can change username and password
      if (isMainAdmin) {
        if (formData.username && formData.username !== user.username) {
          updatePayload.username = formData.username;
        }
        if (formData.newPassword) {
          updatePayload.password = formData.newPassword;
        }
      }

      const response = await fetch(`${API_BASE_URL}/auth/users/${user.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('auth_token')}`,
        },
        body: JSON.stringify(updatePayload),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to update user');
      }

      onSuccess(`User "${formData.name}" updated successfully!`);
    } catch (err: any) {
      onError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-lg w-full mx-4 max-h-[90vh] overflow-y-auto">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-xl font-bold text-gray-900">Edit User</h2>
          <p className="text-sm text-gray-500">@{user.username}</p>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-4 space-y-4">
          {/* Username - Only visible for main admin */}
          {isMainAdmin && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Username
              </label>
              <input
                type="text"
                value={formData.username}
                onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                placeholder="john.doe"
              />
              <p className="mt-1 text-xs text-amber-600">⚠️ Changing username will require the user to login with new credentials</p>
            </div>
          )}

          {/* Full Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Full Name *
            </label>
            <input
              type="text"
              required
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              placeholder="John Doe"
            />
          </div>

          {/* Roles - Multi-select */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Roles * <span className="text-gray-500 font-normal">(select one or more)</span>
            </label>
            <div className="space-y-2">
              {VALID_ROLES.map((role) => (
                <label
                  key={role}
                  className={`flex items-start gap-3 p-2 rounded-lg border cursor-pointer transition-colors ${
                    formData.roles.includes(role)
                      ? 'bg-primary-50 border-primary-500'
                      : 'bg-white border-gray-200 hover:bg-gray-50'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={formData.roles.includes(role)}
                    onChange={() => toggleRole(role)}
                    className="h-4 w-4 mt-0.5 text-primary-600 rounded focus:ring-primary-500 flex-shrink-0"
                  />
                  <div className="flex-1 min-w-0">
                    <span className={`text-sm font-semibold ${formData.roles.includes(role) ? 'text-primary-700' : 'text-gray-800'}`}>
                      {role}
                    </span>
                    <p className="text-xs text-gray-500">{ROLE_FULL_DESCRIPTIONS[role]}</p>
                  </div>
                </label>
              ))}
            </div>
            {formData.roles.length === 0 && (
              <p className="mt-1 text-xs text-red-500">Please select at least one role</p>
            )}
          </div>

          {/* Email (Optional) */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Email
            </label>
            <input
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              placeholder="john.doe@example.com"
            />
          </div>

          {/* Phone (Optional) */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Phone
            </label>
            <input
              type="tel"
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              placeholder="+1234567890"
            />
          </div>

          {/* New Password - Only visible for main admin */}
          {isMainAdmin ? (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Reset Password
              </label>
              <input
                type="password"
                value={formData.newPassword}
                onChange={(e) => setFormData({ ...formData, newPassword: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                placeholder="Enter new password"
                minLength={6}
              />
              <p className="mt-1 text-xs text-gray-500">Leave empty to keep current password. Minimum 6 characters.</p>
            </div>
          ) : (
            <div className="bg-gray-50 rounded-lg p-3 border border-gray-200">
              <p className="text-sm text-gray-600">
                <span className="font-medium">Note:</span> Only the main administrator can change usernames and reset passwords.
              </p>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3 pt-4">
            <Button
              type="button"
              onClick={onClose}
              variant="secondary"
              className="flex-1"
              disabled={loading}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              className="flex-1"
              isLoading={loading}
              disabled={formData.roles.length === 0}
            >
              Save Changes
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

