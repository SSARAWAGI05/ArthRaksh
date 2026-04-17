const db = require('../models/db');

function round(value, digits = 2) {
  return Number(Number(value || 0).toFixed(digits));
}

function buildProofPack({ claim, worker, policy, zone }) {
  const plan = db.getPlan(policy?.planId);
  const pricing = policy?.pricingBreakdown || null;
  const payoutBreakdown = claim?.payoutBreakdown || null;
  const weather = claim?.weatherSnapshot || null;

  return {
    packetVersion: '1.0',
    generatedAt: new Date().toISOString(),
    claim: {
      id: claim.id,
      status: claim.status,
      triggerType: claim.triggerType,
      triggerValue: claim.triggerValue,
      triggeredAt: claim.triggeredAt,
      disruptionHours: round(claim.disruptionHours, 2),
      payoutAmount: round(claim.payoutAmount, 2),
      fraudScore: claim.fraudScore,
      weatherSource: claim.weatherSource,
      payoutRail: claim.payoutRail || null,
      payoutReference: claim.upiRef || null,
    },
    worker: {
      id: worker?.id,
      name: worker?.name,
      platform: worker?.platform,
      baseHourlyEarning: worker?.baseHourlyEarning,
      zone: zone ? `${zone.name}, ${zone.city}` : null,
    },
    policy: {
      id: policy?.id,
      planId: policy?.planId,
      planName: plan?.name || policy?.planId,
      weeklyPremium: policy?.weeklyPremium,
      maxWeeklyPayout: policy?.maxWeeklyPayout,
      coveredActiveHours: policy?.coveredActiveHours,
      remainingActiveHours: policy?.remainingActiveHours,
    },
    premiumExplanation: pricing?.explanation || null,
    payoutBreakdown,
    weatherSnapshot: weather,
    verification: {
      gpsZoneMatch: claim?.gpsZoneMatch ?? null,
      wasActive: claim?.wasActive ?? null,
      reviewStatus: claim?.statusReason || null,
    },
  };
}

function renderProofPackMarkdown(packet) {
  const lines = [
    `# GigShield Proof Pack`,
    ``,
    `Generated: ${packet.generatedAt}`,
    ``,
    `## Claim`,
    `- Claim ID: ${packet.claim.id}`,
    `- Status: ${packet.claim.status}`,
    `- Trigger: ${packet.claim.triggerType} (${packet.claim.triggerValue})`,
    `- Triggered At: ${packet.claim.triggeredAt}`,
    `- Disruption Hours: ${packet.claim.disruptionHours}`,
    `- Payout Amount: ₹${packet.claim.payoutAmount}`,
    `- Fraud Score: ${packet.claim.fraudScore}`,
    `- Weather Source: ${packet.claim.weatherSource || 'N/A'}`,
    `- Payout Rail: ${packet.claim.payoutRail || 'Pending'}`,
    `- Payout Reference: ${packet.claim.payoutReference || 'Pending'}`,
    ``,
    `## Worker`,
    `- Worker: ${packet.worker.name} (${packet.worker.id})`,
    `- Platform: ${packet.worker.platform}`,
    `- Base Hourly Earning: ₹${packet.worker.baseHourlyEarning}`,
    `- Zone: ${packet.worker.zone}`,
    ``,
    `## Policy`,
    `- Policy ID: ${packet.policy.id}`,
    `- Plan: ${packet.policy.planName}`,
    `- Weekly Premium: ₹${packet.policy.weeklyPremium}`,
    `- Max Weekly Payout: ₹${packet.policy.maxWeeklyPayout}`,
    `- Covered Active Hours: ${packet.policy.coveredActiveHours}`,
    `- Remaining Active Hours: ${packet.policy.remainingActiveHours}`,
    ``,
  ];

  if (packet.premiumExplanation?.summary) {
    lines.push(`## Premium Explanation`);
    lines.push(`- Summary: ${packet.premiumExplanation.summary}`);
    (packet.premiumExplanation.factors || []).forEach(factor => {
      lines.push(`- ${factor.label}: ${factor.description} (impact ${round(factor.impact, 2)})`);
    });
    lines.push(``);
  }

  if (packet.payoutBreakdown) {
    lines.push(`## Payout Explanation`);
    lines.push(`- Formula: ${packet.payoutBreakdown.formula}`);
    lines.push(`- Base Hourly Earning: ₹${packet.payoutBreakdown.baseHourlyEarning}`);
    lines.push(`- Disruption Hours: ${packet.payoutBreakdown.disruptionHours}`);
    lines.push(`- Gross Earnings at Risk: ₹${packet.payoutBreakdown.grossEarnings}`);
    lines.push(`- Trigger Multiplier: ${packet.payoutBreakdown.triggerMultiplier}`);
    lines.push(`- Modelled Impact: ₹${packet.payoutBreakdown.modeledImpact}`);
    lines.push(`- Weekly Payout Cap: ₹${packet.payoutBreakdown.weeklyPayoutCap}`);
    lines.push(`- Final Amount: ₹${packet.payoutBreakdown.finalAmount}`);
    lines.push(`- Narrative: ${packet.payoutBreakdown.explanation}`);
    lines.push(``);
  }

  if (packet.weatherSnapshot) {
    lines.push(`## Weather Snapshot`);
    Object.entries(packet.weatherSnapshot).forEach(([key, value]) => {
      lines.push(`- ${key}: ${value}`);
    });
    lines.push(``);
  }

  lines.push(`## Verification`);
  lines.push(`- GPS Zone Match: ${packet.verification.gpsZoneMatch}`);
  lines.push(`- Platform Activity Verified: ${packet.verification.wasActive}`);
  lines.push(`- Review Status: ${packet.verification.reviewStatus || 'None'}`);

  return lines.join('\n');
}

module.exports = {
  buildProofPack,
  renderProofPackMarkdown,
};
