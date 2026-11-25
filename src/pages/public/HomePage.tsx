import { useEffect, useMemo, useRef, useState } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import Lenis from 'lenis';
import { ArrowRight, Compass, MapPin, MessageCircle, Search } from 'lucide-react';
import { useAppContext } from '../../hooks/useAuthTenant';
import {
  subscribePublishedDevelopments,
  subscribePublishedProperties,
  subscribePublishedTestimonials,
  trackPublicEvent,
} from '../../firebase/firestoreService';
import { Development, Property, Testimonial } from '../../types/realestate';
import { PropertyCard } from '../../components/properties/PropertyCard';
import { LeadCaptureForm } from '../../components/leads/LeadCaptureForm';
import { buildWhatsAppUrl, formatCurrencyBRL } from '../../utils/formatters';
import { applySeoMetadata } from '../../utils/seo';

gsap.registerPlugin(ScrollTrigger);

interface HomePageProps {
  onNavigate: (to: string) => void;
}

export function HomePage({ onNavigate }: HomePageProps) {
  const { tenant } = useAppContext();
  const [properties, setProperties] = useState<Property[]>([]);
  const [developments, setDevelopments] = useState<Development[]>([]);
  const [testimonials, setTestimonials] = useState<Testimonial[]>([]);
  const [loading, setLoading] = useState(true);
  const [heroSlide, setHeroSlide] = useState(0);

  // Quick search state
  const [qTx, setQTx] = useState('');
  const [qType, setQType] = useState('');
  const [qRegion, setQRegion] = useState('');

  const pageRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    applySeoMetadata({
      title: tenant.seoTitle || `${tenant.brandName} — Imóveis em ${tenant.city}`,
      description: tenant.seoDescription || tenant.heroSubtitle,
      image: tenant.heroImages?.[0],
    });
    trackPublicEvent({
      tenantId: tenant.id,
      ownerUid: tenant.ownerUid,
      eventType: 'page_view',
      targetId: 'home',
      path: '/',
      source: document.referrer || 'direct',
      utmSource: new URLSearchParams(window.location.search).get('utm_source') || '',
      utmCampaign: new URLSearchParams(window.location.search).get('utm_campaign') || '',
    });
  }, [tenant]);

  useEffect(() => {
    const unsubProps = subscribePublishedProperties(tenant.id, (items) => {
      setProperties(items);
      setLoading(false);
    });
    const unsubDevs = subscribePublishedDevelopments(tenant.id, setDevelopments);
    const unsubTests = subscribePublishedTestimonials(tenant.id, setTestimonials);
    return () => {
      unsubProps();
      unsubDevs();
      unsubTests();
    };
  }, [tenant.id]);

  // Hero slideshow interval
  const heroSlides = tenant.heroImages?.length
    ? tenant.heroImages
    : ['/src/assets/images/hero_rio_architecture_1795532252718.jpg'];

  useEffect(() => {
    if (heroSlides.length <= 1) return;
    const timer = window.setInterval(() => {
      setHeroSlide((prev) => (prev + 1) % heroSlides.length);
    }, 6500);
    return () => window.clearInterval(timer);
  }, [heroSlides.length]);

  // Lenis + GSAP ScrollTrigger orchestration respecting prefers-reduced-motion
  useEffect(() => {
    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReduced) return;

    const lenis = new Lenis({
      duration: 1.15,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      smoothWheel: true,
    });

    const raf = (time: number) => {
      lenis.raf(time);
      requestAnimationFrame(raf);
    };
    const rafId = requestAnimationFrame(raf);
    lenis.on('scroll', ScrollTrigger.update);

    const ctx = gsap.context(() => {
      gsap.from('.hero-stagger', {
        y: 28,
        opacity: 0,
        duration: 0.9,
        stagger: 0.12,
        ease: 'power3.out',
        clearProps: 'transform,opacity',
      });

      gsap.to('.hero-parallax-img', {
        yPercent: 14,
        ease: 'none',
        scrollTrigger: {
          trigger: '.hero-section',
          start: 'top top',
          end: 'bottom top',
          scrub: true,
        },
      });

      gsap.utils.toArray<HTMLElement>('.reveal-section').forEach((sec) => {
        gsap.from(sec, {
          y: 30,
          opacity: 0,
          duration: 0.75,
          ease: 'power2.out',
          clearProps: 'transform,opacity',
          scrollTrigger: {
            trigger: sec,
            start: 'top 86%',
            once: true,
          },
        });
      });

      gsap.from('.about-parallax', {
        y: 26,
        ease: 'none',
        scrollTrigger: {
          trigger: '.about-section',
          start: 'top bottom',
          end: 'bottom top',
          scrub: true,
        },
      });
    }, pageRef);

    return () => {
      cancelAnimationFrame(rafId);
      lenis.destroy();
      ctx.revert();
    };
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      ScrollTrigger.refresh();
    }, 80);
    return () => window.clearTimeout(timer);
  }, [properties.length, developments.length, testimonials.length]);

  const featuredProperties = useMemo(() => {
    const featured = properties.filter((p) => p.featured);
    return (featured.length > 0 ? featured : properties).slice(0, 6);
  }, [properties]);

  const handleQuickSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const params = new URLSearchParams();
    if (qTx) params.set('tx', qTx);
    if (qType) params.set('type', qType);
    if (qRegion.trim()) params.set('q', qRegion.trim());
    const qs = params.toString();
    onNavigate(`/imoveis${qs ? `?${qs}` : ''}`);
  };

  const whatsappUrl = buildWhatsAppUrl(
    tenant.whatsapp,
    `Olá! Visitei o site ${tenant.brandName} e gostaria de conversar sobre imóveis em ${tenant.city}.`
  );

  return (
    <div ref={pageRef}>
      {/* 1. Cinematic Hero Section */}
      <section className="hero-section relative min-h-[84vh] flex items-end overflow-hidden bg-neutral-950 text-white">
        <div className="absolute inset-0">
          {heroSlides.map((src, idx) => (
            <img
              key={src + idx}
              src={src}
              alt={`${tenant.brandName} — ${tenant.city}`}
              referrerPolicy="no-referrer"
              className={`hero-parallax-img absolute inset-0 w-full h-[115%] -top-[7%] object-cover transition-all duration-[2000ms] ease-out ${
                idx === heroSlide ? 'opacity-100 scale-105' : 'opacity-0 scale-100'
              }`}
            />
          ))}
          {/* Measured contrast scrim >= 4.5:1 */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/45 to-black/25" />
        </div>

        <div className="relative z-10 max-w-7xl mx-auto w-full px-6 pb-16 pt-32 grid grid-cols-1 lg:grid-cols-12 gap-10 items-end">
          <div className="lg:col-span-8 space-y-6">
            <p className="hero-stagger text-xs font-medium tracking-widest text-white/80">
              {tenant.city}
              {tenant.state ? ` · ${tenant.state}` : ''}
              {tenant.creci ? ` · ${tenant.creci}` : ''}
            </p>
            <h1 className="hero-stagger font-editorial text-4xl sm:text-5xl lg:text-6xl font-semibold leading-[1.08] tracking-tight text-balance">
              {tenant.heroTitle}
            </h1>
            <p className="hero-stagger text-base sm:text-lg text-white/85 max-w-2xl leading-relaxed">
              {tenant.heroSubtitle}
            </p>
            <div className="hero-stagger flex flex-wrap items-center gap-4 pt-2">
              <button
                type="button"
                onClick={() => onNavigate('/imoveis')}
                className="inline-flex items-center gap-2.5 px-6 py-3.5 text-sm font-medium bg-white text-neutral-950 rounded-[var(--site-radius)] hover:bg-white/90 transition-colors"
              >
                {tenant.heroCtaText || 'Explorar Imóveis'}
                <ArrowRight className="w-4 h-4" />
              </button>
              {whatsappUrl ? (
                <a
                  href={whatsappUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => {
                    trackPublicEvent({
                      tenantId: tenant.id,
                      ownerUid: tenant.ownerUid,
                      eventType: 'whatsapp_click',
                      targetId: 'hero',
                      path: '/',
                      source: 'hero',
                      utmSource: '',
                      utmCampaign: '',
                    });
                  }}
                  className="inline-flex items-center gap-2.5 px-6 py-3.5 text-sm font-medium border border-white/40 text-white rounded-[var(--site-radius)] hover:bg-white/10 transition-colors"
                >
                  <MessageCircle className="w-4 h-4" />
                  Falar no WhatsApp
                </a>
              ) : (
                <a
                  href="#contato"
                  className="inline-flex items-center gap-2.5 px-6 py-3.5 text-sm font-medium border border-white/40 text-white rounded-[var(--site-radius)] hover:bg-white/10 transition-colors"
                >
                  Solicitar Atendimento
                </a>
              )}
            </div>
          </div>

          <div className="lg:col-span-4 hidden lg:flex justify-end items-end">
            {heroSlides.length > 1 && (
              <div className="flex items-center gap-2">
                {heroSlides.map((_, idx) => (
                  <button
                    key={idx}
                    type="button"
                    aria-label={`Slide ${idx + 1}`}
                    onClick={() => setHeroSlide(idx)}
                    className={`h-1.5 rounded-full transition-all ${
                      idx === heroSlide ? 'w-8 bg-white' : 'w-3 bg-white/40 hover:bg-white/70'
                    }`}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </section>

      {/* 2. Quick Search Strip */}
      <section className="border-b border-[var(--site-border)] bg-[var(--site-surface)]">
        <form
          onSubmit={handleQuickSearch}
          className="max-w-7xl mx-auto px-6 py-6 grid grid-cols-1 md:grid-cols-12 gap-4 items-end"
        >
          <label className="md:col-span-3 block space-y-1.5 text-xs font-medium text-[var(--site-text-muted)]">
            <span>Negociação</span>
            <select
              value={qTx}
              onChange={(e) => setQTx(e.target.value)}
              className="w-full px-3.5 py-2.5 text-sm bg-[var(--site-bg)] text-[var(--site-text)] border border-[var(--site-border)] rounded-[var(--site-radius)]"
            >
              <option value="">Todas as modalidades</option>
              <option value="venda">Venda</option>
              <option value="aluguel">Aluguel</option>
              <option value="lancamento">Lançamento</option>
            </select>
          </label>

          <label className="md:col-span-3 block space-y-1.5 text-xs font-medium text-[var(--site-text-muted)]">
            <span>Tipo de Imóvel</span>
            <select
              value={qType}
              onChange={(e) => setQType(e.target.value)}
              className="w-full px-3.5 py-2.5 text-sm bg-[var(--site-bg)] text-[var(--site-text)] border border-[var(--site-border)] rounded-[var(--site-radius)]"
            >
              <option value="">Todos os tipos</option>
              <option value="apartamento">Apartamento</option>
              <option value="cobertura">Cobertura</option>
              <option value="casa">Casa</option>
              <option value="terreno">Terreno</option>
              <option value="comercial">Comercial</option>
            </select>
          </label>

          <label className="md:col-span-4 block space-y-1.5 text-xs font-medium text-[var(--site-text-muted)]">
            <span>Bairro, região ou código</span>
            <input
              type="text"
              value={qRegion}
              onChange={(e) => setQRegion(e.target.value)}
              placeholder="Ex.: Leblon, Barra da Tijuca, Ipanema..."
              className="w-full px-3.5 py-2.5 text-sm bg-[var(--site-bg)] text-[var(--site-text)] border border-[var(--site-border)] rounded-[var(--site-radius)]"
            />
          </label>

          <div className="md:col-span-2">
            <button
              type="submit"
              className="w-full inline-flex items-center justify-center gap-2 px-5 py-2.5 text-sm font-medium bg-[var(--site-text)] text-[var(--site-surface)] rounded-[var(--site-radius)] hover:opacity-90 transition-opacity"
            >
              <Search className="w-4 h-4" />
              Buscar
            </button>
          </div>
        </form>
      </section>

      {/* 3. Featured Properties Catalog */}
      <section className="reveal-section max-w-7xl mx-auto px-6 py-20 space-y-10">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div className="space-y-2">
            <p className="text-xs font-medium text-[var(--site-accent)]">Acervo Selecionado</p>
            <h2 className="font-editorial text-3xl sm:text-4xl font-semibold text-balance">
              Imóveis em Destaque
            </h2>
          </div>
          <button
            type="button"
            onClick={() => onNavigate('/imoveis')}
            className="inline-flex items-center gap-2 text-sm font-medium text-[var(--site-text)] hover:text-[var(--site-accent)] transition-colors"
          >
            Ver catálogo completo
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="h-96 bg-[var(--site-surface)] border border-[var(--site-border)] rounded-[var(--site-radius)] animate-pulse"
              />
            ))}
          </div>
        ) : featuredProperties.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {featuredProperties.map((prop) => (
              <PropertyCard
                key={prop.id}
                property={prop}
                onOpen={(slug) => onNavigate(`/imovel/${slug}`)}
              />
            ))}
          </div>
        ) : (
          <div className="p-10 bg-[var(--site-surface)] border border-[var(--site-border)] rounded-[var(--site-radius)] flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
            <div className="space-y-2 max-w-xl">
              <h3 className="font-editorial text-2xl font-semibold">
                Portfólio em atualização em tempo real
              </h3>
              <p className="text-sm text-[var(--site-text-muted)] leading-relaxed">
                Nenhum imóvel foi publicado ainda neste acervo. Novos imóveis cadastrados e publicados no Painel Admin aparecem automaticamente aqui sem necessidade de alterações no código.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <a
                href="#contato"
                className="px-5 py-2.5 text-xs font-medium bg-[var(--site-text)] text-[var(--site-surface)] rounded-[var(--site-radius)]"
              >
                Solicitar imóveis sob demanda
              </a>
              <button
                type="button"
                onClick={() => onNavigate('/admin')}
                className="px-5 py-2.5 text-xs font-medium border border-[var(--site-border)] rounded-[var(--site-radius)] hover:border-[var(--site-accent)]"
              >
                Acessar Painel Admin
              </button>
            </div>
          </div>
        )}
      </section>

      {/* 4. Developments / Launches Showcase */}
      <section className="reveal-section border-y border-[var(--site-border)] bg-[var(--site-surface)]">
        <div className="max-w-7xl mx-auto px-6 py-20 space-y-10">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
            <div className="space-y-2">
              <p className="text-xs font-medium text-[var(--site-accent)]">Incorporações & Lançamentos</p>
              <h2 className="font-editorial text-3xl sm:text-4xl font-semibold text-balance">
                Empreendimentos
              </h2>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('/empreendimentos')}
              className="inline-flex items-center gap-2 text-sm font-medium text-[var(--site-text)] hover:text-[var(--site-accent)] transition-colors"
            >
              Explorar empreendimentos
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>

          {developments.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {developments.slice(0, 2).map((dev) => (
                <article
                  key={dev.id}
                  onClick={() => onNavigate(`/empreendimento/${dev.slug}`)}
                  className="group cursor-pointer border border-[var(--site-border)] rounded-[var(--site-radius)] overflow-hidden bg-[var(--site-bg)] grid grid-cols-1 sm:grid-cols-12 items-stretch"
                >
                  <div className="sm:col-span-5 relative min-h-[220px] overflow-hidden">
                    <img
                      src={dev.coverImage || '/src/assets/images/editorial_development_1795532253234.jpg'}
                      alt={dev.name}
                      loading="lazy"
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                    />
                  </div>
                  <div className="sm:col-span-7 p-6 flex flex-col justify-between gap-4">
                    <div className="space-y-2">
                      <p className="text-xs text-[var(--site-text-muted)]">
                        {dev.neighborhood} · {dev.city}
                        {dev.deliveryDate ? ` · Entrega ${dev.deliveryDate}` : ''}
                      </p>
                      <h3 className="font-editorial text-2xl font-semibold">{dev.name}</h3>
                      <p className="text-sm text-[var(--site-text-muted)] line-clamp-3">
                        {dev.description}
                      </p>
                    </div>
                    <div className="flex items-center justify-between pt-3 border-t border-[var(--site-border)]">
                      <span className="font-mono text-sm tabular-nums font-medium">
                        {dev.priceFrom > 0 ? `A partir de ${formatCurrencyBRL(dev.priceFrom)}` : 'Sob consulta'}
                      </span>
                      <span className="text-xs font-medium inline-flex items-center gap-1 group-hover:text-[var(--site-accent)]">
                        Ver projeto <ArrowRight className="w-3.5 h-3.5" />
                      </span>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch border border-[var(--site-border)] rounded-[var(--site-radius)] overflow-hidden bg-[var(--site-bg)]">
              <div className="lg:col-span-6 relative min-h-[300px]">
                <img
                  src="/src/assets/images/editorial_development_1795532253234.jpg"
                  alt="Empreendimentos residenciais no Rio de Janeiro"
                  loading="lazy"
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="lg:col-span-6 p-8 sm:p-12 flex flex-col justify-center space-y-5">
                <p className="text-xs font-medium text-[var(--site-accent)]">Acesso Antecipado</p>
                <h3 className="font-editorial text-3xl font-semibold text-balance">
                  Lançamentos residenciais e comerciais com tabela direta de incorporadora
                </h3>
                <p className="text-sm text-[var(--site-text-muted)] leading-relaxed">
                  Receba plantas, memorial descritivo e condições exclusivas de lançamento nas regiões mais valorizadas do Rio de Janeiro.
                </p>
                <div>
                  <a
                    href="#contato"
                    className="inline-flex items-center gap-2 px-5 py-2.5 text-xs font-medium bg-[var(--site-text)] text-[var(--site-surface)] rounded-[var(--site-radius)]"
                  >
                    Solicitar portfólio de lançamentos
                    <ArrowRight className="w-4 h-4" />
                  </a>
                </div>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* 5. About Broker Section (Editorial Portrait & Advisory Narrative) */}
      <section className="about-section reveal-section max-w-7xl mx-auto px-6 py-24">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
          <div className="lg:col-span-5 flex justify-center">
            <div className="about-parallax w-full max-w-[440px] rounded-t-full rounded-b-[2rem] overflow-hidden shadow-[0_24px_60px_-20px_rgba(20,20,19,0.22)]">
              <img
                src={tenant.aboutPhotoUrl || '/src/assets/images/ivy_oliveira_corretora.png'}
                alt={tenant.brokerName}
                loading="lazy"
                referrerPolicy="no-referrer"
                className="w-full h-auto block object-contain"
              />
            </div>
          </div>

          <div className="lg:col-span-7 flex flex-col justify-center space-y-6">
            <div className="space-y-2">
              <p className="text-xs font-medium text-[var(--site-accent)]">
                {tenant.brokerName}
                {tenant.creci ? ` · ${tenant.creci}` : ''}
                {tenant.aboutExperienceYears ? ` · ${tenant.aboutExperienceYears}` : ''}
              </p>
              <h2 className="font-editorial text-3xl sm:text-4xl font-semibold text-balance">
                {tenant.aboutHeadline}
              </h2>
            </div>

            <p className="text-base text-[var(--site-text-muted)] leading-relaxed">
              {tenant.aboutBio}
            </p>

            {tenant.specialties?.length > 0 && (
              <div className="pt-4 border-t border-[var(--site-border)] grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                {tenant.specialties.map((spec, idx) => (
                  <div key={idx} className="flex items-center gap-2 text-[var(--site-text)]">
                    <Compass className="w-4 h-4 text-[var(--site-accent)] shrink-0" />
                    <span>{spec}</span>
                  </div>
                ))}
              </div>
            )}

            <div className="pt-2">
              <button
                type="button"
                onClick={() => onNavigate('/sobre')}
                className="inline-flex items-center gap-2 text-sm font-medium underline underline-offset-4 hover:text-[var(--site-accent)]"
              >
                Conhecer trajetória e atuação
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* 6. Differentials & Regions */}
      <section className="reveal-section border-y border-[var(--site-border)] bg-[var(--site-surface)]">
        <div className="max-w-7xl mx-auto px-6 py-20 grid grid-cols-1 lg:grid-cols-12 gap-12">
          <div className="lg:col-span-4 space-y-4">
            <p className="text-xs font-medium text-[var(--site-accent)]">Atuação & Padrão</p>
            <h2 className="font-editorial text-3xl sm:text-4xl font-semibold text-balance">
              Diferenciais da nossa assessoria
            </h2>
            <div className="pt-4 space-y-2">
              <p className="text-xs font-semibold text-[var(--site-text-muted)] flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-[var(--site-accent)]" />
                Regiões atendidas em {tenant.city}
              </p>
              <p className="text-sm text-[var(--site-text-muted)] leading-relaxed">
                {tenant.regions.join(' · ')}
              </p>
            </div>
          </div>

          <div className="lg:col-span-8 grid grid-cols-1 sm:grid-cols-2 gap-8">
            {(tenant.differentials || []).map((diff, idx) => (
              <div key={idx} className="pt-5 border-t border-[var(--site-border)] space-y-2">
                <h3 className="text-base font-semibold text-[var(--site-text)]">
                  0{idx + 1}. {diff.title}
                </h3>
                <p className="text-sm text-[var(--site-text-muted)] leading-relaxed">
                  {diff.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 7. Verified Real Client Testimonials (Rendered only when published in Firestore) */}
      {testimonials.length > 0 && (
        <section className="reveal-section max-w-7xl mx-auto px-6 py-20 space-y-10">
          <div className="space-y-2">
            <p className="text-xs font-medium text-[var(--site-accent)]">Experiências Reais</p>
            <h2 className="font-editorial text-3xl sm:text-4xl font-semibold">
              Depoimentos de Clientes
            </h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {testimonials.map((t) => (
              <blockquote
                key={t.id}
                className="p-6 bg-[var(--site-surface)] border border-[var(--site-border)] rounded-[var(--site-radius)] flex flex-col justify-between gap-6"
              >
                <p className="text-sm text-[var(--site-text)] leading-relaxed italic">
                  “{t.quote}”
                </p>
                <footer className="pt-4 border-t border-[var(--site-border)] text-xs">
                  <p className="font-semibold text-[var(--site-text)]">{t.clientName}</p>
                  {(t.clientRole || t.propertyReference) && (
                    <p className="text-[var(--site-text-muted)]">
                      {[t.clientRole, t.propertyReference].filter(Boolean).join(' · ')}
                    </p>
                  )}
                </footer>
              </blockquote>
            ))}
          </div>
        </section>
      )}

      {/* 8. Lead Capture & Concierge Call-to-Action */}
      <section id="contato" className="reveal-section max-w-7xl mx-auto px-6 py-20">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-start">
          <div className="lg:col-span-5 space-y-5">
            <p className="text-xs font-medium text-[var(--site-accent)]">Atendimento Direto</p>
            <h2 className="font-editorial text-3xl sm:text-4xl font-semibold text-balance">
              Converse diretamente com {tenant.brokerName}
            </h2>
            <p className="text-sm text-[var(--site-text-muted)] leading-relaxed">
              Seja para adquirir, investir, alugar ou avaliar seu imóvel no Rio de Janeiro, nossa consultoria oferece estudo personalizado e sigilo absoluto.
            </p>
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
                    targetId: 'home_contact',
                    path: '/',
                    source: 'home_contact',
                    utmSource: '',
                    utmCampaign: '',
                  });
                }}
                className="inline-flex items-center gap-2.5 px-5 py-3 text-xs font-medium border border-[var(--site-border)] bg-[var(--site-surface)] rounded-[var(--site-radius)] hover:border-[var(--site-accent)]"
              >
                <MessageCircle className="w-4 h-4 text-[var(--site-accent)]" />
                Iniciar conversa no WhatsApp
              </a>
            )}
          </div>

          <div className="lg:col-span-7">
            <LeadCaptureForm source="home_page" />
          </div>
        </div>
      </section>
    </div>
  );
}
