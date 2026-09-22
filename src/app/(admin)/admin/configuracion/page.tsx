import { updateBusinessHoursAction, updateCommunesAction } from '@/server/actions/admin.actions';
import { communeRepository, settingsRepository } from '@/server/repositories/operations.repository';
import { getWeeklySchedule } from '@/server/services/schedule.service';
import { AdminForm, AdminSubmit } from '@/features/admin/admin-form';
import { AdminPageHeader } from '@/features/admin/admin-page-header';
import { ScheduleDayRow } from '@/features/admin/schedule-day-row';
import { ZoneRow } from '@/features/admin/zone-row';

export const metadata = { title: 'Ajustes — Admin — Casa Origen' };
export const dynamic = 'force-dynamic';

/**
 * Un día cerrado se guarda como 00:00–00:00. Mostrar eso al destildar «Cerrado»
 * dejaría abrir el día con una ventana de cero minutos, así que el form parte
 * del primer turno real del local y el operador solo lo corrige si hace falta.
 *
 * El segundo turno no se precarga acá: solo existe si el día ya lo tiene, y si
 * no, la fila ofrece agregarlo (ver `SECOND_SHIFT_DEFAULT` en `ScheduleDayRow`).
 */
const FALLBACK_SHIFT = { opensAt: '12:30', closesAt: '15:00' } as const;

const EMPTY_SHIFT = { opensAt: '', closesAt: '' } as const;

/**
 * Lo que se configura una vez y se toca poco: horarios y zonas de despacho.
 * Separado de Hoy para que lo diario (abrir, agotar) no quede bajo dos
 * formularios largos. La autenticación la resuelve el middleware de `/admin/*`.
 */
export default async function AdminSettingsPage() {
  const [settings, weeklySchedule, zones] = await Promise.all([
    settingsRepository.get(),
    getWeeklySchedule(),
    // `findAllForAdmin`, no `findAllActive`: una zona apagada tiene que seguir
    // visible acá, si no no hay forma de volver a encenderla.
    communeRepository.findAllForAdmin(),
  ]);

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-4 py-6 lg:px-8 lg:py-8">
      <AdminPageHeader title="Ajustes" description="Horarios y zonas de despacho." />

      <div className="grid gap-6 xl:grid-cols-2 xl:items-start [&>section]:min-w-0">
        <section
          aria-labelledby="horarios"
          className="border-border bg-card space-y-4 rounded-2xl border p-4 sm:p-6"
        >
          <div>
            <h2 id="horarios" className="text-lg font-semibold">
              Horarios
            </h2>
            <p className="text-muted-foreground mt-1 text-sm">
              Estos son los horarios que se muestran en la web. Agrega el segundo turno solo en los
              días que cierras al mediodía.
            </p>
          </div>
          <AdminForm action={updateBusinessHoursAction} className="space-y-3">
            {/*
              Una tarjeta por día, mismo layout en todo ancho. `min-w-0`: la
              grilla de cuatro columnas con cabecera que había antes pedía
              344px de `min-content` y desbordaba la columna de 328px en móvil.
            */}
            <div className="grid min-w-0 gap-2">
              {weeklySchedule.map((day) => (
                <ScheduleDayRow
                  key={day.dayOfWeek}
                  dayOfWeek={day.dayOfWeek}
                  label={day.label}
                  isToday={day.isToday}
                  isClosed={day.isClosed}
                  first={day.slots[0] ?? FALLBACK_SHIFT}
                  second={day.slots[1] ?? EMPTY_SHIFT}
                />
              ))}
            </div>
            <AdminSubmit className="h-11 w-full">Guardar horarios</AdminSubmit>
          </AdminForm>
        </section>

        <section
          aria-labelledby="zonas"
          className="border-border bg-card space-y-4 rounded-2xl border p-4 sm:p-6"
        >
          <div>
            <h2 id="zonas" className="text-lg font-semibold">
              Zonas de despacho
            </h2>
            <p className="text-muted-foreground mt-1 text-sm">
              El cobro es siempre el valor mínimo; el máximo solo se muestra como referencia en la
              web. Los minutos se suman a los {settings.deliveryEtaMinutes} min base.
            </p>
          </div>

          <AdminForm action={updateCommunesAction} className="space-y-2">
            {/* Cabecera solo desde `lg`: en móvil cada campo lleva su propio
                rótulo dentro de la tarjeta (ver `ZoneRow`), porque los inputs
                se acomodan en dos filas y estos títulos no caerían sobre su
                columna. */}
            <div className="text-muted-foreground/70 hidden grid-cols-[1fr_22rem] items-center gap-3 text-[10px] tracking-widest uppercase lg:grid">
              <span>Sector</span>
              <div className="flex min-w-0 items-center gap-x-2">
                <span className="min-w-0 flex-1">Mínimo</span>
                <span className="shrink-0 opacity-0" aria-hidden="true">
                  –
                </span>
                <span className="min-w-0 flex-1">Máximo</span>
                <span className="w-16 shrink-0">Min. extra</span>
                <span className="w-[5.5rem] shrink-0 px-1">Activa</span>
              </div>
            </div>

            {zones.map((zone) => (
              <ZoneRow
                key={zone.id}
                id={zone.id}
                name={zone.name}
                deliveryFeeMin={zone.deliveryFeeMin}
                deliveryFeeMax={zone.deliveryFeeMax}
                extraMinutes={zone.extraMinutes}
                isActive={zone.isActive}
              />
            ))}

            <AdminSubmit className="h-11 w-full">Guardar zonas</AdminSubmit>
          </AdminForm>
        </section>
      </div>
    </div>
  );
}
