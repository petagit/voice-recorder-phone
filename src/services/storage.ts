import * as FileSystem from 'expo-file-system/legacy';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from './supabase';

const NOTES_DIR = FileSystem.documentDirectory + 'notes/';
const STORAGE_PREF_KEY = 'vecord_storage_preference';

export type StorageType = 'local' | 'cloud';

export interface NoteData {
    id: string;
    timestamp: number;
    transcript: string;
    summary?: {
        bulletPoints: string[];
        messages: string[];
    };
    tweet?: string;
}

// --- Local Storage Strategy ---

const initLocalStorage = async () => {
    const dirInfo = await FileSystem.getInfoAsync(NOTES_DIR);
    if (!dirInfo.exists) {
        await FileSystem.makeDirectoryAsync(NOTES_DIR, { intermediates: true });
    }
};

const saveNoteLocal = async (note: NoteData): Promise<string> => {
    await initLocalStorage();

    // Format: YYYY-MM-DD-HH-mm-ss.txt
    const date = new Date(note.timestamp);
    const filename = `${date.toISOString().replace(/[:.]/g, '-')}.txt`;
    const filepath = NOTES_DIR + filename;

    const content =
        `--- Timestamp ---
${note.timestamp}
--- Transcript ---
${note.transcript}
--- Summary ---
${JSON.stringify(note.summary || { bulletPoints: [], messages: [] })}
--- Tweet ---
${note.tweet || ''}
`;

    await FileSystem.writeAsStringAsync(filepath, content);
    console.log('Saved note locally to:', filepath);
    return filename;
};

const loadAllNotesLocal = async (): Promise<NoteData[]> => {
    await initLocalStorage();

    const files = await FileSystem.readDirectoryAsync(NOTES_DIR);
    const notes: NoteData[] = [];

    for (const file of files) {
        if (!file.endsWith('.txt')) continue;

        try {
            const content = await FileSystem.readAsStringAsync(NOTES_DIR + file);
            const sections = content.split('--- ');

            const timestampLine = sections.find(s => s.startsWith('Timestamp ---\n'))?.split('\n')[1];
            const transcript = sections.find(s => s.startsWith('Transcript ---\n'))?.replace('Transcript ---\n', '').trim() || '';
            const summaryStr = sections.find(s => s.startsWith('Summary ---\n'))?.replace('Summary ---\n', '').trim();
            const tweet = sections.find(s => s.startsWith('Tweet ---\n'))?.replace('Tweet ---\n', '').trim();

            const timestamp = timestampLine ? parseInt(timestampLine) : Date.now();
            const summary = summaryStr ? JSON.parse(summaryStr) : undefined;

            notes.push({
                id: file, // Use filename as ID for local
                timestamp,
                transcript,
                summary,
                tweet,
            });
        } catch (error) {
            console.error('Error parsing local note:', file, error);
        }
    }

    // Sort by newest first
    return notes.sort((a, b) => b.timestamp - a.timestamp);
};

const deleteNoteLocal = async (id: string): Promise<void> => {
    try {
        await FileSystem.deleteAsync(NOTES_DIR + id);
        console.log('Deleted local note:', id);
    } catch (error) {
        console.error('Error deleting local note:', id, error);
        throw error;
    }
};

// --- Cloud Storage Strategy ---

const saveNoteCloud = async (note: NoteData): Promise<string> => {
    try {
        const { data, error } = await supabase
            .from('Note')
            .upsert({
                id: note.id, // Ensure ID is UUID if possible, or string. Local uses filename which is not UUID.
                // If local id is filename, we might want to generate a new UUID for cloud or just use it.
                // However, Prisma schema expects String ID (uuid default).
                // If we pass a non-uuid, it might work if schema allows.
                // Ideally, we should unify IDs to be UUIDs.
                // For now, let's map note properties.
                timestamp: note.timestamp,
                transcript: note.transcript,
                summary: note.summary,
                tweet: note.tweet,
                updatedAt: new Date().toISOString(),
            })
            .select()
            .single();

        if (error) throw error;
        console.log('Saved note to cloud:', data.id);
        return data.id;
    } catch (error) {
        console.error('Error saving note to cloud:', error);
        throw error;
    }
};

const loadAllNotesCloud = async (): Promise<NoteData[]> => {
    try {
        const { data, error } = await supabase
            .from('Note')
            .select('*')
            .order('timestamp', { ascending: false });

        if (error) throw error;

        return (data || []).map((item: any) => ({
            id: item.id,
            timestamp: Number(item.timestamp), // Convert BigInt/String to number
            transcript: item.transcript,
            summary: item.summary,
            tweet: item.tweet,
        }));
    } catch (error) {
        console.error('Error loading notes from cloud:', error);
        return [];
    }
};

const deleteNoteCloud = async (id: string): Promise<void> => {
    try {
        const { error } = await supabase
            .from('Note')
            .delete()
            .eq('id', id);

        if (error) throw error;
        console.log('Deleted note from cloud:', id);
    } catch (error) {
        console.error('Error deleting note from cloud:', error);
        throw error;
    }
};

// --- Facade ---

export const getStorageType = async (): Promise<StorageType> => {
    try {
        const type = await AsyncStorage.getItem(STORAGE_PREF_KEY);
        return (type as StorageType) || 'local';
    } catch (error) {
        console.error('Error getting storage type:', error);
        return 'local';
    }
};

export const setStoragePreference = async (type: StorageType) => {
    try {
        await AsyncStorage.setItem(STORAGE_PREF_KEY, type);
    } catch (error) {
        console.error('Error setting storage type:', error);
    }
};

// Legacy init function, also useful ensure dir exists for local
export const initStorage = async () => {
    await initLocalStorage();
};

export const saveNote = async (note: NoteData): Promise<string> => {
    const type = await getStorageType();
    if (type === 'cloud') {
        // If migrating from local to cloud, ID might be filename. Cloud expects UUID usually but String is fine.
        // However, if we want to support switching back and forth, consistency is key.
        // For now, we just save to the active storage.
        return saveNoteCloud(note);
    } else {
        return saveNoteLocal(note);
    }
};

export const loadAllNotes = async (): Promise<NoteData[]> => {
    const type = await getStorageType();
    if (type === 'cloud') {
        return loadAllNotesCloud();
    } else {
        return loadAllNotesLocal();
    }
};

export const deleteNote = async (id: string): Promise<void> => {
    const type = await getStorageType();
    if (type === 'cloud') {
        return deleteNoteCloud(id);
    } else {
        return deleteNoteLocal(id);
    }
};
