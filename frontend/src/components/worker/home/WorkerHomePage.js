import React from 'react';

function LocationSyncBanner({ nearZone, onSwitchZone }) {
  if (!nearZone) return null;
  return (
    <div className="location-tip">
      <div className="tip-text">📍 Movement detected! You are near <strong>{nearZone.name}</strong>.<br/>Sync coverage with your current location?</div>
      <button className="tip-btn" onClick={onSwitchZone}>Sync Now</button>
    </div>
  );
}

function NotificationsBanner({ notifications, onDismiss }) {
  if (!notifications?.length) return null;
  return (
    <div className="notifications-banner" onClick={onDismiss} style={{ cursor: 'pointer' }}>
      {notifications.map(notification => (
        <div
          key={notification.id}
          className={`notif-item ${notification.type}`}
          style={{
            padding: '12px',
            marginBottom: '8px',
            background: 'var(--bg2)',
            borderRadius: '8px',
            borderLeft: notification.type === 'error'
              ? '4px solid #ef4444'
              : notification.type === 'success'
                ? '4px solid #22c55e'
                : '4px solid #f59e0b',
            fontSize: 13,
          }}
        >
          <strong>{notification.type.toUpperCase()}:</strong> {notification.message}
        </div>
      ))}
      <div style={{ fontSize: 11, textAlign: 'right', margin: '-4px 8px 0 0', color: 'var(--text2)' }}>Click to dismiss</div>
    </div>
  );
}

function HomeSectionHeader({ eyebrow, title, subtitle }) {
  return (
    <div className="home-section-head">
      <span>{eyebrow}</span>
      {title ? <strong>{title}</strong> : null}
      {subtitle ? <p>{subtitle}</p> : null}
    </div>
  );
}

function HomeHero({
  policy,
  protectedAmount,
  remainingHours,
  zoneName,
  cycleEnds,
  Icon,
  fmt,
}) {
  return (
    <div className="hero home-hero">
      <div className="home-hero-glow home-hero-glow-one" />
      <div className="home-hero-glow home-hero-glow-two" />
      <div className="hero-content home-hero-content">
        <div className="home-hero-copy">
          <div className={`hero-badge ${policy ? 'active' : 'inactive'}`}>
            <Icon name="shield" size={12} />
            {policy ? 'Current policy is active' : 'No active policy'}
          </div>
          <div className="home-hero-eyebrow">
            Command Centre
          </div>
          <div className="home-hero-policy-name">
            {policy?.plan?.name || 'No active policy'}
          </div>
          <div className="home-hero-policy-meta">
            <span>Max weekly payout</span>
            <strong>{policy ? fmt(protectedAmount) : '—'}</strong>
          </div>
          <div className="hero-label">
            {policy
              ? `${policy.plan?.name || 'Your active plan'} is the policy currently running for ${zoneName || 'your zone'}.`
              : 'No policy is currently running. Activate a plan to see live policy details here.'}
          </div>
          <div className="hero-pills">
            <span className="pill">{policy?.plan?.name || 'No active plan'}</span>
            <span className="pill-dot" />
            <span className="pill">{zoneName || 'Zone not set'}</span>
            <span className="pill-dot" />
            <span className="pill">{policy ? `${remainingHours}h left` : 'Activate protection'}</span>
          </div>
        </div>

        <div className="home-hero-rail">
          <div className="home-hero-stat">
            <span>Current policy</span>
            <strong>{policy?.plan?.name || 'No active policy'}</strong>
          </div>
          <div className="home-hero-stat">
            <span>Status</span>
            <strong>{policy ? 'Active' : 'Inactive'}</strong>
          </div>
          <div className="home-hero-stat">
            <span>Hours left</span>
            <strong>{policy ? `${remainingHours}h` : '—'}</strong>
          </div>
          <div className="home-hero-stat">
            <span>Cycle ends</span>
            <strong>{cycleEnds}</strong>
          </div>
        </div>
      </div>
    </div>
  );
}

function QuickActionRail({ actions, Icon }) {
  return (
    <div className="quick-action-rail">
      {actions.map(action => (
        <button key={action.label} className={`quick-action-card ${action.tone || ''}`.trim()} onClick={action.onClick}>
          <div className="quick-action-top">
            <div className="quick-action-icon"><Icon name={action.icon} size={16} /></div>
            <Icon name="arrow" size={14} />
          </div>
          <strong>{action.label}</strong>
          <span>{action.copy}</span>
        </button>
      ))}
    </div>
  );
}

function HomeSpotlightStrip({ items, Icon }) {
  return (
    <div className="home-spotlight-strip">
      {items.map(item => (
        <div key={item.label} className={`home-spotlight-card ${item.tone || ''}`.trim()}>
          <div className="home-spotlight-icon"><Icon name={item.icon} size={16} /></div>
          <div className="home-spotlight-copy">
            <span>{item.label}</span>
            <strong>{item.value}</strong>
            <p>{item.copy}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

function HomeCyclePanel({ policy, remainingHours, cycleEnds, weeklyProtected, latestClaim, zoneName, Icon, fmt }) {
  return (
    <div className="home-cycle-panel">
      <div className="home-cycle-head">
        <div>
          <div className="home-cycle-label">Weekly cycle narrative</div>
          <strong>{policy ? 'Your protection story for this week' : 'A better home screen, even before activation'}</strong>
        </div>
        <div className={`home-cycle-status ${policy ? 'active' : 'inactive'}`}>
          <Icon name={policy ? 'check' : 'clock'} size={14} />
          <span>{policy ? 'Live' : 'Standby'}</span>
        </div>
      </div>

      <div className="home-cycle-stack">
          <div className="home-cycle-card highlight">
            <span>Hours left this week</span>
            <strong>{policy ? `${remainingHours}h` : 'Choose a plan'}</strong>
            <p>{policy ? `Cycle ends ${cycleEnds}` : 'Protection starts the moment a weekly bundle is activated.'}</p>
          </div>
        <div className="home-cycle-grid">
          <div className="home-cycle-card">
            <span>Protected this week</span>
            <strong>{fmt(weeklyProtected)}</strong>
          </div>
          <div className="home-cycle-card">
            <span>Zone</span>
            <strong>{zoneName || 'Not set'}</strong>
          </div>
          <div className="home-cycle-card">
            <span>Latest claim</span>
            <strong>{latestClaim ? fmt(latestClaim.payoutAmount) : 'No payout'}</strong>
          </div>
          <div className="home-cycle-card">
            <span>Claim status</span>
            <strong>{latestClaim ? latestClaim.status?.replace('_', ' ') : 'Ready'}</strong>
          </div>
        </div>
      </div>
    </div>
  );
}

function PreviewCard({ icon, title, subtitle, stats = [], cta, onClick, tone = 'default', className = '', Icon }) {
  return (
    <button className={`preview-card home-preview-card ${tone} ${className}`.trim()} onClick={onClick}>
      <div className="preview-card-top">
        <div className="preview-card-icon"><Icon name={icon} size={16} /></div>
        <div className="preview-card-cta">
          <span>{cta}</span>
          <Icon name="arrow" size={14} />
        </div>
      </div>
      <div className="preview-card-title">{title}</div>
      <div className="preview-card-sub">{subtitle}</div>
      <div className="preview-card-stats">
        {stats.map((item, index) => (
          <div key={`${item.label}-${index}`} className="preview-stat">
            <span>{item.label}</span>
            <strong>{item.value}</strong>
          </div>
        ))}
      </div>
    </button>
  );
}

function HomePreviewGrid({ cards }) {
  return (
    <div className="preview-grid home-preview-grid">
      {cards.map(card => (
        <PreviewCard key={card.title} {...card} />
      ))}
    </div>
  );
}

export default function WorkerHomePage({
  data,
  nearZone,
  onSwitchZone,
  onDismissNotifications,
  ui,
}) {
  const {
    policy,
    stats,
    recentClaims,
    worker,
    walletBalance,
    notifications,
    shiftShield,
    liveWeather,
    alerts,
  } = data;

  const protectedAmount = policy?.maxWeeklyPayout ?? 0;
  const remainingHours = policy?.remainingActiveHours || 0;
  const zone = policy?.zone || worker?.zone;
  const latestClaim = recentClaims?.[0];
  const cycleEnds = policy?.endDate ? ui.fmtDate(policy.endDate) : 'No active cycle';
  const zoneName = zone?.name || 'No zone';
  const weatherSummary = liveWeather ? `${liveWeather.temp_celsius}°C • AQI ${liveWeather.aqi}` : 'Weather feed syncing';
  const shiftRisk = shiftShield?.forecastLabel || 'Steady';
  const earningsAtRisk = shiftShield?.earningsAtRisk ? ui.fmt(shiftShield.earningsAtRisk) : 'Low';

  const previewCards = [
    {
      icon: 'zap',
      title: 'Risk Center',
      subtitle: 'Live weather, alerts, ShiftShield forecasts, and the full zone pulse in one place.',
      cta: 'Open risk center',
      tone: 'accent',
      onClick: () => ui.nav('intel'),
      Icon: ui.Icon,
      stats: [
        { label: 'Alerts', value: String(alerts?.length || 0) },
        { label: 'Shift risk', value: shiftShield?.forecastLabel || '—' },
        { label: 'Weather', value: liveWeather ? `${liveWeather.temp_celsius}°C` : '—' },
      ],
    },
    {
      icon: 'shield',
      title: 'Manage Plan',
      subtitle: 'Compare active-hour bundles, manage your weekly cycle, and top up hours when needed.',
      cta: policy ? 'Manage plan' : 'Browse plans',
      onClick: () => ui.nav('plans'),
      Icon: ui.Icon,
      stats: [
        { label: 'Status', value: policy ? 'Active' : 'Inactive' },
        { label: 'Plan', value: policy?.plan?.name || 'None' },
        { label: 'Protected', value: ui.fmt(protectedAmount) },
      ],
    },
    {
      icon: 'file',
      title: 'Claims',
      subtitle: 'Track payouts, proof packs, and manual claim actions in the full claims workspace.',
      cta: 'Open claims',
      onClick: () => ui.nav('claims'),
      Icon: ui.Icon,
      stats: [
        { label: 'Paid claims', value: String(stats.paidClaims) },
        { label: 'Total claims', value: String(stats.totalClaims) },
        { label: 'Latest payout', value: latestClaim ? ui.fmt(latestClaim.payoutAmount) : '—' },
      ],
    },
    {
      icon: 'wallet',
      title: 'Wallet',
      subtitle: 'Add funds, withdraw, and track how premiums and payouts move through your wallet.',
      cta: 'Open wallet',
      onClick: () => ui.nav('wallet'),
      Icon: ui.Icon,
      stats: [
        { label: 'Balance', value: ui.fmt(walletBalance ?? 0) },
        { label: 'Protected this week', value: ui.fmt(stats.weeklyProtected) },
        { label: 'Zone', value: zoneName },
      ],
    },
    {
      icon: 'user',
      title: 'Profile',
      subtitle: 'Keep your zone, alert email, and worker context synced for smarter protection.',
      cta: 'Open profile',
      onClick: () => ui.nav('profile'),
      Icon: ui.Icon,
      stats: [
        { label: 'Partner', value: worker?.platform || '—' },
        { label: 'Zone', value: zoneName },
        { label: 'Email', value: worker?.email ? 'Set' : 'Missing' },
      ],
    },
    {
      icon: 'clock',
      title: 'Weekly Cycle',
      subtitle: 'A quick snapshot of the current protection week so Home feels complete and balanced.',
      cta: policy ? 'Review cycle' : 'Get protected',
      onClick: () => ui.nav(policy ? 'plans' : 'plans'),
      Icon: ui.Icon,
      stats: [
        { label: 'Cycle ends', value: cycleEnds },
        { label: 'Hours left', value: policy ? `${remainingHours}h` : '—' },
        { label: 'Latest claim', value: latestClaim ? latestClaim.status?.replace('_', ' ') : 'None' },
      ],
    },
  ];

  const quickActions = [
    {
      icon: 'shield',
      label: policy ? 'Manage plan' : 'Get covered',
      copy: policy ? 'Adjust your cover, top up hours, and review bundle details.' : 'Start a weekly shield and turn this dashboard fully live.',
      onClick: () => ui.nav('plans'),
    },
    {
      icon: 'zap',
      label: 'Open risk center',
      copy: 'See weather, alerts, and ShiftShield predictions for your zone.',
      onClick: () => ui.nav('intel'),
    },
    {
      icon: 'wallet',
      label: 'Review wallet',
      copy: 'Track balance, payout movement, and funding actions.',
      onClick: () => ui.nav('wallet'),
    },
    {
      icon: 'file',
      label: 'Check claims',
      copy: 'Watch the latest claim activity and proof pack progress.',
      onClick: () => ui.nav('claims'),
    },
  ];

  const spotlightItems = [
    {
      icon: 'shield',
      label: 'Protection state',
      value: policy ? 'Protected' : 'Inactive',
      copy: policy ? `${policy.plan?.name || 'Active plan'} is covering the current week.` : 'You can activate protection before the next risky shift.',
      tone: policy ? 'success' : 'warning',
    },
    {
      icon: 'clock',
      label: 'Weekly cycle',
      value: policy ? `${remainingHours}h left` : 'Not started',
      copy: policy ? `Current cycle ends ${cycleEnds}.` : 'No active weekly cycle is running yet.',
    },
    {
      icon: 'wallet',
      label: 'Latest payout',
      value: latestClaim ? ui.fmt(latestClaim.payoutAmount) : '—',
      copy: latestClaim ? `Most recent claim is ${latestClaim.status?.replace('_', ' ')}.` : 'Your first approved payout will show up here.',
    },
    {
      icon: 'zap',
      label: 'Zone pulse',
      value: shiftRisk,
      copy: `${zoneName} • ${alerts?.length || 0} alerts • ${weatherSummary}`,
    },
  ];

  return (
    <div className="screen worker-home-screen">
      <LocationSyncBanner nearZone={nearZone} onSwitchZone={onSwitchZone} />
      <NotificationsBanner notifications={notifications} onDismiss={onDismissNotifications} />

      <QuickActionRail actions={quickActions} Icon={ui.Icon} />

      <div className="home-command-grid">
        <HomeHero
          policy={policy}
          protectedAmount={protectedAmount}
          remainingHours={remainingHours}
          zoneName={zoneName}
          cycleEnds={cycleEnds}
          Icon={ui.Icon}
          fmt={ui.fmt}
        />
        <HomeCyclePanel
          policy={policy}
          remainingHours={remainingHours}
          cycleEnds={cycleEnds}
          weeklyProtected={stats.weeklyProtected}
          latestClaim={latestClaim}
          zoneName={zoneName}
          Icon={ui.Icon}
          fmt={ui.fmt}
        />
      </div>

      <HomeSpotlightStrip items={spotlightItems} Icon={ui.Icon} />

      <div className="home-metric-shell">
        <HomeSectionHeader
          eyebrow="Performance snapshot"
          title="Everything that matters this week"
          subtitle="Protection, payouts, earnings context, and live risk are now grouped with stronger visual hierarchy."
        />
        <ui.MetricBoard
          items={[
            { icon: 'rupee', label: 'Protected this week', value: ui.fmt(stats.weeklyProtected), copy: `${stats.protectionRate}% protection rate` },
            { icon: 'check', label: 'Paid claims', value: String(stats.paidClaims), copy: `${stats.totalClaims} total claims processed` },
            { icon: 'chart', label: 'Estimated weekly earnings', value: ui.fmt(stats.estimatedWeeklyEarnings), copy: 'Used to size protection and payouts' },
            { icon: 'zap', label: 'Current shift risk', value: shiftShield?.forecastLabel || 'No forecast', copy: shiftShield?.earningsAtRisk ? `${ui.fmt(shiftShield.earningsAtRisk)} earnings at risk` : 'Open Risk Center for detail' },
          ]}
        />
      </div>

      <div className="home-preview-shell">
        <HomeSectionHeader
          eyebrow="Workspace shortcuts"
        />
        <HomePreviewGrid cards={previewCards} />
      </div>
    </div>
  );
}
