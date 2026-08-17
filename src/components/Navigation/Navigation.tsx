import Link from "next/link";
import LoginStatus from "@/components/LoginStatus/LoginStatus";
import ProfileLink from "@/components/ProfileLink/ProfileLink";

export default function Navigation() {
    return (
        <nav className="site-nav" aria-label="Primary navigation">
            <Link className="brand-link" href="/">
                Harkonian&apos;s Dazzling Emporium
            </Link>
            <div className="nav-links">
                <Link href="/">Home</Link>
                <Link href="/marketplace">Marketplace</Link>
                <Link href="/find-me">Find Me</Link>
                <ProfileLink />
            </div>
        </nav>
    );
}
