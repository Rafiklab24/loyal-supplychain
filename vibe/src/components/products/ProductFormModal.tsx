/**
 * ProductFormModal - Create/Edit product with all fields
 * Includes: basic info, specifications, shipping requirements
 */

import { useState, useEffect, Fragment } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Dialog, Transition, Tab } from '@headlessui/react';
import {
  XMarkIcon,
  CubeIcon,
  BeakerIcon,
  TruckIcon,
  CheckIcon,
  ExclamationTriangleIcon,
} from '@heroicons/react/24/outline';
import {
  createProduct,
  updateProduct,
  type Product,
  PRODUCT_CATEGORIES,
  UNITS_OF_MEASURE,
  PACK_TYPES,
  INCOTERMS,
  CERTIFICATIONS,
} from '../../services/products';

interface ProductFormModalProps {
  product?: Product | null;
  onClose: () => void;
  onSuccess: () => void;
}

interface FormData {
  // Basic Info
  name: string;
  sku: string;
  hs_code: string;
  category_type: string;
  uom: string;
  pack_type: string;
  net_weight_kg: string;
  brand: string;
  description: string;
  typical_origins: string[];
  aliases: string[];
  is_seasonal: boolean;
  // Specs
  specs: {
    grade: string;
    moisture_pct: string;
    purity_pct: string;
    ash_pct: string;
    color_value: string;
    grain_size_mm: string;
    certifications: string[];
    custom_specs: Record<string, any>;
    // Shipping
    temperature_min_c: string;
    temperature_max_c: string;
    humidity_max_pct: string;
    shelf_life_days: string;
    special_handling: string[];
    packaging_requirements: string;
    // Terms
    default_payment_terms: string;
    default_inspection: string;
    default_incoterm: string;
  };
}

const COMMON_ORIGINS = [
  'Brazil', 'India', 'Thailand', 'Vietnam', 'Indonesia', 'China',
  'USA', 'Australia', 'Turkey', 'Egypt', 'Ukraine', 'Russia',
  'Pakistan', 'Myanmar', 'Cambodia', 'Argentina', 'Mexico', 'Spain',
];

const SPECIAL_HANDLING_OPTIONS = [
  'Keep dry',
  'No direct sunlight',
  'Ventilated container',
  'Temperature controlled',
  'Humidity controlled',
  'Food grade container',
  'Fumigation required',
  'No odor contamination',
];

export function ProductFormModal({ product, onClose, onSuccess }: ProductFormModalProps) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const isEditing = !!product;

  const [formData, setFormData] = useState<FormData>({
    name: '',
    sku: '',
    hs_code: '',
    category_type: '',
    uom: 'MT',
    pack_type: 'BAGS',
    net_weight_kg: '',
    brand: '',
    description: '',
    typical_origins: [],
    aliases: [],
    is_seasonal: true,
    specs: {
      grade: '',
      moisture_pct: '',
      purity_pct: '',
      ash_pct: '',
      color_value: '',
      grain_size_mm: '',
      certifications: [],
      custom_specs: {},
      temperature_min_c: '',
      temperature_max_c: '',
      humidity_max_pct: '',
      shelf_life_days: '',
      special_handling: [],
      packaging_requirements: '',
      default_payment_terms: '',
      default_inspection: '',
      default_incoterm: 'FOB',
    },
  });

  const [aliasInput, setAliasInput] = useState('');
  const [customSpecKey, setCustomSpecKey] = useState('');
  const [customSpecValue, setCustomSpecValue] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Load product data when editing
  useEffect(() => {
    if (product) {
      setFormData({
        name: product.name || '',
        sku: product.sku || '',
        hs_code: product.hs_code || '',
        category_type: product.category_type || '',
        uom: product.uom || 'MT',
        pack_type: product.pack_type || 'BAGS',
        net_weight_kg: product.net_weight_kg?.toString() || '',
        brand: product.brand || '',
        description: product.description || '',
        typical_origins: product.typical_origins || [],
        aliases: product.aliases || [],
        is_seasonal: product.is_seasonal ?? true,
        specs: {
          grade: (product as any).grade || '',
          moisture_pct: (product as any).moisture_pct?.toString() || '',
          purity_pct: (product as any).purity_pct?.toString() || '',
          ash_pct: (product as any).ash_pct?.toString() || '',
          color_value: (product as any).color_value?.toString() || '',
          grain_size_mm: (product as any).grain_size_mm?.toString() || '',
          certifications: (product as any).certifications || [],
          custom_specs: (product as any).custom_specs || {},
          temperature_min_c: (product as any).temperature_min_c?.toString() || '',
          temperature_max_c: (product as any).temperature_max_c?.toString() || '',
          humidity_max_pct: (product as any).humidity_max_pct?.toString() || '',
          shelf_life_days: (product as any).shelf_life_days?.toString() || '',
          special_handling: (product as any).special_handling || [],
          packaging_requirements: (product as any).packaging_requirements || '',
          default_payment_terms: (product as any).default_payment_terms || '',
          default_inspection: (product as any).default_inspection || '',
          default_incoterm: (product as any).default_incoterm || 'FOB',
        },
      });
    }
  }, [product]);

  // Mutations
  const createMutation = useMutation({
    mutationFn: createProduct,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
      onSuccess();
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => updateProduct(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
      onSuccess();
    },
  });

  const isLoading = createMutation.isPending || updateMutation.isPending;
  const error = createMutation.error || updateMutation.error;

  // Handlers
  const handleChange = (field: keyof FormData, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: '' }));
    }
  };

  const handleSpecChange = (field: string, value: any) => {
    setFormData((prev) => ({
      ...prev,
      specs: { ...prev.specs, [field]: value },
    }));
  };

  const handleAddAlias = () => {
    if (aliasInput.trim() && !formData.aliases.includes(aliasInput.trim())) {
      setFormData((prev) => ({
        ...prev,
        aliases: [...prev.aliases, aliasInput.trim()],
      }));
      setAliasInput('');
    }
  };

  const handleRemoveAlias = (alias: string) => {
    setFormData((prev) => ({
      ...prev,
      aliases: prev.aliases.filter((a) => a !== alias),
    }));
  };

  const handleToggleOrigin = (origin: string) => {
    setFormData((prev) => ({
      ...prev,
      typical_origins: prev.typical_origins.includes(origin)
        ? prev.typical_origins.filter((o) => o !== origin)
        : [...prev.typical_origins, origin],
    }));
  };

  const handleToggleCertification = (cert: string) => {
    setFormData((prev) => ({
      ...prev,
      specs: {
        ...prev.specs,
        certifications: prev.specs.certifications.includes(cert)
          ? prev.specs.certifications.filter((c) => c !== cert)
          : [...prev.specs.certifications, cert],
      },
    }));
  };

  const handleToggleHandling = (handling: string) => {
    setFormData((prev) => ({
      ...prev,
      specs: {
        ...prev.specs,
        special_handling: prev.specs.special_handling.includes(handling)
          ? prev.specs.special_handling.filter((h) => h !== handling)
          : [...prev.specs.special_handling, handling],
      },
    }));
  };

  const handleAddCustomSpec = () => {
    if (customSpecKey.trim() && customSpecValue.trim()) {
      setFormData((prev) => ({
        ...prev,
        specs: {
          ...prev.specs,
          custom_specs: {
            ...prev.specs.custom_specs,
            [customSpecKey.trim()]: customSpecValue.trim(),
          },
        },
      }));
      setCustomSpecKey('');
      setCustomSpecValue('');
    }
  };

  const handleRemoveCustomSpec = (key: string) => {
    setFormData((prev) => {
      const { [key]: _, ...rest } = prev.specs.custom_specs;
      return {
        ...prev,
        specs: { ...prev.specs, custom_specs: rest },
      };
    });
  };

  // Validate
  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};
    if (!formData.name.trim()) {
      newErrors.name = t('products.errors.nameRequired', 'Product name is required');
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Submit
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    const payload = {
      name: formData.name,
      sku: formData.sku || undefined,
      hs_code: formData.hs_code || undefined,
      category_type: formData.category_type || undefined,
      uom: formData.uom,
      pack_type: formData.pack_type,
      net_weight_kg: formData.net_weight_kg ? parseFloat(formData.net_weight_kg) : undefined,
      brand: formData.brand || undefined,
      description: formData.description || undefined,
      typical_origins: formData.typical_origins.length > 0 ? formData.typical_origins : undefined,
      aliases: formData.aliases.length > 0 ? formData.aliases : undefined,
      is_seasonal: formData.is_seasonal,
      specs: {
        grade: formData.specs.grade || undefined,
        moisture_pct: formData.specs.moisture_pct ? parseFloat(formData.specs.moisture_pct) : undefined,
        purity_pct: formData.specs.purity_pct ? parseFloat(formData.specs.purity_pct) : undefined,
        ash_pct: formData.specs.ash_pct ? parseFloat(formData.specs.ash_pct) : undefined,
        color_value: formData.specs.color_value ? parseFloat(formData.specs.color_value) : undefined,
        grain_size_mm: formData.specs.grain_size_mm ? parseFloat(formData.specs.grain_size_mm) : undefined,
        certifications: formData.specs.certifications.length > 0 ? formData.specs.certifications : undefined,
        custom_specs: Object.keys(formData.specs.custom_specs).length > 0 ? formData.specs.custom_specs : undefined,
        temperature_min_c: formData.specs.temperature_min_c ? parseFloat(formData.specs.temperature_min_c) : undefined,
        temperature_max_c: formData.specs.temperature_max_c ? parseFloat(formData.specs.temperature_max_c) : undefined,
        humidity_max_pct: formData.specs.humidity_max_pct ? parseFloat(formData.specs.humidity_max_pct) : undefined,
        shelf_life_days: formData.specs.shelf_life_days ? parseInt(formData.specs.shelf_life_days) : undefined,
        special_handling: formData.specs.special_handling.length > 0 ? formData.specs.special_handling : undefined,
        packaging_requirements: formData.specs.packaging_requirements || undefined,
        default_payment_terms: formData.specs.default_payment_terms || undefined,
        default_inspection: formData.specs.default_inspection || undefined,
        default_incoterm: formData.specs.default_incoterm || undefined,
      },
    };

    if (isEditing && product) {
      updateMutation.mutate({ id: product.id, data: payload });
    } else {
      createMutation.mutate(payload);
    }
  };

  return (
    <Transition appear show={true} as={Fragment}>
      <Dialog as="div" className="relative z-50" onClose={onClose}>
        <Transition.Child
          as={Fragment}
          enter="ease-out duration-300"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-200"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-black/50" />
        </Transition.Child>

        <div className="fixed inset-0 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4">
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-300"
              enterFrom="opacity-0 scale-95"
              enterTo="opacity-100 scale-100"
              leave="ease-in duration-200"
              leaveFrom="opacity-100 scale-100"
              leaveTo="opacity-0 scale-95"
            >
              <Dialog.Panel className="w-full max-w-3xl transform overflow-hidden rounded-2xl bg-white shadow-2xl transition-all">
                {/* Header */}
                <div className="bg-gradient-to-r from-emerald-600 to-teal-600 px-6 py-4">
                  <div className="flex items-center justify-between">
                    <Dialog.Title className="text-lg font-semibold text-white flex items-center gap-2">
                      <CubeIcon className="h-6 w-6" />
                      {isEditing
                        ? t('products.editProduct', 'Edit Product')
                        : t('products.newProduct', 'New Product')}
                    </Dialog.Title>
                    <button
                      onClick={onClose}
                      className="text-white/80 hover:text-white transition-colors"
                    >
                      <XMarkIcon className="h-6 w-6" />
                    </button>
                  </div>
                </div>

                {/* Error */}
                {error && (
                  <div className="mx-6 mt-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2">
                    <ExclamationTriangleIcon className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
                    <p className="text-sm text-red-700">{(error as Error).message}</p>
                  </div>
                )}

                <form onSubmit={handleSubmit}>
                  <Tab.Group>
                    <Tab.List className="flex border-b border-gray-200 px-6">
                      <Tab className={({ selected }) =>
                        `flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 -mb-px transition-colors ${
                          selected
                            ? 'border-emerald-600 text-emerald-600'
                            : 'border-transparent text-gray-500 hover:text-gray-700'
                        }`
                      }>
                        <CubeIcon className="h-4 w-4" />
                        {t('products.basicInfo', 'Basic Info')}
                      </Tab>
                      <Tab className={({ selected }) =>
                        `flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 -mb-px transition-colors ${
                          selected
                            ? 'border-emerald-600 text-emerald-600'
                            : 'border-transparent text-gray-500 hover:text-gray-700'
                        }`
                      }>
                        <BeakerIcon className="h-4 w-4" />
                        {t('products.specifications', 'Specifications')}
                      </Tab>
                      <Tab className={({ selected }) =>
                        `flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 -mb-px transition-colors ${
                          selected
                            ? 'border-emerald-600 text-emerald-600'
                            : 'border-transparent text-gray-500 hover:text-gray-700'
                        }`
                      }>
                        <TruckIcon className="h-4 w-4" />
                        {t('products.shipping', 'Shipping & Terms')}
                      </Tab>
                    </Tab.List>

                    <Tab.Panels className="p-6 max-h-[60vh] overflow-y-auto">
                      {/* Basic Info Tab */}
                      <Tab.Panel className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                          {/* Name */}
                          <div className="col-span-2">
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                              {t('products.productName', 'Product Name')} *
                            </label>
                            <input
                              type="text"
                              data-field-name="name"
                              value={formData.name}
                              onChange={(e) => handleChange('name', e.target.value)}
                              className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-emerald-500 ${
                                errors.name ? 'border-red-300' : 'border-gray-300'
                              }`}
                              placeholder="e.g., White Sugar ICUMSA 45"
                            />
                            {errors.name && (
                              <p className="mt-1 text-sm text-red-600">{errors.name}</p>
                            )}
                          </div>

                          {/* SKU */}
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                              {t('products.sku', 'SKU / Code')}
                            </label>
                            <input
                              type="text"
                              data-field-name="sku"
                              value={formData.sku}
                              onChange={(e) => handleChange('sku', e.target.value)}
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                              placeholder="e.g., SUG-W-45"
                            />
                          </div>

                          {/* HS Code */}
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                              {t('products.hsCode', 'HS Code')}
                            </label>
                            <input
                              type="text"
                              data-field-name="hs_code"
                              value={formData.hs_code}
                              onChange={(e) => handleChange('hs_code', e.target.value)}
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                              placeholder="e.g., 1701.99"
                            />
                          </div>

                          {/* Category */}
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                              {t('products.category', 'Category')}
                            </label>
                            <select
                              data-field-name="category_type"
                              value={formData.category_type}
                              onChange={(e) => handleChange('category_type', e.target.value)}
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                            >
                              <option value="">{t('products.selectCategory', 'Select category...')}</option>
                              {PRODUCT_CATEGORIES.map((cat) => (
                                <option key={cat.code} value={cat.code}>
                                  {cat.name}
                                </option>
                              ))}
                            </select>
                          </div>

                          {/* Brand */}
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                              {t('products.brand', 'Brand')}
                            </label>
                            <input
                              type="text"
                              data-field-name="brand"
                              value={formData.brand}
                              onChange={(e) => handleChange('brand', e.target.value)}
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                              placeholder="e.g., Premium Grade"
                            />
                          </div>

                          {/* UOM */}
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                              {t('products.uom', 'Unit of Measure')}
                            </label>
                            <select
                              data-field-name="uom"
                              value={formData.uom}
                              onChange={(e) => handleChange('uom', e.target.value)}
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                            >
                              {UNITS_OF_MEASURE.map((unit) => (
                                <option key={unit.value} value={unit.value}>
                                  {unit.label}
                                </option>
                              ))}
                            </select>
                          </div>

                          {/* Pack Type */}
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                              {t('products.packType', 'Pack Type')}
                            </label>
                            <select
                              data-field-name="pack_type"
                              value={formData.pack_type}
                              onChange={(e) => handleChange('pack_type', e.target.value)}
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                            >
                              {PACK_TYPES.map((pt) => (
                                <option key={pt.value} value={pt.value}>
                                  {pt.label}
                                </option>
                              ))}
                            </select>
                          </div>

                          {/* Seasonal */}
                          <div className="col-span-2">
                            <label className="flex items-center gap-2 cursor-pointer">
                              <input
                                type="checkbox"
                                data-field-name="is_seasonal"
                                checked={formData.is_seasonal}
                                onChange={(e) => handleChange('is_seasonal', e.target.checked)}
                                className="w-4 h-4 text-emerald-600 border-gray-300 rounded focus:ring-emerald-500"
                              />
                              <span className="text-sm text-gray-700">
                                {t('products.isSeasonal', 'This product has seasonal availability')}
                              </span>
                            </label>
                          </div>

                          {/* Description */}
                          <div className="col-span-2">
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                              {t('products.description', 'Description')}
                            </label>
                            <textarea
                              data-field-name="description"
                              value={formData.description}
                              onChange={(e) => handleChange('description', e.target.value)}
                              rows={2}
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                              placeholder="Product description..."
                            />
                          </div>

                          {/* Typical Origins */}
                          <div className="col-span-2">
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                              {t('products.typicalOrigins', 'Typical Origins')}
                            </label>
                            <div className="flex flex-wrap gap-2">
                              {COMMON_ORIGINS.map((origin) => (
                                <button
                                  key={origin}
                                  type="button"
                                  onClick={() => handleToggleOrigin(origin)}
                                  className={`px-3 py-1 text-sm rounded-full border transition-colors ${
                                    formData.typical_origins.includes(origin)
                                      ? 'bg-emerald-100 border-emerald-300 text-emerald-700'
                                      : 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100'
                                  }`}
                                >
                                  {formData.typical_origins.includes(origin) && (
                                    <CheckIcon className="h-3 w-3 inline mr-1" />
                                  )}
                                  {origin}
                                </button>
                              ))}
                            </div>
                          </div>

                          {/* Aliases */}
                          <div className="col-span-2">
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                              {t('products.aliases', 'Alternative Names (Arabic, Trade Names)')}
                            </label>
                            <div className="flex gap-2">
                              <input
                                type="text"
                                value={aliasInput}
                                onChange={(e) => setAliasInput(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddAlias())}
                                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                                placeholder="Add alternative name..."
                              />
                              <button
                                type="button"
                                onClick={handleAddAlias}
                                className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
                              >
                                {t('common.add', 'Add')}
                              </button>
                            </div>
                            {formData.aliases.length > 0 && (
                              <div className="flex flex-wrap gap-2 mt-2">
                                {formData.aliases.map((alias) => (
                                  <span
                                    key={alias}
                                    className="inline-flex items-center gap-1 px-2 py-1 bg-gray-100 text-gray-700 text-sm rounded"
                                  >
                                    {alias}
                                    <button
                                      type="button"
                                      onClick={() => handleRemoveAlias(alias)}
                                      className="text-gray-400 hover:text-gray-600"
                                    >
                                      <XMarkIcon className="h-3 w-3" />
                                    </button>
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      </Tab.Panel>

                      {/* Specifications Tab */}
                      <Tab.Panel className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                          {/* Grade */}
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                              {t('products.grade', 'Grade')}
                            </label>
                            <input
                              type="text"
                              value={formData.specs.grade}
                              onChange={(e) => handleSpecChange('grade', e.target.value)}
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                              placeholder="e.g., ICUMSA 45, Grade A"
                            />
                          </div>

                          {/* Moisture */}
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                              {t('products.moisture', 'Moisture %')}
                            </label>
                            <input
                              type="number"
                              step="0.01"
                              value={formData.specs.moisture_pct}
                              onChange={(e) => handleSpecChange('moisture_pct', e.target.value)}
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                              placeholder="e.g., 0.04"
                            />
                          </div>

                          {/* Purity */}
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                              {t('products.purity', 'Purity %')}
                            </label>
                            <input
                              type="number"
                              step="0.01"
                              value={formData.specs.purity_pct}
                              onChange={(e) => handleSpecChange('purity_pct', e.target.value)}
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                              placeholder="e.g., 99.8"
                            />
                          </div>

                          {/* Ash */}
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                              {t('products.ash', 'Ash Content %')}
                            </label>
                            <input
                              type="number"
                              step="0.01"
                              value={formData.specs.ash_pct}
                              onChange={(e) => handleSpecChange('ash_pct', e.target.value)}
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                              placeholder="e.g., 0.02"
                            />
                          </div>

                          {/* Color Value */}
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                              {t('products.colorValue', 'Color Value (ICUMSA)')}
                            </label>
                            <input
                              type="number"
                              step="1"
                              value={formData.specs.color_value}
                              onChange={(e) => handleSpecChange('color_value', e.target.value)}
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                              placeholder="e.g., 45"
                            />
                          </div>

                          {/* Grain Size */}
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                              {t('products.grainSize', 'Grain Size (mm)')}
                            </label>
                            <input
                              type="number"
                              step="0.1"
                              value={formData.specs.grain_size_mm}
                              onChange={(e) => handleSpecChange('grain_size_mm', e.target.value)}
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                              placeholder="e.g., 0.5"
                            />
                          </div>

                          {/* Certifications */}
                          <div className="col-span-2">
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                              {t('products.certifications', 'Certifications')}
                            </label>
                            <div className="flex flex-wrap gap-2">
                              {CERTIFICATIONS.map((cert) => (
                                <button
                                  key={cert}
                                  type="button"
                                  onClick={() => handleToggleCertification(cert)}
                                  className={`px-3 py-1 text-sm rounded-full border transition-colors ${
                                    formData.specs.certifications.includes(cert)
                                      ? 'bg-blue-100 border-blue-300 text-blue-700'
                                      : 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100'
                                  }`}
                                >
                                  {formData.specs.certifications.includes(cert) && (
                                    <CheckIcon className="h-3 w-3 inline mr-1" />
                                  )}
                                  {cert}
                                </button>
                              ))}
                            </div>
                          </div>

                          {/* Custom Specs */}
                          <div className="col-span-2">
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                              {t('products.customSpecs', 'Custom Specifications')}
                            </label>
                            <div className="flex gap-2">
                              <input
                                type="text"
                                value={customSpecKey}
                                onChange={(e) => setCustomSpecKey(e.target.value)}
                                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                                placeholder="Spec name (e.g., SO2_ppm)"
                              />
                              <input
                                type="text"
                                value={customSpecValue}
                                onChange={(e) => setCustomSpecValue(e.target.value)}
                                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                                placeholder="Value (e.g., <20)"
                              />
                              <button
                                type="button"
                                onClick={handleAddCustomSpec}
                                className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
                              >
                                {t('common.add', 'Add')}
                              </button>
                            </div>
                            {Object.keys(formData.specs.custom_specs).length > 0 && (
                              <div className="mt-2 space-y-1">
                                {Object.entries(formData.specs.custom_specs).map(([key, value]) => (
                                  <div
                                    key={key}
                                    className="flex items-center justify-between px-3 py-2 bg-gray-50 rounded"
                                  >
                                    <span className="text-sm">
                                      <span className="font-medium">{key}:</span> {value}
                                    </span>
                                    <button
                                      type="button"
                                      onClick={() => handleRemoveCustomSpec(key)}
                                      className="text-gray-400 hover:text-red-500"
                                    >
                                      <XMarkIcon className="h-4 w-4" />
                                    </button>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      </Tab.Panel>

                      {/* Shipping & Terms Tab */}
                      <Tab.Panel className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                          {/* Temperature Range */}
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                              {t('products.tempMin', 'Min Temperature (°C)')}
                            </label>
                            <input
                              type="number"
                              step="0.1"
                              value={formData.specs.temperature_min_c}
                              onChange={(e) => handleSpecChange('temperature_min_c', e.target.value)}
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                              placeholder="e.g., 15"
                            />
                          </div>

                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                              {t('products.tempMax', 'Max Temperature (°C)')}
                            </label>
                            <input
                              type="number"
                              step="0.1"
                              value={formData.specs.temperature_max_c}
                              onChange={(e) => handleSpecChange('temperature_max_c', e.target.value)}
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                              placeholder="e.g., 25"
                            />
                          </div>

                          {/* Humidity */}
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                              {t('products.humidityMax', 'Max Humidity %')}
                            </label>
                            <input
                              type="number"
                              step="0.1"
                              value={formData.specs.humidity_max_pct}
                              onChange={(e) => handleSpecChange('humidity_max_pct', e.target.value)}
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                              placeholder="e.g., 65"
                            />
                          </div>

                          {/* Shelf Life */}
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                              {t('products.shelfLife', 'Shelf Life (days)')}
                            </label>
                            <input
                              type="number"
                              value={formData.specs.shelf_life_days}
                              onChange={(e) => handleSpecChange('shelf_life_days', e.target.value)}
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                              placeholder="e.g., 730"
                            />
                          </div>

                          {/* Special Handling */}
                          <div className="col-span-2">
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                              {t('products.specialHandling', 'Special Handling Requirements')}
                            </label>
                            <div className="flex flex-wrap gap-2">
                              {SPECIAL_HANDLING_OPTIONS.map((handling) => (
                                <button
                                  key={handling}
                                  type="button"
                                  onClick={() => handleToggleHandling(handling)}
                                  className={`px-3 py-1 text-sm rounded-full border transition-colors ${
                                    formData.specs.special_handling.includes(handling)
                                      ? 'bg-amber-100 border-amber-300 text-amber-700'
                                      : 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100'
                                  }`}
                                >
                                  {formData.specs.special_handling.includes(handling) && (
                                    <CheckIcon className="h-3 w-3 inline mr-1" />
                                  )}
                                  {handling}
                                </button>
                              ))}
                            </div>
                          </div>

                          {/* Packaging Requirements */}
                          <div className="col-span-2">
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                              {t('products.packagingReqs', 'Packaging Requirements')}
                            </label>
                            <textarea
                              value={formData.specs.packaging_requirements}
                              onChange={(e) => handleSpecChange('packaging_requirements', e.target.value)}
                              rows={2}
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                              placeholder="e.g., Food-grade PP bags, double stitched..."
                            />
                          </div>

                          {/* Default Terms */}
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                              {t('products.defaultPaymentTerms', 'Default Payment Terms')}
                            </label>
                            <input
                              type="text"
                              value={formData.specs.default_payment_terms}
                              onChange={(e) => handleSpecChange('default_payment_terms', e.target.value)}
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                              placeholder="e.g., LC at sight, 30% advance"
                            />
                          </div>

                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                              {t('products.defaultIncoterm', 'Default Incoterm')}
                            </label>
                            <select
                              value={formData.specs.default_incoterm}
                              onChange={(e) => handleSpecChange('default_incoterm', e.target.value)}
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                            >
                              <option value="">Select...</option>
                              {INCOTERMS.map((term) => (
                                <option key={term.value} value={term.value}>
                                  {term.label}
                                </option>
                              ))}
                            </select>
                          </div>

                          <div className="col-span-2">
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                              {t('products.defaultInspection', 'Default Inspection Terms')}
                            </label>
                            <input
                              type="text"
                              value={formData.specs.default_inspection}
                              onChange={(e) => handleSpecChange('default_inspection', e.target.value)}
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                              placeholder="e.g., SGS inspection at loading port"
                            />
                          </div>
                        </div>
                      </Tab.Panel>
                    </Tab.Panels>
                  </Tab.Group>

                  {/* Footer */}
                  <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 flex justify-end gap-3">
                    <button
                      type="button"
                      onClick={onClose}
                      className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
                    >
                      {t('common.cancel', 'Cancel')}
                    </button>
                    <button
                      type="submit"
                      disabled={isLoading}
                      className="px-4 py-2 text-sm font-medium text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 disabled:opacity-50 flex items-center gap-2"
                    >
                      {isLoading && (
                        <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                        </svg>
                      )}
                      {isEditing ? t('common.save', 'Save') : t('common.create', 'Create')}
                    </button>
                  </div>
                </form>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition>
  );
}


