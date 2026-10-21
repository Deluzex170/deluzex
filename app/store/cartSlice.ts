import { createSlice, PayloadAction } from '@reduxjs/toolkit';

export interface CartItem {
  id: string | number;
  title: string;
  price: number;
  image: string;
  quantity: number;
}

export interface AppliedCouponState {
  code: string;
  discount_amount: number;
  discount_type: "percentage" | "flat" | "free_shipping";
  discount_value?: number | null;
  message?: string;
}

export interface CartState {
  cartItems: CartItem[];
  isCartOpen: boolean;
  cartTotal: number;
  appliedCoupon: AppliedCouponState | null;
}

const initialState: CartState = {
  cartItems: [],
  isCartOpen: false,
  cartTotal: 0,
  appliedCoupon: null,
};

const calculateTotal = (items: CartItem[]) => {
  return items.reduce((total, item) => total + item.price * item.quantity, 0);
};

export interface AddToCartPayload {
  _id?: string | number;
  id?: string | number;
  product_title?: string;
  name?: string;
  product_price?: number | string;
  price?: number | string;
  product_main_image?: string;
  image_url?: string;
  quantity?: number;
}

const cartSlice = createSlice({
  name: 'cart',
  initialState,
  reducers: {
    addToCart: (state, action: PayloadAction<AddToCartPayload>) => {
      const product = action.payload;
      const productId = product._id || product.id || Date.now().toString();
      const qtyToAdd = Math.max(1, product.quantity || 1);
      
      const existingItem = state.cartItems.find(item => item.id === productId);
      
      if (existingItem) {
        existingItem.quantity += qtyToAdd;
      } else {
        state.cartItems.push({
          id: productId,
          title: product.product_title || product.name || "Product",
          price: Number(product.product_price || product.price) || 0,
          image: product.product_main_image || product.image_url || "/images/lamp_modern_tall_1784107732736.jpg",
          quantity: qtyToAdd
        });
      }
      state.cartTotal = calculateTotal(state.cartItems);
      state.isCartOpen = true; // Automatically open cart when adding
    },
    removeFromCart: (state, action: PayloadAction<string | number>) => {
      state.cartItems = state.cartItems.filter(item => item.id !== action.payload);
      state.cartTotal = calculateTotal(state.cartItems);
    },
    updateQuantity: (state, action: PayloadAction<{ id: string | number, change: number }>) => {
      const item = state.cartItems.find(i => i.id === action.payload.id);
      if (item) {
        item.quantity = Math.max(1, item.quantity + action.payload.change);
      }
      state.cartTotal = calculateTotal(state.cartItems);
    },
    openCart: (state) => {
      state.isCartOpen = true;
    },
    closeCart: (state) => {
      state.isCartOpen = false;
    },
    clearCart: (state) => {
      state.cartItems = [];
      state.cartTotal = 0;
      state.appliedCoupon = null;
    },
    setCartItems: (state, action: PayloadAction<CartItem[]>) => {
      state.cartItems = action.payload;
      state.cartTotal = calculateTotal(state.cartItems);
    },
    setAppliedCoupon: (state, action: PayloadAction<AppliedCouponState | null>) => {
      state.appliedCoupon = action.payload;
    },
    removeAppliedCoupon: (state) => {
      state.appliedCoupon = null;
    }
  }
});

export const {
  addToCart,
  removeFromCart,
  updateQuantity,
  openCart,
  closeCart,
  clearCart,
  setCartItems,
  setAppliedCoupon,
  removeAppliedCoupon
} = cartSlice.actions;
export default cartSlice.reducer;
