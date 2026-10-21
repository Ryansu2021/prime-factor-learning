# 質因數分解互動學習網

國中七年級數學・質因數分解互動學習網頁：前測分流、因數與倍數、埃拉托斯特尼篩法、短除法工作台、迷思導向亂數闖關、教師即時戰情室。

- 學生網址：https://ryansu2021.github.io/prime-factor-learning/
- 教師戰情室：https://ryansu2021.github.io/prime-factor-learning/?teacher=1

## 檔案

| 檔案 | 用途 |
|---|---|
| `index.html` | 學生網頁與教師戰情室（GitHub Pages） |
| `gas/Code.gs` | Google Apps Script 後端範本（收資料、寫入試算表） |

## 啟用雲端紀錄

1. 新建 Google 試算表 → 擴充功能 → Apps Script，貼上 `gas/Code.gs`。
2. 在你的 Apps Script 專案裡修改 `TEACHER_KEY`。⚠️ **不要把真正的教師密碼 commit 到這個公開儲存庫。**
3. 執行 `setup` 一次並授權。
4. 部署 → 新增部署作業 → 網頁應用程式；執行身分「我」、存取權「所有人」，複製 `/exec` 網址。
5. 把網址填入 `index.html` 的 `const API_URL = '';`。

未設定 `API_URL` 時，網頁以本機模式運作，學習紀錄只存在學生自己的裝置。
