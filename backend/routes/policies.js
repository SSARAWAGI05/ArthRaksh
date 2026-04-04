const router = require('express').Router();
const db     = require('../models/db');
const { auth, adminOnly } = require('../middleware/auth');
const { calculatePremium } = require('../services/ml');

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
      db.getPlans().map(async plan => ({ ...plan, pricing: await calculatePremium(worker, plan) }))
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
    const { planId, autoRenew = false } = req.body;
    const plan   = db.getPlan(planId);
    const worker = db.findWorkerById(req.user.id);
    if (!plan)   return res.status(400).json({ error: 'Invalid plan' });
    if (!worker) return res.status(404).json({ error: 'Worker not found' });

    const pricing = await calculatePremium(worker, plan);
    const premium = pricing.dynamicWeeklyPremium;

    // Check wallet balance
    const balance = worker.walletBalance || 0;
    if (balance < premium) {
      return res.status(402).json({
        error: `Insufficient wallet balance. You need ₹${premium} but have ₹${balance}. Please add money to your wallet first.`,
        required: premium,
        balance,
      });
    }

    // Deduct from wallet
    db.debitWallet(worker.id, premium, `Premium for ${plan.name}`, {
      method:  'wallet',
      planId,
      ref:     'POL' + Date.now().toString(36).toUpperCase(),
    });

    // Expire existing active policy
    const existing = db.getActivePolicy(worker.id);
    if (existing) db.updatePolicy(existing.id, { status: 'expired' });

    const now = new Date();
    const end = new Date(now.getTime() + 7 * 86400000);

    const policy = db.createPolicy({
      workerId:        worker.id,
      planId,
      zoneId:          worker.zoneId,
      weeklyPremium:   premium,
      maxWeeklyPayout: plan.maxWeeklyPayout,
      status:          'active',
      startDate:       now.toISOString(),
      endDate:         end.toISOString(),
      totalPaidIn:     premium,
      totalPaidOut:    0,
      claimCount:      0,
      pricingBreakdown: pricing,
      autoRenew,
    });

    res.status(201).json({
      policy: { ...policy, plan, zone: db.getZone(worker.zoneId) },
      message: `Policy activated! ₹${premium} deducted from your GigShield Wallet.`,
      walletBalance: worker.walletBalance,
    });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// DELETE /api/policies/active — cancel current plan
router.delete('/active', auth, (req, res) => {
  const success = db.cancelPolicy(req.user.id);
  if (success) res.json({ message: 'Policy cancelled successfully' });
  else res.status(404).json({ error: 'No active policy found' });
});

// PATCH /api/policies/active/autorenew — toggle auto renewal
router.patch('/active/autorenew', auth, (req, res) => {
  const policy = db.getActivePolicy(req.user.id);
  if (!policy) return res.status(404).json({ error: 'No active policy found' });
  
  const { autoRenew } = req.body;
  db.updatePolicy(policy.id, { autoRenew: !!autoRenew });
  res.json({ message: 'Auto-renew updated', autoRenew: !!autoRenew });
});

// POST /api/policies/simulate/expire — set current policy to expire in 2 minutes (Simulation only)
router.post('/simulate/expire', auth, (req, res) => {
  const policy = db.getActivePolicy(req.user.id);
  if (!policy) return res.status(404).json({ error: 'No active policy found to expire' });
  
  const nearExpiry = new Date(Date.now() + 60 * 1000).toISOString(); // 1 minute from now
  db.updatePolicy(policy.id, { 
    endDate: nearExpiry,
    notifiedExpiring: true // set to true so scheduler doesn't double-notify
  });
  
  // Instant notification
  db.addWorkerNotification(
    req.user.id,
    'alert',
    `Your ${db.getPlan(policy.planId)?.name || 'policy'} is about to expire! Renew now to stay protected.`
  );
  
  res.json({ 
    message: 'Simulation triggered: Near-expiry state set and notification sent.', 
    endDate: nearExpiry 
  });
});

module.exports = router;