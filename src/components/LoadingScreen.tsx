import { useTheme } from '../context/ThemeContext';
import { StyleSheet, Text, View, ImageBackground } from 'react-native';

const LoadingScreen = () => {
    const { colors } = useTheme();
    return (
        <ImageBackground
            source={require('../../assets/splash-background.png')}
            style={styles.container}
            resizeMode="cover"
        >
            <View style={styles.textContainer}>
                <Text style={styles.title}>Vecord</Text>
                <Text style={styles.tagline}>the easiest way to use nano-banana pro</Text>
            </View>
        </ImageBackground>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        width: '100%',
        height: '100%',
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#000000',
    },
    textContainer: {
        alignItems: 'center',
        position: 'absolute',
        bottom: 100, // Position text towards the bottom or center?
        // User didn't specify position, but typically on a splash with a central logo (if the image has one), text goes below.
        // If the image is just a background, center is safe.
        // Let's go with slightly below center to be safe, or just center.
        // Given "loadingscreen.png" implies a full screen layout, let's just specific center for now.
        // Actually, I'll center it but add some offset if needed.
        // Let's stick to center for now.
        justifyContent: 'center',
        width: '100%',
        paddingHorizontal: 20,
    },
    title: {
        fontSize: 42,
        fontWeight: '800', // Extra bold like tailwind font-extrabold
        color: '#FFFFFF',
        marginBottom: 8,
        textAlign: 'center',
        letterSpacing: 1,
    },
    tagline: {
        fontSize: 16,
        color: '#D1D5DB', // Tailwind gray-300
        textAlign: 'center',
        fontWeight: '500', // Medium
        opacity: 0.9,
    },
});

export default LoadingScreen;
