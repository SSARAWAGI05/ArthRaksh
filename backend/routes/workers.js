const router = require('express').Router();
const db     = require('../models/db');
const { auth } = require('../middleware/auth');
const { calculatePremium } = require('../services/ml');
const { notifyWorkerAction } = require('../services/notifier');

// GET /api/workers/zones  (public — needed for register form)
router.get('/zones', (req, res) => {
  res.json({ zones: db.getZones() });
});

// GET /api/workers/risk-profile
router.get('/risk-profile', auth, async (req, res) => {
  try {
    const worker = db.findWorkerById(req.user.id);
    if (!worker) return res.status(404).json({ error: 'Not found' });
    const zone   = db.getZone(worker.zoneId);
    const plans  = await Promise.all(
      db.getPlans().map(async p => ({ planId: p.id, pricing: await calculatePremium(worker, p) }))
    );
    res.json({ zone, riskProfile: plans[1].pricing, allPlanPricing: plans });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// PATCH /api/workers/profile — update zone
router.patch('/profile', auth, (req, res) => {
  const { zoneId, email } = req.body;
  if (!zoneId && !email) return res.status(400).json({ error: 'zoneId or email required' });
  
  const worker = db.findWorkerById(req.user.id);
  if (!worker) return res.status(404).json({ error: 'Worker not found' });

  if (email) {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ error: 'A valid email address is required' });
    }
    const existing = db.findWorkerByEmail(email);
    if (existing && existing.id !== worker.id) {
      return res.status(409).json({ error: 'Email address already registered' });
    }
  }

  const updates = {};
  if (zoneId) updates.zoneId = zoneId;
  if (email) updates.email = email;
  Object.assign(worker, updates);
  db.save();
  notifyWorkerAction({
    workerId: req.user.id,
    type: 'info',
    inAppMessage: zoneId
      ? `Coverage zone updated to ${db.getZone(zoneId)?.name || zoneId}.`
      : 'Your contact email was updated successfully.',
    emailSubject: email && zoneId ? 'Profile details updated'
      : email ? 'Email address updated'
      : 'Coverage zone updated',
    emailTitle: email && zoneId ? 'Profile updated'
      : email ? 'Email updated'
      : 'Zone changed',
    emailIntro: email && zoneId
      ? 'Your contact details and operating zone have been updated successfully.'
      : email
        ? 'Your GigShield contact email has been updated successfully.'
        : 'Your operating zone has been updated successfully.',
    emailLines: [
      ...(zoneId ? [`New zone: ${db.getZone(zoneId)?.name || zoneId}`] : []),
      ...(email ? [`Contact email: ${email}`] : []),
    ],
    meta: { action: 'profile_update', zoneId: zoneId || null, email: email || null },
  }).catch(() => {});
  
  res.json({ message: 'Profile updated successfully', worker });
});

// POST /api/workers/notifications/read
router.post('/notifications/read', auth, (req, res) => {
  db.markNotificationsRead(req.user.id);
  res.json({ message: 'Notifications marked as read' });
});

module.exports = router;
