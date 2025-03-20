// Main JavaScript file for client-side functionality

document.addEventListener('DOMContentLoaded', function() {
    // Initialize all tooltips
    initializeTooltips();

    // Initialize all popovers
    initializePopovers();

    // Initialize DataTables where present
    initializeDataTables();

    // Setup form validations
    setupFormValidations();

    // Setup auto-dismiss alerts
    setupAutoDismissAlerts();

    // Setup confirmation dialogs
    setupConfirmationDialogs();

    // Setup search functionality
    setupSearch();
});

// Initialize Bootstrap tooltips
function initializeTooltips() {
    var tooltipTriggerList = [].slice.call(document.querySelectorAll('[data-bs-toggle="tooltip"]'));
    tooltipTriggerList.map(function(tooltipTriggerEl) {
        return new bootstrap.Tooltip(tooltipTriggerEl);
    });
}

// Initialize Bootstrap popovers
function initializePopovers() {
    var popoverTriggerList = [].slice.call(document.querySelectorAll('[data-bs-toggle="popover"]'));
    popoverTriggerList.map(function(popoverTriggerEl) {
        return new bootstrap.Popover(popoverTriggerEl);
    });
}

// Initialize DataTables
function initializeDataTables() {
    if (typeof $.fn.DataTable !== 'undefined') {
        $('.data-table').DataTable({
            responsive: true,
            pageLength: 25,
            language: {
                search: "Filter records:",
                lengthMenu: "Show _MENU_ records per page",
                info: "Showing _START_ to _END_ of _TOTAL_ records",
                paginate: {
                    first: "First",
                    last: "Last",
                    next: "Next",
                    previous: "Previous"
                }
            }
        });
    }
}

// Setup form validations
function setupFormValidations() {
    // Password match validation
    const passwordForm = document.querySelector('form:has(input[type="password"])');
    if (passwordForm) {
        const password = passwordForm.querySelector('input[name="password"]');
        const confirmPassword = passwordForm.querySelector('input[name="confirm_password"]');
        
        if (password && confirmPassword) {
            confirmPassword.addEventListener('input', function() {
                if (this.value !== password.value) {
                    this.setCustomValidity('Passwords do not match');
                } else {
                    this.setCustomValidity('');
                }
            });
        }
    }

    // ISBN validation
    const isbnInput = document.querySelector('input[name="isbn"]');
    if (isbnInput) {
        isbnInput.addEventListener('input', function() {
            const isbn = this.value.replace(/[-\s]/g, '');
            if (isbn.length === 13 && /^\d+$/.test(isbn)) {
                this.setCustomValidity('');
            } else {
                this.setCustomValidity('Please enter a valid 13-digit ISBN');
            }
        });
    }

    // Email validation
    const emailInputs = document.querySelectorAll('input[type="email"]');
    emailInputs.forEach(input => {
        input.addEventListener('input', function() {
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(this.value)) {
                this.setCustomValidity('Please enter a valid email address');
            } else {
                this.setCustomValidity('');
            }
        });
    });
}

// Setup auto-dismiss alerts
function setupAutoDismissAlerts() {
    const alerts = document.querySelectorAll('.alert:not(.alert-permanent)');
    alerts.forEach(alert => {
        setTimeout(() => {
            const bsAlert = new bootstrap.Alert(alert);
            bsAlert.close();
        }, 5000);
    });
}

// Setup confirmation dialogs
function setupConfirmationDialogs() {
    document.querySelectorAll('.confirm-action').forEach(button => {
        button.addEventListener('click', function(e) {
            const message = this.dataset.confirmMessage || 'Are you sure you want to proceed?';
            if (!confirm(message)) {
                e.preventDefault();
            }
        });
    });
}

// Setup search functionality
function setupSearch() {
    const searchInput = document.querySelector('.search-input');
    if (searchInput) {
        let timeout = null;
        searchInput.addEventListener('input', function() {
            clearTimeout(timeout);
            timeout = setTimeout(() => {
                const searchTerm = this.value.toLowerCase();
                const items = document.querySelectorAll('.searchable-item');
                
                items.forEach(item => {
                    const text = item.textContent.toLowerCase();
                    if (text.includes(searchTerm)) {
                        item.style.display = '';
                    } else {
                        item.style.display = 'none';
                    }
                });
            }, 300);
        });
    }
}

// Utility function to format dates
function formatDate(date) {
    const d = new Date(date);
    return d.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });
}

// Utility function to format currency
function formatCurrency(amount) {
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD'
    }).format(amount);
}

// Handle file uploads with preview
function handleFileUpload(input, previewElement) {
    if (input.files && input.files[0]) {
        const reader = new FileReader();
        reader.onload = function(e) {
            previewElement.src = e.target.result;
        };
        reader.readAsDataURL(input.files[0]);
    }
}

// Handle dynamic form fields
function addFormField(containerId, template) {
    const container = document.getElementById(containerId);
    const newField = template.cloneNode(true);
    container.appendChild(newField);
}

function removeFormField(button) {
    button.closest('.form-field').remove();
}

// Export functions for use in other scripts
window.libraryApp = {
    formatDate,
    formatCurrency,
    handleFileUpload,
    addFormField,
    removeFormField
};