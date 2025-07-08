import formsService from '../../services/service.js';

class EditInterface {
  constructor() {
    this.formName = '';
    this.isLoadingForm = false;
    this.reportContent = '';
    this.easyMDEInstance = null;
    this.container = null;
  }

  // Extract form name from URL hash
  getFormNameFromURL() {
    const hash = window.location.hash;
    if (hash && hash.length > 1) {
      // Remove the # character and return the form name
      return hash.substring(1);
    }
    return null;
  }

  // Fetch form brief from DA Live
  async fetchFormBrief(formName) {
    if (!formName) return;

    this.isLoadingForm = true;
    this.reportContent = `Loading form brief for: ${formName}...`;
    this.updateInterface();
    
    try {
      const markdown = await formsService.fetchFormBrief(formName);
      this.reportContent = markdown;
      
      console.log('Form brief loaded successfully');
      
    } catch (error) {
      console.error('Error fetching form brief:', error);
      this.reportContent = `# Error Loading Form Brief

## Form: ${formName}

Error: ${formsService.handleApiError(error, 'fetch form brief')}`;
    } finally {
      this.isLoadingForm = false;
      this.updateInterface();
    }
  }

  // Initialize form data on component load
  async initializeFormData() {
    const formName = this.getFormNameFromURL();
    
    if (formName) {
      this.formName = formName;
      await this.fetchFormBrief(formName);
    } else {
      this.reportContent = `# No Form Selected`;
    }
  }

  // Listen for hash changes
  handleHashChange() {
    const newFormName = this.getFormNameFromURL();
    if (newFormName && newFormName !== this.formName) {
      this.formName = newFormName;
      this.fetchFormBrief(newFormName);
    }
  }

  // Handle save action
  async handleSave() {
    let contentToSave = this.reportContent;
    
    // If EasyMDE is active, get content from editor
    if (this.easyMDEInstance) {
      contentToSave = this.easyMDEInstance.value();
    }
    
    if (this.formName && contentToSave) {
      console.log('Saving form brief for:', this.formName);
      console.log('Content to save:', contentToSave);
      
      try {
        await formsService.saveFormBrief(this.formName, contentToSave);
        alert(`Form brief saved successfully for: ${this.formName}`);
      } catch (error) {
        console.error('Error saving form brief:', error);
        alert(`Failed to save form brief: ${formsService.handleApiError(error, 'save form brief')}`);
      }
    } else {
      alert('No form brief to save');
    }
  }

  // Handle editor action
  handleEditor() {
    if (this.formName) {
      console.log('Switching to editor for:', this.formName);
      // TODO: Navigate to editor view or show editor interface
      // For now, just show an alert
      alert(`Editor functionality will be implemented for form: ${this.formName}`);
    } else {
      alert('No form selected for editing');
    }
  }

  // Initialize EasyMDE editor
  initializeEasyMDE() {
    // Check if EasyMDE is available
    if (typeof EasyMDE !== 'undefined') {
      const editorElement = this.container.querySelector('#editor');
      if (editorElement && !this.easyMDEInstance) {
        this.easyMDEInstance = new EasyMDE({
          element: editorElement,
          autofocus: true,
          placeholder: "Start writing markdown...",
          spellChecker: false,
          status: false,
          toolbar: [
            "bold", "italic", "heading", "|",
            "quote", "unordered-list", "ordered-list", "|",
            "link", "image", "|",
            "preview", "side-by-side", "fullscreen", "|",
            "guide"
          ]
        });
        
        // Set initial content if available
        if (this.reportContent) {
          this.easyMDEInstance.value(this.reportContent);
        }
        
        console.log('EasyMDE editor initialized');
      }
    } else {
      // EasyMDE not loaded yet, try again in a bit
      setTimeout(() => this.initializeEasyMDE(), 100);
    }
  }

  // Update the interface
  updateInterface() {
    if (!this.container) return;
    
    // Update form name in right panel top nav
    const rightTopNavItem = this.container.querySelector('.right-panel sp-top-nav-item');
    if (rightTopNavItem) {
      rightTopNavItem.textContent = `📋 Form${this.formName ? ` - ${this.formName}` : ''}`;
    }
    
    // Update content area
    const rightContent = this.container.querySelector('.right-panel .panel-content');
    if (rightContent) {
      if (this.isLoadingForm) {
        rightContent.innerHTML = `
          <div style="text-align: center; padding: 40px;">
            <sp-progress-circle indeterminate size="l"></sp-progress-circle>
            <p style="margin-top: 16px;">Loading form brief...</p>
          </div>
        `;
      } else {
        rightContent.innerHTML = '<textarea id="editor"></textarea>';
        // Initialize EasyMDE after DOM update
        setTimeout(() => this.initializeEasyMDE(), 100);
      }
    }
  }

  // Create the interface
  createInterface() {
    const container = document.createElement('div');
    container.className = 'edit-interface';
    
    container.innerHTML = `
      <sp-split-view
        resizable
        primary-min="300"
        secondary-min="300"
        primary-size="400"
        label="Resize the chat and form brief panels"
        style="height: 100vh; width: 100%;"
      >
        <div class="left-panel">
          <sp-top-nav>
            <sp-top-nav-item href="#">💬 Forms Experience Builder</sp-top-nav-item>
          </sp-top-nav>
          <div class="panel-content">
            ${this.formName ? `
              <div class="chat-area">
                <div class="chat-messages">
                  <sp-card>
                    <div slot="heading">AI Assistant</div>
                    <div slot="content">
                      Hello! I'm ready to help you with the <strong>${this.formName}</strong> form. 
                      Ask me anything about the form brief or discuss improvements.
                    </div>
                  </sp-card>
                </div>
                <div class="chat-input">
                  <sp-textfield 
                    id="chat-input" 
                    placeholder="Type your message..." 
                    style="flex: 1; margin-right: 8px;">
                  </sp-textfield>
                  <sp-button variant="accent" id="send-btn">Send</sp-button>
                </div>
              </div>
            ` : `
              <div class="no-form">
                <sp-illustrated-message heading="No Form Selected">
                  <p>Add a form name to the URL hash to load a form brief.</p>
                  <p><strong>Example:</strong> #contact-form</p>
                </sp-illustrated-message>
              </div>
            `}
          </div>
        </div>
        
        <div class="right-panel">
          <sp-tabs selected="1" size="m">
            <sp-tab label="Brief" value="1"></sp-tab>
            <sp-tab label="Editor" value="2"></sp-tab>
            <sp-tab label="Preview" value="3"></sp-tab>
            <sp-tab-panel value="1">
                <div class="panel-content">
                        ${this.isLoadingForm ? `
                        <sp-progress-circle indeterminate size="l"></sp-progress-circle>
                        <p style="text-align: center; margin-top: 16px;">Loading form brief...</p>
                        ` : `
                        <textarea id="editor"></textarea>
                        `}
                    </div>
            </sp-tab-panel>
            <sp-tab-panel value="2">
                <iframe src="https://www.google.com" width="100%" height="100%"></iframe>
            </sp-tab-panel>
            <sp-tab-panel value="3">Content for Preview</sp-tab-panel>
        </sp-tabs>
          
        </div>
      </sp-split-view>
    `;
    
    this.container = container;
    this.attachEventListeners();
    return container;
  }

  // Attach event listeners
  attachEventListeners() {
    if (!this.container) return;
    
    // Save button
    const saveBtn = this.container.querySelector('#save-btn');
    if (saveBtn) {
      saveBtn.addEventListener('click', () => this.handleSave());
    }
    
    // Editor button
    const editorBtn = this.container.querySelector('#editor-btn');
    if (editorBtn) {
      editorBtn.addEventListener('click', () => this.handleEditor());
    }
    
    // Chat input
    const chatInput = this.container.querySelector('#chat-input');
    const sendBtn = this.container.querySelector('#send-btn');
    
    if (chatInput && sendBtn) {
      sendBtn.addEventListener('click', () => {
        const message = chatInput.value.trim();
        if (message) {
          console.log('Chat message:', message);
          chatInput.value = '';
          // TODO: Implement chat functionality
        }
      });
      
      chatInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
          sendBtn.click();
        }
      });
    }
  }



  // Initialize the interface
  init() {
    // Listen for hash changes
    window.addEventListener('hashchange', () => this.handleHashChange());
    
    // Initialize form data
    this.initializeFormData();
    
    // Initialize EasyMDE editor after a short delay to ensure DOM is ready
    setTimeout(() => this.initializeEasyMDE(), 100);
    
    // Make component accessible for testing
    window.editInterface = this;
  }

  // Cleanup
  destroy() {
    window.removeEventListener('hashchange', () => this.handleHashChange());
    
    // Clean up EasyMDE instance
    if (this.easyMDEInstance) {
      this.easyMDEInstance.cleanup();
      this.easyMDEInstance = null;
    }
  }

  // Utility method for testing - allows manual form loading
  loadForm(formName) {
    if (formName) {
      window.location.hash = formName;
      this.formName = formName;
      this.fetchFormBrief(formName);
    }
  }


}

// Initialize the component
export default function decorate(block) {
  const editInterface = new EditInterface();
  const interfaceElement = editInterface.createInterface();
  
  // Replace the block with the interface
  block.replaceWith(interfaceElement);
  
  // Initialize the interface
  editInterface.init();
}
