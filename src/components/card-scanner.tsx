"use client";

import { useEffect, useRef, useState } from "react";
import { CardSearch, type Suggestion } from "@/components/card-search";
import { cleanOcrText } from "@/lib/ocr/clean";
import { cropTitleBand, loadImageFromFile } from "@/lib/ocr/crop";
import { recognizeTitle } from "@/lib/ocr/worker";

export type ScanConfirm = {
  name: string;
  quantity: number;
  set?: string;
  sectionId?: string;
};

type Section = { id: string; name: string };

type Props = {
  open: boolean;
  onClose: () => void;
  onConfirm: (payload: ScanConfirm) => Promise<void>;
  sections?: Section[];
  title?: string;
};

type Candidate = Suggestion;

export function CardScanner({
  open,
  onClose,
  onConfirm,
  sections = [],
  title = "Escanear carta",
}: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [cameraOn, setCameraOn] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [sourceImage, setSourceImage] = useState<HTMLImageElement | null>(null);
  const [ocrText, setOcrText] = useState("");
  const [progress, setProgress] = useState(0);
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState("");
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [selected, setSelected] = useState<Candidate | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [setCode, setSetCode] = useState("");
  const [sectionId, setSectionId] = useState("");
  const [saving, setSaving] = useState(false);
  const [manualMode, setManualMode] = useState(false);

  useEffect(() => {
    if (!open) stopCamera();
    return () => stopCamera();
  }, [open]);

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  function stopCamera() {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    setCameraOn(false);
    if (videoRef.current) videoRef.current.srcObject = null;
  }

  async function startCamera() {
    setError("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      });
      streamRef.current = stream;
      setCameraOn(true);
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
    } catch {
      setError("Não foi possível acessar a câmera. Use o upload ou permita o acesso.");
    }
  }

  function resetCapture() {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    setSourceImage(null);
    setOcrText("");
    setCandidates([]);
    setSelected(null);
    setProgress(0);
    setManualMode(false);
    setError("");
  }

  async function setCapturedImage(image: HTMLImageElement) {
    stopCamera();
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    const canvas = document.createElement("canvas");
    canvas.width = image.naturalWidth || image.width;
    canvas.height = image.naturalHeight || image.height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(image, 0, 0);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.92));
    if (!blob) return;
    setPreviewUrl(URL.createObjectURL(blob));
    setSourceImage(image);
    setOcrText("");
    setCandidates([]);
    setSelected(null);
    setManualMode(false);
  }

  async function captureFrame() {
    const video = videoRef.current;
    if (!video || !video.videoWidth) {
      setError("Aguarde a câmera carregar.");
      return;
    }
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, 0, 0);
    const frameBlob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.92));
    if (!frameBlob) {
      setError("Falha ao capturar o frame.");
      return;
    }
    const image = await loadImageFromFile(frameBlob);
    await setCapturedImage(image);
  }

  async function onUpload(file: File | null) {
    if (!file) return;
    setError("");
    try {
      const image = await loadImageFromFile(file);
      await setCapturedImage(image);
    } catch {
      setError("Arquivo de imagem inválido.");
    }
  }

  async function runOcr() {
    if (!sourceImage) return;
    setScanning(true);
    setError("");
    setProgress(0);
    setManualMode(false);
    try {
      const crop = await cropTitleBand(sourceImage);
      const raw = await recognizeTitle(crop, setProgress);
      const cleaned = cleanOcrText(raw);
      setOcrText(cleaned);

      if (cleaned.length < 2) {
        setError("Não li um título útil. Tente outra foto ou busque manualmente.");
        setManualMode(true);
        setCandidates([]);
        return;
      }

      if (cleaned.length < 4) {
        setError("Texto curto demais para autocomplete. Refine na busca manual.");
        setManualMode(true);
        setCandidates([]);
        return;
      }

      const response = await fetch(`/api/cards/suggest?q=${encodeURIComponent(cleaned)}`);
      const data = await response.json();
      const list = (data.suggestions ?? []) as Candidate[];
      setCandidates(list);
      setSelected(list[0] ?? null);
      if (!list.length) {
        setError("Nenhuma carta encontrada para esse título. Ajuste na busca manual.");
        setManualMode(true);
      }
    } catch {
      setError("Falha no OCR local. Tente de novo ou busque manualmente.");
      setManualMode(true);
    } finally {
      setScanning(false);
    }
  }

  async function submit() {
    const name = selected ? selected.namePt ?? selected.nameEn : ocrText.trim();
    if (!name) {
      setError("Escolha ou digite uma carta.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      await onConfirm({
        name,
        quantity: Math.max(1, quantity),
        set: setCode.trim() || undefined,
        sectionId: sectionId || undefined,
      });
      resetCapture();
      onClose();
    } catch {
      setError("Não foi possível adicionar a carta.");
    } finally {
      setSaving(false);
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 p-4">
      <div
        role="dialog"
        aria-label={title}
        className="flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden border border-black bg-white"
      >
        <header className="flex items-center justify-between border-b border-black px-4 py-3">
          <h2 className="text-lg font-semibold">{title}</h2>
          <button type="button" className="text-sm underline" onClick={onClose}>
            Fechar
          </button>
        </header>

        <div className="space-y-4 overflow-auto p-4">
          <p className="text-sm text-neutral-600">
            Alinhe o título da carta na faixa superior. Luz difusa ajuda — foil com reflexo atrapalha o OCR.
          </p>

          <div className="flex flex-wrap gap-2">
            <button type="button" className="h-10 border border-black px-3 text-sm" onClick={() => void startCamera()}>
              Usar câmera
            </button>
            <label className="h-10 cursor-pointer border border-black px-3 text-sm leading-10">
              Enviar imagem
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(event) => void onUpload(event.target.files?.[0] ?? null)}
              />
            </label>
            {cameraOn ? (
              <button type="button" className="h-10 bg-black px-3 text-sm text-white" onClick={() => void captureFrame()}>
                Capturar
              </button>
            ) : null}
            {previewUrl ? (
              <button type="button" className="h-10 border border-black px-3 text-sm" onClick={resetCapture}>
                Nova captura
              </button>
            ) : null}
          </div>

          <div className="relative overflow-hidden border border-black bg-neutral-100">
            <video
              ref={videoRef}
              className={cameraOn && !previewUrl ? "max-h-80 w-full object-contain" : "hidden"}
              muted
              playsInline
            />
            {cameraOn && !previewUrl ? (
              <>
                <div className="pointer-events-none absolute inset-x-[8%] top-[4%] h-[16%] border-2 border-black bg-black/10" />
                <span className="pointer-events-none absolute top-[4%] left-[8%] bg-black px-2 text-xs text-white">
                  Título
                </span>
              </>
            ) : null}
            {previewUrl ? (
              <>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={previewUrl} alt="Captura" className="max-h-80 w-full object-contain" />
                <div className="pointer-events-none absolute inset-x-[8%] top-[4%] h-[16%] border-2 border-black bg-black/10" />
              </>
            ) : null}
            {!cameraOn && !previewUrl ? (
              <div className="flex h-48 items-center justify-center text-sm text-neutral-500">
                Câmera ou upload para começar
              </div>
            ) : null}
          </div>

          {previewUrl ? (
            <button
              type="button"
              disabled={scanning}
              className="h-11 w-full bg-black text-sm text-white disabled:opacity-50"
              onClick={() => void runOcr()}
            >
              {scanning ? `Lendo título… ${Math.round(progress * 100)}%` : "Ler título (OCR local)"}
            </button>
          ) : null}

          {ocrText ? (
            <p className="text-sm">
              Texto lido: <span className="font-medium">{ocrText}</span>
            </p>
          ) : null}

          {candidates.length ? (
            <ul className="divide-y border border-black">
              {candidates.map((item) => (
                <li key={item.catalogId}>
                  <button
                    type="button"
                    className={`flex w-full items-center gap-3 px-3 py-2 text-left ${
                      selected?.catalogId === item.catalogId ? "bg-neutral-100" : "hover:bg-neutral-50"
                    }`}
                    onClick={() => setSelected(item)}
                  >
                    {item.imageSmall ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={item.imageSmall} alt="" className="h-10 w-7 object-cover" />
                    ) : (
                      <span className="h-10 w-7 border border-neutral-300" />
                    )}
                    <span>
                      <span className="block text-sm">{item.namePt ?? item.nameEn}</span>
                      <span className="block text-xs text-neutral-500">{item.nameEn}</span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          ) : null}

          {(manualMode || ocrText) && (
            <div className="space-y-2">
              <h3 className="text-xs font-medium tracking-wide uppercase">Busca manual</h3>
              <CardSearch
                key={ocrText}
                initialQuery={ocrText.length >= 4 ? ocrText : ""}
                onSelect={(item) => {
                  setSelected(item);
                  setManualMode(false);
                }}
              />
            </div>
          )}

          <div className="grid gap-3 sm:grid-cols-3">
            <label className="space-y-1 text-sm">
              <span>Quantidade</span>
              <input
                aria-label="Quantidade"
                type="number"
                min={1}
                value={quantity}
                onChange={(event) => setQuantity(Number(event.target.value) || 1)}
                className="h-11 w-full border border-black px-3"
              />
            </label>
            <label className="space-y-1 text-sm sm:col-span-2">
              <span>Set (vazio = mais recente)</span>
              <input
                aria-label="Set"
                value={setCode}
                onChange={(event) => setSetCode(event.target.value)}
                placeholder="ex. mh3"
                className="h-11 w-full border border-black px-3"
              />
            </label>
          </div>

          {sections.length ? (
            <label className="block space-y-1 text-sm">
              <span>Destino</span>
              <select
                aria-label="Destino do scan"
                value={sectionId}
                onChange={(event) => setSectionId(event.target.value)}
                className="h-11 w-full border border-black px-3"
              >
                <option value="">Deck principal</option>
                {sections.map((section) => (
                  <option key={section.id} value={section.id}>
                    Seção: {section.name}
                  </option>
                ))}
              </select>
            </label>
          ) : null}

          {error ? <p className="text-sm text-red-700">{error}</p> : null}
        </div>

        <footer className="flex justify-end gap-2 border-t border-black px-4 py-3">
          <button type="button" className="h-10 border border-black px-4 text-sm" onClick={onClose}>
            Cancelar
          </button>
          <button
            type="button"
            disabled={saving || (!selected && !ocrText)}
            className="h-10 bg-black px-4 text-sm text-white disabled:opacity-50"
            onClick={() => void submit()}
          >
            {saving ? "Adicionando…" : "Adicionar"}
          </button>
        </footer>
      </div>
    </div>
  );
}
