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
UDID=$(xcrun simctl list devices available | sed -n 's/.*iPhone.*(\([A-F0-9-]*\)) (Shutdown)/\1/p' | head -n 1)
if [ -z "$UDID" ]; then
  UDID=$(xcrun simctl list devices available | sed -n 's/.*iPhone.*(\([A-F0-9-]*\)).*/\1/p' | head -n 1)
fi
echo "udid=$UDID"
xcrun simctl boot "$UDID" || true
xcrun simctl bootstatus "$UDID" -b
xcrun simctl install "$UDID" "$APP"
xcrun simctl launch "$UDID" cn.pawhope.app
sleep 12
xcrun simctl io "$UDID" screenshot screenshots/ios/01-home.png
echo "saved screenshots/ios/01-home.png"
