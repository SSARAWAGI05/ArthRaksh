/**
 * Parametric trigger engine
 * Polls weather every 10 minutes, auto-creates claims when thresholds crossed.
 */

const cron      = require('node-cron');
const db        = require('../models/db');
const { getWeather } = require('./weather');
const { scoreFraud, calculatePayoutDetails } = require('./ml');
const { notifyWorkerAction } = require('./notifier');
const { createInstantClaimPayout } = require('./payments');

const THRESHOLDS = {
  rain:    { field: 'rainfall_mm_hr',   check: (v) => v >= 15,  label: 'Heavy Rain',    unit: 'mm/hr' },
  aqi:     { field: 'aqi',              check: (v) => v >= 300, label: 'Severe AQI',    unit: ' AQI'  },
  heat:    { field: 'temp_celsius',     check: (v) => v >= 42,  label: 'Extreme Heat',  unit: '°C'    },
  curfew:  { field: 'curfew_active',    check: (v) => v >= 1,   label: 'Curfew/Strike', unit: ''      },
  flood:   { field: 'road_blocked_pct', check: (v) => v >= 70,  label: 'Road Flooding', unit: '%'     },
  cyclone: { field: 'wind_kmh',         check: (v) => v >= 65,  label: 'Cyclone/Gale',  unit: 'km/h'  },
  fog:     { field: 'visibility_m',     check: (v) => v <= 50,  label: 'Dense Fog',     unit: 'm'     },
};

function estimateHours(type, value) {
  // Rough estimate logic (real version would be more sophisticated)
  const base = { rain: 2.5, aqi: 4, heat: 4, curfew: 3, flood: 3, cyclone: 5, fog: 2 }[type] || 2;
  return parseFloat(base.toFixed(1));
}

async function processPayout(claimId) {
  try {
    const current = db.getAllClaims().find(claim => claim.id === claimId);
    if (!current) {
      console.error(`❌ [PAYOUT FAILED] Claim not found: ${claimId}`);
      return;
    }
    if (current.status === 'paid') return;
    const worker = db.findWorkerById(current.workerId);
    if (!worker) {
      console.error(`❌ [PAYOUT FAILED] Worker not found for claim: ${claimId}`);
      return;
    }

    const payoutResult = createInstantClaimPayout({
      claim: current,
      worker,
      amount: current.payoutAmount,
    });

    const claim = db.updateClaim(claimId, {
      status: 'paid',
      paidAt: new Date().toISOString(),
      upiRef: payoutResult.payout.reference,
      payoutGatewayId: payoutResult.gateway.id,
      payoutGatewayLabel: payoutResult.gateway.label,
      payoutTransferId: payoutResult.payout.providerTransferId,
      payoutRail: payoutResult.payout.rail,
    });

    if (claim) {
      db.creditWallet(claim.workerId, claim.payoutAmount, `Auto-payout: ${claim.triggerType} disruption`, {
        method: 'claim_payout',
        claimId: claim.id,
        gatewayId: payoutResult.gateway.id,
        gatewayLabel: payoutResult.gateway.label,
        gatewayProvider: payoutResult.gateway.provider,
        payoutId: payoutResult.payout.id,
        payoutTransferId: payoutResult.payout.providerTransferId,
        ref: payoutResult.payout.reference,
      });
      await notifyWorkerAction({
        workerId: claim.workerId,
        type: 'success',
        inAppMessage: `Automatic payout sent instantly: ₹${claim.payoutAmount} for ${claim.triggerType} via ${payoutResult.gateway.label}.`,
        emailSubject: 'Automatic payout credited',
        emailTitle: 'Payout credited',
        emailIntro: 'A trigger event matched your policy and we paid you automatically.',
        emailLines: [
          `Trigger: ${claim.triggerType}`,
          `Amount: ₹${claim.payoutAmount}`,
          `Gateway: ${payoutResult.gateway.label}`,
          `Reference: ${payoutResult.payout.reference}`,
        ],
        meta: { action: 'auto_payout', claimId: claim.id, ref: payoutResult.payout.reference, gatewayId: payoutResult.gateway.id },
      });
      console.log(`✅ [PAYOUT SUCCESS] claim=${claimId.split('-')[0]} ref=${payoutResult.payout.reference} amount=₹${claim.payoutAmount} gateway=${payoutResult.gateway.id}`);
    } else {
      console.error(`❌ [PAYOUT FAILED] Claim not found: ${claimId}`);
    }
  } catch (err) {
    console.error(`❌ [PAYOUT ERROR] ${err.message}`);
  }
}

async function checkZone(zone) {
  const weather   = await getWeather(zone);
  const triggered = [];

  for (const [type, cfg] of Object.entries(THRESHOLDS)) {
    const val = weather[cfg.field];
    if (val != null && cfg.check(val)) {
      triggered.push({ type, value: val, label: cfg.label, unit: cfg.unit });
    }
  }

  if (!triggered.length) return;

  const event = db.addTriggerEvent({ zoneId: zone.id, zoneName: zone.name, triggers: triggered, weather });
  console.log(`⚡ [${weather.source}] Trigger in ${zone.name}:`, triggered.map(t => t.label).join(', '));

  const active = db.getPolicies().filter(p => p.status === 'active' && p.zoneId === zone.id);

  for (const policy of active) {
    const plan   = db.getPlan(policy.planId);
    const worker = db.findWorkerById(policy.workerId);
    if (!plan || !worker) continue;

    for (const trig of triggered) {
      if (!plan.triggers.includes(trig.type)) continue;

      const hours   = estimateHours(trig.type, trig.value);
      const coveredHours = Math.min(hours, Number(policy.remainingActiveHours ?? policy.coveredActiveHours ?? hours));
      if (coveredHours <= 0) continue;
      const payoutResult = await calculatePayoutDetails(worker, policy, trig.type, coveredHours);
      const payout  = payoutResult.amount;
      if (payout <= 0) continue;

      const gpsMatch     = Math.random() > 0.05;
      const activeStatus = Math.random() > 0.03;

      const fraudScore = await scoreFraud({
        gpsZoneMatch:     gpsMatch,
        wasActive:        activeStatus,
        disruptionHours:  hours,
        payoutAmount:     payout,
        triggerType:      trig.type,
        triggerRainMmHr:  weather.rainfall_mm_hr || 0,
        triggerAqi:       weather.aqi || 100,
        triggerTempC:     weather.temp_celsius || 30,
      }, worker);

      const claim = db.createClaim({
        workerId:       worker.id,
        policyId:       policy.id,
        triggerEventId: event.id,
        triggerType:    trig.type,
        triggerValue:   `${Number(trig.value).toFixed(1)}${trig.unit}`,
        disruptionHours: coveredHours,
        reservedActiveHours: coveredHours,
        payoutAmount:   payout,
        fraudScore,
        status:         fraudScore > 75 ? 'fraud_review' : 'processing',
        statusReason:   fraudScore > 75 ? 'Anomalous activity detected — flagged for audit' : null,
        triggeredAt:    new Date().toISOString(),
        weatherSource:  weather.source,
        weatherSnapshot: weather,
        payoutBreakdown: payoutResult.breakdown,
        gpsZoneMatch: gpsMatch,
        wasActive: activeStatus,
      });
      db.adjustPolicyHours(policy.id, -coveredHours);

      const claimStatus = fraudScore > 75 ? 'fraud review' : 'processing';
      await notifyWorkerAction({
        workerId: worker.id,
        type: fraudScore > 75 ? 'warning' : 'info',
        inAppMessage: fraudScore > 75
          ? `A ${trig.type} disruption matched your policy. Your claim is under fraud review.`
          : `A ${trig.type} disruption matched your policy. Your claim is being processed.`,
        emailSubject: fraudScore > 75 ? 'Claim flagged for review' : 'Automatic claim created',
        emailTitle: fraudScore > 75 ? 'Claim flagged for review' : 'Automatic claim created',
        emailIntro: fraudScore > 75
          ? 'A disruption matched your policy, but the claim needs manual review before payout.'
          : 'A disruption matched your policy and your claim has been created automatically.',
        emailLines: [
          `Trigger: ${trig.label}`,
          `Estimated payout: ₹${payout}`,
          `Protected hours reserved: ${coveredHours}h`,
          `Current claim status: ${claimStatus}`,
        ],
        meta: { action: 'auto_claim_created', claimId: claim.id, policyId: policy.id, triggerType: trig.type },
      });

      // Simulation - Instant Payout
      if (global.SIMULATE_DISRUPTION && fraudScore <= 75) {
        console.log(`🚀 [SIM] Instant payout for ${worker.name}`);
        await processPayout(claim.id);
      } 
      // Real-world - Stochastic Delay
      else if (fraudScore <= 75) {
        const delay = 5000 + Math.random() * 5000;
        setTimeout(() => processPayout(claim.id), delay);
      }

      console.log(`📋 Claim ${claim.id.split('-')[0]} | ${worker.name} | ₹${payout} | fraud=${fraudScore} | src=${weather.source}`);
    }
  }
}

async function runCheck() {
  for (const zone of db.getZones()) await checkZone(zone);
  return db.getRecentTriggers();
}

function start() {
  const { LIVE } = require('./weather');
  console.log(`🔍 [Real-Life Monitor] Active — Source: ${LIVE ? 'OpenWeatherMap' : 'Mock (Demo Only)'}`);
  cron.schedule('*/10 * * * *', async () => {
    console.log(`🔄 Trigger check: ${new Date().toLocaleTimeString()}`);
    await runCheck();
  });
}

module.exports = { start, runCheck };
