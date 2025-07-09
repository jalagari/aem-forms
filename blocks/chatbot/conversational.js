import Form from "./form.js";
import AIModel from "./model.js";

export default class Conversational extends EventTarget { 
    constructor() {
        super();
        this.formUrl = null;
        this.downloadProgress = 0;
        this.params = null;
        this.collectedData = {};
        this.conversationHistory = [];
        this.form = null;
        this.processedFields = new Set();
        this.form = new Form();
        this.model = new AIModel();
    }

    updateConversationHistory(message, person = 'system', requestedFields = []) {
        const messageObject = {
            role: person,
            content: message
        };
        if (requestedFields.length > 0) {
            messageObject.requestedFields = requestedFields;
        }
        this.conversationHistory.push(messageObject);
        this.dispatchEvent(new CustomEvent('conversationUpdated', {
            detail: {
                message,
                role: person,
                requestedFields: requestedFields,
            }
        }));
    }

    async start(formUrl) {
        this.formUrl = formUrl;
        this.updateConversationHistory("Loading Form Conversational AI...");
        const msg = await this.model.setupModel();
        this.updateConversationHistory(msg);
        this.updateConversationHistory("Loading form...");
        this.form.createFormInstance(this.formUrl);
        this.updateConversationHistory("Waiting for form to ready...");
        this.form.addEventListener('importComplete', async () => {
            await this.processNextFields();
        });
        this.form.addEventListener('formReady', async (e) => {
            this.updateConversationHistory("Form ready");
            await this.processNextFields();
        });
    }

    async invalidField() { 
        const invalidFields = this.form.getInvalidFields();
        if (invalidFields.length > 0) {
            const field = invalidFields[0];
            const message = `Invalid field: ${field.label?.value || field.label || field.name}, reason: ${field.validationMessage}`;
            this.updateConversationHistory(message, 'assistant', [field.id]);
        } else {
            return await this.processNextFields();
        }
    }

    getSchema(keys) {
        const schema  = {
            "type": "object",
            "properties": {
            }
          };
        
        const fillableFields = keys || this.form.getFillableFields();

        fillableFields.forEach(f => {
            let field = f;
            if (typeof f === 'string') {
                field = this.form.getField(f);
            }
            schema.properties[field.name] = {
                "id": field.id,
                "type": field.type,
                "enum": field.enum || [],
                "description": field.description || '',
                "placeholder": field.placeholder || ''
            }
        });

        console.log("Schema", schema);
        return schema;
    }

    async processNextFields() {
        const availableFields = this.form.getFillableFields();
        
        if (availableFields.length === 0) {
            return await this.completeConversation();
        }
        const schema = this.getSchema();

        try {
            this.updateConversationHistory("Grouping fields for smart question...", 'system');
            const response = await this.model.getSmartQuestion(schema);
            
            // Store which fields we're asking about
            this.currentRequestedFields = response.requestedFields || [];
            
            this.updateConversationHistory(`Grouped fields for question: ${JSON.stringify(this.currentRequestedFields)}`, 'system');
            this.updateConversationHistory(response.message, 'assistant', this.currentRequestedFields);
            
        } catch (error) {
            console.error('Error asking for fields:', error);
            // Simple fallback
            const firstFewFields = availableFields.slice(0, 3);
            const fieldNames = firstFewFields.map(f => f.label?.value || f.label || f.name).join(', ');
            const fallbackMessage = `I'd like to collect some information: ${fieldNames}. Could you please provide these details?`;
            
            this.currentRequestedFields = firstFewFields.map(f => f.id);
            
            this.updateConversationHistory(fallbackMessage, 'assistant', this.currentRequestedFields);
        }
    }

    async processUserResponse(message) {
        const { content, image, type } = message;
        if (!this.currentRequestedFields) {
            return { message: "Thank you!", isComplete: true };
        }
        
        try {
            this.updateConversationHistory("Extracting data from user response...", 'system');
            const schema = this.getSchema(image ? this.form.getFillableFields() : this.currentRequestedFields);
            const response = await this.model.extractData(schema, content, image);
            
            // Update form with extracted data and track confidence scores
            console.log("Extracted Data", response);
            if (response) {
                console.log("Collected Data", this.collectedData);
                response.forEach((field) => {
                    if(field.value && field.confidence > 0.5) {
                        this.collectedData[field.name] = field.value;
                    } else {
                        this.collectedData[field.name] = null;
                        // this.updateConversationHistory(`I'm not entirely sure about: ${fieldKey}. The extracted value might need clarification.`);
                    }
                });
                this.updateConversationHistory(`Collected Data: ${JSON.stringify(this.collectedData)}`, 'system');
                console.log("Collected Data", this.collectedData);
                this.updateConversationHistory("Updating form data...", 'system');
                await this.form.updateFormData(this.collectedData);
                await this.invalidField();
            } else {
                this.updateConversationHistory("I didn't quite understand that. Could you please try again?", 'assistant', this.currentRequestedFields);
            }
            
        } catch (error) {
            console.error('Error processing response:', error);
            return {
                message: "I didn't quite understand that. Could you please try again?",
                isComplete: false
            };
        }
    }

    async completeConversation() {
        const summary = Object.keys(this.collectedData).length > 0 
            ? `I've collected: ${Object.entries(this.collectedData)
                .map(([field, value]) => `${field}: ${value}`)
                .join(', ')}`
            : "All done!";
            
        const message = `Perfect! ${summary} Your form is now complete and ready to submit.`;
        
        this.updateConversationHistory(message);
        
        return {
            message: message,
            isComplete: true,
            collectedData: this.collectedData
        };
    }


    getProgress() {
        const totalFields = this.form ? this.form.getFillableFields().length : 0;
        const processedCount = this.processedFields.size;
        return {
            current: processedCount,
            total: totalFields,
            percentage: totalFields > 0 ? Math.round((processedCount / totalFields) * 100) : 0
        };
    }

    getConversationHistory() {
        return this.conversationHistory;
    }

    getCollectedData() {
        return { ...this.collectedData };
    }

    reset() {
        this.collectedData = {};
        this.conversationHistory = [];
        this.processedFields.clear();
        this.currentRequestedFields = null;
    }
}