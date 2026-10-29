// Busca cotações da B3 (Yahoo Finance, sem chave) e grava radar-precos/precos.json
import { writeFileSync, readFileSync, existsSync } from 'node:fs';

const TICKERS = 'AXIA3,SBSP3,PETR4,RDOR3,ITUB4,BPAC11,PRIO3,VALE3,EMBJ3,RENT3,CPFE3,ISAE4,PASS3,SAUD3,RECV3,POMO3,BRBI11,VLID3,ALOS3,B3SA3,TTEN3,PRNR3,LAVV3,PINE4,VTRU3,SMFT3,CAMB3,PNVL3,CURY3,ORVR3,ENEV3,GGBR4,MOTV3,VRTA11,HGRU11,RBRY11,BTLG11,XPML11,SPXR11,IVVB11,NASD11,PKIN11,GOLX11,HODL11,BBAS3,BBDC4,EGIE3,CMIG4,TIMS3,SUZB3,VBBR3,ITSA4,TOTS3,MULT3,HYPE3'.split(',');
const UA = 'Mozilla/5.0 (compatible; radar-precos/1.0)';
const FILE = new URL('./precos.json', import.meta.url);

async function cotacao(symbol) {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=5d&interval=1d`;
  for (let i = 0; i < 3; i++) {
    try {
      const r = await fetch(url, { headers: { 'User-Agent': UA } });
      if (!r.ok) throw new Error('HTTP ' + r.status);
      const j = await r.json();
      const res = j.chart?.result?.[0];
      const p = res?.meta?.regularMarketPrice;
      if (!(p > 0)) throw new Error('sem preço');
      const closes = (res.indicators?.quote?.[0]?.close || []).filter((x) => x != null);
      const last = closes[closes.length - 1];
      const prev = closes.length >= 2 && Math.abs(last - p) < 0.006 ? closes[closes.length - 2] : last;
      return {
        p: Math.round(p * 100) / 100,
        c: prev ? Math.round((p / prev - 1) * 10000) / 100 : null,
        t: new Date((res.meta.regularMarketTime || 0) * 1000).toISOString(),
      };
    } catch (e) {
      if (i === 2) { console.error(symbol, e.message); return null; }
      await new Promise((r) => setTimeout(r, 1500 * (i + 1)));
    }
  }
}

const prices = {};
for (const t of TICKERS) {
  const q = await cotacao(t + '.SA');
  if (q) prices[t] = q;
  await new Promise((r) => setTimeout(r, 250));
}
const ibov = await cotacao('^BVSP');

const ok = Object.keys(prices).length;
console.log(`cotações obtidas: ${ok}/${TICKERS.length}; ibov: ${ibov ? ibov.p : 'falhou'}`);
if (ok < TICKERS.length * 0.8) {
  console.error('Poucas cotações; mantendo o arquivo anterior.');
  process.exit(1);
}
let old = {};
if (existsSync(FILE)) { try { old = JSON.parse(readFileSync(FILE, 'utf8')).prices || {}; } catch {} }
for (const t of TICKERS) if (!prices[t] && old[t]) prices[t] = { ...old[t], stale: true };

writeFileSync(FILE, JSON.stringify({
  geradoEm: new Date().toISOString(),
  fonte: 'Yahoo Finance',
  ibov,
  prices,
}, null, 1) + '\n');
