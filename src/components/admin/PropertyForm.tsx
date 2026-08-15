"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import {
  Loader2,
  Plus,
  X,
  ArrowUp,
  ArrowDown,
  ImageIcon,
  Phone,
  Upload,
} from "lucide-react";
import { propertyTypeLabels, propertyTypes, propertyPurposeLabels, propertyPurposes } from "@/lib/utils";
import { propertySchema } from "@/lib/schemas/property";
import {
  getPropertyImageUrlError,
  isAllowedPropertyImageUrl,
  PROPERTY_IMAGE_HOSTNAME,
  PROPERTY_IMAGE_CONTENT_TYPES,
  PROPERTY_IMAGE_MAX_BYTES,
  PROPERTY_IMAGE_MAX_COUNT,
  PROPERTY_IMAGE_MAX_URL_LENGTH,
} from "@/lib/image-policy";

interface PropertyFormProps {
  propertyId: string;
  initialData?: {
    id: string;
    version: number;
    title: string;
    description: string;
    price: number | string;
    city: string;
    neighborhood: string;
    address: string | null;
    type: string;
    purpose: string;
    bedrooms: number | null;
    bathrooms: number | null;
    area: number | null;
    whatsappPhone: string | null;
    featured: boolean;
    active: boolean;
    images: { id: string; url: string; storageKey?: string | null }[];
  };
}

interface ImageItem {
  url: string;
  imageId?: string;
  uploadId?: string;
}

async function fetchWithTimeout(
  input: RequestInfo | URL,
  init: RequestInit,
  timeoutMs: number
) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

export default function PropertyForm({ propertyId, initialData }: PropertyFormProps) {
  const router = useRouter();
  const isEditing = !!initialData;

  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");

  const [title, setTitle] = useState(initialData?.title || "");
  const [description, setDescription] = useState(initialData?.description || "");
  const [price, setPrice] = useState(initialData?.price?.toString() || "");
  const [city, setCity] = useState(initialData?.city || "");
  const [neighborhood, setNeighborhood] = useState(initialData?.neighborhood || "");
  const [address, setAddress] = useState(initialData?.address || "");
  const [type, setType] = useState(initialData?.type || "HOUSE");
  const [purpose, setPurpose] = useState(initialData?.purpose || "SALE");
  const [bedrooms, setBedrooms] = useState(initialData?.bedrooms?.toString() || "");
  const [bathrooms, setBathrooms] = useState(initialData?.bathrooms?.toString() || "");
  const [area, setArea] = useState(initialData?.area?.toString() || "");
  const [whatsappPhone, setWhatsappPhone] = useState(initialData?.whatsappPhone || "");
  const [featured, setFeatured] = useState(initialData?.featured || false);
  const [active, setActive] = useState(initialData?.active !== false);

  const [images, setImages] = useState<ImageItem[]>(
    initialData?.images?.map((img) => ({
      url: img.url,
      imageId: img.id,
    })) || []
  );

  const [imageUrl, setImageUrl] = useState("");
  const [imageError, setImageError] = useState("");

  function addImageByUrl() {
    if (uploading || saving) return;
    const normalizedUrl = imageUrl.trim();
    const validationError = getPropertyImageUrlError(normalizedUrl);

    if (validationError) {
      setImageError(validationError);
      return;
    }
    if (images.length >= PROPERTY_IMAGE_MAX_COUNT) {
      setImageError(`Adicione no máximo ${PROPERTY_IMAGE_MAX_COUNT} imagens.`);
      return;
    }
    if (images.some((image) => image.url === normalizedUrl)) {
      setImageError("Esta imagem já foi adicionada.");
      return;
    }

    setImages((prev) => [...prev, { url: normalizedUrl }]);
    setImageUrl("");
    setImageError("");
  }

  async function removeImage(index: number) {
    if (uploading || saving) return;
    const image = images[index];
    setImages((prev) => prev.filter((_, i) => i !== index));
    setImageError("");

    if (image?.uploadId) {
      try {
        const response = await fetchWithTimeout(
          `/api/uploads/${image.uploadId}`,
          { method: "DELETE" },
          10_000
        );
        if (response.ok) return;
      } catch {
        // The durable upload intent is also swept by the maintenance cron.
      }
      if (image.uploadId) {
        setImageError(
          "A imagem saiu do formulário, mas a limpeza remota ficou pendente e será tentada novamente."
        );
      }
    }
  }

  function moveImage(index: number, direction: "up" | "down") {
    if (uploading || saving) return;
    const newImages = [...images];
    const newIndex = direction === "up" ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= newImages.length) return;
    [newImages[index], newImages[newIndex]] = [newImages[newIndex], newImages[index]];
    setImages(newImages);
  }

  async function uploadFiles(fileList: FileList | null) {
    if (!fileList || fileList.length === 0 || uploading) return;
    const available = PROPERTY_IMAGE_MAX_COUNT - images.length;
    if (fileList.length > available) {
      setImageError(`Adicione no máximo ${PROPERTY_IMAGE_MAX_COUNT} imagens.`);
      return;
    }
    const files = Array.from(fileList);
    if (files.length === 0) {
      setImageError(`Adicione no máximo ${PROPERTY_IMAGE_MAX_COUNT} imagens.`);
      return;
    }

    setUploading(true);
    setImageError("");
    try {
      for (const file of files) {
        if (!PROPERTY_IMAGE_CONTENT_TYPES.includes(file.type as (typeof PROPERTY_IMAGE_CONTENT_TYPES)[number])) {
          throw new Error("Use somente imagens JPEG, PNG ou WebP.");
        }
        if (file.size < 1 || file.size > PROPERTY_IMAGE_MAX_BYTES) {
          throw new Error("Cada imagem deve ter no máximo 10 MiB.");
        }

        const presign = await fetchWithTimeout(
          "/api/uploads/presign",
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              propertyId,
              contentType: file.type,
              size: file.size,
            }),
          },
          15_000
        );
        const presignData = (await presign.json().catch(() => null)) as
          | { uploadId?: string; uploadUrl?: string; headers?: Record<string, string>; error?: string }
          | null;
        if (!presign.ok || !presignData?.uploadId || !presignData.uploadUrl || !presignData.headers) {
          throw new Error(presignData?.error || "Não foi possível iniciar o upload.");
        }

        const uploadId = presignData.uploadId;
        const uploaded = await fetchWithTimeout(
          presignData.uploadUrl,
          {
            method: "PUT",
            headers: presignData.headers,
            body: file,
          },
          90_000
        );
        if (!uploaded.ok) {
          await fetchWithTimeout(
            `/api/uploads/${uploadId}`,
            { method: "DELETE" },
            10_000
          ).catch(() => undefined);
          throw new Error("O envio direto para o armazenamento falhou.");
        }

        const confirm = await fetchWithTimeout(
          "/api/uploads/confirm",
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ uploadId }),
          },
          30_000
        );
        const confirmData = (await confirm.json().catch(() => null)) as
          | { image?: { uploadId?: string; url?: string }; error?: string }
          | null;
        if (!confirm.ok || !confirmData?.image?.uploadId || !confirmData.image.url) {
          await fetchWithTimeout(
            `/api/uploads/${uploadId}`,
            { method: "DELETE" },
            10_000
          ).catch(() => undefined);
          throw new Error(confirmData?.error || "Não foi possível validar a imagem enviada.");
        }

        setImages((previous) => [
          ...previous,
          { uploadId: confirmData.image!.uploadId!, url: confirmData.image!.url! },
        ]);
      }
    } catch (caughtError) {
      setImageError(
        caughtError instanceof DOMException && caughtError.name === "AbortError"
          ? "O upload excedeu o tempo limite. Tente novamente."
          : caughtError instanceof Error
            ? caughtError.message
            : "Falha no upload."
      );
    } finally {
      setUploading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSaving(true);

    try {
      const invalidImage = images.find(
        (image) => !image.imageId && !image.uploadId && !isAllowedPropertyImageUrl(image.url)
      );
      if (invalidImage) {
        setError(`Todas as imagens devem usar URLs HTTPS de ${PROPERTY_IMAGE_HOSTNAME}.`);
        return;
      }

      const body = {
        title,
        description,
        price,
        city,
        neighborhood,
        address,
        type,
        purpose,
        bedrooms,
        bathrooms,
        area,
        whatsappPhone: whatsappPhone || null,
        featured,
        active,
        images: images.map((img) =>
          img.imageId
            ? { imageId: img.imageId }
            : img.uploadId
              ? { uploadId: img.uploadId }
              : { url: img.url }
        ),
      };

      const result = propertySchema.safeParse(body);
      if (!result.success) {
        setError(result.error.errors[0].message);
        setSaving(false);
        return;
      }

      const url = isEditing
        ? `/api/properties/${initialData.id}`
        : "/api/properties";

      const res = await fetchWithTimeout(
        url,
        {
          method: isEditing ? "PUT" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(
            isEditing ? { ...body, version: initialData.version } : { ...body, id: propertyId }
          ),
        },
        30_000
      );

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Erro ao salvar imóvel");
        return;
      }

      router.push("/admin");
      router.refresh();
    } catch {
      setError("Erro de conexão. Tente novamente.");
    } finally {
      setSaving(false);
    }
  }

  const inputStyle = {
    background: "var(--input-bg)",
    border: "1px solid var(--border)",
    color: "var(--text)",
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-8 max-w-3xl" aria-busy={saving || uploading}>
      {error && (
        <div role="alert" className="p-4 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 text-sm">
          {error}
        </div>
      )}

      {/* Basic Info */}
      <section
        className="rounded-xl p-6"
        style={{ background: "var(--card-bg)", border: "1px solid var(--card-border)", boxShadow: "var(--shadow-card)" }}
      >
        <h2 className="text-lg font-bold mb-5" style={{ color: "var(--text)" }}>
          Informações Básicas
        </h2>
        <div className="space-y-5">
          <div>
            <label htmlFor="title" className="block text-sm font-medium mb-2" style={{ color: "var(--text-secondary)" }}>
              Título *
            </label>
            <input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              maxLength={120}
              placeholder="Ex: Apartamento 2 quartos no Centro"
              className="w-full px-4 py-3 rounded-lg text-sm"
              style={inputStyle}
            />
          </div>

          <div>
            <label htmlFor="description" className="block text-sm font-medium mb-2" style={{ color: "var(--text-secondary)" }}>
              Descrição *
            </label>
            <textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              required
              maxLength={5000}
              rows={5}
              placeholder="Descreva o imóvel em detalhes..."
              className="w-full px-4 py-3 rounded-xl text-sm resize-y"
              style={inputStyle}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
            <div>
              <label htmlFor="type" className="block text-sm font-medium mb-2" style={{ color: "var(--text-secondary)" }}>
                Tipo *
              </label>
              <select
                id="type"
                value={type}
                onChange={(e) => setType(e.target.value)}
                className="w-full px-4 py-3 rounded-xl text-sm"
                style={inputStyle}
              >
                {propertyTypes.map((t) => (
                  <option key={t} value={t}>
                    {propertyTypeLabels[t]}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="purpose" className="block text-sm font-medium mb-2" style={{ color: "var(--text-secondary)" }}>
                Finalidade *
              </label>
              <select
                id="purpose"
                value={purpose}
                onChange={(e) => setPurpose(e.target.value)}
                className="w-full px-4 py-3 rounded-xl text-sm"
                style={inputStyle}
              >
                {propertyPurposes.map((p) => (
                  <option key={p} value={p}>
                    {propertyPurposeLabels[p]}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="price" className="block text-sm font-medium mb-2" style={{ color: "var(--text-secondary)" }}>
                Preço (R$) *
              </label>
              <input
                id="price"
                type="number"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                required
                min="0.01"
                max="1000000000"
                step="0.01"
                placeholder="350000"
                className="w-full px-4 py-3 rounded-xl text-sm"
                style={inputStyle}
              />
            </div>
          </div>

          <div className="sm:col-span-3">
            <label htmlFor="whatsappPhone" className="block text-sm font-medium mb-2" style={{ color: "var(--text-secondary)" }}>
              <span className="flex items-center gap-1.5">
                <Phone className="w-3.5 h-3.5 text-green-500" />
                Telefone WhatsApp do Corretor
              </span>
            </label>
            <input
              id="whatsappPhone"
              value={whatsappPhone}
              onChange={(e) => setWhatsappPhone(e.target.value)}
              inputMode="numeric"
              pattern="[0-9]{10,15}"
              maxLength={15}
              placeholder="DDI + DDD + número, somente dígitos"
              className="w-full px-4 py-3 rounded-xl text-sm"
              style={inputStyle}
            />
            <p className="mt-1.5 text-xs" style={{ color: "var(--text-muted)" }}>
              Número para onde o botão &quot;Falar no WhatsApp&quot; vai direcionar. Formato: 55 + DDD + número (sem espaços ou traços)
            </p>
          </div>
        </div>
      </section>

      {/* Location */}
      <section
        className="rounded-2xl p-6"
        style={{ background: "var(--card-bg)", border: "1px solid var(--card-border)" }}
      >
        <h2 className="text-lg font-semibold mb-5" style={{ color: "var(--text)" }}>
          Localização
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          <div>
            <label htmlFor="city" className="block text-sm font-medium mb-2" style={{ color: "var(--text-secondary)" }}>
              Cidade *
            </label>
            <input
              id="city"
              value={city}
              onChange={(e) => setCity(e.target.value)}
              required
              maxLength={100}
              placeholder="São Paulo"
              className="w-full px-4 py-3 rounded-xl text-sm"
              style={inputStyle}
            />
          </div>
          <div>
            <label htmlFor="neighborhood" className="block text-sm font-medium mb-2" style={{ color: "var(--text-secondary)" }}>
              Bairro *
            </label>
            <input
              id="neighborhood"
              value={neighborhood}
              onChange={(e) => setNeighborhood(e.target.value)}
              required
              maxLength={100}
              placeholder="Vila Mariana"
              className="w-full px-4 py-3 rounded-xl text-sm"
              style={inputStyle}
            />
          </div>
          <div className="sm:col-span-2">
            <label htmlFor="address" className="block text-sm font-medium mb-2" style={{ color: "var(--text-secondary)" }}>
              Endereço (opcional)
            </label>
            <input
              id="address"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              maxLength={300}
              placeholder="Rua das Flores, 123"
              className="w-full px-4 py-3 rounded-xl text-sm"
              style={inputStyle}
            />
          </div>
        </div>
      </section>

      {/* Details */}
      <section
        className="rounded-2xl p-6"
        style={{ background: "var(--card-bg)", border: "1px solid var(--card-border)" }}
      >
        <h2 className="text-lg font-semibold mb-5" style={{ color: "var(--text)" }}>
          Detalhes
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
          <div>
            <label htmlFor="bedrooms" className="block text-sm font-medium mb-2" style={{ color: "var(--text-secondary)" }}>
              Quartos
            </label>
            <input
              id="bedrooms"
              type="number"
              value={bedrooms}
              onChange={(e) => setBedrooms(e.target.value)}
              min="0"
              max="100"
              placeholder="3"
              className="w-full px-4 py-3 rounded-xl text-sm"
              style={inputStyle}
            />
          </div>
          <div>
            <label htmlFor="bathrooms" className="block text-sm font-medium mb-2" style={{ color: "var(--text-secondary)" }}>
              Banheiros
            </label>
            <input
              id="bathrooms"
              type="number"
              value={bathrooms}
              onChange={(e) => setBathrooms(e.target.value)}
              min="0"
              max="100"
              placeholder="2"
              className="w-full px-4 py-3 rounded-xl text-sm"
              style={inputStyle}
            />
          </div>
          <div>
            <label htmlFor="area" className="block text-sm font-medium mb-2" style={{ color: "var(--text-secondary)" }}>
              Área (m²)
            </label>
            <input
              id="area"
              type="number"
              value={area}
              onChange={(e) => setArea(e.target.value)}
              min="0.01"
              max="10000000"
              step="0.01"
              placeholder="120"
              className="w-full px-4 py-3 rounded-xl text-sm"
              style={inputStyle}
            />
          </div>
        </div>
      </section>

      {/* Images */}
      <section
        className="rounded-2xl p-6"
        style={{ background: "var(--card-bg)", border: "1px solid var(--card-border)" }}
      >
        <h2 className="text-lg font-semibold mb-5" style={{ color: "var(--text)" }}>
          Imagens
        </h2>

        <div className="mb-5">
          <label
            htmlFor="imageFiles"
            className="flex cursor-pointer items-center justify-center gap-2 rounded-xl px-4 py-4 text-sm font-semibold transition-colors"
            style={{ background: "var(--bg-secondary)", color: "var(--text-secondary)", border: "1px dashed var(--border)" }}
          >
            {uploading ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            ) : (
              <Upload className="h-4 w-4" aria-hidden="true" />
            )}
            {uploading ? "Enviando e validando imagem..." : "Enviar JPEG, PNG ou WebP para o R2"}
          </label>
          <input
            id="imageFiles"
            type="file"
            accept={PROPERTY_IMAGE_CONTENT_TYPES.join(",")}
            multiple
            disabled={saving || uploading || images.length >= PROPERTY_IMAGE_MAX_COUNT}
            className="sr-only"
            onChange={(event) => {
              void uploadFiles(event.currentTarget.files);
              event.currentTarget.value = "";
            }}
          />
          <p className="mt-2 text-xs" style={{ color: "var(--text-muted)" }}>
            Até 10 MiB por arquivo. O servidor confirma tamanho, tipo e assinatura antes de aceitar.
          </p>
        </div>

        {/* Legacy URL support keeps migrated/seed fixtures editable. */}
        <div className="mb-5">
          <div className="flex flex-col sm:flex-row gap-2">
            <label htmlFor="imageUrl" className="sr-only">
              URL HTTPS da imagem
            </label>
            <input
              id="imageUrl"
              type="url"
              disabled={saving || uploading}
              value={imageUrl}
              onChange={(e) => {
                setImageUrl(e.target.value);
                setImageError("");
              }}
              onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addImageByUrl())}
              placeholder={`https://${PROPERTY_IMAGE_HOSTNAME}/...`}
              maxLength={PROPERTY_IMAGE_MAX_URL_LENGTH}
              aria-describedby="image-url-help image-url-error"
              aria-invalid={Boolean(imageError)}
              className="flex-1 px-4 py-3 rounded-xl text-sm"
              style={inputStyle}
            />
            <button
              type="button"
              onClick={addImageByUrl}
              disabled={saving || uploading || images.length >= PROPERTY_IMAGE_MAX_COUNT}
              className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-medium transition-colors shrink-0"
              style={{ background: "var(--bg-secondary)", color: "var(--text-secondary)", border: "1px solid var(--border)" }}
            >
              <Plus className="w-4 h-4" />
              Adicionar URL
            </button>
          </div>
          <div id="image-url-help" className="mt-2 flex flex-wrap justify-between gap-2 text-xs" style={{ color: "var(--text-muted)" }}>
            <span>Alternativa legada: URL HTTPS de {PROPERTY_IMAGE_HOSTNAME}.</span>
            <span>{images.length}/{PROPERTY_IMAGE_MAX_COUNT} imagens</span>
          </div>
          {imageError && (
            <p id="image-url-error" role="alert" className="mt-2 text-sm text-red-600 dark:text-red-400">
              {imageError}
            </p>
          )}
        </div>

        {/* Image list */}
        {images.length === 0 ? (
          <div
            className="flex flex-col items-center justify-center py-16 rounded-xl"
            style={{ border: "2px dashed var(--border)" }}
          >
            <div className="w-14 h-14 rounded-xl bg-gray-100 dark:bg-gray-850 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
              <ImageIcon className="w-6 h-6 text-gray-500 dark:text-gray-400" />
            </div>
            <p className="text-sm font-medium mb-1" style={{ color: "var(--text)" }}>
              Nenhuma imagem adicionada
            </p>
            <p className="text-xs" style={{ color: "var(--text-muted)" }}>
              Envie um arquivo ou informe uma URL legada permitida
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            {images.map((img, index) => (
              <div key={`${img.url}-${index}`} className="relative group rounded-xl overflow-hidden aspect-[4/3]" style={{ border: "1px solid var(--border)" }}>
                {img.imageId || img.uploadId || isAllowedPropertyImageUrl(img.url) ? (
                  <Image
                    src={img.url}
                    alt={`Imagem ${index + 1}`}
                    fill
                    className="object-cover"
                    sizes="200px"
                  />
                ) : (
                  <div className="h-full p-4 flex items-center justify-center text-center text-xs text-red-600 dark:text-red-400">
                    URL incompatível. Remova esta imagem.
                  </div>
                )}
                 {index === 0 && (
                  <div className="absolute top-2 left-2 px-2 py-0.5 rounded text-white text-[10px] font-bold uppercase tracking-wider" style={{ background: "#0F172A" }}>
                    Principal
                  </div>
                )}
                <div className="absolute inset-0 flex items-center justify-center gap-1 bg-black/30 opacity-100 transition-colors sm:bg-black/0 sm:opacity-0 sm:group-hover:bg-black/30 sm:group-hover:opacity-100 sm:group-focus-within:bg-black/30 sm:group-focus-within:opacity-100">
                  <button
                    type="button"
                    onClick={() => moveImage(index, "up")}
                    disabled={saving || uploading || index === 0}
                    className="p-1.5 rounded-lg bg-white/90 text-gray-700 disabled:opacity-30 hover:bg-white transition-colors"
                    title="Mover para cima"
                    aria-label={`Mover imagem ${index + 1} para cima`}
                  >
                    <ArrowUp className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => moveImage(index, "down")}
                    disabled={saving || uploading || index === images.length - 1}
                    className="p-1.5 rounded-lg bg-white/90 text-gray-700 disabled:opacity-30 hover:bg-white transition-colors"
                    title="Mover para baixo"
                    aria-label={`Mover imagem ${index + 1} para baixo`}
                  >
                    <ArrowDown className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => removeImage(index)}
                    disabled={saving || uploading}
                    className="p-1.5 rounded-lg bg-red-500 text-white hover:bg-red-600 transition-colors"
                    title="Remover"
                    aria-label={`Remover imagem ${index + 1}`}
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Toggles */}
      <section
        className="rounded-xl p-6"
        style={{ background: "var(--card-bg)", border: "1px solid var(--card-border)", boxShadow: "var(--shadow-card)" }}
      >
        <h2 className="text-lg font-bold mb-5" style={{ color: "var(--text)" }}>
          Opções
        </h2>
        <div className="space-y-4">
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={active}
              onChange={(e) => setActive(e.target.checked)}
              className="w-5 h-5 rounded cursor-pointer"
              style={{ accentColor: "#0F172A" }}
            />
            <div>
              <span className="text-sm font-medium" style={{ color: "var(--text)" }}>Ativo</span>
              <p className="text-xs" style={{ color: "var(--text-muted)" }}>O imóvel será visível para visitantes</p>
            </div>
          </label>
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={featured}
              onChange={(e) => setFeatured(e.target.checked)}
              className="w-5 h-5 rounded cursor-pointer"
              style={{ accentColor: "#B45309" }}
            />
            <div>
              <span className="text-sm font-medium" style={{ color: "var(--text)" }}>Destaque</span>
              <p className="text-xs" style={{ color: "var(--text-muted)" }}>O imóvel aparecerá em destaque na página inicial</p>
            </div>
          </label>
        </div>
      </section>

      {/* Submit */}
      <div className="flex items-center justify-end gap-4">
        <button
          type="button"
          onClick={() => router.back()}
          disabled={saving || uploading}
          className="px-6 py-3 rounded-lg text-sm font-medium transition-all"
          style={{ color: "var(--text-secondary)", border: "1px solid var(--border)" }}
        >
          Cancelar
        </button>
        <button
          type="submit"
          disabled={saving || uploading}
          className="flex items-center gap-2 px-8 py-3 rounded-lg text-white font-semibold text-sm disabled:opacity-60 disabled:cursor-not-allowed transition-all hover:opacity-90"
          style={{ background: "#0F172A" }}
        >
          {saving ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Salvando...
            </>
          ) : isEditing ? (
            "Salvar Alterações"
          ) : (
            "Cadastrar Imóvel"
          )}
        </button>
      </div>
    </form>
  );
}
