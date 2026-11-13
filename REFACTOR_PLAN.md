# 整理計畫
最後檢查日期：2026-11-13

> 依 CLAUDE.md「既有程式碼（遷移中）」規則：一次只做一項、不可改變外觀與功能；標為「高」或涉及搬移檔案、改路徑、刪除大段程式碼的項目，動手前先列出受影響處並經確認。
> 行號以檢查當天的 `index.html` 為準，修改後會位移，請以函式名稱搜尋。

## 檢查摘要
- 檔案：`index.html` 1777 行（內嵌 CSS 第 18–516 行約 500 行、內嵌 JS 第 712–1777 行約 1065 行，非 module）、`data.json`、`site.webmanifest`、`favicon.svg`、3 個 PNG 圖示、`README.md`。沒有獨立的 CSS／JS 檔案。
- 本地引用（favicon.svg、favicon-32.png、apple-touch-icon.png、site.webmanifest、data.json）都存在；外部資源：Google Fonts、Leaflet（unpkg）、Open-Meteo API、GitHub API、OpenStreetMap 圖磚。
- 未發現：`var`、inline `onclick` 等事件屬性、缺 alt 的圖片（全站無 `<img>`）、多個 `<h1>`、跨頁重複頁首頁尾（單一頁面）。
- `innerHTML` 共 35 處，抽查顯示使用者與 API 的文字都先經過 `esc()` 轉義，未發現直接放入的原始資料，但不符合「用 textContent」的規則。
- 函式依行數計算都未超過 40 行，但有 20 行單行超過 400 字元（多個函式被壓成少數超長行），實際上難以閱讀與維護。

---

## 一、穩定與資安

- [x] #1【風險：低】空的 catch 與靜默吞掉錯誤
  - 完成：2026-11-13。16 處 catch 補上 `console.error`（含多模型資料、歷年平均、地點查詢、發布、登入、測試連線），畫面與流程不變；保留 4 處 `r.json().catch(() => ({}))`（讀取錯誤回應內容的備援，之後仍依狀態碼顯示錯誤）。驗證：重新截圖與 baseline 比對無版面差異，模擬 API 斷線時 Console 出現中文錯誤說明、頁面正常。
  - 檔案：index.html
  - 問題：`sset()`（第 749 行）、`sdel()`（第 750 行）為空的 `catch {}`；`fixLocalTime()`（883）、`ensurePast()`（911）、`loadWeather()`（1327）、`renderPreview()`（1616）、`runLookup()`（1405、1409、1410 的 `.catch(() => null / ({}))`）、`loadData()`（1008）在錯誤時只改狀態，沒有 `console.error`。
  - 做法：在上述 catch 內加上 `console.error`（附簡短說明），不改變畫面行為；瀏覽器儲存空間的錯誤只記錄、不打擾使用者。
  - 驗證：T1、T2、T23、T41；Console 在正常情況下仍無紅字。

- [x] #2【風險：低】天氣載入失敗缺少「重試」
  - 完成：2026-11-13。總覽（電腦版說明列、手機版組別頁籤下方）與地點查詢在天氣載入失敗時顯示「重新載入天氣」，按下只重抓失敗的部分，成功後自動隱藏；新程式用 `data-js` 掛鉤、BEM class、單一 `status`（`STATUS` 常數）。驗證：模擬斷線三處皆出現、恢復連線按重試後消失且資料正常；正常狀態截圖與 baseline 相同。尚未有間距／圓角 token，新 CSS 的數值待 #4、#5 一併改用變數。
  - 檔案：index.html
  - 問題：天氣 API 失敗時格子只顯示「無資料／錯誤訊息」，沒有重試按鈕（規則要求錯誤畫面含重試）。地點查詢失敗時同樣只有文字。
  - 做法：在總覽下方說明列與地點查詢狀態列加「重新載入天氣」按鈕，只在有錯誤時出現。此項會新增一顆按鈕，**動手前需確認**。
  - 驗證：T23、T41（模擬斷網後按重試可恢復）。

- [x] #3【風險：低】innerHTML 逐處確認並註記
  - 完成：2026-11-13。逐一追查 181 個樣板插入值：使用者輸入與 API 文字都已經過 `esc()`，其餘寫入 `textContent`、網址或提交訊息；另發現降雨機率、日出日落等 API 原始欄位直接進入 HTML，改為在資料進來時用新增的 `toNum()`／`toTime()` 清理（fcDay、fetchPast），並在 `esc()` 旁加註使用原則。驗證：輸入 `<b>test</b>` 預覽時顯示原字串；偽造夾帶 HTML 的 API 回應不會產生元素或執行程式；7 張截圖與 baseline 完全相同。
  - 檔案：index.html
  - 問題：35 處 `innerHTML`（如第 829、832、833、1098、1153、1187、1240、1249、1281、1313…）。目前動態文字皆經 `esc()`，但規則要求改用 `textContent` 或安全組裝。
  - 做法：本項只逐一確認每處的資料來源，把仍含未轉義資料的地方改為 `esc()` 或 `textContent`，並在 `esc()` 旁加註說明用途；全面改寫為 DOM 組裝留待 JS 拆檔時（#12 之後）逐檔處理。
  - 驗證：在行程名稱、組別、顯示名稱輸入 `<b>test</b>` 後發布預覽，畫面應顯示原字串而非粗體（T60、T66、T71）。

## 二、抽出設計變數（tokens.css）

- [ ] #4【風險：低】建立 css/tokens.css
  - 檔案：index.html、新增 css/tokens.css
  - 問題：色彩與字型變數寫在 index.html 的 `:root`（含深色模式三組區塊）。
  - 做法：把 `:root`、`@media (prefers-color-scheme:dark)`、`:root[data-theme="dark"]` 三組變數原樣搬到 `css/tokens.css`，index.html 以 `<link>` 引用；內容不變。
  - 驗證：T5、T13、T30；淺色與深色模式畫面與搬移前一致。

- [ ] #5【風險：低】CSS 中寫死的色碼改用變數（依賴 #4）
  - 檔案：css/tokens.css、index.html
  - 問題：token 區塊外的寫死色碼：第 122 行 `.segbar` `#fff`、152 行 `.pill.today` `#1b1300`、156 行 `.drow .gchip` `#fff`、174 行 `.scrim` `rgba(10,16,22,.38)`、175 行 `.drawer` 陰影、485 行 `.bdate .tt` `#1b1300`、504 行 `.tabbar .badge` `#fff`；JS 第 1263、1267 行地圖預設色 `#3a4fc2`、`#fff`；`.vbar.tint` 的 `#17212b`；`placeColor`／`SHADES` 等 `color-mix(…#000/#fff)`。
  - 做法：新增 `--on-accent`、`--on-today`、`--scrim`、`--shadow-drawer` 等變數取代；JS 讀取 CSS 變數。122、156 行屬於 #6 要刪除的舊樣式，可略過。
  - 驗證：T5、T21、T34、T36。

## 三、刪除無用程式碼

- [ ] #6【風險：中】刪除舊版矩陣與舊手機清單（**刪除大段程式碼，動手前需確認**）
  - 檔案：index.html
  - 問題：未被呼叫的函式 `lanesFor()`（1046）、`wxButton()`（1067）、`renderDayList()`（1190）；`<section class="daylist">` 與其 CSS（`.daylist`、`.day`、`.day-h`、`.drow`…）；舊橫式矩陣的 CSS（`.band`、`.dh`、`.gname`、`.segbar`、`.cell`、`.wx`、`.empty-cell`）；舊編輯頁的 CSS（`.seg-table`、`.grp-list`、`.grp-row`、`.ed-sec`、`.ed-grid2`）。
  - 做法：先列出每段 CSS 選擇器並搜尋確認 HTML／JS 都沒有使用，再一次刪除。
  - 驗證：T13–T22、T30–T38、T60–T77，畫面不變。

## 四、共用頁首頁尾
- 單一頁面，目前不需要。之後若新增頁面再建立 `<site-header>`／`<site-footer>`。

## 五、CSS 規則

- [ ] #7【風險：低】`!important` 例外確認
  - 檔案：index.html
  - 問題：第 60 行 `[hidden]{display:none!important}`、第 515 行 `prefers-reduced-motion` 的 `transition:none!important`。兩者是常見的無障礙／隱藏慣例。
  - 做法：**請你決定**是否列為允許的例外；若允許，在 CLAUDE.md 註記，不改程式。
  - 驗證：無（文件項目）。

- [ ] #8【風險：低】`#id` 選擇器改為 class
  - 檔案：index.html
  - 問題：第 170、439 行 `#tripMap,#lookupMap`；第 310 行 `.ed-bar #draftState,#downloadBtn,#importBtn`；第 312 行 `#ghSet`；第 509 行 `#view-overview .summary/.board`。
  - 做法：在對應元素加 class（如 `map-box`、`ed-bar__optional`），CSS 改用 class。
  - 驗證：T22、T43、T38、T77、手機版編輯操作列。

- [ ] #9【風險：中】靜態 inline style 改為 class
  - 檔案：index.html
  - 問題：`style="..."` 共 56 處。靜態的如：第 519–531 行 SVG 圖示的 `style="fill:var(…)"`、HTML 中的 `style="font-weight:400;font-size:12px"`、`style="gap:4px"`、`style="padding:28px 18px"` 等；動態的如矩陣格線位置 `grid-row/grid-column`、城市顏色 `background`。
  - 做法：本項只處理**靜態**的 inline style，改成 class。動態位置與顏色改用 CSS 自訂屬性（如 `style="--row:3"`）是否算違規，**請你決定**後另立項目。
  - 驗證：T13、T20、T30、T60–T70 畫面不變。

- [ ] #10【風險：高】斷點改為 640／1024、行動優先（**會改變版面，需你決定**）
  - 檔案：index.html（或拆檔後的 CSS）
  - 問題：現行斷點為 max-width 480／600／760／860／900／1120（桌機優先），與規則的 `<640`、`640–1023`、`≥1024`（min-width）不同。例如 640–760px 的寬度目前顯示手機版，改用規則斷點後會變成平板版。
  - 做法：決定後再規劃；在此之前維持現狀。
  - 驗證：375／768／1280px 三種寬度截圖比對。

## 六、JS 拆檔與改成 module

- [ ] #11【風險：低】超長行重新排版
  - 檔案：index.html
  - 問題：20 行超過 400 字元（集中在 `renderGrid`、`hxButton`、`renderMobileList`、`openDrawer`、`renderEdSegs`、`renderCal`、`renderLookupMap`、`runLookup` 等），名義上函式不到 40 行，實際難以閱讀。
  - 做法：只換行與縮排，不改邏輯；換行後超過 40 行的函式記成新項目再拆。
  - 驗證：全部 T 項目抽測；畫面不變。

- [ ] #12【風險：中】抽出 js/constants.js 與 js/utils.js
  - 檔案：index.html、新增 js/constants.js、js/utils.js
  - 問題：狀態字串（'loading'、'past'、'fc'、'cl'、'obs' 等約 41 處）散落各處；日期、格式化等純函式（`localISO`、`parseISO`、`addDays`、`diffDays`、`rangeDates`、`md`、`wd`、`r0`、`r1`、`locKey`、`esc`、`wxInfo`）與 DOM 程式混在一起。
  - 做法：先建立兩個檔案並以 `type="module"` 載入，同時把主程式改為 module（目前沒有 inline 事件屬性，不影響按鈕）。
  - 驗證：全部 T 項目抽測；Console 無錯誤。

- [ ] #13【風險：中】抽出 js/api.js（依賴 #12）
  - 檔案：index.html、新增 js/api.js
  - 問題：`fetch` 散在 5 處（第 756 `getJSON`、1005 `loadData`、1655 `ghRequest`、1723 測試連線、1735 登入驗證）。
  - 做法：Open-Meteo（預報、模型、歷年、實際天氣、地點搜尋）、GitHub（讀寫 data.json、權限檢查）、讀取 data.json 全部移到 api.js，每個函式檢查 `response.ok` 並丟出中文錯誤。
  - 驗證：T1、T2、T23、T40–T41、T51–T53、T72、T76。

- [ ] #14【風險：中】依畫面拆分元件檔（依賴 #12、#13）
  - 檔案：新增 js/components/overview-board.js、mobile-list.js、detail-drawer.js、lookup.js、editor.js、gate.js 等
  - 問題：主程式約 1065 行，遠超過單檔 200 行；JS 以 `id` 抓元素，未使用 `data-js`。
  - 做法：一次搬一個畫面（建議順序：詳細面板 → 地點查詢 → 登入 → 總覽 → 手機清單 → 編輯），搬的同時把該畫面的元素改用 `data-js`、`innerHTML` 改安全組裝。每個畫面各算一個子項，完成一個打勾一個。
  - 驗證：對應畫面的 T 項目。

- [ ] #15【風險：高】CSS 拆檔與 BEM 命名（依賴 #4、#6）
  - 檔案：新增 css/base.css、css/components.css、css/pages/*.css
  - 問題：約 500 行 CSS 內嵌在 index.html，class 命名未採 BEM（如 `.vh`、`.hx`、`.vbar`）。
  - 做法：先原樣拆檔（不改名），再分批改名為 BEM；改名牽涉 JS 產生的 HTML，需與 #14 同步。
  - 驗證：375／768／1280px 截圖比對。

## 七、搬移目錄

- [ ] #16【風險：高】圖示搬到 assets/（**改路徑，需確認**）
  - 檔案：favicon.svg、favicon-32.png、apple-touch-icon.png、icon-192.png、icon-512.png、site.webmanifest、index.html
  - 問題：圖示與 manifest 放在根目錄。
  - 做法：列出 index.html 的 4 個 `<link>` 與 manifest 內 3 個圖示路徑，確認後一起修改。`data.json` **不建議搬移**：編輯頁發布時寫入的 GitHub 路徑與同仁讀取的網址都依賴它。
  - 驗證：T3。

## 其他

- [ ] #17【風險：低】隱藏的檔案選擇欄位補上標籤
  - 檔案：index.html
  - 問題：`#importFile`（匯入 data.json 用的隱藏 `<input type="file">`）沒有 `<label>`／`aria-label`。
  - 做法：加 `aria-label="選擇要匯入的 data.json"`。
  - 驗證：T74。

- [ ] #18【風險：低】已過日期實際天氣載入失敗時，格子顯示「已過」而非錯誤
  - 檔案：index.html
  - 問題：`ensurePast()` 失敗時把日期記為 `null`，`cellData()` 因此回傳 `past`，電腦版與手機版都顯示「已過」，看不出是載入失敗（重試按鈕會出現，但格子內容誤導）。
  - 做法：失敗的地點（`pastFailed`）回傳錯誤狀態並顯示「實際天氣載入失敗」。
  - 驗證：T17、T23（模擬斷線）。
