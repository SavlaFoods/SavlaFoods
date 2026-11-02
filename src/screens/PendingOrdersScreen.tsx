// import React, { useState, useCallback } from 'react';
// import {
//   ActivityIndicator,
//   FlatList,
//   RefreshControl,
//   StatusBar,
//   StyleSheet,
//   Text,
//   TouchableOpacity,
//   View,
//   SafeAreaView,
// } from 'react-native';
// import {
//   useNavigation,
//   useFocusEffect,
//   useRoute,
// } from '@react-navigation/native';
// import { NativeStackNavigationProp } from '@react-navigation/native-stack';

// import axios from 'axios';
// import { API_ENDPOINTS } from '../config/api.config';
// import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
// import { useCustomer } from '../contexts/DisplayNameContext';
// import { MainStackParamList } from '../../src/type/type';
// import { LayoutWrapper } from '../components/AppLayout';

// interface PendingOrder {
//   orderId: number;
//   orderNo: string;
//   orderDate: string;
//   deliveryDate: string;
//   status: string;
//   transporterName: string;
//   remarks: string;
//   deliveryAddress: string;
//   customerName: string;
//   totalItems: number;
//   totalQuantity: number;
//   unitName: string;
//   items: Array<{
//     detailId: number;
//     itemId: number;
//     itemName: string;
//     lotNo: string | number;
//     itemMarks: string;
//     vakalNo: string;
//     requestedQty: number;
//     QUANTITY: number;
//     AVAILABLE_QTY: number;
//     status: string;
//     unitName: string;
//   }>;
// }

// interface PendingOrderResponse {
//   success: boolean;
//   message: string;
//   data: {
//     orders: PendingOrder[];
//     pagination: {
//       page: number;
//       limit: number;
//       totalItems: number;
//       totalPages: number;
//     };
//   };
// }

// type TabKey = 'pending' | 'approved';

// interface TabState {
//   orders: PendingOrder[];
//   page: number;
//   totalPages: number;
//   isLoading: boolean;
//   isLoadingMore: boolean;
//   refreshing: boolean;
//   error: string | null;
// }

// const initialTabState: TabState = {
//   orders: [],
//   page: 1,
//   totalPages: 1,
//   isLoading: true,
//   isLoadingMore: false,
//   refreshing: false,
//   error: null,
// };

// const TABS: Array<{ key: TabKey; label: string }> = [
//   { key: 'pending', label: 'Pending for Approval' },
//   { key: 'approved', label: 'Approved' },
// ];

// // How many days back the "Approved" tab looks (fromDate .. toDate)
// const APPROVED_LOOKBACK_DAYS = 30;

// const toYMD = (date: Date) => {
//   const y = date.getFullYear();
//   const m = String(date.getMonth() + 1).padStart(2, '0');
//   const d = String(date.getDate()).padStart(2, '0');
//   return `${y}-${m}-${d}`;
// };

// // Ensure dates are YYYY-MM-DD without a time component
// const normalizeDate = (dateString: string) => {
//   if (!dateString) return dateString;
//   return dateString.split('T')[0].split(' ')[0];
// };

// const PendingOrdersScreen = () => {
//   const navigation =
//     useNavigation<NativeStackNavigationProp<MainStackParamList>>();
//   const route = useRoute();

//   const [activeTab, setActiveTab] = useState<TabKey>('pending');
//   const [tabData, setTabData] = useState<Record<TabKey, TabState>>({
//     pending: { ...initialTabState },
//     approved: { ...initialTabState },
//   });

//   const { customerID } = useCustomer();

//   const updateTab = useCallback((tab: TabKey, patch: Partial<TabState>) => {
//     setTabData(prev => ({ ...prev, [tab]: { ...prev[tab], ...patch } }));
//   }, []);

//   const fetchOrders = useCallback(
//     async (tab: TabKey, pageNum = 1, refresh = false) => {
//       try {
//         if (!customerID) {
//           updateTab(tab, {
//             error: 'Customer ID not found. Please login again.',
//             isLoading: false,
//           });
//           return;
//         }

//         if (refresh || pageNum === 1) {
//           // Only show the full spinner when there is nothing to show yet
//           if (refresh) {
//             updateTab(tab, { page: 1 });
//           }
//         } else {
//           updateTab(tab, { isLoadingMore: true });
//         }
//         updateTab(tab, { error: null });

//         let response;
//         if (tab === 'pending') {
//           response = await axios.get(`${API_ENDPOINTS.GET_PENDING_ORDERS}`, {
//             params: {
//               customerId: customerID,
//               page: pageNum,
//               limit: 10,
//             },
//           });
//         } else {
//           const today = new Date();
//           const from = new Date();
//           from.setDate(today.getDate() - APPROVED_LOOKBACK_DAYS);

//           // GET /order/getPendingOrderswithstatus
//           response = await axios.get(`${API_ENDPOINTS.GET_APPROVED_ORDERS}`, {
//             params: {
//               customer_id: customerID,
//               fromDate: toYMD(from),
//               toDate: toYMD(today),
//               page: pageNum,
//               limit: 10,
//             },
//           });
//         }

//         const result: PendingOrderResponse = response.data;

//         if (result.success) {
//           const normalizedOrders = (result.data?.orders || []).map(order => ({
//             ...order,
//             orderDate: normalizeDate(order.orderDate),
//             deliveryDate: normalizeDate(order.deliveryDate),
//           }));

//           setTabData(prev => {
//             const current = prev[tab];
//             const nextOrders =
//               refresh || pageNum === 1
//                 ? normalizedOrders
//                 : [...current.orders, ...normalizedOrders];
//             return {
//               ...prev,
//               [tab]: {
//                 ...current,
//                 orders: nextOrders,
//                 totalPages: result.data?.pagination?.totalPages ?? 1,
//                 page: result.data?.pagination?.page ?? pageNum,
//               },
//             };
//           });
//         } else {
//           updateTab(tab, { error: result.message });
//         }
//       } catch (err: any) {
//         console.error(`Error fetching ${tab} orders:`, err);
//         updateTab(tab, {
//           error: err.message || 'Failed to load orders',
//         });

//         // Mock data fallback kept only for the pending tab (as before)
//         if (tab === 'pending' && pageNum === 1) {
//           updateTab(tab, { orders: generateMockData(), totalPages: 3 });
//         }
//       } finally {
//         updateTab(tab, {
//           isLoading: false,
//           refreshing: false,
//           isLoadingMore: false,
//         });
//       }
//     },
//     [customerID, updateTab],
//   );

//   // Runs when the screen is focused AND whenever the active tab changes
//   useFocusEffect(
//     useCallback(() => {
//       updateTab(activeTab, { isLoading: true });
//       fetchOrders(activeTab, 1, true);
//     }, [activeTab, fetchOrders, updateTab]),
//   );

//   const current = tabData[activeTab];

//   const onRefresh = () => {
//     updateTab(activeTab, { refreshing: true });
//     fetchOrders(activeTab, 1, true);
//   };

//   const loadMoreOrders = () => {
//     if (!current.isLoadingMore && current.page < current.totalPages) {
//       fetchOrders(activeTab, current.page + 1);
//     }
//   };

//   const formatDate = (dateString: string) => {
//     if (!dateString) return '';
//     try {
//       const datePart = dateString.split('T')[0].split(' ')[0];
//       const parts = datePart.split('-');
//       if (parts.length !== 3) return dateString;
//       const monthNames = [
//         'January',
//         'February',
//         'March',
//         'April',
//         'May',
//         'June',
//         'July',
//         'August',
//         'September',
//         'October',
//         'November',
//         'December',
//       ];
//       const monthIndex = parseInt(parts[1], 10) - 1;
//       const day = parseInt(parts[2], 10);
//       if (monthIndex < 0 || monthIndex > 11 || isNaN(day)) return dateString;
//       return `${monthNames[monthIndex]} ${day}, ${parts[0]}`;
//     } catch {
//       return dateString;
//     }
//   };

//   const handleViewDetails = (order: PendingOrder) => {
//     navigation.navigate('OrderDetailsScreen' as any, {
//       order,
//       unitName: order.unitName,
//       isApproved: activeTab === 'approved',
//     });
//   };

//   const renderOrderCard = ({ item }: { item: PendingOrder }) => (
//     <View style={styles.card}>
//       <View style={styles.cardHeader}>
//         <View>
//           <Text style={styles.orderNo}>Order No: {item.orderNo}</Text>
//           <Text style={styles.totalItems}>Items: {item.totalItems}</Text>
//         </View>
//       </View>

//       <View style={styles.dateContainer}>
//         <View style={styles.dateBox}>
//           <Text style={styles.dateLabel}>Order Date</Text>
//           <Text style={styles.dateValue}>{formatDate(item.orderDate)}</Text>
//         </View>
//         <View style={styles.dateDivider} />
//         <View style={styles.dateBox}>
//           <Text style={styles.dateLabel}>Delivery Date</Text>
//           <Text style={styles.dateValue}>{formatDate(item.deliveryDate)}</Text>
//         </View>
//       </View>

//       <View style={styles.bottomRow}>
//         <Text style={styles.transporterValue} numberOfLines={1}>
//           {item.transporterName || 'No transporter'}
//         </Text>
//         <TouchableOpacity
//           style={styles.viewDetails}
//           onPress={() => handleViewDetails(item)}
//         >
//           <Text style={styles.viewDetailsText}>View Details</Text>
//           <MaterialIcons name="chevron-right" size={16} color="#0284c7" />
//         </TouchableOpacity>
//       </View>
//     </View>
//   );

//   const renderFooter = () => {
//     if (!current.isLoadingMore) return null;
//     return (
//       <View style={styles.footerLoader}>
//         <ActivityIndicator size="small" color="#0284C7" />
//         <Text style={styles.loadingMoreText}>Loading more orders...</Text>
//       </View>
//     );
//   };

//   const renderTabs = () => (
//     <View style={styles.tabBar}>
//       {TABS.map(tab => {
//         const isActive = tab.key === activeTab;
//         return (
//           <TouchableOpacity
//             key={tab.key}
//             style={[styles.tabButton, isActive && styles.tabButtonActive]}
//             onPress={() => setActiveTab(tab.key)}
//             activeOpacity={0.7}
//           >
//             <Text style={[styles.tabText, isActive && styles.tabTextActive]}>
//               {tab.label}
//             </Text>
//           </TouchableOpacity>
//         );
//       })}
//     </View>
//   );

//   const renderContent = () => {
//     if (current.isLoading && current.orders.length === 0) {
//       return (
//         <View style={styles.centered}>
//           <ActivityIndicator size="large" color="#0284C7" />
//         </View>
//       );
//     }

//     if (current.error && current.orders.length === 0) {
//       return (
//         <View style={styles.centered}>
//           <Text style={styles.errorText}>{current.error}</Text>
//           <TouchableOpacity
//             style={styles.retryButton}
//             onPress={() => {
//               updateTab(activeTab, { isLoading: true });
//               fetchOrders(activeTab, 1, true);
//             }}
//           >
//             <Text style={styles.retryButtonText}>Retry</Text>
//           </TouchableOpacity>
//         </View>
//       );
//     }

//     return (
//       <FlatList
//         data={current.orders.filter(order => order.totalItems > 0)}
//         keyExtractor={item => `${activeTab}-order-${item.orderId}`}
//         renderItem={renderOrderCard}
//         contentContainerStyle={styles.list}
//         refreshControl={
//           <RefreshControl
//             refreshing={current.refreshing}
//             onRefresh={onRefresh}
//           />
//         }
//         onEndReached={loadMoreOrders}
//         onEndReachedThreshold={0.3}
//         ListFooterComponent={renderFooter}
//         showsVerticalScrollIndicator={false}
//         ListEmptyComponent={
//           <View style={styles.emptyContainer}>
//             <MaterialIcons name="history" size={64} color="#d1d5db" />
//             <Text style={styles.emptyText}>
//               {activeTab === 'pending'
//                 ? 'No orders pending for approval'
//                 : 'No approved orders found'}
//             </Text>
//           </View>
//         }
//       />
//     );
//   };

//   return (
//     <LayoutWrapper showHeader={true} showTabBar={false} route={route}>
//       <SafeAreaView style={styles.container}>
//         <StatusBar barStyle="dark-content" backgroundColor="#f3f4f6" />
//         {renderTabs()}
//         {renderContent()}
//       </SafeAreaView>
//     </LayoutWrapper>
//   );
// };

// // Mock data generation function for demonstration
// const generateMockData = (): PendingOrder[] => {
//   const mockOrders: PendingOrder[] = [];
//   for (let i = 1; i <= 5; i++) {
//     const orderDate = new Date();
//     orderDate.setDate(orderDate.getDate() - i * 3);

//     const deliveryDate = new Date(orderDate);
//     deliveryDate.setDate(deliveryDate.getDate() + 2);

//     const totalItems = Math.floor(Math.random() * 5) + 1;
//     const items: PendingOrder['items'] = [];

//     for (let j = 1; j <= totalItems; j++) {
//       items.push({
//         detailId: j,
//         itemId: j * 100,
//         itemName: `Item ${j}`,
//         lotNo: `LOT${j}${i}`,
//         itemMarks: `MARK-${j}${i}`,
//         vakalNo: `VAK-${j}${i}`,
//         requestedQty: Math.floor(Math.random() * 50) + 10,
//         QUANTITY: Math.floor(Math.random() * 100) + 20,
//         AVAILABLE_QTY: Math.floor(Math.random() * 100) + 20,
//         status: 'NEW',
//         unitName: '',
//       });
//     }

//     mockOrders.push({
//       orderId: i,
//       orderNo: `ORD-${2026}${i.toString().padStart(4, '0')}`,
//       orderDate: toYMD(orderDate),
//       deliveryDate: toYMD(deliveryDate),
//       status: 'NEW',
//       transporterName: `Transporter ${i}`,
//       remarks: `Remarks for order ${i}`,
//       deliveryAddress: `123 Delivery St, Building ${i}, City`,
//       customerName: 'John Doe',
//       totalItems,
//       totalQuantity: items.reduce((sum, item) => sum + item.requestedQty, 0),
//       items,
//       unitName: '',
//     });
//   }
//   return mockOrders;
// };

// const styles = StyleSheet.create({
//   container: {
//     flex: 1,
//     backgroundColor: '#f9fafb',
//   },
//   centered: {
//     flex: 1,
//     justifyContent: 'center',
//     alignItems: 'center',
//     padding: 20,
//   },
//   tabBar: {
//     flexDirection: 'row',
//     backgroundColor: '#ffffff',
//     borderBottomWidth: 1,
//     borderBottomColor: '#e5e7eb',
//   },
//   tabButton: {
//     flex: 1,
//     paddingVertical: 14,
//     alignItems: 'center',
//     borderBottomWidth: 3,
//     borderBottomColor: 'transparent',
//   },
//   tabButtonActive: {
//     borderBottomColor: '#F48221',
//   },
//   tabText: {
//     fontSize: 14,
//     fontWeight: '500',
//     color: '#6B7280',
//   },
//   tabTextActive: {
//     color: '#F48221',
//     fontWeight: '600',
//   },
//   list: {
//     padding: 16,
//     paddingBottom: 50,
//   },
//   card: {
//     backgroundColor: '#ffffff',
//     borderRadius: 16,
//     marginBottom: 16,
//     padding: 16,
//     elevation: 2,
//     shadowColor: '#000',
//     shadowOffset: { width: 0, height: 1 },
//     shadowOpacity: 0.1,
//     shadowRadius: 2,
//   },
//   cardHeader: {
//     flexDirection: 'row',
//     justifyContent: 'space-between',
//     alignItems: 'flex-start',
//     marginBottom: 12,
//   },
//   orderNo: {
//     fontSize: 16,
//     fontWeight: '600',
//     color: '#F48221',
//   },
//   totalItems: {
//     fontSize: 14,
//     color: '#6B7280',
//     marginTop: 4,
//   },
//   dateContainer: {
//     flexDirection: 'row',
//     justifyContent: 'space-between',
//     marginBottom: 12,
//     backgroundColor: '#f9fafb',
//     padding: 12,
//     borderRadius: 8,
//   },
//   dateBox: {
//     flex: 1,
//   },
//   dateLabel: {
//     fontSize: 14,
//     color: '#6B7280',
//     marginBottom: 2,
//   },
//   dateValue: {
//     fontSize: 15,
//     color: '#111827',
//     fontWeight: '500',
//   },
//   dateDivider: {
//     width: 1,
//     backgroundColor: '#E5E7EB',
//     marginHorizontal: 16,
//   },
//   bottomRow: {
//     flexDirection: 'row',
//     justifyContent: 'space-between',
//     alignItems: 'center',
//     marginTop: 4,
//   },
//   transporterValue: {
//     fontSize: 14,
//     color: '#4B5563',
//     flex: 1,
//   },
//   viewDetails: {
//     flexDirection: 'row',
//     alignItems: 'center',
//   },
//   viewDetailsText: {
//     fontSize: 14,
//     color: '#0284c7',
//     fontWeight: '500',
//     marginRight: 4,
//   },
//   footerLoader: {
//     flexDirection: 'row',
//     justifyContent: 'center',
//     alignItems: 'center',
//     padding: 16,
//     paddingBottom: 34,
//     marginBottom: 17,
//   },
//   loadingMoreText: {
//     marginLeft: 8,
//     fontSize: 14,
//     color: '#6B7280',
//   },
//   errorText: {
//     fontSize: 16,
//     color: '#EF4444',
//     textAlign: 'center',
//     padding: 16,
//   },
//   emptyContainer: {
//     alignItems: 'center',
//     justifyContent: 'center',
//     padding: 32,
//   },
//   emptyText: {
//     fontSize: 16,
//     color: '#6B7280',
//     marginTop: 16,
//     textAlign: 'center',
//   },
//   retryButton: {
//     marginTop: 16,
//     paddingHorizontal: 24,
//     paddingVertical: 12,
//     backgroundColor: '#0284C7',
//     borderRadius: 8,
//   },
//   retryButtonText: {
//     color: '#fff',
//     fontWeight: '500',
//     fontSize: 16,
//   },
// });

// export default PendingOrdersScreen;

import React, { useState, useCallback, useRef } from 'react';
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  SafeAreaView,
} from 'react-native';
import {
  useNavigation,
  useFocusEffect,
  useRoute,
} from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';

import axios from 'axios';
import { API_ENDPOINTS } from '../config/api.config';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import { useCustomer } from '../contexts/DisplayNameContext';
import { MainStackParamList } from '../../src/type/type';
import { LayoutWrapper } from '../components/AppLayout';

interface PendingOrder {
  orderId: number;
  orderNo: string;
  orderDate: string;
  deliveryDate: string;
  status: string;
  transporterName: string;
  remarks: string;
  deliveryAddress: string;
  customerName: string;
  totalItems: number;
  totalQuantity: number;
  unitName: string;
  items: Array<{
    detailId: number;
    itemId: number;
    itemName: string;
    lotNo: string | number;
    itemMarks: string;
    vakalNo: string;
    requestedQty: number;
    QUANTITY: number;
    AVAILABLE_QTY: number;
    status: string;
    unitName: string;
  }>;
}

interface PendingOrderResponse {
  success: boolean;
  message: string;
  data: {
    orders: PendingOrder[];
    pagination: {
      page: number;
      limit: number;
      totalItems: number;
      totalPages: number;
    };
  };
}

type TabKey = 'pending' | 'approved';

interface TabState {
  orders: PendingOrder[];
  page: number;
  totalPages: number;
  isLoading: boolean;
  isLoadingMore: boolean;
  refreshing: boolean;
  error: string | null;
}

const initialTabState: TabState = {
  orders: [],
  page: 1,
  totalPages: 1,
  isLoading: true,
  isLoadingMore: false,
  refreshing: false,
  error: null,
};

const TABS: Array<{ key: TabKey; label: string }> = [
  { key: 'pending', label: 'Pending for Approval' },
  { key: 'approved', label: 'Approved' },
];

// Units shown in the filter. `value: null` means "no unit filter" (all units).
// Add / rename units here, or later replace this with a list fetched from your API.
const UNITS: Array<{ label: string; value: string | null }> = [
  { label: 'All Units', value: null },
  { label: 'D-39', value: 'D-39' },
  { label: 'D-514', value: 'D-514' },
];

// How many days back the "Approved" tab looks (fromDate .. toDate)
const APPROVED_LOOKBACK_DAYS = 30;

const toYMD = (date: Date) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

// Ensure dates are YYYY-MM-DD without a time component
const normalizeDate = (dateString: string) => {
  if (!dateString) return dateString;
  return dateString.split('T')[0].split(' ')[0];
};

const PendingOrdersScreen = () => {
  const navigation =
    useNavigation<NativeStackNavigationProp<MainStackParamList>>();
  const route = useRoute();

  const [activeTab, setActiveTab] = useState<TabKey>('pending');
  const [selectedUnit, setSelectedUnit] = useState<string | null>(null);
  const [tabData, setTabData] = useState<Record<TabKey, TabState>>({
    pending: { ...initialTabState },
    approved: { ...initialTabState },
  });

  // Used to ignore responses from outdated requests (e.g. user switches unit quickly)
  const requestIds = useRef<Record<TabKey, number>>({
    pending: 0,
    approved: 0,
  });

  const { customerID } = useCustomer();

  const updateTab = useCallback((tab: TabKey, patch: Partial<TabState>) => {
    setTabData(prev => ({ ...prev, [tab]: { ...prev[tab], ...patch } }));
  }, []);

  const fetchOrders = useCallback(
    async (tab: TabKey, pageNum = 1, refresh = false) => {
      const reqId = ++requestIds.current[tab];
      const isStale = () => reqId !== requestIds.current[tab];

      try {
        if (!customerID) {
          updateTab(tab, {
            error: 'Customer ID not found. Please login again.',
            isLoading: false,
          });
          return;
        }

        if (refresh) {
          updateTab(tab, { page: 1 });
        } else if (pageNum > 1) {
          updateTab(tab, { isLoadingMore: true });
        }
        updateTab(tab, { error: null });

        // Only send unitName when a specific unit is selected
        const unitParam = selectedUnit ? { unitName: selectedUnit } : {};

        let response;
        if (tab === 'pending') {
          response = await axios.get(`${API_ENDPOINTS.GET_PENDING_ORDERS}`, {
            params: {
              customerId: customerID,
              page: pageNum,
              limit: 10,
              ...unitParam,
            },
          });
        } else {
          const today = new Date();
          const from = new Date();
          from.setDate(today.getDate() - APPROVED_LOOKBACK_DAYS);

          // GET /order/getPendingOrderswithstatus
          response = await axios.get(`${API_ENDPOINTS.GET_APPROVED_ORDERS}`, {
            params: {
              customer_id: customerID,
              fromDate: toYMD(from),
              toDate: toYMD(today),
              page: pageNum,
              limit: 10,
              ...unitParam,
            },
          });
        }

        if (isStale()) return;

        const result: PendingOrderResponse = response.data;

        if (result.success) {
          const normalizedOrders = (result.data?.orders || []).map(order => ({
            ...order,
            orderDate: normalizeDate(order.orderDate),
            deliveryDate: normalizeDate(order.deliveryDate),
          }));

          setTabData(prev => {
            const currentTab = prev[tab];
            const nextOrders =
              refresh || pageNum === 1
                ? normalizedOrders
                : [...currentTab.orders, ...normalizedOrders];
            return {
              ...prev,
              [tab]: {
                ...currentTab,
                orders: nextOrders,
                totalPages: result.data?.pagination?.totalPages ?? 1,
                page: result.data?.pagination?.page ?? pageNum,
              },
            };
          });
        } else {
          updateTab(tab, { error: result.message });
        }
      } catch (err: any) {
        if (isStale()) return;
        console.error(`Error fetching ${tab} orders:`, err);
        updateTab(tab, {
          error: err.message || 'Failed to load orders',
        });

        // Mock data fallback kept only for the pending tab (as before)
        if (tab === 'pending' && pageNum === 1) {
          updateTab(tab, { orders: generateMockData(), totalPages: 3 });
        }
      } finally {
        if (!isStale()) {
          updateTab(tab, {
            isLoading: false,
            refreshing: false,
            isLoadingMore: false,
          });
        }
      }
    },
    [customerID, selectedUnit, updateTab],
  );

  // Runs when the screen is focused AND whenever the active tab or unit changes
  useFocusEffect(
    useCallback(() => {
      updateTab(activeTab, { isLoading: true });
      fetchOrders(activeTab, 1, true);
    }, [activeTab, fetchOrders, updateTab]),
  );

  const current = tabData[activeTab];

  const handleSelectUnit = (unit: string | null) => {
    if (unit === selectedUnit) return;
    // Clear the list so old unit's orders are never shown under the new unit
    setTabData({
      pending: { ...initialTabState },
      approved: { ...initialTabState },
    });
    setSelectedUnit(unit);
  };

  const onRefresh = () => {
    updateTab(activeTab, { refreshing: true });
    fetchOrders(activeTab, 1, true);
  };

  const loadMoreOrders = () => {
    if (!current.isLoadingMore && current.page < current.totalPages) {
      fetchOrders(activeTab, current.page + 1);
    }
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

  const handleViewDetails = (order: PendingOrder) => {
    navigation.navigate('OrderDetailsScreen' as any, {
      order,
      unitName: order.unitName,
      isApproved: activeTab === 'approved',
    });
  };

  const renderOrderCard = ({ item }: { item: PendingOrder }) => (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <View style={styles.cardHeaderLeft}>
          <Text style={styles.orderNo}>Order No: {item.orderNo}</Text>
          <Text style={styles.totalItems}>Items: {item.totalItems}</Text>
        </View>
        {!!item.unitName && (
          <View style={styles.unitBadge}>
            <MaterialIcons name="warehouse" size={12} color="#0284c7" />
            <Text style={styles.unitBadgeText}>{item.unitName}</Text>
          </View>
        )}
      </View>

      <View style={styles.dateContainer}>
        <View style={styles.dateBox}>
          <Text style={styles.dateLabel}>Order Date</Text>
          <Text style={styles.dateValue}>{formatDate(item.orderDate)}</Text>
        </View>
        <View style={styles.dateDivider} />
        <View style={styles.dateBox}>
          <Text style={styles.dateLabel}>Delivery Date</Text>
          <Text style={styles.dateValue}>{formatDate(item.deliveryDate)}</Text>
        </View>
      </View>

      <View style={styles.bottomRow}>
        <Text style={styles.transporterValue} numberOfLines={1}>
          {item.transporterName || 'No transporter'}
        </Text>
        <TouchableOpacity
          style={styles.viewDetails}
          onPress={() => handleViewDetails(item)}
        >
          <Text style={styles.viewDetailsText}>View Details</Text>
          <MaterialIcons name="chevron-right" size={16} color="#0284c7" />
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderFooter = () => {
    if (!current.isLoadingMore) return null;
    return (
      <View style={styles.footerLoader}>
        <ActivityIndicator size="small" color="#0284C7" />
        <Text style={styles.loadingMoreText}>Loading more orders...</Text>
      </View>
    );
  };

  const renderTabs = () => (
    <View style={styles.tabBar}>
      {TABS.map(tab => {
        const isActive = tab.key === activeTab;
        return (
          <TouchableOpacity
            key={tab.key}
            style={[styles.tabButton, isActive && styles.tabButtonActive]}
            onPress={() => setActiveTab(tab.key)}
            activeOpacity={0.7}
          >
            <Text style={[styles.tabText, isActive && styles.tabTextActive]}>
              {tab.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );

  // Horizontal unit chips, shared by both tabs
  const renderUnitFilter = () => (
    <View style={styles.filterBar}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filterContent}
      >
        {UNITS.map(unit => {
          const isActive = unit.value === selectedUnit;
          return (
            <TouchableOpacity
              key={unit.label}
              style={[styles.chip, isActive && styles.chipActive]}
              onPress={() => handleSelectUnit(unit.value)}
              activeOpacity={0.7}
            >
              {isActive && (
                <MaterialIcons
                  name="check"
                  size={14}
                  color="#ffffff"
                  style={styles.chipIcon}
                />
              )}
              <Text
                style={[styles.chipText, isActive && styles.chipTextActive]}
              >
                {unit.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );

  const renderContent = () => {
    if (current.isLoading && current.orders.length === 0) {
      return (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#0284C7" />
        </View>
      );
    }

    if (current.error && current.orders.length === 0) {
      return (
        <View style={styles.centered}>
          <Text style={styles.errorText}>{current.error}</Text>
          <TouchableOpacity
            style={styles.retryButton}
            onPress={() => {
              updateTab(activeTab, { isLoading: true });
              fetchOrders(activeTab, 1, true);
            }}
          >
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      );
    }

    const visibleOrders = current.orders.filter(order => order.totalItems > 0);

    return (
      <FlatList
        data={visibleOrders}
        keyExtractor={item => `${activeTab}-order-${item.orderId}`}
        renderItem={renderOrderCard}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl
            refreshing={current.refreshing}
            onRefresh={onRefresh}
          />
        }
        onEndReached={loadMoreOrders}
        onEndReachedThreshold={0.3}
        ListFooterComponent={renderFooter}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          visibleOrders.length > 0 ? (
            <Text style={styles.resultsText}>
              Showing {visibleOrders.length} order
              {visibleOrders.length === 1 ? '' : 's'}
              {selectedUnit ? ` in ${selectedUnit}` : ' in all units'}
            </Text>
          ) : null
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <MaterialIcons name="history" size={64} color="#d1d5db" />
            <Text style={styles.emptyText}>
              {activeTab === 'pending'
                ? 'No orders pending for approval'
                : 'No approved orders found'}
              {selectedUnit ? `\nfor unit ${selectedUnit}` : ''}
            </Text>
            {selectedUnit && (
              <TouchableOpacity
                style={styles.clearFilterButton}
                onPress={() => handleSelectUnit(null)}
              >
                <Text style={styles.clearFilterText}>Show all units</Text>
              </TouchableOpacity>
            )}
          </View>
        }
      />
    );
  };

  return (
    <LayoutWrapper showHeader={true} showTabBar={false} route={route}>
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="dark-content" backgroundColor="#f3f4f6" />
        {renderTabs()}
        {renderUnitFilter()}
        {renderContent()}
      </SafeAreaView>
    </LayoutWrapper>
  );
};

// Mock data generation function for demonstration
const generateMockData = (): PendingOrder[] => {
  const mockOrders: PendingOrder[] = [];
  for (let i = 1; i <= 5; i++) {
    const orderDate = new Date();
    orderDate.setDate(orderDate.getDate() - i * 3);

    const deliveryDate = new Date(orderDate);
    deliveryDate.setDate(deliveryDate.getDate() + 2);

    const totalItems = Math.floor(Math.random() * 5) + 1;
    const items: PendingOrder['items'] = [];

    for (let j = 1; j <= totalItems; j++) {
      items.push({
        detailId: j,
        itemId: j * 100,
        itemName: `Item ${j}`,
        lotNo: `LOT${j}${i}`,
        itemMarks: `MARK-${j}${i}`,
        vakalNo: `VAK-${j}${i}`,
        requestedQty: Math.floor(Math.random() * 50) + 10,
        QUANTITY: Math.floor(Math.random() * 100) + 20,
        AVAILABLE_QTY: Math.floor(Math.random() * 100) + 20,
        status: 'NEW',
        unitName: '',
      });
    }

    mockOrders.push({
      orderId: i,
      orderNo: `ORD-${2026}${i.toString().padStart(4, '0')}`,
      orderDate: toYMD(orderDate),
      deliveryDate: toYMD(deliveryDate),
      status: 'NEW',
      transporterName: `Transporter ${i}`,
      remarks: `Remarks for order ${i}`,
      deliveryAddress: `123 Delivery St, Building ${i}, City`,
      customerName: 'John Doe',
      totalItems,
      totalQuantity: items.reduce((sum, item) => sum + item.requestedQty, 0),
      items,
      unitName: '',
    });
  }
  return mockOrders;
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9fafb',
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  tabButton: {
    flex: 1,
    paddingVertical: 14,
    alignItems: 'center',
    borderBottomWidth: 3,
    borderBottomColor: 'transparent',
  },
  tabButtonActive: {
    borderBottomColor: '#F48221',
  },
  tabText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#6B7280',
  },
  tabTextActive: {
    color: '#F48221',
    fontWeight: '600',
  },
  // Unit filter chips
  filterBar: {
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  filterContent: {
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: '#f3f4f6',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    marginRight: 8,
  },
  chipActive: {
    backgroundColor: '#F48221',
    borderColor: '#F48221',
  },
  chipIcon: {
    marginRight: 4,
  },
  chipText: {
    fontSize: 13,
    fontWeight: '500',
    color: '#4B5563',
  },
  chipTextActive: {
    color: '#ffffff',
    fontWeight: '600',
  },
  resultsText: {
    fontSize: 13,
    color: '#6B7280',
    marginBottom: 12,
  },
  list: {
    padding: 16,
    paddingBottom: 50,
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    marginBottom: 16,
    padding: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  cardHeaderLeft: {
    flex: 1,
    marginRight: 8,
  },
  unitBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#e0f2fe',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  unitBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#0284c7',
    marginLeft: 4,
  },
  orderNo: {
    fontSize: 16,
    fontWeight: '600',
    color: '#F48221',
  },
  totalItems: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 4,
  },
  dateContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
    backgroundColor: '#f9fafb',
    padding: 12,
    borderRadius: 8,
  },
  dateBox: {
    flex: 1,
  },
  dateLabel: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 2,
  },
  dateValue: {
    fontSize: 15,
    color: '#111827',
    fontWeight: '500',
  },
  dateDivider: {
    width: 1,
    backgroundColor: '#E5E7EB',
    marginHorizontal: 16,
  },
  bottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 4,
  },
  transporterValue: {
    fontSize: 14,
    color: '#4B5563',
    flex: 1,
  },
  viewDetails: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  viewDetailsText: {
    fontSize: 14,
    color: '#0284c7',
    fontWeight: '500',
    marginRight: 4,
  },
  footerLoader: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
    paddingBottom: 34,
    marginBottom: 17,
  },
  loadingMoreText: {
    marginLeft: 8,
    fontSize: 14,
    color: '#6B7280',
  },
  errorText: {
    fontSize: 16,
    color: '#EF4444',
    textAlign: 'center',
    padding: 16,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  emptyText: {
    fontSize: 16,
    color: '#6B7280',
    marginTop: 16,
    textAlign: 'center',
  },
  clearFilterButton: {
    marginTop: 16,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#F48221',
  },
  clearFilterText: {
    color: '#F48221',
    fontWeight: '600',
    fontSize: 14,
  },
  retryButton: {
    marginTop: 16,
    paddingHorizontal: 24,
    paddingVertical: 12,
    backgroundColor: '#0284C7',
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#fff',
    fontWeight: '500',
    fontSize: 16,
  },
});

export default PendingOrdersScreen;
