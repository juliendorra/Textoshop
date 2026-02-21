import { CreateMLCEngine, type MLCEngine } from "@mlc-ai/web-llm";

let engine: MLCEngine | null = null;
let modelId: string | null = null;

function classifyLoadError(err: any): string {
  const msg = (err.message || err.toString()).toLowerCase();
  const name = (err.name || "").toLowerCase();
  if (
    name === "quotaexceedederror" ||
    msg.includes("quota") ||
    msg.includes("no space") ||
    msg.includes("storage full") ||
    msg.includes("enospc") ||
    msg.includes("disk full")
  ) {
    return "storage";
  }
  if (msg.includes("cache") && (msg.includes("write") || msg.includes("put"))) {
    return "cache-write";
  }
  if (msg.includes("out of memory") || msg.includes("oom") || msg.includes("allocation failed")) {
    return "memory";
  }
  if (msg.includes("device lost") || msg.includes("gpu") || msg.includes("webgpu")) {
    return "gpu";
  }
  if (msg.includes("networkerror") || msg.includes("fetch") || msg.includes("failed to fetch")) {
    return "network";
  }
  if (msg.includes("webgpu is not supported") || msg.includes("navigator.gpu")) {
    return "unsupported";
  }
  return "unknown";
}

function userFriendlyErrorMessage(errorClass: string, err: any): string {
  switch (errorClass) {
    case "storage":
      return "Not enough disk space to store the model. Free up space on your device and try again.";
    case "cache-write":
      return "Failed to write model files to cache. Your disk may be full or browser storage is under pressure.";
    case "memory":
      return "Not enough RAM to load this model. Close other tabs or try a smaller model.";
    case "gpu":
      return "GPU device lost — your GPU may not have enough memory. Try a smaller model.";
    case "network":
      return "Network error — check your internet connection and try again.";
    case "unsupported":
      return "WebGPU is not supported by your browser. Use Chrome 113+ or Edge 113+.";
    default:
      return "Error: " + (err?.message || "Unknown error");
  }
}

async function clearWebLLMCaches(aggressive: boolean) {
  try {
    const names = await caches.keys();
    for (const name of names) {
      const lower = name.toLowerCase();
      const isWebLLM = lower.includes("webllm") || lower.includes("mlc");
      if (isWebLLM || aggressive) {
        await caches.delete(name);
      }
    }
  } catch (e) {
    console.warn("Cache clear failed:", e);
  }
}

async function loadModel(id: string) {
  self.postMessage({ type: "MODEL_STATUS", text: `Loading ${id}...`, progress: 0 });

  try {
    engine = await CreateMLCEngine(id, {
      initProgressCallback: (progress) => {
        const pct = progress.progress || 0;
        self.postMessage({
          type: "MODEL_STATUS",
          text: progress.text || `Loading ${id}... ${Math.round(pct * 100)}%`,
          progress: pct,
        });
      },
    });
    modelId = id;
    self.postMessage({ type: "MODEL_LOADED", modelId: id });
  } catch (err: any) {
    const errorClass = classifyLoadError(err);
    const isStorageIssue = ["storage", "cache-write", "memory", "gpu"].includes(errorClass);

    if (isStorageIssue) {
      // Try clearing caches and retrying once
      self.postMessage({ type: "MODEL_STATUS", text: "Storage issue. Clearing caches and retrying...", progress: 0 });
      await clearWebLLMCaches(true);

      try {
        engine = await CreateMLCEngine(id, {
          initProgressCallback: (progress) => {
            const pct = progress.progress || 0;
            self.postMessage({
              type: "MODEL_STATUS",
              text: progress.text || `Retrying ${id}... ${Math.round(pct * 100)}%`,
              progress: pct,
            });
          },
        });
        modelId = id;
        self.postMessage({ type: "MODEL_LOADED", modelId: id });
        return;
      } catch (retryErr: any) {
        // Fall through to error
        err = retryErr;
      }
    }

    const finalClass = classifyLoadError(err);
    self.postMessage({
      type: "MODEL_ERROR",
      error: userFriendlyErrorMessage(finalClass, err),
      errorClass: finalClass,
    });
  }
}

self.onmessage = async (event: MessageEvent) => {
  const { type, ...payload } = event.data;

  if (type === "LOAD_MODEL") {
    await loadModel(payload.modelId);
  } else if (type === "GENERATE") {
    if (!engine) {
      self.postMessage({
        type: "GENERATE_ERROR",
        requestId: payload.requestId,
        error: "Model not loaded",
      });
      return;
    }

    try {
      // Note: We intentionally omit response_format here.
      // WebLLM's json_object mode requires a compiled JSON schema string,
      // but the prompts already instruct the model to output JSON directly.
      // Passing { type: "json_object" } without a schema causes a
      // "Cannot pass non-string to std::string" BindingError.

      // When JSON is expected, prepend a system message to improve reliability
      // with small models that tend to add commentary around JSON.
      let messages = payload.messages;
      if (payload.json) {
        messages = [
          {
            role: "system",
            content:
              "You are a helpful assistant. When asked to respond with JSON, output ONLY valid JSON with no extra text, no markdown fences, and no commentary.",
          },
          ...payload.messages,
        ];
      }

      const response = await engine.chat.completions.create({
        messages,
        temperature: payload.temperature ?? 0,
        stream: false,
      });
      const text = response.choices[0]?.message?.content || "";
      self.postMessage({
        type: "GENERATE_RESULT",
        requestId: payload.requestId,
        result: text,
      });
    } catch (err: any) {
      self.postMessage({
        type: "GENERATE_ERROR",
        requestId: payload.requestId,
        error: err.message || "Generation failed",
      });
    }
  }
};
