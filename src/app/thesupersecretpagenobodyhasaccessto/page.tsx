"use client";
import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getImageUrl } from "@/lib/imageUrl";

interface ItemRow {
  id: string;
  image: string;
  name: string;
  description: string;
  rarity: string;
  type: string;
  price: number;
  deal: boolean;
  discountPercent: number;
  stock: number;
}

interface NewItem {
  image: string;
  name: string;
  description: string;
  rarity: string;
  type: string;
  price: string;
  deal: boolean;
  discountPercent: string;
  stock: string;
}

const RARITIES = ["COMMON", "UNCOMMON", "RARE", "VERY_RARE", "LEGENDARY"];
const TYPES = ["WEAPON", "ARMOR", "ACCESSORY", "SCROLL", "POTION"];

const emptyNewItem: NewItem = {
  image: "",
  name: "",
  description: "",
  rarity: "COMMON",
  type: "POTION",
  price: "",
  deal: false,
  discountPercent: "0",
  stock: "1",
};

export default function SecretAdminPage() {
  const router = useRouter();
  const [items, setItems] = useState<ItemRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [newItem, setNewItem] = useState<NewItem>(emptyNewItem);
  const [dirtyIds, setDirtyIds] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState<"success" | "error">("success");

  useEffect(() => {
    const isAdmin = typeof window !== "undefined" && localStorage.getItem("isAdmin") === "true";
    if (!isAdmin) router.push("/auth");
    else loadItems();
  }, []);

  async function loadItems() {
    setLoading(true);
    const res = await fetch("/api/items");
    const data = await res.json();
    setItems(Array.isArray(data) ? data : []);
    setLoading(false);
  }

  function flash(msg: string, type: "success" | "error" = "success") {
    setMessage(msg);
    setMessageType(type);
    setTimeout(() => setMessage(""), 3000);
  }

  async function uploadImage(file: File, itemName?: string) {
    const fd = new FormData();
    fd.append("file", file);
    if (itemName) fd.append("itemName", itemName);
    const res = await fetch("/api/upload", { method: "POST", body: fd });
    if (!res.ok) {
      let msg = "Upload failed";
      try {
        const err = await res.json();
        if (err?.error) msg = err.error;
      } catch {
      }
      throw new Error(msg);
    }
    const data = await res.json();
    return data.path;
  }

  async function handleImageChange(e: React.ChangeEvent<HTMLInputElement>, item: ItemRow) {
    const f = e.target.files?.[0];
    if (!f) return;
    try {
      const path = await uploadImage(f, item.name);
      updateField(item.id, "image", path);
      flash("Image uploaded");
    } catch (err) {
      flash(err instanceof Error ? err.message : "Upload failed", "error");
    } finally {
      e.target.value = "";
    }
  }

  function updateField(id: string, key: keyof ItemRow, value: string | number | boolean) {
    setItems((s) => s.map((it) => (it.id === id ? { ...it, [key]: value } : it)));
    setDirtyIds((prev) => new Set(prev).add(id));
  }

  const dirtyCount = dirtyIds.size;

  async function saveItem(item: ItemRow) {
    setSaving(true);
    try {
      const payload = { ...item, price: Number(item.price) || 0 };
      await fetch("/api/items", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      setDirtyIds((prev) => {
        const next = new Set(prev);
        next.delete(item.id);
        return next;
      });
      flash("Item saved");
      router.refresh();
    } catch {
      flash("Error saving item", "error");
    } finally {
      setSaving(false);
    }
  }

  async function saveAllChanges() {
    if (dirtyIds.size === 0) return;
    setSaving(true);
    const changedItems = items.filter((it) => dirtyIds.has(it.id));
    try {
      const res = await fetch("/api/items", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(changedItems.map((it) => ({ ...it, price: Number(it.price) || 0 }))),
      });
      if (!res.ok) throw new Error("Batch save failed");
      setDirtyIds(new Set());
      flash("All changes saved");
      router.refresh();
    } catch {
      flash("Failed to save changes", "error");
    } finally {
      setSaving(false);
    }
  }

  async function deleteItem(id: string) {
    if (!confirm("Are you sure you want to delete this item?")) return;
    await fetch(`/api/items?id=${id}`, { method: "DELETE" });
    setItems((s) => s.filter((it) => it.id !== id));
    setDirtyIds((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
    router.refresh();
  }

  function updateNewItem<K extends keyof NewItem>(key: K, value: NewItem[K]) {
    setNewItem((s) => ({ ...s, [key]: value }));
  }

  async function addNewItem(e: React.FormEvent) {
    e.preventDefault();
    const required: (keyof NewItem)[] = ["name", "description", "rarity", "type", "price", "stock"];
    for (const k of required) {
      const v = newItem[k];
      if (typeof v === "string" && !v.trim()) {
        alert(`${k} is required`);
        return;
      }
    }
    const price = Number(newItem.price);
    if (isNaN(price) || price < 0) {
      alert("Price must be 0 or greater");
      return;
    }
    const payload = {
      image: newItem.image,
      name: newItem.name.trim(),
      description: newItem.description.trim(),
      rarity: newItem.rarity,
      type: newItem.type,
      price,
      deal: newItem.deal,
      discountPercent: Number(newItem.discountPercent) || 0,
      stock: Number(newItem.stock) || 0,
    };
    const res = await fetch("/api/items", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (res.ok) {
      setNewItem(emptyNewItem);
      setShowAdd(false);
      await loadItems();
      flash("Item added");
      router.refresh();
    } else {
      alert("Failed to add item");
    }
  }

  if (loading) return <div style={{ padding: "2rem" }}>Loading…</div>;

  return (
    <div className="admin-page">
      <div className="admin-toolbar">
        <div>
          <h1>Admin — Item Manager</h1>
          <p className="admin-subtitle">
            {items.length} item{items.length === 1 ? "" : "s"} ·{" "}
            {dirtyCount > 0 ? `${dirtyCount} unsaved change${dirtyCount === 1 ? "" : "s"}` : "All changes saved"}
          </p>
        </div>
        <div className="admin-toolbar__actions">
          {dirtyCount > 0 ? (
            <button className="admin-btn admin-btn--primary" onClick={saveAllChanges} disabled={saving}>
              {saving ? "Saving…" : `Save All Changes (${dirtyCount})`}
            </button>
          ) : null}
          <button className="admin-btn" onClick={() => setShowAdd((s) => !s)}>
            {showAdd ? "Cancel" : "Add New Item"}
          </button>
        </div>
      </div>

      {message ? <div className={`admin-toast admin-toast--${messageType}`}>{message}</div> : null}

      <div style={{ overflow: "auto" }}>
        <table className="admin-table">
          <colgroup>
            <col style={{ width: "56px" }} />
            <col style={{ width: "12%" }} />
            <col style={{ width: "18%" }} />
            <col style={{ width: "8%" }} />
            <col style={{ width: "8%" }} />
            <col style={{ width: "8%" }} />
            <col style={{ width: "5%" }} />
            <col style={{ width: "6%" }} />
            <col style={{ width: "6%" }} />
            <col style={{ width: "10%" }} />
          </colgroup>
          <thead>
            <tr>
              <th className="image">Image</th>
              <th className="name">Name</th>
              <th className="description">Description</th>
              <th className="rarity">Rarity</th>
              <th className="type">Type</th>
              <th className="price">Price (Gold)</th>
              <th className="deal">Deal</th>
              <th className="discount">Disc%</th>
              <th className="stock">Stock</th>
              <th className="actions">Actions</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id} className={dirtyIds.has(item.id) ? "row-dirty" : ""}>
                <td className="image">
                  <label className="admin-image-uploader" title={`Upload image for ${item.name || "item"}`}>
                    {item.image ? (
                      <img src={getImageUrl(item.image)} alt={item.name || ""} />
                    ) : (
                      <div className="admin-image-placeholder">?</div>
                    )}
                    <input aria-label={`Upload image for ${item.name || "item"}`} type="file" accept="image/*" onChange={(e) => handleImageChange(e, item)} />
                  </label>
                </td>
                <td className="name">
                  <input value={item.name} onChange={(e) => updateField(item.id, "name", e.target.value)} />
                </td>
                <td className="description">
                  <textarea value={item.description} onChange={(e) => updateField(item.id, "description", e.target.value)} />
                </td>
                <td className="rarity">
                  <select value={item.rarity} onChange={(e) => updateField(item.id, "rarity", e.target.value)}>
                    {RARITIES.map((r) => <option key={r} value={r}>{r}</option>)}
                  </select>
                </td>
                <td className="type">
                  <select value={item.type} onChange={(e) => updateField(item.id, "type", e.target.value)}>
                    {TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                  </select>
                </td>
                <td className="price">
                  <input
                    type="number"
                    min="0"
                    value={item.price}
                    onChange={(e) => updateField(item.id, "price", Number(e.target.value))}
                  />
                </td>
                <td className="deal">
                  <input type="checkbox" checked={item.deal} onChange={(e) => updateField(item.id, "deal", e.target.checked)} />
                </td>
                <td className="discount">
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={item.discountPercent ?? 0}
                    onChange={(e) => updateField(item.id, "discountPercent", Number(e.target.value))}
                  />
                </td>
                <td className="stock">
                  <input
                    type="number"
                    min="0"
                    value={item.stock}
                    onChange={(e) => updateField(item.id, "stock", Number(e.target.value))}
                  />
                </td>
                <td className="admin-actions">
                  {dirtyIds.has(item.id) ? (
                    <button className="admin-btn admin-btn--small" onClick={() => saveItem(item)} disabled={saving}>
                      Save
                    </button>
                  ) : null}
                  <button className="admin-btn admin-btn--small admin-btn--danger" onClick={() => deleteItem(item.id)}>
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {items.length === 0 ? <p className="admin-empty">No items yet — add your first item.</p> : null}

      {showAdd ? (
        <form onSubmit={addNewItem} className="admin-add-form">
          <h2>Add New Item</h2>
          <div className="admin-add-form__grid">
            <label>
              Name <span className="req">*</span>
              <input required value={newItem.name} onChange={(e) => updateNewItem("name", e.target.value)} />
            </label>
            <label>
              Rarity <span className="req">*</span>
              <select value={newItem.rarity} onChange={(e) => updateNewItem("rarity", e.target.value)}>
                {RARITIES.map((r) => <option key={r} value={r}>{r}</option>)}
              </select>
            </label>
            <label>
              Type <span className="req">*</span>
              <select value={newItem.type} onChange={(e) => updateNewItem("type", e.target.value)}>
                {TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </label>
            <label>
              Price (Gold) <span className="req">*</span>
              <input required type="number" min="0" value={newItem.price} onChange={(e) => updateNewItem("price", e.target.value)} />
            </label>
            <label>
              Stock <span className="req">*</span>
              <input required type="number" min="0" value={newItem.stock} onChange={(e) => updateNewItem("stock", e.target.value)} />
            </label>
            <label className="checkbox-field">
              <input type="checkbox" checked={newItem.deal} onChange={(e) => updateNewItem("deal", e.target.checked)} />
              Deal
            </label>
            {newItem.deal ? (
              <label>
                Discount %
                <input type="number" min="0" max="100" value={newItem.discountPercent} onChange={(e) => updateNewItem("discountPercent", e.target.value)} />
              </label>
            ) : null}
            <label className="full-span">
              Description <span className="req">*</span>
              <textarea required rows={3} value={newItem.description} onChange={(e) => updateNewItem("description", e.target.value)} />
            </label>
            <label className="full-span">
              Image (optional)
              <input
                type="file"
                accept="image/*"
                onChange={async (e) => {
                  const f = e.target.files?.[0];
                  if (!f) return;
                  try {
                    const path = await uploadImage(f, newItem.name);
                    updateNewItem("image", path);
                    flash("Image uploaded");
                  } catch (err) {
                    flash(err instanceof Error ? err.message : "Upload failed", "error");
                  } finally {
                    e.target.value = "";
                  }
                }}
              />
              {newItem.image ? (
                <img
                  src={getImageUrl(newItem.image)}
                  alt="New item image preview"
                  style={{ maxWidth: "120px", maxHeight: "120px", marginTop: "0.5rem", borderRadius: "8px" }}
                />
              ) : null}
            </label>
          </div>
          <div className="admin-add-form__actions">
            <button type="submit" className="admin-btn admin-btn--primary">Add Item</button>
          </div>
        </form>
      ) : null}
    </div>
  );
}