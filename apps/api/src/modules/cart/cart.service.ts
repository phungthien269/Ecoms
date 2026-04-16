import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { type CartSummary, ProductStatus, ShopStatus } from "@ecoms/contracts";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { AddCartItemDto } from "./dto/add-cart-item.dto";
import { UpdateCartItemDto } from "./dto/update-cart-item.dto";

const cartItemInclude = {
  product: {
    include: {
      shop: {
        select: {
          id: true,
          name: true,
          slug: true,
          status: true,
          deletedAt: true
        }
      },
      images: {
        orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
        take: 1
      }
    }
  },
  productVariant: true
} satisfies Prisma.CartItemInclude;

type CartItemRecord = Prisma.CartItemGetPayload<{
  include: typeof cartItemInclude;
}>;

@Injectable()
export class CartService {
  constructor(private readonly prisma: PrismaService) {}

  async getCurrentCart(userId: string): Promise<CartSummary> {
    const items = await this.prisma.cartItem.findMany({
      where: { userId },
      include: cartItemInclude,
      orderBy: [{ updatedAt: "desc" }]
    });

    return this.buildCartSummary(items);
  }

  async addItem(userId: string, payload: AddCartItemDto): Promise<CartSummary> {
    const purchasable = await this.ensurePurchasableProduct(
      payload.productId,
      payload.productVariantId
    );

    this.ensureRequestedQuantityAllowed(payload.quantity, purchasable.availableStock);

    const existingItem = await this.prisma.cartItem.findFirst({
      where: {
        userId,
        productId: payload.productId,
        productVariantId: payload.productVariantId ?? null
      }
    });

    if (existingItem) {
      const nextQuantity = existingItem.quantity + payload.quantity;
      this.ensureRequestedQuantityAllowed(nextQuantity, purchasable.availableStock);

      await this.prisma.cartItem.update({
        where: { id: existingItem.id },
        data: {
          quantity: nextQuantity
        }
      });
    } else {
      await this.prisma.cartItem.create({
        data: {
          userId,
          productId: payload.productId,
          productVariantId: payload.productVariantId,
          quantity: payload.quantity
        }
      });
    }

    return this.getCurrentCart(userId);
  }

  async updateItem(
    userId: string,
    cartItemId: string,
    payload: UpdateCartItemDto
  ): Promise<CartSummary> {
    const cartItem = await this.prisma.cartItem.findFirst({
      where: {
        id: cartItemId,
        userId
      }
    });

    if (!cartItem) {
      throw new NotFoundException("Cart item not found");
    }

    const purchasable = await this.ensurePurchasableProduct(
      cartItem.productId,
      cartItem.productVariantId ?? undefined
    );
    this.ensureRequestedQuantityAllowed(payload.quantity, purchasable.availableStock);

    await this.prisma.cartItem.update({
      where: { id: cartItemId },
      data: {
        quantity: payload.quantity
      }
    });

    return this.getCurrentCart(userId);
  }

  async removeItem(userId: string, cartItemId: string): Promise<CartSummary> {
    const cartItem = await this.prisma.cartItem.findFirst({
      where: {
        id: cartItemId,
        userId
      }
    });

    if (!cartItem) {
      throw new NotFoundException("Cart item not found");
    }

    await this.prisma.cartItem.delete({
      where: { id: cartItemId }
    });

    return this.getCurrentCart(userId);
  }

  async clear(userId: string) {
    await this.prisma.cartItem.deleteMany({
      where: { userId }
    });

    return {
      cleared: true
    };
  }

  private async ensurePurchasableProduct(productId: string, productVariantId?: string) {
    const product = await this.prisma.product.findFirst({
      where: {
        id: productId,
        deletedAt: null
      },
      include: {
        shop: {
          select: {
            status: true,
            deletedAt: true
          }
        }
      }
    });

    if (!product) {
      throw new NotFoundException("Product not found");
    }

    if (
      product.status !== ProductStatus.ACTIVE ||
      product.shop.status !== ShopStatus.ACTIVE ||
      product.shop.deletedAt
    ) {
      throw new ConflictException("Only active products from active shops can be added to cart");
    }

    let availableStock = product.stock;
    let variantId: string | null = null;
    if (productVariantId) {
      const variant = await this.prisma.productVariant.findFirst({
        where: {
          id: productVariantId,
          productId
        }
      });

      if (!variant) {
        throw new NotFoundException("Product variant not found");
      }

      availableStock = variant.stock;
      variantId = variant.id;
    }

    return {
      productId: product.id,
      productVariantId: variantId,
      availableStock
    };
  }

  private ensureRequestedQuantityAllowed(quantity: number, availableStock: number) {
    if (availableStock <= 0) {
      throw new ConflictException("This item is currently out of stock");
    }

    if (quantity > availableStock) {
      throw new ConflictException("Requested quantity exceeds available stock");
    }
  }

  private buildCartSummary(items: CartItemRecord[]): CartSummary {
    const groups = new Map<
      string,
      {
        shop: {
          id: string;
          name: string;
          slug: string;
        };
        items: CartSummary["shops"][number]["items"];
        subtotal: Prisma.Decimal;
      }
    >();

    let itemCount = 0;
    let subtotal = new Prisma.Decimal(0);

    for (const item of items) {
      const unitPrice = item.productVariant?.price ?? item.product.salePrice;
      const itemSubtotal = unitPrice.mul(item.quantity);
      itemCount += item.quantity;
      subtotal = subtotal.add(itemSubtotal);

      const shopKey = item.product.shop.id;
      const existingGroup =
        groups.get(shopKey) ??
        {
          shop: {
            id: item.product.shop.id,
            name: item.product.shop.name,
            slug: item.product.shop.slug
          },
          items: [],
          subtotal: new Prisma.Decimal(0)
        };

      existingGroup.items.push({
        id: item.id,
        productId: item.productId,
        productVariantId: item.productVariantId,
        quantity: item.quantity,
        unitPrice: unitPrice.toString(),
        subtotal: itemSubtotal.toString(),
        product: {
          id: item.product.id,
          name: item.product.name,
          slug: item.product.slug,
          status: item.product.status,
          imageUrl: item.product.images[0]?.url ?? null,
          stock: item.product.stock
        },
        variant: item.productVariant
          ? {
              id: item.productVariant.id,
              sku: item.productVariant.sku,
              name: item.productVariant.name,
              attributes: item.productVariant.attributes as Record<string, string>,
              stock: item.productVariant.stock
            }
          : null
      });
      existingGroup.subtotal = existingGroup.subtotal.add(itemSubtotal);
      groups.set(shopKey, existingGroup);
    }

    return {
      shops: Array.from(groups.values()).map((group) => ({
        shop: group.shop,
        items: group.items,
        subtotal: group.subtotal.toString()
      })),
      totals: {
        itemCount,
        subtotal: subtotal.toString()
      }
    };
  }
}
