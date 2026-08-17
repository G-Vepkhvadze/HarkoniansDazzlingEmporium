const branches = [
  {
    city: "Balordroch",
    address: "13 Lanternmoth Road, Brass Bazaar, behind The Singing Awning",
    hours: "Open after breakfast until the moon objects",
  },
  {
    city: "Katastroni",
    address: "77 Briarhook Row, beside the polite haunted fountain",
    hours: "Open on market days and most Tuesdays",
  },
  {
    city: "Hedgewreathe",
    address: "2 Siltglass Street, third door past the dead legionnaire",
    hours: "Open whenever it's funny or chaotic",
  },
  {
    city: "Reishim",
    address: "404 Quillkeeper Terrace, upper stacks, west stair that was not there yesterday",
    hours: "Open by appointment, omen, or dramatic knock",
  },
];

export default function FindMePage() {
  return (
    <div className="stacked-page">
      <section className="page-intro">
        <p className="eyebrow">Find Me</p>
        <h1>Branches across the better-mapped parts of the realm.</h1>
        <p>
          All locations are fictional, questionably licensed, and maintained with pride by Harkonian&apos;s extended
          network of apprentices, familiars, and overconfident clerks.
        </p>
      </section>

      <section className="branch-grid">
        {branches.map((branch) => (
          <article className="branch-card" key={branch.city}>
            <h2>{branch.city}</h2>
            <p>{branch.address}</p>
            <span>{branch.hours}</span>
          </article>
        ))}
      </section>
    </div>
  );
}
