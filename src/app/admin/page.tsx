"use client";
import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

interface ItemRow {
  id: string;
  image: string;
  name: string;
  description: string;
  rarity: string;
  type: string;
  deal: boolean;
  discountPercent: number;
  stock: number;
}

export default function AdminPage() {
  const router = useRouter();
  const [items, setItems] = useState<ItemRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [newItem, setNewItem] = useState<any>({ image: "", name: "", description: "", rarity: "COMMON", type: "POTION", deal: false, discountPercent: 0, stock: 1 });

  useEffect(() => {
    const isAdmin = typeof window !== 'undefined' && localStorage.getItem("isAdmin") === "true";
    if (!isAdmin) router.push('/auth');
    else loadItems();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadItems() {
    setLoading(true);
    const res = await fetch('/api/items');
    const data = await res.json();
    setItems(data || []);
    setLoading(false);
  }

  async function saveItem(item: ItemRow) {
    await fetch('/api/items', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(item) });
    await loadItems();
  }

  async function deleteItem(id: string) {
    if (!confirm('Are you sure you want to delete this item?')) return;
    await fetch(`/api/items?id=${id}`, { method: 'DELETE' });
    await loadItems();
  }

  async function uploadImage(file: File) {
    const fd = new FormData();
    fd.append('file', file);
    const res = await fetch('/api/upload', { method: 'POST', body: fd });
    const data = await res.json();
    return data.path; // e.g., /ItemImages/filename.png
  }

  async function handleImageChange(e: React.ChangeEvent<HTMLInputElement>, item: ItemRow) {
    const f = e.target.files?.[0];
    if (!f) return;
    const path = await uploadImage(f);
    item.image = path;
    setItems((s) => s.map((it) => (it.id === item.id ? { ...it, image: path } : it)));
  }

  function updateField(id: string, key: string, value: any) {
    setItems((s) => s.map((it) => (it.id === id ? { ...it, [key]: value } : it)));
  }

  async function addNewItem(e: React.FormEvent) {
    e.preventDefault();
    // validate required fields except image
    const required = ["name", "description", "rarity", "type", "stock"];
    for (const k of required) {
      if (!newItem[k]) {
        alert(`${k} is required`);
        return;
      }
    }
    const payload = { ...newItem };
    const res = await fetch('/api/items', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    if (res.ok) {
      setNewItem({ image: "", name: "", description: "", rarity: "COMMON", type: "POTION", deal: false, discountPercent: 0, stock: 1 });
      setShowAdd(false);
      await loadItems();
    } else {
      alert('Failed to add item');
    }
  }

  if (loading) return <div style={{padding: '2rem'}}>Loading…</div>;

  return (
    <div className="admin-page">
      <h1>Admin — Item Manager</h1>
      <div style={{overflow: 'auto'}}>
        <table className="admin-table">
          <colgroup>
            <col style={{width: '56px'}} />
            <col style={{width: '16%'}} />
            <col style={{width: '50%'}} />
            <col style={{width: '8%'}} />
            <col style={{width: '6%'}} />
            <col style={{width: '4%'}} />
            <col style={{width: '4%'}} />
            <col style={{width: '4%'}} />
            <col style={{width: '6%'}} />
          </colgroup>
          <thead>
            <tr>
              <th className="image">Image</th>
              <th className="name">Name</th>
              <th className="description">Description</th>
              <th className="rarity">Rarity</th>
              <th className="type">Type</th>
              <th className="deal">Deal</th>
              <th className="discount">Discount %</th>
              <th className="stock">Stock</th>
              <th className="actions">Actions</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id}>
                <td className="image">
                  <label className="admin-image-uploader" title={`Upload image for ${item.name}`}>
                    {item.image ? (
                      <img src={item.image} alt={item.name || ""} />
                    ) : (
                      <div className="admin-image-placeholder">?</div>
                    )}
                    <input aria-label={`Upload image for ${item.name}`} type="file" accept="image/*" onChange={(e) => handleImageChange(e, item)} />
                  </label>
                </td>
                <td className="name"><input value={item.name} onChange={(e) => updateField(item.id, 'name', e.target.value)} /></td>
                <td className="description"><input value={item.description} onChange={(e) => updateField(item.id, 'description', e.target.value)} /></td>
                <td className="rarity">
                  <select value={item.rarity} onChange={(e) => updateField(item.id, 'rarity', e.target.value)}>
                    <option value="COMMON">COMMON</option>
                    <option value="UNCOMMON">UNCOMMON</option>
                    <option value="RARE">RARE</option>
                    <option value="VERY_RARE">VERY_RARE</option>
                    <option value="LEGENDARY">LEGENDARY</option>
                  </select>
                </td>
                <td className="type">
                  <select value={item.type} onChange={(e) => updateField(item.id, 'type', e.target.value)}>
                    <option value="WEAPON">WEAPON</option>
                    <option value="ARMOR">ARMOR</option>
                    <option value="ACCESSORY">ACCESSORY</option>
                    <option value="SCROLL">SCROLL</option>
                    <option value="POTION">POTION</option>
                  </select>
                </td>
                <td className="deal"><input type="checkbox" checked={item.deal} onChange={(e) => updateField(item.id, 'deal', e.target.checked)} /></td>
                <td className="discount"><input type="number" value={item.discountPercent ?? 0} onChange={(e) => updateField(item.id, 'discountPercent', Number(e.target.value))} /></td>
                <td className="stock"><input type="number" value={item.stock} onChange={(e) => updateField(item.id, 'stock', Number(e.target.value))} /></td>
                <td className="admin-actions">
                  <button onClick={() => saveItem(item)}>Save</button>
                  <button onClick={() => deleteItem(item.id)}>Delete</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div style={{marginTop: '1rem'}}>
        <button onClick={() => setShowAdd((s) => !s)}>{showAdd ? 'Cancel' : 'Add New Item'}</button>
      </div>

      {showAdd ? (
        <form onSubmit={addNewItem} style={{marginTop: '1rem', display: 'grid', gap: '0.5rem'}}> 
          <label>
            Name
            <input required value={newItem.name} onChange={(e) => setNewItem((s:any)=>({...s, name: e.target.value}))} />
          </label>
          <label>
            Description
            <input required value={newItem.description} onChange={(e) => setNewItem((s:any)=>({...s, description: e.target.value}))} />
          </label>
          <label>
            Rarity
            <select value={newItem.rarity} onChange={(e) => setNewItem((s:any)=>({...s, rarity: e.target.value}))}>
              <option value="COMMON">COMMON</option>
              <option value="UNCOMMON">UNCOMMON</option>
              <option value="RARE">RARE</option>
              <option value="VERY_RARE">VERY_RARE</option>
              <option value="LEGENDARY">LEGENDARY</option>
            </select>
          </label>
          <label>
            Type
            <select value={newItem.type} onChange={(e) => setNewItem((s:any)=>({...s, type: e.target.value}))}>
              <option value="WEAPON">WEAPON</option>
              <option value="ARMOR">ARMOR</option>
              <option value="ACCESSORY">ACCESSORY</option>
              <option value="SCROLL">SCROLL</option>
              <option value="POTION">POTION</option>
            </select>
          </label>
          <label>
            Deal
            <input type="checkbox" checked={newItem.deal} onChange={(e) => setNewItem((s:any)=>({...s, deal: e.target.checked}))} />
          </label>
          {newItem.deal ? (
            <label>
              Discount %
              <input type="number" value={newItem.discountPercent} onChange={(e) => setNewItem((s:any)=>({...s, discountPercent: Number(e.target.value)}))} />
            </label>
          ) : null}
          <label>
            Stock
            <input required type="number" value={newItem.stock} onChange={(e) => setNewItem((s:any)=>({...s, stock: Number(e.target.value)}))} />
          </label>
          <label>
            Image (optional)
            <input type="file" onChange={async (e)=>{
              const f = e.target.files?.[0];
              if (!f) return;
              const fd = new FormData(); fd.append('file', f);
              const res = await fetch('/api/upload', { method: 'POST', body: fd });
              const data = await res.json();
              setNewItem((s:any)=>({...s, image: data.path}));
            }} />
          </label>
          <div>
            <button type="submit">Add Item</button>
          </div>
        </form>
      ) : null}
    </div>
  );
}

