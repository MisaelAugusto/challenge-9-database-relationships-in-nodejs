import { inject, injectable } from 'tsyringe';

import AppError from '@shared/errors/AppError';

import IProductsRepository from '@modules/products/repositories/IProductsRepository';
import ICustomersRepository from '@modules/customers/repositories/ICustomersRepository';
import Order from '../infra/typeorm/entities/Order';
import IOrdersRepository from '../repositories/IOrdersRepository';

interface IOrderProduct {
  product_id: string;
  price: number;
  quantity: number;
}

interface IProduct {
  id: string;
  quantity: number;
}

interface IRequest {
  customer_id: string;
  products: IProduct[];
}

@injectable()
class CreateOrderService {
  constructor(
    @inject('OrdersRepository')
    private ordersRepository: IOrdersRepository,

    @inject('ProductsRepository')
    private productsRepository: IProductsRepository,

    @inject('CustomersRepository')
    private customersRepository: ICustomersRepository,
  ) {}

  public async execute({ customer_id, products }: IRequest): Promise<Order> {
    const customer = await this.customersRepository.findById(customer_id);

    if (!customer) {
      throw new AppError('This customer does not exist.');
    }

    const findProducts = await this.productsRepository.findAllById(products);

    const findInvalidProduct = products.some(product =>
      findProducts.every(findProduct => findProduct.id !== product.id),
    );

    if (findInvalidProduct) {
      throw new AppError('Product does not exists');
    }

    const orderProducts: IOrderProduct[] = [];

    findProducts.forEach(findProduct => {
      const { quantity } = products.filter(
        product => product.id === findProduct.id,
      )[0];

      if (findProduct.quantity < quantity) {
        throw new AppError('There is not enough product in stock.');
      }

      const orderProduct = {
        product_id: findProduct.id,
        price: findProduct.price,
        quantity,
      };

      orderProducts.push(orderProduct);
    });

    this.productsRepository.updateQuantity(products);

    const order = await this.ordersRepository.create({
      customer,
      products: orderProducts,
    });

    const updateProductsQuantities = orderProducts.map(orderProduct => ({
      id: orderProduct.product_id,
      quantity:
        findProducts.filter(
          findProduct => findProduct.id === orderProduct.product_id,
        )[0].quantity - orderProduct.quantity,
    }));

    await this.productsRepository.updateQuantity(updateProductsQuantities);

    return order;
  }
}

export default CreateOrderService;
