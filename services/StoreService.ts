import { supabase } from './AuthService';
import { Store, UserStorePreference } from '../types';

class StoreService {
  private static instance: StoreService;

  private constructor() {}

  public static getInstance(): StoreService {
    if (!StoreService.instance) {
      StoreService.instance = new StoreService();
    }
    return StoreService.instance;
  }

  public async getAllStores(): Promise<Store[]> {
    try {
      if (__DEV__) console.log('🏪 Fetching all active stores from database...');

      const { data, error } = await supabase
        .from('stores')
        .select('*')
        .eq('is_active', true)
        .order('chain', { ascending: true })
        .order('name', { ascending: true });

      if (error) throw error;

      const stores = data || [];
      if (__DEV__) console.log('✅ Stores fetched successfully', stores.length, 'active stores');
      return stores;
    } catch (error) {
      console.error('❌ Error fetching stores:', error);
      throw error;
    }
  }

  public async getStoresByChain(): Promise<{ [chain: string]: Store[] }> {
    try {
      if (__DEV__) console.log('🔄 Grouping stores by chain...');

      const allStores = await this.getAllStores();
      const storesByChain: { [chain: string]: Store[] } = {};

      for (const store of allStores) {
        const chain = store.chain || 'Other';
        if (!storesByChain[chain]) {
          storesByChain[chain] = [];
        }
        storesByChain[chain].push(store);
      }

      if (__DEV__) console.log('✅ Stores grouped by chain successfully', Object.keys(storesByChain).length, 'chains');
      return storesByChain;
    } catch (error) {
      console.error('❌ Error grouping stores by chain:', error);
      throw error;
    }
  }

  public async getUserStorePreferences(userId: string): Promise<Store[]> {
    try {
      if (__DEV__) console.log('👤 Fetching user store preferences for user:', userId);

      // First, get the store IDs from preferences
      const { data: prefsData, error: prefsError } = await supabase
        .from('user_store_preferences')
        .select('store_id, priority')
        .eq('user_id', userId)
        .order('priority', { ascending: true });

      if (prefsError) {
        console.error('❌ Error fetching preferences:', prefsError);
        throw prefsError;
      }

      if (__DEV__) console.log('📋 Found preferences:', prefsData?.length || 0);

      if (!prefsData || prefsData.length === 0) {
        if (__DEV__) console.log('✅ User store preferences fetched successfully 0 stores');
        return [];
      }

      // Then, get the store details for those IDs
      const storeIds = prefsData.map(p => p.store_id);
      const { data: storesData, error: storesError } = await supabase
        .from('stores')
        .select('*')
        .in('id', storeIds);

      if (storesError) {
        console.error('❌ Error fetching stores:', storesError);
        throw storesError;
      }

      // Sort stores by the priority order from preferences
      const storeMap = new Map(storesData?.map(s => [s.id, s]) || []);
      const stores: Store[] = prefsData
        .map(p => storeMap.get(p.store_id))
        .filter((s): s is Store => s !== undefined);

      if (__DEV__) console.log('✅ User store preferences fetched successfully', stores.length, 'stores');
      return stores;
    } catch (error) {
      console.error('❌ Error fetching user store preferences:', error);
      throw error;
    }
  }

  public async saveUserStorePreferences(userId: string, storeIds: string[]): Promise<boolean> {
    try {
      if (__DEV__) console.log('💾 Saving user store preferences for user:', userId, 'with stores:', storeIds);

      if (storeIds.length !== 3) {
        console.error('❌ Error: Must provide exactly 3 store IDs, got', storeIds.length);
        return false;
      }

      // First, delete all existing preferences for this user
      if (__DEV__) console.log('🗑️ Deleting existing preferences...');
      const { error: deleteError } = await supabase
        .from('user_store_preferences')
        .delete()
        .eq('user_id', userId);

      if (deleteError) throw deleteError;

      // Then, insert the new preferences with priorities 1, 2, 3
      if (__DEV__) console.log('➕ Inserting new preferences...');
      const newPreferences = storeIds.map((storeId, index) => ({
        user_id: userId,
        store_id: storeId,
        priority: index + 1  // 1, 2, 3
      }));

      const { error: insertError } = await supabase
        .from('user_store_preferences')
        .insert(newPreferences);

      if (insertError) throw insertError;

      if (__DEV__) console.log('✅ User store preferences saved successfully');
      return true;
    } catch (error) {
      console.error('❌ Error saving user store preferences:', error);
      return false;
    }
  }

  public async hasUserSelectedStores(userId: string): Promise<boolean> {
    try {
      if (__DEV__) console.log('🔍 Checking if user has selected stores:', userId);

      const { data, error } = await supabase
        .from('user_store_preferences')
        .select('id')
        .eq('user_id', userId)
        .limit(1);

      if (error) throw error;

      const hasPreferences = data && data.length > 0;
      if (__DEV__) console.log('✅ User preference check complete:', hasPreferences ? 'Has preferences' : 'No preferences');
      return hasPreferences;
    } catch (error) {
      console.error('❌ Error checking user store preferences:', error);
      return false;
    }
  }
}

export default StoreService;
