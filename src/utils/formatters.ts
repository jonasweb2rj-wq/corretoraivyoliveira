export function formatCurrencyBRL(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return 'Sob consulta';
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    maximumFractionDigits: 0,
  }).format(value);
}

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 140) || 'imovel';
}

export function generateSafeId(prefix = 'doc'): string {
  const rand = typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID().replace(/-/g, '').slice(0, 12)
    : Math.random().toString(36).slice(2, 14);
  return `${prefix}_${Date.now().toString(36)}_${rand}`;
}

export function sanitizePhoneDigits(phone: string): string {
  return phone.replace(/\D/g, '');
}

export function buildWhatsAppUrl(
  whatsappNumber: string,
  message: string
): string | null {
  const digits = sanitizePhoneDigits(whatsappNumber);
  if (digits.length < 10) return null;
  const fullNumber = digits.startsWith('55') ? digits : `55${digits}`;
  return `https://wa.me/${fullNumber}?text=${encodeURIComponent(message)}`;
}

export function isSafeHttpOrRelativeUrl(url?: string): boolean {
  if (!url) return false;
  if (url.startsWith('/')) return !url.startsWith('//');
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'https:' || parsed.protocol === 'http:';
  } catch {
    return false;
  }
}

export function propertyTypeLabel(type: string): string {
  const map: Record<string, string> = {
    casa: 'Casa',
    apartamento: 'Apartamento',
    cobertura: 'Cobertura',
    terreno: 'Terreno',
    comercial: 'Comercial',
  };
  return map[type] || type;
}

export function transactionTypeLabel(tx: string): string {
  const map: Record<string, string> = {
    venda: 'Venda',
    aluguel: 'Aluguel',
    lancamento: 'Lançamento',
  };
  return map[tx] || tx;
}

export function leadStatusLabel(status: string): string {
  const map: Record<string, string> = {
    new: 'Novo',
    in_progress: 'Em atendimento',
    scheduled: 'Agendado',
    converted: 'Convertido',
    lost: 'Perdido',
  };
  return map[status] || status;
}
