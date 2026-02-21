// Static class with a bunch of utility functions for text manipulation

import { jsonrepair } from "jsonrepair";

/** Utils to parse the results of prompts */

export class PromptParserUtils {
    static parseJSON(json : string) : any {
        // Prompt results tend to decorate the JSON using markdown. If we detect this decoration, we only keep what is inside the code block
        if (json.includes("```json") ) {
            const start = json.indexOf("```json") + 7;
            const end = json.indexOf("```", start);
            json = json.substring(start, end);
        } else if (json.includes("```")) {
            // Also handle bare ``` fences without "json" tag
            const start = json.indexOf("```") + 3;
            const end = json.indexOf("```", start);
            if (end > start) {
                json = json.substring(start, end);
            }
        }

        // Small local models often wrap JSON in preamble/commentary.
        // Try to extract the outermost { ... } or [ ... ] if present.
        const firstBrace = json.indexOf("{");
        const firstBracket = json.indexOf("[");
        if (firstBrace !== -1 || firstBracket !== -1) {
            let startChar: string;
            let endChar: string;
            let startIdx: number;
            if (firstBracket === -1 || (firstBrace !== -1 && firstBrace < firstBracket)) {
                startChar = "{"; endChar = "}"; startIdx = firstBrace;
            } else {
                startChar = "["; endChar = "]"; startIdx = firstBracket;
            }
            const lastIdx = json.lastIndexOf(endChar);
            if (lastIdx > startIdx) {
                json = json.substring(startIdx, lastIdx + 1);
            }
        }

        // Now, try parsing the JSON
        try {
            return JSON.parse(json);
        } catch (e) {
            // Seems like there are still issues, try to repair the json
            json = jsonrepair(json);
            try {
                return JSON.parse(json);
            } catch (e) {
                console.error("Error while parsing JSON", e);
            }
        }
        return null; // We could not parse the json
    }
}