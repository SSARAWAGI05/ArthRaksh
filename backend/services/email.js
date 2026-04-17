const nodemailer = require('nodemailer');

const mailEnabled = Boolean(
  process.env.SMTP_HOST &&
  process.env.SMTP_PORT &&
  process.env.SMTP_USER &&
  process.env.SMTP_PASS
);

const DEFAULT_TIMEOUT_MS = Number(process.env.SMTP_TIMEOUT_MS || 15000);

let transporter = null;
let lastVerify = null;

function getTransporter() {
  if (!mailEnabled) return null;
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT),
      secure: process.env.SMTP_SECURE
        ? String(process.env.SMTP_SECURE).toLowerCase() === 'true'
        : Number(process.env.SMTP_PORT) === 465,
      requireTLS: String(process.env.SMTP_REQUIRE_TLS || '').toLowerCase() === 'true',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
      connectionTimeout: DEFAULT_TIMEOUT_MS,
      greetingTimeout: DEFAULT_TIMEOUT_MS,
      socketTimeout: DEFAULT_TIMEOUT_MS,
    });
  }
  return transporter;
}

async function verifyMailConfig(force = false) {
  if (!mailEnabled) {
    return {
      configured: false,
      verified: false,
      reason: 'SMTP is not configured',
    };
  }

  if (!force && lastVerify && (Date.now() - lastVerify.checkedAt) < 60000) {
    return lastVerify;
  }

  try {
    const tx = getTransporter();
    await tx.verify();
    lastVerify = {
      configured: true,
      verified: true,
      checkedAt: Date.now(),
      reason: null,
    };
  } catch (error) {
    lastVerify = {
      configured: true,
      verified: false,
      checkedAt: Date.now(),
      reason: error.message,
    };
  }

  return lastVerify;
}

async function sendMail({ to, subject, html, text }) {
  const from = process.env.SMTP_FROM || process.env.SMTP_USER || 'no-reply@gigshield.local';
  const tx = getTransporter();

  if (!tx) {
    return {
      delivered: false,
      skipped: true,
      reason: 'SMTP is not configured',
    };
  }

  const info = await tx.sendMail({ from, to, subject, html, text });
  lastVerify = {
    configured: true,
    verified: true,
    checkedAt: Date.now(),
    reason: null,
  };
  return {
    delivered: true,
    skipped: false,
    messageId: info.messageId,
  };
}

module.exports = { sendMail, mailEnabled, verifyMailConfig };
