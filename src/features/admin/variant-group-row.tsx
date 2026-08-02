'use client';

import { useFieldArray, useController, type Control, type UseFormRegister } from 'react-hook-form';
import { Plus, Trash2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { ProductInput } from '@/schemas/product.schema';

function OptionRow({
  control,
  register,
  groupIndex,
  optionIndex,
  onRemove,
}: {
  control: Control<ProductInput>;
  register: UseFormRegister<ProductInput>;
  groupIndex: number;
  optionIndex: number;
  onRemove: () => void;
}) {
  const availableController = useController({
    control,
    name: `variantGroups.${groupIndex}.options.${optionIndex}.isAvailable`,
  });

  return (
    <div className="flex items-center gap-2">
      <Input placeholder="Nombre" className="flex-1" {...register(`variantGroups.${groupIndex}.options.${optionIndex}.name`)} />
      <Input
        type="number"
        placeholder="+/- precio"
        className="w-32"
        {...register(`variantGroups.${groupIndex}.options.${optionIndex}.priceDelta`)}
      />
      <label className="flex items-center gap-1 text-xs whitespace-nowrap">
        <Checkbox checked={availableController.field.value} onCheckedChange={availableController.field.onChange} />
        Disponible
      </label>
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        className="text-muted-foreground hover:text-destructive"
        onClick={onRemove}
        aria-label="Eliminar opción"
      >
        <Trash2 className="size-3.5" />
      </Button>
    </div>
  );
}

export function VariantGroupRow({
  control,
  register,
  groupIndex,
  selectionType,
  onSelectionTypeChange,
  onRemove,
}: {
  control: Control<ProductInput>;
  register: UseFormRegister<ProductInput>;
  groupIndex: number;
  selectionType: 'SINGLE' | 'MULTIPLE';
  onSelectionTypeChange: (value: 'SINGLE' | 'MULTIPLE') => void;
  onRemove: () => void;
}) {
  const { fields, append, remove } = useFieldArray({
    control,
    name: `variantGroups.${groupIndex}.options`,
  });

  const requiredController = useController({ control, name: `variantGroups.${groupIndex}.isRequired` });

  return (
    <div className="border-border space-y-3 rounded-xl border p-4">
      <div className="flex items-start gap-3">
        <div className="flex-1 space-y-1.5">
          <Label>Nombre del grupo</Label>
          <Input placeholder="Ej: Tamaño, Punto de cocción" {...register(`variantGroups.${groupIndex}.name`)} />
        </div>
        <div className="w-40 space-y-1.5">
          <Label>Selección</Label>
          <Select value={selectionType} onValueChange={(v) => onSelectionTypeChange(v as 'SINGLE' | 'MULTIPLE')}>
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="SINGLE">Única</SelectItem>
              <SelectItem value="MULTIPLE">Múltiple</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button type="button" variant="ghost" size="icon" className="mt-6 text-muted-foreground hover:text-destructive" onClick={onRemove} aria-label="Eliminar grupo">
          <Trash2 className="size-4" />
        </Button>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <div className="w-32 space-y-1.5">
          <Label>Mín. selección</Label>
          <Input type="number" {...register(`variantGroups.${groupIndex}.minSelect`)} />
        </div>
        <div className="w-32 space-y-1.5">
          <Label>Máx. selección</Label>
          <Input type="number" {...register(`variantGroups.${groupIndex}.maxSelect`)} />
        </div>
        <label className="flex items-center gap-2 pb-2 text-sm">
          <Checkbox checked={requiredController.field.value} onCheckedChange={requiredController.field.onChange} />
          Obligatorio
        </label>
      </div>

      <div className="space-y-2">
        <Label>Opciones</Label>
        {fields.map((field, optionIndex) => (
          <OptionRow
            key={field.id}
            control={control}
            register={register}
            groupIndex={groupIndex}
            optionIndex={optionIndex}
            onRemove={() => remove(optionIndex)}
          />
        ))}
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => append({ name: '', priceDelta: 0, isDefault: false, isAvailable: true })}
        >
          <Plus className="size-3.5" />
          Agregar opción
        </Button>
      </div>
    </div>
  );
}
