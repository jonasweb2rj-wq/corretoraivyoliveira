import React, { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  BarChart3,
  Building2,
  Check,
  Copy,
  Download,
  ExternalLink,
  Eye,
  EyeOff,
  FileText,
  Home,
  KeyRound,
  LayoutGrid,
  LogOut,
  MessageSquareQuote,
  Palette,
  Plus,
  Search,
  Shield,
  Sparkles,
  Star,
  Trash2,
  Upload,
  Users,
} from 'lucide-react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { doc, serverTimestamp, setDoc } from 'firebase/firestore';
import { useAppContext } from '../../hooks/useAuthTenant';
import { db } from '../../firebase/config';
import {
  deleteDevelopment,
  deleteLandingPage,
  deleteLead,
  deleteProperty,
  deleteTestimonial,
  listTenants,
  saveCampaign,
  saveDevelopment,
  saveLandingPage,
  saveProperty,
  saveTestimonial,
  subscribeAuditLogs,
  subscribeManagedAnalytics,
  subscribeManagedCampaigns,
  subscribeManagedDevelopments,
  subscribeManagedLandingPages,
  subscribeManagedLeads,
  subscribeManagedProperties,
  subscribeManagedTestimonials,
  updateLeadStatus,
  updateTenantSettings,
  writeAuditLog,
} from '../../firebase/firestoreService';
import {
  AnalyticsEvent,
  AuditLog,
  Campaign,
  Development,
  LandingPage,
  Lead,
  LeadStatus,
  Property,
  PropertyMediaItem,
  Tenant,
  Testimonial,
  ThemeConfig,
  ThemePresetId,
} from '../../types/realestate';
import { THEME_PRESETS } from '../../config/themes';
import { DEFAULT_TENANT } from '../../config/defaultTenant';
import {
  formatCurrencyBRL,
  generateSafeId,
  leadStatusLabel,
  propertyTypeLabel,
  slugify,
  transactionTypeLabel,
} from '../../utils/formatters';
import { applySeoMetadata } from '../../utils/seo';
import { deleteMediaOnServer, uploadMediaToServer } from '../../services/mediaService';
import { PropertyEditorModal } from './PropertyEditorModal';

interface AdminDashboardProps {
  onNavigate: (to: string) => void;
}

type AdminTab =
  | 'dashboard'
  | 'properties'
  | 'developments'
  | 'landing-pages'
  | 'leads'
  | 'marketing'
  | 'branding'
  | 'security'
  | 'tenants';

interface HealthStatus {
  capabilities?: {
    geminiAi: boolean;
    vercelBlob: boolean;
    storageMode: 'vercel-blob' | 'local-preview';
    virtualTourPro?: boolean;
  };
}

function formatTimestampDate(ts: unknown): string {
  if (!ts) return '—';
  if (typeof ts === 'object' && ts !== null && 'toDate' in ts && typeof (ts as { toDate: () => Date }).toDate === 'function') {
    return (ts as { toDate: () => Date }).toDate().toLocaleDateString('pt-BR');
  }
  return '—';
}

function getDateKey(ts: unknown): string {
  if (typeof ts === 'object' && ts !== null && 'toDate' in ts && typeof (ts as { toDate: () => Date }).toDate === 'function') {
    return (ts as { toDate: () => Date }).toDate().toISOString().slice(0, 10);
  }
  return new Date().toISOString().slice(0, 10);
}

export function AdminDashboard({ onNavigate }: AdminDashboardProps) {
  const { user, profile, isAdmin, tenant, activeTenantId, setActiveTenantId, updateUserPassword, logout } = useAppContext();
  const [tab, setTab] = useState<AdminTab>('dashboard');

  // Real-time Firestore collections
  const [properties, setProperties] = useState<Property[]>([]);
  const [developments, setDevelopments] = useState<Development[]>([]);
  const [landingPages, setLandingPages] = useState<LandingPage[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [testimonials, setTestimonials] = useState<Testimonial[]>([]);
  const [analyticsEvents, setAnalyticsEvents] = useState<AnalyticsEvent[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [allTenants, setAllTenants] = useState<Tenant[]>([]);
  const [health, setHealth] = useState<HealthStatus | null>(null);

  // Toast / Alert feedback
  const [notice, setNotice] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  // Property modal & filters
  const [editingProperty, setEditingProperty] = useState<Property | null | undefined>(undefined);
  const [propQuery, setPropQuery] = useState('');
  const [propStatusFilter, setPropStatusFilter] = useState<string>('all');

  // Development form state
  const [devModalOpen, setDevModalOpen] = useState(false);
  const [editingDevId, setEditingDevId] = useState<string | null>(null);
  const [devName, setDevName] = useState('');
  const [devDeveloper, setDevDeveloper] = useState('');
  const [devCategory, setDevCategory] = useState<Development['category']>('lancamento');
  const [devCity, setDevCity] = useState('Rio de Janeiro');
  const [devNeighborhood, setDevNeighborhood] = useState('');
  const [devDeliveryDate, setDevDeliveryDate] = useState('');
  const [devPriceFrom, setDevPriceFrom] = useState(0);
  const [devDescription, setDevDescription] = useState('');
  const [devSpecsText, setDevSpecsText] = useState('');
  const [devCoverImage, setDevCoverImage] = useState('');
  const [devImages, setDevImages] = useState<PropertyMediaItem[]>([]);
  const [devFloorPlans, setDevFloorPlans] = useState<PropertyMediaItem[]>([]);
  const [devStatus, setDevStatus] = useState<'draft' | 'published'>('draft');
  const [devFeatured, setDevFeatured] = useState(false);
  const [devUploading, setDevUploading] = useState(false);

  // Landing page form state
  const [lpModalOpen, setLpModalOpen] = useState(false);
  const [editingLpId, setEditingLpId] = useState<string | null>(null);
  const [lpPropertyId, setLpPropertyId] = useState('');
  const [lpTemplate, setLpTemplate] = useState<LandingPage['template']>('editorial-luxo');
  const [lpTitle, setLpTitle] = useState('');
  const [lpSubtitle, setLpSubtitle] = useState('');
  const [lpSlug, setLpSlug] = useState('');
  const [lpHeroImage, setLpHeroImage] = useState('');
  const [lpDescription, setLpDescription] = useState('');
  const [lpCtaText, setLpCtaText] = useState('Solicitar Apresentação Completa');
  const [lpAccentColor, setLpAccentColor] = useState('#9A744B');
  const [lpHighlightsText, setLpHighlightsText] = useState('');
  const [lpStatus, setLpStatus] = useState<'draft' | 'published'>('draft');

  // Leads CRM state
  const [leadQuery, setLeadQuery] = useState('');
  const [leadStatusFilter, setLeadStatusFilter] = useState<string>('all');
  const [leadNotesDraft, setLeadNotesDraft] = useState<Record<string, string>>({});

  // Testimonials & Campaigns state
  const [testName, setTestName] = useState('');
  const [testRole, setTestRole] = useState('');
  const [testQuote, setTestQuote] = useState('');
  const [testPropRef, setTestPropRef] = useState('');
  const [testStatus, setTestStatus] = useState<'draft' | 'published'>('published');

  const [campName, setCampName] = useState('');
  const [campChannel, setCampChannel] = useState('Google Ads');
  const [campUtmSource, setCampUtmSource] = useState('google');
  const [campUtmMedium, setCampUtmMedium] = useState('cpc');
  const [campUtmCampaign, setCampUtmCampaign] = useState('');
  const [campBudget, setCampBudget] = useState(0);

  // Branding & Settings form state synced from active tenant
  const [brandForm, setBrandForm] = useState<Tenant>(tenant);
  const [regionsInput, setRegionsInput] = useState(tenant.regions.join(', '));
  const [specialtiesInput, setSpecialtiesInput] = useState(tenant.specialties.join('\n'));
  const [savingBrand, setSavingBrand] = useState(false);

  // New Tenant form (platform admin)
  const [newTenantBrand, setNewTenantBrand] = useState('');
  const [newTenantBroker, setNewTenantBroker] = useState('');
  const [newTenantCity, setNewTenantCity] = useState('Rio de Janeiro');
  const [newTenantState, setNewTenantState] = useState('RJ');

  // Security & Password update state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [showCurrentPwd, setShowCurrentPwd] = useState(false);
  const [showNewPwd, setShowNewPwd] = useState(false);
  const [showConfirmPwd, setShowConfirmPwd] = useState(false);
  const [updatingPassword, setUpdatingPassword] = useState(false);

  useEffect(() => {
    applySeoMetadata({
      title: `Painel Admin — ${tenant.brandName}`,
      description: 'Painel de gerenciamento imobiliário.',
      noIndex: true,
    });
  }, [tenant.brandName]);

  useEffect(() => {
    setBrandForm(tenant);
    setRegionsInput((tenant.regions || []).join(', '));
    setSpecialtiesInput((tenant.specialties || []).join('\n'));
  }, [tenant]);

  useEffect(() => {
    fetch('/api/health')
      .then((r) => r.json())
      .then((data) => setHealth(data))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!user) return;
    const u1 = subscribeManagedProperties(activeTenantId, user.uid, isAdmin, setProperties);
    const u2 = subscribeManagedDevelopments(activeTenantId, user.uid, isAdmin, setDevelopments);
    const u3 = subscribeManagedLandingPages(activeTenantId, user.uid, isAdmin, setLandingPages);
    const u4 = subscribeManagedLeads(activeTenantId, user.uid, isAdmin, setLeads);
    const u5 = subscribeManagedTestimonials(activeTenantId, user.uid, isAdmin, setTestimonials);
    const u6 = subscribeManagedAnalytics(activeTenantId, user.uid, isAdmin, setAnalyticsEvents);
    const u7 = subscribeManagedCampaigns(activeTenantId, user.uid, isAdmin, setCampaigns);
    const u8 = subscribeAuditLogs(activeTenantId, user.uid, isAdmin, setAuditLogs);

    listTenants(isAdmin, user.uid)
      .then(setAllTenants)
      .catch(() => {});

    return () => {
      u1();
      u2();
      u3();
      u4();
      u5();
      u6();
      u7();
      u8();
    };
  }, [activeTenantId, user, isAdmin]);

  const showNotice = (type: 'ok' | 'err', text: string) => {
    setNotice({ type, text });
    window.setTimeout(() => setNotice(null), 4500);
  };

  // Real Aggregations for Analytics Dashboard
  const kpis = useMemo(() => {
    const publishedProps = properties.filter((p) => p.status === 'published').length;
    const totalViews = analyticsEvents.filter(
      (e) => e.eventType === 'page_view' || e.eventType === 'property_view'
    ).length;
    const whatsappClicks = analyticsEvents.filter((e) => e.eventType === 'whatsapp_click').length;
    const virtualTours = analyticsEvents.filter((e) => e.eventType === 'virtual_tour_open').length;
    const newLeads = leads.filter((l) => l.status === 'new').length;
    return {
      publishedProps,
      totalProps: properties.length,
      totalDevs: developments.length,
      totalLps: landingPages.length,
      totalLeads: leads.length,
      newLeads,
      totalViews,
      whatsappClicks,
      virtualTours,
    };
  }, [properties, developments, landingPages, leads, analyticsEvents]);

  const chartTimeline = useMemo(() => {
    const bucket = new Map<string, { date: string; visualizacoes: number; contatos: number }>();
    for (const ev of analyticsEvents) {
      const key = getDateKey(ev.createdAt);
      const cur = bucket.get(key) || { date: key.slice(5), visualizacoes: 0, contatos: 0 };
      if (ev.eventType === 'lead_submit' || ev.eventType === 'whatsapp_click') {
        cur.contatos += 1;
      } else {
        cur.visualizacoes += 1;
      }
      bucket.set(key, cur);
    }
    return Array.from(bucket.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-14)
      .map(([, v]) => v);
  }, [analyticsEvents]);

  const leadFunnelData = useMemo(() => {
    const statuses: LeadStatus[] = ['new', 'in_progress', 'scheduled', 'converted', 'lost'];
    return statuses.map((st) => ({
      etapa: leadStatusLabel(st),
      quantidade: leads.filter((l) => l.status === st).length,
    }));
  }, [leads]);

  // Property Actions
  const filteredProperties = useMemo(() => {
    const q = propQuery.trim().toLowerCase();
    return properties.filter((p) => {
      if (propStatusFilter !== 'all' && p.status !== propStatusFilter) return false;
      if (q) {
        const hay = `${p.title} ${p.code} ${p.neighborhood} ${p.city}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [properties, propQuery, propStatusFilter]);

  const handleTogglePropertyStatus = async (prop: Property) => {
    if (!user) return;
    const nextStatus = prop.status === 'published' ? 'draft' : 'published';
    try {
      await saveProperty({ ...prop, status: nextStatus }, false);
      await writeAuditLog({
        tenantId: activeTenantId,
        ownerUid: prop.ownerUid,
        actorUid: user.uid,
        actorEmail: user.email || '',
        action: 'toggle_property_status',
        entityType: 'property',
        entityId: prop.id,
        summary: `Alterou status de "${prop.title}" para ${nextStatus}`,
      });
      showNotice('ok', `Imóvel ${nextStatus === 'published' ? 'publicado no site em tempo real' : 'movido para rascunho'}.`);
    } catch (err) {
      showNotice('err', err instanceof Error ? err.message : 'Erro ao alterar status do imóvel.');
    }
  };

  const handleTogglePropertyFeatured = async (prop: Property) => {
    if (!user) return;
    try {
      await saveProperty({ ...prop, featured: !prop.featured }, false);
      await writeAuditLog({
        tenantId: activeTenantId,
        ownerUid: prop.ownerUid,
        actorUid: user.uid,
        actorEmail: user.email || '',
        action: 'toggle_property_featured',
        entityType: 'property',
        entityId: prop.id,
        summary: `${!prop.featured ? 'Destacou' : 'Removeu destaque de'} "${prop.title}"`,
      });
      showNotice('ok', !prop.featured ? 'Imóvel destacado na Home.' : 'Destaque removido.');
    } catch (err) {
      showNotice('err', err instanceof Error ? err.message : 'Erro ao atualizar destaque do imóvel.');
    }
  };

  const handleDuplicateProperty = async (prop: Property) => {
    if (!user) return;
    const newId = generateSafeId('prop');
    const newCode = `${prop.code}-CP`;
    const copy: Omit<Property, 'createdAt' | 'updatedAt'> = {
      ...prop,
      id: newId,
      ownerUid: tenant.ownerUid || user.uid,
      code: newCode,
      title: `${prop.title} (Cópia)`,
      slug: `${slugify(prop.title)}-copia-${Date.now().toString(36).slice(-4)}`,
      status: 'draft',
      featured: false,
      viewsCount: 0,
    };
    try {
      await saveProperty(copy, true);
      await writeAuditLog({
        tenantId: activeTenantId,
        ownerUid: copy.ownerUid,
        actorUid: user.uid,
        actorEmail: user.email || '',
        action: 'duplicate_property',
        entityType: 'property',
        entityId: newId,
        summary: `Duplicou imóvel "${prop.title}" como rascunho`,
      });
      showNotice('ok', 'Cópia criada como rascunho.');
    } catch (err) {
      showNotice('err', err instanceof Error ? err.message : 'Erro ao duplicar imóvel.');
    }
  };

  const handleDeleteProperty = async (prop: Property) => {
    if (!user) return;
    try {
      await deleteProperty(prop.id);
      const mediaToClean = [
        ...(prop.images || []),
        ...(prop.panorama360Images || []),
      ];
      await Promise.all(
        mediaToClean.map((item) =>
          deleteMediaOnServer(activeTenantId, item.url, item.pathname).catch(() => {})
        )
      );
      await writeAuditLog({
        tenantId: activeTenantId,
        ownerUid: prop.ownerUid,
        actorUid: user.uid,
        actorEmail: user.email || '',
        action: 'delete_property',
        entityType: 'property',
        entityId: prop.id,
        summary: `Removeu imóvel "${prop.title}"`,
      });
      showNotice('ok', 'Imóvel removido permanentemente do banco e do site.');
    } catch (err) {
      showNotice('err', err instanceof Error ? err.message : 'Erro ao remover imóvel.');
    }
  };

  // Development CRUD handlers
  const openDevEditor = (dev?: Development) => {
    if (dev) {
      setEditingDevId(dev.id);
      setDevName(dev.name);
      setDevDeveloper(dev.developer || '');
      setDevCategory(dev.category);
      setDevCity(dev.city);
      setDevNeighborhood(dev.neighborhood);
      setDevDeliveryDate(dev.deliveryDate || '');
      setDevPriceFrom(dev.priceFrom || 0);
      setDevDescription(dev.description || '');
      setDevSpecsText((dev.technicalSpecs || []).join('\n'));
      setDevCoverImage(dev.coverImage || '');
      setDevImages(dev.images || []);
      setDevFloorPlans(dev.floorPlans || []);
      setDevStatus(dev.status);
      setDevFeatured(dev.featured);
    } else {
      setEditingDevId(null);
      setDevName('');
      setDevDeveloper('');
      setDevCategory('lancamento');
      setDevCity(tenant.city || 'Rio de Janeiro');
      setDevNeighborhood('');
      setDevDeliveryDate('');
      setDevPriceFrom(0);
      setDevDescription('');
      setDevSpecsText('');
      setDevCoverImage('');
      setDevImages([]);
      setDevFloorPlans([]);
      setDevStatus('published');
      setDevFeatured(false);
    }
    setDevModalOpen(true);
  };

  const handleDevMediaUpload = async (
    e: React.ChangeEvent<HTMLInputElement>,
    target: 'gallery' | 'floorplan'
  ) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    setDevUploading(true);
    try {
      const items: PropertyMediaItem[] = [];
      for (const file of files) {
        const res = await uploadMediaToServer({
          tenantId: activeTenantId,
          file,
          filename: file.name,
          mimeType: file.type,
          folder: 'developments',
        });
        items.push({
          id: generateSafeId('devimg'),
          url: res.url,
          pathname: res.pathname,
          roomTag: target === 'floorplan' ? 'Planta' : 'Empreendimento',
          caption: file.name.replace(/\.[^.]+$/, ''),
        });
      }
      if (target === 'floorplan') {
        setDevFloorPlans((prev) => [...prev, ...items]);
      } else {
        setDevImages((prev) => {
          const next = [...prev, ...items];
          if (!devCoverImage && next[0]) setDevCoverImage(next[0].url);
          return next;
        });
      }
    } catch (err) {
      showNotice('err', err instanceof Error ? err.message : 'Falha no upload.');
    } finally {
      setDevUploading(false);
      e.target.value = '';
    }
  };

  const handleRemoveDevImage = (item: PropertyMediaItem, target: 'gallery' | 'floorplan') => {
    if (target === 'floorplan') {
      setDevFloorPlans((prev) => prev.filter((p) => p.id !== item.id));
    } else {
      setDevImages((prev) => {
        const next = prev.filter((p) => p.id !== item.id);
        if (devCoverImage === item.url) {
          setDevCoverImage(next[0]?.url || '');
        }
        return next;
      });
    }
    deleteMediaOnServer(activeTenantId, item.url, item.pathname).catch(() => {});
  };

  const handleToggleDevelopmentStatus = async (dev: Development) => {
    if (!user) return;
    const nextStatus = dev.status === 'published' ? 'draft' : 'published';
    try {
      await saveDevelopment({ ...dev, status: nextStatus }, false);
      await writeAuditLog({
        tenantId: activeTenantId,
        ownerUid: dev.ownerUid,
        actorUid: user.uid,
        actorEmail: user.email || '',
        action: 'toggle_development_status',
        entityType: 'development',
        entityId: dev.id,
        summary: `Alterou status de "${dev.name}" para ${nextStatus}`,
      });
      showNotice('ok', `Empreendimento ${nextStatus === 'published' ? 'publicado no site em tempo real' : 'movido para rascunho'}.`);
    } catch (err) {
      showNotice('err', err instanceof Error ? err.message : 'Erro ao alterar status do empreendimento.');
    }
  };

  const handleDeleteDevelopment = async (dev: Development) => {
    if (!user) return;
    try {
      await deleteDevelopment(dev.id);
      const mediaToClean = [...(dev.images || []), ...(dev.floorPlans || [])];
      await Promise.all(
        mediaToClean.map((item) =>
          deleteMediaOnServer(activeTenantId, item.url, item.pathname).catch(() => {})
        )
      );
      await writeAuditLog({
        tenantId: activeTenantId,
        ownerUid: dev.ownerUid,
        actorUid: user.uid,
        actorEmail: user.email || '',
        action: 'delete_development',
        entityType: 'development',
        entityId: dev.id,
        summary: `Removeu empreendimento "${dev.name}"`,
      });
      showNotice('ok', 'Empreendimento removido permanentemente do banco e do site.');
    } catch (err) {
      showNotice('err', err instanceof Error ? err.message : 'Erro ao remover empreendimento.');
    }
  };

  const handleSaveDevelopment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !devName.trim() || !devNeighborhood.trim()) {
      showNotice('err', 'Informe o nome e o bairro do empreendimento.');
      return;
    }
    const id = editingDevId || generateSafeId('dev');
    const existing = developments.find((d) => d.id === id);
    const payload: Omit<Development, 'createdAt' | 'updatedAt'> = {
      id,
      tenantId: activeTenantId,
      ownerUid: existing?.ownerUid || tenant.ownerUid || user.uid,
      slug: existing?.slug || `${slugify(devName)}-${id.slice(-4).toLowerCase()}`,
      name: devName.trim(),
      developer: devDeveloper.trim(),
      category: devCategory,
      city: devCity.trim() || 'Rio de Janeiro',
      neighborhood: devNeighborhood.trim(),
      deliveryDate: devDeliveryDate.trim(),
      priceFrom: Number(devPriceFrom) || 0,
      description: devDescription.trim(),
      technicalSpecs: devSpecsText.split('\n').map((s) => s.trim()).filter(Boolean).slice(0, 30),
      coverImage: devCoverImage || devImages[0]?.url || '',
      images: devImages,
      floorPlans: devFloorPlans,
      videos: existing?.videos || [],
      status: devStatus,
      featured: devFeatured,
      seoTitle: `${devName.trim()} — ${tenant.brandName}`,
      seoDescription: devDescription.trim().slice(0, 155),
    };
    try {
      await saveDevelopment(payload, !editingDevId);
      await writeAuditLog({
        tenantId: activeTenantId,
        ownerUid: payload.ownerUid,
        actorUid: user.uid,
        actorEmail: user.email || '',
        action: editingDevId ? 'update_development' : 'create_development',
        entityType: 'development',
        entityId: id,
        summary: `${editingDevId ? 'Atualizou' : 'Cadastrou'} empreendimento "${payload.name}" (${payload.status})`,
      });
      setDevModalOpen(false);
      showNotice('ok', `Empreendimento salvo e ${payload.status === 'published' ? 'publicado em tempo real!' : 'salvo como rascunho.'}`);
    } catch (err) {
      showNotice('err', err instanceof Error ? err.message : 'Erro ao salvar empreendimento.');
    }
  };

  // Landing Page CRUD handlers
  const openLpEditor = (lp?: LandingPage) => {
    if (lp) {
      setEditingLpId(lp.id);
      setLpPropertyId(lp.propertyId || '');
      setLpTemplate(lp.template);
      setLpTitle(lp.title);
      setLpSubtitle(lp.subtitle || '');
      setLpSlug(lp.slug);
      setLpHeroImage(lp.heroImage || '');
      setLpDescription(lp.description || '');
      setLpCtaText(lp.ctaText || 'Solicitar Apresentação Completa');
      setLpAccentColor(lp.accentColor || tenant.themeConfig.accentColor);
      setLpHighlightsText((lp.highlights || []).join('\n'));
      setLpStatus(lp.status);
    } else {
      setEditingLpId(null);
      setLpPropertyId('');
      setLpTemplate('editorial-luxo');
      setLpTitle('');
      setLpSubtitle('');
      setLpSlug('');
      setLpHeroImage('');
      setLpDescription('');
      setLpCtaText('Solicitar Apresentação Completa');
      setLpAccentColor(tenant.themeConfig.accentColor);
      setLpHighlightsText('');
      setLpStatus('draft');
    }
    setLpModalOpen(true);
  };

  const handlePrefillLpFromProperty = (propId: string) => {
    setLpPropertyId(propId);
    const p = properties.find((item) => item.id === propId);
    if (!p) return;
    setLpTitle(p.title);
    setLpSubtitle(p.summary || `${propertyTypeLabel(p.propertyType)} em ${p.neighborhood}, ${p.city}`);
    setLpSlug(slugify(`${p.title}-${p.code}`));
    setLpHeroImage(p.coverImage || p.images?.[0]?.url || '');
    setLpDescription(p.description || '');
    setLpHighlightsText([...(p.differentials || []), ...(p.features || [])].slice(0, 8).join('\n'));
  };

  const handleSaveLandingPage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !lpTitle.trim()) {
      showNotice('err', 'Informe o título da landing page.');
      return;
    }
    const id = editingLpId || generateSafeId('lp');
    const existing = landingPages.find((l) => l.id === id);
    const cleanSlug = slugify(lpSlug || lpTitle);
    const payload: Omit<LandingPage, 'createdAt' | 'updatedAt'> = {
      id,
      tenantId: activeTenantId,
      ownerUid: existing?.ownerUid || tenant.ownerUid || user.uid,
      propertyId: lpPropertyId,
      slug: cleanSlug,
      template: lpTemplate,
      title: lpTitle.trim(),
      subtitle: lpSubtitle.trim(),
      heroImage: lpHeroImage.trim(),
      description: lpDescription.trim(),
      ctaText: lpCtaText.trim() || 'Solicitar Atendimento',
      accentColor: lpAccentColor,
      highlights: lpHighlightsText.split('\n').map((s) => s.trim()).filter(Boolean).slice(0, 15),
      status: lpStatus,
      viewsCount: existing?.viewsCount ?? 0,
      leadsCount: existing?.leadsCount ?? 0,
      seoTitle: `${lpTitle.trim()} — ${tenant.brandName}`,
      seoDescription: (lpSubtitle || lpDescription).trim().slice(0, 155),
    };
    try {
      await saveLandingPage(payload, !editingLpId);
      await writeAuditLog({
        tenantId: activeTenantId,
        ownerUid: payload.ownerUid,
        actorUid: user.uid,
        actorEmail: user.email || '',
        action: editingLpId ? 'update_landing_page' : 'create_landing_page',
        entityType: 'landingPage',
        entityId: id,
        summary: `${editingLpId ? 'Atualizou' : 'Criou'} landing page "/oferta/${cleanSlug}"`,
      });
      setLpModalOpen(false);
      showNotice('ok', `Landing page salva! URL: /oferta/${cleanSlug}`);
    } catch (err) {
      showNotice('err', err instanceof Error ? err.message : 'Erro ao salvar landing page.');
    }
  };

  const handleDeleteLandingPage = async (lp: LandingPage) => {
    if (!user) return;
    try {
      await deleteLandingPage(lp.id);
      await writeAuditLog({
        tenantId: activeTenantId,
        ownerUid: lp.ownerUid,
        actorUid: user.uid,
        actorEmail: user.email || '',
        action: 'delete_landing_page',
        entityType: 'landingPage',
        entityId: lp.id,
        summary: `Removeu landing page "/oferta/${lp.slug}"`,
      });
      showNotice('ok', 'Landing page removida permanentemente.');
    } catch (err) {
      showNotice('err', err instanceof Error ? err.message : 'Erro ao remover landing page.');
    }
  };

  // Lead CRM filter & CSV Export
  const filteredLeads = useMemo(() => {
    const q = leadQuery.trim().toLowerCase();
    return leads.filter((l) => {
      if (leadStatusFilter !== 'all' && l.status !== leadStatusFilter) return false;
      if (q) {
        const hay = `${l.name} ${l.phone} ${l.email} ${l.propertyTitle}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [leads, leadQuery, leadStatusFilter]);

  const handleExportLeadsCsv = () => {
    const headers = ['Data', 'Nome', 'Telefone', 'E-mail', 'Interesse', 'Imóvel', 'Status', 'Origem', 'Notas'];
    const rows = filteredLeads.map((l) => [
      formatTimestampDate(l.createdAt),
      l.name,
      l.phone,
      l.email || '',
      l.interest,
      l.propertyTitle || '',
      leadStatusLabel(l.status),
      l.utmSource || l.source || '',
      (l.notes || '').replace(/[\r\n]+/g, ' '),
    ]);
    const csv = [headers, ...rows]
      .map((r) => r.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
      .join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `leads-${tenant.slug}-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Branding & Theme handlers
  const handleApplyPreset = (presetId: ThemePresetId) => {
    const preset = THEME_PRESETS[presetId];
    setBrandForm((prev) => ({
      ...prev,
      themePreset: presetId,
      themeConfig: { ...preset.config },
    }));
    showNotice('ok', `Tema "${preset.name}" aplicado ao formulário. Salve para publicar ao vivo.`);
  };

  const handleBrandImageUpload = async (
    e: React.ChangeEvent<HTMLInputElement>,
    field: 'logoUrl' | 'faviconUrl' | 'aboutPhotoUrl' | 'heroImages'
  ) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    try {
      const urls: string[] = [];
      for (const file of files) {
        const res = await uploadMediaToServer({
          tenantId: activeTenantId,
          file,
          filename: file.name,
          mimeType: file.type,
          folder: 'branding',
          preserveTransparency: field === 'logoUrl' || field === 'faviconUrl' || field === 'aboutPhotoUrl',
        });
        urls.push(res.url);
      }
      if (field === 'heroImages') {
        setBrandForm((prev) => ({ ...prev, heroImages: [...(prev.heroImages || []), ...urls] }));
      } else {
        setBrandForm((prev) => ({ ...prev, [field]: urls[0] }));
      }
      showNotice('ok', 'Imagem enviada e vinculada. Clique em "Salvar Alterações" para publicar.');
    } catch (err) {
      showNotice('err', err instanceof Error ? err.message : 'Erro no upload.');
    } finally {
      e.target.value = '';
    }
  };

  const handleSaveBranding = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setSavingBrand(true);
    try {
      const updatedFields: Partial<Tenant> = {
        ...brandForm,
        regions: regionsInput.split(',').map((s) => s.trim()).filter(Boolean).slice(0, 30),
        specialties: specialtiesInput.split('\n').map((s) => s.trim()).filter(Boolean).slice(0, 20),
      };
      await updateTenantSettings(activeTenantId, updatedFields);
      await writeAuditLog({
        tenantId: activeTenantId,
        ownerUid: tenant.ownerUid || user.uid,
        actorUid: user.uid,
        actorEmail: user.email || '',
        action: 'update_tenant_branding',
        entityType: 'tenant',
        entityId: activeTenantId,
        summary: `Atualizou configurações, tema (${brandForm.themePreset}) e perfil de "${brandForm.brandName}"`,
      });
      showNotice('ok', 'Configurações salvas e aplicadas ao site em tempo real!');
    } catch (err) {
      showNotice('err', err instanceof Error ? err.message : 'Erro ao salvar configurações.');
    } finally {
      setSavingBrand(false);
    }
  };

  const handleCreateTenant = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !isAdmin || !newTenantBrand.trim() || !newTenantBroker.trim()) return;
    const slug = slugify(newTenantBrand);
    const id = `broker_${slug.slice(0, 24)}_${Date.now().toString(36).slice(-4)}`;
    const newTenant: Tenant = {
      ...DEFAULT_TENANT,
      id,
      ownerUid: user.uid,
      slug,
      brandName: newTenantBrand.trim(),
      brokerName: newTenantBroker.trim(),
      city: newTenantCity.trim() || 'Rio de Janeiro',
      state: newTenantState.trim() || 'RJ',
      creci: '',
      whatsapp: '',
      phone: '',
      email: '',
      instagramHandle: '',
      instagramUrl: '',
      aboutBio: '',
      heroTitle: `Consultoria imobiliária por ${newTenantBroker.trim()}`,
      aboutHeadline: newTenantBroker.trim(),
    };
    try {
      await setDoc(doc(db, 'tenants', id), {
        ...newTenant,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      setAllTenants((prev) => [...prev, newTenant]);
      setActiveTenantId(id);
      setNewTenantBrand('');
      setNewTenantBroker('');
      showNotice('ok', `Novo ambiente "${newTenant.brandName}" criado e ativado.`);
    } catch (err) {
      showNotice('err', err instanceof Error ? err.message : 'Erro ao criar corretor.');
    }
  };

  const handleChangeAdminPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (!currentPassword.trim()) {
      showNotice('err', 'Informe sua senha atual para confirmar a alteração.');
      return;
    }
    if (newPassword.length < 6) {
      showNotice('err', 'A nova senha deve ter pelo menos 6 caracteres.');
      return;
    }
    if (newPassword !== confirmNewPassword) {
      showNotice('err', 'A confirmação da nova senha não confere.');
      return;
    }
    setUpdatingPassword(true);
    try {
      await updateUserPassword(currentPassword, newPassword);
      await writeAuditLog({
        tenantId: activeTenantId,
        ownerUid: tenant.ownerUid || user.uid,
        actorUid: user.uid,
        actorEmail: user.email || '',
        action: 'update_admin_password',
        entityType: 'tenant',
        entityId: activeTenantId,
        summary: `Alterou a senha administrativa de ${user.email || 'admin'} em tempo real no Firebase`,
      });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmNewPassword('');
      showNotice('ok', 'Senha alterada em tempo real no Firebase! A nova senha já está ativa para os próximos acessos.');
    } catch (err) {
      showNotice('err', err instanceof Error ? err.message : 'Não foi possível alterar a senha.');
    } finally {
      setUpdatingPassword(false);
    }
  };

  const navLinks: Array<{ id: AdminTab; label: string; icon: React.ComponentType<{ className?: string }> }> = [
    { id: 'dashboard', label: 'Visão Geral', icon: BarChart3 },
    { id: 'properties', label: 'Imóveis', icon: Home },
    { id: 'developments', label: 'Empreendimentos', icon: Building2 },
    { id: 'landing-pages', label: 'Landing Pages', icon: FileText },
    { id: 'leads', label: 'Leads & CRM', icon: Users },
    { id: 'marketing', label: 'Depoimentos & UTM', icon: MessageSquareQuote },
    { id: 'branding', label: 'Marca & Temas', icon: Palette },
    { id: 'security', label: 'Segurança & Senha', icon: KeyRound },
    { id: 'tenants', label: 'Multi-Corretor & Log', icon: Shield },
  ];

  return (
    <div className="min-h-screen flex flex-col lg:flex-row bg-[var(--site-bg)] text-[var(--site-text)]">
      {/* Sidebar */}
      <aside className="w-full lg:w-64 shrink-0 border-b lg:border-b-0 lg:border-r border-[var(--site-border)] bg-[var(--site-surface)] flex flex-col justify-between">
        <div>
          <div className="p-6 border-b border-[var(--site-border)] space-y-2">
            {tenant.logoUrl ? (
              <img
                src={tenant.logoUrl}
                alt={tenant.brandName}
                referrerPolicy="no-referrer"
                className="h-14 w-auto object-contain bg-transparent select-none"
              />
            ) : null}
            <p className="text-[11px] font-medium text-[var(--site-accent)] uppercase tracking-wider">
              Painel Administrativo
            </p>
            <h1 className={tenant.logoUrl ? 'sr-only' : 'font-editorial text-xl font-semibold truncate'}>
              {tenant.brandName}
            </h1>
            <p className="text-xs text-[var(--site-text-muted)] truncate">
              {profile?.email || user?.email}
            </p>
          </div>

          <nav className="p-3 flex lg:flex-col gap-1 overflow-x-auto">
            {navLinks.map((item) => {
              const Icon = item.icon;
              const active = tab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setTab(item.id)}
                  className={`flex items-center gap-2.5 px-3.5 py-2.5 text-xs font-medium rounded-[var(--site-radius)] whitespace-nowrap shrink-0 transition-colors ${
                    active
                      ? 'bg-[var(--site-text)] text-[var(--site-surface)]'
                      : 'text-[var(--site-text-muted)] hover:text-[var(--site-text)] hover:bg-[var(--site-surface-alt)]'
                  }`}
                >
                  <Icon className="w-4 h-4 shrink-0" />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>
        </div>

        <div className="p-4 border-t border-[var(--site-border)] flex lg:flex-col gap-2">
          <button
            type="button"
            onClick={() => onNavigate('/')}
            className="flex-1 flex items-center justify-center gap-2 px-3 py-2 text-xs font-medium border border-[var(--site-border)] rounded-[var(--site-radius)] hover:border-[var(--site-accent)]"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            Ver Site Público
          </button>
          <button
            type="button"
            onClick={logout}
            className="flex-1 flex items-center justify-center gap-2 px-3 py-2 text-xs font-medium text-red-700 border border-red-200 rounded-[var(--site-radius)] hover:bg-red-50"
          >
            <LogOut className="w-3.5 h-3.5" />
            Sair
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 min-w-0 p-6 lg:p-10 space-y-8 overflow-y-auto">
        {notice && (
          <div
            className={`p-3.5 text-xs border rounded-[var(--site-radius)] ${
              notice.type === 'ok'
                ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                : 'bg-red-50 border-red-200 text-red-900'
            }`}
          >
            {notice.text}
          </div>
        )}

        {/* TAB 1: DASHBOARD & ANALYTICS */}
        {tab === 'dashboard' && (
          <div className="space-y-8">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <h2 className="font-editorial text-3xl font-semibold">Visão Geral & Métricas</h2>
                <p className="text-xs text-[var(--site-text-muted)]">
                  Dados consolidados em tempo real do Firestore para {tenant.brandName}.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setEditingProperty(null)}
                className="inline-flex items-center gap-2 px-4 py-2.5 text-xs font-medium bg-[var(--site-text)] text-[var(--site-surface)] rounded-[var(--site-radius)] hover:opacity-90"
              >
                <Plus className="w-4 h-4" />
                Novo Imóvel
              </button>
            </div>

            {/* Real KPI Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
              <div className="p-5 bg-[var(--site-surface)] border border-[var(--site-border)] rounded-[var(--site-radius)] space-y-1">
                <p className="text-xs text-[var(--site-text-muted)]">Imóveis Publicados</p>
                <p className="font-mono text-2xl font-semibold tabular-nums">
                  {kpis.publishedProps} <span className="text-xs font-normal text-[var(--site-text-muted)]">/ {kpis.totalProps}</span>
                </p>
              </div>
              <div className="p-5 bg-[var(--site-surface)] border border-[var(--site-border)] rounded-[var(--site-radius)] space-y-1">
                <p className="text-xs text-[var(--site-text-muted)]">Leads Captados</p>
                <p className="font-mono text-2xl font-semibold tabular-nums">
                  {kpis.totalLeads} <span className="text-xs font-normal text-[var(--site-accent)]">({kpis.newLeads} novos)</span>
                </p>
              </div>
              <div className="p-5 bg-[var(--site-surface)] border border-[var(--site-border)] rounded-[var(--site-radius)] space-y-1">
                <p className="text-xs text-[var(--site-text-muted)]">Visualizações</p>
                <p className="font-mono text-2xl font-semibold tabular-nums">{kpis.totalViews}</p>
              </div>
              <div className="p-5 bg-[var(--site-surface)] border border-[var(--site-border)] rounded-[var(--site-radius)] space-y-1">
                <p className="text-xs text-[var(--site-text-muted)]">Cliques WhatsApp</p>
                <p className="font-mono text-2xl font-semibold tabular-nums">{kpis.whatsappClicks}</p>
              </div>
              <div className="p-5 bg-[var(--site-surface)] border border-[var(--site-border)] rounded-[var(--site-radius)] space-y-1">
                <p className="text-xs text-[var(--site-text-muted)]">Tours Virtuais</p>
                <p className="font-mono text-2xl font-semibold tabular-nums">{kpis.virtualTours}</p>
              </div>
            </div>

            {/* Charts */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              <div className="lg:col-span-7 p-6 bg-[var(--site-surface)] border border-[var(--site-border)] rounded-[var(--site-radius)] space-y-4">
                <h3 className="text-sm font-semibold">Visualizações e Conversões Diárias</h3>
                {chartTimeline.length > 0 ? (
                  <div className="h-64 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={chartTimeline}>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(120,120,120,0.15)" />
                        <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                        <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                        <Tooltip />
                        <Area
                          type="monotone"
                          dataKey="visualizacoes"
                          name="Visualizações"
                          stroke={tenant.themeConfig.accentColor || '#9A744B'}
                          fill={tenant.themeConfig.accentColor || '#9A744B'}
                          fillOpacity={0.18}
                        />
                        <Area
                          type="monotone"
                          dataKey="contatos"
                          name="Contatos"
                          stroke={tenant.themeConfig.primaryColor || '#141413'}
                          fill={tenant.themeConfig.primaryColor || '#141413'}
                          fillOpacity={0.15}
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <p className="text-xs text-[var(--site-text-muted)] py-16 text-center">
                    Ainda não há eventos registrados. Assim que visitantes navegarem pelo site público, o gráfico será preenchido automaticamente.
                  </p>
                )}
              </div>

              <div className="lg:col-span-5 p-6 bg-[var(--site-surface)] border border-[var(--site-border)] rounded-[var(--site-radius)] space-y-4">
                <h3 className="text-sm font-semibold">Funil de Leads por Etapa</h3>
                {leads.length > 0 ? (
                  <div className="h-64 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={leadFunnelData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(120,120,120,0.15)" />
                        <XAxis dataKey="etapa" tick={{ fontSize: 10 }} />
                        <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                        <Tooltip />
                        <Bar dataKey="quantidade" name="Leads" fill={tenant.themeConfig.accentColor || '#9A744B'} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <p className="text-xs text-[var(--site-text-muted)] py-16 text-center">
                    Nenhum lead captado até o momento.
                  </p>
                )}
              </div>
            </div>

            {/* Infrastructure & AI Readiness (Admin Diagnostics Only) */}
            {health?.capabilities && (
              <div className="p-5 bg-[var(--site-surface)] border border-[var(--site-border)] rounded-[var(--site-radius)] flex flex-wrap items-center justify-between gap-4 text-xs">
                <div className="flex items-center gap-2 font-medium">
                  <Activity className="w-4 h-4 text-[var(--site-accent)]" />
                  <span>Capacidades do Servidor</span>
                </div>
                <div className="flex flex-wrap gap-6 text-[var(--site-text-muted)]">
                  <span>
                    Armazenamento:{' '}
                    <strong className="text-[var(--site-text)]">
                      {health.capabilities.vercelBlob ? 'Vercel Blob Ativo' : 'Local Preview (defina BLOB_READ_WRITE_TOKEN em produção)'}
                    </strong>
                  </span>
                  <span>
                    Gemini IA:{' '}
                    <strong className="text-[var(--site-text)]">
                      {health.capabilities.geminiAi ? 'Configurado' : 'Aguardando GEMINI_API_KEY'}
                    </strong>
                  </span>
                  <span>
                    Tour Virtual Pro:{' '}
                    <strong className="text-[var(--site-text)]">
                      Ativo (100% Nativo no Navegador · 360° Pannellum)
                    </strong>
                  </span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB 2: PROPERTIES */}
        {tab === 'properties' && (
          <div className="space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <h2 className="font-editorial text-3xl font-semibold">Gestão de Imóveis</h2>
                <p className="text-xs text-[var(--site-text-muted)]">
                  Publicação em tempo real com fotos, análise multimodal Gemini, tour 360°/3D e vídeo cinemático.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setEditingProperty(null)}
                className="inline-flex items-center gap-2 px-4 py-2.5 text-xs font-medium bg-[var(--site-text)] text-[var(--site-surface)] rounded-[var(--site-radius)]"
              >
                <Plus className="w-4 h-4" />
                Cadastrar Imóvel
              </button>
            </div>

            <div className="flex flex-wrap gap-3">
              <div className="relative flex-1 min-w-[220px]">
                <Search className="w-4 h-4 absolute left-3 top-2.5 text-[var(--site-text-muted)]" />
                <input
                  type="text"
                  value={propQuery}
                  onChange={(e) => setPropQuery(e.target.value)}
                  placeholder="Buscar por título, código ou bairro..."
                  className="w-full pl-9 pr-3 py-2 text-xs bg-[var(--site-surface)] border border-[var(--site-border)] rounded-[var(--site-radius)]"
                />
              </div>
              <select
                value={propStatusFilter}
                onChange={(e) => setPropStatusFilter(e.target.value)}
                className="px-3 py-2 text-xs bg-[var(--site-surface)] border border-[var(--site-border)] rounded-[var(--site-radius)]"
              >
                <option value="all">Todos os status ({properties.length})</option>
                <option value="published">Publicados</option>
                <option value="draft">Rascunhos</option>
                <option value="sold">Vendidos</option>
                <option value="rented">Alugados</option>
              </select>
            </div>

            {filteredProperties.length === 0 ? (
              <div className="p-12 text-center bg-[var(--site-surface)] border border-[var(--site-border)] rounded-[var(--site-radius)] space-y-3">
                <LayoutGrid className="w-8 h-8 mx-auto opacity-30" />
                <h3 className="font-editorial text-2xl font-semibold">Nenhum imóvel cadastrado</h3>
                <p className="text-xs text-[var(--site-text-muted)] max-w-md mx-auto">
                  Clique em "Cadastrar Imóvel" para enviar fotos, gerar descrições verificadas com IA e publicar automaticamente no site.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredProperties.map((prop) => (
                  <div
                    key={prop.id}
                    className="p-4 bg-[var(--site-surface)] border border-[var(--site-border)] rounded-[var(--site-radius)] flex flex-col md:flex-row md:items-center justify-between gap-4"
                  >
                    <div className="flex items-center gap-4 min-w-0">
                      <div className="w-24 h-16 shrink-0 rounded overflow-hidden bg-[var(--site-surface-alt)] border border-[var(--site-border)]">
                        {prop.coverImage ? (
                          <img src={prop.coverImage} alt={prop.title} className="w-full h-full object-cover" />
                        ) : null}
                      </div>
                      <div className="min-w-0 space-y-1">
                        <div className="flex flex-wrap items-center gap-2 text-[11px] text-[var(--site-text-muted)]">
                          <span className="font-mono">{prop.code}</span>
                          <span>·</span>
                          <span>{transactionTypeLabel(prop.transactionType)}</span>
                          <span>·</span>
                          <span>{propertyTypeLabel(prop.propertyType)}</span>
                          <span>·</span>
                          <span className={prop.status === 'published' ? 'text-emerald-700 font-semibold' : 'text-amber-700'}>
                            {prop.status === 'published' ? 'Publicado' : prop.status === 'draft' ? 'Rascunho' : prop.status}
                          </span>
                        </div>
                        <h3 className="font-editorial text-lg font-semibold truncate">{prop.title}</h3>
                        <p className="text-xs text-[var(--site-text-muted)] tabular-nums">
                          {prop.neighborhood}, {prop.city} · {formatCurrencyBRL(prop.price)}
                        </p>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => handleTogglePropertyFeatured(prop)}
                        title="Destacar na Home"
                        className={`p-2 border rounded text-xs ${
                          prop.featured ? 'border-amber-500 text-amber-700' : 'border-[var(--site-border)] text-[var(--site-text-muted)]'
                        }`}
                      >
                        <Star className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleTogglePropertyStatus(prop)}
                        className="px-3 py-1.5 text-xs border border-[var(--site-border)] rounded hover:border-[var(--site-accent)]"
                      >
                        {prop.status === 'published' ? 'Despublicar' : 'Publicar'}
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditingProperty(prop)}
                        className="px-3 py-1.5 text-xs bg-[var(--site-text)] text-[var(--site-surface)] rounded"
                      >
                        Editar
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDuplicateProperty(prop)}
                        title="Duplicar imóvel"
                        className="p-2 border border-[var(--site-border)] rounded text-xs"
                      >
                        <Copy className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => onNavigate(`/imovel/${prop.slug}`)}
                        title="Visualizar página pública"
                        className="p-2 border border-[var(--site-border)] rounded text-xs"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteProperty(prop)}
                        title="Excluir imóvel"
                        className="p-2 border border-red-200 text-red-700 rounded text-xs"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB 3: DEVELOPMENTS */}
        {tab === 'developments' && (
          <div className="space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <h2 className="font-editorial text-3xl font-semibold">Empreendimentos & Lançamentos</h2>
                <p className="text-xs text-[var(--site-text-muted)]">
                  Cadastre incorporações com galeria, plantas e ficha técnica para publicação automática.
                </p>
              </div>
              <button
                type="button"
                onClick={() => openDevEditor()}
                className="inline-flex items-center gap-2 px-4 py-2.5 text-xs font-medium bg-[var(--site-text)] text-[var(--site-surface)] rounded-[var(--site-radius)]"
              >
                <Plus className="w-4 h-4" />
                Novo Empreendimento
              </button>
            </div>

            {developments.length === 0 ? (
              <div className="p-12 text-center bg-[var(--site-surface)] border border-[var(--site-border)] rounded-[var(--site-radius)] space-y-2">
                <p className="font-editorial text-2xl font-semibold">Nenhum empreendimento cadastrado</p>
                <p className="text-xs text-[var(--site-text-muted)]">
                  Adicione lançamentos ou condomínios para exibi-los na seção de Empreendimentos.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {developments.map((dev) => (
                  <div
                    key={dev.id}
                    className="p-5 bg-[var(--site-surface)] border border-[var(--site-border)] rounded-[var(--site-radius)] space-y-4"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-20 h-14 shrink-0 rounded overflow-hidden bg-[var(--site-surface-alt)] border border-[var(--site-border)]">
                          {dev.coverImage ? (
                            <img src={dev.coverImage} alt={dev.name} className="w-full h-full object-cover" />
                          ) : null}
                        </div>
                        <div className="min-w-0 space-y-1">
                          <p className="text-[11px] text-[var(--site-text-muted)] truncate">
                            {dev.category} · {dev.neighborhood}, {dev.city} ·{' '}
                            <span className={dev.status === 'published' ? 'text-emerald-700 font-semibold' : 'text-amber-700'}>
                              {dev.status === 'published' ? 'Publicado' : 'Rascunho'}
                            </span>
                          </p>
                          <h3 className="font-editorial text-xl font-semibold truncate">{dev.name}</h3>
                          <p className="font-mono text-xs tabular-nums text-[var(--site-text-muted)]">
                            {dev.priceFrom > 0 ? `A partir de ${formatCurrencyBRL(dev.priceFrom)}` : 'Sob consulta'}
                          </p>
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center justify-end gap-1.5 shrink-0">
                        <button
                          type="button"
                          onClick={() => handleToggleDevelopmentStatus(dev)}
                          className="px-2.5 py-1.5 text-xs border border-[var(--site-border)] rounded hover:border-[var(--site-accent)]"
                        >
                          {dev.status === 'published' ? 'Despublicar' : 'Publicar'}
                        </button>
                        <button
                          type="button"
                          onClick={() => openDevEditor(dev)}
                          className="px-3 py-1.5 text-xs bg-[var(--site-text)] text-[var(--site-surface)] rounded"
                        >
                          Editar
                        </button>
                        <button
                          type="button"
                          onClick={() => onNavigate(`/empreendimento/${dev.slug}`)}
                          title="Visualizar página pública"
                          className="p-1.5 border border-[var(--site-border)] rounded text-xs"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteDevelopment(dev)}
                          title="Excluir empreendimento"
                          className="p-1.5 text-red-700 border border-red-200 rounded"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {devModalOpen && (
              <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4 overflow-y-auto">
                <form
                  onSubmit={handleSaveDevelopment}
                  className="bg-[var(--site-surface)] border border-[var(--site-border)] rounded-lg w-full max-w-3xl max-h-[90vh] overflow-y-auto p-6 space-y-5"
                >
                  <div className="flex items-center justify-between border-b border-[var(--site-border)] pb-3">
                    <h3 className="font-editorial text-2xl font-semibold">
                      {editingDevId ? 'Editar Empreendimento' : 'Novo Empreendimento'}
                    </h3>
                    <button type="button" onClick={() => setDevModalOpen(false)} className="text-xs underline">
                      Fechar
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                    <label className="space-y-1 block">
                      <span>Nome do Empreendimento *</span>
                      <input
                        type="text"
                        required
                        value={devName}
                        onChange={(e) => setDevName(e.target.value)}
                        className="w-full px-3 py-2 text-sm border border-[var(--site-border)] rounded bg-[var(--site-bg)]"
                      />
                    </label>
                    <label className="space-y-1 block">
                      <span>Incorporadora</span>
                      <input
                        type="text"
                        value={devDeveloper}
                        onChange={(e) => setDevDeveloper(e.target.value)}
                        className="w-full px-3 py-2 text-sm border border-[var(--site-border)] rounded bg-[var(--site-bg)]"
                      />
                    </label>
                    <label className="space-y-1 block">
                      <span>Categoria</span>
                      <select
                        value={devCategory}
                        onChange={(e) => setDevCategory(e.target.value as Development['category'])}
                        className="w-full px-3 py-2 text-sm border border-[var(--site-border)] rounded bg-[var(--site-bg)]"
                      >
                        <option value="lancamento">Lançamento</option>
                        <option value="condominio">Condomínio</option>
                        <option value="residencial">Residencial</option>
                        <option value="comercial">Comercial</option>
                      </select>
                    </label>
                    <label className="space-y-1 block">
                      <span>Valor a partir de (R$)</span>
                      <input
                        type="number"
                        min={0}
                        value={devPriceFrom}
                        onChange={(e) => setDevPriceFrom(Number(e.target.value))}
                        className="w-full px-3 py-2 text-sm border border-[var(--site-border)] rounded bg-[var(--site-bg)]"
                      />
                    </label>
                    <label className="space-y-1 block">
                      <span>Cidade *</span>
                      <input
                        type="text"
                        required
                        value={devCity}
                        onChange={(e) => setDevCity(e.target.value)}
                        className="w-full px-3 py-2 text-sm border border-[var(--site-border)] rounded bg-[var(--site-bg)]"
                      />
                    </label>
                    <label className="space-y-1 block">
                      <span>Bairro *</span>
                      <input
                        type="text"
                        required
                        value={devNeighborhood}
                        onChange={(e) => setDevNeighborhood(e.target.value)}
                        className="w-full px-3 py-2 text-sm border border-[var(--site-border)] rounded bg-[var(--site-bg)]"
                      />
                    </label>
                    <label className="space-y-1 block">
                      <span>Previsão de entrega</span>
                      <input
                        type="text"
                        value={devDeliveryDate}
                        onChange={(e) => setDevDeliveryDate(e.target.value)}
                        placeholder="Ex.: Dezembro / 2027"
                        className="w-full px-3 py-2 text-sm border border-[var(--site-border)] rounded bg-[var(--site-bg)]"
                      />
                    </label>
                    <label className="space-y-1 block">
                      <span>Status</span>
                      <select
                        value={devStatus}
                        onChange={(e) => setDevStatus(e.target.value as 'draft' | 'published')}
                        className="w-full px-3 py-2 text-sm border border-[var(--site-border)] rounded bg-[var(--site-bg)]"
                      >
                        <option value="draft">Rascunho</option>
                        <option value="published">Publicado</option>
                      </select>
                    </label>
                  </div>

                  <label className="space-y-1 block text-xs">
                    <span>Descrição do Projeto</span>
                    <textarea
                      rows={3}
                      value={devDescription}
                      onChange={(e) => setDevDescription(e.target.value)}
                      className="w-full px-3 py-2 text-sm border border-[var(--site-border)] rounded bg-[var(--site-bg)]"
                    />
                  </label>

                  <label className="space-y-1 block text-xs">
                    <span>Ficha Técnica (um item por linha)</span>
                    <textarea
                      rows={3}
                      value={devSpecsText}
                      onChange={(e) => setDevSpecsText(e.target.value)}
                      className="w-full px-3 py-2 text-sm border border-[var(--site-border)] rounded bg-[var(--site-bg)]"
                    />
                  </label>

                  <div className="space-y-4 text-xs">
                    <div className="flex flex-wrap gap-3">
                      <label className="inline-flex items-center gap-1.5 px-3 py-2 border border-[var(--site-border)] rounded cursor-pointer">
                        <Upload className="w-3.5 h-3.5" />
                        {devUploading ? 'Enviando...' : `Enviar Fotos (${devImages.length})`}
                        <input
                          type="file"
                          multiple
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => handleDevMediaUpload(e, 'gallery')}
                        />
                      </label>
                      <label className="inline-flex items-center gap-1.5 px-3 py-2 border border-[var(--site-border)] rounded cursor-pointer">
                        <Upload className="w-3.5 h-3.5" />
                        {`Enviar Plantas (${devFloorPlans.length})`}
                        <input
                          type="file"
                          multiple
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => handleDevMediaUpload(e, 'floorplan')}
                        />
                      </label>
                    </div>

                    {devImages.length > 0 && (
                      <div className="space-y-2">
                        <p className="font-medium text-[var(--site-text-muted)]">Fotos da Galeria</p>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                          {devImages.map((img) => {
                            const isCover = devCoverImage === img.url;
                            return (
                              <div key={img.id} className="border border-[var(--site-border)] rounded overflow-hidden bg-[var(--site-bg)]">
                                <div className="aspect-[4/3] relative">
                                  <img src={img.url} alt={img.caption || devName} className="w-full h-full object-cover" />
                                  <button
                                    type="button"
                                    onClick={() => handleRemoveDevImage(img, 'gallery')}
                                    title="Excluir foto"
                                    className="absolute top-1.5 right-1.5 p-1 bg-black/70 text-white rounded hover:bg-red-700"
                                  >
                                    <Trash2 className="w-3 h-3" />
                                  </button>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => setDevCoverImage(img.url)}
                                  className={`w-full py-1 text-[11px] font-medium ${
                                    isCover ? 'bg-[var(--site-accent)] text-white' : 'hover:bg-[var(--site-surface-alt)]'
                                  }`}
                                >
                                  {isCover ? 'Capa principal' : 'Definir como capa'}
                                </button>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {devFloorPlans.length > 0 && (
                      <div className="space-y-2">
                        <p className="font-medium text-[var(--site-text-muted)]">Plantas</p>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                          {devFloorPlans.map((fp) => (
                            <div key={fp.id} className="border border-[var(--site-border)] rounded overflow-hidden bg-[var(--site-bg)] relative aspect-[4/3]">
                              <img src={fp.url} alt={fp.caption || 'Planta'} className="w-full h-full object-cover" />
                              <button
                                type="button"
                                onClick={() => handleRemoveDevImage(fp, 'floorplan')}
                                title="Excluir planta"
                                className="absolute top-1.5 right-1.5 p-1 bg-black/70 text-white rounded hover:bg-red-700"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="flex justify-end gap-3 pt-4 border-t border-[var(--site-border)]">
                    <button
                      type="button"
                      onClick={() => setDevModalOpen(false)}
                      className="px-4 py-2 text-xs border border-[var(--site-border)] rounded"
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      className="px-5 py-2 text-xs font-medium bg-[var(--site-text)] text-[var(--site-surface)] rounded"
                    >
                      Salvar Empreendimento
                    </button>
                  </div>
                </form>
              </div>
            )}
          </div>
        )}

        {/* TAB 4: LANDING PAGES */}
        {tab === 'landing-pages' && (
          <div className="space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <h2 className="font-editorial text-3xl font-semibold">Gerador de Landing Pages</h2>
                <p className="text-xs text-[var(--site-text-muted)]">
                  Crie páginas comerciais exclusivas em /oferta/slug para campanhas de anúncios ou imóveis-chave.
                </p>
              </div>
              <button
                type="button"
                onClick={() => openLpEditor()}
                className="inline-flex items-center gap-2 px-4 py-2.5 text-xs font-medium bg-[var(--site-text)] text-[var(--site-surface)] rounded-[var(--site-radius)]"
              >
                <Plus className="w-4 h-4" />
                Nova Landing Page
              </button>
            </div>

            {landingPages.length === 0 ? (
              <div className="p-12 text-center bg-[var(--site-surface)] border border-[var(--site-border)] rounded-[var(--site-radius)] space-y-2">
                <p className="font-editorial text-2xl font-semibold">Nenhuma landing page criada</p>
                <p className="text-xs text-[var(--site-text-muted)]">
                  Crie uma página de oferta dedicada e conecte-a a um imóvel do catálogo com 1 clique.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {landingPages.map((lp) => {
                  const lpUrl = `${window.location.origin}/oferta/${lp.slug}`;
                  const lpViews = analyticsEvents.filter((e) => e.targetId === lp.id).length;
                  const lpLeads = leads.filter((l) => l.landingPageId === lp.id).length;
                  return (
                    <div
                      key={lp.id}
                      className="p-4 bg-[var(--site-surface)] border border-[var(--site-border)] rounded-[var(--site-radius)] flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 text-[11px] text-[var(--site-text-muted)]">
                          <span>{lp.template}</span>
                          <span>·</span>
                          <span className="font-mono">/oferta/{lp.slug}</span>
                          <span>·</span>
                          <span className={lp.status === 'published' ? 'text-emerald-700 font-semibold' : 'text-amber-700'}>
                            {lp.status === 'published' ? 'Publicada' : 'Rascunho'}
                          </span>
                        </div>
                        <h3 className="font-editorial text-xl font-semibold">{lp.title}</h3>
                        <p className="text-xs text-[var(--site-text-muted)] tabular-nums">
                          {lpViews} visualizações · {lpLeads} leads
                        </p>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          onClick={async () => {
                            await navigator.clipboard.writeText(lpUrl);
                            showNotice('ok', 'URL da landing page copiada!');
                          }}
                          className="inline-flex items-center gap-1 px-3 py-1.5 text-xs border border-[var(--site-border)] rounded"
                        >
                          <Copy className="w-3.5 h-3.5" />
                          Copiar URL
                        </button>
                        <button
                          type="button"
                          onClick={() => openLpEditor(lp)}
                          className="px-3 py-1.5 text-xs bg-[var(--site-text)] text-[var(--site-surface)] rounded"
                        >
                          Editar
                        </button>
                        <button
                          type="button"
                          onClick={() => onNavigate(`/oferta/${lp.slug}`)}
                          className="p-2 border border-[var(--site-border)] rounded"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteLandingPage(lp)}
                          className="p-2 border border-red-200 text-red-700 rounded"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {lpModalOpen && (
              <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4 overflow-y-auto">
                <form
                  onSubmit={handleSaveLandingPage}
                  className="bg-[var(--site-surface)] border border-[var(--site-border)] rounded-lg w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6 space-y-4 text-xs"
                >
                  <div className="flex items-center justify-between border-b border-[var(--site-border)] pb-3">
                    <h3 className="font-editorial text-2xl font-semibold">
                      {editingLpId ? 'Editar Landing Page' : 'Criar Landing Page'}
                    </h3>
                    <button type="button" onClick={() => setLpModalOpen(false)} className="underline">
                      Fechar
                    </button>
                  </div>

                  {properties.length > 0 && (
                    <label className="block space-y-1">
                      <span>Gerar automaticamente a partir de um imóvel (opcional)</span>
                      <select
                        value={lpPropertyId}
                        onChange={(e) => handlePrefillLpFromProperty(e.target.value)}
                        className="w-full px-3 py-2 text-sm border border-[var(--site-border)] rounded bg-[var(--site-bg)]"
                      >
                        <option value="">Selecionar imóvel...</option>
                        {properties.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.code} — {p.title}
                          </option>
                        ))}
                      </select>
                    </label>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <label className="space-y-1 block">
                      <span>Título *</span>
                      <input
                        type="text"
                        required
                        value={lpTitle}
                        onChange={(e) => setLpTitle(e.target.value)}
                        className="w-full px-3 py-2 text-sm border border-[var(--site-border)] rounded bg-[var(--site-bg)]"
                      />
                    </label>
                    <label className="space-y-1 block">
                      <span>Slug da URL (/oferta/...)</span>
                      <input
                        type="text"
                        value={lpSlug}
                        onChange={(e) => setLpSlug(e.target.value)}
                        placeholder="ex-cobertura-leblon"
                        className="w-full px-3 py-2 text-sm font-mono border border-[var(--site-border)] rounded bg-[var(--site-bg)]"
                      />
                    </label>
                    <label className="space-y-1 block">
                      <span>Template</span>
                      <select
                        value={lpTemplate}
                        onChange={(e) => setLpTemplate(e.target.value as LandingPage['template'])}
                        className="w-full px-3 py-2 text-sm border border-[var(--site-border)] rounded bg-[var(--site-bg)]"
                      >
                        <option value="editorial-luxo">Editorial Luxo</option>
                        <option value="lancamento-impacto">Lançamento Impacto</option>
                        <option value="minimalista-direto">Minimalista Direto</option>
                      </select>
                    </label>
                    <label className="space-y-1 block">
                      <span>Status</span>
                      <select
                        value={lpStatus}
                        onChange={(e) => setLpStatus(e.target.value as 'draft' | 'published')}
                        className="w-full px-3 py-2 text-sm border border-[var(--site-border)] rounded bg-[var(--site-bg)]"
                      >
                        <option value="draft">Rascunho</option>
                        <option value="published">Publicada</option>
                      </select>
                    </label>
                  </div>

                  <label className="space-y-1 block">
                    <span>Subtítulo</span>
                    <input
                      type="text"
                      value={lpSubtitle}
                      onChange={(e) => setLpSubtitle(e.target.value)}
                      className="w-full px-3 py-2 text-sm border border-[var(--site-border)] rounded bg-[var(--site-bg)]"
                    />
                  </label>

                  <label className="space-y-1 block">
                    <span>Texto principal</span>
                    <textarea
                      rows={3}
                      value={lpDescription}
                      onChange={(e) => setLpDescription(e.target.value)}
                      className="w-full px-3 py-2 text-sm border border-[var(--site-border)] rounded bg-[var(--site-bg)]"
                    />
                  </label>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <label className="space-y-1 block">
                      <span>Texto do Botão (CTA)</span>
                      <input
                        type="text"
                        value={lpCtaText}
                        onChange={(e) => setLpCtaText(e.target.value)}
                        className="w-full px-3 py-2 text-sm border border-[var(--site-border)] rounded bg-[var(--site-bg)]"
                      />
                    </label>
                    <label className="space-y-1 block">
                      <span>Cor de Destaque</span>
                      <input
                        type="color"
                        value={lpAccentColor}
                        onChange={(e) => setLpAccentColor(e.target.value)}
                        className="w-full h-10 p-1 border border-[var(--site-border)] rounded bg-[var(--site-bg)]"
                      />
                    </label>
                  </div>

                  <label className="space-y-1 block">
                    <span>Destaques (um por linha)</span>
                    <textarea
                      rows={3}
                      value={lpHighlightsText}
                      onChange={(e) => setLpHighlightsText(e.target.value)}
                      className="w-full px-3 py-2 text-sm border border-[var(--site-border)] rounded bg-[var(--site-bg)]"
                    />
                  </label>

                  <div className="flex justify-end gap-3 pt-4 border-t border-[var(--site-border)]">
                    <button
                      type="button"
                      onClick={() => setLpModalOpen(false)}
                      className="px-4 py-2 border border-[var(--site-border)] rounded"
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      className="px-5 py-2 font-medium bg-[var(--site-text)] text-[var(--site-surface)] rounded"
                    >
                      Salvar Landing Page
                    </button>
                  </div>
                </form>
              </div>
            )}
          </div>
        )}

        {/* TAB 5: LEADS & CRM */}
        {tab === 'leads' && (
          <div className="space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <h2 className="font-editorial text-3xl font-semibold">Leads & Atendimento (CRM)</h2>
                <p className="text-xs text-[var(--site-text-muted)]">
                  Contatos reais enviados pelos formulários públicos com consentimento LGPD.
                </p>
              </div>
              <button
                type="button"
                disabled={filteredLeads.length === 0}
                onClick={handleExportLeadsCsv}
                className="inline-flex items-center gap-2 px-4 py-2.5 text-xs font-medium border border-[var(--site-border)] bg-[var(--site-surface)] rounded-[var(--site-radius)] disabled:opacity-40"
              >
                <Download className="w-4 h-4" />
                Exportar CSV
              </button>
            </div>

            <div className="flex flex-wrap gap-3">
              <input
                type="text"
                value={leadQuery}
                onChange={(e) => setLeadQuery(e.target.value)}
                placeholder="Filtrar por nome, telefone, e-mail ou imóvel..."
                className="flex-1 min-w-[220px] px-3 py-2 text-xs bg-[var(--site-surface)] border border-[var(--site-border)] rounded-[var(--site-radius)]"
              />
              <select
                value={leadStatusFilter}
                onChange={(e) => setLeadStatusFilter(e.target.value)}
                className="px-3 py-2 text-xs bg-[var(--site-surface)] border border-[var(--site-border)] rounded-[var(--site-radius)]"
              >
                <option value="all">Todos ({leads.length})</option>
                <option value="new">Novo</option>
                <option value="in_progress">Em atendimento</option>
                <option value="scheduled">Agendado</option>
                <option value="converted">Convertido</option>
                <option value="lost">Perdido</option>
              </select>
            </div>

            {filteredLeads.length === 0 ? (
              <div className="p-12 text-center bg-[var(--site-surface)] border border-[var(--site-border)] rounded-[var(--site-radius)] space-y-2">
                <p className="font-editorial text-2xl font-semibold">Nenhum lead encontrado</p>
                <p className="text-xs text-[var(--site-text-muted)]">
                  Todos os contatos enviados pelo site aparecerão aqui em tempo real.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {filteredLeads.map((lead) => {
                  const notesVal = leadNotesDraft[lead.id] ?? lead.notes ?? '';
                  return (
                    <div
                      key={lead.id}
                      className="p-5 bg-[var(--site-surface)] border border-[var(--site-border)] rounded-[var(--site-radius)] space-y-3"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-4">
                        <div className="space-y-1">
                          <div className="flex flex-wrap items-center gap-2 text-xs text-[var(--site-text-muted)]">
                            <span>{formatTimestampDate(lead.createdAt)}</span>
                            <span>·</span>
                            <span className="capitalize">{lead.interest}</span>
                            {lead.utmSource && (
                              <>
                                <span>·</span>
                                <span className="font-mono">UTM: {lead.utmSource}</span>
                              </>
                            )}
                          </div>
                          <h3 className="text-base font-semibold">{lead.name}</h3>
                          <p className="text-xs text-[var(--site-text-muted)] font-mono">
                            {lead.phone} {lead.email ? `· ${lead.email}` : ''}
                          </p>
                          {lead.propertyTitle && (
                            <p className="text-xs text-[var(--site-accent)]">Imóvel: {lead.propertyTitle}</p>
                          )}
                          {lead.message && (
                            <p className="text-xs text-[var(--site-text)] pt-1">{lead.message}</p>
                          )}
                        </div>

                        <div className="flex items-center gap-2">
                          <select
                            value={lead.status}
                            onChange={async (e) => {
                              try {
                                await updateLeadStatus(lead.id, e.target.value as LeadStatus, notesVal);
                                showNotice('ok', 'Status do lead atualizado.');
                              } catch (err) {
                                showNotice('err', err instanceof Error ? err.message : 'Erro ao atualizar lead.');
                              }
                            }}
                            className="px-3 py-1.5 text-xs border border-[var(--site-border)] rounded bg-[var(--site-bg)]"
                          >
                            <option value="new">Novo</option>
                            <option value="in_progress">Em atendimento</option>
                            <option value="scheduled">Agendado</option>
                            <option value="converted">Convertido</option>
                            <option value="lost">Perdido</option>
                          </select>
                          <button
                            type="button"
                            onClick={async () => {
                              try {
                                await deleteLead(lead.id);
                                showNotice('ok', 'Lead removido permanentemente.');
                              } catch (err) {
                                showNotice('err', err instanceof Error ? err.message : 'Erro ao remover lead.');
                              }
                            }}
                            className="p-1.5 border border-red-200 text-red-700 rounded"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      <div className="flex gap-2 pt-2 border-t border-[var(--site-border)]">
                        <input
                          type="text"
                          value={notesVal}
                          onChange={(e) => setLeadNotesDraft((prev) => ({ ...prev, [lead.id]: e.target.value }))}
                          placeholder="Anotações internas de atendimento..."
                          className="flex-1 px-3 py-1.5 text-xs border border-[var(--site-border)] rounded bg-[var(--site-bg)]"
                        />
                        <button
                          type="button"
                          onClick={async () => {
                            try {
                              await updateLeadStatus(lead.id, lead.status, notesVal);
                              showNotice('ok', 'Anotação salva.');
                            } catch (err) {
                              showNotice('err', err instanceof Error ? err.message : 'Erro ao salvar anotação.');
                            }
                          }}
                          className="px-3 py-1.5 text-xs border border-[var(--site-border)] rounded hover:border-[var(--site-accent)]"
                        >
                          Salvar nota
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* TAB 6: TESTIMONIALS & CAMPAIGNS */}
        {tab === 'marketing' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Real Verified Testimonials */}
            <section className="p-6 bg-[var(--site-surface)] border border-[var(--site-border)] rounded-[var(--site-radius)] space-y-5">
              <div>
                <h2 className="font-editorial text-2xl font-semibold">Depoimentos Reais de Clientes</h2>
                <p className="text-xs text-[var(--site-text-muted)]">
                  Apenas depoimentos cadastrados e publicados aqui são exibidos no site público.
                </p>
              </div>

              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  if (!user || !testName.trim() || !testQuote.trim()) return;
                  try {
                    await saveTestimonial(
                      {
                        id: generateSafeId('test'),
                        tenantId: activeTenantId,
                        ownerUid: tenant.ownerUid || user.uid,
                        clientName: testName.trim(),
                        clientRole: testRole.trim(),
                        quote: testQuote.trim(),
                        propertyReference: testPropRef.trim(),
                        status: testStatus,
                      },
                      true
                    );
                    setTestName('');
                    setTestRole('');
                    setTestQuote('');
                    setTestPropRef('');
                    showNotice('ok', 'Depoimento cadastrado e atualizado em tempo real.');
                  } catch (err) {
                    showNotice('err', err instanceof Error ? err.message : 'Erro ao salvar depoimento.');
                  }
                }}
                className="space-y-3 text-xs"
              >
                <div className="grid grid-cols-2 gap-3">
                  <input
                    type="text"
                    required
                    value={testName}
                    onChange={(e) => setTestName(e.target.value)}
                    placeholder="Nome do cliente *"
                    className="px-3 py-2 border border-[var(--site-border)] rounded bg-[var(--site-bg)]"
                  />
                  <input
                    type="text"
                    value={testRole}
                    onChange={(e) => setTestRole(e.target.value)}
                    placeholder="Perfil (ex.: Comprador)"
                    className="px-3 py-2 border border-[var(--site-border)] rounded bg-[var(--site-bg)]"
                  />
                </div>
                <input
                  type="text"
                  value={testPropRef}
                  onChange={(e) => setTestPropRef(e.target.value)}
                  placeholder="Referência do imóvel / bairro"
                  className="w-full px-3 py-2 border border-[var(--site-border)] rounded bg-[var(--site-bg)]"
                />
                <textarea
                  rows={3}
                  required
                  value={testQuote}
                  onChange={(e) => setTestQuote(e.target.value)}
                  placeholder="Depoimento real autorizado pelo cliente..."
                  className="w-full px-3 py-2 border border-[var(--site-border)] rounded bg-[var(--site-bg)]"
                />
                <div className="flex items-center justify-between">
                  <select
                    value={testStatus}
                    onChange={(e) => setTestStatus(e.target.value as 'draft' | 'published')}
                    className="px-3 py-2 border border-[var(--site-border)] rounded bg-[var(--site-bg)]"
                  >
                    <option value="published">Publicado</option>
                    <option value="draft">Rascunho</option>
                  </select>
                  <button
                    type="submit"
                    className="px-4 py-2 font-medium bg-[var(--site-text)] text-[var(--site-surface)] rounded"
                  >
                    Adicionar Depoimento
                  </button>
                </div>
              </form>

              <div className="space-y-3 pt-4 border-t border-[var(--site-border)]">
                {testimonials.map((t) => (
                  <div key={t.id} className="p-3 bg-[var(--site-bg)] border border-[var(--site-border)] rounded text-xs flex justify-between gap-3">
                    <div>
                      <p className="font-semibold">{t.clientName}</p>
                      <p className="text-[var(--site-text-muted)] italic">“{t.quote}”</p>
                    </div>
                    <button
                      type="button"
                      onClick={async () => {
                        try {
                          await deleteTestimonial(t.id);
                          showNotice('ok', 'Depoimento removido.');
                        } catch (err) {
                          showNotice('err', err instanceof Error ? err.message : 'Erro ao remover depoimento.');
                        }
                      }}
                      className="p-1.5 text-red-700 self-start"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </section>

            {/* UTM Campaigns */}
            <section className="p-6 bg-[var(--site-surface)] border border-[var(--site-border)] rounded-[var(--site-radius)] space-y-5">
              <div>
                <h2 className="font-editorial text-2xl font-semibold">Campanhas & Links UTM</h2>
                <p className="text-xs text-[var(--site-text-muted)]">
                  Organize links rastreáveis para Google Ads, Meta Ads e Instagram.
                </p>
              </div>

              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  if (!user || !campName.trim()) return;
                  try {
                    await saveCampaign(
                      {
                        id: generateSafeId('camp'),
                        tenantId: activeTenantId,
                        ownerUid: tenant.ownerUid || user.uid,
                        name: campName.trim(),
                        channel: campChannel,
                        utmSource: campUtmSource.trim(),
                        utmMedium: campUtmMedium.trim(),
                        utmCampaign: campUtmCampaign.trim() || slugify(campName),
                        status: 'active',
                        budget: Number(campBudget) || 0,
                      },
                      true
                    );
                    setCampName('');
                    setCampUtmCampaign('');
                    showNotice('ok', 'Campanha registrada.');
                  } catch (err) {
                    showNotice('err', err instanceof Error ? err.message : 'Erro ao salvar campanha.');
                  }
                }}
                className="space-y-3 text-xs"
              >
                <input
                  type="text"
                  required
                  value={campName}
                  onChange={(e) => setCampName(e.target.value)}
                  placeholder="Nome da campanha *"
                  className="w-full px-3 py-2 border border-[var(--site-border)] rounded bg-[var(--site-bg)]"
                />
                <div className="grid grid-cols-3 gap-2">
                  <input
                    type="text"
                    value={campUtmSource}
                    onChange={(e) => setCampUtmSource(e.target.value)}
                    placeholder="utm_source"
                    className="px-3 py-2 border border-[var(--site-border)] rounded bg-[var(--site-bg)]"
                  />
                  <input
                    type="text"
                    value={campUtmMedium}
                    onChange={(e) => setCampUtmMedium(e.target.value)}
                    placeholder="utm_medium"
                    className="px-3 py-2 border border-[var(--site-border)] rounded bg-[var(--site-bg)]"
                  />
                  <input
                    type="text"
                    value={campUtmCampaign}
                    onChange={(e) => setCampUtmCampaign(e.target.value)}
                    placeholder="utm_campaign"
                    className="px-3 py-2 border border-[var(--site-border)] rounded bg-[var(--site-bg)]"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <input
                    type="text"
                    value={campChannel}
                    onChange={(e) => setCampChannel(e.target.value)}
                    placeholder="Canal (Google Ads / Instagram)"
                    className="px-3 py-2 border border-[var(--site-border)] rounded bg-[var(--site-bg)]"
                  />
                  <input
                    type="number"
                    min={0}
                    value={campBudget}
                    onChange={(e) => setCampBudget(Number(e.target.value))}
                    placeholder="Orçamento mensal (R$)"
                    className="px-3 py-2 border border-[var(--site-border)] rounded bg-[var(--site-bg)]"
                  />
                </div>
                <button
                  type="submit"
                  className="px-4 py-2 font-medium bg-[var(--site-text)] text-[var(--site-surface)] rounded"
                >
                  Salvar Campanha
                </button>
              </form>

              <div className="space-y-3 pt-4 border-t border-[var(--site-border)]">
                {campaigns.map((c) => {
                  const utmUrl = `${window.location.origin}/?utm_source=${encodeURIComponent(c.utmSource)}&utm_medium=${encodeURIComponent(c.utmMedium)}&utm_campaign=${encodeURIComponent(c.utmCampaign)}`;
                  return (
                    <div key={c.id} className="p-3 bg-[var(--site-bg)] border border-[var(--site-border)] rounded text-xs flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-semibold truncate">{c.name}</p>
                        <p className="text-[var(--site-text-muted)] font-mono truncate">
                          {c.channel} · {c.utmSource}/{c.utmMedium}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={async () => {
                          await navigator.clipboard.writeText(utmUrl);
                          showNotice('ok', 'Link UTM copiado!');
                        }}
                        className="px-2.5 py-1 border border-[var(--site-border)] rounded shrink-0"
                      >
                        Copiar UTM
                      </button>
                    </div>
                  );
                })}
              </div>
            </section>
          </div>
        )}

        {/* TAB 7: BRANDING, THEMES, SEO & INTEGRATIONS */}
        {tab === 'branding' && (
          <form onSubmit={handleSaveBranding} className="space-y-8 max-w-5xl">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <h2 className="font-editorial text-3xl font-semibold">Personalização, Temas & Marca</h2>
                <p className="text-xs text-[var(--site-text-muted)]">
                  Altere identidade visual, dados comerciais, logotipo, hero, SEO e tags de rastreamento em tempo real.
                </p>
              </div>
              <button
                type="submit"
                disabled={savingBrand}
                className="inline-flex items-center gap-2 px-5 py-2.5 text-xs font-medium bg-[var(--site-text)] text-[var(--site-surface)] rounded-[var(--site-radius)]"
              >
                <Check className="w-4 h-4" />
                {savingBrand ? 'Salvando...' : 'Salvar Alterações'}
              </button>
            </div>

            {/* 5 Theme Presets */}
            <section className="p-6 bg-[var(--site-surface)] border border-[var(--site-border)] rounded-[var(--site-radius)] space-y-4">
              <div className="flex items-center gap-2 text-sm font-semibold">
                <Sparkles className="w-4 h-4 text-[var(--site-accent)]" />
                <span>Temas Prontos (aplicação imediata)</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {Object.values(THEME_PRESETS).map((preset) => {
                  const selected = brandForm.themePreset === preset.id;
                  return (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() => handleApplyPreset(preset.id)}
                      className={`text-left p-4 border rounded-[var(--site-radius)] space-y-2 transition-colors ${
                        selected ? 'border-[var(--site-accent)] bg-[var(--site-bg)]' : 'border-[var(--site-border)]'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold">{preset.name}</span>
                        <div className="flex gap-1">
                          <span className="w-3 h-3 rounded-full border border-black/10" style={{ backgroundColor: preset.config.backgroundColor }} />
                          <span className="w-3 h-3 rounded-full border border-black/10" style={{ backgroundColor: preset.config.primaryColor }} />
                          <span className="w-3 h-3 rounded-full border border-black/10" style={{ backgroundColor: preset.config.accentColor }} />
                        </div>
                      </div>
                      <p className="text-[11px] text-[var(--site-text-muted)]">{preset.description}</p>
                    </button>
                  );
                })}
              </div>

              {/* Granular Color & Shape Customizer */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-4 border-t border-[var(--site-border)] text-xs">
                {(
                  [
                    ['backgroundColor', 'Fundo do site'],
                    ['surfaceColor', 'Superfície / Cards'],
                    ['textColor', 'Texto principal'],
                    ['accentColor', 'Cor de destaque'],
                  ] as Array<[keyof ThemeConfig, string]>
                ).map(([key, label]) => (
                  <label key={key} className="space-y-1 block">
                    <span>{label}</span>
                    <input
                      type="color"
                      value={String(brandForm.themeConfig[key])}
                      onChange={(e) =>
                        setBrandForm((prev) => ({
                          ...prev,
                          themeConfig: { ...prev.themeConfig, [key]: e.target.value },
                        }))
                      }
                      className="w-full h-9 p-1 border border-[var(--site-border)] rounded bg-[var(--site-bg)]"
                    />
                  </label>
                ))}
              </div>
            </section>

            {/* Broker Identity & Contact Info */}
            <section className="p-6 bg-[var(--site-surface)] border border-[var(--site-border)] rounded-[var(--site-radius)] space-y-4 text-xs">
              <h3 className="text-sm font-semibold border-b border-[var(--site-border)] pb-2">
                Dados da Marca, Corretor & Contato
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <label className="space-y-1 block">
                  <span>Nome da Marca *</span>
                  <input
                    type="text"
                    required
                    value={brandForm.brandName}
                    onChange={(e) => setBrandForm({ ...brandForm, brandName: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-[var(--site-border)] rounded bg-[var(--site-bg)]"
                  />
                </label>
                <label className="space-y-1 block">
                  <span>Corretor(a) Responsável *</span>
                  <input
                    type="text"
                    required
                    value={brandForm.brokerName}
                    onChange={(e) => setBrandForm({ ...brandForm, brokerName: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-[var(--site-border)] rounded bg-[var(--site-bg)]"
                  />
                </label>
                <label className="space-y-1 block">
                  <span>CRECI</span>
                  <input
                    type="text"
                    value={brandForm.creci}
                    onChange={(e) => setBrandForm({ ...brandForm, creci: e.target.value })}
                    placeholder="Ex.: CRECI-RJ 00000"
                    className="w-full px-3 py-2 text-sm border border-[var(--site-border)] rounded bg-[var(--site-bg)]"
                  />
                </label>
                <label className="space-y-1 block">
                  <span>WhatsApp Comercial (com DDD)</span>
                  <input
                    type="text"
                    value={brandForm.whatsapp}
                    onChange={(e) => setBrandForm({ ...brandForm, whatsapp: e.target.value })}
                    placeholder="Ex.: 21999999999"
                    className="w-full px-3 py-2 text-sm border border-[var(--site-border)] rounded bg-[var(--site-bg)]"
                  />
                </label>
                <label className="space-y-1 block">
                  <span>Telefone</span>
                  <input
                    type="text"
                    value={brandForm.phone}
                    onChange={(e) => setBrandForm({ ...brandForm, phone: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-[var(--site-border)] rounded bg-[var(--site-bg)]"
                  />
                </label>
                <label className="space-y-1 block">
                  <span>E-mail de atendimento</span>
                  <input
                    type="email"
                    value={brandForm.email}
                    onChange={(e) => setBrandForm({ ...brandForm, email: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-[var(--site-border)] rounded bg-[var(--site-bg)]"
                  />
                </label>
                <label className="space-y-1 block">
                  <span>Cidade *</span>
                  <input
                    type="text"
                    required
                    value={brandForm.city}
                    onChange={(e) => setBrandForm({ ...brandForm, city: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-[var(--site-border)] rounded bg-[var(--site-bg)]"
                  />
                </label>
                <label className="space-y-1 block">
                  <span>Estado (UF)</span>
                  <input
                    type="text"
                    value={brandForm.state}
                    onChange={(e) => setBrandForm({ ...brandForm, state: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-[var(--site-border)] rounded bg-[var(--site-bg)]"
                  />
                </label>
                <label className="space-y-1 block">
                  <span>Instagram Handle</span>
                  <input
                    type="text"
                    value={brandForm.instagramHandle}
                    onChange={(e) => setBrandForm({ ...brandForm, instagramHandle: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-[var(--site-border)] rounded bg-[var(--site-bg)]"
                  />
                </label>
              </div>

              <label className="space-y-1 block">
                <span>Regiões atendidas (separadas por vírgula)</span>
                <input
                  type="text"
                  value={regionsInput}
                  onChange={(e) => setRegionsInput(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-[var(--site-border)] rounded bg-[var(--site-bg)]"
                />
              </label>

              {/* Uploads: Logo, Hero Images, About Photo */}
              <div className="space-y-3 pt-2">
                {(brandForm.logoUrl || brandForm.aboutPhotoUrl) && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {brandForm.logoUrl && (
                      <div className="flex items-center gap-4 p-3 rounded border border-[var(--site-border)] bg-[var(--site-bg)]">
                        <img
                          src={brandForm.logoUrl}
                          alt={brandForm.brandName}
                          referrerPolicy="no-referrer"
                          className="h-14 w-auto object-contain bg-transparent"
                        />
                        <div className="text-[11px] text-[var(--site-text-muted)]">
                          <p className="font-medium text-[var(--site-text)]">Logotipo atual (fundo transparente)</p>
                          <p>Exibido no cabeçalho, rodapé e área administrativa.</p>
                        </div>
                      </div>
                    )}
                    {brandForm.aboutPhotoUrl && (
                      <div className="flex items-center gap-4 p-3 rounded border border-[var(--site-border)] bg-[var(--site-bg)]">
                        <img
                          src={brandForm.aboutPhotoUrl}
                          alt={brandForm.brokerName}
                          referrerPolicy="no-referrer"
                          className="h-16 w-auto rounded-t-full rounded-b-lg object-contain"
                        />
                        <div className="text-[11px] text-[var(--site-text-muted)]">
                          <p className="font-medium text-[var(--site-text)]">Retrato da Seção Sobre</p>
                          <p>Exibido integralmente na página inicial e em Sobre.</p>
                        </div>
                      </div>
                    )}
                  </div>
                )}
                <div className="flex flex-wrap gap-3">
                  <label className="inline-flex items-center gap-1.5 px-3 py-2 border border-[var(--site-border)] rounded cursor-pointer">
                    <Upload className="w-3.5 h-3.5" />
                    Enviar Logotipo
                    <input type="file" accept="image/*" className="hidden" onChange={(e) => handleBrandImageUpload(e, 'logoUrl')} />
                  </label>
                  <label className="inline-flex items-center gap-1.5 px-3 py-2 border border-[var(--site-border)] rounded cursor-pointer">
                    <Upload className="w-3.5 h-3.5" />
                    Adicionar Foto ao Hero ({brandForm.heroImages?.length || 0})
                    <input type="file" accept="image/*" multiple className="hidden" onChange={(e) => handleBrandImageUpload(e, 'heroImages')} />
                  </label>
                  <label className="inline-flex items-center gap-1.5 px-3 py-2 border border-[var(--site-border)] rounded cursor-pointer">
                    <Upload className="w-3.5 h-3.5" />
                    Foto da Seção Sobre
                    <input type="file" accept="image/*" className="hidden" onChange={(e) => handleBrandImageUpload(e, 'aboutPhotoUrl')} />
                  </label>
                </div>
              </div>
            </section>

            {/* Hero, Bio, SEO & Analytics */}
            <section className="p-6 bg-[var(--site-surface)] border border-[var(--site-border)] rounded-[var(--site-radius)] space-y-4 text-xs">
              <h3 className="text-sm font-semibold border-b border-[var(--site-border)] pb-2">
                Editorial, SEO & Google Tags
              </h3>
              <label className="space-y-1 block">
                <span>Título Hero Principal</span>
                <input
                  type="text"
                  value={brandForm.heroTitle}
                  onChange={(e) => setBrandForm({ ...brandForm, heroTitle: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-[var(--site-border)] rounded bg-[var(--site-bg)]"
                />
              </label>
              <label className="space-y-1 block">
                <span>Subtítulo Hero</span>
                <input
                  type="text"
                  value={brandForm.heroSubtitle}
                  onChange={(e) => setBrandForm({ ...brandForm, heroSubtitle: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-[var(--site-border)] rounded bg-[var(--site-bg)]"
                />
              </label>
              <label className="space-y-1 block">
                <span>Biografia / Apresentação Sobre</span>
                <textarea
                  rows={3}
                  value={brandForm.aboutBio}
                  onChange={(e) => setBrandForm({ ...brandForm, aboutBio: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-[var(--site-border)] rounded bg-[var(--site-bg)]"
                />
              </label>
              <label className="space-y-1 block">
                <span>Especialidades (uma por linha)</span>
                <textarea
                  rows={3}
                  value={specialtiesInput}
                  onChange={(e) => setSpecialtiesInput(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-[var(--site-border)] rounded bg-[var(--site-bg)]"
                />
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <label className="space-y-1 block">
                  <span>SEO Title</span>
                  <input
                    type="text"
                    value={brandForm.seoTitle}
                    onChange={(e) => setBrandForm({ ...brandForm, seoTitle: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-[var(--site-border)] rounded bg-[var(--site-bg)]"
                  />
                </label>
                <label className="space-y-1 block">
                  <span>Domínio Personalizado</span>
                  <input
                    type="text"
                    value={brandForm.customDomain}
                    onChange={(e) => setBrandForm({ ...brandForm, customDomain: e.target.value })}
                    placeholder="ex.: www.ivyoliveiraimoveis.com.br"
                    className="w-full px-3 py-2 text-sm border border-[var(--site-border)] rounded bg-[var(--site-bg)]"
                  />
                </label>
                <label className="space-y-1 block">
                  <span>Google Analytics 4 (G-XXXXXXXX)</span>
                  <input
                    type="text"
                    value={brandForm.ga4Id}
                    onChange={(e) => setBrandForm({ ...brandForm, ga4Id: e.target.value })}
                    className="w-full px-3 py-2 text-sm font-mono border border-[var(--site-border)] rounded bg-[var(--site-bg)]"
                  />
                </label>
                <label className="space-y-1 block">
                  <span>Google Tag Manager (GTM-XXXXXX)</span>
                  <input
                    type="text"
                    value={brandForm.gtmId}
                    onChange={(e) => setBrandForm({ ...brandForm, gtmId: e.target.value })}
                    className="w-full px-3 py-2 text-sm font-mono border border-[var(--site-border)] rounded bg-[var(--site-bg)]"
                  />
                </label>
              </div>
            </section>
          </form>
        )}

        {/* TAB 8: SECURITY & REAL-TIME PASSWORD CHANGE */}
        {tab === 'security' && (
          <div className="space-y-8 max-w-2xl">
            <div>
              <h2 className="font-editorial text-3xl font-semibold">Segurança & Senha do Administrador</h2>
              <p className="text-xs text-[var(--site-text-muted)]">
                Altere sua senha administrativa diretamente no Firebase Authentication em tempo real.
              </p>
            </div>

            <div className="p-6 bg-[var(--site-surface)] border border-[var(--site-border)] rounded-[var(--site-radius)] space-y-6">
              <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-[var(--site-border)]">
                <div>
                  <p className="text-[11px] uppercase tracking-wider text-[var(--site-text-muted)]">Conta autenticada</p>
                  <p className="text-sm font-medium mt-0.5">{user?.email || profile?.email}</p>
                </div>
                <span className="px-2.5 py-1 text-[11px] font-medium bg-emerald-50 text-emerald-800 border border-emerald-200 rounded">
                  Firebase Auth Ativo
                </span>
              </div>

              <form onSubmit={handleChangeAdminPassword} className="space-y-4 text-xs">
                <label className="space-y-1.5 block">
                  <span className="font-medium">Senha atual *</span>
                  <div className="relative">
                    <input
                      type={showCurrentPwd ? 'text' : 'password'}
                      required
                      autoComplete="current-password"
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      placeholder="Digite sua senha atual"
                      className="w-full px-3 py-2.5 pr-10 text-sm border border-[var(--site-border)] rounded-[var(--site-radius)] bg-[var(--site-bg)]"
                    />
                    <button
                      type="button"
                      onClick={() => setShowCurrentPwd((v) => !v)}
                      aria-label="Mostrar ou ocultar senha atual"
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--site-text-muted)] hover:text-[var(--site-text)]"
                    >
                      {showCurrentPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </label>

                <label className="space-y-1.5 block">
                  <span className="font-medium">Nova senha (mínimo 6 caracteres) *</span>
                  <div className="relative">
                    <input
                      type={showNewPwd ? 'text' : 'password'}
                      required
                      minLength={6}
                      autoComplete="new-password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="Digite a nova senha"
                      className="w-full px-3 py-2.5 pr-10 text-sm border border-[var(--site-border)] rounded-[var(--site-radius)] bg-[var(--site-bg)]"
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPwd((v) => !v)}
                      aria-label="Mostrar ou ocultar nova senha"
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--site-text-muted)] hover:text-[var(--site-text)]"
                    >
                      {showNewPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </label>

                <label className="space-y-1.5 block">
                  <span className="font-medium">Confirmar nova senha *</span>
                  <div className="relative">
                    <input
                      type={showConfirmPwd ? 'text' : 'password'}
                      required
                      minLength={6}
                      autoComplete="new-password"
                      value={confirmNewPassword}
                      onChange={(e) => setConfirmNewPassword(e.target.value)}
                      placeholder="Repita a nova senha"
                      className="w-full px-3 py-2.5 pr-10 text-sm border border-[var(--site-border)] rounded-[var(--site-radius)] bg-[var(--site-bg)]"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPwd((v) => !v)}
                      aria-label="Mostrar ou ocultar confirmação da senha"
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--site-text-muted)] hover:text-[var(--site-text)]"
                    >
                      {showConfirmPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </label>

                <div className="pt-2 flex flex-wrap items-center justify-between gap-3">
                  <p className="text-[11px] text-[var(--site-text-muted)]">
                    A atualização é imediata no Firebase e registrada no histórico de auditoria.
                  </p>
                  <button
                    type="submit"
                    disabled={updatingPassword}
                    className="inline-flex items-center gap-2 px-5 py-2.5 text-xs font-medium bg-[var(--site-text)] text-[var(--site-surface)] rounded-[var(--site-radius)] disabled:opacity-50"
                  >
                    <KeyRound className="w-4 h-4" />
                    {updatingPassword ? 'Atualizando no Firebase...' : 'Alterar Senha Agora'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* TAB 9: MULTI-TENANT & AUDIT LOGS */}
        {tab === 'tenants' && (
          <div className="space-y-8">
            <div>
              <h2 className="font-editorial text-3xl font-semibold">Multi-Corretor & Auditoria</h2>
              <p className="text-xs text-[var(--site-text-muted)]">
                Gerencie ambientes isolados por corretor/imobiliária e acompanhe o registro imutável de alterações.
              </p>
            </div>

            {isAdmin && (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                <div className="lg:col-span-6 p-6 bg-[var(--site-surface)] border border-[var(--site-border)] rounded-[var(--site-radius)] space-y-4">
                  <h3 className="text-sm font-semibold">Corretores / Tenants Ativos</h3>
                  <div className="space-y-2">
                    {allTenants.map((t) => (
                      <div
                        key={t.id}
                        className={`p-3 border rounded flex items-center justify-between text-xs ${
                          t.id === activeTenantId ? 'border-[var(--site-accent)] bg-[var(--site-bg)]' : 'border-[var(--site-border)]'
                        }`}
                      >
                        <div>
                          <p className="font-semibold">{t.brandName}</p>
                          <p className="text-[var(--site-text-muted)]">
                            {t.brokerName} · {t.city}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => setActiveTenantId(t.id)}
                          className="px-3 py-1.5 border border-[var(--site-border)] rounded hover:border-[var(--site-accent)]"
                        >
                          {t.id === activeTenantId ? 'Em edição' : 'Gerenciar'}
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                <form
                  onSubmit={handleCreateTenant}
                  className="lg:col-span-6 p-6 bg-[var(--site-surface)] border border-[var(--site-border)] rounded-[var(--site-radius)] space-y-4 text-xs"
                >
                  <h3 className="text-sm font-semibold">Provisionar Novo Corretor</h3>
                  <input
                    type="text"
                    required
                    value={newTenantBrand}
                    onChange={(e) => setNewTenantBrand(e.target.value)}
                    placeholder="Nome da Marca Imobiliária *"
                    className="w-full px-3 py-2 text-sm border border-[var(--site-border)] rounded bg-[var(--site-bg)]"
                  />
                  <input
                    type="text"
                    required
                    value={newTenantBroker}
                    onChange={(e) => setNewTenantBroker(e.target.value)}
                    placeholder="Nome do Corretor Responsável *"
                    className="w-full px-3 py-2 text-sm border border-[var(--site-border)] rounded bg-[var(--site-bg)]"
                  />
                  <div className="grid grid-cols-2 gap-3">
                    <input
                      type="text"
                      value={newTenantCity}
                      onChange={(e) => setNewTenantCity(e.target.value)}
                      placeholder="Cidade"
                      className="px-3 py-2 text-sm border border-[var(--site-border)] rounded bg-[var(--site-bg)]"
                    />
                    <input
                      type="text"
                      value={newTenantState}
                      onChange={(e) => setNewTenantState(e.target.value)}
                      placeholder="UF"
                      className="px-3 py-2 text-sm border border-[var(--site-border)] rounded bg-[var(--site-bg)]"
                    />
                  </div>
                  <button
                    type="submit"
                    className="px-5 py-2.5 font-medium bg-[var(--site-text)] text-[var(--site-surface)] rounded"
                  >
                    Criar Ambiente de Corretor
                  </button>
                </form>
              </div>
            )}

            <section className="p-6 bg-[var(--site-surface)] border border-[var(--site-border)] rounded-[var(--site-radius)] space-y-4">
              <h3 className="text-sm font-semibold">Histórico de Auditoria</h3>
              {auditLogs.length === 0 ? (
                <p className="text-xs text-[var(--site-text-muted)]">Nenhuma alteração registrada ainda.</p>
              ) : (
                <div className="space-y-2 text-xs">
                  {auditLogs.slice(0, 30).map((log) => (
                    <div
                      key={log.id}
                      className="py-2 border-b border-[var(--site-border)] flex flex-wrap items-center justify-between gap-2"
                    >
                      <span>{log.summary}</span>
                      <span className="text-[var(--site-text-muted)] font-mono">
                        {log.actorEmail} · {formatTimestampDate(log.createdAt)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>
        )}
      </div>

      {/* Property Create / Edit Modal */}
      {editingProperty !== undefined && (
        <PropertyEditorModal
          existingProperty={editingProperty}
          onClose={() => setEditingProperty(undefined)}
        />
      )}
    </div>
  );
}
