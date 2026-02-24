import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
} from 'react-native';

import Icon from 'react-native-vector-icons/MaterialIcons';

// TypeScript interfaces
interface InvoiceRow {
  srNo: string;
  billNo: string;
  invoiceDate: string;
  totalInvoiceItemAmount: string;
  totalTaxAmount: string;
  totalInvoiceAmount: string;
}

interface SummaryData {
  totalInvoiceItemAmount: number;
  totalTaxAmount: number;
  totalInvoiceAmount: number;
}

interface SearchFilters {
  customerName?: string;
  billNo?: string;
  unit?: string;
  fromDate?: string;
  toDate?: string;
}

interface ReportData {
  reportData: string[][];
  headers: string[];
  summary: SummaryData;
}

interface RouteParams {
  reportData?: ReportData;
  searchFilters?: SearchFilters;
}

interface InvoiceReportScreenProps {
  route: {
    params?: RouteParams;
  };
  navigation: any;
}

const InvoiceReportScreen: React.FC<InvoiceReportScreenProps> = ({
  route,
  navigation,
}) => {
  const { reportData, searchFilters } = route.params || {};

  const [filteredData, setFilteredData] = useState<InvoiceRow[]>([]);
  const [searchText, setSearchText] = useState<string>('');
  const [entriesPerPage, setEntriesPerPage] = useState<number>(10);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [loading, setLoading] = useState<boolean>(false);

  useEffect(() => {
    if (reportData && reportData.reportData) {
      // Map ONLY the 6 columns we want to display (indices 0-5)
      const formattedData: InvoiceRow[] = reportData.reportData.map(row => ({
        srNo: row[0] || '',
        billNo: row[1] || '',
        invoiceDate: row[2] || '',
        totalInvoiceItemAmount: row[3] || '0',
        totalTaxAmount: row[4] || '0',
        totalInvoiceAmount: row[5] || '0',
        totalRoundoffAmount: row[6] || '0',
        paymentStatus: row[8] || 'Paid',
        //Ignoring row[6] (TotalRoundOff Amount)
        // Ignoring row[7] (Invoice Outstanding Amount)
        // Ignoring row[8] (Payment Status)
      }));
      setFilteredData(formattedData);
    }
  }, [reportData]);

  const handleSearch = (text: string) => {
    setSearchText(text);
    setCurrentPage(1);

    if (!text.trim() || !reportData || !reportData.reportData) {
      const formattedData: InvoiceRow[] =
        reportData?.reportData?.map(row => ({
          srNo: row[0] || '',
          billNo: row[1] || '',
          invoiceDate: row[2] || '',
          totalInvoiceItemAmount: row[3] || '0',
          totalTaxAmount: row[4] || '0',
          totalInvoiceAmount: row[5] || '0',
          paymentStatus: row[8] || 'Paid',
        })) || [];
      setFilteredData(formattedData);
      return;
    }

    const filtered: InvoiceRow[] = reportData.reportData
      .map(row => ({
        srNo: row[0] || '',
        billNo: row[1] || '',
        invoiceDate: row[2] || '',
        totalInvoiceItemAmount: row[3] || '0',
        totalTaxAmount: row[4] || '0',
        totalInvoiceAmount: row[5] || '0',
        paymentStatus: row[8] || 'Paid',
      }))
      .filter(row =>
        Object.values(row).some(
          value =>
            value &&
            value.toString().toLowerCase().includes(text.toLowerCase()),
        ),
      );

    setFilteredData(filtered);
  };

  const formatCurrency = (amount: string | number): string => {
    const numAmount = parseFloat(amount?.toString() || '0');
    if (isNaN(numAmount)) return '0.00';
    return numAmount.toLocaleString('en-IN', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  };

  const calculateSummary = (): SummaryData | null => {
    if (!reportData?.summary) return null;

    if (searchText && filteredData.length !== reportData.reportData.length) {
      return filteredData.reduce(
        (acc: SummaryData, row: InvoiceRow) => {
          acc.totalInvoiceItemAmount += parseFloat(
            row.totalInvoiceItemAmount || '0',
          );
          acc.totalTaxAmount += parseFloat(row.totalTaxAmount || '0');
          acc.totalInvoiceAmount += parseFloat(row.totalInvoiceAmount || '0');
          return acc;
        },
        {
          totalInvoiceItemAmount: 0,
          totalTaxAmount: 0,
          totalInvoiceAmount: 0,
        },
      );
    }

    return reportData.summary;
  };

  const getPaginatedData = (): InvoiceRow[] => {
    const startIndex = (currentPage - 1) * entriesPerPage;
    const endIndex = startIndex + entriesPerPage;
    return filteredData.slice(startIndex, endIndex);
  };

  const totalPages = Math.ceil(filteredData.length / entriesPerPage);

  const handlePageChange = (page: number) => {
    if (page >= 1 && page <= totalPages) {
      setCurrentPage(page);
    }
  };

  const handleExport = () => {
    Alert.alert('Export Data', 'Choose export format:', [
      { text: 'Excel', onPress: () => console.log('Export to Excel') },
      { text: 'PDF', onPress: () => console.log('Export to PDF') },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const renderFiltersUsed = (): React.JSX.Element | null => {
    if (!searchFilters) return null;

    const activeFilters: string[] = [];
    if (searchFilters.customerName)
      activeFilters.push(`Customer: ${searchFilters.customerName}`);
    if (searchFilters.billNo)
      activeFilters.push(`Bill No: ${searchFilters.billNo}`);
    if (searchFilters.unit) activeFilters.push(`Unit: ${searchFilters.unit}`);
    if (searchFilters.fromDate)
      activeFilters.push(`From: ${searchFilters.fromDate}`);
    if (searchFilters.toDate) activeFilters.push(`To: ${searchFilters.toDate}`);

    if (activeFilters.length === 0) return null;

    return (
      <View style={styles.filtersContainer}>
        <Text style={styles.filtersTitle}>Applied Filters:</Text>
        <Text style={styles.filtersText}>{activeFilters.join(' | ')}</Text>
      </View>
    );
  };

  const renderSummary = (): React.JSX.Element | null => {
    const summary = calculateSummary();
    if (!summary) return null;

    return (
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.summaryScrollView}
      >
        <View style={styles.summaryContainer}>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryCardTitle}>Total Records</Text>
            <Text style={styles.summaryCardValue}>{filteredData.length}</Text>
          </View>

          <View style={styles.summaryCard}>
            <Text style={styles.summaryCardTitle}>Invoice Item Amount</Text>
            <Text style={styles.summaryCardValue}>
              ₹{formatCurrency(summary.totalInvoiceItemAmount)}
            </Text>
          </View>

          <View style={styles.summaryCard}>
            <Text style={styles.summaryCardTitle}>Tax Amount</Text>
            <Text style={styles.summaryCardValue}>
              ₹{formatCurrency(summary.totalTaxAmount)}
            </Text>
          </View>

          <View style={styles.summaryCard}>
            <Text style={styles.summaryCardTitle}>Invoice Amount</Text>
            <Text style={styles.summaryCardValue}>
              ₹{formatCurrency(summary.totalInvoiceAmount)}
            </Text>
          </View>
        </View>
      </ScrollView>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TextInput
          style={styles.searchInput}
          placeholder="Search..."
          value={searchText}
          onChangeText={handleSearch}
        />
        <TouchableOpacity onPress={handleExport}>
          <Icon name="file-download" size={28} color="#007bff" />
        </TouchableOpacity>
      </View>

      {renderFiltersUsed()}
      {renderSummary()}

      {loading ? (
        <ActivityIndicator size="large" color="#0000ff" />
      ) : (
        <ScrollView horizontal>
          <View style={styles.tableContainer}>
            {/* Header Row */}
            <View style={styles.row}>
              <Text style={[styles.headerCell, { width: 70 }]}>Sr. No.</Text>
              <Text style={[styles.headerCell, { width: 160 }]}>Bill No</Text>
              <Text style={[styles.headerCell, { width: 130 }]}>
                Invoice Date
              </Text>
              <Text style={[styles.headerCell, { width: 160 }]}>
                Invoice Item Amount
              </Text>
              <Text style={[styles.headerCell, { width: 150 }]}>
                Tax Amount
              </Text>
              <Text style={[styles.headerCell, { width: 170 }]}>
                Invoice Amount
              </Text>
            </View>

            {/* Data Rows */}
            {getPaginatedData().map((row: InvoiceRow, index: number) => (
              <View key={index} style={styles.row}>
                <Text style={[styles.cell, { width: 70 }]}>{row.srNo}</Text>
                <Text style={[styles.cell, { width: 160 }]}>{row.billNo}</Text>
                <Text style={[styles.cell, { width: 130 }]}>
                  {row.invoiceDate}
                </Text>
                <Text style={[styles.cell, { width: 160 }]}>
                  ₹{formatCurrency(row.totalInvoiceItemAmount)}
                </Text>
                <Text style={[styles.cell, { width: 150 }]}>
                  ₹{formatCurrency(row.totalTaxAmount)}
                </Text>
                <Text style={[styles.cell, { width: 170 }]}>
                  ₹{formatCurrency(row.totalInvoiceAmount)}
                </Text>
              </View>
            ))}
          </View>
        </ScrollView>
      )}

      <View style={styles.paginationContainer}>
        <TouchableOpacity
          onPress={() => handlePageChange(currentPage - 1)}
          disabled={currentPage === 1}
          style={styles.pageButton}
        >
          <Text style={styles.pageButtonText}>{'<'}</Text>
        </TouchableOpacity>
        <Text style={styles.pageIndicator}>
          Page {currentPage} of {totalPages}
        </Text>
        <TouchableOpacity
          onPress={() => handlePageChange(currentPage + 1)}
          disabled={currentPage === totalPages}
          style={styles.pageButton}
        >
          <Text style={styles.pageButtonText}>{'>'}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    backgroundColor: '#fff',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  searchInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    padding: 10,
    marginRight: 10,
  },
  filtersContainer: {
    backgroundColor: '#f0f0f0',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  filtersTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  filtersText: {
    fontSize: 12,
    color: '#555',
  },
  summaryScrollView: {
    marginBottom: 16,
  },
  summaryContainer: {
    flexDirection: 'row',
    gap: 12,
  },
  summaryCard: {
    backgroundColor: '#007bff',
    padding: 16,
    borderRadius: 8,
    minWidth: 150,
    alignItems: 'center',
  },
  summaryCardTitle: {
    fontSize: 12,
    color: '#fff',
    marginBottom: 8,
  },
  summaryCardValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
  },
  tableContainer: {
    marginBottom: 16,
  },

  paginationContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 16,
  },
  pageButton: {
    padding: 10,
    backgroundColor: '#007bff',
    borderRadius: 5,
    marginHorizontal: 10,
  },
  pageButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  pageIndicator: {
    fontSize: 14,
  },
  row: {
    flexDirection: 'row',
    borderWidth: 1,
    borderColor: '#ccc',
  },

  headerCell: {
    padding: 10,
    fontSize: 12,
    fontWeight: 'bold',
    color: '#fff',
    backgroundColor: '#007bff',
    textAlign: 'center',
    borderRightWidth: 1,
    borderColor: '#ccc',
  },

  cell: {
    padding: 10,
    fontSize: 11,
    textAlign: 'center',
    borderRightWidth: 1,
    borderColor: '#ccc',
  },
});

export default InvoiceReportScreen;
