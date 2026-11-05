const AUTH_BASE = '/api/auth';
const VAULT_BASE = '/api/vault';

export const api = {
  // Authentication
  async login(email, password) {
    const res = await fetch(`${AUTH_BASE}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    return res.json();
  },

  async getProfile(token) {
    const res = await fetch(`${AUTH_BASE}/me`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    return res.json();
  },

  async registerUser(token, userData) {
    const res = await fetch(`${AUTH_BASE}/register-user`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify(userData)
    });
    return res.json();
  },

  async getUsers(token) {
    const res = await fetch(`${AUTH_BASE}/users`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    return res.json();
  },

  async updateUserStatus(token, userId, status) {
    const res = await fetch(`${AUTH_BASE}/users/${userId}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({ status })
    });
    return res.json();
  },

  async deleteUser(token, userId) {
    const res = await fetch(`${AUTH_BASE}/users/${userId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` }
    });
    return res.json();
  },

  async getLogs(token) {
    const res = await fetch(`${AUTH_BASE}/logs`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    return res.json();
  },

  // Vault - Folders
  async getFolders(token) {
    const res = await fetch(`${VAULT_BASE}/folders`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    return res.json();
  },

  async createFolder(token, folderData) {
    const res = await fetch(`${VAULT_BASE}/folders`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify(folderData)
    });
    return res.json();
  },

  async deleteFolder(token, folderId) {
    const res = await fetch(`${VAULT_BASE}/folders/${folderId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` }
    });
    return res.json();
  },

  // Vault - Documents
  async getDocuments(token, filters = {}) {
    const params = new URLSearchParams();
    if (filters.folder_id) params.append('folder_id', filters.folder_id);
    if (filters.doc_type && filters.doc_type !== 'ALL') params.append('doc_type', filters.doc_type);
    if (filters.search) params.append('search', filters.search);

    const queryString = params.toString() ? `?${params.toString()}` : '';
    const res = await fetch(`${VAULT_BASE}/documents${queryString}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    return res.json();
  },

  async uploadDocument(token, formData) {
    const res = await fetch(`${VAULT_BASE}/upload`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`
        // Notice: Do NOT set Content-Type header when sending FormData, browser will set it with boundary
      },
      body: formData
    });
    return res.json();
  },

  async deleteDocument(token, docId) {
    const res = await fetch(`${VAULT_BASE}/documents/${docId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` }
    });
    return res.json();
  },

  getViewUrl(docId) {
    return `/api/vault/view/${docId}`;
  },

  getDownloadUrl(docId) {
    return `/api/vault/download/${docId}`;
  }
};
