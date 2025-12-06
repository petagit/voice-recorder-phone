# Expo Commands

Start the app:
```bash
npx expo start
```

Run on specific platform:
```bash
npx expo start --ios
npx expo start --android
```

Run Native/Dev Build (Required for Watch Connectivity):
```bash
# iOS
npx expo run:ios

# Random Android Command
npx expo run:android

# Run on Physical Device (iPhone)
npx expo run:ios --device
```

> **Troubleshooting iOS Build:**
> If you see `error: iOS 26.1 is not installed`, it means your Xcode SDK (26.1) is newer than your installed Simulator Runtimes.
> 1. Open Xcode (`xed ios`).
> 2. Go to **Settings > Components**.
> 3. Download the **iOS 26.1 Simulator** (or match your SDK version).

Clear cache:
```bash
npx expo start -c
```
