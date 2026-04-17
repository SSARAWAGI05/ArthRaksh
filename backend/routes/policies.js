const router = require('express').Router();
const db     = require('../models/db');
const { auth, adminOnly } = require('../middleware/auth');
const { getPlanQuote, purchasePolicy, topUpPolicyHours } = require('../services/policyOps');
const { notifyWorkerAction } = require('../services/notifier');
const { getRiskCalendar, getShiftForecast } = require('../services/riskIntel');

// POST /api/policies/plans (admin)
router.post('/plans', auth, adminOnly, (req, res) => {
  const plan = db.addPlan(req.body);
  res.status(201).json({ message: 'Plan created successfully', plan });
});

// GET /api/policies/plans
router.get('/plans', auth, async (req, res) => {
  try {
    const worker = db.findWorkerById(req.user.id);
    if (!worker) return res.status(404).json({ error: 'Worker not found' });
    const plans = await Promise.all(
      db.getPlans().map(async plan => ({ ...plan, pricing: await getPlanQuote(worker, plan) }))
    );
    res.json({ plans });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /api/policies/active
router.get('/active', auth, (req, res) => {
  const policy = db.getActivePolicy(req.user.id);
  if (!policy) return res.json({ policy: null });
  res.json({ policy: { ...policy, plan: db.getPlan(policy.planId), zone: db.getZone(policy.zoneId) } });
});

// GET /api/policies/my
router.get('/my', auth, (req, res) => {
  const list = db.getPoliciesByWorker(req.user.id).map(p => ({
    ...p, plan: db.getPlan(p.planId), zone: db.getZone(p.zoneId),
  }));
  res.json({ policies: list });
});

// POST /api/policies — purchase weekly plan (deducts from wallet)
router.post('/', auth, async (req, res) => {
  try {
    const { planId, autoRenew = false, source = 'wallet', activationMode = 'manual', shiftIntent = null } = req.body;
    const result = await purchasePolicy({ workerId: req.user.id, planId, autoRenew, source, activationMode, shiftIntent });
    if (result.error) {
      return res.status(result.status || 400).json({
        error: result.error,
        required: result.required,
        balance: result.balance,
      });
    }

    await notifyWorkerAction({
      workerId: req.user.id,
      type: 'success',
      inAppMessage: `${result.plan.name} weekly protection activated. ${result.policy.coveredActiveHours} protected hours are now available this week.`,
      emailSubject: activationMode === 'shift_shield' ? 'ShiftShield activated your weekly cover' : 'Your GigShield policy is now active',
      emailTitle: 'Coverage activated',
      emailIntro: activationMode === 'shift_shield'
        ? `${result.plan.name} is now live for your upcoming shift and the rest of the week.`
        : `${result.plan.name} is now live on your account.`,
      emailLines: [
        `Bundle premium: ₹${result.premium}`,
        `Protected active hours: ${result.policy.coveredActiveHours}h`,
        `Wallet balance after purchase: ₹${result.balance}`,
      ],
      meta: { action: 'policy_purchase', policyId: result.policy.id, planId: result.plan.id, activationMode },
    });

    res.status(201).json({
      policy: { ...result.policy, plan: result.plan, zone: db.getZone(result.worker.zoneId) },
      message: activationMode === 'shift_shield'
        ? `ShiftShield activated ${result.plan.name}. ₹${result.premium} was deducted from your GigShield Wallet.`
        : `Policy activated! ₹${result.premium} deducted from your GigShield Wallet.`,
      walletBalance: result.worker.walletBalance,
    });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/policies/shift/start — recommend and activate the best weekly plan for the next shift
router.post('/shift/start', auth, async (req, res) => {
  try {
    const worker = db.findWorkerById(req.user.id);
    if (!worker) return res.status(404).json({ error: 'Worker not found' });

    const zone = db.getZone(worker.zoneId);
    const plans = db.getPlans();
    const calendar = getRiskCalendar(zone);
    const shift = getShiftForecast(worker, zone, plans, calendar);

    if (!shift.recommendation?.planId) {
      return res.status(400).json({ error: 'No weekly plan recommendation available for this shift' });
    }

    const recommendedPlan = db.getPlan(shift.recommendation.planId);
    const active = db.getActivePolicy(worker.id);
    const activePlan = active ? db.getPlan(active.planId) : null;
    const requiredTriggers = shift.dominantTriggers.map(item => item.type);
    const activeIsAdequate = !!(
      active &&
      activePlan &&
      Number(active.remainingActiveHours || 0) >= shift.hours &&
      requiredTriggers.every(trigger => activePlan.triggers.includes(trigger))
    );

    if (activeIsAdequate) {
      return res.json({
        reusedPolicy: true,
        message: `${activePlan.name} already covers the next ${shift.hours}-hour shift.`,
        policy: { ...active, plan: activePlan, zone },
        shift,
      });
    }

    const result = await purchasePolicy({
      workerId: worker.id,
      planId: recommendedPlan.id,
      autoRenew: false,
      source: 'wallet',
      activationMode: 'shift_shield',
      shiftIntent: {
        createdAt: new Date().toISOString(),
        hours: shift.hours,
        earningsAtRisk: shift.earningsAtRisk,
        dominantTriggers: shift.dominantTriggers,
      },
    });

    if (result.error) {
      return res.status(result.status || 400).json({
        error: result.error,
        required: result.required,
        balance: result.balance,
        shift,
        recommendedPlan,
      });
    }

    await notifyWorkerAction({
      workerId: worker.id,
      type: 'success',
      inAppMessage: `ShiftShield activated ${recommendedPlan.name} for your next ${shift.hours}-hour shift.`,
      emailSubject: 'ShiftShield activated coverage',
      emailTitle: 'ShiftShield ready',
      emailIntro: `${recommendedPlan.name} has been activated for your upcoming shift.`,
      emailLines: [
        `Estimated earnings at risk: ₹${shift.earningsAtRisk}`,
        `Dominant risks: ${shift.dominantTriggers.map(item => item.type).join(', ') || 'general volatility'}`,
        `Wallet balance after activation: ₹${result.balance}`,
      ],
      meta: { action: 'shift_shield_activate', policyId: result.policy.id, planId: recommendedPlan.id },
    });

    res.status(201).json({
      reusedPolicy: false,
      message: `ShiftShield activated ${recommendedPlan.name} for your upcoming shift.`,
      shift,
      policy: { ...result.policy, plan: recommendedPlan, zone },
      walletBalance: result.worker.walletBalance,
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// DELETE /api/policies/active — cancel current plan
router.delete('/active', auth, (req, res) => {
  const success = db.cancelPolicy(req.user.id);
  if (success) {
    notifyWorkerAction({
      workerId: req.user.id,
      type: 'warning',
      inAppMessage: 'Your active policy has been cancelled.',
      emailSubject: 'Your policy was cancelled',
      emailTitle: 'Coverage cancelled',
      emailIntro: 'Your active protection has been cancelled.',
      meta: { action: 'policy_cancel' },
    }).catch(() => {});
    res.json({ message: 'Policy cancelled successfully' });
  }
  else res.status(404).json({ error: 'No active policy found' });
});

// PATCH /api/policies/active/autorenew — toggle auto renewal
router.patch('/active/autorenew', auth, (req, res) => {
  const policy = db.getActivePolicy(req.user.id);
  if (!policy) return res.status(404).json({ error: 'No active policy found' });
  
  const { autoRenew } = req.body;
  db.updatePolicy(policy.id, { autoRenew: !!autoRenew });
  notifyWorkerAction({
    workerId: req.user.id,
    type: 'info',
    inAppMessage: `Auto-renew ${autoRenew ? 'enabled' : 'disabled'} for your active policy.`,
    emailSubject: `Auto-renew ${autoRenew ? 'enabled' : 'disabled'}`,
    emailTitle: 'Auto-renew updated',
    emailIntro: `Auto-renew has been ${autoRenew ? 'enabled' : 'disabled'} for your active coverage.`,
    meta: { action: 'toggle_autorenew', autoRenew: !!autoRenew, policyId: policy.id },
  }).catch(() => {});
  res.json({ message: 'Auto-renew updated', autoRenew: !!autoRenew });
});

// POST /api/policies/active/topup-hours — add protected hours to active cycle
router.post('/active/topup-hours', auth, async (req, res) => {
  try {
    const result = await topUpPolicyHours({ workerId: req.user.id, hours: req.body.hours });
    if (result.error) {
      return res.status(result.status || 400).json({
        error: result.error,
        required: result.required,
        balance: result.balance,
        quote: result.quote,
      });
    }

    await notifyWorkerAction({
      workerId: req.user.id,
      type: 'success',
      inAppMessage: `${result.quote.hours} protected hours were added to your active ${result.plan.name} cycle for ₹${result.quote.topUpPrice}.`,
      emailSubject: 'Protected hours added',
      emailTitle: 'Active cycle topped up',
      emailIntro: `${result.quote.hours} protected hours were added to your current weekly cycle.`,
      emailLines: [
        `Plan: ${result.plan.name}`,
        `Top-up hours: ${result.quote.hours}h`,
        `Top-up price: ₹${result.quote.topUpPrice}`,
        `Protected hours remaining: ${result.policy.remainingActiveHours}h`,
      ],
      meta: { action: 'policy_topup_hours', policyId: result.policy.id, planId: result.plan.id, hours: result.quote.hours },
    });

    res.json({
      message: `${result.quote.hours} hours added to your current cycle.`,
      walletBalance: result.balance,
      quote: result.quote,
      policy: { ...result.policy, plan: result.plan, zone: db.getZone(result.policy.zoneId) },
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/policies/simulate/expire — set current policy to expire in 2 minutes (Simulation only)
router.post('/simulate/expire', auth, async (req, res) => {
  const policy = db.getActivePolicy(req.user.id);
  if (!policy) return res.status(404).json({ error: 'No active policy found to expire' });
  
  const nearExpiry = new Date(Date.now() + 60 * 1000).toISOString(); // 1 minute from now
  db.updatePolicy(policy.id, { 
    endDate: nearExpiry,
    remainingActiveHours: Math.min(1, policy.remainingActiveHours || 1),
    notifiedExpiring: true // set to true so scheduler doesn't double-notify
  });
  
  // Instant notification
  await notifyWorkerAction({
    workerId: req.user.id,
    type: 'alert',
    inAppMessage: `Your ${db.getPlan(policy.planId)?.name || 'policy'} is about to expire! Renew now to stay protected.`,
    emailSubject: 'Expiry reminder triggered',
    emailTitle: 'Policy nearing expiry',
    emailIntro: 'Your active policy has been pushed into near-expiry demo mode.',
    emailLines: [
      `Plan: ${db.getPlan(policy.planId)?.name || policy.planId}`,
      `New expiry time: ${new Date(nearExpiry).toLocaleString('en-IN')}`,
    ],
    meta: { action: 'simulate_expire', policyId: policy.id },
  });
  
  res.json({ 
    message: 'Simulation triggered: Near-expiry state set and notification sent.', 
    endDate: nearExpiry 
  });
});

module.exports = router;
