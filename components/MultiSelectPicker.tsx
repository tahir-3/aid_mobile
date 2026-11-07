import { Ionicons } from '@expo/vector-icons';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { describeApiError } from '../lib/apiError';
import { useDebouncedValue } from '../lib/useDebouncedValue';
import type { OptionItem } from './FormComponents';
import { EnterView } from './motion/Enter';

const PAGE_SIZE = 30;

export interface MultiSelectPickerProps {
  visible: boolean;
  title: string;
  /** Items selected when the picker opens. */
  selected: OptionItem[];
  /** Loads one page of options matching `query` (name or ID). */
  loadPage: (query: string, offset: number, limit: number) => Promise<OptionItem[]>;
  onConfirm: (selected: OptionItem[]) => void;
  onClose: () => void;
}

/** Full-screen searchable multi-select with infinite scroll. */
export function MultiSelectPicker({
  visible,
  title,
  selected,
  loadPage,
  onConfirm,
  onClose,
}: MultiSelectPickerProps) {
  const [query, setQuery] = useState('');
  const debouncedQuery = useDebouncedValue(query.trim(), 300);
  const [items, setItems] = useState<OptionItem[]>([]);
  const [picked, setPicked] = useState<Map<string, OptionItem>>(new Map());
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestId = useRef(0);

  // Start from the current selection each time the picker opens.
  useEffect(() => {
    if (visible) {
      setPicked(new Map(selected.map((o) => [o.value, o])));
      setQuery('');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const loadFirst = useCallback(async () => {
    const id = ++requestId.current;
    setLoading(true);
    setError(null);
    try {
      const page = await loadPage(debouncedQuery, 0, PAGE_SIZE);
      if (id !== requestId.current) return;
      setItems(page);
      setHasMore(page.length === PAGE_SIZE);
    } catch (e) {
      if (id !== requestId.current) return;
      setItems([]);
      setHasMore(false);
      setError(describeApiError(e).message);
    } finally {
      if (id === requestId.current) setLoading(false);
    }
  }, [loadPage, debouncedQuery]);

  useEffect(() => {
    if (visible) loadFirst();
  }, [visible, loadFirst]);

  const loadMore = useCallback(async () => {
    if (loading || loadingMore || !hasMore) return;
    const id = requestId.current;
    setLoadingMore(true);
    try {
      const page = await loadPage(debouncedQuery, items.length, PAGE_SIZE);
      if (id !== requestId.current) return;
      setItems((prev) => [...prev, ...page]);
      setHasMore(page.length === PAGE_SIZE);
    } catch {
      setHasMore(false);
    } finally {
      setLoadingMore(false);
    }
  }, [loading, loadingMore, hasMore, loadPage, debouncedQuery, items.length]);

  const toggle = useCallback((item: OptionItem) => {
    setPicked((prev) => {
      const next = new Map(prev);
      if (next.has(item.value)) next.delete(item.value);
      else next.set(item.value, item);
      return next;
    });
  }, []);

  const allShownPicked = items.length > 0 && items.every((i) => picked.has(i.value));
  const toggleAllShown = () => {
    setPicked((prev) => {
      const next = new Map(prev);
      if (allShownPicked) items.forEach((i) => next.delete(i.value));
      else items.forEach((i) => next.set(i.value, i));
      return next;
    });
  };

  const renderItem = useCallback(
    ({ item, index }: { item: OptionItem; index: number }) => {
      const checked = picked.has(item.value);
      return (
        <EnterView index={index}>
        <TouchableOpacity
          activeOpacity={0.7}
          onPress={() => toggle(item)}
          className={`mb-2 flex-row-reverse items-center rounded-2xl border p-3 ${
            checked ? 'border-primary/50 bg-primary/10' : 'border-white/5 bg-surface'
          }`}>
          <Ionicons
            name={checked ? 'checkbox' : 'square-outline'}
            size={22}
            color={checked ? '#FF6F20' : '#64748B'}
          />
          <View className="mr-3 flex-1 items-end">
            <Text className="text-sm font-bold text-white" numberOfLines={1}>
              {item.label}
            </Text>
            {item.sub ? (
              <Text className="mt-0.5 text-xs text-slate-500" numberOfLines={1}>
                {item.sub}
              </Text>
            ) : null}
          </View>
        </TouchableOpacity>
        </EnterView>
      );
    },
    [picked, toggle]
  );

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView className="flex-1 bg-background">
        {/* Header */}
        <View className="flex-row items-center justify-between px-4 py-4">
          <TouchableOpacity
            onPress={onClose}
            className="h-10 w-10 items-center justify-center rounded-full bg-surface">
            <Ionicons name="close" size={22} color="white" />
          </TouchableOpacity>
          <Text className="text-lg font-bold text-white">{title}</Text>
          <View className="w-10" />
        </View>

        {/* Search */}
        <View className="mb-3 px-4">
          <View className="flex-row items-center rounded-xl border border-white/5 bg-surface px-3 py-1">
            <Ionicons name="search-outline" size={20} color="#94A3B8" />
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="ابحث بالاسم أو رقم الهوية..."
              placeholderTextColor="#94A3B8"
              className="flex-1 px-2 text-right text-white"
              autoCorrect={false}
            />
            {query.length > 0 && (
              <TouchableOpacity onPress={() => setQuery('')}>
                <Ionicons name="close-circle" size={18} color="#94A3B8" />
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Selection bar */}
        <View className="mb-2 flex-row-reverse items-center justify-between px-4">
          <Text className="text-xs text-slate-400">تم اختيار {picked.size}</Text>
          <View className="flex-row gap-4">
            {picked.size > 0 && (
              <TouchableOpacity onPress={() => setPicked(new Map())}>
                <Text className="text-xs font-bold text-red-400">إلغاء الكل</Text>
              </TouchableOpacity>
            )}
            {items.length > 0 && (
              <TouchableOpacity onPress={toggleAllShown}>
                <Text className="text-xs font-bold text-primary">
                  {allShownPicked ? 'إلغاء المعروض' : 'تحديد المعروض'}
                </Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        {loading ? (
          <View className="flex-1 items-center justify-center">
            <ActivityIndicator color="#FF6F20" size="large" />
          </View>
        ) : (
          <FlatList
            data={items}
            keyExtractor={(item) => item.value}
            renderItem={renderItem}
            extraData={picked}
            contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24 }}
            onEndReached={loadMore}
            onEndReachedThreshold={0.4}
            keyboardShouldPersistTaps="handled"
            ListFooterComponent={
              loadingMore ? (
                <View className="items-center py-4">
                  <ActivityIndicator color="#FF6F20" />
                </View>
              ) : null
            }
            ListEmptyComponent={
              <View className="mt-16 items-center px-6">
                <Ionicons
                  name={error ? 'cloud-offline-outline' : 'search-outline'}
                  size={44}
                  color="#475569"
                />
                <Text className="mt-3 text-center text-slate-500">
                  {error ?? (debouncedQuery ? 'لا توجد نتائج مطابقة' : 'لا توجد سجلات')}
                </Text>
                {error && (
                  <TouchableOpacity
                    onPress={loadFirst}
                    className="mt-4 rounded-full bg-primary px-6 py-2">
                    <Text className="font-bold text-white">إعادة المحاولة</Text>
                  </TouchableOpacity>
                )}
              </View>
            }
          />
        )}

        {/* Confirm */}
        <View className="border-t border-white/5 px-4 pb-4 pt-3">
          <TouchableOpacity
            onPress={() => {
              onConfirm([...picked.values()]);
              onClose();
            }}
            className="h-14 items-center justify-center rounded-2xl bg-primary">
            <Text className="text-lg font-bold text-white">تأكيد الاختيار ({picked.size})</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </Modal>
  );
}
