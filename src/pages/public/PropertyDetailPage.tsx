import { useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  Check,
  Compass,
  MapPin,
  MessageCircle,
  Share2,
} from 'lucide-react';
import { useAppContext } from '../../hooks/useAuthTenant';
import { subscribePublishedProperties, trackPublicEvent } from '../../firebase/firestoreService';
import { Property } from '../../types/realestate';
import { ProGallery } from '../../components/properties/ProGallery';
import { VirtualTourModal } from '../../components/virtual-tour/VirtualTourModal';
import { LeadCaptureForm } from '../../components/leads/LeadCaptureForm';
import { PropertyCard } from '../../components/properties/PropertyCard';
import {
  buildWhatsAppUrl,
  formatCurrencyBRL,
  propertyTypeLabel,
  transactionTypeLabel,
} from '../../utils/formatters';
import { applySeoMetadata } from '../../utils/seo';

interface PropertyDetailPageProps {
  slug: string;
  onNavigate: (to: string) => void;
}

export function PropertyDetailPage({ slug, onNavigate }: PropertyDetailPageProps) {
  const { tenant } = useAppContext();
  const [properties, setProperties] = useState<Property[]>([]);
  const [loading, setLoading] = useState(true);
  const [tourOpen, setTourOpen] = useState(false);
  const [copiedShare, setCopiedShare] = useState(false);

  useEffect(() => {
    const unsub = subscribePublishedProperties(tenant.id, (items) => {
      setProperties(items);
      setLoading(false);
    });
    return () => unsub();
  }, [tenant.id]);

  const property = useMemo(
    () => properties.find((p) => p.slug === slug || p.id === slug),
    [properties, slug]
  );

  const similarProperties = useMemo(() => {
    if (!property) return [];
    return properties
      .filter((p) => p.id !== property.id)
      .sort((a, b) => {
        const scoreA = (a.neighborhood === property.neighborhood ? 2 : 0) + (a.propertyType === property.propertyType ? 1 : 0);
        const scoreB = (b.neighborhood === property.neighborhood ? 2 : 0) + (b.propertyType === property.propertyType ? 1 : 0);
        return scoreB - scoreA;
      })
      .slice(0, 3);
  }, [properties, property]);

  useEffect(() => {
    if (!property) return;
    applySeoMetadata({
      title: property.seoTitle || `${property.title} — ${tenant.brandName}`,
      description:
        property.seoDescription ||
        property.summary ||
        `${propertyTypeLabel(property.propertyType)} em ${property.neighborhood}, ${property.city}.`,
      image: property.coverImage || property.images?.[0]?.url,
      structuredData: {
        '@context': 'https://schema.org',
        '@type': 'RealEstateListing',
        name: property.title,
        description: property.summary || property.description,
        url: window.location.href,
        offers: {
          '@type': 'Offer',
          price: property.price,
          priceCurrency: 'BRL',
        },
      },
    });
    trackPublicEvent({
      tenantId: tenant.id,
      ownerUid: tenant.ownerUid,
      eventType: 'property_view',
      targetId: property.id,
      path: `/imovel/${property.slug}`,
      source: 'detail_page',
      utmSource: '',
      utmCampaign: '',
    });
  }, [property, tenant]);

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-6 py-20">
        <div className="h-[480px] bg-[var(--site-surface)] border border-[var(--site-border)] rounded-[var(--site-radius)] animate-pulse" />
      </div>
    );
  }

  if (!property) {
    return (
      <div className="max-w-3xl mx-auto px-6 py-24 text-center space-y-5">
        <h1 className="font-editorial text-4xl font-semibold">Imóvel indisponível</h1>
        <p className="text-sm text-[var(--site-text-muted)]">
          Este imóvel pode ter sido negociado ou removido do catálogo público.
        </p>
        <button
          type="button"
          onClick={() => onNavigate('/imoveis')}
          className="px-6 py-3 text-sm font-medium bg-[var(--site-text)] text-[var(--site-surface)] rounded-[var(--site-radius)]"
        >
          Explorar imóveis disponíveis
        </button>
      </div>
    );
  }

  const whatsappUrl = buildWhatsAppUrl(
    tenant.whatsapp,
    `Olá! Tenho interesse no imóvel ${property.title}, código ${property.code}. Gostaria de receber mais informações.`
  );

  const hasVirtualTourMaterial =
    (property.images?.length || 0) > 0 || (property.panorama360Images?.length || 0) > 0;

  const handleShare = async () => {
    trackPublicEvent({
      tenantId: tenant.id,
      ownerUid: tenant.ownerUid,
      eventType: 'share',
      targetId: property.id,
      path: `/imovel/${property.slug}`,
      source: 'share_btn',
      utmSource: '',
      utmCampaign: '',
    });
    if (navigator.share) {
      await navigator.share({
        title: property.title,
        text: property.summary || property.title,
        url: window.location.href,
      }).catch(() => {});
    } else {
      await navigator.clipboard.writeText(window.location.href);
      setCopiedShare(true);
      window.setTimeout(() => setCopiedShare(false), 2500);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-6 py-12 space-y-16">
      {/* Breadcrumb & Actions */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <button
          type="button"
          onClick={() => onNavigate('/imoveis')}
          className="inline-flex items-center gap-2 text-xs font-medium text-[var(--site-text-muted)] hover:text-[var(--site-text)]"
        >
          <ArrowLeft className="w-4 h-4" />
          Voltar para o catálogo
        </button>

        <div className="flex items-center gap-3">
          {hasVirtualTourMaterial && (
            <button
              type="button"
              onClick={() => {
                trackPublicEvent({
                  tenantId: tenant.id,
                  ownerUid: tenant.ownerUid,
                  eventType: 'virtual_tour_open',
                  targetId: property.id,
                  path: `/imovel/${property.slug}`,
                  source: 'detail_tour_btn',
                  utmSource: '',
                  utmCampaign: '',
                });
                setTourOpen(true);
              }}
              className="inline-flex items-center gap-2 px-5 py-2.5 text-xs font-semibold tracking-wide bg-[var(--site-accent)] text-white rounded-[var(--site-radius)] hover:opacity-90 transition-opacity"
            >
              <Compass className="w-4 h-4" />
              VISITAR IMÓVEL VIRTUALMENTE
            </button>
          )}
          <button
            type="button"
            onClick={handleShare}
            className="inline-flex items-center gap-2 px-4 py-2.5 text-xs font-medium border border-[var(--site-border)] bg-[var(--site-surface)] rounded-[var(--site-radius)] hover:border-[var(--site-accent)]"
          >
            {copiedShare ? <Check className="w-4 h-4 text-emerald-700" /> : <Share2 className="w-4 h-4" />}
            {copiedShare ? 'Link copiado' : 'Compartilhar'}
          </button>
        </div>
      </div>

      {/* Header Title & Price */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-end border-b border-[var(--site-border)] pb-8">
        <div className="lg:col-span-8 space-y-3">
          <div className="flex flex-wrap items-center gap-2 text-xs text-[var(--site-text-muted)]">
            <span>{transactionTypeLabel(property.transactionType)}</span>
            <span aria-hidden="true">·</span>
            <span>{propertyTypeLabel(property.propertyType)}</span>
            <span aria-hidden="true">·</span>
            <span>{property.neighborhood}, {property.city}</span>
            <span aria-hidden="true">·</span>
            <span className="font-mono tabular-nums">Cód. {property.code}</span>
          </div>
          <h1 className="font-editorial text-4xl sm:text-5xl font-semibold text-balance">
            {property.title}
          </h1>
          {property.showExactAddress && property.address && (
            <p className="text-sm text-[var(--site-text-muted)] flex items-center gap-1.5">
              <MapPin className="w-4 h-4 text-[var(--site-accent)]" />
              {property.address}
            </p>
          )}
        </div>

        <div className="lg:col-span-4 lg:text-right space-y-1">
          <p className="text-xs text-[var(--site-text-muted)]">Valor</p>
          <p className="font-mono text-3xl font-semibold tabular-nums">
            {formatCurrencyBRL(property.price)}
          </p>
          <p className="text-xs text-[var(--site-text-muted)] tabular-nums">
            {property.condoFee > 0 ? `Condomínio ${formatCurrencyBRL(property.condoFee)}/mês` : ''}
            {property.condoFee > 0 && property.iptu > 0 ? ' · ' : ''}
            {property.iptu > 0 ? `IPTU ${formatCurrencyBRL(property.iptu)}` : ''}
          </p>
        </div>
      </div>

      {/* Pro Gallery */}
      <ProGallery images={property.images} title={property.title} />

      {/* Main Content + Sidebar Lead Form */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-start">
        <div className="lg:col-span-7 space-y-12">
          {/* Technical Specs Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-6 bg-[var(--site-surface)] border border-[var(--site-border)] rounded-[var(--site-radius)]">
            <div>
              <p className="text-xs text-[var(--site-text-muted)]">Área privativa</p>
              <p className="font-mono text-lg font-medium tabular-nums">
                {property.builtArea > 0 ? `${property.builtArea} m²` : '—'}
              </p>
            </div>
            <div>
              <p className="text-xs text-[var(--site-text-muted)]">Quartos / Suítes</p>
              <p className="font-mono text-lg font-medium tabular-nums">
                {property.bedrooms || 0} / {property.suites || 0}
              </p>
            </div>
            <div>
              <p className="text-xs text-[var(--site-text-muted)]">Banheiros</p>
              <p className="font-mono text-lg font-medium tabular-nums">{property.bathrooms || 0}</p>
            </div>
            <div>
              <p className="text-xs text-[var(--site-text-muted)]">Vagas</p>
              <p className="font-mono text-lg font-medium tabular-nums">{property.parkingSpaces || 0}</p>
            </div>
          </div>

          {/* Description */}
          <section className="space-y-4">
            <h2 className="font-editorial text-3xl font-semibold">Sobre o imóvel</h2>
            {property.summary && (
              <p className="text-base font-medium text-[var(--site-text)] leading-relaxed">
                {property.summary}
              </p>
            )}
            <div className="text-sm sm:text-base text-[var(--site-text-muted)] leading-relaxed whitespace-pre-line">
              {property.description}
            </div>
          </section>

          {/* Features & Differentials */}
          {((property.features?.length || 0) > 0 || (property.differentials?.length || 0) > 0) && (
            <section className="space-y-4 pt-6 border-t border-[var(--site-border)]">
              <h2 className="font-editorial text-2xl font-semibold">Características & Diferenciais</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                {[...(property.differentials || []), ...(property.features || [])].map((feat, idx) => (
                  <div key={idx} className="flex items-center gap-2 text-[var(--site-text)]">
                    <Check className="w-4 h-4 text-[var(--site-accent)] shrink-0" />
                    <span>{feat}</span>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Property Videos */}
          {(property.videos?.length || 0) > 0 && (
            <section className="space-y-4 pt-6 border-t border-[var(--site-border)]">
              <h2 className="font-editorial text-2xl font-semibold">Apresentação em Vídeo</h2>
              <div className="grid grid-cols-1 gap-6">
                {property.videos.map((v) => (
                  <div key={v.id} className="space-y-2">
                    <video
                      src={v.url}
                      controls
                      preload="metadata"
                      className="w-full rounded-[var(--site-radius)] border border-[var(--site-border)] bg-black"
                    />
                    <div className="flex items-center justify-between text-xs text-[var(--site-text-muted)]">
                      <span>{v.title}</span>
                      {v.isIllustrativeAi && <span>Apresentação ilustrativa gerada a partir das fotos</span>}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Authorized Location Map Embed */}
          {property.showExactAddress && property.address && (
            <section className="space-y-4 pt-6 border-t border-[var(--site-border)]">
              <h2 className="font-editorial text-2xl font-semibold">Localização</h2>
              <p className="text-sm text-[var(--site-text-muted)]">
                {property.address} — {property.neighborhood}, {property.city}
              </p>
              <iframe
                title={`Mapa de ${property.title}`}
                loading="lazy"
                className="w-full h-72 rounded-[var(--site-radius)] border border-[var(--site-border)]"
                src={`https://www.openstreetmap.org/export/embed.html?bbox=-43.45,-23.03,-43.15,-22.90&layer=mapnik`}
              />
            </section>
          )}
        </div>

        {/* Sticky Sidebar Concierge */}
        <aside className="lg:col-span-5 space-y-6 lg:sticky lg:top-28">
          {whatsappUrl && (
            <a
              href={whatsappUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => {
                trackPublicEvent({
                  tenantId: tenant.id,
                  ownerUid: tenant.ownerUid,
                  eventType: 'whatsapp_click',
                  targetId: property.id,
                  path: `/imovel/${property.slug}`,
                  source: 'detail_whatsapp',
                  utmSource: '',
                  utmCampaign: '',
                });
              }}
              className="w-full inline-flex items-center justify-center gap-2.5 px-6 py-4 text-sm font-medium bg-emerald-800 text-white rounded-[var(--site-radius)] hover:bg-emerald-900 transition-colors"
            >
              <MessageCircle className="w-4 h-4" />
              Conversar sobre este imóvel no WhatsApp
            </a>
          )}

          <LeadCaptureForm
            defaultInterest="visita"
            propertyId={property.id}
            propertyTitle={property.title}
            source="property_detail"
            title="Agendar visita ou solicitar dossiê"
            subtitle={`Atendimento direto com ${tenant.brokerName} para o código ${property.code}.`}
            ctaLabel="Solicitar atendimento"
          />
        </aside>
      </div>

      {/* Similar Properties */}
      {similarProperties.length > 0 && (
        <section className="pt-12 border-t border-[var(--site-border)] space-y-8">
          <h2 className="font-editorial text-3xl font-semibold">Imóveis Semelhantes</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {similarProperties.map((p) => (
              <PropertyCard key={p.id} property={p} onOpen={(s) => onNavigate(`/imovel/${s}`)} />
            ))}
          </div>
        </section>
      )}

      {tourOpen && <VirtualTourModal property={property} onClose={() => setTourOpen(false)} />}
    </div>
  );
}
