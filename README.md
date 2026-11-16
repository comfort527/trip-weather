# 行程天氣總覽

多組人員行程的天氣看板，部署在 GitHub Pages。

- `index.html`：網頁本身（天氣即時向 Open-Meteo 取得）
- `data.json`：行程資料（由網頁的「編輯行程」發布時自動更新）

## 管理者如何編輯

1. 打開網站，點頁尾「編輯行程（管理者）」。
2. 第一次使用：展開「GitHub 發布設定」，填入帳號、repo、存取權杖並儲存（權杖只存在你的瀏覽器）。
3. 修改後按「儲存並發布」，約 1 分鐘後同仁重新整理即可看到。

## 資料來源

- 預報：Open-Meteo（ECMWF、NOAA GFS、DWD ICON 等模型）
- 歷年同期平均：Open-Meteo Historical Weather API（ERA5 再分析），過去 10 年、前後 3 天

## 中央氣象署預報（台灣地點）

- 台灣地點未來 7 天的預報使用中央氣象署開放資料（F-D0047-091 臺灣各縣市未來1週逐12小時天氣預報）。
- `.github/workflows/cwa.yml` 每 3 小時執行 `.github/scripts/fetch-cwa.mjs`，把資料整理成 `data/cwa.json`；網頁只讀這個檔案。
- 授權碼存在 repo 的 **Settings → Secrets and variables → Actions**，名稱 `CWA_KEY`，不會出現在程式碼或網頁中。
- `data/cwa.json` 讀不到或超過 36 小時未更新時，網頁自動改用 Open-Meteo。
