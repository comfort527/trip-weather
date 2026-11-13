# 專案規則（純 HTML / CSS / JavaScript）

> 本檔案是給 AI 的工作規則。每次修改程式碼前都必須遵守。
> 規則與程式碼衝突時，以本檔案為準；需要破例時，先問我。

## 專案資訊（請自行填寫）
- 網站用途：公務出訪團體（本隊＋先遣各組）的行程天氣看板。顯示各組每天所在城市的天氣：16 天內為預報（含多模型可信度）、之後為歷年同期平均、已過日期為實際天氣；管理者可線上編輯行程並發布到 GitHub（GitHub Pages：https://comfort527.github.io/trip-weather/）。
- 主要頁面：`index.html`（單頁，以網址 hash 切換畫面：`#overview` 行程總覽、`#lookup` 地點查詢、`#alerts` 需要留意（手機）、`#edit` 編輯（需管理者權杖，未登入顯示登入畫面）、`#edit-preview` 編輯預覽）；行程資料為 `data.json`。
- 支援瀏覽器：最新版 Chrome、Safari、Edge、Firefox（含手機版）
- 不使用框架、不使用建置工具。新增任何第三方套件前必須先問我。

## 目錄結構
```
index.html
pages/              其他頁面（about.html、contact.html…）
css/
  tokens.css        設計變數：顏色、字級、間距、圓角、陰影
  base.css          全站基礎樣式與重設
  components.css    共用元件樣式（按鈕、卡片、表單…）
  pages/            個別頁面專屬樣式
js/
  main.js           頁面進入點，只負責組裝與初始化
  api.js            所有 fetch 呼叫集中在這裡
  utils.js          純函式（格式化日期、價格、驗證…）
  constants.js      狀態、路徑、設定值等常數
  components/       共用 UI 元件（site-header.js、site-footer.js…）
assets/             圖片、字型、圖示
```
- 新檔案一律放進對應資料夾，不要在根目錄堆檔案。
- 若 `tokens.css` 或上述檔案還不存在，需要時先建立。

## HTML 規則
- 使用語意化標籤：`header`、`nav`、`main`、`section`、`article`、`footer`、`button`。
- 每頁只有一個 `<h1>`，標題層級不可跳級。
- 圖片必須有 `alt`；表單欄位必須有對應的 `<label>`。
- 禁止 inline `style="..."` 與 inline `onclick="..."`。
- JS 要抓取的元素用 `data-js="名稱"` 標記，不要拿樣式用的 class 當 JS 掛鉤。
- 頁首、頁尾、導覽列等跨頁重複的區塊，做成 Web Component（例如 `<site-header>`），不要複製貼上到每一頁。

## CSS 規則
- 顏色、字級、間距、圓角、陰影只能使用 `tokens.css` 的 CSS 變數，禁止寫死色碼與數值。
- 斷點固定為：手機 `< 640px`、平板 `640px–1023px`、桌機 `≥ 1024px`。採用行動優先（min-width）。
- class 命名採用 BEM：`.card`、`.card__title`、`.card--featured`。
- 禁止用 `#id` 選擇器寫樣式；禁止 `!important`（除非先問我）。
  - 已核准的例外（2026-11-13，只限這兩處，其他地方仍禁止）：
    1. `[hidden]{display:none!important}`：確保加上 `hidden` 的元素一定隱藏，不被元件自己的 `display` 蓋掉。
    2. `@media (prefers-reduced-motion:reduce)` 中的 `transition:none!important; animation:none!important`：使用者開啟「減少動態效果」時關閉所有動畫（無障礙）。
- 選擇器巢狀不超過 3 層。

## JavaScript 規則
- 一律使用 ES Modules：`<script type="module" src="...">`，禁止建立全域變數。
- 只用 `const` / `let`，不用 `var`。
- 單一函式不超過 40 行、單一檔案不超過 200 行，超過就拆分。
- 函式命名用動詞開頭並說明用途（`renderProductList`、`formatPrice`），不要用 `data`、`tmp`、`handle` 這類模糊名稱。
- 格式化、計算、驗證寫成純函式放在 `utils.js`，不可直接操作 DOM。
- 狀態字串定義在 `constants.js`，不要在程式中散落字面字串。
- 用守衛子句提早 return，if 巢狀不超過 2 層。
- 插入使用者或 API 提供的文字時用 `textContent`，禁止把未處理的資料放進 `innerHTML`。

## 非同步資料與錯誤處理
- 所有 `fetch` 只能寫在 `api.js`，元件與頁面不得直接呼叫 `fetch`。
- 每個 API 函式都要檢查 `response.ok`，失敗時丟出有意義的錯誤訊息。
- 畫面狀態統一使用一個 `status`：`'idle' | 'loading' | 'success' | 'error'`，不要用多個布林旗標（`isLoading`、`isError`…）。
- 每個非同步區塊都要有：載入中畫面、錯誤畫面（含重試按鈕）、空資料畫面。
- 讀取 API 資料一律使用 `?.` 與 `??`，缺欄位時不可讓整頁壞掉。
- 禁止空的 `catch {}`：至少要 `console.error` 並讓使用者看到錯誤提示。

## 修改流程
1. 動手前先簡短說明：要改哪些檔案、為什麼。
2. 一次只做一件事，不順手修改與本次任務無關的程式碼。
3. 不做目前用不到的擴充、抽象或設定選項。
4. 刪除檔案或大段程式碼前先問我。
5. 完成後回報：改了哪些檔案、我該怎麼驗證。

## 既有程式碼（遷移中）
- 本網站有部分程式碼寫在這份規則之前，尚未符合規則。這是已知情況，不要一次全部改寫。
- 新寫的程式碼必須完全符合規則。
- 修改舊檔案時，只整理這次有動到的函式或區塊，不要順手重寫整個檔案。
- 大範圍整理只照 `REFACTOR_PLAN.md` 的項目進行，一次一項，完成後打勾並寫下驗證方式。
- 搬移檔案或改資料夾前，先列出所有受影響的連結、圖片、CSS、script 路徑，經我確認再動。
- 把 `<script>` 改成 `type="module"` 時，必須同時處理依賴全域函式的 inline `onclick`，否則按鈕會失效。
- 任何整理都不可改變畫面外觀與功能；若必須改變，先問我。

## 完成前檢查清單
- [ ] 瀏覽器 Console 沒有錯誤或警告
- [ ] 375px、768px、1280px 三種寬度版面正常、沒有水平捲軸
- [ ] 只用鍵盤（Tab / Enter）可以操作所有按鈕與表單
- [ ] 沒有寫死的色碼或數值、沒有 inline style
- [ ] 新增的 fetch 有載入中、錯誤、空資料三種畫面

## 本機預覽
ES Modules 無法用 `file://` 直接開啟，請用本機伺服器預覽，擇一：
- VS Code 安裝「Live Server」擴充套件，在 `index.html` 按右鍵選「Open with Live Server」
- 有安裝 Node.js：在專案根目錄執行 `npx serve .`
