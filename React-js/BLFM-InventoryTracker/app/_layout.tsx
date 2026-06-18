import { Tabs } from 'expo-router';
import { Platform, View, Text, Image, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

type IoniconsName = React.ComponentProps<typeof Ionicons>['name'];

function TabIcon({ name, color, size }: { name: IoniconsName; color: string; size: number }) {
  return <Ionicons name={name} size={size} color={color} />;
}

function BLFMHeader({ title }: { title: string }) {
  return (
    <View style={styles.headerRow}>
      <Image
        source={require('../assets/logo.png')}
        style={styles.logo}
        resizeMode="contain"
      />
      <View style={styles.headerTextCol}>
        <Text style={styles.headerTitle}>{title}</Text>
        <Text style={styles.headerSub}>Buffet Lucia's Fiesta Mexicana</Text>
      </View>
    </View>
  );
}

export default function RootLayout() {
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: '#D4880A',
        tabBarInactiveTintColor: '#555555',
        tabBarStyle: {
          backgroundColor: '#111111',
          borderTopColor: '#2A2A2A',
          borderTopWidth: 1,
          height: Platform.OS === 'ios' ? 88 : 68,
          paddingBottom: Platform.OS === 'ios' ? 28 : 10,
          paddingTop: 8,
        },
        tabBarLabelStyle: {
          fontSize: 10,
          fontWeight: '700',
          letterSpacing: 1,
        },
        headerStyle: { backgroundColor: '#111111' },
        headerTintColor: '#F0F0F0',
        headerShadowVisible: false,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Dashboard',
          headerTitle: () => <BLFMHeader title="BLFM INVENTORY" />,
          tabBarIcon: ({ color, size }) => (
            <TabIcon name="grid-outline" color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="scanner"
        options={{
          title: 'Scanner',
          headerTitle: () => <BLFMHeader title="BARCODE SCANNER" />,
          tabBarIcon: ({ color, size }) => (
            <TabIcon name="scan-outline" color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="receipt"
        options={{
          title: 'Receipt',
          headerTitle: () => <BLFMHeader title="RECEIPT CAPTURE" />,
          tabBarIcon: ({ color, size }) => (
            <TabIcon name="camera-outline" color={color} size={size} />
          ),
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  logo: {
    width: 42,
    height: 42,
  },
  headerTextCol: {
    flexDirection: 'column',
    justifyContent: 'center',
  },
  headerTitle: {
    color: '#F0F0F0',
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 2,
  },
  headerSub: {
    color: '#D4880A',
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 0.5,
    marginTop: 1,
  },
});
