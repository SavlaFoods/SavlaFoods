// PaymentComponent.tsx
import React, {useState, useEffect} from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Alert,
  StyleSheet,
  Platform,
  Modal,
  TextInput,
  ScrollView,
} from 'react-native';
import Razorpay from 'react-native-razorpay';

interface PaymentComponentProps {
  totalAmount: number;
  customerName?: string;
  onSuccess?: (paymentId: string) => void;
  onFailure?: (error: string) => void;
}

type TDSPercent = 2 | 5 | 10;

const PaymentComponent: React.FC<PaymentComponentProps> = ({
  totalAmount,
  customerName = 'Customer',
  onSuccess,
  onFailure,
}) => {
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedTDS, setSelectedTDS] = useState<TDSPercent>(2);
  const [customTDSAmount, setCustomTDSAmount] = useState('');

  /** 🔹 Auto-calculate & set Custom TDS when % changes */
  useEffect(() => {
    const tds = (totalAmount * selectedTDS) / 100;
    setCustomTDSAmount(tds.toFixed(2));
  }, [selectedTDS, totalAmount]);

  const calculatePaymentDetails = () => {
    const calculatedTDS = (totalAmount * selectedTDS) / 100;

    const tdsAmount =
      customTDSAmount !== '' ? parseFloat(customTDSAmount) : calculatedTDS;

    const transferAmount = totalAmount - tdsAmount;

    // 🔹 Transfer Charge (2%)
    const transferCharge = transferAmount * 0.02;

    // 🔹 GST on Transfer Charge (18%)
    const gstOnTransferCharge = transferCharge * 0.18;

    const totalTransaction =
      transferAmount + transferCharge + gstOnTransferCharge;

    return {
      calculatedTDS,
      tdsAmount,
      transferAmount,
      transferCharge,
      gstOnTransferCharge,
      totalTransaction,
    };
  };

  const formatCurrency = (amount: number): string =>
    amount.toLocaleString('en-IN', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });

  const handlePayNow = () => {
    const paymentDetails = calculatePaymentDetails();

    if (
      paymentDetails.tdsAmount < 0 ||
      paymentDetails.tdsAmount > totalAmount
    ) {
      Alert.alert('Error', 'Invalid TDS amount');
      return;
    }

    const options = {
      description: 'Payment for Due Invoices',
      currency: 'INR',
      key: 'rzp_test_RF1SJeA9BG7ySv',
      amount: Math.round(paymentDetails.totalTransaction * 100).toString(),
      name: 'Your App Name',
      prefill: {
        name: customerName,
        email: 'customer@example.com',
        contact: '9999999999',
      },
      theme: {color: '#3498db'},
      notes: {
        invoice_amount: totalAmount.toString(),
        tds_percentage: selectedTDS.toString(),
        tds_amount: paymentDetails.tdsAmount.toString(),
      },
    };

    Razorpay.open(options)
      .then((data: {razorpay_payment_id: string}) => {
        setModalVisible(false);
        onSuccess?.(data.razorpay_payment_id);
      })
      .catch((error: any) => {
        const errorMessage =
          error?.description ||
          error?.error?.description ||
          error?.message ||
          'Payment failed';
        onFailure?.(errorMessage);
      });
  };

  const paymentDetails = calculatePaymentDetails();

  return (
    <View style={styles.container}>
      {/* <TouchableOpacity
        style={styles.paymentButton}
        onPress={() => setModalVisible(true)}>
        <Text style={styles.paymentButtonText}>Make Payment</Text>
      </TouchableOpacity> */}

      <Modal transparent visible={modalVisible} animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            {/* Modal Header with Cancel Icon */}
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Payment Details</Text>
              <TouchableOpacity
                onPress={() => setModalVisible(false)}
                style={styles.closeButton}>
                <Text style={styles.closeButtonText}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView>
              {/* Invoice Amount */}
              <View style={styles.amountCard}>
                <Text style={styles.amountLabel}>Invoice Amount</Text>
                <Text style={styles.amountValue}>
                  ₹{formatCurrency(totalAmount)}
                </Text>
              </View>

              {/* 🔹 TDS Selection (UI SAME, added 5%) */}
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Deduct TDS</Text>
                <View style={styles.tdsOptions}>
                  {[2, 10].map(p => (
                    <TouchableOpacity
                      key={p}
                      style={[
                        styles.tdsOption,
                        selectedTDS === p && styles.tdsOptionSelected,
                      ]}
                      onPress={() => setSelectedTDS(p as TDSPercent)}>
                      <Text
                        style={[
                          styles.tdsOptionText,
                          selectedTDS === p && styles.tdsOptionTextSelected,
                        ]}>
                        TDS {p}%
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* TDS Amount */}
              <View style={styles.section}>
                {/* <View style={styles.rowBetween}>
                  <Text style={styles.label}>TDS Amount ({selectedTDS}%)</Text>
                  <Text style={styles.calculatedValue}>
                    ₹{formatCurrency(paymentDetails.calculatedTDS)}
                  </Text>
                </View> */}

                <View style={styles.inputContainer}>
                  <Text style={styles.inputLabel}>
                    Custom TDS Amount (Editable)
                  </Text>
                  <TextInput
                    style={styles.input}
                    keyboardType="numeric"
                    value={customTDSAmount}
                    onChangeText={setCustomTDSAmount}
                  />
                </View>
              </View>

              {/* Payment Breakdown */}
              <View style={styles.breakdownCard}>
                {/* TDS */}
                <View style={styles.breakdownRow}>
                  <Text style={styles.breakdownLabel}>
                    TDS Deducted ({selectedTDS}%)
                  </Text>
                  <Text style={styles.breakdownValue}>
                    - ₹{formatCurrency(paymentDetails.tdsAmount)}
                  </Text>
                </View>

                <View style={styles.divider} />

                {/* Transfer Amount */}
                <View style={styles.breakdownRow}>
                  <Text style={styles.breakdownLabel}>Transfer Amount</Text>
                  <Text style={styles.breakdownValue}>
                    ₹{formatCurrency(paymentDetails.transferAmount)}
                  </Text>
                </View>

                {/* Transfer Charges */}
                <View style={styles.breakdownRow}>
                  <Text style={styles.breakdownLabel}>
                    Transfer Charge (2%)
                  </Text>
                  <Text style={styles.breakdownValue}>
                    ₹{formatCurrency(paymentDetails.transferCharge)}
                  </Text>
                </View>

                {/* GST */}
                <View style={styles.breakdownRow}>
                  <Text style={styles.breakdownLabel}>
                    GST on Transfer Charge (18%)
                  </Text>
                  <Text style={styles.breakdownValue}>
                    ₹{formatCurrency(paymentDetails.gstOnTransferCharge)}
                  </Text>
                </View>

                <View style={styles.divider} />

                {/* Total */}
                <View style={styles.breakdownRow}>
                  <Text style={styles.totalLabel}>Total Payable Amount</Text>
                  <Text style={styles.totalValue}>
                    ₹{formatCurrency(paymentDetails.totalTransaction)}
                  </Text>
                </View>
              </View>

              <TouchableOpacity
                style={styles.payNowButton}
                onPress={handlePayNow}>
                <Text style={styles.payNowButtonText}>
                  Pay Now ₹{formatCurrency(paymentDetails.totalTransaction)}
                </Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {marginRight: 10},
  paymentButton: {
    backgroundColor: '#3498db',
    paddingHorizontal: 16,
    paddingVertical: 12,
    width: '50%',
    borderRadius: 6,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: {width: 0, height: 2},
        shadowOpacity: 0.1,
        shadowRadius: 4,
      },
      android: {elevation: 3},
    }),
  },
  paymentButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '90%',
    paddingBottom: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  modalTitle: {fontSize: 20, fontWeight: 'bold', color: '#333'},
  closeButton: {
    width: 30,
    height: 30,
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeButtonText: {fontSize: 24, color: '#666'},
  amountCard: {
    backgroundColor: '#f8f9fa',
    padding: 20,
    margin: 20,
    borderRadius: 12,
    alignItems: 'center',
  },
  amountLabel: {fontSize: 14, color: '#666', marginBottom: 8},
  amountValue: {fontSize: 32, fontWeight: 'bold', color: '#333'},
  section: {paddingHorizontal: 20, marginBottom: 20},
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  tdsOptions: {flexDirection: 'row', gap: 10},
  tdsOption: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#e0e0e0',
    backgroundColor: '#fff',
    alignItems: 'center',
  },
  tdsOptionSelected: {borderColor: '#3498db', backgroundColor: '#3498db'},
  tdsOptionText: {fontSize: 16, fontWeight: '600', color: '#333'},
  tdsOptionTextSelected: {color: '#fff'},
  rowBetween: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  label: {fontSize: 14, color: '#666'},
  calculatedValue: {fontSize: 14, fontWeight: '600', color: '#333'},
  inputContainer: {marginTop: 8},
  inputLabel: {fontSize: 12, color: '#666', marginBottom: 6},
  input: {
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    color: '#333',
  },
  breakdownCard: {
    backgroundColor: '#f8f9fa',
    marginHorizontal: 20,
    marginBottom: 20,
    padding: 16,
    borderRadius: 12,
  },
  breakdownRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
  },
  breakdownLabel: {fontSize: 14, color: '#666'},
  breakdownValue: {fontSize: 14, fontWeight: '600', color: '#333'},
  divider: {height: 1, backgroundColor: '#e0e0e0', marginVertical: 8},
  totalLabel: {fontSize: 16, fontWeight: 'bold', color: '#333'},
  totalValue: {fontSize: 18, fontWeight: 'bold', color: '#3498db'},
  settlementCard: {
    backgroundColor: '#fff3cd',
    marginHorizontal: 20,
    marginBottom: 20,
    padding: 16,
    borderRadius: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#ffc107',
  },
  settlementTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#856404',
    marginBottom: 8,
  },
  settlementRow: {paddingVertical: 4},
  settlementText: {fontSize: 13, color: '#856404'},
  settlementAmount: {fontWeight: 'bold'},
  payNowButton: {
    backgroundColor: '#28a745',
    marginHorizontal: 22,
    paddingVertical: 16,
    borderRadius: 10,
    alignItems: 'center',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: {width: 0, height: 2},
        shadowOpacity: 0.2,
        shadowRadius: 4,
      },
      android: {elevation: 4},
    }),
  },
  payNowButtonText: {color: '#fff', fontSize: 18, fontWeight: 'bold'},
});

export default PaymentComponent;
