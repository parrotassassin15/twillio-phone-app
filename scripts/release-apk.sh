#!/usr/bin/env bash
# scripts/release-apk.sh
#
# Bumps versionCode/versionName, builds a release APK, writes version.json,
# and optionally serves it locally for OTA dev distribution.
#
# Usage:
#   ./scripts/release-apk.sh <version-name>
#   ./scripts/release-apk.sh 1.1
#   ./scripts/release-apk.sh 1.1 --serve       # also spin up local file server
#
# The resulting APK + version.json can be uploaded to:
#   https://lorikeetsecurity.com/phone-release/apk/release/
#
# For dev: pass --serve to host at http://192.168.1.137:9001/
#   The app must be pointing UPDATE_CHECK_URL at that address (see --dev flag).

set -euo pipefail

# Android Gradle plugin requires Java 17 (Java 26 breaks jlink)
export JAVA_HOME=/usr/lib/jvm/java-17-openjdk
export ANDROID_HOME="${ANDROID_HOME:-/home/parrotboi/Android/Sdk}"

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
GRADLE="$REPO_ROOT/android/gradlew"
BUILD_GRADLE="$REPO_ROOT/android/app/build.gradle"
CONFIG_TS="$REPO_ROOT/src/config/index.ts"
OUTPUT_DIR="$REPO_ROOT/scripts/release-output"
APK_SRC="$REPO_ROOT/android/app/build/outputs/apk/release/app-release.apk"
DEV_SERVER_PORT=9001

VERSION_NAME="${1:-}"
SERVE=false
DEV_MODE=false

for arg in "$@"; do
  case $arg in
    --serve) SERVE=true ;;
    --dev)   DEV_MODE=true ;;
  esac
done

if [[ -z "$VERSION_NAME" ]] || [[ "$VERSION_NAME" == --* ]]; then
  echo "Usage: $0 <version-name> [--serve] [--dev]"
  echo "  version-name: e.g. 1.1 or 2.0"
  exit 1
fi

# ── 1. Read and bump versionCode ──────────────────────────────────────────────

CURRENT_CODE=$(grep 'versionCode' "$BUILD_GRADLE" | grep -v '//' | grep -oE '[0-9]+' | head -1)
NEW_CODE=$((CURRENT_CODE + 1))

echo "Bumping versionCode: $CURRENT_CODE → $NEW_CODE  |  versionName: → $VERSION_NAME"

# Update build.gradle
sed -i "s/versionCode $CURRENT_CODE/versionCode $NEW_CODE/" "$BUILD_GRADLE"
sed -i "s/versionName \".*\"/versionName \"$VERSION_NAME\"/" "$BUILD_GRADLE"

# Update src/config/index.ts
sed -i "s/APP_VERSION_CODE: [0-9]*/APP_VERSION_CODE: $NEW_CODE/" "$CONFIG_TS"
sed -i "s/APP_VERSION_NAME: '[^']*'/APP_VERSION_NAME: '$VERSION_NAME'/" "$CONFIG_TS"

# ── 2. Set UPDATE_CHECK_URL for dev or prod ───────────────────────────────────

if $DEV_MODE; then
  DEV_URL="http://192.168.1.137:$DEV_SERVER_PORT/version.json"
  sed -i "s|UPDATE_CHECK_URL: '.*'|UPDATE_CHECK_URL: '$DEV_URL'|" "$CONFIG_TS"
  echo "  UPDATE_CHECK_URL → $DEV_URL (dev mode)"
else
  PROD_URL="https://lorikeetsecurity.com/phone-release/apk/release/version.json"
  sed -i "s|UPDATE_CHECK_URL: '.*'|UPDATE_CHECK_URL: '$PROD_URL'|" "$CONFIG_TS"
fi

# ── 3. Build release APK ──────────────────────────────────────────────────────

echo ""
echo "Building release APK..."
cd "$REPO_ROOT/android"
./gradlew assembleRelease
cd "$REPO_ROOT"

# ── 4. Copy APK and write version.json ───────────────────────────────────────

mkdir -p "$OUTPUT_DIR"
cp "$APK_SRC" "$OUTPUT_DIR/app-release.apk"

if $DEV_MODE; then
  APK_URL="http://192.168.1.137:$DEV_SERVER_PORT/app-release.apk"
else
  APK_URL="https://lorikeetsecurity.com/phone-release/apk/release/app-release.apk"
fi

cat > "$OUTPUT_DIR/version.json" <<EOF
{
  "versionCode": $NEW_CODE,
  "versionName": "$VERSION_NAME",
  "apkUrl": "$APK_URL",
  "releaseNotes": "Version $VERSION_NAME"
}
EOF

echo ""
echo "✓ Build complete"
echo "  APK:          $OUTPUT_DIR/app-release.apk"
echo "  version.json: $OUTPUT_DIR/version.json"
echo ""

# ── 5. Optional: serve locally for dev distribution ──────────────────────────

if $SERVE; then
  echo "Starting dev file server at http://192.168.1.137:$DEV_SERVER_PORT/"
  echo "  APK:          http://192.168.1.137:$DEV_SERVER_PORT/app-release.apk"
  echo "  version.json: http://192.168.1.137:$DEV_SERVER_PORT/version.json"
  echo ""
  echo "Press Ctrl+C to stop."
  cd "$OUTPUT_DIR"
  python3 -m http.server "$DEV_SERVER_PORT" --bind 0.0.0.0
else
  echo "To deploy to production, run:"
  echo "  scp $OUTPUT_DIR/app-release.apk $OUTPUT_DIR/version.json \\"
  echo "      user@lorikeetsecurity.com:/path/to/phone-release/apk/release/"
  echo ""
  echo "To serve locally for dev testing, re-run with --serve:"
  echo "  $0 $VERSION_NAME --serve --dev"
fi
