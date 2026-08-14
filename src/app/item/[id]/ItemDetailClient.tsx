"use client";

import { useState, useRef, useEffect } from "react";
import { getImageUrl } from "@/lib/imageUrl";

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
  const [authorName, setAuthorName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

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
    if (!authorName.trim() || !newReview.trim()) {
      setError("Please enter both your name and a review.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const res = await fetch(`/api/reviews?itemId=${item.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ itemId: item.id, authorName: authorName.trim(), content: newReview.trim() }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Failed to submit review.");
        return;
      }

      const data = await res.json();
      setReviews([...reviews, data]);
      setNewReview("");
      setAuthorName("");
      setSuccess("Review submitted successfully!");
      setTimeout(() => setSuccess(""), 3000);
    } catch {
      setError("Failed to submit review.");
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteReview = async (reviewId: string, reviewAuthor: string) => {
    const storedName = localStorage.getItem("reviewAuthorName");
    if (storedName !== reviewAuthor) {
      setError("You can only delete your own reviews.");
      return;
    }

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

  const handleStoreAuthorName = (name: string) => {
    setAuthorName(name);
    if (name.trim()) {
      localStorage.setItem("reviewAuthorName", name.trim());
    }
  };

  return (
    <div className="item-detail-page">
      <div className="item-detail-container">
        {/* Image Box */}
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

        {/* Item Info */}
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

        {/* Review Section */}
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
              <input
                type="text"
                placeholder="Your name"
                value={authorName}
                onChange={(e) => handleStoreAuthorName(e.target.value)}
                required
                className="item-detail-review-input"
              />
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
