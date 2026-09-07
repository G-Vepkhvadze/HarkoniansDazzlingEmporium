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

    text = text.replace(
        /@spell(?:\[[^\]]*\])?/gi,
        ""
    );

    text = text.replace(
        /&Reference(?:\[[^\]]*\])?/gi,
        ""
    );

    text = text.replace(
        /condition=(?:\[[^\]]*\])?/gi,
        ""
    );

    text = text.replace(
        /type=(?:\[[^\]]*\])?/gi,
        ""
    );

    text = text.replace(
        /\[([^\[\]]+)\]/g,
        "$1"
    );

    const $ = load(text);

    // Remove existing <strong> tags while preserving their text
    $("strong").each((_, element) => {
        $(element).replaceWith(
            $(element).text()
        );
    });

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

    // Return cleaned HTML
    return ($("body").html() ?? "")
        .replace(/[ \t]+/g, " ")
        .replace(/[ \t]*\n[ \t]*/g, "\n")
        .replace(/\n{3,}/g, "\n\n")
        .trim();
}