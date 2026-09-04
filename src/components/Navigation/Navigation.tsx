import Link from "next/link";
import ProfileLink from "@/components/ProfileLink/ProfileLink";

export default function Navigation() {
    return (
        <nav className="site-nav" aria-label="Primary navigation">
            <Link className="brand-link" href="/">
                Harkonian&apos;s Dazzling Emporium
            </Link>
            <div className="nav-links">
                <Link href="/">Home</Link>
                <ProfileLink />
                <Link href="/marketplace">Marketplace</Link>
                <Link href="/thevault" className="help-link" aria-label="The Vault">
                    Vault
                </Link>
            </div>
        </nav>
    );
}
