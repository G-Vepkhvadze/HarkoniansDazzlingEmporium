import { getFeaturedItems } from "@/lib/items";

export default async function HomePage() {
  const items = await getFeaturedItems();

  return (
      <div>
        <section
            style={{
              textAlign: "center",
              marginBottom: "60px",
            }}
        >
          <h1
              style={{
                fontSize: "42px",
                color: "#d8aa4f",
                letterSpacing: "3px",
              }}
          >
            Harkonian’s Dazzling Emporium
          </h1>

          <p
              style={{
                opacity: 0.8,
              }}
          >
            The finest artifacts, potions,
            and “legally questionable”
            relics in all the realms.
          </p>
        </section>

        <section>
          <h2
              style={{
                color: "#d8aa4f",
                marginBottom: "20px",
              }}
          >
            Featured Items & Fantastic Deals
          </h2>

          <div
              style={{
                display: "grid",
                gridTemplateColumns:
                    "repeat(auto-fit, minmax(220px, 1fr))",
                gap: "20px",
              }}
          >
            {items.map((item) => (
                <div
                    key={item.id}
                    style={{
                      border: "1px solid #3a2418",
                      padding: "15px",
                      borderRadius: "8px",
                      background:
                          "rgba(0,0,0,0.3)",
                    }}
                >
                  <h3>{item.name}</h3>
                  <p>{item.description}</p>

                  <p>
                    <b>Rarity:</b>{" "}
                    {item.rarity}
                  </p>

                  <p>
                    <b>Stock:</b> {item.stock}
                  </p>
                </div>
            ))}
          </div>
        </section>
      </div>
  );
}