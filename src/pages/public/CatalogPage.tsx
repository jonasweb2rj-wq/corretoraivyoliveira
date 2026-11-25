import { useEffect, useMemo, useState } from 'react';
import { SlidersHorizontal, X } from 'lucide-react';
import { useAppContext } from '../../hooks/useAuthTenant';
import { subscribePublishedProperties, trackPublicEvent } from '../../firebase/firestoreService';
import { Property } from '../../types/realestate';
import { PropertyCard } from '../../components/properties/PropertyCard';
import { applySeoMetadata } from '../../utils/seo';

interface CatalogPageProps {
  search: string;
  onNavigate: (to: string) => void;
}

export function CatalogPage({ search, onNavigate }: CatalogPageProps) {
  const { tenant } = useAppContext();
  const [properties, setProperties] = useState<Property[]>([]);
  const [loading, setLoading] = useState(true);

  const initialParams = useMemo(() => new URLSearchParams(search), [search]);
  const [tx, setTx] = useState(() => initialParams.get('tx') || '');
  const [type, setType] = useState(() => initialParams.get('type') || '');
  const [city, setCity] = useState(() => initialParams.get('city') || '');
  const [neighborhood, setNeighborhood] = useState(() => initialParams.get('neighborhood') || '');
  const [keyword, setKeyword] = useState(() => initialParams.get('q') || '');
  const [minPrice, setMinPrice] = useState('');
  const [maxPrice, setMaxPrice] = useState('');
  const [minBedrooms, setMinBedrooms] = useState('');
  const [minSuites, setMinSuites] = useState('');
  const [minParking, setMinParking] = useState('');
  const [minArea, setMinArea] = useState('');
  const [maxCondo, setMaxCondo] = useState('');
  const [sortBy, setSortBy] = useState<'order' | 'price_asc' | 'price_desc' | 'area_desc'>('order');

  useEffect(() => {
    applySeoMetadata({
      title: `Catálogo de Imóveis — ${tenant.brandName}`,
      description: `Explore imóveis disponíveis para venda, aluguel e lançamento em ${tenant.city}.`,
    });
    trackPublicEvent({
      tenantId: tenant.id,
      ownerUid: tenant.ownerUid,
      eventType: 'page_view',
      targetId: 'catalog',
      path: '/imoveis',
      source: 'navigation',
      utmSource: '',
      utmCampaign: '',
    });
  }, [tenant]);

  useEffect(() => {
    const unsub = subscribePublishedProperties(tenant.id, (items) => {
      setProperties(items);
      setLoading(false);
    });
    return () => unsub();
  }, [tenant.id]);

  const cities = useMemo(
    () => Array.from(new Set(properties.map((p) => p.city).filter(Boolean))),
    [properties]
  );
  const neighborhoods = useMemo(
    () => Array.from(new Set(properties.map((p) => p.neighborhood).filter(Boolean))),
    [properties]
  );

  const filtered = useMemo(() => {
    const kw = keyword.trim().toLowerCase();
    const list = properties.filter((p) => {
      if (tx && p.transactionType !== tx) return false;
      if (type && p.propertyType !== type) return false;
      if (city && p.city !== city) return false;
      if (neighborhood && p.neighborhood !== neighborhood) return false;
      if (minPrice && p.price < Number(minPrice)) return false;
      if (maxPrice && p.price > Number(maxPrice)) return false;
      if (minBedrooms && p.bedrooms < Number(minBedrooms)) return false;
      if (minSuites && p.suites < Number(minSuites)) return false;
      if (minParking && p.parkingSpaces < Number(minParking)) return false;
      if (minArea && p.builtArea < Number(minArea)) return false;
      if (maxCondo && p.condoFee > Number(maxCondo)) return false;
      if (kw) {
        const hay = `${p.title} ${p.neighborhood} ${p.city} ${p.code} ${p.description}`.toLowerCase();
        if (!hay.includes(kw)) return false;
      }
      return true;
    });

    if (sortBy === 'price_asc') return [...list].sort((a, b) => a.price - b.price);
    if (sortBy === 'price_desc') return [...list].sort((a, b) => b.price - a.price);
    if (sortBy === 'area_desc') return [...list].sort((a, b) => b.builtArea - a.builtArea);
    return list;
  }, [
    properties,
    tx,
    type,
    city,
    neighborhood,
    keyword,
    minPrice,
    maxPrice,
    minBedrooms,
    minSuites,
    minParking,
    minArea,
    maxCondo,
    sortBy,
  ]);

  const resetFilters = () => {
    setTx('');
    setType('');
    setCity('');
    setNeighborhood('');
    setKeyword('');
    setMinPrice('');
    setMaxPrice('');
    setMinBedrooms('');
    setMinSuites('');
    setMinParking('');
    setMinArea('');
    setMaxCondo('');
    setSortBy('order');
  };

  return (
    <div className="max-w-7xl mx-auto px-6 py-14 space-y-10">
      <div className="space-y-2 border-b border-[var(--site-border)] pb-8">
        <p className="text-xs font-medium text-[var(--site-accent)]">Acervo Completo</p>
        <h1 className="font-editorial text-4xl sm:text-5xl font-semibold">Imóveis Selecionados</h1>
        <p className="text-sm text-[var(--site-text-muted)]">
          Busca em tempo real conectada diretamente ao banco de dados do corretor.
        </p>
      </div>

      {/* Real Firestore Multi-Criteria Filter Panel */}
      <section className="p-6 bg-[var(--site-surface)] border border-[var(--site-border)] rounded-[var(--site-radius)] space-y-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <SlidersHorizontal className="w-4 h-4 text-[var(--site-accent)]" />
            <span>Filtros de Pesquisa</span>
          </div>
          <button
            type="button"
            onClick={resetFilters}
            className="inline-flex items-center gap-1 text-xs text-[var(--site-text-muted)] hover:text-[var(--site-text)]"
          >
            <X className="w-3.5 h-3.5" />
            Limpar filtros
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <label className="block space-y-1 text-xs text-[var(--site-text-muted)]">
            <span>Palavra-chave / Código</span>
            <input
              type="text"
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              placeholder="Bairro, título ou código"
              className="w-full px-3 py-2 text-sm bg-[var(--site-bg)] text-[var(--site-text)] border border-[var(--site-border)] rounded-[var(--site-radius)]"
            />
          </label>

          <label className="block space-y-1 text-xs text-[var(--site-text-muted)]">
            <span>Negociação</span>
            <select
              value={tx}
              onChange={(e) => setTx(e.target.value)}
              className="w-full px-3 py-2 text-sm bg-[var(--site-bg)] text-[var(--site-text)] border border-[var(--site-border)] rounded-[var(--site-radius)]"
            >
              <option value="">Todas</option>
              <option value="venda">Venda</option>
              <option value="aluguel">Aluguel</option>
              <option value="lancamento">Lançamento</option>
            </select>
          </label>

          <label className="block space-y-1 text-xs text-[var(--site-text-muted)]">
            <span>Tipo</span>
            <select
              value={type}
              onChange={(e) => setType(e.target.value)}
              className="w-full px-3 py-2 text-sm bg-[var(--site-bg)] text-[var(--site-text)] border border-[var(--site-border)] rounded-[var(--site-radius)]"
            >
              <option value="">Todos</option>
              <option value="apartamento">Apartamento</option>
              <option value="cobertura">Cobertura</option>
              <option value="casa">Casa</option>
              <option value="terreno">Terreno</option>
              <option value="comercial">Comercial</option>
            </select>
          </label>

          <label className="block space-y-1 text-xs text-[var(--site-text-muted)]">
            <span>Cidade</span>
            <select
              value={city}
              onChange={(e) => setCity(e.target.value)}
              className="w-full px-3 py-2 text-sm bg-[var(--site-bg)] text-[var(--site-text)] border border-[var(--site-border)] rounded-[var(--site-radius)]"
            >
              <option value="">Todas</option>
              {cities.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </label>

          <label className="block space-y-1 text-xs text-[var(--site-text-muted)]">
            <span>Bairro</span>
            <select
              value={neighborhood}
              onChange={(e) => setNeighborhood(e.target.value)}
              className="w-full px-3 py-2 text-sm bg-[var(--site-bg)] text-[var(--site-text)] border border-[var(--site-border)] rounded-[var(--site-radius)]"
            >
              <option value="">Todos</option>
              {neighborhoods.map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </label>

          <label className="block space-y-1 text-xs text-[var(--site-text-muted)]">
            <span>Valor mínimo (R$)</span>
            <input
              type="number"
              min={0}
              value={minPrice}
              onChange={(e) => setMinPrice(e.target.value)}
              placeholder="0"
              className="w-full px-3 py-2 text-sm bg-[var(--site-bg)] text-[var(--site-text)] border border-[var(--site-border)] rounded-[var(--site-radius)]"
            />
          </label>

          <label className="block space-y-1 text-xs text-[var(--site-text-muted)]">
            <span>Valor máximo (R$)</span>
            <input
              type="number"
              min={0}
              value={maxPrice}
              onChange={(e) => setMaxPrice(e.target.value)}
              placeholder="Sem limite"
              className="w-full px-3 py-2 text-sm bg-[var(--site-bg)] text-[var(--site-text)] border border-[var(--site-border)] rounded-[var(--site-radius)]"
            />
          </label>

          <label className="block space-y-1 text-xs text-[var(--site-text-muted)]">
            <span>Quartos (mín.)</span>
            <select
              value={minBedrooms}
              onChange={(e) => setMinBedrooms(e.target.value)}
              className="w-full px-3 py-2 text-sm bg-[var(--site-bg)] text-[var(--site-text)] border border-[var(--site-border)] rounded-[var(--site-radius)]"
            >
              <option value="">Qualquer</option>
              <option value="1">1+</option>
              <option value="2">2+</option>
              <option value="3">3+</option>
              <option value="4">4+</option>
            </select>
          </label>

          <label className="block space-y-1 text-xs text-[var(--site-text-muted)]">
            <span>Suítes (mín.)</span>
            <select
              value={minSuites}
              onChange={(e) => setMinSuites(e.target.value)}
              className="w-full px-3 py-2 text-sm bg-[var(--site-bg)] text-[var(--site-text)] border border-[var(--site-border)] rounded-[var(--site-radius)]"
            >
              <option value="">Qualquer</option>
              <option value="1">1+</option>
              <option value="2">2+</option>
              <option value="3">3+</option>
            </select>
          </label>

          <label className="block space-y-1 text-xs text-[var(--site-text-muted)]">
            <span>Vagas (mín.)</span>
            <select
              value={minParking}
              onChange={(e) => setMinParking(e.target.value)}
              className="w-full px-3 py-2 text-sm bg-[var(--site-bg)] text-[var(--site-text)] border border-[var(--site-border)] rounded-[var(--site-radius)]"
            >
              <option value="">Qualquer</option>
              <option value="1">1+</option>
              <option value="2">2+</option>
              <option value="3">3+</option>
            </select>
          </label>

          <label className="block space-y-1 text-xs text-[var(--site-text-muted)]">
            <span>Área mín. (m²)</span>
            <input
              type="number"
              min={0}
              value={minArea}
              onChange={(e) => setMinArea(e.target.value)}
              placeholder="Ex.: 120"
              className="w-full px-3 py-2 text-sm bg-[var(--site-bg)] text-[var(--site-text)] border border-[var(--site-border)] rounded-[var(--site-radius)]"
            />
          </label>

          <label className="block space-y-1 text-xs text-[var(--site-text-muted)]">
            <span>Condomínio máx. (R$)</span>
            <input
              type="number"
              min={0}
              value={maxCondo}
              onChange={(e) => setMaxCondo(e.target.value)}
              placeholder="Sem limite"
              className="w-full px-3 py-2 text-sm bg-[var(--site-bg)] text-[var(--site-text)] border border-[var(--site-border)] rounded-[var(--site-radius)]"
            />
          </label>
        </div>
      </section>

      {/* Results Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 text-sm">
        <p className="text-[var(--site-text-muted)] tabular-nums">
          {filtered.length} {filtered.length === 1 ? 'imóvel encontrado' : 'imóveis encontrados'}
        </p>
        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
          className="px-3 py-2 text-xs bg-[var(--site-surface)] border border-[var(--site-border)] rounded-[var(--site-radius)]"
        >
          <option value="order">Ordenação selecionada</option>
          <option value="price_asc">Menor preço</option>
          <option value="price_desc">Maior preço</option>
          <option value="area_desc">Maior área</option>
        </select>
      </div>

      {/* Results Grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="h-96 bg-[var(--site-surface)] border border-[var(--site-border)] rounded-[var(--site-radius)] animate-pulse"
            />
          ))}
        </div>
      ) : filtered.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {filtered.map((prop) => (
            <PropertyCard
              key={prop.id}
              property={prop}
              onOpen={(slug) => onNavigate(`/imovel/${slug}`)}
            />
          ))}
        </div>
      ) : (
        <div className="p-12 text-center bg-[var(--site-surface)] border border-[var(--site-border)] rounded-[var(--site-radius)] space-y-4">
          <h3 className="font-editorial text-2xl font-semibold">Nenhum imóvel corresponde aos filtros</h3>
          <p className="text-sm text-[var(--site-text-muted)] max-w-md mx-auto">
            Tente ampliar os critérios de busca ou fale diretamente com nossa consultoria para acessar imóveis fora de portais.
          </p>
          <button
            type="button"
            onClick={resetFilters}
            className="px-5 py-2.5 text-xs font-medium bg-[var(--site-text)] text-[var(--site-surface)] rounded-[var(--site-radius)]"
          >
            Mostrar todos os imóveis
          </button>
        </div>
      )}
    </div>
  );
}
