import React, { useState, useRef, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Modal,
  FlatList,
} from 'react-native';
import axios from 'axios';
import { format } from 'date-fns';
import { API_ENDPOINTS, getAuthHeaders } from '../../config/api.config';
import { useRoute } from '@react-navigation/core';
import { LayoutWrapper } from '../../components/AppLayout';
import DateTimePickerModal from 'react-native-modal-datetime-picker';
import { getSecureOrAsyncItem } from '../../utils/migrationHelper';

// ─── Constants ───────────────────────────────────────────────────────────────

// Add / edit your units here (or replace with an API call if you have one).
// `null` value = all units (unitName is sent as null).
const UNIT_OPTIONS: { label: string; value: string | null }[] = [
  { label: 'All Units', value: null },
  { label: 'D-39', value: 'D-39' },
  { label: 'D-514', value: 'D-514' },
];

// ─── Types ───────────────────────────────────────────────────────────────────

interface SummaryData {
  inward?: {
    TOTAL_INWARD_QUANTITY?: number | string;
  };
  outward?: {
    TOTAL_OUTWARD_QUANTITY?: number | string;
    TOTAL_REQUESTED_QUANTITY?: number | string;
  };
  summary?: {
    NET_QUANTITY: number;
    PENDING_QUANTITY?: number | string;
    DELIVERY_FULFILLMENT_RATE?: number | string;
  };
}

interface ItemWiseData {
  ITEM_ID?: number | string;
  ITEM_NAME?: string;
  ITEM_CATEG_NAME?: string;
  SUB_CATEGORY_NAME?: string;
  TOTAL_INWARD_QUANTITY?: number | string;
  TOTAL_OUTWARD_QUANTITY?: number | string;
  TOTAL_REQUESTED_QUANTITY?: number | string;
  NET_QUANTITY?: number | string;
}

interface Filters {
  customerName?: string | null;
  customerId?: string | number | null;
  itemCategoryName?: string | null;
  itemSubCategoryName?: string | null;
  unitName?: string | null;
  dateRange?: string;
  fromDate?: string;
  toDate?: string;
}

interface ApiResponse {
  success: boolean;
  data: SummaryData | ItemWiseData[];
  filters?: Filters;
  message?: string;
  error?: string;
}

// ─── Component ───────────────────────────────────────────────────────────────

const ReportSummaryScreen: React.FC = () => {
  const route = useRoute();

  // Dates — no default, user must select
  const [fromDate, setFromDate] = useState<Date | null>(null);
  const [toDate, setToDate] = useState<Date | null>(null);

  // Unit selection
  const [selectedUnit, setSelectedUnit] = useState<string | null>(null);
  const [showUnitDropdown, setShowUnitDropdown] = useState<boolean>(false);

  // Picker visibility
  const [showFromDatePicker, setShowFromDatePicker] = useState<boolean>(false);
  const [showToDatePicker, setShowToDatePicker] = useState<boolean>(false);

  // Data state
  const [summaryData, setSummaryData] = useState<
    SummaryData | ItemWiseData[] | null
  >(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<Filters>({
    customerName: null,
    customerId: null,
    itemCategoryName: null,
    itemSubCategoryName: null,
    unitName: null,
  });
  const [reportType, setReportType] = useState<'all' | 'itemwise'>('all');

  const scrollViewRef = useRef<ScrollView>(null);

  // ─── Date Helpers ─────────────────────────────────────────────────────────

  const formatDisplayDate = (date: Date | null): string => {
    return date ? format(date, 'dd/MM/yyyy') : 'Select date';
  };

  const formatApiDate = (date: Date): string => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  // ─── Date Picker Handlers ─────────────────────────────────────────────────

  const handleFromDateConfirm = (date: Date) => {
    setFromDate(date);
    setShowFromDatePicker(false);
    // If the existing "to" date is now before "from", clear it
    if (toDate && date > toDate) {
      setToDate(null);
    }
  };

  const handleToDateConfirm = (date: Date) => {
    setToDate(date);
    setShowToDatePicker(false);
  };

  // ─── Unit Handler ─────────────────────────────────────────────────────────

  const handleUnitSelect = (unit: string | null) => {
    setSelectedUnit(unit);
    setShowUnitDropdown(false);
    setSummaryData(null);
  };

  const selectedUnitLabel =
    UNIT_OPTIONS.find(u => u.value === selectedUnit)?.label ?? 'Select unit';

  // ─── Number Formatter ─────────────────────────────────────────────────────

  const formatNumber = (
    value: number | string | undefined | null,
    decimals: number = 2,
  ): string => {
    if (value === undefined || value === null || value === '') {
      return '0';
    }

    const num = typeof value === 'string' ? parseFloat(value) : Number(value);

    if (isNaN(num)) {
      return '0';
    }

    // Whole numbers
    if (Number.isInteger(num)) {
      return num.toLocaleString('en-IN', {
        maximumFractionDigits: 0,
      });
    }

    // Decimal numbers
    return num.toLocaleString('en-IN', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    });
  };

  // ─── Report Type ──────────────────────────────────────────────────────────

  const handleReportTypeChange = (type: 'all' | 'itemwise') => {
    if (type !== reportType) {
      setReportType(type);
      setSummaryData(null);
      setError(null);
      // Only auto-fetch if dates were already chosen
      if (fromDate && toDate) {
        handleApplyDates(type);
      }
    }
  };

  // ─── Fetch Data ───────────────────────────────────────────────────────────

  const handleApplyDates = async (typeOverride?: 'all' | 'itemwise') => {
    const currentType = typeOverride ?? reportType;

    if (!fromDate || !toDate) {
      Alert.alert('Select Dates', 'Please select both From and To dates.');
      return;
    }

    if (fromDate > toDate) {
      Alert.alert('Invalid Range', 'From date cannot be after To date.');
      return;
    }

    setSummaryData(null);
    setLoading(true);
    setError(null);

    try {
      const headers = await getAuthHeaders();

      // Customer info comes from the logged-in session (secure storage),
      // the same keys that the app-wide providers use.
      const [storedCustomerId, storedCustomerName] = await Promise.all([
        getSecureOrAsyncItem('customerID'),
        getSecureOrAsyncItem('Disp_name'),
      ]);

      if (!storedCustomerId || !storedCustomerName) {
        throw new Error(
          'Customer details not found. Please log in again and retry.',
        );
      }

      const customerIdNum = Number(storedCustomerId);

      const payload = {
        fromDate: formatApiDate(fromDate),
        toDate: formatApiDate(toDate),
        customerName: storedCustomerName,
        customerID: Number.isNaN(customerIdNum)
          ? storedCustomerId
          : customerIdNum,
        itemCategoryName: null,
        itemSubCategoryName: null,
        unitName: selectedUnit, // null => all units
      };

      const apiEndpoint =
        currentType === 'all'
          ? API_ENDPOINTS.GET_ALL_SUMMARY
          : API_ENDPOINTS.GET_ITEMWISE_SUMMARY;

      const response = await axios.post<ApiResponse>(apiEndpoint, payload, {
        headers: {
          ...headers,
          'Cache-Control': 'no-cache',
        },
      });

      if (response.data && response.data.success) {
        if (currentType === 'all') {
          setSummaryData(response.data.data as SummaryData);
        } else {
          setSummaryData(response.data.data as unknown as ItemWiseData[]);
        }

        if (response.data.filters) {
          setFilters(response.data.filters);
        }
      } else {
        const errorMessage =
          response.data?.message || 'Failed to fetch report data';
        setError(errorMessage);
      }
    } catch (err: any) {
      const errorMessage =
        err.response?.data?.message ||
        err.response?.data?.error ||
        err.message ||
        'An error occurred';

      setError(errorMessage);
      Alert.alert('Error', `Failed to fetch report data: ${errorMessage}`, [
        { text: 'OK' },
      ]);
    } finally {
      setLoading(false);
    }
  };

  // ─── Type Guards ──────────────────────────────────────────────────────────

  const isSummaryData = (data: any): data is SummaryData => {
    return (
      data && !Array.isArray(data) && 'inward' in data && 'outward' in data
    );
  };

  const isItemWiseData = (data: any): data is ItemWiseData[] => {
    return (
      data && Array.isArray(data) && data.length > 0 && 'ITEM_NAME' in data[0]
    );
  };

  // ─── Sorted item-wise data (A → Z by item name) ───────────────────────────

  const sortedItemWiseData = useMemo<ItemWiseData[]>(() => {
    if (!Array.isArray(summaryData)) {
      return [];
    }
    return [...summaryData].sort((a, b) =>
      (a.ITEM_NAME || '')
        .trim()
        .localeCompare((b.ITEM_NAME || '').trim(), undefined, {
          sensitivity: 'base',
          numeric: true,
        }),
    );
  }, [summaryData]);

  // ─── Render Summary ───────────────────────────────────────────────────────

  const renderSummaryData = () => {
    if (!summaryData) {
      return (
        <View style={styles.reportSection}>
          <Text style={styles.emptyMessage}>
            Select a date range and press "Apply Date Range" to view the report
          </Text>
        </View>
      );
    }

    if (!isSummaryData(summaryData)) {
      return (
        <View style={styles.reportSection}>
          <Text style={styles.emptyMessage}>
            No summary data available. Please select the "All" report type.
          </Text>
        </View>
      );
    }

    const inward = summaryData.inward || {};
    const outward = summaryData.outward || {};
    const summary = summaryData.summary || {};

    const hasData =
      inward.TOTAL_INWARD_QUANTITY != null ||
      outward.TOTAL_OUTWARD_QUANTITY != null;

    if (!hasData) {
      return (
        <View style={styles.reportSection}>
          <Text style={styles.emptyMessage}>
            No report data found for the selected date range. Try selecting a
            different date range.
          </Text>
        </View>
      );
    }

    return (
      <>
        <View style={styles.reportSection}>
          <Text style={styles.sectionTitle}>Inward Summary</Text>
          <View style={styles.metricRow}>
            <Text style={styles.metricLabel}>Total Quantity:</Text>
            <Text style={styles.metricValue}>
              {formatNumber(inward.TOTAL_INWARD_QUANTITY)}
            </Text>
          </View>
        </View>

        <View style={styles.reportSection}>
          <Text style={styles.sectionTitle}>Outward Summary</Text>
          <View style={styles.metricRow}>
            <Text style={styles.metricLabel}>Total Quantity:</Text>
            <Text style={styles.metricValue}>
              {formatNumber(outward.TOTAL_OUTWARD_QUANTITY)}
            </Text>
          </View>
          <View style={styles.metricRow}>
            <Text style={styles.metricLabel}>Requested Quantity:</Text>
            <Text style={styles.metricValue}>
              {formatNumber(outward.TOTAL_REQUESTED_QUANTITY)}
            </Text>
          </View>
        </View>

        <View style={styles.reportSection}>
          <Text style={styles.sectionTitle}>Summary</Text>
          <View style={styles.metricRow}>
            <Text style={styles.metricLabel}>Net Quantity:</Text>
            <Text style={styles.metricValue}>
              {formatNumber(summary.NET_QUANTITY)}
            </Text>
          </View>
          <View style={styles.metricRow}>
            <Text style={styles.metricLabel}>Pending Quantity:</Text>
            <Text style={styles.metricValue}>
              {formatNumber(summary.PENDING_QUANTITY)}
            </Text>
          </View>
          <View style={styles.metricRow}>
            <Text style={styles.metricLabel}>Fulfillment Rate:</Text>
            <Text style={styles.metricValue}>
              {formatNumber(summary.DELIVERY_FULFILLMENT_RATE)}%
            </Text>
          </View>
        </View>
      </>
    );
  };

  // ─── Render Item Wise ─────────────────────────────────────────────────────

  const renderItemWiseData = () => {
    if (!summaryData) {
      return (
        <View style={styles.reportSection}>
          <Text style={styles.emptyMessage}>
            Select a date range and press "Apply Date Range" to view item-wise
            data
          </Text>
        </View>
      );
    }

    if (!isItemWiseData(summaryData)) {
      return (
        <View style={styles.reportSection}>
          <Text style={styles.emptyMessage}>
            No item-wise data available. Please select the "Item-wise" report
            type.
          </Text>
        </View>
      );
    }

    const itemWiseData = sortedItemWiseData;

    if (itemWiseData.length === 0) {
      return (
        <View style={styles.reportSection}>
          <Text style={styles.emptyMessage}>
            No item data found for the selected date range. Try selecting a
            different date range.
          </Text>
        </View>
      );
    }

    return (
      <View style={[styles.reportSection, styles.itemWiseSection]}>
        <Text style={styles.sectionTitle}>
          Item-wise Summary ({itemWiseData.length} items)
        </Text>

        <View style={styles.tableWrapper}>
          <ScrollView
            horizontal={true}
            showsHorizontalScrollIndicator={true}
            style={{ flex: 1 }}
            contentContainerStyle={{ minWidth: 620 }}
          >
            <View style={styles.tableContainer}>
              {/* Header */}
              <View style={styles.tableHeader}>
                <View style={[styles.headerCell, { width: 200 }]}>
                  <Text style={styles.headerText} numberOfLines={2}>
                    Item Details
                  </Text>
                </View>
                <View style={[styles.headerCell, { width: 100 }]}>
                  <Text style={styles.headerText}>Inward Qty</Text>
                </View>
                <View style={[styles.headerCell, { width: 100 }]}>
                  <Text style={styles.headerText}>Outward Qty</Text>
                </View>
                <View style={[styles.headerCell, { width: 120 }]}>
                  <Text style={styles.headerText}>Requested Qty</Text>
                </View>
                <View style={[styles.headerCell, { width: 100 }]}>
                  <Text style={styles.headerText}>Net Qty</Text>
                </View>
              </View>

              {/* Rows */}
              <View style={{ flex: 1 }}>
                <ScrollView
                  style={{ flex: 1 }}
                  nestedScrollEnabled={true}
                  showsVerticalScrollIndicator={true}
                  persistentScrollbar={true}
                >
                  {itemWiseData.map((item, index) => (
                    <View
                      key={`${item.ITEM_ID}-${index}`}
                      style={[styles.tableRow, { minWidth: 620 }]}
                    >
                      <View style={[styles.dataCell, { width: 200 }]}>
                        <Text style={styles.itemName} numberOfLines={1}>
                          {item.ITEM_NAME || 'Unknown Item'}
                        </Text>
                      </View>
                      <View style={[styles.dataCell, { width: 100 }]}>
                        <Text style={styles.dataText}>
                          {formatNumber(item.TOTAL_INWARD_QUANTITY)}
                        </Text>
                      </View>
                      <View style={[styles.dataCell, { width: 100 }]}>
                        <Text style={styles.dataText}>
                          {formatNumber(item.TOTAL_OUTWARD_QUANTITY)}
                        </Text>
                      </View>
                      <View style={[styles.dataCell, { width: 120 }]}>
                        <Text style={styles.dataText}>
                          {formatNumber(item.TOTAL_REQUESTED_QUANTITY)}
                        </Text>
                      </View>
                      <View style={[styles.dataCell, { width: 100 }]}>
                        <Text
                          style={[
                            styles.dataText,
                            Number(item.NET_QUANTITY) > 0
                              ? styles.positive
                              : Number(item.NET_QUANTITY) < 0
                              ? styles.negative
                              : null,
                          ]}
                        >
                          {formatNumber(Math.abs(Number(item.NET_QUANTITY)))}
                        </Text>
                      </View>
                    </View>
                  ))}
                </ScrollView>
              </View>
            </View>
          </ScrollView>
        </View>
      </View>
    );
  };

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <LayoutWrapper showHeader={true} showTabBar={false} route={route}>
      <View style={styles.container}>
        {/* Title */}
        <View style={styles.titleContainer}>
          <Text style={styles.titleText}>Report Summary</Text>
        </View>

        {/* Date Range Selector */}
        <View style={styles.dateContainer}>
          <View style={styles.dateField}>
            <Text style={styles.dateLabel}>From:</Text>
            <TouchableOpacity
              style={styles.datePicker}
              onPress={() => setShowFromDatePicker(true)}
            >
              <Text
                style={[styles.dateText, !fromDate && styles.placeholderText]}
              >
                {formatDisplayDate(fromDate)}
              </Text>
            </TouchableOpacity>
          </View>

          <View style={styles.dateField}>
            <Text style={styles.dateLabel}>To:</Text>
            <TouchableOpacity
              style={styles.datePicker}
              onPress={() => setShowToDatePicker(true)}
            >
              <Text
                style={[styles.dateText, !toDate && styles.placeholderText]}
              >
                {formatDisplayDate(toDate)}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Unit Dropdown */}
        <View style={styles.dateContainer}>
          <View style={styles.dateField}>
            <Text style={styles.dateLabel}>Unit:</Text>
            <TouchableOpacity
              style={styles.unitDropdown}
              onPress={() => setShowUnitDropdown(true)}
              activeOpacity={0.7}
            >
              <Text
                style={[
                  styles.unitDropdownText,
                  selectedUnit === null && styles.placeholderText,
                ]}
                numberOfLines={1}
              >
                {selectedUnit === null ? 'All Units' : selectedUnitLabel}
              </Text>
              <Text style={styles.dropdownArrow}>▼</Text>
            </TouchableOpacity>
          </View>

          {/* Apply Button — same size/column as the date fields */}
          <View style={styles.dateField}>
            <Text style={styles.dateLabel}> </Text>
            <TouchableOpacity
              style={styles.applyButton}
              onPress={() => handleApplyDates()}
            >
              <Text style={styles.applyButtonText}>Apply</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Report Type Toggle */}
        <View style={styles.radioContainer}>
          <TouchableOpacity
            style={[
              styles.radioButton,
              reportType === 'all' && styles.radioSelected,
            ]}
            onPress={() => handleReportTypeChange('all')}
          >
            <View
              style={[
                styles.radioCircle,
                reportType === 'all' && { borderColor: '#F48221' },
              ]}
            >
              {reportType === 'all' && <View style={styles.radioFill} />}
            </View>
            <Text
              style={[
                styles.radioLabel,
                reportType === 'all' && styles.radioSelectedLabel,
              ]}
            >
              All
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.radioButton,
              reportType === 'itemwise' && styles.radioSelected,
            ]}
            onPress={() => handleReportTypeChange('itemwise')}
          >
            <View
              style={[
                styles.radioCircle,
                reportType === 'itemwise' && { borderColor: '#F48221' },
              ]}
            >
              {reportType === 'itemwise' && <View style={styles.radioFill} />}
            </View>
            <Text
              style={[
                styles.radioLabel,
                reportType === 'itemwise' && styles.radioSelectedLabel,
              ]}
            >
              Item-wise
            </Text>
          </TouchableOpacity>
        </View>

        {/* Loading */}
        {loading && (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#F48221" />
            <Text style={styles.loadingText}>Loading report data...</Text>
          </View>
        )}

        {/* Error */}
        {error && (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>{error}</Text>
            <TouchableOpacity
              style={styles.retryButton}
              onPress={() => handleApplyDates()}
            >
              <Text style={styles.retryButtonText}>Retry</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Report Content */}
        {/* "All" report: page scrolls vertically */}
        {!loading && !error && reportType === 'all' && (
          <ScrollView ref={scrollViewRef} style={styles.scrollContainer}>
            {renderSummaryData()}
          </ScrollView>
        )}

        {/* Item-wise: NO outer vertical ScrollView — the table's own
            vertical scroll handles rows, horizontal scroll handles columns */}
        {!loading && !error && reportType === 'itemwise' && (
          <View style={styles.scrollContainer}>{renderItemWiseData()}</View>
        )}

        {/* Unit dropdown modal */}
        <Modal
          visible={showUnitDropdown}
          transparent
          animationType="fade"
          onRequestClose={() => setShowUnitDropdown(false)}
        >
          <TouchableOpacity
            style={styles.modalOverlay}
            activeOpacity={1}
            onPress={() => setShowUnitDropdown(false)}
          >
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>Select Unit</Text>
              <FlatList
                data={UNIT_OPTIONS}
                keyExtractor={item => String(item.value ?? 'all')}
                renderItem={({ item }) => {
                  const isSelected = item.value === selectedUnit;
                  return (
                    <TouchableOpacity
                      style={[
                        styles.modalOption,
                        isSelected && styles.modalOptionSelected,
                      ]}
                      onPress={() => handleUnitSelect(item.value)}
                    >
                      <Text
                        style={[
                          styles.modalOptionText,
                          isSelected && styles.modalOptionTextSelected,
                        ]}
                      >
                        {item.label}
                      </Text>
                    </TouchableOpacity>
                  );
                }}
              />
            </View>
          </TouchableOpacity>
        </Modal>

        {/* From Date Picker */}
        <DateTimePickerModal
          isVisible={showFromDatePicker}
          mode="date"
          date={fromDate ?? new Date()}
          minimumDate={new Date(2020, 0, 1)}
          maximumDate={toDate ?? new Date()}
          onConfirm={handleFromDateConfirm}
          onCancel={() => setShowFromDatePicker(false)}
        />

        {/* To Date Picker */}
        <DateTimePickerModal
          isVisible={showToDatePicker}
          mode="date"
          date={toDate ?? fromDate ?? new Date()}
          minimumDate={fromDate ?? new Date(2020, 0, 1)}
          maximumDate={new Date()}
          onConfirm={handleToDateConfirm}
          onCancel={() => setShowToDatePicker(false)}
        />
      </View>
    </LayoutWrapper>
  );
};

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 8,
    backgroundColor: '#fff',
  },
  titleContainer: {
    alignItems: 'center',
    marginBottom: 8,
    backgroundColor: '#f9f9f9',
    paddingVertical: 6,
    borderRadius: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#eaeaea',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 1,
    elevation: 1,
  },
  titleText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#F48221',
  },
  dateContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  dateField: {
    flex: 1,
    marginHorizontal: 4,
  },
  dateLabel: {
    fontSize: 13,
    marginBottom: 2,
    color: '#666',
  },
  datePicker: {
    paddingVertical: 8,
    paddingHorizontal: 10,
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ddd',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dateText: {
    fontSize: 14,
    color: '#333',
    fontWeight: '500',
  },
  placeholderText: {
    color: '#999',
    fontWeight: '400',
  },
  unitContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 4,
    marginBottom: 8,
  },
  unitLabel: {
    fontSize: 13,
    color: '#666',
    marginRight: 8,
  },
  unitDropdown: {
    paddingVertical: 8,
    paddingHorizontal: 10,
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ddd',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  unitDropdownText: {
    flex: 1,
    fontSize: 14,
    color: '#333',
    fontWeight: '500',
  },
  dropdownArrow: {
    fontSize: 9,
    color: '#F48221',
    marginLeft: 6,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  modalContent: {
    width: 200,
    maxHeight: '40%',
    backgroundColor: '#fff',
    borderRadius: 10,
    paddingVertical: 8,
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#F48221',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  modalOption: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  modalOptionSelected: {
    backgroundColor: '#FFF3E8',
  },
  modalOptionText: {
    fontSize: 13,
    color: '#333',
  },
  modalOptionTextSelected: {
    color: '#F48221',
    fontWeight: '600',
  },
  applyButton: {
    backgroundColor: '#F48221',
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#F48221',
    alignItems: 'center',
    justifyContent: 'center',
  },
  applyButtonText: {
    color: 'white',
    fontWeight: '600',
    fontSize: 14,
  },
  scrollContainer: {
    flex: 1,
  },
  reportSection: {
    backgroundColor: '#f9f9f9',
    paddingVertical: 10,
    paddingHorizontal: 6,
    borderRadius: 8,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 12,
    color: '#333',
    borderBottomWidth: 1,
    borderBottomColor: '#ddd',
    paddingBottom: 8,
  },
  metricRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  metricLabel: {
    fontSize: 15,
    color: '#555',
    flex: 2,
  },
  metricValue: {
    fontSize: 15,
    fontWeight: '600',
    color: '#333',
    flex: 1,
    textAlign: 'right',
  },
  positive: {
    color: '#333',
    fontWeight: 'bold',
  },
  negative: {
    color: '#333',
    fontWeight: 'bold',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 10,
    color: '#666',
    fontSize: 14,
  },
  radioContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
    marginBottom: 4,
  },
  radioButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
    paddingHorizontal: 12,
    borderRadius: 6,
    backgroundColor: '#fff',
  },
  radioCircle: {
    width: 18,
    height: 18,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: '#ddd',
    marginRight: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  radioFill: {
    width: 10,
    height: 10,
    borderRadius: 2,
    backgroundColor: '#F48221',
  },
  radioLabel: {
    fontSize: 14,
    color: '#666',
  },
  radioSelected: {
    borderColor: '#F48221',
  },
  radioSelectedLabel: {
    color: '#F48221',
  },
  errorContainer: {
    padding: 16,
    backgroundColor: '#ffebee',
    borderRadius: 8,
    marginVertical: 16,
    alignItems: 'center',
  },
  errorText: {
    color: '#c62828',
    textAlign: 'center',
    marginBottom: 12,
  },
  retryButton: {
    backgroundColor: '#F48221',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 4,
  },
  retryButtonText: {
    color: 'white',
    fontWeight: '500',
  },
  emptyMessage: {
    textAlign: 'center',
    color: '#666',
    padding: 20,
    fontSize: 16,
    fontStyle: 'italic',
  },
  tableContainer: {
    flexDirection: 'column',
    minWidth: 620,
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#f8f8f8',
    paddingVertical: 12,
    borderBottomWidth: 2,
    borderBottomColor: '#ddd',
  },
  headerCell: {
    paddingHorizontal: 8,
    justifyContent: 'center',
  },
  headerText: {
    fontWeight: '600',
    fontSize: 12,
    color: '#444',
    textAlign: 'center',
  },
  tableRow: {
    flexDirection: 'row',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    alignItems: 'center',
  },
  dataCell: {
    paddingHorizontal: 8,
    justifyContent: 'center',
  },
  dataText: {
    fontSize: 12,
    color: '#333',
    textAlign: 'center',
  },
  itemName: {
    fontWeight: '500',
    fontSize: 12,
  },
  itemCategory: {
    fontSize: 11,
    color: '#666',
    marginTop: 4,
  },
  tableWrapper: {
    flex: 1,
    flexDirection: 'column',
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 8,
    overflow: 'hidden',
    marginBottom: 10,
    marginHorizontal: 0,
    width: '100%',
  },
  itemWiseSection: {
    flex: 1,
    marginBottom: 8,
  },
});

export default ReportSummaryScreen;
