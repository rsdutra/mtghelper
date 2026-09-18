/** F-007 — crop da faixa do título (~topo da carta). */

const TITLE_TOP = 0.04;
const TITLE_HEIGHT = 0.16;
const SIDE_INSET = 0.08;

type Source = HTMLImageElement | HTMLCanvasElement | HTMLVideoElement;

function sourceSize(source: Source) {
  if (source instanceof HTMLVideoElement) {
    return { width: source.videoWidth, height: source.videoHeight };
  }
  if (source instanceof HTMLCanvasElement) {
    return { width: source.width, height: source.height };
  }
  return {
    width: source.naturalWidth || source.width,
    height: source.naturalHeight || source.height,
  };
}

export async function cropTitleBand(source: Source): Promise<Blob> {
  const { width, height } = sourceSize(source);
  if (!width || !height) {
    throw new Error("Imagem inválida para crop.");
  }

  const sx = Math.floor(width * SIDE_INSET);
  const sy = Math.floor(height * TITLE_TOP);
  const sw = Math.floor(width * (1 - SIDE_INSET * 2));
  const sh = Math.floor(height * TITLE_HEIGHT);

  const canvas = document.createElement("canvas");
  canvas.width = Math.max(sw, 1);
  canvas.height = Math.max(sh, 1);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas não disponível.");

  ctx.drawImage(source, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) reject(new Error("Falha ao gerar crop."));
        else resolve(blob);
      },
      "image/png",
      1,
    );
  });
}

export async function loadImageFromFile(file: Blob): Promise<HTMLImageElement> {
  const url = URL.createObjectURL(file);
  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error("Não foi possível ler a imagem."));
      img.src = url;
    });
    return image;
  } finally {
    URL.revokeObjectURL(url);
  }
}
