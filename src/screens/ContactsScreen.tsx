import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { fetchContacts, saveContact, deleteContact, type Contact } from '../services/api';
import { useCall } from '../contexts/CallContext';

const COLORS = {
  bg:     '#0a1628',
  card:   '#142b49',
  border: '#2a3f5f',
  accent: '#ba5663',
  green:  '#00F82D',
  blue:   '#00b8ff',
  text:   '#d0d0d0',
  muted:  '#85888e',
};

function formatPhone(raw: string): string {
  const d = raw.replace(/[^\d]/g, '');
  if (d.length === 10) return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
  if (d.length === 11 && d[0] === '1')
    return `+1 (${d.slice(1, 4)}) ${d.slice(4, 7)}-${d.slice(7)}`;
  return raw;
}

function initials(name: string): string {
  return name
    .split(' ')
    .slice(0, 2)
    .map(w => w[0]?.toUpperCase() ?? '')
    .join('');
}

// ── Contact form modal ─────────────────────────────────────────────────────

type FormProps = {
  visible: boolean;
  initial?: Contact | null;
  onClose: () => void;
  onSaved: () => void;
};

function ContactForm({ visible, initial, onClose, onSaved }: FormProps) {
  const [name, setName]       = useState('');
  const [phone, setPhone]     = useState('');
  const [email, setEmail]     = useState('');
  const [company, setCompany] = useState('');
  const [notes, setNotes]     = useState('');
  const [saving, setSaving]   = useState(false);

  useEffect(() => {
    if (visible) {
      setName(initial?.name    ?? '');
      setPhone(initial?.phone  ?? '');
      setEmail(initial?.email  ?? '');
      setCompany(initial?.company ?? '');
      setNotes(initial?.notes  ?? '');
    }
  }, [visible, initial]);

  const handleSave = async () => {
    if (!name.trim()) {
      Alert.alert('Required', 'Name is required');
      return;
    }
    setSaving(true);
    try {
      await saveContact({ id: initial?.id, name: name.trim(), phone, email, company, notes });
      onSaved();
      onClose();
    } catch (err: any) {
      Alert.alert('Save failed', err?.message ?? String(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.modalSheet}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>{initial ? 'Edit Contact' : 'New Contact'}</Text>
            <TouchableOpacity onPress={onClose} style={styles.modalClose}>
              <Icon name="close" size={18} color={COLORS.muted} />
            </TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={styles.formBody} keyboardShouldPersistTaps="handled">
            <Field label="Name *" value={name} onChangeText={setName} placeholder="Full name" autoCapitalize="words" />
            <Field label="Phone" value={phone} onChangeText={setPhone} placeholder="+1 (555) 000-0000" keyboardType="phone-pad" />
            <Field label="Email" value={email} onChangeText={setEmail} placeholder="email@example.com" keyboardType="email-address" autoCapitalize="none" />
            <Field label="Company" value={company} onChangeText={setCompany} placeholder="Company name" autoCapitalize="words" />
            <Field label="Notes" value={notes} onChangeText={setNotes} placeholder="Optional notes" multiline />
          </ScrollView>
          <View style={styles.formFooter}>
            <TouchableOpacity style={styles.cancelBtn} onPress={onClose}>
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.saveBtn} onPress={handleSave} disabled={saving}>
              {saving
                ? <ActivityIndicator size="small" color="#fff" />
                : <Text style={styles.saveText}>Save</Text>}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

function Field({
  label, value, onChangeText, placeholder, keyboardType, autoCapitalize, multiline,
}: {
  label: string; value: string; onChangeText: (v: string) => void;
  placeholder?: string; keyboardType?: any; autoCapitalize?: any; multiline?: boolean;
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        style={[styles.fieldInput, multiline && styles.fieldMultiline]}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={COLORS.muted}
        keyboardType={keyboardType}
        autoCapitalize={autoCapitalize ?? 'sentences'}
        multiline={multiline}
        numberOfLines={multiline ? 3 : 1}
      />
    </View>
  );
}

// ── Contact row ────────────────────────────────────────────────────────────

function ContactRow({
  item,
  onCall,
  onEdit,
  onDelete,
  inCall,
}: {
  item: Contact;
  onCall: (phone: string) => void;
  onEdit: (c: Contact) => void;
  onDelete: (c: Contact) => void;
  inCall: boolean;
}) {
  return (
    <View style={styles.row}>
      <View style={styles.avatar}>
        <Text style={styles.avatarText}>{initials(item.name)}</Text>
      </View>
      <View style={styles.rowBody}>
        <Text style={styles.contactName}>{item.name}</Text>
        {item.company ? <Text style={styles.detail}><Icon name="office-building" size={11} color={COLORS.muted} /> {item.company}</Text> : null}
        {item.phone   ? <Text style={styles.detail}><Icon name="phone" size={11} color={COLORS.muted} /> {formatPhone(item.phone)}</Text> : null}
        {item.email   ? <Text style={styles.detail}><Icon name="email" size={11} color={COLORS.muted} /> {item.email}</Text> : null}
      </View>
      <View style={styles.rowActions}>
        {item.phone ? (
          <TouchableOpacity
            style={styles.callBtn}
            onPress={() => onCall(item.phone!)}
            disabled={inCall}
            accessibilityLabel={`Call ${item.name}`}>
            <Icon name="phone" size={15} color={inCall ? COLORS.muted : COLORS.green} />
          </TouchableOpacity>
        ) : null}
        <TouchableOpacity style={styles.editBtn} onPress={() => onEdit(item)} accessibilityLabel={`Edit ${item.name}`}>
          <Icon name="pencil-outline" size={15} color={COLORS.blue} />
        </TouchableOpacity>
        <TouchableOpacity style={styles.deleteBtn} onPress={() => onDelete(item)} accessibilityLabel={`Delete ${item.name}`}>
          <Icon name="trash-can-outline" size={15} color={COLORS.accent} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ── Main screen ────────────────────────────────────────────────────────────

export function ContactsScreen() {
  const { dial, status: callStatus } = useCall();
  const inCall = callStatus === 'connected';

  const [contacts, setContacts]   = useState<Contact[]>([]);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState('');
  const [search, setSearch]       = useState('');
  const [formOpen, setFormOpen]   = useState(false);
  const [editing, setEditing]     = useState<Contact | null>(null);

  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(async (q?: string) => {
    setLoading(true);
    setError('');
    try {
      setContacts(await fetchContacts(q));
    } catch (err: any) {
      setError(err?.message ?? 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleSearchChange = (text: string) => {
    setSearch(text);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => load(text.trim() || undefined), 300);
  };

  const handleCall = useCallback(
    (phone: string) => {
      if (callStatus !== 'idle') {
        Alert.alert('Busy', 'You are already in a call');
        return;
      }
      dial(phone).catch(err => Alert.alert('Call failed', err?.message));
    },
    [dial, callStatus],
  );

  const handleEdit = (c: Contact) => {
    setEditing(c);
    setFormOpen(true);
  };

  const handleNew = () => {
    setEditing(null);
    setFormOpen(true);
  };

  const handleDelete = (c: Contact) => {
    Alert.alert('Delete contact', `Remove ${c.name}?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive',
        onPress: async () => {
          try {
            await deleteContact(c.id);
            load(search.trim() || undefined);
          } catch (err: any) {
            Alert.alert('Delete failed', err?.message);
          }
        },
      },
    ]);
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.topBar}>
        <Text style={styles.topBarTitle}>Contacts</Text>
        <View style={styles.topBarRight}>
          <TouchableOpacity onPress={() => load(search.trim() || undefined)} style={styles.iconBtn}>
            <Icon name="refresh" size={18} color={COLORS.muted} />
          </TouchableOpacity>
          <TouchableOpacity onPress={handleNew} style={[styles.iconBtn, styles.addBtn]}>
            <Icon name="plus" size={18} color="#fff" />
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.searchBar}>
        <Icon name="magnify" size={16} color={COLORS.muted} style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          value={search}
          onChangeText={handleSearchChange}
          placeholder="Search by name, phone, company…"
          placeholderTextColor={COLORS.muted}
          returnKeyType="search"
          clearButtonMode="while-editing"
        />
        {search.length > 0 ? (
          <TouchableOpacity onPress={() => { setSearch(''); load(); }}>
            <Icon name="close-circle" size={16} color={COLORS.muted} />
          </TouchableOpacity>
        ) : null}
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={COLORS.accent} size="large" />
        </View>
      ) : error ? (
        <View style={styles.center}>
          <Icon name="alert-circle" size={32} color={COLORS.muted} />
          <Text style={styles.emptyText}>{error}</Text>
          <TouchableOpacity onPress={() => load()} style={styles.retryBtn}>
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : contacts.length === 0 ? (
        <View style={styles.center}>
          <Icon name="account-group-outline" size={40} color={COLORS.muted} />
          <Text style={styles.emptyText}>{search ? 'No matches' : 'No contacts yet'}</Text>
          {!search ? (
            <TouchableOpacity onPress={handleNew} style={styles.retryBtn}>
              <Text style={styles.retryText}>Add contact</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      ) : (
        <FlatList
          data={contacts}
          keyExtractor={item => String(item.id)}
          renderItem={({ item }) => (
            <ContactRow
              item={item}
              onCall={handleCall}
              onEdit={handleEdit}
              onDelete={handleDelete}
              inCall={inCall}
            />
          )}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
        />
      )}

      <ContactForm
        visible={formOpen}
        initial={editing}
        onClose={() => setFormOpen(false)}
        onSaved={() => load(search.trim() || undefined)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:    { flex: 1, backgroundColor: COLORS.bg },
  topBar:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 14, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  topBarTitle: { color: '#fff', fontSize: 15, fontWeight: '700' },
  topBarRight: { flexDirection: 'row', gap: 8 },
  iconBtn: { padding: 6, borderRadius: 6, backgroundColor: 'rgba(42,63,95,0.3)' },
  addBtn:  { backgroundColor: COLORS.accent },
  searchBar: { flexDirection: 'row', alignItems: 'center', margin: 12, paddingHorizontal: 12, paddingVertical: 8, backgroundColor: COLORS.card, borderWidth: 1, borderColor: COLORS.border, borderRadius: 10, gap: 8 },
  searchIcon: {},
  searchInput: { flex: 1, color: COLORS.text, fontSize: 13, padding: 0 },
  separator: { height: 1, backgroundColor: 'rgba(42,63,95,0.5)', marginLeft: 72 },
  row: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, gap: 12 },
  avatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(186,86,99,0.18)', alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: COLORS.accent, fontWeight: '800', fontSize: 14 },
  rowBody: { flex: 1 },
  contactName: { color: COLORS.text, fontSize: 14, fontWeight: '700', marginBottom: 2 },
  detail: { color: COLORS.muted, fontSize: 11, marginTop: 1 },
  rowActions: { flexDirection: 'row', gap: 6, alignItems: 'center' },
  callBtn:   { width: 34, height: 34, borderRadius: 8, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,248,45,0.12)' },
  editBtn:   { width: 34, height: 34, borderRadius: 8, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,184,255,0.12)' },
  deleteBtn: { width: 34, height: 34, borderRadius: 8, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(186,86,99,0.12)' },
  center:    { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  emptyText: { color: COLORS.muted, fontSize: 13 },
  retryBtn:  { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8, backgroundColor: COLORS.accent },
  retryText: { color: '#fff', fontSize: 13, fontWeight: '600' },
  // modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  modalSheet:   { backgroundColor: COLORS.card, borderTopLeftRadius: 18, borderTopRightRadius: 18, borderWidth: 1, borderColor: COLORS.border, maxHeight: '90%' },
  modalHeader:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  modalTitle:   { color: '#fff', fontSize: 15, fontWeight: '700' },
  modalClose:   { padding: 4 },
  formBody:     { padding: 16, gap: 14 },
  formFooter:   { flexDirection: 'row', gap: 12, padding: 16, borderTopWidth: 1, borderTopColor: COLORS.border },
  field:        { gap: 6 },
  fieldLabel:   { color: COLORS.muted, fontSize: 11, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
  fieldInput:   { backgroundColor: COLORS.bg, borderWidth: 1, borderColor: COLORS.border, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, color: COLORS.text, fontSize: 14 },
  fieldMultiline: { height: 80, textAlignVertical: 'top' },
  cancelBtn:    { flex: 1, paddingVertical: 12, borderRadius: 10, backgroundColor: 'rgba(42,63,95,0.4)', alignItems: 'center' },
  cancelText:   { color: COLORS.muted, fontWeight: '600', fontSize: 14 },
  saveBtn:      { flex: 2, paddingVertical: 12, borderRadius: 10, backgroundColor: COLORS.accent, alignItems: 'center' },
  saveText:     { color: '#fff', fontWeight: '700', fontSize: 14 },
});
