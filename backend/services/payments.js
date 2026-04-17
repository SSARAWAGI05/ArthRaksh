const db = require('../models/db');

function uid(prefix) {
  return `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`.replace(/\./g, '');
}

const GATEWAYS = [
  {
    id: 'razorpay_test',
    provider: 'Razorpay',
    mode: 'test',
    label: 'Razorpay Test Mode',
    accent: '#2563eb',
    description: 'Best for India-first card, UPI, and payout demos.',
    settlement: 'Instant demo settlement',
    topupCta: 'Open Razorpay checkout',
    payoutCta: 'Instant payout via Razorpay Route',
    capabilities: ['topup', 'payout'],
    publicKey: process.env.RAZORPAY_TEST_KEY_ID || 'rzp_test_gigshield_demo',
  },
  {
    id: 'stripe_sandbox',
    provider: 'Stripe',
    mode: 'sandbox',
    label: 'Stripe Sandbox',
    accent: '#635bff',
    description: 'Best for cross-border cards and Connect-style instant transfers.',
    settlement: 'Sandbox instant transfer',
    topupCta: 'Open Stripe checkout',
    payoutCta: 'Instant payout via Stripe Connect',
    capabilities: ['topup', 'payout'],
    publicKey: process.env.STRIPE_SANDBOX_PUBLISHABLE_KEY || 'pk_test_gigshield_demo',
  },
];

function getGateway(gatewayId) {
  return GATEWAYS.find(gateway => gateway.id === gatewayId) || GATEWAYS[0];
}

function listGateways(flow) {
  const gates = flow ? GATEWAYS.filter(gateway => gateway.capabilities.includes(flow)) : GATEWAYS;
  return gates.map(gateway => ({
    id: gateway.id,
    provider: gateway.provider,
    mode: gateway.mode,
    label: gateway.label,
    accent: gateway.accent,
    description: gateway.description,
    settlement: gateway.settlement,
    topupCta: gateway.topupCta,
    payoutCta: gateway.payoutCta,
    capabilities: gateway.capabilities,
    publicKeyPreview: gateway.publicKey,
  }));
}

function maskDestination(destination) {
  if (!destination) return 'wallet';
  if (!destination.includes('@')) return destination;
  const [handle, domain] = destination.split('@');
  return `${handle.slice(0, 2)}***@${domain}`;
}

function buildTopupProviderMeta(gateway, amount) {
  if (gateway.id === 'razorpay_test') {
    const orderId = uid('order');
    return {
      providerOrderId: orderId,
      providerSessionId: uid('pay'),
      displayRef: `RZP-${orderId.slice(-8).toUpperCase()}`,
      checkoutHint: `Mock Razorpay order for INR ${amount}`,
    };
  }

  const intentId = uid('pi');
  return {
    providerOrderId: intentId,
    providerSessionId: `${intentId}_secret_${Math.random().toString(36).slice(2, 10)}`,
    displayRef: `STP-${intentId.slice(-8).toUpperCase()}`,
    checkoutHint: `Mock Stripe payment intent for INR ${amount}`,
  };
}

function buildPayoutProviderMeta(gateway, amount) {
  if (gateway.id === 'razorpay_test') {
    const payoutId = uid('pout');
    return {
      providerPayoutId: payoutId,
      providerTransferId: uid('trf'),
      reference: `RZP-PAYOUT-${payoutId.slice(-6).toUpperCase()}`,
      rail: 'Razorpay Route Test',
      statusText: `Instantly moved ${amount} to worker wallet via Razorpay test payout rail`,
    };
  }

  const transferId = uid('tr');
  return {
    providerPayoutId: transferId,
    providerTransferId: uid('po'),
    reference: `STRIPE-${transferId.slice(-6).toUpperCase()}`,
    rail: 'Stripe Connect Sandbox',
    statusText: `Instantly moved ${amount} to worker wallet via Stripe sandbox transfer`,
  };
}

function chooseGatewayForClaim(claim) {
  if (!claim?.triggerType) return GATEWAYS[0];
  return ['rain', 'flood', 'cyclone'].includes(claim.triggerType)
    ? getGateway('razorpay_test')
    : getGateway('stripe_sandbox');
}

function createTopupSession({ worker, amount, gatewayId, method, purpose = 'Wallet top-up' }) {
  const gateway = getGateway(gatewayId);
  const providerMeta = buildTopupProviderMeta(gateway, amount);
  const session = db.createPaymentSession({
    workerId: worker.id,
    flow: 'topup',
    purpose,
    amount: Number(amount),
    currency: 'INR',
    method,
    gatewayId: gateway.id,
    gatewayLabel: gateway.label,
    gatewayProvider: gateway.provider,
    mode: gateway.mode,
    ...providerMeta,
  });

  return {
    gateway,
    session,
    checkout: {
      sessionId: session.id,
      providerOrderId: session.providerOrderId,
      providerSessionId: session.providerSessionId,
      displayRef: session.displayRef,
      publicKeyPreview: gateway.publicKey,
      hint: session.checkoutHint,
    },
  };
}

function completeTopupSession(sessionId, paymentDetails = {}) {
  const session = db.getPaymentSessionById(sessionId);
  if (!session) {
    const err = new Error('Payment session not found');
    err.status = 404;
    throw err;
  }
  if (session.status === 'captured') {
    return { session, alreadyCaptured: true, gateway: getGateway(session.gatewayId) };
  }
  if (session.status !== 'created') {
    const err = new Error(`Payment session is ${session.status}`);
    err.status = 400;
    throw err;
  }

  const gateway = getGateway(session.gatewayId);
  const completed = db.updatePaymentSession(session.id, {
    status: 'captured',
    capturedAt: new Date().toISOString(),
    providerPaymentId: paymentDetails.providerPaymentId || uid(gateway.id === 'razorpay_test' ? 'pay' : 'ch'),
    paymentMethodDetails: paymentDetails,
  });

  return { session: completed, gateway, alreadyCaptured: false };
}

function createInstantClaimPayout({ claim, worker, amount, gatewayId, destination = 'worker_wallet' }) {
  const gateway = gatewayId ? getGateway(gatewayId) : chooseGatewayForClaim(claim);
  const providerMeta = buildPayoutProviderMeta(gateway, amount);
  const payout = db.createGatewayPayout({
    workerId: worker.id,
    claimId: claim.id,
    amount: Number(amount),
    currency: 'INR',
    destination,
    destinationDisplay: destination === 'worker_wallet' ? 'GigShield Wallet' : maskDestination(destination),
    gatewayId: gateway.id,
    gatewayLabel: gateway.label,
    gatewayProvider: gateway.provider,
    mode: gateway.mode,
    settledAt: new Date().toISOString(),
    ...providerMeta,
  });

  return { gateway, payout };
}

module.exports = {
  getGateway,
  listGateways,
  chooseGatewayForClaim,
  createTopupSession,
  completeTopupSession,
  createInstantClaimPayout,
};
