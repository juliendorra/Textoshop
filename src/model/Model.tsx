import { BaseEditor, BaseSelection, Editor, Node, Point, Transforms } from 'slate';
import { ReactEditor } from 'slate-react';
import { create } from 'zustand';
import { useStudyStore } from '../study/StudyModel';
import { LAYER_COLOR_PALETTE } from '../view/components/LayerManager';
import { getEngine } from './LLMEngine';
import { DrawTool } from './tools/toolbarTools/DrawTool';
import { EraserTool } from './tools/toolbarTools/EraserTool';
import { PluralizerTool, SingularizerTool } from './tools/toolbarTools/PluralizerTool';
import { PrompterTool } from './tools/toolbarTools/PrompterTool';
import { RepairTool } from './tools/toolbarTools/RepairTool';
import { SelectionTool } from './tools/toolbarTools/SelectionTool';
import { SmudgeTool } from './tools/toolbarTools/SmudgeTool';
import { FutureTenseChangerTool, PastTenseChangerTool, PresentTenseChangerTool } from './tools/toolbarTools/TextTenseTools';
import { TonePickerTool } from './tools/toolbarTools/TonePickerTool';
import { ToolbarTool } from './tools/toolbarTools/ToolbarTool';
import { useUndoModelStore } from './UndoModel';
import { SlateUtils } from './utils/SlateUtils';
import { TextAnimationUtils } from './utils/TextAnimationUtils';
import { TextLayerUtils } from './utils/TextLayerUtils';


export interface TextFieldAnimation {
    timeout: NodeJS.Timeout
    storedState: Node[],
    storedSelection: BaseSelection
}


//@ts-ignore
window['Transforms'] = Transforms;
export const textFieldEditors : {[textFieldId: string]: BaseEditor & ReactEditor} = (window as any)["textFieldEditors"] = {}
export const temporaryTextFieldAnimation : {[textFieldId: string]: TextFieldAnimation | null} = {}

/** 
 * Useful structures 
 **/
export interface MessageGPT {
    role: "user" | "assistant" | "system",
    content: string
}

export interface ToneLevel {
    lowAdjective: string
    highAdjective: string
    value: number
}


export interface TextSelection {
    textFieldId : string
    startPoint: Point
    endPoint: Point
    text : string
    selectionId: number
    isLoading?: boolean
}

export interface ExecutablePrompt {
    prompt: string
    model?: string
    json?: boolean,
}

export interface PromptResult {
    result: string,
    parsed?: any
}

export interface MoveableTextField {
    x: number
    y: number
    width: number
    height: number
    isMoveable: boolean
    id: string,
    state: Node[],
    isVisible: boolean
}

export type TextLayer = {
    name: string,
    isVisible: boolean
    modifications: {[tag: string]: string}
    color: string
}

export interface MainLayer extends TextLayer {
    state: Node[]
}

export type HiearchicalLayer = {
    id: string,
    layer: TextLayer,
    children?: HiearchicalLayer[],
}

export type HiearchicalMainLayer = {
    id: string,
    layer: MainLayer,
    children?: HiearchicalLayer[],
}

export type TextLayers = [MainLayer, ...TextLayer[]]
export type HiearchicalLayers = [HiearchicalMainLayer, ...HiearchicalLayer[]]


/** 
 * Model 
 **/
export interface ModelState {
    inMultipleSelectionMode: boolean
    selectedTexts: TextSelection[]
    selectedTool: string
    textFields: MoveableTextField[]
    editors : {[textFieldId: string]: BaseEditor & ReactEditor}
    layers: HiearchicalLayers
    selectedLayerId: number
    animateChangesUntilTimestamp: number
    tone: ToneLevel[];
    toolsOrderInToolbar: string[][];
}

interface ModelAction {
    setInMultipleSelectionMode: (inMultipleSelectionMode: boolean) => void
    setSelectedTexts: (selectedTexts: TextSelection[], removeTextFieldIfEmpty? : boolean ) => void
    reset: () => void
    executePrompt: (prompt: ExecutablePrompt) => Promise<PromptResult>
    setSelectedTool: (tool: string) => void
    getSelectedTool: () => ToolbarTool
    setTextFields: (textFields: MoveableTextField[]) => void
    setTextField: (textFieldId: string, newTextFieldData: Partial<MoveableTextField>) => void
    removeTextField: (textFieldId: string) => void
    setSelectedLayer: (layerId: number) => void
    setLayerVisibility: (layerId: number, isVisible: boolean) => void
    setLayerProperties: (layerId: number, properties: {[tag: string]: any}) => void
    animateNextChanges: () => void
    refreshTextFields: (force?: boolean) => void
    removeLayer: (layerId: number) => void
    moveLayer: (layerId: number, targetParentId: number | null, idWithinParent: number) => void
    addLayer: (layer: HiearchicalLayer, parentId: number | null, idWithinParent: number) => void
    setTone: (tone: ToneLevel[]) => void
    setToolOrderInToolbar: (toolsOrderInToolbar: string[][]) => void
}



export const tools : {[toolName: string]: ToolbarTool} = {}



function getInitialState() {
    const toolsOrderInToolbar : string[][] = [
        [(tools[SelectionTool.getToolName()] = new SelectionTool()).name], 
        [(tools[DrawTool.getToolName()] = new DrawTool()).name], 
        [(tools[TonePickerTool.getToolName()] = new TonePickerTool()).name], 
        [(tools[SmudgeTool.getToolName()] = new SmudgeTool()).name], 
        [
            (tools[PluralizerTool.getToolName()] = new PluralizerTool()).name,
            (tools[SingularizerTool.getToolName()] = new SingularizerTool()).name
        ], 
        [
            (tools[PastTenseChangerTool.getToolName()] = new PastTenseChangerTool()).name,
            (tools[PresentTenseChangerTool.getToolName()] = new PresentTenseChangerTool()).name,
            (tools[FutureTenseChangerTool.getToolName()] = new FutureTenseChangerTool()).name
        ],

        [(tools[RepairTool.getToolName()] = new RepairTool()).name], 
        [(tools[EraserTool.getToolName()] = new EraserTool()).name], 
        [(tools[PrompterTool.getToolName()] = new PrompterTool()).name]
    ]

    const startingLayers = [
        { id: "1", layer: { name: "Layer 1", color: "white", isVisible: true, state: [{
            //@ts-ignore
            type: "paragraph",
            children: [{ text: `   Alice was beginning to get very tired of sitting by her sister on the bank, and of having nothing to do: once or twice she had peeped into the book her sister was reading, but it had no pictures or conversations in it, “and what is the use of a book,” thought Alice “without pictures or conversations?”
        
            So she was considering in her own mind (as well as she could, for the hot day made her feel very sleepy and stupid), whether the pleasure of making a daisy-chain would be worth the trouble of getting up and picking the daisies, when suddenly a White Rabbit with pink eyes ran close by her.
        
            There was nothing so _very_ remarkable in that; nor did Alice think it so _very_ much out of the way to hear the Rabbit say to itself, “Oh dear! Oh dear! I shall be late!” (when she thought it over afterwards, it occurred to her that she ought to have wondered at this, but at the time it all seemed quite natural); but when the Rabbit actually _took a watch out of its waistcoat-pocket_, and looked at it, and then hurried on, Alice started to her feet, for it flashed across her mind that she had never before seen a rabbit with either a waistcoat-pocket, or a watch to take out of it, and burning with curiosity, she ran across the field after it, and fortunately was just in time to see it pop down a large rabbit-hole under the hedge.` }]
        }], modifications: {} }, 
                children: [] },
                { id: "2", layer: { name: "Layer 2", color: LAYER_COLOR_PALETTE[0], isVisible: true, modifications: {} }, children: [] },
        { id: "3", layer: { name: "Layer 3", color: LAYER_COLOR_PALETTE[1], isVisible: true, modifications: {} }, children: [] },
        
    ]

    const initialState: ModelState = {
        inMultipleSelectionMode: false,
        selectedTexts: [],
        selectedTool: SelectionTool.getToolName(),
        editors: {},
        animateChangesUntilTimestamp: 0,
        tone: [
            { lowAdjective: "Informal", highAdjective: "Formal", value: 5 },
            { lowAdjective: "Negative", highAdjective: "Positive", value: 5 },
            { lowAdjective: "Complicated", highAdjective: "Simple", value: 5 },
        ],
        layers: startingLayers as any,
        selectedLayerId: 0,
        textFields: [
            {
                x: -1, y: -1, width: -1, height: -1, isMoveable: false,
                id: "mainTextField",
                state: TextLayerUtils.getStateFromLayers(startingLayers as any),
                isVisible: true
            },
        ],
        toolsOrderInToolbar: toolsOrderInToolbar
    }

    return initialState;
}

function forEachEditor<Type>(array : Type [], textFieldIdRetriever: (e : Type) => string, fn: (element : Type, editor: BaseEditor & ReactEditor, textFieldId: string) => void) {
    array.forEach((e) => {
        const textFieldId = textFieldIdRetriever(e);
        const editor = textFieldEditors[textFieldId];
        if (editor) {
            fn(e, editor, textFieldId);
        }
    });
}

export const useModelStore = create<ModelState & ModelAction>()((set, get) => ({
    ...getInitialState(),
    reset: () => {
        set((state) => ({ ...getInitialState() })),
        get().refreshTextFields();
    },
    setInMultipleSelectionMode: (inMultipleSelectionMode) => set((state) => ({ inMultipleSelectionMode: inMultipleSelectionMode })),
    setSelectedTool: (tool) => {
        set((state) => ({ selectedTool: tool }))
        useStudyStore.getState().logEvent("TOOL_SELECTED", {tool: tool});
    },
    getSelectedTool: () => tools[get().selectedTool],
    executePrompt: async (executablePrompt) => {
        const logEvent = useStudyStore.getState().logEvent;
        const uniqueId = Math.random().toString(36).substring(7);
        const engine = getEngine();

        const stream = await engine.chat.completions.create({
            messages: [{ role: 'user', content: executablePrompt.prompt }],
            stream: true,
            temperature: 0,
            response_format: executablePrompt.json ? { type: "json_object" } : undefined,
        });

        logEvent("PROMPT_SENT_TO_GPT", {...executablePrompt, uniqueId: uniqueId});

        return new Promise<PromptResult>(async (resolve, reject) => {
            let completeResult = "";
            for await (const chunk of stream) {
                const chunkStr = chunk.choices[0]?.delta?.content || '';
                completeResult += chunkStr;
            }
            logEvent("RESULT_FROM_GPT", {uniqueId: uniqueId, response: completeResult});

            resolve({ result: completeResult });
        });
    },
    setTextFields: (textFields) => {
        const previousTextFields = get().textFields;

        let isTemporaryChange = false;

        // Only store the textFields whose states do not contain the differences variable
        const textFieldsToStore = textFields.map(e => {
            const textField = previousTextFields.filter(e2 => e2.id === e.id);
            if (textField.length === 1 && e.state.length > 0 && (e.state[0] as any).differences) {
                isTemporaryChange = true;
                // Do not store text fields that are temporary
                return textField[0];
            }
            return e;
        });

        if (!isTemporaryChange && textFields.map(t => Node.string(t.state[0])).join("\n") !== previousTextFields.map(t => Node.string(t.state[0])).join("\n")) {
            useUndoModelStore.getState().storeUndoStateDebounced();
        }

        // Text fields have changed. We should check the selections and update them in the model
        const selections : TextSelection[] = [];
        forEachEditor(textFieldsToStore, e => e.id, (textField, editor, textFieldId) => {
            const nodes = Editor.nodes(editor, { at: [], mode: 'all', match: (n : any) => n.selectionId !== undefined });

            for (const [node, path] of nodes) { 
                const previousSelection = get().selectedTexts.filter(e => e.textFieldId === textFieldId && e.selectionId === (node as any).selectionId);
                const nodeString = Node.string(node);
                selections.push({
                    textFieldId: textFieldId,
                    startPoint: { path: path, offset: 0 },
                    endPoint: { path: path, offset: nodeString.length },
                    text: nodeString,
                    selectionId: (node as any).selectionId,
                    isLoading: previousSelection.length === 1 ? previousSelection[0].isLoading : false // Make sure we preserve the loading state
                });
            }
        });
        // Sort the selections by their selectionId
        selections.sort((a, b) => a.selectionId - b.selectionId);


        set((state) => ({ textFields: textFieldsToStore, selectedTexts: selections}))

        //const layers = TextLayerUtils.flattenHierarchicalLayers(get().layers);
        forEachEditor(textFields, e => e.id, (textField, editor, textFieldId) => {
            if (textFieldId === "mainTextField" && !(textField.state[0] as any).differences) {
                const previousTextField = previousTextFields.filter(e => e.id === textFieldId);
                const previousState = previousTextField[0].state;
                const newState = textField.state;

                if (get().layers[0].layer.state.length === 0 || previousState.map(e => Node.string(e)).join("\n") !== newState.map(e => Node.string(e)).join("\n")) {
                    // Update the text layers (only for the main text field)
                    // TODO: Support multiple text fields
                    const updatedTextLayers = TextLayerUtils.updateLayersFromNewState(get().layers, get().selectedLayerId, textField.state);

                    if (updatedTextLayers) {
                        set((state) => ({ layers: JSON.parse(JSON.stringify(updatedTextLayers)) }));

                        // Immediately update the text fields to reflect the changes
                        const stateCalculatedFromLayers = TextLayerUtils.getStateFromLayers(updatedTextLayers);
                        
                        //if (newState.map(e => Node.string(e)).join("\n") !== stateCalculatedFromLayers.map(e => Node.string(e)).join("\n")) {

                            // Update the selection to match the new state by finding the corresponding node at the same index in the new state
                            const newStateIndexPosition = SlateUtils.toStrIndex(newState, editor.selection?.anchor || { path: [], offset: 0 });
                            let updatedPoint = SlateUtils.toSlatePoint(stateCalculatedFromLayers, newStateIndexPosition);
                            if (updatedPoint === null) {
                                // Set to the end of the document in this case
                                updatedPoint = Editor.end(editor, []);
                            }
                            editor.selection = updatedPoint ? { anchor: updatedPoint, focus: updatedPoint } : null;
                            editor.children = stateCalculatedFromLayers;
                            editor.onChange();
                        //}
                    }
                }
            }
        });

        if (Date.now() < get().animateChangesUntilTimestamp) {
            // Potentially trigger an animation to show the differences
            forEachEditor(textFields, e => e.id, (textField, editor, textFieldId) => {
                const previousTextField = previousTextFields.filter(e => e.id === textFieldId);

                if (previousTextField.length === 1 && !(textField.state[0] as any).differences) { // Make sure we are not animating a temporary state
                    const previousState = previousTextField[0].state;
                    const newState = textField.state;

                    const highlightedDiffsNode = TextAnimationUtils.getHighlightedNodeDifference(previousState, newState);

                    if (highlightedDiffsNode.length > 0) {
                        TextAnimationUtils.startTextFieldAnimation(textFieldId, editor, newState, highlightedDiffsNode);
                    }
                }
            });
        }
    },
    setTextField: (textFieldId, newTextFieldData) => {
        const textFields = get().textFields;
        const updatedTextFields = textFields.map(e => {
            if (e.id === textFieldId) {
                return { ...e, ...newTextFieldData }
            }
            return e;
        });
        set((state) => ({ textFields: updatedTextFields }));
    },
    removeTextField: (textFieldId) => {
        useStudyStore.getState().logEvent("TEXT_FIELD_REMOVED", {textFieldId: textFieldId});
        // Just make the field invisible
        const textFields = get().textFields;
        const updatedTextFields = textFields.map(e => {
            if (e.id === textFieldId) {
                return { ...e, isVisible: false }
            }
            return e;
        });
        set((state) => ({ textFields: [...updatedTextFields] }));

        //set((state) => ({ textFields: [...state.textFields.filter(e => e.id !== textFieldId)] }));
    },
    setSelectedTexts: (selectedTexts, removeTextFieldIfEmpty = false) => {
        if (selectedTexts.length === 0) {
            forEachEditor(get().textFields, e => e.id, (textField, editor, textFieldId) => {
                Transforms.unsetNodes(editor, ['selection', 'selectionId', 'selectionClassname'], { at: [], mode: 'all', match: (n : any) => n.selection });
            });
        } else {
            // Allow editing text of the selection (no support for changing the range becaue it gets too messy)
            forEachEditor([...new Set(selectedTexts.map(e => e.textFieldId))], e => e, (_, editor, textFieldId) => {
                // Make sure nothing is selected because we are managing the selection ourselves
                editor.deselect();

                const nodes = Editor.nodes(editor, { at: [], mode: 'all', match: (n : any) => n.selectionId !== undefined });

                for (const [node, path] of nodes) { 
                    // Only edit if the text is different
                    const selectionId = (node as any).selectionId;
                    const correspondingSelectedText = selectedTexts.find(e => e.selectionId === selectionId);
                    if (correspondingSelectedText && Node.string(node) !== correspondingSelectedText.text) {
                        // If the text is completely removed, we should place the cursor where it was so that text can be entered in its place
                        if (correspondingSelectedText.text.length === 0) {
                            if (Node.string(editor) !== Node.string(node)) {
                                editor.select(path)
                            }
                        }
                        Transforms.insertText(editor, correspondingSelectedText.text, { at: path });

                        if (Node.string(editor).length === 0) {
                            // The transformation removed ALL the text of the editor.
                            if (removeTextFieldIfEmpty && textFieldId !== "mainTextField") { 
                                // We remove the text field if it is empty
                                get().removeTextField(textFieldId);
                            } else {
                                //  We clean the tree and place the cursor at the very beginning
                                editor.children = [{
                                    //@ts-ignore
                                    type: "paragraph",
                                    children: [{ text: "" }]
                                }]
                                editor.select(Editor.start(editor, []));
                                editor.onChange();
                            }
                        }
                    }
                }
            });
        }
        set((state) => ({ selectedTexts: selectedTexts }))
    },
    refreshTextFields: (force : boolean = false) => {
        const textFields = get().textFields;
        for (const textField of textFields) {
            if (textField.id === "mainTextField") {
                const newState = TextLayerUtils.getStateFromLayers(get().layers);
                const editor = textFieldEditors[textField.id];
                if (editor) {
                    editor.children = newState;
                    editor.onChange();
                }
                
                if (!editor || force) {
                    // Seems like the editor is not mounted yet. Then we directly set the value of the text field
                    textField.state = newState;
                    set((state) => ({ textFields: [...state.textFields] }));
                }
            } else {
                const editor = textFieldEditors[textField.id];
                if (editor) {
                    editor.children = textField.state;
                    editor.onChange();
                }
            
            }
        }
    },


    setSelectedLayer: (layerId) => {
        if (layerId !== get().selectedLayerId) {
            useStudyStore.getState().logEvent("LAYER_SELECTED", {layerId: layerId});
            set((state) => ({ selectedLayerId: layerId }))
        }
    },
    setLayerVisibility: (layerId, isVisible) => {
        const layers = get().layers;
        TextLayerUtils.flattenHierarchicalLayersWithParent(layers).forEach((layerWithParent, index) => {
            if (index === layerId) {
                useStudyStore.getState().logEvent("LAYER_VISIBILITY_CHANGED", {layerId: layerId, isVisible: isVisible, layerName: layerWithParent.hlayer.layer.name});
                if (isVisible) {
                    // Recursively loop through the parents to make sure they are visible too
                    let parent = layerWithParent.parent;
                    while (parent) {
                        parent.hlayer.layer.isVisible = true;
                        parent = parent.parent;
                    }
                } else {
                    // Recursively loop through the children to make sure they are invisible too
                    const children = layerWithParent.hlayer.children;
                    if (children) {
                        const stack = [...children];
                        while (stack.length > 0) {
                            const current = stack.shift();
                            if (current && current.children) {
                                current.layer.isVisible = false;
                                stack.push(...current.children);
                            }
                        }
                    }
                }
                layerWithParent.hlayer.layer.isVisible = isVisible;
            }
        });

        //get().setLayerProperties(layerId, { isVisible: isVisible });
        // Immediately update the text fields to reflect the changes
        get().refreshTextFields();
    },
    setLayerProperties: (layerId, properties) => {
        const layers = get().layers;
        // The layer id assumes a flat list of layer. So we loop through the layers recursively (depth first) to find the layer
        const layersToGoThrough : HiearchicalLayer[] = [...layers];
        let currentId = 0;
        while (layersToGoThrough.length > 0) {
            const currentLayer = layersToGoThrough.shift();
            if (currentLayer) {
                if (currentId === layerId) {
                    useStudyStore.getState().logEvent("LAYER_PROPERTIES_CHANGED", {layerId: layerId, properties: properties, layerName: currentLayer.layer.name});
                    currentLayer.layer = { ...currentLayer.layer, ...properties };
                    break;
                }
                if (currentLayer.children) {
                    // Add at the beginning of the layersToGoThrough
                    layersToGoThrough.unshift(...currentLayer.children);
                }
            }
            currentId++;
        }
        set((state) => ({ layers: [...layers] }));
    },
    /**
     * Animate all the text changes happening within the next 200ms
     */
    animateNextChanges: () => {
        set((state) => ({ animateChangesUntilTimestamp: Date.now() + 200 }))
    },
    removeLayer: (layerId) => {
        if (layerId === 0) {
            return; // We cannot remove the main layer
        }
        const layersToEdit = get().layers;
        const flattenedLayersWithParents = TextLayerUtils.flattenHierarchicalLayersWithParent(layersToEdit);

        if (layerId < flattenedLayersWithParents.length) {
            const layerToRemove = flattenedLayersWithParents[layerId];

            // Remove the layer from the children of the parent
            const parent = layerToRemove.parent;
            const indexWithinParent = layerToRemove.indexWithinParent;
            if (parent && parent.hlayer.children) {
                parent.hlayer.children.splice(indexWithinParent, 1);
            } else {
                // The layer is one of the "root" layers, we remove it from the hiearchical layers directly
                layersToEdit.splice(indexWithinParent, 1);
            }

            if (layerId === get().selectedLayerId) {
                // Need to move the selection so that it is not on the removed layer
                // We move it to the closest layer to the one removed
                get().setSelectedLayer(layerId-1);
            }

            useStudyStore.getState().logEvent("LAYER_REMOVED", {layerId: layerId, layerName: layerToRemove.hlayer.layer.name});

            set((state) => ({ layers: [...layersToEdit] }));
            get().refreshTextFields();
        }
    },
    addLayer: (layer, parentId, idWithinParent) => {
        const layersToEdit = get().layers;
        const flattenedLayers = TextLayerUtils.flattenHierarchicalLayers(layersToEdit);

        if (parentId === null) {
            // Add the layer at the root
            layersToEdit.splice(idWithinParent, 0, layer);
        } else {
            if (parentId < flattenedLayers.length) {
                const parent = flattenedLayers[parentId];
                if (parent.children && parent.children.length >= idWithinParent) {
                    parent.children.splice(idWithinParent, 0, layer);
                }
            }
        }

        // Find the id of the new layer
        const newLayerId = TextLayerUtils.flattenHierarchicalLayers(layersToEdit).findIndex(e => e === layer);
        if (newLayerId !== -1) layer.id = newLayerId.toString();

        useStudyStore.getState().logEvent("LAYER_ADDED", {layerName: layer.layer.name, parentId: parentId, idWithinParent: idWithinParent});

        set((state) => ({ layers: [...layersToEdit] }));
        get().refreshTextFields();
    },
    moveLayer: (layerId, targetParentId, idWithinParent) => {
        const layersToEdit = get().layers;
        const flattenedLayers = TextLayerUtils.flattenHierarchicalLayers(layersToEdit);

        if (layerId < flattenedLayers.length && layerId > 0 /* first layer cannot be dragged */) {
            const layerToMove = flattenedLayers[layerId];

            const targetId = targetParentId === null ? idWithinParent : targetParentId + idWithinParent;

            if (targetId < 0 || targetId > flattenedLayers.length) return;

            // The order of the remove/add will depend if the destination is higher or lower than the current position
            if (targetId < layerId) {
                // Layer is moved higher up in the hierarchy. We should remove first
                get().removeLayer(layerId);
                get().addLayer(layerToMove, targetParentId, idWithinParent);
            } else {
                // Layer is moved lower in the hierarchy. We should add first
                get().addLayer(layerToMove, targetParentId, idWithinParent);
                get().removeLayer(layerId);
            }

            useStudyStore.getState().logEvent("LAYER_MOVED", {layerId: layerId, targetParentId: targetParentId, idWithinParent: idWithinParent});
        }
    },
    setTone: (tone) => {
        set((state) => ({ tone: tone }))
    },
    setToolOrderInToolbar: (toolsOrderInToolbar) => set((state) => ({ toolsOrderInToolbar: toolsOrderInToolbar })),
}))


//         
