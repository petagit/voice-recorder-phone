import { watchEvents, WatchPayload } from 'react-native-watch-connectivity';

export const initWatchConnectivity = (
    onFileReceived: (file: { uri: string, metadata: any }) => void,
    onReachabilityChange?: (reachable: boolean) => void,
    onApplicationContextReceived?: (context: any) => void
) => {
    // Listen for file transfers
    const unsubscribeFile = watchEvents.on('file', (file: any) => {
        console.log('File received from watch:', file);
        onFileReceived(file);
    });

    // Listen for reachability changes
    const unsubscribeReachability = watchEvents.on('reachability', (reachable: boolean) => {
        console.log('Watch reachability changed:', reachable);
        onReachabilityChange?.(reachable);
    });

    // Listen for application context
    const unsubscribeContext = watchEvents.on('application-context', (context: any) => {
        console.log('Application context received:', context);
        onApplicationContextReceived?.(context);
    });

    return () => {
        unsubscribeFile();
        unsubscribeReachability();
        unsubscribeContext();
    };
};
