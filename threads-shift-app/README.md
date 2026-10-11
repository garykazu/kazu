# Threads Shift Studio

GitHub Pagesでそのまま動くHTML・JavaScriptアプリです。Googleログイン、APIキー、サーバーは不要です。
既存のファイル読込みと、`threadForm`・`threadHistory`・`threadWizard` の保存形式は維持しています。

## Googleスプレッドシートを読む

1. Google Sheetsの「共有」→「一般的なアクセス」を「リンクを知っている全員」「閲覧者」にします。組織内限定やログイン必須のシートは対象外です。共有を広げられない資料はExcel・CSVで添付してください。
2. 読みたいタブを開き、通常の共有URL（`https://docs.google.com/spreadsheets/d/ID/edit#gid=番号`）をコピーします。gidがない場合は最初のタブを読みます。「ウェブに公開」の `/d/e/...` URLは今回の対象外です。
3. アプリの「資料・詳しいプロフィール」に貼り、「スプレッドシートを読み込む」を押します。
4. 「資料から見つかったプロフィール候補」で分類と内容を確認します。この時点ではプロフィールを変更しません。
5. 採用する候補を選び、「プロフィールに反映」を押します。入力済み項目は初期状態では選択されず、既存値と候補値の比較を表示します。読込み後に手編集された値は再確認を求めます。
6. ページを再読み込みして反映内容が保持されることを確認します。ブラウザのサイトデータを消すと既存の保存内容も消えるので、キャッシュ・サイトデータの全削除はしないでください。

見出し付きの横型表、項目と回答の縦型ヒアリング表、空セル・番号付き質問・カテゴリ見出しに対応します。
既存の質問マスターに質問を照合し、項目名と回答の対応を正規化して分類します。回答中の単語だけでは別項目へ振り分けません。
自由文の意味をAIで推測する方式ではありません。分類できない資料は確認欄に残し、必要な内容を手入力できます。

Google VisualizationのJSONPを、同一オリジンへのアクセスを許可しないsandbox iframeで実行し、`postMessage` の送信元・origin・ランダム識別子を確認してデータのみ受け取ります。CSV exportへのブラウザfetchで生じるCORS制限に依存しません。
取得先は検証済みID/gidからGoogleの固定ホストに組み立て、候補・既存値・エラーは `textContent` で表示します。
Google側のアクセス設定・配信方式・組織ポリシーによって取得できない場合は日本語エラーにします。
Googleの型判定で数値・文字列が混在する列の一部が空になる可能性があります。読み込んだ資料を必ず確認し、不足があればExcel・CSVを添付してください。

最も簡単な代替方法は、Google Sheetsで「ファイル」→「ダウンロード」→「Microsoft Excel」または「CSV」を選び、既存のファイル欄から添付する方法です。静的構成を維持でき、第三者の代理サーバーへ資料を送信する必要もありません。

## 開発・ビルド・検証

このアプリはルートのVite/Reactダッシュボードとは別の静的アプリです。ルートの `npm run build` だけでは本アプリは出力されません。
既存checkoutを利用してください。クラウドタスクは既に隔離されているため、ユーザーが依頼しない限りworktreeは作成しません。

リポジトリのルートから：

```sh
node threads-shift-app/build.mjs /tmp/kazu-site/threads-shift-app
node --test threads-shift-app/tests/profile-import.test.cjs
python3 -m http.server 4174 --bind 0.0.0.0 --directory /tmp/kazu-site
```

ビルドはHTML内・外部JavaScriptの構文をチェックし、アプリとcore資料を指定ディレクトリへコピーします。
GitHub Pagesをブランチから配信する場合は、`index.html` と `profile-import.js` を同じ `threads-shift-app` ディレクトリに含めてください。

ブラウザ回帰テスト（別ターミナル、Chromiumが必要）：

```sh
npm install --prefix /tmp/kazu-browser-tests --cache /tmp/kazu-npm-cache --no-audit --no-fund playwright@1.64.0 xlsx@0.18.5
THREADS_TEST_URL=http://127.0.0.1:4174/threads-shift-app/ NODE_PATH=/tmp/kazu-browser-tests/node_modules node threads-shift-app/tests/browser-check.cjs
```

Googleの応答を再現したテストです。Chromiumのopaque iframeリクエストをPlaywrightで捕捉するため、テスト起動時だけsite isolationを無効にします。アプリのsandbox・同一オリジン制限は有効です。
成功・非公開・空データ・通信失敗、不正URL/gid、XSS文字列、候補比較・反映・編集競合、保存済みプロフィール/履歴/質問途中データ、Excel/CSV等、投稿生成・今日の作戦・写真ミッション、PC/スマホ幅、未捕捉JS例外を検証します。実際のGoogle接続成功を代替するテストではありません。

2026年10月11日の確認：単体テスト7件、PC幅1280/スマホ幅390のブラウザ回帰、静的アプリのビルド、ルートのViteビルドが成功しました。
実Googleシートの取得は、クラウドの `docs.google.com` 通信が403拒否されるため未確認です。環境設定のネットワーク許可に同ドメインを追加する下書きを保存しましたが、実行環境への適用・公開は別操作です。許可が適用されたら公開シートで再検証してください。

同日の追加確認：ユーザー提供の共有URLからGoogle Visualization応答をHTTPSで取得できました（79行・3列）。実応答を変更せずブラウザのsandboxへ再配信し、6分類のプロフィール候補表示、既存値の保持、未捕捉JS例外なしを確認しました。公開サイトのブラウザからGoogleへ直接取得する経路の成功とは別の確認です。
「質問」「お店の答え（ここに書く）」「こちらの下書き（仮）」形式は回答列だけを使い、下書きや補足・未回答行を候補へ混ぜません。「質問・確認事項」「回答・結果（記入欄）」の追加ヒアリング表にも対応しています。
