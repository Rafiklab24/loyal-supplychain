/**
 * Certificate Generation Component
 * Allows generating certificates from templates for sales shipments
 * Used in the selling workflow when transaction_type = 'outgoing'
 */

import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { 
  DocumentDuplicateIcon, 
  PlusIcon,
  TrashIcon,
  EyeIcon,
  CheckCircleIcon,
  DocumentTextIcon
} from '@heroicons/react/24/outline';
import { 
  getCertificateTemplates, 
  getShipmentCertificates,
  generateCertificate,
  deleteCertificate,
  type CertificateTemplate,
  type SaleCertificate
} from '../../../services/certificates';
import { Spinner } from '../../common/Spinner';
import type { ShipmentFormData } from './types';

interface CertificateGenerationProps {
  formData: ShipmentFormData;
  shipmentId?: string; // Only available after shipment is created
  onChange?: (field: keyof ShipmentFormData, value: any) => void;
}

// Certificate type labels
const CERTIFICATE_TYPE_LABELS: Record<string, { label: string; icon: string }> = {
  quality: { label: 'Quality Certificate', icon: '✅' },
  origin: { label: 'Certificate of Origin', icon: '🌍' },
  health: { label: 'Health Certificate', icon: '🏥' },
  analysis: { label: 'Certificate of Analysis', icon: '🔬' },
  phytosanitary: { label: 'Phytosanitary Certificate', icon: '🌿' },
  weight: { label: 'Weight Certificate', icon: '⚖️' },
  fumigation: { label: 'Fumigation Certificate', icon: '💨' },
  other: { label: 'Other Certificate', icon: '📄' },
};

export function CertificateGeneration({ formData, shipmentId, onChange }: CertificateGenerationProps) {
  const { t } = useTranslation();
  const [templates, setTemplates] = useState<CertificateTemplate[]>([]);
  const [certificates, setCertificates] = useState<SaleCertificate[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<CertificateTemplate | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [previewContent, setPreviewContent] = useState('');
  const [certificateNumber, setCertificateNumber] = useState('');

  // Load templates and existing certificates
  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);
      try {
        const [templatesRes, certsRes] = await Promise.all([
          getCertificateTemplates({ active_only: true }),
          shipmentId ? getShipmentCertificates(shipmentId) : Promise.resolve({ certificates: [] })
        ]);
        setTemplates(templatesRes.templates || []);
        setCertificates(certsRes.certificates || []);
      } catch (error) {
        console.error('Error loading certificate data:', error);
      } finally {
        setIsLoading(false);
      }
    };
    loadData();
  }, [shipmentId]);

  // Generate preview content by replacing placeholders
  const generatePreview = (template: CertificateTemplate) => {
    let content = template.template_content;
    
    // Replace common placeholders with form data
    const replacements: Record<string, string> = {
      '{{certificate_number}}': certificateNumber || '[Certificate Number]',
      '{{issue_date}}': new Date().toLocaleDateString(),
      '{{product_name}}': formData.product_text || formData.lines?.[0]?.type_of_goods || '[Product Name]',
      '{{quantity}}': String(formData.weight_ton || '[Quantity]'),
      '{{unit}}': formData.weight_unit || 'MT',
      '{{country_of_origin}}': formData.lines?.[0]?.country_of_origin || formData.country_of_export || '[Country]',
      '{{exporter_name}}': 'Loyal Supply Chain', // Company name
      '{{buyer_name}}': formData.customer_name || '[Buyer Name]',
      '{{hs_code}}': formData.lines?.[0]?.hs_code || '[HS Code]',
      '{{company_name}}': 'Loyal Supply Chain',
    };
    
    for (const [placeholder, value] of Object.entries(replacements)) {
      content = content.replace(new RegExp(placeholder.replace(/[{}]/g, '\\$&'), 'g'), value);
    }
    
    return content;
  };

  // Handle template selection
  const handleSelectTemplate = (template: CertificateTemplate) => {
    setSelectedTemplate(template);
    setPreviewContent(generatePreview(template));
    setShowPreview(true);
  };

  // Generate certificate
  const handleGenerate = async () => {
    if (!selectedTemplate || !shipmentId) return;
    
    setIsGenerating(true);
    try {
      const variables: Record<string, string | number> = {
        certificate_number: certificateNumber,
        issue_date: new Date().toISOString().split('T')[0],
        product_name: formData.product_text || formData.lines?.[0]?.type_of_goods || '',
        quantity: formData.weight_ton || 0,
        unit: formData.weight_unit || 'MT',
        country_of_origin: formData.lines?.[0]?.country_of_origin || formData.country_of_export || '',
        exporter_name: 'Loyal Supply Chain',
        buyer_name: formData.customer_name || '',
        hs_code: formData.lines?.[0]?.hs_code || '',
        company_name: 'Loyal Supply Chain',
      };
      
      const newCert = await generateCertificate({
        shipment_id: shipmentId,
        template_id: selectedTemplate.id,
        certificate_type: selectedTemplate.certificate_type,
        certificate_number: certificateNumber,
        variables,
        issued_date: new Date().toISOString().split('T')[0],
      });
      
      setCertificates([...certificates, newCert]);
      setSelectedTemplate(null);
      setShowPreview(false);
      setCertificateNumber('');
    } catch (error) {
      console.error('Error generating certificate:', error);
      alert(t('certificates.generateError', 'Failed to generate certificate'));
    } finally {
      setIsGenerating(false);
    }
  };

  // Delete certificate
  const handleDelete = async (certId: string) => {
    if (!confirm(t('certificates.confirmDelete', 'Are you sure you want to delete this certificate?'))) return;
    
    try {
      await deleteCertificate(certId);
      setCertificates(certificates.filter(c => c.id !== certId));
    } catch (error) {
      console.error('Error deleting certificate:', error);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <DocumentDuplicateIcon className="h-5 w-5 text-indigo-600" />
          <h4 className="text-sm font-semibold text-gray-900">
            {t('certificates.title', 'Sales Certificates')}
          </h4>
        </div>
        <span className="text-xs text-gray-500">
          {certificates.length} {t('certificates.generated', 'generated')}
        </span>
      </div>

      {/* Existing Certificates */}
      {certificates.length > 0 && (
        <div className="space-y-2">
          <label className="block text-xs font-medium text-gray-700">
            {t('certificates.existing', 'Generated Certificates')}:
          </label>
          {certificates.map((cert) => {
            const typeInfo = CERTIFICATE_TYPE_LABELS[cert.certificate_type] || CERTIFICATE_TYPE_LABELS.other;
            return (
              <div 
                key={cert.id}
                className="flex items-center justify-between p-3 bg-white border border-gray-200 rounded-lg"
              >
                <div className="flex items-center gap-3">
                  <span className="text-lg">{typeInfo.icon}</span>
                  <div>
                    <div className="text-sm font-medium text-gray-900">
                      {t(`certificates.types.${cert.certificate_type}`, typeInfo.label)}
                    </div>
                    {cert.certificate_number && (
                      <div className="text-xs text-gray-500 font-mono">
                        #{cert.certificate_number}
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                    cert.status === 'final' 
                      ? 'bg-green-100 text-green-700' 
                      : 'bg-amber-100 text-amber-700'
                  }`}>
                    {cert.status}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleDelete(cert.id)}
                    className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                    title={t('common.delete', 'Delete')}
                  >
                    <TrashIcon className="h-4 w-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Template Selection */}
      {!showPreview && shipmentId && (
        <div className="bg-gradient-to-r from-indigo-50 to-purple-50 border border-indigo-200 rounded-lg p-4">
          <label className="block text-sm font-medium text-gray-900 mb-3">
            {t('certificates.selectTemplate', 'Generate New Certificate')}
          </label>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
            {templates.map((template) => {
              const typeInfo = CERTIFICATE_TYPE_LABELS[template.certificate_type] || CERTIFICATE_TYPE_LABELS.other;
              return (
                <button
                  key={template.id}
                  type="button"
                  onClick={() => handleSelectTemplate(template)}
                  className="flex items-center gap-2 p-3 bg-white border border-gray-200 rounded-lg hover:border-indigo-400 hover:bg-indigo-50 transition-colors text-left"
                >
                  <span className="text-lg">{typeInfo.icon}</span>
                  <span className="text-sm font-medium text-gray-900">
                    {template.name}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Preview Modal */}
      {showPreview && selectedTemplate && (
        <div className="bg-white border border-indigo-300 rounded-lg p-4 shadow-lg">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <EyeIcon className="h-5 w-5 text-indigo-600" />
              <h5 className="text-sm font-semibold text-gray-900">
                {t('certificates.preview', 'Certificate Preview')}: {selectedTemplate.name}
              </h5>
            </div>
            <button
              type="button"
              onClick={() => {
                setShowPreview(false);
                setSelectedTemplate(null);
              }}
              className="text-gray-400 hover:text-gray-600"
            >
              ✕
            </button>
          </div>

          {/* Certificate Number Input */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t('certificates.number', 'Certificate Number')}
            </label>
            <input
              type="text"
              value={certificateNumber}
              onChange={(e) => {
                setCertificateNumber(e.target.value);
                setPreviewContent(generatePreview(selectedTemplate));
              }}
              placeholder={t('certificates.numberPlaceholder', 'e.g., QC-2026-001')}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 font-mono"
            />
          </div>

          {/* Preview Content */}
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-4 max-h-64 overflow-y-auto">
            <pre className="text-sm text-gray-700 whitespace-pre-wrap font-mono">
              {previewContent}
            </pre>
          </div>

          {/* Actions */}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleGenerate}
              disabled={isGenerating}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isGenerating ? (
                <Spinner size="sm" />
              ) : (
                <CheckCircleIcon className="h-4 w-4" />
              )}
              {t('certificates.generate', 'Generate Certificate')}
            </button>
            <button
              type="button"
              onClick={() => {
                setShowPreview(false);
                setSelectedTemplate(null);
              }}
              className="px-4 py-2 text-sm font-medium text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
            >
              {t('common.cancel', 'Cancel')}
            </button>
          </div>
        </div>
      )}

      {/* Note for unsaved shipments */}
      {!shipmentId && (
        <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
          <div className="flex items-center gap-2">
            <DocumentTextIcon className="h-5 w-5 text-amber-600" />
            <p className="text-sm text-amber-800">
              {t('certificates.saveFirst', 'Save the shipment first to generate certificates.')}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

