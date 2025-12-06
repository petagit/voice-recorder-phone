import Foundation
import WatchConnectivity

class WatchConnectivityManager: NSObject, ObservableObject, WCSessionDelegate {
    static let shared = WatchConnectivityManager()
    @Published var isSending = false
    
    func startSession() {
        if WCSession.isSupported() {
            let session = WCSession.default
            session.delegate = self
            session.activate()
        }
    }
    
    func transferFile(file: URL, metadata: [String: Any]) {
        if WCSession.default.isReachable {
            isSending = true
            WCSession.default.transferFile(file, metadata: metadata)
            // Note: In a real app, you'd track the transfer progress
            DispatchQueue.main.asyncAfter(deadline: .now() + 2) {
                self.isSending = false
            }
        }
    }
    
    func session(_ session: WCSession, activationDidCompleteWith activationState: WCSessionActivationState, error: Error?) {
        // Handle activation
    }
    
    // Other delegate methods required by protocol but not used here
    #if os(iOS)
    func sessionDidBecomeInactive(_ session: WCSession) {}
    func sessionDidDeactivate(_ session: WCSession) {}
    #endif
}
