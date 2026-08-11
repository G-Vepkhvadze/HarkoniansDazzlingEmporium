"use client";

import { useMemo, useState } from "react";
import ItemCard from "@/components/ItemCard/ItemCard";
import type { ItemRarity, ItemType, ShopItem } from "@/types/items";

const rarityOptions: Array<{ label: string; value: ItemRarity }> = [
    { label: "Common", value: "COMMON" },
    { label: "Uncommon", value: "UNCOMMON" },
    { label: "Rare", value: "RARE" },
    { label: "Very Rare", value: "VERY_RARE" },
    { label: "Legendary", value: "LEGENDARY" },
];

const typeOptions: Array<{ label: string; value: ItemType }> = [
    { label: "Weapon", value: "WEAPON" },
    { label: "Armor", value: "ARMOR" },
    { label: "Accessory", value: "ACCESSORY" },
    { label: "Scrolls", value: "SCROLL" },
    { label: "Potions", value: "POTION" },
];

type StockFilter = "ALL" | "IN_STOCK" | "OUT_OF_STOCK";

export default function MarketplaceBrowser({ items }: { items: ShopItem[] }) {
    const [search, setSearch] = useState("");
    const [rarity, setRarity] = useState<"ALL" | ItemRarity>("ALL");
    const [type, setType] = useState<"ALL" | ItemType>("ALL");
    const [stock, setStock] = useState<StockFilter>("ALL");

    const filteredItems = useMemo(() => {
        const normalizedSearch = search.trim().toLowerCase();

        return items.filter((item) => {
            const matchesSearch =
                item.name.toLowerCase().includes(normalizedSearch) ||
                item.description.toLowerCase().includes(normalizedSearch);
            const matchesRarity = rarity === "ALL" || item.rarity === rarity;
            const matchesType = type === "ALL" || item.type === type;
            const matchesStock =
                stock === "ALL" ||
                (stock === "IN_STOCK" && item.stock > 0) ||
                (stock === "OUT_OF_STOCK" && item.stock === 0);

            return matchesSearch && matchesRarity && matchesType && matchesStock;
        });
    }, [items, rarity, search, stock, type]);

    return (
        <div className="marketplace-layout">
            <aside className="filter-panel" aria-label="Marketplace filters">
                <label>
                    Search
                    <input
                        value={search}
                        onChange={(event) => setSearch(event.target.value)}
                        placeholder="Potion, armor, scroll..."
                    />
                </label>

                <label>
                    Rarity
                    <select value={rarity} onChange={(event) => setRarity(event.target.value as "ALL" | ItemRarity)}>
                        <option value="ALL">All rarities</option>
                        {rarityOptions.map((option) => (
                            <option key={option.value} value={option.value}>
                                {option.label}
                            </option>
                        ))}
                    </select>
                </label>

                <label>
                    Stock
                    <select value={stock} onChange={(event) => setStock(event.target.value as StockFilter)}>
                        <option value="ALL">All stock</option>
                        <option value="IN_STOCK">In stock</option>
                        <option value="OUT_OF_STOCK">Out of stock</option>
                    </select>
                </label>

                <label>
                    Item type
                    <select value={type} onChange={(event) => setType(event.target.value as "ALL" | ItemType)}>
                        <option value="ALL">All item types</option>
                        {typeOptions.map((option) => (
                            <option key={option.value} value={option.value}>
                                {option.label}
                            </option>
                        ))}
                    </select>
                </label>
            </aside>

            <section className="marketplace-results" aria-live="polite">
                <div className="section-heading">
                    <p>{filteredItems.length} item{filteredItems.length === 1 ? "" : "s"} found</p>
                </div>
                <div className="item-grid">
                    {filteredItems.map((item) => (
                        <ItemCard key={item.id} item={item} />
                    ))}
                </div>
            </section>
        </div>
    );
}
