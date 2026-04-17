const cron = require('node-cron');
const db = require('../models/db');
const { purchasePolicy } = require('./policyOps');
const { notifyWorkerAction } = require('./notifier');

function start() {
  console.log('⏳ Renew Scheduler started');
  // Run every 1 minute to check for expirations (for testability)
  // In production, this would be daily (e.g. '0 0 * * *')
  cron.schedule('* * * * *', async () => {
    try {
      const now = new Date();
      const allPolicies = db.getPolicies();
      
      for (const policy of allPolicies) {
        if (policy.status !== 'active') continue;

        const remainingHours = Number(policy.remainingActiveHours ?? policy.coveredActiveHours ?? 0);

        if (remainingHours > 0 && remainingHours <= 6) {
          if (!policy.notifiedExpiring) {
            await notifyWorkerAction({
              workerId: policy.workerId,
              type: 'alert',
              inAppMessage: `Your ${db.getPlan(policy.planId)?.name || 'policy'} has only ${remainingHours} active hours left.`,
              emailSubject: 'Your policy is running low on protected hours',
              emailTitle: 'Protected hours running low',
              emailIntro: 'Your active coverage is nearing exhaustion.',
              emailLines: [`Remaining protected hours: ${remainingHours}h`],
              meta: { action: 'policy_low_hours', policyId: policy.id },
            });
            db.updatePolicy(policy.id, { notifiedExpiring: true });
          }
        }
        
        if (remainingHours <= 0) {
          if (policy.autoRenew) {
            const result = await purchasePolicy({
              workerId: policy.workerId,
              planId: policy.planId,
              autoRenew: true,
              source: 'auto_renew',
            });

            if (!result.error) {
              await notifyWorkerAction({
                workerId: policy.workerId,
                type: 'success',
                inAppMessage: `Your ${result.plan.name} has been auto-renewed for ₹${result.premium}.`,
                emailSubject: 'Policy auto-renewed successfully',
                emailTitle: 'Auto-renew complete',
                emailIntro: 'Your protection bundle has been renewed automatically.',
                emailLines: [
                  `Bundle premium: ₹${result.premium}`,
                  `Protected active hours: ${result.policy.coveredActiveHours}h`,
                ],
                meta: { action: 'auto_renew_success', policyId: result.policy.id, planId: result.plan.id },
              });
            } else {
              db.updatePolicy(policy.id, { status: 'expired' });
              await notifyWorkerAction({
                workerId: policy.workerId,
                type: 'error',
                inAppMessage: `Auto-renewal failed for ${db.getPlan(policy.planId)?.name || 'your plan'} due to insufficient wallet balance.`,
                emailSubject: 'Policy auto-renew failed',
                emailTitle: 'Auto-renew failed',
                emailIntro: 'We could not renew your policy automatically.',
                emailLines: [result.error],
                meta: { action: 'auto_renew_failed', policyId: policy.id },
              });
            }
          } else {
            db.updatePolicy(policy.id, { status: 'expired' });
            await notifyWorkerAction({
              workerId: policy.workerId,
              type: 'warning',
              inAppMessage: 'Your protected active hours are exhausted. Renew to stay covered.',
              emailSubject: 'Your policy has ended',
              emailTitle: 'Coverage ended',
              emailIntro: 'Your protected active hours have been fully used.',
              meta: { action: 'policy_expired', policyId: policy.id },
            });
          }
        }
      }
    } catch (e) {
      console.error('❌ Scheduler error:', e.message);
    }
  });
}

module.exports = { start };
