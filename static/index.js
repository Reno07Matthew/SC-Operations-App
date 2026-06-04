/**
 * S3 Operations Console — Frontend Logic
 * Handles all API calls, DOM updates, drag-and-drop, and user interactions.
 */

// ============================================================
// Constants & State
// ============================================================
const API_BASE = '';
let selectedFiles = [];

// DOM References
const dom = {
    // Connection
    connectionBadge: document.getElementById('connection-badge'),
    connectionText: document.getElementById('connection-text'),

    // Create Bucket
    createForm: document.getElementById('create-bucket-form'),
    bucketNameInput: document.getElementById('bucket-name'),
    regionSelect: document.getElementById('bucket-region'),
    createBtn: document.getElementById('create-bucket-btn'),

    // Upload
    uploadBucketSelect: document.getElementById('upload-bucket-select'),
    dropzone: document.getElementById('dropzone'),
    fileInput: document.getElementById('file-input'),
    fileList: document.getElementById('file-list'),
    uploadBtn: document.getElementById('upload-btn'),

    // Manage Objects
    manageBucketSelect: document.getElementById('manage-bucket-select'),
    refreshObjectsBtn: document.getElementById('refresh-objects-btn'),
    objectsTableWrapper: document.getElementById('objects-table-wrapper'),
    objectsEmptyState: document.getElementById('objects-empty-state'),
    objectsTable: document.getElementById('objects-table'),
    objectsTbody: document.getElementById('objects-tbody'),

    // Activity Log
    logEntries: document.getElementById('log-entries'),
    clearLogBtn: document.getElementById('clear-log-btn'),

    // Modal
    aclModal: document.getElementById('acl-modal'),
    modalCloseBtn: document.getElementById('modal-close-btn'),
    modalOkBtn: document.getElementById('modal-ok-btn'),
    modalOldAcl: document.getElementById('modal-old-acl'),
    modalNewAcl: document.getElementById('modal-new-acl'),
    modalObjectKey: document.getElementById('modal-object-key'),
    modalBucketName: document.getElementById('modal-bucket-name'),
    grantsTbody: document.getElementById('grants-tbody'),

    // Toast
    toastContainer: document.getElementById('toast-container'),
};


// ============================================================
// Initialization
// ============================================================
document.addEventListener('DOMContentLoaded', () => {
    checkConnection();
    loadRegions();
    loadBuckets();
    setupEventListeners();
});


// ============================================================
// Event Listeners
// ============================================================
function setupEventListeners() {
    // Create Bucket Form
    dom.createForm.addEventListener('submit', handleCreateBucket);

    // Dropzone
    dom.dropzone.addEventListener('click', () => dom.fileInput.click());
    dom.dropzone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dom.dropzone.classList.add('drag-over');
    });
    dom.dropzone.addEventListener('dragleave', () => {
        dom.dropzone.classList.remove('drag-over');
    });
    dom.dropzone.addEventListener('drop', (e) => {
        e.preventDefault();
        dom.dropzone.classList.remove('drag-over');
        addFiles(e.dataTransfer.files);
    });
    dom.fileInput.addEventListener('change', () => {
        addFiles(dom.fileInput.files);
        dom.fileInput.value = '';
    });

    // Upload Button
    dom.uploadBtn.addEventListener('click', handleUpload);

    // Manage Bucket Select
    dom.manageBucketSelect.addEventListener('change', () => {
        const bucket = dom.manageBucketSelect.value;
        if (bucket) loadObjects(bucket);
        else showEmptyState();
    });

    // Refresh Objects
    dom.refreshObjectsBtn.addEventListener('click', () => {
        const bucket = dom.manageBucketSelect.value;
        if (bucket) loadObjects(bucket);
    });

    // Clear Log
    dom.clearLogBtn.addEventListener('click', clearLog);

    // Modal close
    dom.modalCloseBtn.addEventListener('click', closeModal);
    dom.modalOkBtn.addEventListener('click', closeModal);
    dom.aclModal.addEventListener('click', (e) => {
        if (e.target === dom.aclModal) closeModal();
    });
}


// ============================================================
// API Helpers
// ============================================================
async function apiGet(endpoint) {
    const response = await fetch(`${API_BASE}${endpoint}`);
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Request failed');
    return data;
}

async function apiPost(endpoint, body, isFormData = false) {
    const options = { method: 'POST' };
    if (isFormData) {
        options.body = body;
    } else {
        options.headers = { 'Content-Type': 'application/json' };
        options.body = JSON.stringify(body);
    }
    const response = await fetch(`${API_BASE}${endpoint}`, options);
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Request failed');
    return data;
}

async function apiPut(endpoint, body) {
    const response = await fetch(`${API_BASE}${endpoint}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Request failed');
    return data;
}


// ============================================================
// Connection Check
// ============================================================
async function checkConnection() {
    try {
        await apiGet('/api/health');
        dom.connectionBadge.className = 'status-badge status-connected';
        dom.connectionText.textContent = 'AWS Connected';
        addLog('info', 'AWS credentials verified successfully.');
    } catch (err) {
        dom.connectionBadge.className = 'status-badge status-error';
        dom.connectionText.textContent = 'Not Connected';
        addLog('error', `AWS connection failed: ${err.message}`);
    }
}


// ============================================================
// Regions
// ============================================================
async function loadRegions() {
    try {
        const data = await apiGet('/api/regions');
        dom.regionSelect.innerHTML = '<option value="">Select a region...</option>';
        data.regions.forEach(r => {
            const opt = document.createElement('option');
            opt.value = r.code;
            opt.textContent = `${r.name} (${r.code})`;
            dom.regionSelect.appendChild(opt);
        });
    } catch (err) {
        addLog('error', `Failed to load regions: ${err.message}`);
    }
}


// ============================================================
// Buckets
// ============================================================
async function loadBuckets() {
    try {
        const data = await apiGet('/api/buckets');
        const buckets = data.buckets || [];

        // Update both bucket selects
        [dom.uploadBucketSelect, dom.manageBucketSelect].forEach(select => {
            const currentValue = select.value;
            select.innerHTML = '<option value="">Select a bucket...</option>';
            buckets.forEach(b => {
                const opt = document.createElement('option');
                opt.value = b.name;
                opt.textContent = `${b.name} (${b.region})`;
                select.appendChild(opt);
            });
            // Restore selection if it still exists
            if (currentValue && buckets.some(b => b.name === currentValue)) {
                select.value = currentValue;
            }
        });
    } catch (err) {
        addLog('error', `Failed to load buckets: ${err.message}`);
    }
}


// ============================================================
// Create Bucket
// ============================================================
async function handleCreateBucket(e) {
    e.preventDefault();

    const name = dom.bucketNameInput.value.trim().toLowerCase();
    const region = dom.regionSelect.value;

    if (!name || !region) return;

    setLoading(dom.createBtn, true);

    try {
        const data = await apiPost('/api/buckets', { name, region });
        showToast('success', data.message);
        addLog('success', data.message);
        dom.bucketNameInput.value = '';
        dom.regionSelect.value = '';
        await loadBuckets();
    } catch (err) {
        showToast('error', err.message);
        addLog('error', `Bucket creation failed: ${err.message}`);
    } finally {
        setLoading(dom.createBtn, false);
    }
}


// ============================================================
// File Handling
// ============================================================
function addFiles(fileList) {
    for (const file of fileList) {
        // Avoid duplicates
        if (!selectedFiles.some(f => f.name === file.name && f.size === file.size)) {
            selectedFiles.push(file);
        }
    }
    renderFileList();
}

function removeFile(index) {
    selectedFiles.splice(index, 1);
    renderFileList();
}

function renderFileList() {
    dom.fileList.innerHTML = '';
    selectedFiles.forEach((file, index) => {
        const item = document.createElement('div');
        item.className = 'file-item';
        item.innerHTML = `
            <div class="file-item-info">
                <svg class="file-item-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/>
                    <polyline points="13 2 13 9 20 9"/>
                </svg>
                <span class="file-item-name">${escapeHtml(file.name)}</span>
            </div>
            <span class="file-item-size">${formatSize(file.size)}</span>
            <button class="file-item-remove" data-index="${index}" title="Remove file">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <line x1="18" y1="6" x2="6" y2="18"/>
                    <line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
            </button>
        `;
        item.querySelector('.file-item-remove').addEventListener('click', () => removeFile(index));
        dom.fileList.appendChild(item);
    });

    dom.uploadBtn.disabled = selectedFiles.length === 0;
}


// ============================================================
// Upload Files
// ============================================================
async function handleUpload() {
    const bucket = dom.uploadBucketSelect.value;
    if (!bucket) {
        showToast('error', 'Please select a target bucket.');
        return;
    }
    if (selectedFiles.length === 0) {
        showToast('error', 'No files selected.');
        return;
    }

    setLoading(dom.uploadBtn, true);

    try {
        const formData = new FormData();
        formData.append('bucket', bucket);
        selectedFiles.forEach(file => formData.append('files', file));

        const data = await apiPost('/api/upload', formData, true);
        showToast('success', data.message);
        addLog('success', data.message);

        if (data.errors && data.errors.length > 0) {
            data.errors.forEach(e => addLog('error', `Upload error for ${e.file}: ${e.error}`));
        }

        // Clear file list
        selectedFiles = [];
        renderFileList();

        // Refresh objects if viewing the same bucket
        if (dom.manageBucketSelect.value === bucket) {
            loadObjects(bucket);
        }
    } catch (err) {
        showToast('error', err.message);
        addLog('error', `Upload failed: ${err.message}`);
    } finally {
        setLoading(dom.uploadBtn, false);
    }
}


// ============================================================
// Objects Management
// ============================================================
async function loadObjects(bucketName) {
    dom.objectsEmptyState.hidden = true;
    dom.objectsTable.hidden = false;
    dom.objectsTbody.innerHTML = `
        <tr class="shimmer-row">
            <td colspan="5" style="text-align:center; padding:24px; color:var(--text-muted);">Loading objects...</td>
        </tr>
    `;

    try {
        const data = await apiGet(`/api/objects/${encodeURIComponent(bucketName)}`);
        const objects = data.objects || [];

        if (objects.length === 0) {
            dom.objectsTbody.innerHTML = `
                <tr>
                    <td colspan="5" style="text-align:center; padding:24px; color:var(--text-muted);">No objects in this bucket</td>
                </tr>
            `;
            addLog('info', `Bucket '${bucketName}' is empty.`);
            return;
        }

        dom.objectsTbody.innerHTML = '';
        objects.forEach(obj => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td title="${escapeHtml(obj.key)}">${escapeHtml(obj.key)}</td>
                <td>${formatSize(obj.size)}</td>
                <td><span class="acl-badge acl-${obj.acl}">${obj.acl}</span></td>
                <td>
                    <select class="acl-select" data-key="${escapeHtml(obj.key)}" data-bucket="${escapeHtml(bucketName)}">
                        <option value="private" ${obj.acl === 'private' ? 'selected' : ''}>private</option>
                        <option value="public-read" ${obj.acl === 'public-read' ? 'selected' : ''}>public-read</option>
                        <option value="public-read-write" ${obj.acl === 'public-read-write' ? 'selected' : ''}>public-read-write</option>
                        <option value="authenticated-read" ${obj.acl === 'authenticated-read' ? 'selected' : ''}>authenticated-read</option>
                    </select>
                </td>
                <td>
                    <button class="btn btn-primary btn-apply-acl" 
                            data-key="${escapeHtml(obj.key)}" 
                            data-bucket="${escapeHtml(bucketName)}">
                        <span class="btn-text">Apply</span>
                        <span class="btn-loader"></span>
                    </button>
                </td>
            `;

            // Apply ACL button click
            const applyBtn = row.querySelector('.btn-apply-acl');
            const aclSelect = row.querySelector('.acl-select');
            applyBtn.addEventListener('click', () => {
                handleAclChange(bucketName, obj.key, aclSelect.value, applyBtn);
            });

            dom.objectsTbody.appendChild(row);
        });

        addLog('info', `Loaded ${objects.length} object(s) from '${bucketName}'.`);

    } catch (err) {
        dom.objectsTbody.innerHTML = `
            <tr>
                <td colspan="5" style="text-align:center; padding:24px; color:var(--error);">${escapeHtml(err.message)}</td>
            </tr>
        `;
        addLog('error', `Failed to load objects: ${err.message}`);
    }
}

function showEmptyState() {
    dom.objectsEmptyState.hidden = false;
    dom.objectsTable.hidden = true;
}


// ============================================================
// ACL Change
// ============================================================
async function handleAclChange(bucket, key, newAcl, button) {
    setLoading(button, true);

    try {
        const data = await apiPut(`/api/acl/${encodeURIComponent(bucket)}/${encodeURIComponent(key)}`, {
            acl: newAcl,
        });

        showToast('success', data.message);
        addLog('success', data.message);

        // Show verification modal
        showAclModal(data);

        // Refresh the objects table
        loadObjects(bucket);

    } catch (err) {
        showToast('error', err.message);
        addLog('error', `ACL change failed: ${err.message}`);
    } finally {
        setLoading(button, false);
    }
}


// ============================================================
// Modal
// ============================================================
function showAclModal(data) {
    dom.modalOldAcl.textContent = data.previousAcl;
    dom.modalNewAcl.textContent = data.currentAcl;
    dom.modalObjectKey.textContent = data.key;
    dom.modalBucketName.textContent = data.bucket;

    // Update new ACL badge styling
    dom.modalNewAcl.className = `acl-value acl-badge acl-${data.currentAcl}`;

    // Render grants table
    dom.grantsTbody.innerHTML = '';
    if (data.grants && data.grants.length > 0) {
        data.grants.forEach(grant => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${escapeHtml(grant.grantee)}</td>
                <td>${escapeHtml(grant.permission)}</td>
            `;
            dom.grantsTbody.appendChild(row);
        });
    } else {
        dom.grantsTbody.innerHTML = '<tr><td colspan="2" style="text-align:center; color:var(--text-muted);">No grants available</td></tr>';
    }

    dom.aclModal.hidden = false;
}

function closeModal() {
    dom.aclModal.hidden = true;
}


// ============================================================
// Activity Log
// ============================================================
function addLog(type, message) {
    const now = new Date();
    const time = now.toLocaleTimeString('en-US', { hour12: false });

    const badgeClass = {
        info: 'log-badge-info',
        success: 'log-badge-success',
        error: 'log-badge-error',
        warning: 'log-badge-warning',
    }[type] || 'log-badge-info';

    const badgeText = type.toUpperCase();

    const entry = document.createElement('div');
    entry.className = `log-entry log-${type}`;
    entry.innerHTML = `
        <span class="log-time">${time}</span>
        <span class="log-badge ${badgeClass}">${badgeText}</span>
        <span class="log-message">${escapeHtml(message)}</span>
    `;

    // Prepend (newest first)
    dom.logEntries.prepend(entry);

    // Keep max 100 entries
    while (dom.logEntries.children.length > 100) {
        dom.logEntries.removeChild(dom.logEntries.lastChild);
    }
}

function clearLog() {
    dom.logEntries.innerHTML = '';
    addLog('info', 'Activity log cleared.');
}


// ============================================================
// Toast Notifications
// ============================================================
function showToast(type, message, duration = 4000) {
    const icons = {
        success: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>',
        error: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>',
        info: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>',
    };

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.innerHTML = `
        <span class="toast-icon">${icons[type] || icons.info}</span>
        <span>${escapeHtml(message)}</span>
    `;

    dom.toastContainer.appendChild(toast);

    setTimeout(() => {
        toast.classList.add('removing');
        toast.addEventListener('animationend', () => toast.remove());
    }, duration);
}


// ============================================================
// Utility Functions
// ============================================================
function setLoading(button, isLoading) {
    if (isLoading) {
        button.classList.add('loading');
        button.disabled = true;
    } else {
        button.classList.remove('loading');
        button.disabled = false;
    }
}

function formatSize(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}
