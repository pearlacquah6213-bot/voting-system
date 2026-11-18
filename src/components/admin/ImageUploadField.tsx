import { useRef, useState, type ChangeEvent } from 'react';
import { Upload, X } from 'lucide-react';
import { toast } from 'sonner';
import { uploadImageFile } from '../../lib/api';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { SafeImage } from '../ui/SafeImage';

interface ImageUploadFieldProps {
  label: string;
  value: string;
  onChange: (url: string) => void;
  aspectClass?: string;
}

export function ImageUploadField({
  label,
  value,
  onChange,
  aspectClass = 'h-32 w-32',
}: ImageUploadFieldProps) {
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [uploading, setUploading] = useState(false);
  const [localPreview, setLocalPreview] = useState<string | null>(null);

  const handleFileChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const allowed = ['image/jpeg', 'image/png', 'image/webp'];
    if (!allowed.includes(file.type)) {
      toast.error('Invalid format. Please choose a JPEG, PNG, or WEBP image.');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error('File exceeds 5 MB limit.');
      return;
    }

    const previewUrl = URL.createObjectURL(file);
    setLocalPreview(previewUrl);
    setUploading(true);
    try {
      const uploaded = await uploadImageFile(file);
      onChange(uploaded.url);
      toast.success('Image uploaded and verified.');
    } catch (err: unknown) {
      setLocalPreview(null);
      toast.error(err instanceof Error ? err.message : 'Image upload failed.');
    } finally {
      setUploading(false);
    }
  };

  const displaySrc = localPreview || value;

  return (
    <div className="space-y-2">
      <label className="text-xs font-semibold text-slate-700">{label}</label>
      <div className="flex items-start gap-4">
        <div
          className={`${aspectClass} rounded-md border border-slate-200 overflow-hidden bg-slate-100 shrink-0 relative`}
        >
          <SafeImage src={displaySrc} alt={label} className="w-full h-full object-cover" />
          {displaySrc && (
            <button
              type="button"
              onClick={() => {
                setLocalPreview(null);
                onChange('');
              }}
              aria-label="Clear image"
              className="absolute top-1.5 right-1.5 h-6 w-6 rounded-full bg-[#0B192C]/80 text-white inline-flex items-center justify-center hover:bg-red-600 cursor-pointer"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        <div className="flex-1 space-y-2">
          <input
            ref={fileRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={handleFileChange}
            className="hidden"
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={uploading}
            onClick={() => fileRef.current?.click()}
          >
            <Upload className="h-3.5 w-3.5" />
            {uploading ? 'Uploading...' : displaySrc ? 'Replace Image' : 'Upload Image'}
          </Button>
          <Input
            value={value}
            onChange={(e) => {
              setLocalPreview(null);
              onChange(e.target.value);
            }}
            placeholder="Or paste /uploads/... or /src/assets/... image path"
            className="text-xs h-9"
          />
          <p className="text-[11px] text-slate-400">
            JPEG, PNG, or WEBP up to 5 MB. Live preview shown before saving.
          </p>
        </div>
      </div>
    </div>
  );
}
