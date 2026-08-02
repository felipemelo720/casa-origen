import { requireStaff, hasPermission } from '@/lib/auth/session';
import { permission } from '@/constants/permissions';
import { AdminSidebar, type AdminNavItem } from '@/features/admin/admin-sidebar';

const NAV_ITEMS: AdminNavItem[] = [
  { href: '/admin', label: 'Dashboard', icon: 'dashboard', permission: permission('dashboard', 'read') },
  { href: '/admin/pedidos', label: 'Pedidos', icon: 'orders', permission: permission('order', 'read') },
  { href: '/admin/cocina', label: 'Cocina', icon: 'kitchen', permission: permission('order', 'update') },
  { href: '/admin/productos', label: 'Productos', icon: 'products', permission: permission('product', 'read') },
  { href: '/admin/categorias', label: 'Categorías', icon: 'categories', permission: permission('category', 'read') },
  { href: '/admin/extras', label: 'Extras', icon: 'extras', permission: permission('extra', 'read') },
  { href: '/admin/etiquetas', label: 'Etiquetas', icon: 'tags', permission: permission('tag', 'read') },
  { href: '/admin/ingredientes', label: 'Ingredientes', icon: 'ingredients', permission: permission('ingredient', 'read') },
  { href: '/admin/estadisticas', label: 'Estadísticas', icon: 'stats', permission: permission('analytics', 'read') },
  { href: '/admin/configuracion', label: 'Configuración', icon: 'settings', permission: permission('setting', 'read') },
];

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await requireStaff();

  const items = NAV_ITEMS.filter((item) => !item.permission || hasPermission(user, item.permission));

  return (
    <div className="flex min-h-dvh flex-col lg:flex-row">
      <AdminSidebar items={items} userName={user.name} roleName={user.roleName} />
      <main className="flex-1 overflow-x-hidden p-4 sm:p-6 lg:p-8">{children}</main>
    </div>
  );
}
