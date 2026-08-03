import type { MetadataRoute } from 'next';

import { publicEnv } from '@/config/public-env';

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = publicEnv.NEXT_PUBLIC_APP_URL;

  return [{ url: baseUrl, changeFrequency: 'daily', priority: 1 }];
}
