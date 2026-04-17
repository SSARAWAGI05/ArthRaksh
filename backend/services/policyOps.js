const db = require('../models/db');
const { calculatePremium } = require('./ml');

function enrichPricing(plan, pricing) {
  const includedActiveHours = Number(plan.includedActiveHours) || 24;
  const dynamicBundlePremium = Number(pricing.dynamicWeeklyPremium || plan.baseWeeklyPremium || 0);
  const dynamicHourlyPremium = Number((dynamicBundlePremium / includedActiveHours).toFixed(2));

  return {
    ...pricing,
    includedActiveHours,
    dynamicBundlePremium,
    dynamicHourlyPremium,
  };
}

function estimateEndDate() {
  return new Date(Date.now() + (7 * 86400000)).toISOString();
}

function topUpMarkupForHours(hours) {
  const safeHours = Math.max(1, Number(hours) || 0);
  return Math.max(1.08, Number((1.75 - (safeHours * 0.03)).toFixed(2)));
}

function getPolicyTopUpQuote(policy, hours) {
  const plan = db.getPlan(policy.planId);
  const safeHours = Math.max(1, Number(hours) || 0);
  const coveredHours = Math.max(1, Number(policy.coveredActiveHours || plan?.includedActiveHours || 1));
  const baseHourlyRate = Number(policy.hourlyPremium || Number(((policy.weeklyPremium || plan?.baseWeeklyPremium || 0) / coveredHours).toFixed(2)));
  const topUpHourlyRate = Number(Math.max(baseHourlyRate, Number((baseHourlyRate * topUpMarkupForHours(safeHours)).toFixed(2))).toFixed(2));
  const topUpPrice = Math.max(1, Math.round(topUpHourlyRate * safeHours));

  return {
    hours: safeHours,
    baseHourlyRate,
    topUpHourlyRate,
    markup: topUpMarkupForHours(safeHours),
    topUpPrice,
  };
}

async function getPlanQuote(worker, plan) {
  const pricing = await calculatePremium(worker, plan);
  return enrichPricing(plan, pricing);
}

async function purchasePolicy({ workerId, planId, autoRenew = false, source = 'wallet', activationMode = 'manual', shiftIntent = null }) {
  const worker = db.findWorkerById(workerId);
  const plan = db.getPlan(planId);

  if (!worker) return { error: 'Worker not found', status: 404 };
  if (!plan) return { error: 'Invalid plan', status: 400 };

  const pricing = await getPlanQuote(worker, plan);
  const premium = pricing.dynamicBundlePremium;
  const balance = worker.walletBalance || 0;

  if (balance < premium) {
    return {
      error: `Insufficient wallet balance. You need ₹${premium} but have ₹${balance}. Please add money to your wallet first.`,
      status: 402,
      required: premium,
      balance,
      pricing,
    };
  }

  const tx = db.debitWallet(worker.id, premium, `Premium for ${plan.name}`, {
    method: source,
    planId,
    ref: 'POL' + Date.now().toString(36).toUpperCase(),
  });

  if (tx?.error) {
    return { error: tx.error, status: 400 };
  }

  const existing = db.getActivePolicy(worker.id);
  if (existing) db.updatePolicy(existing.id, { status: 'expired' });

  const policy = db.createPolicy({
    workerId: worker.id,
    planId,
    zoneId: worker.zoneId,
    weeklyPremium: premium,
    hourlyPremium: pricing.dynamicHourlyPremium,
    coveredActiveHours: pricing.includedActiveHours,
    remainingActiveHours: pricing.includedActiveHours,
    maxWeeklyPayout: plan.maxWeeklyPayout,
    status: 'active',
    startDate: new Date().toISOString(),
    endDate: estimateEndDate(),
    totalPaidIn: premium,
    totalPaidOut: 0,
    claimCount: 0,
    pricingBreakdown: pricing,
    autoRenew,
    activationMode,
    shiftIntent,
  });

  return { worker, plan, policy, pricing, premium, balance: worker.walletBalance };
}

async function topUpPolicyHours({ workerId, hours }) {
  const worker = db.findWorkerById(workerId);
  const policy = db.getActivePolicy(workerId);

  if (!worker) return { error: 'Worker not found', status: 404 };
  if (!policy) return { error: 'No active policy found', status: 404 };

  const safeHours = Math.round(Number(hours) || 0);
  if (safeHours < 4) return { error: 'Minimum top-up is 4 hours', status: 400 };
  if (safeHours > 24) return { error: 'Maximum top-up per request is 24 hours', status: 400 };

  const plan = db.getPlan(policy.planId);
  const quote = getPolicyTopUpQuote(policy, safeHours);
  const balance = Number(worker.walletBalance || 0);

  if (balance < quote.topUpPrice) {
    return {
      error: `Insufficient wallet balance. You need ₹${quote.topUpPrice} but have ₹${balance}. Please add money to your wallet first.`,
      status: 402,
      required: quote.topUpPrice,
      balance,
      quote,
    };
  }

  const tx = db.debitWallet(worker.id, quote.topUpPrice, `Hour top-up for ${plan?.name || 'active plan'}`, {
    method: 'policy_topup',
    policyId: policy.id,
    planId: policy.planId,
    addedHours: quote.hours,
    hourlyRate: quote.topUpHourlyRate,
    baseHourlyRate: quote.baseHourlyRate,
    markup: quote.markup,
    ref: 'TOP' + Date.now().toString(36).toUpperCase(),
  });

  if (tx?.error) return { error: tx.error, status: 400 };

  const nextCovered = Number(policy.coveredActiveHours || 0) + quote.hours;
  const nextRemaining = Number(policy.remainingActiveHours || 0) + quote.hours;
  const nextConsumed = Math.max(0, nextCovered - nextRemaining);
  const updated = db.updatePolicy(policy.id, {
    coveredActiveHours: nextCovered,
    remainingActiveHours: nextRemaining,
    consumedActiveHours: nextConsumed,
    totalPaidIn: Number(policy.totalPaidIn || 0) + quote.topUpPrice,
  });

  return {
    worker,
    plan,
    policy: updated,
    quote,
    balance: worker.walletBalance,
  };
}

module.exports = { getPlanQuote, purchasePolicy, enrichPricing, estimateEndDate, getPolicyTopUpQuote, topUpPolicyHours };
