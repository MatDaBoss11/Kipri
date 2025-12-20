import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient, User } from '@supabase/supabase-js';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '';

// Initialize Supabase with AsyncStorage for persistence
export const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: {
        storage: AsyncStorage,
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false,
    },
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

            // 2. Create the Profile record
            const { error: profileError } = await supabase
                .from('profiles')
                .insert({
                    id: data.user.id,
                    phone_number: phoneNumber,
                });

            if (profileError) {
                console.error('Error creating profile:', profileError);
                // We don't throw here because the auth account was created successfully
            }

            // 3. Create the empty Wishlist record
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
            console.log('AuthService: signIn attempt finished:', (error as any).message);
            throw error;
        }
    }

    /**
     * Signs out the current user
     */
    public async signOut() {
        try {
            const { error } = await supabase.auth.signOut();
            if (error) throw error;
        } catch (error) {
            console.error('AuthService: signOut error:', error);
            throw error;
        }
    }

    /**
     * Returns the currently logged in user
     */
    public async getCurrentUser(): Promise<User | null> {
        const { data: { user } } = await supabase.auth.getUser();
        return user;
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
