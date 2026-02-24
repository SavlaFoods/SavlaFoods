import React, {useState, useRef, useEffect} from 'react';
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
import axios from 'axios';
import {useNavigation} from '@react-navigation/native';
import {NativeStackNavigationProp} from '@react-navigation/native-stack';
import {LayoutWrapper} from '../../components/AppLayout';
import {useDisplayName} from '../../contexts/DisplayNameContext';
import MultiSelect from '../../components/Multiselect';
import PaymentComponent from '../../components/PaymentComponent';
import {API_ENDPOINTS} from '../../config/api.config';

type RootStackParamList = {
  InvoiceDetailsScreen: {invoiceNo: string};
};

interface FormData {
  customerName: string;
  billNo: string;
  units: string[];
  fromDate: Date | null;
  toDate: Date | null;
}

interface Summary {
  totalInvoiceItemAmount: string;
  totalTaxAmount: string;
  totalInvoiceAmount: string;
  totalRoundoffAmount: string;
  totalOutstandingAmount: string;
  outstandingInvoices: number;
}

interface ReportData {
  success: boolean;
  message: string;
  totalRecords: number;
  requestData: any;
  summary: Summary;
  headers: string[];
  reportData: any[][];
}

interface UnitOption {
  label: string;
  value: string;
}

const OutstandingReportScreen: React.FC = () => {
  const {displayName} = useDisplayName();
  const scrollViewRef = useRef<ScrollView>(null);
  const tableContainerRef = useRef<View>(null);
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  const unitOptions: UnitOption[] = [
    {label: 'D-39', value: 'D-39'},
    {label: 'D-514', value: 'D-514'},
    // Add more units as needed
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
  const [selectedInvoices, setSelectedInvoices] = useState<string[]>([]);

  const entriesPerPage = 10;

  useEffect(() => {
    if (displayName) {
      setFormData(prev => ({...prev, customerName: displayName}));
    }
  }, [displayName]);

  useEffect(() => {
    if (
      reportData &&
      reportData.reportData.length > 0 &&
      tableContainerRef.current
    ) {
      tableContainerRef.current.measureLayout(
        scrollViewRef.current as any,
        (x, y) => {
          scrollViewRef.current?.scrollTo({y: y - 20, animated: true});
        },
        () => {},
      );
    }
  }, [reportData]);

  const handleInputChange = (name: keyof FormData, value: string) => {
    setFormData(prev => ({...prev, [name]: value}));
    setError(null);
  };

  const handleUnitChange = (selectedUnits: string[]) => {
    setFormData(prev => ({...prev, units: selectedUnits}));
    setError(null);
  };

  const handleDateChange = (name: 'fromDate' | 'toDate', date: Date) => {
    setFormData(prev => ({...prev, [name]: date}));
    if (name === 'fromDate') setOpenFromDatePicker(false);
    else setOpenToDatePicker(false);
    setError(null);
  };

  const formatDate = (date: Date | null): string => {
    if (!date) return '';
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
  };

  const validateForm = (): boolean => {
    // Removed the mandatory check for fromDate
    if (
      formData.toDate &&
      formData.fromDate &&
      formData.fromDate > formData.toDate
    ) {
      Alert.alert(
        'Validation Error',
        'To Date must be after or same as From Date',
      );
      return false;
    }
    return true;
  };

  const toggleInvoiceSelection = (billNo: string) => {
    setSelectedInvoices(prev =>
      prev.includes(billNo)
        ? prev.filter(i => i !== billNo)
        : [...prev, billNo],
    );
  };

  const handleBillNoClick = (billNo: string) => {
    if (billNo?.trim()) {
      navigation.navigate('InvoiceDetailsScreen', {invoiceNo: billNo.trim()});
    }
  };

  const handleSubmit = async () => {
    if (!validateForm()) return;

    setLoading(true);
    setError(null);
    setReportData(null);
    setCurrentPage(1);
    setSelectedInvoices([]);

    try {
      const API_URL = API_ENDPOINTS.GET_OUTSTANDING_REPORT;

      const payload = {
        customerName: formData.customerName.trim() || null,
        billNo: formData.billNo.trim() || null,
        unit: formData.units.length > 0 ? formData.units : null,
        fromDate: formatDate(formData.fromDate),
        toDate: formData.toDate ? formatDate(formData.toDate) : null,
        paymentStatus: 'DUE', // Force only DUE invoices
      };

      const response = await axios.post(API_URL, payload, {
        timeout: 30000,
      });

      if (response.data && response.data.success) {
        setReportData(response.data);

        if (response.data.totalRecords === 0) {
          Alert.alert(
            'No Records',
            'No due invoices found for the selected criteria.',
          );
        }
      } else {
        throw new Error(response.data?.message || 'Failed to generate report');
      }
    } catch (err: any) {
      const message =
        err.response?.data?.message ||
        err.message ||
        'Network error. Please check your connection or server IP.';
      setError(message);
      Alert.alert('Error', message);
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
    setSelectedInvoices([]);
    setCurrentPage(1);
  };

  const formatCurrency = (amount: string | number): string => {
    const num = parseFloat(amount?.toString() || '0');
    return num.toLocaleString('en-IN', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  };

  const renderTable = () => {
    if (!reportData || reportData.reportData.length === 0) return null;

    // Data already contains only "DUE" invoices because of payload
    const displayRows = reportData.reportData.map((row, index) => [
      index + 1,
      ...row.slice(1), // Sr No + rest of data
    ]);

    const headers = reportData.headers || [
      'Sr. No.',
      'Bill No',
      'Invoice Date',
      'Unit Name',
      'Total Invoice Item Amount',
      'Total Tax Amount',
      'Total Invoice Amount',
      'Total Roundoff Amount',
      'Invoice Outstanding Amount',
      'Payment Status',
    ];

    const startIndex = (currentPage - 1) * entriesPerPage;
    const endIndex = startIndex + entriesPerPage;
    const paginatedData = displayRows.slice(startIndex, endIndex);
    const totalPages = Math.ceil(displayRows.length / entriesPerPage);

    const allBillNos = reportData.reportData.map(row => row[1]);
    const isAllSelected =
      allBillNos.length > 0 &&
      allBillNos.every(bn => selectedInvoices.includes(bn));

    const toggleSelectAll = () => {
      if (isAllSelected) {
        setSelectedInvoices([]);
      } else {
        setSelectedInvoices(allBillNos);
      }
    };

    const selectedTotal = selectedInvoices.reduce((sum, billNo) => {
      const row = reportData.reportData.find(r => r[1] === billNo);
      return sum + parseFloat(row?.[8] || '0'); // Index 8 = Outstanding Amount
    }, 0);

    return (
      <View ref={tableContainerRef} style={styles.tableContainer}>
        <View style={styles.tableHeader}>
          <Text style={styles.sectionTitle}>Outstanding Report</Text>
          {/* <Text style={styles.recordsInfo}>
            Total Due Invoices: {reportData.totalRecords}
          </Text> */}
        </View>

        {/* Summary */}
        {reportData.summary && (
          <View style={styles.summaryContainer}>
            <Text style={styles.summaryText}>
              Total Outstanding: ₹
              {formatCurrency(reportData.summary.totalOutstandingAmount || '0')}
            </Text>
            <Text style={styles.summaryText}>
              Total Invoices: {reportData.summary.outstandingInvoices}
            </Text>
          </View>
        )}

        {/* Payment Section */}
        {selectedTotal > 0 && (
          <View style={styles.paymentSection}>
            {/* <Text style={styles.selectedAmountText}>
              Selected Amount: ₹{formatCurrency(selectedTotal)}
            </Text> */}
            <PaymentComponent
              totalAmount={selectedTotal}
              customerName={formData.customerName}
              onSuccess={paymentId => {
                Alert.alert('Success', `Payment successful! ID: ${paymentId}`);
                setSelectedInvoices([]);
                handleSubmit(); // Refresh data
              }}
              onFailure={error => Alert.alert('Payment Failed', error)}
            />
          </View>
        )}

        <ScrollView horizontal showsHorizontalScrollIndicator>
          <View>
            <View style={[styles.tableHeaderRow, {flexDirection: 'row'}]}>
              {/* Select All Checkbox in Header */}
              {/* <View style={[styles.tableHeaderCell, {width: 60}]}>
                <TouchableOpacity onPress={toggleSelectAll} activeOpacity={0.7}>
                  <View
                    style={[
                      styles.checkboxHeader, // New style for header // Filled only for tick background if needed
                      ,
                    ]}>
                    {isAllSelected && (
                      <Text style={styles.tickMarkHeader}>✓</Text>
                    )}
                  </View>
                </TouchableOpacity>
              </View> */}

              {/* Rest of the headers */}
              {headers.map((header, idx) => (
                <View
                  key={idx}
                  style={[
                    styles.tableHeaderCell,
                    {width: idx === 1 ? 160 : idx === 0 ? 70 : 140},
                  ]}>
                  <Text style={styles.tableHeaderText}>{header}</Text>
                </View>
              ))}
            </View>

            {paginatedData.map((row, idx) => {
              const billNo = row[1];
              const isSelected = selectedInvoices.includes(billNo);

              return (
                <TouchableOpacity
                  key={idx}
                  activeOpacity={0.8}
                  onPress={() => toggleInvoiceSelection(billNo)}
                  style={[
                    styles.tableRow,
                    {flexDirection: 'row'},
                    isSelected && styles.rowSelected,
                  ]}>
                  {/* <View style={[styles.tableCell, {width: 60}]}>
                    <View
                      style={[
                        styles.checkbox,
                        isSelected && styles.checkboxSelected,
                      ]}>
                      {isSelected && <Text style={styles.tickMark}>✓</Text>}
                    </View>
                  </View> */}
                  {row.map((cell: any, cellIdx: number) => (
                    <View
                      key={cellIdx}
                      style={[
                        styles.tableCell,
                        {width: cellIdx === 1 ? 160 : cellIdx === 0 ? 70 : 140},
                      ]}>
                      {cellIdx === 1 ? ( // Bill No column (index 1 in row after Sr No added)
                        <TouchableOpacity
                          onPress={() => handleBillNoClick(cell)}>
                          <Text style={styles.billNoText}>{cell}</Text>
                        </TouchableOpacity>
                      ) : cellIdx === 10 ? ( // Payment Status is the last column (index 10)
                        <Text
                          style={[
                            styles.tableRowText,
                            cell === 'DUE' && {
                              color: '#B7791F',
                              fontWeight: 'bold',
                            }, // Gold/Yellow
                          ]}>
                          {cell}
                        </Text>
                      ) : (
                        <Text style={styles.tableRowText}>
                          {cellIdx >= 4 && cellIdx <= 8
                            ? `₹${formatCurrency(cell)}`
                            : cell}
                        </Text>
                      )}
                    </View>
                  ))}
                </TouchableOpacity>
              );
            })}
          </View>
        </ScrollView>

        {/* Pagination */}
        <View style={styles.paginationContainer}>
          <TouchableOpacity
            disabled={currentPage === 1}
            onPress={() => setCurrentPage(p => Math.max(p - 1, 1))}
            style={[
              styles.paginationButton,
              currentPage === 1 && styles.disabledPaginationButton,
            ]}>
            <Text style={styles.paginationButtonText}>Previous</Text>
          </TouchableOpacity>
          <Text style={styles.pageText}>
            Page {currentPage} of {totalPages}
          </Text>
          <TouchableOpacity
            disabled={currentPage === totalPages}
            onPress={() => setCurrentPage(p => Math.min(p + 1, totalPages))}
            style={[
              styles.paginationButton,
              currentPage === totalPages && styles.disabledPaginationButton,
            ]}>
            <Text style={styles.paginationButtonText}>Next</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  return (
    <LayoutWrapper showHeader={true} showTabBar={true} route={undefined}>
      <ScrollView
        ref={scrollViewRef}
        style={styles.container}
        keyboardShouldPersistTaps="handled">
        <View style={styles.titleContainer}>
          <Text style={styles.titleText}>Outstanding Report</Text>
        </View>

        <View style={styles.formContainer}>
          <Text style={styles.label}>Customer Name</Text>
          <TextInput
            style={styles.input}
            value={formData.customerName}
            onChangeText={text => handleInputChange('customerName', text)}
            placeholder="Enter customer name (optional)"
          />

          <Text style={styles.label}>Bill No</Text>
          <TextInput
            style={styles.input}
            value={formData.billNo}
            onChangeText={text => handleInputChange('billNo', text)}
            placeholder="Enter bill no (optional)"
          />

          <Text style={styles.label}>Units</Text>
          <MultiSelect
            options={unitOptions}
            selectedValues={formData.units}
            onSelectChange={handleUnitChange}
            placeholder="Select units (optional)"
            primaryColor="#3498db"
            showSelectAll
          />

          <Text style={styles.label}>From Date</Text>
          <TouchableOpacity
            style={[
              styles.dateButton,
              !formData.fromDate && styles.dateButtonEmpty,
            ]}
            onPress={() => setOpenFromDatePicker(true)}>
            <Text
              style={[
                styles.dateButtonText,
                !formData.fromDate && styles.placeholderText,
              ]}>
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
            onPress={() => setOpenToDatePicker(true)}>
            <Text
              style={[
                styles.dateButtonText,
                !formData.toDate && styles.placeholderText,
              ]}>
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
          />
          <DatePicker
            modal
            open={openToDatePicker}
            date={formData.toDate || new Date()}
            onConfirm={date => handleDateChange('toDate', date)}
            onCancel={() => setOpenToDatePicker(false)}
            mode="date"
          />

          <View style={styles.buttonContainer}>
            <TouchableOpacity
              style={[styles.button, styles.clearButton]}
              onPress={handleClearForm}>
              <Text style={styles.clearButtonText}>Clear</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.button,
                styles.submitButton,
                loading && styles.disabledButton,
              ]}
              onPress={handleSubmit}
              disabled={loading}>
              {loading ? (
                <ActivityIndicator color="#fff" />
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

        {reportData && reportData.totalRecords === 0 && !loading && (
          <View style={styles.emptyStateContainer}>
            <Text style={styles.emptyStateText}>No due invoices found</Text>
            <Text style={styles.emptyStateSubtext}>
              Try changing the date range or filters
            </Text>
          </View>
        )}
      </ScrollView>
    </LayoutWrapper>
  );
};

const styles = StyleSheet.create({
  summaryContainer: {
    backgroundColor: '#e8f4fd',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  summaryText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#2c3e50',
  },
  // Rest of your existing styles remain the same
  container: {flex: 1, backgroundColor: '#f8f9fa'},
  titleContainer: {alignItems: 'center', paddingVertical: 15},
  titleText: {fontSize: 20, fontWeight: '700', color: '#3498db'},
  formContainer: {
    backgroundColor: '#fff',
    margin: 16,
    padding: 20,
    borderRadius: 12,
    elevation: 4,
  },
  label: {fontSize: 16, fontWeight: '600', marginBottom: 8, color: '#34495e'},
  required: {color: '#e74c3c'},
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
    backgroundColor: '#fff',
  },
  dateButton: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
    justifyContent: 'center',
  },
  dateButtonEmpty: {borderColor: '#ccc'},
  dateButtonText: {fontSize: 16, color: '#2c3e50'},
  placeholderText: {color: '#999'},
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 20,
  },
  button: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginHorizontal: 6,
  },
  clearButton: {backgroundColor: '#95a5a6'},
  clearButtonText: {color: '#fff', fontWeight: '600'},
  submitButton: {backgroundColor: '#3498db'},
  submitButtonText: {color: '#fff', fontWeight: '600'},
  disabledButton: {backgroundColor: '#bdc3c7'},
  errorContainer: {
    margin: 16,
    padding: 12,
    backgroundColor: '#ffeaea',
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#e74c3c',
  },
  errorText: {color: '#c0392b', fontWeight: '500'},
  tableContainer: {
    backgroundColor: '#fff',
    margin: 16,
    padding: 16,
    borderRadius: 12,
    elevation: 4,
  },
  tableHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  sectionTitle: {fontSize: 18, fontWeight: 'bold', color: '#2c3e50'},
  recordsInfo: {fontSize: 14, color: '#7f8c8d'},
  tableHeaderRow: {backgroundColor: '#3498db', height: 50},
  tableHeaderCell: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  tableHeaderText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 12,
    textAlign: 'center',
  },
  tableRow: {height: 50, backgroundColor: '#f8f9fa'},
  rowSelected: {backgroundColor: '#e8f4fd'},
  tableCell: {
    justifyContent: 'center',
    alignItems: 'center',
    borderRightWidth: 1,
    borderRightColor: '#e0e0e0',
  },
  tableRowText: {fontSize: 11, color: '#2c3e50', textAlign: 'center'},
  billNoText: {color: '#3498db', fontWeight: '600', fontSize: 11},
  paginationContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#ddd',
  },
  paginationButton: {
    backgroundColor: '#3498db',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
  },
  disabledPaginationButton: {backgroundColor: '#bdc3c7'},
  paginationButtonText: {color: '#fff', fontWeight: '600'},
  pageText: {fontSize: 14, color: '#2c3e50'},
  emptyStateContainer: {
    margin: 16,
    padding: 40,
    backgroundColor: '#fff',
    borderRadius: 12,
    alignItems: 'center',
    elevation: 4,
  },
  emptyStateText: {fontSize: 16, fontWeight: '600', color: '#7f8c8d'},
  emptyStateSubtext: {fontSize: 14, color: '#95a5a6', marginTop: 8},
  paymentSection: {
    marginVertical: 12,
    // alignItems: 'left',
    alignContent: 'flex-start',
  },
  selectedAmountText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#3298db',
    marginBottom: 10,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderWidth: 2,
    borderColor: '#3498db',
    borderRadius: 4,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxHeader: {
    width: 24,
    height: 24,
    borderWidth: 2,
    borderColor: '#fff', // White border
    backgroundColor: '#fff', // White background
    borderRadius: 4,
    justifyContent: 'center',
    alignItems: 'center',
  },
  tickMarkHeader: {
    color: '#3498db', // Blue tick
    fontWeight: 'bold',
    fontSize: 16,
  },
  checkboxSelected: {backgroundColor: '#3498db'},
  tickMark: {color: '#fff', fontWeight: 'bold', fontSize: 16},
});

export default OutstandingReportScreen;
