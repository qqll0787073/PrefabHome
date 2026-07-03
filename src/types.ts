export type Language = "en" | "zh";

export type UserRole = "buyer" | "manufacturer" | "admin";

export interface BuyerProfile {
  id: string;
  name: string;
  email: string;
  phone?: string;
  state: string;
  zipCode: string;
  landStatus: "owned" | "searching";
  budget: number;
  preferredType: string;
}

export interface ManufacturerProfile {
  id: string;
  companyName: string;
  companyNameCn?: string;
  contactPerson: string;
  title?: string;
  email: string;
  phone: string;
  mobile?: string;
  whatsapp?: string;
  wechat?: string;
  website?: string;
  province?: string;
  city?: string;
  address: string;
  postalCode?: string;
  country?: string;
  yearEstablished?: number;
  employees?: number;
  factoryAreaSqm?: number;
  certifications: string[]; // e.g. ["ISO9001", "CE", "UL", "CSA"]
  products?: string[]; // e.g. ["Space Capsule", "Expandable Container", "ADU"]
  exportMarkets?: string[];
  annualCapacity?: string;
  oem?: boolean;
  odm?: boolean;
  verified?: boolean;
  source?: string;
  notes?: string;

  // CRM - Customer Relationship Management fields
  contactStatus?: "Not Contacted" | "Contacted" | "Replied" | "Follow-up" | "Active" | "Inactive";
  firstContactDate?: string;
  lastContactDate?: string;
  lastEmailSent?: string;
  responseReceived?: boolean;
  responseTime?: string; // e.g. "4h" or "24h"
  productCatalogReceived?: boolean;
  priceListReceived?: boolean;
  photosReceived?: boolean;
  videosReceived?: boolean;
  cadReceived?: boolean;
  ndaSigned?: boolean;
  sampleOrdered?: boolean;
  preferredSupplier?: boolean;

  status: "pending" | "approved" | "rejected" | "suspended";
  factoryPhotos: string[];
}

export interface Product {
  id: string;
  name: string;
  modelNumber: string;
  category: string; // e.g. "Tiny House", "ADU", "Modular House", "Container House", "Cabin", "Garden Office"
  manufacturerId: string;
  manufacturerName: string;
  price: number; // FOB price in USD
  size: string; // e.g., "11.5m x 2.2m x 2.5m"
  area: number; // in sq ft or sq meters
  bedrooms: number;
  bathrooms: number;
  hasKitchen: boolean;
  productionTime: number; // in days
  shippingAvailability: string; // e.g. "Global", "US East Coast only"
  image: string; // url/placeholder
  imageGallery: string[];
  floorPlan: string;
  videoUrl?: string;
  description: string;
  structureMaterial: string;
  wallMaterial: string;
  roofMaterial: string;
  windowType: string;
  insulation: string;
  electricalSystem: string;
  plumbingSystem: string;
  weight: number; // in kg
  requiredContainers: string; // e.g. "1x 40HQ"
  isCustomizable: boolean;
  isSuitableForOffGrid: boolean;
  isSuitableForAdu: boolean;
  warranty: string;
  certifications: string[];
}

export interface QuoteRequest {
  id: string;
  buyerName: string;
  buyerEmail: string;
  buyerPhone?: string;
  productModel: string;
  productId: string;
  manufacturerId: string;
  manufacturerName: string;
  quantity: number;
  budget: number;
  projectLocation: string;
  zipCode: string;
  landStatus: "owned" | "searching";
  needInstallationSupport: boolean;
  needFinancing: boolean;
  needPermitAssistance: boolean;
  customizationRequest: string;
  uploadedFiles: string[]; // Mock file names
  status: "submitted" | "viewed" | "quotation_sent" | "buyer_responded" | "negotiation" | "closed" | "ordered" | "cancelled";
  date: string;
}

export interface Quotation {
  id: string;
  quoteRequestId: string;
  productId: string;
  productModel: string;
  basePrice: number;
  customizationCost: number;
  estimatedShippingCost: number;
  estimatedProductionTime: number; // in days
  paymentTerms: string;
  validityPeriod: string; // e.g., "30 days"
  notes: string;
  date: string;
}

export interface Message {
  id: string;
  fromId: string;
  fromName: string;
  toId: string;
  toName: string;
  text: string;
  translatedText?: string;
  timestamp: string;
  attachmentUrl?: string;
  productRef?: { id: string; name: string };
  quoteRef?: { id: string; model: string };
}

export interface SavedProduct {
  id: string;
  productId: string;
  savedDate: string;
  notes?: string;
}

export interface Review {
  id: string;
  productId: string;
  productName: string;
  buyerName: string;
  rating: number;
  text: string;
  date: string;
}

export interface AdminLog {
  id: string;
  action: string;
  details: string;
  timestamp: string;
}

export interface Notification {
  id: string;
  userId: string;
  text: string;
  date: string;
  isRead: boolean;
}

export interface ShippingRateParams {
  productId: string;
  deliveryZip: string;
  destinationState: string;
  nearestPort: string;
  quantity: number;
  containerType: string;
}

export interface ShippingCostResult {
  factoryPrice: number;
  oceanFreight: number;
  importDuty: number;
  portFee: number;
  customsClearance: number;
  inlandTrucking: number;
  craneCost: number;
  installationEstimate: number;
  totalLandedCost: number;
}
