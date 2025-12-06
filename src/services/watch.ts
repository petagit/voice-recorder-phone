import { watchEvents, WatchPayload } from 'react-native-watch-connectivity';

export const initWatchConnectivity = (
    onFileReceived: (file: { uri: string, metadata: any }) => void
) => {
    // Listen for file transfers
    const unsubscribeFile = watchEvents.on('file', (file: any) => {
        console.log('File received from watch:', file);
        onFileReceived(file);
    });

    return () => {
        unsubscribeFile();
    };
};
