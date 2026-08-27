import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  SafeAreaView,
} from 'react-native';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { useNavigation, useRoute } from '@react-navigation/native';

import { API_ENDPOINTS } from '../../config/api.config'; // adjust path if your apiConfig lives elsewhere
import { useCustomer } from '../../contexts/DisplayNameContext';
import Header from '../../components/Header'; // adjust path to wherever Header.tsx actually lives
import { LayoutWrapper } from '../../components/AppLayout';

type ExpiryStatus =
  | 'EXPIRED'
  | 'CRITICAL'
  | 'WARNING'
  | 'UPCOMING'
  | 'NO_EXPIRY';

interface ExpiryAlertItem {
  ITEM_ID: number;
  ITEM_CODE: string;
  ITEM_NAME: string;
  ITEM_CATEGORY_ID: number;
  ITEM_SUB_CATEGORY_ID: number;
  CUSTOMER_ID: number;
  CUSTOMER_NAME: string;
  LOT_NO: number;
  ITEM_MARKS: string;
  VAKAL_NO: string;
  BATCH_NO: string | null;
  AVAILABLE_QTY: number;
  BALANCE_QTY: number;
  BOX_QUANTITY: number;
  QUANTITY: number;
  EXPIRY_DATE: string;
  UNIT_NAME: string;
  DAYS_TO_EXPIRY: number;
  EXPIRY_STATUS: ExpiryStatus;
}

interface ExpiryAlertSummary {
  total: number;
  EXPIRED: number;
  CRITICAL: number;
  WARNING: number;
  UPCOMING: number;
  NO_EXPIRY: number;
}

interface ExpiryAlertResponse {
  success: boolean;
  input: Record<string, any>;
  summary: ExpiryAlertSummary;
  output: ExpiryAlertItem[];
}

type TabKey = 'ALL' | 'EXPIRED' | 'CRITICAL' | 'WARNING' | 'UPCOMING';

// ─────────────────────────────────────────────────────────────
// Brand tokens — matches the rest of the app
// (headerTintColor '#0284c7', accent '#F48221', white surfaces)
// ─────────────────────────────────────────────────────────────

const COLORS = {
  background: '#F5F6F8',
  surface: '#FFFFFF',
  text: '#1F2937',
  textMuted: '#6B7280',
  border: '#EEF0F2',
  brandOrange: '#F48221',
  brandBlue: '#0284c7',
};

const STATUS_META: Record<
  ExpiryStatus,
  { label: string; color: string; bg: string; icon: string }
> = {
  EXPIRED: {
    label: 'Expired',
    color: '#DC2626',
    bg: '#FDEAEA',
    icon: 'cancel',
  },
  CRITICAL: {
    label: 'Critical',
    color: '#F97316',
    bg: '#FFEDE0',
    icon: 'warning',
  },
  WARNING: {
    label: 'Warning',
    color: '#D97706',
    bg: '#FEF3D8',
    icon: 'schedule',
  },
  UPCOMING: {
    label: 'Upcoming',
    color: '#16A34A',
    bg: '#E4F7EA',
    icon: 'event-available',
  },
  NO_EXPIRY: {
    label: 'No Expiry',
    color: '#6B7280',
    bg: '#F1F2F4',
    icon: 'all-inclusive',
  },
};

const TABS: TabKey[] = ['ALL', 'EXPIRED', 'CRITICAL', 'WARNING', 'UPCOMING'];

// ─────────────────────────────────────────────────────────────
// Screen
// ─────────────────────────────────────────────────────────────

const AlertScreen: React.FC = () => {
  const route = useRoute();
  const { customerID } = useCustomer(); // string | null, provided app-wide by CustomerProvider

  const [activeTab, setActiveTab] = useState<TabKey>('ALL');
  const [summary, setSummary] = useState<ExpiryAlertSummary | null>(null);
  const [alerts, setAlerts] = useState<ExpiryAlertItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchAlerts = useCallback(
    async (isRefresh = false) => {
      if (!customerID) {
        setError('Customer not found for this account.');
        setLoading(false);
        return;
      }

      const numericCustomerID = Number(customerID);
      if (Number.isNaN(numericCustomerID)) {
        setError('Invalid customer ID.');
        setLoading(false);
        return;
      }

      isRefresh ? setRefreshing(true) : setLoading(true);
      setError(null);

      const url = API_ENDPOINTS.EXPIRY_ALERTS(numericCustomerID);
      console.log('[AlertScreen] Fetching expiry alerts...', { url });

      try {
        const response = await fetch(url, {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' },
        });

        console.log(
          '[AlertScreen] Response status:',
          response.status,
          response.ok,
        );

        const rawText = await response.text();
        console.log('[AlertScreen] Raw response body:', rawText);

        if (!response.ok) {
          setError(
            `Server error (${response.status}). Check logs for details.`,
          );
          return;
        }

        let data: ExpiryAlertResponse;
        try {
          data = JSON.parse(rawText);
        } catch (parseErr) {
          console.error(
            '[AlertScreen] Failed to parse JSON response:',
            parseErr,
          );
          setError('Received an invalid response from the server.');
          return;
        }

        console.log('[AlertScreen] Parsed response:', {
          success: data.success,
          summary: data.summary,
          outputCount: data.output?.length,
        });

        if (data.success) {
          setSummary(data.summary);
          setAlerts(data.output || []);
        } else {
          console.warn('[AlertScreen] API returned success: false', data);
          setError('Could not load alerts. Please try again.');
        }
      } catch (err: any) {
        console.error(
          '[AlertScreen] Network/fetch error:',
          err?.message ?? err,
          err,
        );
        setError(
          `Something went wrong while fetching alerts. (${
            err?.message ?? 'Unknown error'
          })`,
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [customerID],
  );

  useEffect(() => {
    fetchAlerts();
  }, [fetchAlerts]);

  const filteredAlerts = useMemo(() => {
    if (activeTab === 'ALL') return alerts;
    return alerts.filter(item => item.EXPIRY_STATUS === activeTab);
  }, [alerts, activeTab]);

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  };

  // Days-to-expiry gets its own clear, readable phrasing per status
  const renderDaysLabel = (days: number, status: ExpiryStatus) => {
    if (status === 'NO_EXPIRY') return 'No expiry date';
    if (status === 'EXPIRED')
      return `Expired ${Math.abs(days)} day${
        Math.abs(days) === 1 ? '' : 's'
      } ago`;
    if (days === 0) return 'Expires today';
    if (days === 1) return 'Expires tomorrow';
    return `${days} days to expiry`;
  };

  // ── Summary cards (unchanged design, just made smaller) ──
  const renderSummaryCards = () => {
    if (!summary) return null;
    const cards: { key: TabKey; count: number }[] = [
      { key: 'EXPIRED', count: summary.EXPIRED },
      { key: 'CRITICAL', count: summary.CRITICAL },
      { key: 'WARNING', count: summary.WARNING },
      { key: 'UPCOMING', count: summary.UPCOMING },
    ];

    return (
      <View style={styles.summaryGrid}>
        {cards.map(card => {
          const meta = STATUS_META[card.key as ExpiryStatus];
          const isActive = activeTab === card.key;
          return (
            <TouchableOpacity
              key={card.key}
              style={[
                styles.summaryCard,
                isActive && { borderColor: meta.color, borderWidth: 1.5 },
              ]}
              onPress={() => setActiveTab(card.key)}
              activeOpacity={0.8}
            >
              <View
                style={[styles.summaryIconWrap, { backgroundColor: meta.bg }]}
              >
                <MaterialIcons name={meta.icon} size={14} color={meta.color} />
              </View>
              <Text style={styles.summaryCount}>{card.count}</Text>
              <Text style={styles.summaryLabel}>{meta.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
    );
  };

  // ── Tab strip (unchanged) ────────────────────────────────
  const renderTabs = () => (
    <View style={styles.tabStrip}>
      {TABS.map(tab => {
        const isActive = activeTab === tab;
        const label =
          tab === 'ALL' ? 'All' : STATUS_META[tab as ExpiryStatus].label;
        const count =
          tab === 'ALL'
            ? summary?.total ?? 0
            : (summary?.[tab as keyof ExpiryAlertSummary] as number) ?? 0;
        return (
          <TouchableOpacity
            key={tab}
            style={[styles.tabChip, isActive && styles.tabChipActive]}
            onPress={() => setActiveTab(tab)}
          >
            <Text
              style={[styles.tabChipText, isActive && styles.tabChipTextActive]}
            >
              {label} ({count})
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );

  // ── List item (unchanged) ──
  const renderItem = ({ item }: { item: ExpiryAlertItem }) => {
    const meta = STATUS_META[item.EXPIRY_STATUS];
    return (
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={{ flex: 1, paddingRight: 8 }}>
            <Text style={styles.itemName} numberOfLines={1}>
              {item.ITEM_NAME}
            </Text>
            <Text style={styles.itemCode}>
              Lot <Text style={styles.lotHighlight}>{item.LOT_NO}</Text>
            </Text>
          </View>
          <View style={[styles.statusPill, { backgroundColor: meta.bg }]}>
            <MaterialIcons name={meta.icon} size={13} color={meta.color} />
            <Text style={[styles.statusPillText, { color: meta.color }]}>
              {meta.label}
            </Text>
          </View>
        </View>

        <View style={styles.detailRow}>
          <DetailBlock label="Vakal No" value={item.VAKAL_NO || '-'} />
          <DetailBlock label="Marks" value={item.ITEM_MARKS || '-'} />
        </View>
        <View style={styles.detailRow}>
          <DetailBlock
            label="Available Qty"
            value={String(item.AVAILABLE_QTY)}
          />
          <DetailBlock label="Unit" value={item.UNIT_NAME || '-'} />
        </View>

        <View style={[styles.daysBanner, { backgroundColor: meta.bg }]}>
          <MaterialCommunityIcons
            name="calendar-clock-outline"
            size={16}
            color={meta.color}
          />
          <Text style={[styles.daysBannerText, { color: meta.color }]}>
            {renderDaysLabel(item.DAYS_TO_EXPIRY, item.EXPIRY_STATUS)}
          </Text>
          <Text style={[styles.daysBannerDate, { color: meta.color }]}>
            {item.EXPIRY_STATUS === 'NO_EXPIRY'
              ? ''
              : formatDate(item.EXPIRY_DATE)}
          </Text>
        </View>
      </View>
    );
  };

  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <MaterialCommunityIcons
        name="bell-check-outline"
        size={52}
        color="#D1D5DB"
      />
      <Text style={styles.emptyTitle}>No alerts here</Text>
      <Text style={styles.emptySubtitle}>
        {activeTab === 'ALL'
          ? "You're all caught up. No expiry alerts to show."
          : `No items in "${
              STATUS_META[activeTab as ExpiryStatus]?.label ?? activeTab
            }" right now.`}
      </Text>
    </View>
  );

  // ── Screen states ────────────────────────────
  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <Header displayName="Alerts" cartItemCount={0} />
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={COLORS.brandOrange} />
          <Text style={styles.loadingText}>Loading alerts...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={styles.container}>
        <Header displayName="Alerts" cartItemCount={0} />
        <View style={styles.centered}>
          <MaterialIcons name="error-outline" size={46} color="#DC2626" />
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity
            style={styles.retryButton}
            onPress={() => fetchAlerts()}
          >
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <LayoutWrapper showHeader={true} route={route} showTabBar={false}>
      <SafeAreaView style={styles.container}>
        {renderSummaryCards()}
        {renderTabs()}

        <FlatList
          data={filteredAlerts}
          keyExtractor={(item, idx) => `${item.ITEM_ID}-${item.LOT_NO}-${idx}`}
          renderItem={renderItem}
          contentContainerStyle={
            filteredAlerts.length === 0
              ? styles.listEmptyContainer
              : styles.listContainer
          }
          ListEmptyComponent={renderEmptyState}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => fetchAlerts(true)}
              colors={[COLORS.brandOrange]}
              tintColor={COLORS.brandOrange}
            />
          }
          showsVerticalScrollIndicator={false}
        />
      </SafeAreaView>
    </LayoutWrapper>
  );
};

// Small reusable label/value block for the card detail rows
const DetailBlock: React.FC<{ label: string; value: string }> = ({
  label,
  value,
}) => (
  <View style={styles.detailBlock}>
    <Text style={styles.detailLabel}>{label}</Text>
    <Text style={styles.detailValue} numberOfLines={1}>
      {value}
    </Text>
  </View>
);

export default AlertScreen;

// ─────────────────────────────────────────────────────────────
// Styles
// ─────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  screenTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: COLORS.surface,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  screenTitleText: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.text,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  loadingText: {
    marginTop: 12,
    color: COLORS.textMuted,
    fontSize: 14,
  },
  errorText: {
    marginTop: 12,
    color: COLORS.text,
    fontSize: 14,
    textAlign: 'center',
  },
  retryButton: {
    marginTop: 16,
    backgroundColor: COLORS.brandOrange,
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#fff',
    fontWeight: '600',
  },

  // Summary cards
  summaryGrid: {
    flexDirection: 'row',
    paddingHorizontal: 12,
    paddingTop: 12,
    paddingBottom: 4,
    gap: 6,
  },
  summaryCard: {
    flex: 1,
    backgroundColor: COLORS.surface,
    borderRadius: 10,
    paddingVertical: 6,
    paddingHorizontal: 4,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  summaryIconWrap: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  summaryCount: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.text,
    marginTop: 3,
  },
  summaryLabel: {
    fontSize: 9.5,
    fontWeight: '500',
    color: COLORS.textMuted,
    marginTop: 0,
  },

  // Tabs
  tabStrip: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8,
  },
  tabChip: {
    paddingHorizontal: 13,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  tabChipActive: {
    backgroundColor: COLORS.brandOrange,
    borderColor: COLORS.brandOrange,
  },
  tabChipText: {
    fontSize: 12.5,
    fontWeight: '600',
    color: COLORS.textMuted,
  },
  tabChipTextActive: {
    color: '#fff',
  },

  // List
  listContainer: {
    paddingHorizontal: 12,
    paddingBottom: 24,
  },
  listEmptyContainer: {
    flexGrow: 1,
  },
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  itemName: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.text,
  },
  itemCode: {
    fontSize: 12,
    color: COLORS.textMuted,
    marginTop: 2,
  },
  lotHighlight: {
    color: COLORS.brandOrange,
    fontWeight: '700',
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 20,
    gap: 4,
  },
  statusPillText: {
    fontSize: 11.5,
    fontWeight: '700',
  },

  daysBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 10,
    marginTop: 10,
    gap: 6,
  },
  daysBannerText: {
    flex: 1,
    fontSize: 13.5,
    fontWeight: '700',
  },
  daysBannerDate: {
    fontSize: 12,
    fontWeight: '600',
    opacity: 0.85,
  },

  detailRow: {
    flexDirection: 'row',
    marginBottom: 6,
  },
  detailBlock: {
    flex: 1,
  },
  detailLabel: {
    fontSize: 11,
    color: COLORS.textMuted,
    marginBottom: 2,
  },
  detailValue: {
    fontSize: 13,
    color: COLORS.text,
    fontWeight: '600',
  },

  // Empty state
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    paddingTop: 80,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.text,
    marginTop: 12,
  },
  emptySubtitle: {
    fontSize: 13,
    color: COLORS.textMuted,
    textAlign: 'center',
    marginTop: 6,
  },
});
