"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import type { ShopItem } from "@/types/items";
import { getImageUrl } from "@/lib/imageUrl";

const rarityLabels: Record<ShopItem["rarity"], string> = {
    COMMON: "Common",
    UNCOMMON: "Uncommon",
    RARE: "Rare",
    VERY_RARE: "Very Rare",
    LEGENDARY: "Legendary",
};

const imageSrc = (item: ShopItem) => getImageUrl(item.image);

function formatGold(n: number) {
    return `${n.toLocaleString()} Gold`;
}

export default function ItemCard({ item }: { item: ShopItem }) {
    const router = useRouter();
    const [showImage, setShowImage] = useState(Boolean(item.image));
    const discount = item.deal && item.discountPercent ? item.discountPercent : 0;
    const saleValue = Math.round(item.price * (1 - discount / 100));

    const handleClick = (e: React.MouseEvent) => {
      e.preventDefault();
      router.push(`/item/${item.id}`);
    };

    return (
        <article className="item-card" tabIndex={0} onClick={handleClick} style={{ cursor: "pointer" }}>
            <div className="item-card__image" aria-hidden="true">
                {item.deal && item.discountPercent > 0 ? (
                    <span className="deal-tag">{item.discountPercent}% off</span>
                ) : null}
                {showImage && item.image ? (
                    <img
                        src={imageSrc(item)}
                        alt={item.name}
                        className="item-card__image-img"
                        loading="lazy"
                        onError={() => setShowImage(false)}
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
                <div className="item-card__meta">
                    <span className={discount > 0 ? "sale-price" : "price"}>
                        {formatGold(discount > 0 ? saleValue : item.price)}
                    </span>
                    <span className="stock">{item.stock > 0 ? `${item.stock} in stock` : "Out of stock"}</span>
                </div>
            </div>
        </article>
    );
}