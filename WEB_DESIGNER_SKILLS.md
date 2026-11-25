# WEB_DESIGNER_SKILLS.md — Catálogo Visual & Motor de Animações

## 1. Motor de Animações & Compatibilidade
- **GSAP + ScrollTrigger** (`gsap`): Revelações progressivas no scroll, parallax de fotografia editorial, sequenciamento de títulos e cartões de imóveis com `prefers-reduced-motion` respeitado automaticamente via `gsap.matchMedia()`.
- **Lenis** (`lenis`): Rolagem suave de inércia refinada no site público (desativada automaticamente no Painel Admin e quando `prefers-reduced-motion: reduce` está ativo).
- **Motion** (`motion/react`): Microinterações de interface, abertura de galerias em tela cheia, transições entre rotas e modais de visita virtual com curvas `cubic-bezier(0.16, 1, 0.3, 1)` ($\le 200\text{ms}$ para feedbacks de UI).
- **Three.js** (`three`): Motor WebGL de Visita Virtual 360° (projeção equiretangular interativa com zoom e pontos de navegação) e Experiência 3D Arquitetônica (modelo espacial interativo com `RoomEnvironment`, iluminação quente/fria, `OrbitControls` e guarda `isSoftwareGl`).

## 2. Coreografia de Seções (Sem Repetição de Efeitos)
| Seção | Efeito / Composição | Biblioteca |
| :--- | :--- | :--- |
| **Hero Cinematográfico** | Entrada com zoom progressivo lento na fotografia principal + revelação de título editorial + scrim graduado 4.5:1 | GSAP + CSS Transform |
| **Busca Rápida** | Barra estrutural limpa abaixo do Hero com aparição suave sem latência de clique | Motion |
| **Imóveis em Destaque** | Grade assimétrica com elevação única, zoom suave nas fotografias no hover e revelação escalonada | GSAP ScrollTrigger |
| **Empreendimentos** | Composição editorial em duas colunas com `items-stretch` e parallax sutil na imagem | GSAP ScrollTrigger |
| **Sobre o Corretor** | Retrato/estúdio editorial com profundidade e linha divisória hairline | GSAP ScrollTrigger |
| **Depoimentos** | Transição discreta de citações atribuídas sem poluição visual | Motion |
| **Contato & Captação** | Entrada progressiva com formulário validado e consentimento explícito LGPD | Motion |

## 3. Sistema de Temas Configuráveis (5 Presets)
1. **Luxo Contemporâneo**: Marfim mineral `#F9F8F6`, grafite profundo `#141413`, acento bronze `#9A744B`.
2. **Minimalista Premium**: Branco puro `#FFFFFF`, carvão `#111827`, acento ardósia `#334155`.
3. **Imobiliário Moderno**: Areia fria `#F8FAFC`, azul marinho `#0F172A`, acento cobalto `#1E40AF`.
4. **Elegância Clássica**: Linho suave `#FAF7F2`, espresso `#1C1917`, acento oliva escuro `#4D5D43`.
5. **Arquitetura Editorial**: Cinza galeria `#F4F4F2`, preto absoluto `#0A0A0A`, acento terracota sóbrio `#8C4A32`.

## 4. Diretrizes Tipográficas & Disciplina Visual
- **2+1 Font Rule**: `Cormorant Garamond` (Display Editorial) + `Plus Jakarta Sans` (Corpo & UI) + `JetBrains Mono` (`tabular-nums` para códigos, preços e métricas).
- **Zero-Pill Metadata**: Metadados de imóveis (`Venda · Leblon · 240 m²`) exibidos em texto limpo com separadores tipográficos (`·`), nunca encapsulados em pílulas coloridas.
- **Top Bar Contract**: 3 zonas exatas (`Marca` — `4-5 links em linha única` — `1 CTA principal`).
