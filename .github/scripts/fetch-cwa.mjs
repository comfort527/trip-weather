// 讀取中央氣象署「臺灣各縣市鄉鎮未來1週逐12小時天氣預報」（F-D0047-091），
// 整理成每個縣市、每一天的資料，寫入 data/cwa.json 給網頁使用。
// 授權碼由環境變數 CWA_KEY 提供（GitHub Actions 的 Secrets），不會寫進輸出檔。
import { writeFile, mkdir, readFile } from 'node:fs/promises';
import { dirname } from 'node:path';

const DATASET = 'F-D0047-091';
const OUTPUT = process.argv[2] ?? 'data/cwa.json';

function toNumber(value) {
  const n = Number(value);
  return value === '' || value == null || !Number.isFinite(n) ? null : n;
}

function addDays(iso, n) {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

async function fetchForecast(key) {
  const url = `https://opendata.cwa.gov.tw/api/v1/rest/datastore/${DATASET}?Authorization=${encodeURIComponent(key)}&format=JSON`;
  const response = await fetch(url);
  if (!response.ok) throw new Error(`中央氣象署 API 回應錯誤：HTTP ${response.status}`);
  const body = await response.json();
  if (String(body?.success) !== 'true') throw new Error('中央氣象署 API 回應失敗（success 不是 true）');
  return body?.records?.Locations?.[0] ?? null;
}

// 把每個時段（12 小時）依「開始日期」分組，並記下時段開始的小時
function groupPeriods(times, readValue) {
  return (times ?? []).map(t => ({ date: t.StartTime?.slice(0, 10), hour: Number(t.StartTime?.slice(11, 13)), value: readValue(t.ElementValue?.[0] ?? {}) }))
    .filter(p => p.date && p.value != null);
}

// 每天分三個時段：前一晚（前一天 18 時起，涵蓋當天清晨）、白天（當天 18 時前開始）、晚上（當天 18 時起）
function periodsOf(list, date) {
  const prev = addDays(date, -1);
  return {
    prevNight: list.filter(p => p.date === prev && p.hour >= 18),
    day: list.filter(p => p.date === date && p.hour < 18),
    night: list.filter(p => p.date === date && p.hour >= 18),
  };
}

function summarizeDay(el, date) {
  const maxOf = list => (list.length ? Math.max(...list.map(p => p.value)) : null);
  const minOf = list => (list.length ? Math.min(...list.map(p => p.value)) : null);
  const first = list => list[0]?.value ?? null;
  // 最高溫看白天；最低溫看當天清晨（前一晚時段）到白天，與氣象署白天描述的溫度範圍一致
  const dayOnly = name => { const p = periodsOf(el[name], date); return p.day.length ? p.day : p.night; };
  const morningToDay = name => { const p = periodsOf(el[name], date); return [...p.prevNight, ...dayOnly(name)]; };
  const w = periodsOf(el.weather, date), pop = periodsOf(el.pop, date), desc = periodsOf(el.desc, date), wind = periodsOf(el.wind, date);
  const weather = first(w.day) ?? first(w.night);
  return {
    code: weather?.code ?? null,
    text: weather?.text ?? null,
    tmax: maxOf(dayOnly('tmax')),
    tmin: minOf(morningToDay('tmin')),
    amax: maxOf(dayOnly('amax')),
    amin: minOf(morningToDay('amin')),
    pop: maxOf([...pop.day, ...pop.night]),
    popDay: first(pop.day),
    popNight: first(pop.night),
    wind: maxOf([...wind.day, ...wind.night]),
    uv: first(periodsOf(el.uv, date).day),
    descDay: first(desc.day),
    descNight: first(desc.night),
  };
}

function summarizeLocation(loc) {
  const byName = Object.fromEntries((loc.WeatherElement ?? []).map(e => [e.ElementName, e.Time]));
  const el = {
    tmax: groupPeriods(byName['最高溫度'], v => toNumber(v.MaxTemperature)),
    tmin: groupPeriods(byName['最低溫度'], v => toNumber(v.MinTemperature)),
    amax: groupPeriods(byName['最高體感溫度'], v => toNumber(v.MaxApparentTemperature)),
    amin: groupPeriods(byName['最低體感溫度'], v => toNumber(v.MinApparentTemperature)),
    pop: groupPeriods(byName['12小時降雨機率'], v => toNumber(v.ProbabilityOfPrecipitation)),
    wind: groupPeriods(byName['風速'], v => toNumber(v.WindSpeed)),
    uv: groupPeriods(byName['紫外線指數'], v => toNumber(v.UVIndex)),
    weather: groupPeriods(byName['天氣現象'], v => (v.WeatherCode ? { code: String(v.WeatherCode), text: String(v.Weather ?? '') } : null)),
    desc: groupPeriods(byName['天氣預報綜合描述'], v => (v.WeatherDescription ? String(v.WeatherDescription) : null)),
  };
  const dates = [...new Set(el.weather.map(p => p.date))].sort();
  const days = Object.fromEntries(dates.map(d => [d, summarizeDay(el, d)]));
  return { name: String(loc.LocationName ?? ''), lat: toNumber(loc.Latitude), lon: toNumber(loc.Longitude), days };
}

async function main() {
  const key = process.env.CWA_KEY;
  if (!key) throw new Error('缺少環境變數 CWA_KEY');
  const data = await fetchForecast(key);
  const locations = (data?.Location ?? []).map(summarizeLocation).filter(l => l.lat != null && l.lon != null);
  if (!locations.length) throw new Error('沒有取得任何縣市資料');
  // 預報內容沒變就不改檔，避免排程每次都產生一筆提交
  const previous = await readFile(OUTPUT, 'utf8').then(JSON.parse).catch(() => null);
  if (previous && JSON.stringify(previous.locations) === JSON.stringify(locations)) {
    console.log('預報內容沒有變動，不更新檔案');
    return;
  }
  const output = { source: '中央氣象署 F-D0047-091 臺灣各縣市未來1週逐12小時天氣預報', dataset: DATASET, updatedAt: new Date().toISOString(), locations };
  await mkdir(dirname(OUTPUT), { recursive: true });
  await writeFile(OUTPUT, JSON.stringify(output, null, 1) + '\n');
  console.log(`已寫入 ${OUTPUT}：${locations.length} 個縣市`);
}

main().catch(err => { console.error(err.message); process.exit(1); });
