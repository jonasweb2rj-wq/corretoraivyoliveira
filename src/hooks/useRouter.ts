import { useCallback, useEffect, useState } from 'react';

export function useRouter() {
  const [pathname, setPathname] = useState<string>(() => window.location.pathname || '/');
  const [search, setSearch] = useState<string>(() => window.location.search || '');

  useEffect(() => {
    const onPop = () => {
      setPathname(window.location.pathname || '/');
      setSearch(window.location.search || '');
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  const navigate = useCallback((to: string) => {
    if (to.startsWith('http://') || to.startsWith('https://')) {
      window.location.href = to;
      return;
    }
    const [pathPart, searchPart] = to.split('?');
    const nextSearch = searchPart ? `?${searchPart}` : '';
    if (pathPart !== window.location.pathname || nextSearch !== window.location.search) {
      window.history.pushState({}, '', to);
      setPathname(pathPart || '/');
      setSearch(nextSearch);
      window.scrollTo({ top: 0, behavior: 'auto' });
    }
  }, []);

  return { pathname, search, navigate };
}
