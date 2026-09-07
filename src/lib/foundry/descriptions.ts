import { load } from "cheerio";

export function sanitizeFoundryDescription(
    input: unknown
): string {
    if (typeof input !== "string") {
        return "";
    }

    let text = input;

    text = text.replace(
        /\[\[\/r\s+([\s\S]*?)\]\]/gi,
        "$1"
    );

    text = text.replace(
        /@UUID\[[^\]]+\]\{([^}]+)\}/gi,
        "$1"
    );

    text = text.replace(
        /@UUID\[[^\]]+\]/gi,
        ""
    );

    const $ = load(text);

    $("br").replaceWith("\n");

    $("p").each((_, element) => {
        $(element).append("\n\n");
    });

    $("li").each((_, element) => {
        $(element).prepend("• ");
        $(element).append("\n");
    });

    return $("body")
        .text()
        .replace(/[ \t]+/g, " ")
        .replace(/[ \t]*\n[ \t]*/g, "\n")
        .replace(/\n{3,}/g, "\n\n")
        .trim();
}