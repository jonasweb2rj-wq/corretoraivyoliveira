import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowDown,
  ArrowUp,
  Check,
  Compass,
  Eye,
  Film,
  GripVertical,
  Images,
  Sparkles,
  Star,
  SunMedium,
  Trash2,
  Upload,
  Wand2,
  X,
} from 'lucide-react';
import {
  Property,
  PropertyMediaItem,
  PropertyStatus,
  PropertyType,
  PropertyVideoItem,
  TransactionType,
  VirtualTourType,
} from '../../types/realestate';
import {
  analyzePropertyPhotos,
  CinematicStyle,
  generatePropertyCopy,
  renderKinematicPropertyVideo,
} from '../../services/aiService';
import {
  deleteMediaOnServer,
  enhancePhotoPreservingReality,
  uploadMediaToServer,
} from '../../services/mediaService';
import { saveAiJob, saveProperty, writeAuditLog } from '../../firebase/firestoreService';
import { generateSafeId, slugify } from '../../utils/formatters';
import { useAppContext } from '../../hooks/useAuthTenant';
import { VirtualTourModal } from '../../components/virtual-tour/VirtualTourModal';

interface PropertyEditorModalProps {
  existingProperty?: Property | null;
  onClose: () => void;
}

const ROOM_OPTIONS = [
  'Fachada',
  'Sala de estar',
  'Sala de jantar',
  'Cozinha',
  'Quarto principal',
  'Quartos adicionais',
  'Banheiro',
  'Varanda',
  'Área gourmet',
  'Piscina',
  'Área externa',
  'Garagem',
  'Outros ambientes',
];

const COPY_STYLES = ['Luxuoso', 'Familiar', 'Moderno', 'Comercial', 'Objetivo', 'Persuasivo'];
const VIDEO_STYLES: CinematicStyle[] = [
  'Cinematográfico de luxo',
  'Arquitetura moderna',
  'Tour imobiliário',
  'Apresentação comercial',
  'Minimalista',
  'Lançamento imobiliário',
];

export function PropertyEditorModal({ existingProperty, onClose }: PropertyEditorModalProps) {
  const { user, activeTenantId, tenant } = useAppContext();
  const isNew = !existingProperty;

  const [title, setTitle] = useState(existingProperty?.title || '');
  const [code, setCode] = useState(existingProperty?.code || `IVY-${Math.floor(100 + Math.random() * 900)}`);
  const [propertyType, setPropertyType] = useState<PropertyType>(existingProperty?.propertyType || 'apartamento');
  const [transactionType, setTransactionType] = useState<TransactionType>(existingProperty?.transactionType || 'venda');
  const [price, setPrice] = useState<number>(existingProperty?.price || 0);
  const [condoFee, setCondoFee] = useState<number>(existingProperty?.condoFee || 0);
  const [iptu, setIptu] = useState<number>(existingProperty?.iptu || 0);
  const [city, setCity] = useState(existingProperty?.city || tenant.city || 'Rio de Janeiro');
  const [neighborhood, setNeighborhood] = useState(existingProperty?.neighborhood || '');
  const [address, setAddress] = useState(existingProperty?.address || '');
  const [showExactAddress, setShowExactAddress] = useState(existingProperty?.showExactAddress || false);
  const [builtArea, setBuiltArea] = useState<number>(existingProperty?.builtArea || 0);
  const [totalArea, setTotalArea] = useState<number>(existingProperty?.totalArea || 0);
  const [bedrooms, setBedrooms] = useState<number>(existingProperty?.bedrooms || 0);
  const [suites, setSuites] = useState<number>(existingProperty?.suites || 0);
  const [bathrooms, setBathrooms] = useState<number>(existingProperty?.bathrooms || 0);
  const [parkingSpaces, setParkingSpaces] = useState<number>(existingProperty?.parkingSpaces || 0);
  const [summary, setSummary] = useState(existingProperty?.summary || '');
  const [description, setDescription] = useState(existingProperty?.description || '');
  const [featuresText, setFeaturesText] = useState((existingProperty?.features || []).join('\n'));
  const [differentialsText, setDifferentialsText] = useState((existingProperty?.differentials || []).join('\n'));
  const [status, setStatus] = useState<PropertyStatus>(existingProperty?.status || 'draft');
  const [featured, setFeatured] = useState(existingProperty?.featured || false);
  const [virtualTourType, setVirtualTourType] = useState<VirtualTourType>(existingProperty?.virtualTourType || 'photo');
  const [seoTitle, setSeoTitle] = useState(existingProperty?.seoTitle || '');
  const [seoDescription, setSeoDescription] = useState(existingProperty?.seoDescription || '');
  const [socialCopy, setSocialCopy] = useState(existingProperty?.socialCopy || '');
  const [whatsappCopy, setWhatsappCopy] = useState(existingProperty?.whatsappCopy || '');

  const [images, setImages] = useState<PropertyMediaItem[]>(existingProperty?.images || []);
  const [panorama360Images, setPanorama360Images] = useState<PropertyMediaItem[]>(
    existingProperty?.panorama360Images || []
  );
  const [videos, setVideos] = useState<PropertyVideoItem[]>(existingProperty?.videos || []);

  // Drag & drop upload and reordering states
  const [photoDropActive, setPhotoDropActive] = useState(false);
  const [panoDropActive, setPanoDropActive] = useState(false);
  const [draggedIdx, setDraggedIdx] = useState<number | null>(null);
  const [tourPreviewOpen, setTourPreviewOpen] = useState(false);

  // Optional AI availability & states (never blocks saving/publishing)
  const [geminiAvailable, setGeminiAvailable] = useState(false);
  const [aiObservedNotes, setAiObservedNotes] = useState('');
  const [aiStyle, setAiStyle] = useState('Luxuoso');
  const [analyzingPhotos, setAnalyzingPhotos] = useState(false);
  const [generatingCopy, setGeneratingCopy] = useState(false);
  const [enhancingIndex, setEnhancingIndex] = useState<number | null>(null);

  // Free Browser-Native Presentation Video states (100% client-side, zero paid API)
  const [videoStyle, setVideoStyle] = useState<CinematicStyle>('Cinematográfico de luxo');
  const [videoAspect, setVideoAspect] = useState<'16:9' | '9:16'>('16:9');
  const [slideDuration, setSlideDuration] = useState(3);
  const [renderingVideo, setRenderingVideo] = useState(false);
  const [videoProgress, setVideoProgress] = useState(0);
  const [previewVideo, setPreviewVideo] = useState<{ blob: Blob; url: string } | null>(null);

  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const propertyId = existingProperty?.id || generateSafeId('prop');

  useEffect(() => {
    fetch('/api/health')
      .then((r) => r.json())
      .then((data) => {
        setGeminiAvailable(Boolean(data?.capabilities?.geminiAi));
      })
      .catch(() => setGeminiAvailable(false));
  }, []);

  const roomSummary = useMemo(() => {
    const map = new Map<string, number>();
    images.forEach((img) => {
      const room = img.roomTag?.trim() || 'Outros ambientes';
      map.set(room, (map.get(room) || 0) + 1);
    });
    return Array.from(map.entries());
  }, [images]);

  const uploadPhotoFiles = async (files: File[], target: 'photo' | 'panorama360') => {
    const validFiles = files.filter((f) => f.type.startsWith('image/'));
    if (validFiles.length === 0) return;

    setUploading(true);
    setError(null);
    try {
      const uploaded: PropertyMediaItem[] = [];
      for (const file of validFiles) {
        const res = await uploadMediaToServer({
          tenantId: activeTenantId,
          file,
          filename: file.name,
          mimeType: file.type,
          folder: propertyId,
          isPanorama: target === 'panorama360',
          watermarkLogoUrl:
            target === 'photo'
              ? tenant.logoUrl || '/logo-ivy-oliveira.png'
              : undefined,
          onProgress: (label) => setFeedback(label),
        });
        uploaded.push({
          id: generateSafeId('img'),
          url: res.url,
          pathname: res.pathname,
          roomTag: target === 'panorama360' ? 'Sala de estar' : 'Sala de estar',
          caption: '',
          isPrimary: false,
          isAiEnhanced: false,
          sortOrder: (target === 'panorama360' ? panorama360Images.length : images.length) + uploaded.length,
        });
      }
      if (target === 'panorama360') {
        setPanorama360Images((prev) => [...prev, ...uploaded]);
        setFeedback(`${uploaded.length} panorama(s) 360° adicionado(s) ao Tour Virtual Pro.`);
      } else {
        setImages((prev) => {
          const next = [...prev, ...uploaded];
          if (!next.some((i) => i.isPrimary) && next[0]) next[0].isPrimary = true;
          return next;
        });
        setFeedback(`${uploaded.length} fotografia(s) enviada(s) e organizada(s) no Tour Virtual Pro.`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao enviar imagens.');
    } finally {
      setUploading(false);
    }
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>, target: 'photo' | 'panorama360') => {
    const files = Array.from(e.target.files || []);
    e.target.value = '';
    if (files.length === 0) return;
    await uploadPhotoFiles(files, target);
  };

  const handleDropFiles = async (e: React.DragEvent, target: 'photo' | 'panorama360') => {
    e.preventDefault();
    if (target === 'photo') setPhotoDropActive(false);
    else setPanoDropActive(false);
    const files = Array.from(e.dataTransfer.files || []);
    if (files.length > 0) {
      await uploadPhotoFiles(files, target);
    }
  };

  const handleVideoFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setUploading(true);
    setError(null);
    try {
      const res = await uploadMediaToServer({
        tenantId: activeTenantId,
        file,
        filename: file.name,
        mimeType: file.type || 'video/mp4',
        folder: propertyId,
        onProgress: (label) => setFeedback(label),
      });
      setVideos((prev) => [
        ...prev,
        {
          id: generateSafeId('vid'),
          url: res.url,
          title: file.name.replace(/\.[^.]+$/, ''),
          isIllustrativeAi: false,
        },
      ]);
      setFeedback('Vídeo comprimido mantendo alta qualidade e salvo no imóvel!');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao enviar vídeo.');
    } finally {
      setUploading(false);
    }
  };

  const handleAnalyzePhotos = async () => {
    if (images.length === 0) {
      setError('Envie pelo menos uma fotografia antes de classificar os ambientes.');
      return;
    }
    setAnalyzingPhotos(true);
    setError(null);
    setFeedback(null);
    try {
      const result = await analyzePropertyPhotos(
        images.map((i) => ({ url: i.url, mimeType: 'image/webp' }))
      );

      if (result.overallArchitecturalNotes) {
        setAiObservedNotes(result.overallArchitecturalNotes);
      }

      setImages((prev) => {
        const updated = prev.map((img, idx) => {
          const analysis = result.photoAnalyses?.find((a) => a.index === idx);
          const matchedRoom =
            ROOM_OPTIONS.find((r) => r.toLowerCase() === (analysis?.roomTag || '').toLowerCase()) ||
            analysis?.roomTag ||
            img.roomTag;
          return {
            ...img,
            roomTag: matchedRoom,
            caption: analysis?.caption || img.caption,
            isPrimary: idx === (result.coverIndex ?? 0),
          };
        });
        if (Array.isArray(result.recommendedOrder) && result.recommendedOrder.length === updated.length) {
          const reordered = result.recommendedOrder
            .map((idx) => updated[idx])
            .filter(Boolean);
          if (reordered.length === updated.length) return reordered;
        }
        return updated;
      });

      if (user) {
        await saveAiJob({
          id: generateSafeId('ai'),
          tenantId: activeTenantId,
          ownerUid: user.uid,
          propertyId,
          jobType: 'photo_analysis',
          provider: 'gemini-4-hydrogen',
          style: 'editorial',
          durationSec: 1,
          aspectRatio: '16:9',
          status: 'completed',
          inputImageUrls: images.slice(0, 8).map((i) => i.url),
          outputUrl: '',
          errorMessage: '',
        }).catch(() => {});
      }

      setFeedback('Classificação automática concluída! Você pode ajustar livremente os ambientes, legendas e ordem.');
    } catch {
      setFeedback('Classificação automática indisponível no momento. Utilize os seletores manuais de ambiente abaixo normalmente.');
    } finally {
      setAnalyzingPhotos(false);
    }
  };

  const handleGenerateCopy = async () => {
    setGeneratingCopy(true);
    setError(null);
    try {
      const result = await generatePropertyCopy({
        style: aiStyle,
        observedNotes: aiObservedNotes,
        propertyData: {
          title,
          code,
          propertyType,
          transactionType,
          price,
          condoFee,
          iptu,
          city,
          neighborhood,
          builtArea,
          totalArea,
          bedrooms,
          suites,
          bathrooms,
          parkingSpaces,
        },
      });
      if (result.commercialTitle && !title) setTitle(result.commercialTitle);
      if (result.summary) setSummary(result.summary);
      if (result.detailedDescription) setDescription(result.detailedDescription);
      if (Array.isArray(result.differentials) && result.differentials.length > 0) {
        setDifferentialsText(result.differentials.join('\n'));
      }
      if (result.socialCopy) setSocialCopy(result.socialCopy);
      if (result.whatsappCopy) setWhatsappCopy(result.whatsappCopy);
      if (result.seoTitle) setSeoTitle(result.seoTitle);
      if (result.seoDescription) setSeoDescription(result.seoDescription);
      setFeedback('Textos comerciais gerados com base nos dados reais informados. Revise antes de publicar.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Serviço de redação indisponível; preencha os textos manualmente.');
    } finally {
      setGeneratingCopy(false);
    }
  };

  const handleEnhancePhoto = async (idx: number) => {
    const img = images[idx];
    if (!img) return;
    setEnhancingIndex(idx);
    setError(null);
    try {
      const enhanced = await enhancePhotoPreservingReality(img.url, {
        brightness: 6,
        contrast: 8,
        warmth: 8,
        sharpness: true,
      });
      const uploaded = await uploadMediaToServer({
        tenantId: activeTenantId,
        blob: enhanced.blob,
        base64Data: enhanced.base64,
        filename: `enhanced-${img.id}.webp`,
        mimeType: 'image/webp',
        folder: propertyId,
      });
      setImages((prev) =>
        prev.map((item, i) =>
          i === idx
            ? {
                ...item,
                originalUrl: item.originalUrl || item.url,
                url: uploaded.url,
                pathname: uploaded.pathname,
                isAiEnhanced: true,
              }
            : item
        )
      );
      setFeedback('Iluminação e nitidez aprimoradas preservando a imagem original.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao aprimorar imagem.');
    } finally {
      setEnhancingIndex(null);
    }
  };

  const handleRenderKinematicVideo = async () => {
    if (images.length === 0) {
      setError('Adicione fotografias do imóvel para gerar a apresentação em vídeo.');
      return;
    }
    setRenderingVideo(true);
    setVideoProgress(0);
    setError(null);
    try {
      const res = await renderKinematicPropertyVideo({
        imageUrls: images.slice(0, 8).map((i) => i.url),
        title: title || `${propertyType} em ${neighborhood || city}`,
        subtitle: `${neighborhood || city} · ${builtArea > 0 ? `${builtArea} m²` : code}`,
        style: videoStyle,
        durationPerSlideSec: slideDuration,
        aspectRatio: videoAspect,
        onProgress: setVideoProgress,
      });
      setPreviewVideo({ blob: res.blob, url: res.url });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao renderizar vídeo no navegador.');
    } finally {
      setRenderingVideo(false);
    }
  };

  const handleApproveAndSaveVideo = async () => {
    if (!previewVideo || !user) return;
    setUploading(true);
    try {
      const file = new File([previewVideo.blob], `${slugify(title || code)}-${videoAspect}.webm`, {
        type: 'video/webm',
      });
      const uploaded = await uploadMediaToServer({
        tenantId: activeTenantId,
        file,
        filename: file.name,
        mimeType: 'video/webm',
        folder: propertyId,
      });
      setVideos((prev) => [
        ...prev,
        {
          id: generateSafeId('vid'),
          url: uploaded.url,
          title: `${videoStyle} (${videoAspect})`,
          style: videoStyle,
          aspectRatio: videoAspect,
          isIllustrativeAi: true,
        },
      ]);
      setPreviewVideo(null);
      setFeedback('Apresentação em vídeo salva e vinculada ao imóvel!');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao salvar vídeo.');
    } finally {
      setUploading(false);
    }
  };

  const moveImage = (idx: number, dir: -1 | 1) => {
    const target = idx + dir;
    if (target < 0 || target >= images.length) return;
    setImages((prev) => {
      const next = [...prev];
      const [moved] = next.splice(idx, 1);
      next.splice(target, 0, moved);
      return next;
    });
  };

  const handleCardDrop = (targetIdx: number) => {
    if (draggedIdx === null || draggedIdx === targetIdx) {
      setDraggedIdx(null);
      return;
    }
    setImages((prev) => {
      const next = [...prev];
      const [moved] = next.splice(draggedIdx, 1);
      next.splice(targetIdx, 0, moved);
      return next;
    });
    setDraggedIdx(null);
  };

  const removeImage = async (idx: number) => {
    const img = images[idx];
    if (img?.pathname) {
      await deleteMediaOnServer(activeTenantId, img.url, img.pathname).catch(() => {});
    }
    setImages((prev) => {
      const next = prev.filter((_, i) => i !== idx);
      if (next.length > 0 && !next.some((i) => i.isPrimary)) {
        next[0] = { ...next[0], isPrimary: true };
      }
      return next;
    });
  };

  const movePanorama = (idx: number, dir: -1 | 1) => {
    const target = idx + dir;
    if (target < 0 || target >= panorama360Images.length) return;
    setPanorama360Images((prev) => {
      const next = [...prev];
      const [moved] = next.splice(idx, 1);
      next.splice(target, 0, moved);
      return next;
    });
  };

  const removePanorama = async (idx: number) => {
    const pano = panorama360Images[idx];
    if (pano?.pathname) {
      await deleteMediaOnServer(activeTenantId, pano.url, pano.pathname).catch(() => {});
    }
    setPanorama360Images((prev) => prev.filter((_, i) => i !== idx));
  };

  const draftPreviewProperty: Property = useMemo(() => {
    const primary = images.find((i) => i.isPrimary) || images[0];
    return {
      id: propertyId,
      tenantId: activeTenantId,
      ownerUid: existingProperty?.ownerUid || user?.uid || '',
      slug: existingProperty?.slug || slugify(title || code),
      code: code.trim(),
      title: title.trim() || 'Pré-visualização do Imóvel',
      propertyType,
      transactionType,
      price: Number(price) || 0,
      condoFee: Number(condoFee) || 0,
      iptu: Number(iptu) || 0,
      city: city.trim() || 'Rio de Janeiro',
      neighborhood: neighborhood.trim() || 'Bairro',
      address: address.trim(),
      showExactAddress,
      builtArea: Number(builtArea) || 0,
      totalArea: Number(totalArea) || 0,
      bedrooms: Number(bedrooms) || 0,
      suites: Number(suites) || 0,
      bathrooms: Number(bathrooms) || 0,
      parkingSpaces: Number(parkingSpaces) || 0,
      description,
      summary,
      features: [],
      differentials: [],
      coverImage: primary?.url || '',
      images: images.map((img, idx) => ({ ...img, sortOrder: idx })),
      videos,
      panorama360Images: panorama360Images.map((p, idx) => ({ ...p, sortOrder: idx })),
      virtualTourType: virtualTourType === 'panorama360' && panorama360Images.length === 0 ? 'photo' : virtualTourType,
      status,
      featured,
      sortOrder: 0,
      seoTitle,
      seoDescription,
      socialCopy,
      whatsappCopy,
      viewsCount: 0,
    };
  }, [
    propertyId,
    activeTenantId,
    existingProperty,
    user,
    title,
    code,
    propertyType,
    transactionType,
    price,
    condoFee,
    iptu,
    city,
    neighborhood,
    address,
    showExactAddress,
    builtArea,
    totalArea,
    bedrooms,
    suites,
    bathrooms,
    parkingSpaces,
    description,
    summary,
    images,
    videos,
    panorama360Images,
    virtualTourType,
    status,
    featured,
    seoTitle,
    seoDescription,
    socialCopy,
    whatsappCopy,
  ]);

  const handleSave = async (targetStatus: PropertyStatus) => {
    if (!user) return;
    if (!title.trim() || !neighborhood.trim() || !city.trim()) {
      setError('Preencha título, cidade e bairro antes de salvar.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const primary = images.find((i) => i.isPrimary) || images[0];
      const slug = existingProperty?.slug || `${slugify(title)}-${code.toLowerCase().replace(/[^a-z0-9]/g, '')}`;
      const effectiveTourType: VirtualTourType =
        virtualTourType === 'panorama360' && panorama360Images.length === 0 ? 'photo' : virtualTourType;

      const payload: Omit<Property, 'createdAt' | 'updatedAt'> = {
        id: propertyId,
        tenantId: activeTenantId,
        ownerUid: existingProperty?.ownerUid || tenant.ownerUid || user.uid,
        slug,
        code: code.trim(),
        title: title.trim(),
        propertyType,
        transactionType,
        price: Number(price) || 0,
        condoFee: Number(condoFee) || 0,
        iptu: Number(iptu) || 0,
        city: city.trim(),
        neighborhood: neighborhood.trim(),
        address: address.trim(),
        showExactAddress,
        builtArea: Number(builtArea) || 0,
        totalArea: Number(totalArea) || 0,
        bedrooms: Number(bedrooms) || 0,
        suites: Number(suites) || 0,
        bathrooms: Number(bathrooms) || 0,
        parkingSpaces: Number(parkingSpaces) || 0,
        description: description.trim(),
        summary: summary.trim(),
        features: featuresText.split('\n').map((s) => s.trim()).filter(Boolean).slice(0, 40),
        differentials: differentialsText.split('\n').map((s) => s.trim()).filter(Boolean).slice(0, 25),
        coverImage: primary?.url || '',
        images: images.map((img, idx) => ({ ...img, sortOrder: idx })),
        videos,
        panorama360Images: panorama360Images.map((p, idx) => ({ ...p, sortOrder: idx })),
        virtualTourType: effectiveTourType,
        status: targetStatus,
        featured,
        sortOrder: existingProperty?.sortOrder ?? 0,
        seoTitle: seoTitle.trim(),
        seoDescription: seoDescription.trim(),
        socialCopy: socialCopy.trim(),
        whatsappCopy: whatsappCopy.trim(),
        viewsCount: existingProperty?.viewsCount ?? 0,
      };

      await saveProperty(payload, isNew);
      await writeAuditLog({
        tenantId: activeTenantId,
        ownerUid: payload.ownerUid,
        actorUid: user.uid,
        actorEmail: user.email || '',
        action: isNew ? 'create_property' : 'update_property',
        entityType: 'property',
        entityId: propertyId,
        summary: `${isNew ? 'Criou' : 'Atualizou'} imóvel "${title}" (${targetStatus})`,
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao salvar imóvel no Firestore.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-[var(--site-surface)] text-[var(--site-text)] border border-[var(--site-border)] rounded-lg w-full max-w-5xl max-h-[92vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-[var(--site-border)] flex items-center justify-between">
          <div>
            <h2 className="font-editorial text-2xl font-semibold">
              {isNew ? 'Cadastrar Novo Imóvel' : `Editar Imóvel · ${code}`}
            </h2>
            <p className="text-xs text-[var(--site-text-muted)]">
              Organize fotografias por ambiente e publique o Smart Virtual Tour Pro sem dependências pagas.
            </p>
          </div>
          <button type="button" onClick={onClose} className="p-2 hover:bg-[var(--site-surface-alt)] rounded">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Form Body */}
        <div className="p-6 overflow-y-auto space-y-8">
          {error && (
            <div className="p-3 text-xs bg-red-50 border border-red-200 text-red-800 rounded">{error}</div>
          )}
          {feedback && (
            <div className="p-3 text-xs bg-emerald-50 border border-emerald-200 text-emerald-800 rounded">
              {feedback}
            </div>
          )}

          {/* Section 1: Technical Info */}
          <section className="space-y-4">
            <h3 className="text-sm font-semibold border-b border-[var(--site-border)] pb-2">
              1. Informações Técnicas & Localização
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <label className="sm:col-span-2 block space-y-1 text-xs">
                <span>Título do Imóvel *</span>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Ex.: Cobertura Linear com Vista Mar no Leblon"
                  className="w-full px-3 py-2 text-sm border border-[var(--site-border)] rounded bg-[var(--site-bg)]"
                />
              </label>
              <label className="block space-y-1 text-xs">
                <span>Código *</span>
                <input
                  type="text"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  className="w-full px-3 py-2 text-sm font-mono border border-[var(--site-border)] rounded bg-[var(--site-bg)]"
                />
              </label>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <label className="block space-y-1 text-xs">
                <span>Tipo</span>
                <select
                  value={propertyType}
                  onChange={(e) => setPropertyType(e.target.value as PropertyType)}
                  className="w-full px-3 py-2 text-sm border border-[var(--site-border)] rounded bg-[var(--site-bg)]"
                >
                  <option value="apartamento">Apartamento</option>
                  <option value="cobertura">Cobertura</option>
                  <option value="casa">Casa</option>
                  <option value="terreno">Terreno</option>
                  <option value="comercial">Comercial</option>
                </select>
              </label>
              <label className="block space-y-1 text-xs">
                <span>Negociação</span>
                <select
                  value={transactionType}
                  onChange={(e) => setTransactionType(e.target.value as TransactionType)}
                  className="w-full px-3 py-2 text-sm border border-[var(--site-border)] rounded bg-[var(--site-bg)]"
                >
                  <option value="venda">Venda</option>
                  <option value="aluguel">Aluguel</option>
                  <option value="lancamento">Lançamento</option>
                </select>
              </label>
              <label className="block space-y-1 text-xs">
                <span>Preço (R$)</span>
                <input
                  type="number"
                  min={0}
                  value={price}
                  onChange={(e) => setPrice(Number(e.target.value))}
                  className="w-full px-3 py-2 text-sm font-mono border border-[var(--site-border)] rounded bg-[var(--site-bg)]"
                />
              </label>
              <label className="block space-y-1 text-xs">
                <span>Condomínio (R$)</span>
                <input
                  type="number"
                  min={0}
                  value={condoFee}
                  onChange={(e) => setCondoFee(Number(e.target.value))}
                  className="w-full px-3 py-2 text-sm font-mono border border-[var(--site-border)] rounded bg-[var(--site-bg)]"
                />
              </label>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <label className="block space-y-1 text-xs">
                <span>IPTU Anual (R$)</span>
                <input
                  type="number"
                  min={0}
                  value={iptu}
                  onChange={(e) => setIptu(Number(e.target.value))}
                  className="w-full px-3 py-2 text-sm font-mono border border-[var(--site-border)] rounded bg-[var(--site-bg)]"
                />
              </label>
              <label className="block space-y-1 text-xs">
                <span>Cidade *</span>
                <input
                  type="text"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-[var(--site-border)] rounded bg-[var(--site-bg)]"
                />
              </label>
              <label className="block space-y-1 text-xs">
                <span>Bairro *</span>
                <input
                  type="text"
                  value={neighborhood}
                  onChange={(e) => setNeighborhood(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-[var(--site-border)] rounded bg-[var(--site-bg)]"
                />
              </label>
              <label className="block space-y-1 text-xs">
                <span>Endereço (opcional)</span>
                <input
                  type="text"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-[var(--site-border)] rounded bg-[var(--site-bg)]"
                />
              </label>
            </div>

            <div className="grid grid-cols-3 sm:grid-cols-6 gap-4">
              <label className="block space-y-1 text-xs">
                <span>Área útil (m²)</span>
                <input
                  type="number"
                  min={0}
                  value={builtArea}
                  onChange={(e) => setBuiltArea(Number(e.target.value))}
                  className="w-full px-3 py-2 text-sm font-mono border border-[var(--site-border)] rounded bg-[var(--site-bg)]"
                />
              </label>
              <label className="block space-y-1 text-xs">
                <span>Área total (m²)</span>
                <input
                  type="number"
                  min={0}
                  value={totalArea}
                  onChange={(e) => setTotalArea(Number(e.target.value))}
                  className="w-full px-3 py-2 text-sm font-mono border border-[var(--site-border)] rounded bg-[var(--site-bg)]"
                />
              </label>
              <label className="block space-y-1 text-xs">
                <span>Quartos</span>
                <input
                  type="number"
                  min={0}
                  value={bedrooms}
                  onChange={(e) => setBedrooms(Number(e.target.value))}
                  className="w-full px-3 py-2 text-sm font-mono border border-[var(--site-border)] rounded bg-[var(--site-bg)]"
                />
              </label>
              <label className="block space-y-1 text-xs">
                <span>Suítes</span>
                <input
                  type="number"
                  min={0}
                  value={suites}
                  onChange={(e) => setSuites(Number(e.target.value))}
                  className="w-full px-3 py-2 text-sm font-mono border border-[var(--site-border)] rounded bg-[var(--site-bg)]"
                />
              </label>
              <label className="block space-y-1 text-xs">
                <span>Banheiros</span>
                <input
                  type="number"
                  min={0}
                  value={bathrooms}
                  onChange={(e) => setBathrooms(Number(e.target.value))}
                  className="w-full px-3 py-2 text-sm font-mono border border-[var(--site-border)] rounded bg-[var(--site-bg)]"
                />
              </label>
              <label className="block space-y-1 text-xs">
                <span>Vagas</span>
                <input
                  type="number"
                  min={0}
                  value={parkingSpaces}
                  onChange={(e) => setParkingSpaces(Number(e.target.value))}
                  className="w-full px-3 py-2 text-sm font-mono border border-[var(--site-border)] rounded bg-[var(--site-bg)]"
                />
              </label>
            </div>

            <div className="flex flex-wrap gap-6 text-xs pt-1">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={showExactAddress}
                  onChange={(e) => setShowExactAddress(e.target.checked)}
                />
                Exibir endereço exato e mapa na página pública
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={featured}
                  onChange={(e) => setFeatured(e.target.checked)}
                />
                Destacar imóvel na página inicial
              </label>
            </div>
          </section>

          {/* Section 2: Intelligent Photo Organization (Drag & Drop + Captions + Room Categories) */}
          <section className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--site-border)] pb-2">
              <div>
                <h3 className="text-sm font-semibold">2. Organização Inteligente das Fotografias</h3>
                <p className="text-[11px] text-[var(--site-text-muted)]">
                  Arraste arquivos, organize por ambiente, defina legendas e escolha a foto principal do catálogo.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <label className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-[var(--site-text)] text-[var(--site-surface)] rounded cursor-pointer hover:opacity-90">
                  <Upload className="w-3.5 h-3.5" />
                  {uploading ? 'Enviando...' : 'Enviar Fotografias'}
                  <input
                    type="file"
                    multiple
                    accept="image/jpeg,image/png,image/webp"
                    className="hidden"
                    disabled={uploading}
                    onChange={(e) => handlePhotoUpload(e, 'photo')}
                  />
                </label>

                {geminiAvailable && (
                  <button
                    type="button"
                    disabled={analyzingPhotos || images.length === 0}
                    onClick={handleAnalyzePhotos}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-[var(--site-accent)] text-[var(--site-accent)] rounded hover:bg-[var(--site-accent)] hover:text-white disabled:opacity-50 transition-colors"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    {analyzingPhotos ? 'Classificando...' : 'Classificar Ambientes (IA Opcional)'}
                  </button>
                )}
              </div>
            </div>

            {/* Drag & Drop Upload Zone */}
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setPhotoDropActive(true);
              }}
              onDragLeave={() => setPhotoDropActive(false)}
              onDrop={(e) => handleDropFiles(e, 'photo')}
              className={`p-5 border border-dashed rounded text-center transition-colors ${
                photoDropActive
                  ? 'border-[var(--site-accent)] bg-[var(--site-surface-alt)]'
                  : 'border-[var(--site-border)] bg-[var(--site-bg)]'
              }`}
            >
              <p className="text-xs font-medium">
                {uploading
                  ? 'Otimizando e enviando fotografias...'
                  : 'Arraste e solte múltiplas fotografias aqui (JPG, PNG ou WebP)'}
              </p>
              <p className="text-[11px] text-[var(--site-text-muted)] mt-1">
                As imagens são otimizadas e recebem automaticamente a marca d&apos;água da logo para exibição no site e no Tour Virtual Pro.
              </p>
            </div>

            {aiObservedNotes && (
              <div className="p-3 text-xs bg-[var(--site-bg)] border border-[var(--site-border)] rounded">
                <span className="font-semibold">Observações visuais sugeridas:</span> {aiObservedNotes}
              </div>
            )}

            {images.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {images.map((img, idx) => (
                  <div
                    key={img.id}
                    draggable
                    onDragStart={() => setDraggedIdx(idx)}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={() => handleCardDrop(idx)}
                    className={`border rounded p-3 bg-[var(--site-bg)] space-y-2.5 transition-opacity ${
                      draggedIdx === idx ? 'opacity-50 border-[var(--site-accent)]' : 'border-[var(--site-border)]'
                    }`}
                  >
                    <div className="relative aspect-[4/3] rounded overflow-hidden bg-neutral-900">
                      <img
                        src={img.url}
                        alt={img.caption || img.roomTag}
                        loading="lazy"
                        className="w-full h-full object-cover"
                      />
                      <span
                        title="Arraste para reordenar"
                        className="absolute top-2 right-2 p-1 bg-black/65 text-white rounded cursor-grab"
                      >
                        <GripVertical className="w-3.5 h-3.5" />
                      </span>
                      {img.isPrimary && (
                        <span className="absolute top-2 left-2 px-2 py-0.5 bg-amber-600 text-white text-[10px] font-medium rounded">
                          Foto Principal
                        </span>
                      )}
                      {img.isAiEnhanced && (
                        <span className="absolute bottom-2 left-2 px-2 py-0.5 bg-black/75 text-white text-[10px] rounded">
                          Luz ajustada
                        </span>
                      )}
                    </div>

                    <div className="space-y-1.5">
                      <select
                        value={ROOM_OPTIONS.includes(img.roomTag || '') ? img.roomTag : 'Outros ambientes'}
                        onChange={(e) =>
                          setImages((prev) =>
                            prev.map((item, i) => (i === idx ? { ...item, roomTag: e.target.value } : item))
                          )
                        }
                        className="w-full px-2 py-1.5 text-xs border border-[var(--site-border)] rounded bg-[var(--site-surface)]"
                      >
                        {ROOM_OPTIONS.map((r) => (
                          <option key={r} value={r}>
                            {r}
                          </option>
                        ))}
                      </select>

                      <input
                        type="text"
                        value={img.caption || ''}
                        onChange={(e) =>
                          setImages((prev) =>
                            prev.map((item, i) => (i === idx ? { ...item, caption: e.target.value } : item))
                          )
                        }
                        placeholder="Legenda personalizada (ex.: Vista livre para o mar)"
                        className="w-full px-2 py-1 text-xs border border-[var(--site-border)] rounded bg-[var(--site-surface)]"
                      />
                    </div>

                    <div className="flex items-center justify-between gap-1 pt-1">
                      <button
                        type="button"
                        title="Definir como imagem principal"
                        onClick={() =>
                          setImages((prev) =>
                            prev.map((item, i) => ({ ...item, isPrimary: i === idx }))
                          )
                        }
                        className={`p-1.5 rounded border text-xs ${
                          img.isPrimary ? 'border-amber-600 text-amber-700' : 'border-[var(--site-border)]'
                        }`}
                      >
                        <Star className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        title="Melhorar iluminação e nitidez (preserva original)"
                        disabled={enhancingIndex === idx}
                        onClick={() => handleEnhancePhoto(idx)}
                        className="p-1.5 rounded border border-[var(--site-border)] hover:border-[var(--site-accent)] text-xs inline-flex items-center gap-1"
                      >
                        <SunMedium className="w-3.5 h-3.5" />
                        <span>{enhancingIndex === idx ? '...' : 'Luz'}</span>
                      </button>
                      <button
                        type="button"
                        title="Mover para cima"
                        onClick={() => moveImage(idx, -1)}
                        className="p-1.5 rounded border border-[var(--site-border)]"
                      >
                        <ArrowUp className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        title="Mover para baixo"
                        onClick={() => moveImage(idx, 1)}
                        className="p-1.5 rounded border border-[var(--site-border)]"
                      >
                        <ArrowDown className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        title="Excluir fotografia"
                        onClick={() => removeImage(idx)}
                        className="p-1.5 rounded border border-red-200 text-red-700"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-[var(--site-text-muted)]">
                Nenhuma fotografia adicionada. Envie imagens acima para montar o Smart Virtual Tour Pro automaticamente.
              </p>
            )}
          </section>

          {/* Section 3: Commercial Descriptions & SEO */}
          <section className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--site-border)] pb-2">
              <h3 className="text-sm font-semibold">3. Descrições Comerciais & SEO</h3>
              {geminiAvailable && (
                <div className="flex items-center gap-2">
                  <select
                    value={aiStyle}
                    onChange={(e) => setAiStyle(e.target.value)}
                    className="px-2.5 py-1.5 text-xs border border-[var(--site-border)] rounded bg-[var(--site-bg)]"
                  >
                    {COPY_STYLES.map((st) => (
                      <option key={st} value={st}>
                        Estilo: {st}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    disabled={generatingCopy}
                    onClick={handleGenerateCopy}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-[var(--site-accent)] text-white rounded hover:opacity-90 disabled:opacity-50"
                  >
                    <Wand2 className="w-3.5 h-3.5" />
                    {generatingCopy ? 'Escrevendo...' : 'Gerar Textos com IA'}
                  </button>
                </div>
              )}
            </div>

            <label className="block space-y-1 text-xs">
              <span>Resumo Executivo</span>
              <input
                type="text"
                value={summary}
                onChange={(e) => setSummary(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-[var(--site-border)] rounded bg-[var(--site-bg)]"
              />
            </label>

            <label className="block space-y-1 text-xs">
              <span>Descrição Completa</span>
              <textarea
                rows={4}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-[var(--site-border)] rounded bg-[var(--site-bg)]"
              />
            </label>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <label className="block space-y-1 text-xs">
                <span>Características (uma por linha)</span>
                <textarea
                  rows={3}
                  value={featuresText}
                  onChange={(e) => setFeaturesText(e.target.value)}
                  placeholder="Varanda gourmet&#10;Piso em mármore&#10;Portaria 24h"
                  className="w-full px-3 py-2 text-sm border border-[var(--site-border)] rounded bg-[var(--site-bg)]"
                />
              </label>
              <label className="block space-y-1 text-xs">
                <span>Diferenciais (um por linha)</span>
                <textarea
                  rows={3}
                  value={differentialsText}
                  onChange={(e) => setDifferentialsText(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-[var(--site-border)] rounded bg-[var(--site-bg)]"
                />
              </label>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <label className="block space-y-1 text-xs">
                <span>Texto para Redes Sociais / Instagram</span>
                <textarea
                  rows={2}
                  value={socialCopy}
                  onChange={(e) => setSocialCopy(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-[var(--site-border)] rounded bg-[var(--site-bg)]"
                />
              </label>
              <label className="block space-y-1 text-xs">
                <span>SEO Title & Meta Description</span>
                <input
                  type="text"
                  value={seoTitle}
                  onChange={(e) => setSeoTitle(e.target.value)}
                  placeholder="Título SEO"
                  className="w-full px-3 py-1.5 text-xs border border-[var(--site-border)] rounded bg-[var(--site-bg)] mb-1.5"
                />
                <input
                  type="text"
                  value={seoDescription}
                  onChange={(e) => setSeoDescription(e.target.value)}
                  placeholder="Meta description SEO"
                  className="w-full px-3 py-1.5 text-xs border border-[var(--site-border)] rounded bg-[var(--site-bg)]"
                />
              </label>
            </div>
          </section>

          {/* Section 4: Smart Virtual Tour Pro & Real 360° Panoramas (Zero Paid APIs) */}
          <section className="space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--site-border)] pb-2">
              <div>
                <h3 className="text-sm font-semibold">4. Smart Virtual Tour Pro & Panoramas 360°</h3>
                <p className="text-[11px] text-[var(--site-text-muted)]">
                  Sistema 100% nativo no navegador: monta automaticamente a visita virtual guiada com as fotos e ambientes organizados acima.
                </p>
              </div>
              <button
                type="button"
                disabled={images.length === 0 && panorama360Images.length === 0}
                onClick={() => setTourPreviewOpen(true)}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium bg-[var(--site-accent)] text-white rounded hover:opacity-90 disabled:opacity-40"
              >
                <Eye className="w-3.5 h-3.5" />
                Pré-visualizar Tour Virtual
              </button>
            </div>

            {/* Live Smart Tour Structure Summary */}
            <div className="p-4 border border-[var(--site-border)] rounded bg-[var(--site-bg)] space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
                <div className="p-3 bg-[var(--site-surface)] border border-[var(--site-border)] rounded space-y-1">
                  <span className="text-[var(--site-text-muted)] flex items-center gap-1.5">
                    <Images className="w-3.5 h-3.5 text-[var(--site-accent)]" />
                    Tour Guiado por Ambientes
                  </span>
                  <p className="font-mono text-base font-semibold tabular-nums">
                    {images.length} foto(s) · {roomSummary.length} ambiente(s)
                  </p>
                </div>

                <div className="p-3 bg-[var(--site-surface)] border border-[var(--site-border)] rounded space-y-1">
                  <span className="text-[var(--site-text-muted)] flex items-center gap-1.5">
                    <Compass className="w-3.5 h-3.5 text-[var(--site-accent)]" />
                    Panoramas 360° Reais (Pannellum)
                  </span>
                  <p className="font-mono text-base font-semibold tabular-nums">
                    {panorama360Images.length} panorama(s)
                  </p>
                </div>

                <label className="p-3 bg-[var(--site-surface)] border border-[var(--site-border)] rounded space-y-1 block">
                  <span className="text-[var(--site-text-muted)] block">Experiência inicial do visitante</span>
                  <select
                    value={virtualTourType}
                    onChange={(e) => setVirtualTourType(e.target.value as VirtualTourType)}
                    className="w-full px-2 py-1 text-xs border border-[var(--site-border)] rounded bg-[var(--site-bg)]"
                  >
                    <option value="photo">Tour Guiado por Ambientes (Automático)</option>
                    <option value="panorama360">Panorama 360° (quando houver 360°)</option>
                    <option value="3d">Incluir Estudo Volumétrico Opcional</option>
                  </select>
                </label>
              </div>

              {roomSummary.length > 0 && (
                <div className="text-xs text-[var(--site-text-muted)]">
                  <span className="font-medium text-[var(--site-text)]">Ambientes no menu do visitante: </span>
                  {roomSummary.map(([name, count]) => `${name} (${count})`).join(' · ')}
                </div>
              )}
            </div>

            {/* Real 360° Equirectangular Panorama Manager */}
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setPanoDropActive(true);
              }}
              onDragLeave={() => setPanoDropActive(false)}
              onDrop={(e) => handleDropFiles(e, 'panorama360')}
              className={`p-4 border rounded space-y-4 transition-colors ${
                panoDropActive
                  ? 'border-[var(--site-accent)] bg-[var(--site-surface-alt)]'
                  : 'border-[var(--site-border)] bg-[var(--site-bg)]'
              }`}
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold">Fotografias Panorâmicas 360° Reais (Opcional)</p>
                  <p className="text-[11px] text-[var(--site-text-muted)]">
                    Envie imagens equiretangulares 360° capturadas no local. Caso não envie, o sistema usa automaticamente o Tour Guiado por Ambientes sem simular 360° artificial.
                  </p>
                </div>
                <label className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-[var(--site-border)] bg-[var(--site-surface)] rounded cursor-pointer hover:border-[var(--site-accent)]">
                  <Upload className="w-3.5 h-3.5" />
                  Enviar Panoramas 360°
                  <input
                    type="file"
                    multiple
                    accept="image/jpeg,image/png,image/webp"
                    className="hidden"
                    disabled={uploading}
                    onChange={(e) => handlePhotoUpload(e, 'panorama360')}
                  />
                </label>
              </div>

              {panorama360Images.length > 0 && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {panorama360Images.map((pano, idx) => (
                    <div
                      key={pano.id}
                      className="p-3 border border-[var(--site-border)] rounded bg-[var(--site-surface)] flex gap-3 items-start"
                    >
                      <img
                        src={pano.url}
                        alt={pano.roomTag || `Panorama ${idx + 1}`}
                        className="w-24 h-16 object-cover rounded shrink-0 bg-neutral-900"
                      />
                      <div className="flex-1 min-w-0 space-y-1.5">
                        <select
                          value={ROOM_OPTIONS.includes(pano.roomTag || '') ? pano.roomTag : 'Outros ambientes'}
                          onChange={(e) =>
                            setPanorama360Images((prev) =>
                              prev.map((item, i) => (i === idx ? { ...item, roomTag: e.target.value } : item))
                            )
                          }
                          className="w-full px-2 py-1 text-xs border border-[var(--site-border)] rounded bg-[var(--site-bg)]"
                        >
                          {ROOM_OPTIONS.map((r) => (
                            <option key={r} value={r}>
                              {r}
                            </option>
                          ))}
                        </select>
                        <input
                          type="text"
                          value={pano.caption || ''}
                          onChange={(e) =>
                            setPanorama360Images((prev) =>
                              prev.map((item, i) => (i === idx ? { ...item, caption: e.target.value } : item))
                            )
                          }
                          placeholder="Legenda do ponto 360°"
                          className="w-full px-2 py-1 text-xs border border-[var(--site-border)] rounded bg-[var(--site-bg)]"
                        />
                        <div className="flex items-center gap-1 pt-0.5">
                          <button
                            type="button"
                            onClick={() => movePanorama(idx, -1)}
                            className="p-1 border border-[var(--site-border)] rounded"
                          >
                            <ArrowUp className="w-3 h-3" />
                          </button>
                          <button
                            type="button"
                            onClick={() => movePanorama(idx, 1)}
                            className="p-1 border border-[var(--site-border)] rounded"
                          >
                            <ArrowDown className="w-3 h-3" />
                          </button>
                          <button
                            type="button"
                            onClick={() => removePanorama(idx)}
                            className="p-1 border border-red-200 text-red-700 rounded ml-auto"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Optional Local Browser Video Presentation (Zero external APIs or paid tokens) */}
            <div className="p-4 border border-[var(--site-border)] rounded bg-[var(--site-bg)] space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-xs font-semibold">Apresentação em Vídeo (100% Gratuita no Navegador — Opcional)</p>
                  <p className="text-[11px] text-[var(--site-text-muted)]">
                    Gera um vídeo WebM com transições suaves diretamente das fotografias enviadas ou permite subir um vídeo MP4/WebM próprio.
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <select
                    value={videoStyle}
                    onChange={(e) => setVideoStyle(e.target.value as CinematicStyle)}
                    className="px-2.5 py-1.5 text-xs border border-[var(--site-border)] rounded bg-[var(--site-surface)]"
                  >
                    {VIDEO_STYLES.map((st) => (
                      <option key={st} value={st}>
                        {st}
                      </option>
                    ))}
                  </select>
                  <select
                    value={videoAspect}
                    onChange={(e) => setVideoAspect(e.target.value as '16:9' | '9:16')}
                    className="px-2.5 py-1.5 text-xs border border-[var(--site-border)] rounded bg-[var(--site-surface)]"
                  >
                    <option value="16:9">Horizontal 16:9</option>
                    <option value="9:16">Vertical 9:16 (Reels)</option>
                  </select>
                  <select
                    value={slideDuration}
                    onChange={(e) => setSlideDuration(Number(e.target.value))}
                    className="px-2.5 py-1.5 text-xs border border-[var(--site-border)] rounded bg-[var(--site-surface)]"
                  >
                    <option value={2}>2s por foto</option>
                    <option value={3}>3s por foto</option>
                    <option value={4}>4s por foto</option>
                  </select>
                  <button
                    type="button"
                    disabled={renderingVideo || images.length === 0}
                    onClick={handleRenderKinematicVideo}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-[var(--site-text)] text-[var(--site-surface)] rounded disabled:opacity-50"
                  >
                    <Film className="w-3.5 h-3.5" />
                    {renderingVideo ? `Gerando ${videoProgress}%` : 'Gerar Vídeo Local'}
                  </button>
                </div>
              </div>

              {previewVideo && (
                <div className="space-y-3 pt-2">
                  <video src={previewVideo.url} controls className="w-full max-h-72 rounded bg-black" />
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={handleApproveAndSaveVideo}
                      disabled={uploading}
                      className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium bg-emerald-700 text-white rounded"
                    >
                      <Check className="w-3.5 h-3.5" />
                      Aprovar e Salvar no Imóvel
                    </button>
                    <button
                      type="button"
                      onClick={() => setPreviewVideo(null)}
                      className="px-3 py-2 text-xs border border-[var(--site-border)] rounded"
                    >
                      Descartar
                    </button>
                  </div>
                </div>
              )}

              <div className="pt-1 flex flex-wrap items-center gap-3 text-xs">
                <label className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-[var(--site-border)] bg-[var(--site-surface)] rounded cursor-pointer">
                  <Upload className="w-3.5 h-3.5" />
                  {uploading ? 'Comprimindo e enviando vídeo...' : `Enviar Vídeo Próprio (${videos.length})`}
                  <input
                    type="file"
                    accept="video/mp4,video/webm,video/quicktime,video/*"
                    disabled={uploading}
                    className="hidden"
                    onChange={handleVideoFileUpload}
                  />
                </label>
              </div>
            </div>
          </section>
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 border-t border-[var(--site-border)] bg-[var(--site-surface)] flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3 text-xs">
            <span>Status atual:</span>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as PropertyStatus)}
              className="px-2.5 py-1.5 border border-[var(--site-border)] rounded bg-[var(--site-bg)]"
            >
              <option value="draft">Rascunho (Privado)</option>
              <option value="published">Publicado (Site Público)</option>
              <option value="sold">Vendido</option>
              <option value="rented">Alugado</option>
            </select>
          </div>

          <div className="flex items-center gap-3">
            {(status === 'sold' || status === 'rented') && (
              <button
                type="button"
                disabled={saving}
                onClick={() => handleSave(status)}
                className="px-4 py-2 text-xs font-medium border border-[var(--site-accent)] text-[var(--site-accent)] rounded hover:bg-[var(--site-surface-alt)]"
              >
                {saving ? 'Salvando...' : `Salvar (${status === 'sold' ? 'Vendido' : 'Alugado'})`}
              </button>
            )}
            <button
              type="button"
              disabled={saving}
              onClick={() => handleSave('draft')}
              className="px-4 py-2 text-xs font-medium border border-[var(--site-border)] rounded hover:border-[var(--site-text)]"
            >
              Salvar Rascunho
            </button>
            <button
              type="button"
              disabled={saving}
              onClick={() => handleSave('published')}
              className="px-5 py-2 text-xs font-medium bg-[var(--site-text)] text-[var(--site-surface)] rounded hover:opacity-90"
            >
              {saving ? 'Salvando...' : 'Publicar no Site'}
            </button>
          </div>
        </div>
      </div>

      {tourPreviewOpen && (
        <VirtualTourModal property={draftPreviewProperty} onClose={() => setTourPreviewOpen(false)} />
      )}
    </div>
  );
}
