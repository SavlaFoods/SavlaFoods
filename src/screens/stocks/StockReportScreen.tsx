import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Modal,
  FlatList,
  Platform,
  ActivityIndicator,
  Keyboard,
  TouchableWithoutFeedback,
  Switch,
  Alert,
  ToastAndroid,
  PermissionsAndroid,
} from 'react-native';
import axios, { AxiosError } from 'axios';
import {
  API_ENDPOINTS,
  DEFAULT_HEADERS,
  getAuthHeaders,
} from '../../config/api.config';
import { getSecureItem } from '../../utils/secureStorage';
import { getSecureOrAsyncItem } from '../../utils/migrationHelper';
import DateTimePicker, {
  DateTimePickerEvent,
} from '@react-native-community/datetimepicker';
import { format } from 'date-fns';
import MultiSelect from '../../components/Multiselect';
import { LayoutWrapper } from '../../components/AppLayout';
import { useRoute } from '@react-navigation/core';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import RNBlobUtil from 'react-native-blob-util';
// For handling binary data
import { Buffer } from 'buffer';
// @ts-ignore
import notifee, { AndroidImportance } from '@notifee/react-native';
// import PushNotification from 'react-native-push-notification';

interface DropdownOption {
  label: string;
  value: string;
}

interface CustomDropdownProps {
  options: DropdownOption[];
  selectedValue: string;
  onSelect: (value: string) => void;
  placeholder: string;
}

const CustomDropdown: React.FC<CustomDropdownProps> = ({
  options,
  selectedValue,
  onSelect,
  placeholder,
}) => {
  const [isVisible, setIsVisible] = useState(false);

  const selectedOption = options.find(option => option.value === selectedValue);
  const displayText = selectedOption ? selectedOption.label : placeholder;

  return (
    <View style={styles.dropdownContainer}>
      <TouchableOpacity
        style={styles.dropdownButton}
        onPress={() => setIsVisible(true)}
      >
        <Text
          style={
            selectedOption
              ? styles.dropdownSelectedText
              : styles.dropdownPlaceholderText
          }
        >
          {displayText}
        </Text>
        <Text style={styles.dropdownIcon}>▼</Text>
      </TouchableOpacity>

      <Modal
        visible={isVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setIsVisible(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setIsVisible(false)}
        >
          <View style={styles.modalContent}>
            <FlatList
              data={options}
              keyExtractor={item => item.value}
              style={{ width: '100%' }}
              keyboardShouldPersistTaps="handled"
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[
                    styles.optionItem,
                    selectedValue === item.value && styles.selectedOption,
                  ]}
                  onPress={() => {
                    onSelect(item.value);
                    setIsVisible(false);
                  }}
                >
                  <Text
                    style={[
                      styles.optionText,
                      selectedValue === item.value && styles.selectedOptionText,
                    ]}
                  >
                    {item.label}
                  </Text>
                </TouchableOpacity>
              )}
            />
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
};

// Updated interface for the new API response
interface StockReportItem {
  ITEM_ID: number;
  ITEM_CODE: string;
  ITEM_DESCRIPTION: string;
  ITEM_NAME: string;
  LOT_NO: number;
  UNIT_NAME: string[] | string; // Modified to handle both array and string
  ITEM_MARKS: string | null;
  VAKAL_NO: string | null;
  BATCH_NO: string | null;
  BALANCE_QTY: number;
  AVAILABLE_QTY: number;
  BOX_QUANTITY: number;
  EXPIRY_DATE: string | null;
  REMARKS: string | null;
  STATUS: string;
  //  ITEM_CATEG_NAME: string;
  SUB_CATEGORY_NAME: string;
  NET_QTY: number;
  INWARD_DT: string | null;
}

interface StockReportResponse {
  status: string;
  count: number;
  data: StockReportItem[];
}

interface SubCategoryItem {
  CATID: string | number;
  CATCODE: string;
  CATDESC: string;
  SUBCATID: string | number;
  SUBCATCODE: string;
  SUBCATDESC: string;
  CATEGORY_IMAGE_NAME?: string;
  SUBCATEGORY_IMAGE_NAME?: string;
  available: boolean; // Added available property
  name: string; // Added name property
}

interface ErrorResponse {
  message?: string;
  status?: string;
  details?: string;
}

// Function to request storage permissions on Android
const requestStoragePermission = async () => {
  if (Platform.OS !== 'android') return true;

  try {
    // For Android 13+ (API level 33+)
    if ((Platform.Version as number) >= 33) {
      const permissions = [
        PermissionsAndroid.PERMISSIONS.READ_MEDIA_IMAGES,
        PermissionsAndroid.PERMISSIONS.READ_MEDIA_VIDEO,
        PermissionsAndroid.PERMISSIONS.READ_MEDIA_AUDIO,
      ];

      const granted = await PermissionsAndroid.requestMultiple(permissions);

      const allGranted = Object.values(granted).every(
        status => status === PermissionsAndroid.RESULTS.GRANTED,
      );

      return allGranted;
    }
    // For Android 10-12 (API level 29-32)
    else if ((Platform.Version as number) >= 29) {
      const granted = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.WRITE_EXTERNAL_STORAGE,
        {
          title: 'Storage Permission',
          message: 'App needs access to storage to download PDF reports.',
          buttonNeutral: 'Ask Me Later',
          buttonNegative: 'Cancel',
          buttonPositive: 'OK',
        },
      );

      return granted === PermissionsAndroid.RESULTS.GRANTED;
    }
    // For Android 9 and below (API level 28 and below)
    else {
      const granted = await PermissionsAndroid.requestMultiple([
        PermissionsAndroid.PERMISSIONS.WRITE_EXTERNAL_STORAGE,
        PermissionsAndroid.PERMISSIONS.READ_EXTERNAL_STORAGE,
      ]);

      return (
        granted[PermissionsAndroid.PERMISSIONS.WRITE_EXTERNAL_STORAGE] ===
          PermissionsAndroid.RESULTS.GRANTED &&
        granted[PermissionsAndroid.PERMISSIONS.READ_EXTERNAL_STORAGE] ===
          PermissionsAndroid.RESULTS.GRANTED
      );
    }
  } catch (err) {
    console.error('Error requesting storage permission:', err);
    return false;
  }
};

const StockReportScreen: React.FC = () => {
  const route = useRoute();
  const [customerName, setCustomerName] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [customerId, setCustomerId] = useState('');
  const [lotNo, setLotNo] = useState('');
  const [vakalNo, setVakalNo] = useState('');
  const [itemSubCategory, setItemSubCategory] = useState<string[]>([]);
  const [itemMarks, setItemMarks] = useState('');
  const [unit, setUnit] = useState<string[]>([]);
  const [fromDate, setFromDate] = useState<Date | null>(null);
  const [toDate, setToDate] = useState<Date | null>(null);
  const [tempFromDate, setTempFromDate] = useState<Date>(new Date());
  const [tempToDate, setTempToDate] = useState<Date>(new Date());
  const [showFromDatePicker, setShowFromDatePicker] = useState<boolean>(false);
  const [showToDatePicker, setShowToDatePicker] = useState<boolean>(false);
  const [isFromDateSelected, setIsFromDateSelected] = useState<boolean>(false);
  const [isToDateSelected, setIsToDateSelected] = useState<boolean>(false);
  const [qtyLessThan, setQtyLessThan] = useState('');
  const [isScrollingToResults, setIsScrollingToResults] = useState(false);
  const scrollViewRef = useRef<ScrollView>(null);
  const resultsRef = useRef<View>(null);
  const [hasSearched, setHasSearched] = useState<boolean>(false);

  // Zero Stock checkbox state
  const [isZeroStock, setIsZeroStock] = useState(false);

  // Pagination state for zero stock
  const [pagination, setPagination] = useState({
    currentPage: 1,
    itemsPerPage: 50,
    totalItems: 0,
    totalPages: 1,
  });

  // API integration state variables
  const [isLoading, setIsLoading] = useState(false);
  const [stockData, setStockData] = useState<StockReportItem[]>([]);
  const [allStockData, setAllStockData] = useState<StockReportItem[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [totalRecords, setTotalRecords] = useState<number>(0);

  // State for PDF download
  const [isPdfDownloading, setIsPdfDownloading] = useState(false);
  const [pdfProgress, setPdfProgress] = useState(0);
  const [pdfStatusMessage, setPdfStatusMessage] = useState('');

  // State for subcategories
  const [subCategories, setSubCategories] = useState<SubCategoryItem[]>([]);
  const [subCategoryLoading, setSubCategoryLoading] = useState(false);

  // Track the active subcategory fetch so stale responses are ignored
  const subCategoryFetchId = useRef<number>(0);

  // Format date for display
  const formatDisplayDate = (date: Date | null): string => {
    if (!date) {
      return '';
    }
    return format(date, 'dd/MM/yyyy');
  };

  // Format dates for API
  const formatApiDate = (date: Date | null): string | null => {
    if (!date) {
      return null;
    }
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  // Enhanced state setters with logging
  const logAndSetCustomerName = (value: string) => {
    console.log('Customer Name changed:', value);
    setCustomerName(value);
  };

  const logAndSetLotNo = (value: string) => {
    console.log('Lot No changed:', value);
    setLotNo(value);
  };

  const logAndSetVakalNo = (value: string) => {
    console.log('Vakal No changed:', value);
    setVakalNo(value);
  };

  const logAndSetItemSubCategory = (values: string[]) => {
    console.log('Item Sub Category changed:', values);
    setItemSubCategory(values);
  };

  const logAndSetItemMarks = (value: string) => {
    console.log('Item Marks changed:', value);
    setItemMarks(value);
  };

  const logAndSetUnit = (values: string[]) => {
    console.log('Unit changed:', values);
    setUnit(values);
  };

  const logAndSetFromDate = (date: Date) => {
    console.log('From Date changed:', date);
    setFromDate(date);
    setIsFromDateSelected(true);
  };

  const logAndSetToDate = (date: Date) => {
    console.log('To Date changed:', date);
    setToDate(date);
    setIsToDateSelected(true);
  };

  const logAndSetQtyLessThan = (value: string) => {
    console.log('Qty Less Than changed:', value);
    setQtyLessThan(value);
  };

  // Scroll to results section when data loads
  useEffect(() => {
    if (stockData.length > 0) {
      setIsScrollingToResults(true);

      setTimeout(() => {
        if (resultsRef.current) {
          resultsRef.current.measure((x, y, width, height, pageX, pageY) => {
            scrollViewRef.current?.scrollTo({ y: pageY - 50, animated: true });
            setTimeout(() => {
              setIsScrollingToResults(false);
            }, 500);
          });
        } else {
          setIsScrollingToResults(false);
        }
      }, 100);
    }
  }, [stockData]);

  // Called explicitly when dates are confirmed or Zero Stock is toggled.
  // NOT a useEffect — avoids accidental re-triggers from search/re-renders.
  const fetchSubCategories = async (
    from: string,
    to: string,
    zeroStock: boolean,
  ) => {
    try {
      setSubCategoryLoading(true);
      setSubCategories([]);

      const id = await getSecureOrAsyncItem('customerID');
      const name = await getSecureOrAsyncItem('Disp_name');

      if (!id || !name) {
        console.error('[SubCategory API] customerID or Disp_name missing');
        setSubCategoryLoading(false);
        return;
      }

      const endpoint = zeroStock
        ? API_ENDPOINTS.GET_ZERO_CATEGORIES
        : API_ENDPOINTS.GET_STOCK_CATEGORIES;

      const payload = {
        customerID: Number(id),
        customerName: name,
        lotNo: null,
        vakaNo: null,
        itemSubCategory: null,
        itemMarks: null,
        unit: null,
        fromDate: from,
        toDate: to,
        qtyLessThan: null,
      };

      console.log('[SubCategory API] Fetching:', endpoint, payload);

      const response = await axios.post(endpoint, payload, {
        headers: DEFAULT_HEADERS,
      });

      if (response.data && Array.isArray(response.data.allSubCategories)) {
        setSubCategories(response.data.allSubCategories);
      } else {
        setSubCategories([]);
        console.error('[SubCategory API] Unexpected response:', response.data);
      }
    } catch (error) {
      setSubCategories([]);
      console.error('[SubCategory API] Error:', error);
    } finally {
      setSubCategoryLoading(false);
    }
  };

  // Fetch display name and customer ID
  useEffect(() => {
    const fetchUserData = async () => {
      try {
        const name = await getSecureOrAsyncItem('Disp_name');
        const id = await getSecureOrAsyncItem('customerID');

        if (name) {
          setDisplayName(name);
          setCustomerName(name);
          console.log('Display name set from secure storage:', name);
        }

        if (id) {
          setCustomerId(id);
          console.log('Customer ID set from secure storage:', id);
        }
      } catch (error) {
        console.error('Error fetching user data:', error);
      }
    };
    fetchUserData();
  }, []);

  const customerOptions: DropdownOption[] = [
    { label: '--SELECT--', value: '' },
    { label: displayName, value: displayName },
  ];

  // FIX 1: Only build subcategory options when both dates are selected.
  // When dates are missing, itemSubCategoryOptions is an empty array and
  // the entire field is hidden (see JSX below), avoiding any confusion.
  const datesSelected = !!fromDate && !!toDate;

  const itemSubCategoryOptions = datesSelected
    ? subCategories
        .slice()
        .sort((a, b) => a.name.localeCompare(b.name))
        .map(item => ({
          label: item.name,
          value: item.name,
          disabled: item.available === false,
        }))
    : [];

  const unitOptions = [
    { label: 'D-39', value: 'D-39' },
    { label: 'D-514', value: 'D-514' },
  ];

  // FIX 3: Toggle Zero Stock without immediately clearing stockData/allStockData
  // to prevent the brief UI layout shift. Data is cleared only when a new search
  // is actually executed (inside handleSearch).
  const toggleZeroStock = () => {
    setIsZeroStock(previousState => {
      const newState = !previousState;
      console.log('Zero Stock toggled:', newState);
      setItemSubCategory([]);
      // Re-fetch subcategories with the new toggle state if dates are ready
      if (fromDate && toDate) {
        const from = formatApiDate(fromDate)!;
        const to = formatApiDate(toDate)!;
        fetchSubCategories(from, to, newState);
      }
      return newState;
    });
  };

  // Update current page data for pagination
  const updateCurrentPageData = (
    data: StockReportItem[],
    page: number,
    itemsPerPage: number,
  ) => {
    const startIndex = (page - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    const paginatedData = data.slice(startIndex, endIndex);
    setStockData(paginatedData);

    setPagination(prev => ({
      ...prev,
      currentPage: page,
      totalItems: data.length,
      totalPages: Math.ceil(data.length / itemsPerPage) || 1,
    }));
  };

  // Handle page change
  const handlePageChange = (newPage: number) => {
    if (newPage < 1 || newPage > pagination.totalPages) return;

    setPagination({
      ...pagination,
      currentPage: newPage,
    });

    updateCurrentPageData(allStockData, newPage, pagination.itemsPerPage);
  };

  // Render pagination UI component
  const renderPagination = () => {
    if (stockData.length === 0) return null;

    const { currentPage, totalPages } = pagination;

    return (
      <View style={styles.paginationContainer}>
        <View style={styles.paginationControls}>
          <TouchableOpacity
            style={[
              styles.pageButton,
              currentPage === 1 && styles.disabledButton,
            ]}
            onPress={() => handlePageChange(1)}
            disabled={currentPage === 1}
          >
            <Text
              style={
                currentPage === 1
                  ? styles.disabledButtonText
                  : styles.pageButtonText
              }
            >
              {'<<'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.pageButton,
              currentPage === 1 && styles.disabledButton,
            ]}
            onPress={() => handlePageChange(currentPage - 1)}
            disabled={currentPage === 1}
          >
            <Text
              style={
                currentPage === 1
                  ? styles.disabledButtonText
                  : styles.pageButtonText
              }
            >
              {'<'}
            </Text>
          </TouchableOpacity>

          <Text style={styles.pageInfo}>
            {currentPage}/{totalPages}
          </Text>

          <TouchableOpacity
            style={[
              styles.pageButton,
              currentPage === totalPages && styles.disabledButton,
            ]}
            onPress={() => handlePageChange(currentPage + 1)}
            disabled={currentPage === totalPages}
          >
            <Text
              style={
                currentPage === totalPages
                  ? styles.disabledButtonText
                  : styles.pageButtonText
              }
            >
              {'>'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.pageButton,
              currentPage === totalPages && styles.disabledButton,
            ]}
            onPress={() => handlePageChange(totalPages)}
            disabled={currentPage === totalPages}
          >
            <Text
              style={
                currentPage === totalPages
                  ? styles.disabledButtonText
                  : styles.pageButtonText
              }
            >
              {'>>'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  // Updated useEffect to scroll to results when data loads
  useEffect(() => {
    if (stockData.length > 0 && !isLoading) {
      setTimeout(() => {
        if (resultsRef.current && scrollViewRef.current) {
          resultsRef.current.measureLayout(
            scrollViewRef.current.getScrollableNode(),
            (x, y) => {
              scrollViewRef.current?.scrollTo({
                y: y + 20,
                animated: true,
              });
            },
            () => {
              scrollViewRef.current?.scrollToEnd({ animated: true });
            },
          );
        }
      }, 300);
    }
  }, [stockData, isLoading]);

  // Updated handleSearch function
  const handleSearch = async () => {
    setHasSearched(true);
    setErrorMessage(null);
    // FIX 3: Clear data here (on explicit search action) instead of on toggle,
    // so the layout shift only happens intentionally when user taps Search.
    setStockData([]);
    setAllStockData([]);
    setTotalRecords(0);
    setIsScrollingToResults(true);

    setPagination({
      ...pagination,
      currentPage: 1,
    });

    try {
      setIsLoading(true);

      if (!customerId) {
        throw new Error('Customer ID not found. Please login again.');
      }

      let fetchedData: StockReportItem[] = [];
      if (isZeroStock) {
        fetchedData = (await fetchZeroStockItems()) || [];
      } else {
        fetchedData = (await fetchStockReportItems()) || [];
      }

      if (fetchedData.length > 0) {
        const totalPages = Math.ceil(
          fetchedData.length / pagination.itemsPerPage,
        );
        setPagination(prev => ({
          ...prev,
          totalItems: fetchedData.length,
          totalPages: totalPages || 1,
        }));

        const startIndex = 0;
        const endIndex = pagination.itemsPerPage;
        const paginatedData = fetchedData.slice(startIndex, endIndex);
        setStockData(paginatedData);
      }
    } catch (error) {
      console.error('Error fetching stock data:', error);
      const axiosError = error as AxiosError<ErrorResponse>;
      if (axiosError.response) {
        console.error(
          'Server response error:',
          axiosError.response.status,
          axiosError.response.data,
        );
        const errorMsg = axiosError.response.data?.message || 'Server error';
        setErrorMessage(
          `Server error: ${axiosError.response.status}. ${errorMsg}`,
        );
      } else if (axiosError.request) {
        console.error('No response received:', axiosError.request);
        setErrorMessage(
          'No response from server. Please check your network connection.',
        );
      } else {
        setErrorMessage(axiosError.message || 'An unknown error occurred');
      }
      setIsScrollingToResults(false);
    } finally {
      setIsLoading(false);
    }
  };

  // Fetch regular stock report items
  const fetchStockReportItems = async () => {
    const payload = {
      customerName: customerName || null,
      lotNo: lotNo ? Number(lotNo) : null,
      vakalNo: vakalNo || null,
      itemSubCategory: itemSubCategory.length > 0 ? itemSubCategory : null,
      itemMarks: itemMarks || null,
      unit: unit.length > 0 ? unit[0] : null,
      fromDate: fromDate ? formatApiDate(fromDate) : null,
      toDate: toDate ? formatApiDate(toDate) : null,
      qtyLessThan: qtyLessThan ? Number(qtyLessThan) : null,
    };

    const apiEndpoint = `${API_ENDPOINTS.GET_STOCK_REPORT}?customerId=${customerId}`;

    console.log(`Using API endpoint: ${apiEndpoint}`);
    console.log('Request payload:', JSON.stringify(payload, null, 2));

    const response = await axios.post(apiEndpoint, payload, {
      headers: DEFAULT_HEADERS,
    });

    console.log('API Response:', JSON.stringify(response.data, null, 2));

    const result = response.data;

    if (result.status === 'success') {
      const data = result.data || [];
      setAllStockData(data);
      setTotalRecords(result.count || 0);
      console.log('Stock data records:', result.count);

      if (data.length > 0) {
        console.log('First record sample:', JSON.stringify(data[0], null, 2));
      } else {
        console.log('No records found');
      }

      return data;
    } else {
      throw new Error(result.message || 'Failed to fetch stock report data');
    }
  };

  // Fetch zero stock items
  const fetchZeroStockItems = async () => {
    const payload = {
      customerName: customerName || null,
      lotNo: lotNo ? Number(lotNo) : null,
      vakalNo: vakalNo || null,
      itemSubCategory: itemSubCategory.length > 0 ? itemSubCategory : null,
      itemMarks: itemMarks || null,
      unit: unit.length > 0 ? unit[0] : null,
      fromDate: fromDate ? formatApiDate(fromDate) : null,
      toDate: toDate ? formatApiDate(toDate) : null,
      qtyLessThan: qtyLessThan ? Number(qtyLessThan) : null,
    };

    const apiEndpoint = `${API_ENDPOINTS.GET_ZERO_STOCK_REPORT}?customerId=${customerId}`;

    console.log(`Using Zero Stock API endpoint: ${apiEndpoint}`);
    console.log(
      'Zero Stock Request payload:',
      JSON.stringify(payload, null, 2),
    );

    const response = await axios.post(apiEndpoint, payload, {
      headers: DEFAULT_HEADERS,
    });

    console.log(
      'Zero Stock API Response:',
      JSON.stringify(response.data, null, 2),
    );

    const result = response.data;

    if (result.status === 'success') {
      const data = result.data || [];
      setAllStockData(data);
      setTotalRecords(result.count || 0);
      console.log('Zero Stock data records:', result.count);

      if (data.length > 0) {
        console.log(
          'First zero stock record sample:',
          JSON.stringify(data[0], null, 2),
        );
      } else {
        console.log('No zero stock records found');
      }

      return data;
    } else {
      throw new Error(result.message || 'Failed to fetch zero stock data');
    }
  };

  const handleClear = () => {
    console.log('Form cleared by user');
    setCustomerName(displayName);
    setLotNo('');
    setVakalNo('');
    setItemSubCategory([]);
    setItemMarks('');
    setUnit([]);
    setFromDate(null);
    setToDate(null);
    setIsFromDateSelected(false);
    setIsToDateSelected(false);
    setQtyLessThan('');
    setStockData([]);
    setAllStockData([]);
    setErrorMessage(null);
    setTotalRecords(0);
    setIsScrollingToResults(false);
    setIsZeroStock(false);
    setHasSearched(false);

    setPagination({
      currentPage: 1,
      itemsPerPage: 50,
      totalItems: 0,
      totalPages: 1,
    });
  };

  // Handle PDF download
  const handlePdfDownload = async () => {
    if (stockData.length === 0) {
      Alert.alert('No Data', 'There is no data to download.');
      return;
    }

    try {
      setIsPdfDownloading(true);
      setPdfProgress(5);
      setPdfStatusMessage('Preparing download...');

      if (Platform.OS === 'android') {
        setPdfProgress(10);
        setPdfStatusMessage('Checking permissions...');
        const hasPermission = await requestStoragePermission();
        if (!hasPermission) {
          Alert.alert(
            'Permission Denied',
            'Storage permission is required to download PDF reports.',
            [{ text: 'OK' }],
          );
          setIsPdfDownloading(false);
          return;
        }
      }

      setPdfProgress(20);
      setPdfStatusMessage('Preparing PDF request...');

      const pdfApiEndpoint = isZeroStock
        ? API_ENDPOINTS.GET_ZERO_STOCK_PDF_REPORT
        : API_ENDPOINTS.GET_STOCK_PDF_REPORT;

      const payload = {
        customerName: customerName || null,
        lotNo: lotNo ? Number(lotNo) : null,
        vakalNo: vakalNo || null,
        itemSubCategory: itemSubCategory.length > 0 ? itemSubCategory : null,
        itemMarks: itemMarks || null,
        unit: unit.length > 0 ? unit[0] : null,
        fromDate: fromDate ? formatApiDate(fromDate) : null,
        toDate: toDate ? formatApiDate(toDate) : null,
        qtyLessThan: qtyLessThan ? Number(qtyLessThan) : null,
      };

      console.log(`Using PDF API endpoint: ${pdfApiEndpoint}`);
      console.log('PDF Request payload:', JSON.stringify(payload, null, 2));

      setPdfProgress(30);
      setPdfStatusMessage('Requesting PDF from server...');

      const currentDate = new Date();
      const dateString = format(currentDate, 'yyyyMMdd_HHmmss');
      const reportType = isZeroStock ? 'ZeroStock' : 'Stock';
      const fileName = `${reportType}_Report_${dateString}.pdf`;

      let dirPath: string;
      let filePath: string;

      if (Platform.OS === 'ios') {
        dirPath = RNBlobUtil.fs.dirs.DocumentDir;
        filePath = `${dirPath}/${fileName}`;
      } else {
        dirPath = RNBlobUtil.fs.dirs.DownloadDir;

        if ((Platform.Version as number) >= 29) {
          console.log('Using app download directory for Android 10+:', dirPath);

          if (dirPath.includes('Android/data')) {
            const directPath = '/storage/emulated/0/Download';
            try {
              const directPathExists = await RNBlobUtil.fs.exists(directPath);
              if (directPathExists) {
                const testFile = `${directPath}/test-write-access.txt`;
                try {
                  await RNBlobUtil.fs.writeFile(testFile, 'test', 'utf8');
                  await RNBlobUtil.fs.unlink(testFile);
                  dirPath = directPath;
                  console.log(
                    'Successfully using external download directory:',
                    dirPath,
                  );
                } catch (writeError) {
                  console.log('External directory not writable:', writeError);
                }
              }
            } catch (error) {
              console.log('Using app-specific directory due to error:', error);
            }
          }
        } else {
          try {
            const directPath = '/storage/emulated/0/Download';
            const exists = await RNBlobUtil.fs.exists(directPath);

            if (exists) {
              const testFile = `${directPath}/test-write-access.txt`;
              try {
                await RNBlobUtil.fs.writeFile(testFile, 'test', 'utf8');
                await RNBlobUtil.fs.unlink(testFile);
                dirPath = directPath;
                console.log('Using external download directory:', dirPath);
              } catch (writeError) {
                console.log('External directory not writable:', writeError);
              }
            } else {
              console.log('Using app download directory:', dirPath);
            }
          } catch (error) {
            console.log('Error checking external directory:', error);
          }
        }

        filePath = `${dirPath}/${fileName}`;
      }

      console.log('File will be saved to:', filePath);

      setPdfProgress(45);
      setPdfStatusMessage('Downloading PDF...');

      const response = await axios({
        url: `${pdfApiEndpoint}?customerId=${customerId}`,
        method: 'POST',
        data: payload,
        responseType: 'arraybuffer',
        headers: {
          ...DEFAULT_HEADERS,
          Accept: 'application/pdf',
        },
      });

      setPdfProgress(60);
      setPdfStatusMessage('Processing PDF data...');

      const data = new Uint8Array(response.data);
      const isPdf =
        data.length > 4 &&
        data[0] === 0x25 && // %
        data[1] === 0x50 && // P
        data[2] === 0x44 && // D
        data[3] === 0x46; // F

      if (!isPdf) {
        const textData = Buffer.from(response.data).toString('utf8');
        console.error('Received non-PDF response:', textData);
        throw new Error(
          `Server returned non-PDF data: ${textData.substring(0, 100)}...`,
        );
      }

      setPdfProgress(70);
      setPdfStatusMessage('Saving PDF file...');

      const pdfData = Buffer.from(response.data).toString('base64');

      const dirExists = await RNBlobUtil.fs.exists(dirPath);
      if (!dirExists) {
        await RNBlobUtil.fs.mkdir(dirPath);
      }

      let finalFilePath = filePath;
      const fileExists = await RNBlobUtil.fs.exists(filePath);
      if (fileExists) {
        const timestamp = new Date().getTime();
        const newFileName = `${reportType}_Report_${dateString}_${timestamp}.pdf`;
        finalFilePath = `${dirPath}/${newFileName}`;
        console.log('File already exists, using unique filename:', newFileName);
      }

      setPdfProgress(80);
      setPdfStatusMessage('Writing file to storage...');

      await RNBlobUtil.fs.writeFile(finalFilePath, pdfData, 'base64');

      const savedFileExists = await RNBlobUtil.fs.exists(finalFilePath);
      if (!savedFileExists) {
        throw new Error(`File could not be saved to ${finalFilePath}`);
      }

      setPdfProgress(90);
      setPdfStatusMessage('Finalizing download...');

      if (Platform.OS === 'android') {
        try {
          await RNBlobUtil.fs.scanFile([
            { path: finalFilePath, mime: 'application/pdf' },
          ]);
          console.log('File scanned successfully');

          const channelId = 'pdf-downloads-stock';

          await notifee.createChannel({
            id: channelId,
            name: 'Stock PDF Downloads',
            importance: AndroidImportance.HIGH,
          });

          const formattedFilePath = !finalFilePath.startsWith('file://')
            ? `file://${finalFilePath}`
            : finalFilePath;

          await notifee.displayNotification({
            title: `${reportType} Report Downloaded`,
            body: `PDF saved to Downloads folder`,
            android: {
              channelId,
              pressAction: {
                id: 'view',
              },
              color: '#F48221',
            },
            data: {
              filePath: formattedFilePath,
            },
          });

          try {
          } catch (notifError) {
            console.error('Error showing notification:', notifError);
            ToastAndroid.showWithGravity(
              'PDF downloaded to Downloads folder',
              ToastAndroid.LONG,
              ToastAndroid.BOTTOM,
            );
          }
        } catch (scanError) {
          console.error('Error making file visible:', scanError);
          ToastAndroid.showWithGravity(
            'PDF saved but may not be visible in Downloads',
            ToastAndroid.LONG,
            ToastAndroid.BOTTOM,
          );
        }
      }

      setPdfProgress(100);
      setPdfStatusMessage('Download complete!');

      setTimeout(() => {
        setIsPdfDownloading(false);

        const isPublicStorage = !finalFilePath.includes('Android/data');
        Alert.alert(
          'PDF Downloaded',
          isPublicStorage
            ? 'The report has been downloaded successfully to Downloads folder!'
            : 'The report has been saved to app storage.',
          [
            {
              text: 'View PDF',
              onPress: () => {
                try {
                  const formattedPath =
                    Platform.OS === 'android' &&
                    !finalFilePath.startsWith('file://')
                      ? `file://${finalFilePath}`
                      : finalFilePath;

                  setTimeout(() => {
                    if (Platform.OS === 'ios') {
                      RNBlobUtil.ios.openDocument(finalFilePath);
                    } else {
                      RNBlobUtil.android.actionViewIntent(
                        finalFilePath,
                        'application/pdf',
                      );
                    }
                  }, 300);
                } catch (viewError) {
                  console.error('Error opening PDF:', viewError);
                  Alert.alert(
                    'Error',
                    'Could not open the PDF file. The file was saved successfully, but there was an error opening it.',
                  );
                }
              },
            },
            { text: 'OK', style: 'cancel' },
          ],
        );
      }, 500);
    } catch (error) {
      console.error('Error downloading PDF:', error);

      let errorMessage = 'Failed to download the PDF report.';
      if (error instanceof Error) {
        errorMessage += ` Error: ${error.message}`;
      }

      Alert.alert('Download Error', errorMessage);
      setIsPdfDownloading(false);
    }
  };

  // Handle date change for From Date
  const onFromDateChange = (
    event: DateTimePickerEvent,
    selectedDate?: Date,
  ) => {
    if (Platform.OS === 'android') {
      setShowFromDatePicker(false);
    }

    if (selectedDate) {
      console.log(`From date changing to ${selectedDate.toISOString()}`);
      setTempFromDate(selectedDate);

      if (Platform.OS === 'android') {
        setFromDate(selectedDate);
        setIsFromDateSelected(true);
        console.log('From date updated (Android)');
        // Trigger subcategory fetch if toDate is already selected
        if (toDate) {
          const from = formatApiDate(selectedDate)!;
          const to = formatApiDate(toDate)!;
          fetchSubCategories(from, to, isZeroStock);
        }
      }
    }
  };

  // Handle date change for To Date
  const onToDateChange = (event: DateTimePickerEvent, selectedDate?: Date) => {
    if (Platform.OS === 'android') {
      setShowToDatePicker(false);
    }

    if (selectedDate) {
      console.log(`To date changing to ${selectedDate.toISOString()}`);
      setTempToDate(selectedDate);

      if (Platform.OS === 'android') {
        setToDate(selectedDate);
        setIsToDateSelected(true);
        console.log('To date updated (Android)');
        // Trigger subcategory fetch if fromDate is already selected
        if (fromDate) {
          const from = formatApiDate(fromDate)!;
          const to = formatApiDate(selectedDate)!;
          fetchSubCategories(from, to, isZeroStock);
        }
      }
    }
  };

  // Confirm date selection for iOS
  const confirmFromDate = () => {
    console.log(`Confirming from date change to ${tempFromDate.toISOString()}`);
    setFromDate(tempFromDate);
    setIsFromDateSelected(true);
    setShowFromDatePicker(false);
    console.log('From date updated (iOS)');
    // Trigger subcategory fetch if toDate is already selected
    if (toDate) {
      const from = formatApiDate(tempFromDate)!;
      const to = formatApiDate(toDate)!;
      fetchSubCategories(from, to, isZeroStock);
    }
  };

  const confirmToDate = () => {
    console.log(`Confirming to date change to ${tempToDate.toISOString()}`);
    setToDate(tempToDate);
    setIsToDateSelected(true);
    setShowToDatePicker(false);
    console.log('To date updated (iOS)');
    // Trigger subcategory fetch if fromDate is already selected
    if (fromDate) {
      const from = formatApiDate(fromDate)!;
      const to = formatApiDate(tempToDate)!;
      fetchSubCategories(from, to, isZeroStock);
    }
  };

  // Render table header
  const renderTableHeader = () => (
    <View style={styles.tableHeader}>
      <Text style={[styles.tableHeaderCell, styles.srNoColumn]}>Sr.No</Text>
      <Text style={[styles.tableHeaderCell, styles.unitColumn]}>Unit</Text>
      <Text style={[styles.tableHeaderCell, styles.inwardDateColumn]}>
        Inward Date
      </Text>
      <Text style={[styles.tableHeaderCell, styles.lotColumn]}>Lot No</Text>
      <Text style={[styles.tableHeaderCell, styles.itemDescColumn]}>
        Item Name
      </Text>
      <Text style={[styles.tableHeaderCell, styles.vakalNoColumn]}>
        Vakal No
      </Text>
      <Text style={[styles.tableHeaderCell, styles.itemMarksColumn]}>
        Item Marks
      </Text>
      <Text style={[styles.tableHeaderCell, styles.netQtyColumn]}>Net Qty</Text>
      <Text style={[styles.tableHeaderCell, styles.expiryDateColumn]}>
        Expiry Date
      </Text>
      <Text style={[styles.tableHeaderCell, styles.remarksColumn]}>
        Remarks
      </Text>
    </View>
  );

  // Render table row
  const renderTableRow = ({
    item,
    index,
  }: {
    item: StockReportItem;
    index: number;
  }) => (
    <View
      style={[
        styles.tableRow,
        index % 2 === 0 ? styles.evenRow : styles.oddRow,
      ]}
    >
      <Text style={[styles.tableCell, styles.srNoColumn]}>
        {pagination.currentPage > 1
          ? (pagination.currentPage - 1) * pagination.itemsPerPage + index + 1
          : index + 1}
      </Text>
      <Text style={[styles.tableCell, styles.unitColumn]} numberOfLines={1}>
        {Array.isArray(item.UNIT_NAME)
          ? item.UNIT_NAME.join(', ')
          : item.UNIT_NAME}
      </Text>
      <Text
        style={[styles.tableCell, styles.inwardDateColumn]}
        numberOfLines={1}
      >
        {item.INWARD_DT || '-'}
      </Text>
      <Text style={[styles.tableCell, styles.lotColumn]}>{item.LOT_NO}</Text>
      <Text style={[styles.tableCell, styles.itemDescColumn]} numberOfLines={2}>
        {item.ITEM_DESCRIPTION}
      </Text>
      <Text style={[styles.tableCell, styles.vakalNoColumn]} numberOfLines={3}>
        {item.VAKAL_NO || '-'}
      </Text>
      <Text
        style={[styles.tableCell, styles.itemMarksColumn]}
        numberOfLines={3}
      >
        {item.ITEM_MARKS || '-'}
      </Text>
      <Text style={[styles.tableCell, styles.netQtyColumn]}>
        {item.NET_QTY}
      </Text>
      <Text
        style={[styles.tableCell, styles.expiryDateColumn]}
        numberOfLines={1}
      >
        {item.EXPIRY_DATE || '-'}
      </Text>
      <Text style={[styles.tableCell, styles.remarksColumn]} numberOfLines={2}>
        {item.REMARKS || '-'}
      </Text>
    </View>
  );

  return (
    <LayoutWrapper showHeader={true} showTabBar={false} route={route}>
      <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
        <ScrollView
          ref={scrollViewRef}
          style={styles.container}
          contentContainerStyle={styles.contentContainer}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
        >
          {/* Form header */}
          <View style={styles.titleContainer}>
            <Text style={styles.titleText}>Stock Report</Text>
          </View>

          <View style={styles.formRow}>
            <View style={styles.formColumn}>
              <Text style={styles.label}>Customer Name</Text>
              <CustomDropdown
                options={customerOptions}
                selectedValue={customerName}
                onSelect={logAndSetCustomerName}
                placeholder="--SELECT--"
              />
            </View>

            <View style={styles.formColumn}>
              <Text style={styles.label}>Lot No</Text>
              <TextInput
                style={styles.input}
                value={lotNo}
                onChangeText={logAndSetLotNo}
                placeholder=""
                keyboardType="numeric"
              />
            </View>
          </View>

          <View style={styles.formRow}>
            <View style={styles.formColumn}>
              <Text style={styles.label}>Vakal No</Text>
              <TextInput
                style={styles.input}
                value={vakalNo}
                onChangeText={logAndSetVakalNo}
                placeholder=""
              />
            </View>
            <View style={styles.formColumn}>
              <Text style={styles.label}>Item Marks</Text>
              <TextInput
                style={styles.input}
                value={itemMarks}
                onChangeText={logAndSetItemMarks}
                placeholder=""
              />
            </View>
          </View>

          <View style={styles.formRow}>
            <View style={styles.formColumn}>
              <Text style={styles.label}>From Date</Text>
              <TouchableOpacity
                style={styles.input}
                activeOpacity={0.7}
                onPress={() => {
                  setTempFromDate(fromDate || new Date());
                  setShowFromDatePicker(true);
                }}
              >
                <Text
                  style={
                    isFromDateSelected
                      ? styles.dateText
                      : styles.placeholderText
                  }
                >
                  {isFromDateSelected
                    ? formatDisplayDate(fromDate)
                    : 'DD/MM/YYYY'}
                </Text>
              </TouchableOpacity>
            </View>

            <View style={styles.formColumn}>
              <Text style={styles.label}>To Date</Text>
              <TouchableOpacity
                style={styles.input}
                activeOpacity={0.7}
                onPress={() => {
                  setTempToDate(toDate || new Date());
                  setShowToDatePicker(true);
                }}
              >
                <Text
                  style={
                    isToDateSelected ? styles.dateText : styles.placeholderText
                  }
                >
                  {isToDateSelected ? formatDisplayDate(toDate) : 'DD/MM/YYYY'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {/*
            FIX 1: Item Sub Category field is now ONLY rendered when both
            From Date and To Date are selected. This eliminates the confusion
            of showing a disabled/non-functional field before dates are picked.
            A helper text guides the user when dates are not yet chosen.
          */}
          <View style={styles.formRow}>
            <View style={styles.formColumn}>
              <Text style={styles.label}>Item Sub Category</Text>
              {!datesSelected ? (
                // Show a non-interactive placeholder explaining the dependency
                <View style={[styles.input, styles.disabledFieldContainer]}>
                  <Text style={styles.disabledFieldText}>
                    Select From & To Date first
                  </Text>
                </View>
              ) : subCategoryLoading ? (
                <View style={[styles.input, styles.dropdownLoading]}>
                  <ActivityIndicator size="small" color="#E87830" />
                  <Text style={styles.dropdownLoadingText}>Loading...</Text>
                </View>
              ) : (
                <MultiSelect
                  options={itemSubCategoryOptions}
                  selectedValues={itemSubCategory}
                  onSelectChange={logAndSetItemSubCategory}
                  placeholder="--SELECT--"
                  primaryColor="#E87830"
                />
              )}
            </View>

            <View style={styles.formColumn}>
              <Text style={styles.label}>Unit</Text>
              <MultiSelect
                options={unitOptions}
                selectedValues={unit}
                onSelectChange={logAndSetUnit}
                placeholder="--SELECT--"
                primaryColor="#E87830"
              />
            </View>
          </View>

          {/* Zero Stock Toggle */}
          <View style={styles.checkboxRow}>
            <Text style={styles.checkboxLabel}>Zero Stock</Text>
            <Switch
              trackColor={{ false: '#767577', true: '#E87830' }}
              thumbColor={isZeroStock ? '#f4f3f4' : '#f4f3f4'}
              ios_backgroundColor="#3e3e3e"
              onValueChange={toggleZeroStock}
              value={isZeroStock}
            />
          </View>

          <View style={styles.buttonRow}>
            <TouchableOpacity
              style={[styles.button, styles.searchButton]}
              onPress={handleSearch}
            >
              <Text style={styles.buttonText}>Search</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.button, styles.clearButton]}
              onPress={handleClear}
            >
              <Text style={styles.buttonText}>Clear</Text>
            </TouchableOpacity>
          </View>

          {/* Loading indicator */}
          {isLoading && (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#E87830" />
            </View>
          )}

          {/* Scrolling indicator */}
          {isLoading && stockData.length === 0 && isScrollingToResults && (
            <View style={styles.scrollIndicatorContainer}>
              <Text style={styles.scrollIndicatorText}>Loading results...</Text>
              <Text style={styles.scrollIndicatorArrow}>↓</Text>
            </View>
          )}

          {/* Empty state message */}
          {!isLoading &&
            stockData.length === 0 &&
            !errorMessage &&
            hasSearched && (
              <View style={styles.noDataContainer}>
                <Text style={styles.noDataText}>
                  No stock data available. Try adjusting your search criteria.
                </Text>
              </View>
            )}

          {/* Table format results */}
          {!isLoading && stockData.length > 0 && (
            <View ref={resultsRef} style={styles.tableContainer}>
              <View style={styles.reportHeaderRight}>
                <TouchableOpacity
                  style={[
                    styles.pdfButton,
                    {
                      backgroundColor:
                        stockData.length === 0 ? '#CBD5E1' : '#F48221',
                    },
                    isPdfDownloading && styles.disabledButton,
                  ]}
                  onPress={handlePdfDownload}
                  disabled={isPdfDownloading || stockData.length === 0}
                >
                  {isPdfDownloading ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <>
                      <MaterialIcons
                        name="file-download"
                        size={20}
                        color="#FFFFFF"
                      />
                      <Text style={styles.pdfButtonText}>PDF</Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
              <ScrollView
                horizontal={true}
                showsHorizontalScrollIndicator={true}
                style={styles.tableScrollView}
              >
                <View>
                  {renderTableHeader()}
                  <FlatList
                    data={stockData}
                    renderItem={renderTableRow}
                    keyExtractor={(item, index) => `stock-${index}`}
                    scrollEnabled={false}
                    keyboardShouldPersistTaps="handled"
                  />
                </View>
              </ScrollView>
              {allStockData.length > pagination.itemsPerPage &&
                renderPagination()}
            </View>
          )}

          {/* Error message display */}
          {errorMessage && (
            <View style={styles.errorContainer}>
              <Text style={styles.errorText}>{errorMessage}</Text>
            </View>
          )}

          {/* PDF Loading Overlay */}
          {isPdfDownloading && (
            <View style={styles.pdfLoadingOverlay}>
              <View style={styles.pdfLoadingCard}>
                <Text style={styles.pdfLoadingText}>Generating PDF</Text>
                <View style={styles.progressBarContainer}>
                  <View
                    style={[
                      styles.progressBar,
                      {
                        width: `${pdfProgress}%`,
                        backgroundColor: '#F48221',
                      },
                    ]}
                  />
                </View>
                <Text style={styles.progressText}>{pdfStatusMessage}</Text>
              </View>
            </View>
          )}
        </ScrollView>
      </TouchableWithoutFeedback>

      {/*
        Date Pickers
        ─────────────────────────────────────────────────────────────────────
        Android: DateTimePicker with display="default" renders as a fully
        native system dialog. Wrapping it in a <Modal> causes a white blank
        strip to appear over the calendar (the app Modal background bleeds
        behind the native dialog). On Android we render the picker directly
        with NO wrapper — the OS handles the dialog chrome entirely.

        iOS: The picker uses display="spinner" which is an inline component,
        so we still wrap it in our own Modal with Cancel/Confirm buttons.
        ─────────────────────────────────────────────────────────────────────
      */}

      {/* FROM DATE — Android: bare picker, iOS: custom Modal */}
      {showFromDatePicker && Platform.OS === 'android' && (
        <DateTimePicker
          value={tempFromDate}
          mode="date"
          display="default"
          onChange={onFromDateChange}
        />
      )}
      {showFromDatePicker && Platform.OS === 'ios' && (
        <Modal transparent={true} animationType="slide">
          <View style={styles.datePickerContainer}>
            <View style={styles.datePickerModal}>
              <DateTimePicker
                value={tempFromDate}
                mode="date"
                display="spinner"
                onChange={onFromDateChange}
                textColor="#000000"
                style={styles.datePicker}
              />
              <View style={styles.datePickerButtons}>
                <TouchableOpacity
                  style={styles.cancelButton}
                  onPress={() => setShowFromDatePicker(false)}
                >
                  <Text style={styles.buttonText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.confirmButton}
                  onPress={confirmFromDate}
                >
                  <Text style={styles.buttonText}>Confirm</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      )}

      {/* TO DATE — Android: bare picker, iOS: custom Modal */}
      {showToDatePicker && Platform.OS === 'android' && (
        <DateTimePicker
          value={tempToDate}
          mode="date"
          display="default"
          onChange={onToDateChange}
        />
      )}
      {showToDatePicker && Platform.OS === 'ios' && (
        <Modal transparent={true} animationType="slide">
          <View style={styles.datePickerContainer}>
            <View style={styles.datePickerModal}>
              <DateTimePicker
                value={tempToDate}
                mode="date"
                display="spinner"
                onChange={onToDateChange}
                textColor="#000000"
                style={styles.datePicker}
              />
              <View style={styles.datePickerButtons}>
                <TouchableOpacity
                  style={styles.cancelButton}
                  onPress={() => setShowToDatePicker(false)}
                >
                  <Text style={styles.buttonText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.confirmButton}
                  onPress={confirmToDate}
                >
                  <Text style={styles.buttonText}>Confirm</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      )}
    </LayoutWrapper>
  );
};

const styles = StyleSheet.create({
  // Container styles
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  contentContainer: {
    paddingHorizontal: 16,
    paddingVertical: 20,
  },
  //title styles
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

  // Form styles
  formRow: {
    flexDirection: 'row',
    marginBottom: 14,
    justifyContent: 'space-between',
    paddingHorizontal: 5,
  },
  formColumn: {
    flex: 1,
    marginHorizontal: 4,
  },
  label: {
    fontSize: 14,
    marginBottom: 6,
    fontWeight: '500',
    color: '#333',
  },
  input: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: 44,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
  },

  // FIX 1: Disabled field style — visually distinct, not interactive
  disabledFieldContainer: {
    backgroundColor: '#F1F5F9',
    borderColor: '#CBD5E1',
    justifyContent: 'center',
  },
  disabledFieldText: {
    color: '#94A3B8',
    fontSize: 13,
    fontStyle: 'italic',
  },

  // Checkbox styles
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
    marginLeft: 5,
    backgroundColor: '#f9f9f9',
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  checkboxLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333',
    marginRight: 10,
    flex: 1,
  },

  // Pagination styles
  paginationContainer: {
    marginTop: 10,
    paddingHorizontal: 4,
    paddingVertical: 8,
    backgroundColor: '#f9fafb',
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  paginationControls: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  pageButton: {
    padding: 6,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 4,
    marginHorizontal: 4,
    backgroundColor: '#fff',
    width: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  disabledButton: {
    opacity: 0.5,
    backgroundColor: '#f3f4f6',
  },
  pageButtonText: {
    color: '#F48221',
    fontSize: 12,
    fontWeight: '500',
  },
  disabledButtonText: {
    color: '#9ca3af',
    fontSize: 12,
  },
  pageInfo: {
    fontSize: 12,
    color: '#4b5563',
    marginHorizontal: 8,
    fontWeight: '500',
  },

  dateText: {
    color: '#333',
    fontSize: 14,
  },
  placeholderText: {
    color: '#999',
    fontSize: 14,
  },

  // Dropdown styles
  dropdownContainer: {
    marginBottom: 15,
  },
  dropdownButton: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: 'white',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 10,
    height: 40,
  },
  dropdownSelectedText: {
    color: '#333',
    fontSize: 14,
  },
  dropdownPlaceholderText: {
    color: '#999',
    fontSize: 14,
  },
  dropdownIcon: {
    color: '#666',
    fontSize: 12,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: 'white',
    borderRadius: 8,
    padding: 15,
    width: '80%',
    maxHeight: '60%',
  },
  optionItem: {
    paddingVertical: 12,
    paddingHorizontal: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  selectedOption: {
    backgroundColor: '#f5f5f9',
  },
  optionText: {
    color: '#333',
    fontSize: 14,
  },
  selectedOptionText: {
    fontWeight: 'bold',
    color: '#E87830',
  },
  dropdownLoading: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dropdownLoadingText: {
    marginLeft: 10,
    color: '#666',
  },

  // Button styles
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 10,
    marginBottom: 20,
  },
  button: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 5,
  },
  searchButton: {
    backgroundColor: '#E87830',
  },
  clearButton: {
    backgroundColor: '#6c757d',
  },
  buttonText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 16,
  },

  // Date picker styles
  datePickerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  datePickerModal: {
    backgroundColor: 'white',
    borderRadius: 10,
    padding: 20,
    width: '90%',
  },
  datePicker: {
    width: '100%',
  },
  datePickerButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 20,
  },
  cancelButton: {
    backgroundColor: '#6c757d',
    padding: 10,
    borderRadius: 5,
    width: '45%',
    alignItems: 'center',
  },
  confirmButton: {
    backgroundColor: '#E87830',
    padding: 10,
    borderRadius: 5,
    width: '45%',
    alignItems: 'center',
  },

  // Loading and scroll indicators
  scrollIndicatorContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 15,
  },
  scrollIndicatorText: {
    color: '#E87830',
    marginRight: 10,
  },
  scrollIndicatorArrow: {
    color: '#E87830',
    fontSize: 20,
    fontWeight: 'bold',
  },

  // Table styles
  tableContainer: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 6,
    marginBottom: 20,
    backgroundColor: 'white',
    overflow: 'hidden',
    position: 'relative',
    paddingTop: 50,
  },
  tableScrollView: {
    width: '100%',
  },
  tableHeader: {
    flexDirection: 'row',
    paddingVertical: 14,
    paddingHorizontal: 0,
    borderBottomWidth: 1,
    borderBottomColor: '#CBD5E1',
  },
  tableHeaderCell: {
    fontSize: 14,
    fontWeight: 'bold',
    paddingHorizontal: 6,
    textAlign: 'center',
  },
  tableRow: {
    flexDirection: 'row',
    paddingVertical: 10,
    borderBottomWidth: 1,
    paddingHorizontal: 0,
    borderBottomColor: '#eee',
  },
  evenRow: {
    backgroundColor: 'white',
  },
  oddRow: {
    backgroundColor: '#f9f9f9',
  },
  tableCell: {
    paddingHorizontal: 4,
    fontSize: 12,
    textAlign: 'center',
  },

  // Column widths
  itemDescColumn: { width: 140 },
  itemMarksColumn: { width: 130 },
  lotColumn: { width: 60 },
  balanceColumn: { width: 70 },
  netQtyColumn: { width: 90 },
  unitColumn: { width: 70 },
  vakalNoColumn: { width: 100 },
  expiryDateColumn: { width: 110 },
  categoryColumn: { width: 100 },
  remarksColumn: { width: 120 },
  inwardDateColumn: { width: 100 },
  srNoColumn: { width: 55 },

  // PDF button styles
  reportHeaderRight: {
    alignItems: 'flex-end',
    marginBottom: 0,
    marginRight: 0,
    position: 'absolute',
    right: 10,
    top: 10,
    zIndex: 1,
  },
  pdfButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 7,
    paddingHorizontal: 15,
    borderRadius: 4,
  },
  pdfButtonText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 14,
    marginLeft: 4,
  },

  // Status indicators
  loadingContainer: {
    padding: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorContainer: {
    backgroundColor: '#f8d7da',
    padding: 15,
    borderRadius: 6,
    marginVertical: 20,
  },
  errorText: {
    color: '#721c24',
    textAlign: 'center',
  },
  noDataContainer: {
    padding: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  noDataText: {
    color: '#6c757d',
    fontSize: 16,
    textAlign: 'center',
  },

  // PDF Loading Overlay
  pdfLoadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    zIndex: 1000,
  },
  pdfLoadingCard: {
    backgroundColor: 'white',
    padding: 20,
    borderRadius: 10,
    alignItems: 'center',
    width: '80%',
    maxWidth: 300,
  },
  pdfLoadingText: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 20,
    color: '#333',
  },
  progressBarContainer: {
    width: '100%',
    height: 20,
    backgroundColor: '#f0f0f0',
    borderRadius: 10,
    overflow: 'hidden',
    marginBottom: 10,
  },
  progressBar: {
    height: '100%',
    backgroundColor: '#E87830',
  },
  progressText: {
    color: '#333',
    fontSize: 14,
    fontWeight: 'bold',
    textAlign: 'center',
  },
});

export default StockReportScreen;
