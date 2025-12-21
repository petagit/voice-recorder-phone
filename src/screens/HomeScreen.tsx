import React, { useState, useEffect, useRef } from 'react';
import { StyleSheet, Text, View, FlatList, TouchableOpacity, ActivityIndicator, Alert, Button, Platform, Share, Linking, Modal, TextInput, ScrollView, Animated, Easing } from 'react-native';
import { Audio, InterruptionModeIOS, InterruptionModeAndroid } from 'expo-av';
import * as Clipboard from 'expo-clipboard';
import * as Notifications from 'expo-notifications';
import { Ionicons } from '@expo/vector-icons';
import { initWatchConnectivity } from '../services/watch';
import { transcribeAudio, organizeText, generateTweet, DEFAULT_TWITTER_PROMPT } from '../services/ai';
import { loadAllNotes, saveNote, deleteNote, initStorage, getStorageType, setStoragePreference, StorageType } from '../services/storage';
import LoadingScreen from '../components/LoadingScreen';
import { useTheme } from '../context/ThemeContext';
import { StatusBar } from 'expo-status-bar';

Notifications.setNotificationHandler({
    handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: false,
        shouldSetBadge: false,
        shouldShowBanner: true,
        shouldShowList: true,
    }),
});

interface Recording {
    id: string;
    uri: string;
    timestamp: number;
    transcript?: string;
    summary?: {
        bulletPoints: string[];
        messages: string[];
    };
    tweet?: string;
    mode?: 'notes' | 'twitter';
    isLoading?: boolean;
}

export default function HomeScreen() {
    const [isAppReady, setIsAppReady] = useState(false);
    const [recordings, setRecordings] = useState<Recording[]>([]);
    const [recording, setRecording] = useState<Audio.Recording | null>(null);
    const [isRecording, setIsRecording] = useState(false);
    const [mode, setMode] = useState<'notes' | 'twitter'>('notes');
    const [twitterPrompt, setTwitterPrompt] = useState(DEFAULT_TWITTER_PROMPT);
    const [isSettingsVisible, setIsSettingsVisible] = useState(false);
    const [isWatchReachable, setIsWatchReachable] = useState(false);
    const [isWatchAppActive, setIsWatchAppActive] = useState(false);
    const [permissionResponse, requestPermission] = Audio.usePermissions();
    const [storageType, setStorageTypeState] = useState<StorageType>('local');
    const { colors, isDark } = useTheme();

    // Live Activity Management
    const startLiveActivity = async () => {
        try {
            if (Platform.OS === 'ios') {
                const { LiveActivity } = require('react-native-live-activity');
                // Start the activity
                await LiveActivity.startActivity({
                    activityId: 'recording',
                    attributes: {
                        recordingTitle: 'Voice Note',
                        recordingStartDate: new Date().toISOString()
                    },
                    contentState: {
                        duration: '00:00',
                        isRecording: true,
                        recordingStartDate: new Date().toISOString()
                    },
                    pushToken: null,
                });
            }
        } catch (e) {
            console.log('Live Activity error:', e);
        }
    };

    const stopLiveActivity = async () => {
        try {
            if (Platform.OS === 'ios') {
                const { LiveActivity } = require('react-native-live-activity');
                await LiveActivity.endActivity('recording');
            }
        } catch (e) {
            console.log('Live Activity error:', e);
        }
    };

    const handleStorageChange = async (type: StorageType) => {
        await setStoragePreference(type);
        setStorageTypeState(type);
        setRecordings([]);
        try {
            const notes = await loadAllNotes();
            setRecordings(notes as Recording[]);
        } catch (e) {
            console.error(e);
            Alert.alert('Error', 'Failed to load notes from ' + type);
        }
    };

    const handleNewFile = async (uri: string) => {
        const newRecording: Recording = {
            id: Date.now().toString(),
            uri,
            timestamp: Date.now(),
            mode: mode,
            isLoading: true,
        };

        setRecordings(prev => [newRecording, ...prev]);

        try {
            // 1. Transcribe
            const transcript = await transcribeAudio(uri);

            // 2. Process based on mode
            let summary: { bulletPoints: string[], messages: string[] } | undefined;
            let tweet: string | undefined;

            if (newRecording.mode === 'twitter') {
                tweet = await generateTweet(transcript, twitterPrompt);
            } else {
                summary = await organizeText(transcript);
            }

            // 3. Save to Storage
            const savedId = await saveNote({
                id: newRecording.id,
                timestamp: newRecording.timestamp,
                transcript,
                summary,
                tweet
            });

            setRecordings(prev => prev.map(rec =>
                rec.id === newRecording.id
                    ? { ...rec, id: savedId, transcript, summary, tweet, isLoading: false }
                    : rec
            ));
        } catch (error) {
            console.error(error);
            Alert.alert('Error', 'Failed to process audio');
            setRecordings(prev => prev.map(rec =>
                rec.id === newRecording.id
                    ? { ...rec, isLoading: false, transcript: 'Error processing audio' }
                    : rec
            ));
        }
    };

    const startRecording = async () => {
        try {
            if (permissionResponse?.status !== 'granted') {
                console.log('Requesting permission..');
                await requestPermission();
            }

            await Audio.setAudioModeAsync({
                allowsRecordingIOS: true,
                playsInSilentModeIOS: true,
                staysActiveInBackground: true,
                interruptionModeIOS: InterruptionModeIOS.DoNotMix,
                interruptionModeAndroid: InterruptionModeAndroid.DoNotMix,
                shouldDuckAndroid: true,
            });

            console.log('Starting recording..');
            const { recording } = await Audio.Recording.createAsync(
                Audio.RecordingOptionsPresets.HIGH_QUALITY
            );
            setRecording(recording);
            setIsRecording(true);
            console.log('Recording started');

            await Notifications.scheduleNotificationAsync({
                content: {
                    title: "Recording in Progress",
                    body: "Tap to return to the app.",
                    sticky: true,
                },
                trigger: null,
            });

            // Start Live Activity
            await startLiveActivity();
        } catch (err) {
            console.error('Failed to start recording', err);
            Alert.alert('Error', 'Failed to start recording');
        }
    };

    const stopRecording = async () => {
        console.log('Stopping recording..');
        setRecording(null);
        setIsRecording(false);
        await recording?.stopAndUnloadAsync();
        await stopLiveActivity(); // End Live Activity
        await Notifications.dismissAllNotificationsAsync();

        const uri = recording?.getURI();
        console.log('Recording stopped and stored at', uri);

        if (uri) {
            handleNewFile(uri);
        }
    };

    useEffect(() => {
        // Load settings and notes
        const init = async () => {
            // Artificial delay to show the loading screen (optional, but good for UX if load is too fast)
            // await new Promise(resolve => setTimeout(resolve, 2000)); 
            const type = await getStorageType();
            setStorageTypeState(type);
            const savedNotes = await loadAllNotes();
            setRecordings(savedNotes as Recording[]);
            setIsAppReady(true);
        };
        init();

        const getPermissions = async () => {
            const { status } = await Notifications.requestPermissionsAsync();
            if (status !== 'granted') {
                console.log('Notification permissions denied');
            }
        };
        getPermissions();

        const unsubscribe = initWatchConnectivity(
            (file) => {
                handleNewFile(file.uri);
            },
            (reachable) => {
                setIsWatchReachable(reachable);
            },
            (context) => {
                // Assuming the watch sends { active: true } or similar in application context
                if (context && context.active !== undefined) {
                    setIsWatchAppActive(context.active);
                }
            }
        );

        // Auto-start recording
        startRecording();

        return unsubscribe;
    }, []);

    // Deep Link Handler for Widget Stop Button
    useEffect(() => {
        const handleDeepLink = (event: { url: string }) => {
            if (event.url.includes('stop-recording')) {
                console.log('Stop recording triggered from Widget/DeepLink');
                if (isRecording) {
                    stopRecording(); // This will refer to the function defined below via hoisting/ref
                    // Wait, stopRecording is defined below as a const.
                    // It will NOT be available here if we are just defining it.
                    // BUT, `stopRecording` is a `const` function.
                    // If we define THIS effect before `stopRecording`, JS rules say we can't access it?
                    // Depends if it's called synchronously. It's called asynchronously in the callback.
                    // By the time the callback runs, `stopRecording` (const) is initialized.
                    // So this is SAFE.
                }
            }
        };

        const subscription = Linking.addEventListener('url', handleDeepLink);

        Linking.getInitialURL().then((url) => {
            // Logic
        });

        return () => {
            subscription.remove();
        };
    }, [isRecording]);

    if (!isAppReady) {
        return <LoadingScreen />;
    }




    const getContentToShare = (item: Recording) => {
        let content = '';
        if (item.transcript) content += `Transcript:\n${item.transcript}\n\n`;
        if (item.tweet) content += `Tweet:\n${item.tweet}\n\n`;
        if (item.summary) {
            content += `Summary:\n${item.summary.bulletPoints.map(p => `• ${p}`).join('\n')}\n\n`;
            content += `Messages:\n${item.summary.messages.map(m => `- ${m}`).join('\n')}`;
        }
        return content;
    };

    const handleCopy = async (item: Recording) => {
        const content = getContentToShare(item);
        await Clipboard.setStringAsync(content);
        Alert.alert('Copied', 'Notes copied to clipboard');
    };

    const handleShare = async (item: Recording) => {
        const content = getContentToShare(item);
        try {
            await Share.share({
                message: content,
            });
        } catch (error) {
            Alert.alert('Error', 'Could not share content');
        }
    };



    const handleDelete = (item: Recording) => {
        Alert.alert(
            'Delete Recording',
            'Are you sure you want to delete this recording?',
            [
                {
                    text: 'Cancel',
                    style: 'cancel',
                },
                {
                    text: 'Delete',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            await deleteNote(item.id);
                            setRecordings(prev => prev.filter(rec => rec.id !== item.id));
                        } catch (error) {
                            Alert.alert('Error', 'Failed to delete recording');
                        }
                    },
                },
            ]
        );
    };

    const handlePostTweet = async (tweet: string) => {
        const url = `https://twitter.com/intent/tweet?text=${encodeURIComponent(tweet)}`;
        const supported = await Linking.canOpenURL(url);

        if (supported) {
            await Linking.openURL(url);
        } else {
            // Fallback strategy if needed, but web URL usually works on iOS/Android even without app
            await Linking.openURL(url);
        }
    };

    const renderItem = ({ item }: { item: Recording }) => (
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.cardHeader}>
                <Text style={styles.date}>{new Date(item.timestamp).toLocaleString()}</Text>
                <TouchableOpacity onPress={() => handleDelete(item)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                    <Text style={[styles.deleteButton, { color: colors.subtext }]}>✕</Text>
                </TouchableOpacity>
            </View>

            {item.isLoading ? (
                <View style={styles.loadingContainer}>
                    <InternalProgressBar color="#FFA500" />
                    <Text style={[styles.processingText, { color: colors.subtext }]}>Processing...</Text>
                </View>
            ) : (
                <>
                    <Text style={[styles.sectionTitle, { color: colors.text }]}>Transcript:</Text>
                    <Text style={[styles.text, { color: colors.text }]}>{item.transcript}</Text>

                    {item.tweet && (
                        <>
                            <Text style={styles.sectionTitle}>Generated Tweet:</Text>
                            <Text style={styles.tweetText}>{item.tweet}</Text>
                            <TouchableOpacity style={styles.tweetButton} onPress={() => item.tweet && handlePostTweet(item.tweet)}>
                                <Text style={styles.tweetButtonText}>Post Tweet</Text>
                            </TouchableOpacity>
                        </>
                    )}

                    {item.summary && (
                        <>
                            <Text style={[styles.sectionTitle, { color: colors.text }]}>Bullet Points:</Text>
                            {item.summary.bulletPoints.map((point, index) => (
                                <Text key={index} style={[styles.bulletPoint, { color: colors.text }]}>• {point}</Text>
                            ))}

                            <Text style={[styles.sectionTitle, { color: colors.text }]}>Messages:</Text>
                            {item.summary.messages.map((msg, index) => (
                                <Text key={index} style={[styles.message, { color: colors.text }]}>- {msg}</Text>
                            ))}
                        </>
                    )}

                    <View style={[styles.actionRow, { borderTopColor: colors.border }]}>
                        <TouchableOpacity style={[styles.actionButton, { backgroundColor: colors.inputBackground }]} onPress={() => handleCopy(item)}>
                            <Text style={[styles.actionButtonText, { color: colors.text }]}>Copy</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={[styles.actionButton, { backgroundColor: colors.inputBackground }]} onPress={() => handleShare(item)}>
                            <Text style={[styles.actionButtonText, { color: colors.text }]}>Share</Text>
                        </TouchableOpacity>
                    </View>
                </>
            )}
        </View>
    );

    return (
        <View style={[styles.container, { backgroundColor: colors.background }]}>
            <StatusBar style={isDark ? 'light' : 'dark'} />
            <View style={styles.headerContainer}>
                <Text style={[styles.header, { color: colors.text }]}>Vecord</Text>
                <TouchableOpacity onPress={() => setIsSettingsVisible(true)} style={styles.settingsButton}>
                    <Ionicons name="settings-outline" size={24} color={colors.text} />
                </TouchableOpacity>
            </View>

            <View style={styles.statusContainer}>
                {isWatchAppActive ? (
                    <View style={[styles.statusBadge, { backgroundColor: colors.statusBadgeActive }]}>
                        <View style={[styles.statusDot, { backgroundColor: colors.tint }]} />
                        <Text style={[styles.statusText, { color: colors.text }]}>Watch App Active</Text>
                    </View>
                ) : isWatchReachable ? (
                    <View style={[styles.statusBadge, { backgroundColor: colors.statusBadgeReachable }]}>
                        <View style={[styles.statusDot, { backgroundColor: colors.success }]} />
                        <Text style={[styles.statusText, { color: colors.text }]}>Watch Connected</Text>
                    </View>
                ) : (
                    <View style={[styles.statusBadge, { backgroundColor: colors.statusBadgeDisconnected }]}>
                        <View style={[styles.statusDot, { backgroundColor: colors.danger }]} />
                        <Text style={[styles.statusText, { color: colors.text }]}>Watch Disconnected</Text>
                    </View>
                )}
            </View>

            {/* Watch Debug Panel */}
            <TouchableOpacity
                style={[styles.debugPanel, { borderColor: colors.border, backgroundColor: colors.card }]}
                onPress={() => Alert.alert('Watch Status', `Reachable: ${isWatchReachable}\nApp Active: ${isWatchAppActive}\n\nMake sure Vecord is installed on your Watch via the Watch app on iPhone.`)}
            >
                <Text style={[styles.debugTitle, { color: colors.text }]}>Watch Debug</Text>
                <Text style={[styles.debugText, { color: colors.subtext }]}>
                    Status: {isWatchReachable ? 'CONNECTED' : 'NOT REACHABLE'}
                </Text>
                <Text style={[styles.debugText, { color: colors.subtext, fontSize: 10 }]}>Tap for details</Text>
            </TouchableOpacity>

            <Modal
                animationType="slide"
                transparent={true}
                visible={isSettingsVisible}
                onRequestClose={() => setIsSettingsVisible(false)}
            >
                <View style={styles.modalView}>
                    <View style={[styles.modalContent, { backgroundColor: colors.modalBackground }]}>
                        <Text style={[styles.modalTitle, { color: colors.text }]}>Settings</Text>

                        <Text style={styles.sectionHeader}>Storage</Text>
                        <View style={[styles.segmentContainer, { backgroundColor: colors.inputBackground }]}>
                            <TouchableOpacity
                                style={[styles.segmentButton, storageType === 'local' && { backgroundColor: isDark ? '#555' : '#FFFFFF' }]}
                                onPress={() => handleStorageChange('local')}
                            >
                                <Text style={[styles.segmentText, storageType === 'local' && { color: colors.text }]}>Local</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.segmentButton, storageType === 'cloud' && { backgroundColor: isDark ? '#555' : '#FFFFFF' }]}
                                onPress={() => handleStorageChange('cloud')}
                            >
                                <Text style={[styles.segmentText, storageType === 'cloud' && { color: colors.text }]}>Cloud</Text>
                            </TouchableOpacity>
                        </View>

                        <Text style={[styles.sectionHeader, { marginTop: 20 }]}>Twitter Prompt</Text>
                        <TextInput
                            style={[styles.textInput, { backgroundColor: colors.inputBackground, color: colors.text }]}
                            multiline
                            value={twitterPrompt}
                            onChangeText={setTwitterPrompt}
                            placeholder="Enter system prompt..."
                            placeholderTextColor={colors.subtext}
                        />

                        <View style={styles.modalButtons}>
                            <TouchableOpacity
                                style={[styles.modalButton, styles.resetButton]}
                                onPress={() => setTwitterPrompt(DEFAULT_TWITTER_PROMPT)}
                            >
                                <Text style={styles.modalButtonText}>Reset Default</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.modalButton, styles.saveButton]}
                                onPress={() => setIsSettingsVisible(false)}
                            >
                                <Text style={styles.modalButtonText}>Done</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>


            <Modal
                animationType="fade"
                transparent={false}
                visible={isRecording}
                onRequestClose={() => { }} // Block back button closing
            >
                <View style={[styles.recordingModalContainer, { backgroundColor: colors.background }]}>
                    <StatusBar style={isDark ? 'light' : 'dark'} />
                    <View style={styles.recordingContent}>
                        <View style={styles.pulsingIndicator} />
                        <Text style={[styles.recordingTitle, { color: colors.text }]}>Recording in progress</Text>
                        <Text style={[styles.recordingSubtitle, { color: colors.subtext }]}>
                            You can put the app in the background or lock the screen; the recording will continue.
                        </Text>
                    </View>

                    <TouchableOpacity
                        style={[styles.recordButton, styles.recordingButton, { marginBottom: 50 }]}
                        onPress={stopRecording}
                    >
                        <Text style={[styles.recordButtonText, { color: '#000000' }]}>Stop Recording</Text>
                    </TouchableOpacity>
                </View>
            </Modal>

            <View style={styles.controls}>
                <TouchableOpacity
                    style={[styles.recordButton, isRecording && styles.recordingButton, { backgroundColor: colors.card, shadowColor: isDark ? '#000' : '#CCC' }]}
                    onPress={isRecording ? stopRecording : startRecording}
                >
                    <Text style={[styles.recordButtonText, { color: colors.text }]}>
                        {isRecording ? 'Stop Recording' : 'Start Recording'}
                    </Text>
                </TouchableOpacity>
            </View>

            <FlatList
                data={recordings}
                renderItem={renderItem}
                keyExtractor={item => item.id}
                contentContainerStyle={styles.list}
                ListEmptyComponent={<Text style={[styles.emptyText, { color: colors.subtext }]}>No recordings yet. Record on your Watch or iPhone!</Text>}
            />

            <View style={[styles.bottomMenu, { backgroundColor: colors.card, borderTopColor: colors.border }]}>
                <TouchableOpacity
                    style={[styles.menuItem, mode === 'notes' && [styles.activeMenuItem, { borderBottomColor: colors.text }]]}
                    onPress={() => setMode('notes')}
                >
                    <Text style={[styles.menuText, mode === 'notes' && { color: colors.text }]}>Notes</Text>
                </TouchableOpacity>
                <TouchableOpacity
                    style={[styles.menuItem, mode === 'twitter' && [styles.activeMenuItem, { borderBottomColor: colors.text }]]}
                    onPress={() => setMode('twitter')}
                >
                    <Text style={[styles.menuText, mode === 'twitter' && { color: colors.text }]}>Twitter Tool</Text>
                </TouchableOpacity>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#000000', // Black background
        paddingTop: Platform.OS === 'ios' ? 60 : 40,
        paddingBottom: 80, // Add padding for bottom menu
    },
    header: {
        fontSize: 24,
        fontWeight: 'bold',
        textAlign: 'center',
        color: '#FFFFFF', // White text
    },
    headerContainer: {
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 20,
        position: 'relative',
    },
    settingsButton: {
        position: 'absolute',
        right: 20,
        padding: 8,
    },
    settingsIcon: {
        fontSize: 24,
    },
    modalView: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: 'rgba(0,0,0,0.8)',
    },
    modalContent: {
        width: '90%',
        backgroundColor: '#1A1A1A',
        borderRadius: 20,
        padding: 20,
        shadowColor: '#000',
        shadowOffset: {
            width: 0,
            height: 2,
        },
        shadowOpacity: 0.25,
        shadowRadius: 4,
        elevation: 5,
    },
    modalTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        color: 'white',
        marginBottom: 15,
        textAlign: 'center',
    },
    sectionHeader: {
        fontSize: 16,
        fontWeight: '600',
        color: '#888',
        marginBottom: 10,
        textTransform: 'uppercase',
    },
    segmentContainer: {
        flexDirection: 'row',
        backgroundColor: '#333',
        borderRadius: 10,
        padding: 4,
        marginBottom: 10,
    },
    segmentButton: {
        flex: 1,
        paddingVertical: 8,
        alignItems: 'center',
        borderRadius: 8,
    },
    activeSegment: {
        backgroundColor: '#555',
    },
    segmentText: {
        color: '#888',
        fontWeight: '600',
    },
    activeSegmentText: {
        color: '#fff',
    },
    modalLabel: {
        color: '#ccc',
        marginBottom: 10,
    },
    textInput: {
        backgroundColor: '#333',
        color: 'white',
        borderRadius: 10,
        padding: 10,
        height: 150,
        textAlignVertical: 'top',
        marginBottom: 20,
    },
    modalButtons: {
        flexDirection: 'row',
        justifyContent: 'space-between',
    },
    modalButton: {
        borderRadius: 10,
        padding: 10,
        elevation: 2,
        minWidth: 100,
        alignItems: 'center',
    },
    resetButton: {
        backgroundColor: '#555',
    },
    saveButton: {
        backgroundColor: '#1DA1F2',
    },
    modalButtonText: {
        color: 'white',
        fontWeight: 'bold',
    },
    controls: {
        alignItems: 'center',
        marginBottom: 20,
    },
    recordButton: {
        backgroundColor: '#FFFFFF', // White button
        paddingHorizontal: 32,
        paddingVertical: 16,
        borderRadius: 30,
        elevation: 5,
        shadowColor: '#FFF', // White shadow
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 4,
    },
    recordingButton: {
        backgroundColor: '#FF3B30', // Red for active recording
    },
    recordButtonText: {
        color: '#000000', // Black text
        fontSize: 18,
        fontWeight: '600',
    },
    list: {
        padding: 16,
    },
    card: {
        backgroundColor: '#1A1A1A', // Dark Gray card
        borderRadius: 12,
        padding: 16,
        marginBottom: 16,
        borderWidth: 1,
        borderColor: '#333',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.5,
        shadowRadius: 4,
        elevation: 3,
    },
    date: {
        fontSize: 12,
        color: '#888',
        marginBottom: 8,
    },
    cardHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 8,
    },
    deleteButton: {
        color: '#666',
        fontSize: 18,
        fontWeight: 'bold',
        padding: 4,
    },
    sectionTitle: {
        fontSize: 16,
        fontWeight: '600',
        marginTop: 12,
        marginBottom: 4,
        color: '#FFFFFF', // White text
    },
    text: {
        fontSize: 14,
        color: '#DDDDDD', // Off-white text
        lineHeight: 20,
    },
    bulletPoint: {
        fontSize: 14,
        color: '#DDDDDD',
        marginLeft: 8,
        marginBottom: 2,
    },
    message: {
        fontSize: 14,
        color: '#DDDDDD',
        marginLeft: 8,
        marginBottom: 2,
        fontStyle: 'italic',
    },
    emptyText: {
        textAlign: 'center',
        color: '#666',
        marginTop: 40,
    },
    actionRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginTop: 16,
        paddingTop: 12,
        borderTopWidth: 1,
        borderTopColor: '#333',
    },
    actionButton: {
        backgroundColor: '#333',
        paddingVertical: 8,
        paddingHorizontal: 12,
        borderRadius: 8,
        minWidth: 60,
        alignItems: 'center',
    },
    actionButtonText: {
        color: '#FFFFFF',
        fontSize: 12,
        fontWeight: '600',
    },
    bottomMenu: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        flexDirection: 'row',
        backgroundColor: '#1A1A1A',
        borderTopWidth: 1,
        borderTopColor: '#333',
        paddingBottom: 40, // Extra padding for iPhone home indicator
        paddingTop: 10,
    },
    menuItem: {
        flex: 1,
        alignItems: 'center',
        paddingVertical: 10,
    },
    activeMenuItem: {
        borderBottomWidth: 2,
        borderBottomColor: '#FFFFFF',
    },
    menuText: {
        color: '#888',
        fontSize: 16,
        fontWeight: '600',
    },
    activeMenuText: {
        color: '#FFFFFF',
    },
    tweetText: {
        fontSize: 16,
        color: '#1DA1F2', // Twitter blue
        lineHeight: 24,
        marginTop: 4,
        marginBottom: 8,
    },
    tweetButton: {
        backgroundColor: '#1DA1F2',
        paddingVertical: 8,
        paddingHorizontal: 16,
        borderRadius: 20,
        alignSelf: 'flex-start',
        marginTop: 8,
        marginBottom: 12,
    },
    tweetButtonText: {
        color: '#FFFFFF',
        fontSize: 14,
        fontWeight: '600',
    },
    statusContainer: {
        alignItems: 'center',
        marginTop: -10,
        marginBottom: 20,
    },
    statusBadge: {
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 16,
        flexDirection: 'row',
        alignItems: 'center',
    },
    statusText: {
        color: '#FFFFFF',
        fontSize: 12,
        fontWeight: '600',
        marginLeft: 6,
    },
    statusDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
    },
    loadingContainer: {
        width: '100%',
        paddingVertical: 12,
        borderRadius: 8,
        position: 'relative',
        overflow: 'hidden',
        justifyContent: 'center',
        alignItems: 'center',
    },
    processingText: {
        fontSize: 14,
        fontWeight: '600',
        zIndex: 1,
    },
    debugPanel: {
        margin: 16,
        padding: 12,
        borderRadius: 8,
        borderWidth: 1,
        alignItems: 'center',
    },
    debugTitle: {
        fontSize: 14,
        fontWeight: 'bold',
        marginBottom: 4,
    },
    debugText: {
        fontSize: 12,
        marginBottom: 2,
    },
    recordingModalContainer: {
        flex: 1,
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 40,
        paddingTop: 100,
    },
    recordingContent: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    recordingTitle: {
        fontSize: 28,
        fontWeight: 'bold',
        marginTop: 24,
        textAlign: 'center',
    },
    recordingSubtitle: {
        fontSize: 16,
        textAlign: 'center',
        marginTop: 16,
        lineHeight: 24,
        opacity: 0.8,
    },
    pulsingIndicator: {
        width: 20,
        height: 20,
        borderRadius: 10,
        backgroundColor: '#FF3B30',
        marginBottom: 10,
    },
});

const InternalProgressBar = ({ color, children }: { color: string, children?: React.ReactNode }) => {
    const progress = React.useRef(new Animated.Value(0)).current;

    React.useEffect(() => {
        const animate = () => {
            progress.setValue(0);
            Animated.timing(progress, {
                toValue: 1,
                duration: 2000,
                easing: Easing.inOut(Easing.ease),
                useNativeDriver: false,
            }).start(() => animate());
        };
        animate();
    }, []);

    const width = progress.interpolate({
        inputRange: [0, 1],
        outputRange: ['0%', '100%'],
    });

    return (
        <View style={styles.loadingContainer}>
            <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: color, width }]} />
            {children}
        </View>
    );
};
