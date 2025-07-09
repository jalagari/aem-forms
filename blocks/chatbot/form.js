import { fetchForm } from "../form/form.js";
import { createFormInstance} from "../form/rules/model/afb-runtime.js";

// Define fillable field types (excluding display-only and containers)
const fillableFieldTypes = new Set([
    'text-input',
    'multiline-input', 
    'number-input',
    'email',
    'password',
    'tel',
    'url',
    'date-input',
    'datetime-input',
    'file-input',
    'drop-down',
    'radio-group',
    'checkbox-group',
    'checkbox',
    'range',
    'color',
    'captcha',
    'panel'
]);

export default class Form extends EventTarget {
    constructor() {
        super();
        this.url = null;
        this.originalFormDef = null;
        this.formDef = null;
        this.instance = null;
        this.fieldsArray = [];
        this.fillableFields = [];
        this.isProcessingQueue = false;
    }

    _isFillableField(item) {
        if(!fillableFieldTypes.has(item.fieldType)) {
            return false;
        }

        if(!item.value || !item.valid) {
            if (item.visible === false || item.enabled === false || item.readOnly === true) {
                return false;
            }
        }
        return true;
    }

    /**
     * Parse the form state to extract fillable fields
     * @returns {Object} - { fieldMap: Map, fieldsArray: Array }
     */
    _extractFillableFields() {
        // Clear previous data
        this.fieldsArray = [];

        /**
         * Recursively extract fields from form structure
         * @param {Object} container - Form container (form or panel)
         * @param {Array} currentPath - Current path for nested fields
         */
        const extractFields = (container, currentPath = []) => {
            if (!container || !container.items) return;

            // Get the order of items if available
            const itemsOrder = container[':itemsOrder'] || [];
            const itemsMap = new Map();

            // Create a map of items by name for quick lookup
            if (container[':items']) {
                Object.keys(container[':items']).forEach(key => {
                    itemsMap.set(key, container[':items'][key]);
                });
            }

            // Also map items array by name/id
            if (container.items) {
                container.items.forEach(item => {
                    if (item.name) {
                        itemsMap.set(item.name, item);
                    } else if (item.id) {
                        itemsMap.set(item.id, item);
                    }
                });
            }

            // Process items in the specified order
            const processedItems = new Set();
            
            // First, process items in the specified order
            itemsOrder.forEach(itemName => {
                const item = itemsMap.get(itemName);
                if (item) {
                    processItem(item, [...currentPath, itemName]);
                    processedItems.add(itemName);
                }
            });

            // Then process any remaining items not in the order
            itemsMap.forEach((item, key) => {
                if (!processedItems.has(key)) {
                    processItem(item, [...currentPath, key]);
                }
            });
        };

        /**
         * Process individual form item
         * @param {Object} item - Form field or panel
         * @param {Array} path - Path to this item
         */
        const processItem = (item, path) => {
            if (!item) return;

            if(!this._isFillableField(item)) {
                return;
            }

            const fieldType = item.fieldType;

            // If it's a panel, recursively process its children
            if (fieldType === 'panel') {
                extractFields(item, path);
                return;
            }

            const field = this.getField(item.id);

            this.fieldsArray.push(field);
            this.fillableFields.push(field);
        };

        // Start extraction from the root form
        if (this.instance) {
            extractFields(this.instance);
        }
    }
    
    handleFormEvent(e) {
        console.log("handleFormEvent", e);
        const { payload } = e;
        const { changes, field: fieldModel } = payload;
        const {
            id, name, fieldType, ':type': componentType, readOnly, type, displayValue, displayFormat, displayValueExpression,
            activeChild,
        } = fieldModel;
        const field = this.getField(id);
        changes.forEach((change) => {
            const { propertyName, currentValue, prevValue } = change;
            switch (propertyName) {
            case 'valid':
                break;
            case 'validationMessage':
                break;
            case 'value':
                console.log(`Form field changed: ${field.label?.value}, ${field.value}, ${field.valid}`);
                if(field && field.value && !field.valid) {
                    const index = this.fillableFields.indexOf(field);
                    if(index !== -1) {
                        this.fillableFields.splice(index, 1);
                        console.log(`Removed fillable field: ${field.label?.value}`);
                    } else {
                        console.log(`Unable to remove fillable field: ${field.label?.value}`);
                    }
                }
                break;
            case 'visible':
                break;
            case 'enabled':
                break;
            case 'readOnly':
            case 'required':
            case 'label':
            case 'description':
            case 'items':
            case 'activeChild': 
            default:
                break;
            }
        });
    }

    subscribe() {
        this.instance.subscribe((e) => {
            this.handleFormEvent(e);
          }, 'fieldChanged');

        this.instance.subscribe((e) => {
            this.handleFormEvent(e);
          }, 'change');

          this.instance.subscribe((e) => {
            this.handleFormEvent(e);
          }, 'submitSuccess');

        this.instance.subscribe((e) => {
            this.handleFormEvent(e);
          }, 'submitFailure');
        
        this.instance.subscribe((e) => {
            this.handleFormEvent(e);
          }, 'submitError');
    }

    async createFormInstance(url) {
        this.url = url;
        this.originalFormDef = await fetchForm(this.url);
        this.instance = await createFormInstance(this.originalFormDef);
        this.subscribe();
        this._extractFillableFields();
        
        // Dispatch form ready event
        this.dispatchEvent(new CustomEvent('formReady', {
            detail: {
                url: this.url,
                state: this.state,
                fillableFields: this.fillableFields,
                totalFields: this.fieldsArray.length
            }
        }));
    }

    createFormInstanceFromData(formData) {
        // Create a form definition from the provided data
        this.formDef = {
            title: formData.title,
            items: formData.fields.map(field => ({
                id: field.name,
                name: field.name,
                fieldType: this.mapFieldType(field.type),
                label: { value: field.label },
                required: field.required || false,
                ...this.getFieldProperties(field)
            }))
        };
        
        this.instance = createFormInstance(this.formDef);
        this.subscribe();
        this._extractFillableFields();
        
        this.dispatchEvent(new CustomEvent('formReady', {
            detail: {
                formDef: this.formDef,
                fillableFields: this.fillableFields,
                totalFields: this.fieldsArray.length
            }
        }));
    }

    mapFieldType(type) {
        const typeMap = {
            'text': 'text-input',
            'email': 'email',
            'tel': 'tel',
            'password': 'password',
            'textarea': 'multiline-input',
            'number': 'number-input',
            'date': 'date-input',
            'time': 'datetime-input',
            'select': 'drop-down',
            'radio': 'radio-group',
            'checkbox': 'checkbox-group',
            'boolean': 'checkbox'
        };
        return typeMap[type] || 'text-input';
    }

    getFieldProperties(field) {
        const properties = {};
        
        if (field.options) {
            properties.items = field.options.map(option => ({
                value: option,
                text: option
            }));
        }
        
        if (field.min !== undefined) properties.min = field.min;
        if (field.max !== undefined) properties.max = field.max;
        
        return properties;
    }

    getFillableFields() {
        return this.fillableFields;
    }

    getInvalidFields() {
        const invalidFieldIds = this.instance._invalidFields;
        const invalidFields = [];
        invalidFieldIds.forEach(fieldId => {
            const field = this.getField(fieldId);
            if (field) {
                invalidFields.push(field.fieldId);
            }
        });
        return invalidFields;
    }

    /**
     * Get a specific field by ID
     * @param {string} fieldId - Field identifier
     * @returns {Object|null} - Field object or null if not found
     */
    getField(fieldId) {
        return this.instance._fields[fieldId] || null;
    }

    /**
     * Get fields by type
     * @param {string} fieldType - Field type to filter by
     * @returns {Array} - Array of fields matching the type
     */
    getFieldsByType(fieldType) {
        return this.fieldsArray.filter(field => field.fieldType === fieldType);
    }

    /**
     * Get field statistics
     * @returns {Object} - Statistics about the form fields
     */
    getFieldStats() {
        const stats = {
            total: this.fieldsArray.length,
            required: 0,
            optional: 0,
            byType: {}
        };

        this.fieldsArray.forEach(field => {
            // Count required vs optional
            if (field.required) {
                stats.required++;
            } else {
                stats.optional++;
            }

            // Count by type
            const type = field.fieldType;
            stats.byType[type] = (stats.byType[type] || 0) + 1;
        });

        return stats;
    }

    async updateFormData(data) {
        console.log("Updating form data", data);
        this.instance.importData(data);
        console.log("Form data updated", this.instance.getState(), this.instance._eventQueue._isProcessing);
    }

    /**
     * Refresh the form state and re-parse fields
     */
    refresh() {
        if (this.instance) {
            this.state = this.instance.getState();
            this.fieldMap.clear();
            this.fieldsArray = [];
        }
    }

    getThankYouMessage() {
        return this.instance?.properties?.thankYouMessageContent || "Thank you for your submission!";
    }
}