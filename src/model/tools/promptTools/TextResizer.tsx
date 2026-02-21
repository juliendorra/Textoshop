import { useStudyStore } from "../../../study/StudyModel";
import { TextUtils } from "../../utils/TextUtils";
import { MultiplePrompts, PromptTool, SimplePrompt } from "./PromptTool";

export class TextResizer extends PromptTool<string, number, string> {
    constructor(originalText: string) {
        super(originalText);
        this.cache.set(""+originalText.length, originalText);
    }

    getAllPossibleParagraphs(sentences: string[][]): string[] {
        // Helper function to generate all combinations of sentence variations
        function generateCombinations(sentences: string[][]): string[][] {
            let result: string[][] = [];
    
            function backtrack(index: number, current: string[]) {
                if (index === sentences.length) {
                    result.push([...current]); // Use spread operator to copy the array
                    return;
                }
    
                for (let sentence of sentences[index]) {
                    current.push(sentence);
                    backtrack(index + 1, current);
                    current.pop();
                }
            }
    
            backtrack(0, []);
            return result;
        }
    
        // Generate all possible combinations of sentence variations
        const allCombinations = generateCombinations(sentences);

        // Reconstruct the paragraphs
        const paragraphs: string[] = [];
        for (let combination of allCombinations) {
            paragraphs.push(combination.join(' '));
        }

        return paragraphs;
    }

    execute(targetLength : number): Promise<string> {
        useStudyStore.getState().logEvent("PROMPT_TOOL_EXECUTED", { className: this.constructor.name, input: this.input, parameters: targetLength });
        if (targetLength === 0) {
            return Promise.resolve("");
        }

        const currentNbWords = Math.round(this.input.length / 4.7);
        const targetNbWords = Math.round(targetLength  / 4.7);
        const wordDifference = targetNbWords - currentNbWords;
        const isShortened = targetLength < this.input.length;

        // Split the text in sentences using a regexp and store it as an array
        const arrayMatches = this.input.match(/[^.!?]+[.!?]+/g);
        const sentences = arrayMatches ? arrayMatches.map(sentence => sentence) : [this.input];
        // Make sure all the sentences are at least 4 words long, otherwise merge them with the next sentence (or previous if this is the last sentence)
        for (let i = 0; i < sentences.length; i++) {
            if (sentences[i].split(" ").length < 4) {
                if (i === sentences.length-1) {
                    sentences[i-1] += " " + sentences[i];
                    sentences.splice(i, 1);
                } else {
                    sentences[i] += " " + sentences[i+1];
                    sentences.splice(i+1, 1);
                }
            }
        }


        let wordDiffPerSentence = Math.round(wordDifference / sentences.length);
        wordDiffPerSentence = wordDiffPerSentence === 0 ? (isShortened ? -1 : 1) : wordDiffPerSentence;

        const diffs = sentences.length === 1 ? [-6, -4, -2, -1, 0, 1, 2, 4, 6] : [-3, 0, 3];

        // V2: Using regular prompts because JSON objects are too slow
        const prompts = sentences.map(sentence => {
            const nbWords = Math.round(sentence.length/4.7);
            const subPrompts = diffs.map(diff => {
                const length = Math.round(nbWords + wordDiffPerSentence + diff);

                return new SimplePrompt({
                        prompt: `${sentence}\n\n${isShortened ? "Shorten" : "Lengthen"} to ${length} words by ${isShortened ? "removing" : "adding"} ${wordDiffPerSentence + diff} words.`,
                });
            });

            return new MultiplePrompts(subPrompts);
        });

        return new MultiplePrompts(prompts).execute().then(results => {
            // Calculate all possible combinations of the sentences
            const allResults = sentences.length === 1 ?
                results.map((result, idx) => [...result.map(s => TextUtils.getFittingString(s.result, sentences[idx]))])
                : results.map((result, idx) => [sentences[idx], ...result.map(s => TextUtils.getFittingString(s.result, sentences[idx]))])

            const allParagraphs = this.getAllPossibleParagraphs(allResults);

            // Cache all the paragraphs
            allParagraphs.forEach(paragraph => {
                this.cache.set(""+paragraph.length, paragraph);
            });

            // Find the closest paragraph to the target length
            const closestParagraph = allParagraphs.reduce((prev, curr) => Math.abs(curr.length - targetLength) < Math.abs(prev.length - targetLength) ? curr : prev);
            
            return closestParagraph;
        });
    }
}