export interface SeoMetadataInput {
  title: string;
  description: string;
  image?: string;
  noIndex?: boolean;
  structuredData?: Record<string, unknown>;
}

export function applySeoMetadata(input: SeoMetadataInput): void {
  document.title = input.title;

  const setMeta = (selector: string, attrName: string, attrVal: string, content: string) => {
    let el = document.head.querySelector(selector) as HTMLMetaElement | null;
    if (!el) {
      el = document.createElement('meta');
      el.setAttribute(attrName, attrVal);
      document.head.appendChild(el);
    }
    el.setAttribute('content', content);
  };

  setMeta('meta[name="description"]', 'name', 'description', input.description);
  setMeta('meta[property="og:title"]', 'property', 'og:title', input.title);
  setMeta('meta[property="og:description"]', 'property', 'og:description', input.description);
  setMeta('meta[name="twitter:title"]', 'name', 'twitter:title', input.title);
  setMeta('meta[name="twitter:description"]', 'name', 'twitter:description', input.description);

  const canonicalHref = `${window.location.origin}${window.location.pathname}`;
  setMeta('meta[property="og:url"]', 'property', 'og:url', canonicalHref);

  let canonical = document.head.querySelector('link[rel="canonical"]') as HTMLLinkElement | null;
  if (!canonical) {
    canonical = document.createElement('link');
    canonical.rel = 'canonical';
    document.head.appendChild(canonical);
  }
  canonical.href = canonicalHref;

  if (input.image) {
    const absImage = input.image.startsWith('http') ? input.image : `${window.location.origin}${input.image}`;
    setMeta('meta[property="og:image"]', 'property', 'og:image', absImage);
  }

  setMeta(
    'meta[name="robots"]',
    'name',
    'robots',
    input.noIndex ? 'noindex, nofollow' : 'index, follow'
  );

  const existingLd = document.getElementById('dynamic-jsonld');
  if (existingLd) existingLd.remove();
  if (input.structuredData) {
    const script = document.createElement('script');
    script.id = 'dynamic-jsonld';
    script.type = 'application/ld+json';
    script.textContent = JSON.stringify(input.structuredData);
    document.head.appendChild(script);
  }
}

export function injectAnalyticsScripts(ga4Id?: string, gtmId?: string): void {
  if (ga4Id && /^G-[A-Z0-9]+$/.test(ga4Id) && !document.getElementById('ga4-script')) {
    const s = document.createElement('script');
    s.id = 'ga4-script';
    s.async = true;
    s.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(ga4Id)}`;
    document.head.appendChild(s);

    const inline = document.createElement('script');
    inline.textContent = `window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','${ga4Id}');`;
    document.head.appendChild(inline);
  }

  if (gtmId && /^GTM-[A-Z0-9]+$/.test(gtmId) && !document.getElementById('gtm-script')) {
    const s = document.createElement('script');
    s.id = 'gtm-script';
    s.textContent = `(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src='https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);})(window,document,'script','dataLayer','${gtmId}');`;
    document.head.appendChild(s);
  }
}
