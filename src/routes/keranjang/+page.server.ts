import { listProducts, type ProductView } from "#lib/server/db";

export interface CartData {
  products: ProductView[];
}

export const load = async (): Promise<CartData> => {
  return { products: await listProducts() };
};
