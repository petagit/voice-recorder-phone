# How to Add the Lock Screen Widget (Manual Step)

Since this project uses Expo Prebuild but requires a Native Widget Extension, you must add the target manually in Xcode once.

## 1. Open Xcode
Run this command in your terminal:
```bash
xcodebuild -workspace ios/Vecord.xcworkspace -scheme Vecord
# Or just open ios/Vecord.xcworkspace
open ios/Vecord.xcworkspace
```

## 2. Add Widget Target
1.  In Xcode, go to **File > New > Target...**
2.  Search for **Widget Extension**.
3.  Click **Next**.
4.  **Product Name**: `VecordWidgets`
5.  **Include Configuration Intent**: Uncheck (OFF).
6.  **Finish**.
7.  If asked to "Activate", click **Activate**.

## 3. Replace Source Files
1.  In the Project Navigator (left), find the new `VecordWidgets` folder.
2.  Delete `VecordWidgetsBundle.swift`, `VecordWidgets.swift` (or similar defaults).
3.  Right-click `VecordWidgets` > **Add Files to "Vecord"...**
4.  Navigate to `vecord/widget-app-source`.
5.  Select:
    - `AudioRecordingAttributes.swift`
    - `RecordingActivityWidget.swift`
    - `VecordWidgetsBundle.swift`
6.  **Important**: Check **"Copy items if needed"**.
7.  **Important**: Ensure "Add to targets" has `VecordWidgets` CHECKED.
8.  Click **Add**.

## 4. Run
```bash
npx expo run:ios --device
```
