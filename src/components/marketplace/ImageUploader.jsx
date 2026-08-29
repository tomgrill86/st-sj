import { UploadCloud, X } from 'lucide-react';
import { useRef, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Image } from '@/components/ui/image';
import { Button } from '@/components/ui/button';

// Uploads images via Base44 file storage and returns public URLs.
export default function ImageUploader({ images = [], onChange, max = 8 }) {
  const inputRef = useRef(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');

  const handleFiles = async (files) => {
    const remaining = max - images.length;
    const toUpload = Array.from(files).slice(0, remaining);
    if (!toUpload.length) return;
    setUploading(true);
    setError('');
    try {
      const urls = [];
      for (const file of toUpload) {
        const { file_url } = await base44.integrations.Core.UploadFile({ file });
        urls.push(file_url);
      }
      onChange([...images, ...urls]);
    } catch (e) {
      setError('Upload failed. Please try again.');
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  const remove = (idx) => {
    const next = [...images];
    next.splice(idx, 1);
    onChange(next);
  };

  const moveUp = (idx) => {
    if (idx === 0) return;
    const next = [...images];
    [next[idx - 1], next[idx]] = [next[idx], next[idx - 1]];
    onChange(next);
  };

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
        {images.map((url, idx) => (
          <div key={idx} className="group relative aspect-square overflow-hidden rounded-xl border border-border bg-muted">
            <Image src={url} alt={`Image ${idx + 1}`} fittingType="fill" className="h-full w-full object-cover" />
            <button
              type="button"
              onClick={() => remove(idx)}
              className="absolute right-1.5 top-1.5 rounded-full bg-background/90 p-1 shadow-sm transition hover:bg-background"
              aria-label="Remove image"
            >
              <X className="h-3.5 w-3.5" />
            </button>
            {idx === 0 && (
              <span className="absolute bottom-1.5 left-1.5 rounded-md bg-background/90 px-1.5 py-0.5 text-[10px] font-medium">Cover</span>
            )}
            {idx > 0 && (
              <button
                type="button"
                onClick={() => moveUp(idx)}
                className="absolute bottom-1.5 right-1.5 rounded-md bg-background/90 px-1.5 py-0.5 text-[10px] font-medium opacity-0 transition group-hover:opacity-100"
              >
                Make cover
              </button>
            )}
          </div>
        ))}

        {images.length < max && (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={uploading}
            className="flex aspect-square flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border bg-muted/30 text-muted-foreground transition hover:border-ring hover:bg-muted/50 disabled:opacity-50"
          >
            <UploadCloud className="h-6 w-6" />
            <span className="text-xs font-medium">{uploading ? 'Uploading…' : 'Add image'}</span>
          </button>
        )}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => e.target.files?.length && handleFiles(e.target.files)}
      />

      {error && <p className="text-sm text-destructive">{error}</p>}
      <p className="text-xs text-muted-foreground">Upload up to {max} images. The first image is the cover. JPG/PNG/WebP.</p>
    </div>
  );
}