import React, { useState, useEffect, useCallback, useRef } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { authAPI, policyAPI, claimsAPI, dashAPI, triggerAPI, workerAPI, walletAPI, chatbotAPI } from './utils/api';
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { Chart, ArcElement, DoughnutController, BarController, LineController, CategoryScale, LinearScale, BarElement, PointElement, LineElement, Filler, Tooltip as ChartTooltip, Legend } from 'chart.js';
import WorkerHomePage from './components/worker/home/WorkerHomePage';
import WorkerIntelPage from './components/worker/intel/WorkerIntelPage';
import './App.css';

Chart.register(ArcElement, DoughnutController, BarController, LineController, CategoryScale, LinearScale, BarElement, PointElement, LineElement, Filler, ChartTooltip, Legend);

// ─── Icons ───────────────────────────────────────────────────────────────────
// ─── Icons ───────────────────────────────────────────────────────────────────
function Icon({ name, size = 20, className = "" }) {
  const d = {
    shield:  <path d="M12 2L4 6v6c0 5.25 3.5 10.15 8 11.35C16.5 22.15 20 17.25 20 12V6L12 2z"/>,
    home:    <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/>,
    file:    <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8L14 2zm0 0v6h6"/>,
    user:    <><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></>,
    rupee:   <path d="M6 3h12M6 8h12M15 21L6 8h3a4 4 0 000-8"/>,
    check:   <polyline points="20 6 9 17 4 12"/>,
    x:       <><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></>,
    alert:   <><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></>,
    zap:     <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>,
    logout:  <><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></>,
    chart:   <><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></>,
    grid:    <><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></>,
    refresh: <><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 11-2.12-9.36L23 10"/></>,
    play:    <><polygon points="8 5 19 12 8 19 8 5"/></>,
    clock:   <><circle cx="12" cy="12" r="9"/><polyline points="12 7 12 12 15 15"/></>,
    mic:     <><path d="M12 3a3 3 0 013 3v6a3 3 0 01-6 0V6a3 3 0 013-3z"/><path d="M19 11a7 7 0 01-14 0"/><line x1="12" y1="18" x2="12" y2="22"/><line x1="8" y1="22" x2="16" y2="22"/></>,
    wallet:  <><rect x="1" y="4" width="22" height="16" rx="2" ry="2"/><line x1="1" y1="10" x2="23" y2="10"/></>,
    plus:    <><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></>,
    arrow:   <><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></>,
    download:<><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></>,
    credit:  <><rect x="1" y="4" width="22" height="16" rx="2"/><line x1="1" y1="10" x2="23" y2="10"/></>,
    send:    <><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></>,
    lock:    <><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></>,
    phone:   <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013.07 9.81a19.79 19.79 0 01-3.07-8.63A2 2 0 012 .18h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L6.09 7.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z"/>,
  };
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
         stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" 
         className={`gs-icon ${className}`} style={{ minWidth: size, minHeight: size }}>
      {d[name]}
    </svg>
  );
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
const fmt      = n  => `₹${(n || 0).toLocaleString('en-IN')}`;
const fmtDate  = d  => d ? new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : '—';
const fmtTime  = d  => d ? new Date(d).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : '';
const statusColor = s => ({ paid: '#22c55e', processing: '#3b82f6', fraud_review: '#ef4444', rejected: '#6b7280' }[s] ?? '#6b7280');
const trigIcon    = t => ({ rain: '🌧️', aqi: '😷', heat: '🌡️', curfew: '🚫', flood: '🌊', cyclone: '🌪️', fog: '🌫️', manual: '📝' }[t] ?? '⚡');
const triggerLabel = t => ({
  rain: 'Heavy Rain',
  aqi: 'Air Quality',
  heat: 'Heat Stress',
  curfew: 'Curfew',
  flood: 'Flooding',
  cyclone: 'Cyclone',
  fog: 'Low Visibility',
  manual: 'Manual Review',
}[t] ?? 'Disruption');
const triggerTone = t => ({
  rain: 'rain',
  aqi: 'aqi',
  heat: 'heat',
  curfew: 'curfew',
  flood: 'flood',
  cyclone: 'cyclone',
  fog: 'fog',
  manual: 'default',
}[t] ?? 'default');
const nav         = page => window.dispatchEvent(new CustomEvent('gs:nav', { detail: page }));
const railLabel   = item => item?.payoutGatewayLabel || item?.gatewayLabel || item?.gatewayProvider || '';
const firstName   = name => String(name || '').trim().split(/\s+/)[0] || 'Partner';
const assistantLanguages = [
  { id: 'English', label: 'English' },
  { id: 'Hindi', label: 'Hindi' },
  { id: 'Bengali', label: 'Bengali' },
  { id: 'Tamil', label: 'Tamil' },
  { id: 'Marathi', label: 'Marathi' },
];

const ZONES_FB = [
  { id: 'z1', name: 'Andheri West',  city: 'Mumbai' },
  { id: 'z2', name: 'Kurla',          city: 'Mumbai' },
  { id: 'z3', name: 'Bandra',         city: 'Mumbai' },
  { id: 'z4', name: 'Powai',          city: 'Mumbai' },
  { id: 'z5', name: 'Dwarka',         city: 'Delhi'  },
  { id: 'z6', name: 'Lajpat Nagar',   city: 'Delhi'  },
  { id: 'z7', name: 'Rohini',         city: 'Delhi'  },
  { id: 'z8', name: 'Cyber City',     city: 'Gurgaon' },
  { id: 'z10', name: 'Koramangala',   city: 'Bengaluru' },
  { id: 'z14', name: 'T Nagar',       city: 'Chennai' },
  { id: 'z17', name: 'Hitech City',   city: 'Hyderabad' },
  { id: 'z20', name: 'Hinjewadi',     city: 'Pune' },
  { id: 'z23', name: 'Salt Lake',     city: 'Kolkata' },
];

// ─── Toast ────────────────────────────────────────────────────────────────────
let _toast = null;
const toast = (msg, type = 'success') => _toast?.({ msg, type });

function Toast() {
  const [t, setT] = useState(null);
  _toast = setT;
  useEffect(() => { if (t) { const id = setTimeout(() => setT(null), 3500); return () => clearTimeout(id); } }, [t]);
  if (!t) return null;
  return (
    <div className={`toast ${t.type}`}>
      <Icon name={t.type === 'success' ? 'check' : 'alert'} size={15} />
      {t.msg}
    </div>
  );
}

const Spinner     = () => <div className="spinner-wrap"><div className="spinner" /></div>;
const SpinInline  = () => <span className="spinner-inline" />;

const getDist = (lat1, lon1, lat2, lon2) => Math.sqrt((lat1-lat2)**2 + (lon1-lon2)**2);
const riskTone = level => ({ high: 'high', moderate: 'moderate', safe: 'safe', low: 'safe' }[level] || 'moderate');
const impactWidth = value => `${Math.max(10, Math.min(100, Math.round((value || 0) * 100)))}%`;

function downloadTextFile(filename, content, mime = 'text/markdown;charset=utf-8') {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function findNearestZone(lat, lon, zones) {
  if (!zones?.length) return null;
  return [...zones].sort((a,b) => getDist(lat,lon,a.lat,a.lon) - getDist(lat,lon,b.lat,b.lon))[0];
}

// ─── Data Components ─────────────────────────────────────────────────────────
function WeatherRadar({ weather, zone }) {
  if (!weather) return null;
  const time = new Date().toLocaleTimeString('en-IN', { hour:'2-digit', minute:'2-digit', second:'2-digit' });
  return (
    <div className="weather-radar">
      <div className="radar-header">
        <div className="radar-title"><Icon name="zap" size={14}/> Radar: {zone?.name || 'Local Zone'}</div>
        <div className="radar-live-indicator"><span className="pulse-dot"/> {time}</div>
      </div>
      <div className="radar-grid">
        <div className="radar-item"><div className="radar-val">{weather.temp_celsius}°C</div><div className="radar-label">Temperature</div></div>
        <div className="radar-item"><div className="radar-val">{weather.aqi}</div><div className="radar-label">AQI Index</div></div>
        <div className="radar-item"><div className="radar-val">{weather.rainfall_mm_hr}</div><div className="radar-label">Precip (mm)</div></div>
      </div>
    </div>
  );
}

function LiveAlerts({ alerts }) {
  if (!alerts?.length) return null;
  return (
    <div className="alerts-feed">
      <div className="feed-title"><Icon name="alert" size={13}/> Live Zone Alerts</div>
      {alerts.map(a => (
        <div key={a.id} className="alert-item">
          <span className={`alert-bullet ${a.type}`}/>
          <div className="alert-content"><p>{a.msg}</p><span>{a.time}</span></div>
        </div>
      ))}
    </div>
  );
}

function RiskCalendar({ calendar }) {
  if (!calendar?.length) return null;
  return (
    <div className="intel-card">
      <div className="intel-card-head">
        <div>
          <div className="section-label">Risk Calendar</div>
          <div className="section-subtle">Weekly view with Green, Yellow, and Red risk windows</div>
        </div>
        <div className="intel-legend">
          <span className="legend-pill safe">Green</span>
          <span className="legend-pill moderate">Yellow</span>
          <span className="legend-pill high">Red</span>
        </div>
      </div>
      <div className="risk-calendar-grid">
        {calendar.map(day => (
          <div key={day.date} className={`risk-day-card ${riskTone(day.overallRisk)}`}>
            <div className="risk-day-top">
              <div>
                <div className="risk-day-week">{day.weekday}</div>
                <div className="risk-day-date">{day.dayLabel}</div>
              </div>
              <span className={`risk-dot ${riskTone(day.overallRisk)}`}/>
            </div>
            <div className="risk-day-level">{day.overallLabel}</div>
            <div className="risk-day-drivers">
              {(day.dominantDrivers || []).map(driver => (
                <span key={driver.key} className="risk-mini-chip">{driver.label}</span>
              ))}
            </div>
            <div className="risk-day-copy">{day.recommendation}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ShiftShieldCard({ shift, onActivate, activating, policy }) {
  if (!shift) return null;
  return (
    <div className="intel-card shift-card">
      <div className="intel-card-head">
        <div>
          <div className="section-label">ShiftShield Mode</div>
          <div className="section-subtle">6-hour earnings risk forecast before your next shift</div>
        </div>
        <div className={`risk-chip ${riskTone(shift.forecastRisk)}`}>{shift.forecastLabel}</div>
      </div>
      <div className="shift-hero">
        <div>
          <div className="shift-hero-val">{fmt(shift.earningsAtRisk)}</div>
          <div className="shift-hero-copy">Estimated earnings at risk over the next {shift.hours} hours</div>
        </div>
        <div className="shift-hero-meta">
          <div>Base shift earnings</div>
          <strong>{fmt(shift.baseShiftEarnings)}</strong>
        </div>
      </div>
      <div className="shift-hour-grid">
        {(shift.hourly || []).map(slot => (
          <div key={slot.hour} className={`shift-hour-pill ${riskTone(slot.level)}`}>
            <span>{slot.hour}</span>
            <strong>{Math.round(slot.score * 100)}%</strong>
          </div>
        ))}
      </div>
      <div className="shift-reco-box">
        <div>
          <div className="shift-reco-title">{shift.recommendation?.planName || policy?.plan?.name || 'Weekly cover ready'}</div>
          <div className="shift-reco-copy">{shift.recommendation?.why || shift.message}</div>
          {(shift.dominantTriggers || []).length > 0 && (
            <div className="shift-drivers">
              {shift.dominantTriggers.map(item => (
                <span key={item.type} className="risk-mini-chip">{triggerLabel(item.type)}</span>
              ))}
            </div>
          )}
        </div>
        <button className="btn-primary shift-activate-btn" onClick={onActivate} disabled={activating}>
          {activating ? <SpinInline /> : policy ? 'Activate Best Weekly Cover' : 'One-Tap Activate'}
        </button>
      </div>
    </div>
  );
}

function ZonePulsePanel({ pulse, title = 'Zone Pulse', subtitle = 'Live neighborhood ranking by risk, claims, and payout intensity' }) {
  const ranked = pulse?.ranked || [];
  if (!ranked.length) return null;

  return (
    <div className="intel-card">
      <div className="intel-card-head">
        <div>
          <div className="section-label">{title}</div>
          <div className="section-subtle">{subtitle}</div>
        </div>
        <div className="section-subtle">{fmtDate(pulse.updatedAt)}</div>
      </div>
      <div className="zone-pulse-layout">
        <div className="zone-pulse-map">
          {ranked.map(zone => (
            <div
              key={zone.id}
              className={`zone-map-node ${riskTone(zone.pulseLevel)}`}
              title={`${zone.name} · ${zone.city}`}
              style={{ left: `${zone.mapX}%`, top: `${zone.mapY}%` }}
            >
              <span>{zone.rank}</span>
            </div>
          ))}
        </div>
        <div className="zone-pulse-rank">
          {ranked.slice(0, 5).map(zone => (
            <div key={zone.id} className="zone-pulse-row">
              <div className="zone-pulse-rank-badge">#{zone.rank}</div>
              <div className="zone-pulse-copy">
                <div className="zone-pulse-name">{zone.name}</div>
                <div className="zone-pulse-meta">{zone.city} · {zone.totalClaims} claims · {fmt(zone.paidOut)} paid</div>
              </div>
              <div className={`risk-chip ${riskTone(zone.pulseLevel)}`}>{zone.pulseLabel}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function PageIntro({ eyebrow, title, subtitle, meta = [], actions = null, className = '' }) {
  return (
    <div className={`page-intro ${className}`.trim()}>
      <div className="page-intro-copy">
        {eyebrow && <div className="page-eyebrow">{eyebrow}</div>}
        {title && <div className="page-title">{title}</div>}
        {subtitle && <div className="page-sub">{subtitle}</div>}
        {!!meta.length && (
          <div className="page-meta">
            {meta.map((item, index) => (
              <span key={`${item.label || item}-${index}`} className="page-meta-pill">
                {item.icon && <Icon name={item.icon} size={12} />}
                <strong>{item.label || item}</strong>
                {item.value ? <span>{item.value}</span> : null}
              </span>
            ))}
          </div>
        )}
      </div>
      {actions ? <div className="page-intro-actions">{actions}</div> : null}
    </div>
  );
}

function JourneyGuide({ title, subtitle, items, className = '' }) {
  if (!items?.length) return null;
  return (
    <div className={`journey-guide ${className}`.trim()}>
      <div className="journey-head">
        <div className="section-label">{title}</div>
        {subtitle ? <div className="section-subtle">{subtitle}</div> : null}
      </div>
      <div className="journey-grid">
        {items.map((item, index) => (
          <div key={`${item.title}-${index}`} className="journey-step">
            <div className="journey-step-no">0{index + 1}</div>
            <div className="journey-step-body">
              <div className="journey-step-title">
                {item.icon ? <Icon name={item.icon} size={14} /> : null}
                <span>{item.title}</span>
              </div>
              <div className="journey-step-copy">{item.copy}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function MetricBoard({ items }) {
  if (!items?.length) return null;
  return (
    <div className="metric-board">
      {items.map(item => (
        <div key={item.label} className="metric-board-card">
          <div className="metric-board-top">
            <div className="metric-board-icon"><Icon name={item.icon} size={15} /></div>
            {item.badge ? <span className={`metric-board-badge ${item.badgeTone || ''}`.trim()}>{item.badge}</span> : null}
          </div>
          <div className="metric-board-label">{item.label}</div>
          <div className="metric-board-value">{item.value}</div>
          {item.copy ? <div className="metric-board-copy">{item.copy}</div> : null}
        </div>
      ))}
    </div>
  );
}

function PriceInsight({ plan, pricing }) {
  if (!pricing) return null;
  const isAdjusted = pricing.multiplier !== 1;
  const includedHours = pricing.includedActiveHours || plan.includedActiveHours;
  const bundlePrice = pricing.dynamicBundlePremium || plan.baseWeeklyPremium;
  const hourRate = pricing.dynamicHourlyPremium || (bundlePrice / includedHours).toFixed(2);
  const factorCount = pricing.explanation?.factors?.length || 0;

  return (
    <div className="price-insight-card">
      <div className="insight-topbar">
        <div>
          <div className="insight-header">Pricing Logic</div>
          <div className="insight-plan-name">{plan.name}</div>
        </div>
        {pricing.riskLabel ? (
          <div className={`insight-risk-pill risk-${pricing.riskLabel?.toLowerCase().split(' ')[0]}`}>{pricing.riskLabel}</div>
        ) : null}
      </div>

      <div className="insight-metric-grid">
        <div className="insight-metric-card">
          <span>Cycle price</span>
          <strong>₹{bundlePrice}</strong>
        </div>
        <div className="insight-metric-card">
          <span>Included hours</span>
          <strong>{includedHours}h</strong>
        </div>
        <div className="insight-metric-card">
          <span>Hour rate</span>
          <strong>₹{hourRate}/h</strong>
        </div>
        <div className="insight-metric-card">
          <span>Base cycle</span>
          <strong>₹{plan.baseWeeklyPremium}</strong>
        </div>
      </div>

      {isAdjusted && (
        <div className="insight-adjustment-bar">
          <span>Dynamic multiplier</span>
          <strong>x{pricing.multiplier}</strong>
        </div>
      )}

      {pricing.explanation?.summary && (
        <div className="insight-summary">{pricing.explanation.summary}</div>
      )}

      {!!factorCount && (
        <div className="insight-factor-list">
          {pricing.explanation.factors.map(factor => (
            <div key={factor.key} className="insight-factor">
              <div className="insight-factor-row">
                <span>{factor.label}</span>
                <strong>{Math.round((factor.impact || 0) * 100)}%</strong>
              </div>
              <div className="insight-factor-track"><div className="insight-factor-fill" style={{ width: impactWidth(factor.impact) }}/></div>
              <div className="insight-factor-copy">{factor.description}</div>
            </div>
          ))}
        </div>
      )}
      <div className="insight-footer">7-day cycle pricing spread across included active hours.</div>
    </div>
  );
}

function SystemInfo() {
  return (
    <div className="info-section">
      <div className="info-title"><Icon name="shield" size={16}/> Why Parametric?</div>
      <div className="info-text">
        Traditional insurance takes weeks. ArthRaksh is <strong>Parametric</strong>.
        It means we don't need you to prove your loss. If our satellite and weather APIs
        detect a disruption in your zone, we pay you <strong>automatically</strong>.
        No forms, no wait.
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// PAYMENT GATEWAY MODAL
// ═══════════════════════════════════════════════════════════════════
function PaymentGateway({ isOpen, onClose, onComplete, amount, purpose, flow = 'topup', defaultGatewayId }) {
  const [gateways,  setGateways]  = useState([]);
  const [loading,   setLoading]   = useState(false);
  const [gatewayId, setGatewayId] = useState(defaultGatewayId || 'razorpay_test');
  const [method,    setMethod]    = useState('card');
  const [step,      setStep]      = useState('form'); // form | processing | success
  const [cardNum,   setCardNum]   = useState('');
  const [expiry,    setExpiry]    = useState('');
  const [cvv,       setCvv]       = useState('');
  const [cardName,  setCardName]  = useState('');
  const [upiId,     setUpiId]     = useState('');
  const [bank,      setBank]      = useState('sbi');
  const [error,     setError]     = useState('');
  const [receipt,   setReceipt]   = useState(null);

  useEffect(() => {
    if (!isOpen) {
      setStep('form');
      setError('');
      setReceipt(null);
      return;
    }

    let mounted = true;
    setLoading(true);
    walletAPI.gateways(flow)
      .then(r => {
        if (!mounted) return;
        const next = r.data.gateways || [];
        setGateways(next);
        setGatewayId(prev => defaultGatewayId || prev || next[0]?.id || 'razorpay_test');
      })
      .catch(() => {
        if (!mounted) return;
        setGateways([]);
        setError('Could not load payment gateways');
      })
      .finally(() => mounted && setLoading(false));

    return () => { mounted = false; };
  }, [isOpen, flow, defaultGatewayId]);

  if (!isOpen) return null;

  const formatCard = v => v.replace(/\D/g,'').slice(0,16).replace(/(.{4})/g,'$1 ').trim();
  const formatExp  = v => {
    const d = v.replace(/\D/g,'').slice(0,4);
    return d.length > 2 ? d.slice(0,2) + '/' + d.slice(2) : d;
  };

  const validate = () => {
    if (method === 'card') {
      if (cardNum.replace(/\s/g,'').length < 16) return 'Enter a valid 16-digit card number';
      if (expiry.length < 5) return 'Enter a valid expiry (MM/YY)';
      if (cvv.length < 3) return 'Enter a valid CVV';
      if (!cardName.trim()) return 'Enter the name on card';
    }
    if (method === 'upi') {
      if (!upiId.includes('@')) return 'Enter a valid UPI ID (e.g. name@upi)';
    }
    return '';
  };

  const selectedGateway = gateways.find(g => g.id === gatewayId);

  const handlePay = async () => {
    const err = validate();
    if (err) { setError(err); return; }
    setError('');
    setStep('processing');
    try {
      const result = await onComplete?.({
        gatewayId,
        method,
        cardLast4: method === 'card' ? cardNum.replace(/\s/g,'').slice(-4) : undefined,
        upiId:     method === 'upi'  ? upiId : undefined,
        bank:      method === 'netbanking' ? bank : undefined,
        cardName,
      });
      setReceipt(result || null);
      setStep('success');
    } catch (err) {
      setStep('form');
      setError(err.response?.data?.error || err.message || 'Payment failed');
    }
  };

  const BANKS = [
    { id: 'sbi', name: 'State Bank of India' },
    { id: 'hdfc', name: 'HDFC Bank' },
    { id: 'icici', name: 'ICICI Bank' },
    { id: 'axis', name: 'Axis Bank' },
    { id: 'kotak', name: 'Kotak Mahindra' },
  ];

  return (
    <div className="gw-overlay" onClick={onClose}>
      <div className="gw-sheet" onClick={e => e.stopPropagation()}>

        {step === 'processing' && (
          <div className="gw-processing">
            <div className="gw-processing-ring"/>
            <div className="gw-processing-label">Processing payment…</div>
            <div className="gw-processing-sub">Connecting to {selectedGateway?.label || 'secure gateway'}</div>
          </div>
        )}

        {step === 'success' && (
          <div className="gw-success">
            <div className="gw-success-icon"><Icon name="check" size={32}/></div>
            <div className="gw-success-title">Payment Successful!</div>
            <div className="gw-success-amt">{fmt(amount)}</div>
            <div className="gw-success-sub">{receipt?.gatewayLabel || selectedGateway?.label} · {purpose}</div>
            {receipt?.ref && <div className="gw-success-ref">Ref: {receipt.ref}</div>}
            <button className="btn-primary" style={{ width: '100%', marginTop: 12 }} onClick={onClose}>Continue</button>
          </div>
        )}

        {step === 'form' && <>
          <div className="gw-header">
            <div className="gw-header-left">
              <div className="gw-logo"><Icon name="lock" size={14}/> Gateway Checkout</div>
              <div className="gw-amount">{fmt(amount)}</div>
              <div className="gw-purpose">{purpose}</div>
            </div>
            <button className="gw-close" onClick={onClose}><Icon name="x" size={18}/></button>
          </div>

          <div className="gw-gateways">
            {loading ? (
              <div className="gw-gateways-loading"><SpinInline /> Loading payment rails…</div>
            ) : gateways.map(gateway => (
              <button
                key={gateway.id}
                className={`gw-gateway-btn ${gatewayId===gateway.id?'active':''}`}
                onClick={() => setGatewayId(gateway.id)}
                style={gatewayId===gateway.id ? { borderColor: gateway.accent, boxShadow: `0 0 0 3px ${gateway.accent}22` } : undefined}
              >
                <div className="gw-gateway-top">
                  <strong>{gateway.label}</strong>
                  <span>{gateway.mode}</span>
                </div>
                <div className="gw-gateway-copy">{gateway.description}</div>
              </button>
            ))}
          </div>

          <div className="gw-methods">
            {[['card','💳 Card'],['upi','⚡ UPI'],['netbanking','🏦 Net Banking']].map(([id,label]) => (
              <button key={id} className={`gw-method-btn ${method===id?'active':''}`} onClick={() => setMethod(id)}>{label}</button>
            ))}
          </div>

          {method === 'card' && (
            <div className="gw-form">
              <div className="gw-card-preview">
                <div className="gw-card-chip"/>
                <div className="gw-card-number">{cardNum || '•••• •••• •••• ••••'}</div>
                <div className="gw-card-row">
                  <div><div className="gw-card-micro">CARD HOLDER</div><div className="gw-card-name">{cardName || 'YOUR NAME'}</div></div>
                  <div><div className="gw-card-micro">EXPIRES</div><div className="gw-card-exp">{expiry || 'MM/YY'}</div></div>
                </div>
              </div>
              <div className="gw-field"><label>Card Number</label><input placeholder="1234 5678 9012 3456" value={cardNum} onChange={e => setCardNum(formatCard(e.target.value))} maxLength={19}/></div>
              <div className="gw-field-row">
                <div className="gw-field"><label>Expiry</label><input placeholder="MM/YY" value={expiry} onChange={e => setExpiry(formatExp(e.target.value))} maxLength={5}/></div>
                <div className="gw-field"><label>CVV</label><input type="password" placeholder="•••" value={cvv} onChange={e => setCvv(e.target.value.replace(/\D/g,'').slice(0,4))} maxLength={4}/></div>
              </div>
              <div className="gw-field"><label>Name on Card</label><input placeholder="Ravi Kumar" value={cardName} onChange={e => setCardName(e.target.value)}/></div>
            </div>
          )}

          {method === 'upi' && (
            <div className="gw-form">
              <div className="gw-upi-apps">
                {[['gpay','G Pay'],['phonepe','PhonePe'],['paytm','Paytm'],['bhim','BHIM']].map(([id,label]) => (
                  <button key={id} className="gw-upi-app" onClick={() => setUpiId(prev => prev || 'user@' + id)}>{label}</button>
                ))}
              </div>
              <div className="gw-upi-divider">or enter UPI ID</div>
              <div className="gw-field">
                <label>UPI ID</label>
                <input placeholder="yourname@upi" value={upiId} onChange={e => setUpiId(e.target.value)}/>
              </div>
            </div>
          )}

          {method === 'netbanking' && (
            <div className="gw-form">
              <div className="gw-bank-list">
                {BANKS.map(b => (
                  <button key={b.id} className={`gw-bank-btn ${bank===b.id?'active':''}`} onClick={() => setBank(b.id)}>{b.name}</button>
                ))}
              </div>
            </div>
          )}

          {error && <div className="gw-error"><Icon name="alert" size={13}/> {error}</div>}

          <div className="gw-footer">
            <button className="gw-pay-btn" onClick={handlePay}>
              <Icon name="lock" size={15}/> {selectedGateway?.topupCta || 'Pay securely'} · {fmt(amount)}
            </button>
            <div className="gw-secure-note"><Icon name="shield" size={11}/> Demo checkout only · No live money movement · Instant sandbox settlement</div>
          </div>
        </>}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// WALLET PAGE
// ═══════════════════════════════════════════════════════════════════
function Wallet() {
  const [balance,  setBalance]  = useState(0);
  const [txns,     setTxns]     = useState([]);
  const [gateways, setGateways] = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [view,     setView]     = useState('main'); // main | add | withdraw
  const [addAmt,   setAddAmt]   = useState('');
  const [wdrAmt,   setWdrAmt]   = useState('');
  const [wdrUpi,   setWdrUpi]   = useState('');
  const [gwOpen,   setGwOpen]   = useState(false);
  const [gwConfig, setGwConfig] = useState({});
  const [wdrBusy,  setWdrBusy]  = useState(false);

  const load = useCallback(async (silent = false) => {
    try {
      const [walletRes, gatewayRes] = await Promise.all([
        walletAPI.balance(),
        walletAPI.gateways('topup'),
      ]);
      setBalance(walletRes.data.balance);
      setTxns(walletRes.data.transactions);
      setGateways(gatewayRes.data.gateways || []);
    } catch { if (!silent) toast('Could not load wallet', 'error'); }
    setLoading(false);
  }, []);

  // Poll every 3s so balance updates instantly when a claim payout arrives
  useEffect(() => {
    load();
    const h = () => load(true);
    window.addEventListener('gs:refresh', h);
    const iv = setInterval(() => load(true), 3000);
    return () => {
      window.removeEventListener('gs:refresh', h);
      clearInterval(iv);
    };
  }, [load]);

  const QUICK_AMOUNTS = [100, 250, 500, 1000, 2000, 5000];

  const openAddGateway = () => {
    const amt = Number(addAmt);
    if (!amt || amt < 10) { toast('Minimum ₹10 to add', 'error'); return; }
    if (amt > 50000) { toast('Maximum ₹50,000 per transaction', 'error'); return; }
    setGwConfig({ amount: amt, purpose: 'Add to ArthRaksh Wallet' });
    setGwOpen(true);
  };

  const handleGwSuccess = async ({ gatewayId, method, cardLast4, upiId, bank }) => {
    const sessionRes = await walletAPI.createTopupSession({
      amount: Number(addAmt),
      gatewayId,
      method,
      purpose: 'Add to ArthRaksh Wallet',
    });
    const confirmRes = await walletAPI.confirmTopupSession(sessionRes.data.session.id, {
      gatewayId,
      method,
      cardLast4,
      upiId,
      bank,
    });
    const newBal = confirmRes.data.balance ?? (balance + Number(addAmt));
    setBalance(newBal);
    toast(`✅ ${fmt(Number(addAmt))} added via ${confirmRes.data.session.gatewayLabel}`);
    setAddAmt('');
    setView('main');
    setTimeout(() => load(true), 250);
    return {
      gatewayLabel: confirmRes.data.session.gatewayLabel,
      ref: confirmRes.data.ref,
      session: confirmRes.data.session,
    };
  };

  const handleWithdraw = async () => {
    const amt = Number(wdrAmt);
    if (!amt || amt < 10) { toast('Minimum ₹10 to withdraw', 'error'); return; }
    if (!wdrUpi.includes('@')) { toast('Enter a valid UPI ID', 'error'); return; }
    if (amt > balance) { toast('Insufficient balance', 'error'); return; }
    setWdrBusy(true);
    try {
      const r = await walletAPI.withdraw({ amount: amt, upiId: wdrUpi });
      setBalance(r.data.balance);
      toast(`✅ ${fmt(amt)} sent to ${wdrUpi}`);
      setWdrAmt(''); setWdrUpi('');
      setView('main');
      load();
    } catch (err) {
      toast(err.response?.data?.error || 'Withdrawal failed', 'error');
    }
    setWdrBusy(false);
  };

  const txIcon = tx => {
    if (tx.type === 'credit') {
      if (tx.method === 'claim_payout') return '🛡️';
      return '⬇️';
    }
    if (tx.method === 'wallet') return '🛡️';
    return '⬆️';
  };

  const txColor = tx => tx.type === 'credit' ? '#22c55e' : '#ef4444';
  const txSign  = tx => tx.type === 'credit' ? '+' : '−';

  if (loading) return <Spinner />;

  return (
    <div className="screen">
      <PaymentGateway
        isOpen={gwOpen}
        onClose={() => setGwOpen(false)}
        onComplete={handleGwSuccess}
        amount={gwConfig.amount}
        purpose={gwConfig.purpose}
      />

      <PageIntro
        eyebrow="Wallet"
        title="Manage the money layer behind coverage and payouts"
        meta={[
          { icon: 'wallet', label: 'Available balance', value: fmt(balance) },
          { icon: 'credit', label: 'Transactions', value: String(txns.length) },
        ]}
      />

      <div className="wallet-hero">
        <div className="wallet-hero-label">ArthRaksh Wallet</div>
        <div className="wallet-hero-balance">{fmt(balance)}</div>
        <div className="wallet-hero-sub">Available balance</div>
        <div className="wallet-hero-actions">
          <button className="wallet-action-btn" onClick={() => setView(view === 'add' ? 'main' : 'add')}>
            <div className="wallet-action-icon"><Icon name="plus" size={18}/></div>
            <span>Add Money</span>
          </button>
          <button className="wallet-action-btn" onClick={() => setView(view === 'withdraw' ? 'main' : 'withdraw')}>
            <div className="wallet-action-icon"><Icon name="send" size={18}/></div>
            <span>Withdraw</span>
          </button>
        </div>
      </div>

      {gateways.length > 0 && (
        <div className="wallet-gateway-strip">
          {gateways.map(gateway => (
            <div key={gateway.id} className="wallet-gateway-pill">
              <strong>{gateway.provider}</strong>
              <span>{gateway.mode}</span>
            </div>
          ))}
          <div className="wallet-gateway-copy">Use Razorpay test mode or Stripe sandbox to top up, then watch claim payouts land instantly in the same wallet.</div>
        </div>
      )}

      {/* Add Money Panel */}
      {view === 'add' && (
        <div className="wallet-panel">
          <div className="wallet-panel-title"><Icon name="plus" size={15}/> Add Money</div>
          <div className="wallet-quick-amounts">
            {QUICK_AMOUNTS.map(a => (
              <button key={a} className={`quick-amt-btn ${addAmt == a ? 'active' : ''}`} onClick={() => setAddAmt(String(a))}>
                ₹{a.toLocaleString('en-IN')}
              </button>
            ))}
          </div>
          <div className="gw-field" style={{ marginBottom: 16 }}>
            <label>Or enter amount</label>
            <input
              type="number" placeholder="Enter amount"
              value={addAmt} onChange={e => setAddAmt(e.target.value)}
              min="10" max="50000"
            />
          </div>
          <button className="btn-primary" onClick={openAddGateway} disabled={!addAmt}>
            <Icon name="credit" size={15}/> Proceed to Payment
          </button>
          <button className="btn-ghost" style={{ marginTop: 8 }} onClick={() => setView('main')}>Cancel</button>
        </div>
      )}

      {/* Withdraw Panel */}
      {view === 'withdraw' && (
        <div className="wallet-panel">
          <div className="wallet-panel-title"><Icon name="send" size={15}/> Withdraw to UPI</div>
          <div className="gw-field">
            <label>Amount</label>
            <input type="number" placeholder="Enter amount" value={wdrAmt} onChange={e => setWdrAmt(e.target.value)} min="10" max={balance}/>
          </div>
          <div className="gw-field">
            <label>UPI ID</label>
            <input placeholder="yourname@upi" value={wdrUpi} onChange={e => setWdrUpi(e.target.value)}/>
          </div>
          {wdrAmt && balance < Number(wdrAmt) && (
            <div className="gw-error"><Icon name="alert" size={13}/> Insufficient balance</div>
          )}
          <button className="btn-primary" onClick={handleWithdraw} disabled={wdrBusy || !wdrAmt || !wdrUpi}>
            {wdrBusy ? <SpinInline/> : <><Icon name="send" size={15}/> Withdraw {wdrAmt ? fmt(Number(wdrAmt)) : ''}</>}
          </button>
          <button className="btn-ghost" style={{ marginTop: 8 }} onClick={() => setView('main')}>Cancel</button>
        </div>
      )}

      {/* Transaction History */}
      <div className="section">
        <div className="section-label">Transaction History</div>
        {txns.length === 0 ? (
          <div className="empty" style={{ paddingTop: 32 }}>
            <div className="empty-icon">💳</div>
            <div className="empty-title">No transactions yet</div>
            <div className="empty-sub">Add money to get started</div>
          </div>
        ) : (
          <div className="txn-list">
            {txns.map(tx => (
              <div key={tx.id} className="txn-row">
                <div className="txn-icon">{txIcon(tx)}</div>
                <div className="txn-info">
                  <div className="txn-desc">{tx.description}</div>
                  <div className="txn-date">{fmtDate(tx.createdAt)} · {fmtTime(tx.createdAt)}</div>
                  {railLabel(tx) && <div className="txn-meta">{railLabel(tx)}</div>}
                  {tx.ref && <div className="txn-ref">{tx.ref}</div>}
                </div>
                <div className="txn-amount" style={{ color: txColor(tx) }}>
                  {txSign(tx)}{fmt(tx.amount)}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// AUTH SCREEN
// ═══════════════════════════════════════════════════════════════════
function AuthScreen({ onAdmin }) {
  const { login, register } = useAuth();
  const [tab,    setTab]    = useState('login');
  const [zones,  setZones]  = useState(ZONES_FB);
  const [busy,   setBusy]   = useState(false);
  const [form,   setForm]   = useState({ name:'', phone:'', email:'', password:'', platform:'swiggy', city:'Mumbai', zoneId:'z1', avgHoursPerWeek:45 });

  const cities = [...new Set(zones.map(z => z.city))];
  const filteredZones = zones.filter(z => z.city === form.city);
  const displayZone = filteredZones.find(z => z.id === form.zoneId)?.name || filteredZones[0]?.name || 'Andheri West';
  const displayName = firstName(form.name) || 'Ravi';
  const platformLabel = form.platform ? form.platform[0].toUpperCase() + form.platform.slice(1) : 'Swiggy';


  const previewTransactions = [
    { title: 'Rain disruption payout', meta: displayZone, amount: '+₹1,727', tone: 'positive' },
    { title: 'Weekly cover activated', meta: 'Smart Shield Plus', amount: '-₹149', tone: 'neutral' },
    { title: 'Wallet top-up', meta: 'Razorpay sandbox', amount: '+₹500', tone: 'positive' },
  ];

  const set = k => e => {
    const val = e.target.value;
    setForm(f => {
      const next = { ...f, [k]: val };
      if (k === 'city') {
        const firstInCity = zones.find(z => z.city === val);
        next.zoneId = firstInCity?.id || '';
      }
      return next;
    });
  };

  useEffect(() => {
    workerAPI.zones().then(r => { if (r.data.zones?.length) setZones(r.data.zones); }).catch(() => {});
  }, []);

  const submit = async e => {
    e.preventDefault();
    setBusy(true);
    try {
      if (tab === 'login') {
        await login(form.phone, form.password);
        toast('Welcome back! 🛡️');
      } else {
        await register(form);
        toast('Account created — your shield is active!');
      }
    } catch (err) {
      toast(err.response?.data?.error || 'Could not connect — is the backend running?', 'error');
    }
    setBusy(false);
  };

  return (
    <div className="auth-wrap">
      <div className="auth-orb auth-orb-a" />
      <div className="auth-orb auth-orb-b" />
      <div className="auth-grid">
        <section className="auth-showcase">

          <div className="auth-logo fintech-brand">
            <div className="logo-icon"><Icon name="shield" size={26} /></div>
            <div>
              <div className="logo-name">ArthRaksh</div>
              <div className="logo-tagline">Fintech-grade resilience for delivery partners</div>
            </div>
          </div>

          <div className="auth-headline">
            <h1>Simple weekly protection for delivery partners who need clarity fast.</h1>

          </div>

          <div className="auth-feature-grid">
            <div className="auth-feature-card">
              <div className="auth-feature-icon"><Icon name="shield" size={16} /></div>
              <div>
                <strong>Weekly cover that fits real shifts</strong>
                <p>Set your city, zone, platform, and active hours once so protection reflects how you actually work.</p>
              </div>
            </div>
            <div className="auth-feature-card">
              <div className="auth-feature-icon"><Icon name="zap" size={16} /></div>
              <div>
                <strong>Live disruption intelligence</strong>
                <p>Risk alerts stay connected to the neighborhood you ride in, helping you understand when cover may trigger.</p>
              </div>
            </div>
            <div className="auth-feature-card">
              <div className="auth-feature-icon"><Icon name="wallet" size={16} /></div>
              <div>
                <strong>One place for money movement</strong>
                <p>Premium deductions, approved claims, and wallet credits show up in a single, easy-to-read timeline.</p>
              </div>
            </div>
          </div>
        </section>

        <div className="auth-card fintech-auth-card">
          <div className="auth-card-copy">
            <div className="auth-card-label">{tab === 'login' ? 'Welcome back' : 'Create your protection profile'}</div>
            <h2>{tab === 'login' ? 'Sign in to your protection dashboard.' : 'Create your worker protection account.'}</h2>
          </div>

          <div className="tabs auth-tabs">
            <button className={`tab-btn ${tab==='login'?'active':''}`} type="button" onClick={() => { setTab('login'); }}>Sign in</button>
            <button className={`tab-btn ${tab==='register'?'active':''}`} type="button" onClick={() => { setTab('register'); }}>Register</button>
          </div>

          <form onSubmit={submit} className="auth-form">
            {tab === 'register' && <>
              <div className="field"><label>Full name</label><input placeholder="Ravi Kumar" value={form.name} onChange={set('name')} required /></div>
              <div className="field"><label>Email address</label><input type="email" placeholder="ravi@example.com" value={form.email} onChange={set('email')} required /></div>
              <div className="field-row">
                <div className="field"><label>Platform</label><select value={form.platform} onChange={set('platform')}><option value="swiggy">Swiggy</option><option value="zomato">Zomato</option><option value="zepto">Zepto</option><option value="blinkit">Blinkit</option></select></div>
                <div className="field"><label>Weekly Hrs</label><input type="number" min="10" max="84" value={form.avgHoursPerWeek} onChange={set('avgHoursPerWeek')} /></div>
              </div>
              <div className="field-row">
                <div className="field"><label>City</label><select value={form.city} onChange={set('city')}>{cities.map(c => <option key={c} value={c}>{c}</option>)}</select></div>
                <div className="field"><label>Area</label><select value={form.zoneId} onChange={set('zoneId')}>{filteredZones.map(z => <option key={z.id} value={z.id}>{z.name}</option>)}</select></div>
              </div>
            </>}
            <div className="field"><label>Phone number</label><input placeholder="9876543210" value={form.phone} onChange={set('phone')} required /></div>
            <div className="field"><label>Password</label><input type="password" placeholder="••••••••" value={form.password} onChange={set('password')} required /></div>
            <button type="submit" className="btn-primary auth-submit-btn" disabled={busy}>{busy ? <SpinInline /> : tab === 'login' ? 'Enter dashboard' : 'Create protected account'}</button>
          </form>

          <div className="auth-footer-row">
            <button className="admin-link" onClick={onAdmin}><Icon name="grid" size={13} /> Insurer dashboard</button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// HOME
// ═══════════════════════════════════════════════════════════════════
function Home() {
  const { user, setUser } = useAuth();
  const [data,      setData]      = useState(null);
  const [loading,   setLoading]   = useState(true);
  const [nearZone,  setNearZone]  = useState(null);
  const [activatingShift, setActivatingShift] = useState(false);

  const load = useCallback(async (isSilent = false) => {
    try {
      const r = await dashAPI.worker();
      setData(r.data);
      if (r.data.worker) setUser(s => ({ ...s, ...r.data.worker }));
    }
    catch { if (!isSilent) toast('Failed to load dashboard', 'error'); }
    setLoading(false);
  }, [setUser]);

  useEffect(() => {
    load();
    const h = () => load(true);
    window.addEventListener('gs:refresh', h);
    const iv = setInterval(() => load(true), 3000);
    return () => {
      window.removeEventListener('gs:refresh', h);
      clearInterval(iv);
    };
  }, [load]);

  useEffect(() => {
    if (!data?.zones) return;
    const onPos = pos => {
      const nearest = findNearestZone(pos.coords.latitude, pos.coords.longitude, data.zones);
      if (nearest && nearest.id !== data.worker?.zoneId) setNearZone(nearest);
      else setNearZone(null);
    };
    const watchId = navigator.geolocation.watchPosition(onPos, () => {}, { enableHighAccuracy: true, maximumAge: 5000, timeout: 10000 });
    return () => navigator.geolocation.clearWatch(watchId);
  }, [data?.zones, data?.worker?.zoneId]);

  const switchZone = async () => {
    if (!nearZone) return;
    try {
      await workerAPI.updateProfile({ zoneId: nearZone.id });
      setNearZone(null);
      await load();
      toast(`📍 Location synced: ${nearZone.name}`);
    } catch { toast('Failed to update zone', 'error'); }
  };

  const activateShiftShield = async () => {
    setActivatingShift(true);
    try {
      const res = await policyAPI.startShift();
      toast(res.data.message || 'ShiftShield activated');
      await load(true);
      nav('plans');
    } catch (err) {
      const msg = err.response?.data?.error || 'Could not activate ShiftShield';
      toast(msg, 'error');
      if (err.response?.status === 402) nav('plans');
    }
    setActivatingShift(false);
  };

  if (loading) return <Spinner />;
  if (!data)   return null;

  return (
    <WorkerHomePage
      data={data}
      nearZone={nearZone}
      onSwitchZone={switchZone}
      onDismissNotifications={() => workerAPI.clearNotifications().then(() => load())}
      ui={{ Icon, fmt, fmtDate, trigIcon, nav, PageIntro, MetricBoard }}
    />
  );
}

function Intel() {
  const { setUser } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activatingShift, setActivatingShift] = useState(false);

  const load = useCallback(async (isSilent = false) => {
    try {
      const r = await dashAPI.worker();
      setData(r.data);
      if (r.data.worker) setUser(s => ({ ...s, ...r.data.worker }));
    } catch {
      if (!isSilent) toast('Failed to load risk center', 'error');
    }
    setLoading(false);
  }, [setUser]);

  useEffect(() => {
    load();
    const h = () => load(true);
    window.addEventListener('gs:refresh', h);
    const iv = setInterval(() => load(true), 4000);
    return () => {
      window.removeEventListener('gs:refresh', h);
      clearInterval(iv);
    };
  }, [load]);

  const activateShiftShield = async () => {
    setActivatingShift(true);
    try {
      const res = await policyAPI.startShift();
      toast(res.data.message || 'ShiftShield activated');
      await load(true);
      nav('plans');
    } catch (err) {
      const msg = err.response?.data?.error || 'Could not activate ShiftShield';
      toast(msg, 'error');
      if (err.response?.status === 402) nav('plans');
    }
    setActivatingShift(false);
  };

  if (loading) return <Spinner />;
  if (!data) return null;

  return (
    <WorkerIntelPage
      data={data}
      activatingShift={activatingShift}
      onActivateShift={activateShiftShield}
      ui={{ PageIntro, fmt, WeatherRadar, LiveAlerts, ShiftShieldCard, RiskCalendar, PriceInsight, ZonePulsePanel }}
    />
  );
}

function ConfirmModal({ isOpen, onCancel, onConfirm, title, text, loading }) {
  if (!isOpen) return null;
  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal-card" onClick={e => e.stopPropagation()}>
        <div className="modal-icon"><Icon name="alert" size={28}/></div>
        <div className="modal-title">{title}</div>
        <div className="modal-text">{text}</div>
        <div className="modal-actions">
          <button className="btn-primary" style={{ background: '#ef4444' }} onClick={onConfirm} disabled={loading}>
            {loading ? <SpinInline /> : 'Confirm Deactivation'}
          </button>
          <button className="btn-outline" onClick={onCancel} disabled={loading}>Cancel</button>
        </div>
      </div>
    </div>
  );
}

// ─── Inline Add Money Modal (triggered from Plans when balance is low) ───────
function InsufficientBalanceModal({ isOpen, onClose, required, balance, onAdded }) {
  const [addAmt, setAddAmt] = useState(String(Math.max(required - balance, 100)));
  const [gwOpen, setGwOpen] = useState(false);

  if (!isOpen) return null;

  const handleGwSuccess = async ({ gatewayId, method, cardLast4, upiId, bank }) => {
    const sessionRes = await walletAPI.createTopupSession({
      amount: Number(addAmt),
      gatewayId,
      method,
      purpose: 'Add to ArthRaksh Wallet',
    });
    const confirmRes = await walletAPI.confirmTopupSession(sessionRes.data.session.id, {
      gatewayId,
      method,
      cardLast4,
      upiId,
      bank,
    });
    toast(`✅ ${fmt(Number(addAmt))} added via ${confirmRes.data.session.gatewayLabel}`);
    onAdded();
    onClose();
    return {
      gatewayLabel: confirmRes.data.session.gatewayLabel,
      ref: confirmRes.data.ref,
    };
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" onClick={e => e.stopPropagation()}>
        <PaymentGateway
          isOpen={gwOpen}
          onClose={() => setGwOpen(false)}
          onComplete={handleGwSuccess}
          amount={Number(addAmt)}
          purpose="Add to ArthRaksh Wallet"
        />
        <div className="modal-icon" style={{ color: '#f59e0b' }}><Icon name="wallet" size={28}/></div>
        <div className="modal-title">Insufficient Balance</div>
        <div className="modal-text">
          You need <strong>{fmt(required)}</strong> to activate this plan.<br/>
          Current balance: <strong>{fmt(balance)}</strong>
        </div>
        <div className="gw-field" style={{ marginBottom: 16 }}>
          <label>Amount to add</label>
          <input type="number" value={addAmt} onChange={e => setAddAmt(e.target.value)} min={required - balance}/>
        </div>
        <div className="modal-actions">
          <button className="btn-primary" onClick={() => setGwOpen(true)} disabled={!addAmt || Number(addAmt) < 1}>
            <Icon name="plus" size={15}/> Add {addAmt ? fmt(Number(addAmt)) : 'Money'}
          </button>
          <button className="btn-outline" onClick={onClose}>Cancel</button>
        </div>
      </div>
    </div>
  );
}

// ─── Plan Details ─────────────────────────────────────────────────
function PlanDetails({ plan }) {
  return (
    <div className="plan-details">
      <div className="pd-title">How this bundle works</div>
      <div className="pd-list">
        <div className="pd-item"><Icon name="check" size={12}/> One 7-day billing cycle with {plan.includedActiveHours} protected active hours included</div>
        <div className="pd-item"><Icon name="check" size={12}/> Hours are consumed only when covered disruption time is actually protected</div>
        <div className="pd-item"><Icon name="check" size={12}/> Up to {fmt(plan.maxWeeklyPayout)} can be paid out across the cycle</div>
        <div className="pd-item"><Icon name="check" size={12}/> Covered payouts land directly in your wallet</div>
        {plan.triggers.map(t => <div key={t} className="pd-item"><Icon name="check" size={12}/> {triggerLabel(t)} disruption covered</div>)}
      </div>
    </div>
  );
}

function topUpMarkupForHours(hours) {
  const safeHours = Math.max(1, Number(hours) || 0);
  return Math.max(1.08, Number((1.75 - (safeHours * 0.03)).toFixed(2)));
}

function getTopUpPreview(policy, hours) {
  const coveredHours = Math.max(1, Number(policy?.coveredActiveHours || policy?.plan?.includedActiveHours || 1));
  const baseHourlyRate = Number(policy?.hourlyPremium || (((policy?.weeklyPremium || policy?.plan?.baseWeeklyPremium || 0) / coveredHours).toFixed(2)));
  const markup = topUpMarkupForHours(hours);
  const topUpHourlyRate = Number(Math.max(baseHourlyRate, Number((baseHourlyRate * markup).toFixed(2))).toFixed(2));
  const topUpPrice = Math.max(1, Math.round(topUpHourlyRate * Math.max(1, Number(hours) || 0)));

  return { baseHourlyRate, topUpHourlyRate, markup, topUpPrice };
}

function PlanModalShell({ title, subtitle, children, onClose, wide = false }) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className={`modal-card plan-modal-card ${wide ? 'wide' : ''}`.trim()} onClick={e => e.stopPropagation()}>
        <button className="plan-modal-close" onClick={onClose} aria-label="Close">
          <Icon name="x" size={16}/>
        </button>
        <div className="plan-modal-head">
          <div className="plan-modal-title">{title}</div>
          {subtitle ? <div className="plan-modal-subtitle">{subtitle}</div> : null}
        </div>
        {children}
      </div>
    </div>
  );
}

function TopUpHoursModal({ policy, walletBal, onClose, onAdded, onNeedFunds }) {
  const [hours, setHours] = useState(8);
  const [busy, setBusy] = useState(false);

  if (!policy) return null;

  const preview = getTopUpPreview(policy, hours);
  const presets = [4, 8, 12, 16];

  const submit = async () => {
    if (walletBal < preview.topUpPrice) {
      onNeedFunds({ required: preview.topUpPrice, balance: walletBal });
      return;
    }

    setBusy(true);
    try {
      const res = await policyAPI.topUpHours(hours);
      toast(`✅ ${hours}h added to this week for ${fmt(res.data.quote.topUpPrice)}`);
      onAdded(res.data);
    } catch (err) {
      const data = err.response?.data;
      if (err.response?.status === 402) onNeedFunds({ required: data.required, balance: data.balance });
      else toast(data?.error || 'Could not top up hours', 'error');
    }
    setBusy(false);
  };

  return (
    <PlanModalShell
      title="Top up protected hours"
      subtitle="Add more covered hours to your current 7-day cycle without changing plans."
      onClose={onClose}
    >
      <div className="topup-modal-grid">
        {presets.map(option => (
          <button
            key={option}
            className={`topup-hour-btn ${hours === option ? 'active' : ''}`}
            onClick={() => setHours(option)}
          >
            <strong>{option}h</strong>
            <span>{fmt(getTopUpPreview(policy, option).topUpPrice)}</span>
          </button>
        ))}
      </div>

      <div className="topup-modal-summary">
        <div><span>Current plan</span><strong>{policy.plan?.name}</strong></div>
        <div><span>Weekly bundle rate</span><strong>₹{preview.baseHourlyRate}/h</strong></div>
        <div><span>Top-up rate</span><strong>₹{preview.topUpHourlyRate}/h</strong></div>
        <div><span>Wallet</span><strong>{fmt(walletBal)}</strong></div>
        <div><span>New total</span><strong>{policy.remainingActiveHours + hours}h left</strong></div>
      </div>

      <div className="topup-modal-note">
        Top-up hours are priced above the weekly bundle rate for convenience. Larger hour packs reduce the top-up rate, but never below your bundle's standard hourly price.
      </div>

      <div className="modal-actions">
        <button className="btn-primary" onClick={submit} disabled={busy}>
          {busy ? <SpinInline /> : <>Add {hours}h for {fmt(preview.topUpPrice)}</>}
        </button>
        <button className="btn-outline" onClick={onClose}>Cancel</button>
      </div>
    </PlanModalShell>
  );
}

function PlanDetailsModal({ plan, pricing, current, onClose, onBuy, buying, canAfford, onNeedFunds }) {
  const premium = pricing?.dynamicBundlePremium || plan.baseWeeklyPremium;
  return (
    <PlanModalShell
      title={plan.name}
      subtitle="Active-hour bundle details for the current 7-day protection cycle."
      onClose={onClose}
      wide
    >
      <div className="plan-modal-hero">
        <div className="plan-modal-price">{fmt(premium)}<span> / cycle</span></div>
        <div className="plan-modal-stats">
          <div><span>Included hours</span><strong>{plan.includedActiveHours}h</strong></div>
          <div><span>Payout cap</span><strong>{fmt(plan.maxWeeklyPayout)}</strong></div>
          <div><span>Covered triggers</span><strong>{plan.triggers.length}</strong></div>
        </div>
      </div>

      <PlanDetails plan={plan} />

      <div className="plan-modal-footer">
        {current ? (
          <div className="plan-modal-current">This is your active bundle for the current week.</div>
        ) : (
          <button className="btn-primary" onClick={() => onBuy(plan.id, premium)} disabled={buying}>
            {buying ? <SpinInline /> : canAfford ? 'Activate this bundle' : 'Add funds and activate'}
          </button>
        )}
        {!current && !canAfford ? (
          <button className="btn-outline" onClick={() => onNeedFunds({ required: premium })}>Review wallet gap</button>
        ) : null}
      </div>
    </PlanModalShell>
  );
}

function PlanPricingModal({ plan, pricing, onClose }) {
  return (
    <PlanModalShell
      title={`${plan.name} pricing`}
      subtitle="How this bundle is billed, how the weekly quote is formed, and how hour top-ups work."
      onClose={onClose}
      wide
    >
      <PriceInsight plan={plan} pricing={pricing} />
      <div className="topup-modal-note" style={{ marginTop: 14 }}>
        Hour top-ups are sold at a premium to the weekly bundle rate for short-term flexibility. As you add more hours, the top-up rate per hour drops, but it never goes below the bundled weekly rate.
      </div>
    </PlanModalShell>
  );
}

// ═══════════════════════════════════════════════════════════════════
// PLANS (with wallet integration)
// ═══════════════════════════════════════════════════════════════════
function Plans() {
  const [plans,       setPlans]       = useState([]);
  const [active,      setActive]      = useState(null);
  const [buying,      setBuying]      = useState(null);
  const [loading,     setLoading]     = useState(true);
  const [showConfirm, setShowConfirm] = useState(false);
  const [cancelling,  setCancelling]  = useState(false);
  const [walletBal,   setWalletBal]   = useState(0);
  const [insufModal,  setInsufModal]  = useState(null); // { required, balance }
  const [switching,   setSwitching]   = useState(false);
  const [detailPlanId, setDetailPlanId] = useState(null);
  const [pricingPlanId, setPricingPlanId] = useState(null);
  const [showTopUpModal, setShowTopUpModal] = useState(false);

  const load = useCallback(async () => {
    try {
      const [p1, p2, p3] = await Promise.all([policyAPI.plans(), policyAPI.active(), walletAPI.balance()]);
      setPlans(p1.data.plans);
      setActive(p2.data.policy);
      setWalletBal(p3.data.balance || 0);
    } catch { toast('Failed to load plans', 'error'); }
    setLoading(false);
  }, []);

  const toggleAutoRenew = async (e) => {
    e.stopPropagation();
    if (!active) return;
    setSwitching(true);
    try {
      const r = await policyAPI.toggleAutoRenew(!active.autoRenew);
      setActive(s => ({ ...s, autoRenew: r.data.autoRenew }));
      toast(`Auto-renew ${r.data.autoRenew ? 'enabled' : 'disabled'}`);
    } catch { toast('Failed to toggle auto-renew', 'error'); }
    setSwitching(false);
  };

  useEffect(() => {
    load();
    const h = () => load();
    window.addEventListener('gs:refresh', h);
    return () => window.removeEventListener('gs:refresh', h);
  }, [load]);

  const buy = async (planId, premium) => {
    // Check balance first
    if (walletBal < premium) {
      setInsufModal({ required: premium, balance: walletBal });
      return;
    }
    setBuying(planId);
    try {
      const r = await policyAPI.buy(planId);
      setActive(r.data.policy);
      setWalletBal(r.data.walletBalance ?? walletBal - premium);
      toast(`✅ ${r.data.message}`);
      setDetailPlanId(null);
    } catch (err) {
      const errData = err.response?.data;
      if (err.response?.status === 402) {
        setInsufModal({ required: errData.required, balance: errData.balance });
      } else {
        toast(errData?.error || 'Purchase failed', 'error');
      }
    }
    setBuying(null);
  };

  const deactivate = async () => {
    setCancelling(true);
    try {
      await policyAPI.cancel();
      setActive(null);
      setShowConfirm(false);
      toast('Policy deactivated successfully');
    } catch { toast('Failed to cancel policy', 'error'); }
    setCancelling(false);
  };

  if (loading) return <Spinner />;

  const detailPlan = detailPlanId ? plans.find(plan => plan.id === detailPlanId) : null;
  const pricingPlan = pricingPlanId ? plans.find(plan => plan.id === pricingPlanId) : null;

  return (
    <div className="screen">
      <ConfirmModal
        isOpen={showConfirm} onCancel={() => setShowConfirm(false)}
        onConfirm={deactivate} loading={cancelling}
        title="Stop coverage?" text="Are you sure you want to end your parametric shield? You will no longer be covered for income disruptions in your zone."
      />
      <InsufficientBalanceModal
        isOpen={!!insufModal}
        onClose={() => setInsufModal(null)}
        required={insufModal?.required || 0}
        balance={insufModal?.balance || walletBal}
        onAdded={load}
      />
      {detailPlan && (
        <PlanDetailsModal
          plan={detailPlan}
          pricing={detailPlan.pricing}
          current={active?.planId === detailPlan.id}
          onClose={() => setDetailPlanId(null)}
          onBuy={buy}
          buying={buying === detailPlan.id}
          canAfford={walletBal >= (detailPlan.pricing?.dynamicBundlePremium || detailPlan.baseWeeklyPremium)}
          onNeedFunds={({ required }) => setInsufModal({ required, balance: walletBal })}
        />
      )}
      {pricingPlan && (
        <PlanPricingModal
          plan={pricingPlan}
          pricing={pricingPlan.pricing}
          onClose={() => setPricingPlanId(null)}
        />
      )}
      {showTopUpModal && (
        <TopUpHoursModal
          policy={active}
          walletBal={walletBal}
          onClose={() => setShowTopUpModal(false)}
          onNeedFunds={({ required, balance }) => setInsufModal({ required, balance: balance ?? walletBal })}
          onAdded={(data) => {
            setActive(data.policy);
            setWalletBal(data.walletBalance);
            setShowTopUpModal(false);
          }}
        />
      )}

      {/* Wallet balance banner */}
      <div className="plans-wallet-bar">
        <div className="pwb-left"><Icon name="wallet" size={14}/> Wallet balance</div>
        <div className="pwb-right">
          <strong>{fmt(walletBal)}</strong>
          <button className="pwb-add" onClick={() => nav('wallet')}><Icon name="plus" size={12}/> Add</button>
        </div>
      </div>

      <PageIntro
        eyebrow="Plans"
        title="Active-hour insurance bundles built on a 7-day cycle"
        meta={[
          { icon: 'wallet', label: 'Wallet balance', value: fmt(walletBal) },
          { icon: 'shield', label: active ? 'Active plan' : 'No active plan', value: active?.plan?.name || 'Select one below' },
        ]}
      />

      <JourneyGuide
        title="How the billing model works"
        items={[
          { icon: 'clock', title: 'Choose hours, not just a label', copy: 'Each bundle starts with included active hours for the week, then shows the payout cap and covered disruption types.' },
          { icon: 'chart', title: 'See the weekly quote', copy: 'The premium is still charged per 7-day cycle, but the pricing logic explains the effective hourly value inside that bundle.' },
          { icon: 'plus', title: 'Top up the current week if needed', copy: 'If you exhaust protection mid-cycle, you can add more active hours to the same week at your bundle’s hourly rate.' },
          { icon: 'check', title: 'Track usage across the cycle', copy: 'Once active, you can manage auto-renew and monitor how many protected hours remain before the cycle ends.' },
        ]}
      />

      {active && (
        <div className="active-hours-rail">
          <div className="ahr-copy">
            <span className="ahr-label">Active weekly cycle</span>
            <strong>{active.plan?.name || 'Current bundle'}</strong>
            <span>{active.remainingActiveHours || 0}h left of {active.coveredActiveHours || active.plan?.includedActiveHours || 0}h until {fmtDate(active.endDate)}</span>
          </div>
          <div className="ahr-stats">
            <div>
              <span>Protected hours left</span>
              <strong>{active.remainingActiveHours || 0}h</strong>
            </div>
            <div>
              <span>Cycle cap</span>
              <strong>{fmt(active.maxWeeklyPayout || active.plan?.maxWeeklyPayout || 0)}</strong>
            </div>
          </div>
          <div className="ahr-actions">
            <button className="btn-outline plan-secondary-btn" onClick={() => setShowTopUpModal(true)}>
              <Icon name="plus" size={14}/> Top up hours
            </button>
            <button className="btn-outline plan-secondary-btn" onClick={() => setPricingPlanId(active.planId)}>
              <Icon name="chart" size={14}/> Billing model
            </button>
          </div>
        </div>
      )}



      <div className="plans-grid">
        {plans.map(plan => {
          const isCurrent = active?.planId === plan.id;
          const price     = plan.pricing;
          const premium   = price?.dynamicBundlePremium || plan.baseWeeklyPremium;
          const canAfford = walletBal >= premium;

          return (
            <div key={plan.id} className={`plan-card ${plan.popular?'featured':''} ${isCurrent?'current':''}`}>
              {plan.popular  && <div className="plan-badge">Most popular</div>}
              {isCurrent     && <div className="plan-active-badge">✓ Active</div>}

              <div className="plan-head">
                <div>
                  <div className="plan-name">{plan.name}</div>
                  <div className="plan-coverage">7-day cycle · {plan.includedActiveHours} active hours included · up to {fmt(plan.maxWeeklyPayout)}</div>
                </div>
                <div style={{ textAlign:'right' }}>
                  <div className="plan-price">{fmt(premium)}</div>
                  <div className="plan-price-note">per 7-day cycle</div>
                </div>
              </div>

              <div className="plan-summary-grid">
                <div className="plan-summary-chip"><span>Hours</span><strong>{plan.includedActiveHours}h</strong></div>
                <div className="plan-summary-chip"><span>Rate</span><strong>₹{price?.dynamicHourlyPremium || (premium / plan.includedActiveHours).toFixed(2)}/h</strong></div>
                <div className="plan-summary-chip"><span>Payout cap</span><strong>{fmt(plan.maxWeeklyPayout)}</strong></div>
              </div>

              <div className="plan-triggers">
                {plan.triggers.map(t => <span key={t} className="trigger-chip">{triggerLabel(t)}</span>)}
              </div>

              <div className="plan-card-copy">
                {isCurrent
                  ? `This bundle is active right now with ${active?.remainingActiveHours || 0}h still available in the current week.`
                  : 'A cleaner weekly bundle for active-hour protection, automatic payouts, and simple wallet-based billing.'}
              </div>

              <div className="plan-card-actions">
                <button className="btn-outline plan-secondary-btn" onClick={() => setDetailPlanId(plan.id)}>
                  <Icon name="shield" size={14}/> View bundle
                </button>
                <button className="btn-outline plan-secondary-btn" onClick={() => setPricingPlanId(plan.id)}>
                  <Icon name="chart" size={14}/> Price breakdown
                </button>
                {isCurrent ? (
                  <div className="plan-active-actions">
                     <button 
                        className={`auto-pay-btn ${active?.autoRenew ? 'active' : ''}`}
                        onClick={toggleAutoRenew}
                        disabled={switching}
                      >
                        {switching ? <SpinInline /> : (
                          <>
                            <div className="apb-label">
                              <Icon name="refresh" size={14}/>
                              <span>Auto-Renew Status</span>
                            </div>
                            <div className="apb-status">{active?.autoRenew ? 'ACTIVE' : 'DISABLED'}</div>
                          </>
                        )}
                      </button>
                    <button className="btn-outline plan-secondary-btn" onClick={() => setShowTopUpModal(true)}>
                      <Icon name="plus" size={14}/> Top up this week
                    </button>
                    <button className="btn-outline-danger" onClick={() => setShowConfirm(true)} style={{ marginTop: 12 }}>
                      Terminate Coverage
                    </button>
                  </div>
                ) : (
                  <button
                    className="btn-primary"
                    disabled={buying === plan.id}
                    onClick={() => buy(plan.id, premium)}
                  >
                    {buying === plan.id ? <SpinInline /> : canAfford
                      ? 'Activate bundle'
                      : <><Icon name="plus" size={14}/> Add funds and activate</>
                    }
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div className="plan-note">
        <Icon name="shield" size={13}/>
        Hybrid weekly billing: each bundle gives you a 7-day protection cycle with included active hours, and you can top up extra hours for the same week if your current bundle runs low.
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// CLAIMS
// ═══════════════════════════════════════════════════════════════════
function Claims() {
  const [claims,    setClaims]    = useState([]);
  const [hasPolicy, setHasPolicy] = useState(false);
  const [loading,   setLoading]   = useState(true);
  const [simType,   setSimType]   = useState('rain');
  const [simming,   setSimming]   = useState(false);
  const [walletBal, setWalletBal] = useState(null);
  const [showManualModal, setShowManualModal] = useState(false);
  const [manualForm, setManualForm] = useState({ date: '', type: 'rain', hours: 4, reason: '' });
  const [submittingManual, setSubmittingManual] = useState(false);
  const [proofingId, setProofingId] = useState(null);

  const load = useCallback(async () => {
    try {
      const [c, p, w] = await Promise.all([claimsAPI.my(), policyAPI.active(), walletAPI.balance()]);
      setClaims(c.data.claims || []);
      setHasPolicy(!!p.data.policy);
      setWalletBal(w.data.balance);
    } catch { /* stay empty */ }
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
    const h = () => load();
    window.addEventListener('gs:refresh', h);
    const iv = setInterval(load, 5000);
    return () => {
      window.removeEventListener('gs:refresh', h);
      clearInterval(iv);
    };
  }, [load]);


  const submitManualClaim = async (e) => {
    e.preventDefault();
    setSubmittingManual(true);
    try {
      await claimsAPI.manual({
        reason: manualForm.reason,
        date: manualForm.date,
        disruptionHours: Number(manualForm.hours),
        type: manualForm.type
      });
      toast('Manual claim successfully submitted for review!');
      setShowManualModal(false);
      setManualForm({ date: '', type: 'rain', hours: 4, reason: '' });
      load();
    } catch {
      toast('Failed to submit manual claim', 'error');
    }
    setSubmittingManual(false);
  };

  const downloadProofPack = async (claimId) => {
    setProofingId(claimId);
    try {
      const res = await claimsAPI.proofPack(claimId);
      downloadTextFile(res.data.filename, res.data.markdown);
      toast('Proof Pack downloaded');
    } catch {
      toast('Could not generate Proof Pack', 'error');
    }
    setProofingId(null);
  };

  if (loading) return <Spinner />;

  const totalPaid = claims.filter(c => c.status === 'paid').reduce((s, c) => s + c.payoutAmount, 0);

  return (
    <div className="screen">
      <PageIntro
        eyebrow="Claims"
        title="Track payouts, proofs, and manual exceptions"
        meta={[
          { icon: 'rupee', label: 'Paid out', value: fmt(totalPaid) },
          { icon: 'file', label: 'Claims', value: String(claims.length) },
          walletBal !== null ? { icon: 'wallet', label: 'Wallet', value: fmt(walletBal) } : null,
        ].filter(Boolean)}
        actions={
          <button className="btn-ghost intro-btn" onClick={() => setShowManualModal(true)}>
            <Icon name="file" size={15} />
            File manual claim
          </button>
        }
      />

      {walletBal !== null && (
        <div className="claims-wallet-hint">
          <Icon name="wallet" size={13}/>
          <span>Payouts are credited instantly to your wallet · Current balance: <strong>{fmt(walletBal)}</strong></span>
        </div>
      )}

      {!hasPolicy && (
        <div className="empty">
          <div className="empty-icon">🛡️</div>
          <div className="empty-title">No active policy</div>
          <div className="empty-sub">Activate a weekly plan first. Claims are created automatically when disruptions hit your zone.</div>
          <button className="btn-primary" style={{ marginTop:20, width:'auto', padding:'12px 28px' }} onClick={() => nav('plans')}>
            View plans →
          </button>
        </div>
      )}

      <div className="claims-grid">
        {claims.map(c => (
          <div key={c.id} className="claim-card">
            <div className="claim-card-head">
              <div className={`claim-card-icon trigger-${c.triggerType}`}>{triggerLabel(c.triggerType).slice(0, 2).toUpperCase()}</div>
              <div className="claim-card-info">
                <div className="claim-card-title">{triggerLabel(c.triggerType)} coverage</div>
                <div className="claim-card-meta">{fmtDate(c.triggeredAt)} at {fmtTime(c.triggeredAt)}</div>
              </div>
              <div className={`status-pill ${c.status}`}>
                {c.status?.replace('_',' ')}
              </div>
            </div>
            <div className="claim-card-body">
              <div className="claim-stat-row"><span>Trigger Value</span><strong>{c.triggerValue}</strong></div>
              <div className="claim-stat-row"><span>Disruption</span><strong>{c.disruptionHours}h</strong></div>
              <div className="claim-stat-row"><span>Payout</span><strong className="payout-val">{fmt(c.payoutAmount)}</strong></div>
              {c.payoutGatewayLabel && <div className="claim-payout-rail"><Icon name="zap" size={11}/> {c.payoutGatewayLabel} · {c.payoutRail || 'Instant payout rail'}</div>}
              {c.upiRef && <div className="claim-payout-ref">Transfer ref: {c.upiRef}</div>}
              {c.weatherSource && <div className="claim-verified"><Icon name="check" size={10}/> Verified via {c.weatherSource} Satellite</div>}
              {c.payoutBreakdown && (
                <div className="claim-explainer">
                  <div className="claim-explainer-title">Explain My Payout</div>
                  <div className="claim-explainer-copy">{c.payoutBreakdown.explanation}</div>
                  <div className="claim-explainer-grid">
                    <div><span>Base hourly</span><strong>{fmt(c.payoutBreakdown.baseHourlyEarning)}</strong></div>
                    <div><span>Hours</span><strong>{c.payoutBreakdown.disruptionHours}h</strong></div>
                    <div><span>Trigger multiplier</span><strong>x{c.payoutBreakdown.triggerMultiplier}</strong></div>
                    <div><span>Weekly cap</span><strong>{fmt(c.payoutBreakdown.weeklyPayoutCap)}</strong></div>
                  </div>
                </div>
              )}
              <div className="claim-card-actions">
                <button className="btn-ghost proof-pack-btn" onClick={() => downloadProofPack(c.id)} disabled={proofingId === c.id}>
                  {proofingId === c.id ? <SpinInline /> : <><Icon name="download" size={13}/> Download Proof Pack</>}
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {claims.length > 0 && (
        <button className="btn-ghost" onClick={load} style={{ marginTop: 6, display:'flex', alignItems:'center', justifyContent:'center', gap:8 }}>
          <Icon name="refresh" size={14}/> Refresh
        </button>
      )}

      {showManualModal && (
        <div className="modal-overlay" onClick={() => setShowManualModal(false)}>
          <div className="modal-card" onClick={e => e.stopPropagation()} style={{ maxWidth: '440px', padding: '0', overflow: 'hidden' }}>
             {/* Header with gradient */}
             <div style={{ background: 'var(--accent-g)', padding: '24px 28px', color: '#fff' }}>
               <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
                 <Icon name="file" size={20}/>
                 <span style={{ fontFamily: 'var(--head)', fontSize: '20px', fontWeight: 800, letterSpacing: '-0.3px' }}>File Manual Claim</span>
               </div>
               <div style={{ fontSize: '13px', opacity: 0.85, fontWeight: 500 }}>
                 For disruptions not captured by automated triggers
               </div>
             </div>
                          {/* Body */}
             <div style={{ padding: '24px 28px 28px' }}>
              <form onSubmit={submitManualClaim} style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
                 <div className="manual-claim-field">
                    <label>Disruption Category</label>
                    <select value={manualForm.type} onChange={e => setManualForm({...manualForm, type: e.target.value})} required>
                      {['rain','aqi','heat','curfew','flood','cyclone','fog'].map(t => <option key={t} value={t}>{trigIcon(t)} {t}</option>)}
                      <option value="manual">📝 Other / Manual</option>
                    </select>
                 </div>

                 <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                   <div className="manual-claim-field">
                      <label>Date of Incident</label>
                      <input type="date" value={manualForm.date} onChange={e => setManualForm({...manualForm, date: e.target.value})} required max={new Date().toISOString().split('T')[0]} />
                   </div>
                   <div className="manual-claim-field">
                      <label>Hours Impacted</label>
                      <input type="number" min="1" max="24" value={manualForm.hours} onChange={e => setManualForm({...manualForm, hours: e.target.value})} required placeholder="4" />
                   </div>
                 </div>

                 <div className="manual-claim-field">
                    <label>Evidence & Details</label>
                    <textarea
                      rows="3"
                      value={manualForm.reason}
                      onChange={e => setManualForm({...manualForm, reason: e.target.value})}
                      placeholder="Describe the disruption, its impact on your deliveries, and any reference details…"
                      required
                    />
                 </div>

                 <div className="manual-claim-field">
                    <label>Supporting Documentation</label>
                    <div className="manual-claim-upload">
                       <div style={{ fontSize: '28px', marginBottom: '8px' }}>📎</div>
                       <div style={{ fontWeight: 700, color: 'var(--text)', fontSize: '13px' }}>Drop files or click to browse</div>
                       <div style={{ fontSize: '11px', color: 'var(--text3)', marginTop: '4px' }}>JPEG, PNG, PDF up to 5MB</div>
                    </div>
                 </div>

                 <div style={{ display: 'flex', gap: '12px', marginTop: '4px' }}>
                   <button type="button" className="btn-ghost" style={{ flex: 1, padding: '14px' }} onClick={() => setShowManualModal(false)}>Cancel</button>
                   <button type="submit" className="btn-primary" style={{ flex: 1.5, padding: '14px' }} disabled={submittingManual}>
                     {submittingManual ? <SpinInline /> : <><Icon name="send" size={14}/> Submit Claim</>}
                   </button>
                 </div>
              </form>
             </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Chart.js Canvas Wrappers ─────────────────────────────────────────────
function DoughnutChart({ data, colors, labels, centerLabel, centerSub }) {
  const ref = useRef(null);
  const instanceRef = useRef(null);

  useEffect(() => {
    if (!ref.current) return;
    if (instanceRef.current) { instanceRef.current.destroy(); instanceRef.current = null; }
    const existing = Chart.getChart(ref.current);
    if (existing) existing.destroy();
    instanceRef.current = new Chart(ref.current, {
      type: 'doughnut',
      data: {
        labels,
        datasets: [{ data, backgroundColor: colors, borderWidth: 0, hoverOffset: 4 }],
      },
      options: {
        cutout: '72%',
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: ctx => ` ${ctx.label}: ${ctx.parsed.toFixed(2)}`,
            },
            backgroundColor: '#1a1e2e',
            titleColor: '#eeeef5',
            bodyColor: '#8b8ea8',
            borderColor: 'rgba(255,255,255,0.07)',
            borderWidth: 1,
          },
        },
      },
    });
    return () => { if (instanceRef.current) { instanceRef.current.destroy(); instanceRef.current = null; } };
  }, [JSON.stringify(data)]);

  return (
    <div className="analytics-doughnut-wrap">
      <canvas ref={ref} />
      {centerLabel && (
        <div className="analytics-doughnut-center">
          <div className="adc-val">{centerLabel}</div>
          <div className="adc-sub">{centerSub}</div>
        </div>
      )}
    </div>
  );
}

function BarChartJS({ labels, datasets, yPrefix = '' }) {
  const ref = useRef(null);
  const instanceRef = useRef(null);

  useEffect(() => {
    if (!ref.current) return;
    if (instanceRef.current) { instanceRef.current.destroy(); instanceRef.current = null; }
    const existing = Chart.getChart(ref.current);
    if (existing) existing.destroy();
    instanceRef.current = new Chart(ref.current, {
      type: 'bar',
      data: { labels, datasets },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: datasets.length > 1, labels: { color: '#8b8ea8', font: { size: 11 }, boxWidth: 12 } },
          tooltip: {
            backgroundColor: '#1a1e2e',
            titleColor: '#eeeef5',
            bodyColor: '#8b8ea8',
            borderColor: 'rgba(255,255,255,0.07)',
            borderWidth: 1,
            callbacks: { label: ctx => ` ${yPrefix}${ctx.parsed.y}` },
          },
        },
        scales: {
          x: { ticks: { color: '#454762', font: { size: 11 } }, grid: { color: 'rgba(255,255,255,0.04)' } },
          y: { ticks: { color: '#454762', font: { size: 11 }, callback: v => `${yPrefix}${v}` }, grid: { color: 'rgba(255,255,255,0.04)' } },
        },
      },
    });
    return () => { if (instanceRef.current) { instanceRef.current.destroy(); instanceRef.current = null; } };
  }, [JSON.stringify(labels), JSON.stringify(datasets)]);

  return <div className="analytics-bar-wrap"><canvas ref={ref} /></div>;
}

function LineChartJS({ labels, datasets }) {
  const ref = useRef(null);
  const instanceRef = useRef(null);

  useEffect(() => {
    if (!ref.current) return;
    if (instanceRef.current) { instanceRef.current.destroy(); instanceRef.current = null; }
    const existing = Chart.getChart(ref.current);
    if (existing) existing.destroy();
    instanceRef.current = new Chart(ref.current, {
      type: 'line',
      data: { labels, datasets },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        tension: 0.4,
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: '#1a1e2e',
            titleColor: '#eeeef5',
            bodyColor: '#8b8ea8',
            borderColor: 'rgba(255,255,255,0.07)',
            borderWidth: 1,
          },
        },
        scales: {
          x: { ticks: { color: '#454762', font: { size: 11 } }, grid: { color: 'rgba(255,255,255,0.04)' } },
          y: { ticks: { color: '#454762', font: { size: 11 } }, grid: { color: 'rgba(255,255,255,0.04)' } },
        },
      },
    });
    return () => { if (instanceRef.current) { instanceRef.current.destroy(); instanceRef.current = null; } };
  }, [JSON.stringify(labels), JSON.stringify(datasets)]);

  return <div className="analytics-bar-wrap"><canvas ref={ref} /></div>;
}

// ─── Profile Analytics Section ────────────────────────────────────────────
function ProfileAnalytics({ claims, rp }) {
  const [analyticsTab, setAnalyticsTab] = useState('earnings');

  const paidClaims  = claims.filter(c => c.status === 'paid');
  const totalPayout = paidClaims.reduce((s, c) => s + c.payoutAmount, 0);
  const totalClaims = claims.length;

  // --- Earnings vs Payout (last 6 months) ---
  const months = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(); d.setMonth(d.getMonth() - (5 - i));
    return d.toLocaleString('en-IN', { month: 'short' });
  });
  const payoutByMonth = months.map((_, i) => {
    const d = new Date(); d.setMonth(d.getMonth() - (5 - i));
    const m = d.getMonth(), y = d.getFullYear();
    return paidClaims
      .filter(c => { const t = new Date(c.triggeredAt); return t.getMonth() === m && t.getFullYear() === y; })
      .reduce((s, c) => s + c.payoutAmount, 0);
  });
  const baseEarning = 80 * 45 * 4;
  const earningsData = months.map(() => baseEarning);

  // --- Trigger breakdown (doughnut) ---
  const trigTypes = ['rain', 'aqi', 'heat', 'curfew', 'flood'];
  const trigColors = ['#4f7fff', '#8b5cf6', '#f59e0b', '#ef4444', '#22c55e'];
  const trigCounts = trigTypes.map(t => claims.filter(c => c.triggerType === t).length);
  const nonZeroTrig = trigTypes.map((t, i) => ({ t, color: trigColors[i], count: trigCounts[i] })).filter(x => x.count > 0);

  // --- Fraud score trend (line) ---
  const fraudData = claims.slice(-8).map((c, i) => ({ x: `C${i + 1}`, y: c.fraudScore ?? 0 }));

  // --- Payout distribution bar ---
  const payoutBuckets = ['₹0–200', '₹200–500', '₹500–1k', '₹1k+'];
  const payoutBucketCounts = [
    paidClaims.filter(c => c.payoutAmount < 200).length,
    paidClaims.filter(c => c.payoutAmount >= 200 && c.payoutAmount < 500).length,
    paidClaims.filter(c => c.payoutAmount >= 500 && c.payoutAmount < 1000).length,
    paidClaims.filter(c => c.payoutAmount >= 1000).length,
  ];

  const TABS = [
    { id: 'earnings', label: 'Earnings' },
    { id: 'triggers', label: 'Triggers' },
    { id: 'payouts',  label: 'Payouts'  },
    { id: 'risk',     label: 'Risk'     },
  ];

  return (
    <div className="analytics-section">
      <div className="analytics-header">
        <div className="analytics-title-row">
          <Icon name="chart" size={15}/> Analytics
        </div>
        <div className="analytics-summary-pills">
          <span className="a-pill"><span className="a-pill-val">{totalClaims}</span> claims</span>
          <span className="a-pill"><span className="a-pill-val">{fmt(totalPayout)}</span> earned</span>
          <span className="a-pill"><span className="a-pill-val">{paidClaims.length}</span> paid</span>
        </div>
      </div>

      <div className="analytics-tabs">
        {TABS.map(t => (
          <button key={t.id} className={`analytics-tab-btn ${analyticsTab === t.id ? 'active' : ''}`} onClick={() => setAnalyticsTab(t.id)}>
            {t.label}
          </button>
        ))}
      </div>

      {analyticsTab === 'earnings' && (
        <div className="analytics-card">
          <div className="analytics-card-title">Monthly Payout vs Base Earnings</div>
          <div className="analytics-card-sub">6-month view · estimated base vs protected income</div>
          <BarChartJS
            labels={months}
            yPrefix="₹"
            datasets={[
              {
                label: 'Base Earnings',
                data: earningsData,
                backgroundColor: 'rgba(79,127,255,0.15)',
                borderColor: '#4f7fff',
                borderWidth: 2,
                borderRadius: 4,
              },
              {
                label: 'Claim Payouts',
                data: payoutByMonth,
                backgroundColor: 'rgba(34,197,94,0.25)',
                borderColor: '#22c55e',
                borderWidth: 2,
                borderRadius: 4,
              },
            ]}
          />
        </div>
      )}

      {analyticsTab === 'triggers' && (
        <div className="analytics-card">
          <div className="analytics-card-title">Disruption Trigger Breakdown</div>
          <div className="analytics-card-sub">Distribution of claim types</div>
          {nonZeroTrig.length === 0 ? (
            <div className="analytics-empty">No claims yet — trigger a disruption to see analytics</div>
          ) : (
            <>
              <DoughnutChart
                data={nonZeroTrig.map(x => x.count)}
                colors={nonZeroTrig.map(x => x.color)}
                labels={nonZeroTrig.map(x => x.t)}
                centerLabel={totalClaims}
                centerSub="total"
              />
              <div className="analytics-legend">
                {nonZeroTrig.map(x => (
                  <div key={x.t} className="analytics-legend-item">
                    <span className="analytics-legend-dot" style={{ background: x.color }}/>
                    <span className="analytics-legend-label">{trigIcon(x.t)} {x.t}</span>
                    <span className="analytics-legend-val">{x.count}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {analyticsTab === 'payouts' && (
        <div className="analytics-card">
          <div className="analytics-card-title">Payout Distribution</div>
          <div className="analytics-card-sub">Claim payout amount buckets</div>
          <BarChartJS
            labels={payoutBuckets}
            datasets={[{
              label: 'Claims',
              data: payoutBucketCounts,
              backgroundColor: ['rgba(79,127,255,0.7)', 'rgba(139,92,246,0.7)', 'rgba(245,158,11,0.7)', 'rgba(34,197,94,0.7)'],
              borderRadius: 6,
              borderWidth: 0,
            }]}
          />
          <div className="analytics-payout-stats">
            <div className="aps-item">
              <div className="aps-val">{fmt(Math.round(totalPayout / Math.max(paidClaims.length, 1)))}</div>
              <div className="aps-lbl">Avg payout</div>
            </div>
            <div className="aps-item">
              <div className="aps-val">{fmt(Math.max(...paidClaims.map(c => c.payoutAmount), 0))}</div>
              <div className="aps-lbl">Highest payout</div>
            </div>
            <div className="aps-item">
              <div className="aps-val">{paidClaims.length > 0 ? Math.round((paidClaims.length / Math.max(totalClaims, 1)) * 100) : 0}%</div>
              <div className="aps-lbl">Success rate</div>
            </div>
          </div>
        </div>
      )}

      {analyticsTab === 'risk' && rp && (
        <div className="analytics-card">
          <div className="analytics-card-title">AI Risk Score Breakdown</div>
          <div className="analytics-card-sub">Factors influencing your premium multiplier</div>
          <BarChartJS
            labels={Object.keys(rp.breakdown || {}).map(k => k.replace(/([A-Z])/g, ' $1').trim())}
            datasets={[{
              label: 'Risk factor',
              data: Object.values(rp.breakdown || {}).map(v => parseFloat((v * 10).toFixed(2))),
              backgroundColor: Object.values(rp.breakdown || {}).map(v =>
                v > 0.2 ? 'rgba(239,68,68,0.7)' : v > 0.1 ? 'rgba(245,158,11,0.7)' : 'rgba(34,197,94,0.7)'
              ),
              borderRadius: 5,
              borderWidth: 0,
            }]}
          />
          {fraudData.length > 1 && (
            <>
              <div className="analytics-card-title" style={{ marginTop: 20 }}>Fraud Score Trend</div>
              <div className="analytics-card-sub">Across your last {fraudData.length} claims</div>
              <LineChartJS
                labels={fraudData.map(d => d.x)}
                datasets={[{
                  data: fraudData.map(d => d.y),
                  borderColor: '#4f7fff',
                  backgroundColor: 'rgba(79,127,255,0.08)',
                  fill: true,
                  pointBackgroundColor: fraudData.map(d => d.y > 65 ? '#ef4444' : '#22c55e'),
                  pointRadius: 4,
                }]}
              />
            </>
          )}
          <div className="analytics-risk-summary">
            <div className="ars-row">
              <span>Multiplier</span>
              <strong>×{rp.multiplier}</strong>
            </div>
            <div className="ars-row">
              <span>Risk label</span>
              <strong className={`risk-label risk-${rp.riskLabel?.toLowerCase().split(' ')[0]}`}>{rp.riskLabel}</strong>
            </div>
            <div className="ars-row">
              <span>Pricing source</span>
              <strong>{rp.source === 'ml_service' ? 'ML Model' : 'Local formula'}</strong>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// PROFILE
// ═══════════════════════════════════════════════════════════════════
function Profile() {
  const { user, setUser, logout } = useAuth();
  const [profile, setProfile] = useState(null);
  const [claims,  setClaims]  = useState([]);
  const [zones,   setZones]   = useState([]);
  const [updating, setUpdating] = useState(false);
  const [savingEmail, setSavingEmail] = useState(false);
  const [emailDraft, setEmailDraft] = useState(user?.email || '');
  const [selCity, setSelCity] = useState(user?.zone?.city || 'Mumbai');

  const load = useCallback(async () => {
    try {
      const [r1, r2, r3] = await Promise.all([workerAPI.riskProfile(), workerAPI.zones(), claimsAPI.my()]);
      setProfile(r1.data);
      setZones(r2.data.zones);
      setClaims(r3.data.claims || []);
      if (r1.data.riskProfile?.zone?.city) setSelCity(r1.data.riskProfile.zone.city);
    } catch {}
  }, []);

  useEffect(() => {
    load();
    const h = () => load();
    window.addEventListener('gs:refresh', h);
    return () => window.removeEventListener('gs:refresh', h);
  }, [load]);

  useEffect(() => {
    setEmailDraft(user?.email || '');
  }, [user?.email]);

  const cities = [...new Set(zones.map(z => z.city))];
  const filteredZones = zones.filter(z => z.city === selCity);

  const changeZone = async (e) => {
    const zoneId = e.target.value;
    setUpdating(true);
    try {
      const r = await workerAPI.updateProfile({ zoneId });
      setUser(s => ({ ...s, ...r.data.worker }));
      load();
      toast('📍 Work zone updated');
    } catch { toast('Failed to update zone', 'error'); }
    setUpdating(false);
  };

  const saveEmail = async () => {
    if (!emailDraft.trim()) {
      toast('Email is required for alerts', 'error');
      return;
    }
    setSavingEmail(true);
    try {
      const r = await workerAPI.updateProfile({ email: emailDraft.trim() });
      setUser(s => ({ ...s, ...r.data.worker }));
      toast('📧 Alert email updated');
    } catch (err) {
      toast(err.response?.data?.error || 'Failed to update email', 'error');
    }
    setSavingEmail(false);
  };

  const rp = profile?.riskProfile;
  const quickProfileStats = [
    { label: 'Platform', value: user?.platform || 'Worker' },
    { label: 'Zone', value: user?.zone?.name || 'Not selected' },
    { label: 'Phone', value: user?.phone || 'Not available' },
  ];

  return (
    <div className="screen">
      <PageIntro
        eyebrow="Profile"
        title="Keep your account, zone, and pricing context in sync"
        meta={[
          { icon: 'user', label: 'Partner', value: user?.platform || 'Worker' },
          { icon: 'shield', label: 'Coverage zone', value: user?.zone?.name || 'Not selected' },
        ]}
      />

      <div className="profile-card">
        <div className="profile-hero-main">
          <div className="profile-avatar">{user?.name?.[0]?.toUpperCase()}</div>
          <div className="profile-hero-copy">
            <div className="profile-name">{user?.name}</div>
            <div className="profile-meta">{user?.platform} partner · {user?.phone}</div>
            <div className="profile-status-row">
              <span className="profile-status-pill">Active worker profile</span>
              <span className="profile-status-pill muted">{user?.zone?.city || 'City pending'}</span>
            </div>
          </div>
        </div>
        <div className="profile-stat-strip">
          {quickProfileStats.map(item => (
            <div key={item.label} className="profile-stat-pill">
              <span>{item.label}</span>
              <strong>{item.value}</strong>
            </div>
          ))}
        </div>
      </div>

      <div className="section">
        <div className="section-label">Account Preferences</div>
        <div className="glass-panel profile-settings-card" style={{ padding: '20px', marginBottom: '24px' }}>
          <div className="profile-field">
            <label>Email For Alerts</label>
            <input
              type="email"
              value={emailDraft}
              onChange={e => setEmailDraft(e.target.value)}
              placeholder="you@example.com"
            />
            <button className="btn-primary" style={{ marginTop: 10 }} onClick={saveEmail} disabled={savingEmail || !emailDraft.trim()}>
              {savingEmail ? <SpinInline /> : 'Save Email'}
            </button>
          </div>
          <div className="profile-setting-grid">
            <div className="profile-field">
              <label>Operating City</label>
              <select value={selCity} onChange={(e) => setSelCity(e.target.value)}>
                {cities.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div className="profile-field" style={{ marginBottom: 0 }}>
              <label>Verified Coverage Zone</label>
              <select value={user?.zoneId} onChange={changeZone} disabled={updating}>
                {filteredZones.map(z => <option key={z.id} value={z.id}>{z.name}</option>)}
              </select>
              {updating && <div className="profile-inline-note">Syncing location data…</div>}
            </div>
          </div>
        </div>
      </div>

      {rp && (
        <div className="section">
          <div className="section-label">Institutional Risk Profile</div>
          <div className="risk-card">
            <div className="risk-zone-row">
              <div className="risk-zone-name">{rp.zone} Specialist</div>
              <div className={`status-pill ${rp.riskLabel?.toLowerCase().split(' ')[0]}`}>{rp.riskLabel} Risk</div>
            </div>
            <div className="metric-grid">
              <div className="metric-box"><div className="m-val">9.2</div><div className="m-lbl">Safety Rating</div></div>
              <div className="metric-box"><div className="m-val">Zone A</div><div className="m-lbl">Stability Tier</div></div>
            </div>
            <div className="risk-rows">
              {Object.entries(rp.breakdown || {}).map(([k, v]) => (
                <div key={k} className="risk-row">
                  <div className="risk-row-label"><span>{k.replace(/([A-Z])/g,' $1').trim()}</span><span>{(v * 10).toFixed(1)}/10</span></div>
                  <div className="risk-bar-track"><div className="risk-bar-fill" style={{ width:`${Math.min(100,v*300)}%`, background: v > 0.2 ? 'var(--red)' : v > 0.1 ? 'var(--amber)' : 'var(--green)' }} /></div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      <ProfileAnalytics claims={claims} rp={rp} />

      <div style={{ marginTop: 32 }}>
        <button className="btn-danger" onClick={logout}>
          <Icon name="logout" size={16}/> 
          <span>Sign out from ArthRaksh</span>
        </button>
      </div>
    </div>
  );
}

function AssistantPanel() {
  const starterSuggestions = [
    'What is my wallet balance?',
    'Add ₹500 to wallet',
    'Recommend a plan',
    'Change my zone to Bandra',
  ];
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState('');
  const [language, setLanguage] = useState('English');
  const [messages, setMessages] = useState([
    {
      role: 'assistant',
      content: 'I am Sia, your multilingual GigShield assistant. I can handle plans, claims, wallet actions, zone updates, and demo simulations. For money actions, I now collect the amount, gateway, payment method, and the demo payment details before anything is processed.',
      suggestions: starterSuggestions,
    },
  ]);
  const [loading, setLoading] = useState(false);
  const [listening, setListening] = useState(false);
  const [conversationState, setConversationState] = useState(null);
  const recognitionRef = useRef(null);
  const endRef = useRef(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, open]);

  const latestAssistantMessage = [...messages].reverse().find(message => message.role === 'assistant');
  const liveSuggestions = latestAssistantMessage?.suggestions?.length
    ? latestAssistantMessage.suggestions
    : starterSuggestions;

  const gatewayName = gatewayId => {
    if (gatewayId === 'stripe_sandbox') return 'Stripe Sandbox';
    if (gatewayId === 'razorpay_test') return 'Razorpay Test Mode';
    return 'demo payment rail';
  };

  const pendingHeadline = action => {
    if (!action?.type) return null;
    if (action.type === 'wallet_add') return 'Wallet top-up awaiting confirmation';
    if (action.type === 'wallet_withdraw') return 'Withdrawal awaiting confirmation';
    if (action.type === 'buy_policy') return 'Policy purchase ready';
    if (action.type === 'renew_policy') return 'Policy renewal ready';
    if (action.type === 'change_zone') return 'Zone change pending';
    if (action.type === 'manual_claim') return 'Manual claim draft';
    return 'Action pending';
  };

  const pendingCopy = action => {
    if (!action?.type) return '';
    if (action.type === 'wallet_add') {
      const amount = action.params?.amount ? fmt(action.params.amount) : 'an amount';
      const rail = action.params?.gatewayId ? gatewayName(action.params.gatewayId) : 'a payment rail';
      const method = action.params?.method ? ` · ${action.params.method.toUpperCase()}` : '';
      const detail = action.params?.upiId
        ? ` · ${action.params.upiId}`
        : action.params?.bank
          ? ` · ${action.params.bank.toUpperCase()}`
          : action.params?.cardLast4 || action.params?.cardNumber
            ? ` · card ending ${(action.params.cardLast4 || action.params.cardNumber?.slice(-4))}`
            : '';
      return `${amount} via ${rail}${method}${detail}`;
    }
    if (action.type === 'wallet_withdraw') {
      return `${action.params?.amount ? fmt(action.params.amount) : 'Amount pending'} to ${action.params?.upiId || 'UPI pending'}`;
    }
    if (action.type === 'buy_policy' || action.type === 'renew_policy') {
      return action.params?.planId ? `Plan: ${action.params.planId}` : 'Plan selection pending';
    }
    if (action.type === 'change_zone') return action.params?.zoneId || 'Zone selection pending';
    if (action.type === 'manual_claim') return action.params?.type || 'Claim details pending';
    return 'One more confirmation needed';
  };

  const speak = (text) => {
    if (!window.speechSynthesis || !text) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = language === 'Hindi' ? 'hi-IN'
      : language === 'Bengali' ? 'bn-IN'
      : language === 'Tamil' ? 'ta-IN'
      : language === 'Marathi' ? 'mr-IN'
      : 'en-IN';
    window.speechSynthesis.speak(utterance);
  };

  const sendMessage = async (rawPrompt) => {
    const prompt = (rawPrompt ?? input).trim();
    if (!prompt || loading) return;

    const nextHistory = [...messages, { role: 'user', content: prompt }];
    setMessages(nextHistory);
    setInput('');
    setLoading(true);

    try {
      const res = await chatbotAPI.message({
        message: prompt,
        language,
        history: nextHistory.slice(-10),
        conversationState,
      });

      const assistantText = res.data.reply || 'I am here with you. Tell me what you need next.';
      setConversationState(res.data.conversationState || null);
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: assistantText,
        actions: res.data.executedActions || [],
        suggestions: res.data.suggestions || [],
        pendingAction: res.data.conversationState?.pendingAction || null,
        actionResult: res.data.actionResult || null,
        pending: !!res.data.conversationState?.pendingAction,
      }]);
      if (res.data.ui?.navigateTo) nav(res.data.ui.navigateTo);
      if (res.data.ui?.refresh || res.data.actionResult?.success) {
        setTimeout(() => window.dispatchEvent(new CustomEvent('gs:refresh')), 150);
      }
      speak(assistantText);
    } catch (err) {
      const errorMsg = err.response?.data?.error || 'The assistant could not respond right now.';
      setMessages(prev => [...prev, { role: 'assistant', content: errorMsg }]);
    }

    setLoading(false);
  };

  const toggleListening = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      toast('Voice recognition is not supported in this browser', 'error');
      return;
    }

    if (listening && recognitionRef.current) {
      recognitionRef.current.stop();
      setListening(false);
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = language === 'Hindi' ? 'hi-IN'
      : language === 'Bengali' ? 'bn-IN'
      : language === 'Tamil' ? 'ta-IN'
      : language === 'Marathi' ? 'mr-IN'
      : 'en-IN';
    recognition.interimResults = true;
    recognition.continuous = false;
    recognition.onstart = () => setListening(true);
    recognition.onresult = (event) => {
      const transcript = Array.from(event.results).map(r => r[0]?.transcript || '').join(' ');
      setInput(transcript.trim());
    };
    recognition.onend = () => setListening(false);
    recognition.onerror = () => setListening(false);
    recognitionRef.current = recognition;
    recognition.start();
  };

  return (
    <div className={`assistant-shell ${open ? 'open' : ''}`}>
      {open && (
        <div className="assistant-panel">
          <div className="assistant-header">
            <div className="assistant-identity">
              <div className="assistant-avatar">
                <div className="assistant-avatar-face">
                  <span />
                  <span />
                </div>
              </div>
              <div>
                <div className="assistant-name">Sia Agent Assistant</div>
                <div className="assistant-sub">Conversational control for coverage, claims, wallet, profile, and demo flows</div>
              </div>
            </div>
            <button className="assistant-close" onClick={() => setOpen(false)}>
              <Icon name="x" size={16} />
            </button>
          </div>

          <div className="assistant-statusbar">
            <div className="assistant-status-pill">Secure actions</div>
            <div className="assistant-status-copy">Money actions now require amount, gateway choice, and confirmation.</div>
          </div>

          <div className="assistant-toolbar">
            <select value={language} onChange={e => setLanguage(e.target.value)}>
              {assistantLanguages.map(lang => <option key={lang.id} value={lang.id}>{lang.label}</option>)}
            </select>
            <button className={`assistant-voice-btn ${listening ? 'live' : ''}`} onClick={toggleListening}>
              <Icon name="mic" size={14} /> {listening ? 'Listening…' : 'Speak'}
            </button>
          </div>

          <div className="assistant-feed">
            {messages.map((message, idx) => (
              <div key={idx} className={`assistant-msg ${message.role}`}>
                <div className="assistant-stack">
                  <div className="assistant-bubble">{message.content}</div>
                  {message.pendingAction && (
                    <div className="assistant-pending-card">
                      <div className="assistant-pending-title">{pendingHeadline(message.pendingAction)}</div>
                      <div className="assistant-pending-copy">{pendingCopy(message.pendingAction)}</div>
                    </div>
                  )}
                  {!!message.actions?.length && (
                    <div className="assistant-action-row">
                      {message.actions.map((action, actionIdx) => (
                        <span
                          key={`${action.label}-${actionIdx}`}
                          className={`assistant-action-pill ${action.success ? 'success' : 'neutral'}`}
                        >
                          {action.label}
                        </span>
                      ))}
                    </div>
                  )}
                  {message.pending && (
                    <div className="assistant-pending-note">Waiting on one more detail or your confirmation.</div>
                  )}
                </div>
              </div>
            ))}
            {loading && (
              <div className="assistant-msg assistant">
                <div className="assistant-bubble">Understanding your request and taking the next step…</div>
              </div>
            )}
            <div ref={endRef} />
          </div>

          <div className="assistant-suggestions">
            {liveSuggestions.slice(0, 4).map(suggestion => (
              <button
                key={suggestion}
                className="assistant-chip"
                onClick={() => sendMessage(suggestion)}
                disabled={loading}
              >
                {suggestion}
              </button>
            ))}
          </div>

          <div className="assistant-input">
            <div className="assistant-input-shell">
              <div className="assistant-input-label">Message Sia</div>
              <div className="assistant-compose-row">
                <textarea
                  rows="2"
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      sendMessage();
                    }
                  }}
                  placeholder="Try: add ₹500 to wallet, renew my plan, move me to Bandra, file a flood claim for 3 hours..."
                />
                <button className="assistant-send" onClick={() => sendMessage()} disabled={loading || !input.trim()}>
                  <Icon name="send" size={15} />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <button className="assistant-fab" onClick={() => setOpen(v => !v)}>
        <div className="assistant-fab-avatar">
          <div className="assistant-avatar-face">
            <span />
            <span />
          </div>
        </div>
        <div className="assistant-fab-copy">
          <strong>Sia</strong>
          <span>Smart help</span>
        </div>
      </button>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// WORKER APP SHELL
// ═══════════════════════════════════════════════════════════════════
function WorkerApp() {
  const { user } = useAuth();
  const [page, setPage] = useState('home');
  const [simType, setSimType] = useState('rain');
  const [simming, setSimming] = useState(false);
  const [walletBal, setWalletBal] = useState(null);

  useEffect(() => {
    const h = e => setPage(e.detail);
    window.addEventListener('gs:nav', h);
    return () => window.removeEventListener('gs:nav', h);
  }, []);

  useEffect(() => {
    let active = true;

    const loadWalletBalance = async () => {
      try {
        const res = await walletAPI.balance();
        if (active) setWalletBal(res.data.balance ?? 0);
      } catch {
        if (active) setWalletBal(null);
      }
    };

    loadWalletBalance();
    window.addEventListener('gs:refresh', loadWalletBalance);
    return () => {
      active = false;
      window.removeEventListener('gs:refresh', loadWalletBalance);
    };
  }, []);

  const refreshAll = () => window.dispatchEvent(new CustomEvent('gs:refresh'));

  const simulate = async () => {
    setSimming(true);
    try {
      await triggerAPI.simulate(simType);
      toast(`${trigIcon(simType)} ${simType} disruption triggered — refreshing UI…`);
      setTimeout(refreshAll, 1000);
    } catch (err) {
      toast(err.response?.data?.error || 'Simulation failed', 'error');
    }
    setSimming(false);
  };

  const simulateExpiry = async () => {
    setSimming(true);
    try {
      await policyAPI.simulateExpire();
      toast('⏳ Expiry simulation triggered! Checking notifications…');
      setTimeout(refreshAll, 500); 
    } catch (err) {
      toast(err.response?.data?.error || 'Simulated expiry failed', 'error');
    }
    setSimming(false);
  };

  const NAV = [
    { id:'home',    label:'Home',    icon:'home'   },
    { id:'intel',   label:'Risk',    icon:'zap'    },
    { id:'plans',   label:'Plans',   icon:'shield' },
    { id:'claims',  label:'Claims',  icon:'file'   },
    { id:'wallet',  label:'Wallet',  icon:'wallet' },
    { id:'profile', label:'Profile', icon:'user'   },
  ];
  const activeNav = NAV.find(item => item.id === page) || NAV[0];
  const userInitial = user?.name?.[0] || 'A';

  return (
    <div className="app-shell responsive-shell fintech-app-shell">
      <div className="app-backdrop" />
      {/* Desktop Sidebar */}
      <div className="desktop-sidebar">
        <div className="desktop-sidebar-top">
          <div className="sidebar-brand">
            <Icon name="shield" size={24}/>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
              <span className="sidebar-brand-name">ArthRaksh</span>
              <span className="live-badge" style={{ marginLeft: 0, marginTop: 4 }}>LIVE</span>
            </div>
          </div>
          <nav className="desktop-nav">
            {NAV.map(n => (
              <button key={n.id} className={`desktop-nav-btn ${page===n.id?'active':''}`} onClick={() => setPage(n.id)}>
                <Icon name={n.icon} size={20}/>
                <span>{n.label}</span>
              </button>
            ))}
          </nav>

          <button className="sidebar-wallet-card" onClick={() => setPage('wallet')}>
            <div className="sidebar-wallet-top">
              <span className="sidebar-wallet-label">
                <Icon name="wallet" size={14}/>
                Wallet balance
              </span>
              <span className="sidebar-wallet-link">Open</span>
            </div>
            <strong className="sidebar-wallet-value">
              {walletBal === null ? 'Loading...' : fmt(walletBal)}
            </strong>
          </button>

          <div className="sidebar-sim">
            <div className="sim-label"><Icon name="zap" size={12}/> Scenario Simulation</div>
            <select value={simType} onChange={e => setSimType(e.target.value)} className="sim-select-sidebar">
              {['rain','aqi','heat','curfew','flood', 'cyclone', 'fog'].map(t => <option key={t} value={t}>{trigIcon(t)} {t}</option>)}
            </select>
            <button className="sim-btn-sidebar sim-btn-primary" onClick={simulate} disabled={simming}>
              {simming ? <SpinInline /> : <><Icon name="play" size={13}/> Trigger Event</>}
            </button>
            <button className="sim-btn-sidebar sim-btn-outline" onClick={simulateExpiry} disabled={simming}>
              {simming ? <SpinInline /> : <><Icon name="clock" size={13}/> Force Expiry</>}
            </button>
          </div>
        </div>
        <div className="desktop-user">
          <div className="avatar">{user?.name?.[0]}</div>
          <div className="desktop-user-info" style={{ flex: 1 }}>
            <div className="desktop-user-name">{user?.name}</div>
            <div className="desktop-user-role">Partner • {user?.platform}</div>
          </div>
          <button className="btn-ghost" onClick={() => { localStorage.removeItem('gs_token'); window.location.reload(); }} style={{ padding: '8px' }}>
            <Icon name="logout" size={16}/>
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="app-main">
        {/* Mobile Header */}
        <div className="app-header">
          <div className="header-meta">
            <div className="header-brand">
              <Icon name="shield" size={19}/>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
                <span>ArthRaksh</span>
                <span className="live-badge" style={{ marginLeft: 0, marginTop: 2 }}>LIVE</span>
              </div>
            </div>
            <div className="header-context">
              <strong>{activeNav.label}</strong>
              <span>{user?.zone?.name || user?.zone?.city || 'Protected workspace'}</span>
            </div>
          </div>
          <div className="header-right">
            <div className="header-balance-pill">
              <span>Protected</span>
              <strong>Live</strong>
            </div>
            <div className="header-profile">
              <div className="header-name-group">
                <span className="header-name">{firstName(user?.name)}</span>
                <small>{user?.platform || 'Partner'}</small>
              </div>
              <div className="avatar">{userInitial}</div>
            </div>
            <button className="btn-ghost" onClick={() => { localStorage.removeItem('gs_token'); window.location.reload(); }} style={{ padding: '6px', marginLeft: '4px' }}>
              <Icon name="logout" size={16}/>
            </button>
          </div>
        </div>

        <div className="app-content content-scroll">
          <div className="content-inner">
            {page === 'home'    && <Home    />}
            {page === 'intel'   && <Intel   />}
            {page === 'plans'   && <Plans   />}
            {page === 'claims'  && <Claims  />}
            {page === 'wallet'  && <Wallet  />}
            {page === 'profile' && <Profile />}
          </div>
        </div>

        {/* Mobile Bottom Nav */}
        <nav className="bottom-nav">
          {NAV.map(n => (
            <button key={n.id} className={`nav-btn ${page===n.id?'active':''}`} onClick={() => setPage(n.id)}>
              <Icon name={n.icon} size={21}/>
              <span>{n.label}</span>
            </button>
          ))}
        </nav>
        <AssistantPanel />
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// ADMIN DASHBOARD
// ═══════════════════════════════════════════════════════════════════
function AdminDash({ onLogout }) {
  const [data,     setData]     = useState(null);
  const [loading,  setLoading]  = useState(true);
  const [tab,      setTab]      = useState('overview');
  const [simType,  setSimType]  = useState('rain');
  const [simming,  setSimming]  = useState(false);
  const [payoutGateways, setPayoutGateways] = useState([]);
  const [claimGatewayId, setClaimGatewayId] = useState('razorpay_test');
  const [proofingId, setProofingId] = useState(null);

  const load = useCallback(async () => {
    try { const r = await dashAPI.admin(); setData(r.data); }
    catch { toast('Failed to load admin data', 'error'); }
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
    const iv = setInterval(load, 4000);
    return () => clearInterval(iv);
  }, [load]);

  useEffect(() => {
    walletAPI.gateways('payout')
      .then(r => {
        const next = r.data.gateways || [];
        setPayoutGateways(next);
        if (next.length && !next.some(gateway => gateway.id === claimGatewayId)) {
          setClaimGatewayId(next[0].id);
        }
      })
      .catch(() => {});
  }, [claimGatewayId]);

  const simulate = async () => {
    setSimming(true);
    try { await triggerAPI.simulate(simType); toast(`⚡ ${simType} simulated`); setTimeout(load, 1500); }
    catch { toast('Simulation failed', 'error'); }
    setSimming(false);
  };

  const handleClaim = async (id, action) => {
    try {
      if (action === 'approve') await claimsAPI.approve(id, claimGatewayId);
      else                       await claimsAPI.reject(id, 'Fraud confirmed');
      const gatewayLabel = payoutGateways.find(gateway => gateway.id === claimGatewayId)?.label;
      toast(action === 'approve' ? `✅ Approved & paid via ${gatewayLabel || 'instant payout rail'}` : '❌ Rejected');
      load();
    } catch { toast('Action failed', 'error'); }
  };

  const downloadProofPack = async (claimId) => {
    setProofingId(claimId);
    try {
      const res = await claimsAPI.proofPack(claimId);
      downloadTextFile(res.data.filename, res.data.markdown);
      toast('Proof Pack downloaded');
    } catch {
      toast('Could not generate Proof Pack', 'error');
    }
    setProofingId(null);
  };

  if (loading) return <Spinner />;
  if (!data)   return null;

  const { summary, byTrigger, weeklyTrend, zoneStats, recentClaims, fraudQueue, zonePulse } = data;
  const rankedZones = zonePulse?.ranked || [];
  const triggerEntries = Array.isArray(byTrigger)
    ? byTrigger
    : Object.entries(byTrigger || {}).map(([t, claims]) => ({ t, claims }));
  const topZone = rankedZones[0];
  const latestClaim = recentClaims[0];
  const freshCount = recentClaims.filter(c => c.status === 'processing' || c.status === 'fraud_review').length;
  const triggerLeader = [...triggerEntries].sort((a, b) => (b.claims || 0) - (a.claims || 0))[0];
  const introMeta = [
    { icon: 'clock', label: 'Last refresh', value: zonePulse?.updatedAt ? `${fmtDate(zonePulse.updatedAt)} · ${fmtTime(zonePulse.updatedAt)}` : 'Live' },
    { icon: 'alert', label: 'Fraud queue', value: `${fraudQueue?.length || 0} cases` },
    { icon: 'shield', label: 'Top risk zone', value: topZone ? `${topZone.name}, ${topZone.city}` : 'No hotspot' },
  ];
  const overviewBoard = [
    {
      icon: 'user',
      label: 'Protected workforce',
      value: `${summary.totalWorkers} workers`,
      copy: `${summary.activePolicies} active policies are currently attached to live delivery profiles.`,
    },
    {
      icon: 'rupee',
      label: 'Premium collected',
      value: fmt(summary.premiumIn),
      copy: `Current book has paid out ${fmt(summary.paidOut)} with a ${summary.lossRatio}% loss ratio.`,
    },
    {
      icon: 'alert',
      label: 'Review pressure',
      value: `${freshCount} live cases`,
      badge: fraudQueue?.length ? 'Action needed' : 'Clear',
      badgeTone: fraudQueue?.length ? 'moderate' : 'safe',
      copy: fraudQueue?.length
        ? `${fraudQueue.length} claims are waiting on fraud review before payout release.`
        : 'No claims are blocked in fraud review right now.',
    },
    {
      icon: 'zap',
      label: 'Trigger leading volume',
      value: triggerLeader ? `${trigIcon(triggerLeader.t)} ${triggerLabel(triggerLeader.t)}` : 'No trigger data',
      copy: triggerLeader ? `${triggerLeader.claims} claims linked to this disruption type in the current dataset.` : 'Trigger analytics will populate once claims arrive.',
    },
  ];
  const adminJourney = [
    { icon: 'alert', title: 'Review the queue first', copy: 'Start with fraud review so blocked claims do not sit unattended while payout-ready cases pile up.' },
    { icon: 'chart', title: 'Read zone movement', copy: 'Use the pulse map to spot neighborhoods where disruption intensity is rising before claims accelerate.' },
    { icon: 'shield', title: 'Adjust plans with context', copy: 'Tune weekly cover, payout ceilings, and covered hours only after checking recent trigger and payout behavior.' },
  ];
  const TABS = [
    { id:'overview', label:'Overview' },
    { id:'claims',   label:'Claims'   },
    { id:'fraud',    label:`Fraud (${fraudQueue?.length||0})` },
    { id:'zones',    label:'Zones'    },
    { id:'plans',    label:'Manage Plans' }
  ];

  return (
    <div className="admin-shell">
      <div className="admin-sidebar">
        <div className="admin-sidebar-brand">
          <Icon name="grid" size={22}/>
          <div>
            <span>ArthRaksh Admin</span>
            <small>Insurer control workspace</small>
          </div>
        </div>
        <div className="admin-sidebar-body">
          <nav className="admin-nav">
            {TABS.map(t => <button key={t.id} className={`admin-nav-btn ${tab===t.id?'active':''}`} onClick={() => setTab(t.id)}>{t.label}</button>)}
          </nav>
        </div>
        <div className="admin-sidebar-footer">
          <div className="admin-sim-box">
            <div className="sim-title"><Icon name="zap" size={13}/> Simulate trigger</div>
            <select value={simType} onChange={e => setSimType(e.target.value)} className="sim-select">
              {['rain','aqi','heat','curfew','flood','cyclone','fog'].map(t => <option key={t} value={t}>{trigIcon(t)} {triggerLabel(t)}</option>)}
            </select>
            <button className="btn-sim" onClick={simulate} disabled={simming} style={{ width:'100%', marginTop:8 }}>
              {simming ? <SpinInline/> : 'Run trigger'}
            </button>
          </div>
          <button className="admin-logout" onClick={onLogout}><Icon name="logout" size={14}/> Log out</button>
        </div>
      </div>

      <div className="admin-main">
        <div className="admin-mobile-header">
          <div className="admin-mobile-brand">
            <Icon name="grid" size={18} />
            <div>
              <strong>ArthRaksh Admin</strong>
              <span>Insurer control workspace</span>
            </div>
          </div>
          <button className="admin-mobile-logout" onClick={onLogout}><Icon name="logout" size={14}/> Log out</button>
        </div>

        <div className="admin-mobile-nav">
          {TABS.map(t => (
            <button key={t.id} className={`admin-mobile-tab ${tab===t.id?'active':''}`} onClick={() => setTab(t.id)}>
              {t.label}
            </button>
          ))}
        </div>

        {tab === 'overview' && <>
          <PageIntro
            eyebrow="Admin overview"
            meta={introMeta}
          />
          <MetricBoard items={overviewBoard} />
          <JourneyGuide title="Operating rhythm" subtitle="A tighter review sequence for the live book" items={adminJourney} className="admin-journey" />
          <div className="admin-chart-grid">
            <div className="chart-card admin-surface">
              <div className="chart-title">Weekly payout trend</div>
              <ResponsiveContainer width="100%" height={180}>
                <AreaChart data={weeklyTrend}>
                  <XAxis dataKey="week" tick={{ fontSize:11 }}/>
                  <YAxis tick={{ fontSize:11 }}/>
                  <Tooltip formatter={v => fmt(v)}/>
                  <Area type="monotone" dataKey="payout" stroke="#4f7fff" fill="rgba(79,127,255,.15)"/>
                </AreaChart>
              </ResponsiveContainer>
            </div>
            <div className="chart-card admin-surface">
              <div className="chart-title">Weekly claim count</div>
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={weeklyTrend}>
                  <XAxis dataKey="week" tick={{ fontSize:11 }}/>
                  <YAxis tick={{ fontSize:11 }}/>
                  <Tooltip/>
                  <Bar dataKey="claims" fill="#8b5cf6" radius={[4,4,0,0]}/>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
          <ZonePulsePanel pulse={zonePulse} title="Zone Pulse" subtitle="Live ranking of neighborhoods by disruption risk, claim frequency, and payout intensity" />
        </>}

        {tab === 'claims' && <>
          <PageIntro
            eyebrow="Claims"
            title="Claims across the network"
            subtitle="Scan worker, trigger, payout rail, fraud score, and proof-pack status from one table."
            meta={[
              { icon: 'file', label: 'Recent claims', value: `${recentClaims.length}` },
              { icon: 'check', label: 'Latest status', value: latestClaim ? latestClaim.status?.replace('_', ' ') : 'No claims yet' },
            ]}
          />
          <div className="claims-table-wrap admin-surface">
            <table className="claims-table">
              <thead><tr><th>Worker</th><th>Trigger</th><th>Hours</th><th>Payout</th><th>Rail</th><th>Fraud</th><th>Status</th><th>Date</th><th>Packet</th></tr></thead>
              <tbody>
                {recentClaims.map(c => (
                  <tr key={c.id}>
                    <td>{c.worker?.name || '—'}</td>
                    <td><span className={`admin-trigger-chip ${triggerTone(c.triggerType)}`}>{trigIcon(c.triggerType)} {triggerLabel(c.triggerType)}</span></td>
                    <td>{c.disruptionHours}h</td>
                    <td>{fmt(c.payoutAmount)}</td>
                    <td>{c.payoutGatewayLabel ? <span className="inline-gateway-tag">{c.payoutGatewayLabel}</span> : <span style={{ color:'var(--text3)' }}>Pending</span>}</td>
                    <td>
                      <div className="fraud-bar-wrap">
                        <div className="fraud-bar-track"><div className="fraud-bar-fill" style={{ width:`${c.fraudScore}%`, background: c.fraudScore>65?'#ef4444':c.fraudScore>35?'#f59e0b':'#22c55e' }}/></div>
                        <span style={{ fontSize:11, color:'var(--text2)' }}>{c.fraudScore}</span>
                      </div>
                    </td>
                    <td><span className="status-pill" style={{ background:statusColor(c.status)+'22', color:statusColor(c.status) }}>{c.status?.replace('_',' ')}</span></td>
                    <td style={{ color:'var(--text2)', fontSize:12 }}>{fmtDate(c.triggeredAt)}</td>
                    <td>
                      <button className="table-proof-btn" onClick={() => downloadProofPack(c.id)} disabled={proofingId === c.id}>
                        {proofingId === c.id ? '...' : 'Download'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>}

        {tab === 'fraud' && <>
          <PageIntro
            eyebrow="Fraud review"
            title="Review suspicious claims before payout release."
            subtitle="Keep the queue moving with a selected payout rail ready for the claims that clear review."
            meta={[
              { icon: 'alert', label: 'Queue size', value: `${fraudQueue.length}` },
              { icon: 'wallet', label: 'Selected rail', value: payoutGateways.find(gateway => gateway.id === claimGatewayId)?.label || 'Not loaded' },
            ]}
          />
          {payoutGateways.length > 0 && (
            <div className="fraud-gateway-bar">
              <span>Instant payout rail</span>
              <select value={claimGatewayId} onChange={e => setClaimGatewayId(e.target.value)} className="fraud-gateway-select">
                {payoutGateways.map(gateway => <option key={gateway.id} value={gateway.id}>{gateway.label}</option>)}
              </select>
            </div>
          )}
          {fraudQueue.length === 0 ? (
            <div className="empty"><div className="empty-icon">✅</div><div className="empty-title">Queue is clear</div></div>
          ) : fraudQueue.map(c => (
            <div key={c.id} className="fraud-card">
              <div className="fraud-card-head">
                <div>
                  <div className="fraud-worker">{c.worker?.name} · {c.worker?.platform}</div>
                  <div className="fraud-trigger"><span className={`admin-trigger-chip ${triggerTone(c.triggerType)}`}>{trigIcon(c.triggerType)} {triggerLabel(c.triggerType)}</span> <span>{c.triggerValue} · {c.disruptionHours}h</span></div>
                </div>
                <div className="fraud-score-big">{c.fraudScore}<span>/100</span></div>
              </div>
              {c.fraudReason && <div className="fraud-reason"><Icon name="alert" size={13}/> {c.fraudReason}</div>}
              <div className="fraud-payout">Claimed: <strong>{fmt(c.payoutAmount)}</strong></div>
              <div className="fraud-actions">
                <button className="btn-approve" onClick={() => handleClaim(c.id,'approve')}><Icon name="check" size={13}/> Approve & pay instantly</button>
                <button className="btn-reject"  onClick={() => handleClaim(c.id,'reject')} ><Icon name="x"     size={13}/> Reject</button>
              </div>
            </div>
          ))}
        </>}

        {tab === 'zones' && <>
          <PageIntro
            eyebrow="Zone analytics"
            title="Neighborhood-level disruption and portfolio exposure."
            subtitle="Spot claim-heavy pockets, flood-prone zones, and changing risk concentration before it affects weekly payouts."
            meta={[
              { icon: 'shield', label: 'Highest risk', value: topZone ? `${topZone.name}` : 'No hotspot' },
              { icon: 'chart', label: 'Zones tracked', value: `${zoneStats.length}` },
            ]}
          />
          <ZonePulsePanel pulse={zonePulse} title="Zone Pulse Map" subtitle="Live city map ranking neighborhoods by disruption risk, claim frequency, and payout intensity" />
          <div className="zones-grid">
            {zoneStats.map(z => (
              <div key={z.id} className="zone-card">
                <div className="zone-name">{z.name}</div>
                <div className="zone-city">{z.city}</div>
                <div className="zone-risk-track"><div className="zone-risk-fill" style={{ width:`${z.riskScore*100}%`, background: z.riskScore>.8?'#ef4444':z.riskScore>.65?'#f59e0b':'#22c55e' }}/></div>
                <div className="zone-stats">
                  <span>{z.activePolicies} active policies</span>
                  <span>{z.totalClaims} claims</span>
                  <span className={`zone-flood ${z.floodProne?'yes':'no'}`}>{z.floodProne?'flood-prone':'stable'}</span>
                </div>
              </div>
            ))}
          </div>
        </>}

        {/* ─── MANAGE PLANS TAB ─── */}
        {tab === 'plans' && (
          <div className="admin-fade-in" style={{ animation: 'fadeIn 0.4s ease' }}>
            <PageIntro
              eyebrow="Plan controls"
              title="Manage the parametric product portfolio."
              subtitle="Review live bundles and deploy new weekly cover products without leaving the admin workspace."
              meta={[
                { icon: 'shield', label: 'Live plans', value: `${data.plans?.length || 0}` },
                { icon: 'zap', label: 'Top trigger', value: triggerLeader ? triggerLabel(triggerLeader.t) : 'No trigger data' },
              ]}
            />
            <div className="admin-plan-grid">
              <div>
                <div className="admin-plan-stack">
                  <div className="pd-title">Existing Live Plans</div>
                  {data.plans?.map(p => (
                    <div key={p.id} className="admin-plan-card">
                      <div className="admin-plan-card-copy">
                        <div className="admin-plan-card-title">{p.name}</div>
                        <div className="admin-plan-card-meta">
                          Weekly subscription • {p.includedActiveHours} protected hours • Premium: {fmt(p.baseWeeklyPremium)}
                        </div>
                      </div>
                      <div className="admin-plan-icons">
                         {p.triggers?.slice(0,3).map(t => <span key={t} className={`admin-trigger-chip compact ${triggerTone(t)}`}>{trigIcon(t)} {triggerLabel(t)}</span>)}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="glass-panel admin-plan-form">
                <div className="pd-title">Deploy New Product</div>
                <form onSubmit={async e => {
                  e.preventDefault();
                  const fd = new FormData(e.target);
                  const triggers = ['rain','aqi','heat','curfew','flood','cyclone','fog'].filter(t => fd.get(`trig_${t}`));
                  setSimming(true);
                  try {
                    await policyAPI.addPlan({
                      name: fd.get('name'),
                      baseWeeklyPremium: Number(fd.get('prem')),
                      maxWeeklyPayout: Number(fd.get('pay')),
                      includedActiveHours: Number(fd.get('hours')),
                      triggers,
                      popular: false
                    });
                    toast('Product successfully deployed to network! 🚀');
                    e.target.reset();
                    load();
                  } catch { toast('Deployment failed', 'error'); }
                  setSimming(false);
                }}>
                  <div className="field admin-form-field">
                    <label>Product Title</label>
                    <input name="name" required placeholder="e.g. Cyclone Ultra" />
                  </div>
                  <div className="field-row admin-form-row">
                    <div className="field">
                      <label>Bundle Premium (₹)</label>
                      <input type="number" name="prem" required placeholder="149" />
                    </div>
                    <div className="field">
                      <label>Max Payout (₹)</label>
                      <input type="number" name="pay" required placeholder="4000" />
                    </div>
                  </div>
                  <div className="field admin-form-field">
                    <label>Protected Active Hours</label>
                    <input type="number" name="hours" required placeholder="48" />
                  </div>
                  <div className="field admin-form-field">
                    <label>Select Underwriting Triggers</label>
                    <div className="admin-trigger-grid">
                      {['rain','aqi','heat','curfew','flood','cyclone','fog'].map(t => (
                        <label key={t} className={`admin-trigger-option ${triggerTone(t)}`}>
                          <input type="checkbox" name={`trig_${t}`} /> {trigIcon(t)} {triggerLabel(t)}
                        </label>
                      ))}
                    </div>
                  </div>
                  <button type="submit" className="btn-primary" disabled={simming} style={{ width: '100%' }}>
                    {simming ? <SpinInline /> : 'Authorize & Deploy Product'}
                  </button>
                </form>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// ADMIN LOGIN
// ═══════════════════════════════════════════════════════════════════
function AdminLogin({ onBack, onLoggedIn }) {
  const [email, setEmail]   = useState('admin@gigshield.in');
  const [pass,  setPass]    = useState('admin123');
  const [busy,  setBusy]    = useState(false);

  const submit = async e => {
    e.preventDefault();
    setBusy(true);
    try {
      const r = await authAPI.adminLogin({ email, password: pass });
      localStorage.setItem('gs_token', r.data.token);
      onLoggedIn();
    } catch { toast('Invalid admin credentials', 'error'); }
    setBusy(false);
  };

  return (
    <div className="auth-wrap admin-auth-wrap">
      <div className="auth-orb auth-orb-a" />
      <div className="auth-orb auth-orb-b" />
      <div className="admin-auth-shell">
        <section className="admin-auth-showcase">
          <div className="auth-announcement">ArthRaksh insurer workspace</div>
          <div className="auth-logo fintech-brand">
            <div className="logo-icon"><Icon name="grid" size={24}/></div>
            <div>
              <div className="logo-name">Admin Control</div>
              <div className="logo-tagline">Claims, fraud review, zones, and product controls</div>
            </div>
          </div>

          <div className="auth-headline admin-auth-headline">
            <h1>One clear place to run the protection system.</h1>
            <p>
              Review payouts, inspect fraud signals, trigger events, and manage plan configuration
              from the same calmer admin workspace.
            </p>
          </div>

          <div className="admin-auth-pulse">
            <div className="admin-auth-pulse-card">
              <span>Claims queue</span>
              <strong>Live review</strong>
              <p>Approve, reject, and download proof packs from one operational flow.</p>
            </div>
            <div className="admin-auth-pulse-card">
              <span>Zone pulse</span>
              <strong>Risk mapped</strong>
              <p>Track disruption hotspots across neighborhoods before payouts spike.</p>
            </div>
            <div className="admin-auth-pulse-card">
              <span>Products</span>
              <strong>Plan control</strong>
              <p>Update bundled cover, payout limits, and protected hours in minutes.</p>
            </div>
          </div>
        </section>

        <div className="auth-card admin-auth-card">
          <div className="auth-card-copy">
            <div className="auth-card-label">Admin sign in</div>
            <h2>Access the insurer dashboard.</h2>
            <p>Use the seeded demo admin account or your configured insurer credentials.</p>
          </div>

          <div className="admin-auth-demo">
            <div>
              <span>Demo email</span>
              <strong>admin@gigshield.in</strong>
            </div>
            <div>
              <span>Demo password</span>
              <strong>admin123</strong>
            </div>
          </div>

          <form onSubmit={submit} className="auth-form">
            <div className="field"><label>Email</label><input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="admin@gigshield.in" required /></div>
            <div className="field"><label>Password</label><input type="password" value={pass} onChange={e => setPass(e.target.value)} placeholder="admin123" required /></div>
            <button type="submit" className="btn-primary auth-submit-btn" disabled={busy}>{busy ? <SpinInline/> : 'Access dashboard'}</button>
          </form>

          <div className="auth-footer-row admin-auth-footer">
            <div className="auth-footer-copy">
              <strong>Insurer tools</strong>
              <span>Claim approvals, payout rails, simulations, fraud review, and live zone analytics.</span>
            </div>
            <button className="admin-link" onClick={onBack}>Back to worker app</button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// ROOT
// ═══════════════════════════════════════════════════════════════════
function Root() {
  const { user, loading } = useAuth();
  const [adminMode,    setAdminMode]    = useState(false);
  const [adminAuthed,  setAdminAuthed]  = useState(false);

  useEffect(() => {
    const t = localStorage.getItem('gs_token');
    if (!t) return;
    try {
      const p = JSON.parse(atob(t.split('.')[1]));
      if (p.role === 'admin') setAdminAuthed(true);
    } catch {}
  }, []);

  if (loading) return (
    <div className="loading-screen"><div className="spinner"/><span>Loading ArthRaksh…</span></div>
  );

  if (adminAuthed) return (
    <AdminDash onLogout={() => { localStorage.removeItem('gs_token'); setAdminAuthed(false); setAdminMode(false); }}/>
  );

  if (adminMode) return (
    <AdminLogin onBack={() => setAdminMode(false)} onLoggedIn={() => setAdminAuthed(true)}/>
  );

  if (!user) return <AuthScreen onAdmin={() => setAdminMode(true)}/>;

  return <WorkerApp/>;
}

export default function App() {
  return (
    <AuthProvider>
      <Toast/>
      <Root/>
    </AuthProvider>
  );
}
