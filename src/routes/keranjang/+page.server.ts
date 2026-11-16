import { listProducts, type ProductView } from "#lib/server/db";

export interface CartData {
  products: ProductView[];
}

export const load = (): CartData => {
  return { products: listProducts() };
};
