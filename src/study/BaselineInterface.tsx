import { Button, Textarea } from "@nextui-org/react";
import React, { useEffect, useMemo, useState } from "react";
import { FaTrashCan } from "react-icons/fa6";
import { IoSend } from "react-icons/io5";
import { PiOpenAiLogo } from "react-icons/pi";
import ReactMarkdown from 'react-markdown';
import { Transforms, createEditor } from "slate";
import { withHistory } from "slate-history";
import { Editable, Slate, withReact } from "slate-react";
import { getEngine, useLLMEngineStore } from "../model/LLMEngine";
import { MessageGPT, useModelStore } from "../model/Model";
import { ModelLoadOverlay, ModelStatusChip } from "../view/components/ModelStatus";
import { TextLayerUtils } from "../model/utils/TextLayerUtils";
import { useStudyStore } from "./StudyModel";



export default function BaselineInterface(props: { children?: React.ReactNode }) {
  const modelReady = useLLMEngineStore(state => !!state.loadedModelId && !state.isLoading);
  const [textInputValue, setTextInputValue] = useState("");
  const [gptMessages, setGptMessages] = useState<MessageGPT[]>([
  ]);
  const messageDivRef = React.createRef<HTMLDivElement>();
  const layers = useModelStore(state => state.layers);

  const editor = useMemo(() => {
    const instance = withReact(withHistory(createEditor()))

    const { normalizeNode } = instance

    instance.normalizeNode = entry => {
      const [node, path] = entry

      if (path.length === 0) { // Root node
        const paragraphs = (node as any).children;
        // Ensure that there is only one paragraph
        if (paragraphs.length > 1) {

          // Add a new line at the begining of the following paragraph
          Transforms.insertText(instance, "\n", { at: { path: [1, 0], offset: 0 } })
          Transforms.mergeNodes(instance, { at: [1] })
        }
      }

      // Fall back to the original `normalizeNode` to enforce other constraints.
      normalizeNode(entry)
    }
    return instance;
  }, []);

  const onMessageSend = () => {
    const messages: MessageGPT[] = [...gptMessages, { content: textInputValue, role: 'user' }];
    setGptMessages(messages);
    setTextInputValue("");

    useStudyStore.getState().logEvent("CHATGPT_PROMPTED", { prompt: textInputValue });

    // Send the message to the local LLM
    (async () => {
      const engine = getEngine();
      const stream = await engine.chat.completions.create({
        messages: messages,
        stream: true,
      });

      const response: MessageGPT = { content: "", role: 'assistant' };

      setGptMessages([...messages, response]);
      for await (const chunk of stream) {
        response.content += chunk.choices[0]?.delta?.content || '';
        setGptMessages([...messages, response]);
      }

      useStudyStore.getState().logEvent("CHATGPT_RESPONDED", { response: response.content, fullHistory: gptMessages });

    })();
  }

  useEffect(() => {
    if (messageDivRef.current) {
      // Always scroll to the bottom of the message
      messageDivRef.current.scrollTop = messageDivRef.current.scrollHeight;
    }
  });

  useEffect(() => {
    // Convert the data from layers to a flatten text and set the editor
    if (layers.length > 0) {
      // Map modifications id to the name of the parent layer
      const idsToCategory: { [key: string]: string } = {};

      for (let i = 1; i < layers.length; i++) {
        const layer = layers[i];

        if (layer.children) {
          for (const children of layer.children) {
            const ids = Object.keys(children.layer.modifications);
            for (const id of ids) {
              let categoryName = layer.layer.name;
              idsToCategory[id] = categoryName;
            }
          }
        }
      }

      // Go over the categories in order and add numbers whenever encountering a category spread out from the rest
      let lastCategory = "";
      const categoryCounter: { [key: string]: number } = {};
      for (const id of Object.keys(idsToCategory).map(e => parseInt(e)).sort((a, b) => a - b)) {
        const category = idsToCategory[id];
        if (category !== lastCategory) {
          categoryCounter[category] = categoryCounter[category] ? categoryCounter[category] + 1 : 1;
          lastCategory = category;
        } else {
          // We keep only the first mention of the category
          idsToCategory[id] = "";
        }

        if (categoryCounter[category] > 1 && idsToCategory[id].length > 0) {
          idsToCategory[id] = `${category} (${categoryCounter[category]})`;
        }
      }


      const flattenedLayers = TextLayerUtils.flattenHierarchicalLayersToTextLayer(layers);
      let state = JSON.parse(JSON.stringify(flattenedLayers[0].state)); // Start from the first layer


      // Fill the first layer with placeholders to indicate what should go where
      for (const [tagId, modification] of Object.entries(idsToCategory)) {
        // Find the corresponding tag in the state
        for (const paragraph of state) {
          for (const child of (paragraph as any).children) {
            if ((child as any).layerTagId === parseInt(tagId)) {
              child.text = modification.length === 0 ? "" : `<${modification.toUpperCase()}>\n`;
            }
          }
        }
      }

      for (let i = 1; i < layers.length; i++) {
        const layer = layers[i];

        if (layer.children) {
          state.push({
            children: [{ text: "\n_________________\n# " + layer.layer.name.toUpperCase() }]
          })
          for (const children of layer.children) {
            const modifications = Object.entries(children.layer.modifications);

            if (modifications.length > 0) {
              const text = modifications.map(([key, value], idx) => `${idx > 0 ? '(' + (idx+1) + ') ' : ''}${value.trim()}`).join("\n");
              state.push({
                children: [{ text: "\n## " + children.layer.name + "\n" + text }]
              })
            }
          }
        }

      }

      // Add some space at the end so that we can scroll
      state.push({
        children: [{ text: "\n".repeat(20) }]
      });


      editor.children = state as any;
      editor.onChange();
      // This should only serve for the template task
    }
  }, [layers]);

  return (
    <>
      {!modelReady && <ModelLoadOverlay />}
      <ModelStatusChip />
      <div style={{ display: 'flex', flexDirection: 'row', height: '100vh', width: '100%', background: '#F2EEF0' }}>
        {/* Text Editor Side */}
        <div style={{ minWidth: 720, height: '100%', width: '70%', display: 'flex', flexDirection: 'row', justifyContent: 'center' }}>
          <div id="mainTextField" className={"textEditor"} style={{ position: 'relative', background: 'white', width: 700, paddingTop: 60, marginTop: 20, paddingLeft: 50, paddingRight: 50, borderRadius: '2px', boxShadow: '0 0 10px rgba(0,0,0,0.1)', overflow: 'scroll' }}>
            <Slate editor={editor} initialValue={layers.length > 0 ? layers[0].layer.state : []}>
              <Editable />
            </Slate>
          </div>
        </div>
        {/* ChatGPT Side */}
        <div style={{ position: 'relative', width: '30%', background: 'white', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <Button variant="light" isIconOnly disabled={gptMessages.length === 0} style={{top: 5, right: 5, fontSize: 16, position: 'absolute'}} size="sm" 
            onClick={() => setGptMessages([])}
          ><FaTrashCan/></Button>
          {/* Messages */}
          <div ref={messageDivRef} style={{ maxWidth: 960, minWidth: 400, flexGrow: 1, display: 'flex', fontSize: 18, flexDirection: 'column', alignItems: 'center', justifyContent: 'start', width: '100%', overflow: 'scroll', marginTop: 20, paddingLeft: 20, paddingRight: 20 }}>
            {gptMessages.map((message, index) => {
              return (
                <div key={index} style={{ display: 'flex', flexDirection: 'row', gap: 10, alignItems: 'start', marginBottom: 10, justifyContent: message.role === "user" ? "end" : 'start', width: '100%' }}>
                  {message.role === "assistant" && <div style={{ borderRadius: '50%', border: '1px solid #dddddd', padding: 5, marginTop: 10, fontSize: 25 }}><PiOpenAiLogo /></div>}

                  <div style={{ background: message.role === 'user' ? '#f4f4f4' : undefined, color: 'black', padding: 10, borderRadius: 5, whiteSpace: 'pre-wrap' }}>
                    {message.role === "assistant" && <ReactMarkdown>
                      {message.content}
                    </ReactMarkdown>}
                    {message.role === "user" && message.content}
                  </div>
                </div>
              )
            })}
          </div>

          { /* Text input */}
          <div style={{ flexGrow: 0, position: 'relative', width: '80%', maxWidth: 960, marginBottom: 20 }}>
            <Textarea
              value={textInputValue}
              onChange={(e) => setTextInputValue(e.target.value)}
              style={{ fontSize: 20, paddingRight: 40, paddingTop: 8, paddingBottom: 8 }}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  onMessageSend();
                  e.preventDefault();
                }
              }}


              minRows={1}
              placeholder="Message ChatGPT" />
            <Button isDisabled={textInputValue.length === 0} isIconOnly color={'primary'} style={{ position: 'absolute', right: 5, bottom: 5 }} size={'md'}
              onClick={onMessageSend}
            >
              <IoSend />
            </Button>
          </div>

        </div>
        {props.children}
      </div>
    </>
  )
}
