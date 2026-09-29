
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("/sw.js").catch((err) => {
      console.warn("Service Worker 註冊失敗：", err);
    });
  }
