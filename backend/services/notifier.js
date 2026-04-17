const db = require('../models/db');
const { sendMail, mailEnabled } = require('./email');

const MAX_EMAIL_ATTEMPTS = Number(process.env.EMAIL_MAX_ATTEMPTS || 5);

function wrapEmailHtml({ title, intro, bodyLines = [], footer }) {
  const lines = bodyLines.map(line => `<li style="margin:0 0 8px;">${line}</li>`).join('');
  return `
    <div style="font-family:Arial,sans-serif;background:#f5f7fb;padding:24px;color:#1f2937;">
      <div style="max-width:640px;margin:0 auto;background:#ffffff;border-radius:18px;padding:28px;border:1px solid #e5e7eb;">
        <div style="font-size:12px;letter-spacing:.14em;text-transform:uppercase;color:#2563eb;font-weight:700;margin-bottom:10px;">GigShield Updates</div>
        <h1 style="margin:0 0 12px;font-size:26px;line-height:1.2;color:#111827;">${title}</h1>
        <p style="margin:0 0 18px;font-size:15px;line-height:1.6;color:#374151;">${intro}</p>
        ${lines ? `<ul style="padding-left:18px;margin:0 0 18px;font-size:14px;line-height:1.5;color:#4b5563;">${lines}</ul>` : ''}
        <p style="margin:0;font-size:13px;line-height:1.6;color:#6b7280;">${footer || 'You are receiving this because action alerts are enabled for your GigShield account.'}</p>
      </div>
    </div>
  `;
}

function buildEmailPayload({ emailSubject, emailTitle, emailIntro, emailLines = [], inAppMessage }) {
  const subject = emailSubject || emailTitle || 'GigShield account update';
  const title = emailTitle || subject;
  const intro = emailIntro || inAppMessage || 'There is a new update on your account.';
  const text = [intro, ...emailLines].filter(Boolean).join('\n');
  const html = wrapEmailHtml({ title, intro, bodyLines: emailLines });

  return { subject, title, intro, emailLines, text, html };
}

function getRetryableEmailEvents(limit = 20) {
  return db.getEmailEvents()
    .filter(event => {
      if (!event?.to) return false;
      if (!event.subject || !event.html || !event.text) return false;
      if (event.status === 'sent' || event.status === 'skipped') return false;
      return Number(event.attempts || 0) < MAX_EMAIL_ATTEMPTS;
    })
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
    .slice(0, limit);
}

async function deliverEmailEvent(eventId) {
  const event = db.getEmailEventById(eventId);
  if (!event) return null;

  if (!event.to) {
    db.updateEmailEvent(event.id, { status: 'skipped', reason: 'Worker has no email address' });
    return { emailEvent: db.getEmailEventById(event.id), delivered: false, skipped: true };
  }

  if (!mailEnabled) {
    db.updateEmailEvent(event.id, {
      status: 'queued',
      reason: 'SMTP is not configured',
    });
    return { emailEvent: db.getEmailEventById(event.id), delivered: false, skipped: false, queued: true };
  }

  const nextAttempts = Number(event.attempts || 0) + 1;
  db.updateEmailEvent(event.id, {
    status: nextAttempts >= MAX_EMAIL_ATTEMPTS ? 'failed' : 'retrying',
    attempts: nextAttempts,
    lastAttemptAt: new Date().toISOString(),
    reason: null,
  });

  try {
    const result = await sendMail({
      to: event.to,
      subject: event.subject,
      html: event.html,
      text: event.text,
    });

    if (!result.delivered) {
      const status = result.skipped ? 'queued' : (nextAttempts >= MAX_EMAIL_ATTEMPTS ? 'failed' : 'retrying');
      db.updateEmailEvent(event.id, {
        status,
        reason: result.reason || null,
      });
      return { emailEvent: db.getEmailEventById(event.id), ...result };
    }

    db.updateEmailEvent(event.id, {
      status: 'sent',
      deliveredAt: new Date().toISOString(),
      reason: null,
      messageId: result.messageId || null,
    });
    return { emailEvent: db.getEmailEventById(event.id), ...result };
  } catch (error) {
    db.updateEmailEvent(event.id, {
      status: nextAttempts >= MAX_EMAIL_ATTEMPTS ? 'failed' : 'retrying',
      reason: error.message,
    });
    return {
      emailEvent: db.getEmailEventById(event.id),
      delivered: false,
      skipped: false,
      reason: error.message,
    };
  }
}

async function processQueuedEmails(limit = 20) {
  const events = getRetryableEmailEvents(limit);
  const results = [];

  for (const event of events) {
    // Retry only if the next attempt is due.
    const lastAttemptAt = event.lastAttemptAt ? new Date(event.lastAttemptAt).getTime() : 0;
    const backoffMs = Math.min(30 * 60000, Math.max(15000, Number(event.attempts || 0) * 15000));
    if (lastAttemptAt && (Date.now() - lastAttemptAt) < backoffMs) continue;
    results.push(await deliverEmailEvent(event.id));
  }

  return results;
}

function getEmailDeliverySummary() {
  const events = db.getEmailEvents();
  return {
    total: events.length,
    queued: events.filter(event => event.status === 'queued' || event.status === 'retrying').length,
    failed: events.filter(event => event.status === 'failed').length,
    sent: events.filter(event => event.status === 'sent').length,
    skipped: events.filter(event => event.status === 'skipped').length,
  };
}

async function notifyWorkerAction({
  workerId,
  type = 'info',
  inAppMessage,
  emailSubject,
  emailTitle,
  emailIntro,
  emailLines = [],
  meta = {},
}) {
  const worker = db.findWorkerById(workerId);
  if (!worker) return null;

  if (inAppMessage) {
    db.addWorkerNotification(workerId, type, inAppMessage);
  }

  const payload = buildEmailPayload({
    emailSubject,
    emailTitle,
    emailIntro,
    emailLines,
    inAppMessage,
  });

  const emailEvent = db.addEmailEvent({
    workerId,
    to: worker.email || null,
    subject: payload.subject,
    type,
    meta,
    title: payload.title,
    intro: payload.intro,
    emailLines: payload.emailLines,
    html: payload.html,
    text: payload.text,
  });

  if (!worker.email) {
    db.updateEmailEvent(emailEvent.id, { status: 'skipped', reason: 'Worker has no email address' });
    return { emailEvent: db.getEmailEventById(emailEvent.id), delivered: false, skipped: true };
  }

  return deliverEmailEvent(emailEvent.id);
}

module.exports = {
  notifyWorkerAction,
  mailEnabled,
  deliverEmailEvent,
  processQueuedEmails,
  getEmailDeliverySummary,
};
