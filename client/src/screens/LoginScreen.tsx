// client/src/screens/LoginScreen.tsx
// Purpose: Real signup/login screen backed by server sessions.

import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, ActivityIndicator, Alert } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../App';
import { useAuth } from '../context/AuthContext';

type Props = NativeStackScreenProps<RootStackParamList, 'Login'>;

const LoginScreen: React.FC<Props> = ({ navigation }) => {
  const { signIn, signUp } = useAuth();
  const [displayName, setDisplayName] = useState('');
  const [password, setPassword] = useState('');
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    setLoading(true);
    try {
      if (mode === 'login') await signIn(displayName, password);
      else await signUp(displayName, password);
    } catch (error) {
      Alert.alert('Authentication failed', error instanceof Error ? error.message : 'Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Golf 9</Text>
      <Text style={styles.subtitle}>{mode === 'login' ? 'Sign in to continue' : 'Create your player profile'}</Text>
      <TextInput style={styles.input} placeholder="Display name" placeholderTextColor="#9BA3C7" value={displayName} onChangeText={setDisplayName} autoCapitalize="none" />
      <TextInput style={styles.input} placeholder="Password" placeholderTextColor="#9BA3C7" value={password} onChangeText={setPassword} secureTextEntry />
      <TouchableOpacity style={styles.button} onPress={submit} disabled={loading}>
        {loading ? <ActivityIndicator color="#0B1023" /> : <Text style={styles.buttonText}>{mode === 'login' ? 'Log In' : 'Sign Up'}</Text>}
      </TouchableOpacity>
      <TouchableOpacity onPress={() => setMode(mode === 'login' ? 'signup' : 'login')}>
        <Text style={styles.link}>{mode === 'login' ? 'Need an account? Sign up' : 'Already have an account? Log in'}</Text>
      </TouchableOpacity>
      <TouchableOpacity onPress={() => navigation.navigate('Rules')}>
        <Text style={styles.link}>How to Play?</Text>
      </TouchableOpacity>
    </View>
  );
};

export default LoginScreen;

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0B1023', alignItems: 'center', justifyContent: 'center', padding: 24 },
  title: { fontSize: 48, fontWeight: 'bold', color: '#52E5A7', marginBottom: 8 },
  subtitle: { fontSize: 18, color: '#E8ECF1', marginBottom: 24 },
  input: { width: '100%', borderWidth: 1, borderColor: '#2A2F57', borderRadius: 12, color: '#E8ECF1', padding: 14, marginBottom: 12, backgroundColor: '#121737' },
  button: { backgroundColor: '#52E5A7', paddingVertical: 12, paddingHorizontal: 32, borderRadius: 8, marginBottom: 16, minWidth: 160, alignItems: 'center' },
  buttonText: { color: '#0B1023', fontSize: 18, fontWeight: 'bold' },
  link: { color: '#FFCC66', textDecorationLine: 'underline', fontSize: 16, marginTop: 12 },
});
