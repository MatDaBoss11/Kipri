import { LinearGradient } from 'expo-linear-gradient';
import { useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    KeyboardAvoidingView,
    Platform,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// Use relative imports to avoid alias issues
import { Colors } from '../constants/Colors';
import { useColorScheme } from '../hooks/useColorScheme';
import AuthService from '../services/AuthService';

interface AuthScreenProps {
    onAuthSuccess: () => void;
}

const AuthScreen = ({ onAuthSuccess }: AuthScreenProps) => {
    const insets = useSafeAreaInsets();
    const colorScheme = useColorScheme();
    const colors = Colors[colorScheme ?? 'light'];

    const [phoneNumber, setPhoneNumber] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);

    const handleContinue = async () => {
        if (!phoneNumber || !password) {
            Alert.alert('Error', 'Please fill in both fields');
            return;
        }

        // Mauritian numbers are usually 8 digits
        if (phoneNumber.length < 7) {
            Alert.alert('Error', 'Please enter a valid phone number');
            return;
        }

        setLoading(true);
        const fullNumber = `+230${phoneNumber}`;

        try {
            // 1. Try to Sign In first
            console.log('Attempting sign in for:', fullNumber);
            await AuthService.signIn(fullNumber, password);
            onAuthSuccess();
        } catch (signInError: any) {
            // 2. If Sign In fails, it might be a new user or a wrong password
            console.log('Sign in failed, checking if new user...');

            try {
                // Try to Sign Up
                await AuthService.signUp(fullNumber, password);
                onAuthSuccess();
            } catch (signUpError: any) {
                // 3. If Sign Up fails because the user ALREADY exists, 
                // then the original Sign In failed because the PASSWORD was wrong.
                if (signUpError.message?.toLowerCase().includes('already registered') ||
                    signUpError.message?.toLowerCase().includes('already exists')) {
                    Alert.alert(
                        'Try Again',
                        'The password you entered is incorrect for this phone number.'
                    );
                } else {
                    // Some other error (network, etc.)
                    Alert.alert('Auth Failed', signUpError.message || 'Something went wrong');
                }
            }
        } finally {
            setLoading(false);
        }
    };

    return (
        <LinearGradient
            colors={colorScheme === 'dark' ? ['#0F172A', '#1E293B'] : ['#F8FAFC', '#F1F5F9']}
            style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}
        >
            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                style={styles.keyboardView}
            >
                <View style={styles.content}>
                    <View style={styles.branding}>
                        <View style={[styles.logoContainer, { backgroundColor: colors.primary }]}>
                            <Text style={styles.logoText}>K</Text>
                        </View>
                        <Text style={[styles.title, { color: colors.primary }]}>Kipri</Text>
                        <Text style={[styles.subtitle, { color: colors.text }]}>
                            Save more on every grocery run
                        </Text>
                    </View>

                    <View style={styles.form}>
                        <View style={styles.inputContainer}>
                            <Text style={[styles.label, { color: colors.text }]}>Phone Number</Text>
                            <View style={[
                                styles.phoneInputWrapper,
                                {
                                    backgroundColor: colorScheme === 'dark' ? '#334155' : '#FFFFFF',
                                    borderColor: colorScheme === 'dark' ? '#475569' : '#E2E8F0'
                                }
                            ]}>
                                <View style={styles.prefixContainer}>
                                    <Text style={[styles.prefixText, { color: colors.text }]}>+230</Text>
                                    <View style={[styles.verticalDivider, { backgroundColor: colorScheme === 'dark' ? '#475569' : '#E2E8F0' }]} />
                                </View>
                                <TextInput
                                    style={[styles.input, { color: colors.text }]}
                                    placeholder="5123 4567"
                                    placeholderTextColor={colorScheme === 'dark' ? '#94A3B8' : '#94A3B8'}
                                    keyboardType="phone-pad"
                                    value={phoneNumber}
                                    onChangeText={(val) => setPhoneNumber(val.replace(/\D/g, '').slice(0, 8))}
                                    autoCapitalize="none"
                                />
                            </View>
                        </View>

                        <View style={styles.inputContainer}>
                            <Text style={[styles.label, { color: colors.text }]}>Password</Text>
                            <TextInput
                                style={[
                                    styles.inputBase,
                                    {
                                        backgroundColor: colorScheme === 'dark' ? '#334155' : '#FFFFFF',
                                        color: colors.text,
                                        borderColor: colorScheme === 'dark' ? '#475569' : '#E2E8F0'
                                    }
                                ]}
                                placeholder="••••••••"
                                placeholderTextColor={colorScheme === 'dark' ? '#94A3B8' : '#94A3B8'}
                                secureTextEntry
                                value={password}
                                onChangeText={setPassword}
                            />
                        </View>

                        <TouchableOpacity
                            style={[styles.button, { backgroundColor: colors.primary }]}
                            onPress={handleContinue}
                            disabled={loading}
                            activeOpacity={0.8}
                        >
                            {loading ? (
                                <ActivityIndicator color="white" />
                            ) : (
                                <Text style={styles.buttonText}>Continue</Text>
                            )}
                        </TouchableOpacity>

                        <Text style={[styles.footerText, { color: colors.text }]}>
                            New users will be registered automatically.
                        </Text>
                    </View>
                </View>
            </KeyboardAvoidingView>
        </LinearGradient>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    keyboardView: {
        flex: 1,
    },
    content: {
        flex: 1,
        paddingHorizontal: 28,
        justifyContent: 'center',
    },
    branding: {
        alignItems: 'center',
        marginBottom: 48,
    },
    logoContainer: {
        width: 64,
        height: 64,
        borderRadius: 18,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 16,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 8,
        elevation: 5,
    },
    logoText: {
        color: 'white',
        fontSize: 32,
        fontWeight: '900',
    },
    title: {
        fontSize: 42,
        fontWeight: '800',
        letterSpacing: 2,
        marginBottom: 4,
    },
    subtitle: {
        fontSize: 16,
        fontWeight: '500',
        opacity: 0.6,
        textAlign: 'center',
    },
    form: {
        gap: 22,
    },
    inputContainer: {
        gap: 8,
    },
    label: {
        fontSize: 14,
        fontWeight: '700',
        marginLeft: 4,
    },
    phoneInputWrapper: {
        flexDirection: 'row',
        height: 60,
        borderRadius: 16,
        borderWidth: 1.5,
        overflow: 'hidden',
        alignItems: 'center',
    },
    prefixContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingLeft: 16,
        gap: 12,
    },
    prefixText: {
        fontSize: 16,
        fontWeight: '700',
        opacity: 0.8,
    },
    verticalDivider: {
        width: 1.5,
        height: 24,
    },
    input: {
        flex: 1,
        height: '100%',
        paddingHorizontal: 8,
        fontSize: 18,
        fontWeight: '600',
        letterSpacing: 1,
    },
    inputBase: {
        height: 60,
        borderRadius: 16,
        paddingHorizontal: 16,
        fontSize: 18,
        borderWidth: 1.5,
    },
    button: {
        height: 60,
        borderRadius: 16,
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: 12,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.2,
        shadowRadius: 10,
        elevation: 4,
    },
    buttonText: {
        color: 'white',
        fontSize: 18,
        fontWeight: '800',
        letterSpacing: 1,
    },
    footerText: {
        fontSize: 13,
        fontWeight: '500',
        opacity: 0.5,
        textAlign: 'center',
        marginTop: 8,
    },
});

export default AuthScreen;
