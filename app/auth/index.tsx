import React, { useState } from 'react';
import { View, Text, TextInput, Button, StyleSheet, Alert, ActivityIndicator, TouchableOpacity } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useAuth } from '@/hooks/useAuth';
import { Redirect } from 'expo-router';

export default function AuthScreen() {
  const { user, login, register, loading, error } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isRegistering, setIsRegistering] = useState(false);
  const [passwordVisible, setPasswordVisible] = useState(false);

  // If user is authenticated and not loading, redirect to main app
  if (user && !loading) {
    return <Redirect href="/(tabs)" />;
  }

  const handleAuth = async () => {
    if (!email || !password) {
      Alert.alert('Hata', 'Lütfen e-posta ve şifre girin.');
      return;
    }
    try {
      if (isRegistering) {
        await register(email, password);
        Alert.alert('Başarılı', 'Kayıt başarılı! Giriş yapabilirsiniz.');
        setIsRegistering(false); // Switch to login after successful registration
      } else {
        await login(email, password);
      }
    } catch (e: any) {
      Alert.alert('Kimlik Doğrulama Hatası', error || 'Bilinmeyen bir hata oluştu.');
      console.error('Authentication Error:', e);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{isRegistering ? 'Kayıt Ol' : 'Giriş Yap'}</Text>
      <TextInput
        style={styles.input}
        placeholder="E-posta"
        value={email}
        onChangeText={setEmail}
        keyboardType="email-address"
        autoCapitalize="none"
      />
      <View style={styles.passwordInputContainer}>
        <TextInput
          style={[styles.input, styles.passwordInput]}
          placeholder="Şifre"
          value={password}
          onChangeText={setPassword}
          secureTextEntry={!passwordVisible}
        />
        <TouchableOpacity
          style={styles.passwordToggle}
          onPress={() => setPasswordVisible(!passwordVisible)}
        >
          <MaterialIcons
            name={passwordVisible ? 'visibility' : 'visibility-off'}
            size={24}
            color="gray"
          />
        </TouchableOpacity>
      </View>
      {loading && <ActivityIndicator size="small" color="#0000ff" />}
      {error && <Text style={styles.errorText}>{error}</Text>}
      <Button title={isRegistering ? 'Kayıt Ol' : 'Giriş Yap'} onPress={handleAuth} disabled={loading} />
      <Button
        title={isRegistering ? 'Zaten hesabım var? Giriş Yap' : 'Hesabın yok mu? Kayıt Ol'}
        onPress={() => setIsRegistering(!isRegistering)}
        color="#841584"
        disabled={loading}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#f5f5f5',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 30,
    color: '#333',
  },
  input: {
    width: '100%',
    height: 50,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    paddingHorizontal: 15,
    marginBottom: 15,
    fontSize: 16,
  },
  passwordInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    marginBottom: 15,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    height: 50,
  },
  passwordInput: {
    flex: 1,
    height: 50,
    paddingHorizontal: 15,
    borderWidth: 0,
    marginBottom: 0,
  },
  passwordToggle: {
    padding: 10,
  },

  errorText: {
    color: 'red',
    marginBottom: 15,
    textAlign: 'center',
  },
});