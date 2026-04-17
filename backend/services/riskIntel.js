const db = require('../models/db');

function clamp(value, min = 0, max = 1) {
  return Math.max(min, Math.min(max, value));
}

function round(value, digits = 2) {
  return Number(Number(value || 0).toFixed(digits));
}

function hashSeed(...parts) {
  const text = parts.join('|');
  let hash = 0;
  for (let i = 0; i < text.length; i += 1) {
    hash = ((hash << 5) - hash) + text.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

function seededUnit(...parts) {
  const seed = hashSeed(...parts);
  return (seed % 1000) / 1000;
}

function levelForScore(score) {
  if (score >= 0.7) return { level: 'high', label: 'High Risk', calendarLabel: 'Red', color: '#ef4444' };
  if (score >= 0.4) return { level: 'moderate', label: 'Moderate Risk', calendarLabel: 'Yellow', color: '#f59e0b' };
  return { level: 'safe', label: 'Safe', calendarLabel: 'Green', color: '#22c55e' };
}

function normalizeMapPosition(value, min, max, padding = 8) {
  const span = Math.max(max - min, 0.0001);
  const rawPercent = ((value - min) / span) * 100;
  const usableRange = 100 - (padding * 2);
  return round(padding + ((rawPercent / 100) * usableRange), 1);
}

function cityAirBase(city = '') {
  return ({
    Delhi: 0.7,
    Gurgaon: 0.68,
    Noida: 0.66,
    Kolkata: 0.58,
    Mumbai: 0.4,
    Chennai: 0.35,
    Bengaluru: 0.33,
    Hyderabad: 0.34,
    Pune: 0.31,
    Ahmedabad: 0.46,
    Lucknow: 0.55,
    Jaipur: 0.43,
  }[city] ?? 0.4);
}

function getRiskCalendar(zone, days = 7, fromDate = new Date()) {
  const baseRisk = zone?.riskScore ?? 0.6;
  const floodBoost = zone?.floodProne ? 0.12 : 0;
  const month = fromDate.getMonth();
  const monsoonBoost = [5, 6, 7, 8].includes(month) ? 0.16 : 0.03;
  const heatSeasonBoost = [2, 3, 4, 5].includes(month) ? 0.22 : 0.06;

  return Array.from({ length: days }, (_, index) => {
    const day = new Date(fromDate);
    day.setDate(fromDate.getDate() + index);
    const daySeed = seededUnit(zone?.id || 'zone', day.toISOString().slice(0, 10));
    const weekendBoost = [0, 6].includes(day.getDay()) ? 0.03 : 0;

    const rainRisk = clamp(baseRisk * 0.6 + monsoonBoost + floodBoost + (daySeed * 0.22) + weekendBoost);
    const heatRisk = clamp(baseRisk * 0.25 + heatSeasonBoost + ((1 - daySeed) * 0.16));
    const aqiRisk = clamp(cityAirBase(zone?.city) + (daySeed * 0.18) + (zone?.floodProne ? 0.03 : 0));
    const overallScore = clamp((rainRisk * 0.42) + (aqiRisk * 0.33) + (heatRisk * 0.25));
    const level = levelForScore(overallScore);

    const drivers = [
      { key: 'rain', label: 'rain', score: rainRisk },
      { key: 'aqi', label: 'AQI', score: aqiRisk },
      { key: 'heat', label: 'heat', score: heatRisk },
    ]
      .sort((a, b) => b.score - a.score)
      .slice(0, 2);

    return {
      date: day.toISOString().slice(0, 10),
      weekday: day.toLocaleDateString('en-IN', { weekday: 'short' }),
      dayLabel: day.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }),
      overallScore: round(overallScore, 2),
      overallRisk: level.level,
      overallLabel: level.label,
      calendarColor: level.calendarLabel,
      color: level.color,
      rainRisk: round(rainRisk, 2),
      aqiRisk: round(aqiRisk, 2),
      heatRisk: round(heatRisk, 2),
      dominantDrivers: drivers,
      recommendation: level.level === 'high'
        ? `Expect pressure from ${drivers.map(driver => driver.label).join(' and ')}. Stay covered before peak hours.`
        : level.level === 'moderate'
          ? `Some disruption risk from ${drivers.map(driver => driver.label).join(' and ')}. A weekly shield is recommended.`
          : 'Conditions look stable. Basic protection should be enough.',
    };
  });
}

function getShiftForecast(worker, zone, plans, calendar = getRiskCalendar(zone)) {
  const hours = 6;
  const now = new Date();
  const today = calendar[0];
  const baseHourly = Number(worker?.baseHourlyEarning || 80);

  const dominantTriggers = [
    { type: 'rain', score: today?.rainRisk ?? 0.3 },
    { type: 'aqi', score: today?.aqiRisk ?? 0.3 },
    { type: 'heat', score: today?.heatRisk ?? 0.3 },
  ]
    .filter(item => item.score >= 0.32)
    .sort((a, b) => b.score - a.score);

  const hourly = Array.from({ length: hours }, (_, index) => {
    const slot = new Date(now);
    slot.setHours(now.getHours() + index, 0, 0, 0);
    const hourSeed = seededUnit(zone?.id || 'zone', slot.toISOString(), worker?.id || 'worker');
    const score = clamp((today?.overallScore ?? 0.4) + ((hourSeed - 0.5) * 0.18));
    const level = levelForScore(score);
    return {
      hour: slot.toLocaleTimeString('en-IN', { hour: 'numeric' }),
      score: round(score, 2),
      level: level.level,
      color: level.color,
      label: level.label,
    };
  });

  const avgScore = round(hourly.reduce((sum, item) => sum + item.score, 0) / Math.max(hourly.length, 1), 2);
  const protectedEarnings = Math.round(baseHourly * hours * clamp(0.35 + (avgScore * 0.55), 0.35, 0.9));
  const riskLevel = levelForScore(avgScore);
  const requiredTriggers = dominantTriggers.length ? dominantTriggers.map(item => item.type) : ['rain', 'aqi'];
  const recommendedPlan = [...plans]
    .sort((a, b) => a.baseWeeklyPremium - b.baseWeeklyPremium)
    .find(plan => requiredTriggers.every(trigger => plan.triggers.includes(trigger))) || [...plans].sort((a, b) => a.baseWeeklyPremium - b.baseWeeklyPremium)[0];

  return {
    hours,
    forecastRisk: riskLevel.level,
    forecastLabel: riskLevel.label,
    color: riskLevel.color,
    earningsAtRisk: protectedEarnings,
    baseShiftEarnings: baseHourly * hours,
    dominantTriggers,
    hourly,
    recommendation: recommendedPlan ? {
      planId: recommendedPlan.id,
      planName: recommendedPlan.name,
      why: `Cheapest adequate weekly plan covering ${requiredTriggers.join(', ')} risk for the next ${hours} hours.`,
    } : null,
    message: riskLevel.level === 'high'
      ? `Your next ${hours}-hour shift looks exposed. Activate cover before you head out.`
      : riskLevel.level === 'moderate'
        ? `Conditions are mixed for the next ${hours} hours. A weekly plan keeps the shift protected.`
        : `Your next ${hours}-hour shift looks relatively stable, but basic weekly protection is still available.`,
  };
}

function getZonePulse(zones = db.getZones(), claims = db.getAllClaims(), policies = db.getPolicies()) {
  const claimZoneMap = {};

  claims.forEach(claim => {
    const policy = db.getPolicyById(claim.policyId);
    const zoneId = policy?.zoneId;
    if (!zoneId) return;
    if (!claimZoneMap[zoneId]) {
      claimZoneMap[zoneId] = { totalClaims: 0, paidOut: 0, paidClaims: 0 };
    }
    claimZoneMap[zoneId].totalClaims += 1;
    if (claim.status === 'paid') {
      claimZoneMap[zoneId].paidClaims += 1;
      claimZoneMap[zoneId].paidOut += Number(claim.payoutAmount || 0);
    }
  });

  const cityBounds = zones.reduce((acc, zone) => {
    if (!acc[zone.city]) {
      acc[zone.city] = {
        minLat: zone.lat,
        maxLat: zone.lat,
        minLon: zone.lon,
        maxLon: zone.lon,
      };
      return acc;
    }

    acc[zone.city].minLat = Math.min(acc[zone.city].minLat, zone.lat);
    acc[zone.city].maxLat = Math.max(acc[zone.city].maxLat, zone.lat);
    acc[zone.city].minLon = Math.min(acc[zone.city].minLon, zone.lon);
    acc[zone.city].maxLon = Math.max(acc[zone.city].maxLon, zone.lon);
    return acc;
  }, {});

  const ranked = zones.map(zone => {
    const bounds = cityBounds[zone.city] || {
      minLat: zone.lat,
      maxLat: zone.lat,
      minLon: zone.lon,
      maxLon: zone.lon,
    };
    const zoneClaims = claimZoneMap[zone.id] || { totalClaims: 0, paidOut: 0, paidClaims: 0 };
    const activePolicies = policies.filter(policy => policy.zoneId === zone.id && policy.status === 'active').length;
    const claimFrequency = round(zoneClaims.totalClaims / Math.max(activePolicies, 1), 2);
    const payoutIntensity = round(zoneClaims.paidOut / Math.max(activePolicies, 1), 0);
    const pulseScore = clamp(
      (zone.riskScore * 0.5) +
      (Math.min(zoneClaims.totalClaims / 10, 1) * 0.25) +
      (Math.min(zoneClaims.paidOut / 5000, 1) * 0.25)
    );
    const level = levelForScore(pulseScore);

    return {
      ...zone,
      totalClaims: zoneClaims.totalClaims,
      paidClaims: zoneClaims.paidClaims,
      paidOut: Math.round(zoneClaims.paidOut),
      activePolicies,
      claimFrequency,
      payoutIntensity,
      pulseScore: round(pulseScore, 2),
      pulseLabel: level.label,
      pulseLevel: level.level,
      color: level.color,
      mapX: normalizeMapPosition(zone.lon, bounds.minLon, bounds.maxLon),
      mapY: normalizeMapPosition(bounds.maxLat - zone.lat, 0, bounds.maxLat - bounds.minLat),
    };
  }).sort((a, b) => b.pulseScore - a.pulseScore);

  ranked.forEach((zone, index) => {
    zone.rank = index + 1;
  });

  const byCity = ranked.reduce((acc, zone) => {
    acc[zone.city] = acc[zone.city] || [];
    acc[zone.city].push(zone);
    return acc;
  }, {});

  return {
    updatedAt: new Date().toISOString(),
    ranked,
    byCity,
  };
}

module.exports = {
  clamp,
  levelForScore,
  getRiskCalendar,
  getShiftForecast,
  getZonePulse,
};
