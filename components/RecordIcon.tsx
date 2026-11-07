import { FontAwesome5, Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import React from 'react';
import type { StyleProp, TextStyle } from 'react-native';

import type { RecordTypeKey } from '../lib/records';

/**
 * Icon of a person type (recipients / wounded / martyrs / prisoners), used for its tab, list
 * header, cards, details screen and dashboard tile so they always match.
 * FontAwesome glyphs look larger than MaterialCommunityIcons at the same size,
 * hence the per-icon scale.
 */
export function RecordIcon({
  type,
  size,
  color,
  style,
}: {
  type: RecordTypeKey | 'recipients';
  size: number;
  color: string;
  style?: StyleProp<TextStyle>;
}) {
  switch (type) {
    case 'recipients':
      return <Ionicons name="people" size={size} color={color} style={style} />;
    case 'wounded':
      return (
        <FontAwesome5
          name="user-injured"
          size={Math.round(size * 0.9)}
          color={color}
          style={style}
        />
      );
    case 'martyrs':
      return <MaterialCommunityIcons name="flower-tulip" size={size} color={color} style={style} />;
    case 'prisoners':
      return <MaterialCommunityIcons name="handcuffs" size={size} color={color} style={style} />;
  }
}
