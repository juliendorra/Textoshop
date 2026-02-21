import { create } from "zustand";

export const MODEL_OPTIONS = [
  {
    id: "Qwen2.5-0.5B-Instruct-q4f16_1-MLC",
    label: "Very Small (0.5B) — Fastest",
    size: "~350 MB",
  },
  {
    id: "Qwen2.5-1.5B-Instruct-q4f16_1-MLC",
    label: "Small (1.5B) — Balanced",
    size: "~1 GB",
  },
  {
    id: "Phi-3.5-mini-instruct-q4f16_1-MLC",
    label: "Medium (3.8B) — Best Quality",
    size: "~2 GB",
  },
] as const;

export const DEFAULT_MODEL = MODEL_OPTIONS[0].id;

const STORAGE_KEY = "textoshop-last-model";

export function getSavedModelId(): string {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved && MODEL_OPTIONS.some((m) => m.id === saved)) return saved;
  } catch {}
  return DEFAULT_MODEL;
}

function saveModelId(modelId: string) {
  try {
    localStorage.setItem(STORAGE_KEY, modelId);
  } catch {}
}

/** Short display label for the loaded model (e.g. "0.5B") */
export function getModelShortLabel(modelId: string | null): string {
  if (!modelId) return "";
  const opt = MODEL_OPTIONS.find((m) => m.id === modelId);
  return opt ? opt.label.split("—")[0].trim() : modelId;
}

// ── Worker singleton ──────────────────────────────────────────────
let worker: Worker | null = null;
let requestCounter = 0;
const pendingRequests = new Map<
  number,
  { resolve: (value: string) => void; reject: (reason: any) => void }
>();

function getWorker(): Worker {
  if (!worker) {
    worker = new Worker(new URL("./llm-worker.ts", import.meta.url), {
      type: "module",
    });
    worker.onmessage = (event: MessageEvent) => {
      const { type, ...payload } = event.data;

      if (type === "MODEL_STATUS") {
        useLLMEngineStore.setState({
          progress: payload.progress ?? 0,
          progressText: payload.text ?? "",
        });
      } else if (type === "MODEL_LOADED") {
        saveModelId(payload.modelId);
        useLLMEngineStore.setState({
          loadedModelId: payload.modelId,
          isLoading: false,
          progress: 1,
          progressText: "Model loaded",
        });
      } else if (type === "MODEL_ERROR") {
        useLLMEngineStore.setState({
          isLoading: false,
          error: payload.error || "Failed to load model",
          progress: 0,
          progressText: "",
        });
      } else if (type === "GENERATE_RESULT") {
        const pending = pendingRequests.get(payload.requestId);
        if (pending) {
          pending.resolve(payload.result);
          pendingRequests.delete(payload.requestId);
        }
      } else if (type === "GENERATE_ERROR") {
        const pending = pendingRequests.get(payload.requestId);
        if (pending) {
          pending.reject(new Error(payload.error));
          pendingRequests.delete(payload.requestId);
        }
      }
    };
  }
  return worker;
}

// ── Zustand store ─────────────────────────────────────────────────
interface LLMEngineState {
  loadedModelId: string | null;
  isLoading: boolean;
  progress: number;
  progressText: string;
  error: string | null;
  loadModel: (modelId: string) => void;
}

export const useLLMEngineStore = create<LLMEngineState>((set, get) => ({
  loadedModelId: null,
  isLoading: false,
  progress: 0,
  progressText: "",
  error: null,

  loadModel: (modelId: string) => {
    const state = get();
    if (state.loadedModelId === modelId && !state.isLoading) {
      return; // Already loaded
    }

    set({
      isLoading: true,
      progress: 0,
      progressText: "Initializing...",
      error: null,
      loadedModelId: null,
    });

    getWorker().postMessage({ type: "LOAD_MODEL", modelId });
  },
}));

// ── Engine proxy ──────────────────────────────────────────────────
// Exposes an OpenAI-compatible interface that proxies to the worker.

interface GenerateOptions {
  messages: Array<{ role: string; content: string }>;
  stream?: boolean;
  temperature?: number;
  response_format?: { type: string };
  json?: boolean;
}

/**
 * Minimal OpenAI-compatible engine proxy that sends generation requests
 * to the web worker and returns a Promise with the result.
 *
 * Streaming note: the worker runs generation non-streaming for simplicity.
 * The `stream: true` option is accepted but the result is returned as a
 * single-chunk async iterable so existing call sites work unchanged.
 */
const engineProxy = {
  chat: {
    completions: {
      create: async (options: GenerateOptions) => {
        const w = getWorker();
        const requestId = ++requestCounter;

        const resultPromise = new Promise<string>((resolve, reject) => {
          pendingRequests.set(requestId, { resolve, reject });
        });

        w.postMessage({
          type: "GENERATE",
          requestId,
          messages: options.messages,
          temperature: options.temperature,
          json: !!(options.response_format?.type === "json_object"),
        });

        const resultText = await resultPromise;

        if (options.stream) {
          // Return an async iterable with a single chunk so `for await` works
          return (async function* () {
            yield {
              choices: [{ delta: { content: resultText } }],
            };
          })();
        }

        // Non-streaming: return OpenAI-style response
        return {
          choices: [
            {
              message: { role: "assistant" as const, content: resultText },
            },
          ],
        };
      },
    },
  },
};

/**
 * Get the engine proxy. Throws if no model is loaded yet.
 */
export function getEngine(): typeof engineProxy {
  const { loadedModelId, isLoading } = useLLMEngineStore.getState();
  if (!loadedModelId || isLoading) {
    throw new Error(
      "No model loaded. Please load a model from the launcher first."
    );
  }
  return engineProxy;
}
