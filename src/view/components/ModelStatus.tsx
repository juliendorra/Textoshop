import { Button, Card, CardBody, Chip, Progress, Select, SelectItem } from "@nextui-org/react";
import { useState } from "react";
import { FaBrain } from "react-icons/fa6";
import {
  MODEL_OPTIONS,
  getModelShortLabel,
  getSavedModelId,
  useLLMEngineStore,
} from "../../model/LLMEngine";

/**
 * Full-screen overlay shown when no model is loaded.
 * Lets the user select and load a model before using the editor.
 */
export function ModelLoadOverlay() {
  const [selectedModel, setSelectedModel] = useState<string>(getSavedModelId());
  const isLoading = useLLMEngineStore((s) => s.isLoading);
  const progress = useLLMEngineStore((s) => s.progress);
  const progressText = useLLMEngineStore((s) => s.progressText);
  const error = useLLMEngineStore((s) => s.error);
  const loadModel = useLLMEngineStore((s) => s.loadModel);

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 100000,
        background: "rgba(0,0,0,0.45)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        backdropFilter: "blur(4px)",
      }}
    >
      <Card style={{ maxWidth: 480, width: "90%" }}>
        <CardBody style={{ gap: 12 }}>
          <p style={{ fontWeight: 700, fontSize: 16 }}>
            <FaBrain style={{ display: "inline", marginRight: 6, verticalAlign: "-2px" }} />
            Load an AI model to continue
          </p>
          <p style={{ fontSize: 13, color: "#666" }}>
            Textoshop needs a local AI model to power its editing tools.
            The model runs entirely in your browser via WebGPU.
          </p>

          <div style={{ display: "flex", alignItems: "end", gap: 10 }}>
            <Select
              variant="faded"
              label="Model"
              size="sm"
              selectedKeys={[selectedModel]}
              isDisabled={isLoading}
              onChange={(e) => {
                if (e.target.value) setSelectedModel(e.target.value);
              }}
              className="max-w-xs"
            >
              {MODEL_OPTIONS.map((opt) => (
                <SelectItem key={opt.id} value={opt.id} textValue={opt.label}>
                  {opt.label} ({opt.size})
                </SelectItem>
              ))}
            </Select>
            <Button
              color="primary"
              size="sm"
              isLoading={isLoading}
              isDisabled={isLoading}
              onClick={() => loadModel(selectedModel)}
            >
              Load Model
            </Button>
          </div>

          {isLoading && (
            <div>
              <Progress value={progress * 100} color="primary" size="sm" />
              <p style={{ fontSize: 11, color: "#888", marginTop: 2 }}>
                {progressText}
              </p>
            </div>
          )}
          {error && (
            <p style={{ color: "red", fontSize: 12 }}>{error}</p>
          )}
        </CardBody>
      </Card>
    </div>
  );
}

/**
 * Small chip in the bottom-left showing the loaded model + click to switch.
 */
export function ModelStatusChip() {
  const [showPicker, setShowPicker] = useState(false);
  const [selectedModel, setSelectedModel] = useState<string>(getSavedModelId());
  const loadedModelId = useLLMEngineStore((s) => s.loadedModelId);
  const isLoading = useLLMEngineStore((s) => s.isLoading);
  const progress = useLLMEngineStore((s) => s.progress);
  const progressText = useLLMEngineStore((s) => s.progressText);
  const error = useLLMEngineStore((s) => s.error);
  const loadModel = useLLMEngineStore((s) => s.loadModel);

  const label = isLoading
    ? `Loading... ${Math.round(progress * 100)}%`
    : getModelShortLabel(loadedModelId);

  return (
    <div style={{ position: "fixed", bottom: 12, left: 12, zIndex: 9999 }}>
      {/* Picker popover */}
      {showPicker && (
        <Card
          style={{
            position: "absolute",
            bottom: 36,
            left: 0,
            width: 340,
            boxShadow: "0 4px 24px rgba(0,0,0,0.18)",
          }}
        >
          <CardBody style={{ gap: 8, padding: 12 }}>
            <p style={{ fontWeight: 600, fontSize: 13 }}>Switch model</p>
            <div style={{ display: "flex", alignItems: "end", gap: 8 }}>
              <Select
                variant="faded"
                size="sm"
                selectedKeys={[selectedModel]}
                isDisabled={isLoading}
                onChange={(e) => {
                  if (e.target.value) setSelectedModel(e.target.value);
                }}
                aria-label="Model selector"
              >
                {MODEL_OPTIONS.map((opt) => (
                  <SelectItem key={opt.id} value={opt.id} textValue={opt.label}>
                    {opt.label} ({opt.size})
                  </SelectItem>
                ))}
              </Select>
              <Button
                color="primary"
                size="sm"
                isLoading={isLoading}
                isDisabled={isLoading || loadedModelId === selectedModel}
                onClick={() => loadModel(selectedModel)}
              >
                {loadedModelId === selectedModel ? "Loaded" : "Load"}
              </Button>
            </div>
            {isLoading && (
              <div>
                <Progress value={progress * 100} color="primary" size="sm" />
                <p style={{ fontSize: 11, color: "#888", marginTop: 2 }}>
                  {progressText}
                </p>
              </div>
            )}
            {error && (
              <p style={{ color: "red", fontSize: 11 }}>{error}</p>
            )}
          </CardBody>
        </Card>
      )}

      {/* Chip trigger */}
      <Chip
        variant="flat"
        size="sm"
        style={{
          cursor: "pointer",
          opacity: 0.85,
          userSelect: "none",
        }}
        startContent={
          <FaBrain style={{ fontSize: 10, marginLeft: 4 }} />
        }
        onClick={() => setShowPicker((v) => !v)}
      >
        {label || "No model"}
      </Chip>
    </div>
  );
}
