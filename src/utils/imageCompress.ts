// Comprime e redimensiona uma imagem no navegador antes de salvar. A foto é guardada
// como base64 diretamente no documento do Firestore (sem Firebase Storage e sem Google
// Drive — assim funciona 100% no plano gratuito). Um documento do Firestore tem limite
// de 1 MiB no total, então aqui garantimos ativamente que o resultado final fique bem
// abaixo disso, reduzindo qualidade/tamanho progressivamente até caber.

export interface CompressedImage {
  blob: Blob;
  dataUrl: string;
  width: number;
  height: number;
}

const INITIAL_MAX_DIMENSION = 1280; // px, no lado maior
const MIN_MAX_DIMENSION = 480; // não vale a pena reduzir além disso
const INITIAL_JPEG_QUALITY = 0.75;
const MIN_JPEG_QUALITY = 0.4;
export const MAX_ORIGINAL_FILE_SIZE = 15 * 1024 * 1024; // 15MB antes de tentar comprimir

// Alvo final: bem abaixo de 1 MiB (limite de documento do Firestore), deixando espaço
// de sobra para os outros campos do relatório e para a codificação base64 (~33% maior
// que o binário).
const TARGET_MAX_BLOB_BYTES = 550 * 1024; // ~550KB binário → ~730KB em base64

function drawToCanvas(img: HTMLImageElement, maxDimension: number): HTMLCanvasElement {
  let { width, height } = img;
  if (width > maxDimension || height > maxDimension) {
    if (width >= height) {
      height = Math.round((height / width) * maxDimension);
      width = maxDimension;
    } else {
      width = Math.round((width / height) * maxDimension);
      height = maxDimension;
    }
  }

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Não foi possível processar a imagem neste navegador.');
  }
  // Fundo branco evita fundo preto em PNGs com transparência ao converter para JPEG
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, width, height);
  ctx.drawImage(img, 0, 0, width, height);
  return canvas;
}

function canvasToBlob(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error('Falha ao comprimir a imagem.'));
          return;
        }
        resolve(blob);
      },
      'image/jpeg',
      quality
    );
  });
}

// Lê um arquivo de imagem escolhido pelo usuário, redimensiona e reexporta como JPEG,
// reduzindo qualidade/dimensão progressivamente até o resultado ficar dentro do alvo
// de tamanho — garantindo que caiba com folga em um documento do Firestore.
export async function compressImageFile(file: File): Promise<CompressedImage> {
  if (!file.type.startsWith('image/')) {
    throw new Error('O arquivo selecionado não é uma imagem.');
  }
  if (file.size > MAX_ORIGINAL_FILE_SIZE) {
    throw new Error('A imagem é muito grande (máximo 15MB).');
  }

  const dataUrlOriginal = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Não foi possível ler o arquivo de imagem.'));
    reader.onload = () => resolve(reader.result as string);
    reader.readAsDataURL(file);
  });

  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const el = new Image();
    el.onerror = () => reject(new Error('Não foi possível carregar a imagem selecionada.'));
    el.onload = () => resolve(el);
    el.src = dataUrlOriginal;
  });

  let maxDimension = INITIAL_MAX_DIMENSION;
  let quality = INITIAL_JPEG_QUALITY;
  let lastBlob: Blob | null = null;
  let lastCanvas: HTMLCanvasElement | null = null;

  // Até 6 tentativas: reduz a qualidade primeiro, depois a dimensão, até caber no alvo.
  for (let attempt = 0; attempt < 6; attempt++) {
    const canvas = drawToCanvas(img, maxDimension);
    const blob = await canvasToBlob(canvas, quality);
    lastBlob = blob;
    lastCanvas = canvas;

    if (blob.size <= TARGET_MAX_BLOB_BYTES) break;

    if (quality > MIN_JPEG_QUALITY) {
      quality = Math.max(MIN_JPEG_QUALITY, quality - 0.15);
    } else if (maxDimension > MIN_MAX_DIMENSION) {
      maxDimension = Math.max(MIN_MAX_DIMENSION, Math.round(maxDimension * 0.75));
    } else {
      break; // já no mínimo de qualidade e dimensão; usa o que conseguiu
    }
  }

  if (!lastBlob || !lastCanvas) {
    throw new Error('Falha ao comprimir a imagem.');
  }

  if (lastBlob.size > TARGET_MAX_BLOB_BYTES * 1.5) {
    // Mesmo após todas as tentativas, ficou grande demais para salvar com segurança.
    throw new Error('Esta foto tem muitos detalhes e não coube no limite de tamanho mesmo após compressão. Tente uma foto mais simples ou tire uma nova foto com menos resolução.');
  }

  const dataUrl = lastCanvas.toDataURL('image/jpeg', quality);
  return { blob: lastBlob, dataUrl, width: lastCanvas.width, height: lastCanvas.height };
}
