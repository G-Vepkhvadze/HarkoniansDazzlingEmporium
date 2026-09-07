"use client";

import { useState } from "react";
import { getImageUrl } from "@/lib/imageUrl";
import { useAuth } from "@/components/AuthProvider/AuthProvider";

interface VaultCardProps {
  id: string;
  image: string;
  quote: string;
  likeCount: number;
  initialIsLiked?: boolean;
  onLikeToggle?: (vaultItemId: string, isNowLiked: boolean) => void;
}

export default function VaultCard({
  id,
  image,
  quote,
  likeCount,
  initialIsLiked = false,
  onLikeToggle,
}: VaultCardProps) {
  const { isAuthenticated, loading } = useAuth();
  const [isLiked, setIsLiked] = useState(initialIsLiked);
  const [currentLikeCount, setCurrentLikeCount] = useState(likeCount);
  const [isToggling, setIsToggling] = useState(false);

  const handleLikeToggle = async () => {
    if (!isAuthenticated || isToggling || loading) return;

    setIsToggling(true);
    try {
      const response = await fetch("/api/vault/like", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ vaultItemId: id }),
        credentials: "include",
      });

      if (response.ok) {
        const data = await response.json();
        const newIsLiked = data.isLiked;
        setIsLiked(newIsLiked);
        setCurrentLikeCount(newIsLiked ? currentLikeCount + 1 : currentLikeCount - 1);
        
        // Notify parent if callback exists
        if (onLikeToggle) {
          onLikeToggle(id, newIsLiked);
        }
      }
    } catch (error) {
      // Error handling is silent to prevent console errors as requested
    } finally {
      setIsToggling(false);
    }
  };

  const imageUrl = getImageUrl(image);

  return (
    <div className="vault-card">
      <div className="vault-card__image">
        {imageUrl && (
          <img
            src={imageUrl}
            alt={quote || "Vault image"}
            loading="lazy"
          />
        )}
      </div>
      <div className="vault-card__content">
        <p className="vault-card__quote">{quote}</p>
        <div className="vault-card__meta">
          <span>{currentLikeCount} {currentLikeCount === 1 ? "like" : "likes"}</span>
          <button
            className={`vault-like-btn ${isLiked ? "liked" : ""}`}
            onClick={handleLikeToggle}
            disabled={!isAuthenticated || isToggling || loading}
            title={!isAuthenticated ? "Login to like" : ""}
            aria-label={isLiked ? "Unlike this vault item" : "Like this vault item"}
          >
            {isLiked ? "♥" : "♡"}
          </button>
        </div>
      </div>
    </div>
  );
}