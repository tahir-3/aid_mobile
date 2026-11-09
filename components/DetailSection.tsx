import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import type React from 'react';
import { Pressable, Text, View } from 'react-native';

import { FadeInView } from './motion/FadeInView';

type IconName = React.ComponentProps<typeof Ionicons>['name'];

const isEmpty = (v: unknown) => v === null || v === undefined || v === '';

/** Icon for common field keys, so screens don't repeat the mapping. */
const FIELD_ICONS: Record<string, IconName> = {
  full_name: 'person-outline',
  id_no: 'card-outline',
  gender: 'male-female-outline',
  date_of_birth: 'calendar-outline',
  age: 'time-outline',
  marital_status: 'heart-outline',
  number_of_family_members: 'people-outline',
  family_members_count: 'people-outline',
  occupation: 'briefcase-outline',
  employer: 'business-outline',
  branch: 'business-outline',
  masjed: 'home-outline',
  closest_masjed: 'home-outline',
  jawwal_no: 'call-outline',
  ooredoo_no: 'call-outline',
  address: 'location-outline',
  current_address: 'location-outline',
  current_address_details: 'map-outline',
  prev_adderss: 'location-outline',
  displaced_resident: 'navigate-outline',
  displaced_area: 'location-outline',
  nature_of_approval: 'document-text-outline',
  accommodation_name: 'home-outline',
  bank_type: 'wallet-outline',
  type_of_bank: 'wallet-outline',
  bank_name: 'business-outline',
  account_number: 'card-outline',
  bank_account: 'card-outline',
};

/** Icon for a field: explicit map, then a guess from the key, then the fallback. */
export function fieldIcon(key: string, fallback: IconName = 'ellipse-outline'): IconName {
  if (FIELD_ICONS[key]) return FIELD_ICONS[key];
  if (key.includes('date')) return 'calendar-outline';
  if (key.includes('jawwal') || key.includes('phone')) return 'call-outline';
  if (key.endsWith('id_no')) return 'card-outline';
  if (key.endsWith('full_name')) return 'person-outline';
  return fallback;
}

const copy = async (value: string) => {
  if (value) await Clipboard.setStringAsync(value);
};

/**
 * One label/value row. Icon and label sit on the right (RTL), value on the left.
 * Tap copies the value. Pass `children` to render a custom value (e.g. a status chip).
 */
export function DetailRow({
  label,
  value,
  icon,
  last,
  children,
}: {
  label: string;
  value?: unknown;
  icon: IconName;
  last?: boolean;
  children?: React.ReactNode;
}) {
  if (!children && isEmpty(value)) return null;
  const text = isEmpty(value) ? '' : String(value);
  return (
    <Pressable
      onPress={() => copy(text)}
      accessibilityHint="اضغط لنسخ القيمة"
      className={`flex-row-reverse items-center py-3 active:opacity-70 ${
        last ? '' : 'border-b border-white/5'
      }`}>
      <View className="h-8 w-8 items-center justify-center rounded-xl bg-white/5">
        <Ionicons name={icon} size={16} color="#94A3B8" />
      </View>
      <Text className="mr-3 max-w-[45%] text-right text-sm text-slate-400">{label}</Text>
      <View className="mr-4 flex-1 items-start">
        {children ?? (
          <Text className="text-left text-sm font-semibold text-white" selectable>
            {text}
          </Text>
        )}
      </View>
    </Pressable>
  );
}

/** Titled card holding detail rows. */
export function DetailSection({
  title,
  icon,
  color = '#3B82F6',
  delay = 0,
  children,
}: {
  title: string;
  icon: IconName;
  color?: string;
  delay?: number;
  children: React.ReactNode;
}) {
  return (
    <FadeInView delay={delay} className="mb-5">
      <View className="mb-3 flex-row-reverse items-center px-1">
        <View
          className="h-8 w-8 items-center justify-center rounded-xl"
          style={{ backgroundColor: `${color}1A` }}>
          <Ionicons name={icon} size={18} color={color} />
        </View>
        <Text className="mr-2.5 text-base font-bold text-white">{title}</Text>
      </View>
      <View className="rounded-3xl border border-white/5 bg-surface px-4 py-1">{children}</View>
    </FadeInView>
  );
}

export interface FieldSpec {
  key: string;
  label: string;
  icon?: IconName;
}

/** Section built from field specs; hidden when every field is empty. */
export function FieldsSection({
  title,
  icon,
  color,
  delay,
  fields,
  data,
  format,
}: {
  title: string;
  icon: IconName;
  color?: string;
  delay?: number;
  fields: FieldSpec[];
  data: Record<string, any>;
  /** Optional value formatter (e.g. count arrays, translate Select values). */
  format?: (key: string, value: unknown) => unknown;
}) {
  const rows = fields
    .map((f) => ({ ...f, value: format ? format(f.key, data[f.key]) : data[f.key] }))
    .filter((f) => !isEmpty(f.value));
  if (rows.length === 0) return null;
  return (
    <DetailSection title={title} icon={icon} color={color} delay={delay}>
      {rows.map((f, i) => (
        <DetailRow
          key={f.key}
          label={f.label}
          value={f.value}
          icon={f.icon ?? fieldIcon(f.key, icon)}
          last={i === rows.length - 1}
        />
      ))}
    </DetailSection>
  );
}
