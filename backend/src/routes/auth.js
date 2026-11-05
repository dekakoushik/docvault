import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { dbGet, dbRun, dbAll } from '../db.js';
import { authenticateToken, requireSuperadmin } from '../middleware/auth.js';
import { logAudit } from '../logger.js';

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'docvault_superadmin_secret_key_2026_production_ready';

// POST /api/auth/login - Mobile & Web compatible
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Email and password are required.' });
    }

    const cleanEmail = email.trim().toLowerCase();
    const user = await dbGet('SELECT * FROM users WHERE LOWER(email) = ?', [cleanEmail]);

    if (!user) {
      logAudit('LOGIN_FAILED', cleanEmail, { reason: 'User not found' });
      return res.status(401).json({ success: false, message: 'Invalid credentials.' });
    }

    if (user.status !== 'active') {
      logAudit('LOGIN_BLOCKED', cleanEmail, { reason: 'Account suspended/inactive' });
      return res.status(403).json({ success: false, message: 'Your account is deactivated. Contact administrator.' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      logAudit('LOGIN_FAILED', cleanEmail, { reason: 'Password mismatch' });
      return res.status(401).json({ success: false, message: 'Invalid credentials.' });
    }

    const tokenPayload = {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      mobile: user.mobile,
      department: user.department
    };

    const token = jwt.sign(tokenPayload, JWT_SECRET, { expiresIn: '7d' });

    logAudit('LOGIN_SUCCESS', user.email, { role: user.role, id: user.id });

    // Store activity log in db as well
    await dbRun(
      'INSERT INTO activity_logs (user_id, action, details, ip_address) VALUES (?, ?, ?, ?)',
      [user.id, 'USER_LOGIN', `Logged in via Portal/API`, req.ip || '127.0.0.1']
    );

    return res.json({
      success: true,
      message: 'Login successful',
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        mobile: user.mobile,
        role: user.role,
        department: user.department,
        status: user.status
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    return res.status(500).json({ success: false, message: 'Server error during login' });
  }
});

// GET /api/auth/me - Verify current token
router.get('/me', authenticateToken, async (req, res) => {
  try {
    const user = await dbGet('SELECT id, name, email, mobile, role, department, status, created_at FROM users WHERE id = ?', [req.user.id]);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    res.json({ success: true, user });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error fetching profile' });
  }
});

// POST /api/auth/register-user - Only Superadmin can register users
router.post('/register-user', authenticateToken, requireSuperadmin, async (req, res) => {
  try {
    const { name, mobile, email, password, role = 'user', department = 'General' } = req.body;

    if (!name || !mobile || !email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Name, mobile number, email, and password are required.'
      });
    }

    const cleanEmail = email.trim().toLowerCase();
    const cleanMobile = mobile.trim();
    const cleanName = name.trim();

    // Basic format validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(cleanEmail)) {
      return res.status(400).json({ success: false, message: 'Please provide a valid email address.' });
    }

    if (password.length < 6) {
      return res.status(400).json({ success: false, message: 'Password must be at least 6 characters long.' });
    }

    // Check duplicate email
    const existing = await dbGet('SELECT id FROM users WHERE LOWER(email) = ?', [cleanEmail]);
    if (existing) {
      return res.status(409).json({ success: false, message: 'User with this email already exists.' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const result = await dbRun(
      `INSERT INTO users (name, email, mobile, password, role, department, status)
       VALUES (?, ?, ?, ?, ?, ?, 'active')`,
      [cleanName, cleanEmail, cleanMobile, hashedPassword, role, department]
    );

    const createdUser = {
      id: result.lastID,
      name: cleanName,
      email: cleanEmail,
      mobile: cleanMobile,
      role,
      department,
      status: 'active'
    };

    logAudit('USER_REGISTERED', req.user.email, {
      newUserId: result.lastID,
      newUserName: cleanName,
      newUserEmail: cleanEmail,
      role
    });

    await dbRun(
      'INSERT INTO activity_logs (user_id, action, details, ip_address) VALUES (?, ?, ?, ?)',
      [req.user.id, 'USER_REGISTERED', `Created account for ${cleanEmail} (${role})`, req.ip || '127.0.0.1']
    );

    return res.status(201).json({
      success: true,
      message: 'User registered successfully',
      user: createdUser
    });
  } catch (error) {
    console.error('Register user error:', error);
    return res.status(500).json({ success: false, message: 'Error registering user' });
  }
});

// GET /api/auth/users - Superadmin list all users
router.get('/users', authenticateToken, requireSuperadmin, async (req, res) => {
  try {
    const users = await dbAll(
      `SELECT id, name, email, mobile, role, department, status, created_at 
       FROM users 
       ORDER BY id DESC`
    );
    res.json({ success: true, count: users.length, users });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error retrieving users' });
  }
});

// PATCH /api/auth/users/:id/status - Superadmin toggle user status
router.patch('/users/:id/status', authenticateToken, requireSuperadmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!['active', 'inactive', 'suspended'].includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid status' });
    }

    if (parseInt(id, 10) === req.user.id) {
      return res.status(400).json({ success: false, message: 'Superadmin cannot alter their own status.' });
    }

    await dbRun('UPDATE users SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [status, id]);

    logAudit('USER_STATUS_UPDATED', req.user.email, { targetUserId: id, status });

    res.json({ success: true, message: `User status changed to ${status}` });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error updating status' });
  }
});

// DELETE /api/auth/users/:id - Superadmin delete user
router.delete('/users/:id', authenticateToken, requireSuperadmin, async (req, res) => {
  try {
    const { id } = req.params;

    if (parseInt(id, 10) === req.user.id) {
      return res.status(400).json({ success: false, message: 'Superadmin cannot delete their own account.' });
    }

    await dbRun('DELETE FROM users WHERE id = ?', [id]);
    logAudit('USER_DELETED', req.user.email, { deletedUserId: id });

    res.json({ success: true, message: 'User deleted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error deleting user' });
  }
});

// GET /api/auth/logs - Superadmin view system activity logs
router.get('/logs', authenticateToken, requireSuperadmin, async (req, res) => {
  try {
    const logs = await dbAll(
      `SELECT l.id, l.action, l.details, l.ip_address, l.created_at, u.name as user_name, u.email as user_email
       FROM activity_logs l
       LEFT JOIN users u ON l.user_id = u.id
       ORDER BY l.id DESC
       LIMIT 50`
    );
    res.json({ success: true, logs });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error fetching logs' });
  }
});

export default router;

