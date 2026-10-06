"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import ProfileLink from "@/components/ProfileLink/ProfileLink";
import CurrentGold from "@/components/CurrentGold/CurrentGold";

export default function Navigation() {
    const [menuOpen, setMenuOpen] = useState(false);

    useEffect(() => {
        if (!menuOpen) return;

        const closeOnEscape = (event: KeyboardEvent) => {
            if (event.key === "Escape") setMenuOpen(false);
        };

        window.addEventListener("keydown", closeOnEscape);
        return () => window.removeEventListener("keydown", closeOnEscape);
    }, [menuOpen]);

    return (
        <nav className={`site-nav${menuOpen ? " menu-open" : ""}`} aria-label="Primary navigation">
            <button
                className="menu-toggle"
                type="button"
                aria-label={menuOpen ? "Close navigation menu" : "Open navigation menu"}
                aria-expanded={menuOpen}
                aria-controls="primary-navigation-links"
                onClick={() => setMenuOpen((open) => !open)}
            >
                <span />
                <span />
                <span />
            </button>
            <Link className="brand-link" href="/">
                Harkonian&apos;s Dazzling Emporium
            </Link>
            <div className="nav-links" id="primary-navigation-links">
                <Link href="/" onClick={() => setMenuOpen(false)}>Home</Link>
                <ProfileLink onNavigate={() => setMenuOpen(false)} />
                <Link href="/marketplace" onClick={() => setMenuOpen(false)}>Marketplace</Link>
                <Link href="/thevault" className="help-link" aria-label="The Vault" onClick={() => setMenuOpen(false)}>
                    Vault
                </Link>
                <Link href="/appraisals" onClick={() => setMenuOpen(false)}>Appraisals</Link>
            </div>
            <CurrentGold />
        </nav>
    );
}
