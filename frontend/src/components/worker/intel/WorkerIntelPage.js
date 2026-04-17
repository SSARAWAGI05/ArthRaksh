import React from 'react';

function IntelHero({ zone, liveWeather, alerts, shiftShield, PageIntro, fmt }) {
  const meta = [
    { icon: 'clock', label: 'Zone', value: zone?.name || 'Not synced' },
    { icon: 'alert', label: 'Live alerts', value: String(alerts?.length || 0) },
    { icon: 'zap', label: 'Shift risk', value: shiftShield?.forecastLabel || 'No forecast' },
  ];

  return (
    <PageIntro
      eyebrow="Risk Center"
      title="Detailed live conditions, forecasts, and zone intelligence"
      meta={meta}
      actions={
        <div className="intel-summary-chip">
          <strong>{liveWeather ? `${liveWeather.temp_celsius}°C` : '—'}</strong>
          <span>{liveWeather ? `AQI ${liveWeather.aqi}` : 'Weather pending'}</span>
          {shiftShield?.earningsAtRisk ? <span>{fmt(shiftShield.earningsAtRisk)} at risk</span> : null}
        </div>
      }
    />
  );
}

export default function WorkerIntelPage({
  data,
  activatingShift,
  onActivateShift,
  ui,
}) {
  const {
    policy,
    liveWeather,
    alerts,
    riskCalendar,
    shiftShield,
    zonePulse,
    activePremiumExplanation,
    worker,
  } = data;
  const zone = policy?.zone || worker?.zone;

  return (
    <div className="screen">
      <IntelHero
        zone={zone}
        liveWeather={liveWeather}
        alerts={alerts}
        shiftShield={shiftShield}
        PageIntro={ui.PageIntro}
        fmt={ui.fmt}
      />

      <ui.WeatherRadar weather={liveWeather} zone={zone} />
      <ui.LiveAlerts alerts={alerts} />

      <div className="section">
        <div className="section-label">Short-term disruption decision</div>
      </div>

      <ui.ShiftShieldCard shift={shiftShield} onActivate={onActivateShift} activating={activatingShift} policy={policy} />
      <ui.RiskCalendar calendar={riskCalendar} />

      {policy?.plan && activePremiumExplanation && (
        <div className="section">
          <div className="section-label">Pricing context for your active cover</div>
          <ui.PriceInsight plan={policy.plan} pricing={activePremiumExplanation} />
        </div>
      )}

      <ui.ZonePulsePanel
        pulse={zonePulse}
        title={`Zone Pulse${zonePulse?.city ? ` · ${zonePulse.city}` : ''}`}
        subtitle="Full city-level neighborhood ranking by disruption risk, claim frequency, and payout intensity."
      />
    </div>
  );
}
