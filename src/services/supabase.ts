
import 'react-native-url-polyfill/auto';
import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';

// In a real app, these should be in an .env file
// const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
// const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

// For now we will assume the user puts them in .env or we can use placeholders
// Since we don't have the values yet, we'll try to read from env or fallback
const CONSTANTS = {
    SUPABASE_URL: process.env.EXPO_PUBLIC_SUPABASE_URL || '',
    SUPABASE_ANON_KEY: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || ''
};

const isConfigured = CONSTANTS.SUPABASE_URL && CONSTANTS.SUPABASE_ANON_KEY;

if (!isConfigured) {
    console.warn('Supabase is not configured. Missing EXPO_PUBLIC_SUPABASE_URL or EXPO_PUBLIC_SUPABASE_ANON_KEY.');
}

// Create the client if configured, otherwise create a dummy object or a client that faces errors gracefully
// However, creating a client with empty strings throws an error immediately.
// We export a proxy or a dummy if not configured to prevent crash on import.

export const supabase = isConfigured
    ? createClient(CONSTANTS.SUPABASE_URL, CONSTANTS.SUPABASE_ANON_KEY, {
        auth: {
            storage: AsyncStorage,
            autoRefreshToken: true,
            persistSession: true,
            detectSessionInUrl: false,
        },
    })
    : new Proxy({} as any, {
        get: (target, prop) => {
            // Return a function that logs a warning and returns an error-like object for any method call
            // This is a rough mock to prevent "cannot read property of undefined" but operations will fail.
            const warnAndReturn = () => {
                console.warn(`Supabase accessed but not configured. Call to '${String(prop)}' ignored.`);
                return { data: null, error: { message: 'Supabase not configured' } };
            };

            // If the property accessed is 'auth' etc, we might need a nested proxy, 
            // but for now let's just make everything return the warner or a safe object.
            if (prop === 'from') return () => new Proxy({}, {
                get: () => warnAndReturn // Chain: supabase.from().select() -> warnAndReturn
            });

            return warnAndReturn;
        }
    });
