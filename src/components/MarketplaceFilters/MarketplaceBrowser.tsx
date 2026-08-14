"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
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

const ITEMS_PER_PAGE = 18;

type SortFilter = "NEWEST" | "OLDEST" | "MOST_EXPENSIVE" | "CHEAPEST";

const sortOptions: Array<{ label: string; value: SortFilter }> = [
    { label: "Newest", value: "NEWEST" },
    { label: "Oldest", value: "OLDEST" },
    { label: "Most Expensive", value: "MOST_EXPENSIVE" },
    { label: "Cheapest", value: "CHEAPEST" },
];

export default function MarketplaceBrowser({ items }: { items: ShopItem[] }) {
    const [search, setSearch] = useState("");
    const [rarity, setRarity] = useState<"ALL" | ItemRarity>("ALL");
    const [type, setType] = useState<"ALL" | ItemType>("ALL");
    const [stock, setStock] = useState<StockFilter>("ALL");
    const [sort, setSort] = useState<SortFilter>("NEWEST");
    const [page, setPage] = useState(1);

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

    // Apply sorting to filtered items
    const sortedItems = useMemo(() => {
        const sorted = [...filteredItems];
        
        switch (sort) {
            case "NEWEST":
                return sorted.sort((a, b) => 
                    (b.createdAt ? new Date(b.createdAt).getTime() : 0) - (a.createdAt ? new Date(a.createdAt).getTime() : 0)
                );
            case "OLDEST":
                return sorted.sort((a, b) => 
                    (a.createdAt ? new Date(a.createdAt).getTime() : 0) - (b.createdAt ? new Date(b.createdAt).getTime() : 0)
                );
            case "MOST_EXPENSIVE":
                return sorted.sort((a, b) => b.price - a.price);
            case "CHEAPEST":
                return sorted.sort((a, b) => a.price - b.price);
            default:
                return sorted;
        }
    }, [filteredItems, sort]);

    const totalPages = Math.max(1, Math.ceil(sortedItems.length / ITEMS_PER_PAGE));
    const currentPage = Math.min(page, totalPages);

    const pagedItems = useMemo(() => {
        const start = (currentPage - 1) * ITEMS_PER_PAGE;
        return sortedItems.slice(start, start + ITEMS_PER_PAGE);
    }, [sortedItems, currentPage]);

    function goToPage(nextPage: number) {
        setPage(Math.min(Math.max(nextPage, 1), totalPages));
    }

    function updateFilter<T>(setter: (value: T) => void) {
        return (value: T) => {
            setter(value);
            setPage(1);
        };
    }

    const handleSearchChange = updateFilter<string>(setSearch);
    const handleRarityChange = updateFilter<"ALL" | ItemRarity>(setRarity);
    const handleTypeChange = updateFilter<"ALL" | ItemType>(setType);
    const handleStockChange = updateFilter<StockFilter>(setStock);
    const handleSortChange = updateFilter<SortFilter>(setSort);

    return (
        <div className="marketplace-layout">
            <aside className="filter-panel" aria-label="Marketplace filters">
                <label>
                    <div className="filter-label-wrapper">
                    Search
                    <Image src="/Athiel-Searcher.gif" alt="Athiel" width={30} height={30} />
                    </div>
                    <input
                        value={search}
                        onChange={(event) => handleSearchChange(event.target.value)}
                        placeholder="Potion, armor, scroll..."
                    />
                </label>
                <label>
                    Rarity
                    <select value={rarity} onChange={(event) => handleRarityChange(event.target.value as "ALL" | ItemRarity)}>
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
                    <select value={stock} onChange={(event) => handleStockChange(event.target.value as StockFilter)}>
                        <option value="ALL">All stock</option>
                        <option value="IN_STOCK">In stock</option>
                        <option value="OUT_OF_STOCK">Out of stock</option>
                    </select>
                </label>

                <label>
                    Item type
                    <select value={type} onChange={(event) => handleTypeChange(event.target.value as "ALL" | ItemType)}>
                        <option value="ALL">All item types</option>
                        {typeOptions.map((option) => (
                            <option key={option.value} value={option.value}>
                                {option.label}
                            </option>
                        ))}
                    </select>
                </label>

                <label>
                    Sort by
                    <select value={sort} onChange={(event) => handleSortChange(event.target.value as SortFilter)}>
                        {sortOptions.map((option) => (
                            <option key={option.value} value={option.value}>
                                {option.label}
                            </option>
                        ))}
                    </select>
                </label>
            </aside>

            <section className="marketplace-results" aria-live="polite">
                <div className="section-heading">
                    <p>{sortedItems.length} item{sortedItems.length === 1 ? "" : "s"} found</p>
                </div>
                <div className="item-grid">
                    {pagedItems.map((item) => (
                        <ItemCard key={item.id} item={item} />
                    ))}
                </div>

                {totalPages > 1 ? (
                    <nav className="pagination" aria-label="Marketplace pagination">
                        <button
                            type="button"
                            onClick={() => goToPage(currentPage - 1)}
                            disabled={currentPage === 1}
                        >
                            Previous
                        </button>

                        {Array.from({ length: totalPages }, (_, index) => index + 1).map((pageNumber) => (
                            <button
                                type="button"
                                key={pageNumber}
                                className={pageNumber === currentPage ? "active" : ""}
                                onClick={() => goToPage(pageNumber)}
                                aria-current={pageNumber === currentPage ? "page" : undefined}
                            >
                                {pageNumber}
                            </button>
                        ))}

                        <button
                            type="button"
                            onClick={() => goToPage(currentPage + 1)}
                            disabled={currentPage === totalPages}
                        >
                            Next
                        </button>

                        <span className="pagination__status">
                            Page {currentPage} of {totalPages}
                        </span>
                    </nav>
                ) : null}
            </section>
        </div>
    );
}
