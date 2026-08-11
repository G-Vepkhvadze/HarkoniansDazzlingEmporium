"use client";
import React, { useState } from "react";
import type { ShopItem } from "@/types/items";

const rarityLabels: Record<ShopItem["rarity"], string> = {
    COMMON: "Common",
    UNCOMMON: "Uncommon",
    RARE: "Rare",
    VERY_RARE: "Very Rare",
    LEGENDARY: "Legendary",
};

const typeLabels: Record<ShopItem["type"], string> = {
    WEAPON: "Weapon",
    ARMOR: "Armor",
    ACCESSORY: "Accessory",
    SCROLL: "Scroll",
    POTION: "Potion",
};

function getValueForRarity(rarity: ShopItem["rarity"], seed: string) {
    const ranges: Record<ShopItem["rarity"], [number, number]> = {
        COMMON: [20, 100],
        UNCOMMON: [200, 500],
        RARE: [1000, 2000],
        VERY_RARE: [2000, 4000],
        LEGENDARY: [8000, 20000],
    };
    const [min, max] = ranges[rarity];
    // deterministic pseudo-random based on id so values remain stable
    let sum = 0;
    for (let i = 0; i < seed.length; i++) sum += seed.charCodeAt(i);
    const range = max - min + 1;
    return min + (sum % range);
}

function formatGold(n: number) {
    return `${n.toLocaleString()} Gold`;
}

export default function ItemCard({ item }: { item: ShopItem }) {
    const [showImage, setShowImage] = useState(Boolean(item.image));
    const baseValue = getValueForRarity(item.rarity, item.id);
    const discount = item.deal && item.discountPercent ? item.discountPercent : 0;
    const saleValue = Math.round(baseValue * (1 - discount / 100));

    return (
        <article className="item-card" tabIndex={0}>
            <div className="item-card__image" aria-hidden="true">
                {item.deal && item.discountPercent > 0 ? (
                    <span className="deal-tag">{item.discountPercent}% off</span>
                ) : null}
                {showImage && item.image ? (
                    <img
                        src={item.image}
                        alt={item.name}
                        className="item-card__image-img"
                        onError={() => setShowImage(false)}
                        onLoad={() => setShowImage(true)}
                    />
                ) : (
                    <div className="item-card__initial">{item.name ? item.name.charAt(0) : "?"}</div>
                )}
            </div>
            <div className="item-card__body">
                <div className="item-card__title-row">
                    <h3>{item.name}</h3>
                </div>
                <div className="item-card__rarity-row">
                    <span className={`rarity rarity--${item.rarity.toLowerCase().replace("_", "-")}`}>
                        {rarityLabels[item.rarity]}
                    </span>
                    {item.deal ? <span className="deal-pill">Deal</span> : null}
                </div>
                <p className="item-card__description">{item.description}</p>
                <div className="item-card__price-row">
                    <span className={discount > 0 ? "sale-price" : "price"}>
                        {formatGold(discount > 0 ? saleValue : baseValue)}
                    </span>
                </div>
                <div className="item-card__meta">
                    <span>{typeLabels[item.type]}</span>
                    <span>{item.stock > 0 ? `${item.stock} in stock` : "Out of stock"}</span>
                </div>
            </div>
        </article>
    );
}
