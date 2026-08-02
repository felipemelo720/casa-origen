'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { SearchIcon } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export function TrackOrderForm() {
  const router = useRouter();
  const [code, setCode] = useState('');

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = code.trim();
    if (!trimmed) return;
    router.push(`/pedido/${encodeURIComponent(trimmed)}`);
  }

  return (
    <form onSubmit={handleSubmit} className="mt-6 flex gap-2">
      <Input
        value={code}
        onChange={(e) => setCode(e.target.value)}
        placeholder="CO-260802-0001"
        autoCapitalize="characters"
        className="uppercase"
      />
      <Button type="submit">
        <SearchIcon className="size-4" />
        Buscar
      </Button>
    </form>
  );
}
