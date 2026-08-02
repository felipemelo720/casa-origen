'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState } from 'react';
import {
  ChefHat,
  LayoutDashboard,
  LineChart,
  LogOut,
  Menu,
  Package,
  PlusCircle,
  ReceiptText,
  Settings,
  Soup,
  Tag,
  Wheat,
} from 'lucide-react';

import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from '@/components/ui/sheet';
import { cn } from '@/lib/utils';
import { signOut } from '@/lib/auth/auth-client';
import type { PermissionKey } from '@/constants/permissions';

export type AdminNavItem = {
  href: string;
  label: string;
  icon: keyof typeof ICONS;
  permission?: PermissionKey;
};

const ICONS = {
  dashboard: LayoutDashboard,
  orders: ReceiptText,
  kitchen: ChefHat,
  products: Package,
  categories: Soup,
  extras: PlusCircle,
  tags: Tag,
  ingredients: Wheat,
  settings: Settings,
  stats: LineChart,
};

function NavLinks({ items, onNavigate }: { items: AdminNavItem[]; onNavigate?: () => void }) {
  const pathname = usePathname();

  return (
    <nav className="flex flex-col gap-1">
      {items.map((item) => {
        const Icon = ICONS[item.icon];
        const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            className={cn(
              'flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
              active ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
            )}
          >
            <Icon className="size-4" />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

export function AdminSidebar({
  items,
  userName,
  roleName,
}: {
  items: AdminNavItem[];
  userName: string;
  roleName: string | null;
}) {
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);

  async function handleSignOut() {
    await signOut();
    router.push('/');
    router.refresh();
  }

  const initials = userName
    .split(' ')
    .map((part) => part[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  return (
    <>
      <aside className="border-border bg-card hidden w-60 shrink-0 flex-col border-r p-4 lg:flex">
        <Link href="/admin" className="font-display mb-6 px-1 text-lg font-bold">
          Casa Origen
        </Link>
        <NavLinks items={items} />
        <div className="mt-auto space-y-2 pt-4">
          <div className="flex items-center gap-2 px-1">
            <Avatar size="sm">
              <AvatarFallback>{initials}</AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{userName}</p>
              {roleName && <p className="text-muted-foreground truncate text-xs">{roleName}</p>}
            </div>
          </div>
          <Button variant="ghost" size="sm" className="w-full justify-start" onClick={handleSignOut}>
            <LogOut className="size-4" />
            Cerrar sesión
          </Button>
        </div>
      </aside>

      <div className="border-border bg-card flex items-center justify-between border-b p-3 lg:hidden">
        <Link href="/admin" className="font-display text-lg font-bold">
          Casa Origen
        </Link>
        <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" aria-label="Abrir menú">
              <Menu className="size-4" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-64 p-4">
            <SheetTitle className="sr-only">Menú admin</SheetTitle>
            <NavLinks items={items} onNavigate={() => setMobileOpen(false)} />
            <Button variant="ghost" size="sm" className="mt-4 w-full justify-start" onClick={handleSignOut}>
              <LogOut className="size-4" />
              Cerrar sesión
            </Button>
          </SheetContent>
        </Sheet>
      </div>
    </>
  );
}
