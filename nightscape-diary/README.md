# 夜景日記 Nightscape Diary

いつもの帰り道で出会った、心に残る夜景と色を集める日記（PWA）。
卒業研究「日常生活における身近な夜景への意識を促すサービスの提案」のプロトタイプ。

## 技術構成

- ビルド不要のバニラ JavaScript（ES Modules）＋ CSS。外部ライブラリ・有料APIなし
- 保存：IndexedDB（写真は端末内に保存。サーバーには送られません）
- PWA：`manifest.webmanifest` ＋ `sw.js`（オフライン起動）
- 色の類似度：OKLab 色空間の距離（人の見え方に近い）

## ファイル構成

```
index.html               入口
manifest.webmanifest     PWA 設定
sw.js                    Service Worker（更新時は VERSION を上げる）
css/app.css              すべての見た目
icons/                   アプリアイコン
js/main.js               起動・画面の切り替え（#/... のルーティング）
js/store.js              データの状態・似た色の検索・タグ集計
js/db.js                 IndexedDB
js/colors.js             色の計算（OKLab、色名、色系統）
js/image.js              写真の縮小・画素の取得・EXIF撮影日時
js/letters.js            ナイトレターの文面と選び方 ← 手紙を増やすならここ
js/samples.js            デモ用サンプル（イラストを描いて生成）
js/views/tonight.js      今夜（今日の手紙・色との再会）／手紙一覧・本文
js/views/capture.js      撮影・選択 → 色の採集 → 日記を書く → 保存
js/views/diary.js        日記一覧・カレンダー・タグ／キーワード検索
js/views/entry.js        記録の詳細・編集・削除
js/views/collection.js   色（星図・標本箱・夜のパレット）、色の詳細と「似た色との再会」
js/views/settings.js     その他（地域・天気、バックアップ、サンプル、使い方）
js/sky.js                今夜の空：天気（Open-Meteo）・日没・青い時間・月齢
js/journey.js            色でめぐる夜（似た色をたどるスライドショー）
js/wallpaper.js          夜のパレットから壁紙をつくる
```

## 手元で動かす

```
python3 -m http.server 8000
```
→ ブラウザで http://localhost:8000 を開く（`file://` では動きません）。

## iPhone で使う（HTTPS で公開）

カメラ・Service Worker・ホーム画面追加には HTTPS が必要です。無料の方法：

**A. Netlify Drop（いちばん簡単）**
1. https://app.netlify.com/drop を開く
2. このフォルダ（index.html がある階層）をドラッグ＆ドロップ
3. 表示された https://〜.netlify.app を iPhone の Safari で開く

**B. GitHub Pages**
1. GitHub にリポジトリを作り、このフォルダの中身をアップロード
2. Settings → Pages → Branch: main / (root) を選んで保存
3. 数分後に表示される https://ユーザー名.github.io/リポジトリ名/ を開く

**ホーム画面に追加**：Safari の共有ボタン → 「ホーム画面に追加」。

## 調整のヒント

- 似た色の判定の厳しさ：`js/colors.js` の `SIMILAR_THRESHOLD`（小さいほど厳しい。既定 9）
- 保存する写真の大きさ：`js/image.js` の `MAX_SIDE`
- ファイルを更新して公開し直したら、`sw.js` の `VERSION` を変更すると確実に反映されます

## 注意

- データはブラウザの中にだけ保存されます。Safari の「履歴とWebサイトデータを消去」で消えるため、「その他 → バックアップを書き出す」をときどき使ってください。
- ホーム画面から起動したアプリと、Safari で開いたページは保存領域が別になります（iOS の仕様）。

## 天気の取得について（v1.1）

- 天気は Open-Meteo（https://open-meteo.com 、無料・APIキー不要・非商用利用可）から1時間ごとに取得します。
  今の天気・3時間以内の雨・8時間以内に降った雨（＝雨上がり）・雲量から、手紙を選びます。
- 日没・青い時間（太陽高度 −4〜−8°）・暗くなる時刻（−12°）・月齢は端末内で計算します（目安）。
- 「その他 → 今夜の空 → 天気：手動で設定」にすると、選んだ天気で手紙が書かれます（実験・デモ用）。
- 手紙の文面は js/letters.js の `build(s)` で、`s.t.sunset`（日没）`s.t.blue`（青い時間）`s.moon` などを差し込んで作っています。
