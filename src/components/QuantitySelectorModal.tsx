// import React, { useEffect, useState } from 'react';
// import {
//   View,
//   Text,
//   StyleSheet,
//   Modal,
//   TouchableOpacity,
//   TextInput,
//   Alert,
//   Platform,
//   KeyboardAvoidingView,
// } from 'react-native';
// import Icon from 'react-native-vector-icons/Feather';
// import { useNavigation } from '@react-navigation/native';
// import { NativeStackNavigationProp } from '@react-navigation/native-stack';

// import { useCart } from '../contexts/CartContext';
// import SuccessModal from './SuccessModal'; // Import the new SuccessModal component

// interface QuantitySelectorModalProps {
//   isVisible: boolean;
//   item: {
//     item_id: number;
//     item_name: string;
//     lot_no: string;
//     available_qty: number;
//     unit_name: string;
//     box_quantity: number;
//     quantity: number;
//     customerID?: number | string;
//     vakal_no?: string;
//     item_marks?: string;
//   };
//   onClose: () => void;
// }

// const QuantitySelectorModal: React.FC<QuantitySelectorModalProps> = ({
//   isVisible,
//   item,
//   onClose,
// }) => {
//   const navigation = useNavigation<NativeStackNavigationProp<any>>();
//   const [inputValue, setInputValue] = useState('1');
//   const maxQuantity = item.quantity;
//   const { addToCart } = useCart();
//   const [showSuccessModal, setShowSuccessModal] = useState(false);
//   const [addedQuantity, setAddedQuantity] = useState(0);

//   useEffect(() => {
//     if (isVisible) {
//       // Always start with 1 as the default input value
//       setInputValue('1');
//       setShowSuccessModal(false);
//     }
//   }, [isVisible]);

//   const validateAndUpdateQuantity = (value: string) => {
//     const cleanedValue = value.replace(/[^0-9]/g, '');

//     if (cleanedValue === '' || cleanedValue === '0') {
//       setInputValue('1'); // Don't allow empty or zero values
//       return;
//     }

//     const numValue = parseInt(cleanedValue);

//     if (numValue > maxQuantity) {
//       setInputValue(maxQuantity.toString());
//       Alert.alert(
//         'Invalid Quantity',
//         `Maximum available quantity is ${maxQuantity}`,
//       );
//       return;
//     }

//     setInputValue(cleanedValue);
//   };

//   const incrementQuantity = () => {
//     const currentValue = parseInt(inputValue) || 0;
//     if (currentValue < maxQuantity) {
//       setInputValue((currentValue + 1).toString());
//     }
//   };

//   const decrementQuantity = () => {
//     const currentValue = parseInt(inputValue) || 0;
//     if (currentValue > 1) {
//       setInputValue((currentValue - 1).toString());
//     }
//     // If value is 1 or less, keep it at 1 (minimum value)
//     else {
//       setInputValue('1');
//     }
//   };

//   const handleConfirm = () => {
//     const quantity = parseInt(inputValue) || 1; // Default to 1 if parsing fails

//     if (quantity <= 0) {
//       setInputValue('1');
//       return;
//     }

//     if (quantity > maxQuantity) {
//       Alert.alert(
//         'Invalid Quantity',
//         `Please select a quantity between 1 and ${maxQuantity}`,
//       );
//       return;
//     }

//     // Create cart item with requested quantity for cart, but preserve original quantity
//     const cartItem = {
//       item_id: item.item_id,
//       item_name: item.item_name,
//       lot_no: item.lot_no,
//       vakal_no: item.vakal_no || '',
//       item_marks: item.item_marks || '',
//       unit_name: item.unit_name,
//       available_qty: item.available_qty,
//       quantity: item.quantity, // Preserve original quantity for display in PlaceOrderScreen
//       quantityInBox: item.box_quantity || 0,
//       requested_qty: quantity, // User-selected quantity
//       ordered_quantity: quantity, // User-selected quantity
//       customerID: item.customerID,
//       addedTimestamp: Date.now(), // Add current timestamp
//     };

//     // Add to cart
//     addToCart(cartItem);

//     // Set added quantity for success modal
//     setAddedQuantity(quantity);

//     // Show success modal instead of Alert
//     setShowSuccessModal(true);
//   };

//   const handleGoToCart = () => {
//     setShowSuccessModal(false);
//     onClose(); // Close the quantity selector modal
//     navigation.navigate('PlaceOrderScreen', {
//       selectedItems: [],
//       customerID: item.customerID,
//     });
//   };

//   const handleOrderMore = () => {
//     setShowSuccessModal(false);
//     onClose(); // Close both modals
//   };

//   return (
//     <>
//       <Modal
//         transparent={true}
//         visible={isVisible && !showSuccessModal}
//         onRequestClose={onClose}
//         animationType="fade"
//         statusBarTranslucent={true}
//       >
//         <KeyboardAvoidingView
//           behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
//           style={styles.modalOverlay}
//         >
//           <View style={styles.modalContent}>
//             <View style={styles.modalHeader}>
//               <Text style={styles.modalTitle}>Select Quantity</Text>
//             </View>

//             <View style={styles.itemInfo}>
//               <View style={styles.infoRow}>
//                 <Icon name="package" size={20} color="#F48221" />
//                 <Text style={styles.modalItemDetail}>
//                   Item:{' '}
//                   <Text style={styles.modalItemValue}>{item.item_name}</Text>
//                 </Text>
//               </View>
//               <View style={styles.infoRow}>
//                 <Icon name="hash" size={20} color="#F48221" />
//                 <Text style={styles.modalItemDetail}>
//                   Lot No:{' '}
//                   <Text style={styles.modalItemValue}>{item.lot_no}</Text>
//                 </Text>
//               </View>
//               <View style={styles.infoRow}>
//                 <Icon name="database" size={20} color="#F48221" />
//                 <Text style={styles.modalItemDetail}>
//                   Quantity:{' '}
//                   <Text style={styles.modalItemValue}>{maxQuantity}</Text>
//                 </Text>
//               </View>
//               <View style={styles.infoRow}>
//                 <Icon name="box" size={20} color="#F48221" />
//                 <Text style={styles.modalItemDetail}>
//                   Unit:{' '}
//                   <Text style={styles.modalItemValue}>{item.unit_name}</Text>
//                 </Text>
//               </View>
//             </View>

//             <View style={styles.quantitySelector}>
//               <TouchableOpacity
//                 style={[
//                   styles.quantityButton,
//                   (!inputValue || parseInt(inputValue) <= 1) &&
//                     styles.quantityButtonDisabled,
//                 ]}
//                 onPress={decrementQuantity}
//                 disabled={!inputValue || parseInt(inputValue) <= 1}
//               >
//                 <Icon name="minus" size={20} color="white" />
//               </TouchableOpacity>

//               <TextInput
//                 style={styles.quantityInput}
//                 keyboardType="numeric"
//                 value={inputValue}
//                 onChangeText={validateAndUpdateQuantity}
//                 selectTextOnFocus={true}
//                 maxLength={String(maxQuantity).length}
//               />

//               <TouchableOpacity
//                 style={[
//                   styles.quantityButton,
//                   parseInt(inputValue) >= maxQuantity &&
//                     styles.quantityButtonDisabled,
//                 ]}
//                 onPress={incrementQuantity}
//                 disabled={parseInt(inputValue) >= maxQuantity}
//               >
//                 <Icon name="plus" size={20} color="white" />
//               </TouchableOpacity>
//             </View>

//             <View style={styles.modalActions}>
//               <TouchableOpacity style={styles.cancelButton} onPress={onClose}>
//                 <Icon name="x" size={20} color="#6B7280" />
//                 <Text style={styles.cancelButtonText}>Cancel</Text>
//               </TouchableOpacity>

//               <TouchableOpacity
//                 style={styles.confirmButton}
//                 onPress={handleConfirm}
//               >
//                 <Icon name="shopping-cart" size={20} color="white" />
//                 <Text style={styles.confirmButtonText}>Add to Cart</Text>
//               </TouchableOpacity>
//             </View>
//           </View>
//         </KeyboardAvoidingView>
//       </Modal>

//       {/* Success Modal */}
//       <SuccessModal
//         isVisible={showSuccessModal}
//         itemCount={addedQuantity}
//         onClose={handleOrderMore}
//         onGoToCart={handleGoToCart}
//       />
//     </>
//   );
// };

// const styles = StyleSheet.create({
//   modalOverlay: {
//     flex: 1,
//     backgroundColor: 'rgba(0, 0, 0, 0.5)',
//     justifyContent: 'center',
//     alignItems: 'center',
//   },
//   modalContent: {
//     backgroundColor: 'white',
//     borderRadius: 12,
//     padding: 20,
//     width: '85%',
//     maxWidth: 400,
//     elevation: 5,
//     shadowColor: '#000',
//     shadowOffset: { width: 0, height: 2 },
//     shadowOpacity: 0.25,
//     shadowRadius: 4,
//   },
//   modalHeader: {
//     flexDirection: 'row',
//     justifyContent: 'space-between',
//     alignItems: 'center',
//     marginBottom: 20,
//   },
//   modalTitle: {
//     fontSize: 20,
//     fontWeight: 'bold',
//     color: '#1F2937',
//   },
//   closeButton: {
//     padding: 4,
//   },
//   itemInfo: {
//     marginBottom: 24,
//     backgroundColor: '#F9FAFB',
//     padding: 16,
//     borderRadius: 8,
//   },
//   infoRow: {
//     flexDirection: 'row',
//     alignItems: 'center',
//     marginBottom: 12,
//     gap: 10,
//   },
//   modalItemDetail: {
//     fontSize: 15,
//     color: '#6B7280',
//     flex: 1,
//   },
//   modalItemValue: {
//     color: '#1F2937',
//     fontWeight: '600',
//   },
//   quantitySelector: {
//     flexDirection: 'row',
//     justifyContent: 'space-between',
//     alignItems: 'center',
//     marginBottom: 24,
//     paddingHorizontal: 20,
//   },
//   quantityButton: {
//     width: 40,
//     height: 40,
//     borderRadius: 20,
//     backgroundColor: '#F48221',
//     justifyContent: 'center',
//     alignItems: 'center',
//   },
//   quantityButtonDisabled: {
//     backgroundColor: '#E5E7EB',
//   },
//   quantityInput: {
//     borderWidth: 1,
//     borderColor: '#E5E7EB',
//     borderRadius: 8,
//     paddingHorizontal: 16,
//     paddingVertical: 8,
//     width: 80,
//     textAlign: 'center',
//     fontSize: 16,
//     color: '#1F2937',
//   },
//   modalActions: {
//     flexDirection: 'row',
//     justifyContent: 'space-between',
//     gap: 12,
//   },
//   cancelButton: {
//     flex: 1,
//     flexDirection: 'row',
//     backgroundColor: '#E5E7EB',
//     padding: 12,
//     borderRadius: 8,
//     alignItems: 'center',
//     justifyContent: 'center',
//     gap: 8,
//   },
//   cancelButtonText: {
//     color: '#6B7280',
//     fontSize: 16,
//     fontWeight: '600',
//   },
//   confirmButton: {
//     flex: 1,
//     flexDirection: 'row',
//     backgroundColor: '#F48221',
//     padding: 12,
//     borderRadius: 8,
//     alignItems: 'center',
//     justifyContent: 'center',
//     gap: 8,
//   },
//   confirmButtonText: {
//     color: 'white',
//     fontSize: 16,
//     fontWeight: '600',
//   },
// });

// export default QuantitySelectorModal;

import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TextInput,
  Platform,
  Keyboard,
  Animated,
  EmitterSubscription,
} from 'react-native';
import Icon from 'react-native-vector-icons/Feather';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { useCart } from '../contexts/CartContext';
import SuccessModal from './SuccessModal'; // Import the new SuccessModal component

interface QuantitySelectorModalProps {
  isVisible: boolean;
  item: {
    item_id: number;
    item_name: string;
    lot_no: string;
    available_qty: number;
    unit_name: string;
    box_quantity: number;
    quantity: number;
    customerID?: number | string;
    vakal_no?: string;
    item_marks?: string;
  };
  onClose: () => void;
}

const QuantitySelectorModal: React.FC<QuantitySelectorModalProps> = ({
  isVisible,
  item,
  onClose,
}) => {
  const navigation = useNavigation<NativeStackNavigationProp<any>>();
  const [inputValue, setInputValue] = useState('1');
  const maxQuantity = item.quantity;
  const { addToCart } = useCart();
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [addedQuantity, setAddedQuantity] = useState(0);

  // Custom styled alert (replaces the plain OS Alert.alert popups so we can
  // add color/branding — native alerts can't be styled).
  const [customAlert, setCustomAlert] = useState<{
    visible: boolean;
    type: 'warning' | 'error';
    title: string;
    message: string;
  }>({ visible: false, type: 'warning', title: '', message: '' });

  const showAlert = (
    type: 'warning' | 'error',
    title: string,
    message: string,
  ) => {
    setCustomAlert({ visible: true, type, title, message });
  };

  const closeAlert = () => {
    setCustomAlert(prev => ({ ...prev, visible: false }));
  };

  // Manual keyboard tracking replaces KeyboardAvoidingView.
  // KeyboardAvoidingView (esp. behavior="height" on Android) nested inside
  // a transparent Modal triggers a resize -> keyboard-event -> resize loop
  // the moment the input is focused, which is what causes the flicker.
  // Driving a single Animated.Value from Keyboard events and translating
  // the modal ourselves avoids that native layout thrash entirely.
  const keyboardOffset = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const showEventName =
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEventName =
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

    const animateTo = (value: number, duration: number) => {
      Animated.timing(keyboardOffset, {
        toValue: value,
        duration,
        useNativeDriver: true,
      }).start();
    };

    const showSub: EmitterSubscription = Keyboard.addListener(
      showEventName,
      event => {
        const keyboardHeight = event?.endCoordinates?.height ?? 0;
        // Shift the modal up by roughly half the keyboard height so it
        // stays clear of the keyboard without over-shooting off-screen.
        const shiftBy = keyboardHeight * 0.5;
        const duration = Platform.OS === 'ios' ? event?.duration ?? 250 : 200;
        animateTo(-shiftBy, duration);
      },
    );

    const hideSub: EmitterSubscription = Keyboard.addListener(
      hideEventName,
      event => {
        const duration = Platform.OS === 'ios' ? event?.duration ?? 250 : 200;
        animateTo(0, duration);
      },
    );

    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, [keyboardOffset]);

  useEffect(() => {
    if (isVisible) {
      // Always start with 1 as the default input value
      setInputValue('1');
      setShowSuccessModal(false);
      keyboardOffset.setValue(0);
    } else {
      // Make sure a lingering keyboard doesn't re-trigger listeners/flicker
      // after the modal has closed.
      Keyboard.dismiss();
    }
  }, [isVisible, keyboardOffset]);

  const validateAndUpdateQuantity = (value: string) => {
    const cleanedValue = value.replace(/[^0-9]/g, '');

    // Allow the field to be temporarily empty so the user can clear it
    // and type a fresh value. We only enforce a minimum of 1 when the
    // field loses focus or the user confirms (see onBlur / handleConfirm).
    if (cleanedValue === '') {
      setInputValue('');
      return;
    }

    const numValue = parseInt(cleanedValue, 10);

    if (numValue > maxQuantity) {
      setInputValue(maxQuantity.toString());
      showAlert(
        'warning',
        'Maximum Quantity Reached',
        `Maximum available quantity is ${maxQuantity}. We've set it to the highest amount available.`,
      );
      return;
    }

    setInputValue(cleanedValue);
  };

  // If the user leaves the field empty (e.g. cleared it and tapped away),
  // restore a sensible default instead of leaving it blank.
  const handleQuantityBlur = () => {
    const numValue = parseInt(inputValue, 10);
    if (inputValue === '' || isNaN(numValue) || numValue <= 0) {
      setInputValue('1');
    }
  };

  const incrementQuantity = () => {
    const currentValue = parseInt(inputValue) || 0;
    if (currentValue < maxQuantity) {
      setInputValue((currentValue + 1).toString());
    }
  };

  const decrementQuantity = () => {
    const currentValue = parseInt(inputValue) || 0;
    if (currentValue > 1) {
      setInputValue((currentValue - 1).toString());
    }
    // If value is 1 or less, keep it at 1 (minimum value)
    else {
      setInputValue('1');
    }
  };

  const handleConfirm = () => {
    const numValue = parseInt(inputValue, 10);

    // Show a clear validation popup instead of silently defaulting to 1
    // when the field is empty or the quantity is 0/invalid.
    if (inputValue.trim() === '' || isNaN(numValue) || numValue <= 0) {
      showAlert(
        'error',
        'Invalid Quantity',
        'Please enter a quantity greater than 0.',
      );
      setInputValue('1');
      return;
    }

    const quantity = numValue;

    if (quantity > maxQuantity) {
      showAlert(
        'warning',
        'Maximum Quantity Reached',
        `Please select a quantity between 1 and ${maxQuantity}.`,
      );
      return;
    }

    // Create cart item with requested quantity for cart, but preserve original quantity
    const cartItem = {
      item_id: item.item_id,
      item_name: item.item_name,
      lot_no: item.lot_no,
      vakal_no: item.vakal_no || '',
      item_marks: item.item_marks || '',
      unit_name: item.unit_name,
      available_qty: item.available_qty,
      quantity: item.quantity, // Preserve original quantity for display in PlaceOrderScreen
      quantityInBox: item.box_quantity || 0,
      requested_qty: quantity, // User-selected quantity
      ordered_quantity: quantity, // User-selected quantity
      customerID: item.customerID,
      addedTimestamp: Date.now(), // Add current timestamp
    };

    // Add to cart
    addToCart(cartItem);

    // Set added quantity for success modal
    setAddedQuantity(quantity);

    // Show success modal instead of Alert
    setShowSuccessModal(true);
  };

  const handleGoToCart = () => {
    setShowSuccessModal(false);
    onClose(); // Close the quantity selector modal
    navigation.navigate('PlaceOrderScreen', {
      selectedItems: [],
      customerID: item.customerID,
    });
  };

  const handleOrderMore = () => {
    setShowSuccessModal(false);
    onClose(); // Close both modals
  };

  return (
    <>
      <Modal
        transparent={true}
        visible={isVisible && !showSuccessModal}
        onRequestClose={onClose}
        animationType="fade"
        statusBarTranslucent={true}
      >
        <View style={styles.modalOverlay}>
          <Animated.View
            style={[
              styles.modalContent,
              { transform: [{ translateY: keyboardOffset }] },
            ]}
          >
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Quantity</Text>
            </View>

            <View style={styles.itemInfo}>
              <View style={styles.infoRow}>
                <Icon name="package" size={20} color="#F48221" />
                <Text style={styles.modalItemDetail}>
                  Item:{' '}
                  <Text style={styles.modalItemValue}>{item.item_name}</Text>
                </Text>
              </View>
              <View style={styles.infoRow}>
                <Icon name="hash" size={20} color="#F48221" />
                <Text style={styles.modalItemDetail}>
                  Lot No:{' '}
                  <Text style={styles.modalItemValue}>{item.lot_no}</Text>
                </Text>
              </View>
              <View style={styles.infoRow}>
                <Icon name="database" size={20} color="#F48221" />
                <Text style={styles.modalItemDetail}>
                  Quantity:{' '}
                  <Text style={styles.modalItemValue}>{maxQuantity}</Text>
                </Text>
              </View>
              <View style={styles.infoRow}>
                <Icon name="box" size={20} color="#F48221" />
                <Text style={styles.modalItemDetail}>
                  Unit:{' '}
                  <Text style={styles.modalItemValue}>{item.unit_name}</Text>
                </Text>
              </View>
            </View>

            <View style={styles.quantitySelector}>
              <TouchableOpacity
                style={[
                  styles.quantityButton,
                  (!inputValue || parseInt(inputValue) <= 1) &&
                    styles.quantityButtonDisabled,
                ]}
                onPress={decrementQuantity}
                disabled={!inputValue || parseInt(inputValue) <= 1}
              >
                <Icon name="minus" size={20} color="white" />
              </TouchableOpacity>

              <TextInput
                style={styles.quantityInput}
                keyboardType="numeric"
                value={inputValue}
                onChangeText={validateAndUpdateQuantity}
                onBlur={handleQuantityBlur}
                selectTextOnFocus={true}
                maxLength={String(maxQuantity).length}
              />

              <TouchableOpacity
                style={[
                  styles.quantityButton,
                  parseInt(inputValue) >= maxQuantity &&
                    styles.quantityButtonDisabled,
                ]}
                onPress={incrementQuantity}
                disabled={parseInt(inputValue) >= maxQuantity}
              >
                <Icon name="plus" size={20} color="white" />
              </TouchableOpacity>
            </View>

            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.cancelButton} onPress={onClose}>
                <Icon name="x" size={20} color="#6B7280" />
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.confirmButton}
                onPress={handleConfirm}
              >
                <Icon name="shopping-cart" size={20} color="white" />
                <Text style={styles.confirmButtonText}>Add to Cart</Text>
              </TouchableOpacity>
            </View>
          </Animated.View>
        </View>
      </Modal>

      {/* Success Modal */}
      <SuccessModal
        isVisible={showSuccessModal}
        itemCount={addedQuantity}
        onClose={handleOrderMore}
        onGoToCart={handleGoToCart}
      />

      {/* Custom styled validation alert (replaces plain OS Alert.alert) */}
      <Modal
        transparent
        visible={customAlert.visible}
        animationType="fade"
        onRequestClose={closeAlert}
        statusBarTranslucent
      >
        <View style={styles.alertOverlay}>
          <View
            style={[
              styles.alertBox,
              customAlert.type === 'error'
                ? styles.alertBoxError
                : styles.alertBoxWarning,
            ]}
          >
            <View
              style={[
                styles.alertIconCircle,
                customAlert.type === 'error'
                  ? styles.alertIconCircleError
                  : styles.alertIconCircleWarning,
              ]}
            >
              <Icon
                name={
                  customAlert.type === 'error'
                    ? 'alert-circle'
                    : 'alert-triangle'
                }
                size={30}
                color="#FFFFFF"
              />
            </View>

            <Text style={styles.alertTitle}>{customAlert.title}</Text>
            <Text style={styles.alertMessage}>{customAlert.message}</Text>

            <TouchableOpacity
              style={[
                styles.alertButton,
                customAlert.type === 'error'
                  ? styles.alertButtonError
                  : styles.alertButtonWarning,
              ]}
              onPress={closeAlert}
            >
              <Text style={styles.alertButtonText}>Got it</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 20,
    width: '85%',
    maxWidth: 400,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1F2937',
  },
  closeButton: {
    padding: 4,
  },
  itemInfo: {
    marginBottom: 24,
    backgroundColor: '#F9FAFB',
    padding: 16,
    borderRadius: 8,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 10,
  },
  modalItemDetail: {
    fontSize: 15,
    color: '#6B7280',
    flex: 1,
  },
  modalItemValue: {
    color: '#1F2937',
    fontWeight: '600',
  },
  quantitySelector: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
    paddingHorizontal: 20,
  },
  quantityButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F48221',
    justifyContent: 'center',
    alignItems: 'center',
  },
  quantityButtonDisabled: {
    backgroundColor: '#E5E7EB',
  },
  quantityInput: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
    width: 80,
    textAlign: 'center',
    fontSize: 16,
    color: '#1F2937',
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  cancelButton: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: '#E5E7EB',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  cancelButtonText: {
    color: '#6B7280',
    fontSize: 16,
    fontWeight: '600',
  },
  confirmButton: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: '#F48221',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  confirmButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  alertOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  alertBox: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    paddingTop: 24,
    paddingBottom: 20,
    paddingHorizontal: 22,
    width: '100%',
    maxWidth: 360,
    alignItems: 'center',
    borderTopWidth: 4,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  alertBoxWarning: {
    borderTopColor: '#F48221',
  },
  alertBoxError: {
    borderTopColor: '#DC2626',
  },
  alertIconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 14,
  },
  alertIconCircleWarning: {
    backgroundColor: '#F48221',
  },
  alertIconCircleError: {
    backgroundColor: '#DC2626',
  },
  alertTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 8,
    textAlign: 'center',
  },
  alertMessage: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 20,
  },
  alertButton: {
    paddingVertical: 12,
    paddingHorizontal: 32,
    borderRadius: 8,
    width: '100%',
    alignItems: 'center',
  },
  alertButtonWarning: {
    backgroundColor: '#F48221',
  },
  alertButtonError: {
    backgroundColor: '#DC2626',
  },
  alertButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default QuantitySelectorModal;
