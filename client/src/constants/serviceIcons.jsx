import {
  Stethoscope,
  Sparkles,
  Wrench,
  Scan,
  Smile,
  Baby,
  AlertTriangle,
  Syringe,
  Crown,
  Sun,
  Heart,
  Settings,
  Scissors,
  Search,
  CheckCircle2,
  Star,
  Eye,
  Shield,
  UserCheck,
} from 'lucide-react';

const iconClass = "h-8 w-8 text-cyan-700 dark:text-cyan-200";

export const REGULAR_CHECKUP = (
  <div className="flex items-center justify-center">
    <Stethoscope className={iconClass} />
    <CheckCircle2 className="h-4 w-4 text-emerald-500 -ml-1 -mt-4" />
  </div>
);

export const TEETH_CLEANING = (
  <div className="flex items-center justify-center">
    <Sparkles className={iconClass} />
    <Star className="h-3 w-3 text-yellow-400 -ml-1 -mt-4" />
  </div>
);

export const TOOTH_FILLING = (
  <div className="flex items-center justify-center">
    <Wrench className={iconClass} />
  </div>
);

export const DENTAL_XRAY = (
  <div className="flex items-center justify-center">
    <Eye className={iconClass} />
  </div>
);

export const BRACES = (
  <div className="flex items-center justify-center">
    <Smile className={iconClass} />
    <Star className="h-3 w-3 text-cyan-400 -ml-1 -mt-3" />
  </div>
);

export const KIDS_DENTAL = (
  <div className="flex items-center justify-center">
    <Baby className={iconClass} />
    <Star className="h-3 w-3 text-yellow-400 -ml-1 -mt-3" />
  </div>
);

export const TOOTH_EXTRACTION = (
  <div className="flex items-center justify-center">
    <AlertTriangle className={iconClass} />
  </div>
);

export const ROOT_CANAL = (
  <div className="flex items-center justify-center">
    <Syringe className={iconClass} />
  </div>
);

export const DENTAL_CROWN = (
  <div className="flex items-center justify-center">
    <Crown className={iconClass} />
  </div>
);

export const TEETH_WHITENING = (
  <div className="flex items-center justify-center">
    <Sun className={iconClass} />
    <Sparkles className="h-4 w-4 text-yellow-400 -ml-1 -mt-3" />
  </div>
);

export const EMERGENCY_VISIT = (
  <div className="flex items-center justify-center">
    <AlertTriangle className={iconClass} />
    <div className="h-1.5 w-1.5 rounded-full bg-red-500 absolute mt-2 ml-3" />
  </div>
);

export const GUM_CARE = (
  <div className="flex items-center justify-center">
    <Heart className={iconClass} />
  </div>
);

export const DENTURE_FITTING = (
  <div className="flex items-center justify-center">
    <UserCheck className={iconClass} />
  </div>
);

export const DENTAL_IMPLANT = (
  <div className="flex items-center justify-center">
    <Shield className={iconClass} />
  </div>
);

export const RETAINER = (
  <div className="flex items-center justify-center">
    <Settings className={iconClass} />
  </div>
);

export const SURGERY_FOLLOWUP = (
  <div className="flex items-center justify-center">
    <Scissors className={iconClass} />
  </div>
);

export const SMILE_DESIGN = (
  <div className="flex items-center justify-center">
    <Smile className={iconClass} />
    <Sparkles className="h-4 w-4 text-yellow-400 -ml-1 -mt-3" />
  </div>
);

export const WISDOM_TOOTH = (
  <div className="flex items-center justify-center">
    <Search className={iconClass} />
  </div>
);

const SERVICE_TO_ICON = {
  'Regular Checkup': REGULAR_CHECKUP,
  'Teeth Cleaning': TEETH_CLEANING,
  'Tooth Filling': TOOTH_FILLING,
  'Dental X-Ray': DENTAL_XRAY,
  'Braces Consultation': BRACES,
  'Kids Dental Visit': KIDS_DENTAL,
  'Tooth Extraction': TOOTH_EXTRACTION,
  'Root Canal': ROOT_CANAL,
  'Dental Crown': DENTAL_CROWN,
  'Teeth Whitening': TEETH_WHITENING,
  'Emergency Visit': EMERGENCY_VISIT,
  'Gum Care Check': GUM_CARE,
  'Denture Fitting': DENTURE_FITTING,
  'Dental Implant': DENTAL_IMPLANT,
  'Retainer Adjustment': RETAINER,
  'Surgery Follow-up': SURGERY_FOLLOWUP,
  'Smile Design': SMILE_DESIGN,
  'Wisdom Tooth Check': WISDOM_TOOTH,
};

export const getServiceIcon = (service) => {
  if (!service) return REGULAR_CHECKUP;
  const baseName = service.split(' - ')[0] || service;
  return SERVICE_TO_ICON[baseName] || REGULAR_CHECKUP;
};
