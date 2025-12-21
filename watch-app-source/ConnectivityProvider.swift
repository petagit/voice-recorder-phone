import Foundation
import WatchConnectivity
import SwiftUI
import Combine

class ConnectivityProvider: NSObject, ObservableObject, WCSessionDelegate {
    @Published var isReachable = false
    @Published var receivedContext: [String: Any] = [:]
    
    static let shared = ConnectivityProvider()
    
    override init() {
        super.init()
        if WCSession.isSupported() {
            WCSession.default.delegate = self
            WCSession.default.activate()
        }
    }
    
    func session(_ session: WCSession, activationDidCompleteWith activationState: WCSessionActivationState, error: Error?) {
        DispatchQueue.main.async {
            self.isReachable = session.isReachable
            self.sendActiveState(true) // Send active state on activation
        }
    }
    
    func sessionReachabilityDidChange(_ session: WCSession) {
        DispatchQueue.main.async {
            self.isReachable = session.isReachable
        }
    }
    
    func session(_ session: WCSession, didReceiveApplicationContext applicationContext: [String : Any]) {
        DispatchQueue.main.async {
            self.receivedContext = applicationContext
        }
    }
    
    func sendActiveState(_ isActive: Bool) {
        guard WCSession.default.activationState == .activated else { return }
        
        let context = ["active": isActive]
        try? WCSession.default.updateApplicationContext(context)
        
        if WCSession.default.isReachable {
            WCSession.default.sendMessage(context, replyHandler: nil) { error in
                print("Error sending message: \(error.localizedDescription)")
            }
        }
    }
}
