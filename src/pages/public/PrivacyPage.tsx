import { useEffect } from 'react';
import { useAppContext } from '../../hooks/useAuthTenant';
import { applySeoMetadata } from '../../utils/seo';

export function PrivacyPage() {
  const { tenant } = useAppContext();

  useEffect(() => {
    applySeoMetadata({
      title: `Política de Privacidade e LGPD — ${tenant.brandName}`,
      description: 'Transparência no tratamento de dados pessoais conforme a Lei nº 13.709/2018 (LGPD).',
    });
  }, [tenant.brandName]);

  return (
    <div className="max-w-4xl mx-auto px-6 py-16 space-y-8">
      <div className="space-y-2 border-b border-[var(--site-border)] pb-6">
        <p className="text-xs font-medium text-[var(--site-accent)]">Transparência & Conformidade</p>
        <h1 className="font-editorial text-4xl font-semibold">Política de Privacidade e LGPD</h1>
      </div>

      <div className="space-y-6 text-sm text-[var(--site-text-muted)] leading-relaxed">
        <p className="whitespace-pre-line">{tenant.lgpdPrivacyText}</p>

        <section className="space-y-2">
          <h2 className="text-base font-semibold text-[var(--site-text)]">1. Finalidade do Tratamento</h2>
          <p>
            Os dados fornecidos nos formulários de contato e agendamento de visitas (nome, telefone, e-mail e interesse imobiliário) são utilizados estritamente para viabilizar o atendimento solicitado junto a {tenant.brandName}.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-base font-semibold text-[var(--site-text)]">2. Direitos do Titular e Exclusão de Dados</h2>
          <p>
            Em cumprimento ao art. 18 da LGPD, você pode solicitar a confirmação, retificação, portabilidade ou exclusão definitiva de seus dados pessoais a qualquer momento entrando em contato pelo canal oficial do corretor{tenant.email ? ` (${tenant.email})` : ''}.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-base font-semibold text-[var(--site-text)]">3. Segurança e Métricas</h2>
          <p>
            As métricas de navegação registradas pelo site são anônimas e não identificam visitantes individualmente sem consentimento explícito.
          </p>
        </section>
      </div>
    </div>
  );
}
