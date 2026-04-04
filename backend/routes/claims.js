const router = require('express').Router();
const db     = require('../models/db');
const { auth, adminOnly } = require('../middleware/auth');

const safe = w => { if (!w) return null; const { password: _, ...s } = w; return s; };
const upi  = () => 'UPI' + Math.random().toString(36).substr(2, 12).toUpperCase();

// GET /api/claims/my
router.get('/my', auth, (req, res) => {
  const claims = db.getClaimsByWorker(req.user.id).map(c => ({
    ...c, policy: db.getPolicyById(c.policyId),
  }));
  res.json({ claims });
});

// GET /api/claims  (admin)
router.get('/', auth, adminOnly, (req, res) => {
  const claims = db.getAllClaims().map(c => ({
    ...c,
    worker: safe(db.findWorkerById(c.workerId)),
    policy: db.getPolicyById(c.policyId),
  }));
  res.json({ claims });
});

// POST /api/claims/manual
router.post('/manual', auth, (req, res) => {
  const { reason, date, disruptionHours, type } = req.body;
  const policy = db.getActivePolicy(req.user.id);
  if (!policy) return res.status(400).json({ error: 'No active policy found' });

  const claim = db.createClaim({
    workerId:       req.user.id,
    policyId:       policy.id,
    triggerType:    type || 'manual',
    triggerValue:   'N/A',
    disruptionHours: disruptionHours || 4,
    payoutAmount:   (policy.maxWeeklyPayout / 7) * ((disruptionHours || 4) / 4), // estimation mapping
    fraudScore:     50, // Manual reviews get medium fraud score automatically
    status:         'manual_review',
    manualReason:   reason,
    triggeredAt:    date || new Date().toISOString(),
    weatherSource:  'User Submitted',
  });

  res.status(201).json({ message: 'Claim submitted for review', claim });
});

// POST /api/claims/:id/approve  (admin) — credits worker wallet
router.post('/:id/approve', auth, adminOnly, (req, res) => {
  const ref = upi();
  const claim = db.updateClaim(req.params.id, {
    status: 'paid', paidAt: new Date().toISOString(), upiRef: ref,
  });
  if (!claim) return res.status(404).json({ error: 'Claim not found' });

  // Credit the worker's wallet
  db.creditWallet(claim.workerId, claim.payoutAmount, `Claim payout: ${claim.triggerType} disruption`, {
    method:  'claim_payout',
    claimId: claim.id,
    ref,
  });

  res.json({ message: 'Claim approved and payout credited to wallet', claim });
});

// POST /api/claims/:id/reject  (admin)
router.post('/:id/reject', auth, adminOnly, (req, res) => {
  const { reason } = req.body;
  const claim = db.updateClaim(req.params.id, {
    status: 'rejected', rejectedReason: reason || 'Rejected by insurer',
  });
  if (!claim) return res.status(404).json({ error: 'Claim not found' });
  res.json({ message: 'Claim rejected', claim });
});

module.exports = router;