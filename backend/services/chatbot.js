const axios = require('axios');
const db = require('../models/db');
const { getPlanQuote, purchasePolicy } = require('./policyOps');
const { notifyWorkerAction } = require('./notifier');
const { runCheck } = require('./triggers');
const { getGateway, listGateways, createTopupSession, completeTopupSession } = require('./payments');

const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';
const GROQ_MODEL = process.env.GROQ_MODEL || 'llama-3.3-70b-versatile';

const TRIGGER_TYPES = ['rain', 'aqi', 'heat', 'curfew', 'flood', 'cyclone', 'fog', 'manual'];
const NAV_TARGETS = ['home', 'plans', 'claims', 'wallet', 'profile'];
const CANCEL_WORDS = ['cancel', 'stop', 'never mind', 'nevermind', 'leave it', 'leave this', 'not now', 'abort'];
const YES_WORDS = ['yes', 'yeah', 'yep', 'sure', 'ok', 'okay', 'confirm', 'proceed', 'do it', 'go ahead', 'haan', 'ha', 'han', 'ji', 'theek hai', 'thik hai', 'kar do', 'karo'];
const NO_WORDS = ['no', 'nah', 'nope', 'dont', "don't", 'not now', 'stop', 'mat', 'nahi', 'nahin'];
const TOPUP_GATEWAYS = listGateways('topup');
const BANK_ALIASES = {
  sbi: 'State Bank of India',
  hdfc: 'HDFC Bank',
  icici: 'ICICI Bank',
  axis: 'Axis Bank',
  kotak: 'Kotak Mahindra',
};

function nowIso() {
  return new Date().toISOString();
}

function cleanText(text = '') {
  return String(text).trim();
}

function lower(text = '') {
  return cleanText(text).toLowerCase();
}

function compact(text = '') {
  return lower(text).replace(/[^\w@.\s-]/g, ' ').replace(/\s+/g, ' ').trim();
}

function titleCase(text = '') {
  return cleanText(text)
    .split(/\s+/)
    .filter(Boolean)
    .map(part => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(' ');
}

function money(value) {
  return `₹${Number(value || 0).toLocaleString('en-IN')}`;
}

function shortDate(value) {
  return value ? new Date(value).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : 'today';
}

function clone(value) {
  return value ? JSON.parse(JSON.stringify(value)) : value;
}

function normalizeState(state) {
  if (!state || typeof state !== 'object') return { pendingAction: null, lastAction: null };
  return {
    pendingAction: state.pendingAction || null,
    lastAction: state.lastAction || null,
  };
}

function isAffirmative(message = '') {
  const normalized = compact(message);
  return YES_WORDS.some(word => normalized === word || normalized.startsWith(`${word} `) || normalized.endsWith(` ${word}`));
}

function isNegative(message = '') {
  const normalized = compact(message);
  return NO_WORDS.some(word => normalized === word || normalized.startsWith(`${word} `) || normalized.endsWith(` ${word}`));
}

function wantsAbort(message = '') {
  const normalized = compact(message);
  return CANCEL_WORDS.some(word => normalized.includes(word));
}

function extractAmount(message = '') {
  const match = cleanText(message).match(/(?:₹|rs\.?\s*|inr\s*)?(\d{2,6})(?!\d)/i);
  return match ? Number(match[1]) : null;
}

function extractUpiId(message = '') {
  const match = cleanText(message).match(/[A-Za-z0-9._-]{2,}@[A-Za-z]{2,}/);
  return match ? match[0] : null;
}

function extractHours(message = '') {
  const match = cleanText(message).match(/(\d{1,2})(?:\s+)?(?:hours?|hrs?|hr)\b/i);
  return match ? Number(match[1]) : null;
}

function parseGatewayFromMessage(message = '') {
  const normalized = compact(message);
  if (!normalized) return null;
  if (/(razorpay|rzp)/.test(normalized)) return 'razorpay_test';
  if (/(stripe)/.test(normalized)) return 'stripe_sandbox';
  return null;
}

function parsePaymentMethodFromMessage(message = '') {
  const normalized = compact(message);
  if (!normalized) return null;
  if (/\bupi\b|gpay|phonepe|paytm|bhim/.test(normalized)) return 'upi';
  if (/net ?bank|bank transfer|hdfc|sbi|icici|axis|kotak/.test(normalized)) return 'netbanking';
  if (/card|credit card|debit card|visa|mastercard|amex/.test(normalized)) return 'card';
  return null;
}

function extractBank(message = '') {
  const normalized = compact(message);
  return Object.keys(BANK_ALIASES).find(key => normalized.includes(key)) || null;
}

function extractCardNumber(message = '') {
  const match = cleanText(message).match(/((?:\d[ -]?){13,19})/);
  if (!match?.[1]) return null;
  const digits = match[1].replace(/\D/g, '');
  return digits.length >= 13 && digits.length <= 19 ? digits : null;
}

function extractExpiry(message = '') {
  const match = cleanText(message).match(/\b(0[1-9]|1[0-2])\s*\/\s*(\d{2}|\d{4})\b/);
  if (!match) return null;
  const year = match[2].length === 4 ? match[2].slice(2) : match[2];
  return `${match[1]}/${year}`;
}

function extractCvv(message = '') {
  const labeled = cleanText(message).match(/(?:cvv|cvc|security code)\D*(\d{3,4})\b/i);
  if (labeled?.[1]) return labeled[1];

  const combined = cleanText(message).match(/\b(?:0[1-9]|1[0-2])\s*\/\s*(?:\d{2}|\d{4})\D+(\d{3,4})\b/);
  return combined?.[1] || null;
}

function extractCardHolder(message = '') {
  const labeled = cleanText(message).match(/(?:name|holder|name on card)\s*[:\-]?\s*([A-Za-z][A-Za-z\s.'-]{2,})/i);
  if (labeled?.[1]) return titleCase(labeled[1]);

  const parts = cleanText(message).split(',').map(part => part.trim()).filter(Boolean);
  const named = parts.reverse().find(part => {
    if (!/^[A-Za-z][A-Za-z\s.'-]{2,}$/.test(part)) return false;
    if (part.trim().split(/\s+/).length < 2) return false;
    const normalized = compact(part);
    return !/(razorpay|stripe|test mode|sandbox|upi|net banking|card)\b/.test(normalized);
  });
  return named ? titleCase(named) : null;
}

function extractIsoDate(message = '') {
  const normalized = compact(message);
  if (!normalized) return null;

  const today = new Date();
  const asYmd = d => d.toISOString().slice(0, 10);

  if (normalized.includes('today')) return asYmd(today);
  if (normalized.includes('yesterday')) return asYmd(new Date(today.getTime() - 86400000));

  const explicit = normalized.match(/\b(20\d{2}-\d{2}-\d{2})\b/);
  if (explicit) return explicit[1];

  const slash = normalized.match(/\b(\d{1,2})[\/-](\d{1,2})(?:[\/-](20\d{2}|\d{2}))?\b/);
  if (slash) {
    const day = Number(slash[1]);
    const month = Number(slash[2]) - 1;
    const year = slash[3] ? Number(slash[3].length === 2 ? `20${slash[3]}` : slash[3]) : today.getFullYear();
    const d = new Date(year, month, day);
    if (!Number.isNaN(d.getTime())) return asYmd(d);
  }

  return null;
}

function extractReason(message = '') {
  const text = cleanText(message);
  if (!text) return null;

  const strongMatch = text.match(/(?:because|due to|reason is|impact was)\s+(.+)/i);
  if (strongMatch?.[1]) return strongMatch[1].trim();

  const fallbackMatch = text.match(/(?:for)\s+(.+)/i);
  if (fallbackMatch?.[1] && !/^\d+\s*(?:hours?|hrs?|hr)\b/i.test(fallbackMatch[1].trim())) {
    return fallbackMatch[1].trim();
  }

  if (text.length > 30) return text;
  return null;
}

function findPlanFromMessage(message = '') {
  const normalized = compact(message);
  if (!normalized) return null;

  const aliases = {
    basic: ['basic', 'basic shield'],
    pro: ['pro', 'pro shield'],
    max: ['max', 'max shield'],
    ultimate: ['ultimate', 'ultimate shield'],
  };

  return db.getPlans().find(plan => {
    const options = new Set([
      plan.id.toLowerCase(),
      plan.name.toLowerCase(),
      ...plan.name.toLowerCase().split(/\s+/),
      ...(aliases[plan.id] || []),
    ]);
    return Array.from(options).some(option => normalized.includes(option));
  }) || null;
}

function escapeRegex(text = '') {
  return cleanText(text).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function hasPhrase(text = '', phrase = '') {
  const normalizedText = compact(text);
  const normalizedPhrase = compact(phrase);
  if (!normalizedText || !normalizedPhrase) return false;
  return new RegExp(`(^|\\s)${escapeRegex(normalizedPhrase)}(?=\\s|$)`).test(normalizedText);
}

function findTriggerFromMessage(message = '') {
  const normalized = compact(message);
  if (!normalized) return null;

  const aliases = {
    rain: ['rain', 'rainfall', 'barish', 'monsoon', 'downpour'],
    aqi: ['aqi', 'pollution', 'air quality', 'smog', 'smoke'],
    heat: ['heat', 'hot', 'temperature', 'loo'],
    curfew: ['curfew', 'lockdown', 'restriction'],
    flood: ['flood', 'waterlogging', 'water logging', 'flooding'],
    cyclone: ['cyclone', 'storm', 'hurricane'],
    fog: ['fog', 'mist', 'low visibility'],
    manual: ['manual', 'other'],
  };

  return TRIGGER_TYPES.find(type => (aliases[type] || [type]).some(term => hasPhrase(normalized, term))) || null;
}

function findZoneFromMessage(message = '') {
  const normalized = compact(message);
  if (!normalized) return { zone: null, city: null, matches: [] };

  const zones = db.getZones();
  const matches = zones.filter(zone => {
    const name = compact(zone.name);
    const city = compact(zone.city);
    return normalized.includes(name) || normalized.includes(`${name} ${city}`) || normalized.includes(city);
  });

  const exactZone = matches.find(zone => normalized.includes(compact(zone.name)));
  if (exactZone) return { zone: exactZone, city: exactZone.city, matches: [exactZone] };

  const matchedCity = matches[0]?.city || null;
  return {
    zone: matches.length === 1 ? matches[0] : null,
    city: matchedCity,
    matches,
  };
}

function dedupeById(items = []) {
  return items.filter((item, index) => items.findIndex(other => other.id === item.id) === index);
}

function navigationForMessage(message = '') {
  const normalized = compact(message);
  if (!/(show|open|take me|go to|navigate|move to|switch to|bring up)/.test(normalized)) return null;

  if (normalized.includes('wallet')) return 'wallet';
  if (normalized.includes('claim')) return 'claims';
  if (normalized.includes('plan') || normalized.includes('policy')) return 'plans';
  if (normalized.includes('profile') || normalized.includes('zone')) return 'profile';
  if (normalized.includes('home') || normalized.includes('dashboard')) return 'home';
  return null;
}

async function buildContext(worker) {
  const zone = db.getZone(worker.zoneId);
  const activePolicy = db.getActivePolicy(worker.id);
  const policies = db.getPoliciesByWorker(worker.id).slice(0, 5);
  const claims = db.getClaimsByWorker(worker.id);
  const paidClaims = claims.filter(claim => claim.status === 'paid');
  const walletTransactions = db.getWalletTransactions(worker.id, 5);
  const planQuotes = await Promise.all(
    db.getPlans().map(async plan => ({
      ...plan,
      pricing: await getPlanQuote(worker, plan),
    }))
  );

  const weekAgo = Date.now() - 7 * 86400000;
  const weeklyPaid = paidClaims
    .filter(claim => new Date(claim.triggeredAt).getTime() >= weekAgo)
    .reduce((sum, claim) => sum + Number(claim.payoutAmount || 0), 0);

  return {
    worker: {
      id: worker.id,
      name: worker.name,
      phone: worker.phone,
      platform: worker.platform,
      zoneId: worker.zoneId,
      zoneName: zone?.name || worker.zoneId,
      city: zone?.city || null,
      avgHoursPerWeek: Number(worker.avgHoursPerWeek || 45),
      walletBalance: db.getWalletBalance(worker.id),
    },
    zone: zone ? {
      id: zone.id,
      name: zone.name,
      city: zone.city,
      riskScore: zone.riskScore,
      floodProne: zone.floodProne,
      alerts: db.getZoneAlerts(zone),
    } : null,
    activePolicy: activePolicy ? {
      id: activePolicy.id,
      planId: activePolicy.planId,
      planName: db.getPlan(activePolicy.planId)?.name || activePolicy.planId,
      remainingActiveHours: Number(activePolicy.remainingActiveHours || 0),
      coveredActiveHours: Number(activePolicy.coveredActiveHours || 0),
      autoRenew: !!activePolicy.autoRenew,
      maxWeeklyPayout: Number(activePolicy.maxWeeklyPayout || 0),
      endDate: activePolicy.endDate,
    } : null,
    recentPolicies: policies.map(policy => ({
      id: policy.id,
      planId: policy.planId,
      planName: db.getPlan(policy.planId)?.name || policy.planId,
      status: policy.status,
      remainingActiveHours: Number(policy.remainingActiveHours || 0),
      autoRenew: !!policy.autoRenew,
      startDate: policy.startDate,
      endDate: policy.endDate,
    })),
    claims: {
      total: claims.length,
      paid: paidClaims.length,
      pending: claims.filter(claim => claim.status !== 'paid').length,
      weeklyPaid,
      recent: claims.slice(0, 5).map(claim => ({
        id: claim.id,
        triggerType: claim.triggerType,
        status: claim.status,
        payoutAmount: Number(claim.payoutAmount || 0),
        disruptionHours: Number(claim.disruptionHours || 0),
        triggeredAt: claim.triggeredAt,
      })),
    },
    wallet: {
      balance: db.getWalletBalance(worker.id),
      recentTransactions: walletTransactions.map(tx => ({
        type: tx.type,
        amount: Number(tx.amount || 0),
        description: tx.description,
        createdAt: tx.createdAt,
        ref: tx.ref || null,
      })),
    },
    plans: planQuotes.map(plan => ({
      id: plan.id,
      name: plan.name,
      includedActiveHours: Number(plan.includedActiveHours || 0),
      maxWeeklyPayout: Number(plan.maxWeeklyPayout || 0),
      triggers: plan.triggers,
      premium: Number(plan.pricing?.dynamicBundlePremium || plan.baseWeeklyPremium || 0),
      multiplier: Number(plan.pricing?.multiplier || 1),
      riskLabel: plan.pricing?.riskLabel || 'Standard',
      popular: !!plan.popular,
    })),
    topupGateways: TOPUP_GATEWAYS.map(gateway => ({
      id: gateway.id,
      label: gateway.label,
      provider: gateway.provider,
      mode: gateway.mode,
    })),
  };
}

function recommendedPlan(context) {
  if (!context?.plans?.length) return null;
  if (context.worker.avgHoursPerWeek >= 55) {
    return context.plans.find(plan => plan.id === 'ultimate') || context.plans[context.plans.length - 1];
  }
  if (context.zone?.riskScore >= 0.8) {
    return context.plans.find(plan => plan.id === 'max') || context.plans.find(plan => plan.id === 'pro') || context.plans[0];
  }
  return context.plans.find(plan => plan.id === 'pro') || context.plans.find(plan => plan.popular) || context.plans[0];
}

function planSummary(plan) {
  if (!plan) return 'a coverage plan';
  return `${plan.name} for ${money(plan.premium)} with ${plan.includedActiveHours} protected hours`;
}

function defaultTopupMethod(gatewayId) {
  return gatewayId === 'razorpay_test' ? 'upi' : 'card';
}

function paymentMethodLabel(method) {
  if (method === 'upi') return 'demo UPI checkout';
  if (method === 'netbanking') return 'demo net banking';
  return 'demo card checkout';
}

function gatewaySummary(gatewayId) {
  return getGateway(gatewayId)?.label || 'demo gateway';
}

function paymentDetailSummary(params = {}) {
  if (params.method === 'upi') return params.upiId || 'UPI ID pending';
  if (params.method === 'netbanking') return params.bank ? BANK_ALIASES[params.bank] || params.bank : 'bank pending';
  if (params.method === 'card') {
    const last4 = params.cardNumber ? params.cardNumber.slice(-4) : params.cardLast4;
    const holder = params.cardHolder || 'card holder pending';
    return last4 ? `${holder} · card ending ${last4}` : holder;
  }
  return 'payment details pending';
}

function describePolicy(context) {
  if (!context.activePolicy) {
    const recommended = recommendedPlan(context);
    return `You do not have an active policy right now. I would recommend ${planSummary(recommended)} based on your current zone and work pattern.`;
  }

  return `${context.activePolicy.planName} is active with ${context.activePolicy.remainingActiveHours} of ${context.activePolicy.coveredActiveHours} protected hours left. Auto-renew is ${context.activePolicy.autoRenew ? 'enabled' : 'disabled'}, and your payout cap is ${money(context.activePolicy.maxWeeklyPayout)}.`;
}

function describeWallet(context) {
  const latest = context.wallet.recentTransactions[0];
  const recentLine = latest
    ? ` Your latest transaction was ${latest.type === 'credit' ? 'a credit of' : 'a debit of'} ${money(latest.amount)} on ${shortDate(latest.createdAt)}.`
    : '';
  return `Your wallet balance is ${money(context.wallet.balance)}.${recentLine}`;
}

function describeClaims(context) {
  if (!context.claims.total) {
    return 'You have no claims yet. Once a disruption hits your covered zone, payouts are created automatically, and you can also file a manual claim through me if needed.';
  }

  const latest = context.claims.recent[0];
  const recentLine = latest
    ? ` Your latest claim was a ${latest.triggerType} claim on ${shortDate(latest.triggeredAt)} with status ${latest.status.replace(/_/g, ' ')}.`
    : '';
  return `You have ${context.claims.total} claims in total, ${context.claims.paid} paid, and ${money(context.claims.weeklyPaid)} credited this week.${recentLine}`;
}

function describePlans(context) {
  const lines = context.plans.slice(0, 4).map(plan =>
    `${plan.name}: ${money(plan.premium)}, ${plan.includedActiveHours} hours, up to ${money(plan.maxWeeklyPayout)}`
  );
  const recommended = recommendedPlan(context);
  return `Here are your current plan options: ${lines.join(' | ')}. I currently recommend ${planSummary(recommended)}.`;
}

function describeRisk(context) {
  if (!context.zone) return 'I could not find your current operating zone.';
  const alerts = context.zone.alerts?.slice(0, 2).map(alert => alert.msg).join(' ');
  return `You are currently mapped to ${context.zone.name}, ${context.zone.city}. The zone risk score is ${(Number(context.zone.riskScore || 0) * 100).toFixed(0)}%. ${alerts || 'I can also change your zone if you have moved.'}`;
}

function describeHome(context) {
  return `${describePolicy(context)} ${describeWallet(context)} ${describeClaims(context)}`;
}

function describeGeneralCapabilities() {
  return 'I can manage your coverage end to end: activate or renew plans, cancel coverage, toggle auto-renew, add or withdraw wallet money, file manual claims, change your zone, trigger demo simulations, and explain your current policy, claims, wallet, and risk status in a natural conversation.';
}

function inferInfoTopic(message = '') {
  const normalized = compact(message);
  if (!normalized) return 'general';
  if (normalized.includes('wallet') || normalized.includes('balance') || normalized.includes('money')) return 'wallet';
  if (normalized.includes('claim') || normalized.includes('payout')) return 'claims';
  if (normalized.includes('plan') || normalized.includes('policy') || normalized.includes('coverage') || normalized.includes('shield')) return 'policy';
  if (normalized.includes('price') || normalized.includes('premium') || normalized.includes('recommend')) return 'plans';
  if (normalized.includes('risk') || normalized.includes('zone') || normalized.includes('weather') || normalized.includes('alert')) return 'risk';
  if (normalized.includes('dashboard') || normalized.includes('home') || normalized.includes('status')) return 'home';
  return 'general';
}

function answerInfoTopic(topic, context) {
  if (topic === 'wallet') return describeWallet(context);
  if (topic === 'claims') return describeClaims(context);
  if (topic === 'policy') return describePolicy(context);
  if (topic === 'plans') return describePlans(context);
  if (topic === 'risk') return describeRisk(context);
  if (topic === 'home') return describeHome(context);
  return describeGeneralCapabilities();
}

function isInfoOnlyMessage(message = '') {
  const normalized = compact(message);
  return /\b(what|which|how much|how many|status|show|tell|do i have|am i|can you explain|help|recommend|best)\b/.test(normalized);
}

function parsePlanAction(message = '') {
  const normalized = compact(message);
  const plan = findPlanFromMessage(message);
  const wantsAutoRenew = /auto.?renew|auto renew/.test(normalized);

  if (/(renew|extend)\b/.test(normalized)) {
    return {
      type: 'renew_policy',
      params: { planId: plan?.id || null, autoRenew: wantsAutoRenew ? true : null },
      requiresConfirmation: false,
    };
  }

  if (/(cancel|terminate|stop)\b/.test(normalized) && /(policy|coverage|shield|plan)\b/.test(normalized)) {
    return {
      type: 'cancel_policy',
      params: {},
      requiresConfirmation: true,
    };
  }

  if (/(auto.?renew).*(on|enable|start|activate)|\bturn on auto/.test(normalized)) {
    return {
      type: 'set_auto_renew',
      params: { enabled: true },
      requiresConfirmation: false,
    };
  }

  if (/(auto.?renew).*(off|disable|stop)|\bturn off auto/.test(normalized)) {
    return {
      type: 'set_auto_renew',
      params: { enabled: false },
      requiresConfirmation: false,
    };
  }

  if (/(buy|activate|get|take|start)\b/.test(normalized) && /(plan|policy|coverage|shield)\b/.test(normalized)) {
    return {
      type: 'buy_policy',
      params: { planId: plan?.id || null, autoRenew: wantsAutoRenew ? true : null },
      requiresConfirmation: !plan,
    };
  }

  if (plan && /(buy|activate|get|take|start)/.test(normalized)) {
    return {
      type: 'buy_policy',
      params: { planId: plan.id, autoRenew: wantsAutoRenew ? true : null },
      requiresConfirmation: false,
    };
  }

  return null;
}

function parseWalletAction(message = '') {
  const normalized = compact(message);
  const amount = extractAmount(message);
  const upiId = extractUpiId(message);

  if (/(withdraw|cash ?out|send to|payout me|transfer out)/.test(normalized) && /(wallet|upi|money|balance|cash|amount|rupees|rs|inr)/.test(normalized)) {
    return {
      type: 'wallet_withdraw',
      params: { amount, upiId },
      requiresConfirmation: true,
    };
  }

  if (/(add|top ?up|load|recharge|put)/.test(normalized) && /(wallet|balance|money|fund)/.test(normalized)) {
    return {
      type: 'wallet_add',
      params: {
        amount,
        gatewayId: parseGatewayFromMessage(message),
        method: parsePaymentMethodFromMessage(message),
        upiId,
        bank: extractBank(message),
        cardNumber: extractCardNumber(message),
        expiry: extractExpiry(message),
        cvv: extractCvv(message),
        cardHolder: extractCardHolder(message),
      },
      requiresConfirmation: true,
    };
  }

  return null;
}

function parseClaimAction(message = '') {
  const normalized = compact(message);
  if (!/(claim|manual claim|file)/.test(normalized)) return null;

  return {
    type: 'manual_claim',
    params: {
      type: findTriggerFromMessage(message) || null,
      date: extractIsoDate(message),
      disruptionHours: extractHours(message),
      reason: extractReason(message),
    },
    requiresConfirmation: false,
  };
}

function parseZoneAction(message = '') {
  const normalized = compact(message);
  if (!/(zone|area|location|city|move me|switch me|change my area|change my zone)/.test(normalized)) return null;

  const found = findZoneFromMessage(message);
  return {
    type: 'change_zone',
    params: {
      zoneId: found.zone?.id || null,
      city: found.city || null,
    },
    matches: found.matches || [],
    requiresConfirmation: !!found.zone,
  };
}

function parseSimulationAction(message = '') {
  const normalized = compact(message);

  if (/(force expiry|simulate expiry|expire my policy|trigger expiry)/.test(normalized)) {
    return {
      type: 'simulate_expiry',
      params: {},
      requiresConfirmation: true,
    };
  }

  if (/(simulate|trigger|test|demo)/.test(normalized) && /(rain|aqi|heat|curfew|flood|cyclone|fog|disruption|event)/.test(normalized)) {
    return {
      type: 'simulate_trigger',
      params: { triggerType: findTriggerFromMessage(message) },
      requiresConfirmation: true,
    };
  }

  return null;
}

function heuristicPlan(message = '', context) {
  const navigationTarget = navigationForMessage(message);
  const planAction = parsePlanAction(message);
  if (planAction) return { mode: 'action', action: planAction, navigationTarget: navigationTarget || 'plans' };

  const walletAction = parseWalletAction(message);
  if (walletAction) return { mode: 'action', action: walletAction, navigationTarget: navigationTarget || 'wallet' };

  const claimAction = parseClaimAction(message);
  if (claimAction) return { mode: 'action', action: claimAction, navigationTarget: navigationTarget || 'claims' };

  const zoneAction = parseZoneAction(message);
  if (zoneAction) return { mode: 'action', action: zoneAction, navigationTarget: navigationTarget || 'profile' };

  const simulationAction = parseSimulationAction(message);
  if (simulationAction) return { mode: 'action', action: simulationAction, navigationTarget: 'home' };

  if (navigationTarget) {
    return { mode: 'navigate', navigationTarget, reply: `Opening ${navigationTarget} for you.` };
  }

  const infoTopic = inferInfoTopic(message);
  if (isInfoOnlyMessage(message) || infoTopic !== 'general') {
    return { mode: 'inform', infoTopic, reply: answerInfoTopic(infoTopic, context) };
  }

  return { mode: 'smalltalk', reply: describeGeneralCapabilities() };
}

function safeParseJson(text = '') {
  try {
    return JSON.parse(text);
  } catch {
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) return null;
    try {
      return JSON.parse(match[0]);
    } catch {
      return null;
    }
  }
}

async function groqPlan({ message, language, history, context, state }) {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) return null;

  const system = [
    'You are planning the next step for GigShield Sia, a multilingual assistant inside an insurance dashboard for delivery workers.',
    'Return JSON only.',
    'Supported modes: action, inform, navigate, cancel_pending, smalltalk.',
    'Supported action types: buy_policy, renew_policy, cancel_policy, set_auto_renew, wallet_add, wallet_withdraw, manual_claim, change_zone, simulate_trigger, simulate_expiry.',
    'Use only facts present in the context.',
    'If the user is answering a pending action, continue that action.',
    'If required details are missing, include them in action.missing instead of inventing them.',
    'For cancel_policy, wallet_withdraw, change_zone, simulate_trigger, and simulate_expiry, set action.requiresConfirmation to true unless the pending action is already awaiting confirmation.',
    'For wallet_add, gather amount, gatewayId, payment method, and the relevant payment details before final confirmation.',
    'For buy_policy without a plan, leave planId null so the app can recommend one.',
    'Use navigationTarget only from: home, plans, claims, wallet, profile.',
    `Reply language preference: ${language || 'same language as the user'}.`,
  ].join(' ');

  const userPrompt = {
    message,
    pendingAction: state.pendingAction,
    history: (history || []).slice(-8),
    context,
    outputShape: {
      mode: 'action|inform|navigate|cancel_pending|smalltalk',
      infoTopic: 'general|wallet|claims|policy|plans|risk|home|null',
      navigationTarget: 'home|plans|claims|wallet|profile|null',
      reply: 'short optional draft',
      action: {
        type: 'buy_policy|renew_policy|cancel_policy|set_auto_renew|wallet_add|wallet_withdraw|manual_claim|change_zone|simulate_trigger|simulate_expiry|null',
        params: {
          planId: 'basic|pro|max|ultimate|null',
          autoRenew: 'boolean|null',
          enabled: 'boolean|null',
          amount: 'number|null',
          gatewayId: 'razorpay_test|stripe_sandbox|null',
          method: 'upi|card|netbanking|null',
          upiId: 'string|null',
          bank: 'sbi|hdfc|icici|axis|kotak|null',
          cardNumber: 'string|null',
          expiry: 'MM/YY|null',
          cvv: 'string|null',
          cardHolder: 'string|null',
          date: 'YYYY-MM-DD|null',
          disruptionHours: 'number|null',
          reason: 'string|null',
          triggerType: 'rain|aqi|heat|curfew|flood|cyclone|fog|manual|null',
          zoneId: 'zone id|null',
          city: 'string|null',
        },
        missing: ['fieldName'],
        requiresConfirmation: 'boolean',
      },
    },
  };

  try {
    const { data } = await axios.post(
      GROQ_API_URL,
      {
        model: GROQ_MODEL,
        temperature: 0.1,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: JSON.stringify(userPrompt) },
        ],
      },
      {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        timeout: 20000,
      }
    );

    return safeParseJson(data?.choices?.[0]?.message?.content || '');
  } catch {
    return null;
  }
}

async function inferPlan({ message, language, history, context, state }) {
  const llmPlan = await groqPlan({ message, language, history, context, state });
  if (llmPlan?.mode) return llmPlan;
  return heuristicPlan(message, context);
}

function fillPendingAction(pendingAction, message) {
  const next = clone(pendingAction) || {};
  next.params = next.params || {};

  if (next.type === 'wallet_add') {
    const amount = next.params.amount ? null : extractAmount(message);
    const gatewayId = parseGatewayFromMessage(message);
    const method = parsePaymentMethodFromMessage(message);
    const upiId = extractUpiId(message);
    const bank = extractBank(message);
    const cardNumber = extractCardNumber(message);
    const expiry = extractExpiry(message);
    const cvv = extractCvv(message);
    const cardHolder = extractCardHolder(message);
    if (amount) next.params.amount = amount;
    if (gatewayId) next.params.gatewayId = gatewayId;
    if (method) next.params.method = method;
    if (upiId) next.params.upiId = upiId;
    if (bank) next.params.bank = bank;
    if (cardNumber) {
      next.params.cardNumber = cardNumber;
      next.params.cardLast4 = cardNumber.slice(-4);
    }
    if (expiry) next.params.expiry = expiry;
    if (cvv) next.params.cvv = cvv;
    if (cardHolder) next.params.cardHolder = cardHolder;
  }

  if (next.type === 'wallet_withdraw') {
    const amount = extractAmount(message);
    const upiId = extractUpiId(message);
    if (amount) next.params.amount = amount;
    if (upiId) next.params.upiId = upiId;
  }

  if (next.type === 'buy_policy' || next.type === 'renew_policy') {
    const plan = findPlanFromMessage(message);
    if (plan?.id) next.params.planId = plan.id;
    const normalized = compact(message);
    if (/(auto.?renew).*(on|enable|yes)/.test(normalized)) next.params.autoRenew = true;
    if (/(auto.?renew).*(off|disable|no)/.test(normalized)) next.params.autoRenew = false;
  }

  if (next.type === 'set_auto_renew') {
    const normalized = compact(message);
    if (/(on|enable|start|yes)/.test(normalized)) next.params.enabled = true;
    if (/(off|disable|stop|no)/.test(normalized)) next.params.enabled = false;
  }

  if (next.type === 'manual_claim') {
    const trigger = findTriggerFromMessage(message);
    const date = extractIsoDate(message);
    const hours = extractHours(message);
    const reason = extractReason(message);

    if (next.params.triggerType && !next.params.type) next.params.type = next.params.triggerType;
    if (trigger) next.params.type = trigger;
    if (date) next.params.date = date;
    if (hours) next.params.disruptionHours = hours;
    if (reason) next.params.reason = reason;
    if (!next.params.type) next.params.type = 'manual';
    if (!next.params.date) next.params.date = new Date().toISOString().slice(0, 10);
    if (!next.params.disruptionHours) next.params.disruptionHours = 4;
  }

  if (next.type === 'change_zone') {
    const found = findZoneFromMessage(message);
    if (found.zone?.id) next.params.zoneId = found.zone.id;
    if (found.city) next.params.city = found.city;
    next.matches = dedupeById([...(next.matches || []), ...(found.matches || [])]);
  }

  if (next.type === 'simulate_trigger') {
    const trigger = findTriggerFromMessage(message);
    if (trigger) next.params.triggerType = trigger;
  }

  return next;
}

function finalizeActionDraft(draft, context) {
  if (!draft?.type) return { ...draft, missing: [] };

  const action = clone(draft);
  action.params = action.params || {};
  action.missing = [];
  action.requiresConfirmation = !!action.requiresConfirmation;

  if (action.type === 'buy_policy') {
    if (!action.params.planId) {
      action.params.planId = recommendedPlan(context)?.id || null;
      action.requiresConfirmation = true;
    }
  }

  if (action.type === 'renew_policy') {
    action.requiresConfirmation = false;
    if (!action.params.planId) {
      action.params.planId = context.activePolicy?.planId || context.recentPolicies?.[0]?.planId || null;
    }
    if (!action.params.planId) action.missing.push('planId');
  }

  if (action.type === 'wallet_add') {
    action.requiresConfirmation = true;
    if (!action.params.amount) action.missing.push('amount');
    if (!action.params.gatewayId) action.missing.push('gatewayId');
    if (!action.params.method) action.missing.push('method');

    if (action.params.method === 'upi' && !action.params.upiId) {
      action.missing.push('upiId');
    }

    if (action.params.method === 'netbanking' && !action.params.bank) {
      action.missing.push('bank');
    }

    if (action.params.method === 'card') {
      if (!action.params.cardNumber) action.missing.push('cardNumber');
      if (!action.params.expiry) action.missing.push('expiry');
      if (!action.params.cvv) action.missing.push('cvv');
      if (!action.params.cardHolder) action.missing.push('cardHolder');
      if (action.params.cardNumber && !action.params.cardLast4) {
        action.params.cardLast4 = action.params.cardNumber.slice(-4);
      }
    }
  }

  if (action.type === 'wallet_withdraw') {
    action.requiresConfirmation = true;
    if (!action.params.amount) action.missing.push('amount');
    if (!action.params.upiId) action.missing.push('upiId');
  }

  if (action.type === 'set_auto_renew') {
    action.requiresConfirmation = false;
    if (action.params.enabled == null) action.missing.push('enabled');
  }

  if (action.type === 'manual_claim') {
    action.requiresConfirmation = false;
    if (!action.params.type) action.params.type = 'manual';
    if (!action.params.date) action.params.date = new Date().toISOString().slice(0, 10);
    if (!action.params.disruptionHours) action.params.disruptionHours = 4;
    if (!action.params.reason) action.missing.push('reason');
  }

  if (action.type === 'change_zone') {
    action.requiresConfirmation = true;
    if (!action.params.zoneId) action.missing.push('zoneId');
  }

  if (action.type === 'simulate_trigger') {
    action.requiresConfirmation = true;
    if (!action.params.triggerType) action.missing.push('triggerType');
  }

  if (action.type === 'simulate_expiry') {
    action.requiresConfirmation = true;
  }

  if (action.type === 'cancel_policy') {
    action.requiresConfirmation = true;
  }

  return action;
}

function buildClarification(action, context) {
  if (!action) return 'Tell me what you want me to do, and I will handle it for you.';

  if (action.type === 'buy_policy') {
    const recommended = recommendedPlan(context);
    return `I can activate ${planSummary(recommended)}. Say "buy it" to continue, or tell me another plan like Basic, Pro, Max, or Ultimate.`;
  }

  if (action.type === 'renew_policy') {
    return 'I can renew your latest plan, but I could not identify which one. Say something like "renew my Pro Shield".';
  }

  if (action.type === 'wallet_add') {
    if (!action.params.amount) {
      return 'How much would you like me to add to your wallet? You can say something like "add ₹500".';
    }
    if (!action.params.gatewayId) {
      return `For ${money(action.params.amount)}, which demo payment rail should I use: Razorpay Test Mode or Stripe Sandbox?`;
    }
    if (!action.params.method) {
      return `Great. For ${gatewaySummary(action.params.gatewayId)}, which payment method should I use: UPI, card, or net banking?`;
    }
    if (action.params.method === 'upi' && !action.params.upiId) {
      return 'Share the UPI ID I should use for this demo payment, for example `ravi@oksbi` or `demo@upi`.';
    }
    if (action.params.method === 'netbanking' && !action.params.bank) {
      return 'Which bank should I use for the demo net banking step: SBI, HDFC, ICICI, Axis, or Kotak?';
    }
    if (action.params.method === 'card') {
      const missingCardBits = [
        !action.params.cardNumber && 'card number',
        !action.params.expiry && 'expiry',
        !action.params.cvv && 'CVV',
        !action.params.cardHolder && 'card holder name',
      ].filter(Boolean);
      if (missingCardBits.length) {
        return `Send the ${missingCardBits.join(', ')} for the demo card payment. A simple format like "4111111111111111, 12/28, 123, Ravi Kumar" works well.`;
      }
    }
    return 'I have the payment details. Please confirm and I will run the demo top-up.';
  }

  if (action.type === 'wallet_withdraw') {
    if (!action.params.amount) return 'How much should I withdraw from your wallet?';
    return `I can send ${money(action.params.amount)}. What UPI ID should I use?`;
  }

  if (action.type === 'set_auto_renew') {
    return 'Should I turn auto-renew on or off for your active policy?';
  }

  if (action.type === 'manual_claim') {
    return 'Tell me briefly what happened so I can file the manual claim with the right reason.';
  }

  if (action.type === 'change_zone') {
    const possibleZones = (action.matches || [])
      .map(zone => zone.name)
      .slice(0, 4);
    if (possibleZones.length > 1) {
      return `I found multiple matching zones: ${possibleZones.join(', ')}. Tell me the exact zone you want.`;
    }
    return 'Tell me the exact zone or area you want to switch to, for example Kurla, Bandra, or Powai.';
  }

  if (action.type === 'simulate_trigger') {
    return 'Which disruption should I simulate: rain, AQI, heat, curfew, flood, cyclone, or fog?';
  }

  return 'I need one more detail before I can do that.';
}

function buildConfirmation(action, context) {
  if (!action) return 'Please confirm.';

  if (action.type === 'cancel_policy') {
    return `Please confirm: should I cancel your active policy${context.activePolicy ? ` (${context.activePolicy.planName})` : ''}?`;
  }

  if (action.type === 'wallet_withdraw') {
    return `Please confirm: should I withdraw ${money(action.params.amount)} to ${action.params.upiId}?`;
  }

  if (action.type === 'change_zone') {
    const zone = db.getZone(action.params.zoneId);
    return `Please confirm: should I change your operating zone to ${zone?.name || action.params.zoneId}${zone?.city ? `, ${zone.city}` : ''}?`;
  }

  if (action.type === 'simulate_trigger') {
    return `Please confirm: should I simulate a ${action.params.triggerType} disruption right now?`;
  }

  if (action.type === 'simulate_expiry') {
    return 'Please confirm: should I force your active policy into near-expiry demo mode?';
  }

  if (action.type === 'buy_policy') {
    const plan = context.plans.find(item => item.id === action.params.planId);
    return `I recommend ${planSummary(plan)}. Should I activate it now?`;
  }

  if (action.type === 'wallet_add') {
    const gateway = getGateway(action.params.gatewayId);
    const followUp = action.followUp?.type === 'buy_policy'
      ? ' After the top-up, I will activate your plan automatically.'
      : action.followUp?.type === 'renew_policy'
        ? ' After the top-up, I will renew your plan automatically.'
        : '';
    return `Please confirm: should I add ${money(action.params.amount)} using ${gateway.label} via ${paymentMethodLabel(action.params.method)} (${paymentDetailSummary(action.params)})?${followUp}`;
  }

  return 'Please confirm and I will do it.';
}

async function executePolicyCancel(worker, context) {
  if (!context.activePolicy) {
    return { type: 'cancel_policy', success: false, summary: 'You do not have an active policy to cancel.' };
  }

  db.cancelPolicy(worker.id);
  await notifyWorkerAction({
    workerId: worker.id,
    type: 'warning',
    inAppMessage: 'Your active policy has been cancelled.',
    emailSubject: 'Your GigShield policy was cancelled',
    emailTitle: 'Coverage cancelled',
    emailIntro: 'Your active protection has been cancelled successfully.',
    emailLines: [`Plan: ${context.activePolicy.planName}`],
    meta: { action: 'cancel_policy', policyId: context.activePolicy.id },
  });

  return {
    type: 'cancel_policy',
    success: true,
    label: 'Coverage cancelled',
    summary: `Your ${context.activePolicy.planName} policy has been cancelled.`,
    ui: { refresh: true, navigateTo: 'plans' },
  };
}

async function executePolicyRenew(worker, action, context) {
  const planId = action.params.planId || context.activePolicy?.planId || context.recentPolicies?.[0]?.planId;
  if (!planId) {
    return { type: 'renew_policy', success: false, summary: 'I could not find a plan to renew.' };
  }

  const sourcePolicy = context.activePolicy || context.recentPolicies[0];
  const result = await purchasePolicy({
    workerId: worker.id,
    planId,
    autoRenew: action.params.autoRenew == null ? !!sourcePolicy?.autoRenew : !!action.params.autoRenew,
    source: 'chatbot',
  });

  if (result.error) {
    if (result.status === 402) {
      const gap = Math.max(0, Number(result.required || 0) - Number(result.balance || 0));
      return {
        type: 'renew_policy',
        success: false,
        summary: `${result.error} I can add ${money(gap)} to your wallet and renew ${result.plan?.name || db.getPlan(planId)?.name || 'your plan'} in one step if you want.`,
        offerAction: {
          type: 'wallet_add',
          params: { amount: gap },
          requiresConfirmation: true,
          followUp: {
            type: 'renew_policy',
            params: {
              planId,
              autoRenew: action.params.autoRenew == null ? !!sourcePolicy?.autoRenew : !!action.params.autoRenew,
            },
          },
        },
      };
    }
    return { type: 'renew_policy', success: false, summary: result.error };
  }

  await notifyWorkerAction({
    workerId: worker.id,
    type: 'success',
    inAppMessage: `${result.plan.name} renewed from chat for ${money(result.premium)}.`,
    emailSubject: 'Your policy was renewed',
    emailTitle: 'Policy renewed',
    emailIntro: `${result.plan.name} is active again.`,
    emailLines: [
      `Bundle premium: ${money(result.premium)}`,
      `Protected active hours: ${result.policy.coveredActiveHours}h`,
    ],
    meta: { action: 'renew_policy', policyId: result.policy.id, planId: result.plan.id },
  });

  return {
    type: 'renew_policy',
    success: true,
    label: 'Policy renewed',
    summary: `${result.plan.name} has been renewed for ${money(result.premium)}.`,
    policy: result.policy,
    ui: { refresh: true, navigateTo: 'plans' },
  };
}

async function executePolicyBuy(worker, action, context) {
  const planId = action.params.planId || recommendedPlan(context)?.id;
  const result = await purchasePolicy({
    workerId: worker.id,
    planId,
    autoRenew: !!action.params.autoRenew,
    source: 'chatbot',
  });

  if (result.error) {
    if (result.status === 402) {
      const gap = Math.max(0, Number(result.required || 0) - Number(result.balance || 0));
      return {
        type: 'buy_policy',
        success: false,
        summary: `${result.error} I can add ${money(gap)} to your wallet and activate ${result.plan?.name || db.getPlan(planId)?.name || 'that plan'} in one step if you want.`,
        offerAction: {
          type: 'wallet_add',
          params: { amount: gap },
          requiresConfirmation: true,
          followUp: {
            type: 'buy_policy',
            params: {
              planId,
              autoRenew: !!action.params.autoRenew,
            },
          },
        },
      };
    }
    return { type: 'buy_policy', success: false, summary: result.error };
  }

  await notifyWorkerAction({
    workerId: worker.id,
    type: 'success',
    inAppMessage: `${result.plan.name} activated from chat for ${money(result.premium)}.`,
    emailSubject: 'Your new policy is active',
    emailTitle: 'Protection activated',
    emailIntro: `${result.plan.name} is now protecting your earnings.`,
    emailLines: [
      `Premium paid: ${money(result.premium)}`,
      `Protected active hours: ${result.policy.coveredActiveHours}h`,
    ],
    meta: { action: 'buy_policy', policyId: result.policy.id, planId: result.plan.id },
  });

  return {
    type: 'buy_policy',
    success: true,
    label: 'Policy activated',
    summary: `${result.plan.name} is now active for ${money(result.premium)}.`,
    policy: result.policy,
    ui: { refresh: true, navigateTo: 'plans' },
  };
}

async function executeWalletAdd(worker, action) {
  const amount = Number(action.params.amount || 0);
  const gateway = getGateway(action.params.gatewayId);
  const method = action.params.method || null;
  const upiId = cleanText(action.params.upiId || '');
  const bank = cleanText(action.params.bank || '').toLowerCase();
  const cardNumber = cleanText(action.params.cardNumber || '').replace(/\D/g, '');
  const expiry = cleanText(action.params.expiry || '');
  const cvv = cleanText(action.params.cvv || '').replace(/\D/g, '');
  const cardHolder = cleanText(action.params.cardHolder || '');
  if (!amount || amount < 10) {
    return { type: 'wallet_add', success: false, summary: 'Please add at least ₹10 to the wallet.' };
  }
  if (amount > 50000) {
    return { type: 'wallet_add', success: false, summary: 'The maximum wallet top-up in one transaction is ₹50,000.' };
  }
  if (!action.params.gatewayId) {
    return { type: 'wallet_add', success: false, summary: 'Choose Razorpay Test Mode or Stripe Sandbox before I run the demo top-up.' };
  }
  if (!method) {
    return { type: 'wallet_add', success: false, summary: 'Choose whether this demo payment should use UPI, card, or net banking.' };
  }
  if (method === 'upi' && !upiId) {
    return { type: 'wallet_add', success: false, summary: 'I still need the UPI ID to complete this demo top-up.' };
  }
  if (method === 'netbanking' && !BANK_ALIASES[bank]) {
    return { type: 'wallet_add', success: false, summary: 'Tell me which bank to use: SBI, HDFC, ICICI, Axis, or Kotak.' };
  }
  if (method === 'card') {
    if (cardNumber.length < 13 || cardNumber.length > 19) {
      return { type: 'wallet_add', success: false, summary: 'I need a valid demo card number before I can continue.' };
    }
    if (!/^(0[1-9]|1[0-2])\/\d{2}$/.test(expiry)) {
      return { type: 'wallet_add', success: false, summary: 'I need the card expiry in MM/YY format.' };
    }
    if (cvv.length < 3 || cvv.length > 4) {
      return { type: 'wallet_add', success: false, summary: 'I need a valid 3 or 4 digit CVV for the demo card step.' };
    }
    if (!cardHolder) {
      return { type: 'wallet_add', success: false, summary: 'I still need the card holder name for the demo payment.' };
    }
  }

  const created = createTopupSession({
    worker,
    amount,
    gatewayId: gateway.id,
    method,
    purpose: 'Sia assistant wallet top-up',
  });
  const completed = completeTopupSession(created.session.id, {
    method,
    source: 'chatbot',
    upiId: method === 'upi' ? upiId : null,
    bank: method === 'netbanking' ? bank : null,
    cardLast4: method === 'card' ? cardNumber.slice(-4) : null,
    expiry: method === 'card' ? expiry : null,
    cardHolder: method === 'card' ? cardHolder : null,
  });

  db.creditWallet(worker.id, amount, `Added via Sia assistant using ${gateway.label}`, {
    method: 'gateway_topup',
    gatewayId: completed.session.gatewayId,
    gatewayLabel: completed.session.gatewayLabel,
    gatewayProvider: completed.session.gatewayProvider,
    paymentSessionId: completed.session.id,
    providerOrderId: completed.session.providerOrderId,
    providerPaymentId: completed.session.providerPaymentId,
    ref: completed.session.displayRef,
    upiId: method === 'upi' ? upiId : null,
    bank: method === 'netbanking' ? bank : null,
    cardLast4: method === 'card' ? cardNumber.slice(-4) : null,
  });

  await notifyWorkerAction({
    workerId: worker.id,
    type: 'success',
    inAppMessage: `${money(amount)} added to your wallet from chat via ${gateway.label}.`,
    emailSubject: 'Wallet top-up completed',
    emailTitle: 'Wallet updated',
    emailIntro: `${money(amount)} has been added to your GigShield wallet.`,
    emailLines: [
      `Gateway: ${gateway.label}`,
      `Method: ${paymentMethodLabel(method)}`,
      `Details: ${paymentDetailSummary({
        method,
        upiId,
        bank,
        cardHolder,
        cardNumber,
      })}`,
      `Reference: ${completed.session.displayRef}`,
      `Available balance: ${money(db.getWalletBalance(worker.id))}`,
    ],
    meta: { action: 'wallet_add', amount, gatewayId: gateway.id, ref: completed.session.displayRef },
  });

  return {
    type: 'wallet_add',
    success: true,
    label: 'Wallet topped up',
    summary: `${money(amount)} has been added through ${gateway.label}. Your new balance is ${money(db.getWalletBalance(worker.id))}.`,
    balance: db.getWalletBalance(worker.id),
    gateway: {
      id: gateway.id,
      label: gateway.label,
      method,
      ref: completed.session.displayRef,
      detailSummary: paymentDetailSummary({
        method,
        upiId,
        bank,
        cardHolder,
        cardNumber,
      }),
    },
    ui: { refresh: true, navigateTo: 'wallet' },
  };
}

async function executeWalletWithdraw(worker, action, context) {
  const amount = Number(action.params.amount || 0);
  const upiId = cleanText(action.params.upiId);

  if (!amount || amount < 10) {
    return { type: 'wallet_withdraw', success: false, summary: 'Please choose a withdrawal amount of at least ₹10.' };
  }
  if (!upiId || !/@/.test(upiId)) {
    return { type: 'wallet_withdraw', success: false, summary: 'I need a valid UPI ID to complete the withdrawal.' };
  }
  if (context.wallet.balance < amount) {
    return { type: 'wallet_withdraw', success: false, summary: `You only have ${money(context.wallet.balance)} in your wallet right now.` };
  }

  const ref = `WDR${Date.now().toString(36).toUpperCase()}`;
  const tx = db.debitWallet(worker.id, amount, `Withdrawn to ${upiId}`, {
    method: 'upi_withdrawal',
    ref,
    upiId,
  });

  if (tx?.error) {
    return { type: 'wallet_withdraw', success: false, summary: tx.error };
  }

  await notifyWorkerAction({
    workerId: worker.id,
    type: 'info',
    inAppMessage: `${money(amount)} withdrawn to ${upiId}.`,
    emailSubject: 'Wallet withdrawal completed',
    emailTitle: 'Withdrawal processed',
    emailIntro: `${money(amount)} was withdrawn from your wallet.`,
    emailLines: [`Destination: ${upiId}`, `Reference: ${ref}`, `Available balance: ${money(db.getWalletBalance(worker.id))}`],
    meta: { action: 'wallet_withdraw', amount, ref, upiId },
  });

  return {
    type: 'wallet_withdraw',
    success: true,
    label: 'Withdrawal completed',
    summary: `${money(amount)} has been sent to ${upiId}. Your remaining balance is ${money(db.getWalletBalance(worker.id))}.`,
    balance: db.getWalletBalance(worker.id),
    ui: { refresh: true, navigateTo: 'wallet' },
  };
}

async function executeManualClaim(worker, action, context) {
  const activePolicy = db.getActivePolicy(worker.id);
  if (!activePolicy) {
    return { type: 'manual_claim', success: false, summary: 'You need an active policy before I can file a claim.' };
  }

  const requestedHours = Math.min(24, Math.max(1, Number(action.params.disruptionHours || 4)));
  const coveredHours = Math.min(requestedHours, Number(activePolicy.remainingActiveHours ?? activePolicy.coveredActiveHours ?? requestedHours));

  if (coveredHours <= 0) {
    return { type: 'manual_claim', success: false, summary: 'There are no protected hours left on your active policy.' };
  }

  const claim = db.createClaim({
    workerId: worker.id,
    policyId: activePolicy.id,
    triggerType: action.params.type || 'manual',
    triggerValue: 'N/A',
    disruptionHours: coveredHours,
    reservedActiveHours: coveredHours,
    payoutAmount: (activePolicy.maxWeeklyPayout / 7) * (coveredHours / 4),
    fraudScore: 50,
    status: 'manual_review',
    manualReason: action.params.reason,
    triggeredAt: action.params.date || nowIso(),
    weatherSource: 'User Submitted',
  });
  db.adjustPolicyHours(activePolicy.id, -coveredHours);

  await notifyWorkerAction({
    workerId: worker.id,
    type: 'info',
    inAppMessage: `Manual claim submitted for ${coveredHours} protected hours.`,
    emailSubject: 'Manual claim submitted',
    emailTitle: 'Claim under review',
    emailIntro: 'Your manual claim has been submitted and is awaiting review.',
    emailLines: [`Trigger: ${action.params.type || 'manual'}`, `Protected hours reserved: ${coveredHours}h`],
    meta: { action: 'manual_claim', claimId: claim.id, policyId: activePolicy.id },
  });

  return {
    type: 'manual_claim',
    success: true,
    label: 'Manual claim filed',
    summary: `Your manual ${claim.triggerType} claim for ${coveredHours} hours has been submitted for review.`,
    claim,
    ui: { refresh: true, navigateTo: 'claims' },
  };
}

async function executeZoneChange(worker, action) {
  const zone = db.getZone(action.params.zoneId);
  if (!zone) {
    return { type: 'change_zone', success: false, summary: 'I could not find that zone in the system.' };
  }

  Object.assign(worker, { zoneId: zone.id });
  db.save();

  await notifyWorkerAction({
    workerId: worker.id,
    type: 'info',
    inAppMessage: `Coverage zone updated to ${zone.name}.`,
    emailSubject: 'Coverage zone updated',
    emailTitle: 'Zone changed',
    emailIntro: 'Your operating zone has been updated successfully.',
    emailLines: [`New zone: ${zone.name}, ${zone.city}`],
    meta: { action: 'zone_update', zoneId: zone.id },
  });

  return {
    type: 'change_zone',
    success: true,
    label: 'Zone updated',
    summary: `Your operating zone has been changed to ${zone.name}, ${zone.city}.`,
    ui: { refresh: true, navigateTo: 'profile' },
  };
}

async function executeAutoRenew(worker, action, context) {
  const policy = db.getActivePolicy(worker.id);
  if (!policy) {
    return { type: 'set_auto_renew', success: false, summary: 'You do not have an active policy to update.' };
  }

  db.updatePolicy(policy.id, { autoRenew: !!action.params.enabled });
  await notifyWorkerAction({
    workerId: worker.id,
    type: 'info',
    inAppMessage: `Auto-renew ${action.params.enabled ? 'enabled' : 'disabled'} for your active policy.`,
    emailSubject: `Auto-renew ${action.params.enabled ? 'enabled' : 'disabled'}`,
    emailTitle: 'Auto-renew updated',
    emailIntro: `Auto-renew has been ${action.params.enabled ? 'enabled' : 'disabled'} for your active coverage.`,
    meta: { action: 'toggle_autorenew', autoRenew: !!action.params.enabled, policyId: policy.id },
  });

  return {
    type: 'set_auto_renew',
    success: true,
    label: action.params.enabled ? 'Auto-renew enabled' : 'Auto-renew disabled',
    summary: `Auto-renew is now ${action.params.enabled ? 'enabled' : 'disabled'} for ${context.activePolicy?.planName || 'your active policy'}.`,
    ui: { refresh: true, navigateTo: 'plans' },
  };
}

async function executeSimulation(worker, action) {
  if (action.type === 'simulate_expiry') {
    const policy = db.getActivePolicy(worker.id);
    if (!policy) {
      return { type: 'simulate_expiry', success: false, summary: 'You do not have an active policy to force into expiry mode.' };
    }

    const nearExpiry = new Date(Date.now() + 60000).toISOString();
    db.updatePolicy(policy.id, {
      endDate: nearExpiry,
      remainingActiveHours: Math.min(1, policy.remainingActiveHours || 1),
      notifiedExpiring: true,
    });
    await notifyWorkerAction({
      workerId: worker.id,
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

    return {
      type: 'simulate_expiry',
      success: true,
      label: 'Expiry simulated',
      summary: 'I forced your policy into near-expiry demo mode and sent the notification.',
      ui: { refresh: true, navigateTo: 'home' },
    };
  }

  global.SIMULATE_DISRUPTION = true;
  global.SIMULATE_TYPE = action.params.triggerType;
  try {
    const triggers = await runCheck();
    return {
      type: 'simulate_trigger',
      success: true,
      label: 'Simulation triggered',
      summary: `I triggered a ${action.params.triggerType} disruption simulation.`,
      triggers,
      ui: { refresh: true, navigateTo: 'home' },
    };
  } finally {
    global.SIMULATE_DISRUPTION = false;
    global.SIMULATE_TYPE = null;
  }
}

async function executeAction(worker, action, context) {
  if (action.type === 'buy_policy') return executePolicyBuy(worker, action, context);
  if (action.type === 'renew_policy') return executePolicyRenew(worker, action, context);
  if (action.type === 'cancel_policy') return executePolicyCancel(worker, context);
  if (action.type === 'set_auto_renew') return executeAutoRenew(worker, action, context);
  if (action.type === 'wallet_add') return executeWalletAdd(worker, action);
  if (action.type === 'wallet_withdraw') return executeWalletWithdraw(worker, action, context);
  if (action.type === 'manual_claim') return executeManualClaim(worker, action, context);
  if (action.type === 'change_zone') return executeZoneChange(worker, action);
  if (action.type === 'simulate_trigger' || action.type === 'simulate_expiry') return executeSimulation(worker, action);
  return { type: action.type || 'unknown', success: false, summary: 'I do not know how to do that yet.' };
}

async function executeWithFollowUps(worker, action, context) {
  const executedActions = [];
  let currentContext = context;
  let currentAction = action;

  while (currentAction) {
    const result = await executeAction(worker, currentAction, currentContext);
    executedActions.push(result);

    if (!result.success || !currentAction.followUp) {
      return { primary: result, executedActions };
    }

    currentContext = await buildContext(worker);
    currentAction = currentAction.followUp;
  }

  return { primary: executedActions[executedActions.length - 1] || null, executedActions };
}

function executedActionSummaries(executedActions = []) {
  return executedActions
    .filter(action => action?.label || action?.summary)
    .map(action => ({
      type: action.type,
      label: action.label || action.summary,
      success: !!action.success,
      summary: action.summary,
    }));
}

function combineUi(executedActions = [], fallback = {}) {
  return executedActions.reduce((ui, action) => ({
    refresh: ui.refresh || !!action?.ui?.refresh,
    navigateTo: action?.ui?.navigateTo || ui.navigateTo,
  }), { refresh: false, navigateTo: fallback.navigateTo || null });
}

function buildSuggestions({ pendingAction, actionResult, context, topic }) {
  if (pendingAction?.type === 'wallet_add') {
    if (!pendingAction.params?.amount) return ['Add ₹200', 'Add ₹500', 'Add ₹1000', 'Cancel'];
    if (!pendingAction.params?.gatewayId) return ['Razorpay Test Mode', 'Stripe Sandbox', 'Cancel'];
    if (!pendingAction.params?.method) return ['UPI', 'Card', 'Net Banking', 'Cancel'];
    if (pendingAction.params?.method === 'upi' && !pendingAction.params?.upiId) return ['demo@upi', 'ravi@oksbi', 'Cancel'];
    if (pendingAction.params?.method === 'netbanking' && !pendingAction.params?.bank) return ['SBI', 'HDFC', 'ICICI', 'Cancel'];
    if (pendingAction.params?.method === 'card' && !pendingAction.params?.cardNumber) {
      return ['4111111111111111, 12/28, 123, Ravi Kumar', 'Cancel'];
    }
    return ['Yes, continue', 'Use Razorpay instead', 'Use Stripe instead', 'Cancel'];
  }

  if (pendingAction?.type === 'wallet_withdraw') {
    if (!pendingAction.params?.amount) return ['Withdraw ₹200', 'Withdraw ₹500', 'Cancel'];
    if (!pendingAction.params?.upiId) return ['Use demo@upi', 'Use ravi@oksbi', 'Cancel'];
    return ['Yes, withdraw it', 'Change amount', 'Cancel'];
  }

  if (pendingAction?.type === 'buy_policy' || pendingAction?.type === 'renew_policy') {
    return ['Yes, continue', 'Show other plans', 'Cancel'];
  }

  if (pendingAction?.type === 'change_zone') return ['Bandra', 'Kurla', 'Powai', 'Cancel'];
  if (pendingAction?.type === 'manual_claim') return ['Rain disruption for 4 hours', 'Flood disruption for 3 hours', 'Cancel'];

  if (actionResult?.type === 'wallet_add' && actionResult?.success) {
    return ['What is my wallet balance?', 'Withdraw ₹200 to demo@upi', 'Buy Pro Shield'];
  }

  if (actionResult?.type === 'buy_policy' && actionResult?.success) {
    return ['Show my active policy', 'Turn on auto-renew', 'What is my wallet balance?'];
  }

  if (topic === 'wallet') return ['Add ₹500 to wallet', 'Withdraw ₹200 to demo@upi', 'What is my wallet balance?'];
  if (topic === 'claims') return ['Show my paid claims', 'File a manual claim', 'Simulate rain disruption'];
  if (topic === 'policy') return ['Recommend a plan', 'Renew my plan', 'Turn on auto-renew'];

  return ['What is my wallet balance?', 'Recommend a plan', 'Change my zone to Bandra', 'Simulate rain disruption'];
}

async function localizeReply(reply, language) {
  const apiKey = process.env.GROQ_API_KEY;
  if (!reply || !apiKey || !language || language === 'English') return reply;

  try {
    const { data } = await axios.post(
      GROQ_API_URL,
      {
        model: GROQ_MODEL,
        temperature: 0.2,
        messages: [
          {
            role: 'system',
            content: `Rewrite assistant replies in ${language}. Keep plan names, zone names, rupee amounts, dates, and IDs exactly as they appear. Return plain text only.`,
          },
          {
            role: 'user',
            content: reply,
          },
        ],
      },
      {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        timeout: 15000,
      }
    );

    return data?.choices?.[0]?.message?.content?.trim() || reply;
  } catch {
    return reply;
  }
}

async function finalizeResponse(payload, language) {
  return {
    ...payload,
    reply: await localizeReply(payload.reply, language),
  };
}

async function handleChatMessage({ workerId, message, language, history, conversationState }) {
  const worker = db.findWorkerById(workerId);
  if (!worker) return { status: 404, error: 'Worker not found' };

  const state = normalizeState(conversationState);
  const text = cleanText(message);
  if (!text) return { status: 400, error: 'message is required' };

  let context = await buildContext(worker);

  if (state.pendingAction) {
    if (wantsAbort(text) || isNegative(text)) {
      return finalizeResponse({
        reply: 'Okay, I stopped that request. Tell me what you want to do next.',
        conversationState: { pendingAction: null, lastAction: state.lastAction },
        executedActions: [],
        suggestions: buildSuggestions({ context, topic: inferInfoTopic(text) }),
        usedGroq: false,
        ui: { refresh: false, navigateTo: null },
      }, language);
    }

    let pending = fillPendingAction(state.pendingAction, text);
    pending = finalizeActionDraft(pending, context);

    if (pending.requiresConfirmation && !pending.confirmed) {
      if (isAffirmative(text)) {
        pending.confirmed = true;
      } else if (pending.missing?.length) {
        return finalizeResponse({
          reply: buildClarification(pending, context),
          conversationState: { pendingAction: pending, lastAction: state.lastAction },
          executedActions: [],
          suggestions: buildSuggestions({ pendingAction: pending, context }),
          usedGroq: false,
          ui: { refresh: false, navigateTo: null },
        }, language);
      } else {
        return finalizeResponse({
          reply: buildConfirmation(pending, context),
          conversationState: { pendingAction: pending, lastAction: state.lastAction },
          executedActions: [],
          suggestions: buildSuggestions({ pendingAction: pending, context }),
          usedGroq: false,
          ui: { refresh: false, navigateTo: null },
        }, language);
      }
    }

    if (pending.missing?.length) {
      return finalizeResponse({
        reply: buildClarification(pending, context),
        conversationState: { pendingAction: pending, lastAction: state.lastAction },
        executedActions: [],
        suggestions: buildSuggestions({ pendingAction: pending, context }),
        usedGroq: false,
        ui: { refresh: false, navigateTo: null },
      }, language);
    }

    const execution = await executeWithFollowUps(worker, pending, context);
    context = await buildContext(worker);

    if (!execution.primary?.success && execution.primary?.offerAction) {
      return finalizeResponse({
        reply: execution.primary.summary,
        actionResult: execution.primary,
        executedActions: executedActionSummaries(execution.executedActions),
        conversationState: { pendingAction: execution.primary.offerAction, lastAction: execution.primary.type },
        suggestions: buildSuggestions({ pendingAction: execution.primary.offerAction, context }),
        usedGroq: false,
        ui: combineUi(execution.executedActions),
      }, language);
    }

    return finalizeResponse({
      reply: execution.primary?.summary || 'Done.',
      actionResult: execution.primary,
      executedActions: executedActionSummaries(execution.executedActions),
      conversationState: { pendingAction: null, lastAction: execution.primary?.type || state.lastAction },
      suggestions: buildSuggestions({ actionResult: execution.primary, context, topic: execution.primary?.type }),
      usedGroq: false,
      ui: combineUi(execution.executedActions),
      context: {
        walletBalance: context.wallet.balance,
        activePolicy: context.activePolicy,
      },
    }, language);
  }

  const plan = await inferPlan({ message: text, language, history, context, state });

  if (plan.mode === 'cancel_pending') {
    return finalizeResponse({
      reply: 'There is nothing pending right now, but I am ready for the next thing you need.',
      conversationState: { pendingAction: null, lastAction: state.lastAction },
      executedActions: [],
      suggestions: buildSuggestions({ context, topic: inferInfoTopic(text) }),
      usedGroq: true,
      ui: { refresh: false, navigateTo: null },
    }, language);
  }

  if (plan.mode === 'navigate') {
    return finalizeResponse({
      reply: plan.reply || `Opening ${plan.navigationTarget} for you.`,
      conversationState: { pendingAction: null, lastAction: state.lastAction },
      executedActions: [],
      suggestions: buildSuggestions({ context, topic: plan.navigationTarget }),
      usedGroq: true,
      ui: { refresh: false, navigateTo: NAV_TARGETS.includes(plan.navigationTarget) ? plan.navigationTarget : null },
    }, language);
  }

  if (plan.mode === 'inform') {
    const topic = plan.infoTopic || inferInfoTopic(text);
    return finalizeResponse({
      reply: plan.reply || answerInfoTopic(topic, context),
      conversationState: { pendingAction: null, lastAction: topic },
      executedActions: [],
      suggestions: buildSuggestions({ context, topic }),
      usedGroq: true,
      ui: {
        refresh: false,
        navigateTo: NAV_TARGETS.includes(plan.navigationTarget) ? plan.navigationTarget : null,
      },
    }, language);
  }

  if (plan.mode === 'smalltalk' || !plan.action) {
    return finalizeResponse({
      reply: plan.reply || describeGeneralCapabilities(),
      conversationState: { pendingAction: null, lastAction: state.lastAction },
      executedActions: [],
      suggestions: buildSuggestions({ context, topic: 'general' }),
      usedGroq: true,
      ui: { refresh: false, navigateTo: null },
    }, language);
  }

  let action = fillPendingAction(plan.action, text);
  action = finalizeActionDraft(action, context);
  action.requiresConfirmation = !!action.requiresConfirmation;

  if (action.missing?.length) {
    return finalizeResponse({
      reply: buildClarification(action, context),
      conversationState: { pendingAction: action, lastAction: state.lastAction },
      executedActions: [],
      suggestions: buildSuggestions({ pendingAction: action, context }),
      usedGroq: true,
      ui: {
        refresh: false,
        navigateTo: NAV_TARGETS.includes(plan.navigationTarget) ? plan.navigationTarget : null,
      },
    }, language);
  }

  if (action.requiresConfirmation) {
    return finalizeResponse({
      reply: buildConfirmation(action, context),
      conversationState: { pendingAction: action, lastAction: state.lastAction },
      executedActions: [],
      suggestions: buildSuggestions({ pendingAction: action, context }),
      usedGroq: true,
      ui: {
        refresh: false,
        navigateTo: NAV_TARGETS.includes(plan.navigationTarget) ? plan.navigationTarget : null,
      },
    }, language);
  }

  const execution = await executeWithFollowUps(worker, action, context);
  context = await buildContext(worker);

  if (!execution.primary?.success && execution.primary?.offerAction) {
    return finalizeResponse({
      reply: execution.primary.summary,
      actionResult: execution.primary,
      executedActions: executedActionSummaries(execution.executedActions),
      conversationState: { pendingAction: execution.primary.offerAction, lastAction: execution.primary.type },
      suggestions: buildSuggestions({ pendingAction: execution.primary.offerAction, context }),
      usedGroq: true,
      ui: combineUi(execution.executedActions, { navigateTo: plan.navigationTarget }),
    }, language);
  }

  const reply = execution.primary?.summary || plan.reply || 'Done.';
  return finalizeResponse({
    reply,
    actionResult: execution.primary,
    executedActions: executedActionSummaries(execution.executedActions),
    conversationState: { pendingAction: null, lastAction: execution.primary?.type || state.lastAction },
    suggestions: buildSuggestions({ actionResult: execution.primary, context, topic: execution.primary?.type }),
    usedGroq: true,
    ui: combineUi(execution.executedActions, { navigateTo: plan.navigationTarget }),
    context: {
      walletBalance: context.wallet.balance,
      activePolicy: context.activePolicy,
    },
  }, language);
}

module.exports = { handleChatMessage };
