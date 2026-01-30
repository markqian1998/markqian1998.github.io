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
    { label: 'MSCI World (URTH)', proName: 'NYSEARCA:URTH' },
    { label: 'Nikkei 225', proName: 'INDEX:NKY' },
    { label: 'Hang Seng', proName: 'INDEX:HSI' },
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
    { label: 'USDJPY', proName: 'OANDA:USDJPY' },
    { label: 'USDCHF', proName: 'OANDA:USDCHF' },
    { label: 'USDCNH', proName: 'OANDA:USDCNH' },
    { label: 'USDCNY', proName: 'OANDA:USDCNY' },
    { label: 'USDHKD', proName: 'OANDA:USDHKD' },
    { label: 'EURUSD', proName: 'OANDA:EURUSD' },
    { label: 'GBPUSD', proName: 'OANDA:GBPUSD' },
    { label: 'AUDUSD', proName: 'OANDA:AUDUSD' }
  ],
  commodities: [
    { label: 'BTC', proName: 'COINBASE:BTCUSD' },
    { label: 'Gold', proName: 'OANDA:XAUUSD' },
    { label: 'Silver', proName: 'OANDA:XAGUSD' },
    { label: 'Copper (proxy)', proName: 'TVC:COPPER' },
    { label: 'WTI (proxy)', proName: 'TVC:USOIL' },
    { label: 'Brent (proxy)', proName: 'TVC:UKOIL' },
    { label: 'Nat Gas (proxy)', proName: 'TVC:NGAS' }
  ]
};

const buildSymbols = (set) => set.map((item) => [item.label, item.proName]);

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
    'nav.contact': 'Contact',
    'footer.linkedin': 'LinkedIn',
    'hero.title': 'Associate Portfolio Manager — Multi‑Asset, Macro, Derivatives',
    'hero.lead': 'Building alpha through disciplined risk management, cross‑asset structuring, and
            discretionary macro execution. Based in Hong Kong.',
    'meta.name': 'Name:',
    'meta.name.value': 'Mark Qian',
    'meta.age': 'Age:',
    'meta.age.value': '28',
    'meta.location': 'Location:',
    'meta.location.value': 'Hong Kong',
    'meta.hometown': 'Hometown:',
    'meta.hometown.value': 'Shanghai',
    'cta.experience': 'View Experience',
    'cta.projects': 'See Projects',
    'cta.resume': 'Download Resume (PDF)',
    'edu.umich': 'University of Michigan (BS Math) · 2018–2022',
    'edu.fudan': 'High School Affiliated to Fudan University · 2014–2017',
    'link.email': 'Email',
    'link.github': 'GitHub',
    'certs.title': 'Licenses & Certifications',
    'certs.sfc4': 'SFC Type 4',
    'certs.sfc9': 'SFC Type 9',
    'certs.bmc': 'Bloomberg Market Concepts',
    'certs.jpm': 'J.P. Morgan VEP',
    'certs.citi': 'Citi VEP',
    'stats.title': 'Professional Experience',
    'stats.aum': '$M AUM',
    'stats.return': '% p.a. return',
    'stats.vol': '% Vol cap',
    'cards.pm.title': 'Portfolio Management',
    'cards.pm.body': 'Led a 5‑person team managing $520M AUM across FICC, Equities, and Derivatives
          with volatility below 12% since Jun 2022.',
    'cards.rm.title': 'Infrastructure Building & Risk Management',
    'cards.rm.body': 'Built pricing and risk engines using Python/QuantLib, SABR/SVI vols, GARCH/CVaR,
          copulas, PCA, and Black‑Litterman stabilization.',
    'cards.ce.title': 'Client Engagement & Communication',
    'cards.ce.body': 'Prepared market wraps, ran monthly portfolio reviews, and delivered tactical
          positioning updates for UHNW and corporate clients.',
    'highlights.title': 'Highlights',
    'highlights.1': 'Primary PM of $35M UBS IB Bond AMC; +253 bps vs BBG Barclays IG Index since inception.',
    'highlights.2': 'Executed $12M 15‑name US equity short‑put strategy with valuation screens and IV/RV calibration.',
    'highlights.3': 'Structured $30M cross‑currency loan optimization strategy across CHF/JPY/CNH.',
    'markets.title': 'Live Markets',
    'markets.disclaimer': 'Delayed data · TradingView',
    'markets.equities': 'Equities',
    'markets.rates': 'Rates & Credit',
    'markets.fx': 'FX & Dollar',
    'markets.commodities': 'Commodities & Crypto',
    'exp.title': 'Experience',
    'exp.poseidon.title': 'Poseidon Capital Limited — Associate Portfolio Manager',
    'exp.poseidon.time': 'Hong Kong · Nov 2021 – Present',
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
    'edu.fudan.detail': '2014–2017 · Shanghai',
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
    'contact.lead': 'Best way to reach me is via LinkedIn.'
  },
  zh: {
    'nav.home': '主页',
    'nav.experience': '经历',
    'nav.projects': '项目',
    'nav.education': '教育',
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
    'cta.experience': '查看经历',
    'cta.projects': '查看项目',
    'cta.resume': '下载简历（PDF）',
    'edu.umich': '密歇根大学（数学学士）· 2018–2022',
    'edu.fudan': '复旦大学附属中学 · 2014–2017',
    'link.email': '邮箱',
    'link.github': 'GitHub',
    'certs.title': '牌照与认证',
    'certs.sfc4': 'SFC 第4类牌照',
    'certs.sfc9': 'SFC 第9类牌照',
    'certs.bmc': '彭博市场概念证书',
    'certs.jpm': '摩根大通虚拟体验项目',
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
    'markets.disclaimer': '数据延迟 · TradingView',
    'markets.equities': '股票',
    'markets.rates': '利率与信用',
    'markets.fx': '外汇与美元',
    'markets.commodities': '大宗商品与加密资产',
    'exp.title': '工作经历',
    'exp.poseidon.title': '波塞冬资本有限公司 — 副投资组合经理',
    'exp.poseidon.time': '香港 · 2021年11月 – 至今',
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
    'contact.lead': '最佳联系方式是通过领英。'
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
