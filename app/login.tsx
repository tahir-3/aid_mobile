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
import { loginToFrappe } from '../lib/api';
import { performInitialSync } from '../lib/sync';

export default function Login() {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [syncMessage, setSyncMessage] = useState('');
  const { setTokens } = useAuthStore();

  const handleLogin = async () => {
    if (!username || !password) {
      Alert.alert('خطأ', 'يرجى إدخال اسم المستخدم وكلمة المرور');
      return;
    }

    setLoading(true);
    try {
      const data = await loginToFrappe(username, password);

      if (data.access_token && data.refresh_token) {
        await setTokens(data.access_token, data.refresh_token, data.user ?? undefined);

        // Now fetch and cache all doctype records for offline use
        setSyncMessage('جاري تحميل البيانات...');
        await performInitialSync((progress, message) => {
          setSyncMessage(message);
        });

        router.replace('/(tabs)');
      } else {
        throw new Error('Invalid response from server');
      }
    } catch (error: any) {
      console.error(error);
      Alert.alert('فشل تسجيل الدخول', 'خطأ في اسم المستخدم أو كلمة المرور');
    } finally {
      setLoading(false);
      setSyncMessage('');
    }
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

              {/* Sync progress message */}
              {loading && syncMessage ? (
                <View className="mt-3 flex-row items-center justify-center">
                  <Text className="text-center text-sm text-slate-400">{syncMessage}</Text>
                </View>
              ) : null}
            </View>
          </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
