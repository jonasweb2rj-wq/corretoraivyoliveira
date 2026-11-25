import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, ArrowRight, Building2, Check } from 'lucide-react';
import { useAppContext } from '../../hooks/useAuthTenant';
import { subscribePublishedDevelopments } from '../../firebase/firestoreService';
import { Development } from '../../types/realestate';
import { ProGallery } from '../../components/properties/ProGallery';
import { LeadCaptureForm } from '../../components/leads/LeadCaptureForm';
import { formatCurrencyBRL } from '../../utils/formatters';
import { applySeoMetadata } from '../../utils/seo';

interface DevelopmentsPageProps {
  slug?: string;
  onNavigate: (to: string) => void;
}

export function DevelopmentsPage({ slug, onNavigate }: DevelopmentsPageProps) {
  const { tenant } = useAppContext();
  const [developments, setDevelopments] = useState<Development[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = subscribePublishedDevelopments(tenant.id, (items) => {
      setDevelopments(items);
      setLoading(false);
    });
    return () => unsub();
  }, [tenant.id]);

  const activeDev = useMemo(
    () => (slug ? developments.find((d) => d.slug === slug || d.id === slug) : undefined),
    [developments, slug]
  );

  useEffect(() => {
    if (activeDev) {
      applySeoMetadata({
        title: activeDev.seoTitle || `${activeDev.name} — ${tenant.brandName}`,
        description: activeDev.seoDescription || activeDev.description.slice(0, 155),
        image: activeDev.coverImage,
      });
    } else {
      applySeoMetadata({
        title: `Empreendimentos & Lançamentos — ${tenant.brandName}`,
        description: `Lançamentos, condomínios e projetos residenciais e comerciais em ${tenant.city}.`,
      });
    }
  }, [activeDev, tenant]);

  if (slug && !loading && !activeDev) {
    return (
      <div className="max-w-3xl mx-auto px-6 py-24 text-center space-y-5">
        <h1 className="font-editorial text-4xl font-semibold">Empreendimento não encontrado</h1>
        <button
          type="button"
          onClick={() => onNavigate('/empreendimentos')}
          className="px-6 py-3 text-sm font-medium bg-[var(--site-text)] text-[var(--site-surface)] rounded-[var(--site-radius)]"
        >
          Ver todos os empreendimentos
        </button>
      </div>
    );
  }

  if (activeDev) {
    return (
      <div className="max-w-7xl mx-auto px-6 py-12 space-y-14">
        <button
          type="button"
          onClick={() => onNavigate('/empreendimentos')}
          className="inline-flex items-center gap-2 text-xs font-medium text-[var(--site-text-muted)] hover:text-[var(--site-text)]"
        >
          <ArrowLeft className="w-4 h-4" />
          Voltar para empreendimentos
        </button>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-end border-b border-[var(--site-border)] pb-8">
          <div className="lg:col-span-8 space-y-3">
            <p className="text-xs text-[var(--site-text-muted)]">
              {activeDev.category.toUpperCase()} · {activeDev.neighborhood}, {activeDev.city}
              {activeDev.developer ? ` · ${activeDev.developer}` : ''}
            </p>
            <h1 className="font-editorial text-4xl sm:text-5xl font-semibold">{activeDev.name}</h1>
          </div>
          <div className="lg:col-span-4 lg:text-right">
            <p className="text-xs text-[var(--site-text-muted)]">Unidades a partir de</p>
            <p className="font-mono text-2xl font-semibold tabular-nums">
              {activeDev.priceFrom > 0 ? formatCurrencyBRL(activeDev.priceFrom) : 'Sob consulta'}
            </p>
            {activeDev.deliveryDate && (
              <p className="text-xs text-[var(--site-text-muted)]">Previsão: {activeDev.deliveryDate}</p>
            )}
          </div>
        </div>

        <ProGallery images={activeDev.images} title={activeDev.name} />

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-start">
          <div className="lg:col-span-7 space-y-10">
            <section className="space-y-4">
              <h2 className="font-editorial text-3xl font-semibold">O Projeto</h2>
              <p className="text-sm sm:text-base text-[var(--site-text-muted)] leading-relaxed whitespace-pre-line">
                {activeDev.description}
              </p>
            </section>

            {activeDev.technicalSpecs?.length > 0 && (
              <section className="space-y-4 pt-6 border-t border-[var(--site-border)]">
                <h2 className="font-editorial text-2xl font-semibold">Ficha Técnica</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                  {activeDev.technicalSpecs.map((spec, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <Check className="w-4 h-4 text-[var(--site-accent)] shrink-0" />
                      <span>{spec}</span>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {activeDev.floorPlans?.length > 0 && (
              <section className="space-y-4 pt-6 border-t border-[var(--site-border)]">
                <h2 className="font-editorial text-2xl font-semibold">Plantas</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {activeDev.floorPlans.map((fp, idx) => (
                    <div key={fp.id || idx} className="border border-[var(--site-border)] rounded-[var(--site-radius)] overflow-hidden bg-[var(--site-surface)]">
                      <img
                        src={fp.url}
                        alt={fp.caption || `Planta ${idx + 1}`}
                        referrerPolicy="no-referrer"
                        className="w-full h-56 object-contain bg-white p-2"
                      />
                      {fp.caption && (
                        <p className="p-3 text-xs text-[var(--site-text-muted)] border-t border-[var(--site-border)]">
                          {fp.caption}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </section>
            )}
          </div>

          <aside className="lg:col-span-5">
            <LeadCaptureForm
              defaultInterest="empreendimento"
              developmentId={activeDev.id}
              propertyTitle={activeDev.name}
              source="development_detail"
              title="Receber book e tabela de valores"
              subtitle={`Solicite as plantas e disponibilidades atualizadas de ${activeDev.name}.`}
            />
          </aside>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-6 py-14 space-y-12">
      <div className="space-y-2 border-b border-[var(--site-border)] pb-8">
        <p className="text-xs font-medium text-[var(--site-accent)]">Lançamentos & Condomínios</p>
        <h1 className="font-editorial text-4xl sm:text-5xl font-semibold">Empreendimentos</h1>
        <p className="text-sm text-[var(--site-text-muted)]">
          Projetos residenciais e comerciais selecionados no Rio de Janeiro.
        </p>
      </div>

      {loading ? (
        <div className="h-72 bg-[var(--site-surface)] border border-[var(--site-border)] rounded-[var(--site-radius)] animate-pulse" />
      ) : developments.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {developments.map((dev) => (
            <article
              key={dev.id}
              onClick={() => onNavigate(`/empreendimento/${dev.slug}`)}
              className="group cursor-pointer bg-[var(--site-surface)] border border-[var(--site-border)] rounded-[var(--site-radius)] overflow-hidden flex flex-col"
            >
              <div className="aspect-[16/10] overflow-hidden bg-[var(--site-surface-alt)]">
                {dev.coverImage ? (
                  <img
                    src={dev.coverImage}
                    alt={dev.name}
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <Building2 className="w-10 h-10 opacity-30" />
                  </div>
                )}
              </div>
              <div className="p-6 space-y-3 flex-1 flex flex-col justify-between">
                <div className="space-y-2">
                  <p className="text-xs text-[var(--site-text-muted)]">
                    {dev.neighborhood} · {dev.city}
                    {dev.deliveryDate ? ` · ${dev.deliveryDate}` : ''}
                  </p>
                  <h2 className="font-editorial text-2xl font-semibold">{dev.name}</h2>
                  <p className="text-sm text-[var(--site-text-muted)] line-clamp-3">{dev.description}</p>
                </div>
                <div className="pt-4 border-t border-[var(--site-border)] flex items-center justify-between text-xs font-medium">
                  <span className="font-mono text-sm tabular-nums">
                    {dev.priceFrom > 0 ? `Desde ${formatCurrencyBRL(dev.priceFrom)}` : 'Sob consulta'}
                  </span>
                  <span className="inline-flex items-center gap-1 group-hover:text-[var(--site-accent)]">
                    Ver detalhes <ArrowRight className="w-3.5 h-3.5" />
                  </span>
                </div>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          <div className="lg:col-span-6 p-8 bg-[var(--site-surface)] border border-[var(--site-border)] rounded-[var(--site-radius)] space-y-4">
            <h2 className="font-editorial text-3xl font-semibold">
              Lançamentos sob consulta direta
            </h2>
            <p className="text-sm text-[var(--site-text-muted)] leading-relaxed">
              Assim que novos empreendimentos forem publicados pelo corretor no painel administrativo, suas galerias, plantas e fichas técnicas ficarão disponíveis aqui em tempo real.
            </p>
          </div>
          <div className="lg:col-span-6">
            <LeadCaptureForm
              defaultInterest="empreendimento"
              source="developments_empty"
              title="Consultar lançamentos disponíveis"
              subtitle="Informe a região desejada para receber opções atualizadas."
            />
          </div>
        </div>
      )}
    </div>
  );
}
