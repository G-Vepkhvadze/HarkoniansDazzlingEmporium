"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface AppraisalCardProps {
  id: string;
  itemName: string;
  itemDescription: string;
  canRemove: boolean;
}

export default function AppraisalCard({ id, itemName, itemDescription, canRemove }: AppraisalCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [isRemoving, setIsRemoving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  async function handleRemove() {
    if (isRemoving || !window.confirm(`Remove the appraisal for “${itemName}”?`)) return;

    setIsRemoving(true);
    setError(null);
    try {
      const response = await fetch(`/api/appraisals/${encodeURIComponent(id)}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!response.ok) {
        const result = await response.json().catch(() => null);
        throw new Error(result?.error || "Failed to remove appraisal");
      }
      router.refresh();
    } catch (removeError) {
      setError(removeError instanceof Error ? removeError.message : "Failed to remove appraisal");
      setIsRemoving(false);
    }
  }

  return (
    <article className={`appraisal-card${expanded ? " is-expanded" : ""}`}>
      <h2 className="appraisal-card__name">{itemName}</h2>
      <p className="appraisal-card__description">{itemDescription}</p>
      <button
        type="button"
        className="appraisal-card__toggle"
        aria-expanded={expanded}
        onClick={() => setExpanded((value) => !value)}
      >
        {expanded ? "Show less" : "Show full description"}
      </button>
      {canRemove && (
        <button
          type="button"
          className="appraisal-card__remove"
          onClick={handleRemove}
          disabled={isRemoving}
        >
          {isRemoving ? "Removing..." : "Remove"}
        </button>
      )}
      {error && <p className="appraisal-card__error" role="alert">{error}</p>}
    </article>
  );
}
