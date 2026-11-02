import { FormEvent, useEffect, useState } from "react";
import { callBff } from "../lib/api/client";
import type { AppItem } from "../lib/api/types";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { ErrorMessage } from "../components/ui/ErrorMessage";
import { PageHeader } from "../components/ui/PageHeader";
import { Spinner } from "../components/ui/Spinner";

export function ItemsPage() {
  const [items, setItems] = useState<AppItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [creating, setCreating] = useState(false);

  async function load() {
    setLoading(true);
    setError(null);
    const res = await callBff<{ items: AppItem[]; _prototype?: boolean }>({
      action: "list_items",
      limit: 50,
    });
    setLoading(false);
    if (!res.success) {
      setError(res.error.message);
      return;
    }
    setItems(res.data.items ?? []);
  }

  useEffect(() => {
    load();
  }, []);

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    setCreating(true);
    const res = await callBff<{ item: AppItem }>({
      action: "create_item",
      title: title.trim(),
      description: "Created from app model prototype",
    });
    setCreating(false);
    if (!res.success) {
      setError(res.error.message);
      return;
    }
    setTitle("");
    await load();
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Items"
        description="DataPool prototype — schema app_model_items"
      />

      <Card title="Create item (prototype)">
        <form onSubmit={onCreate} className="flex flex-wrap gap-2">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Item title"
            className="form-input min-w-[200px] flex-1"
          />
          <Button type="submit" disabled={creating}>
            {creating ? "Creating…" : "Create"}
          </Button>
        </form>
      </Card>

      <Card title="List">
        {loading ? (
          <Spinner />
        ) : error ? (
          <ErrorMessage message={error} />
        ) : items.length === 0 ? (
          <p className="text-body text-text-muted">No items yet. Create one above.</p>
        ) : (
          <ul className="divide-y divide-border-subtle">
            {items.map((item, i) => (
              <li key={item.data_id ?? i} className="flex justify-between py-3 text-body">
                <div>
                  <div className="font-medium">{item.title}</div>
                  {item.description ? (
                    <div className="text-text-muted">{item.description}</div>
                  ) : null}
                </div>
                <span className="rounded-full bg-bg-muted px-2 py-0.5 text-micro text-text-secondary">
                  {item.status}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
