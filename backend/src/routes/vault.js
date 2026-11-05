import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { dbRun, dbGet, dbAll } from '../db.js';
import { authenticateToken } from '../middleware/auth.js';
import { logAudit } from '../logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const uploadDirectory = path.resolve(__dirname, '../../../uploads');

if (!fs.existsSync(uploadDirectory)) {
  fs.mkdirSync(uploadDirectory, { recursive: true });
}

// Multer Storage Configuration - preserves original file extensions, supports any file type
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDirectory);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname);
    cb(null, `${uniqueSuffix}${ext}`);
  }
});

// Accepts all file types (PDF, Word, Excel, Images, Archives, Text, Code, etc.)
const upload = multer({
  storage,
  limits: { fileSize: 100 * 1024 * 1024 } // 100MB limit per file
});

const router = express.Router();

// ==========================================
// FOLDER ENDPOINTS (Superadmin & All Users)
// ==========================================

// GET /api/vault/folders - List all folders
router.get('/folders', authenticateToken, async (req, res) => {
  try {
    const folders = await dbAll(`
      SELECT f.*, u.name as creator_name,
        (SELECT COUNT(*) FROM documents d WHERE d.folder_id = f.id) as doc_count
      FROM folders f
      LEFT JOIN users u ON f.created_by = u.id
      ORDER BY f.id ASC
    `);
    res.json({ success: true, folders });
  } catch (error) {
    console.error('Fetch folders error:', error);
    res.status(500).json({ success: false, message: 'Failed to retrieve folders' });
  }
});

// POST /api/vault/folders - Create new folder
router.post('/folders', authenticateToken, async (req, res) => {
  try {
    const { name, description } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, message: 'Folder name is required.' });
    }

    const cleanName = name.trim();
    const result = await dbRun(
      `INSERT INTO folders (name, description, created_by) VALUES (?, ?, ?)`,
      [cleanName, description ? description.trim() : '', req.user.id]
    );

    logAudit('FOLDER_CREATED', req.user.email, {
      folderId: result.lastID,
      folderName: cleanName
    });

    await dbRun(
      'INSERT INTO activity_logs (user_id, action, details, ip_address) VALUES (?, ?, ?, ?)',
      [req.user.id, 'FOLDER_CREATED', `Created folder "${cleanName}"`, req.ip || '127.0.0.1']
    );

    res.status(201).json({
      success: true,
      message: 'Folder created successfully',
      folder: {
        id: result.lastID,
        name: cleanName,
        description: description || '',
        created_by: req.user.id,
        creator_name: req.user.name,
        doc_count: 0
      }
    });
  } catch (error) {
    console.error('Create folder error:', error);
    res.status(500).json({ success: false, message: 'Failed to create folder' });
  }
});

// DELETE /api/vault/folders/:id - Only Superadmin can delete folders
router.delete('/folders/:id', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'superadmin') {
      return res.status(403).json({ success: false, message: 'Forbidden. Only Superadmin can delete vault folders.' });
    }

    const { id } = req.params;
    const folder = await dbGet('SELECT * FROM folders WHERE id = ?', [id]);

    if (!folder) {
      return res.status(404).json({ success: false, message: 'Folder not found.' });
    }

    // Set any documents currently in this folder to folder_id = NULL (root vault)
    await dbRun('UPDATE documents SET folder_id = NULL WHERE folder_id = ?', [id]);

    // Delete folder
    await dbRun('DELETE FROM folders WHERE id = ?', [id]);

    logAudit('FOLDER_DELETED', req.user.email, {
      folderId: id,
      folderName: folder.name
    });

    await dbRun(
      'INSERT INTO activity_logs (user_id, action, details, ip_address) VALUES (?, ?, ?, ?)',
      [req.user.id, 'FOLDER_DELETED', `Superadmin deleted folder "${folder.name}"`, req.ip || '127.0.0.1']
    );

    res.json({ success: true, message: `Folder "${folder.name}" deleted successfully.` });
  } catch (error) {
    console.error('Delete folder error:', error);
    res.status(500).json({ success: false, message: 'Failed to delete folder' });
  }
});

// ==========================================
// DOCUMENT ENDPOINTS (Superadmin & All Users)
// ==========================================

// GET /api/vault/documents - List all documents (with folder filter option)
router.get('/documents', authenticateToken, async (req, res) => {
  try {
    const { folder_id, doc_type, search } = req.query;

    let query = `
      SELECT d.*, u.name as uploader_name, u.email as uploader_email, f.name as folder_name
      FROM documents d
      LEFT JOIN users u ON d.uploaded_by = u.id
      LEFT JOIN folders f ON d.folder_id = f.id
      WHERE 1=1
    `;
    const params = [];

    if (folder_id) {
      query += ` AND d.folder_id = ?`;
      params.push(folder_id);
    }

    if (doc_type && doc_type !== 'ALL') {
      query += ` AND d.doc_type = ?`;
      params.push(doc_type);
    }

    if (search) {
      query += ` AND (d.name LIKE ? OR d.description LIKE ? OR d.original_filename LIKE ?)`;
      const s = `%${search}%`;
      params.push(s, s, s);
    }

    query += ` ORDER BY d.id DESC`;

    const documents = await dbAll(query, params);
    res.json({ success: true, count: documents.length, documents });
  } catch (error) {
    console.error('Fetch documents error:', error);
    res.status(500).json({ success: false, message: 'Failed to retrieve documents' });
  }
});

// POST /api/vault/upload - Upload new document
router.post('/upload', authenticateToken, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'Please attach a document file to upload.' });
    }

    const { name, doc_type, renewal_date, description, folder_id } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, message: 'Document name is required.' });
    }

    const cleanName = name.trim();
    const cleanDocType = doc_type ? doc_type.trim() : 'General';
    const cleanRenewalDate = renewal_date ? renewal_date.trim() : null;
    const cleanFolderId = folder_id ? parseInt(folder_id, 10) : null;

    const result = await dbRun(
      `INSERT INTO documents (
        folder_id, name, doc_type, renewal_date, description,
        original_filename, stored_filename, file_path, file_size,
        mime_type, uploaded_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        cleanFolderId,
        cleanName,
        cleanDocType,
        cleanRenewalDate,
        description ? description.trim() : '',
        req.file.originalname,
        req.file.filename,
        req.file.path,
        req.file.size,
        req.file.mimetype,
        req.user.id
      ]
    );

    logAudit('DOCUMENT_UPLOADED', req.user.email, {
      documentId: result.lastID,
      name: cleanName,
      docType: cleanDocType,
      fileName: req.file.originalname,
      renewalDate: cleanRenewalDate,
      size: req.file.size
    });

    await dbRun(
      'INSERT INTO activity_logs (user_id, action, details, ip_address) VALUES (?, ?, ?, ?)',
      [req.user.id, 'DOCUMENT_UPLOADED', `Uploaded document "${cleanName}" (${cleanDocType})`, req.ip || '127.0.0.1']
    );

    res.status(201).json({
      success: true,
      message: 'Document uploaded successfully to the Vault',
      document: {
        id: result.lastID,
        name: cleanName,
        doc_type: cleanDocType,
        renewal_date: cleanRenewalDate,
        original_filename: req.file.originalname,
        stored_filename: req.file.filename,
        file_size: req.file.size,
        mime_type: req.file.mimetype,
        uploaded_by: req.user.id,
        uploader_name: req.user.name
      }
    });
  } catch (error) {
    console.error('Document upload error:', error);
    res.status(500).json({ success: false, message: 'Error processing document upload' });
  }
});

// GET /api/vault/view/:id - View or stream document in browser / mobile
router.get('/view/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const doc = await dbGet('SELECT * FROM documents WHERE id = ?', [id]);

    if (!doc) {
      return res.status(404).send('Document not found in vault');
    }

    if (!fs.existsSync(doc.file_path)) {
      return res.status(404).send('Document file does not exist on storage');
    }

    // Set appropriate content type & inline disposition so browser previews it
    if (doc.mime_type) {
      res.setHeader('Content-Type', doc.mime_type);
    }
    res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(doc.original_filename)}"`);

    const fileStream = fs.createReadStream(doc.file_path);
    fileStream.pipe(res);
  } catch (error) {
    console.error('View document error:', error);
    res.status(500).send('Error viewing document');
  }
});

// GET /api/vault/download/:id - Download document file
router.get('/download/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const doc = await dbGet('SELECT * FROM documents WHERE id = ?', [id]);

    if (!doc || !fs.existsSync(doc.file_path)) {
      return res.status(404).json({ success: false, message: 'Document file not found' });
    }

    res.download(doc.file_path, doc.original_filename);
  } catch (error) {
    console.error('Download document error:', error);
    res.status(500).json({ success: false, message: 'Error downloading document' });
  }
});

// DELETE /api/vault/documents/:id - Delete document
router.delete('/documents/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const doc = await dbGet('SELECT * FROM documents WHERE id = ?', [id]);

    if (!doc) {
      return res.status(404).json({ success: false, message: 'Document not found' });
    }

    // Superadmin can delete any; regular users can delete documents they uploaded
    if (req.user.role !== 'superadmin' && doc.uploaded_by !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Permission denied to delete this document.' });
    }

    // Remove file from disk
    if (fs.existsSync(doc.file_path)) {
      try {
        fs.unlinkSync(doc.file_path);
      } catch (err) {
        console.warn('Could not remove file from disk:', err.message);
      }
    }

    await dbRun('DELETE FROM documents WHERE id = ?', [id]);

    logAudit('DOCUMENT_DELETED', req.user.email, {
      documentId: id,
      documentName: doc.name
    });

    await dbRun(
      'INSERT INTO activity_logs (user_id, action, details, ip_address) VALUES (?, ?, ?, ?)',
      [req.user.id, 'DOCUMENT_DELETED', `Deleted document "${doc.name}"`, req.ip || '127.0.0.1']
    );

    res.json({ success: true, message: 'Document removed from vault' });
  } catch (error) {
    console.error('Delete document error:', error);
    res.status(500).json({ success: false, message: 'Error deleting document' });
  }
});

export default router;

