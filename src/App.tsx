/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { ErrorBoundary } from './components/ErrorBoundary';
import { AppProvider, useAppContext } from './hooks/useAuthTenant';
import { useRouter } from './hooks/useRouter';
import { SiteLayout } from './components/layout/SiteLayout';
import { HomePage } from './pages/public/HomePage';
import { CatalogPage } from './pages/public/CatalogPage';
import { PropertyDetailPage } from './pages/public/PropertyDetailPage';
import { DevelopmentsPage } from './pages/public/DevelopmentsPage';
import { LandingPageView } from './pages/public/LandingPageView';
import { AboutBrokerPage } from './pages/public/AboutBrokerPage';
import { PrivacyPage } from './pages/public/PrivacyPage';
import { AdminLogin } from './pages/admin/AdminLogin';
import { AdminDashboard } from './pages/admin/AdminDashboard';

function AppRoutes() {
  const { pathname, search, navigate } = useRouter();
  const { user, authReady } = useAppContext();

  const normalized = pathname.replace(/\/+$/, '') || '/';

  // Protected Admin & Login Routes (strictly separated from public site navigation)
  if (normalized === '/admin' || normalized.startsWith('/admin/') || normalized === '/login') {
    if (!authReady) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-[var(--site-bg)] text-[var(--site-text)]">
          <div className="w-8 h-8 border-2 border-[var(--site-accent)] border-t-transparent rounded-full animate-spin" />
        </div>
      );
    }
    if (!user) {
      return <AdminLogin onNavigate={navigate} />;
    }
    return <AdminDashboard onNavigate={navigate} />;
  }

  // Public Routes inside SiteLayout
  let pageNode: React.ReactNode;

  if (normalized === '/imoveis') {
    pageNode = <CatalogPage search={search} onNavigate={navigate} />;
  } else if (normalized.startsWith('/imovel/')) {
    const slug = decodeURIComponent(normalized.slice('/imovel/'.length));
    pageNode = <PropertyDetailPage slug={slug} onNavigate={navigate} />;
  } else if (normalized === '/empreendimentos') {
    pageNode = <DevelopmentsPage onNavigate={navigate} />;
  } else if (normalized.startsWith('/empreendimento/')) {
    const slug = decodeURIComponent(normalized.slice('/empreendimento/'.length));
    pageNode = <DevelopmentsPage slug={slug} onNavigate={navigate} />;
  } else if (normalized.startsWith('/oferta/')) {
    const slug = decodeURIComponent(normalized.slice('/oferta/'.length));
    pageNode = <LandingPageView slug={slug} onNavigate={navigate} />;
  } else if (normalized === '/sobre') {
    pageNode = <AboutBrokerPage />;
  } else if (normalized === '/privacidade') {
    pageNode = <PrivacyPage />;
  } else {
    pageNode = <HomePage onNavigate={navigate} />;
  }

  return (
    <SiteLayout currentPath={normalized} onNavigate={navigate}>
      {pageNode}
    </SiteLayout>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <AppProvider>
        <AppRoutes />
      </AppProvider>
    </ErrorBoundary>
  );
}
