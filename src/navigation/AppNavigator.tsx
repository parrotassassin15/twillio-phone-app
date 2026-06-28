import React, { useEffect, useRef } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  View,
} from 'react-native';
import { checkForUpdate } from '../services/updateService';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

import { useAuth } from '../contexts/AuthContext';
import { AgentProvider } from '../contexts/AgentContext';
import { CallProvider } from '../contexts/CallContext';
import { LoginScreen } from '../screens/LoginScreen';
import { DialerScreen } from '../screens/DialerScreen';
import { CallLogScreen } from '../screens/CallLogScreen';
import { ExtensionsScreen } from '../screens/ExtensionsScreen';
import { ContactsScreen } from '../screens/ContactsScreen';
import { SettingsScreen } from '../screens/SettingsScreen';

const COLORS = {
  bg:       '#0a1628',
  card:     '#142b49',
  accent:   '#ba5663',
  inactive: '#525252',
  border:   '#2a3f5f',
  text:     '#d0d0d0',
};

const Tab = createBottomTabNavigator();

function MainTabs() {
  return (
    <NavigationContainer>
      <Tab.Navigator
        screenOptions={({ route }) => ({
          tabBarIcon: ({ color, size }) => {
            const icons: Record<string, string> = {
              Dialer:     'dialpad',
              Calls:      'phone-log',
              Contacts:   'account-box-multiple-outline',
              Extensions: 'headset',
              Settings:   'cog-outline',
            };
            return <Icon name={icons[route.name] ?? 'circle'} size={size} color={color} />;
          },
          tabBarActiveTintColor:   COLORS.accent,
          tabBarInactiveTintColor: COLORS.inactive,
          tabBarStyle: {
            backgroundColor: COLORS.card,
            borderTopColor:  COLORS.border,
          },
          headerStyle:      { backgroundColor: COLORS.card },
          headerTintColor:  COLORS.text,
          headerTitleStyle: { color: COLORS.text, fontWeight: '700' },
        })}>
        <Tab.Screen name="Dialer"     component={DialerScreen} />
        <Tab.Screen name="Calls"      component={CallLogScreen} />
        <Tab.Screen name="Contacts"   component={ContactsScreen} />
        <Tab.Screen name="Extensions" component={ExtensionsScreen} />
        <Tab.Screen name="Settings"   component={SettingsScreen} />
      </Tab.Navigator>
    </NavigationContainer>
  );
}

export function AppNavigator() {
  const { token, isLoading } = useAuth();
  const updateChecked = useRef(false);

  useEffect(() => {
    if (updateChecked.current) return;
    updateChecked.current = true;
    checkForUpdate().then(update => {
      if (!update) return;
      Alert.alert(
        `Update Available — v${update.versionName}`,
        update.releaseNotes
          ? update.releaseNotes
          : 'A new version of LS Phone is ready to install.',
        [
          { text: 'Later', style: 'cancel' },
          {
            text: 'Update Now',
            onPress: () => Linking.openURL(update.apkUrl),
          },
        ],
      );
    });
  }, []);

  if (isLoading) {
    return (
      <View style={{ flex: 1, backgroundColor: COLORS.bg, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator size="large" color={COLORS.accent} />
      </View>
    );
  }

  if (!token) {
    return <LoginScreen />;
  }

  return (
    <AgentProvider>
      <CallProvider>
        <MainTabs />
      </CallProvider>
    </AgentProvider>
  );
}
