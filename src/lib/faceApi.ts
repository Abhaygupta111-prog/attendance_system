/**
 * Client-side face recognition utility using @vladmandic/face-api.
 * Runs 100% in the browser — no API key, no external service.
 *
 * Model weights served from /public/models (local, bundled with app).
 * Uses the modern .bin format — complete files, no truncation issues.
 */

// Served from public/models/ — matches the .bin format used by @vladmandic/face-api
const MODEL_URL = '/models';

let _faceapi: typeof import('@vladmandic/face-api') | null = null;
let _modelsLoaded = false;

/** Dynamically import face-api (browser only) and load neural-net models. */
export async function loadFaceModels(): Promise<typeof import('@vladmandic/face-api')> {
  if (_faceapi && _modelsLoaded) return _faceapi;

  if (typeof window === 'undefined') {
    throw new Error('face-api must run in the browser.');
  }

  _faceapi = await import('@vladmandic/face-api');

  if (!_modelsLoaded) {
    await Promise.all([
      _faceapi.nets.ssdMobilenetv1.loadFromUri(MODEL_URL),
      _faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
      _faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
    ]);
    _modelsLoaded = true;
  }

  return _faceapi;
}

/**
 * Extract a 128-dimensional face descriptor from a live video element.
 * Returns null if no face is detected.
 */
export async function getDescriptorFromVideo(
  video: HTMLVideoElement
): Promise<Float32Array | null> {
  const api = await loadFaceModels();
  const result = await api
    .detectSingleFace(video, new api.SsdMobilenetv1Options({ minConfidence: 0.5 }))
    .withFaceLandmarks()
    .withFaceDescriptor();
  return result?.descriptor ?? null;
}

/**
 * Extract a 128-dimensional face descriptor from a base64 image data URI.
 * Returns null if no face is detected.
 */
export async function getDescriptorFromDataUri(
  dataUri: string
): Promise<Float32Array | null> {
  const api = await loadFaceModels();
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = async () => {
      const result = await api
        .detectSingleFace(img, new api.SsdMobilenetv1Options({ minConfidence: 0.5 }))
        .withFaceLandmarks()
        .withFaceDescriptor();
      resolve(result?.descriptor ?? null);
    };
    img.onerror = () => resolve(null);
    img.src = dataUri;
  });
}

/**
 * Euclidean distance between two 128-d descriptors.
 *   < 0.5  → very likely same person
 *   < 0.6  → probably same person  (standard face-api.js threshold)
 *   > 0.6  → likely different people
 */
export function faceDistance(
  a: number[] | Float32Array,
  b: number[] | Float32Array
): number {
  let sum = 0;
  for (let i = 0; i < 128; i++) {
    const d = a[i] - b[i];
    sum += d * d;
  }
  return Math.sqrt(sum);
}

/** Threshold below which two faces are considered the same person. */
export const FACE_MATCH_THRESHOLD = 0.55;
