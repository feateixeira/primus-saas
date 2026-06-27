import type { CartItem, Product } from "@/types/models";

export const getCartQuantity = (cart: CartItem[], productId: string): number =>
  cart.find((item) => item.productId === productId)?.quantity ?? 0;

export const getAvailableStock = (
  product: Pick<Product, "id" | "stock">,
  cart: CartItem[]
): number => Math.max(0, product.stock - getCartQuantity(cart, product.id));

export const canAddProductToCart = (
  product: Pick<Product, "id" | "stock" | "name">,
  cart: CartItem[],
  delta = 1
): { ok: true } | { ok: false; message: string; description?: string } => {
  const inCart = getCartQuantity(cart, product.id);

  if (product.stock <= 0) {
    return {
      ok: false,
      message: "Produto sem estoque",
      description: `${product.name} não possui unidades disponíveis.`,
    };
  }

  if (inCart + delta > product.stock) {
    const available = Math.max(0, product.stock - inCart);
    return {
      ok: false,
      message: "Estoque insuficiente",
      description:
        available > 0
          ? `${product.name}: restam apenas ${available} un. disponíveis.`
          : `${product.name} já atingiu o estoque máximo no carrinho.`,
    };
  }

  return { ok: true };
};

export const validateCartStock = (
  cart: CartItem[],
  products: Pick<Product, "id" | "name" | "stock">[]
): string | null => {
  for (const item of cart) {
    const product = products.find((p) => p.id === item.productId);
    if (!product) {
      return `Produto "${item.name}" não está mais disponível.`;
    }
    if (product.stock < item.quantity) {
      return `${product.name}: estoque insuficiente (disponível ${product.stock}, no carrinho ${item.quantity}).`;
    }
  }
  return null;
};
