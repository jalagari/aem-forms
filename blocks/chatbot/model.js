class AIModel{
    constructor() {
        this.session = null;
        this.controller = new AbortController();
    }

    convertToJson(message) {
        console.log("message", message);
        let cleaned = message.trim();
        
        // Remove markdown code blocks
        if (cleaned.includes('```json')) {
            cleaned = cleaned.replace(/```json|```/g, '').trim();
        } else if (cleaned.includes('```')) {
            cleaned = cleaned.replace(/```/g, '').trim();
        }
        
        // Try to extract JSON from text if LLM added extra text
        const jsonMatch = cleaned.match(/\{.*\}/);
        if (jsonMatch) {
            cleaned = jsonMatch[0];
        }
        
        try {
            return JSON.parse(cleaned);
        } catch (error) {
            // Clean up formatting issues
            cleaned = cleaned
                .replace(/\n/g, ' ')
                .replace(/\r/g, ' ')
                .replace(/\t/g, ' ')
                .replace(/\s+/g, ' ')
                .trim();
            
            try {
                return JSON.parse(cleaned);
            } catch (secondError) {
                // Last attempt - try to extract JSON pattern more aggressively
                const jsonPattern = /\{[\s\S]*\}/;
                const lastMatch = message.match(jsonPattern);
                if (lastMatch) {
                    try {
                        const finalClean = lastMatch[0]
                            .replace(/\n/g, ' ')
                            .replace(/\r/g, ' ')
                            .replace(/\t/g, ' ')
                            .replace(/\s+/g, ' ')
                            .trim();
                        return JSON.parse(finalClean);
                    } catch (thirdError) {
                        console.log("Original message:", message);
                        console.log("Final cleaned:", finalClean);
                        console.error('All JSON parse attempts failed:', thirdError);
                        throw new Error('Unable to parse LLM response');
                    }
                }
                
                console.log("Original message:", message);
                console.log("Cleaned:", cleaned);
                console.error('JSON parse failed:', secondError);
                throw new Error('Unable to parse LLM response');
            }
        }
    }

    async setupModel() {
        const availability = await LanguageModel.availability();
        if (availability !== "unavailable") {
            this.params = await LanguageModel.params();
            this.session = await LanguageModel.create({
                signal: this.controller.signal,
                expectedInputs: [
                    { type: "image" },
                    { type: "text" }
                ],
                monitor(m) {
                    m.addEventListener("downloadprogress", (e) => {
                        console.log("Download progress:", e.loaded * 100);
                    });
                },
                initialPrompts: [
                    { 
                        role: 'system', 
                        content: `You are a JSON-only conversational form assistant. You MUST ONLY return valid JSON responses. Never include explanatory text, comments, or conversational responses outside of JSON.

                        CRITICAL RULES:
                        1. ALWAYS return ONLY valid JSON - no other text
                        2. Never include explanations, comments, or conversational text
                        3. Never ask questions about the format - just return JSON
                        4. Group related fields naturally (name+age+dob, email+phone+address, etc.)
                        5. Extract multiple values from user responses intelligently
                        
                        NO OTHER TEXT ALLOWED - ONLY JSON!` 
                    }
                    ]
                });
            return 'AI Model is available'; 
        }
        return 'Built-in conversational AI is unavailable';
    }

    async getSmartQuestion(schema) {
        const prompt = `You are a conversational assistant that creates questions to fill a form.
        Your goal is to group related fields and ask for them in a natural way.

        Based on the JSON Schema of available fields below, do the following:

        JSON Schema of available fields:
        ${JSON.stringify(schema, null, 2)}

        INSTRUCTIONS:
        1.  Examine the schema's "properties" to see the available fields.
        2.  Choose 2-5 logically related fields to ask about in one question (e.g., name, email, phone).
        3.  Create a single, friendly, conversational message asking for the selected fields.
        4.  Do not ask for fields that are not in the schema.
        5.  Never include field id in question
        6.  In your response, you MUST provide the 'id' of each field you are asking for. The 'id' is available inside each field's definition in the schema. Do NOT use the field name (the key in the "properties" object).

        GROUPING EXAMPLES:
        - "Hi! Let's start with your basic information. Could you tell me your full name, email address, and phone number?"
        - "Now I need your address details. What's your street address, city, state, and zip code?"
        - "Tell me about your preferences - what's your preferred contact method and any specific interests?"

        CRITICAL: You MUST return ONLY a single, valid JSON object. No other text, explanations, or comments.

        REQUIRED JSON FORMAT:
        {
        "message": "A conversational question asking for multiple related fields.",
        "requestedFields": ["id1", "id2", "id3"]
        }

        Now, choose the most logical group of fields to ask for and generate the JSON response.`;

        try {
            const response = await this.session.prompt(prompt);
            console.log("response from getSmartQuestion", response);

            const parsedResponse = this.convertToJson(response);
            console.log("parsedResponse from getSmartQuestion", parsedResponse);
            return parsedResponse;
        } catch (error) {
            console.error('Error getting smart question:', error);
            throw error;
        }
    }

    async extractData(schema, userInput, image) {
        const prompt = `You are an expert at extracting structured information from user input.
        Your task is to extract values for the fields defined in the provided JSON schema from the user's content.
        You must always provide your response in a valid JSON format as an array of objects.
        
        User provided content:
        ---
        ${userInput}
        ---
        
        JSON Schema of fields to extract:
        ---
        ${JSON.stringify(schema, null, 2)}
        ---
        
        INSTRUCTIONS:
        For each field in the JSON schema, create a JSON object with the following properties:
        1.  \`name\`: The name of the field from the schema (e.g., "Full_Name", "email_address").
        2.  \`value\`: The data extracted from the user's content for that field.
        3.  \`confidence\`: A score from 0.0 (uncertain) to 1.0 (certain) of your confidence.
        4.  \`reasoning\`: A brief explanation of *why* you extracted that value or why it's missing.
        
        EXTRACTION RULES:
        - **Explicit User Refusal:** If the user says they don't want to provide data ("skip this", "I won't say", etc.):
            - Set \`value\` to \`null\` (or \`"Not Provided"\` for enums).
            - Set \`confidence\` to \`1.0\`.
            - Set \`reasoning\` to "User explicitly refused to provide this information."
        - **Information Not Found:** If the field isn't mentioned, set \`value\` to \`null\`, \`confidence\` to \`0.0\`, and \`reasoning\` to "Information not found in the provided content."
        - **For enum fields:** Choose the closest matching option from the enum list for the \`value\`.
        
        CRITICAL: Your final output must be a single JSON array containing an object for EACH field requested in the schema. Do not include any other text or explanations.
        
        REQUIRED JSON FORMAT (EXAMPLE):
        [
          {
            "name": "field_name_from_schema_1",
            "value": "extracted value 1",
            "confidence": 0.95,
            "reasoning": "The user said 'My name is extracted value 1'."
          },
          {
            "name": "field_name_from_schema_2",
            "value": null,
            "confidence": 1.0,
            "reasoning": "User explicitly refused to provide this information."
          }
        ]`;
        
        try {
            let response;
            if (image) {
                response = await this.session.prompt(
                    [{
                        role: "user",
                        content: [
                          { type: "text", value: prompt },
                          { type: "image", value: image }
                        ]
                      }]
                    );
            } else {
                response = await this.session.prompt(prompt);
            }
            const responseJson = this.convertToJson(response);
            return responseJson;
        } catch (error) {
            console.error('Error extracting data:', error);
            throw error;
        }
    }
}

export default AIModel;