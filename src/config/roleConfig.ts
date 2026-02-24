// roleConfig.ts
export const ROLES = {
  CREATE_ORDER: '1',
  ACCOUNT: '2',
  CONFIG: '3',
  STOCK_SEARCH: '4',
  REPORTS: '5',
};

export const roleScreenConfig = {
  [ROLES.CREATE_ORDER]: [
    'HomeScreen',
    'SubCategory',
    'ItemDetailScreen',
    'ItemDetailsExpanded',
    'QuantitySelectorModal',
    'PlaceOrderScreen',
    'OrderConfirmationScreen',
    'PendingOrdersScreen',
    'OrderHistoryScreen',
  ],
  [ROLES.ACCOUNT]: [
    'InvoiceHome',
    'InvoiceReportScreen',
    'InvoiceDetailsScreen',
  ],
  [ROLES.CONFIG]: [], // Pending, as per your instruction
  [ROLES.STOCK_SEARCH]: [
    'HomeScreen',
    'SubCategory',
    'ItemDetailScreen',
    'ItemDetailsExpanded',
  ],
  [ROLES.REPORTS]: [
    'Reports',
    'StockReportScreen',
    'LotReportScreen',
    'InwardOutwardReportScreen',
    'ReportSummaryScreen',
  ],
};

export const roleComponentConfig = {
  [ROLES.CREATE_ORDER]: ['CartButton', 'AddToCartButton', 'QuantitySelector'],
  [ROLES.STOCK_SEARCH]: [], // Stock Search does not include cart-related components
};
