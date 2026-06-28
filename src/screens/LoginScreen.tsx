import React, { useState } from 'react';
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Linking,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useAuth } from '../contexts/AuthContext';
import { Config } from '../config';

const VERSION = '0.1.0';

const C = {
  bg:      '#0a1628',
  card:    '#142b49',
  accent:  '#ba5663',
  border:  '#2a3f5f',
  text:    '#d0d0d0',
  muted:   '#85888e',
  input:   '#0e1e35',
  ms:      '#2f2f2f',
};

export function LoginScreen() {
  const { login } = useAuth();
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [error, setError]       = useState<string | null>(null);
  const [loading, setLoading]   = useState(false);
  const [msLoading, setMsLoading] = useState(false);
  const [showPw, setShowPw]     = useState(false);

  const handleLogin = async () => {
    if (!email.trim() || !password) {
      setError('Email and password are required.');
      return;
    }
    setError(null);
    setLoading(true);
    try {
      await login(email, password);
    } catch (err: any) {
      setError(err?.message ?? 'Login failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleMicrosoftSSO = async () => {
    setError(null);
    setMsLoading(true);
    try {
      const url = `${Config.BASE_URL}/api/ms-sso?redirect_uri=lorikeet%3A%2F%2Fauth%2Fcallback`;
      await Linking.openURL(url);
    } catch {
      setError('Could not open Microsoft sign-in. Please try again.');
    } finally {
      setMsLoading(false);
    }
  };

  return (
    <SafeAreaView style={s.safe}>
      <KeyboardAvoidingView
        style={s.kav}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>

        {/* Branding */}
        <View style={s.brand}>
          <Image
            source={require('../assets/ls_logo.png')}
            style={s.logo}
            resizeMode="contain"
          />
          <Text style={s.appName}>LS Phone</Text>
          <Text style={s.tagline}>v{VERSION}</Text>
        </View>

        {/* Card */}
        <View style={s.card}>
          <Text style={s.cardTitle}>Sign in</Text>

          <View style={s.field}>
            <Text style={s.label}>Email</Text>
            <TextInput
              style={s.input}
              value={email}
              onChangeText={setEmail}
              placeholder="you@example.com"
              placeholderTextColor={C.muted}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="next"
              editable={!loading && !msLoading}
            />
          </View>

          <View style={s.field}>
            <Text style={s.label}>Password</Text>
            <View style={s.pwWrap}>
              <TextInput
                style={[s.input, s.pwInput]}
                value={password}
                onChangeText={setPassword}
                placeholder="••••••••"
                placeholderTextColor={C.muted}
                secureTextEntry={!showPw}
                autoCapitalize="none"
                autoCorrect={false}
                returnKeyType="go"
                onSubmitEditing={handleLogin}
                editable={!loading && !msLoading}
              />
              <TouchableOpacity
                style={s.eyeBtn}
                onPress={() => setShowPw(v => !v)}
                accessibilityLabel={showPw ? 'Hide password' : 'Show password'}>
                <Icon
                  name={showPw ? 'eye-off' : 'eye'}
                  size={18}
                  color={C.muted}
                />
              </TouchableOpacity>
            </View>
          </View>

          {error ? <Text style={s.error}>{error}</Text> : null}

          <TouchableOpacity
            style={[s.btn, (loading || msLoading) && s.btnDisabled]}
            onPress={handleLogin}
            disabled={loading || msLoading}
            accessibilityLabel="Sign in">
            {loading
              ? <ActivityIndicator color="#fff" size="small" />
              : <Text style={s.btnText}>Sign in</Text>}
          </TouchableOpacity>

          {/* Divider */}
          <View style={s.divider}>
            <View style={s.divLine} />
            <Text style={s.divText}>or</Text>
            <View style={s.divLine} />
          </View>

          {/* Microsoft SSO */}
          <TouchableOpacity
            style={[s.msBtn, (loading || msLoading) && s.btnDisabled]}
            onPress={handleMicrosoftSSO}
            disabled={loading || msLoading}
            accessibilityLabel="Sign in with Microsoft">
            {msLoading ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <View style={s.msInner}>
                <Icon name="microsoft" size={18} color="#fff" style={s.msIcon} />
                <Text style={s.msBtnText}>Sign in with Microsoft</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>

      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bg },
  kav:  { flex: 1, justifyContent: 'center', paddingHorizontal: 24 },

  brand: { alignItems: 'center', marginBottom: 36 },
  logo: { width: 90, height: 90, marginBottom: 14 },
  appName:  { color: '#fff', fontSize: 26, fontWeight: '800', letterSpacing: 1 },
  tagline:  { color: C.muted, fontSize: 13, marginTop: 2 },

  card: {
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 16,
    padding: 24,
    gap: 16,
  },
  cardTitle: { color: '#fff', fontSize: 18, fontWeight: '700', marginBottom: 4 },

  field: { gap: 6 },
  label: { color: C.muted, fontSize: 12, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.6 },
  input: {
    backgroundColor: C.input,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: C.text,
    fontSize: 15,
  },

  pwWrap:  { position: 'relative' },
  pwInput: { paddingRight: 44 },
  eyeBtn: {
    position: 'absolute',
    right: 12,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
  },

  error: {
    color: '#ff6b7a',
    fontSize: 13,
    textAlign: 'center',
    marginTop: -4,
  },

  btn: {
    backgroundColor: C.accent,
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 4,
  },
  btnDisabled: { opacity: 0.6 },
  btnText: { color: '#fff', fontSize: 15, fontWeight: '700' },

  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginVertical: -4,
  },
  divLine: { flex: 1, height: 1, backgroundColor: C.border },
  divText: { color: C.muted, fontSize: 12 },

  msBtn: {
    backgroundColor: C.ms,
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#444',
  },
  msInner: { flexDirection: 'row', alignItems: 'center' },
  msIcon:  { marginRight: 8 },
  msBtnText: { color: '#fff', fontSize: 15, fontWeight: '600' },
});
