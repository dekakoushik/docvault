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
const uploadDirectory = process.env.UPLOADS_DIR || path.resolve(__dirname, '../../../uploads');

if (!fs.existsSync(uploadDirectory)) {
  fs.mkdirSync(uploadDirectory, { recursive: true });
}

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

const upload = multer({
  storage,
  limits: { fileSize: 100 * 1024 * 1024 }
});

const router = express.Router();

/**
 * Intelligent categorization and renewal date heuristic for document auto-organization
 */
function analyzeDocumentMeta(filename, originalName, mimeType) {
  const combined = (filename + ' ' + (originalName || '')).toLowerCase();
  
  // Category detection
  let docType = 'General';
  let targetFolder = 'General Vault';
  let subfolder = null;

  if (combined.match(/invoice|bill|receipt|gst|payment|tax|salary|payroll/)) {
    docType = 'Invoice / Financial';
    targetFolder = 'Finance & Accounts';
    if (combined.match(/gst|tax/)) subfolder = 'Tax & GST';
    else if (combined.match(/salary|payroll/)) subfolder = 'Payroll';
    else subfolder = 'Invoices';
  } else if (combined.match(/contract|msa|sow|agreement|nda|mou|lease/)) {
    docType = combined.match(/nda|mou/) ? 'Agreement / NDA' : 'Contract';
    targetFolder = 'Legal & Contracts';
    if (combined.match(/nda/)) subfolder = 'NDAs';
    else if (combined.match(/employment|hire|joining/)) subfolder = 'Employment Contracts';
    else subfolder = 'Client Agreements';
  } else if (combined.match(/policy|compliance|iso|manual|guideline|sop/)) {
    docType = 'Policy / Compliance';
    targetFolder = 'Compliance & Policies';
  } else if (combined.match(/license|certificate|registration|trademark|patent/)) {
    docType = 'License / Certificate';
    targetFolder = 'Licenses & Certifications';
  } else if (combined.match(/passport|aadhar|aadhaar|pan|id|voter|kyc|resume|cv/)) {
    docType = 'Identity / KYC';
    targetFolder = 'HR & Identity';
    if (combined.match(/resume|cv/)) subfolder = 'Resumes';
    else subfolder = 'KYC Documents';
  } else if (combined.match(/spec|architecture|design|tech|diagram|code|api/)) {
    docType = 'Technical Spec';
    targetFolder = 'Technical Documentation';
  }

  // Renewal date heuristic: Look for explicit date in filename like 2026-12-31 or 31-12-2026 or 2027
  let renewalDate = null;
  const isoMatch = combined.match(/(\d{4})[-_](\d{2})[-_](\d{2})/);
  if (isoMatch) {
    renewalDate = `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`;
  } else {
    // If it's a contract/license, default renewal reminder to 1 year ahead
    if (['Contract', 'License / Certificate', 'Agreement / NDA'].includes(docType)) {
      const d = new Date();
      d.setFullYear(d.getFullYear() + 1);
      renewalDate = d.toISOString().split('T')[0];
    }
  }

  return { docType, targetFolder, subfolder, renewalDate };
}

/**
 * Helper to ensure a folder hierarchy exists or create it
 */
async function ensureFolderHierarchy(folderName, subfolderName, userId) {
  let mainFolder = await dbGet('SELECT * FROM folders WHERE name = ? AND parent_id IS NULL', [folderName]);
  if (!mainFolder) {
    const res = await dbRun(
      'INSERT INTO folders (name, description, parent_id, created_by) VALUES (?, ?, NULL, ?)',
      [folderName, `Auto-created by DocVault AI Assistant for ${folderName}`, userId]
    );
    mainFolder = { id: res.lastID, name: folderName };
  }

  if (subfolderName) {
    let sub = await dbGet('SELECT * FROM folders WHERE name = ? AND parent_id = ?', [subfolderName, mainFolder.id]);
    if (!sub) {
      const subRes = await dbRun(
        'INSERT INTO folders (name, description, parent_id, created_by) VALUES (?, ?, ?, ?)',
        [subfolderName, `Subfolder in ${folderName}`, mainFolder.id, userId]
      );
      return { folderId: subRes.lastID, folderName: `${folderName} / ${subfolderName}` };
    }
    return { folderId: sub.id, folderName: `${folderName} / ${subfolderName}` };
  }

  return { folderId: mainFolder.id, folderName: mainFolder.name };
}

// ==========================================
// AI ASSISTANT CHAT & COMMAND EXECUTION
// ==========================================

// POST /api/ai/chat - Natural language command execution
router.post('/chat', authenticateToken, async (req, res) => {
  try {
    const { prompt } = req.body;
    if (!prompt || !prompt.trim()) {
      return res.status(400).json({ success: false, message: 'Prompt is required.' });
    }

    const cleanPrompt = prompt.trim();
    const lower = cleanPrompt.toLowerCase();
    const actionsTaken = [];
    let replyText = '';

    // 1. Command: CREATE SUBFOLDER / FOLDER
    // e.g., "create folder Finance", "create subfolder 2026 under Invoices"
    const subfolderMatch = cleanPrompt.match(/(?:create|make|add)\s+subfolder\s+["']?([^"']+)["']?\s+(?:under|in|inside)\s+["']?([^"']+)["']?/i);
    const folderMatch = cleanPrompt.match(/(?:create|make|add)\s+folder\s+["']?([^"']+)["']?/i);

    if (subfolderMatch) {
      const subName = subfolderMatch[1].trim();
      const parentName = subfolderMatch[2].trim();

      // Find parent folder
      let parent = await dbGet('SELECT * FROM folders WHERE name LIKE ?', [`%${parentName}%`]);
      if (!parent) {
        // Create parent first
        const pRes = await dbRun('INSERT INTO folders (name, description, parent_id, created_by) VALUES (?, ?, NULL, ?)', [parentName, 'Parent Folder', req.user.id]);
        parent = { id: pRes.lastID, name: parentName };
      }

      const resSub = await dbRun(
        'INSERT INTO folders (name, description, parent_id, created_by) VALUES (?, ?, ?, ?)',
        [subName, `Subfolder under ${parent.name}`, parent.id, req.user.id]
      );

      actionsTaken.push({
        type: 'FOLDER_CREATED',
        id: resSub.lastID,
        name: subName,
        parent: parent.name
      });
      replyText = `Created subfolder **"${subName}"** under parent folder **"${parent.name}"**.`;
    } else if (folderMatch) {
      const fName = folderMatch[1].trim();
      let existing = await dbGet('SELECT * FROM folders WHERE name = ? AND parent_id IS NULL', [fName]);
      if (existing) {
        replyText = `Folder **"${fName}"** already exists in the vault.`;
      } else {
        const resF = await dbRun(
          'INSERT INTO folders (name, description, parent_id, created_by) VALUES (?, ?, NULL, ?)',
          [fName, 'Created via DocVault AI Assistant', req.user.id]
        );
        actionsTaken.push({
          type: 'FOLDER_CREATED',
          id: resF.lastID,
          name: fName
        });
        replyText = `Created new vault folder **"${fName}"**.`;
      }
    }
    // 2. Command: SEARCH DOCUMENTS
    // e.g., "search invoice", "find contracts expiring soon", "list files in legal"
    else if (lower.includes('search') || lower.includes('find') || lower.includes('show') || lower.includes('list') || lower.includes('where is')) {
      const termMatch = cleanPrompt.match(/(?:search|find|show|list|where is)\s+(?:for\s+)?["']?([^"']+)["']?/i);
      let queryTerm = termMatch ? termMatch[1].replace(/documents?|files?|folders?/gi, '').trim() : '';

      let docs = [];
      let foldersFound = [];

      if (lower.includes('expir')) {
        // Find expiring or expired documents
        docs = await dbAll(`
          SELECT d.*, f.name as folder_name, u.name as uploader_name
          FROM documents d
          LEFT JOIN folders f ON d.folder_id = f.id
          LEFT JOIN users u ON d.uploaded_by = u.id
          WHERE d.renewal_date IS NOT NULL AND d.renewal_date != ''
          ORDER BY d.renewal_date ASC
          LIMIT 10
        `);
        replyText = `Here are the documents with tracked renewal dates:`;
      } else if (queryTerm) {
        docs = await dbAll(`
          SELECT d.*, f.name as folder_name, u.name as uploader_name
          FROM documents d
          LEFT JOIN folders f ON d.folder_id = f.id
          LEFT JOIN users u ON d.uploaded_by = u.id
          WHERE d.name LIKE ? OR d.original_filename LIKE ? OR d.doc_type LIKE ? OR d.description LIKE ?
          ORDER BY d.id DESC
          LIMIT 10
        `, [`%${queryTerm}%`, `%${queryTerm}%`, `%${queryTerm}%`, `%${queryTerm}%`]);

        foldersFound = await dbAll(`
          SELECT f.*, pf.name as parent_name,
            (SELECT COUNT(*) FROM documents d WHERE d.folder_id = f.id) as doc_count
          FROM folders f
          LEFT JOIN folders pf ON f.parent_id = pf.id
          WHERE f.name LIKE ?
          LIMIT 5
        `, [`%${queryTerm}%`]);

        replyText = `Found ${docs.length} document(s) and ${foldersFound.length} folder(s) matching "${queryTerm}".`;
      } else {
        docs = await dbAll(`
          SELECT d.*, f.name as folder_name
          FROM documents d
          LEFT JOIN folders f ON d.folder_id = f.id
          ORDER BY d.id DESC
          LIMIT 5
        `);
        replyText = `Here are the most recently secured documents in the vault:`;
      }

      actionsTaken.push({
        type: 'SEARCH_RESULTS',
        documents: docs,
        folders: foldersFound
      });
    }
    // 3. Command: VAULT SUMMARY & STATS
    else if (lower.includes('status') || lower.includes('summary') || lower.includes('stats') || lower.includes('count')) {
      const docCount = await dbGet('SELECT COUNT(*) as count FROM documents');
      const folderCount = await dbGet('SELECT COUNT(*) as count FROM folders');
      const expiringCount = await dbGet("SELECT COUNT(*) as count FROM documents WHERE renewal_date IS NOT NULL AND renewal_date != '' AND renewal_date <= date('now', '+30 days')");

      replyText = `**DocVault Status Summary:**\n• Total Documents: **${docCount.count}**\n• Total Folders & Subfolders: **${folderCount.count}**\n• Documents Expiring Within 30 Days: **${expiringCount.count}**`;
    }
    // 4. Default Helpful AI Guidance
    else {
      replyText = `I am your **DocVault AI Assistant**! Here is what I can do for you:\n\n` +
        `• **Auto-Organize Uploads**: Drop any document in the upload box below and I will detect its category, create matching folders/subfolders, and set renewal alerts automatically.\n` +
        `• **Create Folders**: Say *"Create folder Operations"* or *"Create subfolder Q1 2026 under Invoices"*.\n` +
        `• **Instant Search**: Ask *"Find NDAs"*, *"Search tax invoice"*, or *"Show expiring contracts"*.\n` +
        `• **Vault Summary**: Ask *"Show vault summary"* or *"Status"*.\n\n` +
        `What would you like me to do?`;
    }

    logAudit('AI_CHAT_INTERACTION', req.user.email, { prompt: cleanPrompt, actions: actionsTaken });

    res.json({
      success: true,
      reply: replyText,
      actions: actionsTaken
    });
  } catch (error) {
    console.error('AI Chat Error:', error);
    res.status(500).json({ success: false, message: 'AI Assistant failed: ' + error.message });
  }
});

// ==========================================
// AI SMART AUTO-ORGANIZING UPLOAD
// ==========================================

// POST /api/ai/auto-upload - Upload file and let AI auto-categorize, create folder hierarchy, and set renewals
router.post('/auto-upload', authenticateToken, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No file uploaded.' });
    }

    const { originalname, filename, size, mimetype } = req.file;
    const customPrompt = req.body.prompt || '';

    // Run semantic document analysis
    const analysis = analyzeDocumentMeta(filename, originalname + ' ' + customPrompt, mimetype);
    
    // Ensure target folder & subfolder exist
    const folderInfo = await ensureFolderHierarchy(analysis.targetFolder, analysis.subfolder, req.user.id);

    // Human-readable document name clean up
    const cleanDocName = originalname.replace(/\.[^/.]+$/, "").replace(/[-_]/g, ' ');

    // Insert document into database
    const insertRes = await dbRun(`
      INSERT INTO documents (
        folder_id, name, doc_type, renewal_date, description,
        original_filename, stored_filename, file_path, file_size, mime_type, uploaded_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      folderInfo.folderId,
      cleanDocName,
      analysis.docType,
      analysis.renewalDate,
      `Auto-organized by AI into "${folderInfo.folderName}"`,
      originalname,
      filename,
      req.file.path,
      size,
      mimetype,
      req.user.id
    ]);

    const createdDoc = await dbGet(`
      SELECT d.*, u.name as uploader_name, f.name as folder_name
      FROM documents d
      LEFT JOIN users u ON d.uploaded_by = u.id
      LEFT JOIN folders f ON d.folder_id = f.id
      WHERE d.id = ?
    `, [insertRes.lastID]);

    logAudit('AI_AUTO_ORGANIZED_UPLOAD', req.user.email, {
      docId: insertRes.lastID,
      docName: cleanDocName,
      folder: folderInfo.folderName,
      category: analysis.docType,
      renewalDate: analysis.renewalDate
    });

    res.json({
      success: true,
      message: `Document automatically organized into "${folderInfo.folderName}"!`,
      document: createdDoc,
      aiAnalysis: {
        category: analysis.docType,
        folder: folderInfo.folderName,
        renewalDate: analysis.renewalDate,
        summary: `Identified file as **${analysis.docType}** and filed it safely into **${folderInfo.folderName}**${analysis.renewalDate ? ` with a renewal reminder set for **${analysis.renewalDate}**` : ''}.`
      }
    });
  } catch (error) {
    console.error('AI Auto-Upload Error:', error);
    res.status(500).json({ success: false, message: 'AI auto-organization failed: ' + error.message });
  }
});

export default router;
