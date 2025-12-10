# How to Deploy to TestFlight

The project is configured for TestFlight deployment. Follow these steps to build and submit your app.

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






    ```