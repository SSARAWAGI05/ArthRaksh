const router = require('express').Router();
const db     = require('../models/db');
const { auth } = require('../middleware/auth');
const { notifyWorkerAction } = require('../services/notifier');
const {
  listGateways,
  createTopupSession,
  completeTopupSession,
  getGateway,
} = require('../services/payments');

function formatMethodLabel({ method, cardLast4, upiId, bank, gatewayLabel }) {
  const rail = gatewayLabel ? `${gatewayLabel}` : 'Payment gateway';
  if (method === 'upi') return `${rail} · UPI (${upiId || 'user@upi'})`;
  if (method === 'netbanking') return `${rail} · ${bank || 'Net Banking'}`;
  return `${rail} · Card ••••${cardLast4 || '0000'}`;
}

async function creditTopup({
  worker,
  amount,
  gatewayId,
  method = 'card',
  cardLast4,
  upiId,
  bank,
  purpose = 'GigShield wallet top-up',
}) {
  const created = createTopupSession({
    worker,
    amount,
    gatewayId,
    method,
    purpose,
  });

  await new Promise(resolve => setTimeout(resolve, 650));

  const completed = completeTopupSession(created.session.id, {
    method,
    cardLast4: cardLast4 || null,
    upiId: upiId || null,
    bank: bank || null,
  });

  const session = completed.session;
  const methodLabel = formatMethodLabel({
    method,
    cardLast4,
    upiId,
    bank,
    gatewayLabel: session.gatewayLabel,
  });

  const tx = db.creditWallet(worker.id, Number(amount), `Added via ${methodLabel}`, {
    method: 'gateway_topup',
    gatewayId: session.gatewayId,
    gatewayLabel: session.gatewayLabel,
    gatewayProvider: session.gatewayProvider,
    paymentSessionId: session.id,
    providerOrderId: session.providerOrderId,
    providerPaymentId: session.providerPaymentId,
    ref: session.displayRef,
    cardLast4: cardLast4 || null,
    upiId: upiId || null,
    bank: bank || null,
  });

  return { session, tx };
}

// GET /api/wallet/balance
router.get('/balance', auth, (req, res) => {
  const worker = db.findWorkerById(req.user.id);
  if (!worker) return res.status(404).json({ error: 'Worker not found' });
  res.json({
    balance:      worker.walletBalance || 0,
    transactions: db.getWalletTransactions(req.user.id, 30),
  });
});

// GET /api/wallet/transactions
router.get('/transactions', auth, (req, res) => {
  const limit = parseInt(req.query.limit) || 50;
  res.json({ transactions: db.getWalletTransactions(req.user.id, limit) });
});

// GET /api/wallet/gateways
router.get('/gateways', auth, (req, res) => {
  res.json({ gateways: listGateways(req.query.flow || null) });
});

// POST /api/wallet/topup/session
router.post('/topup/session', auth, (req, res) => {
  try {
    const { amount, method = 'card', gatewayId, purpose } = req.body;
    if (!amount || Number(amount) <= 0) return res.status(400).json({ error: 'Invalid amount' });
    if (Number(amount) > 50000) return res.status(400).json({ error: 'Maximum top-up is ₹50,000 per transaction' });

    const worker = db.findWorkerById(req.user.id);
    if (!worker) return res.status(404).json({ error: 'Worker not found' });

    const created = createTopupSession({
      worker,
      amount: Number(amount),
      gatewayId,
      method,
      purpose,
    });

    res.json({
      success: true,
      gateway: getGateway(created.gateway.id),
      session: created.session,
      checkout: created.checkout,
    });
  } catch (e) {
    res.status(e.status || 500).json({ error: e.message });
  }
});

// POST /api/wallet/topup/session/:id/confirm
router.post('/topup/session/:id/confirm', auth, async (req, res) => {
  try {
    const worker = db.findWorkerById(req.user.id);
    if (!worker) return res.status(404).json({ error: 'Worker not found' });

    const existing = db.getPaymentSessionById(req.params.id);
    if (!existing || existing.workerId !== worker.id || existing.flow !== 'topup') {
      return res.status(404).json({ error: 'Payment session not found' });
    }

    if (existing.status === 'captured') {
      return res.json({
        success: true,
        message: `₹${existing.amount} already added to your GigShield Wallet`,
        ref: existing.displayRef,
        balance: worker.walletBalance,
        session: existing,
      });
    }

    await new Promise(resolve => setTimeout(resolve, 650));

    const completed = completeTopupSession(existing.id, {
      method: req.body.method || existing.method,
      cardLast4: req.body.cardLast4 || null,
      upiId: req.body.upiId || null,
      bank: req.body.bank || null,
    });

    const tx = db.creditWallet(worker.id, Number(completed.session.amount), `Added via ${formatMethodLabel({
      method: req.body.method || existing.method,
      cardLast4: req.body.cardLast4,
      upiId: req.body.upiId,
      bank: req.body.bank,
      gatewayLabel: completed.session.gatewayLabel,
    })}`, {
      method: 'gateway_topup',
      gatewayId: completed.session.gatewayId,
      gatewayLabel: completed.session.gatewayLabel,
      gatewayProvider: completed.session.gatewayProvider,
      paymentSessionId: completed.session.id,
      providerOrderId: completed.session.providerOrderId,
      providerPaymentId: completed.session.providerPaymentId,
      ref: completed.session.displayRef,
      cardLast4: req.body.cardLast4 || null,
      upiId: req.body.upiId || null,
      bank: req.body.bank || null,
    });

    notifyWorkerAction({
      workerId: worker.id,
      type: 'success',
      inAppMessage: `₹${completed.session.amount} added via ${completed.session.gatewayLabel}.`,
      emailSubject: 'Wallet top-up completed',
      emailTitle: 'Wallet balance updated',
      emailIntro: `₹${completed.session.amount} was successfully added to your wallet.`,
      emailLines: [
        `Gateway: ${completed.session.gatewayLabel}`,
        `Reference: ${completed.session.displayRef}`,
        `Available balance: ₹${worker.walletBalance}`,
      ],
      meta: { action: 'wallet_add', amount: Number(completed.session.amount), ref: completed.session.displayRef, gatewayId: completed.session.gatewayId },
    }).catch(() => {});

    res.json({
      success: true,
      message: `₹${completed.session.amount} added to your GigShield Wallet`,
      ref: completed.session.displayRef,
      balance: worker.walletBalance,
      session: completed.session,
      transaction: tx,
    });
  } catch (e) {
    res.status(e.status || 500).json({ error: e.message });
  }
});

// POST /api/wallet/add
router.post('/add', auth, async (req, res) => {
  try {
    const { amount, method = 'card', cardLast4, upiId, bank, gatewayId } = req.body;
    if (!amount || Number(amount) <= 0) return res.status(400).json({ error: 'Invalid amount' });
    if (Number(amount) > 50000) return res.status(400).json({ error: 'Maximum top-up is ₹50,000 per transaction' });

    const worker = db.findWorkerById(req.user.id);
    if (!worker) return res.status(404).json({ error: 'Worker not found' });

    const { session } = await creditTopup({
      worker,
      amount: Number(amount),
      gatewayId,
      method,
      cardLast4,
      upiId,
      bank,
    });

    res.json({
      success: true,
      message: `₹${amount} added to your GigShield Wallet`,
      ref: session.displayRef,
      balance: worker.walletBalance,
      gateway: {
        id: session.gatewayId,
        label: session.gatewayLabel,
        provider: session.gatewayProvider,
      },
      session,
    });
    notifyWorkerAction({
      workerId: req.user.id,
      type: 'success',
      inAppMessage: `₹${amount} added to your wallet via ${session.gatewayLabel}.`,
      emailSubject: 'Wallet top-up completed',
      emailTitle: 'Wallet balance updated',
      emailIntro: `₹${amount} was successfully added to your wallet.`,
      emailLines: [`Gateway: ${session.gatewayLabel}`, `Reference: ${session.displayRef}`, `Available balance: ₹${worker.walletBalance}`],
      meta: { action: 'wallet_add', amount: Number(amount), ref: session.displayRef, gatewayId: session.gatewayId },
    }).catch(() => {});
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/wallet/withdraw
router.post('/withdraw', auth, async (req, res) => {
  try {
    const { amount, upiId } = req.body;
    if (!amount || amount <= 0) return res.status(400).json({ error: 'Invalid amount' });
    if (!upiId) return res.status(400).json({ error: 'UPI ID is required for withdrawal' });

    const worker = db.findWorkerById(req.user.id);
    if (!worker) return res.status(404).json({ error: 'Worker not found' });
    if ((worker.walletBalance || 0) < amount) {
      return res.status(400).json({ error: 'Insufficient wallet balance' });
    }

    await new Promise(r => setTimeout(r, 600));

    const ref = 'WDR' + Date.now().toString(36).toUpperCase() + Math.random().toString(36).substr(2, 4).toUpperCase();

    const tx = db.debitWallet(req.user.id, Number(amount), `Withdrawn to ${upiId}`, {
      method: 'upi_withdrawal', ref, upiId,
    });

    if (tx?.error) return res.status(400).json({ error: tx.error });

    // Read AFTER the debit
    res.json({
      success: true,
      message: `₹${amount} sent to ${upiId}`,
      ref,
      balance: worker.walletBalance,
    });
    notifyWorkerAction({
      workerId: req.user.id,
      type: 'info',
      inAppMessage: `₹${amount} withdrawn to ${upiId}.`,
      emailSubject: 'Wallet withdrawal completed',
      emailTitle: 'Withdrawal processed',
      emailIntro: `₹${amount} was withdrawn from your wallet.`,
      emailLines: [`Destination: ${upiId}`, `Reference: ${ref}`, `Available balance: ₹${worker.walletBalance}`],
      meta: { action: 'wallet_withdraw', amount: Number(amount), ref, upiId },
    }).catch(() => {});
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
