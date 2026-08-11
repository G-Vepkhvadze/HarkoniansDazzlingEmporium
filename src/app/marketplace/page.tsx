import MarketplaceBrowser from "@/components/MarketplaceFilters/MarketplaceBrowser";
import { getItems } from "@/lib/items";

export const dynamic = 'force-dynamic';

export default async function MarketplacePage() {
  const items = await getItems();

  return (
    <div className="stacked-page">
      <section className="page-intro">
        <p className="eyebrow">Marketplace</p>
        <h1>Browse the shelves before something bites.</h1>
        <p>
          Filter by rarity, stock, or item type to find the right magical tool for the wrong situation.
        </p>
      </section>

      <MarketplaceBrowser items={items} />
    </div>
  );
}
