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
        this.form = new Form();
        this.model = new AIModel();
        
        // Field type classification for smart processing
        this.complexFieldTypes = new Set(['drop-down', 'radio-group', 'checkbox-group', 'checkbox', 'date-input', 'datetime-input', 'file-input', 'range', 'color']);
    }

    updateConversationHistory(content, person = 'system', type = 'text', field = null) {
        const message = {
            sender: person,
            content,
            type,
        };
        if (field) {
            message.field = field;
        }
        this.conversationHistory.push(message);
        this.dispatchEvent(new CustomEvent('conversationUpdated', {
            detail: message
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
        this.form.addEventListener('formReady', async (e) => {
            this.updateConversationHistory("Form ready");
            await this.identifyFields();
        });
    }

    async invalidField() { 
        const invalidFields = this.form.getInvalidFields();
        if (invalidFields.length > 0) {
            const field = invalidFields[0];
            const isFieldComplex = this.complexFieldTypes.has(field.fieldType); 
            const message = `Invalid field: ${field.label?.value || field.label || field.name}, reason: ${field.validationMessage}`;
            if (isFieldComplex) {
                await this.processComplexField(message, field);
            } else {
                this.updateConversationHistory(message, 'assistant');
            }
        } else {
            return await this.identifyFields();
        }
    }

    getSchema(fields) {
        const schema  = {
            "type": "object",
            "properties": {
            }
          };
        
        fields.forEach(f => {
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

    async identifyFields() {
        const availableFields = this.form.getFillableFields();
        
        if (availableFields.length === 0) {
            return await this.completeConversation();
        }

        // Get next field or group of fields
        this.currentRequestedFields = this.getNextFields(availableFields);
        
        if (this.currentRequestedFields.length === 0) {
            return await this.completeConversation();
        }

        // Process the fields
        if (this.currentRequestedFields.length === 1 && this.isComplexField(this.currentRequestedFields[0])) {
            await this.processComplexField(this.currentRequestedFields[0]);
        } else {
            await this.processNextFields();
        }
    }

    getNextFields(availableFields) {
        const fields = [];
        
        for (let i = 0; i < availableFields.length; i++) {
            const field = availableFields[i];
            
            if (this.isComplexField(field)) {
                // If we have simple fields, return them first
                if (fields.length > 0) {
                    return fields;
                }
                // Otherwise, return just this complex field
                return [field];
            } else {
                fields.push(field);
                if (fields.length >= 4) {
                    return fields;
                }
            }
        }
        
        return fields;
    }

    isComplexField(field) {
        return this.complexFieldTypes.has(field.fieldType);
    }

    async processNextFields() {
        try {
            this.updateConversationHistory("Generating question for selected fields...", 'system');
            
            // Get schema for the selected fields
            const schema = this.getSchema(this.currentRequestedFields);
            const response = await this.model.getSmartQuestion(schema);
            
            // Store which fields we're asking about
            
            this.updateConversationHistory(`Generated question: ${response.message}`, 'system');
            this.updateConversationHistory(response.message, 'assistant');
            
        } catch (error) {
            console.error('Error asking for fields:', error);
            // Simple fallback
            const fieldLabels = this.currentRequestedFields.map(field => 
                field.label?.value || field.label || field.name
            ).join(', ');
            const fallbackMessage = `I'd like to collect some information: ${fieldLabels}. Could you please provide these details?`;
            
            this.updateConversationHistory(fallbackMessage, 'assistant');
        }
    }


    async processComplexField(field) {
        const messageType = this.getFieldMessageType(field);
        const message = field.label?.value || field.label || field.name;
        
        this.updateConversationHistory(
            message, 
            'assistant', 
            messageType,
            field
        );
    }

    getFieldMessageType(field) {
        const fieldType = field.fieldType;
        if (fieldType === 'checkbox') return 'boolean';
        if (['drop-down', 'radio-group', 'checkbox-group'].includes(fieldType)) return 'choice';
        return 'field';
    }
    
    async processUserResponse(message) {
        const { content, image, field } = message;
        
        if (!this.currentRequestedFields) {
            this.updateConversationHistory(this.form.getThankYouMessage(), 'assistant', 'html');
        }

        // Handle direct field response (from widgets)
        if (field) {
            this.collectedData[field.name] = content;
            await this.form.updateFormData(this.collectedData);
            return await this.invalidField();
        }
        
        // Handle conversational response (from text input)
        try {
            this.updateConversationHistory("Extracting data from user response...", 'system');
            const schema = this.getSchema(this.currentRequestedFields);
            const response = await this.model.extractData(schema, content, image);
            
            if (response) {
                response.forEach((field) => {
                    if (field.value && field.confidence > 0.5) {
                        this.collectedData[field.name] = field.value;
                    }
                });
                
                await this.form.updateFormData(this.collectedData);
                return await this.invalidField();
            } else {
                this.updateConversationHistory("I didn't quite understand that. Could you please try again?", 'assistant');
            }
            
        } catch (error) {
            console.error('Error processing response:', error);
            this.updateConversationHistory("I didn't quite understand that. Could you please try again?", 'assistant');
        }
    }

    async completeConversation() {
        const summary = Object.keys(this.collectedData).length > 0 
            ? `I've collected: ${Object.entries(this.collectedData)
                .map(([field, value]) => `${field}: ${value}`)
                .join(', ')}`
            : "All done!";
            
        const message = `Perfect! ${summary} Your form is now complete and ready to submit.`;
        
        this.updateConversationHistory(message, 'assistant');
        
        return {
            message: message,
            isComplete: true,
            collectedData: this.collectedData
        };
    }

    getProgress() {
        const totalFields = this.form ? this.form.getFillableFields().length : 0;
        const collectedCount = Object.keys(this.collectedData).length;
        return {
            current: collectedCount,
            total: totalFields,
            percentage: totalFields > 0 ? Math.round((collectedCount / totalFields) * 100) : 0
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
        this.currentRequestedFields = null;
    }
}