import * as FileSystem from 'expo-file-system/legacy';

const NOTES_DIR = FileSystem.documentDirectory + 'notes/';

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

export const deleteNote = async (id: string): Promise<void> => {
    try {
        await FileSystem.deleteAsync(NOTES_DIR + id);
        console.log('Deleted note:', id);
    } catch (error) {
        console.error('Error deleting note:', id, error);
        throw error;
    }
};

export const initStorage = async () => {
    const dirInfo = await FileSystem.getInfoAsync(NOTES_DIR);
    if (!dirInfo.exists) {
        await FileSystem.makeDirectoryAsync(NOTES_DIR, { intermediates: true });
    }
};

export const saveNote = async (note: NoteData): Promise<string> => {
    await initStorage();

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
    console.log('Saved note to:', filepath);
    return filepath;
};

export const loadAllNotes = async (): Promise<NoteData[]> => {
    await initStorage();

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
                id: file, // Use filename as ID
                timestamp,
                transcript,
                summary,
                tweet,
                // uri is not needed for display, but could be reconstructed if needed
            } as any);
        } catch (error) {
            console.error('Error parsing note:', file, error);
        }
    }

    // Sort by newest first
    return notes.sort((a, b) => b.timestamp - a.timestamp);
};
