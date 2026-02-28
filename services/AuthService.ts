import * as SecureStore from 'expo-secure-store';
import { createClient, User } from '@supabase/supabase-js';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '';

// Secure storage adapter for Supabase auth (encrypts tokens at rest)
const secureStoreAdapter = {
    getItem: (key: string) => SecureStore.getItemAsync(key),
    setItem: (key: string, value: string) => SecureStore.setItemAsync(key, value),
    removeItem: (key: string) => SecureStore.deleteItemAsync(key),
};

// Initialize Supabase with SecureStore for encrypted persistence
export const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: {
        storage: secureStoreAdapter,
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false,
    },
});

// Handle invalid refresh tokens on startup - clear stale session so user can re-login
supabase.auth.onAuthStateChange((event, session) => {
    if (event === 'TOKEN_REFRESHED' && !session) {
        if (__DEV__) console.log('[AuthService] Token refresh failed, clearing stale session');
        supabase.auth.signOut().catch(() => {});
    }
});

class AuthService {
    private static instance: AuthService;

    private constructor() { }

    public static getInstance(): AuthService {
        if (!AuthService.instance) {
            AuthService.instance = new AuthService();
        }
        return AuthService.instance;
    }

    /**
     * Generates a pseudo-email from a phone number for password-based auth
     */
    private getPseudoEmail(phoneNumber: string): string {
        // Remove any non-numeric characters just in case
        const cleanPhone = phoneNumber.replace(/\D/g, '');
        return `${cleanPhone}@kipri.app`;
    }

    /**
     * Signs up a new user using Phone Number + Password
     */
    public async signUp(phoneNumber: string, password: string) {
        try {
            const email = this.getPseudoEmail(phoneNumber);

            // 1. Create the Auth account
            const { data, error } = await supabase.auth.signUp({
                email,
                password,
            });

            if (error) throw error;
            if (!data.user) throw new Error('Sign up failed - no user returned');

            // Profile is now automatically created by database trigger
            // Wait a moment for the trigger to complete
            await new Promise(resolve => setTimeout(resolve, 500));

            // Create the empty Wishlist record
            const { error: wishlistError } = await supabase
                .from('user_wishlists')
                .insert({
                    user_id: data.user.id,
                    items: [],
                });

            if (wishlistError) {
                console.error('Error creating initial wishlist:', wishlistError);
            }

            return { user: data.user, session: data.session };
        } catch (error) {
            console.error('AuthService: signUp error:', error);
            throw error;
        }
    }

    /**
     * Signs in an existing user
     */
    public async signIn(phoneNumber: string, password: string) {
        try {
            const email = this.getPseudoEmail(phoneNumber);

            const { data, error } = await supabase.auth.signInWithPassword({
                email,
                password,
            });

            if (error) throw error;
            return { user: data.user, session: data.session };
        } catch (error) {
            // We use console.log here instead of error because this is an expected 
            // part of the Unified Login flow (checking if user exists)
            if (__DEV__) console.log('AuthService: signIn attempt finished:', (error as any).message);
            throw error;
        }
    }

    /**
     * Signs out the current user
     */
    public async signOut() {
        try {
            const { error } = await supabase.auth.signOut();
            if (error) {
                if (__DEV__) console.log('AuthService: signOut had error (session may already be invalid):', error.message);
            }
        } catch (error) {
            if (__DEV__) console.log('AuthService: signOut error (non-critical):', error);
        }
    }

    /**
     * Returns the currently logged in user.
     * Returns null (instead of throwing) when the session/token is stale.
     */
    public async getCurrentUser(): Promise<User | null> {
        try {
            const { data: { user }, error } = await supabase.auth.getUser();
            if (error) {
                if (__DEV__) console.log('[AuthService] getCurrentUser error:', error.message);
                // Stale token — clear it so next startup is clean
                await supabase.auth.signOut().catch(() => {});
                return null;
            }
            return user;
        } catch (e: any) {
            if (__DEV__) console.log('[AuthService] getCurrentUser threw:', e?.message || e);
            await supabase.auth.signOut().catch(() => {});
            return null;
        }
    }

    /**
     * Checks if a user is logged in
     */
    public async isAuthenticated(): Promise<boolean> {
        const user = await this.getCurrentUser();
        return !!user;
    }
}

export default AuthService.getInstance();
