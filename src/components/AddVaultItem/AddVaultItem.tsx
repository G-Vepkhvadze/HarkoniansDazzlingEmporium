"use client";

import { useState, useRef } from "react";
import { useAuth } from "@/components/AuthProvider/AuthProvider";

interface AddVaultItemProps {
  onAdded?: () => void;
}

// Maximum image width constraint
const MAX_IMAGE_WIDTH = 900;

export default function AddVaultItem({ onAdded }: AddVaultItemProps) {
  const { isDM, loading } = useAuth();
  const [showModal, setShowModal] = useState(false);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [quote, setQuote] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  // If loading or not DM, don't show anything
  if (loading || !isDM) {
    return null;
  }

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Check if it's an image
    if (!file.type.startsWith("image/")) {
      setError("Please select an image file");
      return;
    }

    // Check image dimensions client-side if possible
    const img = new Image();
    img.onload = () => {
      if (img.width > MAX_IMAGE_WIDTH) {
        setError(`Image width exceeds ${MAX_IMAGE_WIDTH}px. Please resize your image.`);
      } else {
        setError(null);
      }
    };
    img.onerror = () => {
      setError("Invalid image file");
    };
    img.src = URL.createObjectURL(file);

    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
  };

  const handleRemoveImage = () => {
    setImageFile(null);
    setImagePreview(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!imageFile) {
      setError("Please select an image");
      return;
    }

    if (!quote.trim()) {
      setError("Please add a quote or comment");
      return;
    }

    setIsUploading(true);
    setError(null);
    setSuccess(null);

    try {
      // Upload image first
      const formData = new FormData();
      formData.append("file", imageFile);

      const uploadResponse = await fetch("/api/vault/upload", {
        method: "POST",
        body: formData,
        credentials: "include",
      });

      if (!uploadResponse.ok) {
        const uploadError = await uploadResponse.json();
        throw new Error(uploadError.error || "Failed to upload image");
      }

      const uploadData = await uploadResponse.json();
      const imagePath = uploadData.path;

      // Create vault item
      const createResponse = await fetch("/api/vault", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          image: imagePath,
          quote: quote.trim(),
        }),
        credentials: "include",
      });

      if (!createResponse.ok) {
        const createError = await createResponse.json();
        throw new Error(createError.error || "Failed to create vault item");
      }

      setSuccess("Vault item added successfully!");
      setImageFile(null);
      setImagePreview(null);
      setQuote("");
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }

      // Close modal after a short delay
      setTimeout(() => {
        setShowModal(false);
        if (onAdded) {
          onAdded();
        }
      }, 1000);

    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add vault item");
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <>
      <button
        className="vault-add-btn"
        onClick={() => setShowModal(true)}
        aria-label="Add new vault item"
      >
        + Add New
      </button>

      {showModal && (
        <div className="vault-modal-overlay" onClick={() => setShowModal(false)}>
          <div className="vault-modal" onClick={(e) => e.stopPropagation()}>
            <h2>Add to The Vault</h2>
            
            {error && <div className="vault-error">{error}</div>}
            {success && <div className="vault-success">{success}</div>}

            <form className="vault-modal__form" onSubmit={handleSubmit}>
              <div className="vault-modal__field">
                <label htmlFor="vault-image">Image (max {MAX_IMAGE_WIDTH}px width)</label>
                <div className="vault-modal__field-content">
                  <label className="vault-image-upload" htmlFor="vault-image">
                    {imagePreview ? (
                      <img src={imagePreview} alt="Preview" />
                    ) : (
                      <span className="vault-image-placeholder">+</span>
                    )}
                    <input
                      type="file"
                      id="vault-image"
                      accept="image/*"
                      ref={fileInputRef}
                      onChange={handleImageSelect}
                      disabled={isUploading}
                    />
                  </label>
                  {imageFile && (
                    <button
                      type="button"
                      className="vault-modal__btn"
                      onClick={handleRemoveImage}
                      disabled={isUploading}
                    >
                      Remove
                    </button>
                  )}
                </div>
              </div>

              <div className="vault-modal__field">
                <label htmlFor="vault-quote">Quote/Comment</label>
                <textarea
                  id="vault-quote"
                  className="vault-modal__textarea"
                  value={quote}
                  onChange={(e) => setQuote(e.target.value)}
                  placeholder="Add a quote or comment about this image..."
                  disabled={isUploading}
                />
              </div>

              <div className="vault-modal__actions">
                <button
                  type="button"
                  className="vault-modal__btn"
                  onClick={() => setShowModal(false)}
                  disabled={isUploading}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="vault-modal__btn vault-modal__btn--primary"
                  disabled={isUploading || !imageFile || !quote.trim()}
                >
                  {isUploading ? "Adding..." : "Add to Vault"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}