import type { APIRoute } from 'astro';
import { imageConfig } from 'astro:assets';
import imageService from 'astro/assets/services/sharp';
import english from '../../assets/buyer-pack-en.svg?raw';
import russian from '../../assets/buyer-pack-ru.svg?raw';

export function getStaticPaths() {
  return [
    { params: { card: 'buyer-pack-en' }, props: { artwork: english } },
    { params: { card: 'buyer-pack-ru' }, props: { artwork: russian } },
  ];
}

export const GET: APIRoute = async ({ props, params }) => {
  // Only the two bundled vector artworks above reach the static renderer.
  const png = await imageService.transform(
    new TextEncoder().encode(props.artwork),
    { src: params.card + '.svg', format: 'png' },
    { ...imageConfig, dangerouslyProcessSVG: true },
  );
  return new Response(new Uint8Array(png.data), { headers: { 'Content-Type': 'image/png' } });
};
