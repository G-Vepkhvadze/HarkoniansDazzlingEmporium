"use client";

import { useState, useRef, useEffect } from "react";
import { getImageUrl } from "@/lib/imageUrl";
import { Filter } from "bad-words";
import { isLoggedIn, getUsername } from "@/lib/auth";

interface Review {
  id: string;
  itemId: string;
  authorName: string;
  content: string;
  createdAt: Date;
}

interface ItemWithReviews {
  id: string;
  image: string;
  name: string;
  description: string;
  rarity: string;
  type: string;
  price: number;
  deal: boolean;
  discountPercent: number;
  stock: number;
  reviews: Review[];
}

const rarityLabels: Record<string, string> = {
  COMMON: "Common",
  UNCOMMON: "Uncommon",
  RARE: "Rare",
  VERY_RARE: "Very Rare",
  LEGENDARY: "Legendary",
};

const typeLabels: Record<string, string> = {
  WEAPON: "Weapon",
  ARMOR: "Armor",
  ACCESSORY: "Accessory",
  SCROLL: "Scroll",
  POTION: "Potion",
};

function formatGold(n: number) {
  return `${n.toLocaleString()} Gold`;
}

function calculateSalePrice(price: number, discountPercent: number) {
  return Math.round(price * (1 - discountPercent / 100));
}

export default function ItemDetailClient({ item }: { item: ItemWithReviews }) {
  const [reviews, setReviews] = useState<Review[]>(item.reviews);
  const [newReview, setNewReview] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loggedIn, setLoggedIn] = useState(false);
  const [purchaseQuantity, setPurchaseQuantity] = useState(1);

  const filter = new Filter({
    placeHolder: "***",
  });
  
  // - case insensitive
  const exceptions = [
    "fuck", "shit", "cunt", "twat", "bitch", "ass", 
    "asshole", "dickhead", "shithead", "cunthead", "twathead",
    "bitchhead", "slut", "slutty", "fucker"
  ];

  exceptions.forEach(word => {
    filter.removeWords(word);
  });

  const exceptionVariations = exceptions.map(w => w.toUpperCase());
  exceptionVariations.forEach(word => {
    filter.removeWords(word);
  });

  useEffect(() => {
    // Check initial login state
    isLoggedIn().then(setLoggedIn);
    
    const handleStorageChange = () => {
      isLoggedIn().then(setLoggedIn);
    };
    
    window.addEventListener("storage", handleStorageChange);
    return () => window.removeEventListener("storage", handleStorageChange);
  }, []);

  const imageSrc = item.image ? getImageUrl(item.image) : null;
  const discount = item.deal && item.discountPercent ? item.discountPercent : 0;
  const displayPrice = discount > 0 ? calculateSalePrice(item.price, discount) : item.price;
  const originalPrice = item.price;

  // Load reviews on mount
  useEffect(() => {
    setReviews(item.reviews);
  }, [item.reviews]);

  const handleSubmitReview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newReview.trim()) {
      setError("Please enter a review.");
      return;
    }

    const filteredContent = filter.clean(newReview.trim());

    if (filteredContent !== newReview.trim()) {
      setError("Review contains inappropriate language.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const res = await fetch(`/api/reviews?itemId=${item.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ itemId: item.id, content: filteredContent }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Failed to submit review.");
        return;
      }

      const data = await res.json();
      setReviews([...reviews, data]);
      setNewReview("");
      setSuccess("Review submitted successfully!");
      setTimeout(() => setSuccess(""), 3000);
    } catch {
      setError("Failed to submit review.");
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteReview = async (reviewId: string, reviewAuthor: string) => {
    // Check if user is logged in
    if (!loggedIn) {
      setError("You must be logged in as admin to delete reviews.");
      return;
    }

    const adminUsername = getUsername();

    if (!confirm("Are you sure you want to delete this review?")) return;

    try {
      const res = await fetch(`/api/reviews/${reviewId}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        setError("Failed to delete review.");
        return;
      }

      setReviews(reviews.filter((r) => r.id !== reviewId));
      setSuccess("Review deleted successfully!");
      setTimeout(() => setSuccess(""), 3000);
    } catch {
      setError("Failed to delete review.");
    }
  };



  return (
    <div className="item-detail-page">
      <div className="item-detail-container">
        <div
          className="item-detail-image-box"
        >
          {imageSrc ? (
              <div className="item-detail-image-wrapper">
            <img
              src={imageSrc}
              alt={item.name}
              className="item-detail-image"
            /></div>
          ) : (
            <div className="item-detail-image-placeholder">
              {item.name ? item.name.charAt(0).toUpperCase() : "?"}
            </div>
          )}
        </div>

        <div className="item-detail-info">
          <h1 className="item-detail-name">{item.name}</h1>
          <p className="item-detail-type">
            {typeLabels[item.type] || item.type} · {rarityLabels[item.rarity] || item.rarity}
          </p>
          <div className="item-detail-price-row">
            {discount > 0 ? (
              <>
                <span className="item-detail-sale-price">
                  {formatGold(displayPrice)}
                </span>
                <span className="item-detail-original-price">
                  {formatGold(originalPrice)}
                </span>
              </>
            ) : (
              <span className="item-detail-price">{formatGold(item.price)}</span>
            )}
          </div>
          <p className="item-detail-description">{item.description}</p>
          <p className="item-detail-stock">
            {item.stock > 0 ? `${item.stock} in stock` : "Out of stock"}
          </p>
        </div>

        <section className="item-detail-purchase" style={{
          marginTop: "2rem",
          padding: "1.5rem",
          border: "1px solid rgba(216, 170, 79, 0.24)",
          borderRadius: "2px",
          background: "linear-gradient(145deg, rgba(45, 30, 20, 0.92), rgba(22, 15, 10, 0.95))",
        }}>
          <h2 style={{
            color: "var(--gold-soft)",
            fontSize: "1.3rem",
            marginBottom: "1rem",
            fontFamily: "var(--fantasy-font)",
          }}>
            Purchase {item.name}
          </h2>
          <div style={{
            display: "grid",
            gridTemplateColumns: "auto 1fr auto",
            gap: "1rem",
            alignItems: "center",
            maxWidth: "500px",
          }}>
            <label style={{
              color: "var(--cream)",
              fontWeight: 700,
            }}>
              Quantity:
            </label>
            <input
              type="number"
              min="1"
              max={item.stock}
              value={purchaseQuantity}
              onChange={(e) => {
                const value = parseInt(e.target.value) || 1;
                setPurchaseQuantity(Math.min(value, item.stock));
              }}
              style={{
                border: "1px solid rgba(216, 170, 79, 0.35)",
                borderRadius: "2px",
                background: "#130d09",
                color: "var(--cream)",
                padding: "0.5rem",
                width: "80px",
              }}
            />
          </div>
          <div style={{
            marginTop: "1rem",
            paddingTop: "1rem",
            borderTop: "1px solid rgba(216, 170, 79, 0.18)",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}>
            <span style={{
              color: "var(--cream)",
              fontSize: "1.1rem",
              fontWeight: 700,
            }}>
              Total: {formatGold(displayPrice * purchaseQuantity)}
            </span>
            <button
              style={{
                border: "1px solid rgba(216, 170, 79, 0.4)",
                borderRadius: "2px",
                background: "rgba(216, 170, 79, 0.18)",
                color: "var(--cream)",
                padding: "0.55rem 1.25rem",
                fontSize: "0.95rem",
                fontWeight: 700,
                cursor: "pointer",
                transition: "background 140ms ease, border-color 140ms ease",
              }}
              onClick={() => {
                alert("Purchase functionality coming soon!");
              }}
            >
              Purchase
            </button>
          </div>
        </section>

        <section className="item-detail-reviews">
          <h2>Reviews</h2>
          
          {reviews.length === 0 ? (
            <p className="item-detail-no-reviews">No reviews yet. Be the first to review this item!</p>
          ) : (
            <div className="item-detail-reviews-list">
              {reviews.map((review) => (
                <div key={review.id} className="item-detail-review">
                  <div className="item-detail-review-header">
                    <span className="item-detail-review-author">{review.authorName}</span>
                    <button
                      className="item-detail-review-delete"
                      onClick={() => handleDeleteReview(review.id, review.authorName)}
                    >
                      Delete
                    </button>
                  </div>
                  <p className="item-detail-review-content">{review.content}</p>
                </div>
              ))}
            </div>
          )}

          <form onSubmit={handleSubmitReview} className="item-detail-review-form">
            <h3>Leave a Review</h3>
            <div className="item-detail-review-inputs">
              <textarea
                placeholder="Your review..."
                value={newReview}
                onChange={(e) => setNewReview(e.target.value)}
                required
                className="item-detail-review-textarea"
                rows={4}
              />
            </div>
            <button type="submit" disabled={loading} className="item-detail-review-submit">
              {loading ? "Submitting..." : "Submit Review"}
            </button>
            {error && <p className="item-detail-error">{error}</p>}
            {success && <p className="item-detail-success">{success}</p>}
          </form>
        </section>
      </div>
    </div>
  );
}
