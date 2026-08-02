'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { settingsSchema, type SettingsInput } from '@/schemas/settings.schema';
import { updateSettingsAction } from '@/server/actions/settings.actions';
import { FormField as Field } from '@/features/admin/form-field';

export function SettingsForm({ defaultValues }: { defaultValues: SettingsInput }) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);

  const form = useForm<SettingsInput>({
    resolver: zodResolver(settingsSchema),
    defaultValues,
  });

  async function onSubmit(values: SettingsInput) {
    setSubmitting(true);
    const result = await updateSettingsAction(values);
    setSubmitting(false);

    if (!result.ok) {
      toast.error(result.message);
      if (result.fieldErrors) {
        for (const [field, messages] of Object.entries(result.fieldErrors)) {
          form.setError(field as keyof SettingsInput, { message: messages[0] });
        }
      }
      return;
    }

    toast.success('Configuración guardada.');
    router.refresh();
  }

  const errors = form.formState.errors;

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="max-w-2xl space-y-8">
      <section className="space-y-4">
        <h2 className="font-display text-lg font-semibold">General</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Nombre" htmlFor="name" error={errors.name?.message}>
            <Input id="name" {...form.register('name')} />
          </Field>
          <Field label="Tagline" htmlFor="tagline" error={errors.tagline?.message}>
            <Input id="tagline" {...form.register('tagline')} />
          </Field>
        </div>
        <Field label="Descripción" htmlFor="description" error={errors.description?.message}>
          <Textarea id="description" {...form.register('description')} />
        </Field>
      </section>

      <Separator />

      <section className="space-y-4">
        <h2 className="font-display text-lg font-semibold">Contacto</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Correo" htmlFor="email" error={errors.email?.message}>
            <Input id="email" type="email" {...form.register('email')} />
          </Field>
          <Field label="Teléfono" htmlFor="phone" error={errors.phone?.message}>
            <Input id="phone" {...form.register('phone')} />
          </Field>
          <Field label="WhatsApp" htmlFor="whatsapp" error={errors.whatsapp?.message}>
            <Input id="whatsapp" {...form.register('whatsapp')} />
          </Field>
          <Field label="Dirección" htmlFor="address" error={errors.address?.message}>
            <Input id="address" {...form.register('address')} />
          </Field>
          <Field label="Instagram (URL)" htmlFor="instagramUrl" error={errors.instagramUrl?.message}>
            <Input id="instagramUrl" {...form.register('instagramUrl')} />
          </Field>
          <Field label="Facebook (URL)" htmlFor="facebookUrl" error={errors.facebookUrl?.message}>
            <Input id="facebookUrl" {...form.register('facebookUrl')} />
          </Field>
        </div>
      </section>

      <Separator />

      <section className="space-y-4">
        <h2 className="font-display text-lg font-semibold">Operación</h2>
        <div className="flex items-center gap-2">
          <Switch
            id="acceptingOrders"
            checked={form.watch('acceptingOrders')}
            onCheckedChange={(checked) => form.setValue('acceptingOrders', checked)}
          />
          <Label htmlFor="acceptingOrders">Aceptando pedidos</Label>
        </div>
        <Field label="Mensaje si está cerrado" htmlFor="closedMessage" error={errors.closedMessage?.message}>
          <Input id="closedMessage" {...form.register('closedMessage')} />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Despacho por defecto (CLP)" htmlFor="defaultDeliveryFee" error={errors.defaultDeliveryFee?.message}>
            <Input id="defaultDeliveryFee" type="number" {...form.register('defaultDeliveryFee')} />
          </Field>
          <Field label="Envío gratis desde (CLP, 0 = desactivado)" htmlFor="freeDeliveryFrom" error={errors.freeDeliveryFrom?.message}>
            <Input id="freeDeliveryFrom" type="number" {...form.register('freeDeliveryFrom')} />
          </Field>
          <Field label="Pedido mínimo (CLP)" htmlFor="minOrderAmount" error={errors.minOrderAmount?.message}>
            <Input id="minOrderAmount" type="number" {...form.register('minOrderAmount')} />
          </Field>
          <Field label="ETA delivery (min)" htmlFor="deliveryEtaMinutes" error={errors.deliveryEtaMinutes?.message}>
            <Input id="deliveryEtaMinutes" type="number" {...form.register('deliveryEtaMinutes')} />
          </Field>
          <Field label="ETA retiro (min)" htmlFor="pickupEtaMinutes" error={errors.pickupEtaMinutes?.message}>
            <Input id="pickupEtaMinutes" type="number" {...form.register('pickupEtaMinutes')} />
          </Field>
        </div>
      </section>

      <Separator />

      <section className="space-y-4">
        <h2 className="font-display text-lg font-semibold">SEO</h2>
        <Field label="Título SEO" htmlFor="seoTitle" error={errors.seoTitle?.message}>
          <Input id="seoTitle" {...form.register('seoTitle')} />
        </Field>
        <Field label="Descripción SEO" htmlFor="seoDescription" error={errors.seoDescription?.message}>
          <Textarea id="seoDescription" {...form.register('seoDescription')} />
        </Field>
      </section>

      <Button type="submit" disabled={submitting}>
        {submitting && <Loader2 className="size-4 animate-spin" />}
        Guardar configuración
      </Button>
    </form>
  );
}
