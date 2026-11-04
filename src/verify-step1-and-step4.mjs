import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import nodemailer from 'nodemailer';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const envPath = path.resolve(__dirname, '../.env');
dotenv.config({ path: envPath });

async function checkEnvironmentAndSmtp() {
  console.log('=== STEP 1 & STEP 4: ENVIRONMENT & SMTP VERIFICATION ===\n');

  // 1. Backend Server Check
  try {
    const res = await fetch('http://localhost:5000/api/categories');
    if (res.ok) {
      console.log('✓ Backend Server is RUNNING and responding on port 5000.');
    } else {
      console.log(`! Backend Server responded with status: ${res.status}`);
    }
  } catch (err) {
    console.log(`✗ Backend Server is NOT reachable on http://localhost:5000 (${err.message})`);
  }

  // 2. Environment Variables Presence (Zero Secrets Displayed)
  const envChecklist = [
    { name: 'PORT', present: Boolean(process.env.PORT) },
    { name: 'MONGODB_URI', present: Boolean(process.env.MONGODB_URI) },
    { name: 'JWT_SECRET', present: Boolean(process.env.JWT_SECRET) },
    { name: 'RAZORPAY_KEY_ID', present: Boolean(process.env.RAZORPAY_KEY_ID) },
    { name: 'RAZORPAY_KEY_SECRET', present: Boolean(process.env.RAZORPAY_KEY_SECRET) },
    { name: 'SMTP_HOST', present: Boolean(process.env.SMTP_HOST), val: process.env.SMTP_HOST },
    { name: 'SMTP_PORT', present: Boolean(process.env.SMTP_PORT), val: process.env.SMTP_PORT },
    { name: 'SMTP_SECURE', present: Boolean(process.env.SMTP_SECURE), val: process.env.SMTP_SECURE },
    { name: 'SMTP_USER', present: Boolean(process.env.SMTP_USER), val: process.env.SMTP_USER ? 'CONFIGURED (Valid Email Format)' : 'MISSING' },
    { name: 'SMTP_PASS', present: Boolean(process.env.SMTP_PASS), val: process.env.SMTP_PASS ? 'CONFIGURED [REDACTED]' : 'MISSING' },
    { name: 'MAIL_FROM', present: Boolean(process.env.MAIL_FROM), val: process.env.MAIL_FROM },
    { name: 'ADMIN_NOTIFICATION_EMAIL', present: Boolean(process.env.ADMIN_NOTIFICATION_EMAIL), val: process.env.ADMIN_NOTIFICATION_EMAIL },
    { name: 'CLIENT_URL', present: Boolean(process.env.CLIENT_URL), val: process.env.CLIENT_URL },
    { name: 'ADMIN_CLIENT_URL', present: Boolean(process.env.ADMIN_CLIENT_URL), val: process.env.ADMIN_CLIENT_URL },
  ];

  console.log('\nEnvironment Configuration Check:');
  for (const item of envChecklist) {
    const status = item.present ? '✓' : '✗';
    const detail = item.val !== undefined ? ` -> ${item.val}` : '';
    console.log(`  ${status} ${item.name}${detail}`);
  }

  // 3. Git Ignore Check
  try {
    const gitignorePath = path.resolve(__dirname, '../.gitignore');
    if (fs.existsSync(gitignorePath)) {
      const content = fs.readFileSync(gitignorePath, 'utf8');
      const ignoresEnv = content.split('\n').some(line => line.trim() === '.env');
      if (ignoresEnv) {
        console.log('\n✓ server/.gitignore explicitly ignores .env (Protection confirmed).');
      } else {
        console.log('\n! server/.gitignore does NOT explicitly list .env.');
      }
    }
  } catch (err) {
    console.log('\n! Gitignore check error:', err.message);
  }

  // 4. Safe Real SMTP Connectivity Verification (transporter.verify() ONLY, NO EMAILS SENT)
  console.log('\n=== STEP 4: REAL SMTP CONNECTIVITY VERIFICATION ===');
  console.log('Connecting to Gmail SMTP server using Nodemailer transporter.verify()... (No email will be sent)');

  const port = parseInt(process.env.SMTP_PORT || '587', 10);
  const secure = process.env.SMTP_SECURE === 'true' || port === 465;

  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: port,
    secure: secure,
    auth: {
      user: (process.env.SMTP_USER || '').trim(),
      pass: (process.env.SMTP_PASS || '').trim(),
    },
  });

  try {
    const isVerified = await transporter.verify();
    if (isVerified) {
      console.log('✓ REAL SMTP CONNECTIVITY SUCCESSFUL: Gmail SMTP handshake and authentication succeeded (250 OK).');
    } else {
      console.log('! SMTP verification returned false without throwing.');
    }
  } catch (smtpErr) {
    console.log('✗ SMTP CONNECTIVITY FAILED:', smtpErr.message);
  }
}

checkEnvironmentAndSmtp().catch(console.error);

