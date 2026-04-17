const router = require('express').Router();
const db     = require('../models/db');
const { auth, adminOnly } = require('../middleware/auth');
const { notifyWorkerAction } = require('../services/notifier');
const { createInstantClaimPayout, getGateway } = require('../services/payments');
const { calculatePayoutDetails } = require('../services/ml');
const { buildProofPack, renderProofPackMarkdown } = require('../services/proofPack');

const safe = w => { if (!w) return null; const { password: _, ...s } = w; return s; };

function serializeClaim(claim) {
  const policy = db.getPolicyById(claim.policyId);
  return {
    ...claim,
    policy,
    plan: policy ? db.getPlan(policy.planId) : null,
    zone: policy ? db.getZone(policy.zoneId) : null,
  };
}

// GET /api/claims/my
router.get('/my', auth, (req, res) => {
  const claims = [...db.getClaimsByWorker(req.user.id)]
    .sort((a, b) => new Date(b.triggeredAt) - new Date(a.triggeredAt))
    .map(serializeClaim);
  res.json({ claims });
});

// GET /api/claims  (admin)
router.get('/', auth, adminOnly, (req, res) => {
  const claims = [...db.getAllClaims()].sort((a, b) => new Date(b.triggeredAt) - new Date(a.triggeredAt)).map(c => ({
    ...serializeClaim(c),
    worker: safe(db.findWorkerById(c.workerId)),
  }));
  res.json({ claims });
});

// POST /api/claims/manual
router.post('/manual', auth, (req, res) => {
  (async () => {
    const { reason, date, disruptionHours, type } = req.body;
    const policy = db.getActivePolicy(req.user.id);
    if (!policy) return res.status(400).json({ error: 'No active policy found' });
    const requestedHours = Number(disruptionHours || 4);
    const coveredHours = Math.min(requestedHours, Number(policy.remainingActiveHours ?? policy.coveredActiveHours ?? requestedHours));
    if (coveredHours <= 0) {
      return res.status(400).json({ error: 'No active protection hours remain on this policy' });
    }

    const worker = db.findWorkerById(req.user.id);
    const payoutDetails = await calculatePayoutDetails(worker, policy, type || 'manual', coveredHours);
    const claim = db.createClaim({
      workerId:       req.user.id,
      policyId:       policy.id,
      triggerType:    type || 'manual',
      triggerValue:   'Self-reported disruption',
      disruptionHours: coveredHours,
      reservedActiveHours: coveredHours,
      payoutAmount:   payoutDetails.amount,
      fraudScore:     50,
      status:         'manual_review',
      manualReason:   reason,
      triggeredAt:    date || new Date().toISOString(),
      weatherSource:  'User Submitted',
      weatherSnapshot: { source: 'manual_submission', narrative: reason || 'No narrative provided' },
      payoutBreakdown: payoutDetails.breakdown,
      gpsZoneMatch: null,
      wasActive: null,
    });
    db.adjustPolicyHours(policy.id, -coveredHours);
    notifyWorkerAction({
      workerId: req.user.id,
      type: 'info',
      inAppMessage: `Manual claim submitted for ${coveredHours} protected hours.`,
      emailSubject: 'Manual claim submitted',
      emailTitle: 'Claim under review',
      emailIntro: 'Your manual claim has been submitted and is awaiting review.',
      emailLines: [`Trigger: ${type || 'manual'}`, `Protected hours reserved: ${coveredHours}h`],
      meta: { action: 'manual_claim', claimId: claim.id, policyId: policy.id },
    }).catch(() => {});

    res.status(201).json({ message: 'Claim submitted for review', claim: serializeClaim(claim) });
  })().catch(error => res.status(500).json({ error: error.message }));
});

// POST /api/claims/:id/approve  (admin) — credits worker wallet
router.post('/:id/approve', auth, adminOnly, (req, res) => {
  const existingClaim = db.getAllClaims().find(item => item.id === req.params.id);
  if (!existingClaim) return res.status(404).json({ error: 'Claim not found' });
  if (existingClaim.status === 'paid') {
    return res.status(400).json({ error: 'Claim already paid' });
  }

  const worker = db.findWorkerById(existingClaim.workerId);
  if (!worker) return res.status(404).json({ error: 'Worker not found' });

  const { gatewayId } = req.body || {};
  const payoutResult = createInstantClaimPayout({
    claim: existingClaim,
    worker,
    amount: existingClaim.payoutAmount,
    gatewayId,
  });

  const claim = db.updateClaim(req.params.id, {
    status: 'paid',
    paidAt: new Date().toISOString(),
    upiRef: payoutResult.payout.reference,
    payoutGatewayId: payoutResult.gateway.id,
    payoutGatewayLabel: payoutResult.gateway.label,
    payoutTransferId: payoutResult.payout.providerTransferId,
    payoutRail: payoutResult.payout.rail,
  });

  db.creditWallet(claim.workerId, claim.payoutAmount, `Claim payout: ${claim.triggerType} disruption`, {
    method: 'claim_payout',
    claimId: claim.id,
    gatewayId: payoutResult.gateway.id,
    gatewayLabel: payoutResult.gateway.label,
    gatewayProvider: payoutResult.gateway.provider,
    payoutId: payoutResult.payout.id,
    payoutTransferId: payoutResult.payout.providerTransferId,
    ref: payoutResult.payout.reference,
  });

  notifyWorkerAction({
    workerId: claim.workerId,
    type: 'success',
    inAppMessage: `Claim approved. ₹${claim.payoutAmount} credited instantly via ${payoutResult.gateway.label}.`,
    emailSubject: 'Claim approved and paid',
    emailTitle: 'Payout credited instantly',
    emailIntro: 'Your claim has been approved and the payout is already in your wallet.',
    emailLines: [
      `Trigger: ${claim.triggerType}`,
      `Payout amount: ₹${claim.payoutAmount}`,
      `Gateway: ${payoutResult.gateway.label}`,
      `Transfer reference: ${payoutResult.payout.reference}`,
    ],
    meta: { action: 'claim_approve', claimId: claim.id, ref: payoutResult.payout.reference, gatewayId: payoutResult.gateway.id },
  }).catch(() => {});

  res.json({
    message: 'Claim approved and payout credited to wallet',
    claim,
    payout: payoutResult.payout,
    gateway: getGateway(payoutResult.gateway.id),
  });
});

// POST /api/claims/:id/reject  (admin)
router.post('/:id/reject', auth, adminOnly, (req, res) => {
  const { reason } = req.body;
  const claim = db.updateClaim(req.params.id, {
    status: 'rejected', rejectedReason: reason || 'Rejected by insurer',
  });
  if (!claim) return res.status(404).json({ error: 'Claim not found' });
  if (claim.reservedActiveHours && !claim.hoursRestored) {
    db.adjustPolicyHours(claim.policyId, claim.reservedActiveHours);
    db.updateClaim(claim.id, { hoursRestored: true });
  }
  notifyWorkerAction({
    workerId: claim.workerId,
    type: 'error',
    inAppMessage: `Claim rejected${reason ? `: ${reason}` : '.'}`,
    emailSubject: 'Claim review update',
    emailTitle: 'Claim rejected',
    emailIntro: 'Your claim review has been completed.',
    emailLines: [reason || 'This claim was rejected by the insurer review team.'],
    meta: { action: 'claim_reject', claimId: claim.id },
  }).catch(() => {});
  res.json({ message: 'Claim rejected', claim });
});

// GET /api/claims/:id/proof-pack
router.get('/:id/proof-pack', auth, (req, res) => {
  const claim = db.getClaimById(req.params.id);
  if (!claim) return res.status(404).json({ error: 'Claim not found' });

  const isOwner = claim.workerId === req.user.id;
  const isAdmin = req.user.role === 'admin';
  if (!isOwner && !isAdmin) return res.status(403).json({ error: 'Not allowed' });

  const worker = db.findWorkerById(claim.workerId);
  const policy = db.getPolicyById(claim.policyId);
  const zone = db.getZone(policy?.zoneId);
  const packet = buildProofPack({ claim, worker, policy, zone });

  res.json({
    filename: `gigshield-proof-pack-${claim.id}.md`,
    packet,
    markdown: renderProofPackMarkdown(packet),
  });
});

module.exports = router;
