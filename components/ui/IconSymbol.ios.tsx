import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { SymbolView, SymbolViewProps, SymbolWeight } from 'expo-symbols';
import { ComponentProps } from 'react';
import { StyleProp, ViewStyle, OpaqueColorValue } from 'react-native';

// Mapping SF Symbol names to Material Icons for fallback
// Some SF Symbol names don't exist or have issues on certain iOS versions
type IconMapping = Record<string, ComponentProps<typeof MaterialIcons>['name']>;

const SF_TO_MATERIAL_FALLBACK: IconMapping = {
  'photo.camera.fill': 'photo-camera', // photo.camera.fill doesn't exist in SF Symbols
};

// Known working SF Symbols
const VALID_SF_SYMBOLS = [
  'house.fill',
  'tag.fill',
  'bag.fill',
  'bookmark.fill',
  'bookmark',
  'camera.fill',
  'qrcode',
  'chevron.right',
  'chevron.left.forwardslash.chevron.right',
  'paperplane.fill',
];

export function IconSymbol({
  name,
  size = 24,
  color,
  style,
  weight = 'regular',
}: {
  name: SymbolViewProps['name'] | string;
  size?: number;
  color: string | OpaqueColorValue;
  style?: StyleProp<ViewStyle>;
  weight?: SymbolWeight;
}) {
  // Check if this symbol needs a fallback to Material Icons
  const fallbackIcon = SF_TO_MATERIAL_FALLBACK[name as string];

  if (fallbackIcon) {
    // Use Material Icons as fallback for problematic SF Symbols
    return (
      <MaterialIcons
        name={fallbackIcon}
        size={size}
        color={color as string}
        style={style as any}
      />
    );
  }

  // Use native SF Symbols for valid symbols
  return (
    <SymbolView
      weight={weight}
      tintColor={color as string}
      resizeMode="scaleAspectFit"
      name={name as SymbolViewProps['name']}
      style={[
        {
          width: size,
          height: size,
        },
        style,
      ]}
    />
  );
}
