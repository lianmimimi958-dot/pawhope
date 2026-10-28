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

TYPE=$(xcrun simctl list devicetypes | grep 'iPhone' | head -n 1 | sed -n 's/.*(\(com.apple.CoreSimulator.SimDeviceType.[^)]*\)).*/\1/p')
RUNTIME=$(xcrun simctl list runtimes available | grep 'iOS' | tail -n 1 | sed -n 's/.*(\(com.apple.CoreSimulator.SimRuntime.iOS-[^)]*\)).*/\1/p')
echo "type=$TYPE"
echo "runtime=$RUNTIME"
test -n "$TYPE"
test -n "$RUNTIME"
UDID=$(xcrun simctl create "PawHopePreview" "$TYPE" "$RUNTIME")
echo "udid=$UDID"
xcrun simctl boot "$UDID"
xcrun simctl bootstatus "$UDID" -b
xcrun simctl install "$UDID" "$APP"
xcrun simctl launch "$UDID" cn.pawhope.app
sleep 12
xcrun simctl io "$UDID" screenshot screenshots/ios/01-home.png
echo "saved screenshots/ios/01-home.png"
