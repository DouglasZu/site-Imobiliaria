"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import {
  Loader2,
  Upload,
  X,
  ArrowUp,
  ArrowDown,
  ImageIcon,
  Phone,
} from "lucide-react";
import { propertyTypeLabels, propertyTypes, propertyPurposeLabels, propertyPurposes } from "@/lib/utils";

interface PropertyFormProps {
  initialData?: {
    id: string;
    title: string;
    description: string;
    price: number;
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
    images: { id: string; url: string; publicId: string }[];
  };
}

interface ImageItem {
  url: string;
  publicId: string;
  preview?: string;
}

export default function PropertyForm({ initialData }: PropertyFormProps) {
  const router = useRouter();
  const isEditing = !!initialData;

  const [saving, setSaving] = useState(false);
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
      publicId: img.publicId || "",
    })) || []
  );

  const [imageUrl, setImageUrl] = useState("");

  function addImageByUrl() {
    if (!imageUrl.trim()) return;
    setImages((prev) => [...prev, { url: imageUrl.trim(), publicId: "" }]);
    setImageUrl("");
  }

  function removeImage(index: number) {
    setImages((prev) => prev.filter((_, i) => i !== index));
  }

  function moveImage(index: number, direction: "up" | "down") {
    const newImages = [...images];
    const newIndex = direction === "up" ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= newImages.length) return;
    [newImages[index], newImages[newIndex]] = [newImages[newIndex], newImages[index]];
    setImages(newImages);
  }

  function compressImage(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = (event) => {
        const img = new window.Image();
        img.src = event.target?.result as string;
        img.onload = () => {
          const canvas = document.createElement("canvas");
          const MAX_WIDTH = 1200;
          const MAX_HEIGHT = 1200;
          let width = img.width;
          let height = img.height;

          if (width > height) {
            if (width > MAX_WIDTH) {
              height *= MAX_WIDTH / width;
              width = MAX_WIDTH;
            }
          } else {
            if (height > MAX_HEIGHT) {
              width *= MAX_HEIGHT / height;
              height = MAX_HEIGHT;
            }
          }

          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext("2d");
          ctx?.drawImage(img, 0, 0, width, height);
          resolve(canvas.toDataURL("image/jpeg", 0.7));
        };
        img.onerror = (err) => reject(err);
      };
      reader.onerror = (err) => reject(err);
    });
  }

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const newImages: ImageItem[] = [];
    
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      try {
        const compressedBase64 = await compressImage(file);
        newImages.push({ url: compressedBase64, publicId: "" });
      } catch (err) {
        console.error("Erro ao processar imagem", err);
      }
    }
    
    setImages((prev) => [...prev, ...newImages]);
    e.target.value = '';
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSaving(true);

    try {
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
        images: images.map((img) => ({ url: img.url, publicId: img.publicId })),
      };

      const url = isEditing
        ? `/api/properties/${initialData.id}`
        : "/api/properties";

      const res = await fetch(url, {
        method: isEditing ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

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
    <form onSubmit={handleSubmit} className="space-y-8 max-w-3xl">
      {error && (
        <div className="p-4 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 text-sm">
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
                min="0"
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
              placeholder="5511999999999 (código do país + DDD + número)"
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
              min="0"
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

        {/* Add Actions */}
        <div className="flex flex-col sm:flex-row gap-3 mb-5">
          <label className="flex items-center justify-center gap-2 px-6 py-3 rounded-lg text-white text-sm font-medium transition-all cursor-pointer hover:opacity-90 shrink-0" style={{ background: "#0F172A" }}>
            <ImageIcon className="w-4 h-4" />
            Fazer Upload de Fotos
            <input 
              type="file" 
              accept="image/*" 
              multiple 
              className="hidden" 
              onChange={handleFileUpload} 
            />
          </label>
          
          <div className="flex flex-1 gap-2">
            <input
              value={imageUrl}
              onChange={(e) => setImageUrl(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addImageByUrl())}
              placeholder="Ou cole uma URL..."
              className="flex-1 px-4 py-3 rounded-xl text-sm"
              style={inputStyle}
            />
            <button
              type="button"
              onClick={addImageByUrl}
              className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-medium transition-colors shrink-0"
              style={{ background: "var(--bg-secondary)", color: "var(--text-secondary)", border: "1px solid var(--border)" }}
            >
              <Upload className="w-4 h-4" />
              Adicionar URL
            </button>
          </div>
        </div>

        {/* Image list */}
        {images.length === 0 ? (
          <label
            className="flex flex-col items-center justify-center py-16 rounded-xl cursor-pointer hover:bg-black/5 dark:hover:bg-white/5 transition-colors group"
            style={{ border: "2px dashed var(--border)" }}
          >
            <div className="w-14 h-14 rounded-xl bg-gray-100 dark:bg-gray-850 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
              <Upload className="w-6 h-6 text-gray-500 dark:text-gray-400" />
            </div>
            <p className="text-sm font-medium mb-1" style={{ color: "var(--text)" }}>
              Clique para selecionar as fotos
            </p>
            <p className="text-xs" style={{ color: "var(--text-muted)" }}>
              Ou arraste os arquivos para cá
            </p>
            <input 
              type="file" 
              accept="image/*" 
              multiple 
              className="hidden" 
              onChange={handleFileUpload} 
            />
          </label>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            {images.map((img, index) => (
              <div key={index} className="relative group rounded-xl overflow-hidden aspect-[4/3]" style={{ border: "1px solid var(--border)" }}>
                <Image
                  src={img.url}
                  alt={`Imagem ${index + 1}`}
                  fill
                  className="object-cover"
                  sizes="200px"
                />
                 {index === 0 && (
                  <div className="absolute top-2 left-2 px-2 py-0.5 rounded text-white text-[10px] font-bold uppercase tracking-wider" style={{ background: "#0F172A" }}>
                    Principal
                  </div>
                )}
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center gap-1 opacity-0 group-hover:opacity-100">
                  <button
                    type="button"
                    onClick={() => moveImage(index, "up")}
                    disabled={index === 0}
                    className="p-1.5 rounded-lg bg-white/90 text-gray-700 disabled:opacity-30 hover:bg-white transition-colors"
                    title="Mover para cima"
                  >
                    <ArrowUp className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => moveImage(index, "down")}
                    disabled={index === images.length - 1}
                    className="p-1.5 rounded-lg bg-white/90 text-gray-700 disabled:opacity-30 hover:bg-white transition-colors"
                    title="Mover para baixo"
                  >
                    <ArrowDown className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => removeImage(index)}
                    className="p-1.5 rounded-lg bg-red-500 text-white hover:bg-red-600 transition-colors"
                    title="Remover"
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
          className="px-6 py-3 rounded-lg text-sm font-medium transition-all"
          style={{ color: "var(--text-secondary)", border: "1px solid var(--border)" }}
        >
          Cancelar
        </button>
        <button
          type="submit"
          disabled={saving}
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
