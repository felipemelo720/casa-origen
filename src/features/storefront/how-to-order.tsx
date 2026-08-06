import { ClipboardCheck, MessageCircle, Pizza } from 'lucide-react';

type Props = {
  /** Without a configured number the order still lands in the database, so the
   *  last step must not promise a WhatsApp message that never opens. */
  whatsappEnabled: boolean;
};

/**
 * Confirming a cart opens WhatsApp with the order detail. That is unusual
 * enough that it needs saying up front — otherwise the tab switch reads as a
 * bug and people abandon on the last click.
 */
export function HowToOrder({ whatsappEnabled }: Props) {
  const steps = [
    {
      icon: Pizza,
      title: 'Elige tus pizzas',
      body: 'Escoge el tamaño y los extras. El precio se arma solo, sin sorpresas al final.',
    },
    {
      icon: ClipboardCheck,
      title: 'Confirma tus datos',
      body: 'Retiro en tienda o despacho, cómo pagas y listo. Sin crear cuenta ni contraseñas.',
    },
    {
      icon: MessageCircle,
      title: whatsappEnabled ? 'Cerramos por WhatsApp' : 'Nosotros te llamamos',
      body: whatsappEnabled
        ? 'Al confirmar se abre WhatsApp con tu pedido listo para enviar. Ahí coordinamos la entrega.'
        : 'Recibimos tu pedido y te contactamos al teléfono que dejaste para coordinar la entrega.',
    },
  ];

  return (
    <section id="como-pedir" className="border-border bg-secondary/40 scroll-mt-28 border-y">
      <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <h2 className="font-display mb-1 text-2xl font-bold">Pedir es así de simple</h2>
        <p className="text-muted-foreground mb-8 text-sm">Tres pasos, menos de un minuto.</p>

        <ol className="grid gap-6 sm:grid-cols-3">
          {steps.map((step, index) => (
            <li key={step.title} className="border-border bg-card rounded-2xl border p-6">
              <div className="flex items-center gap-3">
                <span className="bg-primary/10 text-primary flex size-9 shrink-0 items-center justify-center rounded-full">
                  <step.icon className="size-4" />
                </span>
                <span className="text-muted-foreground text-xs font-semibold tracking-widest uppercase">
                  Paso {index + 1}
                </span>
              </div>
              <p className="font-display mt-4 font-semibold">{step.title}</p>
              <p className="text-muted-foreground mt-2 text-sm">{step.body}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
