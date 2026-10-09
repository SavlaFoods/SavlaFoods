// OrderConfirmation.tsx
import React, { useState, useEffect } from 'react';
import {
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  Alert,
  Platform,
  ActivityIndicator,
  Modal,
  Dimensions,
  KeyboardAvoidingView,
  Keyboard,
  TouchableWithoutFeedback,
  InteractionManager,
} from 'react-native';
import { RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { MainStackParamList } from '../../src/type/type';
import Ionicons from 'react-native-vector-icons/Ionicons';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import axios from 'axios';
import { API_ENDPOINTS } from '../config/api.config';

import DateTimePicker from '@react-native-community/datetimepicker';
import PendingOrdersScreen from './PendingOrdersScreen';

const { width, height } = Dimensions.get('window');

interface OrderItem {
  ITEM_ID: number;
  ITEM_NAME: string;
  LOT_NO: string;
  VAKAL_NO: string;
  ITEM_MARKS: string;
  UNIT_NAME: string;
  AVAILABLE_QTY: number;
  QUANTITY: number;
  NET_QUANTITY: number;
  ORDERED_QUANTITY: number;
  BatchNo?: string | null;
  UNIT_ID?: number;
}

/* ---------------------------------------------------------------------------
 * LABOUR CHARGES — TYPES (aligned with /labourCharges/{orderId}/labour-charges)
 * -------------------------------------------------------------------------*/

interface LaborItemSelection {
  itemId: number;
  itemName: string;
  lotNo: string;
  maxQuantity: number;
  applied: boolean;
  appliedQuantity: string;
}

interface LaborCharge {
  id: number;
  workTypeId: number;
  code: string;
  type: string;
  isForced: boolean;
  allowsPartial: boolean;
  selected: boolean;
  applyToAll: boolean;
  isItemPickerOpen: boolean;
  quantity: number;
  appliedQuantity: string;
  rate: number; // NEW - display-only, comes from API
  itemSelections: LaborItemSelection[];
}

interface ApiLabourType {
  workTypeId: number;
  code: string;
  type: string;
  rate: number;
  appliedQuantity: number;
  amount: number;
  isTaxable: string;
  fkSacId: number;
  fkGstTaxId: number;
}
interface ApiLabourItem {
  ItemID: number;
  LotNo: number | string;
  requestedQuantity: number;
  labourTypes: ApiLabourType[];
}
interface OrderResponse {
  success: boolean;
  message: string;
  data: {
    orderDate: string;
    deliveryDate: string;
    ordersByUnit: {
      orderId: number;
      orderNo: string;
      unitId: number | string;
      unitName?: string;
      itemCount: number;
      items: {
        ItemID: number;
        LotNo: number | string;
        'Requested Quantity': number;
        BatchNo: string;
        ItemMarks: string;
        VakalNo: string;
        BOX_QUANTITY: number;
        BALANCE_QTY: number;
        AVAILABLE_QTY: number;
        QUANTITY: number;
        PREVIOUS_AVAILABLE_QTY: number;
        PREVIOUS_BALANCE_QTY: number;
        STOCK_REDUCED_BY: number;
        LOCATION_INFO?: {
          LOCATION_ID: number | null;
          LOCATION_NAME: string | null;
          PREVIOUS_LOCATION_AVAILABLE_QTY: number | null;
          UPDATED_LOCATION_AVAILABLE_QTY: number | null;
          LOCATION_STOCK_REDUCED_BY: number;
        };
      }[];
      // returned proof that labour charges were actually inserted in DB
      labourCharges: {
        id: number;
        ItemID: number;
        LotNo: number | string;
        workTypeId: number;
        appliedQuantity: number;
        rate: number;
        amount: number;
      }[];
    }[];
  };
}

interface TransporterDetails {
  name: string;
  vehicleNo: string;
  shopNo: string;
}

type OrderConfirmationScreenRouteProp = RouteProp<
  MainStackParamList,
  'OrderConfirmationScreen'
>;
type OrderConfirmationScreenNavigationProp = NativeStackNavigationProp<
  MainStackParamList,
  'OrderConfirmationScreen'
>;

interface OrderConfirmationScreenProps {
  route: OrderConfirmationScreenRouteProp;
  navigation: OrderConfirmationScreenNavigationProp;
}

/* ---------------------------------------------------------------------------
 * LABOUR CHARGES — static catalogue taken from the real API response
 * (rates are display-only; the backend always decides the final rate)
 * -------------------------------------------------------------------------*/

const LABOR_CHARGE_DEFINITIONS = [
  {
    workTypeId: 1,
    code: 'L',
    type: 'LOADING',
    isForced: true,
    allowsPartial: false,
  },
  {
    workTypeId: 4,
    code: 'T',
    type: 'THAPPI',
    isForced: false,
    allowsPartial: false,
  },
  {
    workTypeId: 5,
    code: 'W',
    type: 'WEIGHT',
    isForced: false,
    allowsPartial: true,
  },
  {
    workTypeId: 7,
    code: 'D',
    type: 'DUMPING',
    isForced: false,
    allowsPartial: true,
  },
];

// Only these 4 are shown in the UI, matching the existing design
const ALLOWED_WORKTYPE_IDS = [1, 4, 5, 7]; // Loading, Thappi, Weight, Dumping

const buildLaborChargesFromApi = (
  apiData: ApiLabourItem[],
  items: OrderItem[],
): LaborCharge[] => {
  const chargeMap = new Map<number, LaborCharge>();

  ALLOWED_WORKTYPE_IDS.forEach(id => {
    const def = LABOR_CHARGE_DEFINITIONS.find(d => d.workTypeId === id);
    if (!def) return;
    chargeMap.set(id, {
      id: def.workTypeId,
      workTypeId: def.workTypeId,
      code: def.code,
      type: `${def.type}(${def.code})`,
      isForced: def.isForced,
      allowsPartial: def.allowsPartial,
      selected: def.isForced,
      applyToAll: true,
      isItemPickerOpen: false,
      quantity: 0,
      appliedQuantity: '',
      rate: 0,
      itemSelections: [],
    });
  });

  apiData.forEach(apiItem => {
    const orderItem = items.find(
      it =>
        it.ITEM_ID === apiItem.ItemID &&
        String(it.LOT_NO) === String(apiItem.LotNo),
    );
    const itemName = orderItem?.ITEM_NAME || `Item ${apiItem.ItemID}`;
    const maxQty =
      apiItem.requestedQuantity || orderItem?.ORDERED_QUANTITY || 0;

    apiItem.labourTypes
      .filter(lt => ALLOWED_WORKTYPE_IDS.includes(lt.workTypeId))
      .forEach(lt => {
        const charge = chargeMap.get(lt.workTypeId);
        if (!charge) return;
        charge.quantity += maxQty;
        charge.rate = lt.rate; // rate per unit for this work type
        charge.itemSelections.push({
          itemId: apiItem.ItemID,
          itemName,
          lotNo: String(apiItem.LotNo ?? ''),
          maxQuantity: maxQty,
          applied: false,
          appliedQuantity: '',
        });
      });
  });

  const result = Array.from(chargeMap.values());
  result.forEach(charge => {
    charge.appliedQuantity = charge.quantity ? String(charge.quantity) : '';
  });
  console.log(
    '[LabourCharges][PARSE] Built charges from API:',
    JSON.stringify(result, null, 2),
  );
  return result; // no fallback — purely API-driven now
};

const OrderConfirmationScreen: React.FC<OrderConfirmationScreenProps> = ({
  route,
  navigation,
}) => {
  const {
    orderItems,
    customerID,
    userSupervisorId,
    CUST_DELIVERY_ADD,
    userMukadamId,
    stockLotLocationId,
    unitId = 3,
    finYearId = 15,
  } = route.params;

  const today = new Date();
  const formattedToday = `${today.getFullYear()}-${String(
    today.getMonth() + 1,
  ).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

  const [orderBy, setOrderBy] = useState('');
  const orderByInputRef = React.useRef<TextInput>(null);
  const datePickerTimerRef = React.useRef<NodeJS.Timeout | null>(null);
  const scrollViewRef = React.useRef<ScrollView>(null);

  const [orderDetails, setOrderDetails] = useState({
    orderDate: formattedToday,
    deliveryDate: formattedToday,
    CUST_DELIVERY_ADD: CUST_DELIVERY_ADD || '',
    remarks: '',
    laborCharges: '',
  });

  const [transporterDetails, setTransporterDetails] =
    useState<TransporterDetails>({
      name: '',
      vehicleNo: '',
      shopNo: '',
    });

  const [isLoading, setIsLoading] = useState(false);
  const [orderByError, setOrderByError] = useState('');
  const [transporterNameError, setTransporterNameError] = useState('');
  const [deliveryLocationError, setDeliveryLocationError] = useState('');
  const [deliveryDateError, setDeliveryDateError] = useState('');

  const [isLaborSectionOpen, setIsLaborSectionOpen] = useState(false);

  const [laborCharges, setLaborCharges] = useState<LaborCharge[]>([]);

  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [showValidationModal, setShowValidationModal] = useState(false);
  const [validationMessage, setValidationMessage] = useState('');
  const [successData, setSuccessData] = useState({
    ordersByUnit: [] as any[],
    formattedTransporterName: '',
    selectedLabor: [] as any[],
  });

  const [showDatePicker, setShowDatePicker] = useState(false);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [isOrderPlaced, setIsOrderPlaced] = useState(false);
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const [showResubmissionModal, setShowResubmissionModal] = useState(false);

  const [laborRatesLoading, setLaborRatesLoading] = useState(false);
  const [laborRatesError, setLaborRatesError] = useState('');

  const fetchLabourCharges = React.useCallback(async () => {
    setLaborRatesLoading(true);
    setLaborRatesError('');
    try {
      const payload = {
        items: orderItems.map((item: OrderItem) => ({
          ItemID: item.ITEM_ID,
          LotNo: item.LOT_NO,
          requestedQuantity: item.ORDERED_QUANTITY,
        })),
      };

      console.log(
        '[LabourCharges][FETCH] URL →',
        API_ENDPOINTS.GET_LABOUR_CHARGES,
      );
      console.log(
        '[LabourCharges][FETCH] Payload →',
        JSON.stringify(payload, null, 2),
      );

      const { data } = await axios.post(
        API_ENDPOINTS.GET_LABOUR_CHARGES,
        payload,
        { headers: { 'Content-Type': 'application/json' }, timeout: 15000 },
      );

      console.log(
        '[LabourCharges][FETCH] Raw response →',
        JSON.stringify(data, null, 2),
      );

      if (data?.success && Array.isArray(data.data)) {
        const built = buildLaborChargesFromApi(data.data, orderItems);
        console.log(
          '[LabourCharges][FETCH] Charges set in state →',
          built.length,
          'work types',
        );
        setLaborCharges(built);
      } else {
        console.warn(
          '[LabourCharges][FETCH] API returned success=false or bad shape',
        );
        setLaborRatesError('No labour rates found for these items.');
        setLaborCharges([]);
      }
    } catch (err: any) {
      console.error(
        '[LabourCharges][FETCH] Error →',
        err?.message,
        err?.response?.data,
      );
      setLaborRatesError('Could not load labour rates from server.');
      setLaborCharges([]);
    } finally {
      setLaborRatesLoading(false);
    }
  }, [orderItems]);
  useEffect(() => {
    fetchLabourCharges();
  }, [fetchLabourCharges]);

  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      if (isOrderPlaced) {
        setOrderDetails({
          orderDate: formattedToday,
          deliveryDate: formattedToday,
          CUST_DELIVERY_ADD: '',
          remarks: '',
          laborCharges: '',
        });
        setTransporterDetails({ name: '', vehicleNo: '', shopNo: '' });
        setOrderBy('');
        fetchLabourCharges(); // replaces buildInitialLaborCharges(orderItems)
        setIsOrderPlaced(false);
        setSuccessData({
          ordersByUnit: [],
          formattedTransporterName: '',
          selectedLabor: [],
        });
        setOrderByError('');
        setTransporterNameError('');
        setDeliveryLocationError('');
        setDeliveryDateError('');
      }
    });
    return unsubscribe;
  }, [navigation, isOrderPlaced, formattedToday, fetchLabourCharges]);

  useEffect(() => {
    const keyboardDidShowListener = Keyboard.addListener(
      'keyboardDidShow',
      () => setKeyboardVisible(true),
    );
    const keyboardDidHideListener = Keyboard.addListener(
      'keyboardDidHide',
      () => setKeyboardVisible(false),
    );
    return () => {
      keyboardDidShowListener.remove();
      keyboardDidHideListener.remove();
    };
  }, []);

  /* -------------------------------------------------------------------------
   * LABOUR CHARGES — HANDLERS
   * -----------------------------------------------------------------------*/

  const toggleLaborChargeSelection = (id: number) => {
    setLaborCharges(prev =>
      prev.map(charge => {
        if (charge.id !== id) return charge;
        if (charge.isForced) return charge;
        return { ...charge, selected: !charge.selected };
      }),
    );
  };

  const updateAppliedQuantity = (id: number, value: string) => {
    const numericOnly = value.replace(/[^0-9]/g, '');
    setLaborCharges(prev =>
      prev.map(charge => {
        if (charge.id !== id) return charge;
        const clamped =
          numericOnly === ''
            ? ''
            : String(Math.min(parseInt(numericOnly, 10), charge.quantity));
        return { ...charge, appliedQuantity: clamped };
      }),
    );
  };

  const setApplyToAll = (id: number, applyToAll: boolean) => {
    setLaborCharges(prev =>
      prev.map(charge =>
        charge.id === id
          ? {
              ...charge,
              applyToAll,
              isItemPickerOpen: applyToAll ? false : charge.isItemPickerOpen,
            }
          : charge,
      ),
    );
  };

  const toggleItemPicker = (id: number) => {
    setLaborCharges(prev =>
      prev.map(charge =>
        charge.id === id
          ? { ...charge, isItemPickerOpen: !charge.isItemPickerOpen }
          : charge,
      ),
    );
  };

  const toggleItemForCharge = (
    chargeId: number,
    itemId: number,
    lotNo: string,
  ) => {
    setLaborCharges(prev =>
      prev.map(charge => {
        if (charge.id !== chargeId) return charge;
        return {
          ...charge,
          itemSelections: charge.itemSelections.map(sel =>
            sel.itemId === itemId && sel.lotNo === lotNo
              ? {
                  ...sel,
                  applied: !sel.applied,
                  appliedQuantity: !sel.applied ? String(sel.maxQuantity) : '',
                }
              : sel,
          ),
        };
      }),
    );
  };

  const updateItemAppliedQuantity = (
    chargeId: number,
    itemId: number,
    lotNo: string,
    value: string,
  ) => {
    const numericOnly = value.replace(/[^0-9]/g, '');
    setLaborCharges(prev =>
      prev.map(charge => {
        if (charge.id !== chargeId) return charge;
        return {
          ...charge,
          itemSelections: charge.itemSelections.map(sel => {
            if (sel.itemId !== itemId || sel.lotNo !== lotNo) return sel;
            const clamped =
              numericOnly === ''
                ? ''
                : String(Math.min(parseInt(numericOnly, 10), sel.maxQuantity));
            return { ...sel, appliedQuantity: clamped };
          }),
        };
      }),
    );
  };

  const areAllOptionalChargesSelected = laborCharges
    .filter(c => !c.isForced)
    .every(c => c.selected);

  const toggleSelectAllLaborCharges = () => {
    const shouldSelectAll = !areAllOptionalChargesSelected;
    setLaborCharges(prev =>
      prev.map(charge =>
        charge.isForced ? charge : { ...charge, selected: shouldSelectAll },
      ),
    );
  };

  const selectedLaborCount = laborCharges.filter(c => c.selected).length;

  const getSelectedLaborChargesSummary = () => {
    const selected = laborCharges.filter(charge => charge.selected);
    if (selected.length === 0) return '';
    return selected
      .map(charge => {
        if (!charge.allowsPartial || charge.applyToAll) {
          return `${charge.type}: ${
            charge.appliedQuantity || 0
          } (Entire Order)`;
        }
        const applied = charge.itemSelections.filter(sel => sel.applied);
        if (applied.length === 0) {
          return `${charge.type}: (no items selected)`;
        }
        return `${charge.type}: ${applied
          .map(sel => `${sel.itemName} - ${sel.appliedQuantity}`)
          .join(', ')}`;
      })
      .join(' | ');
  };

  /* -------------------------------------------------------------------------
   * Build the exact POST body expected by /labourCharges/{orderId}/labour-charges
   * -------------------------------------------------------------------------*/

  const buildLabourChargesForOrderPayload = () => {
    const payloadCharges: {
      ItemID: number;
      LotNo: string;
      workTypeId: number;
      appliedQuantity: number;
    }[] = [];

    laborCharges
      .filter(charge => charge.selected)
      .forEach(charge => {
        if (!charge.allowsPartial || charge.applyToAll) {
          charge.itemSelections.forEach(sel => {
            if (sel.maxQuantity > 0) {
              payloadCharges.push({
                ItemID: Number(sel.itemId),
                LotNo: String(sel.lotNo).trim(),
                workTypeId: Number(charge.workTypeId),
                appliedQuantity: sel.maxQuantity,
              });
            }
          });
        } else {
          charge.itemSelections
            .filter(sel => sel.applied && parseInt(sel.appliedQuantity, 10) > 0)
            .forEach(sel => {
              payloadCharges.push({
                ItemID: Number(sel.itemId),
                LotNo: String(sel.lotNo).trim(),
                workTypeId: Number(charge.workTypeId),
                appliedQuantity: parseInt(sel.appliedQuantity, 10),
              });
            });
        }
      });

    return payloadCharges;
  };
  /* -------------------------------------------------------------------------
   * EXISTING HELPERS
   * -----------------------------------------------------------------------*/

  const getFormattedTransporterName = () => {
    let formattedName = transporterDetails.name.trim();
    if (transporterDetails.vehicleNo) {
      formattedName += ` | Vehicle: ${transporterDetails.vehicleNo.trim()}`;
    }
    if (transporterDetails.shopNo) {
      formattedName += ` | Shop: ${transporterDetails.shopNo.trim()}`;
    }
    return formattedName;
  };

  const handleDateFieldTap = () => {
    Keyboard.dismiss();
    setTimeout(() => setShowDatePicker(true), 10);
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return '';
    try {
      const datePart = dateString.split('T')[0].split(' ')[0];
      const parts = datePart.split('-');
      if (parts.length !== 3) return dateString;
      const monthNames = [
        'January',
        'February',
        'March',
        'April',
        'May',
        'June',
        'July',
        'August',
        'September',
        'October',
        'November',
        'December',
      ];
      const monthIndex = parseInt(parts[1], 10) - 1;
      const day = parseInt(parts[2], 10);
      if (monthIndex < 0 || monthIndex > 11 || isNaN(day)) return dateString;
      return `${monthNames[monthIndex]} ${day}, ${parts[0]}`;
    } catch {
      return dateString;
    }
  };

  const isValidDateFormat = (dateString: string) =>
    /^\d{4}-\d{2}-\d{2}$/.test(dateString);

  const isValidDate = (dateString: string) => {
    if (!isValidDateFormat(dateString)) return false;
    const parts = dateString.split('-');
    const year = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10);
    const day = parseInt(parts[2], 10);
    if (month < 1 || month > 12 || day < 1 || day > 31) return false;
    return true;
  };

  const isDeliveryDateValid = (dateString: string) => {
    if (!isValidDate(dateString)) return false;
    const parts = dateString.split('-');
    const year = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10) - 1;
    const day = parseInt(parts[2], 10);
    const deliveryDate = new Date(year, month, day);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return deliveryDate >= today;
  };

  const handleTransporterNameChange = (text: string) => {
    setTransporterDetails(prev => ({ ...prev, name: text }));
    setTransporterNameError('');
    if (!/^[a-zA-Z0-9\s.',-]*$/.test(text)) {
      setTransporterNameError(
        'Only letters, numbers, spaces, and common punctuation allowed',
      );
    }
  };

  const handleOrderByChange = (text: string) => {
    setOrderBy(text);
    setOrderByError('');
  };

  const handleDeliveryLocationChange = (text: string) => {
    setOrderDetails(prev => ({ ...prev, CUST_DELIVERY_ADD: text }));
    setDeliveryLocationError('');
  };

  const onDateChange = (event: any, selectedDate?: Date) => {
    if (Platform.OS === 'android') {
      setShowDatePicker(false);
      if (event?.type === 'dismissed' || !selectedDate) return;
    }
    if (!selectedDate) return;
    setSelectedDate(selectedDate);
    const formatted = `${selectedDate.getFullYear()}-${String(
      selectedDate.getMonth() + 1,
    ).padStart(2, '0')}-${String(selectedDate.getDate()).padStart(2, '0')}`;
    setOrderDetails(prev => ({ ...prev, deliveryDate: formatted }));
    setDeliveryDateError('');
  };

  const handleSubmitOrder = async () => {
    if (isOrderPlaced) {
      setShowResubmissionModal(true);
      return;
    }

    setOrderByError('');
    setTransporterNameError('');
    setDeliveryLocationError('');
    setDeliveryDateError('');

    let hasError = false;

    if (!orderBy.trim()) {
      setOrderByError('Order Creator name is required');
      hasError = true;
    }

    if (!transporterDetails.name.trim()) {
      setTransporterNameError('Transporter Name is required');
      hasError = true;
    } else if (!/^[a-zA-Z0-9\s.',-]*$/.test(transporterDetails.name)) {
      setTransporterNameError(
        'Only letters, numbers, spaces, and common punctuation allowed',
      );
      hasError = true;
    }

    if (!orderDetails.CUST_DELIVERY_ADD.trim()) {
      setDeliveryLocationError('Delivery Location is required');
      hasError = true;
    }

    if (!isValidDateFormat(orderDetails.deliveryDate)) {
      setDeliveryDateError('Delivery date must be in YYYY-MM-DD format');
      hasError = true;
    } else if (!isValidDate(orderDetails.deliveryDate)) {
      setDeliveryDateError('Invalid delivery date');
      hasError = true;
    } else if (!isDeliveryDateValid(orderDetails.deliveryDate)) {
      setDeliveryDateError('Delivery date cannot be in the past');
      hasError = true;
    }

    const incompletePartialCharge = laborCharges.find(
      charge =>
        charge.selected &&
        charge.allowsPartial &&
        !charge.applyToAll &&
        !charge.itemSelections.some(
          sel =>
            sel.applied &&
            sel.appliedQuantity &&
            parseInt(sel.appliedQuantity, 10) > 0,
        ),
    );
    if (incompletePartialCharge) {
      hasError = true;
    }

    if (hasError) {
      if (incompletePartialCharge) {
        Alert.alert(
          'Missing Information',
          `Please select at least one item and quantity for ${incompletePartialCharge.type}, or switch it to "Apply to All".`,
        );
      }
      scrollViewRef.current?.scrollTo({ y: 0, animated: true });
      setTimeout(() => orderByInputRef.current?.focus(), 400);
      return;
    }
    setIsLoading(true);
    try {
      const formattedTransporterName = getFormattedTransporterName();

      const labourPayload = buildLabourChargesForOrderPayload();
      console.log(
        '[OrderSubmit] labourCharges being sent →',
        JSON.stringify(labourPayload, null, 2),
      );
      const labourChargesPayload = buildLabourChargesForOrderPayload();
      console.log(
        '[OrderSubmit] labourCharges being sent →',
        JSON.stringify(labourChargesPayload, null, 2),
      );

      const orderPayload = {
        CustomerID: customerID,
        items: orderItems.map((item: OrderItem) => ({
          ItemID: Number(item.ITEM_ID),
          LotNo: String(item.LOT_NO).trim(), // <-- normalize here too, same format as labourCharges
          requestedQuantity: item.ORDERED_QUANTITY,
          BatchNo: item.BatchNo === '**null**' ? null : item.BatchNo,
          ItemMarks: item.ITEM_MARKS || '',
          VakalNo: item.VAKAL_NO || '',
          UnitName: item.UNIT_NAME,
        })),
        orderDate: orderDetails.orderDate,
        deliveryDate: orderDetails.deliveryDate,
        transporterName: formattedTransporterName,
        ORDER_BY: orderBy,
        CUST_DELIVERY_ADD: orderDetails.CUST_DELIVERY_ADD,
        remarks: orderDetails.remarks,
        userSupervisorId,
        userMukadamId,
        stockLotLocationId,
        unitId,
        finYearId,
        orderMode: 'APP',
        labourCharges: labourChargesPayload,
      };

      console.log(
        '[OrderSubmit] Full order payload →',
        JSON.stringify(orderPayload, null, 2),
      );

      console.log('Order payload →', JSON.stringify(orderPayload, null, 2));
      console.log(
        '[OrderSubmit] Full order payload →',
        JSON.stringify(orderPayload, null, 2),
      );

      const response = await axios.post<OrderResponse>(
        API_ENDPOINTS.GET_PLACEORDER_DETAILS,
        orderPayload,
        {
          headers: { 'Content-Type': 'application/json' },
          timeout: 15000,
        },
      );

      console.log(
        '[OrderSubmit] Server response →',
        JSON.stringify(response.data, null, 2),
      );

      if (!response || !response.data) {
        throw new Error('No response received from server');
      }

      if (response.data.success !== true) {
        throw new Error(
          response.data.message || 'Server returned unsuccessful response',
        );
      }

      const { ordersByUnit } = response.data.data;
      if (!ordersByUnit || !ordersByUnit.length) {
        throw new Error('Missing order details in success response');
      }

      // Proof-of-save: log what the DB actually inserted, not just what we sent
      ordersByUnit.forEach(unitOrder => {
        console.log(
          `[OrderSubmit] Order ${unitOrder.orderNo} — labour charges saved in DB →`,
          JSON.stringify(unitOrder.labourCharges, null, 2),
        );
        if (
          unitOrder.labourCharges.length === 0 &&
          buildLabourChargesForOrderPayload().length > 0
        ) {
          console.warn(
            `[OrderSubmit] WARNING: sent labour charges but order ${unitOrder.orderNo} returned none — check item/lot match on backend.`,
          );
        }
      });

      // Prepare success UI data
      const processedOrdersByUnit = ordersByUnit.map(unitOrder => {
        const unitItemIds = new Set(unitOrder.items.map(item => item.ItemID));
        const processedItems = orderItems
          .filter(item => unitItemIds.has(item.ITEM_ID))
          .map(item => ({
            ...item,
            FK_ORDER_ID: unitOrder.orderId,
            FK_ITEM_ID: item.ITEM_ID,
            STATUS: 'NEW',
            REMARK: orderDetails.remarks,
          }));
        return { ...unitOrder, processedItems };
      });

      setSuccessData({
        ordersByUnit: processedOrdersByUnit,
        formattedTransporterName,
        selectedLabor: laborCharges.filter(c => c.selected),
      });
      setIsOrderPlaced(true);
      setShowSuccessModal(true);
    } catch (error: any) {
      console.error(
        'Error submitting order:',
        error.message,
        error?.response?.data,
      );
      console.error(
        '[OrderSubmit] Error →',
        error?.message,
        JSON.stringify(error?.response?.data),
      );
      Alert.alert(
        'Error',
        error?.response?.data?.message ||
          error.message ||
          'Failed to place order',
      );
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    return () => {
      if (datePickerTimerRef.current) {
        clearTimeout(datePickerTimerRef.current);
        datePickerTimerRef.current = null;
      }
    };
  }, []);

  return (
    <View style={styles.safeArea}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.mainContainer}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 64 : 0}
      >
        <ScrollView
          ref={scrollViewRef}
          style={styles.scrollContainer}
          keyboardShouldPersistTaps="always"
          keyboardDismissMode="none"
        >
          <View style={styles.cardContainer}>
            {/* ---------- Order By ---------- */}
            <View style={styles.sectionHeader}>
              <MaterialIcons name="person-pin" size={24} color="#2C3E50" />
              <Text style={styles.sectionTitle}>Order By</Text>
              <Text style={{ color: 'red' }}> *</Text>
            </View>
            <View style={styles.field}>
              <View style={styles.inputContainer}>
                <MaterialIcons
                  name="person"
                  size={20}
                  color="#718096"
                  style={styles.inputIcon}
                />
                <TextInput
                  ref={orderByInputRef}
                  style={[
                    styles.fieldInput,
                    styles.inputWithIcon,
                    { fontSize: orderBy ? 16 : 13 },
                  ]}
                  value={orderBy}
                  onChangeText={handleOrderByChange}
                  placeholder="Enter order creator name"
                  placeholderTextColor={'grey'}
                />
              </View>
              {orderByError ? (
                <Text style={styles.errorText}>{orderByError}</Text>
              ) : null}
            </View>

            {/* ---------- Transporter ---------- */}
            <View style={styles.sectionHeader}>
              <MaterialIcons name="local-shipping" size={24} color="#2C3E50" />
              <Text style={styles.sectionTitle}>Transporter Details</Text>
            </View>

            <View style={styles.field}>
              <Text style={styles.fieldLabel}>
                Transporter Name <Text style={{ color: 'red' }}> *</Text>
              </Text>
              <View style={styles.inputContainer}>
                <Ionicons
                  name="person"
                  size={20}
                  color="#718096"
                  style={styles.inputIcon}
                />
                <TextInput
                  style={[styles.fieldInput, styles.inputWithIcon]}
                  value={transporterDetails.name}
                  onChangeText={handleTransporterNameChange}
                />
              </View>
              {transporterNameError ? (
                <Text style={styles.errorText}>{transporterNameError}</Text>
              ) : null}
            </View>

            <View style={styles.field}>
              <Text style={styles.fieldLabel}>Vehicle No (Optional)</Text>
              <View style={styles.inputContainer}>
                <MaterialIcons
                  name="directions-car"
                  size={20}
                  color="#718096"
                  style={styles.inputIcon}
                />
                <TextInput
                  style={[styles.fieldInput, styles.inputWithIcon]}
                  value={transporterDetails.vehicleNo}
                  onChangeText={text =>
                    setTransporterDetails(prev => ({
                      ...prev,
                      vehicleNo: text,
                    }))
                  }
                />
              </View>
            </View>

            <View style={styles.field}>
              <Text style={styles.fieldLabel}>Shop No (Optional)</Text>
              <View style={styles.inputContainer}>
                <MaterialIcons
                  name="store"
                  size={20}
                  color="#718096"
                  style={styles.inputIcon}
                />
                <TextInput
                  style={[styles.fieldInput, styles.inputWithIcon]}
                  value={transporterDetails.shopNo}
                  onChangeText={text =>
                    setTransporterDetails(prev => ({ ...prev, shopNo: text }))
                  }
                />
              </View>
            </View>

            <View style={styles.divider} />

            {/* ---------- Dates & Location ---------- */}
            <View style={styles.field}>
              <Text style={styles.fieldLabel}>Order Date</Text>
              <View style={styles.dateInputContainer}>
                <View style={styles.dateInputContent}>
                  <MaterialIcons
                    name="event"
                    size={20}
                    color="#718096"
                    style={styles.inputIcon}
                  />
                  <Text style={styles.dateText}>
                    {formatDate(orderDetails.orderDate)}
                  </Text>
                </View>
              </View>
            </View>

            <View style={styles.field}>
              <Text style={styles.fieldLabel}>
                Delivery Date <Text style={{ color: 'red' }}> *</Text>
              </Text>
              <TouchableWithoutFeedback onPress={handleDateFieldTap}>
                <View
                  style={[styles.dateInputContainer, { position: 'relative' }]}
                >
                  <View style={styles.dateInputContent}>
                    <MaterialIcons
                      name="event-available"
                      size={20}
                      color="#718096"
                      style={styles.inputIcon}
                    />
                    <Text style={styles.dateText}>
                      {formatDate(orderDetails.deliveryDate)}
                    </Text>
                  </View>
                </View>
              </TouchableWithoutFeedback>
              {deliveryDateError ? (
                <Text style={styles.errorText}>{deliveryDateError}</Text>
              ) : null}
              {showDatePicker && Platform.OS === 'android' && (
                <DateTimePicker
                  testID="datePickerAndroid"
                  value={selectedDate}
                  mode="date"
                  display="default"
                  textColor="#0284c7"
                  onChange={onDateChange}
                  minimumDate={new Date()}
                />
              )}
            </View>

            <View style={styles.field}>
              <Text style={styles.fieldLabel}>
                Delivery Location <Text style={{ color: 'red' }}> *</Text>
              </Text>
              <View style={styles.inputContainer}>
                <MaterialIcons
                  name="location-on"
                  size={20}
                  color="#718096"
                  style={styles.inputIcon}
                />
                <TextInput
                  style={[styles.fieldInput, styles.inputWithIcon]}
                  value={orderDetails.CUST_DELIVERY_ADD}
                  onChangeText={handleDeliveryLocationChange}
                  multiline
                  numberOfLines={2}
                />
              </View>
              {deliveryLocationError ? (
                <Text style={styles.errorText}>{deliveryLocationError}</Text>
              ) : null}
            </View>

            <View style={styles.field}>
              <Text style={styles.fieldLabel}>Remarks</Text>
              <View style={[styles.inputContainer, styles.remarksContainer]}>
                <View style={styles.remarksIconContainer}>
                  <MaterialIcons name="notes" size={20} color="#718096" />
                </View>
                <TextInput
                  style={[
                    styles.fieldInput,
                    styles.inputWithIcon,
                    styles.remarksInput,
                  ]}
                  value={orderDetails.remarks}
                  onChangeText={text =>
                    setOrderDetails(prev => ({ ...prev, remarks: text }))
                  }
                  multiline
                  numberOfLines={100}
                  textAlignVertical="top"
                />
              </View>
            </View>

            {/* ---------- LABOUR CHARGES ---------- */}
            <TouchableOpacity
              activeOpacity={0.7}
              style={styles.laborHeaderRow}
              onPress={() => setIsLaborSectionOpen(prev => !prev)}
            >
              <View style={styles.laborHeaderLeft}>
                <View style={styles.laborIconBadge}>
                  <MaterialIcons name="engineering" size={18} color="#0284c7" />
                </View>
                <View>
                  <Text style={styles.sectionTitle}>Labour Charges</Text>
                  <Text style={styles.laborSubtitle}>
                    {selectedLaborCount > 0
                      ? `${selectedLaborCount} charge${
                          selectedLaborCount > 1 ? 's' : ''
                        } }`
                      : 'Tap to configure'}
                  </Text>
                </View>
              </View>
              <MaterialIcons
                name={isLaborSectionOpen ? 'expand-less' : 'expand-more'}
                size={26}
                color="#4A5568"
              />
            </TouchableOpacity>

            {!isLaborSectionOpen && getSelectedLaborChargesSummary() ? (
              <View style={styles.selectedLaborContainer}>
                <MaterialIcons
                  name="assignment-turned-in"
                  size={16}
                  color="#0284c7"
                />
                <Text style={styles.selectedLaborText} numberOfLines={2}>
                  {getSelectedLaborChargesSummary()}
                </Text>
              </View>
            ) : null}

            {laborRatesLoading && (
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  marginTop: 8,
                }}
              >
                <ActivityIndicator size="small" color="#0284c7" />
                <Text style={{ marginLeft: 8, fontSize: 12, color: '#718096' }}>
                  Loading labour rates...
                </Text>
              </View>
            )}
            {!!laborRatesError && (
              <Text style={[styles.errorText, { marginLeft: 0, marginTop: 6 }]}>
                {laborRatesError}
              </Text>
            )}

            {isLaborSectionOpen && (
              <View style={styles.laborBody}>
                <View style={styles.tableHeader}>
                  <TouchableOpacity
                    style={[
                      styles.checkbox,
                      areAllOptionalChargesSelected && styles.checkboxSelected,
                    ]}
                    onPress={toggleSelectAllLaborCharges}
                  >
                    {areAllOptionalChargesSelected && (
                      <Text style={styles.checkmark}>✓</Text>
                    )}
                  </TouchableOpacity>
                  <Text style={[styles.tableHeaderCell, laborColStyles.type]}>
                    Type
                  </Text>
                  <Text
                    style={[styles.tableHeaderCell, laborColStyles.applied]}
                  >
                    Applied
                  </Text>
                  <Text style={[styles.tableHeaderCell, laborColStyles.qty]}>
                    Qty
                  </Text>
                </View>

                {laborCharges.map((charge, index) => {
                  const appliedCount = charge.itemSelections.filter(
                    sel => sel.applied,
                  ).length;

                  return (
                    <View key={charge.id} style={styles.laborChargeBlock}>
                      <View
                        style={[
                          styles.laborItem,
                          index % 2 === 0 && styles.evenRow,
                        ]}
                      >
                        <TouchableOpacity
                          style={[
                            styles.checkbox,
                            charge.selected && styles.checkboxSelected,
                            charge.isForced && styles.checkboxDisabled,
                          ]}
                          onPress={() => toggleLaborChargeSelection(charge.id)}
                          disabled={charge.isForced}
                        >
                          {charge.selected && (
                            <Text style={styles.checkmark}>✓</Text>
                          )}
                        </TouchableOpacity>

                        <View style={laborColStyles.type}>
                          <Text style={styles.laborItemText}>
                            {charge.type}
                          </Text>
                          {charge.isForced && (
                            <Text style={styles.entireOrderTagText}>
                              Entire Order
                            </Text>
                          )}
                        </View>

                        <View style={laborColStyles.applied}>
                          <TextInput
                            style={[
                              styles.quantityInput,
                              (!charge.selected ||
                                (charge.allowsPartial && !charge.applyToAll)) &&
                                styles.disabledQuantityInput,
                            ]}
                            value={
                              charge.allowsPartial && !charge.applyToAll
                                ? String(
                                    charge.itemSelections
                                      .filter(sel => sel.applied)
                                      .reduce(
                                        (sum, sel) =>
                                          sum +
                                          (parseFloat(sel.appliedQuantity) ||
                                            0),
                                        0,
                                      ),
                                  )
                                : charge.appliedQuantity
                            }
                            onChangeText={text =>
                              updateAppliedQuantity(charge.id, text)
                            }
                            keyboardType="numeric"
                            editable={
                              charge.selected &&
                              (!charge.allowsPartial || charge.applyToAll)
                            }
                          />
                        </View>

                        <Text
                          style={[
                            styles.laborItemText,
                            laborColStyles.qty,
                            { textAlign: 'center' },
                          ]}
                        >
                          {charge.quantity}
                        </Text>
                      </View>

                      {charge.selected && charge.allowsPartial && (
                        <View style={styles.partialChargeContainer}>
                          <View style={styles.applyToggleRow}>
                            <TouchableOpacity
                              style={[
                                styles.applyToggleOption,
                                charge.applyToAll &&
                                  styles.applyToggleOptionActive,
                              ]}
                              onPress={() => setApplyToAll(charge.id, true)}
                            >
                              <Text
                                style={[
                                  styles.applyToggleText,
                                  charge.applyToAll &&
                                    styles.applyToggleTextActive,
                                ]}
                              >
                                Apply to All
                              </Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                              style={[
                                styles.applyToggleOption,
                                !charge.applyToAll &&
                                  styles.applyToggleOptionActive,
                              ]}
                              onPress={() => setApplyToAll(charge.id, false)}
                            >
                              <Text
                                style={[
                                  styles.applyToggleText,
                                  !charge.applyToAll &&
                                    styles.applyToggleTextActive,
                                ]}
                              >
                                Select Items
                              </Text>
                            </TouchableOpacity>
                          </View>

                          {!charge.applyToAll && (
                            <View style={styles.itemDropdownContainer}>
                              <TouchableOpacity
                                style={styles.itemDropdownTrigger}
                                onPress={() => toggleItemPicker(charge.id)}
                              >
                                <Text style={styles.itemDropdownTriggerText}>
                                  {appliedCount > 0
                                    ? `${appliedCount} item(s) selected`
                                    : 'Select items / lots'}
                                </Text>
                                <MaterialIcons
                                  name={
                                    charge.isItemPickerOpen
                                      ? 'arrow-drop-up'
                                      : 'arrow-drop-down'
                                  }
                                  size={22}
                                  color="#4A5568"
                                />
                              </TouchableOpacity>

                              {charge.isItemPickerOpen && (
                                <View style={styles.itemDropdownList}>
                                  {charge.itemSelections.map(sel => (
                                    <View
                                      key={`${charge.id}-${sel.itemId}-${sel.lotNo}`}
                                      style={styles.itemDropdownRow}
                                    >
                                      <TouchableOpacity
                                        style={styles.itemDropdownCheckboxRow}
                                        onPress={() =>
                                          toggleItemForCharge(
                                            charge.id,
                                            sel.itemId,
                                            sel.lotNo,
                                          )
                                        }
                                      >
                                        <View
                                          style={[
                                            styles.checkbox,
                                            sel.applied &&
                                              styles.checkboxSelected,
                                          ]}
                                        >
                                          {sel.applied && (
                                            <Text style={styles.checkmark}>
                                              ✓
                                            </Text>
                                          )}
                                        </View>
                                        <View
                                          style={
                                            styles.itemDropdownLabelContainer
                                          }
                                        >
                                          <Text
                                            style={styles.itemDropdownLabel}
                                          >
                                            {sel.itemName}
                                          </Text>
                                          <Text
                                            style={styles.itemDropdownSubLabel}
                                          >
                                            Lot: {sel.lotNo || 'N/A'} · Ordered:{' '}
                                            {sel.maxQuantity}
                                          </Text>
                                        </View>
                                      </TouchableOpacity>

                                      {sel.applied && (
                                        <View
                                          style={
                                            styles.itemDropdownQtyContainer
                                          }
                                        >
                                          {/* qty input can be re-enabled if needed */}
                                        </View>
                                      )}
                                    </View>
                                  ))}
                                </View>
                              )}
                            </View>
                          )}
                        </View>
                      )}
                    </View>
                  );
                })}

                <TouchableOpacity
                  style={styles.collapseButton}
                  onPress={() => {
                    setIsLaborSectionOpen(false);
                    setOrderDetails(prev => ({
                      ...prev,
                      laborCharges: getSelectedLaborChargesSummary(),
                    }));
                  }}
                >
                  <Text style={styles.collapseButtonText}>Done</Text>
                  <MaterialIcons name="check" size={18} color="#FFFFFF" />
                </TouchableOpacity>
              </View>
            )}
          </View>

          {/* ---------- Order Summary ---------- */}
          <View style={styles.itemsSummary}>
            <View style={styles.summaryHeader}>
              <MaterialIcons name="receipt-long" size={24} color="#2C3E50" />
              <Text style={styles.summaryTitle}>Order Summary</Text>
            </View>
            {orderItems.map((item: OrderItem, index: number) => (
              <View key={index} style={styles.itemRow}>
                <View style={styles.itemInfo}>
                  <MaterialIcons name="inventory" size={20} color="#4A5568" />
                  <View style={styles.itemDetails}>
                    <Text style={styles.itemName}>
                      {item.ITEM_NAME || `Item ${item.ITEM_ID}`}
                    </Text>
                    <Text style={styles.unitName}>
                      {item.UNIT_NAME || 'Unit not specified'}
                    </Text>
                  </View>
                </View>
                <View style={styles.quantityBadge}>
                  <Text style={styles.itemQuantity}>
                    {item.ORDERED_QUANTITY}
                  </Text>
                </View>
              </View>
            ))}
          </View>

          {/* ---------- Submit ---------- */}
          <View style={styles.submitButtonContainer}>
            <TouchableOpacity
              style={[styles.submitButton, isLoading && styles.disabledButton]}
              onPress={handleSubmitOrder}
              disabled={isLoading}
            >
              {isLoading ? (
                <View style={styles.loadingContainer}>
                  <ActivityIndicator color="#FFFFFF" />
                  <Text style={styles.buttonText}>Processing...</Text>
                </View>
              ) : (
                <>
                  <Text style={styles.buttonText}>Confirm Order</Text>
                  <Ionicons
                    name="checkmark-circle-outline"
                    size={24}
                    style={{ color: '#FFFFFF' }}
                  />
                </>
              )}
            </TouchableOpacity>
          </View>
        </ScrollView>

        {/* iOS Date Picker Modal */}
        <Modal
          visible={showDatePicker && Platform.OS === 'ios'}
          transparent={true}
          animationType="slide"
        >
          <View style={styles.iosDatePickerModal}>
            <View style={styles.iosDatePickerContainer}>
              <View style={styles.iosDatePickerHeader}>
                <Text style={styles.iosDatePickerTitle}>
                  Select Delivery Date
                </Text>
                <TouchableOpacity onPress={() => setShowDatePicker(false)}>
                  <Text style={styles.iosDatePickerDoneBtn}>Done</Text>
                </TouchableOpacity>
              </View>
              <DateTimePicker
                testID="datePickerIOS"
                value={selectedDate}
                mode="date"
                display="spinner"
                onChange={(_event, date) => {
                  if (date) setSelectedDate(date);
                }}
                minimumDate={new Date()}
                style={styles.iosDatePicker}
                textColor="#000000"
              />
              <TouchableOpacity
                style={styles.iosDatePickerConfirmBtn}
                onPress={() => {
                  const formatted = `${selectedDate.getFullYear()}-${String(
                    selectedDate.getMonth() + 1,
                  ).padStart(2, '0')}-${String(selectedDate.getDate()).padStart(
                    2,
                    '0',
                  )}`;
                  setOrderDetails(prev => ({
                    ...prev,
                    deliveryDate: formatted,
                  }));
                  setDeliveryDateError('');
                  setShowDatePicker(false);
                }}
              >
                <Text style={styles.iosDatePickerConfirmText}>
                  Confirm Date
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>

        {/* Success Modal */}
        <Modal
          visible={showSuccessModal}
          transparent={true}
          animationType="fade"
          onRequestClose={() => setShowSuccessModal(false)}
        >
          <View style={styles.successModalOverlay}>
            <View style={styles.successModalContent}>
              <View style={styles.successHeader}>
                <View style={styles.successIconCircle}>
                  <Ionicons name="checkmark-sharp" size={40} color="#FFFFFF" />
                </View>
                <Text style={styles.successTitle}>
                  Order Placed Successfully!
                </Text>
              </View>

              <View style={styles.ordersContainer}>
                {successData.ordersByUnit.map((order, index) => (
                  <View key={index} style={styles.compactOrderCard}>
                    <View style={styles.compactOrderDetails}>
                      <Text style={styles.orderNoText}>#{order.orderNo}</Text>
                      <Text style={styles.unitText}>{order.unitName}</Text>
                      <Text style={styles.itemCountText}>
                        {order.itemCount} items
                      </Text>
                    </View>
                  </View>
                ))}
              </View>

              <View style={styles.successButtonsContainer}>
                <TouchableOpacity
                  style={styles.viewOrderButton}
                  onPress={() => {
                    setShowSuccessModal(false);
                    navigation.navigate('BottomTabNavigator', {
                      screen: 'Orders',
                      customerID: customerID,
                      params: {
                        screen: 'OrdersHome',
                        params: {
                          shouldRefresh: true,
                          customerID: customerID,
                        },
                      },
                    });

                    if (successData.ordersByUnit.length >= 1) {
                      const order = successData.ordersByUnit[0];
                      setTimeout(() => {
                        return navigation.navigate('PendingOrdersScreen', {
                          orderId: order.orderId,
                          orderNo: order.orderNo,
                          transporterName: successData.formattedTransporterName,
                          orderBy: order.orderBy,
                          deliveryDate: orderDetails.deliveryDate,
                          deliveryAddress: orderDetails.CUST_DELIVERY_ADD,
                          orderDate: orderDetails.orderDate,
                          items: order.processedItems,
                          customerID: customerID,
                          unitId: unitId,
                        });
                      }, 100);
                    }
                  }}
                >
                  <View style={styles.viewOrderGradient}>
                    <MaterialIcons
                      name="visibility"
                      size={20}
                      color="#FFFFFF"
                    />
                    <Text style={styles.viewOrderText}>
                      {successData.ordersByUnit.length > 1
                        ? 'View Orders'
                        : 'View Order'}
                    </Text>
                  </View>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        {/* Validation / Resubmission modals – unchanged */}
        <Modal
          visible={showValidationModal}
          transparent={true}
          animationType="fade"
          onRequestClose={() => setShowValidationModal(false)}
        >
          <View style={styles.validationModalOverlay}>
            <View style={styles.validationModalContent}>
              <View style={styles.validationModalHeader}>
                <MaterialIcons name="info-outline" size={30} color="#dc3545" />
                <Text style={styles.validationHeaderText}>
                  Missing Required Information
                </Text>
              </View>
              <View style={styles.validationBodyContainer}>
                {validationMessage.split('\n').map((message, index) =>
                  index === 0 ? (
                    <Text key={index} style={styles.validationMainMessage}>
                      {message}
                    </Text>
                  ) : (
                    <View key={index} style={styles.validationItemRow}>
                      <MaterialIcons
                        name="error-outline"
                        size={18}
                        color="#dc3545"
                      />
                      <Text style={styles.validationItemText}>{message}</Text>
                    </View>
                  ),
                )}
              </View>
              <TouchableOpacity
                style={styles.validationActionButton}
                onPress={() => setShowValidationModal(false)}
              >
                <Text style={styles.validationActionButtonText}>Got It!</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>

        <Modal
          visible={showResubmissionModal}
          transparent={true}
          animationType="fade"
          onRequestClose={() => setShowResubmissionModal(false)}
        >
          <View style={styles.resubmissionModalOverlay}>
            <View style={styles.resubmissionModalContent}>
              <View style={styles.resubmissionIconContainer}>
                <View style={styles.resubmissionIconCircle}>
                  <MaterialIcons name="warning" size={40} color="#FFFFFF" />
                </View>
              </View>
              <View style={styles.resubmissionTextContainer}>
                <Text style={styles.resubmissionTitle}>Already Submitted!</Text>
                <Text style={styles.resubmissionMessage}>
                  This order has already been placed successfully. Please start
                  a new order.
                </Text>
              </View>
              <View style={styles.resubmissionButtonsContainer}>
                <TouchableOpacity
                  style={styles.resubmissionButton}
                  onPress={() => {
                    setShowResubmissionModal(false);
                    navigation.goBack();
                  }}
                >
                  <View style={styles.resubmissionButtonGradient}>
                    <MaterialIcons name="arrow-back" size={20} color="black" />
                    <Text style={styles.resubmissionButtonText}>Go Back</Text>
                  </View>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      </KeyboardAvoidingView>
    </View>
  );
};

/* ---------- styles (identical to original, only labourColStyles kept) ---------- */
const laborColStyles = StyleSheet.create({
  type: { flex: 1.6, marginLeft: 10 },
  applied: { flex: 1.1, alignItems: 'center' },
  qty: { flex: 0.6, textAlign: 'center' },
  rate: { flex: 0.6, textAlign: 'center' },
  amount: { flex: 0.9, textAlign: 'right' },
});

const styles = StyleSheet.create({
  // … paste the entire original StyleSheet here unchanged …
  // (safeArea, mainContainer, scrollContainer, cardContainer, … all the way to itemCountText)
  safeArea: { flex: 1, backgroundColor: '#F5F7FA' },
  mainContainer: { flex: 1, backgroundColor: '#FFFAFA', elevation: 2 },
  scrollContainer: { flex: 1, padding: 16 },
  cardContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
      },
      android: { elevation: 6 },
    }),
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#2C3E50',
    marginLeft: 8,
  },
  field: { marginBottom: 20 },
  fieldLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#34495E',
    marginBottom: 8,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  inputIcon: { padding: 12 },
  inputWithIcon: {
    flex: 1,
    borderWidth: 0,
    backgroundColor: 'transparent',
    paddingLeft: 0,
  },
  fieldInput: {
    padding: 12,
    fontSize: 16,
    color: '#2C3E50',
    borderRadius: 12,
  },
  remarksInput: {
    flex: 1,
    height: 120,
    paddingTop: 12,
    paddingBottom: 1,
    paddingRight: 12,
    fontSize: 15,
    color: '#2D3748',
    textAlignVertical: 'top',
  },
  errorText: {
    color: '#dc3545',
    fontSize: 12,
    marginTop: 4,
    marginLeft: 40,
  },
  iosDatePickerModal: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  iosDatePickerContainer: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 16,
  },
  iosDatePickerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  iosDatePickerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#2C3E50',
  },
  iosDatePickerDoneBtn: {
    fontSize: 18,
    fontWeight: '600',
    color: '#0284c7',
  },
  iosDatePicker: { height: 200, marginTop: 10 },
  iosDatePickerConfirmBtn: {
    backgroundColor: '#0284c7',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginTop: 16,
    marginBottom: 5,
  },
  iosDatePickerConfirmText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  laborHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  laborHeaderLeft: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  laborIconBadge: {
    width: 30,
    height: 30,
    borderRadius: 9,
    backgroundColor: '#E9F2FC',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  laborSubtitle: { fontSize: 12.5, color: '#718096', marginTop: 2 },
  laborBody: { marginTop: 14 },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#F8F9FC',
    paddingVertical: 10,
    paddingHorizontal: 1,
    borderRadius: 8,
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  tableHeaderCell: { fontSize: 13, fontWeight: '600', color: '#333' },
  collapseButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0284c7',
    borderRadius: 10,
    paddingVertical: 11,
    gap: 6,
    marginTop: 4,
  },
  collapseButtonText: { color: '#FFFFFF', fontSize: 14.5, fontWeight: '700' },
  divider: {
    height: 1,
    backgroundColor: '#E2E8F0',
    marginVertical: 20,
  },
  selectedLaborContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0F5FF',
    padding: 12,
    borderRadius: 12,
    marginBottom: 16,
    borderLeftWidth: 4,
    borderLeftColor: '#6B46C1',
  },
  selectedLaborText: {
    fontSize: 13,
    color: '#4A5568',
    marginLeft: 8,
    flex: 1,
  },
  itemsSummary: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
      },
      android: { elevation: 6 },
    }),
  },
  summaryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  summaryTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#2C3E50',
    marginLeft: 8,
  },
  itemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  itemInfo: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  itemName: { fontSize: 14, color: '#2C3E50', marginLeft: 8, flex: 1 },
  quantityBadge: {
    backgroundColor: '#E2E8F0',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  itemQuantity: { fontSize: 14, color: '#2C3E50', fontWeight: '500' },
  submitButtonContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    marginBottom: 40,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
      },
      android: { elevation: 6 },
    }),
  },
  submitButton: {
    backgroundColor: '#0284c7',
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  disabledButton: { backgroundColor: '#A0AEC0' },
  buttonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '600' },
  loadingContainer: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  laborChargeBlock: {
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  laborItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 0,
    gap: 8,
  },
  evenRow: { backgroundColor: '#F7FAFC' },
  laborItemText: { fontSize: 13, color: '#333' },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#CBD5E0',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
  },
  checkboxSelected: {
    backgroundColor: '#0284c7',
    borderColor: '#3B82F6',
  },
  checkmark: { color: '#FFFFFF', fontSize: 14, fontWeight: 'bold' },
  quantityInput: {
    borderWidth: 1,
    borderColor: '#CBD5E0',
    borderRadius: 4,
    paddingVertical: 6,
    paddingHorizontal: 8,
    width: '100%',
    fontSize: 13,
    backgroundColor: '#FFFFFF',
    textAlign: 'center',
  },
  disabledQuantityInput: {
    backgroundColor: '#F1F5F9',
    color: '#94A3B8',
  },
  dateInputContainer: {
    backgroundColor: '#F8FAFC',
    borderColor: '#E2E8F0',
    borderWidth: 1,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    height: 48,
    paddingHorizontal: 12,
  },
  dateInputContent: {
    flexDirection: 'row',
    alignItems: 'center',
    color: '#0284c7',
    flex: 1,
  },
  dateText: { fontSize: 16, color: '#2C3E50', marginLeft: 1 },
  remarksContainer: {
    minHeight: 120,
    padding: 0,
    backgroundColor: '#F8FAFC',
    borderColor: '#E2E8F0',
    borderWidth: 1,
    borderRadius: 12,
  },
  remarksIconContainer: {
    paddingTop: 12,
    paddingHorizontal: 12,
    alignSelf: 'flex-start',
  },
  checkboxDisabled: {
    backgroundColor: '#0284c7',
    borderColor: '#3B82F6',
    opacity: 0.8,
  },
  entireOrderTagText: {
    fontSize: 11,
    color: '#718096',
    fontWeight: '600',
    marginTop: 2,
  },
  partialChargeContainer: {
    paddingHorizontal: 12,
    paddingBottom: 14,
    marginLeft: 28,
  },
  applyToggleRow: {
    flexDirection: 'row',
    backgroundColor: '#F1F5F9',
    borderRadius: 10,
    padding: 4,
    gap: 4,
  },
  applyToggleOption: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: 'center',
  },
  applyToggleOptionActive: { backgroundColor: '#0284c7' },
  applyToggleText: {
    fontSize: 13,
    color: '#4A5568',
    fontWeight: '600',
  },
  applyToggleTextActive: { color: '#FFFFFF' },
  itemDropdownContainer: { marginTop: 10 },
  itemDropdownTrigger: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  itemDropdownTriggerText: { fontSize: 14, color: '#2C3E50' },
  itemDropdownList: {
    marginTop: 6,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 10,
    overflow: 'hidden',
  },
  itemDropdownRow: {
    padding: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#EDF2F7',
  },
  itemDropdownCheckboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  itemDropdownLabelContainer: { flex: 1 },
  itemDropdownLabel: {
    fontSize: 14,
    color: '#2C3E50',
    fontWeight: '500',
  },
  itemDropdownSubLabel: {
    fontSize: 12,
    color: '#718096',
    marginTop: 2,
  },
  itemDropdownQtyContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 8,
    paddingLeft: 30,
  },
  successModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  successModalContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 24,
    width: '100%',
    maxWidth: 400,
    alignItems: 'center',
  },
  successIconCircle: {
    width: Platform.OS === 'ios' ? 54 : 58,
    height: Platform.OS === 'ios' ? 54 : 58,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#4CAF50',
  },
  successTitle: {
    fontSize: Platform.OS === 'ios' ? 17 : 18,
    fontWeight: 'bold',
    color: '#1A202C',
    marginBottom: 10,
    marginTop: 10,
    textAlign: 'center',
    width: '100%',
  },
  successButtonsContainer: {
    width: '100%',
    alignItems: 'center',
    marginTop: 10,
    paddingHorizontal: 20,
  },
  viewOrderButton: {
    width: '70%',
    height: 45,
    overflow: 'hidden',
    borderRadius: 12,
    backgroundColor: '#0284c7',
    marginBottom: 16,
  },
  viewOrderGradient: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  viewOrderText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  validationModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  validationModalContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    width: '90%',
    maxWidth: 400,
    overflow: 'hidden',
    alignItems: 'center',
    minHeight: 180,
  },
  validationModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: Platform.OS === 'ios' ? 3 : 25,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    marginTop: 10,
    width: '100%',
  },
  validationHeaderText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#dc3545',
    marginLeft: 3,
  },
  validationBodyContainer: {
    width: '89%',
    paddingHorizontal: 17,
    paddingVertical: 16,
  },
  validationMainMessage: {
    fontSize: Platform.OS === 'ios' ? 14 : 15,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 12,
    textAlign: 'center',
  },
  validationItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    backgroundColor: '#EFF6FF',
    padding: 10,
    borderRadius: 6,
    borderLeftWidth: 3,
    borderLeftColor: '#dc3545',
  },
  validationItemText: {
    fontSize: 13,
    color: '#4B5563',
    marginLeft: 8,
    flex: 1,
  },
  validationActionButton: {
    backgroundColor: '#0284c7',
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 20,
    width: '40%',
    alignItems: 'center',
    marginBottom: 16,
    marginTop: 4,
  },
  validationActionButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
  },
  resubmissionModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  resubmissionModalContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 2,
    width: '85%',
    height: Platform.OS === 'ios' ? 'auto' : 320,
    maxWidth: 400,
    alignItems: 'center',
  },
  resubmissionIconContainer: { marginBottom: 24 },
  resubmissionTextContainer: { alignItems: 'center', marginBottom: 3 },
  resubmissionTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FF5252',
    marginBottom: 1,
    textAlign: 'center',
  },
  resubmissionMessage: {
    fontSize: 16,
    color: '#4A5568',
    textAlign: 'center',
    lineHeight: 24,
  },
  resubmissionButtonsContainer: { width: '100%' },
  resubmissionButton: { width: '100%', overflow: 'hidden', borderRadius: 12 },
  resubmissionIconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  resubmissionButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 20,
    gap: 8,
  },
  resubmissionButtonText: {
    color: '#2C3E50',
    fontSize: 16,
    fontWeight: '600',
  },
  itemDetails: { flex: 1, marginLeft: 8 },
  unitName: {
    fontSize: 12,
    color: '#718096',
    marginTop: 2,
    marginLeft: 7,
  },
  successHeader: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    width: '100%',
  },
  ordersContainer: {
    width: '100%',
    paddingHorizontal: 16,
    marginBottom: 16,
    paddingStart: 5,
  },
  compactOrderCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    marginBottom: 10,
    padding: 12,
    paddingHorizontal: 16,
    width: '100%',
  },
  compactOrderDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  orderNoText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0284c7',
    flex: 0.8,
    minWidth: 90,
  },
  unitText: {
    fontSize: 14,
    color: '#4A5568',
    flex: 1,
    textAlign: 'center',
    marginHorizontal: 4,
    minWidth: 70,
  },
  itemCountText: {
    fontSize: 14,
    color: '#718096',
    flex: 0.8,
    textAlign: 'right',
    minWidth: 60,
  },
});

export default OrderConfirmationScreen;
