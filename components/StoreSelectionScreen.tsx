import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    TouchableOpacity,
    ScrollView,
    ActivityIndicator,
    Alert,
    StyleSheet,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useColorScheme } from '../hooks/useColorScheme';
import { Colors } from '../constants/Colors';
import StoreService from '../services/StoreService';
import { useStorePreferences } from '../contexts/StorePreferencesContext';
import { Store } from '../types';

interface StoreSelectionScreenProps {
    onComplete: () => void;
}

const StoreSelectionScreen = ({ onComplete }: StoreSelectionScreenProps) => {
    const insets = useSafeAreaInsets();
    const colorScheme = useColorScheme();
    const colors = Colors[colorScheme ?? 'light'];
    const { saveStorePreferences } = useStorePreferences();

    const [selectedStoreIds, setSelectedStoreIds] = useState<string[]>([]);
    const [availableStores, setAvailableStores] = useState<Store[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        const fetchStores = async () => {
            try {
                setIsLoading(true);
                const stores = await StoreService.getInstance().getAllStores();
                setAvailableStores(stores);
            } catch (error) {
                console.error('Error fetching stores:', error);
                Alert.alert('Error', 'Failed to load stores. Please try again.');
            } finally {
                setIsLoading(false);
            }
        };

        fetchStores();
    }, []);

    const handleStorePress = (storeId: string) => {
        if (selectedStoreIds.includes(storeId)) {
            // Remove from selection
            setSelectedStoreIds(prev => prev.filter(id => id !== storeId));
        } else if (selectedStoreIds.length < 3) {
            // Add to selection
            setSelectedStoreIds(prev => [...prev, storeId]);
        } else {
            // Already have 3 selected
            Alert.alert(
                'Maximum Reached',
                'You can only select 3 stores. Unselect one first.'
            );
        }
    };

    const handleConfirm = async () => {
        if (selectedStoreIds.length !== 3) {
            Alert.alert('Selection Required', 'Please select exactly 3 stores to continue.');
            return;
        }

        try {
            setIsSaving(true);
            const success = await saveStorePreferences(selectedStoreIds);

            if (success) {
                onComplete();
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

    const getSelectedStore = (index: number): Store | null => {
        const storeId = selectedStoreIds[index];
        if (!storeId) return null;
        return availableStores.find(s => s.id === storeId) || null;
    };

    const renderSelectedSlot = (index: number) => {
        const store = getSelectedStore(index);
        const priority = index + 1;

        return (
            <View
                key={`slot-${index}`}
                style={[
                    styles.selectedSlot,
                    {
                        backgroundColor: store
                            ? store.color + '20'
                            : colorScheme === 'dark' ? '#334155' : '#F1F5F9',
                        borderColor: store
                            ? store.color
                            : colorScheme === 'dark' ? '#475569' : '#E2E8F0',
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
        const isSelected = selectedStoreIds.includes(store.id);
        const selectionIndex = selectedStoreIds.indexOf(store.id);

        return (
            <TouchableOpacity
                key={store.id}
                style={[
                    styles.storeCard,
                    {
                        backgroundColor: colorScheme === 'dark' ? '#1E293B' : '#FFFFFF',
                        borderColor: isSelected ? store.color : (colorScheme === 'dark' ? '#334155' : '#E2E8F0'),
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

    if (isLoading) {
        return (
            <LinearGradient
                colors={colorScheme === 'dark' ? ['#0F172A', '#1E293B'] : ['#F8FAFC', '#F1F5F9']}
                style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}
            >
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color={colors.primary} />
                    <Text style={[styles.loadingText, { color: colors.text }]}>
                        Loading stores...
                    </Text>
                </View>
            </LinearGradient>
        );
    }

    return (
        <LinearGradient
            colors={colorScheme === 'dark' ? ['#0F172A', '#1E293B'] : ['#F8FAFC', '#F1F5F9']}
            style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}
        >
            <View style={styles.content}>
                {/* Header Section */}
                <View style={styles.header}>
                    <Text style={[styles.title, { color: colors.primary }]}>
                        Choose Your Stores
                    </Text>
                    <Text style={[styles.subtitle, { color: colors.text }]}>
                        Select exactly 3 supermarkets to compare prices
                    </Text>
                    <View style={[styles.counterBadge, { backgroundColor: colors.primary + '20' }]}>
                        <Text style={[styles.counterText, { color: colors.primary }]}>
                            {selectedStoreIds.length}/3 selected
                        </Text>
                    </View>
                </View>

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

                {/* Confirm Button */}
                <TouchableOpacity
                    style={[
                        styles.confirmButton,
                        {
                            backgroundColor: selectedStoreIds.length === 3
                                ? colors.primary
                                : colorScheme === 'dark' ? '#334155' : '#CBD5E1',
                        },
                    ]}
                    onPress={handleConfirm}
                    disabled={selectedStoreIds.length !== 3 || isSaving}
                    activeOpacity={0.8}
                >
                    {isSaving ? (
                        <ActivityIndicator color="white" />
                    ) : (
                        <Text
                            style={[
                                styles.confirmButtonText,
                                {
                                    color: selectedStoreIds.length === 3
                                        ? 'white'
                                        : colorScheme === 'dark' ? '#64748B' : '#94A3B8',
                                },
                            ]}
                        >
                            Continue
                        </Text>
                    )}
                </TouchableOpacity>
            </View>
        </LinearGradient>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    content: {
        flex: 1,
        paddingHorizontal: 20,
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        gap: 16,
    },
    loadingText: {
        fontSize: 16,
        fontWeight: '500',
    },
    header: {
        alignItems: 'center',
        paddingTop: 24,
        paddingBottom: 16,
    },
    title: {
        fontSize: 28,
        fontWeight: '800',
        letterSpacing: 0.5,
        marginBottom: 8,
    },
    subtitle: {
        fontSize: 15,
        fontWeight: '500',
        opacity: 0.7,
        textAlign: 'center',
        marginBottom: 12,
    },
    counterBadge: {
        paddingHorizontal: 16,
        paddingVertical: 6,
        borderRadius: 20,
    },
    counterText: {
        fontSize: 14,
        fontWeight: '700',
    },
    selectedStoresContainer: {
        flexDirection: 'row',
        gap: 10,
        marginBottom: 20,
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
    confirmButton: {
        height: 56,
        borderRadius: 16,
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: 12,
        marginBottom: 16,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 8,
        elevation: 4,
    },
    confirmButtonText: {
        fontSize: 17,
        fontWeight: '800',
        letterSpacing: 0.5,
    },
});

export default StoreSelectionScreen;
