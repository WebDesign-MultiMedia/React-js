import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  TextInput,
  ScrollView,
  Alert,
  ActivityIndicator,
  Platform,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SHEETDB_URL, IMGBB_API_KEY } from '../constants/api';

// ─── Types ────────────────────────────────────────────────────────────────────

interface ReceiptForm {
  vendor: string;
  amount: string;
  notes: string;
}

const BLANK_FORM: ReceiptForm = { vendor: '', amount: '', notes: '' };

const VENDOR_SHORTCUTS = ["Jetro", "BJ's", "Restaurant Depot", "Costco"];

// ─── ImgBB Upload ─────────────────────────────────────────────────────────────
async function uploadReceiptImage(base64: string): Promise<string> {
  if (IMGBB_API_KEY === 'YOUR_IMGBB_API_KEY_HERE') {
    throw new Error('Add your ImgBB API key to constants/api.ts before uploading images.');
  }

  const formData = new FormData();
  formData.append('image', base64);

  const response = await fetch(
    `https://api.imgbb.com/1/upload?key=${IMGBB_API_KEY}`,
    { method: 'POST', body: formData }
  );

  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    throw new Error(`ImgBB ${response.status}: ${detail}`);
  }

  const json = await response.json();

  if (!json.success) {
    throw new Error(json.error?.message ?? 'ImgBB upload failed');
  }

  return json.data.url as string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const generateId = (): string =>
  Date.now().toString(36) + Math.random().toString(36).substring(2, 7);

// ─── Component ────────────────────────────────────────────────────────────────

export default function ReceiptScreen() {
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [form, setForm] = useState<ReceiptForm>(BLANK_FORM);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const updateField = (key: keyof ReceiptForm, value: string) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  // ── Camera / Gallery ────────────────────────────────────────────────────────

  const launchCamera = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert(
        'Camera Permission Required',
        'Please allow camera access in Settings to capture receipts.'
      );
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: 'images',
      quality: 0.75,
      allowsEditing: false,
      base64: true,
    });
    if (!result.canceled && result.assets[0]) {
      setImageUri(result.assets[0].uri);
      setImageBase64(result.assets[0].base64 ?? null);
    }
  };

  const launchGallery = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert(
        'Photo Library Permission Required',
        'Please allow photo library access in Settings to select receipts.'
      );
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: 'images',
      quality: 0.75,
      base64: true,
    });
    if (!result.canceled && result.assets[0]) {
      setImageUri(result.assets[0].uri);
      setImageBase64(result.assets[0].base64 ?? null);
    }
  };

  // ── Submit ──────────────────────────────────────────────────────────────────

  const handleSubmit = async () => {
    if (!imageUri || !imageBase64) {
      Alert.alert('No Image', 'Please capture or select a receipt photo first.');
      return;
    }
    if (!form.vendor.trim()) {
      Alert.alert('Vendor Required', 'Enter the store name (e.g. Jetro, BJ\'s).');
      return;
    }

    // Step 1 — upload image and get a URL
    setUploading(true);
    let receiptUrl = '';
    try {
      receiptUrl = await uploadReceiptImage(imageBase64);
    } catch (uploadErr) {
      const msg = (uploadErr as Error).message;
      Alert.alert('Upload Failed', msg);
      setUploading(false);
      return;
    } finally {
      setUploading(false);
    }

    // Step 2 — log the receipt row in SheetDB
    setSubmitting(true);
    try {
      const payload = {
        data: [
          {
            id: generateId(),
            barcode: `RECEIPT-${Date.now()}`,
            name: `Receipt — ${form.vendor.trim()}${form.notes.trim() ? ` (${form.notes.trim()})` : ''}`,
            category: 'Receipt Log',
            current_stock: 0,
            unit_type: 'receipt',
            items_per_case: 1,
            cost_price: Number(form.amount) || 0,
            receipt_url: receiptUrl,
          },
        ],
      };

      const response = await fetch(SHEETDB_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) throw new Error(`Server responded with ${response.status}`);

      Alert.alert(
        '✓ Receipt Logged',
        `Receipt from "${form.vendor}" saved successfully.`,
        [
          {
            text: 'Link to Item',
            onPress: () =>
              router.push({ pathname: '/', params: { receipt_url: receiptUrl } }),
          },
          {
            text: 'Done',
            onPress: () => {
              setImageUri(null);
              setImageBase64(null);
              setForm(BLANK_FORM);
            },
          },
        ]
      );
    } catch (err) {
      Alert.alert(
        'Save Failed',
        `Could not log receipt in SheetDB.\n\n${(err as Error).message}`
      );
    } finally {
      setSubmitting(false);
    }
  };

  const isLoading = uploading || submitting;

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      {/* ── Image Section ─────────────────────────────────────────────────── */}
      <View style={styles.card}>
        <Text style={styles.sectionLabel}>RECEIPT IMAGE</Text>

        {imageUri ? (
          <View>
            <Image
              source={{ uri: imageUri }}
              style={styles.preview}
              resizeMode="contain"
            />
            <View style={styles.retakeRow}>
              <TouchableOpacity
                style={[styles.secondaryBtn, { flex: 1, marginRight: 6 }]}
                onPress={launchCamera}
              >
                <Ionicons name="camera" size={16} color="#f59e0b" />
                <Text style={styles.secondaryBtnText}>Retake</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.secondaryBtn, { flex: 1, marginLeft: 6 }]}
                onPress={launchGallery}
              >
                <Ionicons name="images" size={16} color="#f59e0b" />
                <Text style={styles.secondaryBtnText}>Gallery</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <View style={styles.placeholder}>
            <Ionicons name="receipt-outline" size={60} color="#334155" />
            <Text style={styles.placeholderText}>No receipt captured yet</Text>
            <View style={styles.captureRow}>
              <TouchableOpacity style={[styles.captureBtn, { flex: 1, marginRight: 8 }]} onPress={launchCamera}>
                <Ionicons name="camera" size={20} color="#0f172a" />
                <Text style={styles.captureBtnText}>Camera</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.captureBtn, styles.captureBtnOutline, { flex: 1, marginLeft: 8 }]}
                onPress={launchGallery}
              >
                <Ionicons name="images" size={20} color="#f59e0b" />
                <Text style={[styles.captureBtnText, { color: '#f59e0b' }]}>Gallery</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </View>

      {/* ── Receipt Details ───────────────────────────────────────────────── */}
      <View style={styles.card}>
        <Text style={styles.sectionLabel}>RECEIPT DETAILS</Text>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>
            Vendor / Store <Text style={styles.required}>*</Text>
          </Text>
          <TextInput
            style={styles.input}
            value={form.vendor}
            onChangeText={(v) => updateField('vendor', v)}
            placeholder="e.g. Jetro, BJ's Wholesale"
            placeholderTextColor="#475569"
          />
          {/* Quick-fill shortcuts */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.shortcuts}>
            {VENDOR_SHORTCUTS.map((v) => (
              <TouchableOpacity
                key={v}
                style={styles.shortcutChip}
                onPress={() => updateField('vendor', v)}
              >
                <Text style={styles.shortcutText}>{v}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Total Amount ($)</Text>
          <TextInput
            style={styles.input}
            value={form.amount}
            onChangeText={(v) => updateField('amount', v)}
            keyboardType="decimal-pad"
            placeholder="0.00"
            placeholderTextColor="#475569"
            selectTextOnFocus
          />
        </View>

        <View style={[styles.inputGroup, { marginBottom: 0 }]}>
          <Text style={styles.label}>Notes (optional)</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            value={form.notes}
            onChangeText={(v) => updateField('notes', v)}
            placeholder="Date, order #, items purchased…"
            placeholderTextColor="#475569"
            multiline
            numberOfLines={3}
            textAlignVertical="top"
          />
        </View>
      </View>

      {/* ── Submit ────────────────────────────────────────────────────────── */}
      <TouchableOpacity
        style={[styles.submitBtn, isLoading && styles.submitBtnDisabled]}
        onPress={handleSubmit}
        disabled={isLoading}
        activeOpacity={0.8}
      >
        {isLoading ? (
          <View style={styles.btnContent}>
            <ActivityIndicator color="#0f172a" size="small" />
            <Text style={styles.submitBtnText}>
              {uploading ? 'Uploading…' : 'Saving…'}
            </Text>
          </View>
        ) : (
          <View style={styles.btnContent}>
            <Ionicons name="cloud-upload" size={18} color="#0f172a" />
            <Text style={styles.submitBtnText}>LOG RECEIPT</Text>
          </View>
        )}
      </TouchableOpacity>

      <View style={{ height: 32 }} />
    </ScrollView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a',
  },
  content: {
    padding: 16,
    gap: 12,
  },
  card: {
    backgroundColor: '#1e293b',
    borderRadius: 14,
    padding: 16,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#10b981',
    letterSpacing: 1.8,
    marginBottom: 14,
  },
  // Image area
  placeholder: {
    alignItems: 'center',
    paddingVertical: 28,
    gap: 10,
  },
  placeholderText: {
    color: '#475569',
    fontSize: 14,
    fontWeight: '500',
  },
  captureRow: {
    flexDirection: 'row',
    width: '100%',
    marginTop: 6,
  },
  captureBtn: {
    backgroundColor: '#f59e0b',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 12,
    gap: 8,
  },
  captureBtnOutline: {
    backgroundColor: 'transparent',
    borderWidth: 1.5,
    borderColor: '#f59e0b',
  },
  captureBtnText: {
    color: '#0f172a',
    fontWeight: '800',
    fontSize: 14,
  },
  preview: {
    width: '100%',
    height: 220,
    borderRadius: 10,
    marginBottom: 12,
    backgroundColor: '#0f172a',
  },
  retakeRow: {
    flexDirection: 'row',
  },
  secondaryBtn: {
    backgroundColor: '#0f172a',
    borderWidth: 1.5,
    borderColor: '#f59e0b',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 10,
    gap: 6,
  },
  secondaryBtnText: {
    color: '#f59e0b',
    fontWeight: '700',
    fontSize: 13,
  },
  // Form
  inputGroup: {
    marginBottom: 14,
  },
  label: {
    fontSize: 12,
    color: '#94a3b8',
    marginBottom: 6,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
  required: {
    color: '#ef4444',
  },
  input: {
    backgroundColor: '#0f172a',
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: Platform.OS === 'ios' ? 14 : 12,
    color: '#f8fafc',
    fontSize: 16,
  },
  textArea: {
    height: 88,
    paddingTop: 12,
  },
  shortcuts: {
    marginTop: 8,
  },
  shortcutChip: {
    backgroundColor: '#0f172a',
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginRight: 8,
  },
  shortcutText: {
    color: '#94a3b8',
    fontSize: 12,
    fontWeight: '600',
  },
  // Submit
  submitBtn: {
    backgroundColor: '#10b981',
    borderRadius: 14,
    paddingVertical: 18,
    alignItems: 'center',
    marginTop: 4,
    shadowColor: '#10b981',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  submitBtnDisabled: {
    opacity: 0.55,
  },
  btnContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  submitBtnText: {
    color: '#0f172a',
    fontSize: 16,
    fontWeight: '900',
    letterSpacing: 1.2,
  },
});
