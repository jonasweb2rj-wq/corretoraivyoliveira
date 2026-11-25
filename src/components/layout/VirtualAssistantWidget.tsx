import React, { useEffect, useRef, useState } from 'react';
import { ArrowRight, Send, X } from 'lucide-react';
import { trackPublicEvent } from '../../firebase/firestoreService';
import { Tenant } from '../../types/realestate';
import { buildWhatsAppUrl } from '../../utils/formatters';
import {
  InstagramOfficialIcon,
  normalizeInstagramUrl,
  WhatsAppOfficialIcon,
} from './FloatingSocialButtons';

interface VirtualAssistantWidgetProps {
  tenant: Tenant;
  currentPath: string;
  onNavigate: (to: string) => void;
}

interface ChatMessage {
  id: string;
  sender: 'assistant' | 'user';
  text: string;
  routeAction?: { label: string; path: string };
  showSocialLinks?: boolean;
}

const ASSISTANT_NAME = 'Clara';
const ASSISTANT_AVATAR_URL = '/src/assets/images/virtual_assistant_portrait_1795535956537.jpg';

const QUICK_TOPICS = [
  'Ver imóveis disponíveis',
  'Lançamentos',
  'Regiões atendidas',
  'Agendar visita',
  'Falar nas redes sociais',
];

function buildAssistantReply(
  rawInput: string,
  tenant: Tenant
): Omit<ChatMessage, 'id' | 'sender'> {
  const q = rawInput
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

  const regionsText =
    tenant.regions && tenant.regions.length > 0
      ? tenant.regions.join(', ')
      : tenant.city;

  if (/^(oi|ola|bom dia|boa tarde|boa noite|tudo bem|hey|hi)/.test(q.trim())) {
    return {
      text: `Olá! Que bom receber você por aqui. Como posso ajudar hoje — gostaria de explorar nossos imóveis, conhecer lançamentos ou conversar diretamente pelo WhatsApp e Instagram da ${tenant.brandName}?`,
      routeAction: { label: 'Explorar imóveis', path: '/imoveis' },
      showSocialLinks: true,
    };
  }

  if (/(lancamento|empreendimento|planta|obra|incorporacao|condominio)/.test(q)) {
    return {
      text: `Temos empreendimentos selecionados com plantas detalhadas e condições especiais em ${tenant.city}. Você pode conferir os projetos no catálogo ou falar direto com nossa equipe pelas redes.`,
      routeAction: { label: 'Ver empreendimentos', path: '/empreendimentos' },
      showSocialLinks: true,
    };
  }

  if (/(regiao|regioes|bairro|onde|cidade|leblon|ipanema|barra|lagoa|sao conrado|zona sul|endereco)/.test(q)) {
    return {
      text: `A ${tenant.brandName} atua principalmente em ${tenant.city}${tenant.state ? ` (${tenant.state})` : ''}, com foco em ${regionsText}. Se quiser atendimento personalizado para algum bairro específico, chame nossa equipe no WhatsApp ou acompanhe as novidades no Instagram.`,
      routeAction: { label: 'Filtrar imóveis por região', path: '/imoveis' },
      showSocialLinks: true,
    };
  }

  if (/(visita|tour|360|agendar|horario|conhecer|marcar)/.test(q)) {
    return {
      text: `Você pode explorar a Visita Virtual Pro e fotos panorâmicas 360° direto na página de cada imóvel, ou agendar uma visita presencial com ${tenant.brokerName} pelo WhatsApp.`,
      routeAction: { label: 'Escolher imóvel para visitar', path: '/imoveis' },
      showSocialLinks: true,
    };
  }

  if (/(vender|anunciar|avaliacao|avaliar|corretor|ivy|sobre|creci|quem)/.test(q)) {
    const creciNote = tenant.creci ? ` (${tenant.creci})` : '';
    return {
      text: `${tenant.brokerName}${creciNote} conduz pessoalmente consultoria para compra, venda e avaliação patrimonial em ${tenant.city}. Conheça mais sobre o atendimento ou envie uma mensagem no WhatsApp ou Instagram.`,
      routeAction: { label: `Conhecer ${tenant.brokerName}`, path: '/sobre' },
      showSocialLinks: true,
    };
  }

  if (/(whatsapp|instagram|insta|zap|rede|social|contato|telefone|falar|atendimento)/.test(q)) {
    return {
      text: `Nossos canais oficiais estão prontos para atender você rapidamente! Escolha abaixo se prefere iniciar uma conversa no WhatsApp ou acompanhar os destaques no Instagram da ${tenant.brandName}.`,
      showSocialLinks: true,
    };
  }

  if (/(imovel|imoveis|casa|apartamento|ap|cobertura|terreno|comercial|compra|comprar|alugar|aluguel|preco|valor)/.test(q)) {
    let targetPath = '/imoveis';
    if (q.includes('cobertura')) targetPath = '/imoveis?type=cobertura';
    else if (q.includes('casa')) targetPath = '/imoveis?type=casa';
    else if (q.includes('apartamento') || /\bap\b/.test(q)) targetPath = '/imoveis?type=apartamento';
    else if (q.includes('alugar') || q.includes('aluguel')) targetPath = '/imoveis?tx=aluguel';

    return {
      text: `Nosso acervo reúne imóveis selecionados em ${regionsText} com valores, fichas técnicas e visita virtual. Clique abaixo para ver as opções disponíveis ou fale conosco no WhatsApp e Instagram para atendimento sob medida.`,
      routeAction: { label: 'Ver imóveis no catálogo', path: targetPath },
      showSocialLinks: true,
    };
  }

  return {
    text: `Posso direcionar você ao acervo de imóveis e empreendimentos em ${tenant.city}, ou conectar você agora mesmo ao WhatsApp e Instagram oficiais da ${tenant.brandName} para tirar qualquer dúvida direta com a equipe.`,
    routeAction: { label: 'Ver imóveis', path: '/imoveis' },
    showSocialLinks: true,
  };
}

export function VirtualAssistantWidget({
  tenant,
  currentPath,
  onNavigate,
}: VirtualAssistantWidgetProps) {
  const [open, setOpen] = useState(false);
  const [avatarError, setAvatarError] = useState(false);
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>(() => [
    {
      id: 'welcome',
      sender: 'assistant',
      text: `Olá! Eu sou a ${ASSISTANT_NAME}, assistente virtual da ${tenant.brandName}. Como posso ajudar você hoje?`,
      showSocialLinks: true,
    },
  ]);

  const listRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (open && listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [messages, open]);

  const instagramUrl = normalizeInstagramUrl(tenant);
  const whatsappUrl = buildWhatsAppUrl(
    tenant.whatsapp,
    `Olá! Conversei com a assistente ${ASSISTANT_NAME} no site da ${tenant.brandName} e gostaria de atendimento.`
  );

  const sendMessage = (textToSend: string) => {
    const trimmed = textToSend.trim();
    if (!trimmed) return;

    const userMsg: ChatMessage = {
      id: `u_${Date.now()}`,
      sender: 'user',
      text: trimmed,
    };

    const replyData = buildAssistantReply(trimmed, tenant);
    const botMsg: ChatMessage = {
      id: `a_${Date.now() + 1}`,
      sender: 'assistant',
      ...replyData,
    };

    setMessages((prev) => [...prev, userMsg, botMsg]);
    setInput('');
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendMessage(input);
  };

  const handleOpenWhatsApp = () => {
    trackPublicEvent({
      tenantId: tenant.id,
      ownerUid: tenant.ownerUid,
      eventType: 'whatsapp_click',
      targetId: 'assistant_whatsapp',
      path: currentPath,
      source: 'virtual_assistant',
      utmSource: '',
      utmCampaign: '',
    });
    if (!whatsappUrl) {
      setOpen(false);
      const contactEl = document.getElementById('contato');
      if (contactEl) {
        contactEl.scrollIntoView({ behavior: 'smooth' });
      } else {
        onNavigate('/#contato');
      }
    }
  };

  const handleOpenInstagram = () => {
    trackPublicEvent({
      tenantId: tenant.id,
      ownerUid: tenant.ownerUid,
      eventType: 'share',
      targetId: 'assistant_instagram',
      path: currentPath,
      source: 'virtual_assistant',
      utmSource: '',
      utmCampaign: '',
    });
  };

  return (
    <div className="fixed bottom-5 left-4 sm:bottom-6 sm:left-6 z-40 flex flex-col items-start">
      {open && (
        <section
          aria-label={`Atendimento virtual com ${ASSISTANT_NAME}`}
          className="mb-3 w-[calc(100vw-2rem)] sm:w-[360px] max-h-[72vh] flex flex-col bg-[var(--site-surface)] border border-[var(--site-border)] rounded-[var(--site-radius)] shadow-2xl overflow-hidden"
        >
          {/* Header */}
          <div className="flex items-center justify-between gap-3 px-4 py-3.5 border-b border-[var(--site-border)] bg-[var(--site-bg)]">
            <div className="flex items-center gap-3 min-w-0">
              {!avatarError ? (
                <img
                  src={ASSISTANT_AVATAR_URL}
                  alt={`${ASSISTANT_NAME} — Assistente Virtual`}
                  referrerPolicy="no-referrer"
                  onError={() => setAvatarError(true)}
                  className="w-10 h-10 rounded-full object-cover border border-[var(--site-border)] shrink-0"
                />
              ) : (
                <div className="w-10 h-10 rounded-full bg-[var(--site-accent)] text-white flex items-center justify-center font-semibold text-sm shrink-0">
                  {ASSISTANT_NAME[0]}
                </div>
              )}
              <div className="min-w-0">
                <p className="text-sm font-semibold text-[var(--site-text)] truncate">
                  {ASSISTANT_NAME}
                </p>
                <p className="text-xs text-[var(--site-text-muted)] truncate">
                  Assistente Virtual · {tenant.brandName}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Fechar assistente virtual"
              className="p-1.5 text-[var(--site-text-muted)] hover:text-[var(--site-text)] rounded-md transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Messages */}
          <div
            ref={listRef}
            className="flex-1 overflow-y-auto px-4 py-4 space-y-3 bg-[var(--site-surface)]"
          >
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex flex-col ${
                  msg.sender === 'user' ? 'items-end' : 'items-start'
                }`}
              >
                <div
                  className={`max-w-[88%] px-3.5 py-2.5 text-[13px] leading-relaxed rounded-[var(--site-radius)] ${
                    msg.sender === 'user'
                      ? 'bg-[var(--site-text)] text-[var(--site-surface)]'
                      : 'bg-[var(--site-bg)] text-[var(--site-text)] border border-[var(--site-border)]'
                  }`}
                >
                  <p>{msg.text}</p>

                  {msg.sender === 'assistant' &&
                    (msg.routeAction || msg.showSocialLinks) && (
                      <div className="mt-2.5 pt-2.5 border-t border-[var(--site-border)] flex flex-wrap gap-2">
                        {msg.routeAction && (
                          <button
                            type="button"
                            onClick={() => {
                              setOpen(false);
                              onNavigate(msg.routeAction!.path);
                            }}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium bg-[var(--site-text)] text-[var(--site-surface)] rounded-[var(--site-radius)] hover:opacity-90 transition-opacity"
                          >
                            {msg.routeAction.label}
                            <ArrowRight className="w-3 h-3" />
                          </button>
                        )}

                        {msg.showSocialLinks && (
                          <>
                            {whatsappUrl ? (
                              <a
                                href={whatsappUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                onClick={handleOpenWhatsApp}
                                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-white rounded-[var(--site-radius)] hover:opacity-90 transition-opacity"
                                style={{ backgroundColor: '#25D366' }}
                              >
                                <WhatsAppOfficialIcon className="w-3.5 h-3.5" />
                                WhatsApp
                              </a>
                            ) : (
                              <button
                                type="button"
                                onClick={handleOpenWhatsApp}
                                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-white rounded-[var(--site-radius)] hover:opacity-90 transition-opacity"
                                style={{ backgroundColor: '#25D366' }}
                              >
                                <WhatsAppOfficialIcon className="w-3.5 h-3.5" />
                                Contato
                              </button>
                            )}

                            <a
                              href={instagramUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={handleOpenInstagram}
                              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-white rounded-[var(--site-radius)] hover:opacity-90 transition-opacity"
                              style={{
                                background:
                                  'linear-gradient(45deg, #f09433 0%, #e6683c 25%, #dc2743 50%, #cc2366 75%, #bc1888 100%)',
                              }}
                            >
                              <InstagramOfficialIcon className="w-3.5 h-3.5" />
                              Instagram
                            </a>
                          </>
                        )}
                      </div>
                    )}
                </div>
              </div>
            ))}
          </div>

          {/* Quick Topic Buttons */}
          <div className="px-3 py-2 border-t border-[var(--site-border)] bg-[var(--site-bg)] flex items-center gap-1.5 overflow-x-auto">
            {QUICK_TOPICS.map((topic) => (
              <button
                key={topic}
                type="button"
                onClick={() => sendMessage(topic)}
                className="px-2.5 py-1 text-xs font-medium whitespace-nowrap shrink-0 bg-[var(--site-surface)] text-[var(--site-text)] border border-[var(--site-border)] rounded-[var(--site-radius)] hover:border-[var(--site-accent)] transition-colors"
              >
                {topic}
              </button>
            ))}
          </div>

          {/* Text Input */}
          <form
            onSubmit={handleSubmit}
            className="flex items-center gap-2 px-3 py-2.5 border-t border-[var(--site-border)] bg-[var(--site-surface)]"
          >
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={`Pergunte à ${ASSISTANT_NAME}...`}
              aria-label={`Escreva sua dúvida para ${ASSISTANT_NAME}`}
              className="flex-1 min-w-0 px-3 py-2 text-xs bg-[var(--site-bg)] text-[var(--site-text)] border border-[var(--site-border)] rounded-[var(--site-radius)] focus:outline-none focus:border-[var(--site-accent)]"
            />
            <button
              type="submit"
              disabled={!input.trim()}
              aria-label="Enviar mensagem"
              className="p-2 bg-[var(--site-text)] text-[var(--site-surface)] rounded-[var(--site-radius)] hover:opacity-90 disabled:opacity-40 transition-opacity shrink-0"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
        </section>
      )}

      {/* Floating Left Trigger with Portrait & Name */}
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-expanded={open}
        aria-label={open ? `Minimizar atendimento com ${ASSISTANT_NAME}` : `Conversar com ${ASSISTANT_NAME}, assistente virtual`}
        className="group flex items-center gap-2.5 p-1 sm:pr-4 bg-[var(--site-surface)] border border-[var(--site-border)] rounded-full shadow-lg hover:border-[var(--site-accent)] transition-all duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--site-accent)]"
      >
        {!avatarError ? (
          <img
            src={ASSISTANT_AVATAR_URL}
            alt={`${ASSISTANT_NAME} — Assistente Virtual`}
            referrerPolicy="no-referrer"
            onError={() => setAvatarError(true)}
            className="w-11 h-11 sm:w-12 sm:h-12 rounded-full object-cover shrink-0"
          />
        ) : (
          <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-full bg-[var(--site-accent)] text-white flex items-center justify-center font-semibold text-base shrink-0">
            {ASSISTANT_NAME[0]}
          </div>
        )}
        <div className="hidden sm:flex flex-col items-start text-left leading-tight">
          <span className="text-xs font-semibold text-[var(--site-text)] whitespace-nowrap">
            {ASSISTANT_NAME}
          </span>
          <span className="text-[11px] text-[var(--site-text-muted)] whitespace-nowrap">
            Assistente Virtual
          </span>
        </div>
      </button>
    </div>
  );
}
