import dotenv from 'dotenv';
dotenv.config();
import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';
import { connectDB } from './config/db.js';
import { Admin } from './models/Admin.js';

async function createAdmin() {
  try {
    await connectDB();

    const args = process.argv.slice(2);
    const email = (args[0] || process.env.ADMIN_EMAIL || 'dev@youngdecade.com').toLowerCase().trim();
    const password = args[1] || process.env.ADMIN_PASSWORD || 'AdminVoltix2026!';
    const name = args[2] || process.env.ADMIN_NAME || 'PLUXPC Administrator';

    if (password.length < 8) {
      console.error('Password must be at least 8 characters long');
      process.exit(1);
    }

    const salt = await bcrypt.genSalt(12);
    const passwordHash = await bcrypt.hash(password, salt);

    const existing = await Admin.findOne({ email });
    if (existing) {
      existing.name = name;
      existing.passwordHash = passwordHash;
      await existing.save();
      console.log(`[Admin] Existing admin "${email}" updated with new password.`);
    } else {
      await Admin.create({
        name,
        email,
        passwordHash,
        role: 'admin',
      });
      console.log(`[Admin] Admin account created successfully for "${email}".`);
    }

    console.log(`Credentials:\n  Email: ${email}\n  Role: admin`);
    await mongoose.disconnect();
    process.exit(0);
  } catch (err) {
    console.error('[Create Admin Error]:', err);
    process.exit(1);
  }
}

createAdmin();

