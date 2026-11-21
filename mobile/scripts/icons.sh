#!/bin/sh
# Renders assets/brand/*.svg to the PNGs app.json points at. Needs Google Chrome, which keeps transparency.
set -eu
cd "$(dirname "$0")/.."
chrome="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
render() {
  "$chrome" --headless=new --disable-gpu --hide-scrollbars --default-background-color=00000000 \
    --window-size=1024,1024 --screenshot="$PWD/assets/images/$2" "file://$PWD/assets/brand/$1" 2>/dev/null
}
render icon.svg icon.png
render foreground.svg android-icon-foreground.png
render background.svg android-icon-background.png
render monochrome.svg android-icon-monochrome.png
render splash.svg splash-icon.png
sips -Z 48 assets/images/icon.png --out assets/images/favicon.png >/dev/null
