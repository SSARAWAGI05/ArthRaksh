const cron = require('node-cron');
const { verifyMailConfig, mailEnabled } = require('./email');
const { processQueuedEmails, getEmailDeliverySummary } = require('./notifier');

let started = false;

async function runQueuePass() {
  try {
    const results = await processQueuedEmails(25);
    return results;
  } catch (error) {
    console.error('❌ Mail queue error:', error.message);
    return [];
  }
}

function start() {
  if (started) return;
  started = true;

  verifyMailConfig()
    .then(status => {
      if (!status.configured) {
        console.warn('📭 Email delivery is not configured yet. Events will stay queued until SMTP is set.');
        return;
      }
      if (!status.verified) {
        console.warn(`📭 SMTP is configured but not verified: ${status.reason}`);
        return;
      }
      console.log('📬 Mail queue ready');
      runQueuePass().catch(() => {});
    })
    .catch(error => {
      console.warn(`📭 SMTP verification failed: ${error.message}`);
    });

  cron.schedule('* * * * *', async () => {
    const results = await runQueuePass();
    if (results.length) {
      const sent = results.filter(result => result?.delivered).length;
      const failed = results.filter(result => result && !result.delivered && !result.skipped).length;
      if (sent || failed) {
        console.log(`📬 Mail queue processed ${results.length} event(s): ${sent} sent, ${failed} pending/failed`);
      }
    }
  });
}

async function getMailSystemStatus() {
  const smtp = await verifyMailConfig();
  return {
    smtp,
    mailEnabled,
    queue: getEmailDeliverySummary(),
  };
}

module.exports = {
  start,
  runQueuePass,
  getMailSystemStatus,
};
