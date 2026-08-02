'use server';

import { z } from 'zod';

import { permissionAction } from '@/server/actions/action-builder';
import { orderRepository } from '@/server/repositories/order.repository';
import { permission } from '@/constants/permissions';

export const getActiveKitchenOrdersAction = permissionAction(
  { name: 'kitchen.getActiveOrders', permissions: [permission('order', 'read')] },
  z.void(),
  async () => orderRepository.findActiveForKitchen(),
);
