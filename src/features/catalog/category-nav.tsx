'use client';

import Link from 'next/link';
import { useSelectedLayoutSegment } from 'next/navigation';

import { cn } from '@/lib/utils';
import type { CategoryTreeNode } from '@/server/repositories/category.repository';

export function CategoryNav({ categories }: { categories: CategoryTreeNode[] }) {
  const segment = useSelectedLayoutSegment();

  return (
    <nav className="scrollbar-thin -mx-4 flex gap-2 overflow-x-auto px-4 pb-2 sm:mx-0 sm:flex-wrap sm:px-0">
      <Link
        href="/menu"
        className={cn(
          'shrink-0 rounded-full border px-4 py-2 text-sm font-medium transition-colors',
          !segment
            ? 'bg-primary text-primary-foreground border-primary'
            : 'border-border hover:bg-accent',
        )}
      >
        Todo
      </Link>
      {categories.map((category) => (
        <Link
          key={category.id}
          href={`/menu/${category.slug}`}
          className={cn(
            'shrink-0 rounded-full border px-4 py-2 text-sm font-medium transition-colors',
            segment === category.slug
              ? 'bg-primary text-primary-foreground border-primary'
              : 'border-border hover:bg-accent',
          )}
        >
          {category.name}
        </Link>
      ))}
    </nav>
  );
}
