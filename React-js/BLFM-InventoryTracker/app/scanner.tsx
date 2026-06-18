import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Alert,
  Modal,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Dimensions,
  Platform,
} from 'react-native';
import {
  CameraView,
  useCameraPermissions,
  type BarcodeScanningResult,
} from 'expo-camera';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SHEETDB_URL } from '../constants/api';

// ─── Types ────────────────────────────────────────────────────────────────────

interface SheetItem {
  id: string;
  barcode: string;
  name: string;
  category: string;
  current_stock: string;
  unit_type: string;
  items_per_case: string;
  cost_price: string;
  receipt_url: string;
}

const { width } = Dimensions.get('window');
const FRAME_SIZE = Math.min(width * 0.65, 280);
const CORNER = 28;
const BORDER = 3;

// ─── Component ────────────────────────────────────────────────────────────────

export default function ScannerScreen() {
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const [searching, setSearching] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [foundItem, setFoundItem] = useState<SheetItem | null>(null);
  const [addQty, setAddQty] = useState('1');
  const [updating, setUpdating] = useState(false);

  const handleBarcodeScanned = async ({ data }: BarcodeScanningResult) => {
    if (scanned || searching) return;
    setScanned(true);
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    setSearching(true);
    try {
      const res = await fetch(`${SHEETDB_URL}/search?barcode=${encodeURIComponent(data)}`);
      if (!res.ok) throw new Error(`SheetDB returned ${res.status}`);

      const results: SheetItem[] = await res.json();

      if (results && results.length > 0) {
        setFoundItem(results[0]);
        setAddQty('1');
        setModalVisible(true);
      } else {
        Alert.alert(
          'New Item',
          `Barcode "${data}" is not in inventory.\n\nAdd it as a new item?`,
          [
            { text: 'Cancel', style: 'cancel', onPress: () => setScanned(false) },
            {
              text: 'Add New Item',
              onPress: () => router.push({ pathname: '/', params: { barcode: data } }),
            },
          ]
        );
      }
    } catch (err) {
      Alert.alert('Search Failed', `Could not query SheetDB.\n${(err as Error).message}`);
      setScanned(false);
    } finally {
      setSearching(false);
    }
  };

  const handleAddStock = async () => {
    if (!foundItem) return;
    const qty = Number(addQty);
    if (!Number.isFinite(qty) || qty <= 0) {
      Alert.alert('Invalid Quantity', 'Please enter a positive whole number.');
      return;
    }

    setUpdating(true);
    try {
      const res = await fetch(`${SHEETDB_URL}/id/${encodeURIComponent(foundItem.id)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data: { current_stock: `value+${qty}` } }),
      });
      if (!res.ok) throw new Error(`SheetDB returned ${res.status}`);

      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

      Alert.alert(
        'Stock Updated',
        `Added ${qty} unit(s) to "${foundItem.name}".\nNew stock: ${Number(foundItem.current_stock) + qty} ${foundItem.unit_type}`,
        [
          {
            text: 'Scan Another',
            onPress: () => {
              setModalVisible(false);
              setFoundItem(null);
              setScanned(false);
            },
          },
        ]
      );
    } catch (err) {
      Alert.alert('Update Failed', (err as Error).message);
    } finally {
      setUpdating(false);
    }
  };

  const dismissModal = () => {
    setModalVisible(false);
    setFoundItem(null);
    setScanned(false);
  };

  if (!permission) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color="#D4880A" size="large" />
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={styles.centered}>
        <Ionicons name="camera-off-outline" size={52} color="#333333" />
        <Text style={styles.permTitle}>Camera Access Required</Text>
        <Text style={styles.permSub}>Grant camera permission to scan barcodes.</Text>
        <TouchableOpacity style={styles.permBtn} onPress={requestPermission}>
          <Text style={styles.permBtnText}>GRANT PERMISSION</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <CameraView
        style={StyleSheet.absoluteFillObject}
        facing="back"
        barcodeScannerSettings={{
          barcodeTypes: ['ean13', 'ean8', 'upc_a', 'upc_e', 'code128', 'code39', 'qr'],
        }}
        onBarcodeScanned={scanned ? undefined : handleBarcodeScanned}
      />

      {/* Viewfinder overlay */}
      <View style={StyleSheet.absoluteFillObject} pointerEvents="none">
        <View style={styles.vigTop} />
        <View style={{ flexDirection: 'row', height: FRAME_SIZE }}>
          <View style={styles.vigSide} />
          <View style={styles.frame}>
            <View style={[styles.corner, styles.tl]} />
            <View style={[styles.corner, styles.tr]} />
            <View style={[styles.corner, styles.bl]} />
            <View style={[styles.corner, styles.br]} />
          </View>
          <View style={styles.vigSide} />
        </View>
        <View style={styles.vigBottom}>
          {searching ? (
            <ActivityIndicator color="#D4880A" style={{ marginTop: 20 }} />
          ) : (
            <Text style={styles.hint}>
              {scanned ? 'Processing…' : 'Align barcode within the frame'}
            </Text>
          )}
        </View>
      </View>

      {scanned && !searching && !modalVisible && (
        <View style={styles.rescanRow}>
          <TouchableOpacity style={styles.rescanBtn} onPress={() => setScanned(false)}>
            <Ionicons name="refresh" size={15} color="#FFFFFF" />
            <Text style={styles.rescanText}>SCAN AGAIN</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* ── Stock Add Modal ─────────────────────────────────────────────────── */}
      <Modal visible={modalVisible} transparent animationType="slide" onRequestClose={dismissModal}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHandle} />

            <Text style={styles.modalEyebrow}>ITEM FOUND</Text>
            <Text style={styles.modalItemName} numberOfLines={2}>
              {foundItem?.name}
            </Text>

            <View style={styles.modalMetaRow}>
              <View style={styles.modalChip}>
                <Text style={styles.modalChipText}>{foundItem?.category}</Text>
              </View>
              <View style={[styles.modalChip, { borderColor: '#1B6B38' }]}>
                <Text style={[styles.modalChipText, { color: '#1B6B38' }]}>
                  {foundItem?.current_stock} {foundItem?.unit_type} in stock
                </Text>
              </View>
            </View>

            <Text style={styles.modalInputLabel}>UNITS TO ADD</Text>
            <TextInput
              style={styles.modalInput}
              value={addQty}
              onChangeText={setAddQty}
              keyboardType="number-pad"
              placeholder="1"
              placeholderTextColor="#444444"
              autoFocus
              selectTextOnFocus
            />

            <View style={styles.modalBtnRow}>
              <TouchableOpacity style={styles.cancelBtn} onPress={dismissModal}>
                <Text style={styles.cancelBtnText}>CANCEL</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.confirmBtn, updating && { opacity: 0.4 }]}
                onPress={handleAddStock}
                disabled={updating}
              >
                {updating ? (
                  <ActivityIndicator color="#FFFFFF" size="small" />
                ) : (
                  <>
                    <Ionicons name="add" size={18} color="#FFFFFF" />
                    <Text style={styles.confirmBtnText}>ADD STOCK</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const VIGNETTE = 'rgba(0,0,0,0.62)';

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  centered: {
    flex: 1,
    backgroundColor: '#0D0D0D',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
    gap: 14,
  },
  permTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#F0F0F0',
    textAlign: 'center',
  },
  permSub: {
    fontSize: 14,
    color: '#666666',
    textAlign: 'center',
    lineHeight: 22,
  },
  permBtn: {
    marginTop: 8,
    backgroundColor: '#1B6B38',
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#2A8A4A',
  },
  permBtnText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 11,
    letterSpacing: 2,
  },
  vigTop: { flex: 1, backgroundColor: VIGNETTE },
  vigSide: { flex: 1, backgroundColor: VIGNETTE },
  vigBottom: {
    flex: 1,
    backgroundColor: VIGNETTE,
    alignItems: 'center',
    paddingTop: 24,
  },
  hint: {
    color: '#F0F0F0',
    fontSize: 13,
    fontWeight: '500',
    letterSpacing: 0.5,
    opacity: 0.9,
  },
  frame: { width: FRAME_SIZE, height: FRAME_SIZE },
  corner: {
    position: 'absolute',
    width: CORNER,
    height: CORNER,
    borderColor: '#D4880A',
  },
  tl: { top: 0, left: 0, borderTopWidth: BORDER, borderLeftWidth: BORDER },
  tr: { top: 0, right: 0, borderTopWidth: BORDER, borderRightWidth: BORDER },
  bl: { bottom: 0, left: 0, borderBottomWidth: BORDER, borderLeftWidth: BORDER },
  br: { bottom: 0, right: 0, borderBottomWidth: BORDER, borderRightWidth: BORDER },
  rescanRow: {
    position: 'absolute',
    bottom: Platform.OS === 'ios' ? 110 : 90,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  rescanBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    backgroundColor: '#1B6B38',
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#2A8A4A',
  },
  rescanText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 11,
    letterSpacing: 1.5,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.72)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: '#1A1A1A',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    padding: 28,
    paddingBottom: Platform.OS === 'ios' ? 48 : 32,
    borderTopWidth: 1,
    borderColor: '#2A2A2A',
  },
  modalHandle: {
    alignSelf: 'center',
    width: 36,
    height: 3,
    backgroundColor: '#333333',
    borderRadius: 2,
    marginBottom: 24,
  },
  modalEyebrow: {
    fontSize: 10,
    fontWeight: '800',
    color: '#D4880A',
    letterSpacing: 2.5,
    marginBottom: 8,
  },
  modalItemName: {
    fontSize: 22,
    fontWeight: '800',
    color: '#F0F0F0',
    marginBottom: 14,
    lineHeight: 28,
  },
  modalMetaRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 28,
    flexWrap: 'wrap',
  },
  modalChip: {
    backgroundColor: '#111111',
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: '#2A2A2A',
  },
  modalChipText: {
    color: '#888888',
    fontSize: 12,
    fontWeight: '600',
  },
  modalInputLabel: {
    fontSize: 10,
    color: '#666666',
    fontWeight: '700',
    marginBottom: 10,
    letterSpacing: 1.5,
  },
  modalInput: {
    backgroundColor: '#111111',
    borderWidth: 1,
    borderColor: '#D4880A',
    borderRadius: 6,
    paddingVertical: 18,
    paddingHorizontal: 20,
    color: '#F0F0F0',
    fontSize: 32,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 24,
    letterSpacing: -1,
  },
  modalBtnRow: { flexDirection: 'row', gap: 12 },
  cancelBtn: {
    flex: 1,
    backgroundColor: '#111111',
    borderRadius: 6,
    paddingVertical: 18,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#2A2A2A',
  },
  cancelBtnText: {
    color: '#888888',
    fontWeight: '700',
    fontSize: 11,
    letterSpacing: 1.5,
  },
  confirmBtn: {
    flex: 2,
    backgroundColor: '#1B6B38',
    borderRadius: 6,
    paddingVertical: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: '#2A8A4A',
  },
  confirmBtnText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 11,
    letterSpacing: 1.5,
  },
});
