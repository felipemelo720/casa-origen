import { describe, expect, it } from 'vitest';
import { buildWhatsAppUrl } from './whatsapp-link';

describe('buildWhatsAppUrl', () => {
  it('strips human formatting from the number', () => {
    expect(buildWhatsAppUrl('+56 9 1234 5678')).toBe('https://wa.me/56912345678');
  });

  it('omits the query string when there is no message', () => {
    expect(buildWhatsAppUrl('56912345678')).toBe('https://wa.me/56912345678');
  });

  it('URL-encodes the message', () => {
    expect(buildWhatsAppUrl('56912345678', 'Pedido #CO-260806-0001 ¿confirmas?')).toBe(
      'https://wa.me/56912345678?text=Pedido%20%23CO-260806-0001%20%C2%BFconfirmas%3F',
    );
  });
});
