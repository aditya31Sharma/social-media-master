export async function downloadStories(stories) {
  const files = await Promise.all(stories.map(async story => {
    const canvas = document.createElement('canvas');
    canvas.width = story.canvas.width; canvas.height = story.canvas.height;
    canvas.getContext('2d').drawImage(story.canvas, 0, 0);
    const name = `story-${story.id}-${story.username}-${story.time}${story.unit}.webp`;
    const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/webp', .95));
    if (!blob || blob.type !== 'image/webp') throw new Error('WebP export is unavailable in this browser. Try Chrome or Safari.');
    return { blob, name };
  }));
  for (const [index, file] of files.entries()) {
    if (index) await new Promise(resolve => setTimeout(resolve, 250));
    const url = URL.createObjectURL(file.blob), link = document.createElement('a');
    link.href = url; link.download = file.name;
    document.body.append(link); link.click(); link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  }
  return files.length;
}
