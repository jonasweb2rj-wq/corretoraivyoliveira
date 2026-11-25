import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  Unsubscribe,
} from 'firebase/firestore';
import { User } from 'firebase/auth';
import {
  BOOTSTRAPPED_ADMIN_EMAIL,
  db,
  handleFirestoreError,
  isBootAdminUser,
  OperationType,
} from './config';
import { DEFAULT_TENANT, DEFAULT_TENANT_ID } from '../config/defaultTenant';
import {
  AiJob,
  AnalyticsEvent,
  AuditLog,
  Campaign,
  Development,
  LandingPage,
  Lead,
  Property,
  Tenant,
  Testimonial,
  UserProfile,
} from '../types/realestate';
import { generateSafeId, slugify } from '../utils/formatters';

function cleanUndefined<T extends Record<string, unknown>>(obj: T): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v !== undefined) {
      out[k] = v;
    }
  }
  return out;
}

function clampStr(val: unknown, maxLen: number): string {
  if (typeof val !== 'string') return '';
  return val.slice(0, maxLen);
}

function clampSlug(val: unknown, fallback = 'item'): string {
  return slugify(typeof val === 'string' && val.trim() ? val : fallback).slice(0, 155);
}

function clampStrArray(val: unknown, maxItems: number, maxItemLen = 180): string[] {
  if (!Array.isArray(val)) return [];
  return val
    .filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
    .slice(0, maxItems)
    .map((s) => s.slice(0, maxItemLen));
}

function clampNumber(val: unknown, min = 0): number {
  const n = Number(val);
  if (!Number.isFinite(n) || n < min) return min;
  return n;
}

// Auto-provision admin, user profile, and default Ivy Oliveira tenant on login
export async function bootstrapUserAndTenant(user: User): Promise<{
  profile: UserProfile;
  tenant: Tenant;
  isAdmin: boolean;
}> {
  const isBootAdmin = isBootAdminUser(user);

  try {
    if (isBootAdmin) {
      const adminRef = doc(db, 'admins', user.uid);
      const adminSnap = await getDoc(adminRef);
      if (!adminSnap.exists()) {
        await setDoc(adminRef, {
          uid: user.uid,
          email: user.email || BOOTSTRAPPED_ADMIN_EMAIL,
          createdAt: serverTimestamp(),
        });
      }
    }

    const userRef = doc(db, 'users', user.uid);
    const userSnap = await getDoc(userRef);
    let profile: UserProfile;

    if (!userSnap.exists()) {
      const assignedTenantId = isBootAdmin ? DEFAULT_TENANT_ID : `broker_${user.uid.slice(0, 12)}`;
      profile = {
        uid: user.uid,
        email: user.email || '',
        displayName: user.displayName || user.email?.split('@')[0] || 'Administrador',
        photoURL: user.photoURL || '',
        role: isBootAdmin ? 'admin' : 'broker',
        tenantId: assignedTenantId,
      };
      await setDoc(userRef, {
        ...cleanUndefined(profile as unknown as Record<string, unknown>),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } else {
      profile = userSnap.data() as UserProfile;
      if (isBootAdmin && (profile.role !== 'admin' || profile.tenantId !== DEFAULT_TENANT_ID)) {
        profile = {
          ...profile,
          role: 'admin',
          tenantId: DEFAULT_TENANT_ID,
        };
        await updateDoc(userRef, {
          role: 'admin',
          tenantId: DEFAULT_TENANT_ID,
          updatedAt: serverTimestamp(),
        });
      }
    }

    const tenantRef = doc(db, 'tenants', profile.tenantId);
    const tenantSnap = await getDoc(tenantRef);
    let tenant: Tenant;

    if (!tenantSnap.exists()) {
      const baseTenant: Tenant = isBootAdmin
        ? { ...DEFAULT_TENANT, id: profile.tenantId, ownerUid: user.uid }
        : {
            ...DEFAULT_TENANT,
            id: profile.tenantId,
            ownerUid: user.uid,
            slug: `corretor-${user.uid.slice(0, 8).toLowerCase()}`,
            brandName: profile.displayName,
            brokerName: profile.displayName,
            email: profile.email,
            heroTitle: `Consultoria imobiliária por ${profile.displayName}`,
            aboutHeadline: profile.displayName,
            aboutBio: '',
            creci: '',
            whatsapp: '',
            phone: '',
            instagramHandle: '',
            instagramUrl: '',
          };

      await setDoc(tenantRef, {
        ...cleanUndefined(baseTenant as unknown as Record<string, unknown>),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      tenant = baseTenant;
    } else {
      const existing = tenantSnap.data() as Tenant;
      const useDefaultAbout =
        !existing.aboutPhotoUrl || existing.aboutPhotoUrl.includes('editorial_advisory_studio_');
      const normalizedExisting: Tenant = {
        ...existing,
        heroTitle: existing.heroTitle?.replace(/Curadoria/gi, 'Consultoria') || '',
        heroSubtitle: existing.heroSubtitle?.replace(/Curadoria/gi, 'Consultoria') || '',
        seoTitle: existing.seoTitle?.replace(/Curadoria/gi, 'Consultoria') || '',
        differentials: (existing.differentials || []).map((d) => ({
          ...d,
          title: d.title?.replace(/Curadoria Arquitetônica/gi, 'Seleção Arquitetônica').replace(/Curadoria/gi, 'Consultoria'),
        })),
      };
      const useDefaultLogo =
        !existing.logoUrl ||
        existing.logoUrl.includes('wxmntYHq') ||
        existing.logoUrl.includes('logo_ivy_oliveira.png');
      const useDefaultFavicon =
        !existing.faviconUrl ||
        existing.faviconUrl.includes('wxmntYHq') ||
        existing.faviconUrl.includes('logo_ivy_oliveira.png');
      tenant =
        profile.tenantId === DEFAULT_TENANT_ID
          ? {
              ...DEFAULT_TENANT,
              ...normalizedExisting,
              logoUrl: useDefaultLogo ? DEFAULT_TENANT.logoUrl : existing.logoUrl,
              faviconUrl: useDefaultFavicon ? DEFAULT_TENANT.faviconUrl : existing.faviconUrl,
              aboutPhotoUrl: useDefaultAbout ? DEFAULT_TENANT.aboutPhotoUrl : existing.aboutPhotoUrl,
            }
          : normalizedExisting;
    }

    const adminCheck = isBootAdmin || profile.role === 'admin';
    return { profile, tenant, isAdmin: adminCheck };
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, 'users/bootstrap');
  }
}

// Public Tenant Subscription
export function subscribePublicTenant(
  tenantId: string,
  onData: (tenant: Tenant) => void
): Unsubscribe {
  const ref = doc(db, 'tenants', tenantId);
  return onSnapshot(
    ref,
    (snap) => {
      if (snap.exists()) {
        const loaded = snap.data() as Tenant;
        const useDefaultAbout =
          !loaded.aboutPhotoUrl || loaded.aboutPhotoUrl.includes('editorial_advisory_studio_');
        const normalizedLoaded: Tenant = {
          ...loaded,
          heroTitle: loaded.heroTitle?.replace(/Curadoria/gi, 'Consultoria') || '',
          heroSubtitle: loaded.heroSubtitle?.replace(/Curadoria/gi, 'Consultoria') || '',
          seoTitle: loaded.seoTitle?.replace(/Curadoria/gi, 'Consultoria') || '',
          differentials: (loaded.differentials || []).map((d) => ({
            ...d,
            title: d.title?.replace(/Curadoria Arquitetônica/gi, 'Seleção Arquitetônica').replace(/Curadoria/gi, 'Consultoria'),
          })),
        };
        const useDefaultLogo =
          !loaded.logoUrl ||
          loaded.logoUrl.includes('wxmntYHq') ||
          loaded.logoUrl.includes('logo_ivy_oliveira.png');
        const useDefaultFavicon =
          !loaded.faviconUrl ||
          loaded.faviconUrl.includes('wxmntYHq') ||
          loaded.faviconUrl.includes('logo_ivy_oliveira.png');
        onData(
          tenantId === DEFAULT_TENANT_ID
            ? {
                ...DEFAULT_TENANT,
                ...normalizedLoaded,
                logoUrl: useDefaultLogo ? DEFAULT_TENANT.logoUrl : loaded.logoUrl,
                faviconUrl: useDefaultFavicon ? DEFAULT_TENANT.faviconUrl : loaded.faviconUrl,
                aboutPhotoUrl: useDefaultAbout ? DEFAULT_TENANT.aboutPhotoUrl : loaded.aboutPhotoUrl,
              }
            : normalizedLoaded
        );
      } else {
        onData(DEFAULT_TENANT);
      }
    },
    (err) => {
      console.warn('Tenant fallback active:', err.message);
      onData(DEFAULT_TENANT);
    }
  );
}

// List active tenants (for multi-broker directory or admin tenant switcher)
export async function listTenants(isAdmin: boolean, ownerUid?: string): Promise<Tenant[]> {
  try {
    const q = isAdmin
      ? query(collection(db, 'tenants'))
      : ownerUid
        ? query(collection(db, 'tenants'), where('ownerUid', '==', ownerUid))
        : query(collection(db, 'tenants'), where('status', '==', 'active'));
    const snap = await getDocs(q);
    return snap.docs.map((d) => d.data() as Tenant);
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, 'tenants');
  }
}

export async function updateTenantSettings(tenantId: string, updates: Partial<Tenant>): Promise<void> {
  const path = `tenants/${tenantId}`;
  try {
    const safeUpdates = cleanUndefined({
      ...updates,
      brandName: updates.brandName !== undefined ? clampStr(updates.brandName, 120) : undefined,
      brokerName: updates.brokerName !== undefined ? clampStr(updates.brokerName, 120) : undefined,
      creci: updates.creci !== undefined ? clampStr(updates.creci, 60) : undefined,
      city: updates.city !== undefined ? clampStr(updates.city, 80) : undefined,
      state: updates.state !== undefined ? clampStr(updates.state, 20) : undefined,
      regions: updates.regions !== undefined ? clampStrArray(updates.regions, 30, 80) : undefined,
      whatsapp: updates.whatsapp !== undefined ? clampStr(updates.whatsapp, 30) : undefined,
      phone: updates.phone !== undefined ? clampStr(updates.phone, 30) : undefined,
      email: updates.email !== undefined ? clampStr(updates.email, 200) : undefined,
      instagramHandle: updates.instagramHandle !== undefined ? clampStr(updates.instagramHandle, 80) : undefined,
      instagramUrl: updates.instagramUrl !== undefined ? clampStr(updates.instagramUrl, 500) : undefined,
      logoUrl: updates.logoUrl !== undefined ? clampStr(updates.logoUrl, 1000) : undefined,
      faviconUrl: updates.faviconUrl !== undefined ? clampStr(updates.faviconUrl, 1000) : undefined,
      heroTitle: updates.heroTitle !== undefined ? clampStr(updates.heroTitle, 200) : undefined,
      heroSubtitle: updates.heroSubtitle !== undefined ? clampStr(updates.heroSubtitle, 500) : undefined,
      heroCtaText: updates.heroCtaText !== undefined ? clampStr(updates.heroCtaText, 60) : undefined,
      heroImages: updates.heroImages !== undefined ? clampStrArray(updates.heroImages, 10, 1000) : undefined,
      aboutHeadline: updates.aboutHeadline !== undefined ? clampStr(updates.aboutHeadline, 200) : undefined,
      aboutBio: updates.aboutBio !== undefined ? clampStr(updates.aboutBio, 4000) : undefined,
      aboutPhotoUrl: updates.aboutPhotoUrl !== undefined ? clampStr(updates.aboutPhotoUrl, 1000) : undefined,
      aboutExperienceYears: updates.aboutExperienceYears !== undefined ? clampStr(updates.aboutExperienceYears, 40) : undefined,
      specialties: updates.specialties !== undefined ? clampStrArray(updates.specialties, 20, 120) : undefined,
      differentials: updates.differentials !== undefined ? updates.differentials.slice(0, 12) : undefined,
      seoTitle: updates.seoTitle !== undefined ? clampStr(updates.seoTitle, 160) : undefined,
      seoDescription: updates.seoDescription !== undefined ? clampStr(updates.seoDescription, 320) : undefined,
      ga4Id: updates.ga4Id !== undefined ? clampStr(updates.ga4Id, 60) : undefined,
      gtmId: updates.gtmId !== undefined ? clampStr(updates.gtmId, 60) : undefined,
      gscVerification: updates.gscVerification !== undefined ? clampStr(updates.gscVerification, 120) : undefined,
      googleAdsId: updates.googleAdsId !== undefined ? clampStr(updates.googleAdsId, 60) : undefined,
      lgpdPrivacyText: updates.lgpdPrivacyText !== undefined ? clampStr(updates.lgpdPrivacyText, 6000) : undefined,
      customDomain: updates.customDomain !== undefined ? clampStr(updates.customDomain, 200) : undefined,
    } as Record<string, unknown>);
    delete safeUpdates.id;
    delete safeUpdates.ownerUid;
    delete safeUpdates.slug;
    delete safeUpdates.createdAt;
    await updateDoc(doc(db, 'tenants', tenantId), {
      ...safeUpdates,
      updatedAt: serverTimestamp(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, path);
  }
}

// Real-time Public Properties Listener
export function subscribePublishedProperties(
  tenantId: string,
  onData: (items: Property[]) => void
): Unsubscribe {
  const q = query(
    collection(db, 'properties'),
    where('tenantId', '==', tenantId),
    where('status', '==', 'published')
  );
  return onSnapshot(
    q,
    (snap) => {
      const list = snap.docs.map((d) => d.data() as Property);
      list.sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
      onData(list);
    },
    (err) => {
      handleFirestoreError(err, OperationType.LIST, 'properties');
    }
  );
}

// Real-time Admin/Broker Properties Listener (isolated by ownerUid unless platform admin)
export function subscribeManagedProperties(
  tenantId: string,
  ownerUid: string,
  isAdmin: boolean,
  onData: (items: Property[]) => void
): Unsubscribe {
  const q = isAdmin
    ? query(collection(db, 'properties'), where('tenantId', '==', tenantId))
    : query(
        collection(db, 'properties'),
        where('tenantId', '==', tenantId),
        where('ownerUid', '==', ownerUid)
      );
  return onSnapshot(
    q,
    (snap) => {
      const list = snap.docs.map((d) => d.data() as Property);
      list.sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
      onData(list);
    },
    (err) => {
      handleFirestoreError(err, OperationType.LIST, 'properties');
    }
  );
}

export async function saveProperty(
  property: Omit<Property, 'createdAt' | 'updatedAt'>,
  isNew: boolean
): Promise<void> {
  const path = `properties/${property.id}`;
  try {
    const sanitized = cleanUndefined({
      ...property,
      slug: clampSlug(property.slug || property.title, property.code || 'imovel'),
      code: clampStr(property.code || 'IMV', 40),
      title: clampStr(property.title, 180),
      price: clampNumber(property.price, 0),
      condoFee: clampNumber(property.condoFee, 0),
      iptu: clampNumber(property.iptu, 0),
      city: clampStr(property.city, 80),
      neighborhood: clampStr(property.neighborhood, 100),
      address: clampStr(property.address, 240),
      builtArea: clampNumber(property.builtArea, 0),
      totalArea: clampNumber(property.totalArea, 0),
      bedrooms: clampNumber(property.bedrooms, 0),
      suites: clampNumber(property.suites, 0),
      bathrooms: clampNumber(property.bathrooms, 0),
      parkingSpaces: clampNumber(property.parkingSpaces, 0),
      description: clampStr(property.description, 8000),
      summary: clampStr(property.summary, 600),
      features: clampStrArray(property.features, 40, 200),
      differentials: clampStrArray(property.differentials, 25, 200),
      coverImage: clampStr(property.coverImage, 1000),
      images: Array.isArray(property.images) ? property.images.slice(0, 50) : [],
      videos: Array.isArray(property.videos) ? property.videos.slice(0, 12) : [],
      panorama360Images: Array.isArray(property.panorama360Images) ? property.panorama360Images.slice(0, 20) : [],
      seoTitle: clampStr(property.seoTitle, 160),
      seoDescription: clampStr(property.seoDescription, 320),
      socialCopy: clampStr(property.socialCopy, 2000),
      whatsappCopy: clampStr(property.whatsappCopy, 1000),
      viewsCount: clampNumber(property.viewsCount, 0),
    } as Record<string, unknown>);

    if (isNew) {
      await setDoc(doc(db, 'properties', property.id), {
        ...sanitized,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } else {
      delete sanitized.id;
      delete sanitized.tenantId;
      delete sanitized.ownerUid;
      delete sanitized.createdAt;
      await updateDoc(doc(db, 'properties', property.id), {
        ...sanitized,
        updatedAt: serverTimestamp(),
      });
    }
  } catch (err) {
    handleFirestoreError(err, isNew ? OperationType.CREATE : OperationType.UPDATE, path);
  }
}

export async function deleteProperty(propertyId: string): Promise<void> {
  try {
    await deleteDoc(doc(db, 'properties', propertyId));
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, `properties/${propertyId}`);
  }
}

// Developments
export function subscribePublishedDevelopments(
  tenantId: string,
  onData: (items: Development[]) => void
): Unsubscribe {
  const q = query(
    collection(db, 'developments'),
    where('tenantId', '==', tenantId),
    where('status', '==', 'published')
  );
  return onSnapshot(
    q,
    (snap) => onData(snap.docs.map((d) => d.data() as Development)),
    (err) => handleFirestoreError(err, OperationType.LIST, 'developments')
  );
}

export function subscribeManagedDevelopments(
  tenantId: string,
  ownerUid: string,
  isAdmin: boolean,
  onData: (items: Development[]) => void
): Unsubscribe {
  const q = isAdmin
    ? query(collection(db, 'developments'), where('tenantId', '==', tenantId))
    : query(
        collection(db, 'developments'),
        where('tenantId', '==', tenantId),
        where('ownerUid', '==', ownerUid)
      );
  return onSnapshot(
    q,
    (snap) => onData(snap.docs.map((d) => d.data() as Development)),
    (err) => handleFirestoreError(err, OperationType.LIST, 'developments')
  );
}

export async function saveDevelopment(
  dev: Omit<Development, 'createdAt' | 'updatedAt'>,
  isNew: boolean
): Promise<void> {
  const path = `developments/${dev.id}`;
  try {
    const sanitized = cleanUndefined({
      ...dev,
      slug: clampSlug(dev.slug || dev.name, 'empreendimento'),
      name: clampStr(dev.name, 160),
      developer: clampStr(dev.developer, 120),
      city: clampStr(dev.city, 80),
      neighborhood: clampStr(dev.neighborhood, 100),
      deliveryDate: clampStr(dev.deliveryDate, 60),
      priceFrom: clampNumber(dev.priceFrom, 0),
      description: clampStr(dev.description, 8000),
      technicalSpecs: clampStrArray(dev.technicalSpecs, 30, 200),
      coverImage: clampStr(dev.coverImage, 1000),
      images: Array.isArray(dev.images) ? dev.images.slice(0, 40) : [],
      floorPlans: Array.isArray(dev.floorPlans) ? dev.floorPlans.slice(0, 20) : [],
      videos: Array.isArray(dev.videos) ? dev.videos.slice(0, 10) : [],
      seoTitle: clampStr(dev.seoTitle, 160),
      seoDescription: clampStr(dev.seoDescription, 320),
    } as Record<string, unknown>);

    if (isNew) {
      await setDoc(doc(db, 'developments', dev.id), {
        ...sanitized,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } else {
      delete sanitized.id;
      delete sanitized.tenantId;
      delete sanitized.ownerUid;
      delete sanitized.createdAt;
      await updateDoc(doc(db, 'developments', dev.id), {
        ...sanitized,
        updatedAt: serverTimestamp(),
      });
    }
  } catch (err) {
    handleFirestoreError(err, isNew ? OperationType.CREATE : OperationType.UPDATE, path);
  }
}

export async function deleteDevelopment(id: string): Promise<void> {
  try {
    await deleteDoc(doc(db, 'developments', id));
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, `developments/${id}`);
  }
}

// Landing Pages
export function subscribePublishedLandingPages(
  tenantId: string,
  onData: (items: LandingPage[]) => void
): Unsubscribe {
  const q = query(
    collection(db, 'landingPages'),
    where('tenantId', '==', tenantId),
    where('status', '==', 'published')
  );
  return onSnapshot(
    q,
    (snap) => onData(snap.docs.map((d) => d.data() as LandingPage)),
    (err) => handleFirestoreError(err, OperationType.LIST, 'landingPages')
  );
}

export function subscribeManagedLandingPages(
  tenantId: string,
  ownerUid: string,
  isAdmin: boolean,
  onData: (items: LandingPage[]) => void
): Unsubscribe {
  const q = isAdmin
    ? query(collection(db, 'landingPages'), where('tenantId', '==', tenantId))
    : query(
        collection(db, 'landingPages'),
        where('tenantId', '==', tenantId),
        where('ownerUid', '==', ownerUid)
      );
  return onSnapshot(
    q,
    (snap) => onData(snap.docs.map((d) => d.data() as LandingPage)),
    (err) => handleFirestoreError(err, OperationType.LIST, 'landingPages')
  );
}

export async function saveLandingPage(
  lp: Omit<LandingPage, 'createdAt' | 'updatedAt'>,
  isNew: boolean
): Promise<void> {
  const path = `landingPages/${lp.id}`;
  try {
    const sanitized = cleanUndefined({
      ...lp,
      slug: clampSlug(lp.slug || lp.title, 'oferta'),
      title: clampStr(lp.title, 180),
      subtitle: clampStr(lp.subtitle, 400),
      heroImage: clampStr(lp.heroImage, 1000),
      description: clampStr(lp.description, 6000),
      ctaText: clampStr(lp.ctaText, 80),
      accentColor: clampStr(lp.accentColor, 30),
      highlights: clampStrArray(lp.highlights, 15, 200),
      viewsCount: clampNumber(lp.viewsCount, 0),
      leadsCount: clampNumber(lp.leadsCount, 0),
      seoTitle: clampStr(lp.seoTitle, 160),
      seoDescription: clampStr(lp.seoDescription, 320),
    } as Record<string, unknown>);

    if (isNew) {
      await setDoc(doc(db, 'landingPages', lp.id), {
        ...sanitized,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } else {
      delete sanitized.id;
      delete sanitized.tenantId;
      delete sanitized.ownerUid;
      delete sanitized.createdAt;
      await updateDoc(doc(db, 'landingPages', lp.id), {
        ...sanitized,
        updatedAt: serverTimestamp(),
      });
    }
  } catch (err) {
    handleFirestoreError(err, isNew ? OperationType.CREATE : OperationType.UPDATE, path);
  }
}

export async function deleteLandingPage(id: string): Promise<void> {
  try {
    await deleteDoc(doc(db, 'landingPages', id));
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, `landingPages/${id}`);
  }
}

// Testimonials
export function subscribePublishedTestimonials(
  tenantId: string,
  onData: (items: Testimonial[]) => void
): Unsubscribe {
  const q = query(
    collection(db, 'testimonials'),
    where('tenantId', '==', tenantId),
    where('status', '==', 'published')
  );
  return onSnapshot(
    q,
    (snap) => onData(snap.docs.map((d) => d.data() as Testimonial)),
    (err) => handleFirestoreError(err, OperationType.LIST, 'testimonials')
  );
}

export function subscribeManagedTestimonials(
  tenantId: string,
  ownerUid: string,
  isAdmin: boolean,
  onData: (items: Testimonial[]) => void
): Unsubscribe {
  const q = isAdmin
    ? query(collection(db, 'testimonials'), where('tenantId', '==', tenantId))
    : query(
        collection(db, 'testimonials'),
        where('tenantId', '==', tenantId),
        where('ownerUid', '==', ownerUid)
      );
  return onSnapshot(
    q,
    (snap) => onData(snap.docs.map((d) => d.data() as Testimonial)),
    (err) => handleFirestoreError(err, OperationType.LIST, 'testimonials')
  );
}

export async function saveTestimonial(
  item: Omit<Testimonial, 'createdAt' | 'updatedAt'>,
  isNew: boolean
): Promise<void> {
  try {
    const sanitized = cleanUndefined({
      ...item,
      clientName: clampStr(item.clientName, 120),
      clientRole: clampStr(item.clientRole, 120),
      quote: clampStr(item.quote, 1200),
      propertyReference: clampStr(item.propertyReference, 160),
    } as Record<string, unknown>);

    if (isNew) {
      await setDoc(doc(db, 'testimonials', item.id), {
        ...sanitized,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } else {
      delete sanitized.id;
      delete sanitized.tenantId;
      delete sanitized.ownerUid;
      delete sanitized.createdAt;
      await updateDoc(doc(db, 'testimonials', item.id), {
        ...sanitized,
        updatedAt: serverTimestamp(),
      });
    }
  } catch (err) {
    handleFirestoreError(err, isNew ? OperationType.CREATE : OperationType.UPDATE, `testimonials/${item.id}`);
  }
}

export async function deleteTestimonial(id: string): Promise<void> {
  try {
    await deleteDoc(doc(db, 'testimonials', id));
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, `testimonials/${id}`);
  }
}

// Leads (Public Create with LGPD consent; Private Read/Manage)
export async function submitPublicLead(
  lead: Omit<Lead, 'id' | 'status' | 'notes' | 'createdAt' | 'updatedAt'>
): Promise<string> {
  if (!lead.ownerUid) {
    throw new Error('Canal de atendimento aguardando ativação pelo corretor responsável.');
  }
  const id = generateSafeId('lead');
  try {
    await setDoc(doc(db, 'leads', id), {
      ...cleanUndefined({
        ...lead,
        id,
        status: 'new',
        notes: '',
        lgpdConsent: true,
      } as unknown as Record<string, unknown>),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return id;
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, `leads/${id}`);
  }
}

export function subscribeManagedLeads(
  tenantId: string,
  ownerUid: string,
  isAdmin: boolean,
  onData: (items: Lead[]) => void
): Unsubscribe {
  const q = isAdmin
    ? query(collection(db, 'leads'), where('tenantId', '==', tenantId))
    : query(
        collection(db, 'leads'),
        where('tenantId', '==', tenantId),
        where('ownerUid', '==', ownerUid)
      );
  return onSnapshot(
    q,
    (snap) => onData(snap.docs.map((d) => d.data() as Lead)),
    (err) => handleFirestoreError(err, OperationType.LIST, 'leads')
  );
}

export async function updateLeadStatus(leadId: string, status: Lead['status'], notes: string): Promise<void> {
  try {
    await updateDoc(doc(db, 'leads', leadId), {
      status,
      notes: notes.slice(0, 2000),
      updatedAt: serverTimestamp(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `leads/${leadId}`);
  }
}

export async function deleteLead(leadId: string): Promise<void> {
  try {
    await deleteDoc(doc(db, 'leads', leadId));
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, `leads/${leadId}`);
  }
}

// Analytics Events
export async function trackPublicEvent(
  event: Omit<AnalyticsEvent, 'id' | 'createdAt'>
): Promise<void> {
  if (!event.ownerUid || !event.tenantId) return;
  const id = generateSafeId('evt');
  try {
    await setDoc(doc(db, 'analyticsEvents', id), {
      ...cleanUndefined({ ...event, id } as unknown as Record<string, unknown>),
      createdAt: serverTimestamp(),
    });
  } catch {
    // Non-blocking telemetry
  }
}

export function subscribeManagedAnalytics(
  tenantId: string,
  ownerUid: string,
  isAdmin: boolean,
  onData: (items: AnalyticsEvent[]) => void
): Unsubscribe {
  const q = isAdmin
    ? query(collection(db, 'analyticsEvents'), where('tenantId', '==', tenantId))
    : query(
        collection(db, 'analyticsEvents'),
        where('tenantId', '==', tenantId),
        where('ownerUid', '==', ownerUid)
      );
  return onSnapshot(
    q,
    (snap) => onData(snap.docs.map((d) => d.data() as AnalyticsEvent)),
    (err) => handleFirestoreError(err, OperationType.LIST, 'analyticsEvents')
  );
}

// Campaigns
export function subscribeManagedCampaigns(
  tenantId: string,
  ownerUid: string,
  isAdmin: boolean,
  onData: (items: Campaign[]) => void
): Unsubscribe {
  const q = isAdmin
    ? query(collection(db, 'campaigns'), where('tenantId', '==', tenantId))
    : query(
        collection(db, 'campaigns'),
        where('tenantId', '==', tenantId),
        where('ownerUid', '==', ownerUid)
      );
  return onSnapshot(
    q,
    (snap) => onData(snap.docs.map((d) => d.data() as Campaign)),
    (err) => handleFirestoreError(err, OperationType.LIST, 'campaigns')
  );
}

export async function saveCampaign(c: Omit<Campaign, 'createdAt' | 'updatedAt'>, isNew: boolean): Promise<void> {
  try {
    if (isNew) {
      await setDoc(doc(db, 'campaigns', c.id), {
        ...cleanUndefined(c as unknown as Record<string, unknown>),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } else {
      const payload = cleanUndefined(c as unknown as Record<string, unknown>);
      delete payload.id;
      delete payload.tenantId;
      delete payload.ownerUid;
      delete payload.createdAt;
      await updateDoc(doc(db, 'campaigns', c.id), {
        ...payload,
        updatedAt: serverTimestamp(),
      });
    }
  } catch (err) {
    handleFirestoreError(err, isNew ? OperationType.CREATE : OperationType.UPDATE, `campaigns/${c.id}`);
  }
}

// AI Jobs
export function subscribeManagedAiJobs(
  tenantId: string,
  ownerUid: string,
  isAdmin: boolean,
  onData: (items: AiJob[]) => void
): Unsubscribe {
  const q = isAdmin
    ? query(collection(db, 'aiJobs'), where('tenantId', '==', tenantId))
    : query(
        collection(db, 'aiJobs'),
        where('tenantId', '==', tenantId),
        where('ownerUid', '==', ownerUid)
      );
  return onSnapshot(
    q,
    (snap) => onData(snap.docs.map((d) => d.data() as AiJob)),
    (err) => handleFirestoreError(err, OperationType.LIST, 'aiJobs')
  );
}

export async function saveAiJob(job: Omit<AiJob, 'createdAt' | 'updatedAt'>): Promise<void> {
  try {
    await setDoc(doc(db, 'aiJobs', job.id), {
      ...cleanUndefined(job as unknown as Record<string, unknown>),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, `aiJobs/${job.id}`);
  }
}

// Audit Logs
export function subscribeAuditLogs(
  tenantId: string,
  ownerUid: string,
  isAdmin: boolean,
  onData: (items: AuditLog[]) => void
): Unsubscribe {
  const q = isAdmin
    ? query(collection(db, 'auditLogs'), where('tenantId', '==', tenantId))
    : query(
        collection(db, 'auditLogs'),
        where('tenantId', '==', tenantId),
        where('ownerUid', '==', ownerUid)
      );
  return onSnapshot(
    q,
    (snap) => onData(snap.docs.map((d) => d.data() as AuditLog)),
    (err) => handleFirestoreError(err, OperationType.LIST, 'auditLogs')
  );
}

export async function writeAuditLog(log: Omit<AuditLog, 'id' | 'createdAt'>): Promise<void> {
  const id = generateSafeId('audit');
  try {
    await setDoc(doc(db, 'auditLogs', id), {
      ...cleanUndefined({ ...log, id } as unknown as Record<string, unknown>),
      createdAt: serverTimestamp(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, `auditLogs/${id}`);
  }
}
