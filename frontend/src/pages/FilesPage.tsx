import { ChangeEvent, useEffect, useState } from "react";
import { callBff } from "../lib/api/client";
import type { AppFile } from "../lib/api/types";
import { Card } from "../components/ui/Card";
import { ErrorMessage } from "../components/ui/ErrorMessage";
import { PageHeader } from "../components/ui/PageHeader";
import { Spinner } from "../components/ui/Spinner";

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result ?? "");
      const base64 = result.includes(",") ? result.split(",")[1] : result;
      resolve(base64);
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

export function FilesPage() {
  const [files, setFiles] = useState<AppFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  async function load() {
    setLoading(true);
    setError(null);
    const res = await callBff<{ files: AppFile[] }>({ action: "list_files" });
    setLoading(false);
    if (!res.success) {
      setError(res.error.message);
      return;
    }
    setFiles(res.data.files ?? []);
  }

  useEffect(() => {
    load();
  }, []);

  async function onUpload(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setError(null);
    try {
      const content_base64 = await fileToBase64(file);
      const res = await callBff<{ file: AppFile }>({
        action: "upload_file",
        filename: file.name,
        content_base64,
      });
      if (!res.success) setError(res.error.message);
      else await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Files" description="Tenant storage via sandbox file capability." />

      <Card title="Upload (prototype)">
        <label className="inline-flex cursor-pointer items-center gap-2 text-sm">
          <span className="inline-flex items-center justify-center rounded-lg border border-border bg-bg px-4 py-2 text-sm font-medium text-text hover:bg-bg-subtle">
            {uploading ? "Uploading…" : "Choose file"}
          </span>
          <input type="file" className="hidden" onChange={onUpload} disabled={uploading} />
        </label>
        <p className="mt-2 text-micro text-text-muted">
          Small files only — encoded as base64 in the BFF payload for demo purposes.
        </p>
      </Card>

      <Card title="Stored files">
        {loading ? (
          <Spinner />
        ) : error ? (
          <ErrorMessage message={error} />
        ) : files.length === 0 ? (
          <p className="text-sm text-text-muted">No files listed yet.</p>
        ) : (
          <ul className="divide-y divide-border-subtle text-sm">
            {files.map((f, i) => (
              <li key={f.storage_path ?? i} className="py-3">
                <div className="font-medium">{f.filename}</div>
                <div className="font-mono text-micro text-text-muted">{f.storage_path}</div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
