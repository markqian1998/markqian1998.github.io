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
// Final symbols + sources (TradingView / FRED / proxy ETFs)
// Equities: SPXUSD (CFD), NSXUSD (CFD), URTH (ETF proxy), NKY (index), HSI (index),
// HSTech proxy (HKEX:3033), Shanghai (SSE:000001), CSI proxy (SSE:000300)
// Rates/Credit: FRED DGS2/5/10/30, AGG (proxy), LQD (proxy), HYG (proxy)
// FX: OANDA spot pairs (USDJPY, USDCHF, USDCNH, USDCNY, USDHKD, EURUSD, GBPUSD, AUDUSD)
// Commodities/Crypto: BTCUSD (Coinbase), XAUUSD/XAGUSD (OANDA), COPPER (TVC proxy),
// WTI/Brent/NG (TVC proxies to avoid N/A)
const MARKET_SETS = {
  equities: [
    { label: 'S&P 500', proName: 'FOREXCOM:SPXUSD' },
    { label: 'Nasdaq 100', proName: 'FOREXCOM:NSXUSD' },
    { label: 'Dow Jones', proName: 'INDEX:DJI' },
    { label: 'MSCI World', proName: 'NYSEARCA:URTH' },
    { label: 'Nikkei 225', proName: 'INDEX:NKY' },
    { label: 'Hang Seng', proName: 'INDEX:HSI' }
  ],
  rates_credit: [
    { label: 'UST 2Y', proName: 'FRED:DGS2' },
    { label: 'UST 10Y', proName: 'FRED:DGS10' },
    { label: 'IG Credit (LQD)', proName: 'NYSEARCA:LQD' },
    { label: 'HY Credit (HYG)', proName: 'NYSEARCA:HYG' },
    { label: 'UST 2s10s', proName: 'FRED:T10Y2Y' }
  ],
  fx_dollar: [
    { label: 'DXY (UUP)', proName: 'NYSEARCA:UUP' },
    { label: 'USDJPY', proName: 'OANDA:USDJPY' },
    { label: 'EURUSD', proName: 'OANDA:EURUSD' },
    { label: 'USDCNH', proName: 'FX:USDCNH' }
  ],
  commodities: [
    { label: 'Gold', proName: 'OANDA:XAUUSD' },
    { label: 'WTI', proName: 'CFI:WTI' },
    { label: 'Copper', proName: 'TVC:COPPER' },
    { label: 'Bitcoin', proName: 'COINBASE:BTCUSD' },
    { label: 'Ethereum', proName: 'COINBASE:ETHUSD' }
  ]
};

const buildSymbols = (set) => set.map((item) => ({ name: item.proName, displayName: item.label }));

const marketConfigs = {
  equities: {
    containerId: 'market-equities',
    title: 'Equities',
    symbols: buildSymbols(MARKET_SETS.equities)
  },
  rates: {
    containerId: 'market-rates',
    title: 'Rates & Credit',
    symbols: buildSymbols(MARKET_SETS.rates_credit)
  },
  fx: {
    containerId: 'market-fx',
    title: 'FX & Dollar',
    symbols: buildSymbols(MARKET_SETS.fx_dollar)
  },
  commodities: {
    containerId: 'market-commodities',
    title: 'Commodities & Crypto',
    symbols: buildSymbols(MARKET_SETS.commodities)
  }
};

Object.entries(marketConfigs).forEach(([key, cfg]) => {
  const host = document.getElementById(cfg.containerId);
  if (host) host.dataset.widgetKey = key;
});

const loadMarketWidget = (cfg) => {
  const container = document.getElementById(cfg.containerId);
  if (!container) return;

  container.innerHTML = '';

  const widget = document.createElement('div');
  widget.className = 'tradingview-widget-container';
  const widgetInner = document.createElement('div');
  widgetInner.className = 'tradingview-widget-container__widget';
  widget.appendChild(widgetInner);

  const script = document.createElement('script');
  script.type = 'text/javascript';
  script.src = 'https://s3.tradingview.com/external-embedding/embed-widget-market-quotes.js';
  script.async = true;
  script.innerHTML = JSON.stringify({
    colorTheme: 'dark',
    locale: 'en',
    width: '100%',
    height: 360,
    isTransparent: true,
    showSymbolLogo: false,
    symbolsGroups: [
      {
        name: cfg.title,
        originalName: cfg.title,
        symbols: cfg.symbols
      }
    ]
  });

  widget.appendChild(script);
  container.appendChild(widget);
};

Object.values(marketConfigs).forEach(loadMarketWidget);

const stooqCache = new Map();
let stooqBackoffMs = 0;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const fetchStooqQuotes = async (symbols, attempt = 0) => {
  const url = `/api/stooq?symbols=${encodeURIComponent(symbols.join(','))}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Stooq fetch failed: ${res.status}`);
  const data = await res.json();
  return data.quotes || [];
};

const renderStooqQuotes = async () => {
  const nodes = Array.from(document.querySelectorAll('.map-quote-data'));
  if (!nodes.length) return;

  const symbols = nodes.map((node) => node.dataset.stooqSymbol).filter(Boolean);
  if (!symbols.length) return;

  if (stooqBackoffMs) await sleep(stooqBackoffMs);

  try {
    const quotes = await fetchStooqQuotes(symbols);
    stooqBackoffMs = 0;
    const quoteMap = new Map(quotes.map((q) => [q.symbol, q]));

    nodes.forEach((node) => {
      const symbol = node.dataset.stooqSymbol;
      const q = quoteMap.get(symbol);
      if (q && q.price != null) {
        stooqCache.set(symbol, q);
      }

      const cached = stooqCache.get(symbol);
      if (!cached || cached.price == null) {
        return; // keep previous DOM as-is
      }

      const price = cached.price;
      const change = cached.change ?? 0;
      const changePct = cached.changePct ?? 0;

      node.classList.remove('positive', 'negative');
      if (change > 0) node.classList.add('positive');
      if (change < 0) node.classList.add('negative');

      node.innerHTML = `
        <div class="quote-price">${price.toLocaleString(undefined, { maximumFractionDigits: 2 })}</div>
        <div class="quote-change">${change >= 0 ? '+' : ''}${change.toFixed(2)} (${changePct >= 0 ? '+' : ''}${changePct.toFixed(2)}%)</div>
      `;
    });
  } catch (err) {
    stooqBackoffMs = Math.max(stooqBackoffMs ? Math.floor(stooqBackoffMs / 2) : 20000, 1000);
  }
};

renderStooqQuotes();
setInterval(renderStooqQuotes, 90000);

// Subtle flicker/glow pulse on cards to mimic terminal updates
setInterval(() => {
  document.querySelectorAll('.market-card').forEach((card) => {
    card.classList.add('tick-update');
    setTimeout(() => card.classList.remove('tick-update'), 300);
  });
}, 6000);


// === i18n language toggle ===
const I18N = {
  en: {
    'nav.home': 'Home',
    'nav.experience': 'Experience',
    'nav.projects': 'Projects',
    'nav.education': 'Education',
    'nav.marketNotes': 'Market Notes',
    'nav.contact': 'Contact',

    'exp.poseidon.lead': 'Multi‑asset discretionary portfolio management for UHNW clients across FICC, equities, derivatives and structured solutions. Build alpha strategies and internal pricing/risk infrastructure.',
    'exp.poseidon.pm.title': 'Portfolio Management & Alpha Generation',
    'exp.poseidon.pm.1': 'Led a 5‑person team managing $520M AUM across multi‑asset mandates (FICC, equities, derivatives), delivering 10.17% p.a. since Jun 2022 with portfolio volatility maintained below 12%.',
    'exp.poseidon.pm.2': 'Primary PM of $35M in‑house Bond AMC (UBS IB) allocating across 30+ IG credits, deploying macro overlays to enhance yield and hedge tail risks, including short UST puts (tail hedge / duration control), CDX/iTraxx roll shorts (contango capture), and swaption straddle exposures (short gamma / long vega positioning). Outperformed BBG Barclays IG Index by 253 bps since inception.',
    'exp.poseidon.pm.3': 'Built and executed a $12M 15‑name US equity short‑put strategy, combining valuation screening (EV/EBITDA, EV/Sales, P/FCF) with proprietary Python IV/RV calibration to systematically harvest VRP via 1M rolling 20–30 delta puts; sized risk via delta × IV weighting with continuous Greek/skew monitoring.',
    'exp.poseidon.pm.4': 'Structured and managed a $30M cross‑currency loan optimization program for PB clients, reallocating exposures across CHF / JPY / CNH to capture hiking‑cycle rate differentials; generated $2.7M in interest savings and FX PnL.',
    'exp.poseidon.pm.5': 'Advised 7 corporate clients on FX/rates hedging using forwards, multi‑leg options, and cross‑currency swaps (CCS), providing execution‑ready structures under varying volatility and liquidity regimes.',
    'exp.poseidon.pm.6': 'Collaborated on a $20M Equity L/S AMC with GS, combining Marquee basket exposure and single‑name ideas; supported tactical timing and dynamic hedging using DownVaR and weekly gamma positioning.',
    'exp.poseidon.risk.title': 'Infrastructure Building & Risk Management',
    'exp.poseidon.risk.1': 'Developed an antithetic Monte Carlo pricing engine (Python/QuantLib) for path‑dependent nonlinear derivatives; integrated SVI/SABR‑calibrated vol surfaces and bootstrapped OIS curves, producing 200+ daily valuations and Greeks.',
    'exp.poseidon.risk.2': 'Designed and implemented an internal risk engine integrating CVaR, GARCH volatility forecasting, copula dependency modeling, Bayesian shrinkage, and PCA factor decomposition for regime‑aware risk control.',
    'exp.poseidon.risk.3': 'Applied Black‑Litterman for signal stabilization and Fisher information‑weighted covariance estimation to reduce fragility under shifting market regimes.',
    'exp.poseidon.risk.4': 'Automated multi‑asset trade lifecycle via Python/Flask (quoting → ordering → booking), streamlining workflows across front/middle/back office and improving operational accuracy with OMS/PMS tools (Enfusion/Derivitec/TSI/BBG).',
    'exp.poseidon.risk.5': 'Contributed to monthly Bloomberg ECFC & FXFC forecasts using in‑house regression models on macro indicators.',
    'exp.poseidon.client.title': 'Client Engagement & Communication',
    'exp.poseidon.client.1': 'Prepared market wraps and investor letters, translating macro regimes into actionable portfolio positioning and trade ideas.',
    'exp.poseidon.client.2': 'Designed strategic/tactical asset allocation frameworks, led monthly portfolio reviews and proactive rebalancing to maintain alignment with client objectives.',
    'exp.poseidon.client.3': 'Mentored 9 intern analysts over 4 years, delivering structured “101” training sessions on product mechanics, market microstructure, and risk.',
    'exp.trident.title': 'Trident Partners Group SPC — Financial Analyst (Cayman Open‑Ended Digital Asset Mutual Fund)',
    'exp.trident.time': 'Hong Kong | Feb 2022 – Jan 2024',
    'exp.trident.lead': 'Operational + research role supporting a Cayman‑registered digital asset mutual fund, including product launch, documentation, and index tracking automation.',
    'exp.trident.b1': 'Designed the fund logo and website, and coordinated day‑to‑day operations with fund administrator, auditor, compliance, custodians, exchanges, and counterparties.',
    'exp.trident.b2': 'Supported the launch of index tracking fund TCDA, preparing institutional materials including Factsheet, PPM, IMA, DDQ, and pitchbooks for Accredited Investors.',
    'exp.trident.b3': 'Built automation scripts to retrieve live crypto prices via CoinMarket API, improving index operations efficiency by ~90%, including index weight adjustment, stablecoin removal rules, index price calculation, and backtesting workflow.',
    'exp.trident.b4': 'Initiated internal seminars and self‑directed research on Solidity, smart contracts, ECDSA, multi‑signature wallets, Merkle trees, token standards, and ERC‑20 / ERC‑721.',
    'exp.gen.title': 'GenHarmony Capital Group (US$6B Private Equity Firm) — Private Equity Summer Analyst (TMT)',
    'exp.gen.time': 'Shanghai, China | May 2021 – Aug 2021',
    'exp.gen.lead': 'TMT‑focused buy‑side internship involving deal execution, diligence, and IC material preparation.',
    'exp.gen.b1': 'Led private placement workstream for BOE Technology (000725.SZ); participated in private placement of SF Express (002352.SZ) and pre‑IPO of Shenzhen Horn Audio; conducted diligence on NAURA Tech (002371.SZ).',
    'exp.gen.b2': 'Conducted expert interviews with staff/executives/underwriters/industry experts; collected historical market data and analyzed business + financial performance.',
    'exp.gen.b3': 'Built 3‑scenario revenue forecasts and summarized investment highlights/risks into a 200‑page IC package.',
    'exp.gen.b4': 'Addressed LP concerns and supported capital raising, ultimately raising $116M for the BOE deal.',
    'exp.gen.b5': 'Offered the lowest dealing price at ¥5.57 among 58 competing funds, achieving 25%+ paper profit.',
    'exp.allign.title': 'ALLIGN Marketing — FP&A Summer Analyst',
    'exp.allign.time': 'Detroit, MI | Mar 2021 – Aug 2021',
    'exp.allign.lead': 'Finance operations + forecasting role supporting small‑business clients.',
    'exp.allign.b1': 'Conducted data input audits on clients’ QuickBooks accounts, reconciled entries, and delivered client‑facing findings.',
    'exp.allign.b2': 'Built forecasting models combining moving average and linear regression for revenue and expenses.',
    'exp.allign.b3': 'Performed ROI analysis across expense categories and developed hands‑on What‑if scenario models for business planning.',
    'exp.mb.title': 'Maize & Blue Endowment Fund (University of Michigan) — Quantitative Researcher',
    'exp.mb.time': 'Ann Arbor, MI | Sep 2021 – May 2022',
    'exp.mb.lead': 'Quant research role in a premier student‑managed investment fund.',
    'exp.mb.b1': 'Managed and rebalanced value‑weighted portfolios using ML models including Lasso Penalized Regression, Random Forest, Gradient Boosting Regression, and Neural Networks with tuned hyperparameters.',
    'exp.mb.b2': 'Tracked alpha/beta, out‑of‑sample R², geometric average return, and Sharpe ratio to recommend 20 out of 300 stocks.',
    'exp.jpm.title': 'J.P. Morgan Markets Virtual Program (Forage) — Sales & Trading',
    'exp.jpm.time': 'New York | Jul 2022 – Aug 2022',
    'exp.jpm.b1': 'Built a strategic client approach (client selection, service mapping, execution flow).',
    'exp.jpm.b2': 'Developed market‑relevant trade ideas and delivered a client pitch via mock phone call.',
    'exp.jpm.b3': 'Quoted equity futures considering liquidity and communicated pricing over the spread with sales in a simulated trading environment.',
    'exp.citi.title': 'Citi APAC Investment Banking Virtual Experience (Forage) — Investment Banking',
    'exp.citi.time': 'New York | Sep 2020 – Oct 2020',
    'exp.citi.b1': 'Prepared an IP‑based game operator company profile covering business model and key financials.',
    'exp.citi.b2': 'Selected 15 comparable companies and performed comps analysis.',
    'exp.citi.b3': 'Supported valuation work and summarized findings in a written update for senior bankers’ review.',
    'footer.linkedin': 'LinkedIn',
    'hero.title': 'Associate Portfolio Manager — Multi‑Asset, Macro, Derivatives',
    'hero.lead': 'Building alpha through disciplined risk management, cross‑asset structuring, and discretionary macro execution. Based in Hong Kong.',
    'meta.name': 'Name:',
    'meta.name.value': 'Mark Qian',
    'meta.age': 'Age:',
    'meta.age.value': '28',
    'meta.location': 'Location:',
    'meta.location.value': 'Hong Kong',
    'meta.hometown': 'Hometown:',
    'meta.hometown.value': 'Shanghai',
    'cta.marketNotes': 'Read Market Notes',
    'cta.experience': 'View Experience',
    'cta.projects': 'See Projects',
    'cta.resume': 'Download Resume (PDF)',
    'edu.umich': 'University of Michigan (BS Math) · 2018–2022',
    'edu.fudan': 'High School Affiliated to Fudan University · 2014–2017',
    'edu.shangbao.name': 'Shangbao Middle School',
    'edu.shangbao.detail': '2010–2014 · Shanghai',
    'edu.shangbao.inline': 'Shangbao Middle School · 2010–2014',
    'link.email': 'Email',
    'link.github': 'GitHub',
    'certs.title': 'License',
    'certs.sfc4': 'SFC Type 4',
    'certs.sfc9': 'SFC Type 9',
    'certs.bmc': 'Bloomberg BMC',
    'certs.jpm': 'JPM VEP',
    'certs.citi': 'Citi VEP',
    'stats.title': 'Professional Experience',
    'stats.aum': '$M AUM',
    'stats.return': '% p.a. return',
    'stats.vol': '% Vol cap',
    'cards.pm.title': 'Portfolio Management',
    'cards.pm.body': 'Led a 5‑person team managing $520M AUM across FICC, Equities, and Derivatives with volatility below 12% since Jun 2022.',
    'cards.rm.title': 'Infrastructure Building & Risk Management',
    'cards.rm.body': 'Built pricing and risk engines using Python/QuantLib, SABR/SVI vols, GARCH/CVaR, copulas, PCA, and Black‑Litterman stabilization.',
    'cards.ce.title': 'Client Engagement & Communication',
    'cards.ce.body': 'Prepared market wraps, ran monthly portfolio reviews, and delivered tactical positioning updates for UHNW and corporate clients.',
    'highlights.title': 'Highlights',
    'highlights.1': 'Primary PM of $35M UBS IB Bond AMC; +253 bps vs BBG Barclays IG Index since inception.',
    'highlights.2': 'Executed $12M 15‑name US equity short‑put strategy with valuation screens and IV/RV calibration.',
    'highlights.3': 'Structured $30M cross‑currency loan optimization strategy across CHF/JPY/CNH.',
    'markets.title': 'Live Markets',
    'markets.disclaimer': 'Delayed data · Stooq',
    'markets.equities': 'Equities',
    'markets.rates': 'Rates & Credit',
    'markets.fx': 'FX & Dollar',
    'markets.commodities': 'Commodities & Crypto',
    'map.us': '🇺🇸 US',
    'map.eu': '🇪🇺 EU',
    'map.uk': '🇬🇧 UK',
    'map.jp': '🇯🇵 JP',
    'map.cn': '🇨🇳 CN',
    'map.hk': '🇭🇰 HK',
    'map.kr': '🇰🇷 KR',
    'map.tw': '🇹🇼 TW',
    'map.in': '🇮🇳 IN',
    'map.au': '🇦🇺 AU',
    'map.br': '🇧🇷 BR',
    'map.commod': '🧱 Commodities',
    'map.spx': 'SPX',
    'map.ndx': 'NDX',
    'map.stoxx': 'STOXX',
    'map.ftse': 'FTSE',
    'map.nky': 'NKY',
    'map.shcomp': 'SHCOMP',
    'map.hsi': 'HSI',
    'map.kospi': 'KOSPI',
    'map.taiex': 'TAIEX (proxy)',
    'map.nifty': 'NIFTY (proxy)',
    'map.asx': 'ASX 200 (proxy)',
    'map.bovespa': 'Bovespa (proxy)',
    'map.gold': 'Gold (spot)',
    'map.silver': 'Silver (spot)',
    'map.copper': 'Copper (proxy)',
    'map.btc': 'Bitcoin',
    'map.wti': 'WTI',
    'exp.title': 'Experience',
    'exp.poseidon.title': 'Poseidon Capital Limited — Associate Portfolio Manager',
    'exp.poseidon.time': 'Hong Kong · Nov 2021 – Present',

    'exp.poseidon.meta': 'SFC Licensed Type 4 & Type 9 RA (CE No. BTL239)',
    'exp.poseidon.pm.title': 'Portfolio Management & Alpha',
    'exp.poseidon.pm.1': 'Led a 5‑person team managing $520M AUM across FICC, equities, and derivatives for UHNW clients; delivered 10.17% p.a. with portfolio vol maintained below 12% since Jun 2022.',
    'exp.poseidon.pm.2': 'Primary PM of $35M in‑house Bond AMC at UBS IB, allocating across 30+ IG credits; deployed macro overlays (short UST puts, CDX/iTraxx roll shorts, short gamma/long vega on swaption straddles). Outperformed BBG Barclays IG Index by 253 bps since inception.',
    'exp.poseidon.pm.3': 'Built and executed $12M US equity short‑put strategy (15 names) with valuation screens (EV/EBITDA, EV/Sales, P/FCF) and proprietary IV/RV calibration; traded 1m rolling 20–30 delta puts to harvest VRP; sized via delta × IV risk‑weighting; active Greeks + skew monitoring.',
    'exp.poseidon.pm.4': 'Structured and managed $30M cross‑currency loan optimization (CHF/JPY/CNH), capturing rate differentials through the hiking cycle; generated $2.7M interest savings and FX PnL; advised 7 corporates on hedging (forwards, multi‑leg options, CCS).',
    'exp.poseidon.pm.5': 'Collaborated on $20M Equity L/S AMC with GS (Marquee basket + single names); supported tactical timing + dynamic hedging via DownVar and long weekly gamma.',
    'exp.poseidon.risk.title': 'Infrastructure & Risk Systems',
    'exp.poseidon.risk.1': 'Developed antithetic Monte Carlo pricing engine in Python/QuantLib for path‑dependent derivatives; integrated SVI/SABR vol surfaces and bootstrapped OIS curves; delivered 200+ daily valuations + Greeks.',
    'exp.poseidon.risk.2': 'Built internal risk engine: CVaR, GARCH forecasting, copula dependency, Bayesian shrinkage, PCA factor decomposition; applied Black‑Litterman + Fisher‑information‑weighted covariance to reduce fragility under regime shifts.',
    'exp.poseidon.risk.3': 'Automated trade lifecycle via Python/Flask (quoting → ordering → booking), improving accuracy and latency across OMS/PMS (Enfusion/Derivitec/TSI/BBG).',
    'exp.poseidon.risk.4': 'Contributed to Bloomberg ECFC & FXFC monthly forecasts using in‑house regression models for macro indicators.',
    'exp.poseidon.client.title': 'Client Engagement',
    'exp.poseidon.client.1': 'Produced market wraps and investor letters; advised tactical positioning and trade opportunities.',
    'exp.poseidon.client.2': 'Designed strategic/tactical asset allocation and led monthly portfolio reviews and rebalancing.',
    'exp.poseidon.client.3': 'Mentored 9 interns over 4 years; delivered internal “101” training sessions on products and market dynamics.',
    'exp.gen.title': 'GenHarmony Capital Group (US$6B AUM) — Private Equity Summer Intern, TMT',
    'exp.gen.time': 'Shanghai · May 2021 – Aug 2021',
    'exp.gen.b1': 'Led BOE Technology private placement (000725.SZ); participated in SF Express private placement (002352.SZ) and Shenzhen Horn Audio pre‑IPO; conducted NAURA Tech diligence (002371.SZ).',
    'exp.gen.b2': 'Interviewed staff, executives, underwriters, and industry experts; collected historical market data; analyzed business & financial performance; summarized investment highlights/risks; modeled 3‑scenario revenue forecasts.',
    'exp.gen.b3': 'Compiled 200‑page IC materials, addressed LP concerns, and raised $116M for the BOE deal; offered lowest dealing price at ¥5.57 among 58 funds, achieving 25%+ paper profit.',
    'exp.mb.title': 'Maize & Blue Endowment Fund — Quantitative Researcher',
    'exp.mb.time': 'Ann Arbor · Sep 2021 – May 2022',
    'exp.mb.b1': 'Managed and rebalanced value‑weighted portfolios using ML models (Lasso, Random Forests, Gradient Boosting, Neural Networks) with tuned hyperparameters; tracked alpha/beta, OOS R², geometric avg return, and Sharpe to recommend 20 of 300 stocks.',
    'exp.poseidon.b1': 'Led 5‑person team managing $520M AUM across FICC, Equities, and Derivatives; 10.17% p.a. since Jun 2022 with vol < 12%.',
    'exp.poseidon.b2': 'Primary PM of $35M in‑house Bond AMC at UBS IB across 30+ IG credits; macro overlays (short UST puts, CDX/iTraxx roll shorts, short gamma/long vega on swaption straddles) to enhance yield and hedge tail risk. Outperformed BBG Barclays IG Index by 253 bps since inception.',
    'exp.poseidon.b3': 'Built and executed $12M 15‑name US equity short‑put strategy with valuation screens (EV/EBITDA, EV/Sales, P/FCF) and proprietary IV/RV calibration; delta × IV risk‑weighted sizing with active Greek and skew‑aware monitoring.',
    'exp.poseidon.b4': 'Structured and managed $30M cross‑currency loan optimization for PB clients across CHF/JPY/CNH; generated $2.7M interest savings & FX PnL. Advised 7 corporate clients on FX/rates hedging via forwards, multi‑leg options, and CCS.',
    'exp.poseidon.b5': 'Collaborated on $20M Equity L/S AMC with GS, combining Marquee basket exposure and single‑name ideas driven by fundamental analysis.',
    'exp.poseidon.b6': 'Developed antithetic Monte Carlo pricing engine with Python/QuantLib; integrated SVI/SABR vols and OIS curves for 200+ daily valuations and Greeks.',
    'exp.poseidon.b7': 'Designed internal risk engine using CVaR, GARCH, copulas, PCA, and Black‑Litterman signal stabilization; applied Bayesian shrinkage and Fisher‑information‑weighted covariance to reduce regime fragility.',
    'exp.poseidon.b8': 'Automated multi‑asset trade lifecycle (quote → order → book) via Python/Flask; integrated OMS/PMS (Enfusion/Derivitec/TSI/BBG).',
    'exp.poseidon.b9': 'Prepared market wraps and investor letters; ran monthly portfolio reviews and proactive rebalancing with daily client engagement.',
    'exp.poseidon.b10': 'Mentored 9 intern analysts; delivered 101 training sessions on products and markets.',
    'exp.gen.title': 'GenHarmony Capital Group — Private Equity Summer Intern (TMT)',
    'exp.gen.time': 'Shanghai · May 2021 – Aug 2021',
    'exp.gen.b1': 'Led private placement for BOE Technology; contributed to SF Express and Shenzhen Horn Audio deals.',
    'exp.gen.b2': 'Conducted due diligence, interviews, and scenario‑based revenue modeling.',
    'exp.gen.b3': 'Compiled 200‑page IC materials; helped raise $116M for BOE deal.',
    'proj.title': 'Selected Projects',
    'proj.p1.title': 'Antithetic Monte Carlo Pricing Engine',
    'proj.p2.title': 'Multi‑Asset Risk Engine',
    'proj.p3.title': 'Systematic Short‑Put Strategy',
    'proj.p4.title': 'Student‑Managed Fund Research',
    'proj.skills': 'Skills',
    'edu.title': 'Education',
    'edu.umich.name': 'University of Michigan',
    'edu.umich.degree': 'Bachelor of Science — Mathematics',
    'edu.umich.detail': '2018–2022 · GPA 3.8/4.0 · Ann Arbor, MI',
    'edu.fudan.name': 'High School Affiliated to Fudan University',
    'edu.fudan.degree': 'Liberal Arts & Sciences Academy (Olympiad track)',
    'edu.fudan.detail': '2014–2017 · Shanghai',
    'edu.shangbao.name': 'Shangbao Middle School',
    'edu.shangbao.degree': 'Middle School',
    'edu.shangbao.detail': '2010–2014 · Shanghai',
    'edu.certs.title': 'Licenses & Certifications',
    'edu.certs.t4': 'Licensed Representative — Type 4 Advising on Securities',
    'edu.certs.t9': 'Licensed Representative — Type 9 Asset Management',
    'edu.certs.sfc': 'Securities and Futures Commission (SFC)',
    'edu.certs.t4.detail': 'Issued Jun 2023 · Credential ID: BTL239',
    'edu.certs.t9.detail': 'Issued Mar 2023 · Credential ID: BTL239',
    'edu.certs.bmc': 'Bloomberg Market Concepts Certificate',
    'edu.certs.bloomberg': 'Bloomberg',
    'edu.certs.bmc.detail': 'Issued Aug 2022 · Credential ID: vDWDZV8qgkhghLV4aKuu9ai1',
    'edu.certs.vep': 'Virtual Experience Program Participant',
    'edu.certs.jpm': 'J.P. Morgan',
    'edu.certs.jpm.detail': 'Issued Mar 2021 · Credential ID: jmySfopF4PXhR77CL',
    'edu.certs.citi': 'Citi',
    'edu.certs.citi.detail': 'Issued Sep 2020 · Credential ID: dEy3DSXDs3CbAsQDg',
    'contact.title': 'Contact',
    'contact.lead': 'Best way to reach me is via Email.',
    'contact.email': 'Email',
    'contact.github': 'GitHub',
    'contact.instagram': 'Instagram',
    'contact.youtube': 'YouTube',
    'contact.bilibili': 'Bilibili',
    'contact.location': 'Location'
  },
  zh: {
    'nav.home': '主页',
    'nav.experience': '经历',
    'nav.projects': '项目',
    'nav.education': '教育',
    'nav.marketNotes': '市场笔记',
    'nav.contact': '联系',
    'footer.linkedin': '领英',
    'hero.title': '副投资组合经理 — 多资产 / 宏观 / 衍生品',
    'hero.lead': '以纪律化风控、跨资产结构设计与宏观自主交易创造超额收益。现居香港。',
    'meta.name': '姓名：',
    'meta.name.value': '钱胤哲（Mark Qian）',
    'meta.age': '年龄：',
    'meta.age.value': '28',
    'meta.location': '所在地：',
    'meta.location.value': '香港',
    'meta.hometown': '家乡：',
    'meta.hometown.value': '上海',
    'cta.marketNotes': '阅读市场笔记',
    'cta.experience': '查看经历',
    'cta.projects': '查看项目',
    'cta.resume': '下载简历（PDF）',
    'edu.umich': '密歇根大学（数学学士）· 2018–2022',
    'edu.umich.name': '密歇根大学',
    'edu.umich.degree': '数学学士',
    'edu.umich.detail': '2018–2022 · GPA 3.8/4.0 · 安娜堡',
    'edu.fudan': '复旦大学附属中学（文理学院）· 2014–2017',
    'edu.fudan.name': '复旦大学附属中学',
    'edu.fudan.degree': '文理学院（竞赛班）',
    'edu.fudan.detail': '2014–2017 · 上海',
    'edu.shangbao.name': '上宝中学',
    'edu.shangbao.degree': '初中',
    'edu.shangbao.detail': '2010–2014 · 上海',
    'edu.shangbao.inline': '上宝中学 · 2010–2014',
    'link.email': '邮箱',
    'link.github': 'GitHub',
    'certs.title': '牌照',
    'certs.sfc4': 'SFC 第4类牌照',
    'certs.sfc9': 'SFC 第9类牌照',
    'certs.bmc': 'Bloomberg BMC',
    'certs.jpm': 'JPM VEP',
    'certs.citi': '花旗虚拟体验项目',
    'stats.title': '专业经验',
    'stats.aum': 'AUM（百万美元）',
    'stats.return': '年化收益率',
    'stats.vol': '波动率上限',
    'cards.pm.title': '资产组合管理',
    'cards.pm.body': '带领5人团队管理5.2亿美元AUM，覆盖FICC、股票与衍生品；自2022年6月以来波动率低于12%。',
    'cards.rm.title': '基础设施建设与风险管理',
    'cards.rm.body': '搭建Python/QuantLib定价与风险引擎，使用SABR/SVI波动率、GARCH/CVaR、Copula、PCA和Black‑Litterman稳定化。',
    'cards.ce.title': '客户沟通与服务',
    'cards.ce.body': '撰写市场周报、主持月度组合回顾，并为超高净值及企业客户提供战术配置建议。',
    'highlights.title': '亮点',
    'highlights.1': '作为UBS投行债券AMC主PM（3,500万美元）；自成立以来跑赢彭博巴克莱投资级指数253个基点。',
    'highlights.2': '执行1,200万美元、15只美股的卖出看跌期权策略，结合估值筛选与IV/RV校准。',
    'highlights.3': '构建3,000万美元跨币种（CHF/JPY/CNH）贷款优化策略。',
    'markets.title': '实时市场',
    'markets.disclaimer': '数据延迟 · Stooq',
    'markets.equities': '股票',
    'markets.rates': '利率与信用',
    'markets.fx': '外汇与美元',
    'markets.commodities': '大宗商品与加密资产',
    'map.us': '🇺🇸 美国',
    'map.eu': '🇪🇺 欧洲',
    'map.uk': '🇬🇧 英国',
    'map.jp': '🇯🇵 日本',
    'map.cn': '🇨🇳 中国',
    'map.hk': '🇭🇰 香港',
    'map.kr': '🇰🇷 韩国',
    'map.tw': '🇹🇼 台湾',
    'map.in': '🇮🇳 印度',
    'map.au': '🇦🇺 澳大利亚',
    'map.br': '🇧🇷 巴西',
    'map.commod': '🧱 大宗商品',
    'map.spx': '标普500',
    'map.ndx': '纳指100',
    'map.stoxx': '欧洲Stoxx 50',
    'map.ftse': '富时100',
    'map.nky': '日经225',
    'map.shcomp': '上证综指',
    'map.hsi': '恒生指数',
    'map.kospi': 'KOSPI',
    'map.taiex': '台湾加权（代理）',
    'map.nifty': '印度Nifty（代理）',
    'map.asx': 'ASX 200（代理）',
    'map.bovespa': '巴西Bovespa（代理）',
    'map.gold': '黄金（现货）',
    'map.silver': '白银（现货）',
    'map.copper': '铜（代理）',
    'map.btc': '比特币',
    'map.wti': 'WTI原油',
    'exp.title': '工作经历',
    'exp.poseidon.title': '波塞冬资本有限公司 — 副投资组合经理',
    'exp.poseidon.time': '香港 · 2021年11月 – 至今',

    'exp.poseidon.meta': 'SFC Licensed Type 4 & Type 9 RA (CE No. BTL239)',
    'exp.poseidon.pm.title': 'Portfolio Management & Alpha',
    'exp.poseidon.pm.1': 'Led a 5‑person team managing $520M AUM across FICC, equities, and derivatives for UHNW clients; delivered 10.17% p.a. with portfolio vol maintained below 12% since Jun 2022.',
    'exp.poseidon.pm.2': 'Primary PM of $35M in‑house Bond AMC at UBS IB, allocating across 30+ IG credits; deployed macro overlays (short UST puts, CDX/iTraxx roll shorts, short gamma/long vega on swaption straddles). Outperformed BBG Barclays IG Index by 253 bps since inception.',
    'exp.poseidon.pm.3': 'Built and executed $12M US equity short‑put strategy (15 names) with valuation screens (EV/EBITDA, EV/Sales, P/FCF) and proprietary IV/RV calibration; traded 1m rolling 20–30 delta puts to harvest VRP; sized via delta × IV risk‑weighting; active Greeks + skew monitoring.',
    'exp.poseidon.pm.4': 'Structured and managed $30M cross‑currency loan optimization (CHF/JPY/CNH), capturing rate differentials through the hiking cycle; generated $2.7M interest savings and FX PnL; advised 7 corporates on hedging (forwards, multi‑leg options, CCS).',
    'exp.poseidon.pm.5': 'Collaborated on $20M Equity L/S AMC with GS (Marquee basket + single names); supported tactical timing + dynamic hedging via DownVar and long weekly gamma.',
    'exp.poseidon.risk.title': 'Infrastructure & Risk Systems',
    'exp.poseidon.risk.1': 'Developed antithetic Monte Carlo pricing engine in Python/QuantLib for path‑dependent derivatives; integrated SVI/SABR vol surfaces and bootstrapped OIS curves; delivered 200+ daily valuations + Greeks.',
    'exp.poseidon.risk.2': 'Built internal risk engine: CVaR, GARCH forecasting, copula dependency, Bayesian shrinkage, PCA factor decomposition; applied Black‑Litterman + Fisher‑information‑weighted covariance to reduce fragility under regime shifts.',
    'exp.poseidon.risk.3': 'Automated trade lifecycle via Python/Flask (quoting → ordering → booking), improving accuracy and latency across OMS/PMS (Enfusion/Derivitec/TSI/BBG).',
    'exp.poseidon.risk.4': 'Contributed to Bloomberg ECFC & FXFC monthly forecasts using in‑house regression models for macro indicators.',
    'exp.poseidon.client.title': 'Client Engagement',
    'exp.poseidon.client.1': 'Produced market wraps and investor letters; advised tactical positioning and trade opportunities.',
    'exp.poseidon.client.2': 'Designed strategic/tactical asset allocation and led monthly portfolio reviews and rebalancing.',
    'exp.poseidon.client.3': 'Mentored 9 interns over 4 years; delivered internal “101” training sessions on products and market dynamics.',
    'exp.gen.title': '元和鸿鸣资本（管理规模约60亿美元）— 私募股权暑期实习生（TMT）',
    'exp.gen.time': '上海 · 2021年5月 – 2021年8月',
    'exp.gen.b1': '主导京东方定向增发（000725.SZ）；参与顺丰定向增发（002352.SZ）与深圳Horn Audio Pre‑IPO；完成北方华创尽调（002371.SZ）。',
    'exp.gen.b2': '访谈公司与行业专家、承销商等；整理历史市场数据；分析经营与财务表现；总结投资亮点/风险；建立三情景收入预测模型。',
    'exp.gen.b3': '编制200页投委会材料并回应LP关切，最终为京东方项目募资1.16亿美元；在58家基金竞价中报出最低成交价¥5.57，取得25%+账面收益。',
    'exp.mb.title': 'Maize & Blue Endowment Fund — 量化研究员',
    'exp.mb.time': '安娜堡 · 2021年9月 – 2022年5月',
    'exp.mb.b1': '使用Lasso、随机森林、梯度提升与神经网络等模型并调参管理与再平衡价值加权组合；跟踪alpha/beta、样本外R²、几何平均收益与Sharpe，从300只股票中推荐20只。',
    'exp.poseidon.b1': '带领5人团队管理5.2亿美元AUM，覆盖FICC、股票与衍生品；年化10.17%，波动率<12%。',
    'exp.poseidon.b2': '作为UBS投行内部债券AMC主PM，覆盖30+投资级信用；通过宏观对冲提升收益并管理尾部风险；自成立以来跑赢253bp。',
    'exp.poseidon.b3': '搭建并执行1,200万美元、15只美股的卖出看跌期权策略，结合估值筛选与IV/RV校准，进行Greek与偏度监控。',
    'exp.poseidon.b4': '为PB客户设计3,000万美元跨币种（CHF/JPY/CNH）贷款优化，节省利息并产生FX收益；为7家企业提供汇率/利率对冲建议。',
    'exp.poseidon.b5': '与高盛合作2,000万美元股票多空AMC，结合Marquee篮子与个股研究。',
    'exp.poseidon.b6': '开发对偶蒙特卡洛定价引擎，集成SVI/SABR与OIS曲线，提供200+日度估值与Greek。',
    'exp.poseidon.b7': '设计内部风险引擎，采用CVaR、GARCH、Copula、PCA及Black‑Litterman，降低模型在不同周期下的脆弱性。',
    'exp.poseidon.b8': '使用Python/Flask自动化多资产交易全流程（询价→下单→入账），对接OMS/PMS。',
    'exp.poseidon.b9': '撰写市场周报与投资者通信；月度回顾与再平衡，维持日常客户沟通。',
    'exp.poseidon.b10': '指导9名实习分析师，开展101场产品与市场培训。',
    'exp.gen.title': '元和鸿鸣资本 — 私募股权暑期实习生（TMT）',
    'exp.gen.time': '上海 · 2021年5月 – 2021年8月',
    'exp.gen.b1': '主导京东方定向增发项目；参与顺丰及深圳Horn Audio项目。',
    'exp.gen.b2': '开展尽调、访谈与情景式收入建模。',
    'exp.gen.b3': '编制200页投委会材料；协助京东方项目募资1.16亿美元。',
    'proj.title': '项目精选',
    'proj.p1.title': '对偶蒙特卡洛定价引擎',
    'proj.p2.title': '多资产风险引擎',
    'proj.p3.title': '系统化卖出看跌策略',
    'proj.p4.title': '学生管理基金研究',
    'proj.skills': '技能',
    'edu.title': '教育背景',
    'edu.umich.name': '密歇根大学',
    'edu.umich.degree': '理学学士 — 数学',
    'edu.umich.detail': '2018–2022 · GPA 3.8/4.0 · 密歇根州安娜堡',
    'edu.fudan.name': '复旦大学附属中学',
    'edu.fudan.detail': '2014–2017 · 上海',
    'edu.certs.title': '牌照与认证',
    'edu.certs.t4': '持牌代表 — 第4类（就证券提供意见）',
    'edu.certs.t9': '持牌代表 — 第9类（资产管理）',
    'edu.certs.sfc': '香港证监会（SFC）',
    'edu.certs.t4.detail': '颁发于2023年6月 · 证书编号：BTL239',
    'edu.certs.t9.detail': '颁发于2023年3月 · 证书编号：BTL239',
    'edu.certs.bmc': '彭博市场概念证书',
    'edu.certs.bloomberg': '彭博',
    'edu.certs.bmc.detail': '颁发于2022年8月 · 证书编号：vDWDZV8qgkhghLV4aKuu9ai1',
    'edu.certs.vep': '虚拟体验项目参与者',
    'edu.certs.jpm': '摩根大通',
    'edu.certs.jpm.detail': '颁发于2021年3月 · 证书编号：jmySfopF4PXhR77CL',
    'edu.certs.citi': '花旗',
    'edu.certs.citi.detail': '颁发于2020年9月 · 证书编号：dEy3DSXDs3CbAsQDg',
    'contact.title': '联系',
    'contact.lead': '最佳联系方式是通过邮箱。',
    'contact.email': '邮箱',
    'contact.github': 'GitHub',
    'contact.instagram': 'Instagram',
    'contact.youtube': 'YouTube',
    'contact.bilibili': 'B站',
    'contact.location': '所在地'
  }
};

const setLang = (lang) => {
  localStorage.setItem('lang', lang);
  document.documentElement.lang = lang === 'zh' ? 'zh' : 'en';
  document.querySelectorAll('[data-i18n]').forEach((el) => {
    const key = el.dataset.i18n;
    if (I18N[lang] && I18N[lang][key]) {
      el.textContent = I18N[lang][key];
    }
  });
  document.querySelectorAll('.lang-btn').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.lang === lang);
  });
};

const getLang = () => {
  const urlLang = new URLSearchParams(location.search).get('lang');
  return urlLang || localStorage.getItem('lang') || 'en';
};

document.addEventListener('DOMContentLoaded', () => {
  setLang(getLang());
  // ensure stats show and animate
  counters.forEach((el) => { el.textContent = el.dataset.count; });
  setTimeout(() => { counters.forEach((el) => animateCount(el)); }, 50);
  document.querySelectorAll('[data-lang]').forEach((btn) => {
    btn.addEventListener('click', () => setLang(btn.dataset.lang));
  });
});
