import test from "node:test";
import assert from "node:assert/strict";
import { greeting, parseNews, ago, weatherIcon, shortcuts, parseTickers, tickerLabel, quoteFromChart, assetName, sparkPath, money, points, percent } from "./newtab-model.js";

test("a saudação segue a hora do dia", () => {
  assert.equal(greeting(6), "Bom dia");
  assert.equal(greeting(12), "Boa tarde");
  assert.equal(greeting(19), "Boa noite");
  assert.equal(greeting(3), "Boa noite");
});

test("as notícias do Google Notícias saem sem o nome da fonte no título", () => {
  const xml = `<rss><channel><item><title>Lobo é visto em Minas - G1</title><link>https://news.google.com/a</link><pubDate>Mon, 26 Oct 2026 12:00:00 GMT</pubDate><source url="https://g1.globo.com">G1</source></item><item><title>Sem link</title></item><item><title><![CDATA[Chuva &amp; frio]]></title><link>https://news.google.com/b</link><source url="https://x.com">X &amp; Y</source></item></channel></rss>`;
  const news = parseNews(xml);
  assert.equal(news.length, 2);
  assert.deepEqual(news[0], { title: "Lobo é visto em Minas", link: "https://news.google.com/a", source: "G1", sourceUrl: "https://g1.globo.com", published: Date.parse("Mon, 26 Oct 2026 12:00:00 GMT") });
  assert.equal(news[1].title, "Chuva & frio");
  assert.equal(news[1].source, "X & Y");
});

test("o tempo desde a publicação fica curto", () => {
  const now = Date.parse("2026-10-26T15:00:00Z");
  assert.equal(ago(now - 5 * 60000, now), "há 5 min");
  assert.equal(ago(now - 3 * 3600000, now), "há 3 h");
  assert.equal(ago(now - 26 * 3600000, now), "há 1 dia");
  assert.equal(ago(null, now), "");
});

test("o código do tempo vira ícone, de dia e de noite", () => {
  assert.equal(weatherIcon(0), "sun");
  assert.equal(weatherIcon(0, false), "moon");
  assert.equal(weatherIcon(63), "cloud-rain");
  assert.equal(weatherIcon(95), "cloud-lightning");
});

test("os atalhos juntam fixadas e mais visitados sem repetir", () => {
  const pinned = [{ url: "https://youtube.com/", title: "YouTube" }];
  const top = [{ url: "https://youtube.com", title: "YT" }, { url: "chrome://history", title: "x" }, { url: "https://github.com/", title: "" }];
  assert.deepEqual(shortcuts(pinned, top), [
    { url: "https://youtube.com/", title: "YouTube", pinned: true },
    { url: "https://github.com/", title: "github.com", pinned: false },
  ]);
});

test("as ações escritas viram tickers do Yahoo, B3 com .SA", () => {
  assert.deepEqual(parseTickers("petr4, VALE3 ;AAPL  bova11 petr4 ^GSPC <script>"), ["PETR4.SA", "VALE3.SA", "AAPL", "BOVA11.SA", "^GSPC"]);
  assert.deepEqual(parseTickers(""), []);
  assert.equal(parseTickers("A B C D E F", 3).length, 3);
  assert.equal(tickerLabel("PETR4.SA"), "PETR4");
  assert.equal(tickerLabel("AAPL"), "AAPL");
});

test("a cotação sai do chart do Yahoo com a variação do dia", () => {
  const chart = (meta) => ({ chart: { result: [{ meta }] } });
  assert.deepEqual(quoteFromChart(chart({ symbol: "^BVSP", longName: "IBOVESPA", regularMarketPrice: 170433.92, regularMarketChangePercent: -0.335, currency: "BRL" })), { symbol: "^BVSP", name: "IBOVESPA", fund: false, price: 170433.92, change: -0.335, currency: "BRL", spark: [] });
  const q = quoteFromChart(chart({ symbol: "PETR4.SA", regularMarketPrice: 52.96, chartPreviousClose: 50, currency: "BRL" }));
  assert.ok(Math.abs(q.change - 5.92) < 1e-9);
  assert.equal(quoteFromChart({ chart: { result: null } }), null);
  const fii = quoteFromChart({ chart: { result: [{ meta: { symbol: "MXRF11.SA", longName: "Maxi Renda Fundo De Investimento Imobiliaro - FII", shortName: "FII MAXI RENCI", regularMarketPrice: 8.89 }, indicators: { quote: [{ close: [8.9, null, 8.88, 8.89] }] } }] } });
  assert.equal(fii.fund, true);
  assert.equal(fii.name, "Maxi Renda");
  assert.deepEqual(fii.spark, [8.9, 8.88, 8.89]);
  assert.equal(quoteFromChart(chart({ symbol: "X" })), null);
});

test("o nome do papel sai sem S.A. e sem o \"Fundo de Investimento Imobiliário\"", () => {
  assert.equal(assetName("Engie Brasil Energia S.A."), "Engie Brasil Energia");
  assert.equal(assetName("Cshg Logistica - Fundo De Investimento Imobiliario"), "Cshg Logistica");
  assert.equal(assetName("Xp Malls Fundo Investimentos Imobiliarios"), "Xp Malls");
  assert.equal(assetName("Kinea Renda Imobiliária Fundo de Investimento Imobiliário"), "Kinea Renda Imobiliária");
  assert.equal(assetName(""), "");
});

test("o gráfico do dia ocupa a caixa toda", () => {
  assert.equal(sparkPath([1, 3, 2], 100, 20), "M0 20L50 0L100 10");
  assert.equal(sparkPath([5, 5], 10, 4), "M0 2L10 2");
  assert.equal(sparkPath([5], 10, 4), "");
});

test("valores do mercado no jeito brasileiro", () => {
  assert.equal(money(5.367).replace(/\s/g, " "), "R$ 5,37");
  assert.equal(points(170433.92), "170.434");
  assert.equal(percent(0.389), "+0,39%");
  assert.equal(percent(-0.335), "−0,34%");
  assert.equal(percent(0), "0,00%");
  assert.equal(percent(null), "");
});
