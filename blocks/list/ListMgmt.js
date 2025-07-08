/**
 * ListMgmt - Business logic and data management for Adaptive Forms
 * Handles API operations, validation, and data transformation
 */
export class ListMgmt {
    constructor() {
        // API operations moved to FormsService
    }

    // Validation Logic
    validateFormName(name, existingForms = []) {
        if (!name || name.trim().length === 0) {
            return { valid: false, message: 'Form name is required' };
        }
        
        const trimmedName = name.trim();
        
        if (trimmedName.length < 3) {
            return { valid: false, message: 'Form name must be at least 3 characters long' };
        }
        
        if (trimmedName.length > 50) {
            return { valid: false, message: 'Form name must be less than 50 characters' };
        }
        
        // Check for alphabets and spaces only
        const alphabetsOnly = /^[a-zA-Z\s]+$/;
        if (!alphabetsOnly.test(trimmedName)) {
            return { valid: false, message: 'Form name should contain only letters and spaces' };
        }
        
        // Check if form name already exists
        const existingForm = existingForms.find(form => 
            form.name.toLowerCase() === trimmedName.toLowerCase()
        );
        
        if (existingForm) {
            return { valid: false, message: 'A form with this name already exists' };
        }
        
        return { valid: true };
    }

    // Data Operations
    sortData(data, columnKey) {
        return [...data].sort((a, b) => {
            let aVal = a[columnKey];
            let bVal = b[columnKey];
            
            // Use raw timestamp for sorting lastModified column
            if (columnKey === 'lastModified') {
                aVal = a.rawTimestamp || 0;
                bVal = b.rawTimestamp || 0;
            }
            
            if (aVal < bVal) return -1;
            if (aVal > bVal) return 1;
            return 0;
        });
    }

    removeFormFromData(data, formId) {
        return data.filter(item => item.id !== formId);
    }

    // Form Creation
    createFormUrl(formName) {
        return `/edit#${encodeURIComponent(formName)}`;
    }

    // Utility Methods
    getFormColumns() {
        return [
            { key: 'name', label: 'Form Name', sortable: true },
            { key: 'actions', label: 'Actions', sortable: false },
        ];
    }

    getFormValidationConfig() {
        return {
            minLength: 3,
            maxLength: 50,
            pattern: /^[a-zA-Z\s]+$/,
            allowedChars: 'letters and spaces only'
        };
    }

    // Event Factory Methods
    createFormEvent(eventName, detail = {}) {
        return new CustomEvent(eventName, {
            detail,
            bubbles: true
        });
    }

    // Error handling moved to FormsService
}
