import React, { useEffect, useState } from 'react';
import { ArrowLeft, Eye, EyeOff, Lock, Mail, ShieldCheck } from 'lucide-react';
import { useAppContext } from '../../hooks/useAuthTenant';
import { applySeoMetadata } from '../../utils/seo';

interface AdminLoginProps {
  onNavigate: (to: string) => void;
}

export function AdminLogin({ onNavigate }: AdminLoginProps) {
  const { tenant, loginWithEmailPassword, authError, authSubmitting } = useAppContext();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    applySeoMetadata({
      title: `Acesso Administrativo — ${tenant.brandName}`,
      description: 'Área restrita de administração do site imobiliário.',
      noIndex: true,
    });
  }, [tenant.brandName]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password) return;
    await loginWithEmailPassword(email, password);
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-6 bg-[var(--site-bg)] text-[var(--site-text)]">
      <div className="max-w-md w-full p-8 sm:p-10 bg-[var(--site-surface)] border border-[var(--site-border)] rounded-[var(--site-radius)] space-y-7 shadow-sm">
        <div className="space-y-2">
          <button
            type="button"
            onClick={() => onNavigate('/')}
            className="inline-flex items-center gap-1.5 text-xs text-[var(--site-text-muted)] hover:text-[var(--site-text)] transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Voltar ao site público
          </button>
          {tenant.logoUrl ? (
            <div className="pt-3 pb-1">
              <img
                src={tenant.logoUrl}
                alt={tenant.brandName}
                referrerPolicy="no-referrer"
                className="h-20 w-auto object-contain bg-transparent select-none"
              />
              <h1 className="sr-only">{tenant.brandName}</h1>
            </div>
          ) : (
            <h1 className="font-editorial text-3xl font-semibold pt-2">{tenant.brandName}</h1>
          )}
          <p className="text-sm text-[var(--site-text-muted)]">
            Painel de administração e publicação em tempo real.
          </p>
        </div>

        {authError && (
          <div
            role="alert"
            className="p-3.5 text-xs bg-red-50 border border-red-200 text-red-800 rounded-[var(--site-radius)] leading-relaxed"
          >
            {authError}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label
              htmlFor="admin-login-email"
              className="block text-[11px] uppercase tracking-[0.14em] font-medium text-[var(--site-text-muted)]"
            >
              Login (E-mail)
            </label>
            <div className="relative">
              <Mail className="w-4 h-4 text-[var(--site-text-muted)] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                id="admin-login-email"
                type="email"
                autoComplete="username"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="sandrodbillo@hotmail.com"
                disabled={authSubmitting}
                className="w-full pl-10 pr-4 py-3 text-sm bg-[var(--site-bg)] border border-[var(--site-border)] rounded-[var(--site-radius)] focus:outline-none focus:border-[var(--site-accent)] transition-colors disabled:opacity-60"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label
              htmlFor="admin-login-password"
              className="block text-[11px] uppercase tracking-[0.14em] font-medium text-[var(--site-text-muted)]"
            >
              Senha
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 text-[var(--site-text-muted)] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                id="admin-login-password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Digite sua senha"
                disabled={authSubmitting}
                className="w-full pl-10 pr-11 py-3 text-sm bg-[var(--site-bg)] border border-[var(--site-border)] rounded-[var(--site-radius)] focus:outline-none focus:border-[var(--site-accent)] transition-colors disabled:opacity-60"
              />
              <button
                type="button"
                onClick={() => setShowPassword((prev) => !prev)}
                aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-[var(--site-text-muted)] hover:text-[var(--site-text)] transition-colors"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={authSubmitting || !email.trim() || !password}
            className="w-full flex items-center justify-center gap-2.5 px-5 py-3.5 text-sm font-medium bg-[var(--site-text)] text-[var(--site-surface)] rounded-[var(--site-radius)] hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            {authSubmitting ? (
              <>
                <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                Entrando no painel...
              </>
            ) : (
              <>
                <ShieldCheck className="w-4 h-4" />
                Entrar no Painel Admin
              </>
            )}
          </button>

          <p className="text-xs text-[var(--site-text-muted)] leading-relaxed pt-1">
            Autenticação criptografada via Firebase Authentication com provisionamento automático do ambiente administrativo.
          </p>
        </form>
      </div>
    </div>
  );
}
