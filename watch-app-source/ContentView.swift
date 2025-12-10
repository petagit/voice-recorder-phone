import SwiftUI

struct ContentView: View {
    @ObservedObject var connectivity = ConnectivityProvider.shared
    @State private var isRecording = false
    
    var body: some View {
        VStack {
            Image(systemName: isRecording ? "waveform" : "mic.fill")
                .resizable()
                .aspectRatio(contentMode: .fit)
                .frame(width: 50, height: 50)
                .foregroundColor(isRecording ? .red : .blue)
                .padding()
            
            Text(isRecording ? "Recording..." : "Ready")
                .font(.headline)
            
            if connectivity.isReachable {
                Text("iPhone Connected")
                    .font(.caption2)
                    .foregroundColor(.green)
            } else {
                Text("Waiting for iPhone...")
                    .font(.caption2)
                    .foregroundColor(.gray)
            }
        }
        .onAppear {
            connectivity.sendActiveState(true)
        }
        .onDisappear {
            connectivity.sendActiveState(false)
        }
        // Respond to the App Intent launch if needed
        .onOpenURL { url in
            // Handle URL schemes if used
        }
    }
}
