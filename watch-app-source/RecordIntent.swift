import AppIntents
import SwiftUI

struct StartRecording: AppIntent {
    static var title: LocalizedStringResource = "Start Recording"
    static var description = IntentDescription("Opens the app to start recording immediately.")
    static var openAppWhenRun: Bool = true // Critical: Must open the app

    @MainActor
    func perform() async throws -> some IntentResult {
        // Since openAppWhenRun is true, the app will launch.
        // We can interact with our view model here if needed, or just let the app open.
        ConnectivityProvider.shared.sendActiveState(true)
        return .result()
    }
}

// Provider to expose shortcuts to the system
struct VecordShortcuts: AppShortcutsProvider {
    static var appShortcuts: [AppShortcut] {
        AppShortcut(
            intent: StartRecording(),
            phrases: ["Start recording with \(.applicationName)"],
            shortTitle: "Start Recording",
            systemImageName: "mic.circle.fill"
        )
    }
}
