const cron = require('node-cron');
const db = require('../models/db');
const { calculatePremium } = require('./ml');

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

        const endDate = new Date(policy.endDate);
        const msLeft = endDate.getTime() - now.getTime();
        const hoursLeft = msLeft / (1000 * 60 * 60);

        // Less than 24 hours left: check if we should notify
        if (hoursLeft > 0 && hoursLeft <= 24) {
          if (!policy.notifiedExpiring) {
            db.addWorkerNotification(
              policy.workerId,
              'alert',
              `Your ${db.getPlan(policy.planId)?.name || 'policy'} expires in less than 24 hours!`
            );
            db.updatePolicy(policy.id, { notifiedExpiring: true });
          }
        }
        
        // Expired
        if (hoursLeft <= 0) {
          if (policy.autoRenew) {
            const worker = db.findWorkerById(policy.workerId);
            const plan = db.getPlan(policy.planId);
            
            if (worker && plan) {
              const pricing = await calculatePremium(worker, plan);
              const premium = pricing.dynamicWeeklyPremium;

              if ((worker.walletBalance || 0) >= premium) {
                // Debit and renew
                db.debitWallet(worker.id, premium, `Auto-renewal for ${plan.name}`, {
                  method: 'wallet',
                  planId: plan.id,
                  ref: 'REN' + Date.now().toString(36).toUpperCase()
                });

                db.updatePolicy(policy.id, { status: 'expired' });
                
                const newStart = new Date(now);
                const newEnd = new Date(now.getTime() + 7 * 86400000);

                db.createPolicy({
                  workerId: worker.id,
                  planId: plan.id,
                  zoneId: worker.zoneId,
                  weeklyPremium: premium,
                  maxWeeklyPayout: plan.maxWeeklyPayout,
                  status: 'active',
                  startDate: newStart.toISOString(),
                  endDate: newEnd.toISOString(),
                  totalPaidIn: premium,
                  totalPaidOut: 0,
                  claimCount: 0,
                  pricingBreakdown: pricing,
                  autoRenew: true
                });

                db.addWorkerNotification(
                  worker.id,
                  'success',
                  `Your ${plan.name} has been successfully auto-renewed for ₹${premium}.`
                );
              } else {
                // Insufficient funds
                db.updatePolicy(policy.id, { status: 'expired' });
                db.addWorkerNotification(
                  worker.id,
                  'error',
                  `Auto-renewal failed for ${plan.name} due to insufficient wallet balance.`
                );
              }
            } else {
              db.updatePolicy(policy.id, { status: 'expired' });
            }
          } else {
            // No auto-renew, just expire
            db.updatePolicy(policy.id, { status: 'expired' });
            db.addWorkerNotification(
              policy.workerId,
              'warning',
              `Your coverage has expired. Renew to stay protected from disruptions.`
            );
          }
        }
      }
    } catch (e) {
      console.error('❌ Scheduler error:', e.message);
    }
  });
}

module.exports = { start };
