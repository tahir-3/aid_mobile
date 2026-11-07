import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
  ScrollView,
  Keyboard,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuthStore } from '../store/authStore';
import { describeApiError, frappeMessage } from '../lib/apiError';
import { useSyncStore } from '../store/syncStore';

/** Arabic message for a failed login request. */
function loginErrorMessage(err: any): string {
  const info = describeApiError(err);
  if (info.kind === 'network') return info.message;
  if (info.status === 429)
    return 'محاولات تسجيل دخول كثيرة. يرجى الانتظار قليلاً ثم المحاولة مجدداً.';
  if (info.status === 401) {
    const detail = frappeMessage(err?.response?.data) ?? '';
    if (/disabled/i.test(detail)) return 'هذا الحساب معطل. تواصل مع مسؤول النظام.';
    if (/not allowed at this time/i.test(detail)) return 'تسجيل الدخول غير مسموح في هذا الوقت.';
    if (/locked/i.test(detail)) return 'تم قفل الحساب مؤقتاً بسبب محاولات فاشلة متكررة.';
    if (/ip address/i.test(detail)) return 'تسجيل الدخول غير مسموح من هذا الموقع.';
    return 'خطأ في اسم المستخدم أو كلمة المرور';
  }
  return info.detail ?? info.message;
}

export default function Login() {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const signIn = useAuthStore((s) => s.signIn);

  const handleLogin = async () => {
    if (!username.trim() || !password) {
      Alert.alert('خطأ', 'يرجى إدخال اسم المستخدم وكلمة المرور');
      return;
    }

    setLoading(true);
    try {
      await signIn(username, password);
    } catch (error: any) {
      console.warn('Login failed:', describeApiError(error));
      Alert.alert('فشل تسجيل الدخول', loginErrorMessage(error));
      setLoading(false);
      return;
    }
    // Enter the app immediately; data downloads in the background and the
    // dashboard shows the progress (see store/syncStore.ts).
    useSyncStore.getState().startInitialSync();
    router.replace('/(tabs)');
  };

  return (
    <SafeAreaView className="flex-1 bg-background">
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'padding'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 60}
        className="flex-1">
        <ScrollView
          contentContainerStyle={{ flexGrow: 1, justifyContent: 'center' }}
          keyboardShouldPersistTaps="always"
          keyboardDismissMode="on-drag"
          className="px-6"
          onScrollBeginDrag={Keyboard.dismiss}>
          <View className="mb-12 items-center">
            <View className="mb-4 h-60 w-60 items-center justify-center overflow-hidden rounded-3xl">
              <Image
                source={require('../assets/icon.png')}
                className="h-full w-full"
                resizeMode="contain"
              />
            </View>
            <Text className="mb-2 text-3xl font-bold text-white">بيانات سكان منطقة مشروع عامر</Text>
          </View>

          <View className="space-y-4">
            <View className="flex-row-reverse items-center rounded-2xl border border-white/15 bg-surface px-4 py-1">
              <Ionicons name="person-outline" size={20} color="#94A3B8" />
              <TextInput
                placeholder="اسم المستخدم"
                placeholderTextColor="#64748B"
                className="flex-1 px-3 py-4 text-right text-white"
                value={username}
                onChangeText={setUsername}
                autoCapitalize="none"
                autoCorrect={false}
                editable={!loading}
              />
            </View>

            <View className="mt-4 flex-row-reverse items-center rounded-2xl border border-white/15 bg-surface px-4 py-1">
              <Ionicons name="lock-closed-outline" size={20} color="#94A3B8" />
              <TextInput
                placeholder="كلمة المرور"
                placeholderTextColor="#64748B"
                className="flex-1 px-3 py-4 text-right text-white"
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                editable={!loading}
              />
            </View>

            <TouchableOpacity
              activeOpacity={0.8}
              onPress={handleLogin}
              disabled={loading}
              className={`mt-8 h-14 items-center justify-center rounded-2xl bg-primary shadow-lg shadow-primary/40 ${loading ? 'opacity-70' : ''}`}>
              {loading ? (
                <ActivityIndicator color="white" />
              ) : (
                <Text className="text-lg font-bold text-white">دخول</Text>
              )}
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
