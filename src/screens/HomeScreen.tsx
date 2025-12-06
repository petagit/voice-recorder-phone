import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, View, FlatList, TouchableOpacity, ActivityIndicator, Alert, Button, Platform, Share } from 'react-native';
import { Audio } from 'expo-av';
import * as Clipboard from 'expo-clipboard';
import * as Notifications from 'expo-notifications';
import { initWatchConnectivity } from '../services/watch';
import { transcribeAudio, organizeText, generateTweet } from '../services/ai';
import { loadAllNotes, saveNote, deleteNote, initStorage } from '../services/storage';

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
    const [recordings, setRecordings] = useState<Recording[]>([]);
    const [recording, setRecording] = useState<Audio.Recording | null>(null);
    const [isRecording, setIsRecording] = useState(false);
    const [mode, setMode] = useState<'notes' | 'twitter'>('notes');
    const [permissionResponse, requestPermission] = Audio.usePermissions();

    useEffect(() => {
        // Load saved notes on startup
        const loadNotes = async () => {
            const savedNotes = await loadAllNotes();
            setRecordings(savedNotes as Recording[]);
        };
        loadNotes();

        const getPermissions = async () => {
            const { status } = await Notifications.requestPermissionsAsync();
            if (status !== 'granted') {
                console.log('Notification permissions denied');
            }
        };
        getPermissions();

        const unsubscribe = initWatchConnectivity((file) => {
            handleNewFile(file.uri);
        });

        // Auto-start recording
        startRecording();

        return unsubscribe;
    }, []);

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
        await Notifications.dismissAllNotificationsAsync();

        const uri = recording?.getURI();
        console.log('Recording stopped and stored at', uri);

        if (uri) {
            handleNewFile(uri);
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
                tweet = await generateTweet(transcript);
            } else {
                summary = await organizeText(transcript);
            }

            // 3. Save to Storage
            await saveNote({
                id: newRecording.id,
                timestamp: newRecording.timestamp,
                transcript,
                summary,
                tweet
            });

            setRecordings(prev => prev.map(rec =>
                rec.id === newRecording.id
                    ? { ...rec, transcript, summary, tweet, isLoading: false }
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

    const handleNotion = async (item: Recording) => {
        const content = getContentToShare(item);
        try {
            await Share.share({
                message: `Saved to Notion:\n\n${content}`,
                title: 'Save to Notion'
            });
        } catch (error) {
            Alert.alert('Error', 'Could not share to Notion');
        }
    };

    const handleDrive = async (item: Recording) => {
        const content = getContentToShare(item);
        try {
            await Share.share({
                message: `Saved to Drive:\n\n${content}`,
                title: 'Save to Drive'
            });
        } catch (error) {
            Alert.alert('Error', 'Could not share to Drive');
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

    const renderItem = ({ item }: { item: Recording }) => (
        <View style={styles.card}>
            <View style={styles.cardHeader}>
                <Text style={styles.date}>{new Date(item.timestamp).toLocaleString()}</Text>
                <TouchableOpacity onPress={() => handleDelete(item)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                    <Text style={styles.deleteButton}>✕</Text>
                </TouchableOpacity>
            </View>

            {item.isLoading ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
                <>
                    <Text style={styles.sectionTitle}>Transcript:</Text>
                    <Text style={styles.text}>{item.transcript}</Text>

                    {item.tweet && (
                        <>
                            <Text style={styles.sectionTitle}>Generated Tweet:</Text>
                            <Text style={styles.tweetText}>{item.tweet}</Text>
                        </>
                    )}

                    {item.summary && (
                        <>
                            <Text style={styles.sectionTitle}>Bullet Points:</Text>
                            {item.summary.bulletPoints.map((point, index) => (
                                <Text key={index} style={styles.bulletPoint}>• {point}</Text>
                            ))}

                            <Text style={styles.sectionTitle}>Messages:</Text>
                            {item.summary.messages.map((msg, index) => (
                                <Text key={index} style={styles.message}>- {msg}</Text>
                            ))}
                        </>
                    )}

                    <View style={styles.actionRow}>
                        <TouchableOpacity style={styles.actionButton} onPress={() => handleCopy(item)}>
                            <Text style={styles.actionButtonText}>Copy</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.actionButton} onPress={() => handleShare(item)}>
                            <Text style={styles.actionButtonText}>Share</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.actionButton} onPress={() => handleNotion(item)}>
                            <Text style={styles.actionButtonText}>Notion</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.actionButton} onPress={() => handleDrive(item)}>
                            <Text style={styles.actionButtonText}>Drive</Text>
                        </TouchableOpacity>
                    </View>
                </>
            )}
        </View>
    );

    return (
        <View style={styles.container}>
            <Text style={styles.header}>Vecord</Text>

            <View style={styles.controls}>
                <TouchableOpacity
                    style={[styles.recordButton, isRecording && styles.recordingButton]}
                    onPress={isRecording ? stopRecording : startRecording}
                >
                    <Text style={styles.recordButtonText}>
                        {isRecording ? 'Stop Recording' : 'Start Recording'}
                    </Text>
                </TouchableOpacity>
            </View>

            <FlatList
                data={recordings}
                renderItem={renderItem}
                keyExtractor={item => item.id}
                contentContainerStyle={styles.list}
                ListEmptyComponent={<Text style={styles.emptyText}>No recordings yet. Record on your Watch or iPhone!</Text>}
            />

            <View style={styles.bottomMenu}>
                <TouchableOpacity
                    style={[styles.menuItem, mode === 'notes' && styles.activeMenuItem]}
                    onPress={() => setMode('notes')}
                >
                    <Text style={[styles.menuText, mode === 'notes' && styles.activeMenuText]}>Notes</Text>
                </TouchableOpacity>
                <TouchableOpacity
                    style={[styles.menuItem, mode === 'twitter' && styles.activeMenuItem]}
                    onPress={() => setMode('twitter')}
                >
                    <Text style={[styles.menuText, mode === 'twitter' && styles.activeMenuText]}>Twitter Tool</Text>
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
        marginBottom: 20,
        color: '#FFFFFF', // White text
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
});
