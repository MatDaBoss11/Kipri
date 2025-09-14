import { createClient } from '@supabase/supabase-js'
import Constants from 'expo-constants'

const supabaseUrl = Constants.expoConfig?.extra?.supabaseUrl || 'https://reuhsokiceymokjwgwjg.supabase.co'
const supabaseAnonKey = Constants.expoConfig?.extra?.supabaseAnonKey || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJldWhzb2tpY2V5bW9randnd2pnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQzNzgxMDcsImV4cCI6MjA2OTk1NDEwN30.XJnViYpp_3oh24BEiZSwgiXyxfH4G9_Iw65clDEg4SI'

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
})