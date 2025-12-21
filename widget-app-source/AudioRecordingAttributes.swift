import ActivityKit
import SwiftUI

struct AudioRecordingAttributes: ActivityAttributes {
    public struct ContentState: Codable, Hashable {
        // We pass the start time so the UI can show a timer
        var recordingStartDate: Date
    }
    
    var recordingTitle: String
}
