import Link from "next/link";

export default function Navigation() {
    return (
        <nav
            style={{
                display: "flex",
                justifyContent: "center",
                gap: "30px",
                marginTop: "15px",
                fontSize: "14px",
            }}
        >
            <Link href="/">Home</Link>
            <Link href="/marketplace">
                Marketplace
            </Link>
            <Link href="/contact">
                Contact
            </Link>
            <Link href="/hidden-portal">
                ?
            </Link>
        </nav>
    );
}