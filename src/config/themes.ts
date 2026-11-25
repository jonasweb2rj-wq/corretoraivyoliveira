import { ThemeConfig, ThemePresetId } from '../types/realestate';

export interface ThemePresetDefinition {
  id: ThemePresetId;
  name: string;
  description: string;
  config: ThemeConfig;
}

export const THEME_PRESETS: Record<ThemePresetId, ThemePresetDefinition> = {
  'luxo-contemporaneo': {
    id: 'luxo-contemporaneo',
    name: 'Luxo Contemporâneo',
    description: 'Marfim mineral, grafite profundo e bronze arquitetônico.',
    config: {
      primaryColor: '#141413',
      secondaryColor: '#F1EFEA',
      accentColor: '#9A744B',
      backgroundColor: '#F9F8F6',
      surfaceColor: '#FFFFFF',
      textColor: '#141413',
      mutedTextColor: '#5C5954',
      headingFont: '"Cormorant Garamond", Georgia, serif',
      bodyFont: '"Plus Jakarta Sans", sans-serif',
      buttonStyle: 'rounded',
      cardStyle: 'bordered',
    },
  },
  'minimalista-premium': {
    id: 'minimalista-premium',
    name: 'Minimalista Premium',
    description: 'Branco puro, carvão limpo e traços precisos.',
    config: {
      primaryColor: '#111827',
      secondaryColor: '#F3F4F6',
      accentColor: '#334155',
      backgroundColor: '#FFFFFF',
      surfaceColor: '#F9FAFB',
      textColor: '#111827',
      mutedTextColor: '#6B7280',
      headingFont: '"Plus Jakarta Sans", sans-serif',
      bodyFont: '"Plus Jakarta Sans", sans-serif',
      buttonStyle: 'sharp',
      cardStyle: 'minimal',
    },
  },
  'imobiliario-moderno': {
    id: 'imobiliario-moderno',
    name: 'Imobiliário Moderno',
    description: 'Azul marinho estrutural, areia fria e cobalto focal.',
    config: {
      primaryColor: '#0F172A',
      secondaryColor: '#F1F5F9',
      accentColor: '#1E40AF',
      backgroundColor: '#F8FAFC',
      surfaceColor: '#FFFFFF',
      textColor: '#0F172A',
      mutedTextColor: '#475569',
      headingFont: '"Cormorant Garamond", Georgia, serif',
      bodyFont: '"Plus Jakarta Sans", sans-serif',
      buttonStyle: 'soft',
      cardStyle: 'elevated',
    },
  },
  'elegancia-classica': {
    id: 'elegancia-classica',
    name: 'Elegância Clássica',
    description: 'Linho suave, espresso e oliva sob medida.',
    config: {
      primaryColor: '#1C1917',
      secondaryColor: '#EFECE6',
      accentColor: '#4D5D43',
      backgroundColor: '#FAF7F2',
      surfaceColor: '#FFFFFF',
      textColor: '#1C1917',
      mutedTextColor: '#57534E',
      headingFont: '"Cormorant Garamond", Georgia, serif',
      bodyFont: '"Plus Jakarta Sans", sans-serif',
      buttonStyle: 'rounded',
      cardStyle: 'bordered',
    },
  },
  'arquitetura-editorial': {
    id: 'arquitetura-editorial',
    name: 'Arquitetura Editorial',
    description: 'Cinza galeria, preto absoluto e terracota mineral.',
    config: {
      primaryColor: '#0A0A0A',
      secondaryColor: '#EAEAE6',
      accentColor: '#8C4A32',
      backgroundColor: '#F4F4F2',
      surfaceColor: '#FFFFFF',
      textColor: '#0A0A0A',
      mutedTextColor: '#525252',
      headingFont: '"Cormorant Garamond", Georgia, serif',
      bodyFont: '"Plus Jakarta Sans", sans-serif',
      buttonStyle: 'sharp',
      cardStyle: 'bordered',
    },
  },
};

export function applyThemeToDocument(theme: ThemeConfig): void {
  const root = document.documentElement;
  root.style.setProperty('--site-bg', theme.backgroundColor);
  root.style.setProperty('--site-surface', theme.surfaceColor);
  root.style.setProperty('--site-surface-alt', theme.secondaryColor);
  root.style.setProperty('--site-text', theme.textColor);
  root.style.setProperty('--site-text-muted', theme.mutedTextColor);
  root.style.setProperty('--site-accent', theme.accentColor);
  root.style.setProperty('--site-font-display', theme.headingFont);
  root.style.setProperty('--site-font-body', theme.bodyFont);
  const radius = theme.buttonStyle === 'sharp' ? '0.125rem' : theme.buttonStyle === 'soft' ? '0.75rem' : '0.375rem';
  root.style.setProperty('--site-radius', radius);
}
