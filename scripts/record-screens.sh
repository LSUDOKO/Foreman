#!/usr/bin/env bash
# Record the laptop screen and the phone (over USB with scrcpy) at the same time, for the demo video.
#   bash scripts/record-screens.sh        → Ctrl+C to stop both
set -u
mkdir -p recordings
ts=$(date +%Y%m%d-%H%M%S)
adb get-state >/dev/null 2>&1 || { echo "phone not connected (adb devices)"; exit 1; }
adb shell svc power stayon usb >/dev/null 2>&1
# Phone: screen + its microphone (Android blocks capturing call audio; Twilio records both sides of the call instead).
scrcpy --record="recordings/phone-$ts.mp4" --audio-source=mic --stay-awake --window-title="Foreman · phone" --max-size=1600 &
P1=$!
# Laptop: full screen with system audio monitor if available.
wf-recorder -f "recordings/screen-$ts.mp4" -c libx264 -p preset=veryfast -p crf=20 &
P2=$!
echo "recording → recordings/phone-$ts.mp4 and recordings/screen-$ts.mp4 (Ctrl+C to stop)"
trap 'kill -INT $P1 $P2 2>/dev/null; wait; echo saved; ls -lh recordings | tail -4' INT TERM
wait
