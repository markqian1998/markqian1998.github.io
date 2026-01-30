// === Animated counters ===
const counters = document.querySelectorAll('[data-count]');

const animateCount = (el) => {
  const target = Number(el.dataset.count);
  const isFloat = String(el.dataset.count).includes('.');
  const duration = 1200;
  const start = performance.now();

  const tick = (now) => {
    const progress = Math.min((now - start) / duration, 1);
    const value = target * (0.2 + 0.8 * progress * progress);
    el.textContent = isFloat ? value.toFixed(2) : Math.round(value).toString();
    if (progress < 1) requestAnimationFrame(tick);
    else el.textContent = isFloat ? target.toFixed(2) : target.toString();
  };

  requestAnimationFrame(tick);
};

const countObserver = new IntersectionObserver((entries) => {
  entries.forEach((entry) => {
    if (entry.isIntersecting) {
      animateCount(entry.target);
      countObserver.unobserve(entry.target);
    }
  });
}, { threshold: 0.6 });

counters.forEach((el) => countObserver.observe(el));

// === Reveal animations (cards, sections, markets) ===
const reveal = document.querySelectorAll('.card, .section, .hero, .market-card');
reveal.forEach((el) => el.classList.add('reveal'));

const revealObserver = new IntersectionObserver((entries) => {
  entries.forEach((entry) => {
    if (entry.isIntersecting) {
      entry.target.classList.add('reveal-in');
      revealObserver.unobserve(entry.target);
    }
  });
}, { threshold: 0.18 });

reveal.forEach((el) => revealObserver.observe(el));

// === TradingView market widgets ===
// Symbol lists live here — update labels/proName if a symbol shows N/A.
// For DXY fallback, change the first candidate below.
const MARKET_SETS = {
  equities: [
    { label: 'S&P 500', proName: 'FOREXCOM:SPXUSD' },
    { label: 'Nasdaq 100', proName: 'FOREXCOM:NSXUSD' },
    { label: 'MSCI World (URTH)', proName: 'NYSEARCA:URTH' },
    { label: 'Nikkei 225', proName: 'INDEX:NKY' },
    { label: 'HSI', proName: 'INDEX:HSI' },
    { label: 'HSTech (proxy)', proName: 'HKEX:3033' },
    { label: 'Shanghai Comp', proName: 'SSE:000001' },
    { label: 'CSI 300 (proxy)', proName: 'SSE:000300' }
  ],
  rates_credit: [
    { label: 'US 2Y', proName: 'FRED:DGS2' },
    { label: 'US 5Y', proName: 'FRED:DGS5' },
    { label: 'US 10Y', proName: 'FRED:DGS10' },
    { label: 'US 30Y', proName: 'FRED:DGS30' },
    { label: 'US Agg (AGG)', proName: 'NYSEARCA:AGG' },
    { label: 'IG credit (LQD)', proName: 'NYSEARCA:LQD' },
    { label: 'HY credit (HYG)', proName: 'NYSEARCA:HYG' }
  ],
  fx_dollar: [
    { label: 'DXY', proNameCandidates: ['ICEUS:DXY', 'TVC:DXY', 'FRED:DTWEXBGS'] },
    { label: 'USDJPY', proName: 'FX:USDJPY' },
    { label: 'USDCHF', proName: 'FX:USDCHF' },
    { label: 'USDCNH', proName: 'FX:USDCNH' },
    { label: 'USDHKD', proName: 'FX:USDHKD' },
    { label: 'EURUSD', proName: 'FX:EURUSD' },
    { label: 'GBPUSD', proName: 'FX:GBPUSD' },
    { label: 'AUDUSD', proName: 'FX:AUDUSD' }
  ],
  commodities: [
    { label: 'BTC', proName: 'COINBASE:BTCUSD' },
    { label: 'Gold', proName: 'OANDA:XAUUSD' },
    { label: 'Silver', proName: 'OANDA:XAGUSD' },
    { label: 'Copper (proxy HG)', proName: 'COMEX:HG1!' },
    { label: 'WTI', proName: 'NYMEX:CL1!' },
    { label: 'Brent', proName: 'ICEEUR:BRN1!' },
    { label: 'Nat Gas', proName: 'NYMEX:NG1!' }
  ]
};

const resolveSymbol = (item) => {
  if (item.proNameCandidates?.length) return item.proNameCandidates[0];
  return item.proName;
};

const buildSymbols = (set) =>
  set.map((item) => [item.label, resolveSymbol(item)]);

const marketConfigs = {
  equities: {
    containerId: 'market-equities',
    symbols: buildSymbols(MARKET_SETS.equities)
  },
  rates: {
    containerId: 'market-rates',
    symbols: buildSymbols(MARKET_SETS.rates_credit)
  },
  fx: {
    containerId: 'market-fx',
    symbols: buildSymbols(MARKET_SETS.fx_dollar)
  },
  commodities: {
    containerId: 'market-commodities',
    symbols: buildSymbols(MARKET_SETS.commodities)
  }
};

const loadMarketWidget = (cfg) => {
  const container = document.getElementById(cfg.containerId);
  if (!container) return;

  const widget = document.createElement('div');
  widget.className = 'tradingview-widget-container';
  const widgetInner = document.createElement('div');
  widgetInner.className = 'tradingview-widget-container__widget';
  widget.appendChild(widgetInner);

  const script = document.createElement('script');
  script.type = 'text/javascript';
  script.src = 'https://s3.tradingview.com/external-embedding/embed-widget-market-overview.js';
  script.async = true;
  script.innerHTML = JSON.stringify({
    colorTheme: 'dark',
    dateRange: '1D',
    showChart: true,
    locale: 'en',
    width: '100%',
    height: 360,
    isTransparent: true,
    symbols: cfg.symbols
  });

  widget.appendChild(script);
  container.appendChild(widget);
};

Object.values(marketConfigs).forEach(loadMarketWidget);
