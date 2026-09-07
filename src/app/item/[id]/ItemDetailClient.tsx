"use client";

import { useState, useRef, useEffect } from "react";
import { getImageUrl } from "@/lib/imageUrl";
import { Filter } from "bad-words";
import { isLoggedIn, getUsername } from "@/lib/auth";
import { rarityLabels, typeLabels, legacyTypeLabels, getTypeLabel } from "@/lib/constants/labels";
import { formatGold, calculateSalePrice, formatStock } from "@/lib/utils/format";

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

export default function ItemDetailClient({ item }: { item: ItemWithReviews }) {
  const [reviews, setReviews] = useState<Review[]>(item.reviews);
  const [newReview, setNewReview] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loggedIn, setLoggedIn] = useState(false);
  const [purchaseQuantity, setPurchaseQuantity] = useState(1);
  const [characters, setCharacters] = useState<
      {
        id: string;
        name: string;
        creditBalance: number;
        foundryWorldId: string | null;
        foundryActorId: string | null;
      }[]
  >([]);

  const [selectedCharacterId, setSelectedCharacterId] =
      useState("");

  const [purchasing, setPurchasing] = useState(false);

  const filter = new Filter({
    placeHolder: "***",
  });

  const exceptions = [
    "fuck", "shit", "cunt", "twat", "bitch", "ass", 
    "asshole", "dickhead", "shithead", "cunthead", "twathead",
    "bitchhead", "slut", "slutty", "fucker", "dick", "Dick", "Dickhead",
      "Shithead", "Asshole",
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

    fetch("/api/characters", {
      credentials: "include"
    })
        .then(async (response) => {
          if (!response.ok) {
            return;
          }

          const data = await response.json();

          const linkedCharacters =
              (data.characters || []).filter(
                  (character: {
                    foundryWorldId: string | null;
                    foundryActorId: string | null;
                  }) =>
                      character.foundryWorldId &&
                      character.foundryActorId
              );

          setCharacters(linkedCharacters);

          if (linkedCharacters.length === 1) {
            setSelectedCharacterId(
                linkedCharacters[0].id
            );
          }
        })
        .catch(() => {
          // Leave character list empty.
        });
    
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

  const handlePurchase = async () => {
    if (!loggedIn) {
      setError("You must be logged in to purchase.");
      return;
    }

    if (!selectedCharacterId) {
      setError("Please select a character.");
      return;
    }

    if (
        item.stock !== -1 &&
        purchaseQuantity > item.stock
    ) {
      setError("Not enough stock available.");
      return;
    }

    setPurchasing(true);
    setError("");
    setSuccess("");

    try {
      const idempotencyKey =
          crypto.randomUUID();

      const response = await fetch(
          "/api/purchases/create",
          {
            method: "POST",
            credentials: "include",
            headers: {
              "Content-Type": "application/json"
            },
            body: JSON.stringify({
              itemId: item.id,
              characterId: selectedCharacterId,
              quantity: purchaseQuantity,
              idempotencyKey
            })
          }
      );

      const data = await response.json();

      if (!response.ok) {
        setError(
            data.error || "Purchase failed."
        );
        return;
      }

      setSuccess(
          "Purchase submitted successfully. Your item will be delivered to Foundry."
      );

      setPurchaseQuantity(1);

    } catch {
      setError(
          "Unable to complete purchase. Please try again."
      );
    } finally {
      setPurchasing(false);
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
              loading="lazy"
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
            {getTypeLabel(item.type)} · {rarityLabels[item.rarity as keyof typeof rarityLabels] || item.rarity}
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
            {formatStock(item.stock)}
          </p>
        </div>

        <section className="item-detail-purchase">
          <h2>
            Purchase {item.name}
          </h2>
          <div className="item-detail-purchase-grid">
            {loggedIn && characters.length > 0 && (
                <div>
                  <label className="item-detail-purchase-label">
                    Purchase for:
                  </label>

                  <select
                      value={selectedCharacterId}
                      onChange={(e) =>
                          setSelectedCharacterId(e.target.value)
                      }
                      className="item-detail-purchase-select"
                  >
                    <option value="">
                      Select a character
                    </option>

                    {characters.map((character) => (
                        <option
                            key={character.id}
                            value={character.id}
                        >
                          {character.name} —{" "}
                          {formatGold(character.creditBalance)}
                        </option>
                    ))}
                  </select>
                </div>
            )}
            <label className="item-detail-purchase-label">
              Quantity:
            </label>
            <input
                type="number"
                min="1"
                max={item.stock === -1 ? undefined : item.stock}
                value={purchaseQuantity}
                onChange={(e) => {
                  const value = Math.max(
                      1,
                      parseInt(e.target.value, 10) || 1
                  );

                  if (item.stock === -1) {
                    setPurchaseQuantity(value);
                  } else {
                    setPurchaseQuantity(
                        Math.min(value, item.stock)
                    );
                  }
                }}
                className="item-detail-purchase-input"
            />
          </div>
          <div className="item-detail-purchase-divider">
            <span className="item-detail-purchase-total">
              Total: {formatGold(displayPrice * purchaseQuantity)}
            </span>
            <button
                className="item-detail-purchase-btn"
                onClick={handlePurchase}
                disabled={
                    purchasing ||
                    item.stock === 0 ||
                    !loggedIn ||
                    !selectedCharacterId
                }
            >
              {purchasing ? "Purchasing..." : "Purchase"}
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
