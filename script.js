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

// === Reveal animations ===
const reveal = document.querySelectorAll('.card, .section, .hero, .market-card');
reveal.forEach((el) => el.classList.add('reveal'));

const revealObserver = new IntersectionObserver((entries) => {
  entries.forEach((entry) => {
    if (entry.isIntersecting) {
      entry.target.classList.add('reveal-in');
      revealObserver.unobserve(entry.target);
    }
  });
}, { threshold: 0.2 });

reveal.forEach((el) => revealObserver.observe(el));

// === TradingView market widgets ===
// Symbol lists live here — update symbols per card as needed.
const marketConfigs = {
  equities: {
    containerId: 'market-equities',
    // TradingView symbol list for Equities
    symbols: [
      ['S&P 500', 'FOREXCOM:SPXUSD'],
      ['Nasdaq 100', 'FOREXCOM:NSXUSD'],
      ['MSCI World (URTH)', 'AMEX:URTH'],
      ['Nikkei 225', 'TVC:NI225'],
      ['Hang Seng', 'HKEX:HSI'],
      ['Hang Seng Tech', 'HKEX:HSTECH'],
      ['Shanghai Composite', 'SSE:000001']
    ]
  },
  rates: {
    containerId: 'market-rates',
    // TradingView symbol list for Rates & Credit
    symbols: [
      ['UST 2Y', 'TVC:US02Y'],
      ['UST 5Y', 'TVC:US05Y'],
      ['UST 10Y', 'TVC:US10Y'],
      ['UST 30Y', 'TVC:US30Y'],
      ['US Agg (AGG)', 'AMEX:AGG'],
      ['IG Credit (LQD)', 'AMEX:LQD'],
      ['HY Credit (HYG)', 'AMEX:HYG']
    ]
  },
  fx: {
    containerId: 'market-fx',
    // TradingView symbol list for FX & Dollar
    symbols: [
      ['DXY', 'TVC:DXY'],
      ['USDJPY', 'OANDA:USDJPY'],
      ['USDCHF', 'OANDA:USDCHF'],
      ['USDCNH', 'OANDA:USDCNH'],
      ['USDHKD', 'OANDA:USDHKD'],
      ['EURUSD', 'OANDA:EURUSD'],
      ['GBPUSD', 'OANDA:GBPUSD'],
      ['AUDUSD', 'OANDA:AUDUSD'],
      // Optional if available on TradingView
      ['USDCNY', 'OANDA:USDCNY']
    ]
  },
  commodities: {
    containerId: 'market-commodities',
    // TradingView symbol list for Commodities & Crypto
    symbols: [
      ['Bitcoin', 'COINBASE:BTCUSD'],
      ['Gold', 'OANDA:XAUUSD'],
      ['Silver', 'OANDA:XAGUSD'],
      ['Copper', 'COMEX:HG1!'],
      ['WTI', 'TVC:USOIL'],
      ['Brent', 'TVC:UKOIL'],
      ['Natural Gas', 'NYMEX:NG1!']
    ]
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
