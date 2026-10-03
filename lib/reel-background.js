// Figma H8vihtRHHXMz32hzHMQ09s, node4990:13948.
// CSS linear-gradient(225deg, #f2f2f2 0%, #c6c9cc 100%).
export const REEL_LOGO_COLOR = '#aaaaaa';

export function paintReelBackground(ctx, width, height) {
  // CSS projects the rectangle onto the gradient axis, rather than joining corners.
  const reach = (width + height) / 4;
  const gradient = ctx.createLinearGradient(
    width / 2 + reach, height / 2 - reach,
    width / 2 - reach, height / 2 + reach,
  );
  gradient.addColorStop(0, '#f2f2f2');
  gradient.addColorStop(1, '#c6c9cc');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);
}
