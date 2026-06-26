import React from 'react';
import { Animated, Easing, StyleSheet, Text, TouchableOpacity, View, Modal } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useCall } from '../contexts/CallContext';
import { Config } from '../config';

function resolveContact(raw: string): string | undefined {
  const digits = raw.replace(/[^\d]/g, '');
  for (const [key, name] of Object.entries(Config.CONTACTS)) {
    if (key.replace(/[^\d]/g, '') === digits) return name;
  }
  return undefined;
}

function formatPhone(raw: string): string {
  const d = raw.replace(/[^\d]/g, '');
  if (d.length === 10) return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
  if (d.length === 11 && d[0] === '1')
    return `+1 (${d.slice(1, 4)}) ${d.slice(4, 7)}-${d.slice(7)}`;
  return raw;
}

export function IncomingCallOverlay() {
  const { remoteNumber, acceptIncoming, rejectIncoming } = useCall();
  const contactName = resolveContact(remoteNumber);
  const pulse = React.useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 750, easing: Easing.ease, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 750, easing: Easing.ease, useNativeDriver: true }),
      ]),
    ).start();
  }, [pulse]);

  const iconScale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.15] });

  return (
    <Modal visible transparent animationType="fade">
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <Animated.View style={[styles.iconWrap, { transform: [{ scale: iconScale }] }]}>
            <Icon name="phone-ring" size={40} color="#00F82D" />
          </Animated.View>

          <Text style={styles.label}>Incoming Call</Text>
          {contactName ? <Text style={styles.contactName}>{contactName}</Text> : null}
          <Text style={styles.number}>{formatPhone(remoteNumber) || 'Unknown'}</Text>

          <View style={styles.buttonRow}>
            <TouchableOpacity
              style={[styles.roundBtn, styles.rejectBtn]}
              onPress={rejectIncoming}
              accessibilityLabel="Decline call">
              <Icon name="phone-hangup" size={28} color="#fff" />
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.roundBtn, styles.acceptBtn]}
              onPress={acceptIncoming}
              accessibilityLabel="Accept call">
              <Icon name="phone" size={28} color="#fff" />
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.75)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  card: {
    backgroundColor: '#142b49',
    borderWidth: 1,
    borderColor: '#525252',
    borderRadius: 20,
    padding: 32,
    width: 320,
    alignItems: 'center',
  },
  iconWrap: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(0,248,45,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  label: { color: '#85888e', fontSize: 13, marginBottom: 4 },
  contactName: { color: '#ba5663', fontSize: 18, fontWeight: '700', marginBottom: 2 },
  number: { color: '#fff', fontSize: 22, fontWeight: '700', marginBottom: 28 },
  buttonRow: { flexDirection: 'row', gap: 40 },
  roundBtn: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  acceptBtn: {
    backgroundColor: '#00F82D',
    shadowColor: '#00F82D',
    shadowOpacity: 0.4,
    shadowRadius: 10,
    elevation: 6,
  },
  rejectBtn: {
    backgroundColor: '#ff4757',
    shadowColor: '#ff4757',
    shadowOpacity: 0.4,
    shadowRadius: 10,
    elevation: 6,
  },
});
