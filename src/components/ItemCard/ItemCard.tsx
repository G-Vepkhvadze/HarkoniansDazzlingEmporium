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

export default function ItemCard({ item }: { item: ShopItem }) {
    return (
        <article className="item-card" tabIndex={0}>
            <div className="item-card__image" aria-hidden="true">
                {item.deal && item.discountPercent > 0 ? (
                    <span className="deal-tag">{item.discountPercent}% off</span>
                ) : null}
                {item.name.slice(0, 1)}
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
                    <span>{typeLabels[item.type]}</span>
                    <span>{item.stock > 0 ? `${item.stock} in stock` : "Out of stock"}</span>
                </div>
            </div>
        </article>
    );
}
