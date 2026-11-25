import { ArrowUpRight, Building2, MessageCircle } from 'lucide-react';
import { Property } from '../../types/realestate';
import {
  buildWhatsAppUrl,
  formatCurrencyBRL,
  propertyTypeLabel,
  transactionTypeLabel,
} from '../../utils/formatters';
import { useAppContext } from '../../hooks/useAuthTenant';
import { trackPublicEvent } from '../../firebase/firestoreService';

interface PropertyCardProps {
  property: Property;
  onOpen: (slug: string) => void;
}

export function PropertyCard({ property, onOpen }: PropertyCardProps) {
  const { tenant } = useAppContext();
  const cover = property.coverImage || property.images?.[0]?.url || '';
  const whatsappUrl = buildWhatsAppUrl(
    tenant.whatsapp,
    `Olá! Tenho interesse no imóvel ${property.title}, código ${property.code}. Gostaria de receber mais informações.`
  );

  return (
    <article className="group bg-[var(--site-surface)] border border-[var(--site-border)] rounded-[var(--site-radius)] overflow-hidden transition-shadow duration-300 hover:shadow-lg flex flex-col">
      <button
        type="button"
        onClick={() => onOpen(property.slug)}
        className="relative aspect-[4/3] w-full overflow-hidden bg-[var(--site-surface-alt)] text-left focus-visible:outline-2 focus-visible:outline-[var(--site-accent)]"
      >
        {cover ? (
          <img
            src={cover}
            alt={property.title}
            loading="lazy"
            referrerPolicy="no-referrer"
            className="w-full h-full object-cover transition-transform duration-700 ease-out group-hover:scale-105"
          />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center gap-2 text-[var(--site-text-muted)]">
            <Building2 className="w-8 h-8 opacity-50" />
            <span className="text-xs">{property.title}</span>
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/45 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
      </button>

      <div className="p-6 flex-1 flex flex-col justify-between gap-5">
        <div className="space-y-2.5">
          {/* Zero-Pill Metadata Discipline */}
          <div className="flex flex-wrap items-center gap-2 text-xs text-[var(--site-text-muted)]">
            <span>{transactionTypeLabel(property.transactionType)}</span>
            <span aria-hidden="true">·</span>
            <span>{propertyTypeLabel(property.propertyType)}</span>
            <span aria-hidden="true">·</span>
            <span className="font-mono tabular-nums">Cód. {property.code}</span>
          </div>

          <h3 className="font-editorial text-2xl font-semibold leading-snug text-[var(--site-text)] text-balance">
            <a
              href={`/imovel/${property.slug}`}
              onClick={(e) => {
                e.preventDefault();
                onOpen(property.slug);
              }}
              className="hover:text-[var(--site-accent)] transition-colors"
            >
              {property.title}
            </a>
          </h3>

          <p className="text-sm text-[var(--site-text-muted)]">
            {property.neighborhood}, {property.city}
          </p>
        </div>

        <div className="space-y-4">
          {/* Architectural Specifications */}
          <div className="pt-4 border-t border-[var(--site-border)] flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-[var(--site-text-muted)] tabular-nums">
            {property.builtArea > 0 && <span>{property.builtArea} m²</span>}
            {property.bedrooms > 0 && <span>{property.bedrooms} quartos</span>}
            {property.suites > 0 && <span>{property.suites} suítes</span>}
            {property.bathrooms > 0 && <span>{property.bathrooms} banheiros</span>}
            {property.parkingSpaces > 0 && <span>{property.parkingSpaces} vagas</span>}
          </div>

          <div className="flex items-center justify-between gap-3 pt-1">
            <p className="font-mono text-base font-medium tabular-nums text-[var(--site-text)]">
              {formatCurrencyBRL(property.price)}
            </p>

            <div className="flex items-center gap-2 shrink-0">
              {whatsappUrl && (
                <a
                  href={whatsappUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={`Conversar sobre ${property.title} no WhatsApp`}
                  onClick={() => {
                    trackPublicEvent({
                      tenantId: tenant.id,
                      ownerUid: tenant.ownerUid,
                      eventType: 'whatsapp_click',
                      targetId: property.id,
                      path: `/imovel/${property.slug}`,
                      source: 'property_card',
                      utmSource: '',
                      utmCampaign: '',
                    });
                  }}
                  className="p-2.5 border border-[var(--site-border)] rounded-[var(--site-radius)] text-[var(--site-text)] hover:border-[var(--site-accent)] hover:text-[var(--site-accent)] transition-colors"
                >
                  <MessageCircle className="w-4 h-4" />
                </a>
              )}
              <button
                type="button"
                onClick={() => onOpen(property.slug)}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium bg-[var(--site-text)] text-[var(--site-surface)] rounded-[var(--site-radius)] hover:opacity-90 transition-opacity whitespace-nowrap"
              >
                Detalhes
                <ArrowUpRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </article>
  );
}
