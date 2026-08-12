import React, { useCallback, useRef, useState } from 'react';
import {
  Upload,
  FileSpreadsheet,
  FileText,
  X,
  CheckCircle2,
  Loader2,
  Save,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import PageHeader from '@/components/common/PageHeader';
import { storageService } from '@/services';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

const ACCEPTED_EXTENSIONS = ['.xlsx', '.xls', '.csv', '.ods', '.tsv'];
const ACCEPTED_ACCEPT =
  '.xlsx,.xls,.csv,.ods,.tsv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,text/csv,application/vnd.oasis.opendocument.spreadsheet,text/tab-separated-values';
const MAX_FILE_SIZE_MB = 25;

function getExtension(filename = '') {
  const idx = filename.lastIndexOf('.');
  return idx >= 0 ? filename.slice(idx).toLowerCase() : '';
}

function formatBytes(bytes) {
  if (!bytes && bytes !== 0) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function isAcceptedFile(file) {
  const ext = getExtension(file?.name);
  return ACCEPTED_EXTENSIONS.includes(ext);
}

export default function DataUpload() {
  const inputRef = useRef(null);
  const [isDragging, setIsDragging] = useState(false);
  const [file, setFile] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const [savedUrl, setSavedUrl] = useState('');
  const [savedFileName, setSavedFileName] = useState('');

  const resetSelection = useCallback(() => {
    setFile(null);
    setSavedUrl('');
    setSavedFileName('');
    if (inputRef.current) inputRef.current.value = '';
  }, []);

  const handleFile = useCallback((selected) => {
    if (!selected) return;

    if (!isAcceptedFile(selected)) {
      toast.error(`Unsupported format. Allowed: ${ACCEPTED_EXTENSIONS.join(', ')}`);
      return;
    }

    if (selected.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
      toast.error(`File is too large. Max size is ${MAX_FILE_SIZE_MB} MB.`);
      return;
    }

    setFile(selected);
    setSavedUrl('');
    setSavedFileName('');
  }, []);

  const onDrop = useCallback(
    (e) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(false);
      const dropped = e.dataTransfer?.files?.[0];
      if (dropped) handleFile(dropped);
    },
    [handleFile]
  );

  const handleSave = async () => {
    if (!file) {
      toast.error('Please select a file first');
      return;
    }

    setIsSaving(true);
    try {
      const result = await storageService.uploadFile(file, 'uploads', 'data-uploads', {
        keepOriginalName: true,
      });
      setSavedUrl(result.file_url);
      setSavedFileName(result.file_name || file.name);
      toast.success(`Saved as ${result.file_name || file.name}`);
    } catch (err) {
      console.error('Save error:', err);
      toast.error(err?.message || 'Failed to save file to Supabase');
    } finally {
      setIsSaving(false);
    }
  };

  const FileIcon =
    getExtension(file?.name) === '.csv' || getExtension(file?.name) === '.tsv'
      ? FileText
      : FileSpreadsheet;

  return (
    <div className="space-y-6 max-w-5xl">
      <PageHeader
        title="Data Upload"
        subtitle="Upload spreadsheet files (.xlsx, .xls, .csv, and more)"
      />

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Upload className="w-5 h-5 text-primary" />
            Upload file
          </CardTitle>
          <CardDescription>
            Drag and drop a file here, or browse to select one. Supported formats:{' '}
            {ACCEPTED_EXTENSIONS.join(', ')}. Click Save to store it in Supabase.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                inputRef.current?.click();
              }
            }}
            onDragEnter={(e) => {
              e.preventDefault();
              setIsDragging(true);
            }}
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragging(true);
            }}
            onDragLeave={(e) => {
              e.preventDefault();
              setIsDragging(false);
            }}
            onDrop={onDrop}
            onClick={() => inputRef.current?.click()}
            className={cn(
              'flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed px-6 py-12 text-center cursor-pointer transition-colors',
              isDragging
                ? 'border-primary bg-primary/5'
                : 'border-gray-300 hover:border-primary/50 hover:bg-gray-50'
            )}
          >
            <div className="rounded-full bg-primary/10 p-3">
              <Upload className="w-6 h-6 text-primary" />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-900">
                Drop your file here, or click to browse
              </p>
              <p className="mt-1 text-xs text-gray-500">
                .xlsx, .xls, .csv, .ods, .tsv · up to {MAX_FILE_SIZE_MB} MB
              </p>
            </div>
            <input
              ref={inputRef}
              type="file"
              className="hidden"
              accept={ACCEPTED_ACCEPT}
              onChange={(e) => handleFile(e.target.files?.[0])}
            />
          </div>

          {file && (
            <div className="flex flex-col sm:flex-row sm:items-center gap-3 rounded-xl border bg-white p-4">
              <div className="flex items-center gap-3 min-w-0 flex-1">
                <div className="rounded-lg bg-emerald-50 p-2 shrink-0">
                  <FileIcon className="w-5 h-5 text-emerald-700" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{file.name}</p>
                  <p className="text-xs text-gray-500">{formatBytes(file.size)}</p>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Badge variant="secondary" className="uppercase">
                  {getExtension(file.name).replace('.', '') || 'file'}
                </Badge>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={resetSelection}
                  aria-label="Remove file"
                  disabled={isSaving}
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
            </div>
          )}

          {savedUrl && (
            <div className="flex items-start gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
              <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0" />
              <div className="min-w-0">
                <p className="font-medium">Saved to Supabase as {savedFileName}</p>
                <a
                  href={savedUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs underline break-all"
                >
                  {savedUrl}
                </a>
              </div>
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            <Button type="button" onClick={handleSave} disabled={!file || isSaving}>
              {isSaving ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Saving…
                </>
              ) : (
                <>
                  <Save className="w-4 h-4 mr-2" />
                  Save
                </>
              )}
            </Button>
            {file && (
              <Button type="button" variant="outline" onClick={resetSelection} disabled={isSaving}>
                Clear
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
