import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
// Resolve agent log dir: check env AGENT_DIR, else resolve relative to project root
const agentLogDir = process.env.AGENT_DIR || path.resolve(__dirname, '../../.agent');

if (!fs.existsSync(agentLogDir)) {
  fs.mkdirSync(agentLogDir, { recursive: true });
}

const auditLogPath = path.join(agentLogDir, 'audit.log');

export function logAudit(action, actor, details = {}) {
  const timestamp = new Date().toISOString();
  const logEntry = `[${timestamp}] [ACTOR: ${actor || 'SYSTEM'}] [ACTION: ${action}] ${JSON.stringify(details)}\n`;

  try {
    fs.appendFileSync(auditLogPath, logEntry, 'utf8');
  } catch (err) {
    console.error('Failed to write to .agent/audit.log:', err.message);
  }
}
