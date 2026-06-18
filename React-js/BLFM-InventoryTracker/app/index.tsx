import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  Switch,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { SHEETDB_URL } from '../constants/api';

// ─── Types ────────────────────────────────────────────────────────────────────

interface FormData {
  barcode: string;
  name: string;
  category: string;
  unit_type: string;
  items_per_case: string;
  cases_quantity: string;
  single_quantity: string;
  cost_price: string;
  receipt_url: string;
}

const BLANK_FORM: FormData = {
  barcode: '',
  name: '',
  category: '',
  unit_type: 'unit',
  items_per_case: '12',
  cases_quantity: '1',
  single_quantity: '1',
  cost_price: '0.00',
  receipt_url: '',
};

const generateId = (): string =>
  Date.now().toString(36) + Math.random().toString(36).substring(2, 7);

// ─── Component ────────────────────────────────────────────────────────────────

export default function DashboardScreen() {
  const params = useLocalSearchParams<{ barcode?: string; receipt_url?: string }>();

  const [isFullCase, setIsFullCase] = useState(false);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState<FormData>(BLANK_FORM);

  useEffect(() => {
    if (params.barcode) setForm((p) => ({ ...p, barcode: params.barcode as string }));
  }, [params.barcode]);

  useEffect(() => {
    if (params.receipt_url) setForm((p) => ({ ...p, receipt_url: params.receipt_url as string }));
  }, [params.receipt_url]);

  const updateField = (key: keyof FormData, value: string) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const calculateTotalUnits = (): number => {
    if (isFullCase) {
      const cases = Number(form.cases_quantity);
      const perCase = Number(form.items_per_case);
      return isNaN(cases) || isNaN(perCase) ? 0 : cases * perCase;
    }
    const qty = Number(form.single_quantity);
    return isNaN(qty) ? 0 : qty;
  };

  const handleSubmit = async () => {
    if (!form.name.trim()) {
      Alert.alert('Validation Error', 'Item name is required.');
      return;
    }
    if (!form.category.trim()) {
      Alert.alert('Validation Error', 'Please enter a category.');
      return;
    }
    const totalUnits = calculateTotalUnits();
    if (totalUnits <= 0) {
      Alert.alert('Validation Error', 'Total units must be greater than zero.');
      return;
    }

    setLoading(true);
    try {
      const payload = {
        data: [{
          id: generateId(),
          barcode: form.barcode.trim(),
          name: form.name.trim(),
          category: form.category.trim(),
          current_stock: totalUnits,
          unit_type: form.unit_type.trim() || 'unit',
          items_per_case: isFullCase ? Number(form.items_per_case) : 1,
          cost_price: Number(form.cost_price) || 0,
          receipt_url: form.receipt_url.trim(),
        }],
      };

      const response = await fetch(SHEETDB_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) throw new Error(`Server responded with ${response.status}`);

      Alert.alert('Saved!', `Added ${totalUnits} unit(s) of "${form.name}" to inventory.`, [
        { text: 'OK', onPress: () => setForm(BLANK_FORM) },
      ]);
    } catch (err) {
      Alert.alert('Network Error', `Could not save.\n\n${(err as Error).message}`);
    } finally {
      setLoading(false);
    }
  };

  const totalPreview = calculateTotalUnits();

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* ── Transaction Type ─────────────────────────────────────────────── */}
        <View style={styles.card}>
          <Text style={styles.sectionLabel}>TRANSACTION TYPE</Text>
          <View style={styles.toggleRow}>
            <Text style={[styles.toggleLabel, !isFullCase && styles.toggleActive]}>
              Single Item
            </Text>
            <Switch
              value={isFullCase}
              onValueChange={setIsFullCase}
              trackColor={{ false: '#2A2A2A', true: '#1B6B38' }}
              thumbColor={isFullCase ? '#D4880A' : '#555555'}
              ios_backgroundColor="#2A2A2A"
              style={{ marginHorizontal: 16 }}
            />
            <Text style={[styles.toggleLabel, isFullCase && styles.toggleActive]}>
              Full Case
            </Text>
          </View>
        </View>

        {/* ── Quantity ─────────────────────────────────────────────────────── */}
        <View style={styles.card}>
          <Text style={styles.sectionLabel}>QUANTITY</Text>

          {isFullCase ? (
            <View style={styles.row}>
              <View style={[styles.inputGroup, { flex: 1, marginRight: 10 }]}>
                <Text style={styles.label}>CASES</Text>
                <TextInput
                  style={styles.input}
                  value={form.cases_quantity}
                  onChangeText={(v) => updateField('cases_quantity', v)}
                  keyboardType="numeric"
                  placeholder="1"
                  placeholderTextColor="#444444"
                  selectTextOnFocus
                />
              </View>
              <View style={[styles.inputGroup, { flex: 1, marginLeft: 10 }]}>
                <Text style={styles.label}>ITEMS / CASE</Text>
                <TextInput
                  style={styles.input}
                  value={form.items_per_case}
                  onChangeText={(v) => updateField('items_per_case', v)}
                  keyboardType="numeric"
                  placeholder="12"
                  placeholderTextColor="#444444"
                  selectTextOnFocus
                />
              </View>
            </View>
          ) : (
            <View style={styles.inputGroup}>
              <Text style={styles.label}>QUANTITY (UNITS)</Text>
              <TextInput
                style={styles.input}
                value={form.single_quantity}
                onChangeText={(v) => updateField('single_quantity', v)}
                keyboardType="numeric"
                placeholder="1"
                placeholderTextColor="#444444"
                selectTextOnFocus
              />
            </View>
          )}

          <View style={styles.totalBadge}>
            <Text style={styles.totalLabel}>TOTAL UNITS</Text>
            <Text style={styles.totalNum}>{totalPreview > 0 ? totalPreview : '—'}</Text>
            {isFullCase && totalPreview > 0 && (
              <Text style={styles.totalFormula}>
                {form.cases_quantity} cases × {form.items_per_case} per case
              </Text>
            )}
          </View>
        </View>

        {/* ── Item Details ─────────────────────────────────────────────────── */}
        <View style={styles.card}>
          <Text style={styles.sectionLabel}>ITEM DETAILS</Text>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>BARCODE</Text>
            <TextInput
              style={styles.input}
              value={form.barcode}
              onChangeText={(v) => updateField('barcode', v)}
              placeholder="Scan or enter barcode"
              placeholderTextColor="#444444"
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>ITEM NAME <Text style={styles.required}>*</Text></Text>
            <TextInput
              style={styles.input}
              value={form.name}
              onChangeText={(v) => updateField('name', v)}
              placeholder="e.g. Pollo Entero"
              placeholderTextColor="#444444"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>CATEGORY <Text style={styles.required}>*</Text></Text>
            <TextInput
              style={styles.input}
              value={form.category}
              onChangeText={(v) => updateField('category', v)}
              placeholder="e.g. Meat, Produce, Dry Goods"
              placeholderTextColor="#444444"
            />
          </View>

          <View style={styles.row}>
            <View style={[styles.inputGroup, { flex: 1, marginRight: 10 }]}>
              <Text style={styles.label}>UNIT TYPE</Text>
              <TextInput
                style={styles.input}
                value={form.unit_type}
                onChangeText={(v) => updateField('unit_type', v)}
                placeholder="lb, oz, unit…"
                placeholderTextColor="#444444"
                autoCapitalize="none"
              />
            </View>
            <View style={[styles.inputGroup, { flex: 1, marginLeft: 10 }]}>
              <Text style={styles.label}>COST PRICE ($)</Text>
              <TextInput
                style={styles.input}
                value={form.cost_price}
                onChangeText={(v) => updateField('cost_price', v)}
                keyboardType="decimal-pad"
                placeholder="0.00"
                placeholderTextColor="#444444"
                selectTextOnFocus
              />
            </View>
          </View>

          <View style={[styles.inputGroup, { marginBottom: 0 }]}>
            <Text style={styles.label}>RECEIPT URL</Text>
            <TextInput
              style={styles.input}
              value={form.receipt_url}
              onChangeText={(v) => updateField('receipt_url', v)}
              placeholder="Auto-filled from Receipt tab"
              placeholderTextColor="#444444"
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>
        </View>

        {/* ── Submit ────────────────────────────────────────────────────────── */}
        <TouchableOpacity
          style={[styles.submitBtn, loading && styles.submitBtnDisabled]}
          onPress={handleSubmit}
          disabled={loading}
          activeOpacity={0.8}
        >
          {loading ? (
            <ActivityIndicator color="#FFFFFF" size="small" />
          ) : (
            <Text style={styles.submitBtnText}>ADD TO INVENTORY</Text>
          )}
        </TouchableOpacity>

        <View style={{ height: 32 }} />
      </ScrollView>
    </KeyboardAvoidingView>
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
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 4,
  },
  toggleLabel: {
    fontSize: 15,
    fontWeight: '500',
    color: '#444444',
    minWidth: 90,
    textAlign: 'center',
  },
  toggleActive: {
    color: '#F0F0F0',
    fontWeight: '700',
  },
  row: {
    flexDirection: 'row',
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
  totalBadge: {
    backgroundColor: '#111111',
    borderRadius: 6,
    padding: 18,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#1B6B38',
    gap: 4,
  },
  totalLabel: {
    fontSize: 10,
    color: '#D4880A',
    fontWeight: '700',
    letterSpacing: 2,
  },
  totalNum: {
    color: '#F0F0F0',
    fontSize: 40,
    fontWeight: '800',
    letterSpacing: -1,
  },
  totalFormula: {
    color: '#555555',
    fontSize: 12,
    marginTop: 2,
  },
  submitBtn: {
    backgroundColor: '#1B6B38',
    borderRadius: 8,
    paddingVertical: 20,
    alignItems: 'center',
    marginTop: 4,
    borderWidth: 1,
    borderColor: '#2A8A4A',
  },
  submitBtnDisabled: {
    opacity: 0.4,
  },
  submitBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 2.5,
  },
});
