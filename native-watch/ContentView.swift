import SwiftUI
import AVFoundation
import WatchConnectivity

struct ContentView: View {
    @StateObject private var audioRecorder = AudioRecorder()
    @StateObject private var connectivityManager = WatchConnectivityManager.shared
    
    var body: some View {
        VStack {
            if audioRecorder.isRecording {
                Button(action: {
                    audioRecorder.stopRecording()
                }) {
                    Image(systemName: "stop.circle.fill")
                        .resizable()
                        .aspectRatio(contentMode: .fit)
                        .frame(width: 80, height: 80)
                        .foregroundColor(.red)
                }
                Text("Recording...")
                    .padding()
            } else {
                Button(action: {
                    audioRecorder.startRecording()
                }) {
                    Image(systemName: "mic.circle.fill")
                        .resizable()
                        .aspectRatio(contentMode: .fit)
                        .frame(width: 80, height: 80)
                        .foregroundColor(.green)
                }
                Text("Tap to Record")
                    .padding()
            }
            
            if connectivityManager.isSending {
                Text("Sending to iPhone...")
                    .font(.caption)
                    .foregroundColor(.gray)
            }
        }
        .onAppear {
            connectivityManager.startSession()
        }
        .onChange(of: audioRecorder.lastRecordingUrl) { newUrl in
            if let url = newUrl {
                connectivityManager.transferFile(file: url, metadata: ["timestamp": Date().timeIntervalSince1970])
            }
        }
    }
}

struct ContentView_Previews: PreviewProvider {
    static var previews: some View {
        ContentView()
    }
}
