import { ChevronDown } from 'lucide-react';

import type { FaqItem } from './faq-content';

type Props = { items: FaqItem[] };

/**
 * `<details>` nativo y no el Accordion de Radix: abre y cierra sin JS, con
 * teclado de serie, y el texto de las respuestas está en el HTML aunque esté
 * plegado, que es lo que lee el buscador. El `FAQPage` sale de los mismos
 * `items`, así que lo que ve Google y lo que ve el cliente no pueden divergir.
 */
export function Faq({ items }: Props) {
  if (items.length === 0) return null;

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: items.map((item) => ({
      '@type': 'Question',
      name: item.question,
      acceptedAnswer: { '@type': 'Answer', text: item.answer },
    })),
  };

  return (
    <section
      id="preguntas"
      className="reveal mx-auto max-w-3xl scroll-mt-28 px-4 pb-16 sm:px-6 lg:px-8"
    >
      <h2 className="font-display mb-6 text-2xl font-bold">Preguntas frecuentes</h2>
      <div className="border-border bg-card divide-border divide-y rounded-2xl border">
        {items.map((item) => (
          <details key={item.question} className="group">
            <summary className="hover:bg-muted/50 focus-visible:ring-ring flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 rounded-2xl px-6 py-3 font-semibold focus-visible:ring-2 focus-visible:outline-none [&::-webkit-details-marker]:hidden">
              {item.question}
              <ChevronDown
                aria-hidden
                className="text-muted-foreground size-4 shrink-0 transition-transform group-open:rotate-180 motion-reduce:transition-none"
              />
            </summary>
            <p className="text-muted-foreground max-w-prose px-6 pb-4 text-sm">{item.answer}</p>
          </details>
        ))}
      </div>
      <script
        type="application/ld+json"
        // Escapado: nombres de zona y medios de pago vienen del admin.
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, '\\u003c') }}
      />
    </section>
  );
}
