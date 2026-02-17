import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLogout } from '../../contexts/LogoutContext';
import { useStorePreferences } from '../../contexts/StorePreferencesContext';
import StoreService from '../../services/StoreService';
import AuthService from '../../services/AuthService';
import { Store } from '../../types';

const SettingsScreen = () => {
  const insets = useSafeAreaInsets();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const isDark = colorScheme === 'dark';

  const { logout } = useLogout();
  const { selectedStores, saveStorePreferences, loadUserStores, clearStorePreferences } = useStorePreferences();

  // State for editing stores
  const [isEditingStores, setIsEditingStores] = useState(false);
  const [availableStores, setAvailableStores] = useState<Store[]>([]);
  const [editSelectedIds, setEditSelectedIds] = useState<string[]>([]);
  const [isLoadingStores, setIsLoadingStores] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [userName, setUserName] = useState<string>('');

  // Load user info
  useEffect(() => {
    const loadUserInfo = async () => {
      try {
        const user = await AuthService.getCurrentUser();
        if (user?.phone) {
          setUserName(user.phone);
        }
      } catch (error) {
        console.error('Error loading user info:', error);
      }
    };
    loadUserInfo();
  }, []);

  // Load all stores when entering edit mode
  const handleEditStores = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setIsEditingStores(true);
    setIsLoadingStores(true);

    try {
      const stores = await StoreService.getInstance().getAllStores();
      setAvailableStores(stores);
      // Pre-select current stores
      if (selectedStores) {
        setEditSelectedIds(selectedStores.map(s => s.id));
      }
    } catch (error) {
      console.error('Error loading stores:', error);
      Alert.alert('Error', 'Failed to load stores. Please try again.');
      setIsEditingStores(false);
    } finally {
      setIsLoadingStores(false);
    }
  };

  const handleReselectOnMap = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Alert.alert(
      'Reselect Stores',
      'This will take you back to the map to pick your 3 stores. Continue?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Go to Map',
          onPress: () => clearStorePreferences(),
        },
      ]
    );
  };

  const handleCancelEdit = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setIsEditingStores(false);
    setEditSelectedIds([]);
  };

  const handleStorePress = (storeId: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    if (editSelectedIds.includes(storeId)) {
      // Remove from selection
      setEditSelectedIds(prev => prev.filter(id => id !== storeId));
    } else if (editSelectedIds.length < 3) {
      // Add to selection
      setEditSelectedIds(prev => [...prev, storeId]);
    } else {
      // Already have 3 selected
      Alert.alert(
        'Maximum Reached',
        'You can only select 3 stores. Unselect one first.'
      );
    }
  };

  const handleSaveStores = async () => {
    if (editSelectedIds.length !== 3) {
      Alert.alert('Selection Required', 'Please select exactly 3 stores to continue.');
      return;
    }

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setIsSaving(true);

    try {
      const success = await saveStorePreferences(editSelectedIds);

      if (success) {
        await loadUserStores();
        setIsEditingStores(false);
        setEditSelectedIds([]);
        Alert.alert('Success', 'Your store preferences have been updated!');
      } else {
        Alert.alert('Error', 'Failed to save your store preferences. Please try again.');
      }
    } catch (error) {
      console.error('Error saving preferences:', error);
      Alert.alert('Error', 'Something went wrong. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleLogout = useCallback(async () => {
    Alert.alert(
      'Log Out',
      'Are you sure you want to log out?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Log Out',
          style: 'destructive',
          onPress: async () => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
            try {
              await logout();
            } catch (error) {
              console.error('Error logging out:', error);
              Alert.alert('Error', 'Failed to log out. Please try again.');
            }
          },
        },
      ]
    );
  }, [logout]);

  const getEditSelectedStore = (index: number): Store | null => {
    const storeId = editSelectedIds[index];
    if (!storeId) return null;
    return availableStores.find(s => s.id === storeId) || null;
  };

  const renderSelectedSlot = (index: number) => {
    const store = getEditSelectedStore(index);
    const priority = index + 1;

    return (
      <View
        key={`slot-${index}`}
        style={[
          styles.selectedSlot,
          {
            backgroundColor: store
              ? store.color + '20'
              : isDark ? '#334155' : '#F1F5F9',
            borderColor: store
              ? store.color
              : isDark ? '#475569' : '#E2E8F0',
          },
        ]}
      >
        <Text style={[styles.priorityBadge, { color: colors.primary }]}>
          {priority}
        </Text>
        {store ? (
          <View style={styles.selectedSlotContent}>
            <Text style={styles.selectedSlotIcon}>{store.icon}</Text>
            <Text
              style={[styles.selectedSlotName, { color: colors.text }]}
              numberOfLines={1}
            >
              {store.name}
            </Text>
          </View>
        ) : (
          <Text style={[styles.selectedSlotPlaceholder, { color: colors.text }]}>
            Select a store
          </Text>
        )}
      </View>
    );
  };

  const renderStoreCard = (store: Store) => {
    const isSelected = editSelectedIds.includes(store.id);
    const selectionIndex = editSelectedIds.indexOf(store.id);

    return (
      <TouchableOpacity
        key={store.id}
        style={[
          styles.storeCard,
          {
            backgroundColor: isDark ? '#1E293B' : '#FFFFFF',
            borderColor: isSelected ? store.color : (isDark ? '#334155' : '#E2E8F0'),
            borderWidth: isSelected ? 2.5 : 1,
          },
        ]}
        onPress={() => handleStorePress(store.id)}
        activeOpacity={0.7}
      >
        {isSelected && (
          <View style={[styles.checkmarkBadge, { backgroundColor: store.color }]}>
            <Text style={styles.checkmarkText}>{selectionIndex + 1}</Text>
          </View>
        )}
        <View
          style={[
            styles.storeIconContainer,
            { backgroundColor: store.color + '20' },
          ]}
        >
          <Text style={styles.storeIcon}>{store.icon}</Text>
        </View>
        <Text
          style={[styles.storeName, { color: colors.text }]}
          numberOfLines={1}
        >
          {store.name}
        </Text>
        <Text
          style={[styles.storeDetails, { color: colors.text }]}
          numberOfLines={1}
        >
          {store.chain}{store.location ? ` - ${store.location}` : ''}
        </Text>
      </TouchableOpacity>
    );
  };

  const renderCurrentStoreCard = (store: Store, index: number) => (
    <View
      key={store.id}
      style={[
        styles.currentStoreCard,
        { backgroundColor: isDark ? '#1E293B' : '#FFFFFF' },
      ]}
    >
      <View style={[styles.currentStorePriority, { backgroundColor: store.color }]}>
        <Text style={styles.currentStorePriorityText}>{index + 1}</Text>
      </View>
      <View style={[styles.currentStoreIconBg, { backgroundColor: store.color + '20' }]}>
        <Text style={styles.currentStoreIcon}>{store.icon}</Text>
      </View>
      <View style={styles.currentStoreInfo}>
        <Text style={[styles.currentStoreName, { color: colors.text }]} numberOfLines={1}>
          {store.name}
        </Text>
        <Text style={[styles.currentStoreChain, { color: colors.text }]} numberOfLines={1}>
          {store.chain}{store.location ? ` - ${store.location}` : ''}
        </Text>
      </View>
    </View>
  );

  // Edit mode view
  if (isEditingStores) {
    return (
      <LinearGradient
        colors={isDark ? ['#0F172A', '#1E293B', '#334155'] : ['#f5f5f5', '#f2f2f2', '#f3f3f3']}
        style={[styles.container, { paddingTop: insets.top }]}
      >
        {/* Header */}
        <View style={styles.editHeader}>
          <TouchableOpacity onPress={handleCancelEdit} style={styles.backButton}>
            <MaterialIcons name="arrow-back" size={24} color={colors.text} />
          </TouchableOpacity>
          <View style={styles.editHeaderText}>
            <Text style={[styles.editTitle, { color: colors.primary }]}>
              Change Stores
            </Text>
            <Text style={[styles.editSubtitle, { color: colors.text }]}>
              Select exactly 3 stores to compare
            </Text>
          </View>
          <View style={[styles.counterBadge, { backgroundColor: colors.primary + '20' }]}>
            <Text style={[styles.counterText, { color: colors.primary }]}>
              {editSelectedIds.length}/3
            </Text>
          </View>
        </View>

        {isLoadingStores ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={[styles.loadingText, { color: colors.text }]}>
              Loading stores...
            </Text>
          </View>
        ) : (
          <>
            {/* Selected Stores Display */}
            <View style={styles.selectedStoresContainer}>
              {[0, 1, 2].map(index => renderSelectedSlot(index))}
            </View>

            {/* Store Grid */}
            <ScrollView
              style={styles.scrollView}
              contentContainerStyle={styles.scrollContent}
              showsVerticalScrollIndicator={false}
            >
              <View style={styles.storeGrid}>
                {availableStores.map(store => renderStoreCard(store))}
              </View>
            </ScrollView>

            {/* Save Button */}
            <View style={styles.buttonContainer}>
              <TouchableOpacity
                style={[
                  styles.saveButton,
                  {
                    backgroundColor: editSelectedIds.length === 3
                      ? colors.primary
                      : isDark ? '#334155' : '#CBD5E1',
                  },
                ]}
                onPress={handleSaveStores}
                disabled={editSelectedIds.length !== 3 || isSaving}
                activeOpacity={0.8}
              >
                {isSaving ? (
                  <ActivityIndicator color="white" />
                ) : (
                  <Text
                    style={[
                      styles.saveButtonText,
                      {
                        color: editSelectedIds.length === 3
                          ? 'white'
                          : isDark ? '#64748B' : '#94A3B8',
                      },
                    ]}
                  >
                    Save Changes
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </>
        )}
      </LinearGradient>
    );
  }

  // Main settings view
  return (
    <LinearGradient
      colors={isDark ? ['#0F172A', '#1E293B', '#334155'] : ['#f5f5f5', '#f2f2f2', '#f3f3f3']}
      style={[styles.container, { paddingTop: insets.top }]}
    >
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerTitleContainer}>
          <Text style={[styles.kipriLogo, { color: colors.primary }]}>Kipri</Text>
          <Text style={[styles.headerSubtitle, { color: colors.text }]}>Settings</Text>
        </View>
      </View>

      <ScrollView
        style={styles.mainScrollView}
        contentContainerStyle={styles.mainScrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* User Section */}
        <View style={[styles.section, { backgroundColor: isDark ? '#1E293B' : '#FFFFFF' }]}>
          <View style={styles.sectionHeader}>
            <MaterialIcons name="person" size={22} color={colors.primary} />
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Account</Text>
          </View>
          <View style={styles.sectionContent}>
            <View style={styles.userInfo}>
              <View style={[styles.userAvatar, { backgroundColor: colors.primary + '20' }]}>
                <MaterialIcons name="person" size={28} color={colors.primary} />
              </View>
              <View style={styles.userDetails}>
                <Text style={[styles.userPhone, { color: colors.text }]}>
                  {userName || 'Loading...'}
                </Text>
                <Text style={[styles.userLabel, { color: colors.text }]}>Phone Number</Text>
              </View>
            </View>
          </View>
        </View>

        {/* My Stores Section */}
        <View style={[styles.section, { backgroundColor: isDark ? '#1E293B' : '#FFFFFF' }]}>
          <View style={styles.sectionHeader}>
            <MaterialIcons name="store" size={22} color={colors.primary} />
            <Text style={[styles.sectionTitle, { color: colors.text }]}>My Stores</Text>
            <View style={{ flexDirection: 'row', gap: 6 }}>
              <TouchableOpacity
                style={[styles.changeButton, { backgroundColor: colors.primary }]}
                onPress={handleReselectOnMap}
                activeOpacity={0.7}
              >
                <MaterialIcons name="map" size={14} color="white" />
                <Text style={styles.changeButtonText}>Map</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.changeButton, { backgroundColor: colors.primary }]}
                onPress={handleEditStores}
                activeOpacity={0.7}
              >
                <MaterialIcons name="edit" size={14} color="white" />
                <Text style={styles.changeButtonText}>Change</Text>
              </TouchableOpacity>
            </View>
          </View>
          <View style={styles.sectionContent}>
            {selectedStores && selectedStores.length > 0 ? (
              <View style={styles.currentStoresGrid}>
                {selectedStores.map((store, index) => renderCurrentStoreCard(store, index))}
              </View>
            ) : (
              <View style={styles.noStoresContainer}>
                <Text style={[styles.noStoresText, { color: colors.text }]}>
                  No stores selected
                </Text>
                <TouchableOpacity
                  style={[styles.selectStoresButton, { backgroundColor: colors.primary }]}
                  onPress={handleEditStores}
                  activeOpacity={0.7}
                >
                  <Text style={styles.selectStoresButtonText}>Select Stores</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </View>

        {/* About Section */}
        <View style={[styles.section, { backgroundColor: isDark ? '#1E293B' : '#FFFFFF' }]}>
          <View style={styles.sectionHeader}>
            <MaterialIcons name="info" size={22} color={colors.primary} />
            <Text style={[styles.sectionTitle, { color: colors.text }]}>About</Text>
          </View>
          <View style={styles.sectionContent}>
            <View style={styles.aboutItem}>
              <Text style={[styles.aboutLabel, { color: colors.text }]}>App Version</Text>
              <Text style={[styles.aboutValue, { color: colors.primary }]}>1.0.0</Text>
            </View>
            <View style={styles.aboutItem}>
              <Text style={[styles.aboutLabel, { color: colors.text }]}>Made with</Text>
              <Text style={[styles.aboutValue, { color: colors.error }]}>love in Mauritius</Text>
            </View>
          </View>
        </View>

        {/* Logout Button */}
        <TouchableOpacity
          style={[styles.logoutButton, { backgroundColor: colors.error }]}
          onPress={handleLogout}
          activeOpacity={0.7}
        >
          <MaterialIcons name="logout" size={20} color="white" />
          <Text style={styles.logoutButtonText}>Log Out</Text>
        </TouchableOpacity>
      </ScrollView>
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  headerTitleContainer: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 8,
  },
  kipriLogo: {
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: 1,
  },
  headerSubtitle: {
    fontSize: 16,
    fontWeight: '500',
    opacity: 0.7,
  },
  mainScrollView: {
    flex: 1,
  },
  mainScrollContent: {
    paddingHorizontal: 16,
    paddingBottom: 120,
    gap: 16,
  },
  section: {
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 10,
  },
  sectionTitle: {
    flex: 1,
    fontSize: 16,
    fontWeight: '700',
  },
  sectionContent: {
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  userAvatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
  },
  userDetails: {
    flex: 1,
  },
  userPhone: {
    fontSize: 16,
    fontWeight: '600',
  },
  userLabel: {
    fontSize: 12,
    opacity: 0.6,
    marginTop: 2,
  },
  changeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    gap: 4,
  },
  changeButtonText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '600',
  },
  currentStoresGrid: {
    gap: 10,
  },
  currentStoreCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    gap: 12,
  },
  currentStorePriority: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  currentStorePriorityText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '800',
  },
  currentStoreIconBg: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  currentStoreIcon: {
    fontSize: 22,
  },
  currentStoreInfo: {
    flex: 1,
  },
  currentStoreName: {
    fontSize: 14,
    fontWeight: '700',
  },
  currentStoreChain: {
    fontSize: 12,
    opacity: 0.6,
    marginTop: 2,
  },
  noStoresContainer: {
    alignItems: 'center',
    paddingVertical: 20,
    gap: 12,
  },
  noStoresText: {
    fontSize: 14,
    opacity: 0.6,
  },
  selectStoresButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
  },
  selectStoresButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
  aboutItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  aboutLabel: {
    fontSize: 14,
    opacity: 0.7,
  },
  aboutValue: {
    fontSize: 14,
    fontWeight: '600',
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 16,
    gap: 8,
    marginTop: 8,
    shadowColor: '#EF4444',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  logoutButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '700',
  },
  // Edit mode styles
  editHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 16,
    gap: 12,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  editHeaderText: {
    flex: 1,
  },
  editTitle: {
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  editSubtitle: {
    fontSize: 13,
    opacity: 0.7,
    marginTop: 2,
  },
  counterBadge: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 16,
  },
  counterText: {
    fontSize: 14,
    fontWeight: '700',
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
  },
  loadingText: {
    fontSize: 16,
    fontWeight: '500',
  },
  selectedStoresContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    gap: 10,
    marginBottom: 16,
  },
  selectedSlot: {
    flex: 1,
    height: 80,
    borderRadius: 12,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
    paddingHorizontal: 4,
  },
  priorityBadge: {
    position: 'absolute',
    top: 4,
    left: 6,
    fontSize: 11,
    fontWeight: '800',
  },
  selectedSlotContent: {
    alignItems: 'center',
    gap: 4,
  },
  selectedSlotIcon: {
    fontSize: 24,
  },
  selectedSlotName: {
    fontSize: 11,
    fontWeight: '600',
    textAlign: 'center',
  },
  selectedSlotPlaceholder: {
    fontSize: 11,
    fontWeight: '500',
    opacity: 0.5,
    textAlign: 'center',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingBottom: 20,
  },
  storeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  storeCard: {
    width: '47%',
    paddingVertical: 16,
    paddingHorizontal: 12,
    borderRadius: 16,
    alignItems: 'center',
    position: 'relative',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 3,
  },
  checkmarkBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 22,
    height: 22,
    borderRadius: 11,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkmarkText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '800',
  },
  storeIconContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
  },
  storeIcon: {
    fontSize: 28,
  },
  storeName: {
    fontSize: 13,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 2,
  },
  storeDetails: {
    fontSize: 11,
    fontWeight: '500',
    opacity: 0.6,
    textAlign: 'center',
  },
  buttonContainer: {
    paddingHorizontal: 16,
    paddingBottom: 100,
    paddingTop: 8,
  },
  saveButton: {
    height: 56,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
  },
  saveButtonText: {
    fontSize: 17,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
});

export default SettingsScreen;
