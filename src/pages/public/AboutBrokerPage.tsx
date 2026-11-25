import { useEffect } from 'react';
import { Compass, MapPin, MessageCircle } from 'lucide-react';
import { useAppContext } from '../../hooks/useAuthTenant';
import { LeadCaptureForm } from '../../components/leads/LeadCaptureForm';
import { buildWhatsAppUrl } from '../../utils/formatters';
import { applySeoMetadata } from '../../utils/seo';

export function AboutBrokerPage() {
  const { tenant } = useAppContext();

  useEffect(() => {
    applySeoMetadata({
      title: `Sobre ${tenant.brokerName} — ${tenant.brandName}`,
      description: tenant.aboutBio.slice(0, 155),
      image: tenant.aboutPhotoUrl,
    });
  }, [tenant]);

  const whatsappUrl = buildWhatsAppUrl(
    tenant.whatsapp,
    `Olá ${tenant.brokerName}! Gostaria de agendar uma conversa sobre consultoria imobiliária.`
  );

  return (
    <div className="max-w-7xl mx-auto px-6 py-16 space-y-20">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
        <div className="lg:col-span-5 flex justify-center">
          <div className="w-full max-w-[460px] rounded-t-full rounded-b-[2rem] overflow-hidden shadow-[0_24px_60px_-20px_rgba(20,20,19,0.22)]">
            <img
              src={tenant.aboutPhotoUrl || '/src/assets/images/ivy_oliveira_corretora.png'}
              alt={tenant.brokerName}
              referrerPolicy="no-referrer"
              className="w-full h-auto block object-contain"
            />
          </div>
        </div>

        <div className="lg:col-span-7 flex flex-col justify-center space-y-6">
          <div className="space-y-2">
            <p className="text-xs font-medium text-[var(--site-accent)]">
              {tenant.brandName}
              {tenant.creci ? ` · ${tenant.creci}` : ''}
              {tenant.aboutExperienceYears ? ` · ${tenant.aboutExperienceYears}` : ''}
            </p>
            <h1 className="font-editorial text-4xl sm:text-5xl font-semibold text-balance">
              {tenant.brokerName}
            </h1>
            <p className="text-base font-medium text-[var(--site-text)]">{tenant.aboutHeadline}</p>
          </div>

          <p className="text-sm sm:text-base text-[var(--site-text-muted)] leading-relaxed whitespace-pre-line">
            {tenant.aboutBio}
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pt-4 border-t border-[var(--site-border)]">
            <div className="space-y-2">
              <h2 className="text-xs font-semibold text-[var(--site-text-muted)] flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-[var(--site-accent)]" />
                Regiões de Atuação
              </h2>
              <p className="text-sm text-[var(--site-text)]">{tenant.regions.join(' · ')}</p>
            </div>
            <div className="space-y-2">
              <h2 className="text-xs font-semibold text-[var(--site-text-muted)] flex items-center gap-1.5">
                <Compass className="w-3.5 h-3.5 text-[var(--site-accent)]" />
                Especialidades
              </h2>
              <ul className="text-sm space-y-1">
                {tenant.specialties.map((s, idx) => (
                  <li key={idx}>{s}</li>
                ))}
              </ul>
            </div>
          </div>

          <div className="flex flex-wrap gap-4 pt-2">
            {whatsappUrl && (
              <a
                href={whatsappUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-5 py-3 text-xs font-medium bg-[var(--site-text)] text-[var(--site-surface)] rounded-[var(--site-radius)]"
              >
                <MessageCircle className="w-4 h-4" />
                Conversar no WhatsApp
              </a>
            )}
            {tenant.instagramUrl && (
              <a
                href={tenant.instagramUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-5 py-3 text-xs font-medium border border-[var(--site-border)] rounded-[var(--site-radius)] hover:border-[var(--site-accent)]"
              >
                {tenant.instagramHandle || 'Instagram'}
              </a>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-start pt-12 border-t border-[var(--site-border)]">
        <div className="lg:col-span-5 space-y-4">
          <h2 className="font-editorial text-3xl font-semibold">Contato Direto</h2>
          <p className="text-sm text-[var(--site-text-muted)] leading-relaxed">
            Agende uma consultoria para compra, venda ou avaliação do seu patrimônio imobiliário.
          </p>
          <div className="text-sm space-y-1 text-[var(--site-text-muted)]">
            <p>{tenant.city}{tenant.state ? `, ${tenant.state}` : ''}</p>
            {tenant.email && <p>{tenant.email}</p>}
            {tenant.phone && <p>{tenant.phone}</p>}
          </div>
        </div>
        <div className="lg:col-span-7">
          <LeadCaptureForm source="about_page" />
        </div>
      </div>
    </div>
  );
}
