# How to Deploy to TestFlight

The project is configured for TestFlight deployment. Follow these steps to build and submit your app.

# Manual Watch App Setup (The "Raw Swift" Way)

If automatic configuration fails, follow these steps to set up the Watch App manually in Xcode.

## 1. Clean the Project
We have already removed the automatic plugin.
1.  Open Terminal in `vecord`.
2.  Run: `npx expo prebuild -p ios --clean`

## 2. Create the Target in Xcode
1.  Open `ios/Vecord.xcworkspace` in Xcode.
2.  Go to **File** > **New** > **Target...**
3.  Select the **watchOS** tab.
4.  Choose **App**. Click **Next**.
5.  **Product Name**: `WatchApp`
6.  **Organization Identifier**: `com.fengzhiping` (or matches your iOS app).
7.  **Watch App for Existing iOS App**: Ensure explicitly selected (Embed in Vecord).
8.  **Interface**: SwiftUI.
9.  **Language**: Swift.
10. Click **Finish**.
11. If asked to Activate Scheme, click **Activate**.

## 3. Copy Your Source Code
1.  In the Project Navigator (left sidebar), find the new `WatchApp` folder.
2.  Delete the default `ContentView.swift` and `WatchApp.swift` (Move to Trash).
3.  Right-click the `WatchApp` folder > **Add Files to "Vecord"...**
4.  Navigate to your project root `vecord/watch-app-source`.
5.  Select:
    -   `ContentView.swift`
    -   `WatchApp.swift`
    -   `ConnectivityProvider.swift`
    -   `RecordIntent.swift` (if you have intentes)
    -   `Info.plist` (DO NOT select this if the target already has one, skip it or merge manually).
6.  **Important**: Check the box **"Copy items if needed"**.
7.  **Important**: In "Add to targets", make sure **ONLY "WatchApp"** is checked.
8.  Click **Add**.

## 4. Run Correctly
1.  Select the **WatchApp** scheme at the top.
2.  Select a Simulator or Device.
3.  Press **Cmd+R**.

## Prerequisites
- **Apple Developer Account**: A paid account ($99/year) is required.
- **Expo Account**: You need to be logged in to [expo.dev](https://expo.dev).

## Deployment Steps

1.  **Login to EAS**
    Ensure you are logged in to your Expo account via the CLI:
    ```bash
    eas login
    ```

2.  **Start the Build**
    Run the build command for iOS. This will handle certificates and provisioning profiles automatically.
    ```bash
    eas build --platform ios --profile production
    ```
    - Follow the interactive prompts.
    - **Apple ID**: When asked, provide your Apple ID and password (or App-Specific Password).
    - **Capabilities**: Select **Yes** if asked to set up Push Notifications or other capabilities.

3.  **Submit to TestFlight**
    Once the build finishes (approx. 15-30 mins), submit it to TestFlight:
    ```bash
    eas submit --platform ios
    ```
    - Select the build you just created from the list.

## After Submission
- Go to [App Store Connect](https://appstoreconnect.apple.com).
- Navigate to **TestFlight**.
- Once the build is processed, you can add internal testers (including yourself) to install the app via the TestFlight app on your iOS device.

## Managing Environment Variables
Your app code relies on variables starting with `EXPO_PUBLIC_` (e.g., `EXPO_PUBLIC_OPENAI_API_KEY`). For these to work in TestFlight builds:

1.  **Create EAS Secrets**
    Use the EAS CLI to securely store your keys. The name MUST match what's in your code (including `EXPO_PUBLIC_`).
    ```bash
    eas secret:create --scope project --name EXPO_PUBLIC_OPENAI_API_KEY --value "sk-..."
    ```

2.  **Rebuild Required**
    After setting or updating secrets, you MUST run a new build for them to take effect:
    ```bash
    eas build --platform ios --profile production
    ```



    eas build --platform ios --profile production
    eas submit --platform ios

    eas build --profile preview








    ```