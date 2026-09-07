import { load } from "cheerio";

export function sanitizeFoundryDescription(
  input: unknown
): string {
  if (typeof input !== "string") {
    return "";
  }

  let text = input;

  // ---------------------------------------------------------
  // Foundry roll syntax
  // [[/r 2d6 + 3]]
  // → 2d6 + 3
  // ---------------------------------------------------------

  text = text.replace(
    /\[\[\/r\s+([\s\S]*?)\]\]/gi,
    "$1"
  );

  // ---------------------------------------------------------
  // Foundry UUID links
  //
  // @UUID[...]{Display Text}
  // → Display Text
  //
  // @UUID[...]
  // → removed
  // ---------------------------------------------------------

  text = text.replace(
    /@UUID\[[^\]]+\]\{([^}]+)\}/gi,
    "$1"
  );

  text = text.replace(
    /@UUID\[[^\]]+\]/gi,
    ""
  );

  // ---------------------------------------------------------
  // Foundry spell references
  // ---------------------------------------------------------

  text = text.replace(
    /@spell(?:\[[^\]]*\])?/gi,
    ""
  );

  // ---------------------------------------------------------
  // Foundry reference syntax
  // ---------------------------------------------------------

  text = text.replace(
    /&Reference(?:\[[^\]]*\])?/gi,
    ""
  );

  // ---------------------------------------------------------
  // Remove leftover Foundry parameters
  // ---------------------------------------------------------

  text = text.replace(
    /condition=(?:\[[^\]]*\])?/gi,
    ""
  );

  text = text.replace(
    /type=(?:\[[^\]]*\])?/gi,
    ""
  );

  // ---------------------------------------------------------
  // Remove square brackets while preserving their contents
  //
  // [Requires Attunement]
  // → Requires Attunement
  // ---------------------------------------------------------

  text = text.replace(
    /\[([^\[\]]+)\]/g,
    "$1"
  );

  // ---------------------------------------------------------
  // Parse HTML
  // ---------------------------------------------------------

  const $ = load(
    `<div id="harkonians-description">${text}</div>`
);

const root =
    $("#harkonians-description");

// Remove unsafe/non-content elements entirely.
root.find("script, style").remove();

// ---------------------------------------------------------
// Preserve line breaks before stripping HTML
// ---------------------------------------------------------

root.find("br").replaceWith("\n");

root.find("p").each((_, element) => {
    $(element).prepend("\n");
    $(element).append("\n");
});

root.find("div").each((_, element) => {
    $(element).prepend("\n");
    $(element).append("\n");
});

// ---------------------------------------------------------
// Preserve unordered/ordered list readability
// ---------------------------------------------------------

root.find("li").each((_, element) => {
    $(element).prepend("• ");
    $(element).append("\n");
});

// ---------------------------------------------------------
// Formatting tags:
// remove the tag, preserve the contents
// ---------------------------------------------------------

root
    .find(
        "strong, b, em, i, u, s, strike, mark"
    )
    .each((_, element) => {
        $(element).replaceWith(
            $(element).contents()
        );
    });

// ---------------------------------------------------------
// Convert everything else to plain text
// ---------------------------------------------------------

let result = root.text();

// Normalize non-breaking spaces.
result = result.replace(
    /\u00A0/g,
    " "
);

// Normalize tabs and repeated spaces.
result = result.replace(
    /[ \t]+/g,
    " "
);

// Remove whitespace surrounding newlines.
result = result.replace(
    /[ \t]*\n[ \t]*/g,
    "\n"
);

// Prevent excessive blank lines.
result = result.replace(
    /\n{3,}/g,
    "\n\n"
);

return result.trim();
}