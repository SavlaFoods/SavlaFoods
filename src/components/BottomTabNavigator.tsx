import React, { createContext, useContext, useState, useMemo } from 'react';
import { StyleSheet, View, TouchableOpacity, Text } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import {
  useNavigation,
  CommonActions,
  useRoute,
} from '@react-navigation/native';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import FontAwesome from 'react-native-vector-icons/FontAwesome';
import { ParamListBase } from '@react-navigation/native';

// Import your screens
import HomeScreen from '../screens/HomeScreen';
import AlertScreen from '../screens/AlertScreen';
import OrdersScreen from '../screens/OrdersScreen';
import OrderHistoryScreen from '../screens/OrderHistoryScreen';
import InwardOutwardReportScreen from '../screens/InwardOutwardReportScreen';
import { CustomerProvider } from '../contexts/DisplayNameContext';
import PendingOrdersScreen from '../screens/PendingOrdersScreen';

import StockReportScreen from '../screens/stocks/StockReportScreen';
import LotReportScreen from '../screens/LotReportScreen';
import ReportSummaryScreen from '../screens/stocks/ReportSummaryScreen';
import EditOrderScreen from './EditOrderScreen';
import OrderDetailsScreen from '../screens/OrderDetailsScreen';
import { LayoutWrapper } from './AppLayout';
import ReportsScreen from '../screens/stocks/ReportsScreen';
import { useAuthorization } from '../contexts/AuthorizationContext';

// Import new Finance/Billing screens
import InvoiceScreen from '../screens/Invoice/InvoiceScreen';
import InvoiceReportScreen from '../screens/Invoice/InvoiceReportScreen';
import InvoiceDetailsScreen from '../screens/Invoice/InvoiceDetailsScreen';
import InvoiceList from '../screens/Invoice/InvoiceListScreen';
import InvoiceListScreen from '../screens/Invoice/InvoiceListScreen';

// import OutstandingReportScreen from '../screens/Invoice/OutstandingReportScreen';

interface OrderItem {
  detailId?: number;
  itemId?: number;
  itemName: string;
  lotNo: string | number;
  itemMarks: string;
  vakalNo: string;
  requestedQty: number;
  availableQty: number;
  status: string;
  unitName?: string;
  netQuantity?: number;
  batchNo?: string | null;
  supervisorName?: string | null;
  mukadamName?: string | null;
}

interface Order {
  orderId: number;
  orderNo: string;
  orderDate: string;
  deliveryDate: string;
  status: string;
  transporterName: string;
  remarks: string | null;
  deliveryAddress: string | null;
  createdOn?: string;
  customerName: string;
  customerMobile?: number;
  customerEmail?: string | null;
  totalItems: number;
  totalQuantity: number;
  items: OrderItem[];
}

type OrdersStackParamList = {
  OrdersHome: undefined;
  OrderDetails: { order: Order };
  OrderDetailsScreen: {
    order: Order;
    onGoBack?: (updatedOrder: Order) => void;
  };
  EditOrderScreen: { order: Order };
  OrderHistory: undefined;
  PendingOrders: undefined;
};

type FinanceStackParamList = {
  InvoiceHome: undefined;

  InvoiceReportScreen: undefined;
  InvoiceList: undefined;
  InvoiceDetailsScreen: { invoiceNo: string };
};

type TabParamList = {
  Home: undefined;
  Announcement: undefined;
  Alert: undefined;
  Search: {
    customerID?: string;
  };
  Orders: {
    screen: keyof OrdersStackParamList;
    params?: any;
  };
  OrderHistory: undefined;
  PendingOrders: undefined;
  Invoice: {
    screen: keyof FinanceStackParamList;
    params?: any;
  };
  OrderDetails: { order: Order };
  EditOrderScreen: { order: Order };
} & ParamListBase;

// Create Stack Navigator for Orders section
const OrdersStack = createNativeStackNavigator<OrdersStackParamList>();

type ReportsStackParamList = {
  Reports: undefined;
  StockReportScreen: undefined;
  LotReport: undefined;
  InwardOutwardReport: undefined;
  ReportSummary: undefined;
};

const ReportsStack = createNativeStackNavigator<ReportsStackParamList>();
const InvoiceStack = createNativeStackNavigator<FinanceStackParamList>();

export const OrdersStackNavigator = () => {
  return (
    <OrdersStack.Navigator
      screenOptions={{
        headerStyle: {
          // backgroundColor: '#F48221',
          backgroundColor: '#fff',
        },
        headerTintColor: '#0284c7',
      }}
    >
      <OrdersStack.Screen
        name="OrdersHome" // Renamed to avoid duplicate name
        component={OrdersScreen}
        options={{ headerShown: false }}
      />
      <OrdersStack.Screen
        name="OrderDetails" // Make sure this screen is registered
        component={OrderDetailsScreen as unknown as React.ComponentType<any>}
        options={{ headerShown: false }}
      />
      <OrdersStack.Screen
        name="EditOrderScreen"
        component={EditOrderScreen as unknown as React.ComponentType<any>}
        options={{ headerShown: false }}
      />

      <OrdersStack.Screen
        name="OrderHistory"
        component={OrderHistoryScreen}
        options={{ headerShown: false }}
      />

      <OrdersStack.Screen
        name="PendingOrders"
        component={PendingOrdersScreen}
        options={{ headerShown: false }}
      />
    </OrdersStack.Navigator>
  );
};
export const FinanceStackNavigator = () => {
  return (
    <InvoiceStack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: '#fff' },
        headerTintColor: '#F48221',
      }}
    >
      {/* This is the new list screen - first screen when tapping Invoice tab */}
      <InvoiceStack.Screen
        name="InvoiceHome"
        component={InvoiceListScreen}
        options={{ headerShown: false }}
      />

      {/* Your EXISTING InvoiceScreen - now accessed via "Invoice Report" */}
      <InvoiceStack.Screen
        name="InvoiceReportScreen"
        component={InvoiceScreen} // ← Your original InvoiceScreen stays here
        options={{ headerShown: false }}
      />

      {/* Outstanding Report
      <InvoiceStack.Screen
        name="OutstandingReportScreen"
        component={OutstandingReportScreen}
        options={{headerShown: false}}
      /> */}

      <InvoiceStack.Screen
        name="InvoiceDetailsScreen"
        component={InvoiceDetailsScreen}
        options={{ headerShown: false }}
      />
    </InvoiceStack.Navigator>
  );
};

export const ReportsStackNavigator = () => {
  return (
    <ReportsStack.Navigator
      screenOptions={{
        headerStyle: {
          backgroundColor: '#fff',
        },
        headerTintColor: '#F48221',
      }}
    >
      <ReportsStack.Screen
        name="Reports"
        component={ReportsScreen}
        options={{ headerShown: false }}
      />

      <ReportsStack.Screen
        name="StockReportScreen"
        component={StockReportScreen}
        options={{ headerShown: false }}
      />
      <ReportsStack.Screen
        name="LotReport"
        component={LotReportScreen}
        options={{ headerShown: false }}
      />

      <ReportsStack.Screen
        name="InwardOutwardReport"
        component={InwardOutwardReportScreen}
        options={{ headerShown: false }}
      />
      <ReportsStack.Screen
        name="ReportSummary"
        component={ReportSummaryScreen}
        options={{ headerShown: false }}
      />
    </ReportsStack.Navigator>
  );
};

interface OrderContextType {
  orderDetails: any;
  setOrderDetails: (details: any) => void;
}

export const OrderContext = createContext<OrderContextType>({
  orderDetails: null,
  setOrderDetails: () => {},
});

const Tab = createBottomTabNavigator<TabParamList>();

interface NavigationHistoryContextType {
  history: string[];
  addToHistory: (route: string) => void;
  getPreviousRoute: () => string | null;
}

// Create a context to manage navigation history
export const NavigationHistoryContext =
  createContext<NavigationHistoryContextType>({
    history: [],
    addToHistory: () => {},
    getPreviousRoute: () => null,
  });

export const NavigationHistoryProvider: React.FC<{
  children: React.ReactNode;
}> = ({ children }) => {
  const [history, setHistory] = useState<string[]>([]);

  const addToHistory = (route: string) => {
    setHistory(prev => [...prev, route]);
  };

  const getPreviousRoute = () => {
    if (history.length < 2) return null;
    return history[history.length - 2];
  };

  return (
    <NavigationHistoryContext.Provider
      value={{ history, addToHistory, getPreviousRoute }}
    >
      {children}
    </NavigationHistoryContext.Provider>
  );
};

export const TabBar = (props: any) => {
  const navigation = useNavigation<any>();
  const { getPreviousRoute, addToHistory } = useContext(
    NavigationHistoryContext,
  );
  const { hasModuleAccess, userAuthorization } = useAuthorization();

  // Define all possible tabs with their module IDs
  const allTabs = [
    {
      name: 'Home',
      icon: (isActive: boolean) =>
        isActive ? (
          <MaterialIcons name="home" size={24} color="#F48221" />
        ) : (
          <MaterialCommunityIcons name="home-outline" size={24} color="black" />
        ),
      label: 'Home',
      moduleIds: [1, 4],
    },
    {
      name: 'Invoice',
      icon: (isActive: boolean) => (
        <MaterialIcons
          name="account-balance-wallet"
          size={24}
          color={isActive ? '#F48221' : 'black'}
        />
      ),
      label: 'Invoice',
      moduleIds: [2],
    },
    {
      name: 'Orders',
      icon: (isActive: boolean) => (
        <FontAwesome
          name="list-alt"
          size={24}
          color={isActive ? '#F48221' : 'black'}
        />
      ),
      label: 'Orders',
      moduleIds: [1],
    },
    {
      name: 'Reports',
      icon: (isActive: boolean) =>
        isActive ? (
          <MaterialIcons name="assessment" size={24} color="#F48221" />
        ) : (
          <MaterialCommunityIcons
            name="chart-box-outline"
            size={24}
            color="black"
          />
        ),
      label: 'Reports',
      moduleIds: [5],
    },
    {
      name: 'Alert',
      icon: (isActive: boolean) =>
        isActive ? (
          <MaterialIcons name="notifications" size={24} color="#F48221" />
        ) : (
          <MaterialIcons name="notifications-none" size={24} color="black" />
        ),
      label: 'Alerts',
      moduleIds: [1, 4],
    },
  ];

  // Filter tabs based on user authorization
  const authorizedTabs = useMemo(() => {
    // First check if user has any module access
    const tabsWithModuleAccess = allTabs.filter(tab =>
      tab.moduleIds.some(id => hasModuleAccess(id)),
    );

    // If user has module access, return those tabs
    if (tabsWithModuleAccess.length > 0) {
      return tabsWithModuleAccess;
    }

    // If no module access, check if user has HomeScreen-only access (for comma RAR case)
    if (
      userAuthorization &&
      userAuthorization.allowedScreens.includes('HomeScreen')
    ) {
      // Return only Home tab for HomeScreen-only users
      return allTabs.filter(tab => tab.name === 'Home');
    }

    return [];
  }, [allTabs, hasModuleAccess, userAuthorization]);

  // Create tabs array for rendering
  const tabs = authorizedTabs.map(tab => ({
    name: tab.name,
    icon: tab.icon(props.route?.name === tab.name),
    label: tab.label,
  }));

  // Enhanced tab press handler with route history
  const onTabPress = (routeName: string) => {
    if (routeName === props.route?.name) {
      return;
    }

    // Add current route to history before navigating
    if (props.route?.name) {
      addToHistory(props.route.name);
    }

    // Only allow navigation to authorized tabs
    if (authorizedTabs.some(tab => tab.name === routeName)) {
      const currentParams = props.route?.params;
      const navigationParams = {
        screen: routeName,
        params: {
          previousRoute: props.route?.name,
          customerID: currentParams?.customerID,
          shouldRefresh: true,
        },
      };

      navigation.navigate('BottomTabNavigator', navigationParams);
    } else if (
      props.customTabNavigation &&
      props.customTabNavigation[routeName]
    ) {
      props.customTabNavigation[routeName]();
    } else {
      navigation.navigate(routeName);
    }
  };

  // Handle back navigation
  const handleBack = () => {
    const previousRoute = getPreviousRoute();
    if (previousRoute) {
      navigation.navigate(previousRoute);
    }
  };

  return (
    <View style={styles.tabBar}>
      {getPreviousRoute() && (
        <TouchableOpacity style={styles.backButton} onPress={handleBack}>
          <MaterialIcons name="arrow-back" size={24} color="black" />
        </TouchableOpacity>
      )}

      {tabs.map(tab => (
        <TouchableOpacity
          key={tab.name}
          style={styles.tabItem}
          onPress={() => onTabPress(tab.name)}
        >
          {tab.icon}
          <Text
            style={[
              styles.tabLabel,
              { color: props.route?.name === tab.name ? '#F48221' : 'black' },
            ]}
          >
            {tab.label}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );
};

const BottomTabNavigator: React.FC = () => {
  const { hasModuleAccess } = useAuthorization();

  const getTabBarIcon = (
    route: any,
    focused: boolean,
    color: string,
    size: number,
  ) => {
    switch (route.name) {
      case 'Home':
        return focused ? (
          <MaterialIcons name="home" size={size} color={color} />
        ) : (
          <MaterialCommunityIcons
            name="home-outline"
            size={size}
            color={color}
          />
        );
      case 'Orders':
        return focused ? (
          <FontAwesome name="list-alt" size={size} color={color} />
        ) : (
          <FontAwesome name="list-alt" size={size} color={color} />
        );
      case 'Invoice':
        return focused ? (
          <MaterialIcons
            name="account-balance-wallet"
            size={size}
            color={color}
          />
        ) : (
          <MaterialIcons
            name="account-balance-wallet"
            size={size}
            color={color}
          />
        );
      case 'Reports':
        return focused ? (
          <MaterialIcons name="assessment" size={size} color={color} />
        ) : (
          <MaterialCommunityIcons
            name="chart-box-outline"
            size={size}
            color={color}
          />
        );
      case 'Alert':
        return focused ? (
          <MaterialIcons name="notifications" size={size} color={color} />
        ) : (
          <MaterialIcons name="notifications-none" size={size} color={color} />
        );

      default:
        return <MaterialIcons name="circle" size={size} color={color} />;
    }
  };

  return (
    <CustomerProvider>
      <NavigationHistoryProvider>
        <Tab.Navigator
          screenOptions={({ route }) => ({
            tabBarIcon: ({ focused, color, size }) =>
              getTabBarIcon(route, focused, color, size),

            tabBarLabelStyle: {
              fontSize: 13,
              marginBottom: 4,
            },

            tabBarActiveTintColor: '#F48221',
            tabBarInactiveTintColor: 'black',

            tabBarStyle: {
              backgroundColor: '#fff',
              height: 65,
              paddingBottom: 10,
              paddingTop: 6,
              borderTopWidth: 0,
              elevation: 10,
            },

            headerShown: false,
          })}
        >
          <Tab.Screen name="Home" component={HomeScreen} />
          {/* <Tab.Screen
            name="Search"
            component={SearchScreen}
            options={{
              headerShown: false,
            }}
          /> */}
          {hasModuleAccess(2) && (
            <Tab.Screen name="Invoice" component={FinanceStackNavigator} />
          )}
          {hasModuleAccess(1) && (
            <Tab.Screen name="Orders" component={OrdersStackNavigator} />
          )}
          {hasModuleAccess(5) && (
            <Tab.Screen
              name="Reports"
              component={ReportsStackNavigator}
              options={{ title: 'Reports' }}
            />
          )}
          <Tab.Screen name="Alert" component={AlertScreen} />
        </Tab.Navigator>
      </NavigationHistoryProvider>
    </CustomerProvider>
  );
};

const styles = StyleSheet.create({
  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderTopColor: '#ddd',
    borderTopWidth: 1,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: -2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },

  tabItem: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 8,
  },
  tabLabel: {
    fontSize: 13,
    marginTop: 2,
  },
  backButton: {
    position: 'absolute',
    left: 8,
    top: 8,
    zIndex: 1,
  },
});

export default BottomTabNavigator;
