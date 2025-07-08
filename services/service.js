class FormsService {
    constructor() {
        this.baseUrl = 'http://localhost:8000/api/v1';
        this.daLiveBaseUrl = 'https://admin.da.live/source/jalagari/aem-forms';
    }

    // File upload service
    async uploadFile(file) {
        // Generate unique filename to avoid conflicts
        const timestamp = Date.now();
        const fileExtension = file.name.split('.').pop();
        const baseName = file.name.replace(/\.[^/.]+$/, '');
        const filename = `${baseName}_${timestamp}.${fileExtension}`;
        const uploadUrl = `${this.daLiveBaseUrl}/tmp/${filename}`;
        
        const formData = new FormData();
        formData.append('data', file);
        
        const response = await fetch(uploadUrl, {
            method: 'PUT',
            body: formData
        });
        
        if (!response.ok) {
            throw new Error(`Upload failed with status: ${response.status}`);
        }
        
        return uploadUrl;
    }

    // Form creation service
    async createForm(formData) {
        const { formName, prompt, fileUrl, url, detailLevel } = formData;
        
        // Construct the API payload
        const payload = {
            detail_level: detailLevel || 'STANDARD',
            generate_json: "true",
            name: formName,
            text: prompt,
            path: fileUrl,
            form_url: url
        };

        console.log('Calling form creation API with payload:', payload);

        const response = await fetch(`${this.baseUrl}/flow/kickoff`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`API request failed with status ${response.status}: ${errorText}`);
        }

        const result = await response.json();
        console.log('Form creation API response:', result);
        
        return result;
    }

    // Form brief fetching service
    async fetchFormBrief(formName) {
        if (!formName) {
            throw new Error('Form name is required');
        }

        const url = `${this.daLiveBaseUrl}/forms/${formName}/breif.html`;
        console.log('Fetching form brief from:', url);
        
        const response = await fetch(url);
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const markdown = await response.text();
        return markdown;
    }

    // Forms list service
    async fetchForms() {
        try {
            const response = await fetch(`${this.daLiveBaseUrl.replace('/source/jalagari/aem-forms', '')}/list/jalagari/aem-forms/forms`);
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const formsData = await response.json();
            return this.transformApiData(formsData);
            
        } catch (error) {
            console.error('Error fetching forms:', error);
            throw new Error(`Failed to load forms: ${error.message}`);
        }
    }

    // Delete form service
    async deleteForm(form) {
        try {
            // Extract path without the leading slash for the API
            const pathForApi = form.path.startsWith('/') ? form.path.substring(1) : form.path;
            const deleteUrl = `${this.daLiveBaseUrl}/${pathForApi.replace('jalagari/aem-forms', '')}`;
            
            const response = await fetch(deleteUrl, {
                method: 'DELETE',
                headers: {
                    'Content-Type': 'application/json',
                }
            });

            if (!response.ok) {
                throw new Error(`Failed to delete form: ${response.status}`);
            }

            console.log(`Form "${form.name}" deleted successfully`);
            return true;
            
        } catch (error) {
            console.error('Error deleting form:', error);
            throw new Error(`Error deleting form: ${error.message}`);
        }
    }

    // Data transformation helper
    transformApiData(formsData) {
        return formsData.map((form, index) => ({
            id: index + 1,
            name: form.name,
            lastModified: this.formatDate(form.lastModified),
            path: form.path,
            ext: form.ext,
            rawTimestamp: form.lastModified
        }));
    }

    // Date formatting helper
    formatDate(timestamp) {
        try {
            const date = new Date(timestamp);
            return date.toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            });
        } catch (error) {
            return 'Invalid Date';
        }
    }

    // Save form brief service
    async saveFormBrief(formName, content) {
        if (!formName || !content) {
            throw new Error('Form name and content are required');
        }

        // This would be the actual API call to save the form brief
        // For now, just logging the action
        console.log('Saving form brief for:', formName);
        console.log('Content:', content);
        
        return new Promise((resolve) => {
            setTimeout(() => {
                resolve(true);
            }, 500);
        });
    }

    // Error handling helper
    handleApiError(error, operation) {
        console.error(`Error during ${operation}:`, error);
        
        if (error.name === 'TypeError' && error.message.includes('fetch')) {
            return `Network error during ${operation}. Please check your connection and try again.`;
        }
        
        if (error.message.includes('404')) {
            return `Resource not found during ${operation}. Please verify the form exists.`;
        }
        
        if (error.message.includes('403')) {
            return `Access denied during ${operation}. Please check your permissions.`;
        }
        
        if (error.message.includes('500')) {
            return `Server error during ${operation}. Please try again later.`;
        }
        
        return `Failed to ${operation}: ${error.message}`;
    }
}

// Create and export a singleton instance
const formsService = new FormsService();
export default formsService;
