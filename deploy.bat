@echo off
rem ============================================================
rem  PLAYBOARD 3D ― GitHub に公開（ダブルクリックで実行）
rem   1. 変更があれば記録（コミット）
rem   2. はじめての時だけ GitHub にリポジトリを作り、公開ページ（GitHub Pages）を有効にする
rem   3. GitHub へアップロード（push）
rem   4. 公開ページを開く
rem  上がるのは .gitignore に書いたファイルだけ（メモ・試作は上がらない）
rem  動作確認だけしたい時：deploy.bat --dry （コミットと push はしない）
rem ============================================================
chcp 65001 >nul
setlocal EnableDelayedExpansion
cd /d "%~dp0"

set "REPO=i2f0726/playboard-3d"
set "URL=https://i2f0726.github.io/playboard-3d/"
set "DRY="
if /i "%~1"=="--dry" set "DRY=1"

echo.
echo ===== PLAYBOARD 3D デプロイ =====
echo.

rem --- 1. 未記録の変更があるか ---
set "DIRTY="
for /f "delims=" %%i in ('git status --porcelain') do set "DIRTY=1"

if defined DIRTY (
  echo 記録していない変更があります:
  git status --short
  echo.
  set "MSG="
  set /p "MSG=変更のメモを入力して Enter（空のまま Enter で「更新」）: "
  if "!MSG!"=="" set "MSG=更新"
  if defined DRY (
    echo [dry] git add -A ／ git commit -m "!MSG!" を実行する予定
  ) else (
    git add -A
    git commit -m "!MSG!"
    if errorlevel 1 goto :fail
  )
) else (
  echo 記録していない変更はありません。
)

rem --- 2. はじめての時：リポジトリ作成と GitHub Pages ---
echo.
git remote get-url origin >nul 2>&1
if errorlevel 1 (
  if defined DRY (
    echo [dry] gh repo create %REPO% --public --source . --push を実行する予定
    echo [dry] GitHub Pages を main ブランチで有効にする予定
    goto :done
  )
  gh repo view %REPO% >nul 2>&1
  if errorlevel 1 (
    echo GitHub にリポジトリを作っています...
    gh repo create %REPO% --public --source . --remote origin --push
    if errorlevel 1 goto :fail
  ) else (
    echo GitHub にもうあるリポジトリにつなぎます...
    git remote add origin https://github.com/%REPO%.git
    git push -u origin main
    if errorlevel 1 goto :fail
  )
  goto :pages
)

rem --- 3. アップロード ---
if defined DRY (
  echo [dry] git push を実行する予定
  git status -sb | findstr /b "##"
) else (
  echo GitHub へアップロードしています...
  git push
  if errorlevel 1 goto :fail
)

rem --- 公開ページ（GitHub Pages）がまだなら有効にする ---
:pages
if not defined DRY (
  gh api repos/%REPO%/pages >nul 2>&1
  if errorlevel 1 (
    echo 公開ページ（GitHub Pages）を有効にしています...
    gh api -X POST repos/%REPO%/pages -f "source[branch]=main" -f "source[path]=/" >nul
    if errorlevel 1 goto :fail
  )
)

:done
echo.
echo 完了しました。1〜2分で公開ページに反映されます（はじめての時は数分かかることがあります）。
echo %URL%
if not defined DRY start "" "%URL%"
echo.
pause
exit /b 0

:fail
echo.
echo ×失敗しました。上の英語のメッセージを確認してください。
echo   ・"Authentication" や "gh auth login" と出たら、PowerShell で gh auth login をやり直してください
echo   ・"already exists" と出たら、同じ名前のリポジトリがもうあります（Claude に相談してください）
echo   ・"rejected" と出たら、GitHub 側に新しい変更があります（Claude に相談してください）
echo.
pause
exit /b 1
