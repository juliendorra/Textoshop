import { Accordion, AccordionItem, Button, Card, CardBody, Chip } from "@nextui-org/react";
import { useState } from "react";
import { FaGraduationCap } from "react-icons/fa6";
import { IoClose } from "react-icons/io5";

interface TutorialStep {
  title: string;
  toolHint?: string;
  instructions: string;
}

const TUTORIAL_STEPS: TutorialStep[] = [
  {
    title: "Welcome to Textoshop",
    instructions:
      "Textoshop lets you edit text the way image editors let you edit photos — with AI-powered tools in a toolbar.\n\nSome toolbar slots contain multiple tool variants. You'll see a small arrow (▾) to the left of those tools — click it to reveal the other variants and switch between them. The keyboard shortcut always activates whichever variant is currently shown.\n\nClick through these steps to discover each tool. You can try them on the text in the editor as you go!",
  },
  {
    title: "Select",
    toolHint: "1",
    instructions:
      "The Select tool is the default cursor. Use it (key 1) to place the caret and select text by clicking and dragging.\n\nOnce text is selected, you get two handles:\n• Rotate (top-right corner): drag the rotation handle to reorganize the text — the AI reorders sentences and ideas. An arc with 5 levels appears; the further you drag, the more the text is rearranged.\n• Resize (right edge): drag the right edge to shorten or expand the text so it fits the target width. The AI rewrites sentences to match the new length.",
  },
  {
    title: "Drag & Drop (Boolean Ops)",
    instructions:
      "You can drag any text fragment and drop it onto another sentence. A menu appears with five boolean operations — inspired by vector graphics:\n\n• Insert: places the dragged text at the exact drop position.\n• Unite: merges both texts together, keeping all content from both.\n• Subtract: removes the idea expressed in the dragged text from the target sentence.\n• Exclude: removes overlapping content that appears in both texts.\n• Intersect: keeps only the elements that both texts have in common.\n\nTry dragging a sentence onto another one and experiment with each operation!",
  },
  {
    title: "Tone Brush",
    toolHint: "2",
    instructions:
      "The Tone Brush changes the tone of text. Select it (key 2), then click on a sentence.\n\nUse the Tone panel on the right to set the target tone — try moving the sliders between Informal/Formal, Polite/Impolite, or Simple/Complicated before clicking.",
  },
  {
    title: "Tone Picker",
    toolHint: "3",
    instructions:
      "The Tone Picker reads the tone of existing text — like an eyedropper for tone. Select it (key 3) and click on a sentence.\n\nThe tone sliders on the right will update to match that sentence's style. You can then use the Tone Brush to apply that tone elsewhere.",
  },
  {
    title: "Smudge",
    toolHint: "4",
    instructions:
      "The Smudge tool paraphrases text. Select it from the toolbar (key 4), then click on a sentence to rephrase it while keeping its meaning.\n\nTry it: click on any sentence and watch it get rewritten.",
  },
  {
    title: "Pluralizer / Singularizer",
    toolHint: "5",
    instructions:
      "This slot has two variants: the Pluralizer converts text to plural form, and the Singularizer does the reverse. Click the small arrow (▾) to switch between them.\n\nSelect the active variant (key 5) and click on a word or sentence. The surrounding text adjusts automatically to stay coherent.",
  },
  {
    title: "Tense Changers",
    toolHint: "6",
    instructions:
      "This slot has three variants: To Past Tense, To Present Tense, and To Future Tense. Click the small arrow (▾) to switch between them.\n\nSelect the active variant (key 6) and click on a sentence. The surrounding text adjusts automatically.",
  },
  {
    title: "Repair / Fix Grammar",
    toolHint: "7",
    instructions:
      "The Repair tool fixes spelling and grammar errors. Select it (key 7) and click on text that has mistakes.\n\nTry intentionally introducing a typo, then use the Repair tool to fix it.",
  },
  {
    title: "Eraser",
    toolHint: "8",
    instructions:
      "The Eraser removes text while keeping the surrounding sentences coherent. Select it (key 8) and click on a sentence to erase it.\n\nThe AI will adjust the remaining text so it still reads naturally.",
  },
  {
    title: "Prompt",
    toolHint: "9",
    instructions:
      "The Prompt tool lets you give custom instructions. Select it (key 9), click on a sentence, and type any transformation you want.\n\nExamples: \"make this more dramatic\", \"translate to French\", \"add more detail about the setting\".",
  },
  {
    title: "Layers",
    instructions:
      "Layers let you create template documents with interchangeable parts — like email templates where you swap sections depending on context.\n\nUse the Layer panel on the right to create layers, add sub-layers, and toggle visibility. Text linked to hidden layers disappears from the document.",
  },
  {
    title: "You're all set!",
    instructions:
      "You've seen all the main tools. Feel free to explore — combine tools, try different texts, and experiment with layers.\n\nYou can reopen this tutorial anytime from the graduation cap icon at the bottom.",
  },
];

const STORAGE_KEY = "textoshop-tutorial-dismissed";

function isTutorialDismissed(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === "true";
  } catch {
    return false;
  }
}

function setTutorialDismissed(v: boolean) {
  try {
    localStorage.setItem(STORAGE_KEY, v ? "true" : "false");
  } catch {}
}

export function GuidedTutorial() {
  const [dismissed, setDismissed] = useState(isTutorialDismissed());
  const [stepIndex, setStepIndex] = useState(0);

  if (dismissed) {
    return (
      <div style={{ position: "fixed", bottom: 12, left: 80, zIndex: 9999 }}>
        <Chip
          variant="flat"
          size="sm"
          style={{ cursor: "pointer", opacity: 0.85, userSelect: "none" }}
          startContent={<FaGraduationCap style={{ fontSize: 10, marginLeft: 4 }} />}
          onClick={() => {
            setDismissed(false);
            setTutorialDismissed(false);
            setStepIndex(0);
          }}
        >
          Tutorial
        </Chip>
      </div>
    );
  }

  const step = TUTORIAL_STEPS[stepIndex];
  const isFirst = stepIndex === 0;
  const isLast = stepIndex === TUTORIAL_STEPS.length - 1;

  return (
    <div style={{ position: "fixed", left: 80, bottom: 50, zIndex: 9999, userSelect: "none" }}>
      <Card style={{ width: 320, boxShadow: "0 4px 24px rgba(0,0,0,0.15)" }}>
        <CardBody style={{ padding: 0 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "8px 12px 0 12px",
            }}
          >
            <span style={{ fontSize: 11, color: "#888" }}>
              Step {stepIndex + 1} / {TUTORIAL_STEPS.length}
            </span>
            <Button
              isIconOnly
              size="sm"
              variant="light"
              style={{ minWidth: 20, width: 20, height: 20 }}
              onClick={() => {
                setDismissed(true);
                setTutorialDismissed(true);
              }}
            >
              <IoClose style={{ fontSize: 14 }} />
            </Button>
          </div>
          <Accordion isCompact defaultExpandedKeys={["1"]}>
            <AccordionItem
              key="1"
              aria-label="Tutorial step"
              title={
                <span style={{ fontWeight: 600, fontSize: 13 }}>
                  {step.title}
                  {step.toolHint && (
                    <span style={{ color: "#888", fontWeight: 400, marginLeft: 6, fontSize: 11 }}>
                      Key {step.toolHint}
                    </span>
                  )}
                </span>
              }
              style={{ whiteSpace: "pre-wrap", padding: "0 4px" }}
            >
              <p style={{ fontSize: 13, lineHeight: 1.5, color: "#333", margin: 0 }}>
                {step.instructions}
              </p>
            </AccordionItem>
          </Accordion>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              padding: "4px 12px 10px 12px",
              gap: 8,
            }}
          >
            <Button
              size="sm"
              variant="light"
              isDisabled={isFirst}
              onClick={() => setStepIndex(stepIndex - 1)}
            >
              Back
            </Button>
            {isLast ? (
              <Button
                size="sm"
                color="primary"
                onClick={() => {
                  setDismissed(true);
                  setTutorialDismissed(true);
                }}
              >
                Done
              </Button>
            ) : (
              <Button
                size="sm"
                color="primary"
                onClick={() => setStepIndex(stepIndex + 1)}
              >
                Next
              </Button>
            )}
          </div>
        </CardBody>
      </Card>
    </div>
  );
}
