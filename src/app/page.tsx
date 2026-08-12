import { getFeaturedItems } from "@/lib/items";
import ItemCard from "@/components/ItemCard/ItemCard";

export const revalidate = 60;

export default async function HomePage() {
  const items = await getFeaturedItems();
  const carouselItems = [...items, ...items];

  return (
      <div className="stacked-page">
        <section className="hero-section">
          <p className="eyebrow">Arcane goods, suspiciously fair prices</p>
          <h1>
            Harkonian’s Dazzling Emporium
          </h1>
          <p>
            The finest artifacts, potions, armor, scrolls, and legally questionable relics in all the realms.
          </p>
        </section>

        <section className="content-section">
          <div className="section-heading">
            <p>Featured Items & Fantastic Deals</p>
            <h2>Hand-picked treasures for adventurers with more courage than caution.</h2>
          </div>

          <div className="featured-carousel" aria-label="Featured deal carousel">
            <div className="featured-carousel__track">
              {carouselItems.map((item, index) => (
                  <div className="featured-carousel__slide" key={`${item.id}-${index}`}>
                    <ItemCard item={item} />
                  </div>
              ))}
            </div>
          </div>
        </section>

        <section className="content-section about-panel">
          <div className="section-heading">
            <p>About Me</p>
            <h2>Harkonian buys the strange, sells the useful, and labels the dangerous.</h2>
          </div>
          <p>
            Founded behind a velvet curtain in the brass-lit markets of Balordroch, the Emporium serves dungeon
            delvers, court mages, retired heroes, and anyone else willing to read a warranty written in infernal
            fine print. Every shelf is inspected by Harkonian personally, or by a broom he trusts nearly as much.
          </p>
        </section>

        <section className="content-section">
          <div className="section-heading">
            <p>Seasonal Notices</p>
            <h2>Rotating deals from the counter ledger.</h2>
          </div>
          <div className="promo-grid">
            <article className="promo-card">
              <h3>Summer Harvest Deals</h3>
              <p>Discounts on sun charms, cooling potions, and scarecrow repellents for heroic farmers.</p>
            </article>
            <article className="promo-card">
              <h3>Winter Solstice Celebrations</h3>
              <p>Half-price everwarm mittens with every ring of frost resistance rental.</p>
            </article>
            <article className="promo-card">
              <h3>Adventurer Loyalty Week</h3>
              <p>Bring back a map, rumor, or cursed coin and receive store credit of unclear value.</p>
            </article>
          </div>
        </section>
      </div>
  );
}
