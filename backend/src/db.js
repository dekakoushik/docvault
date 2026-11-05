import sqlite3 from 'sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import bcrypt from 'bcryptjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dbDir = path.resolve(__dirname, '../../database');
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const uploadsDir = path.resolve(__dirname, '../../uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const dbPath = path.resolve(__dirname, '../../database/docvault.sqlite');

const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Error opening SQLite database:', err.message);
  } else {
    console.log('Connected to SQLite database at:', dbPath);
  }
});

export const dbRun = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) reject(err);
      else resolve({ lastID: this.lastID, changes: this.changes });
    });
  });
};

export const dbGet = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
};

export const dbAll = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
};

export async function initDatabase() {
  // Users table
  await dbRun(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      mobile TEXT NOT NULL,
      password TEXT NOT NULL,
      role TEXT DEFAULT 'user',
      department TEXT DEFAULT 'General',
      status TEXT DEFAULT 'active',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Folders table
  await dbRun(`
    CREATE TABLE IF NOT EXISTS folders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      description TEXT,
      created_by INTEGER NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (created_by) REFERENCES users(id)
    )
  `);

  // Documents table (stores any file type, document name, type/category, renewal_date, file_path, tags, size, etc.)
  await dbRun(`
    CREATE TABLE IF NOT EXISTS documents (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      folder_id INTEGER,
      name TEXT NOT NULL,
      doc_type TEXT NOT NULL,
      renewal_date TEXT,
      description TEXT,
      original_filename TEXT NOT NULL,
      stored_filename TEXT NOT NULL,
      file_path TEXT NOT NULL,
      file_size INTEGER NOT NULL,
      mime_type TEXT,
      uploaded_by INTEGER NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (folder_id) REFERENCES folders(id) ON DELETE SET NULL,
      FOREIGN KEY (uploaded_by) REFERENCES users(id)
    )
  `);

  // Activity logs table
  await dbRun(`
    CREATE TABLE IF NOT EXISTS activity_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      action TEXT NOT NULL,
      details TEXT,
      ip_address TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Default General folder
  const generalFolder = await dbGet('SELECT * FROM folders WHERE name = ?', ['General Vault']);
  if (!generalFolder) {
    await dbRun(
      `INSERT INTO folders (name, description, created_by) VALUES (?, ?, ?)`,
      ['General Vault', 'Default repository for corporate and user documents', 1]
    );
  }

  // Seed default superadmin if not exists
  const adminEmail = process.env.DEFAULT_ADMIN_EMAIL || 'superadmin@docvault.com';
  const existingAdmin = await dbGet('SELECT * FROM users WHERE email = ?', [adminEmail]);

  if (!existingAdmin) {
    const defaultPassword = process.env.DEFAULT_ADMIN_PASSWORD || 'Admin@123456';
    const hashedPassword = await bcrypt.hash(defaultPassword, 10);
    const adminName = process.env.DEFAULT_ADMIN_NAME || 'Super Administrator';
    const adminPhone = process.env.DEFAULT_ADMIN_PHONE || '9876543210';

    await dbRun(
      `INSERT INTO users (name, email, mobile, password, role, department, status)
       VALUES (?, ?, ?, ?, 'superadmin', 'Executive', 'active')`,
      [adminName, adminEmail, adminPhone, hashedPassword]
    );

    console.log(`[Seed] Superadmin created with email: ${adminEmail}`);
  }
}

export default db;
