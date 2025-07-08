import { ListMgmt } from './ListMgmt.js';
import formsService from '../../services/service.js';

class CreateForm {
    constructor() {
        this.listMgmt = new ListMgmt();
        this.existingForms = [];
        this.creationMethod = 'prompt'; // default to prompt method
        this.detailLevel = 'STANDARD'; // default detail level
        this.container = null;
        this.dialog = null;
        this.uploadedFileUrl = null;
        this.isUploading = false;
        this.isCreatingForm = false;
    }

    // Show error toast
    showErrorToast(message) {
        // Create toast element
        const toast = document.createElement('sp-toast');
        toast.setAttribute('variant', 'negative');
        toast.setAttribute('timeout', '6000');
        toast.setAttribute('open', '');
        toast.textContent = message;
        
        // Add to document body
        document.body.appendChild(toast);
        
        // Auto-remove after timeout
        setTimeout(() => {
            if (toast.parentNode) {
                toast.parentNode.removeChild(toast);
            }
        }, 6000);
    }

    // Handle creation method selection
    handleCreationMethodChange(event) {
        this.creationMethod = event.target.value;
        // Clear uploaded file when switching methods
        this.uploadedFileUrl = null;
        this.isUploading = false;
        this.isCreatingForm = false;
        // Reset detail level to default when switching methods
        this.detailLevel = 'STANDARD';
        this.updateFormInputs();
        this.updateDetailLevelDisplay();
        console.log('Creation method changed to:', this.creationMethod);
    }

    // Handle detail level selection
    handleDetailLevelChange(event) {
        this.detailLevel = event.target.value;
        this.updateDetailLevelDisplay();
        console.log('Detail level changed to:', this.detailLevel);
    }

    // Update detail level display
    updateDetailLevelDisplay() {
        if (this.dialog) {
            // Update selected state for detail level options
            this.dialog.querySelectorAll('.detail-option').forEach(option => {
                const radio = option.querySelector('input[type="radio"]');
                if (radio && radio.value === this.detailLevel) {
                    option.classList.add('selected');
                } else {
                    option.classList.remove('selected');
                }
            });
        }
    }

    // Validation methods - only used on form submission
    validateFormName(name) {
        return this.listMgmt.validateFormName(name, this.existingForms);
    }

    validatePrompt(prompt) {
        if (!prompt || prompt.trim().length < 10) {
            return { valid: false, message: 'Please provide a more detailed description (at least 10 characters)' };
        }
        return { valid: true };
    }

    validateUrl(url) {
        if (!url || url.trim().length === 0) {
            return { valid: false, message: 'Please enter a URL' };
        }
        if (!this.isValidUrl(url.trim())) {
            return { valid: false, message: 'Please enter a valid URL' };
        }
        return { valid: true };
    }

    // Handle image upload button click
    handleImageUploadClick() {
        if (this.dialog) {
            const imageInput = this.dialog.querySelector('#imageInput');
            if (imageInput) {
                imageInput.click();
            }
        }
    }

    // Handle image remove button click
    handleImageRemove() {
        if (this.dialog) {
            const imageInput = this.dialog.querySelector('#imageInput');
            if (imageInput) {
                imageInput.value = '';
                this.uploadedFileUrl = null;
                this.isUploading = false;
                this.updateImagePreview();
            }
        }
    }

    // Validate and upload image
    async handleImageInput(event) {
        const file = event.target.files[0];
        if (file) {
            const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'application/pdf'];
            if (!allowedTypes.includes(file.type)) {
                this.showErrorToast('Please upload an image file (JPEG, PNG, GIF) or PDF');
                event.target.value = '';
                return;
            } else if (file.size > 10 * 1024 * 1024) { // 10MB limit
                this.showErrorToast('File size should be less than 10MB');
                event.target.value = '';
                return;
            }
            
            // Start upload process
            this.isUploading = true;
            this.updateImagePreview();
            
            try {
                this.uploadedFileUrl = await formsService.uploadFile(file);
                console.log('File uploaded successfully:', this.uploadedFileUrl);
            } catch (error) {
                console.error('Upload failed:', error);
                this.showErrorToast('Failed to upload file. Please try again.');
                this.uploadedFileUrl = null;
                event.target.value = '';
            } finally {
                this.isUploading = false;
                this.updateImagePreview();
            }
        } else {
            this.uploadedFileUrl = null;
        }
        this.updateImagePreview();
    }

    // Methods moved to FormsService

    // Update form creation state
    updateFormCreationState() {
        if (this.dialog) {
            const confirmButton = this.dialog.querySelector('sp-button[slot="confirm"]');
            const cancelButton = this.dialog.querySelector('sp-button[slot="cancel"]');
            
            if (this.isCreatingForm) {
                if (confirmButton) {
                    confirmButton.disabled = true;
                    confirmButton.textContent = 'Creating Form...';
                }
                if (cancelButton) {
                    cancelButton.disabled = true;
                }
            } else {
                if (confirmButton) {
                    confirmButton.disabled = false;
                    confirmButton.textContent = 'Create Form';
                }
                if (cancelButton) {
                    cancelButton.disabled = false;
                }
            }
        }
    }

    // Update image preview
    updateImagePreview() {
        if (this.dialog) {
            const imageInput = this.dialog.querySelector('#imageInput');
            const uploadedFiles = this.dialog.querySelector('.uploaded-files');
            const fileName = uploadedFiles.querySelector('.file-name');
            const uploadProgress = this.dialog.querySelector('.upload-progress');
            const dropzone = this.dialog.querySelector('.file-upload-dropzone');
            
            if (imageInput && imageInput.files[0]) {
                const file = imageInput.files[0];
                
                if (this.isUploading) {
                    fileName.innerHTML = `<span class="upload-status">📤 Uploading ${file.name}...</span>`;
                    uploadedFiles.style.display = 'block';
                    uploadProgress.style.display = 'flex';
                    dropzone.classList.add('uploading');
                } else if (this.uploadedFileUrl) {
                    fileName.innerHTML = `<span class="upload-status success">✅ ${file.name} uploaded successfully</span>`;
                    uploadedFiles.style.display = 'block';
                    uploadProgress.style.display = 'none';
                    dropzone.classList.remove('uploading');
                    dropzone.classList.add('uploaded');
                } else {
                    fileName.innerHTML = `<span class="upload-status error">❌ ${file.name} - Upload failed</span>`;
                    uploadedFiles.style.display = 'block';
                    uploadProgress.style.display = 'none';
                    dropzone.classList.remove('uploading', 'uploaded');
                }
            } else {
                uploadedFiles.style.display = 'none';
                uploadProgress.style.display = 'none';
                dropzone.classList.remove('uploading', 'uploaded');
            }
        }
    }

    // Helper method to validate URL
    isValidUrl(string) {
        try {
            const url = new URL(string);
            return url.protocol === 'http:' || url.protocol === 'https:';
        } catch (_) {
            return false;
        }
    }

    // Removed updateErrorDisplay method - using toast notifications now

    // Update form inputs visibility
    updateFormInputs() {
        if (this.dialog) {
            const promptSection = this.dialog.querySelector('.prompt-section');
            const imageSection = this.dialog.querySelector('.image-section');
            const urlSection = this.dialog.querySelector('.url-section');

            if (promptSection) promptSection.style.display = this.creationMethod === 'prompt' ? 'block' : 'none';
            if (imageSection) imageSection.style.display = this.creationMethod === 'image' ? 'block' : 'none';
            if (urlSection) urlSection.style.display = this.creationMethod === 'url' ? 'block' : 'none';

            // Update selected state
            this.dialog.querySelectorAll('.method-option').forEach(option => {
                const radio = option.querySelector('input[type="radio"]');
                if (radio && radio.value === this.creationMethod) {
                    option.classList.add('selected');
                } else {
                    option.classList.remove('selected');
                }
            });
        }
    }

    // Dialog event handlers
    async handleDialogConfirm(event) {
        event.preventDefault(); // Always prevent default form submission
        
        const formNameInput = this.dialog.querySelector('#formName');
        const formName = formNameInput.value.trim();
        
        // Prevent submission while uploading or creating form
        if (this.isUploading) {
            this.showErrorToast('Please wait for the file upload to complete');
            return;
        }
        
        if (this.isCreatingForm) {
            return;
        }
        
        // Validate form name
        const formNameValidation = this.validateFormName(formName);
        if (!formNameValidation.valid) {
            this.showErrorToast(formNameValidation.message);
            return;
        }

        // Validate creation method specific inputs
        if (this.creationMethod === 'prompt') {
            const promptInput = this.dialog.querySelector('#promptInput');
            const prompt = promptInput.value.trim();
            const promptValidation = this.validatePrompt(prompt);
            if (!promptValidation.valid) {
                this.showErrorToast(promptValidation.message);
                return;
            }
        } else if (this.creationMethod === 'image') {
            const imageInput = this.dialog.querySelector('#imageInput');
            
            if (!imageInput.files[0]) {
                this.showErrorToast('Please select an image or PDF file');
                return;
            } else if (!this.uploadedFileUrl) {
                this.showErrorToast('Please wait for the file to upload or try uploading again');
                return;
            }
        } else if (this.creationMethod === 'url') {
            const urlInput = this.dialog.querySelector('#urlInput');
            const url = urlInput.value.trim();
            const urlValidation = this.validateUrl(url);
            if (!urlValidation.valid) {
                this.showErrorToast(urlValidation.message);
                return;
            }
        }
        
        // Collect form data based on creation method
        const formData = {
            formName,
            prompt: this.dialog.querySelector('#promptInput').value.trim(),
            fileUrl: this.uploadedFileUrl,
            url: this.dialog.querySelector('#urlInput').value.trim(),
            detailLevel: this.detailLevel
        };

        // Dispatch event to parent component
        if (this.onFormCreate) {
            this.onFormCreate(formData);
        }
        
        // Call the form creation API
        this.isCreatingForm = true;
        this.updateFormCreationState();
        
        try {
            const result = await formsService.createForm(formData);
            
            // Handle successful creation - redirect to edit page
            const editUrl = `/edit#${encodeURIComponent(formData.formName)}`;
            console.log('Form created successfully, redirecting to:', editUrl);
            window.location.href = editUrl;
        } catch (error) {
            console.error('Form creation failed:', error);
            // Show error using spectrum toast
            const errorMessage = formsService.handleApiError(error, 'create form');
            this.showErrorToast(errorMessage);
        } finally {
            this.isCreatingForm = false;
            this.updateFormCreationState();
        }
    }

    handleDialogCancel(event) {
        // Reset form state when dialog is cancelled
        this.creationMethod = 'prompt';
        this.detailLevel = 'STANDARD';
        this.uploadedFileUrl = null;
        this.isUploading = false;
        this.isCreatingForm = false;
        console.log('Create form dialog cancelled');
    }

    // Create and return DOM element
    createElement() {
        const element = document.createElement('div');
        element.className = 'create-form-component';
        
        element.innerHTML = `
            <overlay-trigger type="modal" receives-focus="auto">
                <sp-dialog-wrapper
                    slot="click-content"
                    headline="Create New Adaptive Form"
                    confirm-label="Create Form"
                    cancel-label="Cancel"
                    size="l"
                    underlay
                >
                    <div class="form-creation-dialog">
                        <div class="form-section">
                            <sp-field-label for="formName" required>Form Name</sp-field-label>
                            <sp-textfield 
                                id="formName" 
                                name="formName" 
                                placeholder="Enter form name (letters only)..." 
                                pattern="[a-zA-Z\\s]+"
                                title="Only letters and spaces are allowed"
                                required 
                            ></sp-textfield>
                            <sp-help-text slot="help-text">
                                Use only letters and spaces (e.g., "Contact Form", "User Survey")
                            </sp-help-text>
                        </div>

                        <div class="form-section">
                            <sp-field-label>How would you like to create your form?</sp-field-label>
                            <div class="creation-method-options">
                                <label class="method-option selected">
                                    <input type="radio" name="creationMethod" value="prompt" checked>
                                    <div class="method-content">
                                        <strong>Describe Your Requirements</strong>
                                        <div class="method-description">Tell us what kind of form you need in plain English</div>
                                    </div>
                                </label>
                                
                                <label class="method-option">
                                    <input type="radio" name="creationMethod" value="image">
                                    <div class="method-content">
                                        <strong>Upload Form Image/PDF</strong>
                                        <div class="method-description">Upload an image or PDF of an existing form to recreate</div>
                                    </div>
                                </label>
                                
                                <label class="method-option">
                                    <input type="radio" name="creationMethod" value="url">
                                    <div class="method-content">
                                        <strong>Existing Form URL</strong>
                                        <div class="method-description">Provide a URL to an existing form that you'd like to recreate</div>
                                    </div>
                                </label>
                            </div>
                        </div>

                        <div class="creation-inputs-section">
                            <div class="prompt-section">
                                <div class="detail-level-section">
                                    <sp-field-label>Detail Level</sp-field-label>
                                    <div class="detail-level-options">
                                        <label class="detail-option">
                                            <input type="radio" name="detailLevel" value="SIMPLE">
                                            <div class="detail-content">
                                                <strong>Simple</strong>
                                            </div>
                                        </label>
                                        
                                        <label class="detail-option selected">
                                            <input type="radio" name="detailLevel" value="STANDARD" checked>
                                            <div class="detail-content">
                                                <strong>Standard</strong>
                                            </div>
                                        </label>
                                        
                                        <label class="detail-option">
                                            <input type="radio" name="detailLevel" value="COMPREHENSIVE">
                                            <div class="detail-content">
                                                <strong>Comprehensive</strong>
                                            </div>
                                        </label>
                                    </div>
                                </div>
                                
                                <sp-field-label for="promptInput" required>What kind of form do you need?</sp-field-label>
                                                                 <sp-textfield 
                                     id="promptInput" 
                                     name="promptInput" 
                                     placeholder="Example: I need a contact form with fields for name, email, phone number, and a message. Please include validation for the email field."
                                     multiline
                                     rows="4"
                                     required
                                 ></sp-textfield>
                            </div>

                            <div class="image-section" style="display: none;">
                                <sp-field-label for="imageInput" required>Upload Form Image or PDF</sp-field-label>
                                <div class="file-upload-area">
                                    <input type="file" id="imageInput" class="hidden-file-input" accept="image/*,.pdf">
                                    <div class="file-upload-dropzone">
                                        <div class="upload-icon">📁</div>
                                        <p class="upload-text">Click to select or drag and drop</p>
                                        <p class="upload-subtext">Supports: JPG, PNG, GIF, PDF (max 10MB)</p>
                                        <div class="upload-progress" style="display: none;">
                                            <div class="upload-spinner">⏳</div>
                                            <span>Uploading...</span>
                                        </div>
                                    </div>
                                </div>
                                <div class="uploaded-files" style="display: none;">
                                    <div class="file-preview">
                                        <span class="file-name"></span>
                                        <button type="button" class="remove-file-btn">×</button>
                                    </div>
                                </div>
                                <sp-help-text>
                                    Upload an image or PDF of an existing form that you would like to recreate
                                </sp-help-text>
                            </div>

                            <div class="url-section" style="display: none;">
                                <sp-field-label for="urlInput" required>Enter the URL of the form you want to recreate</sp-field-label>
                                <sp-textfield 
                                    id="urlInput" 
                                    name="urlInput" 
                                    placeholder="https://example.com/contact-form"
                                    required
                                ></sp-textfield>
                                <sp-help-text>
                                    Provide the complete URL of an existing form that you would like to analyze and recreate
                                </sp-help-text>
                            </div>
                        </div>
                    </div>
                </sp-dialog-wrapper>
                <sp-button slot="trigger" variant="accent">
                    Create New Form
                </sp-button>
            </overlay-trigger>
        `;

        // Get dialog wrapper reference
        const dialogWrapper = element.querySelector('sp-dialog-wrapper');
        this.dialog = dialogWrapper;

        // Add event listeners for form inputs
        const imageInput = element.querySelector('#imageInput');
        const fileUploadDropzone = element.querySelector('.file-upload-dropzone');
        const removeFileBtn = element.querySelector('.remove-file-btn');

        imageInput.addEventListener('change', (e) => this.handleImageInput(e));
        fileUploadDropzone.addEventListener('click', () => this.handleImageUploadClick());
        removeFileBtn.addEventListener('click', () => this.handleImageRemove());

        // Radio buttons for creation method
        const radioButtons = element.querySelectorAll('input[name="creationMethod"]');
        radioButtons.forEach(radio => {
            radio.addEventListener('change', (e) => this.handleCreationMethodChange(e));
        });

        // Radio buttons for detail level
        const detailLevelButtons = element.querySelectorAll('input[name="detailLevel"]');
        detailLevelButtons.forEach(radio => {
            radio.addEventListener('change', (e) => this.handleDetailLevelChange(e));
        });

        // Dialog events
        dialogWrapper.addEventListener('confirm', (e) => this.handleDialogConfirm(e));
        dialogWrapper.addEventListener('cancel', (e) => this.handleDialogCancel(e));

        this.container = element;
        return element;
    }
}

export { CreateForm };
