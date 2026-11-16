// 讀取中央氣象署「臺灣各縣市鄉鎮未來1週逐12小時天氣預報」（F-D0047-091），
// 整理成每個縣市、每一天的資料，寫入 data/cwa.json 給網頁使用。
// 授權碼由環境變數 CWA_KEY 提供（GitHub Actions 的 Secrets），不會寫進輸出檔。
import { writeFile, mkdir } from 'node:fs/promises';
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

// 與某天重疊的時段：前一晚 18 時、當天 06 時、當天 18 時
function overlapping(periods, date) {
  const prev = addDays(date, -1);
  return periods.filter(p => p.date === date || (p.date === prev && p.hour >= 12));
}

function summarizeDay(el, date) {
  const startsOn = list => list.filter(p => p.date === date);
  const daytime = list => startsOn(list).find(p => p.hour < 12) ?? startsOn(list)[0];
  const maxOf = list => (list.length ? Math.max(...list.map(p => p.value)) : null);
  const minOf = list => (list.length ? Math.min(...list.map(p => p.value)) : null);
  const weather = daytime(el.weather);
  return {
    code: weather?.value.code ?? null,
    text: weather?.value.text ?? null,
    tmax: maxOf(overlapping(el.tmax, date)),
    tmin: minOf(overlapping(el.tmin, date)),
    amax: maxOf(overlapping(el.amax, date)),
    amin: minOf(overlapping(el.amin, date)),
    pop: maxOf(startsOn(el.pop)),
    wind: maxOf(startsOn(el.wind)),
    uv: daytime(el.uv)?.value ?? null,
    desc: daytime(el.desc)?.value ?? null,
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
  const output = { source: '中央氣象署 F-D0047-091 臺灣各縣市未來1週逐12小時天氣預報', dataset: DATASET, updatedAt: new Date().toISOString(), locations };
  await mkdir(dirname(OUTPUT), { recursive: true });
  await writeFile(OUTPUT, JSON.stringify(output, null, 1) + '\n');
  console.log(`已寫入 ${OUTPUT}：${locations.length} 個縣市`);
}

main().catch(err => { console.error(err.message); process.exit(1); });
