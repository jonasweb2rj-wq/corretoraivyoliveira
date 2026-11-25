import { trackPublicEvent } from '../../firebase/firestoreService';
import { Tenant } from '../../types/realestate';
import { buildWhatsAppUrl, isSafeHttpOrRelativeUrl } from '../../utils/formatters';

interface FloatingSocialButtonsProps {
  tenant: Tenant;
  currentPath: string;
  onNavigate: (to: string) => void;
}

export function normalizeInstagramUrl(tenant: Tenant): string {
  if (tenant.instagramUrl && isSafeHttpOrRelativeUrl(tenant.instagramUrl)) {
    return tenant.instagramUrl;
  }
  const handle = (tenant.instagramHandle || 'ivyoliveiraimoveisrj').replace(/^@+/, '').trim();
  return `https://www.instagram.com/${encodeURIComponent(handle || 'ivyoliveiraimoveisrj')}`;
}

export function InstagramOfficialIcon({ className = 'w-6 h-6' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <rect
        x="2.25"
        y="2.25"
        width="19.5"
        height="19.5"
        rx="5.5"
        stroke="currentColor"
        strokeWidth="2"
      />
      <circle cx="12" cy="12" r="4.25" stroke="currentColor" strokeWidth="2" />
      <circle cx="17.5" cy="6.5" r="1.25" fill="currentColor" />
    </svg>
  );
}

export function WhatsAppOfficialIcon({ className = 'w-6 h-6' }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" fill="currentColor" className={className} aria-hidden="true">
      <path d="M16.002 2.667c-7.35 0-13.334 5.983-13.334 13.333 0 2.352.616 4.647 1.787 6.671L2.667 29.333l6.842-1.793a13.28 13.28 0 0 0 6.493 1.693h.005c7.349 0 13.326-5.984 13.326-13.333 0-3.562-1.387-6.911-3.905-9.429a13.25 13.25 0 0 0-9.426-3.804Zm0 24.31h-.004a11.03 11.03 0 0 1-5.622-1.538l-.403-.24-4.181 1.096 1.116-4.076-.263-.418a11.016 11.016 0 0 1-1.691-5.801c0-6.093 4.957-11.051 11.053-11.051 2.952 0 5.726 1.151 7.813 3.241a10.976 10.976 0 0 1 3.235 7.812c0 6.094-4.959 11.075-11.053 11.075Zm6.063-8.282c-.332-.166-1.966-.971-2.271-1.081-.304-.111-.526-.166-.747.166-.222.332-.858 1.081-1.052 1.303-.194.221-.388.249-.72.083-.332-.166-1.403-.517-2.672-1.65-.988-.881-1.655-1.97-1.849-2.302-.194-.332-.02-.512.146-.677.149-.149.332-.388.498-.581.166-.194.221-.332.332-.554.111-.221.055-.415-.028-.581-.083-.166-.747-1.801-1.024-2.466-.27-.648-.544-.56-.747-.571-.193-.01-.415-.012-.637-.012s-.581.083-.886.415c-.304.332-1.163 1.137-1.163 2.771s1.191 3.214 1.357 3.436c.166.221 2.343 3.577 5.676 5.016.793.342 1.412.546 1.894.699.796.253 1.52.217 2.093.132.639-.095 1.966-.804 2.243-1.58.277-.776.277-1.441.194-1.58-.083-.138-.305-.221-.637-.387Z" />
    </svg>
  );
}

export function FloatingSocialButtons({
  tenant,
  currentPath,
  onNavigate,
}: FloatingSocialButtonsProps) {
  const instagramUrl = normalizeInstagramUrl(tenant);
  const whatsappUrl = buildWhatsAppUrl(
    tenant.whatsapp,
    `Olá! Vim pelo site da ${tenant.brandName} e gostaria de mais informações.`
  );

  const handleInstagramClick = () => {
    trackPublicEvent({
      tenantId: tenant.id,
      ownerUid: tenant.ownerUid,
      eventType: 'share',
      targetId: 'floating_instagram',
      path: currentPath,
      source: 'floating_right',
      utmSource: '',
      utmCampaign: '',
    });
  };

  const handleWhatsAppClick = () => {
    trackPublicEvent({
      tenantId: tenant.id,
      ownerUid: tenant.ownerUid,
      eventType: 'whatsapp_click',
      targetId: 'floating_whatsapp',
      path: currentPath,
      source: 'floating_right',
      utmSource: '',
      utmCampaign: '',
    });
    if (!whatsappUrl) {
      const contactEl = document.getElementById('contato');
      if (contactEl) {
        contactEl.scrollIntoView({ behavior: 'smooth' });
      } else {
        onNavigate('/#contato');
      }
    }
  };

  return (
    <div
      className="fixed bottom-5 right-4 sm:bottom-6 sm:right-6 z-40 flex flex-col items-end gap-3"
      aria-label="Canais oficiais de contato"
    >
      <a
        href={instagramUrl}
        target="_blank"
        rel="noopener noreferrer"
        onClick={handleInstagramClick}
        aria-label="Abrir Instagram oficial"
        className="group relative flex items-center justify-center w-12 h-12 sm:w-13 sm:h-13 rounded-full text-white shadow-lg transition-transform duration-200 hover:scale-105 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--site-accent)]"
        style={{
          background:
            'linear-gradient(45deg, #f09433 0%, #e6683c 25%, #dc2743 50%, #cc2366 75%, #bc1888 100%)',
        }}
      >
        <InstagramOfficialIcon className="w-6 h-6" />
        <span className="pointer-events-none hidden sm:block absolute right-15 whitespace-nowrap px-2.5 py-1 text-xs font-medium bg-[var(--site-text)] text-[var(--site-surface)] rounded-md shadow-md opacity-0 translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-150">
          Instagram
        </span>
      </a>

      {whatsappUrl ? (
        <a
          href={whatsappUrl}
          target="_blank"
          rel="noopener noreferrer"
          onClick={handleWhatsAppClick}
          aria-label="Conversar no WhatsApp oficial"
          className="group relative flex items-center justify-center w-12 h-12 sm:w-13 sm:h-13 rounded-full text-white shadow-lg transition-transform duration-200 hover:scale-105 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#25D366]"
          style={{ backgroundColor: '#25D366' }}
        >
          <WhatsAppOfficialIcon className="w-6 h-6" />
          <span className="pointer-events-none hidden sm:block absolute right-15 whitespace-nowrap px-2.5 py-1 text-xs font-medium bg-[var(--site-text)] text-[var(--site-surface)] rounded-md shadow-md opacity-0 translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-150">
            WhatsApp
          </span>
        </a>
      ) : (
        <button
          type="button"
          onClick={handleWhatsAppClick}
          aria-label="Solicitar atendimento por WhatsApp"
          className="group relative flex items-center justify-center w-12 h-12 sm:w-13 sm:h-13 rounded-full text-white shadow-lg transition-transform duration-200 hover:scale-105 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#25D366]"
          style={{ backgroundColor: '#25D366' }}
        >
          <WhatsAppOfficialIcon className="w-6 h-6" />
          <span className="pointer-events-none hidden sm:block absolute right-15 whitespace-nowrap px-2.5 py-1 text-xs font-medium bg-[var(--site-text)] text-[var(--site-surface)] rounded-md shadow-md opacity-0 translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-150">
            WhatsApp
          </span>
        </button>
      )}
    </div>
  );
}
