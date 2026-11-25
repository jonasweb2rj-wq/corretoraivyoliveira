export type UserRole = 'admin' | 'broker' | 'editor';

export type ThemePresetId =
  | 'luxo-contemporaneo'
  | 'minimalista-premium'
  | 'imobiliario-moderno'
  | 'elegancia-classica'
  | 'arquitetura-editorial';

export interface ThemeConfig {
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  backgroundColor: string;
  surfaceColor: string;
  textColor: string;
  mutedTextColor: string;
  headingFont: string;
  bodyFont: string;
  buttonStyle: 'sharp' | 'rounded' | 'soft';
  cardStyle: 'bordered' | 'elevated' | 'minimal';
}

export interface TenantDifferential {
  title: string;
  description: string;
}

export interface Tenant {
  id: string;
  ownerUid: string;
  slug: string;
  brandName: string;
  brokerName: string;
  creci: string;
  city: string;
  state: string;
  regions: string[];
  whatsapp: string;
  phone: string;
  email: string;
  instagramHandle: string;
  instagramUrl: string;
  logoUrl: string;
  faviconUrl: string;
  heroTitle: string;
  heroSubtitle: string;
  heroCtaText: string;
  heroImages: string[];
  aboutHeadline: string;
  aboutBio: string;
  aboutPhotoUrl: string;
  aboutExperienceYears: string;
  specialties: string[];
  differentials: TenantDifferential[];
  themePreset: ThemePresetId;
  themeConfig: ThemeConfig;
  seoTitle: string;
  seoDescription: string;
  ga4Id: string;
  gtmId: string;
  gscVerification: string;
  googleAdsId: string;
  lgpdPrivacyText: string;
  customDomain: string;
  status: 'active' | 'inactive';
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  photoURL?: string;
  role: UserRole;
  tenantId: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface PropertyMediaItem {
  id: string;
  url: string;
  pathname?: string;
  roomTag?: string;
  caption?: string;
  isPrimary?: boolean;
  isAiEnhanced?: boolean;
  originalUrl?: string;
  sortOrder?: number;
}

export interface PropertyVideoItem {
  id: string;
  url: string;
  title: string;
  style?: string;
  aspectRatio?: '16:9' | '9:16';
  isIllustrativeAi?: boolean;
}

export type PropertyType = 'casa' | 'apartamento' | 'cobertura' | 'terreno' | 'comercial';
export type TransactionType = 'venda' | 'aluguel' | 'lancamento';
export type PropertyStatus = 'draft' | 'published' | 'sold' | 'rented';
export type VirtualTourType = 'photo' | 'panorama360' | '3d';

export interface Property {
  id: string;
  tenantId: string;
  ownerUid: string;
  slug: string;
  code: string;
  title: string;
  propertyType: PropertyType;
  transactionType: TransactionType;
  price: number;
  condoFee: number;
  iptu: number;
  city: string;
  neighborhood: string;
  address: string;
  showExactAddress: boolean;
  builtArea: number;
  totalArea: number;
  bedrooms: number;
  suites: number;
  bathrooms: number;
  parkingSpaces: number;
  description: string;
  summary: string;
  features: string[];
  differentials: string[];
  coverImage: string;
  images: PropertyMediaItem[];
  videos: PropertyVideoItem[];
  panorama360Images: PropertyMediaItem[];
  virtualTourType: VirtualTourType;
  status: PropertyStatus;
  featured: boolean;
  sortOrder: number;
  seoTitle: string;
  seoDescription: string;
  socialCopy: string;
  whatsappCopy: string;
  viewsCount: number;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface Development {
  id: string;
  tenantId: string;
  ownerUid: string;
  slug: string;
  name: string;
  developer: string;
  category: 'lancamento' | 'condominio' | 'residencial' | 'comercial';
  city: string;
  neighborhood: string;
  deliveryDate: string;
  priceFrom: number;
  description: string;
  technicalSpecs: string[];
  coverImage: string;
  images: PropertyMediaItem[];
  floorPlans: PropertyMediaItem[];
  videos: PropertyVideoItem[];
  status: 'draft' | 'published';
  featured: boolean;
  seoTitle: string;
  seoDescription: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface LandingPage {
  id: string;
  tenantId: string;
  ownerUid: string;
  propertyId: string;
  slug: string;
  template: 'editorial-luxo' | 'lancamento-impacto' | 'minimalista-direto';
  title: string;
  subtitle: string;
  heroImage: string;
  description: string;
  ctaText: string;
  accentColor: string;
  highlights: string[];
  status: 'draft' | 'published';
  viewsCount: number;
  leadsCount: number;
  seoTitle: string;
  seoDescription: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export type LeadInterest = 'comprar' | 'alugar' | 'vender' | 'investir' | 'visita' | 'empreendimento' | 'informacoes';
export type LeadStatus = 'new' | 'in_progress' | 'scheduled' | 'converted' | 'lost';

export interface Lead {
  id: string;
  tenantId: string;
  ownerUid: string;
  name: string;
  phone: string;
  email: string;
  interest: LeadInterest;
  propertyId: string;
  propertyTitle: string;
  developmentId: string;
  landingPageId: string;
  source: string;
  utmSource: string;
  utmMedium: string;
  utmCampaign: string;
  message: string;
  lgpdConsent: boolean;
  status: LeadStatus;
  notes: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface Testimonial {
  id: string;
  tenantId: string;
  ownerUid: string;
  clientName: string;
  clientRole: string;
  quote: string;
  propertyReference: string;
  status: 'draft' | 'published';
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface AnalyticsEvent {
  id: string;
  tenantId: string;
  ownerUid: string;
  eventType: 'page_view' | 'property_view' | 'whatsapp_click' | 'share' | 'lead_submit' | 'virtual_tour_open';
  targetId: string;
  path: string;
  source: string;
  utmSource: string;
  utmCampaign: string;
  createdAt?: unknown;
}

export interface Campaign {
  id: string;
  tenantId: string;
  ownerUid: string;
  name: string;
  channel: string;
  utmSource: string;
  utmMedium: string;
  utmCampaign: string;
  status: 'active' | 'paused' | 'ended';
  budget: number;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface AiJob {
  id: string;
  tenantId: string;
  ownerUid: string;
  propertyId: string;
  jobType: 'photo_analysis' | 'description_gen' | 'video_cinematic' | 'video_veo';
  provider: string;
  style: string;
  durationSec: number;
  aspectRatio: '16:9' | '9:16';
  status: 'queued' | 'processing' | 'completed' | 'failed' | 'cancelled';
  inputImageUrls: string[];
  outputUrl: string;
  errorMessage: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface AuditLog {
  id: string;
  tenantId: string;
  ownerUid: string;
  actorUid: string;
  actorEmail: string;
  action: string;
  entityType: string;
  entityId: string;
  summary: string;
  createdAt?: unknown;
}
