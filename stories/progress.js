export function drawProgress(ctx, value) {
  const percent = Math.max(0, Math.min(100, value));
  ctx.save();
  ctx.lineWidth = 5; ctx.lineCap = 'round';
  ctx.strokeStyle = 'rgba(255,255,255,.4)';
  ctx.beginPath(); ctx.moveTo(21, 26); ctx.lineTo(1059, 26); ctx.stroke();
  if (percent > 0) {
    ctx.strokeStyle = '#fff';
    ctx.beginPath(); ctx.moveTo(21, 26); ctx.lineTo(21 + 1038 * percent / 100, 26); ctx.stroke();
  }
  ctx.restore();
}
