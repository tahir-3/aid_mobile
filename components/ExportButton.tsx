import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import { ActivityIndicator, Alert, Text, TouchableOpacity } from 'react-native';

import { describeApiError } from '../lib/apiError';

/** "تصدير Excel" chip: runs `onExport`, shows progress and a readable error. */
export function ExportButton({
  onExport,
  label = 'تصدير Excel',
  compact = false,
}: {
  onExport: () => Promise<void>;
  label?: string;
  /** Icon-only round button (e.g. sheet header). */
  compact?: boolean;
}) {
  const [busy, setBusy] = useState(false);

  const run = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await onExport();
    } catch (e: any) {
      const info = describeApiError(e);
      const message = e?.response ? (info.detail ?? info.message) : (e?.message ?? info.message);
      Alert.alert('تعذر التصدير', message);
    } finally {
      setBusy(false);
    }
  };

  if (compact) {
    return (
      <TouchableOpacity
        onPress={run}
        disabled={busy}
        accessibilityLabel={label}
        className="h-9 w-9 items-center justify-center rounded-full bg-emerald-500/15">
        {busy ? (
          <ActivityIndicator size="small" color="#10B981" />
        ) : (
          <Ionicons name="download-outline" size={18} color="#10B981" />
        )}
      </TouchableOpacity>
    );
  }

  return (
    <TouchableOpacity
      onPress={run}
      disabled={busy}
      className="flex-row-reverse items-center rounded-full bg-emerald-500/15 px-3 py-1">
      {busy ? (
        <ActivityIndicator size="small" color="#10B981" />
      ) : (
        <Ionicons name="download-outline" size={13} color="#10B981" />
      )}
      <Text className="mr-1 text-xs font-bold text-emerald-400">
        {busy ? 'جاري التصدير...' : label}
      </Text>
    </TouchableOpacity>
  );
}
