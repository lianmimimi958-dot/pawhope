#!/bin/sh
set -eu
cd "$(dirname "$0")/../.."
mkdir -p screenshots/ios build

xcodebuild \
  -project ios/PawHope.xcodeproj \
  -scheme PawHope \
  -destination 'generic/platform=iOS Simulator' \
  -configuration Debug \
  -derivedDataPath build/ios \
  CODE_SIGNING_ALLOWED=NO \
  build

APP=$(find build/ios/Build/Products -name 'PawHope.app' -type d | head -n 1)
echo "app=$APP"
test -d "$APP"

echo "---- devicetypes ----"
xcrun simctl list devicetypes | grep iPhone || true
echo "---- runtimes ----"
xcrun simctl list runtimes available || true

TYPE=$(xcrun simctl list devicetypes | grep 'iPhone' | grep -v 'SE' | head -n 1 | sed -n 's/.*(\(com.apple.CoreSimulator.SimDeviceType.[^)]*\)).*/\1/p')
RUNTIME=$(xcrun simctl list runtimes available | grep 'iOS' | tail -n 1 | sed -n 's/.*[( ]\(com.apple.CoreSimulator.SimRuntime.iOS-[^ )]*\).*/\1/p')
echo "type=$TYPE"
echo "runtime=$RUNTIME"
test -n "$TYPE"
test -n "$RUNTIME"

UDID=$(xcrun simctl create "PawHopePreview" "$TYPE" "$RUNTIME")
echo "udid=$UDID"
xcrun simctl boot "$UDID"
xcrun simctl bootstatus "$UDID" -b
xcrun simctl install "$UDID" "$APP"

shot() {
  name="$1"
  screen="$2"
  wait="$3"
  xcrun simctl terminate "$UDID" cn.pawhope.app >/dev/null 2>&1 || true
  xcrun simctl launch "$UDID" cn.pawhope.app --screen "$screen"
  sleep "$wait"
  xcrun simctl io "$UDID" screenshot "screenshots/ios/$name"
  echo "saved screenshots/ios/$name"
}

shot 01-home.png home 16
shot 02-device.png device 8
shot 03-social.png social 8
shot 04-mall.png mall 8
shot 05-mine.png mine 8
