export const BRAND_ENTRANCE = Object.freeze({ start: 3.15, duration: .38, initialScale: 1.45, minimumEnding: 4.5 });
export const ANIMATION_STYLES = Object.freeze([
  ['scale-out', 'Scale out'], ['scale-in', 'Scale in'], ['fade-in', 'Fade in'], ['instant', 'Instant'],
  ['slide-left', 'Slide from left'], ['slide-right', 'Slide from right'],
  ['slide-top', 'Slide from top'], ['slide-bottom', 'Slide from bottom'],
]);
export const animationDefaults = () => ({ style: 'scale-out', duration: BRAND_ENTRANCE.duration, delay: 0, easing: 'snappy', scaleIn: 0, scaleOut: BRAND_ENTRANCE.initialScale * 100, distance: 100 });
const settings = animation => ({ ...animationDefaults(), ...animation });

export function endingBrandPose(time, animation) {
  const a = settings(animation), elapsed = time - BRAND_ENTRANCE.start - a.delay;
  if (elapsed < -1e-9) return { scale: 0, x: 0, y: 0, opacity: 0 };
  const progress = a.style === 'instant' ? 1 : Math.max(0, Math.min(1, elapsed / a.duration));
  const pose = { scale: 1, x: 0, y: 0, opacity: 1 };
  if (progress === 1) return pose;
  const p = a.easing === 'linear' ? progress : a.easing === 'smooth'
    ? progress ** 3 * (progress * (progress * 6 - 15) + 10) : 1 - (1 - progress) ** 3;
  if (a.style === 'scale-out') pose.scale = 1 + (a.scaleOut / 100 - 1) * (1 - p);
  if (a.style === 'scale-in') pose.scale = a.scaleIn / 100 + (1 - a.scaleIn / 100) * p;
  if (a.style === 'fade-in') pose.opacity = p;
  if (a.style === 'slide-left') pose.x = -1080 * a.distance / 100 * (1 - p);
  if (a.style === 'slide-right') pose.x = 1080 * a.distance / 100 * (1 - p);
  if (a.style === 'slide-top') pose.y = -1920 * a.distance / 100 * (1 - p);
  if (a.style === 'slide-bottom') pose.y = 1920 * a.distance / 100 * (1 - p);
  return pose;
}
export const endingBrandScale = time => endingBrandPose(time).scale;
export function endingDuration(ending) {
  const layers = [...(ending.labels || []).filter(label => label.text), ending.brand, ending.link].filter(layer => layer && layer.enabled !== false);
  return Math.max(BRAND_ENTRANCE.minimumEnding, ...layers.map(layer => {
    const a = settings(layer.animation);
    return BRAND_ENTRANCE.start + a.delay + (a.style === 'instant' ? 0 : a.duration) + .4;
  }));
}
export function paintEndingLayer(ctx, layer, pose, paint) {
  if (pose.scale <= 0 || pose.opacity <= 0) return;
  const x = layer.x * 1080, y = layer.y * 1920;
  ctx.save(); ctx.translate(x + pose.x, y + pose.y); ctx.scale(pose.scale, pose.scale); ctx.translate(-x, -y);
  ctx.globalAlpha *= pose.opacity; paint(pose.opacity); ctx.restore();
}
