import VaultCard from "@/components/VaultCard/VaultCard";
import AddVaultItem from "@/components/AddVaultItem/AddVaultItem";
import { getVaultItems } from "@/lib/vault";
import { getCurrentUserClient } from "@/lib/auth";
import LocomotiveScrollProvider from "@/components/locomotiveScroll/LocomotiveScroll";

export const revalidate = 60;

export default async function TheVaultPage() {
  const items = await getVaultItems();
  const currentUser = await getCurrentUserClient();

  return (
    <div className="stacked-page vault-page">
        <LocomotiveScrollProvider />
      <section className="page-intro vault-page__intro">
        <p className="eyebrow">The Vault</p>
        <h1>The Vault</h1>
        <p>A collection of wisdoms from the realms, curated by the Emporium.</p>
      </section>

      <section className="vault-section">
        <div className="vault-page__header">
          <div className="section-heading">
            <p>Explore the Collection</p>
            <h2>quotes and memories from adventurers past.</h2>
          </div>
          <AddVaultItem />
        </div>

        {items.length === 0 ? (
          <div style={{ textAlign: "center", padding: "2rem", color: "var(--muted)" }}>
            <p>The Vault is empty. Check back later for treasures!</p>
          </div>
        ) : (
          <div className="vault-grid">
            {items.map((item) => (
              <VaultCard
                key={item.id}
                id={item.id}
                image={item.image}
                quote={item.quote}
                likeCount={item.likeCount}
                initialIsLiked={currentUser ? item.isLikedByUser : false}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}