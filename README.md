# local-translate

在瀏覽器裡用 WebGPU 跑小型語言模型，把網頁段落翻成台灣繁體中文，譯文直接顯示在原文下面。模型跑在本機，網頁內容不會送到任何伺服器。

這是個實驗性的 Chromium（Edge／Chrome）擴充功能。翻譯引擎使用 [WebLLM](https://github.com/mlc-ai/web-llm)，模型是 Qwen 系列的小模型。

## 安裝

需要 Node.js 20 以上，以及支援 WebGPU 的 Chromium 124 以上（Edge 或 Chrome）。

```bash
npm install
npm run build
```

1. 開啟 `edge://extensions`（或 `chrome://extensions`），打開「開發人員模式」。
2. 按「載入解壓縮」，選擇 `dist/` 資料夾。
3. 第一次翻譯時會開始下載模型，預設的 1.5B 約 1 GB。點工具列上的圖示可以看下載進度。

manifest 裡有固定 `key`，所以搬動資料夾後擴充功能的 ID 不會變，已經下載的模型也不用重抓。

## 使用

- 在段落上按右鍵，選「翻譯這一段／反白範圍」，就會翻譯那一段。
- 反白一個範圍後在範圍內按右鍵，範圍碰到的每個段落都會照順序翻譯。只反白到一部分的段落也會整段翻。
- 對已經翻過的段落（或譯文本身）再選一次，就會移除譯文。如果還在翻，翻譯也會一起停止。
- 點工具列圖示可以切換模型，也能看到目前狀態和翻譯速度（tokens/s）。

安裝或更新擴充功能之前就已經開著的分頁，要重新整理後右鍵翻譯才會生效。

## 模型

| 模型 | 說明 |
|---|---|
| Qwen2.5-1.5B-Instruct（預設） | 品質和速度的折衷。在 Intel Iris Xe 內顯上大約 9 tokens/s |
| Qwen2.5-0.5B-Instruct | 比較快，但中文品質明顯較差 |
| Qwen3-0.6B / Qwen3-1.7B | 已關閉思考模式 |

如果顯卡不支援 `shader-f16`，會自動改用同一個模型的 q4f32 版本，速度會比較慢，popup 上會顯示。

## 翻譯方式

- 背景資訊只用網頁標題，放在 system prompt。
- 同一個分頁裡最近兩段翻好的「原文→譯文」會當作範例一起送進去，讓相鄰段落的用詞一致。
- 如果譯文幾乎沒有中文，會自動重翻一次。
- 翻譯結果會快取在 IndexedDB，key 由模型、prompt 版本和原文組成。prompt 改版後，舊的快取會自動失效。

## 已知限制

- 不支援 iframe 裡的內容。
- 在內顯上，一段中等長度的文字大約要 10–15 秒。
- 模型讀取 prompt 時每批最多 256 個 token，避免 Windows 因為 GPU 逾時而重置顯卡（`DXGI_ERROR_DEVICE_HUNG`）。這是透過 WebLLM 的私有欄位設定的，只在 `@mlc-ai/web-llm@0.2.87` 驗證過，升級前要重新確認（見 `src/offscreen/webllm.js`）。
- 即使顯卡被重置，引擎也會自動重新載入模型，並重翻那一段。

## 開發

```bash
npm test        # node --test + jsdom
npm run build   # 打包到 dist/
```

| 路徑 | 內容 |
|---|---|
| `src/content/` | 頁面端：記住右鍵位置、找出段落、插入譯文、排隊翻譯 |
| `src/offscreen/` | offscreen document：WebLLM 引擎、IndexedDB 快取、翻譯工作排程 |
| `src/shared/prompt.js` | prompt、範例、判斷譯文是否仍是英文 |
| `src/sw.js` | 右鍵選單、建立 offscreen document |
| `src/popup/` | 模型選擇與狀態 |
