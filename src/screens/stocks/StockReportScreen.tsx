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

// Matches the StockCategorySubAvailability API response (allSubCategories[])
interface SubCategoryItem {
  id: string | number;
  name: string;
  categoryId?: string | number;
  categoryName?: string;
  available: boolean;
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

  // As On Date (replaces From Date / To Date)
  const [asOnDate, setAsOnDate] = useState<Date | null>(null);
  const [tempAsOnDate, setTempAsOnDate] = useState<Date>(new Date());
  const [showAsOnDatePicker, setShowAsOnDatePicker] = useState<boolean>(false);
  const [isAsOnDateSelected, setIsAsOnDateSelected] = useState<boolean>(false);

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

  // Convert an API date string (YYYY-MM-DD or ISO with time) to DD/MM/YYYY.
  const formatTableDate = (value: string | null | undefined): string => {
    if (!value) {
      return '-';
    }
    const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
    if (match) {
      return `${match[3]}/${match[2]}/${match[1]}`;
    }
    return value;
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

  // Called explicitly when As On Date is confirmed or Zero Stock is toggled.
  // NOT a useEffect — avoids accidental re-triggers from search/re-renders.
  //
  // Normal mode  -> StockCategorySubAvailability API (returns allSubCategories
  //                 with `available` true/false as on the selected date).
  // Zero stock   -> existing GET_ZERO_CATEGORIES endpoint, now sent asOnDate.
  const fetchSubCategories = async (asOn: string, zeroStock: boolean) => {
    const requestId = ++subCategoryFetchId.current; // mark this call as "latest"
    try {
      setSubCategoryLoading(true);
      setSubCategories([]);

      const id = await getSecureOrAsyncItem('customerID');
      const name = await getSecureOrAsyncItem('Disp_name');

      if (!id || !name) {
        console.error('[SubCategory API] customerID or Disp_name missing');
        return;
      }

      const endpoint = zeroStock
        ? API_ENDPOINTS.GET_ZERO_CATEGORIES
        : `${API_ENDPOINTS.GET_STOCK_CATEGORY_SUB_AVAILABILITY}?customerId=${id}`;

      const payload = {
        customerID: Number(id),
        customerName: name,
        lotNo: null,
        vakalNo: null,
        itemSubCategory: null,
        itemMarks: null,
        unit: null,
        asOnDate: asOn,
        qtyLessThan: null,
      };

      console.log('========== SUBCATEGORY API START ==========');
      console.log('As On Date:', asOn);
      console.log('Zero Stock:', zeroStock);
      console.log('API Endpoint:', endpoint);
      console.log('Request payload:', JSON.stringify(payload));
      console.log('Request Time:', new Date().toISOString());

      const startTime = Date.now();

      const response = await axios.post(endpoint, payload, {
        headers: await getAuthHeaders(),
        timeout: 50000,
      });

      console.log('Response Time:', Date.now() - startTime, 'ms');
      console.log('Response Data:', response.data);
      console.log('========== SUBCATEGORY API END ==========');

      if (requestId !== subCategoryFetchId.current) return; // a newer call superseded this one

      const list =
        response.data?.allSubCategories ??
        response.data?.data?.allSubCategories;

      if (Array.isArray(list)) {
        const mapped: SubCategoryItem[] = list.map((raw: any) => ({
          ...raw,
          id: raw.id ?? raw.SUBCATID ?? '',
          name: raw.name ?? raw.SUBCATDESC ?? raw.CATDESC ?? '',
          available: raw.available ?? true,
        }));
        console.log(
          '[SubCategory API] Mapped count:',
          mapped.length,
          'first:',
          mapped[0],
        );
        setSubCategories(mapped);
      } else {
        setSubCategories([]);
        console.error('[SubCategory API] Unexpected response:', response.data);
      }
    } catch (error: any) {
      console.log('========== SUBCATEGORY API ERROR ==========');

      if (error.code === 'ECONNABORTED') {
        console.log('API TIMEOUT');
      }

      console.log('Error Message:', error.message);
      console.log('Error Code:', error.code);
      console.log('Error Response:', error.response?.data);

      if (requestId === subCategoryFetchId.current) setSubCategories([]);
      console.error('[SubCategory API] Error:', error);
    } finally {
      if (requestId === subCategoryFetchId.current)
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

  const dateSelected = !!asOnDate;

  // Sub category options come from the availability API; unavailable ones are disabled
  const itemSubCategoryOptions = dateSelected
    ? subCategories
        .slice()
        .sort((a, b) => (a.name || '').localeCompare(b.name || ''))
        .map(item => ({
          label: item.name || '(unnamed)',
          value: item.name || '',
          disabled: item.available === false,
        }))
    : [];

  if (dateSelected) {
    console.log(
      '[SubCategoryOptions] built',
      itemSubCategoryOptions.length,
      'options from',
      subCategories.length,
      'raw rows',
    );
  }
  const unitOptions = [
    { label: 'D-39', value: 'D-39' },
    { label: 'D-514', value: 'D-514' },
  ];

  // Toggle Zero Stock without immediately clearing stockData/allStockData
  // to prevent the brief UI layout shift. Data is cleared only when a new search
  // is actually executed (inside handleSearch).
  const toggleZeroStock = () => {
    const newState = !isZeroStock;
    console.log('Zero Stock toggled:', newState);
    setIsZeroStock(newState);
    setItemSubCategory([]);
    // Re-fetch subcategories with the new toggle state if the date is ready
    if (asOnDate) {
      fetchSubCategories(formatApiDate(asOnDate)!, newState);
    }
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

  // Common request body for stock report / zero stock / PDF
  const buildReportPayload = () => ({
    customerID: customerId ? Number(customerId) : null,
    customerName: customerName || null,
    lotNo: lotNo ? Number(lotNo) : null,
    vakalNo: vakalNo || null,
    itemSubCategory: itemSubCategory.length > 0 ? itemSubCategory : null,
    itemMarks: itemMarks || null,
    unit: unit.length > 0 ? unit[0] : null,
    asOnDate: asOnDate ? formatApiDate(asOnDate) : null,
    qtyLessThan: qtyLessThan ? Number(qtyLessThan) : null,
  });

  // Updated handleSearch function
  const handleSearch = async () => {
    setHasSearched(true);
    setErrorMessage(null);

    // Mandatory field validation
    const missingFields: string[] = [];
    if (!asOnDate) missingFields.push('As On Date');
    if (unit.length === 0) missingFields.push('Unit');

    if (missingFields.length > 0) {
      const message = `Please select: ${missingFields.join(', ')}`;
      setErrorMessage(message);
      Alert.alert('Required Fields Missing', message);
      return;
    }
    // Clear data here (on explicit search action) instead of on toggle,
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
    const payload = buildReportPayload();

    const apiEndpoint = `${API_ENDPOINTS.GET_STOCK_REPORT}?customerId=${customerId}`;

    console.log(`Using API endpoint: ${apiEndpoint}`);
    console.log('Request payload:', JSON.stringify(payload, null, 2));

    const response = await axios.post(apiEndpoint, payload, {
      headers: await getAuthHeaders(),
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
    const payload = buildReportPayload();

    const apiEndpoint = `${API_ENDPOINTS.GET_ZERO_STOCK_REPORT}?customerId=${customerId}`;

    console.log(`Using Zero Stock API endpoint: ${apiEndpoint}`);
    console.log(
      'Zero Stock Request payload:',
      JSON.stringify(payload, null, 2),
    );

    const response = await axios.post(apiEndpoint, payload, {
      headers: await getAuthHeaders(),
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
    setSubCategories([]);
    setItemMarks('');
    setUnit([]);
    setAsOnDate(null);
    setIsAsOnDateSelected(false);
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
    if (!asOnDate || unit.length === 0) {
      Alert.alert(
        'Required Fields Missing',
        'As On Date and Unit are required.',
      );
      return;
    }

    try {
      setIsPdfDownloading(true);
      setPdfProgress(10);
      setPdfStatusMessage('Requesting report from server...');

      const pdfApiEndpoint = isZeroStock
        ? API_ENDPOINTS.GET_ZERO_STOCK_PDF_REPORT
        : API_ENDPOINTS.GET_STOCK_PDF_REPORT;

      const payload = buildReportPayload();

      const currentDate = new Date();
      const dateString = format(currentDate, 'yyyyMMdd_HHmmss');
      const reportType = isZeroStock ? 'ZeroStock' : 'Stock';
      const fileName = `${reportType}_Report_${dateString}.pdf`;
      const url = `${pdfApiEndpoint}?customerId=${customerId}`;
      const authHeaders = await getAuthHeaders();

      // App-private storage — no permission needed on any Android version.
      const dirPath =
        Platform.OS === 'ios'
          ? RNBlobUtil.fs.dirs.DocumentDir
          : RNBlobUtil.fs.dirs.CacheDir;
      const finalFilePath = `${dirPath}/${fileName}`;

      // Clean up any stale file at this exact path before writing.
      const staleExists = await RNBlobUtil.fs.exists(finalFilePath);
      if (staleExists) {
        await RNBlobUtil.fs.unlink(finalFilePath).catch(() => {});
      }

      setPdfProgress(20);
      setPdfStatusMessage('Downloading PDF...');

      // KEY FIX: specify `path` explicitly instead of `fileCache: true`.
      // Letting RNBlobUtil auto-generate a cache path is what triggers the
      // "Unexpected FileStorage response file: null" error on some devices.
      const task = RNBlobUtil.config({
        timeout: 60000,
        path: finalFilePath,
      }).fetch(
        'POST',
        url,
        {
          ...authHeaders,
          'Content-Type': 'application/json',
          Accept: 'application/pdf',
        },
        JSON.stringify(payload),
      );

      task.progress((received: number, total: number) => {
        if (total > 0) {
          const pct = 20 + Math.round((received / total) * 60); // 20–80%
          setPdfProgress(pct);
        } else {
          setPdfStatusMessage('Server is generating the report...');
        }
      });

      const res = await task;

      setPdfProgress(85);
      setPdfStatusMessage('Verifying file...');

      // Confirm the file actually exists at the path we told it to write to.
      const fileExists = await RNBlobUtil.fs.exists(finalFilePath);
      if (!fileExists) {
        throw new Error('File was not written to storage.');
      }

      const base64Head = await RNBlobUtil.fs.readFile(finalFilePath, 'base64');
      const headerBytes = Buffer.from(base64Head.slice(0, 12), 'base64');
      const isPdf =
        headerBytes.length >= 4 &&
        headerBytes[0] === 0x25 &&
        headerBytes[1] === 0x50 &&
        headerBytes[2] === 0x44 &&
        headerBytes[3] === 0x46;

      if (!isPdf) {
        await RNBlobUtil.fs.unlink(finalFilePath).catch(() => {});
        throw new Error('Server returned non-PDF data.');
      }

      setPdfProgress(100);
      setPdfStatusMessage('Download complete!');

      setTimeout(() => {
        setIsPdfDownloading(false);
        Alert.alert('PDF Ready', 'The report has been generated successfully', [
          {
            text: 'View PDF',
            onPress: () => {
              try {
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
                  'Could not open the PDF file. The file was saved, but there was an error opening it.',
                );
              }
            },
          },
          { text: 'OK', style: 'cancel' },
        ]);
      }, 500);
    } catch (error) {
      console.error('Error downloading PDF:', error);
      let errorMessage = 'Failed to download the PDF report.';
      if (error instanceof Error) {
        if (error.message.includes('timeout')) {
          errorMessage =
            'The request timed out. The report may be too large, or the server is slow — please try again.';
        } else {
          errorMessage += ` Error: ${error.message}`;
        }
      }
      Alert.alert('Download Error', errorMessage);
      setIsPdfDownloading(false);
    }
  };

  // Apply a newly chosen As On Date: store it, reset sub category selection
  // (availability depends on the date) and refetch the sub category list.
  const applyAsOnDate = (date: Date) => {
    setAsOnDate(date);
    setIsAsOnDateSelected(true);
    setItemSubCategory([]);
    fetchSubCategories(formatApiDate(date)!, isZeroStock);
  };

  // Handle date change for As On Date
  const onAsOnDateChange = (
    event: DateTimePickerEvent,
    selectedDate?: Date,
  ) => {
    if (Platform.OS === 'android') {
      setShowAsOnDatePicker(false);
    }

    if (selectedDate) {
      console.log(`As On date changing to ${selectedDate.toISOString()}`);
      setTempAsOnDate(selectedDate);

      if (Platform.OS === 'android') {
        // Android fires onChange with type 'dismissed' and no date on cancel,
        // so reaching here means the user actually picked a date.
        applyAsOnDate(selectedDate);
        console.log('As On date updated (Android)');
      }
    }
  };

  // Confirm date selection for iOS
  const confirmAsOnDate = () => {
    console.log(
      `Confirming As On date change to ${tempAsOnDate.toISOString()}`,
    );
    setShowAsOnDatePicker(false);
    applyAsOnDate(tempAsOnDate);
    console.log('As On date updated (iOS)');
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
        {formatTableDate(item.INWARD_DT)}
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

          {/* As On Date (single date, replaces From Date / To Date) */}
          <View style={styles.formRow}>
            <View style={styles.formColumn}>
              <Text style={styles.label}>
                As On Date <Text style={styles.requiredAsterisk}>*</Text>
              </Text>
              <TouchableOpacity
                style={styles.input}
                activeOpacity={0.7}
                onPress={() => {
                  setTempAsOnDate(asOnDate || new Date());
                  setShowAsOnDatePicker(true);
                }}
              >
                <Text
                  style={
                    isAsOnDateSelected
                      ? styles.dateText
                      : styles.placeholderText
                  }
                >
                  {isAsOnDateSelected
                    ? formatDisplayDate(asOnDate)
                    : 'DD/MM/YYYY'}
                </Text>
              </TouchableOpacity>
            </View>

            {/* Spacer keeps As On Date at half width like the other fields */}
            <View style={styles.formColumn} />
          </View>

          {/*
            Item Sub Category is fetched from StockCategorySubAvailability
            for the chosen As On Date. Subcategories with available=false
            are shown but disabled in the dropdown.
          */}
          <View style={styles.formRow}>
            <View style={styles.formColumn}>
              <Text style={styles.label}>Item Sub Category</Text>
              {!dateSelected ? (
                <View style={[styles.input, styles.disabledFieldContainer]}>
                  <Text style={styles.disabledFieldText}>
                    Select As On Date first
                  </Text>
                </View>
              ) : (
                <MultiSelect
                  options={itemSubCategoryOptions}
                  selectedValues={itemSubCategory}
                  onSelectChange={logAndSetItemSubCategory}
                  placeholder={subCategoryLoading ? 'Loading...' : '--SELECT--'}
                  primaryColor="#E87830"
                />
              )}
            </View>

            <View style={styles.formColumn}>
              <Text style={styles.label}>
                Unit <Text style={styles.requiredAsterisk}>*</Text>
              </Text>
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
        </ScrollView>
      </TouchableWithoutFeedback>

      {/* PDF Loading Overlay — true full-screen modal, not tied to scroll position */}
      <Modal
        visible={isPdfDownloading}
        transparent={true}
        animationType="fade"
        statusBarTranslucent={true}
      >
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
      </Modal>

      {/* AS ON DATE — Android: bare picker, iOS: custom Modal */}
      {showAsOnDatePicker && Platform.OS === 'android' && (
        <DateTimePicker
          value={tempAsOnDate}
          mode="date"
          display="default"
          onChange={onAsOnDateChange}
        />
      )}
      {showAsOnDatePicker && Platform.OS === 'ios' && (
        <Modal transparent={true} animationType="slide">
          <View style={styles.datePickerContainer}>
            <View style={styles.datePickerModal}>
              <DateTimePicker
                value={tempAsOnDate}
                mode="date"
                display="spinner"
                onChange={onAsOnDateChange}
                textColor="#000000"
                style={styles.datePicker}
              />
              <View style={styles.datePickerButtons}>
                <TouchableOpacity
                  style={styles.cancelButton}
                  onPress={() => setShowAsOnDatePicker(false)}
                >
                  <Text style={styles.buttonText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.confirmButton}
                  onPress={confirmAsOnDate}
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
  requiredAsterisk: {
    color: '#DC2626',
    fontWeight: 'bold',
  },

  // Disabled field style — visually distinct, not interactive
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
