import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useCall } from '../contexts/CallContext';
import { Config } from '../config';

type Props = {
  visible: boolean;
  onClose: () => void;
};

function formatPhone(raw: string): string {
  const d = raw.replace(/[^\d]/g, '');
  if (d.length === 10) return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
  if (d.length === 11 && d[0] === '1')
    return `+1 (${d.slice(1, 4)}) ${d.slice(4, 7)}-${d.slice(7)}`;
  return raw;
}

export function TransferModal({ visible, onClose }: Props) {
  const { transfer } = useCall();
  const [target, setTarget] = useState('');
  const [loading, setLoading] = useState(false);

  const doTransfer = async (dest: string) => {
    const t = (dest || target).trim();
    if (!t) {
      Alert.alert('Transfer', 'Enter a number or pick an extension');
      return;
    }
    setLoading(true);
    try {
      await transfer(t);
      Alert.alert('Transfer', `Transferring to ${formatPhone(t)}`);
      onClose();
    } catch (err: any) {
      Alert.alert('Transfer failed', err?.message ?? String(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <View style={styles.header}>
            <Icon name="phone-forward" size={18} color="#00b8ff" />
            <Text style={styles.title}>Transfer call</Text>
          </View>
          <Text style={styles.sub}>Enter a number or pick a team extension</Text>

          <TextInput
            style={styles.input}
            value={target}
            onChangeText={setTarget}
            placeholder="Number or extension…"
            placeholderTextColor="#525252"
            keyboardType="phone-pad"
            autoFocus
          />

          <View style={styles.extList}>
            {Config.EXTENSIONS.map(ext => (
              <TouchableOpacity
                key={ext.ext}
                style={styles.extRow}
                onPress={() => doTransfer(ext.number)}>
                <View style={styles.extBadge}>
                  <Text style={styles.extBadgeText}>{ext.ext}</Text>
                </View>
                <View style={styles.extInfo}>
                  <Text style={styles.extName}>{ext.name}</Text>
                  <Text style={styles.extNum}>{formatPhone(ext.number)}</Text>
                </View>
                <Icon name="arrow-right" size={14} color="#00b8ff" />
              </TouchableOpacity>
            ))}
          </View>

          <View style={styles.footer}>
            <TouchableOpacity style={styles.cancelBtn} onPress={onClose} disabled={loading}>
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.confirmBtn}
              onPress={() => doTransfer('')}
              disabled={loading}>
              {loading ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <>
                  <Icon name="phone-forward" size={14} color="#fff" />
                  <Text style={styles.confirmText}> Transfer</Text>
                </>
              )}
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
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'flex-end',
  },
  card: {
    backgroundColor: '#142b49',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderWidth: 1,
    borderColor: '#525252',
    padding: 24,
  },
  header: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  title: { color: '#fff', fontSize: 16, fontWeight: '700' },
  sub: { color: '#85888e', fontSize: 12, marginBottom: 16 },
  input: {
    backgroundColor: '#0e1e35',
    borderWidth: 1,
    borderColor: '#2a3f5f',
    borderRadius: 8,
    color: '#d0d0d0',
    padding: 12,
    fontSize: 15,
    marginBottom: 12,
  },
  extList: {
    borderWidth: 1,
    borderColor: '#2a3f5f',
    borderRadius: 8,
    overflow: 'hidden',
    marginBottom: 16,
  },
  extRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(42,63,95,0.5)',
  },
  extBadge: {
    width: 32,
    height: 32,
    borderRadius: 7,
    backgroundColor: 'rgba(186,86,99,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  extBadgeText: { color: '#ba5663', fontWeight: '800', fontSize: 12, fontFamily: 'monospace' },
  extInfo: { flex: 1 },
  extName: { color: '#d0d0d0', fontSize: 13, fontWeight: '600' },
  extNum: { color: '#85888e', fontSize: 11, marginTop: 1 },
  footer: { flexDirection: 'row', gap: 10 },
  cancelBtn: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    backgroundColor: 'rgba(82,82,82,0.3)',
    alignItems: 'center',
  },
  cancelText: { color: '#d0d0d0', fontWeight: '600', fontSize: 14 },
  confirmBtn: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    backgroundColor: '#00b8ff',
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
  },
  confirmText: { color: '#fff', fontWeight: '600', fontSize: 14 },
});
