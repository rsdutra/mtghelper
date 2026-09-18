/** F-007 — worker Tesseract.js local (eng+por). */

import { createWorker, type Worker } from "tesseract.js";

let worker: Worker | null = null;
let loading: Promise<Worker> | null = null;
let progressHandler: ((progress: number) => void) | null = null;

async function getWorker() {
  if (worker) return worker;
  if (!loading) {
    loading = createWorker("eng+por", 1, {
      logger: (message) => {
        if (message.status === "recognizing text" && typeof message.progress === "number") {
          progressHandler?.(message.progress);
        }
      },
    }).then((instance) => {
      worker = instance;
      return instance;
    });
  }
  return loading;
}

export async function recognizeTitle(
  image: Blob | HTMLCanvasElement | string,
  onProgress?: (progress: number) => void,
) {
  progressHandler = onProgress ?? null;
  const instance = await getWorker();
  onProgress?.(0);
  const result = await instance.recognize(image);
  onProgress?.(1);
  progressHandler = null;
  return result.data.text;
}

export async function terminateOcrWorker() {
  if (worker) {
    await worker.terminate();
    worker = null;
    loading = null;
  }
}
