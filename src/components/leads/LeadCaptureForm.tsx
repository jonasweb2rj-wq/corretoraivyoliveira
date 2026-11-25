import React, { useState } from 'react';
import { CheckCircle2, Send } from 'lucide-react';
import { useAppContext } from '../../hooks/useAuthTenant';
import { submitPublicLead, trackPublicEvent } from '../../firebase/firestoreService';
import { LeadInterest } from '../../types/realestate';

interface LeadCaptureFormProps {
  defaultInterest?: LeadInterest;
  propertyId?: string;
  propertyTitle?: string;
  developmentId?: string;
  landingPageId?: string;
  source?: string;
  title?: string;
  subtitle?: string;
  ctaLabel?: string;
}

export function LeadCaptureForm({
  defaultInterest = 'informacoes',
  propertyId = '',
  propertyTitle = '',
  developmentId = '',
  landingPageId = '',
  source = 'site_form',
  title = 'Solicitar atendimento personalizado',
  subtitle = 'Preencha seus dados para receber o dossiê completo ou agendar uma visita reservada.',
  ctaLabel = 'Enviar solicitação',
}: LeadCaptureFormProps) {
  const { tenant } = useAppContext();
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [interest, setInterest] = useState<LeadInterest>(defaultInterest);
  const [message, setMessage] = useState('');
  const [lgpdConsent, setLgpdConsent] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!name.trim() || !phone.trim()) {
      setError('Por favor, informe seu nome e telefone/WhatsApp.');
      return;
    }
    if (!lgpdConsent) {
      setError('É necessário concordar com a política de privacidade (LGPD) para enviar.');
      return;
    }

    setSubmitting(true);
    try {
      const urlParams = new URLSearchParams(window.location.search);
      const utmSource = urlParams.get('utm_source') || '';
      const utmMedium = urlParams.get('utm_medium') || '';
      const utmCampaign = urlParams.get('utm_campaign') || '';

      await submitPublicLead({
        tenantId: tenant.id,
        ownerUid: tenant.ownerUid,
        name: name.trim(),
        phone: phone.trim(),
        email: email.trim(),
        interest,
        propertyId,
        propertyTitle,
        developmentId,
        landingPageId,
        source,
        utmSource,
        utmMedium,
        utmCampaign,
        message: message.trim(),
        lgpdConsent: true,
      });

      await trackPublicEvent({
        tenantId: tenant.id,
        ownerUid: tenant.ownerUid,
        eventType: 'lead_submit',
        targetId: propertyId || developmentId || landingPageId || 'general',
        path: window.location.pathname,
        source,
        utmSource,
        utmCampaign,
      });

      setSubmitted(true);
      setName('');
      setPhone('');
      setEmail('');
      setMessage('');
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Não foi possível enviar sua solicitação no momento.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <div className="p-8 bg-[var(--site-surface)] border border-[var(--site-border)] rounded-[var(--site-radius)] space-y-4">
        <div className="flex items-center gap-3 text-[var(--site-accent)]">
          <CheckCircle2 className="w-6 h-6" />
          <h3 className="font-editorial text-2xl font-semibold text-[var(--site-text)]">
            Solicitação recebida
          </h3>
        </div>
        <p className="text-sm text-[var(--site-text-muted)] leading-relaxed">
          Seus dados foram registrados com segurança. {tenant.brokerName} entrará em contato pelos canais informados.
        </p>
        <button
          type="button"
          onClick={() => setSubmitted(false)}
          className="text-xs font-medium underline underline-offset-4 text-[var(--site-text)]"
        >
          Enviar outra mensagem
        </button>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="p-6 sm:p-8 bg-[var(--site-surface)] border border-[var(--site-border)] rounded-[var(--site-radius)] space-y-5"
    >
      <div className="space-y-1.5">
        <h3 className="font-editorial text-2xl font-semibold text-[var(--site-text)]">{title}</h3>
        <p className="text-sm text-[var(--site-text-muted)]">{subtitle}</p>
      </div>

      {error && (
        <div className="p-3 text-xs bg-red-50 border border-red-200 text-red-800 rounded-[var(--site-radius)]">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <label className="block space-y-1.5 text-xs font-medium text-[var(--site-text-muted)]">
          <span>Nome completo *</span>
          <input
            type="text"
            required
            maxLength={120}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Seu nome"
            className="w-full px-3.5 py-2.5 text-sm bg-[var(--site-bg)] text-[var(--site-text)] border border-[var(--site-border)] rounded-[var(--site-radius)] focus:outline-none focus:border-[var(--site-accent)]"
          />
        </label>

        <label className="block space-y-1.5 text-xs font-medium text-[var(--site-text-muted)]">
          <span>Telefone / WhatsApp *</span>
          <input
            type="tel"
            required
            maxLength={40}
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="(21) 99999-9999"
            className="w-full px-3.5 py-2.5 text-sm bg-[var(--site-bg)] text-[var(--site-text)] border border-[var(--site-border)] rounded-[var(--site-radius)] focus:outline-none focus:border-[var(--site-accent)]"
          />
        </label>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <label className="block space-y-1.5 text-xs font-medium text-[var(--site-text-muted)]">
          <span>E-mail</span>
          <input
            type="email"
            maxLength={200}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="voce@exemplo.com"
            className="w-full px-3.5 py-2.5 text-sm bg-[var(--site-bg)] text-[var(--site-text)] border border-[var(--site-border)] rounded-[var(--site-radius)] focus:outline-none focus:border-[var(--site-accent)]"
          />
        </label>

        <label className="block space-y-1.5 text-xs font-medium text-[var(--site-text-muted)]">
          <span>Interesse</span>
          <select
            value={interest}
            onChange={(e) => setInterest(e.target.value as LeadInterest)}
            className="w-full px-3.5 py-2.5 text-sm bg-[var(--site-bg)] text-[var(--site-text)] border border-[var(--site-border)] rounded-[var(--site-radius)] focus:outline-none focus:border-[var(--site-accent)]"
          >
            <option value="comprar">Comprar imóvel</option>
            <option value="alugar">Alugar imóvel</option>
            <option value="visita">Agendar visita</option>
            <option value="empreendimento">Conhecer empreendimento</option>
            <option value="vender">Vender / Avaliar meu imóvel</option>
            <option value="investir">Investimento imobiliário</option>
            <option value="informacoes">Solicitar informações</option>
          </select>
        </label>
      </div>

      <label className="block space-y-1.5 text-xs font-medium text-[var(--site-text-muted)]">
        <span>Mensagem</span>
        <textarea
          rows={3}
          maxLength={2000}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Conte o que procura (região, perfil do imóvel ou melhor horário para contato)..."
          className="w-full px-3.5 py-2.5 text-sm bg-[var(--site-bg)] text-[var(--site-text)] border border-[var(--site-border)] rounded-[var(--site-radius)] focus:outline-none focus:border-[var(--site-accent)]"
        />
      </label>

      <label className="flex items-start gap-3 text-xs text-[var(--site-text-muted)] cursor-pointer">
        <input
          type="checkbox"
          checked={lgpdConsent}
          onChange={(e) => setLgpdConsent(e.target.checked)}
          className="mt-0.5 h-4 w-4 accent-[var(--site-accent)]"
        />
        <span>
          Concordo com o tratamento dos meus dados para retorno deste atendimento imobiliário, conforme a Política de Privacidade (LGPD).
        </span>
      </label>

      <button
        type="submit"
        disabled={submitting}
        className="w-full inline-flex items-center justify-center gap-2 px-6 py-3 text-sm font-medium bg-[var(--site-text)] text-[var(--site-surface)] rounded-[var(--site-radius)] hover:opacity-90 disabled:opacity-50 transition-opacity"
      >
        <Send className="w-4 h-4" />
        {submitting ? 'Enviando...' : ctaLabel}
      </button>
    </form>
  );
}
