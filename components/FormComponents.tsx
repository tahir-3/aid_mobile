import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useMemo, useState } from 'react';
import { FlatList, Modal, Text, TextInput, TouchableOpacity, View } from 'react-native';

export interface OptionItem {
  label: string;
  value: string;
  sub?: string;
}

const DEBOUNCE_MS = 300;

/** Debounced search query for SearchPicker */
function useDebouncedValue<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return debounced;
}

export interface SearchPickerProps {
  title: string;
  visible: boolean;
  options: OptionItem[];
  onSelect: (item: OptionItem) => void;
  onClose: () => void;
}

const SearchPickerRow = React.memo(
  ({ item, onSelect }: { item: OptionItem; onSelect: (item: OptionItem) => void }) => (
    <TouchableOpacity
      onPress={() => onSelect(item)}
      className="flex-row items-center justify-between border-b border-white/5 px-5 py-4">
      <Ionicons name="chevron-back" size={16} color="#475569" />
      <View className="ml-4 flex-1 items-end">
        <Text className="text-sm font-bold text-white">{item.label}</Text>
        {item.sub && <Text className="text-xs text-slate-500">{item.sub}</Text>}
      </View>
    </TouchableOpacity>
  )
);

/** Searchable picker modal with debounced query. */
export const SearchPicker: React.FC<SearchPickerProps> = ({
  title,
  visible,
  options,
  onSelect,
  onClose,
}) => {
  const [q, setQ] = useState('');
  const debouncedQ = useDebouncedValue(q, DEBOUNCE_MS);

  const filtered = useMemo(() => {
    if (!debouncedQ.trim()) return options.slice(0, 20);
    const lower = debouncedQ.toLowerCase();
    return options
      .filter(
        (o) =>
          o.label.toLowerCase().includes(lower) ||
          o.sub?.toLowerCase().includes(lower) ||
          o.value?.toLowerCase().includes(lower)
      )
      .slice(0, 30);
  }, [debouncedQ, options]);

  const handleSelect = React.useCallback(
    (item: OptionItem) => {
      onSelect(item);
      setQ('');
      onClose();
    },
    [onSelect, onClose]
  );

  const renderItem = React.useCallback(
    ({ item }: { item: OptionItem }) => <SearchPickerRow item={item} onSelect={handleSelect} />,
    [handleSelect]
  );

  const reset = () => {
    setQ('');
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={reset} transparent>
      <View className="flex-1 bg-black/60">
        <View className="absolute bottom-0 left-0 right-0 rounded-t-3xl bg-background pb-8">
          <View className="mx-auto mt-3 h-1 w-12 rounded-full bg-white/20" />
          <View className="flex-row items-center justify-between px-5 py-4">
            <TouchableOpacity onPress={reset}>
              <Ionicons name="close" size={24} color="#94A3B8" />
            </TouchableOpacity>
            <Text className="text-base font-bold text-white">{title}</Text>
            <View className="w-6" />
          </View>
          <View className="mx-5 mb-3 flex-row items-center rounded-xl border border-white/10 bg-surface px-3 py-2">
            <Ionicons name="search-outline" size={18} color="#94A3B8" />
            <TextInput
              value={q}
              onChangeText={setQ}
              placeholder="بحث..."
              placeholderTextColor="#64748B"
              className="flex-1 px-2 text-right text-white"
              autoFocus
            />
          </View>
          <FlatList
            data={filtered}
            keyExtractor={(item) => item.value}
            style={{ maxHeight: 320 }}
            keyboardShouldPersistTaps="handled"
            renderItem={renderItem}
            ListEmptyComponent={
              <View className="items-center py-8">
                <Text className="text-slate-500">لا توجد نتائج</Text>
              </View>
            }
          />
        </View>
      </View>
    </Modal>
  );
};

export interface OptionsPickerProps {
  title: string;
  visible: boolean;
  options: string[];
  onSelect: (value: string) => void;
  onClose: () => void;
}

/** Simple options picker without search. */
export const OptionsPicker: React.FC<OptionsPickerProps> = ({
  title,
  visible,
  options,
  onSelect,
  onClose,
}) => (
  <Modal visible={visible} animationType="slide" onRequestClose={onClose} transparent>
    <View className="flex-1 bg-black/60">
      <View className="absolute bottom-0 left-0 right-0 rounded-t-3xl bg-background pb-8">
        <View className="mx-auto mt-3 h-1 w-12 rounded-full bg-white/20" />
        <View className="flex-row items-center justify-between px-5 py-4">
          <TouchableOpacity onPress={onClose}>
            <Ionicons name="close" size={24} color="#94A3B8" />
          </TouchableOpacity>
          <Text className="text-base font-bold text-white">{title}</Text>
          <View className="w-6" />
        </View>
        <FlatList
          data={options}
          keyExtractor={(item) => item}
          style={{ maxHeight: 320 }}
          renderItem={({ item }) => (
            <TouchableOpacity
              onPress={() => {
                onSelect(item);
                onClose();
              }}
              className="border-b border-white/5 px-5 py-4">
              <Text className="text-right text-sm text-white">{item}</Text>
            </TouchableOpacity>
          )}
        />
      </View>
    </View>
  </Modal>
);

export const RadioGroup = ({
  options,
  value,
  onChange,
  wrap,
}: {
  options: string[];
  value: string;
  onChange: (v: string) => void;
  wrap?: boolean;
}) => (
  <View className={`flex-row-reverse gap-3 ${wrap ? 'flex-wrap' : ''}`}>
    {options.map((opt) => (
      <TouchableOpacity
        key={opt}
        onPress={() => onChange(opt)}
        className={`flex-1 flex-row-reverse items-center justify-center rounded-2xl border px-4 py-3 ${
          value === opt ? 'border-primary bg-primary/10' : 'border-white/10 bg-surface'
        }`}>
        {/* Row is reversed (RTL): the circle sits right of the label, so the gap
            goes on its left side. */}
        <View
          className={`ml-3 h-4 w-4 rounded-full border-2 ${
            value === opt ? 'border-primary bg-primary' : 'border-slate-500'
          }`}
        />
        <Text className={`text-sm font-bold ${value === opt ? 'text-primary' : 'text-slate-400'}`}>
          {opt}
        </Text>
      </TouchableOpacity>
    ))}
  </View>
);

export const FieldLabel = ({ label, required }: { label: string; required?: boolean }) => (
  <Text className="mb-2 text-right text-sm font-bold text-slate-400">
    {label}
    {required && <Text className="text-primary"> *</Text>}
  </Text>
);

export const PickerButton = ({
  value,
  placeholder,
  onPress,
  error,
}: {
  value: string;
  placeholder: string;
  onPress: () => void;
  error?: boolean;
}) => (
  <TouchableOpacity
    onPress={onPress}
    className={`flex-row items-center justify-between rounded-2xl border px-4 py-4 ${
      error ? 'border-red-500/60 bg-red-900/10' : 'border-white/10 bg-surface'
    }`}>
    <Ionicons name="chevron-back" size={18} color="#475569" />
    <Text className={`text-right text-sm ${value ? 'text-white' : 'text-slate-500'}`}>
      {value || placeholder}
    </Text>
  </TouchableOpacity>
);
