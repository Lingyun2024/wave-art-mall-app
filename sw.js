/*
  sw.js —— 最小 Service Worker 樁（stub）
  用途：holiday.html 會註冊 ../sw.js，若檔案不存在會在 console 噴 404 警告。
  此樁只做最基本的 install/activate，不攔截任何 fetch（避免影響 Vercel 靜態部署），
  單純讓註冊成功、消除警告。未來若要啟用離線快取再擴充此檔。
*/
self.addEventListener('install', function (event) {
  self.skipWaiting();
});

self.addEventListener('activate', function (event) {
  event.waitUntil(self.clients.claim());
});

// 不做任何 fetch 攔截，維持原生網路行為
self.addEventListener('fetch', function () { /* no-op */ });
