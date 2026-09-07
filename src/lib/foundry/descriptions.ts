import { load } from "cheerio";

export function sanitizeFoundryDescription(
    input: unknown
): string {
    if (typeof input !== "string") {
        return "";
    }

    let text = input;

    // Foundry inline rolls:
    // [[/r 2d4 + 2]] → 2d4 + 2
    text = text.replace(
        /\[\[\/r\s+([\s\S]*?)\]\]/gi,
        "$1"
    );

    // Foundry UUID links with visible text:
    // @UUID[...] {Shield} → Shield
    text = text.replace(
        /@UUID\[[^\]]+\]\{([^}]+)\}/gi,
        "$1"
    );

    // Foundry UUID links without visible text
    text = text.replace(
        /@UUID\[[^\]]+\]/gi,
        ""
    );

    // Foundry tags
    text = text.replace(
        /@spell\b/gi,
        ""
    );

    text = text.replace(
        /&Reference\b/gi,
        ""
    );

    // [Fire Damage] → <strong>Fire Damage</strong>
    text = text.replace(
        /\[([^\[\]]+)\]/g,
        "$1"
    );

    const $ = load(text);

    // Preserve line breaks
    $("br").replaceWith("\n");

    // Preserve paragraphs
    $("p").each((_, element) => {
        $(element).append("\n\n");
    });

    // Preserve lists
    $("li").each((_, element) => {
        $(element).prepend("• ");
        $(element).append("\n");
    });

    // Return HTML, not plain text
    return ($("body").html() ?? "")
        .replace(/[ \t]+/g, " ")
        .replace(/[ \t]*\n[ \t]*/g, "\n")
        .replace(/\n{3,}/g, "\n\n")
        .trim();
}