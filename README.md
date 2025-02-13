# Getamped-update-history

![logo](./image/logo_ga.png)

遊戲官網: https://getamped.cyberstep.com.tw

因為這遊戲網路上資料很少

韓服還算幸運，玩的人很多，所以還有文檔可以爬

中文資料打著燈籠都難找，通常只能問老手

官網的圖檔還有更新資料都有個刷新週期，久了會找不到

所以寫個爬蟲把資料都保存下來

至於會不會開放預覽，等我找到可以長期免費的方案再說

## HOW TO USE

```

git clone https://github.com/Mr-Smilin/Getamped-update-history.git

# rename .env.example to .env

npm install

# 開始爬蟲
npm run start

# 到 http://localhost:3000 查看爬蟲結果
npm run server

# 靜態檔案生成
npm run build

```

## 目前實現

- [x] 根據指定 ID 爬取子元素資料
- [x] 根據指定 class 爬取子元素資料
- [x] 根據官方更新歷程 API 遍歷更新頁面 url
- [x] 紀錄已收錄 url，避免重複爬取
- [x] 盡可能還原官網 style
- [x] 爬取圖片另存至專案避免來源過期
- [x] 建立簡易入口網站，方便閱覽
- [x] 建立搜尋引擎，根據頁面文本查詢內容(空格可多條件)
- [x] 透過 express 建置動態網站
- [x] 土法煉鋼產生靜態網站
- [x] 前綴域名支持

<br>

開始記錄爬蟲時間: 2025/02/12
