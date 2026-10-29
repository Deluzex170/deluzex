import { createSlice, PayloadAction } from '@reduxjs/toolkit';

export interface CartItem {
  id: string | number;
  title: string;
  price: number;
  image: string;
  quantity: number;
  // Units available in inventory; undefined means no known limit (e.g. made-to-order)
  maxQuantity?: number;
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
  max_quantity?: number;
}

// Inventory cap for a product: made-to-order pieces and products without a stock count are uncapped
export const getMaxQuantity = (product: { stock_count?: number | null; stock_status?: string }): number | undefined => {
  const isMadeToOrder = Boolean(product.stock_status?.toLowerCase().includes("order"));
  if (isMadeToOrder || product.stock_count === undefined || product.stock_count === null) return undefined;
  return Math.max(0, Number(product.stock_count));
};

const clampToStock = (quantity: number, maxQuantity?: number) =>
  maxQuantity !== undefined ? Math.min(quantity, maxQuantity) : quantity;

const cartSlice = createSlice({
  name: 'cart',
  initialState,
  reducers: {
    addToCart: (state, action: PayloadAction<AddToCartPayload>) => {
      const product = action.payload;
      const productId = product._id || product.id || Date.now().toString();
      const qtyToAdd = Math.max(1, product.quantity || 1);
      const maxQuantity = product.max_quantity;
      if (maxQuantity !== undefined && maxQuantity <= 0) return;

      const existingItem = state.cartItems.find(item => String(item.id) === String(productId));

      if (existingItem) {
        if (maxQuantity !== undefined) existingItem.maxQuantity = maxQuantity;
        existingItem.quantity = clampToStock(existingItem.quantity + qtyToAdd, existingItem.maxQuantity);
      } else {
        state.cartItems.push({
          id: productId,
          title: product.product_title || product.name || "Product",
          price: Number(product.product_price || product.price) || 0,
          image: product.product_main_image || product.image_url || "/images/lamp_modern_tall_1784107732736.jpg",
          quantity: clampToStock(qtyToAdd, maxQuantity),
          maxQuantity,
        });
      }
      state.cartTotal = calculateTotal(state.cartItems);
      state.isCartOpen = true; // Automatically open cart when adding
    },
    removeFromCart: (state, action: PayloadAction<string | number>) => {
      state.cartItems = state.cartItems.filter(item => item.id !== action.payload);
      state.cartTotal = calculateTotal(state.cartItems);
    },
    updateQuantity: (state, action: PayloadAction<{ id: string | number, change: number, max_quantity?: number }>) => {
      const item = state.cartItems.find(i => String(i.id) === String(action.payload.id));
      if (item) {
        if (action.payload.max_quantity !== undefined) item.maxQuantity = action.payload.max_quantity;
        item.quantity = Math.max(1, clampToStock(item.quantity + action.payload.change, item.maxQuantity));
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
      // Backend cart rows carry no stock info, so keep known caps from the local cart
      const knownCaps = new Map(state.cartItems.map(i => [String(i.id), i.maxQuantity]));
      state.cartItems = action.payload.map(item => {
        const maxQuantity = item.maxQuantity ?? knownCaps.get(String(item.id));
        return { ...item, maxQuantity, quantity: Math.max(1, clampToStock(item.quantity, maxQuantity)) };
      });
      state.cartTotal = calculateTotal(state.cartItems);
    },
    setStockLimits: (state, action: PayloadAction<Record<string, number | undefined>>) => {
      for (const item of state.cartItems) {
        const key = String(item.id);
        if (!(key in action.payload)) continue;
        item.maxQuantity = action.payload[key];
        item.quantity = Math.max(1, clampToStock(item.quantity, item.maxQuantity));
      }
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
  setStockLimits,
  setAppliedCoupon,
  removeAppliedCoupon
} = cartSlice.actions;
export default cartSlice.reducer;
