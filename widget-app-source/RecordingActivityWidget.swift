import ActivityKit
import SwiftUI
import WidgetKit

struct RecordingActivityWidget: Widget {
    var body: some WidgetConfiguration {
        ActivityConfiguration(for: AudioRecordingAttributes.self) { context in
            // Lock Screen UI
            HStack {
                VStack(alignment: .leading) {
                    Text("Recording")
                        .font(.headline)
                        .foregroundColor(.white)
                    // Native count-up timer
                    Text(timerInterval: context.state.recordingStartDate...Date().addingTimeInterval(60*60*24), countsDown: false)
                        .font(.caption)
                        .foregroundColor(.gray)
                        .monospacedDigit()
                }
                Spacer()
                
                Link(destination: URL(string: "vecord://stop-recording")!) {
                    Text("Stop")
                        .font(.system(size: 14, weight: .bold))
                        .foregroundColor(.white)
                        .padding(.vertical, 8)
                        .padding(.horizontal, 16)
                        .background(Color.red)
                        .cornerRadius(20)
                }
            }
            .padding()
            .activityBackgroundTint(Color.black)
            .activitySystemActionForegroundColor(Color.white)

        } dynamicIsland: { context in
            DynamicIsland {
                // Expanded UI
                DynamicIslandExpandedRegion(.leading) {
                    Label("Rec", systemImage: "recordingtape")
                        .foregroundColor(.red)
                }
                DynamicIslandExpandedRegion(.trailing) {
                    Text(timerInterval: context.state.recordingStartDate...Date().addingTimeInterval(60*60*24), countsDown: false)
                        .font(.title2)
                        .monospacedDigit()
                        .frame(width: 80)
                }
                DynamicIslandExpandedRegion(.bottom) {
                    Link(destination: URL(string: "vecord://stop-recording")!) {
                        Text("Stop Recording")
                            .frame(maxWidth: .infinity)
                            .padding()
                            .background(Color.red)
                            .foregroundColor(.white)
                            .cornerRadius(12)
                    }
                }
            } compactLeading: {
                Image(systemName: "recordingtape")
                    .foregroundColor(.red)
            } compactTrailing: {
                Text(timerInterval: context.state.recordingStartDate...Date().addingTimeInterval(60*60*24), countsDown: false)
                    .font(.caption)
                    .monospacedDigit()
                    .frame(width: 40)
            } minimal: {
                Image(systemName: "recordingtape")
                    .foregroundColor(.red)
            }
        }
    }
}
