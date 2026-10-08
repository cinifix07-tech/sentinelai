const bcrypt = require('bcrypt');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const { query, missingConfig } = require('../config/database');
const { recordActivity } = require('../services/activityLog');

const passwordColumns = ['password_hash', 'password'];
const resetOtpRecords = new Map();
const resetOtpTtlMs = 5 * 60 * 1000;
const resetVerifiedTtlMs = 10 * 60 * 1000;
const fallbackUsers = [
  { user_id: 'dev-admin', email: 'admin@cinifix.com', password: '0147', full_name: 'Cinifix Admin', role: 'ADMIN' },
  { user_id: 'dev-client', email: 'client@cinifix.com', password: '0147', full_name: 'Sarah Chen', role: 'USER' },
];

function signUser(user, devMode = false) {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < 32) {
    const error = new Error('JWT_SECRET must be configured with at least 32 characters.');
    error.status = 503;
    throw error;
  }
  const token = jwt.sign(
    { user_id: user.user_id || user.id, email: user.email, role: user.role, dev_mode: devMode },
    secret,
    { expiresIn: '12h' }
  );

  return {
    token,
    user_id: user.user_id || user.id,
    email: user.email,
    full_name: user.full_name || user.name || user.email,
    role: user.role || 'USER',
    dev_mode: devMode,
  };
}

function fallbackLogin(email, password) {
  const fallbackEnabled = process.env.NODE_ENV !== 'production'
    && process.env.ALLOW_DEV_FALLBACK_AUTH === 'true';
  if (!fallbackEnabled) return null;
  const missing = missingConfig();
  if (!missing.includes('DATABASE_PASSWORD')) return null;
  const user = fallbackUsers.find((item) => item.email === email.toLowerCase() && item.password === password);
  return user ? signUser(user, true) : null;
}

function hashOtp(email, code) {
  const secret = process.env.JWT_SECRET || 'local-development-secret-change-me';
  return crypto.createHash('sha256').update(`${email}:${code}:${secret}`).digest('hex');
}

function maskEmail(email) {
  const [name, domain] = email.split('@');
  if (!domain) return email;
  const visible = name.slice(0, 2);
  return `${visible}${'*'.repeat(Math.max(name.length - 2, 2))}@${domain}`;
}

function safeOtpMatch(expected, actual) {
  const expectedBuffer = Buffer.from(expected);
  const actualBuffer = Buffer.from(actual);
  return expectedBuffer.length === actualBuffer.length && crypto.timingSafeEqual(expectedBuffer, actualBuffer);
}

async function sendOtpEmail(email, code, user) {
  const smtpUser = process.env.SMTP_USER;
  const smtpPass = process.env.SMTP_PASS;
  if (!smtpUser || !smtpPass) {
    return { sent: false, reason: 'SMTP_USER and SMTP_PASS are not configured' };
  }

  let nodemailer;
  try {
    nodemailer = require('nodemailer');
  } catch {
    return { sent: false, reason: 'nodemailer is not installed' };
  }

  const port = Number(process.env.SMTP_PORT || 465);
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port,
    secure: String(process.env.SMTP_SECURE || '').toLowerCase() === 'false' ? false : port === 465,
    auth: {
      user: smtpUser,
      pass: smtpPass,
    },
  });

  const appName = process.env.APP_NAME || 'Sentinel AI';
  const displayName = user.full_name || user.email;
  await transporter.sendMail({
    from: process.env.SMTP_FROM || `"${appName}" <${smtpUser}>`,
    to: email,
    subject: `${appName} password reset OTP`,
    text: `Hello ${displayName},\n\nYour ${appName} password reset OTP is ${code}. It expires in 5 minutes.\n\nIf you did not request this, ignore this email.`,
    html: `
      <div style="font-family:Inter,Arial,sans-serif;background:#eef4f6;padding:28px;color:#0b1c30">
        <div style="max-width:520px;margin:auto;background:#ffffff;border-radius:18px;padding:28px;border:1px solid #d9e5ea">
          <p style="margin:0 0 8px;font-size:12px;letter-spacing:3px;text-transform:uppercase;color:#00796b">Sentinel AI verification</p>
          <h1 style="margin:0 0 12px;font-size:26px">Password reset OTP</h1>
          <p style="margin:0 0 20px;color:#4f6473">Hello ${displayName}, use this premium recovery code to continue changing your password.</p>
          <div style="font-size:34px;font-weight:800;letter-spacing:10px;background:#eef7f6;color:#00796b;border-radius:14px;padding:18px 20px;text-align:center">${code}</div>
          <p style="margin:20px 0 0;color:#637887;font-size:13px">This code expires in 5 minutes. If you did not request this, you can safely ignore this email.</p>
        </div>
      </div>
    `,
  });

  return { sent: true };
}

async function login(req, res, next) {
  try {
    const { email, password } = req.body || {};
    if (!email || !password) return res.status(400).json({ error: 'Email and password are required' });

    const fallback = fallbackLogin(email, password);
    if (fallback) {
      res.cookie('sentinel_session', fallback.token, {
        httpOnly: true,
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
        maxAge: 12 * 60 * 60 * 1000,
      });
      await recordActivity({
        req,
        actor: fallback,
        result: 'LOGIN_SUCCESS',
        reason: `${fallback.role || 'USER'} signed in with fallback account ${fallback.email}`,
      });
      return res.json(fallback);
    }

    const result = await query('SELECT * FROM users WHERE email = $1 LIMIT 1', [email.toLowerCase()]);
    const user = result.rows[0];
    if (!user) {
      await recordActivity({
        req,
        actor: { email: String(email).toLowerCase() },
        result: 'LOGIN_FAILED',
        reason: `Failed sign-in for unknown email ${String(email).toLowerCase()}`,
      });
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const stored = passwordColumns.map((column) => user[column]).find(Boolean);
    const valid = stored && await bcrypt.compare(password, stored);
    if (!valid) {
      await recordActivity({
        req,
        actor: user,
        result: 'LOGIN_FAILED',
        reason: `Failed sign-in for ${user.email}`,
      });
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const signed = signUser({ ...user, role: user.role || 'USER' });
    res.cookie('sentinel_session', signed.token, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      maxAge: 12 * 60 * 60 * 1000,
    });
    await recordActivity({
      req,
      actor: signed,
      result: 'LOGIN_SUCCESS',
      reason: `${signed.role || 'USER'} signed in as ${signed.email}`,
    });
    res.json(signed);
  } catch (error) {
    next(error);
  }
}

async function sendResetOtp(req, res, next) {
  try {
    const { email } = req.body || {};
    const normalizedEmail = String(email || '').trim().toLowerCase();

    if (!normalizedEmail) {
      return res.status(400).json({ error: 'Email address is required' });
    }

    const userResult = await query(
      'SELECT user_id, email, full_name, role FROM users WHERE email = $1 LIMIT 1',
      [normalizedEmail]
    );
    const user = userResult.rows[0];
    if (!user) return res.status(404).json({ error: 'No user account found for that email address' });

    const code = String(crypto.randomInt(100000, 1000000));
    resetOtpRecords.set(normalizedEmail, {
      codeHash: hashOtp(normalizedEmail, code),
      expiresAt: Date.now() + resetOtpTtlMs,
      attempts: 0,
      verifiedUntil: 0,
    });

    const delivery = await sendOtpEmail(normalizedEmail, code, user);
    if (process.env.NODE_ENV === 'production' && !delivery.sent) {
      resetOtpRecords.delete(normalizedEmail);
      return res.status(503).json({ error: 'Password recovery is temporarily unavailable. Configure secure email delivery.' });
    }
    await recordActivity({
      req,
      actor: user,
      result: 'OTP_SENT',
      reason: `Password reset OTP requested for ${normalizedEmail}`,
    });

    res.json({
      ok: true,
      message: delivery.sent
        ? `OTP sent to ${maskEmail(normalizedEmail)}.`
        : 'OTP generated. Configure SMTP_USER and SMTP_PASS to send it through Gmail.',
      ...(process.env.NODE_ENV !== 'production' && process.env.ALLOW_DEV_FALLBACK_AUTH === 'true'
        ? { dev_otp: delivery.sent ? undefined : code }
        : {}),
      delivery: process.env.NODE_ENV === 'production' ? undefined : delivery,
      user: {
        email: user.email,
        full_name: user.full_name || user.email,
        role: user.role || 'USER',
      },
    });
  } catch (error) {
    next(error);
  }
}

async function verifyResetOtp(req, res, next) {
  try {
    const { email, code } = req.body || {};
    const normalizedEmail = String(email || '').trim().toLowerCase();
    const normalizedCode = String(code || '').trim();

    if (!normalizedEmail || !normalizedCode) {
      return res.status(400).json({ error: 'Email and OTP are required' });
    }

    const record = resetOtpRecords.get(normalizedEmail);
    if (!record) return res.status(400).json({ error: 'Request a new OTP first' });
    if (record.expiresAt < Date.now()) {
      resetOtpRecords.delete(normalizedEmail);
      return res.status(400).json({ error: 'OTP expired. Request a new code.' });
    }
    if (record.attempts >= 5) {
      resetOtpRecords.delete(normalizedEmail);
      return res.status(429).json({ error: 'Too many OTP attempts. Request a new code.' });
    }

    record.attempts += 1;
    const valid = safeOtpMatch(record.codeHash, hashOtp(normalizedEmail, normalizedCode));
    if (!valid) return res.status(401).json({ error: 'Invalid OTP code' });

    record.verifiedUntil = Date.now() + resetVerifiedTtlMs;
    await recordActivity({
      req,
      result: 'OTP_VERIFIED',
      reason: `Password reset OTP verified for ${normalizedEmail}`,
    });
    res.json({ ok: true, message: 'OTP verified. You can now change your password.' });
  } catch (error) {
    next(error);
  }
}

async function resetPassword(req, res, next) {
  try {
    const { email, password } = req.body || {};
    const normalizedEmail = String(email || '').trim().toLowerCase();
    const nextPassword = String(password || '');

    if (!normalizedEmail || !nextPassword) {
      return res.status(400).json({ error: 'Email and new password are required' });
    }

    if (nextPassword.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters' });
    }

    const otpRecord = resetOtpRecords.get(normalizedEmail);
    if (!otpRecord || otpRecord.verifiedUntil < Date.now()) {
      return res.status(401).json({ error: 'Verify the Gmail OTP before changing the password' });
    }

    const userResult = await query('SELECT user_id, email FROM users WHERE email = $1 LIMIT 1', [normalizedEmail]);
    const user = userResult.rows[0];
    if (!user) return res.status(404).json({ error: 'No user account found for that email address' });

    const rounds = Number(process.env.BCRYPT_ROUNDS || 10);
    const hash = await bcrypt.hash(nextPassword, rounds);
    await query('UPDATE users SET password_hash = $1 WHERE email = $2', [hash, normalizedEmail]);
    resetOtpRecords.delete(normalizedEmail);
    await recordActivity({
      req,
      actor: user,
      result: 'PASSWORD_RESET',
      reason: `Password updated for ${normalizedEmail}`,
    });

    res.json({ ok: true, message: 'Password updated successfully. You can now sign in.' });
  } catch (error) {
    next(error);
  }
}

module.exports = { login, resetPassword, sendResetOtp, verifyResetOtp };
