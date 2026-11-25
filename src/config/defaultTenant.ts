import { Tenant } from '../types/realestate';
import { THEME_PRESETS } from './themes';

export const DEFAULT_TENANT_ID = 'ivy-oliveira';

// Only verified public baseline details; unverified contact/CRECI fields remain empty for admin entry
export const DEFAULT_TENANT: Tenant = {
  id: DEFAULT_TENANT_ID,
  ownerUid: '',
  slug: 'ivy-oliveira-imoveis',
  brandName: 'Ivy Oliveira Imóveis',
  brokerName: 'Ivy Oliveira',
  creci: '',
  city: 'Rio de Janeiro',
  state: 'RJ',
  regions: ['Zona Sul', 'Barra da Tijuca', 'São Conrado', 'Lagoa', 'Leblon', 'Ipanema'],
  whatsapp: '',
  phone: '',
  email: '',
  instagramHandle: '@ivyoliveiraimoveisrj',
  instagramUrl: 'https://www.instagram.com/ivyoliveiraimoveisrj',
  logoUrl: '/logo-ivy-oliveira.png',
  faviconUrl: '/logo-ivy-oliveira.png',
  heroTitle: 'Arquitetura residencial selecionada no Rio de Janeiro',
  heroSubtitle: 'Consultoria imobiliária sob medida com atendimento direto, análise patrimonial e visitas imersivas.',
  heroCtaText: 'Explorar Acervo',
  heroImages: [
    '/src/assets/images/hero_rio_architecture_1795532252718.jpg',
    '/src/assets/images/hero_penthouse_living_1795532252931.jpg',
  ],
  aboutHeadline: 'Assessoria imobiliária independente no Rio de Janeiro',
  aboutBio:
    'Atuação dedicada à compra, venda e avaliação de imóveis residenciais e empreendimentos selecionados no Rio de Janeiro. Cada negociação é conduzida com transparência documental, análise técnica de mercado e acompanhamento integral até a escritura.',
  aboutPhotoUrl: '/src/assets/images/ivy_oliveira_corretora.png',
  aboutExperienceYears: 'Desde 2017',
  specialties: [
    'Imóveis Residenciais de Alto Padrão',
    'Lançamentos & Incorporações',
    'Avaliação Patrimonial',
    'Assessoria Jurídica e Documental',
  ],
  differentials: [
    {
      title: 'Seleção Arquitetônica',
      description: 'Seleção criteriosa de plantas, insolação, vista e potencial de valorização no Rio de Janeiro.',
    },
    {
      title: 'Atendimento Direto',
      description: 'Condução pessoal em todas as etapas, da visita presencial ou virtual à assinatura em cartório.',
    },
    {
      title: 'Apresentação Digital Imersiva',
      description: 'Fotografia organizada por ambiente, passeios panorâmicos 360° e dossiês completos para decisão segura.',
    },
    {
      title: 'Segurança Documental e LGPD',
      description: 'Verificação rigorosa de certidões, ônus reais e sigilo integral dos dados de compradores e proprietários.',
    },
  ],
  themePreset: 'luxo-contemporaneo',
  themeConfig: THEME_PRESETS['luxo-contemporaneo'].config,
  seoTitle: 'Ivy Oliveira Imóveis — Consultoria Imobiliária no Rio de Janeiro',
  seoDescription:
    'Imóveis selecionados, lançamentos e assessoria personalizada no Rio de Janeiro. Visita virtual 360° e atendimento consultivo.',
  ga4Id: '',
  gtmId: '',
  gscVerification: '',
  googleAdsId: '',
  lgpdPrivacyText:
    'Em conformidade com a Lei Geral de Proteção de Dados (Lei nº 13.709/2018), os dados informados neste site são utilizados exclusivamente para atendimento imobiliário solicitado pelo titular. Você pode solicitar consulta, correção ou exclusão dos seus dados a qualquer momento pelos canais oficiais deste site.',
  customDomain: '',
  status: 'active',
};
