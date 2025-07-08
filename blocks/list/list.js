import { ListMgmt } from './ListMgmt.js';
import { CreateForm } from './create.js';
import formsService from '../../services/service.js';

// The Spectrum Web Components production bundle is loaded via script tag in head.html
// No need to import individual components when using the bundle

class List {
    constructor() {
        this.listMgmt = new ListMgmt();
        this.data = [];
        this.columns = this.listMgmt.getFormColumns();
        this.loading = false;
        this.error = null;
        this.container = null;
        
        this.initializeComponent();
    }

    // Initialize component state
    initializeComponent() {
        this.fetchForms();
    }

    // API Operations - Using FormsService
    async fetchForms(skipViewUpdate = false) {
        if (!skipViewUpdate) {
            this.setLoadingState(true);
        }

        try {
            this.data = await formsService.fetchForms();
            console.log('Forms loaded:', this.data);
        } catch (error) {
            this.error = formsService.handleApiError(error, 'fetch forms');
        } finally {
            if (!skipViewUpdate) {
                this.setLoadingState(false);
            }
        }
    }

    // Show success toast
    showSuccessToast(message) {
        const toast = document.createElement('sp-toast');
        toast.setAttribute('variant', 'positive');
        toast.setAttribute('timeout', '4000');
        toast.setAttribute('open', '');
        toast.textContent = message;
        
        document.body.appendChild(toast);
        
        setTimeout(() => {
            if (toast.parentNode) {
                toast.parentNode.removeChild(toast);
            }
        }, 4000);
    }

    // Show error toast
    showErrorToast(message) {
        const toast = document.createElement('sp-toast');
        toast.setAttribute('variant', 'negative');
        toast.setAttribute('timeout', '6000');
        toast.setAttribute('open', '');
        toast.textContent = message;
        
        document.body.appendChild(toast);
        
        setTimeout(() => {
            if (toast.parentNode) {
                toast.parentNode.removeChild(toast);
            }
        }, 6000);
    }

    // Delete form with confirmation
    async deleteForm(form) {
        if (!confirm(`Are you sure you want to delete "${form.name}"? This action cannot be undone.`)) {
            return;
        }

        try {
            await formsService.deleteForm(form);
            this.data = this.listMgmt.removeFormFromData(this.data, form.id);
            
            // Only refresh table if we're in table view, otherwise full update
            if (this.container?.querySelector('.table-wrapper')) {
                this.refreshTable();
            } else {
                this.updateView();
            }
            
            this.showSuccessToast(`Form "${form.name}" deleted successfully`);
            
            if (this.container) {
                this.container.dispatchEvent(this.listMgmt.createFormEvent('form-deleted', { form }));
            }
        } catch (error) {
            const errorMessage = formsService.handleApiError(error, 'delete form');
            this.showErrorToast(errorMessage);
        }
    }

    // State management methods
    setLoadingState(loading) {
        this.loading = loading;
        this.error = null;
        this.updateView();
    }

    // Event handlers

    handleSort(columnKey) {
        this.data = this.listMgmt.sortData(this.data, columnKey);
        this.updateView();
    }

    handleEdit(form) {
        console.log('Edit form:', form);
        const editUrl = `/edit#${encodeURIComponent(form.name)}`;
        window.location.href = editUrl;
    }

    handlePreview(form) {
        console.log('Preview form:', form);
        const previewUrl = `/preview#${encodeURIComponent(form.name)}`;
        window.location.href = previewUrl;
    }



    // Refresh only the table content, not the toolbar
    refreshTable() {
        const tableWrapper = this.container?.querySelector('.table-wrapper');
        if (tableWrapper) {
            // Clear current table
            tableWrapper.innerHTML = '';
            // Add new table with updated data
            tableWrapper.appendChild(this.createTable());
        }
    }

    async handleRefresh() {
        console.log('Refreshing forms list...');
        
        // Find the refresh button and show loading state
        const refreshButton = this.container?.querySelector('sp-button[variant="secondary"]');
        if (refreshButton) {
            refreshButton.disabled = true;
            refreshButton.textContent = 'Refreshing...';
        }
        
        try {
            // Fetch new data without updating entire view
            await this.fetchForms(true);
            // Only refresh the table, keep toolbar persistent
            this.refreshTable();
            this.showSuccessToast('Forms list refreshed successfully');
        } catch (error) {
            this.showErrorToast('Failed to refresh forms list');
            console.error('Refresh failed:', error);
        } finally {
            // Restore refresh button
            if (refreshButton) {
                refreshButton.disabled = false;
                refreshButton.textContent = 'Refresh';
            }
        }
    }

    // Handle form creation event from CreateForm component
    handleFormCreate(event) {
        const { formName, creationMethod, prompt, fileUrl, fileName, url } = event.detail;
        console.log('Form creation initiated:', { formName, creationMethod, prompt, fileUrl, fileName, url });
        
        // Here you could integrate with your forms experience builder API
        // to create the form based on the provided parameters
        
        // For now, just log the different creation methods
        switch (creationMethod) {
            case 'prompt':
                console.log('Creating form from prompt:', prompt);
                break;
            case 'image':
                console.log('Creating form from uploaded image/PDF:', fileName);
                console.log('Uploaded file URL:', fileUrl);
                break;
            case 'url':
                console.log('Creating form from URL:', url);
                break;
        }
        
        // Refresh the form list to include the new form
        this.fetchForms();
    }

    // Helper method to create CreateForm component
    createFormComponent() {
        const createForm = new CreateForm();
        createForm.existingForms = this.data;
        createForm.onFormCreate = (formData) => this.handleFormCreate({ detail: formData });
        return createForm.createElement();
    }

    // DOM creation methods
    createLoadingState() {
        const container = document.createElement('sp-theme');
        container.setAttribute('scale', 'medium');
        container.setAttribute('color', 'light');
        
        container.innerHTML = `
            <div class="table-container">
                <div class="empty-state">
                    <div class="empty-state-icon">⏳</div>
                    <h3>Loading forms...</h3>
                    <p>Please wait while we load your forms.</p>
                </div>
            </div>
        `;
        
        return container;
    }

    createErrorState() {
        const container = document.createElement('sp-theme');
        container.setAttribute('scale', 'medium');
        container.setAttribute('color', 'light');
        
        container.innerHTML = `
            <div class="table-container">
                <div class="empty-state">
                    <div class="empty-state-icon">❌</div>
                    <h3>Error loading forms</h3>
                    <p>${this.error}</p>
                </div>
            </div>
        `;
        
        // Add refresh button
        const refreshButton = document.createElement('sp-button');
        refreshButton.setAttribute('variant', 'accent');
        refreshButton.textContent = 'Try Again';
        refreshButton.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            this.handleRefresh();
        });
        
        const emptyState = container.querySelector('.empty-state');
        emptyState.appendChild(refreshButton);
        
        return container;
    }

    createEmptyState() {
        const container = document.createElement('sp-theme');
        container.setAttribute('scale', 'medium');
        container.setAttribute('color', 'light');
        
        container.innerHTML = `
            <div class="table-container">
                <div class="empty-state">
                    <div class="empty-state-icon">📋</div>
                    <h3>No forms found</h3>
                    <p>Create your first form to get started</p>
                </div>
            </div>
        `;
        
        // Add create form component and refresh button
        const emptyState = container.querySelector('.empty-state');
        emptyState.appendChild(this.createFormComponent());
        
        const refreshButton = document.createElement('sp-button');
        refreshButton.setAttribute('variant', 'secondary');
        refreshButton.textContent = 'Refresh';
        refreshButton.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            this.handleRefresh();
        });
        emptyState.appendChild(refreshButton);
        
        return container;
    }

    createToolbar() {
        const toolbar = document.createElement('div');
        toolbar.className = 'table-header-flex';
        
        const title = document.createElement('h3');
        title.className = 'table-title';
        title.textContent = 'Adaptive Forms';
        
        const actions = document.createElement('div');
        actions.className = 'table-actions-flex';
        
        actions.appendChild(this.createFormComponent());
        
        const refreshButton = document.createElement('sp-button');
        refreshButton.setAttribute('variant', 'secondary');
        refreshButton.textContent = 'Refresh';
        refreshButton.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            this.handleRefresh();
        });
        actions.appendChild(refreshButton);
        
        toolbar.appendChild(title);
        toolbar.appendChild(actions);
        
        return toolbar;
    }

    createTableHead() {
        const tableHead = document.createElement('sp-table-head');
        
        this.columns.forEach(column => {
            const headCell = document.createElement('sp-table-head-cell');
            headCell.textContent = column.label;
            
            if (column.sortable) {
                headCell.className = 'sortable';
                headCell.addEventListener('click', () => this.handleSort(column.key));
                
                const sortIndicator = document.createElement('span');
                sortIndicator.className = 'sort-indicator';
                sortIndicator.textContent = '↕';
                headCell.appendChild(sortIndicator);
            }
            
            // Set class for actions column
            if (column.key === 'actions') {
                headCell.className = 'actions-header';
            }
            
            tableHead.appendChild(headCell);
        });
        
        return tableHead;
    }

        createTableBody() {
        const tableBody = document.createElement('sp-table-body');
        
        this.data.forEach(row => {
            const tableRow = document.createElement('sp-table-row');
            
            this.columns.forEach(column => {
                const cell = document.createElement('sp-table-cell');
                
                if (column.key === 'actions') {
                    const actions = document.createElement('div');
                    actions.className = 'row-actions-flex';
                    
                    const editButton = document.createElement('sp-button');
                    editButton.setAttribute('size', 's');
                    editButton.setAttribute('variant', 'primary');
                    editButton.textContent = 'Edit';
                    editButton.addEventListener('click', (e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        this.handleEdit(row);
                    });
                    actions.appendChild(editButton);
                    
                    const previewButton = document.createElement('sp-button');
                    previewButton.setAttribute('size', 's');
                    previewButton.setAttribute('variant', 'secondary');
                    previewButton.textContent = 'Preview';
                    previewButton.addEventListener('click', (e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        this.handlePreview(row);
                    });
                    actions.appendChild(previewButton);
                    
                    const deleteButton = document.createElement('sp-button');
                    deleteButton.setAttribute('size', 's');
                    deleteButton.setAttribute('variant', 'negative');
                    deleteButton.textContent = 'Delete';
                    deleteButton.addEventListener('click', (e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        this.deleteForm(row);
                    });
                    actions.appendChild(deleteButton);
                    
                    cell.appendChild(actions);
                    cell.className = 'actions-cell';
                } else {
                    cell.textContent = row[column.key];
                    cell.className = 'name-cell';
                }
                
                tableRow.appendChild(cell);
            });
            
            tableBody.appendChild(tableRow);
        });
        
        return tableBody;
    }

    createTable() {
        const table = document.createElement('sp-table');
        table.className = 'forms-table';
        table.appendChild(this.createTableHead());
        table.appendChild(this.createTableBody());
        return table;
    }

    createTableView() {
        const container = document.createElement('sp-theme');
        container.setAttribute('scale', 'medium');
        container.setAttribute('color', 'light');
        container.setAttribute('theme', 'spectrum');
        
        const tableContainer = document.createElement('div');
        tableContainer.className = 'table-container-styled';
        
        // Add persistent toolbar
        tableContainer.appendChild(this.createToolbar());
        
        // Add table that can be refreshed
        const tableWrapper = document.createElement('div');
        tableWrapper.className = 'table-wrapper';
        tableWrapper.appendChild(this.createTable());
        
        tableContainer.appendChild(tableWrapper);
        container.appendChild(tableContainer);
        
        return container;
    }

    updateView() {
        if (!this.container) return;
        
        // Clear current content
        this.container.innerHTML = '';
        
        let content;
        if (this.loading) {
            content = this.createLoadingState();
        } else if (this.error) {
            content = this.createErrorState();
        } else if (!this.data || this.data.length === 0) {
            content = this.createEmptyState();
        } else {
            content = this.createTableView();
        }
        
        this.container.appendChild(content);
    }

    // Create and return DOM element
    createElement() {
        const element = document.createElement('div');
        element.className = 'aem-list-component';
        this.container = element;
        this.updateView();
        return element;
    }
}

export default function decorateArea(block) {
    const list = new List();
    block.classList.add('da-list');
    block.replaceWith(list.createElement());
}