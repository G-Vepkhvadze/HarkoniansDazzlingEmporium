"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthProvider/AuthProvider";

export default function AddAppraisal() {
  const { isDM, loading } = useAuth();
  const router = useRouter();
  const [showModal, setShowModal] = useState(false);
  const [itemName, setItemName] = useState("");
  const [itemDescription, setItemDescription] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  if (loading || !isDM) return null;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsSaving(true);

    try {
      const response = await fetch("/api/appraisals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ itemName, itemDescription }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Failed to add appraisal");

      setItemName("");
      setItemDescription("");
      setShowModal(false);
      router.refresh();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Failed to add appraisal");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <>
      <button className="appraisal-add-btn" type="button" onClick={() => setShowModal(true)}>
        Add Appraisal
      </button>
      {showModal && (
        <div className="vault-modal-overlay" onClick={() => setShowModal(false)}>
          <div
            className="vault-modal appraisal-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="appraisal-modal-title"
            onClick={(event) => event.stopPropagation()}
          >
            <h2 id="appraisal-modal-title">Add Appraisal</h2>
            {error && <div className="vault-error" role="alert">{error}</div>}
            <form className="vault-modal__form" onSubmit={handleSubmit}>
              <div className="vault-modal__field">
                <label htmlFor="appraisal-name">Item Name</label>
                <input
                  id="appraisal-name"
                  className="vault-modal__input"
                  value={itemName}
                  onChange={(event) => setItemName(event.target.value)}
                  required
                />
              </div>
              <div className="vault-modal__field">
                <label htmlFor="appraisal-description">Item Description</label>
                <textarea
                  id="appraisal-description"
                  className="vault-modal__textarea"
                  value={itemDescription}
                  onChange={(event) => setItemDescription(event.target.value)}
                  required
                />
              </div>
              <div className="vault-modal__actions">
                <button className="vault-modal__btn" type="button" onClick={() => setShowModal(false)} disabled={isSaving}>
                  Cancel
                </button>
                <button className="vault-modal__btn vault-modal__btn--primary" type="submit" disabled={isSaving}>
                  {isSaving ? "Adding..." : "Add Appraisal"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
