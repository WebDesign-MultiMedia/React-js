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

  const response = await fetch(`https://api.imgbb.com/1/upload?key=${IMGBB_API_KEY}`, {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    throw new Error(`ImgBB ${response.status}: ${detail}`);
  }

  const json = await response.json();
  if (!json.success) throw new Error(json.error?.message ?? 'ImgBB upload failed');
  return json.data.url as string;
}

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

  const launchCamera = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Camera Permission Required', 'Please allow camera access in Settings.');
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
      Alert.alert('Permission Required', 'Please allow photo library access in Settings.');
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

  const handleSubmit = async () => {
    if (!imageUri || !imageBase64) {
      Alert.alert('No Image', 'Please capture or select a receipt photo first.');
      return;
    }
    if (!form.vendor.trim()) {
      Alert.alert('Vendor Required', "Enter the store name (e.g. Jetro, BJ's).");
      return;
    }

    setUploading(true);
    let receiptUrl = '';
    try {
      receiptUrl = await uploadReceiptImage(imageBase64);
    } catch (uploadErr) {
      Alert.alert('Upload Failed', (uploadErr as Error).message);
      setUploading(false);
      return;
    } finally {
      setUploading(false);
    }

    setSubmitting(true);
    try {
      const payload = {
        data: [{
          id: generateId(),
          barcode: `RECEIPT-${Date.now()}`,
          name: `Receipt — ${form.vendor.trim()}${form.notes.trim() ? ` (${form.notes.trim()})` : ''}`,
          category: 'Receipt Log',
          current_stock: 0,
          unit_type: 'receipt',
          items_per_case: 1,
          cost_price: Number(form.amount) || 0,
          receipt_url: receiptUrl,
        }],
      };

      const response = await fetch(SHEETDB_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) throw new Error(`Server responded with ${response.status}`);

      Alert.alert('Receipt Logged', `Receipt from "${form.vendor}" saved successfully.`, [
        {
          text: 'Link to Item',
          onPress: () => router.push({ pathname: '/', params: { receipt_url: receiptUrl } }),
        },
        {
          text: 'Done',
          onPress: () => {
            setImageUri(null);
            setImageBase64(null);
            setForm(BLANK_FORM);
          },
        },
      ]);
    } catch (err) {
      Alert.alert('Save Failed', `Could not log receipt.\n\n${(err as Error).message}`);
    } finally {
      setSubmitting(false);
    }
  };

  const isLoading = uploading || submitting;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      {/* ── Image Section ───────────────────────────────────────────────────── */}
      <View style={styles.card}>
        <Text style={styles.sectionLabel}>RECEIPT IMAGE</Text>

        {imageUri ? (
          <View>
            <Image source={{ uri: imageUri }} style={styles.preview} resizeMode="contain" />
            <View style={styles.retakeRow}>
              <TouchableOpacity
                style={[styles.secondaryBtn, { flex: 1, marginRight: 6 }]}
                onPress={launchCamera}
              >
                <Ionicons name="camera-outline" size={15} color="#D4880A" />
                <Text style={styles.secondaryBtnText}>RETAKE</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.secondaryBtn, { flex: 1, marginLeft: 6 }]}
                onPress={launchGallery}
              >
                <Ionicons name="images-outline" size={15} color="#D4880A" />
                <Text style={styles.secondaryBtnText}>GALLERY</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <View style={styles.placeholder}>
            <Ionicons name="receipt-outline" size={52} color="#333333" />
            <Text style={styles.placeholderTitle}>No Receipt Captured</Text>
            <Text style={styles.placeholderSub}>Use your camera or select from gallery</Text>
            <View style={styles.captureRow}>
              <TouchableOpacity
                style={[styles.captureBtn, { flex: 1, marginRight: 8 }]}
                onPress={launchCamera}
              >
                <Ionicons name="camera-outline" size={18} color="#FFFFFF" />
                <Text style={styles.captureBtnText}>CAMERA</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.captureBtn, styles.captureBtnOutline, { flex: 1, marginLeft: 8 }]}
                onPress={launchGallery}
              >
                <Ionicons name="images-outline" size={18} color="#D4880A" />
                <Text style={[styles.captureBtnText, { color: '#D4880A' }]}>GALLERY</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </View>

      {/* ── Receipt Details ─────────────────────────────────────────────────── */}
      <View style={styles.card}>
        <Text style={styles.sectionLabel}>RECEIPT DETAILS</Text>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>VENDOR / STORE <Text style={styles.required}>*</Text></Text>
          <TextInput
            style={styles.input}
            value={form.vendor}
            onChangeText={(v) => updateField('vendor', v)}
            placeholder="e.g. Jetro, BJ's Wholesale"
            placeholderTextColor="#444444"
          />
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
          <Text style={styles.label}>TOTAL AMOUNT ($)</Text>
          <TextInput
            style={styles.input}
            value={form.amount}
            onChangeText={(v) => updateField('amount', v)}
            keyboardType="decimal-pad"
            placeholder="0.00"
            placeholderTextColor="#444444"
            selectTextOnFocus
          />
        </View>

        <View style={[styles.inputGroup, { marginBottom: 0 }]}>
          <Text style={styles.label}>NOTES (OPTIONAL)</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            value={form.notes}
            onChangeText={(v) => updateField('notes', v)}
            placeholder="Date, order #, items purchased…"
            placeholderTextColor="#444444"
            multiline
            numberOfLines={3}
            textAlignVertical="top"
          />
        </View>
      </View>

      {/* ── Submit ────────────────────────────────────────────────────────────── */}
      <TouchableOpacity
        style={[styles.submitBtn, isLoading && styles.submitBtnDisabled]}
        onPress={handleSubmit}
        disabled={isLoading}
        activeOpacity={0.8}
      >
        {isLoading ? (
          <View style={styles.btnContent}>
            <ActivityIndicator color="#FFFFFF" size="small" />
            <Text style={styles.submitBtnText}>{uploading ? 'UPLOADING…' : 'SAVING…'}</Text>
          </View>
        ) : (
          <View style={styles.btnContent}>
            <Ionicons name="cloud-upload-outline" size={16} color="#FFFFFF" />
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
    backgroundColor: '#0D0D0D',
  },
  content: {
    padding: 20,
    gap: 14,
  },
  card: {
    backgroundColor: '#1A1A1A',
    borderRadius: 8,
    padding: 20,
    borderWidth: 1,
    borderColor: '#2A2A2A',
  },
  sectionLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: '#D4880A',
    letterSpacing: 2.5,
    marginBottom: 18,
  },
  placeholder: {
    alignItems: 'center',
    paddingVertical: 32,
    gap: 8,
  },
  placeholderTitle: {
    color: '#F0F0F0',
    fontSize: 16,
    fontWeight: '700',
    marginTop: 4,
  },
  placeholderSub: {
    color: '#555555',
    fontSize: 13,
  },
  captureRow: {
    flexDirection: 'row',
    width: '100%',
    marginTop: 20,
  },
  captureBtn: {
    backgroundColor: '#1B6B38',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 6,
    gap: 8,
    borderWidth: 1,
    borderColor: '#2A8A4A',
  },
  captureBtnOutline: {
    backgroundColor: 'transparent',
    borderWidth: 1.5,
    borderColor: '#D4880A',
  },
  captureBtnText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 11,
    letterSpacing: 1.5,
  },
  preview: {
    width: '100%',
    height: 220,
    borderRadius: 6,
    marginBottom: 12,
    backgroundColor: '#111111',
  },
  retakeRow: {
    flexDirection: 'row',
  },
  secondaryBtn: {
    backgroundColor: '#111111',
    borderWidth: 1,
    borderColor: '#2A2A2A',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 11,
    borderRadius: 6,
    gap: 6,
  },
  secondaryBtnText: {
    color: '#D4880A',
    fontWeight: '700',
    fontSize: 10,
    letterSpacing: 1.5,
  },
  inputGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 10,
    color: '#666666',
    marginBottom: 8,
    fontWeight: '700',
    letterSpacing: 1.5,
  },
  required: {
    color: '#C41E28',
  },
  input: {
    backgroundColor: '#111111',
    borderWidth: 1,
    borderColor: '#2A2A2A',
    borderRadius: 6,
    paddingHorizontal: 14,
    paddingVertical: Platform.OS === 'ios' ? 14 : 12,
    color: '#F0F0F0',
    fontSize: 15,
  },
  textArea: {
    height: 88,
    paddingTop: 12,
  },
  shortcuts: {
    marginTop: 10,
  },
  shortcutChip: {
    backgroundColor: '#111111',
    borderWidth: 1,
    borderColor: '#2A2A2A',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 7,
    marginRight: 8,
  },
  shortcutText: {
    color: '#D4880A',
    fontSize: 12,
    fontWeight: '600',
  },
  submitBtn: {
    backgroundColor: '#C41E28',
    borderRadius: 8,
    paddingVertical: 20,
    alignItems: 'center',
    marginTop: 4,
    borderWidth: 1,
    borderColor: '#E02030',
  },
  submitBtnDisabled: {
    opacity: 0.4,
  },
  btnContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  submitBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 2.5,
  },
});
