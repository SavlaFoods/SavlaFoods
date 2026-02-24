import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
  Alert,
  Dimensions,
} from 'react-native';
import axios from 'axios';
import { format } from 'date-fns';
import { API_ENDPOINTS, getAuthHeaders } from '../../config/api.config';
import { useRoute } from '@react-navigation/core';
import { LayoutWrapper } from '../../components/AppLayout';
import DateTimePickerModal from 'react-native-modal-datetime-picker';

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

  // Date state — no more temp dates needed
  const [fromDate, setFromDate] = useState<Date>(() => {
    const today = new Date();
    const lastMonth = new Date(today);
    lastMonth.setMonth(today.getMonth() - 1);
    return lastMonth;
  });
  const [toDate, setToDate] = useState<Date>(new Date());

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
  const [tableHeight, setTableHeight] = useState<number>(550);

  const scrollViewRef = useRef<ScrollView>(null);

  // ─── Table Height ─────────────────────────────────────────────────────────

  useEffect(() => {
    const calculateTableHeight = () => {
      const screenHeight = Dimensions.get('window').height;
      const calculatedHeight = Math.min(Math.max(screenHeight * 0.6, 400), 650);
      setTableHeight(calculatedHeight);
    };

    calculateTableHeight();

    const dimensionsListener = Dimensions.addEventListener(
      'change',
      calculateTableHeight,
    );

    return () => {
      dimensionsListener.remove();
    };
  }, []);

  // ─── Date Helpers ─────────────────────────────────────────────────────────

  const formatDisplayDate = (date: Date): string => {
    return format(date, 'dd/MM/yyyy');
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
  };

  const handleToDateConfirm = (date: Date) => {
    setToDate(date);
    setShowToDatePicker(false);
  };

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

    if (num % 1 === 0 || Math.abs(num) >= 1000) {
      return num.toLocaleString('en-US', { maximumFractionDigits: 0 });
    }

    return num.toLocaleString('en-US', {
      maximumFractionDigits: decimals,
      minimumFractionDigits: decimals,
    });
  };

  // ─── Report Type ──────────────────────────────────────────────────────────

  const handleReportTypeChange = (type: 'all' | 'itemwise') => {
    if (type !== reportType) {
      setReportType(type);
      setSummaryData(null);
    }
  };

  // ─── Fetch Data ───────────────────────────────────────────────────────────

  const handleApplyDates = async () => {
    setSummaryData(null);
    setLoading(true);
    setError(null);

    try {
      const fromDateStr = formatApiDate(fromDate);
      const toDateStr = formatApiDate(toDate);

      const headers = await getAuthHeaders();

      const payload = {
        fromDate: fromDateStr,
        toDate: toDateStr,
        customerName: 'UNICORP ENTERPRISES',
        itemCategoryName: null,
        itemSubCategoryName: null,
        unitName: null,
      };

      const apiEndpoint =
        reportType === 'all'
          ? API_ENDPOINTS.GET_ALL_SUMMARY
          : API_ENDPOINTS.GET_ITEMWISE_SUMMARY;

      const response = await axios.post<ApiResponse>(apiEndpoint, payload, {
        headers: {
          ...headers,
          'Cache-Control': 'no-cache',
        },
      });

      if (response.data && response.data.success) {
        if (reportType === 'all') {
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

    const itemWiseData = summaryData;

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
      <View style={styles.reportSection}>
        <Text style={styles.sectionTitle}>
          Item-wise Summary ({itemWiseData.length} items)
        </Text>

        <View style={styles.minimumScrollHint}>
          <Text style={styles.minimumScrollHintText}>
            ⟷ Scroll horizontally to see more columns
          </Text>
        </View>

        <View style={styles.tableWrapper}>
          <ScrollView
            horizontal={true}
            showsHorizontalScrollIndicator={true}
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
              <View style={{ height: Math.min(tableHeight, 450) }}>
                <ScrollView
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
              <Text style={styles.dateText}>{formatDisplayDate(fromDate)}</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.dateField}>
            <Text style={styles.dateLabel}>To:</Text>
            <TouchableOpacity
              style={styles.datePicker}
              onPress={() => setShowToDatePicker(true)}
            >
              <Text style={styles.dateText}>{formatDisplayDate(toDate)}</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Apply Button */}
        <TouchableOpacity style={styles.applyButton} onPress={handleApplyDates}>
          <Text style={styles.applyButtonText}>Apply Date Range</Text>
        </TouchableOpacity>

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
              onPress={handleApplyDates}
            >
              <Text style={styles.retryButtonText}>Retry</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Report Content */}
        {!loading && !error && (
          <ScrollView ref={scrollViewRef} style={styles.scrollContainer}>
            {reportType === 'all' ? renderSummaryData() : renderItemWiseData()}
          </ScrollView>
        )}

        {/* ✅ From Date Picker — works on both iOS and Android */}
        <DateTimePickerModal
          isVisible={showFromDatePicker}
          mode="date"
          date={fromDate}
          minimumDate={new Date(2020, 0, 1)}
          maximumDate={new Date()}
          onConfirm={handleFromDateConfirm}
          onCancel={() => setShowFromDatePicker(false)}
        />

        {/* ✅ To Date Picker — works on both iOS and Android */}
        <DateTimePickerModal
          isVisible={showToDatePicker}
          mode="date"
          date={toDate}
          minimumDate={new Date(2020, 0, 1)}
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
    paddingVertical: 16,
    paddingHorizontal: 8,
    backgroundColor: '#fff',
  },
  titleContainer: {
    alignItems: 'center',
    marginBottom: 16,
    backgroundColor: '#f9f9f9',
    paddingVertical: 10,
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
    fontSize: 20,
    fontWeight: '600',
    color: '#F48221',
  },
  dateContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  dateField: {
    flex: 1,
    marginHorizontal: 4,
  },
  dateLabel: {
    fontSize: 14,
    marginBottom: 4,
    color: '#666',
  },
  datePicker: {
    padding: 12,
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
  applyButton: {
    backgroundColor: '#F48221',
    paddingVertical: 10,
    borderRadius: 8,
    marginBottom: 16,
    alignItems: 'center',
  },
  applyButtonText: {
    color: 'white',
    fontWeight: '600',
    fontSize: 16,
  },
  scrollContainer: {
    flex: 1,
  },
  reportSection: {
    backgroundColor: '#f9f9f9',
    paddingVertical: 16,
    paddingHorizontal: 6,
    borderRadius: 8,
    marginBottom: 16,
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
    marginBottom: 16,
  },
  radioButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
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
    fontSize: 16,
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
    minHeight: 500,
    width: '100%',
  },
  minimumScrollHint: {
    paddingVertical: 3,
    paddingHorizontal: 6,
    backgroundColor: '#f8f8f8',
    borderRadius: 4,
    alignItems: 'center',
    marginBottom: 3,
  },
  minimumScrollHintText: {
    color: '#666',
    fontSize: 11,
  },
});

export default ReportSummaryScreen;
