/** Rasterize text locally so FFmpeg receives a PNG, never untrusted filter syntax. */
export function taglineOverlay(width: number, height: number, text: string): string {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;
  const margin = Math.round(Math.min(width, height) * 0.06);
  const maxWidth = width - margin * 2;
  let fontSize = Math.round(Math.min(width, height) * 0.075);
  let lines: string[] = [];
  // Character wrapping also handles a long single word and scripts without spaces.
  for (; fontSize >= 8; fontSize--) {
    ctx.font = `600 ${fontSize}px Inter, sans-serif`;
    lines = [''];
    for (const char of Array.from(text.replace(/\s+/g, ' ').trim())) {
      const last = lines.length - 1;
      if (lines[last] && ctx.measureText(lines[last] + char).width > maxWidth) lines.push(char.trimStart());
      else lines[last] += char;
    }
    if (lines.length <= 3) break;
  }
  const lineHeight = Math.ceil(fontSize * 1.3);
  const boxHeight = lines.length * lineHeight + margin * 2;
  const top = height - boxHeight;
  ctx.fillStyle = 'rgba(0,0,0,0.72)';
  ctx.fillRect(0, top, width, boxHeight);
  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  lines.forEach((line, i) => ctx.fillText(line.trim(), width / 2, top + margin + (i + 0.5) * lineHeight, maxWidth));
  return canvas.toDataURL('image/png');
}
