import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
    View,
    Text,
    TouchableOpacity,
    ScrollView,
    ActivityIndicator,
    Alert,
    StyleSheet,
    Animated,
} from 'react-native';
import MapView, { Marker, Region } from 'react-native-maps';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useColorScheme } from '../hooks/useColorScheme';
import { Colors } from '../constants/Colors';
import StoreService from '../services/StoreService';
import { useStorePreferences } from '../contexts/StorePreferencesContext';
import { Store } from '../types';

interface StoreSelectionScreenProps {
    onComplete: () => void;
}

/** Initial region showing the north of Mauritius where the stores are. */
const MAURITIUS_REGION: Region = {
    latitude: -20.025,
    longitude: 57.62,
    latitudeDelta: 0.12,
    longitudeDelta: 0.12,
};

// ─── Component ───────────────────────────────────────────────

const StoreSelectionScreen = ({ onComplete }: StoreSelectionScreenProps) => {
    const insets = useSafeAreaInsets();
    const colorScheme = useColorScheme();
    const colors = Colors[colorScheme ?? 'light'];
    const { saveStorePreferences } = useStorePreferences();
    const mapRef = useRef<MapView>(null);

    const [selectedIds, setSelectedIds] = useState<string[]>([]);
    const [stores, setStores] = useState<Store[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);

    // Floating info card — shown when a marker is tapped
    const [focusedStoreId, setFocusedStoreId] = useState<string | null>(null);
    const infoCardOpacity = useRef(new Animated.Value(0)).current;

    // Toast state
    const [toastMsg, setToastMsg] = useState<string | null>(null);
    const toastOpacity = useRef(new Animated.Value(0)).current;

    // ── Fetch stores from database ──────────────────────────
    useEffect(() => {
        (async () => {
            try {
                setIsLoading(true);
                const dbStores = await StoreService.getInstance().getAllStores();
                // Only show stores that have coordinates
                const withCoords = dbStores.filter(s => s.latitude != null && s.longitude != null);
                setStores(withCoords);

                // Fit the map so every pin is visible
                if (withCoords.length > 0 && mapRef.current) {
                    setTimeout(() => {
                        mapRef.current?.fitToCoordinates(
                            withCoords.map(s => ({ latitude: s.latitude!, longitude: s.longitude! })),
                            { edgePadding: { top: 150, right: 60, bottom: 280, left: 60 }, animated: false },
                        );
                    }, 500);
                }
            } catch (error) {
                console.error('Error fetching stores:', error);
                Alert.alert('Error', 'Failed to load stores. Please try again.');
            } finally {
                setIsLoading(false);
            }
        })();
    }, []);

    // ── Toast helper ────────────────────────────────────────
    const showToast = (message: string) => {
        setToastMsg(message);
        toastOpacity.setValue(0);
        Animated.sequence([
            Animated.timing(toastOpacity, { toValue: 1, duration: 200, useNativeDriver: true }),
            Animated.delay(2000),
            Animated.timing(toastOpacity, { toValue: 0, duration: 300, useNativeDriver: true }),
        ]).start(() => setToastMsg(null));
    };

    // ── Show floating info card ──────────────────────────────
    const showInfoCard = useCallback((storeId: string) => {
        setFocusedStoreId(storeId);
        infoCardOpacity.setValue(0);
        Animated.timing(infoCardOpacity, {
            toValue: 1,
            duration: 200,
            useNativeDriver: true,
        }).start();
    }, [infoCardOpacity]);

    const hideInfoCard = useCallback(() => {
        Animated.timing(infoCardOpacity, {
            toValue: 0,
            duration: 150,
            useNativeDriver: true,
        }).start(() => setFocusedStoreId(null));
    }, [infoCardOpacity]);

    // ── Selection logic ─────────────────────────────────────
    const handleMarkerPress = (storeId: string) => {
        // Show info card
        showInfoCard(storeId);

        // Toggle selection
        if (selectedIds.includes(storeId)) {
            setSelectedIds(prev => prev.filter(id => id !== storeId));
        } else if (selectedIds.length < 3) {
            setSelectedIds(prev => [...prev, storeId]);
        } else {
            showToast('You can only select 3 stores. Deselect one first.');
        }
    };

    const handleMapPress = () => {
        if (focusedStoreId) {
            hideInfoCard();
        }
    };

    const handleRemoveChip = (storeId: string) => {
        setSelectedIds(prev => prev.filter(id => id !== storeId));
    };

    // ── Save & continue ─────────────────────────────────────
    const handleContinue = async () => {
        if (selectedIds.length !== 3) return;
        try {
            setIsSaving(true);
            const success = await saveStorePreferences(selectedIds);
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

    // ── Derived data ────────────────────────────────────────
    const selectedStores: Store[] = selectedIds
        .map(id => stores.find(s => s.id === id))
        .filter((s): s is Store => !!s);

    const focusedStore = focusedStoreId
        ? stores.find(s => s.id === focusedStoreId) ?? null
        : null;

    const isFocusedSelected = focusedStoreId ? selectedIds.includes(focusedStoreId) : false;

    // ── Loading state ───────────────────────────────────────
    if (isLoading) {
        return (
            <View style={[styles.loadingContainer, { backgroundColor: colors.background }]}>
                <ActivityIndicator size="large" color={colors.primary} />
                <Text style={[styles.loadingText, { color: colors.text }]}>
                    Loading stores...
                </Text>
            </View>
        );
    }

    // ── Main render ─────────────────────────────────────────
    return (
        <View style={styles.container}>
            {/* ── Full-screen map (NO Callouts — prevents iOS crash) */}
            <MapView
                ref={mapRef}
                style={styles.map}
                initialRegion={MAURITIUS_REGION}
                showsUserLocation={false}
                showsMyLocationButton={false}
                toolbarEnabled={false}
                onPress={handleMapPress}
            >
                {stores.map(store => {
                    const isSelected = selectedIds.includes(store.id);
                    return (
                        <Marker
                            key={store.id}
                            coordinate={{
                                latitude: store.latitude!,
                                longitude: store.longitude!,
                            }}
                            pinColor={isSelected ? '#22C55E' : '#EF4444'}
                            onPress={() => handleMarkerPress(store.id)}
                            tracksViewChanges={false}
                            zIndex={isSelected ? 2 : 1}
                        />
                    );
                })}
            </MapView>

            {/* ── Floating header ────────────────────────── */}
            <View
                style={[styles.floatingHeader, { top: insets.top + 12 }]}
                pointerEvents="none"
            >
                <View style={[
                    styles.headerCard,
                    {
                        backgroundColor: colorScheme === 'dark'
                            ? 'rgba(30, 41, 59, 0.92)'
                            : 'rgba(255, 255, 255, 0.92)',
                    },
                ]}>
                    <Text style={[styles.headerTitle, { color: colors.primary }]}>
                        Choose Your Stores
                    </Text>
                    <Text style={[styles.headerSubtitle, { color: colors.text }]}>
                        Tap pins to select 3 stores to compare
                    </Text>
                </View>
            </View>

            {/* ── Floating info card (replaces Callout) ───── */}
            {focusedStore && (
                <Animated.View
                    style={[styles.infoCard, { opacity: infoCardOpacity }]}
                    pointerEvents="box-none"
                >
                    <View style={[
                        styles.infoCardInner,
                        {
                            backgroundColor: colorScheme === 'dark'
                                ? 'rgba(30, 41, 59, 0.95)'
                                : 'rgba(255, 255, 255, 0.95)',
                        },
                    ]}>
                        <View style={styles.infoCardContent}>
                            <Text style={[styles.infoCardTitle, { color: colors.text }]}>
                                {focusedStore.name}
                            </Text>
                            <Text style={[styles.infoCardSub, { color: colorScheme === 'dark' ? '#94A3B8' : '#64748B' }]}>
                                {focusedStore.chain}
                                {focusedStore.location ? ` \u2022 ${focusedStore.location}` : ''}
                            </Text>
                        </View>
                        <View style={[
                            styles.infoCardBadge,
                            { backgroundColor: isFocusedSelected ? '#22C55E' : '#94A3B8' },
                        ]}>
                            <Text style={styles.infoCardBadgeText}>
                                {isFocusedSelected ? 'Selected' : 'Tap pin'}
                            </Text>
                        </View>
                    </View>
                </Animated.View>
            )}

            {/* ── Toast message ──────────────────────────── */}
            {toastMsg && (
                <Animated.View
                    style={[styles.toast, { opacity: toastOpacity }]}
                    pointerEvents="none"
                >
                    <Text style={styles.toastText}>{toastMsg}</Text>
                </Animated.View>
            )}

            {/* ── Bottom bar ─────────────────────────────── */}
            <View style={[
                styles.bottomBar,
                {
                    paddingBottom: Math.max(insets.bottom, 16),
                    backgroundColor: colorScheme === 'dark' ? '#1E293B' : '#FFFFFF',
                    borderTopColor: colorScheme === 'dark' ? '#334155' : '#E2E8F0',
                },
            ]}>
                {/* Counter */}
                <Text style={[styles.counter, { color: colors.text }]}>
                    {selectedIds.length}/3 stores selected
                </Text>

                {/* Chips */}
                {selectedStores.length > 0 && (
                    <ScrollView
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        style={styles.chipsRow}
                        contentContainerStyle={styles.chipsContent}
                    >
                        {selectedStores.map(store => (
                            <View
                                key={store.id}
                                style={[
                                    styles.chip,
                                    {
                                        backgroundColor: colors.primary + '15',
                                        borderColor: colors.primary + '30',
                                    },
                                ]}
                            >
                                <Text
                                    style={[styles.chipLabel, { color: colors.primary }]}
                                    numberOfLines={1}
                                >
                                    {store.name}
                                </Text>
                                <TouchableOpacity
                                    onPress={() => handleRemoveChip(store.id)}
                                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                                >
                                    <Text style={[styles.chipX, { color: colors.primary }]}>
                                        ✕
                                    </Text>
                                </TouchableOpacity>
                            </View>
                        ))}
                    </ScrollView>
                )}

                {/* Continue button — only when 3 selected */}
                {selectedIds.length === 3 && (
                    <TouchableOpacity
                        style={[styles.continueBtn, { backgroundColor: colors.primary }]}
                        onPress={handleContinue}
                        disabled={isSaving}
                        activeOpacity={0.8}
                    >
                        {isSaving ? (
                            <ActivityIndicator color="white" />
                        ) : (
                            <Text style={styles.continueTxt}>Continue</Text>
                        )}
                    </TouchableOpacity>
                )}
            </View>
        </View>
    );
};

// ─── Styles ──────────────────────────────────────────────────

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    map: {
        ...StyleSheet.absoluteFillObject,
    },

    // Loading
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

    // Floating header
    floatingHeader: {
        position: 'absolute',
        left: 20,
        right: 20,
        alignItems: 'center',
    },
    headerCard: {
        paddingHorizontal: 24,
        paddingVertical: 14,
        borderRadius: 16,
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.12,
        shadowRadius: 8,
        elevation: 5,
    },
    headerTitle: {
        fontSize: 20,
        fontWeight: '800',
        letterSpacing: 0.5,
    },
    headerSubtitle: {
        fontSize: 13,
        fontWeight: '500',
        opacity: 0.7,
        marginTop: 3,
    },

    // Floating info card (replaces native Callout)
    infoCard: {
        position: 'absolute',
        top: '42%',
        left: 24,
        right: 24,
        alignItems: 'center',
    },
    infoCardInner: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderRadius: 14,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 10,
        elevation: 8,
        gap: 12,
    },
    infoCardContent: {
        flex: 1,
    },
    infoCardTitle: {
        fontSize: 15,
        fontWeight: '700',
    },
    infoCardSub: {
        fontSize: 12,
        fontWeight: '500',
        marginTop: 2,
    },
    infoCardBadge: {
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 10,
    },
    infoCardBadgeText: {
        color: '#FFFFFF',
        fontSize: 11,
        fontWeight: '700',
    },

    // Toast
    toast: {
        position: 'absolute',
        top: '45%',
        left: 40,
        right: 40,
        backgroundColor: 'rgba(0, 0, 0, 0.82)',
        paddingHorizontal: 20,
        paddingVertical: 14,
        borderRadius: 14,
        alignItems: 'center',
    },
    toastText: {
        color: '#FFFFFF',
        fontSize: 14,
        fontWeight: '600',
        textAlign: 'center',
    },

    // Bottom bar
    bottomBar: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        paddingTop: 16,
        paddingHorizontal: 20,
        borderTopWidth: 1,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -3 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
        elevation: 10,
    },
    counter: {
        fontSize: 15,
        fontWeight: '700',
        textAlign: 'center',
        marginBottom: 12,
    },

    // Chips
    chipsRow: {
        marginBottom: 14,
    },
    chipsContent: {
        flexDirection: 'row',
        gap: 8,
    },
    chip: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 14,
        paddingVertical: 8,
        borderRadius: 20,
        borderWidth: 1,
        gap: 8,
    },
    chipLabel: {
        fontSize: 13,
        fontWeight: '600',
        maxWidth: 150,
    },
    chipX: {
        fontSize: 14,
        fontWeight: '700',
    },

    // Continue button
    continueBtn: {
        height: 52,
        borderRadius: 14,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 4,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 8,
        elevation: 4,
    },
    continueTxt: {
        color: '#FFFFFF',
        fontSize: 17,
        fontWeight: '800',
        letterSpacing: 0.5,
    },
});

export default StoreSelectionScreen;
