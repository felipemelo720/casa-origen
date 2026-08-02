import { orderRepository } from '@/server/repositories/order.repository';
import { KitchenBoard } from '@/features/admin/kitchen-board';

export const metadata = { title: 'Cocina' };

export default async function KitchenPage() {
  const orders = await orderRepository.findActiveForKitchen();

  return (
    <div className="space-y-6">
      <h1 className="font-display text-3xl font-bold">Cocina</h1>
      <KitchenBoard initialOrders={orders} />
    </div>
  );
}
