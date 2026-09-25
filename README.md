# webLM_repo

WebLM / WebLLM 網頁專案集合。

## 目前頁面

- `sanguo-popbook.html`：三國志 3D 互動立體繪本
  - Three.js + GSAP
  - WebLLM
  - SmolLM2-360M semantic router
  - WebLLM 僅負責自然語言意圖分類；實際角色回答採預設腳本

## 目錄規劃

```text
webLM_repo/
├─ index.html              # 之後建立，作為各專案統一入口
├─ sanguo-popbook.html
└─ assets/
   ├─ sanguo-popbook.css
   └─ sanguo-popbook.js
```

目前刻意不建立 `index.html`，避免三國志頁面佔用整個 repository 的首頁。後續再由 `index.html` 統一連結各 WebLM / WebLLM 實驗頁面。

## GitHub Pages

啟用 GitHub Pages 後，三國志頁面預計可透過：

`https://bai-collab.github.io/webLM_repo/sanguo-popbook.html`

第一次啟動語意模型需要下載 WebLLM 模型；下載完成後由瀏覽器快取。瀏覽器需支援 WebGPU。
