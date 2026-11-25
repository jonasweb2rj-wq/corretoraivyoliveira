import React, { useEffect, useState } from 'react';
import { Menu, X } from 'lucide-react';
import { useAppContext } from '../../hooks/useAuthTenant';
import { buildWhatsAppUrl } from '../../utils/formatters';
import { trackPublicEvent } from '../../firebase/firestoreService';
import { FloatingSocialButtons } from './FloatingSocialButtons';
import { VirtualAssistantWidget } from './VirtualAssistantWidget';

interface SiteLayoutProps {
  currentPath: string;
  onNavigate: (to: string) => void;
  children: React.ReactNode;
}

export function SiteLayout({ currentPath, onNavigate, children }: SiteLayoutProps) {
  const { tenant } = useAppContext();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [logoError, setLogoError] = useState(false);
  useEffect(() => {
    setLogoError(false);
  }, [tenant.logoUrl]);
  const [lgpdAccepted, setLgpdAccepted] = useState(() => {
    try {
      return localStorage.getItem('lgpd_notice_ack') === '1';
    } catch {
      return false;
    }
  });

  const whatsappUrl = buildWhatsAppUrl(
    tenant.whatsapp,
    `Olá! Gostaria de receber informações sobre os imóveis selecionados em ${tenant.brandName}.`
  );

  const handlePrimaryCta = () => {
    if (whatsappUrl) {
      trackPublicEvent({
        tenantId: tenant.id,
        ownerUid: tenant.ownerUid,
        eventType: 'whatsapp_click',
        targetId: 'header_cta',
        path: currentPath,
        source: 'header',
        utmSource: '',
        utmCampaign: '',
      });
      window.open(whatsappUrl, '_blank', 'noopener,noreferrer');
    } else {
      const contactEl = document.getElementById('contato');
      if (contactEl) {
        contactEl.scrollIntoView({ behavior: 'smooth' });
      } else {
        onNavigate('/#contato');
      }
    }
  };

  const navItems = [
    { label: 'Início', path: '/' },
    { label: 'Imóveis', path: '/imoveis' },
    { label: 'Empreendimentos', path: '/empreendimentos' },
    { label: 'Sobre', path: '/sobre' },
  ];

  return (
    <div className="min-h-screen flex flex-col bg-[var(--site-bg)] text-[var(--site-text)]">
      {/* Strict 3-Zone Top Bar Contract */}
      <header className="sticky top-0 z-40 border-b border-[var(--site-border)] bg-[var(--site-bg)]/92 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between gap-8">
          {/* Zone 1: Transparent Brand Lockup / Wordmark */}
          <a
            href="/"
            onClick={(e) => {
              e.preventDefault();
              onNavigate('/');
            }}
            className="flex items-center whitespace-nowrap shrink-0 bg-transparent focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--site-accent)]"
          >
            {tenant.logoUrl && !logoError ? (
              <>
                <img
                  src={tenant.logoUrl}
                  alt={tenant.brandName}
                  referrerPolicy="no-referrer"
                  onError={() => setLogoError(true)}
                  className="h-14 sm:h-[68px] w-auto max-w-[180px] object-contain bg-transparent select-none py-0.5"
                />
                <span className="sr-only">{tenant.brandName}</span>
              </>
            ) : (
              <span className="font-editorial text-2xl font-semibold tracking-tight text-[var(--site-text)] whitespace-nowrap">
                {tenant.brandName}
              </span>
            )}
          </a>

          {/* Zone 2: 4 Clean Single-Line Text Navigation Links */}
          <nav className="hidden md:flex items-center gap-8 text-sm font-medium text-[var(--site-text-muted)]">
            {navItems.map((item) => {
              const active = currentPath === item.path;
              return (
                <a
                  key={item.path}
                  href={item.path}
                  onClick={(e) => {
                    e.preventDefault();
                    onNavigate(item.path);
                  }}
                  className={`whitespace-nowrap shrink-0 py-1 border-b transition-colors duration-200 ${
                    active
                      ? 'text-[var(--site-text)] border-[var(--site-accent)]'
                      : 'border-transparent hover:text-[var(--site-text)] hover:border-[var(--site-border)]'
                  }`}
                >
                  {item.label}
                </a>
              );
            })}
          </nav>

          {/* Zone 3: 1 Primary CTA Action */}
          <div className="flex items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={handlePrimaryCta}
              className="hidden sm:inline-flex items-center justify-center px-5 py-2.5 text-xs font-medium tracking-wide bg-[var(--site-text)] text-[var(--site-surface)] rounded-[var(--site-radius)] hover:opacity-90 transition-opacity whitespace-nowrap shrink-0"
            >
              Atendimento
            </button>
            <button
              type="button"
              aria-label="Abrir menu"
              onClick={() => setMobileOpen((prev) => !prev)}
              className="md:hidden p-2.5 text-[var(--site-text)] border border-[var(--site-border)] rounded-[var(--site-radius)]"
            >
              {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Mobile Drawer */}
        {mobileOpen && (
          <div className="md:hidden border-t border-[var(--site-border)] bg-[var(--site-surface)] px-6 py-5 space-y-3">
            {navItems.map((item) => (
              <a
                key={item.path}
                href={item.path}
                onClick={(e) => {
                  e.preventDefault();
                  setMobileOpen(false);
                  onNavigate(item.path);
                }}
                className="block py-2 text-base font-medium text-[var(--site-text)]"
              >
                {item.label}
              </a>
            ))}
            <button
              type="button"
              onClick={() => {
                setMobileOpen(false);
                handlePrimaryCta();
              }}
              className="w-full py-3 text-sm font-medium bg-[var(--site-text)] text-[var(--site-surface)] rounded-[var(--site-radius)]"
            >
              Atendimento
            </button>
          </div>
        )}
      </header>

      <main className="flex-1">{children}</main>

      {/* Complete Architectural Footer */}
      <footer className="border-t border-[var(--site-border)] bg-[var(--site-surface)] text-[var(--site-text)]">
        <div className="max-w-7xl mx-auto px-6 py-16 grid grid-cols-1 md:grid-cols-12 gap-12">
          <div className="md:col-span-5 space-y-4">
            {tenant.logoUrl && !logoError ? (
              <div>
                <img
                  src={tenant.logoUrl}
                  alt={tenant.brandName}
                  referrerPolicy="no-referrer"
                  className="h-20 sm:h-24 w-auto object-contain bg-transparent select-none"
                />
                <h3 className="sr-only">{tenant.brandName}</h3>
              </div>
            ) : (
              <h3 className="font-editorial text-2xl font-semibold">{tenant.brandName}</h3>
            )}
            <p className="text-sm text-[var(--site-text-muted)] leading-relaxed max-w-md">
              {tenant.seoDescription || tenant.heroSubtitle}
            </p>
            <div className="text-xs text-[var(--site-text-muted)] space-y-1">
              <p>
                {tenant.city}
                {tenant.state ? `, ${tenant.state}` : ''}
                {tenant.creci ? ` · ${tenant.creci}` : ''}
              </p>
              {tenant.email && <p>{tenant.email}</p>}
              {tenant.phone && <p>{tenant.phone}</p>}
            </div>
          </div>

          <div className="md:col-span-3 space-y-3">
            <p className="text-xs font-semibold tracking-wider text-[var(--site-text-muted)]">
              Navegação
            </p>
            <ul className="space-y-2.5 text-sm">
              {navItems.map((item) => (
                <li key={item.path}>
                  <a
                    href={item.path}
                    onClick={(e) => {
                      e.preventDefault();
                      onNavigate(item.path);
                    }}
                    className="text-[var(--site-text-muted)] hover:text-[var(--site-text)] transition-colors"
                  >
                    {item.label}
                  </a>
                </li>
              ))}
              <li>
                <a
                  href="/privacidade"
                  onClick={(e) => {
                    e.preventDefault();
                    onNavigate('/privacidade');
                  }}
                  className="text-[var(--site-text-muted)] hover:text-[var(--site-text)] transition-colors"
                >
                  Privacidade & LGPD
                </a>
              </li>
            </ul>
          </div>

          <div className="md:col-span-4 space-y-3">
            <p className="text-xs font-semibold tracking-wider text-[var(--site-text-muted)]">
              Regiões & Canais
            </p>
            <p className="text-sm text-[var(--site-text-muted)] leading-relaxed">
              {tenant.regions.join(' · ')}
            </p>
            <div className="pt-2 flex flex-wrap gap-4 text-sm">
              {tenant.instagramUrl && (
                <a
                  href={tenant.instagramUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline underline-offset-4 text-[var(--site-text)] hover:text-[var(--site-accent)]"
                >
                  {tenant.instagramHandle || 'Instagram'}
                </a>
              )}
              {whatsappUrl && (
                <a
                  href={whatsappUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline underline-offset-4 text-[var(--site-text)] hover:text-[var(--site-accent)]"
                >
                  WhatsApp Comercial
                </a>
              )}
            </div>
          </div>
        </div>

        <div className="border-t border-[var(--site-border)]">
          <div className="max-w-7xl mx-auto px-6 py-5 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-[var(--site-text-muted)]">
            <p>
              © {new Date().getFullYear()} {tenant.brandName}. Todos os direitos reservados.
            </p>
            <div className="flex items-center gap-6">
              <a
                href="/privacidade"
                onClick={(e) => {
                  e.preventDefault();
                  onNavigate('/privacidade');
                }}
                className="hover:text-[var(--site-text)] transition-colors"
              >
                Política de Privacidade
              </a>
              <a
                href="/admin"
                onClick={(e) => {
                  e.preventDefault();
                  onNavigate('/admin');
                }}
                className="hover:text-[var(--site-text)] transition-colors"
              >
                Painel Admin
              </a>
            </div>
          </div>
        </div>
      </footer>

      {/* Discreet LGPD Cookie Notice (centered bottom so left/right floating widgets remain unobstructed) */}
      {!lgpdAccepted && (
        <div className="fixed bottom-20 left-4 right-4 sm:bottom-5 sm:left-1/2 sm:right-auto sm:-translate-x-1/2 z-30 sm:w-full sm:max-w-md p-3.5 bg-[var(--site-surface)] border border-[var(--site-border)] shadow-lg rounded-[var(--site-radius)] text-xs space-y-2.5">
          <p className="text-[var(--site-text-muted)] leading-relaxed">
            Utilizamos cookies essenciais e métricas anônimas para aprimorar sua experiência imobiliária, em conformidade com a LGPD.
          </p>
          <div className="flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={() => onNavigate('/privacidade')}
              className="text-[var(--site-text-muted)] underline underline-offset-2"
            >
              Saiba mais
            </button>
            <button
              type="button"
              onClick={() => {
                try {
                  localStorage.setItem('lgpd_notice_ack', '1');
                } catch {
                  // ignore storage errors
                }
                setLgpdAccepted(true);
              }}
              className="px-3.5 py-1.5 bg-[var(--site-text)] text-[var(--site-surface)] font-medium rounded-[var(--site-radius)]"
            >
              Concordar
            </button>
          </div>
        </div>
      )}

      {/* Left: Humanized Virtual Assistant */}
      <VirtualAssistantWidget
        tenant={tenant}
        currentPath={currentPath}
        onNavigate={onNavigate}
      />

      {/* Right: Official Floating Instagram & WhatsApp Buttons */}
      <FloatingSocialButtons
        tenant={tenant}
        currentPath={currentPath}
        onNavigate={onNavigate}
      />
    </div>
  );
}
