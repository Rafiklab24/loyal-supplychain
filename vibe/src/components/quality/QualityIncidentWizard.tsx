/**
 * Quality Incident Wizard (Simplified)
 * 
 * Steps:
 * 1. Problem Type Selection (multi-select: Mold, Broken, Moisture, etc.)
 * 2. Photo Capture - 3 locations (F, M, B) with 3 photos each
 * 3. Container Condition (Yes/No toggles)
 * 4. Summary & Submit
 */

import { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useSearchParams, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  XMarkIcon,
  ArrowLeftIcon,
  ArrowRightIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  CameraIcon,
  PhotoIcon,
  TrashIcon,
} from '@heroicons/react/24/outline';
import { Card } from '../common/Card';
import { Spinner } from '../common/Spinner';
import { Badge } from '../common/Badge';
import {
  createQualityIncident,
  updateQualityIncident,
  submitIncident,
  getQualityIncident,
  uploadMedia,
  ISSUE_TYPES,
} from '../../services/qualityIncidents';
import type { QualityIncident, IssueType } from '../../services/qualityIncidents';
import { getInventoryShipment, markShipmentDelivered } from '../../services/inventory';
import { ProblemTypeSelector } from './ProblemTypeSelector';

// ============================================================
// TYPES
// ============================================================

type WizardStep = 'problem-type' | 'photo-capture' | 'measurements' | 'container' | 'summary';
type LocationGroup = 'F' | 'M' | 'B';

interface LocationPhotos {
  F: string[]; // URLs of photos from Front
  M: string[]; // URLs of photos from Middle
  B: string[]; // URLs of photos from Back
}

interface DefectMeasurements {
  sample_weight_g: number;    // Default 1000g
  broken_g: number;
  mold_g: number;
  foreign_g: number;
  other_g: number;
  moisture_pct: number;       // Moisture percentage from meter
}

const LOCATION_LABELS = {
  F: { en: 'Front', ar: 'الأمام' },
  M: { en: 'Middle', ar: 'الوسط' },
  B: { en: 'Back', ar: 'الخلف' },
};

// ============================================================
// PHOTO CAPTURE COMPONENT
// ============================================================

interface PhotoCaptureProps {
  location: LocationGroup;
  photos: string[];
  onAddPhoto: (location: LocationGroup, file: File) => void;
  onRemovePhoto: (location: LocationGroup, index: number) => void;
  isRtl: boolean;
  isUploading: boolean;
}

function PhotoCapture({ location, photos, onAddPhoto, onRemovePhoto, isRtl, isUploading }: PhotoCaptureProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onAddPhoto(location, file);
      e.target.value = ''; // Reset for next selection
    }
  };
  
  const label = isRtl ? LOCATION_LABELS[location].ar : LOCATION_LABELS[location].en;
  const photosNeeded = 3;
  const photosCount = photos.length;
  const isComplete = photosCount >= photosNeeded;
  
  return (
    <div className={`p-4 rounded-2xl border-2 transition-all ${
      isComplete 
        ? 'bg-green-50 dark:bg-green-900/20 border-green-500' 
        : 'bg-gray-50 dark:bg-gray-800 border-gray-300 dark:border-gray-600'
    }`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-3xl font-bold text-gray-900 dark:text-white">{location}</span>
          <span className="text-lg text-gray-600 dark:text-gray-400">({label})</span>
        </div>
        <div className={`px-3 py-1 rounded-full text-sm font-medium ${
          isComplete 
            ? 'bg-green-500 text-white' 
            : 'bg-gray-300 dark:bg-gray-600 text-gray-700 dark:text-gray-300'
        }`}>
          {photosCount}/{photosNeeded}
        </div>
      </div>
      
      {/* Photo Grid */}
      <div className="grid grid-cols-3 gap-2 mb-3">
        {[0, 1, 2].map((index) => {
          const photo = photos[index];
          return (
            <div 
              key={index}
              className="aspect-square rounded-xl overflow-hidden bg-gray-200 dark:bg-gray-700 relative"
            >
              {photo ? (
                <>
                  <img src={photo} alt={`${location}-${index + 1}`} className="w-full h-full object-cover" />
                  <button
                    onClick={() => onRemovePhoto(location, index)}
                    className="absolute top-1 right-1 p-1 bg-red-500 text-white rounded-full hover:bg-red-600"
                  >
                    <TrashIcon className="h-4 w-4" />
                  </button>
                </>
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <PhotoIcon className="h-8 w-8 text-gray-400" />
                </div>
              )}
            </div>
          );
        })}
      </div>
      
      {/* Add Photo Button */}
      {!isComplete && (
        <>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            onChange={handleFileSelect}
            className="hidden"
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
            className="w-full py-3 bg-blue-600 text-white font-medium rounded-xl hover:bg-blue-700 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {isUploading ? (
              <Spinner />
            ) : (
              <>
                <CameraIcon className="h-5 w-5" />
                {isRtl ? `التقاط صورة ${photosCount + 1}` : `Capture Photo ${photosCount + 1}`}
              </>
            )}
          </button>
        </>
      )}
      
      {isComplete && (
        <div className="text-center text-green-600 dark:text-green-400 font-medium flex items-center justify-center gap-2">
          <CheckCircleIcon className="h-5 w-5" />
          {isRtl ? 'مكتمل' : 'Complete'}
        </div>
      )}
    </div>
  );
}

// ============================================================
// MAIN WIZARD COMPONENT
// ============================================================

interface QualityIncidentWizardProps {
  incidentId?: string;
  onClose?: () => void;
}

export function QualityIncidentWizard({ incidentId: propIncidentId, onClose }: QualityIncidentWizardProps) {
  const { i18n } = useTranslation();
  const isRtl = i18n.language === 'ar';
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();
  const { id: routeIncidentId } = useParams<{ id: string }>();
  
  const incidentId = propIncidentId || routeIncidentId;
  const shipmentId = searchParams.get('shipment_id');
  
  // State
  const [currentStep, setCurrentStep] = useState<WizardStep>('problem-type');
  const [selectedIssueTypes, setSelectedIssueTypes] = useState<IssueType[]>([]);
  const [locationPhotos, setLocationPhotos] = useState<LocationPhotos>({ F: [], M: [], B: [] });
  const [measurements, setMeasurements] = useState<DefectMeasurements>({
    sample_weight_g: 1000,
    broken_g: 0,
    mold_g: 0,
    foreign_g: 0,
    other_g: 0,
    moisture_pct: 0,
  });
  const [containerCondition, setContainerCondition] = useState({
    moisture_seen: false,
    bad_smell: false,
    torn_bags: false,
    torn_bags_count: 0,
    condensation: false,
  });
  const [incident, setIncident] = useState<QualityIncident | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  
  // Fetch existing incident if editing
  const { data: existingIncident, isLoading: isLoadingIncident } = useQuery({
    queryKey: ['quality-incident', incidentId],
    queryFn: () => getQualityIncident(incidentId!),
    enabled: !!incidentId,
  });
  
  // Fetch shipment details if creating new
  const { data: shipmentData } = useQuery({
    queryKey: ['inventory-shipment', shipmentId],
    queryFn: () => getInventoryShipment(shipmentId!),
    enabled: !!shipmentId && !incidentId,
  });
  
  // Initialize from existing incident
  useEffect(() => {
    if (existingIncident?.incident) {
      const inc = existingIncident.incident;
      setIncident(inc);
      
      // Parse stored issue types (could be comma-separated or single)
      if (inc.issue_type) {
        const types = inc.issue_type.split(',').filter(Boolean) as IssueType[];
        setSelectedIssueTypes(types);
      }
      
      // Load container condition
      setContainerCondition({
        moisture_seen: inc.container_moisture_seen || false,
        bad_smell: inc.container_bad_smell || false,
        torn_bags: inc.container_torn_bags || false,
        torn_bags_count: inc.container_torn_bags_count || 0,
        condensation: inc.container_condensation || false,
      });
      
      // Load existing photos grouped by location
      // Photos are stored with sample_id like 'F', 'M', 'B'
      const existingPhotos: LocationPhotos = { F: [], M: [], B: [] };
      if (inc.sample_cards) {
        inc.sample_cards.forEach((card: any) => {
          if (card.sample_id === 'F' || card.sample_id === 'M' || card.sample_id === 'B') {
            existingPhotos[card.sample_id as LocationGroup] = card.media_urls || [];
          }
        });
      }
      setLocationPhotos(existingPhotos);
      
      // Determine which step to show
      if (inc.issue_type && selectedIssueTypes.length === 0) {
        // Has issue type but just loaded
      } else if (Object.values(existingPhotos).some(p => p.length > 0)) {
        setCurrentStep('photo-capture');
      }
    }
  }, [existingIncident]);
  
  // Mutations
  const createMutation = useMutation({
    mutationFn: createQualityIncident,
    onSuccess: (result) => {
      setIncident(result.incident);
    },
  });
  
  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => updateQualityIncident(id, data),
    onSuccess: (result) => {
      setIncident(result.incident);
    },
  });
  
  const uploadMutation = useMutation({
    mutationFn: ({ incidentId, file, location }: { incidentId: string; file: File; location: string }) => 
      uploadMedia(incidentId, file, 'photo', 'defects_separated', location),
  });
  
  const submitMutation = useMutation({
    mutationFn: async (id: string) => {
      const result = await submitIncident(id);
      if (incident?.shipment_id) {
        await markShipmentDelivered(incident.shipment_id, true);
      }
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['quality-incidents'] });
      queryClient.invalidateQueries({ queryKey: ['inventory-shipments'] });
      navigate('/inventory');
    },
  });
  
  // Handlers
  const handleToggleIssueType = (type: IssueType) => {
    setSelectedIssueTypes(prev => 
      prev.includes(type) 
        ? prev.filter(t => t !== type)
        : [...prev, type]
    );
  };
  
  const handleProblemTypeContinue = async () => {
    if (selectedIssueTypes.length === 0) return;
    
    const issueTypeString = selectedIssueTypes.join(',');
    
    if (!incident && shipmentId) {
      // Create new incident
      await createMutation.mutateAsync({
        shipment_id: shipmentId,
        issue_type: issueTypeString as IssueType,
      });
    } else if (incident) {
      // Update existing
      await updateMutation.mutateAsync({
        id: incident.id,
        data: { issue_type: issueTypeString }
      });
    }
    
    setCurrentStep('photo-capture');
  };
  
  const handleAddPhoto = async (location: LocationGroup, file: File) => {
    if (!incident) return;
    
    setIsUploading(true);
    try {
      const result = await uploadMutation.mutateAsync({
        incidentId: incident.id,
        file,
        location,
      });
      
      // Add photo URL to state
      setLocationPhotos(prev => ({
        ...prev,
        [location]: [...prev[location], result.media.file_url]
      }));
    } catch (error) {
      console.error('Failed to upload photo:', error);
    } finally {
      setIsUploading(false);
    }
  };
  
  const handleRemovePhoto = (location: LocationGroup, index: number) => {
    setLocationPhotos(prev => ({
      ...prev,
      [location]: prev[location].filter((_, i) => i !== index)
    }));
    // TODO: Also delete from server
  };
  
  const handlePhotoContinue = async () => {
    // Just move to measurements step (photos are already uploaded)
    setCurrentStep('measurements');
  };
  
  const handleMeasurementsContinue = async () => {
    if (!incident) return;
    
    // Calculate defect percentages
    const totalDefects = measurements.broken_g + measurements.mold_g + measurements.foreign_g + measurements.other_g;
    const defectPct = measurements.sample_weight_g > 0 
      ? (totalDefects / measurements.sample_weight_g) * 100 
      : 0;
    
    // Update incident with measurements
    await updateMutation.mutateAsync({
      id: incident.id,
      data: {
        sample_weight_g: measurements.sample_weight_g,
        broken_g: measurements.broken_g,
        mold_g: measurements.mold_g,
        foreign_g: measurements.foreign_g,
        other_g: measurements.other_g,
        moisture_pct: measurements.moisture_pct,
        total_defect_pct: defectPct,
      }
    });
    
    setCurrentStep('container');
  };
  
  const handleContainerContinue = async () => {
    if (!incident) return;
    
    await updateMutation.mutateAsync({
      id: incident.id,
      data: {
        container_moisture_seen: containerCondition.moisture_seen,
        container_bad_smell: containerCondition.bad_smell,
        container_torn_bags: containerCondition.torn_bags,
        container_torn_bags_count: containerCondition.torn_bags_count,
        container_condensation: containerCondition.condensation,
      }
    });
    
    setCurrentStep('summary');
  };
  
  const handleSubmit = async () => {
    if (!incident) return;
    await submitMutation.mutateAsync(incident.id);
  };
  
  const goBack = () => {
    switch (currentStep) {
      case 'photo-capture':
        setCurrentStep('problem-type');
        break;
      case 'measurements':
        setCurrentStep('photo-capture');
        break;
      case 'container':
        setCurrentStep('measurements');
        break;
      case 'summary':
        setCurrentStep('container');
        break;
      default:
        if (onClose) onClose();
        else navigate(-1);
    }
  };
  
  // Calculate progress
  const totalPhotos = locationPhotos.F.length + locationPhotos.M.length + locationPhotos.B.length;
  const requiredPhotos = 9; // 3 per location
  const allPhotosComplete = totalPhotos >= requiredPhotos;
  const anyPhotos = totalPhotos > 0;
  
  // Loading state
  if (isLoadingIncident) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100 dark:bg-gray-900">
        <Spinner />
      </div>
    );
  }
  
  // ============================================================
  // RENDER STEPS
  // ============================================================
  
  const renderStep = () => {
    switch (currentStep) {
      case 'problem-type':
        return (
          <ProblemTypeSelector
            selectedTypes={selectedIssueTypes}
            onToggleType={handleToggleIssueType}
            onContinue={handleProblemTypeContinue}
            isLoading={createMutation.isPending || updateMutation.isPending}
            isRtl={isRtl}
          />
        );
        
      case 'photo-capture':
        return (
          <div className="p-4 space-y-4">
            <div className="text-center mb-4">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
                {isRtl ? 'التقاط صور العيوب' : 'Capture Defect Photos'}
              </h2>
              <p className="text-gray-500 dark:text-gray-400 text-sm">
                {isRtl 
                  ? 'التقط 3 صور لكل موقع (أمام، وسط، خلف)' 
                  : 'Take 3 photos from each location (Front, Middle, Back)'}
              </p>
            </div>
            
            {/* Progress */}
            <div className="bg-gray-200 dark:bg-gray-700 rounded-full h-2 mb-4">
              <div 
                className="bg-emerald-500 h-2 rounded-full transition-all"
                style={{ width: `${Math.min((totalPhotos / requiredPhotos) * 100, 100)}%` }}
              />
            </div>
            <p className="text-center text-sm text-gray-500 dark:text-gray-400 mb-4">
              {totalPhotos}/{requiredPhotos} {isRtl ? 'صور' : 'photos'}
            </p>
            
            {/* Location Photo Captures */}
            {(['F', 'M', 'B'] as LocationGroup[]).map(location => (
              <PhotoCapture
                key={location}
                location={location}
                photos={locationPhotos[location]}
                onAddPhoto={handleAddPhoto}
                onRemovePhoto={handleRemovePhoto}
                isRtl={isRtl}
                isUploading={isUploading}
              />
            ))}
            
            {/* Continue Button */}
            <button
              onClick={handlePhotoContinue}
              disabled={!anyPhotos}
              className="w-full py-4 bg-blue-600 text-white font-bold rounded-xl disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isRtl ? 'التالي: القياسات' : 'Next: Measurements'}
            </button>
            
            {!allPhotosComplete && anyPhotos && (
              <p className="text-center text-amber-600 dark:text-amber-400 text-sm">
                {isRtl ? 'يمكنك المتابعة لكن يفضل إكمال جميع الصور' : 'You can continue but completing all photos is recommended'}
              </p>
            )}
          </div>
        );
        
      case 'measurements':
        const totalDefects = measurements.broken_g + measurements.mold_g + measurements.foreign_g + measurements.other_g;
        const defectPct = measurements.sample_weight_g > 0 
          ? ((totalDefects / measurements.sample_weight_g) * 100).toFixed(1) 
          : '0.0';
        const isValidTotal = totalDefects <= measurements.sample_weight_g;
        
        return (
          <div className="p-4">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2 text-center">
              {isRtl ? 'قياس العيوب' : 'Defect Measurements'}
            </h2>
            <p className="text-gray-500 dark:text-gray-400 text-center text-sm mb-4">
              {isRtl ? 'وزن العيوب بالجرام من عينة 1 كجم' : 'Weigh defects in grams from a 1kg sample'}
            </p>
            
            {/* Sample Weight */}
            <Card className="p-4 mb-4">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                ⚖️ {isRtl ? 'وزن العينة (جرام)' : 'Sample Weight (g)'}
              </label>
              <input
                type="number"
                inputMode="numeric"
                value={measurements.sample_weight_g}
                onChange={(e) => setMeasurements(prev => ({ ...prev, sample_weight_g: parseInt(e.target.value) || 0 }))}
                className="w-full p-4 text-2xl text-center font-bold border-2 border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
              />
            </Card>
            
            {/* Defect Inputs */}
            <div className="space-y-3 mb-4">
              {/* Broken */}
              <div className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-800 rounded-xl">
                <span className="text-2xl">💔</span>
                <div className="flex-1">
                  <label className="block text-sm text-gray-600 dark:text-gray-400">
                    {isRtl ? 'كسر (جرام)' : 'Broken (g)'}
                  </label>
                  <input
                    type="number"
                    inputMode="numeric"
                    value={measurements.broken_g || ''}
                    onChange={(e) => setMeasurements(prev => ({ ...prev, broken_g: parseInt(e.target.value) || 0 }))}
                    placeholder="0"
                    className="w-full p-2 text-xl font-bold border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                </div>
              </div>
              
              {/* Mold */}
              <div className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-800 rounded-xl">
                <span className="text-2xl">🦠</span>
                <div className="flex-1">
                  <label className="block text-sm text-gray-600 dark:text-gray-400">
                    {isRtl ? 'عفن (جرام)' : 'Mold (g)'}
                  </label>
                  <input
                    type="number"
                    inputMode="numeric"
                    value={measurements.mold_g || ''}
                    onChange={(e) => setMeasurements(prev => ({ ...prev, mold_g: parseInt(e.target.value) || 0 }))}
                    placeholder="0"
                    className="w-full p-2 text-xl font-bold border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                </div>
              </div>
              
              {/* Foreign Matter */}
              <div className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-800 rounded-xl">
                <span className="text-2xl">🪨</span>
                <div className="flex-1">
                  <label className="block text-sm text-gray-600 dark:text-gray-400">
                    {isRtl ? 'شوائب (جرام)' : 'Foreign (g)'}
                  </label>
                  <input
                    type="number"
                    inputMode="numeric"
                    value={measurements.foreign_g || ''}
                    onChange={(e) => setMeasurements(prev => ({ ...prev, foreign_g: parseInt(e.target.value) || 0 }))}
                    placeholder="0"
                    className="w-full p-2 text-xl font-bold border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                </div>
              </div>
              
              {/* Other */}
              <div className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-800 rounded-xl">
                <span className="text-2xl">❓</span>
                <div className="flex-1">
                  <label className="block text-sm text-gray-600 dark:text-gray-400">
                    {isRtl ? 'أخرى (جرام)' : 'Other (g)'}
                  </label>
                  <input
                    type="number"
                    inputMode="numeric"
                    value={measurements.other_g || ''}
                    onChange={(e) => setMeasurements(prev => ({ ...prev, other_g: parseInt(e.target.value) || 0 }))}
                    placeholder="0"
                    className="w-full p-2 text-xl font-bold border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                </div>
              </div>
            </div>
            
            {/* Defect Percentage Display */}
            <Card className={`p-4 mb-4 text-center ${!isValidTotal ? 'border-2 border-red-500' : ''}`}>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">
                {isRtl ? 'نسبة العيوب الإجمالية' : 'Total Defect Percentage'}
              </p>
              <p className={`text-4xl font-bold ${
                parseFloat(defectPct) > 5 ? 'text-red-600' : 
                parseFloat(defectPct) > 2 ? 'text-amber-600' : 'text-green-600'
              }`}>
                {defectPct}%
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                {totalDefects}g / {measurements.sample_weight_g}g
              </p>
              {!isValidTotal && (
                <p className="text-red-600 text-sm mt-2">
                  {isRtl ? 'إجمالي العيوب أكبر من وزن العينة!' : 'Total defects exceed sample weight!'}
                </p>
              )}
            </Card>
            
            {/* Moisture Percentage (from meter) */}
            <Card className="p-4 mb-4">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                💧 {isRtl ? 'نسبة الرطوبة (من الجهاز)' : 'Moisture % (from meter)'}
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  inputMode="decimal"
                  step="0.1"
                  value={measurements.moisture_pct || ''}
                  onChange={(e) => setMeasurements(prev => ({ ...prev, moisture_pct: parseFloat(e.target.value) || 0 }))}
                  placeholder="0.0"
                  className="flex-1 p-4 text-2xl text-center font-bold border-2 border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                />
                <span className="text-2xl font-bold text-gray-500">%</span>
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-2 text-center">
                {isRtl ? 'أدخل القراءة من جهاز قياس الرطوبة' : 'Enter reading from moisture meter'}
              </p>
            </Card>
            
            {/* Continue Button */}
            <button
              onClick={handleMeasurementsContinue}
              disabled={!isValidTotal || updateMutation.isPending}
              className="w-full py-4 bg-blue-600 text-white font-bold rounded-xl disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {updateMutation.isPending ? <Spinner /> : (isRtl ? 'التالي: حالة الحاوية' : 'Next: Container Condition')}
            </button>
          </div>
        );
        
      case 'container':
        return (
          <div className="p-4">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4 text-center">
              {isRtl ? 'حالة الحاوية' : 'Container Condition'}
            </h2>
            
            <div className="space-y-3">
              {/* Moisture Toggle */}
              <button
                onClick={() => setContainerCondition(prev => ({ ...prev, moisture_seen: !prev.moisture_seen }))}
                className={`w-full p-4 rounded-xl border-2 flex items-center justify-between transition-all ${
                  containerCondition.moisture_seen
                    ? 'bg-red-50 dark:bg-red-900/30 border-red-500'
                    : 'bg-gray-50 dark:bg-gray-800 border-gray-300 dark:border-gray-600'
                }`}
              >
                <span className="text-lg">💧 {isRtl ? 'رطوبة مرئية' : 'Moisture Seen'}</span>
                <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                  containerCondition.moisture_seen ? 'bg-red-500 text-white' : 'bg-gray-300 text-gray-700'
                }`}>
                  {containerCondition.moisture_seen ? (isRtl ? 'نعم' : 'Yes') : (isRtl ? 'لا' : 'No')}
                </span>
              </button>
              
              {/* Bad Smell Toggle */}
              <button
                onClick={() => setContainerCondition(prev => ({ ...prev, bad_smell: !prev.bad_smell }))}
                className={`w-full p-4 rounded-xl border-2 flex items-center justify-between transition-all ${
                  containerCondition.bad_smell
                    ? 'bg-red-50 dark:bg-red-900/30 border-red-500'
                    : 'bg-gray-50 dark:bg-gray-800 border-gray-300 dark:border-gray-600'
                }`}
              >
                <span className="text-lg">👃 {isRtl ? 'رائحة كريهة' : 'Bad Smell'}</span>
                <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                  containerCondition.bad_smell ? 'bg-red-500 text-white' : 'bg-gray-300 text-gray-700'
                }`}>
                  {containerCondition.bad_smell ? (isRtl ? 'نعم' : 'Yes') : (isRtl ? 'لا' : 'No')}
                </span>
              </button>
              
              {/* Torn Bags Toggle */}
              <button
                onClick={() => setContainerCondition(prev => ({ ...prev, torn_bags: !prev.torn_bags }))}
                className={`w-full p-4 rounded-xl border-2 flex items-center justify-between transition-all ${
                  containerCondition.torn_bags
                    ? 'bg-red-50 dark:bg-red-900/30 border-red-500'
                    : 'bg-gray-50 dark:bg-gray-800 border-gray-300 dark:border-gray-600'
                }`}
              >
                <span className="text-lg">📦 {isRtl ? 'أكياس ممزقة' : 'Torn Bags'}</span>
                <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                  containerCondition.torn_bags ? 'bg-red-500 text-white' : 'bg-gray-300 text-gray-700'
                }`}>
                  {containerCondition.torn_bags ? (isRtl ? 'نعم' : 'Yes') : (isRtl ? 'لا' : 'No')}
                </span>
              </button>
              
              {/* Torn Bags Count */}
              {containerCondition.torn_bags && (
                <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-xl">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    {isRtl ? 'عدد الأكياس الممزقة' : 'Number of torn bags'}
                  </label>
                  <input
                    type="range"
                    min="1"
                    max="100"
                    value={containerCondition.torn_bags_count}
                    onChange={(e) => setContainerCondition(prev => ({ ...prev, torn_bags_count: parseInt(e.target.value) }))}
                    className="w-full"
                  />
                  <p className="text-center text-2xl font-bold text-gray-900 dark:text-white mt-2">
                    {containerCondition.torn_bags_count}
                  </p>
                </div>
              )}
              
              {/* Condensation Toggle */}
              <button
                onClick={() => setContainerCondition(prev => ({ ...prev, condensation: !prev.condensation }))}
                className={`w-full p-4 rounded-xl border-2 flex items-center justify-between transition-all ${
                  containerCondition.condensation
                    ? 'bg-red-50 dark:bg-red-900/30 border-red-500'
                    : 'bg-gray-50 dark:bg-gray-800 border-gray-300 dark:border-gray-600'
                }`}
              >
                <span className="text-lg">💦 {isRtl ? 'تكثف' : 'Condensation'}</span>
                <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                  containerCondition.condensation ? 'bg-red-500 text-white' : 'bg-gray-300 text-gray-700'
                }`}>
                  {containerCondition.condensation ? (isRtl ? 'نعم' : 'Yes') : (isRtl ? 'لا' : 'No')}
                </span>
              </button>
            </div>
            
            {/* Continue Button */}
            <button
              onClick={handleContainerContinue}
              disabled={updateMutation.isPending}
              className="w-full mt-6 py-4 bg-blue-600 text-white font-bold rounded-xl disabled:opacity-50"
            >
              {updateMutation.isPending ? <Spinner /> : (isRtl ? 'التالي: الملخص' : 'Next: Summary')}
            </button>
          </div>
        );
        
      case 'summary':
        return (
          <div className="p-4">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4 text-center">
              {isRtl ? 'ملخص التقرير' : 'Report Summary'}
            </h2>
            
            {/* HOLD Banner */}
            <div className="bg-red-600 text-white p-4 rounded-xl mb-4 text-center">
              <ExclamationTriangleIcon className="h-8 w-8 mx-auto mb-2" />
              <p className="font-bold text-lg">{isRtl ? 'الشحنة محتجزة' : 'SHIPMENT ON HOLD'}</p>
              <p className="text-sm text-red-100">{isRtl ? 'لا تبيع - لا تعيد التغليف' : 'Do not sell - Do not repack'}</p>
            </div>
            
            {/* Issue Types */}
            <Card className="p-4 mb-4">
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">
                {isRtl ? 'نوع المشكلة' : 'Issue Type(s)'}
              </p>
              <div className="flex flex-wrap gap-2">
                {selectedIssueTypes.map(type => (
                  <Badge key={type} color="amber">
                    {ISSUE_TYPES[type]?.icon} {isRtl ? ISSUE_TYPES[type]?.labelAr : ISSUE_TYPES[type]?.label}
                  </Badge>
                ))}
              </div>
            </Card>
            
            {/* Measurements Summary */}
            <Card className="p-4 mb-4">
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">
                {isRtl ? 'القياسات' : 'Measurements'}
              </p>
              <div className="grid grid-cols-2 gap-4">
                <div className="text-center p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                  <p className="text-3xl font-bold text-amber-600">
                    {measurements.sample_weight_g > 0 
                      ? ((measurements.broken_g + measurements.mold_g + measurements.foreign_g + measurements.other_g) / measurements.sample_weight_g * 100).toFixed(1)
                      : '0'}%
                  </p>
                  <p className="text-xs text-gray-500">{isRtl ? 'نسبة العيوب' : 'Defect %'}</p>
                </div>
                <div className="text-center p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                  <p className="text-3xl font-bold text-blue-600">{measurements.moisture_pct}%</p>
                  <p className="text-xs text-gray-500">{isRtl ? 'رطوبة' : 'Moisture'}</p>
                </div>
              </div>
              <div className="mt-3 grid grid-cols-4 gap-2 text-xs">
                <div className="text-center">
                  <p className="font-medium text-gray-900 dark:text-white">{measurements.broken_g}g</p>
                  <p className="text-gray-500">{isRtl ? 'كسر' : 'Broken'}</p>
                </div>
                <div className="text-center">
                  <p className="font-medium text-gray-900 dark:text-white">{measurements.mold_g}g</p>
                  <p className="text-gray-500">{isRtl ? 'عفن' : 'Mold'}</p>
                </div>
                <div className="text-center">
                  <p className="font-medium text-gray-900 dark:text-white">{measurements.foreign_g}g</p>
                  <p className="text-gray-500">{isRtl ? 'شوائب' : 'Foreign'}</p>
                </div>
                <div className="text-center">
                  <p className="font-medium text-gray-900 dark:text-white">{measurements.other_g}g</p>
                  <p className="text-gray-500">{isRtl ? 'أخرى' : 'Other'}</p>
                </div>
              </div>
            </Card>
            
            {/* Photos Summary */}
            <Card className="p-4 mb-4">
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">
                {isRtl ? 'الصور الملتقطة' : 'Photos Captured'}
              </p>
              <div className="grid grid-cols-3 gap-2">
                <div className="text-center">
                  <p className="text-2xl font-bold text-gray-900 dark:text-white">{locationPhotos.F.length}</p>
                  <p className="text-xs text-gray-500">{isRtl ? 'أمام' : 'Front'}</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-gray-900 dark:text-white">{locationPhotos.M.length}</p>
                  <p className="text-xs text-gray-500">{isRtl ? 'وسط' : 'Middle'}</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-gray-900 dark:text-white">{locationPhotos.B.length}</p>
                  <p className="text-xs text-gray-500">{isRtl ? 'خلف' : 'Back'}</p>
                </div>
              </div>
              <p className="text-center text-sm text-gray-600 dark:text-gray-400 mt-2">
                {isRtl ? `المجموع: ${totalPhotos} صور` : `Total: ${totalPhotos} photos`}
              </p>
            </Card>
            
            {/* Container Issues */}
            {(containerCondition.moisture_seen || containerCondition.bad_smell || 
              containerCondition.torn_bags || containerCondition.condensation) && (
              <Card className="p-4 mb-4">
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">
                  {isRtl ? 'مشاكل الحاوية' : 'Container Issues'}
                </p>
                <div className="flex flex-wrap gap-2">
                  {containerCondition.moisture_seen && <Badge color="red">{isRtl ? 'رطوبة' : 'Moisture'}</Badge>}
                  {containerCondition.bad_smell && <Badge color="red">{isRtl ? 'رائحة' : 'Smell'}</Badge>}
                  {containerCondition.torn_bags && <Badge color="red">{containerCondition.torn_bags_count} {isRtl ? 'ممزق' : 'torn'}</Badge>}
                  {containerCondition.condensation && <Badge color="red">{isRtl ? 'تكثف' : 'Condensation'}</Badge>}
                </div>
              </Card>
            )}
            
            {/* Submit Button */}
            <button
              onClick={handleSubmit}
              disabled={submitMutation.isPending || totalPhotos === 0}
              className="w-full py-4 bg-emerald-600 text-white font-bold rounded-xl disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {submitMutation.isPending ? (
                <Spinner />
              ) : (
                <>
                  <CheckCircleIcon className="h-6 w-6" />
                  {isRtl ? 'إرسال التقرير' : 'Submit Report'}
                </>
              )}
            </button>
            
            <p className="text-center text-sm text-gray-500 dark:text-gray-400 mt-3">
              {isRtl ? 'سيتم إخطار المشرف ومكتب الإدارة' : 'Supervisor and HQ will be notified'}
            </p>
          </div>
        );
        
      default:
        return null;
    }
  };
  
  // ============================================================
  // SUBMITTED REPORT VIEW (Read-only)
  // ============================================================
  
  const renderSubmittedReport = () => {
    if (!incident) return null;
    
    const issueTypes = incident.issue_type?.split(',').filter(Boolean) || [];
    const mediaPhotos = incident.media || [];
    
    return (
      <div className="p-4 space-y-4">
        {/* Status Banner */}
        <div className={`p-4 rounded-xl text-center ${
          incident.status === 'submitted' ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200' :
          incident.status === 'under_review' ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-200' :
          incident.status === 'action_set' ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-200' :
          incident.status === 'closed' ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200' :
          'bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200'
        }`}>
          <p className="font-bold text-lg">
            {incident.status === 'submitted' ? (isRtl ? 'تم تقديم التقرير' : 'Report Submitted') :
             incident.status === 'under_review' ? (isRtl ? 'قيد المراجعة' : 'Under Review') :
             incident.status === 'action_set' ? (isRtl ? 'تم اتخاذ إجراء' : 'Action Taken') :
             incident.status === 'closed' ? (isRtl ? 'مغلق' : 'Closed') :
             (isRtl ? 'مسودة' : 'Draft')}
          </p>
          <p className="text-sm opacity-75">
            {isRtl ? `تم التقديم: ${new Date(incident.submitted_at || incident.created_at).toLocaleDateString('ar-SA')}` 
                   : `Submitted: ${new Date(incident.submitted_at || incident.created_at).toLocaleDateString('en-GB')}`}
          </p>
        </div>
        
        {/* HOLD Banner */}
        {incident.hold_status && (
          <div className="bg-red-600 text-white p-4 rounded-xl text-center">
            <ExclamationTriangleIcon className="h-8 w-8 mx-auto mb-2" />
            <p className="font-bold text-lg">{isRtl ? 'الشحنة محتجزة' : 'SHIPMENT ON HOLD'}</p>
            <p className="text-sm text-red-100">{isRtl ? 'لا تبيع - لا تعيد التغليف' : 'Do not sell - Do not repack'}</p>
          </div>
        )}
        
        {/* Issue Types */}
        <Card className="p-4">
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">
            {isRtl ? 'نوع المشكلة' : 'Issue Type'}
          </p>
          <div className="flex flex-wrap gap-2">
            {issueTypes.map(type => (
              <Badge key={type} color="amber">
                {ISSUE_TYPES[type as IssueType]?.icon} {isRtl ? ISSUE_TYPES[type as IssueType]?.labelAr : ISSUE_TYPES[type as IssueType]?.label}
              </Badge>
            ))}
          </div>
        </Card>
        
        {/* Measurements */}
        {(incident.broken_g || incident.mold_g || incident.foreign_g || incident.other_g || incident.moisture_pct) && (
          <Card className="p-4">
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">
              {isRtl ? 'القياسات' : 'Measurements'}
            </p>
            <div className="grid grid-cols-2 gap-3">
              {Number(incident.broken_g || 0) > 0 && (
                <div className="bg-gray-50 dark:bg-gray-700 p-3 rounded-lg text-center">
                  <p className="text-xl font-bold text-red-600">{incident.broken_g}g</p>
                  <p className="text-xs text-gray-500">{isRtl ? 'كسر' : 'Broken'}</p>
                </div>
              )}
              {Number(incident.mold_g || 0) > 0 && (
                <div className="bg-gray-50 dark:bg-gray-700 p-3 rounded-lg text-center">
                  <p className="text-xl font-bold text-green-600">{incident.mold_g}g</p>
                  <p className="text-xs text-gray-500">{isRtl ? 'عفن' : 'Mold'}</p>
                </div>
              )}
              {Number(incident.foreign_g || 0) > 0 && (
                <div className="bg-gray-50 dark:bg-gray-700 p-3 rounded-lg text-center">
                  <p className="text-xl font-bold text-amber-600">{incident.foreign_g}g</p>
                  <p className="text-xs text-gray-500">{isRtl ? 'شوائب' : 'Foreign'}</p>
                </div>
              )}
              {Number(incident.moisture_pct || 0) > 0 && (
                <div className="bg-gray-50 dark:bg-gray-700 p-3 rounded-lg text-center">
                  <p className="text-xl font-bold text-blue-600">{Number(incident.moisture_pct || 0).toFixed(1)}%</p>
                  <p className="text-xs text-gray-500">{isRtl ? 'رطوبة' : 'Moisture'}</p>
                </div>
              )}
            </div>
            {Number(incident.avg_defect_pct || 0) > 0 && (
              <div className="mt-3 text-center">
                <p className="text-3xl font-bold text-red-600">{Number(incident.avg_defect_pct || 0).toFixed(1)}%</p>
                <p className="text-sm text-gray-500">{isRtl ? 'نسبة العيوب الإجمالية' : 'Total Defect %'}</p>
              </div>
            )}
          </Card>
        )}
        
        {/* Photos Gallery */}
        {mediaPhotos.length > 0 && (
          <Card className="p-4">
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">
              {isRtl ? `الصور (${mediaPhotos.length})` : `Photos (${mediaPhotos.length})`}
            </p>
            <div className="grid grid-cols-3 gap-2">
              {mediaPhotos.map((photo: any, index: number) => (
                <div key={photo.id || index} className="relative aspect-square rounded-lg overflow-hidden bg-gray-200 dark:bg-gray-700">
                  <img 
                    src={photo.file_url || `/quality-media/${incident.id}/${photo.file_path?.split('/').pop()}`}
                    alt={`Photo ${index + 1}`}
                    className="w-full h-full object-cover"
                  />
                  {photo.slot && (
                    <div className="absolute bottom-0 left-0 right-0 bg-black/50 text-white text-xs p-1 text-center">
                      {photo.slot}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </Card>
        )}
        
        {/* Container Condition */}
        {(incident.container_moisture_seen || incident.container_bad_smell || 
          incident.container_torn_bags || incident.container_condensation) && (
          <Card className="p-4">
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">
              {isRtl ? 'حالة الحاوية' : 'Container Condition'}
            </p>
            <div className="flex flex-wrap gap-2">
              {incident.container_moisture_seen && <Badge color="red">{isRtl ? 'رطوبة' : 'Moisture'}</Badge>}
              {incident.container_bad_smell && <Badge color="red">{isRtl ? 'رائحة كريهة' : 'Bad Smell'}</Badge>}
              {incident.container_torn_bags && <Badge color="red">{incident.container_torn_bags_count || 0} {isRtl ? 'كيس ممزق' : 'torn bags'}</Badge>}
              {incident.container_condensation && <Badge color="red">{isRtl ? 'تكثف' : 'Condensation'}</Badge>}
            </div>
          </Card>
        )}
        
        {/* Back Button */}
        <button
          onClick={() => navigate('/inventory')}
          className="w-full py-4 bg-gray-600 text-white font-bold rounded-xl flex items-center justify-center gap-2"
        >
          {isRtl ? <ArrowRightIcon className="h-5 w-5" /> : <ArrowLeftIcon className="h-5 w-5" />}
          {isRtl ? 'العودة للمستودع' : 'Back to Inventory'}
        </button>
      </div>
    );
  };
  
  // ============================================================
  // MAIN RENDER
  // ============================================================
  
  const stepIndex = ['problem-type', 'photo-capture', 'measurements', 'container', 'summary'].indexOf(currentStep);
  
  // Check if viewing a submitted report (not draft)
  const isSubmittedReport = incident && incident.status !== 'draft';
  
  return (
    <div className="min-h-screen bg-gray-100 dark:bg-gray-900">
      {/* Header */}
      <div className={`text-white px-4 py-4 sticky top-0 z-10 ${
        isSubmittedReport 
          ? 'bg-gradient-to-r from-blue-600 to-blue-700' 
          : 'bg-gradient-to-r from-amber-500 to-orange-600'
      }`}>
        <div className="flex items-center justify-between">
          <button 
            onClick={isSubmittedReport ? () => navigate('/inventory') : goBack} 
            className="p-2 -ml-2"
          >
            {isRtl ? <ArrowRightIcon className="h-6 w-6" /> : <ArrowLeftIcon className="h-6 w-6" />}
          </button>
          <div className="text-center flex-1">
            <h1 className="font-bold">
              {isSubmittedReport 
                ? (isRtl ? 'تقرير الجودة' : 'Quality Report')
                : (isRtl ? 'تقرير مشكلة الجودة' : 'Quality Issue Report')}
            </h1>
            {incident && (
              <p className="text-xs opacity-75">{incident.shipment_sn} - {incident.product_text}</p>
            )}
            {!incident && shipmentData && (
              <p className="text-xs opacity-75">{shipmentData.shipment.sn} - {shipmentData.shipment.product_text}</p>
            )}
          </div>
          <button onClick={onClose || (() => navigate('/inventory'))} className="p-2 -mr-2">
            <XMarkIcon className="h-6 w-6" />
          </button>
        </div>
        
        {/* Step Progress - only show for draft */}
        {!isSubmittedReport && (
          <div className="flex gap-1 mt-3">
            {[0, 1, 2, 3, 4].map((index) => (
              <div
                key={index}
                className={`h-1 flex-1 rounded-full transition-colors ${
                  stepIndex >= index ? 'bg-white' : 'bg-white/30'
                }`}
              />
            ))}
          </div>
        )}
      </div>
      
      {/* Content */}
      {isSubmittedReport ? renderSubmittedReport() : renderStep()}
    </div>
  );
}

export default QualityIncidentWizard;
