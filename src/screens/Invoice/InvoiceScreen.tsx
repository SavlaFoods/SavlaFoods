import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Platform,
} from 'react-native';
import DatePicker from 'react-native-date-picker';
import axios, { AxiosError } from 'axios';
import { API_ENDPOINTS, getAuthHeaders } from '../../config/api.config';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { LayoutWrapper } from '../../components/AppLayout';
import { useDisplayName } from '../../contexts/DisplayNameContext';
import MultiSelect from '../../components/Multiselect';
import RazorpayCheckout from 'react-native-razorpay';

// Define navigation param list
type RootStackParamList = {
  InvoiceDetailsScreen: { invoiceNo: string };
  InvoiceReportScreen: {
    reportData: ReportData | null;
    searchFilters: SearchFilters;
  };
};

// Define types for form data and report data
interface FormData {
  customerName: string;
  billNo: string;
  units: string[];
  fromDate: Date | null;
  toDate: Date | null;
}

interface SearchFilters {
  customerName: string;
  billNo: string;
  units: string[];
  fromDate: string;
  toDate: string | null;
}

interface ReportData {
  success: boolean;
  totalRecords: number;
  reportData: string[][];
  headers: string[];
  summary: any;
  message: string;
  requestData: any;
}

interface UnitOption {
  label: string;
  value: string;
}

const FinanceScreen: React.FC = () => {
  const { displayName } = useDisplayName();
  const scrollViewRef = useRef<ScrollView>(null);
  const tableContainerRef = useRef<View>(null); // New ref for table container
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  const unitOptions: UnitOption[] = [
    { label: 'D-39', value: 'D-39' },
    { label: 'D-514', value: 'D-514' },
  ];

  const [formData, setFormData] = useState<FormData>({
    customerName: displayName || '',
    billNo: '',
    units: [],
    fromDate: null,
    toDate: null,
  });

  const [reportData, setReportData] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [openFromDatePicker, setOpenFromDatePicker] = useState<boolean>(false);
  const [openToDatePicker, setOpenToDatePicker] = useState<boolean>(false);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [entriesPerPage] = useState<number>(10);

  const [selectedInvoices, setSelectedInvoices] = useState<string[]>([]);

  // Scroll to table when reportData updates
  useEffect(() => {
    if (
      reportData &&
      reportData.reportData &&
      reportData.reportData.length > 0 &&
      tableContainerRef.current
    ) {
      tableContainerRef.current.measureLayout(
        scrollViewRef.current as any,
        (x, y) => {
          scrollViewRef.current?.scrollTo({
            y: y - 20, // Slight offset for visibility
            animated: true,
          });
        },
        () => {
          console.log('Failed to measure table container layout');
        },
      );
    }
  }, [reportData]);

  React.useEffect(() => {
    if (displayName) {
      setFormData(prev => ({ ...prev, customerName: displayName }));
    }
  }, [displayName]);

  const handleInputChange = (name: keyof FormData, value: string) => {
    setFormData(prev => ({ ...prev, [name]: value }));
    if (error) setError(null);
  };

  const handleUnitChange = (selectedUnits: string[]) => {
    setFormData(prev => ({ ...prev, units: selectedUnits }));
    if (error) setError(null);
  };

  const handleDateChange = (name: 'fromDate' | 'toDate', date: Date) => {
    if (date) {
      setFormData(prev => ({ ...prev, [name]: date }));
    }
    if (name === 'fromDate') setOpenFromDatePicker(false);
    else setOpenToDatePicker(false);
    if (error) setError(null);
  };

  const handleBillNoClick = (billNo: string) => {
    if (billNo && billNo.trim() !== '') {
      navigation.navigate('InvoiceDetailsScreen', {
        invoiceNo: billNo.trim(),
      });
    } else {
      Alert.alert('Error', 'Invalid bill number');
    }
  };

  const formatDate = (date: Date | null): string => {
    if (!date) return '';
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
  };

  const formatDateForAPI = (date: Date | null): string => {
    if (!date) return '';
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const validateForm = (): boolean => {
    if (!formData.fromDate) {
      Alert.alert('Validation Error', 'From Date is required');
      return false;
    }
    if (formData.toDate && formData.fromDate > formData.toDate) {
      Alert.alert(
        'Validation Error',
        'To Date should be greater than or equal to From Date',
      );
      return false;
    }
    return true;
  };

  const toggleInvoice = (billNo: string) => {
    setSelectedInvoices(prev =>
      prev.includes(billNo)
        ? prev.filter(i => i !== billNo)
        : [...prev, billNo],
    );
  };

  const scrollToTop = () => {
    if (scrollViewRef.current) {
      scrollViewRef.current.scrollTo({
        y: 0,
        animated: true,
      });
    }
  };

  const tryMultipleEndpoints = async (
    payload: any,
    headers: any,
  ): Promise<any> => {
    const possibleEndpoints = [
      API_ENDPOINTS.GET_INVOICE_REPORT,
      API_ENDPOINTS.GET_INVOICE_REPORT?.replace(
        '/getInvoiceReportTable',
        '/getInvoiceReport',
      ),
      API_ENDPOINTS.GET_INVOICE_REPORT?.replace(
        'invoice/getInvoiceReportTable',
        'api/invoice/getInvoiceReportTable',
      ),
      API_ENDPOINTS.GET_INVOICE_REPORT?.replace(
        'invoice/getInvoiceReportTable',
        'invoices/getInvoiceReportTable',
      ),
      API_ENDPOINTS.GET_INVOICE_REPORT?.replace(
        'invoice/getInvoiceReportTable',
        'getInvoiceReportTable',
      ),
    ].filter(Boolean);

    let lastError: AxiosError | null = null;
    for (const endpoint of possibleEndpoints) {
      try {
        // console.log(`Trying endpoint: ${endpoint}`);
        const response = await axios.post(endpoint, payload, {
          headers,
          timeout: 30000,
        });
        // console.log(`Success with endpoint: ${endpoint}`);
        return response;
      } catch (error: unknown) {
        const axiosError = error as AxiosError;
        // console.log(
        //   // `Failed with endpoint: ${endpoint}`,
        //   axiosError.response?.status,
        // );
        lastError = axiosError;
        if (axiosError.response?.status !== 404) {
          break;
        }
      }
    }
    throw lastError;
  };

  const handleSubmit = async () => {
    if (!validateForm()) return;

    setError(null);
    setLoading(true);
    setReportData(null);
    setCurrentPage(1);

    scrollToTop();

    try {
      const headers = await getAuthHeaders();
      const unitValue = formData.units.length > 0 ? formData.units : null;

      const payload1 = {
        customerName: formData.customerName.trim() || null,
        billNo: formData.billNo.trim() || null,
        unit: unitValue,
        fromDate: formatDate(formData.fromDate),
        toDate: formData.toDate ? formatDate(formData.toDate) : null,
      };

      const payload2 = {
        customerName: formData.customerName.trim() || null,
        billNo: formData.billNo.trim() || null,
        unit: unitValue,
        fromDate: formatDateForAPI(formData.fromDate),
        toDate: formData.toDate ? formatDateForAPI(formData.toDate) : null,
      };

      console.log('Trying payload 1 (DD/MM/YYYY):', payload1);

      let response;
      try {
        response = await tryMultipleEndpoints(payload1, headers);
      } catch (error: unknown) {
        const axiosError = error as AxiosError;
        if (axiosError.response?.status === 400) {
          console.log('Trying payload 2 (YYYY-MM-DD):', payload2);
          response = await tryMultipleEndpoints(payload2, headers);
        } else {
          throw error;
        }
      }

      // console.log('API Response:', response.data);

      if (response.data && response.data.success) {
        const processedData: ReportData = {
          success: true,
          totalRecords: response.data.totalRecords || 0,
          reportData: response.data.reportData || [],
          headers: response.data.headers || [],
          summary: response.data.summary || null,
          message: response.data.message || 'Report generated successfully',
          requestData: response.data.requestData || null,
        };

        setReportData(processedData);

        if (processedData.totalRecords === 0) {
          Alert.alert(
            'No Records Found',
            'No invoices found matching your search criteria. Please try different filters.',
            [{ text: 'OK' }],
          );
        }
      } else {
        const errorMessage: string =
          response.data?.message || 'Failed to fetch report data';
        setError(errorMessage);
        Alert.alert('Error', errorMessage);
      }
    } catch (error: unknown) {
      const axiosError = error as AxiosError;
      console.error('API Error:', axiosError);
      let errorMessage = 'Failed to fetch report data';
      if (axiosError.response) {
        console.error('Error Response:', axiosError.response.data);
        if (axiosError.response.status === 404) {
          errorMessage =
            'API endpoint not found. Please check with your backend team.';
        } else {
          errorMessage =
            (axiosError.response.data as any)?.message ||
            `Server Error: ${axiosError.response.status}`;
        }
      } else if (axiosError.request) {
        console.error('No Response:', axiosError.request);
        errorMessage = 'Network Error: Unable to connect to server';
      } else {
        console.error('Error Message:', axiosError.message);
        errorMessage = axiosError.message || 'An unexpected error occurred';
      }
      setError(errorMessage);
      Alert.alert('Error', errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleClearForm = () => {
    setFormData({
      customerName: displayName || '',
      billNo: '',
      units: [],
      fromDate: null,
      toDate: null,
    });
    setReportData(null);
    setError(null);
    setCurrentPage(1);
  };

  const formatCurrency = (amount: string | number): string => {
    const numAmount = parseFloat(amount.toString() || '0');
    if (isNaN(numAmount)) return '0.00';
    return numAmount.toLocaleString('en-IN', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  };

  const getPaginatedData = (): string[][] => {
    if (!reportData || !reportData.reportData) return [];
    const startIndex = (currentPage - 1) * entriesPerPage;
    const endIndex = startIndex + entriesPerPage;
    return reportData.reportData.slice(startIndex, endIndex);
  };

  const getTotalPages = (): number => {
    if (!reportData || !reportData.reportData) return 0;
    return Math.ceil(reportData.reportData.length / entriesPerPage);
  };

  const handlePageChange = (page: number) => {
    const totalPages = getTotalPages();
    if (page >= 1 && page <= totalPages) {
      setCurrentPage(page);
    }
  };

  const viewDetailedReport = () => {
    if (reportData) {
      navigation.navigate('InvoiceReportScreen', {
        reportData: {
          ...reportData,
        },
        searchFilters: {
          customerName: formData.customerName,
          billNo: formData.billNo,
          units: formData.units,
          fromDate: formatDate(formData.fromDate),
          toDate: formData.toDate ? formatDate(formData.toDate) : null,
        },
      });
    }
  };

  const renderTable = () => {
    if (
      !reportData ||
      !reportData.reportData ||
      reportData.reportData.length === 0
    ) {
      return null;
    }

    const headers: string[] = reportData.headers || [
      'Sr. No.',
      'Bill No',
      'Invoice Date',
      'Invoice Item Amount',
      'Tax Amount',
      'Invoice Amount',
      'Roundoff Amount',
    ];

    const paginatedData = getPaginatedData();

    const tableRows = paginatedData.map(row => [
      row[0] || '',
      { billNo: row[1] || '', isClickable: true },
      row[2] || '',
      `₹${formatCurrency(row[3] || '0')}`,
      `₹${formatCurrency(row[4] || '0')}`,
      `₹${formatCurrency(row[5] || '0')}`,
      `₹${formatCurrency(row[6] || '0')}`,
    ]);

    const totalPages = getTotalPages();

    return (
      <View ref={tableContainerRef} style={styles.tableContainer}>
        <View style={styles.tableHeader}>
          <Text style={styles.sectionTitle}>Invoice Report</Text>
          <View style={styles.tableActions}>
            <Text style={styles.recordsInfo}>
              Showing {paginatedData.length} of {reportData.totalRecords}{' '}
              records
            </Text>
          </View>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={true}>
          <View style={{ flex: 1 }}>
            <View style={[styles.tableHeaderRow, { flexDirection: 'row' }]}>
              {headers.map((header, index) => (
                <View
                  key={index}
                  style={[
                    styles.tableHeaderCell,
                    {
                      width:
                        index === 0
                          ? 60
                          : index === 1
                          ? 160
                          : index === 2
                          ? 120
                          : 140,
                    },
                  ]}
                >
                  <Text style={styles.tableHeaderText}>{header}</Text>
                </View>
              ))}
            </View>

            {tableRows.map((row, rowIndex) => (
              <View
                key={rowIndex}
                style={[styles.tableRow, { flexDirection: 'row' }]}
              >
                {row.map((cell, cellIndex) => (
                  <View
                    key={cellIndex}
                    style={[
                      styles.tableCell,
                      {
                        width:
                          cellIndex === 0
                            ? 60
                            : cellIndex === 1
                            ? 160
                            : cellIndex === 2
                            ? 120
                            : 140,
                      },
                    ]}
                  >
                    {cellIndex === 1 &&
                    typeof cell === 'object' &&
                    cell.isClickable ? (
                      <TouchableOpacity
                        onPress={() => handleBillNoClick(cell.billNo)}
                        style={styles.billNoButton}
                      >
                        <Text style={styles.billNoText}>{cell.billNo}</Text>
                      </TouchableOpacity>
                    ) : (
                      <Text style={styles.tableRowText}>
                        {typeof cell === 'object' ? cell.billNo : cell}
                      </Text>
                    )}
                  </View>
                ))}
              </View>
            ))}
          </View>
        </ScrollView>

        <View style={styles.paginationContainer}>
          <TouchableOpacity
            style={[
              styles.paginationButton,
              currentPage === 1 && styles.disabledPaginationButton,
            ]}
            onPress={() => handlePageChange(currentPage - 1)}
            disabled={currentPage === 1}
          >
            <Text style={styles.paginationButtonText}>Previous</Text>
          </TouchableOpacity>

          <View style={styles.pageInfo}>
            <Text style={styles.pageText}>
              Page {currentPage} of {totalPages}
            </Text>
          </View>

          <TouchableOpacity
            style={[
              styles.paginationButton,
              currentPage === totalPages && styles.disabledPaginationButton,
            ]}
            onPress={() => handlePageChange(currentPage + 1)}
            disabled={currentPage === totalPages}
          >
            <Text style={styles.paginationButtonText}>Next</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  return (
    <LayoutWrapper showHeader={true} showTabBar={false} route={undefined}>
      <ScrollView
        ref={scrollViewRef}
        style={styles.container}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={true}
      >
        <View style={styles.titleContainer}>
          <Text style={styles.titleText}>Invoice Report</Text>
        </View>

        <View style={styles.formContainer}>
          <Text style={styles.label}>Customer Name</Text>
          <TextInput
            style={styles.input}
            value={formData.customerName}
            onChangeText={text => handleInputChange('customerName', text)}
            placeholder="Enter customer name (optional)"
            placeholderTextColor="#999"
          />

          <Text style={styles.label}>Bill No</Text>
          <TextInput
            style={styles.input}
            value={formData.billNo}
            onChangeText={text => handleInputChange('billNo', text)}
            placeholder="Enter bill number (optional)"
            placeholderTextColor="#999"
          />

          <Text style={styles.label}>Units</Text>
          <MultiSelect
            options={unitOptions}
            selectedValues={formData.units}
            onSelectChange={handleUnitChange}
            placeholder="Select units (optional)"
            primaryColor="#3498db"
            showSelectAll={true}
            searchPlaceholder="Search units..."
          />

          <Text style={styles.label}>
            From Date <Text style={styles.required}>*</Text>
          </Text>
          <TouchableOpacity
            style={[
              styles.dateButton,
              !formData.fromDate && styles.dateButtonEmpty,
            ]}
            onPress={() => setOpenFromDatePicker(true)}
          >
            <Text
              style={[
                styles.dateButtonText,
                !formData.fromDate && styles.placeholderText,
              ]}
            >
              {formData.fromDate
                ? formatDate(formData.fromDate)
                : 'Select From Date'}
            </Text>
          </TouchableOpacity>

          <Text style={styles.label}>To Date</Text>
          <TouchableOpacity
            style={[
              styles.dateButton,
              !formData.toDate && styles.dateButtonEmpty,
            ]}
            onPress={() => setOpenToDatePicker(true)}
          >
            <Text
              style={[
                styles.dateButtonText,
                !formData.toDate && styles.placeholderText,
              ]}
            >
              {formData.toDate
                ? formatDate(formData.toDate)
                : 'Select To Date (optional)'}
            </Text>
          </TouchableOpacity>

          <DatePicker
            modal
            open={openFromDatePicker}
            date={formData.fromDate || new Date()}
            onConfirm={date => handleDateChange('fromDate', date)}
            onCancel={() => setOpenFromDatePicker(false)}
            mode="date"
            title="Select From Date"
          />

          <DatePicker
            modal
            open={openToDatePicker}
            date={formData.toDate || new Date()}
            onConfirm={date => handleDateChange('toDate', date)}
            onCancel={() => setOpenToDatePicker(false)}
            mode="date"
            title="Select To Date"
          />

          <View style={styles.buttonContainer}>
            <TouchableOpacity
              style={[styles.button, styles.clearButton]}
              onPress={handleClearForm}
              activeOpacity={0.8}
            >
              <Text style={styles.clearButtonText}>Clear</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.button,
                styles.submitButton,
                loading && styles.disabledButton,
              ]}
              onPress={handleSubmit}
              disabled={loading}
              activeOpacity={0.8}
            >
              {loading ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Text style={styles.submitButtonText}>Generate Report</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>

        {error && (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        {renderTable()}

        {reportData && reportData.totalRecords === 0 && (
          <View style={styles.emptyStateContainer}>
            <Text style={styles.emptyStateText}>
              No invoices found matching your criteria
            </Text>
            <Text style={styles.emptyStateSubtext}>
              Try adjusting your search filters
            </Text>
          </View>
        )}
      </ScrollView>
    </LayoutWrapper>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  titleContainer: {
    alignItems: 'center',
    marginBottom: 5,
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
    color: '#3498db',
  },
  formContainer: {
    backgroundColor: '#fff',
    margin: 16,
    padding: 20,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
    color: '#34495e',
  },
  required: {
    color: '#e74c3c',
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
    fontSize: 16,
    backgroundColor: '#fff',
  },
  dateButton: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
    justifyContent: 'center',
    backgroundColor: '#fff',
  },
  dateButtonEmpty: {
    borderColor: '#ddd',
  },
  dateButtonText: {
    fontSize: 16,
    color: '#2c3e50',
  },
  placeholderText: {
    color: '#999',
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 10,
    marginHorizontal: -5,
  },
  button: {
    flex: 1,
    padding: Platform.OS === 'android' ? 9 : 12,
    borderRadius: 8,
    alignItems: 'center',
    marginHorizontal: 5,
    elevation: 3,
    justifyContent: 'center',
    minHeight: 45,
    ...Platform.select({
      android: {
        overflow: 'hidden',
      },
    }),
  },
  clearButton: {
    backgroundColor: '#95a5a6',
  },
  clearButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  submitButton: {
    backgroundColor: '#3498db',
  },
  submitButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  disabledButton: {
    backgroundColor: '#bdc3c7',
  },
  errorContainer: {
    margin: 16,
    padding: 12,
    backgroundColor: '#ffeaea',
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#e74c3c',
  },
  errorText: {
    color: '#c0392b',
    fontSize: 14,
    fontWeight: '500',
  },
  tableContainer: {
    backgroundColor: '#fff',
    margin: 16,
    padding: 20,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  tableHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2c3e50',
  },
  tableActions: {
    alignItems: 'flex-end',
  },
  recordsInfo: {
    fontSize: 12,
    color: '#7f8c8d',
    marginBottom: 4,
  },
  tableHeaderRow: {
    height: 50,
    backgroundColor: '#3498db',
  },
  tableHeaderText: {
    fontWeight: 'bold',
    textAlign: 'center',
    fontSize: 12,
    color: '#fff',
    paddingHorizontal: 4,
  },
  tableRow: {
    height: 45,
    backgroundColor: '#f8f9fa',
  },
  tableRowText: {
    textAlign: 'center',
    fontSize: 11,
    color: '#2c3e50',
    paddingHorizontal: 4,
  },
  paginationContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
  paginationButton: {
    backgroundColor: '#3498db',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
    minWidth: 80,
    alignItems: 'center',
  },
  disabledPaginationButton: {
    backgroundColor: '#bdc3c7',
  },
  paginationButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  pageInfo: {
    alignItems: 'center',
  },
  pageText: {
    fontSize: 14,
    color: '#2c3e50',
    fontWeight: '500',
  },
  emptyStateContainer: {
    backgroundColor: '#fff',
    margin: 16,
    padding: 40,
    borderRadius: 12,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  emptyStateText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#7f8c8d',
    textAlign: 'center',
    marginBottom: 8,
  },
  emptyStateSubtext: {
    fontSize: 14,
    color: '#95a5a6',
    textAlign: 'center',
  },
  tableHeaderCell: {
    height: 50,
    backgroundColor: '#3498db',
    justifyContent: 'center',
    alignItems: 'center',
    borderRightWidth: 1,
    borderRightColor: '#fff',
    paddingHorizontal: 4,
  },
  tableCell: {
    height: 45,
    backgroundColor: '#f8f9fa',
    justifyContent: 'center',
    alignItems: 'center',
    borderRightWidth: 1,
    borderRightColor: '#e0e0e0',
    paddingHorizontal: 4,
  },
  billNoButton: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    minWidth: 80,
    alignItems: 'center',
  },
  billNoText: {
    color: '#3498db',
    fontSize: 11,
    fontWeight: '600',
    textAlign: 'center',
  },
  dueAmount: {
    fontSize: 12,
    color: '#fff',
  },
});

export default FinanceScreen;

// import React, {useState, useRef, useEffect} from 'react';
// import {
//   View,
//   Text,
//   TextInput,
//   TouchableOpacity,
//   ScrollView,
//   StyleSheet,
//   ActivityIndicator,
//   Alert,
//   Platform,
// } from 'react-native';
// import DatePicker from 'react-native-date-picker';
// import axios, {AxiosError} from 'axios';
// import {API_ENDPOINTS, getAuthHeaders} from '../../config/api.config';
// import {useNavigation} from '@react-navigation/native';
// import {NativeStackNavigationProp} from '@react-navigation/native-stack';
// import {LayoutWrapper} from '../../components/AppLayout';
// import {useDisplayName} from '../../contexts/DisplayNameContext';
// import MultiSelect from '../../components/Multiselect';
// import PaymentComponent from '../../components/PaymentComponent';

// type RootStackParamList = {
//   InvoiceDetailsScreen: {invoiceNo: string};
// };

// interface FormData {
//   customerName: string;
//   billNo: string;
//   units: string[];
//   fromDate: Date | null;
//   toDate: Date | null;
// }

// interface ReportData {
//   success: boolean;
//   totalRecords: number;
//   reportData: string[][];
//   headers: string[];
//   summary: {
//     totalInvoiceItemAmount: string;
//     totalTaxAmount: string;
//     totalInvoiceAmount: string;
//     totalRoundoffAmount: string;
//     invOutstandingAmount: string;
//     paidInvoices: number;
//     dueInvoices: number;
//   };
//   message: string;
//   requestData: any;
// }

// interface UnitOption {
//   label: string;
//   value: string;
// }

// const FinanceScreen: React.FC = () => {
//   const {displayName} = useDisplayName();
//   const scrollViewRef = useRef<ScrollView>(null);
//   const tableContainerRef = useRef<View>(null);
//   const navigation =
//     useNavigation<NativeStackNavigationProp<RootStackParamList>>();

//   const unitOptions: UnitOption[] = [
//     {label: 'D-39', value: 'D-39'},
//     {label: 'D-514', value: 'D-514'},
//   ];

//   const [formData, setFormData] = useState<FormData>({
//     customerName: displayName || '',
//     billNo: '',
//     units: [],
//     fromDate: null,
//     toDate: null,
//   });

//   const [reportData, setReportData] = useState<ReportData | null>(null);
//   const [loading, setLoading] = useState<boolean>(false);
//   const [error, setError] = useState<string | null>(null);
//   const [openFromDatePicker, setOpenFromDatePicker] = useState<boolean>(false);
//   const [openToDatePicker, setOpenToDatePicker] = useState<boolean>(false);
//   const [currentPage, setCurrentPage] = useState<number>(1);
//   const [entriesPerPage] = useState<number>(10);

//   const [viewMode, setViewMode] = useState<'REPORT' | 'DUE'>('REPORT');

//   const [selectedInvoices, setSelectedInvoices] = useState<string[]>([]);

//   useEffect(() => {
//     if (
//       reportData &&
//       reportData.reportData &&
//       reportData.reportData.length > 0 &&
//       tableContainerRef.current
//     ) {
//       tableContainerRef.current.measureLayout(
//         scrollViewRef.current as any,
//         (x, y) => {
//           scrollViewRef.current?.scrollTo({y: y - 20, animated: true});
//         },
//         () => {},
//       );
//     }
//   }, [reportData]);

//   React.useEffect(() => {
//     if (displayName) {
//       setFormData(prev => ({...prev, customerName: displayName}));
//     }
//   }, [displayName]);

//   const handleInputChange = (name: keyof FormData, value: string) => {
//     setFormData(prev => ({...prev, [name]: value}));
//     if (error) setError(null);
//   };

//   const handleUnitChange = (selectedUnits: string[]) => {
//     setFormData(prev => ({...prev, units: selectedUnits}));
//     if (error) setError(null);
//   };

//   const handleDateChange = (name: 'fromDate' | 'toDate', date: Date) => {
//     if (date) setFormData(prev => ({...prev, [name]: date}));
//     if (name === 'fromDate') setOpenFromDatePicker(false);
//     else setOpenToDatePicker(false);
//     if (error) setError(null);
//   };

//   const handleBillNoClick = (billNo: string) => {
//     if (billNo && billNo.trim() !== '') {
//       navigation.navigate('InvoiceDetailsScreen', {invoiceNo: billNo.trim()});
//     }
//   };

//   const formatDate = (date: Date | null): string => {
//     if (!date) return '';
//     const day = String(date.getDate()).padStart(2, '0');
//     const month = String(date.getMonth() + 1).padStart(2, '0');
//     const year = date.getFullYear();
//     return `${day}/${month}/${year}`;
//   };

//   const formatDateForAPI = (date: Date | null): string => {
//     if (!date) return '';
//     const year = date.getFullYear();
//     const month = String(date.getMonth() + 1).padStart(2, '0');
//     const day = String(date.getDate()).padStart(2, '0');
//     return `${year}-${month}-${day}`;
//   };

//   const validateForm = (): boolean => {
//     if (!formData.fromDate) {
//       Alert.alert('Validation Error', 'From Date is required');
//       return false;
//     }
//     if (formData.toDate && formData.fromDate > formData.toDate) {
//       Alert.alert(
//         'Validation Error',
//         'To Date should be greater than or equal to From Date',
//       );
//       return false;
//     }
//     return true;
//   };

//   const toggleInvoiceSelection = (billNo: string) => {
//     setSelectedInvoices(prev =>
//       prev.includes(billNo)
//         ? prev.filter(i => i !== billNo)
//         : [...prev, billNo],
//     );
//   };

//   const scrollToTop = () => {
//     scrollViewRef.current?.scrollTo({y: 0, animated: true});
//   };

//   const tryMultipleEndpoints = async (
//     payload: any,
//     headers: any,
//   ): Promise<any> => {
//     const possibleEndpoints = [
//       API_ENDPOINTS.GET_INVOICE_REPORT,
//       API_ENDPOINTS.GET_INVOICE_REPORT?.replace(
//         '/getInvoiceReportTable',
//         '/getInvoiceReport',
//       ),
//       API_ENDPOINTS.GET_INVOICE_REPORT?.replace(
//         'invoice/getInvoiceReportTable',
//         'api/invoice/getInvoiceReportTable',
//       ),
//       API_ENDPOINTS.GET_INVOICE_REPORT?.replace(
//         'invoice/getInvoiceReportTable',
//         'invoices/getInvoiceReportTable',
//       ),
//       API_ENDPOINTS.GET_INVOICE_REPORT?.replace(
//         'invoice/getInvoiceReportTable',
//         'getInvoiceReportTable',
//       ),
//     ].filter(Boolean);

//     let lastError: AxiosError | null = null;
//     for (const endpoint of possibleEndpoints) {
//       try {
//         const response = await axios.post(endpoint, payload, {
//           headers,
//           timeout: 30000,
//         });
//         return response;
//       } catch (error: unknown) {
//         const axiosError = error as AxiosError;
//         lastError = axiosError;
//         if (axiosError.response?.status !== 404) break;
//       }
//     }
//     throw lastError;
//   };

//   const handleSubmit = async () => {
//     if (!validateForm()) return;

//     setError(null);
//     setLoading(true);
//     setReportData(null);
//     setCurrentPage(1);
//     setViewMode('REPORT');
//     setSelectedInvoices([]);

//     scrollToTop();

//     try {
//       const headers = await getAuthHeaders();
//       const unitValue = formData.units.length > 0 ? formData.units : null;

//       const payload1 = {
//         customerName: formData.customerName.trim() || null,
//         billNo: formData.billNo.trim() || null,
//         unit: unitValue,
//         fromDate: formatDate(formData.fromDate),
//         toDate: formData.toDate ? formatDate(formData.toDate) : null,
//       };

//       const payload2 = {
//         customerName: formData.customerName.trim() || null,
//         billNo: formData.billNo.trim() || null,
//         unit: unitValue,
//         fromDate: formatDateForAPI(formData.fromDate),
//         toDate: formData.toDate ? formatDateForAPI(formData.toDate) : null,
//       };

//       let response;
//       try {
//         response = await tryMultipleEndpoints(payload1, headers);
//       } catch (error: unknown) {
//         const axiosError = error as AxiosError;
//         if (axiosError.response?.status === 400) {
//           response = await tryMultipleEndpoints(payload2, headers);
//         } else {
//           throw error;
//         }
//       }

//       if (response.data && response.data.success) {
//         const processedData: ReportData = {
//           success: true,
//           totalRecords: response.data.totalRecords || 0,
//           reportData: response.data.reportData || [],
//           headers: response.data.headers || [],
//           summary: response.data.summary || {
//             totalInvoiceItemAmount: '0.00',
//             totalTaxAmount: '0.00',
//             totalInvoiceAmount: '0.00',
//             totalRoundoffAmount: '0.00',
//             invOutstandingAmount: '0.00',
//             paidInvoices: 0,
//             dueInvoices: 0,
//           },
//           message: response.data.message || 'Report generated successfully',
//           requestData: response.data.requestData || null,
//         };

//         setReportData(processedData);

//         if (processedData.totalRecords === 0) {
//           Alert.alert(
//             'No Records Found',
//             'No invoices found matching your search criteria.',
//             [{text: 'OK'}],
//           );
//         }
//       } else {
//         const errorMessage =
//           response.data?.message || 'Failed to fetch report data';
//         setError(errorMessage);
//         Alert.alert('Error', errorMessage);
//       }
//     } catch (error: unknown) {
//       const axiosError = error as AxiosError;
//       let errorMessage = 'Failed to fetch report data';
//       if (axiosError.response?.status === 404) {
//         errorMessage =
//           'API endpoint not found. Please check with your backend team.';
//       } else {
//         errorMessage =
//           (axiosError.response?.data as any)?.message ||
//           `Server Error: ${axiosError.response?.status}`;
//       }
//       setError(errorMessage);
//       Alert.alert('Error', errorMessage);
//     } finally {
//       setLoading(false);
//     }
//   };

//   const handleClearForm = () => {
//     setFormData({
//       customerName: displayName || '',
//       billNo: '',
//       units: [],
//       fromDate: null,
//       toDate: null,
//     });
//     setReportData(null);
//     setError(null);
//     setCurrentPage(1);
//     setViewMode('REPORT');
//     setSelectedInvoices([]);
//   };

//   const formatCurrency = (amount: string | number): string => {
//     const num = parseFloat(amount.toString() || '0');
//     return num.toLocaleString('en-IN', {
//       minimumFractionDigits: 2,
//       maximumFractionDigits: 2,
//     });
//   };

//   const renderTable = () => {
//     if (
//       !reportData ||
//       !reportData.reportData ||
//       reportData.reportData.length === 0
//     ) {
//       return null;
//     }

//     let filteredRows = reportData.reportData;
//     if (viewMode === 'REPORT') {
//       filteredRows = reportData.reportData.filter(
//         row => row[9]?.trim() === 'PAID',
//       );
//     } else if (viewMode === 'DUE') {
//       filteredRows = reportData.reportData.filter(
//         row => row[9]?.trim() === 'DUE',
//       );
//     }

//     const displayRows = filteredRows.map((row, index) => [
//       index + 1, // New Sr. No. starting from 1
//       ...row.slice(1), // Keep all columns except the original Sr. No.
//     ]);

//     const headers = reportData.headers || [
//       'Sr. No.',
//       'Bill No',
//       'Invoice Date',
//       'Unit Name',
//       'Total Invoice Item Amount',
//       'Total Tax Amount',
//       'Total Invoice Amount',
//       'Total Roundoff Amount',
//       'Invoice Outstanding Amount',
//       'Payment Status',
//     ];

//     const startIndex = (currentPage - 1) * entriesPerPage;
//     const endIndex = startIndex + entriesPerPage;
//     const paginatedData = displayRows.slice(startIndex, endIndex);
//     const totalPages = Math.ceil(displayRows.length / entriesPerPage);
//     // All bill numbers in current filtered view (for select all)
//     const allBillNosInView = filteredRows.map(row => row[1]);
//     const isAllSelected =
//       allBillNosInView.length > 0 &&
//       allBillNosInView.every(billNo => selectedInvoices.includes(billNo));

//     const toggleSelectAll = () => {
//       if (isAllSelected) {
//         setSelectedInvoices([]);
//       } else {
//         setSelectedInvoices(allBillNosInView);
//       }
//     };

//     const selectedTotal = selectedInvoices.reduce((sum, billNo) => {
//       const row = filteredRows.find(r => r[1] === billNo);
//       return sum + parseFloat(row?.[8] || '0');
//     }, 0);

//     return (
//       <View ref={tableContainerRef} style={styles.tableContainer}>
//         <View style={styles.tableHeader}>
//           <Text style={styles.sectionTitle}>Invoice Report</Text>
//           <View style={styles.tableActions}>
//             <Text style={styles.recordsInfo}>
//               Showing {paginatedData.length} of {displayRows.length} records
//             </Text>
//           </View>
//         </View>

//         {/* Clean Text Toggle with Underline */}
//         <View style={styles.toggleContainer}>
//           <TouchableOpacity
//             onPress={() => {
//               setViewMode('REPORT');
//               setCurrentPage(1);
//               setSelectedInvoices([]);
//             }}
//             style={styles.toggleTab}>
//             <Text
//               style={[
//                 styles.toggleTabText,
//                 viewMode === 'REPORT' && styles.toggleTabActive,
//               ]}>
//               Paid Invoices ({reportData.summary?.paidInvoices || 0})
//             </Text>
//             {viewMode === 'REPORT' && <View style={styles.underline} />}
//           </TouchableOpacity>

//           <TouchableOpacity
//             onPress={() => {
//               setViewMode('DUE');
//               setCurrentPage(1);
//             }}
//             style={styles.toggleTab}>
//             <Text
//               style={[
//                 styles.toggleTabText,
//                 viewMode === 'DUE' && styles.toggleTabActive,
//               ]}>
//               Invoice Due ({reportData.summary?.dueInvoices || 0})
//             </Text>
//             {viewMode === 'DUE' && <View style={styles.underline} />}
//           </TouchableOpacity>
//         </View>

//         {/* Make Payment Section - Only in DUE mode */}
//         {viewMode === 'DUE' && (
//           <View style={styles.paymentSection}>
//             <View>
//               {selectedTotal > 0 && (
//                 <PaymentComponent
//                   totalAmount={selectedTotal}
//                   customerName={formData.customerName}
//                   onSuccess={paymentId => {
//                     Alert.alert(
//                       'Success',
//                       `Payment successful! ID: ${paymentId}`,
//                     );
//                     setSelectedInvoices([]);
//                     handleSubmit();
//                   }}
//                   onFailure={error => {
//                     Alert.alert('Payment Failed', error);
//                   }}
//                 />
//               )}
//               {selectedTotal > 0 && (
//                 <Text style={styles.selectedAmountText}>
//                   Selected Amount: ₹{formatCurrency(selectedTotal)}
//                 </Text>
//               )}
//             </View>
//           </View>
//         )}

//         <ScrollView horizontal showsHorizontalScrollIndicator={true}>
//           <View style={{flex: 1}}>
//             <View style={[styles.tableHeaderRow, {flexDirection: 'row'}]}>
//               {viewMode === 'DUE' && (
//                 <TouchableOpacity
//                   onPress={toggleSelectAll}
//                   style={[styles.tableHeaderCell, {width: 60}]}>
//                   <View
//                     style={[
//                       styles.checkbox,
//                       styles.checkboxHeader, // Always white border
//                       isAllSelected && styles.checkboxSelected, // Blue fill + white border
//                       isAllSelected && styles.checkboxHeaderSelected, // Optional override
//                     ]}>
//                     {isAllSelected && (
//                       <Text style={styles.tickMarkHeader}>✓</Text>
//                     )}
//                   </View>
//                 </TouchableOpacity>
//               )}
//               {headers.map((header, index) => (
//                 <View
//                   key={index}
//                   style={[
//                     styles.tableHeaderCell,
//                     {
//                       width:
//                         index === 0
//                           ? 70
//                           : index === 1
//                           ? 160
//                           : index === 9
//                           ? 120
//                           : 140,
//                     },
//                   ]}>
//                   <Text style={styles.tableHeaderText}>{header}</Text>
//                 </View>
//               ))}
//             </View>

//             {paginatedData.map((row, rowIndex) => {
//               const billNo = row[1];
//               const isSelected = selectedInvoices.includes(billNo);

//               return (
//                 <TouchableOpacity
//                   key={rowIndex}
//                   activeOpacity={0.7}
//                   onPress={() =>
//                     viewMode === 'DUE' && toggleInvoiceSelection(billNo)
//                   }
//                   style={[
//                     styles.tableRow,
//                     {flexDirection: 'row'},
//                     isSelected && styles.rowSelected,
//                   ]}>
//                   {/* Checkbox only in DUE mode */}
//                   {viewMode === 'DUE' && (
//                     <View style={[styles.tableCell, {width: 60}]}>
//                       <View
//                         style={[
//                           styles.checkbox,
//                           isSelected && styles.checkboxSelected,
//                         ]}>
//                         {isSelected && <Text style={styles.tickMark}>✓</Text>}
//                       </View>
//                     </View>
//                   )}
//                   {/* Sr. No. */}
//                   <View style={[styles.tableCell, {width: 70}]}>
//                     <Text style={styles.tableRowText}>{row[0]}</Text>
//                   </View>
//                   {/* Bill No */}
//                   <View style={[styles.tableCell, {width: 160}]}>
//                     <TouchableOpacity
//                       onPress={() => handleBillNoClick(billNo)}
//                       style={styles.billNoButton}>
//                       <Text style={styles.billNoText}>{billNo}</Text>
//                     </TouchableOpacity>
//                   </View>
//                   {/* Invoice Date */}
//                   <View style={[styles.tableCell, {width: 140}]}>
//                     <Text style={styles.tableRowText}>{row[2] || ''}</Text>
//                   </View>
//                   {/* Unit Name */}
//                   <View style={[styles.tableCell, {width: 140}]}>
//                     <Text style={styles.tableRowText}>{row[3] || 'N/A'}</Text>
//                   </View>
//                   {/* Amounts */}
//                   <View style={[styles.tableCell, {width: 140}]}>
//                     <Text style={styles.tableRowText}>
//                       ₹{formatCurrency(row[4] || '0')}
//                     </Text>
//                   </View>
//                   <View style={[styles.tableCell, {width: 140}]}>
//                     <Text style={styles.tableRowText}>
//                       ₹{formatCurrency(row[5] || '0')}
//                     </Text>
//                   </View>
//                   <View style={[styles.tableCell, {width: 140}]}>
//                     <Text style={styles.tableRowText}>
//                       ₹{formatCurrency(row[6] || '0')}
//                     </Text>
//                   </View>
//                   <View style={[styles.tableCell, {width: 140}]}>
//                     <Text style={styles.tableRowText}>
//                       ₹{formatCurrency(row[7] || '0')}
//                     </Text>
//                   </View>
//                   <View style={[styles.tableCell, {width: 140}]}>
//                     <Text style={[styles.tableRowText, {fontWeight: 'bold'}]}>
//                       ₹{formatCurrency(row[8] || '0')}
//                     </Text>
//                   </View>
//                   {/* Payment Status - Mustard for DUE */}
//                   <View style={[styles.tableCell, {width: 120}]}>
//                     <Text
//                       style={[
//                         styles.tableRowText,
//                         {
//                           fontWeight: 'bold',
//                           color: row[9] === 'PAID' ? 'green' : '#D4A017', // Mustard color for DUE
//                         },
//                       ]}>
//                       {row[9] || ''}
//                     </Text>
//                   </View>
//                 </TouchableOpacity>
//               );
//             })}
//           </View>
//         </ScrollView>

//         <View style={styles.paginationContainer}>
//           <TouchableOpacity
//             style={[
//               styles.paginationButton,
//               currentPage === 1 && styles.disabledPaginationButton,
//             ]}
//             onPress={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
//             disabled={currentPage === 1}>
//             <Text style={styles.paginationButtonText}>Previous</Text>
//           </TouchableOpacity>

//           <View style={styles.pageInfo}>
//             <Text style={styles.pageText}>
//               Page {currentPage} of {totalPages}
//             </Text>
//           </View>

//           <TouchableOpacity
//             style={[
//               styles.paginationButton,
//               currentPage === totalPages && styles.disabledPaginationButton,
//             ]}
//             onPress={() =>
//               setCurrentPage(prev => Math.min(prev + 1, totalPages))
//             }
//             disabled={currentPage === totalPages}>
//             <Text style={styles.paginationButtonText}>Next</Text>
//           </TouchableOpacity>
//         </View>
//       </View>
//     );
//   };

//   return (
//     <LayoutWrapper showHeader={true} showTabBar={false} route={undefined}>
//       <ScrollView
//         ref={scrollViewRef}
//         style={styles.container}
//         keyboardShouldPersistTaps="handled"
//         showsVerticalScrollIndicator={true}>
//         <View style={styles.titleContainer}>
//           <Text style={styles.titleText}>Invoice Report</Text>
//         </View>

//         <View style={styles.formContainer}>
//           <Text style={styles.label}>Customer Name</Text>
//           <TextInput
//             style={styles.input}
//             value={formData.customerName}
//             onChangeText={text => handleInputChange('customerName', text)}
//             placeholder="Enter customer name (optional)"
//             placeholderTextColor="#999"
//           />

//           <Text style={styles.label}>Bill No</Text>
//           <TextInput
//             style={styles.input}
//             value={formData.billNo}
//             onChangeText={text => handleInputChange('billNo', text)}
//             placeholder="Enter bill number (optional)"
//             placeholderTextColor="#999"
//           />

//           <Text style={styles.label}>Units</Text>
//           <MultiSelect
//             options={unitOptions}
//             selectedValues={formData.units}
//             onSelectChange={handleUnitChange}
//             placeholder="Select units (optional)"
//             primaryColor="#3498db"
//             showSelectAll={true}
//             searchPlaceholder="Search units..."
//           />

//           <Text style={styles.label}>
//             From Date <Text style={styles.required}>*</Text>
//           </Text>
//           <TouchableOpacity
//             style={[
//               styles.dateButton,
//               !formData.fromDate && styles.dateButtonEmpty,
//             ]}
//             onPress={() => setOpenFromDatePicker(true)}>
//             <Text
//               style={[
//                 styles.dateButtonText,
//                 !formData.fromDate && styles.placeholderText,
//               ]}>
//               {formData.fromDate
//                 ? formatDate(formData.fromDate)
//                 : 'Select From Date'}
//             </Text>
//           </TouchableOpacity>

//           <Text style={styles.label}>To Date</Text>
//           <TouchableOpacity
//             style={[
//               styles.dateButton,
//               !formData.toDate && styles.dateButtonEmpty,
//             ]}
//             onPress={() => setOpenToDatePicker(true)}>
//             <Text
//               style={[
//                 styles.dateButtonText,
//                 !formData.toDate && styles.placeholderText,
//               ]}>
//               {formData.toDate
//                 ? formatDate(formData.toDate)
//                 : 'Select To Date (optional)'}
//             </Text>
//           </TouchableOpacity>

//           <DatePicker
//             modal
//             open={openFromDatePicker}
//             date={formData.fromDate || new Date()}
//             onConfirm={date => handleDateChange('fromDate', date)}
//             onCancel={() => setOpenFromDatePicker(false)}
//             mode="date"
//             title="Select From Date"
//           />

//           <DatePicker
//             modal
//             open={openToDatePicker}
//             date={formData.toDate || new Date()}
//             onConfirm={date => handleDateChange('toDate', date)}
//             onCancel={() => setOpenToDatePicker(false)}
//             mode="date"
//             title="Select To Date"
//           />

//           <View style={styles.buttonContainer}>
//             <TouchableOpacity
//               style={[styles.button, styles.clearButton]}
//               onPress={handleClearForm}
//               activeOpacity={0.8}>
//               <Text style={styles.clearButtonText}>Clear</Text>
//             </TouchableOpacity>

//             <TouchableOpacity
//               style={[
//                 styles.button,
//                 styles.submitButton,
//                 loading && styles.disabledButton,
//               ]}
//               onPress={handleSubmit}
//               disabled={loading}
//               activeOpacity={0.8}>
//               {loading ? (
//                 <ActivityIndicator color="#fff" size="small" />
//               ) : (
//                 <Text style={styles.submitButtonText}>Generate Report</Text>
//               )}
//             </TouchableOpacity>
//           </View>
//         </View>

//         {error && (
//           <View style={styles.errorContainer}>
//             <Text style={styles.errorText}>{error}</Text>
//           </View>
//         )}

//         {renderTable()}

//         {reportData && reportData.totalRecords === 0 && (
//           <View style={styles.emptyStateContainer}>
//             <Text style={styles.emptyStateText}>
//               No invoices found matching your criteria
//             </Text>
//             <Text style={styles.emptyStateSubtext}>
//               Try adjusting your search filters
//             </Text>
//           </View>
//         )}
//       </ScrollView>
//     </LayoutWrapper>
//   );
// };

// const styles = StyleSheet.create({
//   container: {
//     flex: 1,
//     backgroundColor: '#f8f9fa',
//   },
//   titleContainer: {
//     alignItems: 'center',
//     marginBottom: 5,
//     backgroundColor: '#f9f9f9',
//     paddingVertical: 10,
//     borderRadius: 8,
//     borderBottomWidth: 1,
//     borderBottomColor: '#eaeaea',
//     shadowColor: '#000',
//     shadowOffset: {width: 0, height: 1},
//     shadowOpacity: 0.1,
//     shadowRadius: 1,
//     elevation: 1,
//   },
//   titleText: {
//     fontSize: 20,
//     fontWeight: '600',
//     color: '#3498db',
//   },
//   formContainer: {
//     backgroundColor: '#fff',
//     margin: 16,
//     padding: 20,
//     borderRadius: 12,
//     shadowColor: '#000',
//     shadowOffset: {width: 0, height: 2},
//     shadowOpacity: 0.1,
//     shadowRadius: 8,
//     elevation: 4,
//   },
//   label: {
//     fontSize: 16,
//     fontWeight: '600',
//     marginBottom: 8,
//     color: '#34495e',
//   },
//   required: {
//     color: '#e74c3c',
//   },
//   input: {
//     borderWidth: 1,
//     borderColor: '#ddd',
//     borderRadius: 8,
//     padding: 12,
//     marginBottom: 16,
//     fontSize: 16,
//     backgroundColor: '#fff',
//   },
//   dateButton: {
//     borderWidth: 1,
//     borderColor: '#ddd',
//     borderRadius: 8,
//     padding: 12,
//     marginBottom: 16,
//     justifyContent: 'center',
//     backgroundColor: '#fff',
//   },
//   dateButtonEmpty: {
//     borderColor: '#ddd',
//   },
//   dateButtonText: {
//     fontSize: 16,
//     color: '#2c3e50',
//   },
//   placeholderText: {
//     color: '#999',
//   },
//   buttonContainer: {
//     flexDirection: 'row',
//     justifyContent: 'space-between',
//     marginTop: 10,
//     marginHorizontal: -5,
//   },
//   button: {
//     flex: 1,
//     padding: Platform.OS === 'android' ? 9 : 12,
//     borderRadius: 8,
//     alignItems: 'center',
//     marginHorizontal: 5,
//     elevation: 3,
//     justifyContent: 'center',
//     minHeight: 45,
//     ...Platform.select({
//       android: {
//         overflow: 'hidden',
//       },
//     }),
//   },
//   clearButton: {
//     backgroundColor: '#95a5a6',
//   },
//   clearButtonText: {
//     color: '#fff',
//     fontSize: 16,
//     fontWeight: '600',
//     textAlign: 'center',
//   },
//   submitButton: {
//     backgroundColor: '#3498db',
//   },
//   submitButtonText: {
//     color: '#fff',
//     fontSize: 16,
//     fontWeight: '600',
//     textAlign: 'center',
//   },
//   disabledButton: {
//     backgroundColor: '#bdc3c7',
//   },
//   errorContainer: {
//     margin: 16,
//     padding: 12,
//     backgroundColor: '#ffeaea',
//     borderRadius: 8,
//     borderLeftWidth: 4,
//     borderLeftColor: '#e74c3c',
//   },
//   errorText: {
//     color: '#c0392b',
//     fontSize: 14,
//     fontWeight: '500',
//   },
//   tableContainer: {
//     backgroundColor: '#fff',
//     margin: 16,
//     padding: 20,
//     borderRadius: 12,
//     shadowColor: '#000',
//     shadowOffset: {width: 0, height: 2},
//     shadowOpacity: 0.1,
//     shadowRadius: 8,
//     elevation: 4,
//   },
//   tableHeader: {
//     flexDirection: 'row',
//     justifyContent: 'space-between',
//     alignItems: 'center',
//     marginBottom: 16,
//   },
//   sectionTitle: {
//     fontSize: 18,
//     fontWeight: 'bold',
//     color: '#2c3e50',
//   },
//   tableActions: {
//     alignItems: 'flex-end',
//   },
//   recordsInfo: {
//     fontSize: 12,
//     color: '#7f8c8d',
//     marginBottom: 4,
//   },
//   tableHeaderRow: {
//     height: 50,
//     backgroundColor: '#3498db',
//   },
//   tableHeaderText: {
//     fontWeight: 'bold',
//     textAlign: 'center',
//     fontSize: 12,
//     color: '#fff',
//     paddingHorizontal: 4,
//   },
//   tableRow: {
//     height: 45,
//     backgroundColor: '#f8f9fa',
//   },
//   rowSelected: {
//     backgroundColor: '#fffacd', // Light mustard highlight when selected
//   },
//   tableRowText: {
//     textAlign: 'center',
//     fontSize: 11,
//     color: '#2c3e50',
//     paddingHorizontal: 4,
//   },
//   paginationContainer: {
//     flexDirection: 'row',
//     justifyContent: 'space-between',
//     alignItems: 'center',
//     marginTop: 16,
//     paddingTop: 16,
//     borderTopWidth: 1,
//     borderTopColor: '#e0e0e0',
//   },
//   paginationButton: {
//     backgroundColor: '#3498db',
//     paddingHorizontal: 16,
//     paddingVertical: 8,
//     borderRadius: 6,
//     minWidth: 80,
//     alignItems: 'center',
//   },
//   disabledPaginationButton: {
//     backgroundColor: '#bdc3c7',
//   },
//   paginationButtonText: {
//     color: '#fff',
//     fontSize: 14,
//     fontWeight: '600',
//   },
//   pageInfo: {
//     alignItems: 'center',
//   },
//   pageText: {
//     fontSize: 14,
//     color: '#2c3e50',
//     fontWeight: '500',
//   },
//   emptyStateContainer: {
//     backgroundColor: '#fff',
//     margin: 16,
//     padding: 40,
//     borderRadius: 12,
//     alignItems: 'center',
//     shadowColor: '#000',
//     shadowOffset: {width: 0, height: 2},
//     shadowOpacity: 0.1,
//     shadowRadius: 8,
//     elevation: 4,
//   },
//   emptyStateText: {
//     fontSize: 16,
//     fontWeight: '600',
//     color: '#7f8c8d',
//     textAlign: 'center',
//     marginBottom: 8,
//   },
//   emptyStateSubtext: {
//     fontSize: 14,
//     color: '#95a5a6',
//     textAlign: 'center',
//   },
//   tableHeaderCell: {
//     height: 50,
//     backgroundColor: '#3498db',
//     justifyContent: 'center',
//     alignItems: 'center',
//     borderRightWidth: 1,
//     borderRightColor: '#fff',
//     paddingHorizontal: 4,
//   },
//   tableCell: {
//     height: 45,
//     backgroundColor: '#f8f9fa',
//     justifyContent: 'center',
//     alignItems: 'center',
//     borderRightWidth: 1,
//     borderRightColor: '#e0e0e0',
//     paddingHorizontal: 4,
//   },
//   billNoButton: {
//     paddingHorizontal: 8,
//     paddingVertical: 4,
//     borderRadius: 4,
//     minWidth: 80,
//     alignItems: 'center',
//   },
//   billNoText: {
//     color: '#3498db',
//     fontSize: 11,
//     fontWeight: '600',
//     textAlign: 'center',
//   },

//   // Clean toggle design
//   toggleContainer: {
//     flexDirection: 'row',
//     justifyContent: 'center',
//     marginVertical: 12,
//     paddingHorizontal: 20,
//   },
//   toggleTab: {
//     paddingHorizontal: 20,
//     paddingVertical: 10,
//   },
//   toggleTabText: {
//     fontSize: 15,
//     fontWeight: '600',
//     color: '#666',
//   },
//   toggleTabActive: {
//     color: '#3498db',
//     fontWeight: '700',
//   },
//   underline: {
//     height: 3,
//     backgroundColor: '#3498db',
//     marginTop: 6,
//     borderRadius: 2,
//   },

//   // Payment section - aligned left
//   paymentSection: {
//     marginVertical: 0,
//     paddingVertical: 0,
//   },
//   selectedAmountText: {
//     fontSize: 16,
//     fontWeight: 'bold',
//     color: '#2c3e50',
//     marginBottom: 8,
//     paddingVertical: 5,
//   },

//   // Checkbox styles - improved
//   checkbox: {
//     width: 24,
//     height: 22,
//     borderWidth: 2,
//     borderColor: '#3498db', // default blue border
//     borderRadius: 4,
//     justifyContent: 'center',
//     alignItems: 'center',
//   },
//   checkboxHeader: {
//     borderColor: '#fff', // Always white border in header
//   },
//   checkboxSelected: {
//     backgroundColor: '#3498db', // Fill blue when selected
//     borderColor: '#fff', // White border when selected
//   },
//   checkboxHeaderSelected: {
//     backgroundColor: '#fff', // Optional: white fill for contrast, or keep blue
//   },
//   tickMark: {
//     color: '#fff',
//     fontSize: 16,
//     fontWeight: 'bold',
//   },
//   tickMarkHeader: {
//     color: '#3498db', // White tick in header
//     fontSize: 16,
//     fontWeight: 'bold',
//   },
// });

// export default FinanceScreen;
