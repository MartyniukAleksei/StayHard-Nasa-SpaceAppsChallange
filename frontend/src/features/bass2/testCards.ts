// Curated copy for the "Tests to read first" cards on the BASS-II overview. Numbers next to the charts are
// computed from the data on the page; the text says what to look for and cites a source.

export type Note = { text: string; refs: string[] };
export type Card = { test: string; phenomenon: string; title: string; notes: Note[] };

export const CARDS: Card[] = [
  {
    test: "O13a",
    phenomenon: "Quenching at low flow",
    title: "A rod flame that fades out when the ventilation drops",
    notes: [
      {
        text: "The crew turned the fan down step by step. Watch the flame brightness fall at each step: with less flow, less fresh oxygen reaches the tip and the flame shrinks to a small blue cap.",
        refs: ["olson17", "report"],
      },
      {
        text: "This is the left, quenching branch of the U-shaped boundary: near the limit the surface loses more heat by radiation than the weak flame can give back.",
        refs: ["olson17"],
      },
      {
        text: "Near the limit the blue flame is almost invisible to the camera, so the moment it goes out is an interval, not a point. The researchers' log says it lasted more than 3 minutes at the last fan setting.",
        refs: ["report"],
      },
    ],
  },
  {
    test: "B13",
    phenomenon: "Radiative extinction",
    title: "A thin film that burns until the flow is almost gone",
    notes: [
      {
        text: "The flame spreads against the flow over a 0.4 mm PMMA film. The flow was lowered in steps; the flame kept spreading down to the lowest steps and then went out.",
        refs: ["bhatt16cf", "report"],
      },
      {
        text: "For thin films the flow at which the flame dies does not depend on the film thickness, and a simple radiation balance predicts it.",
        refs: ["bhatt16cf"],
      },
      {
        text: "On Earth, buoyancy alone drives a flow of tens of cm/s past a flame, so this low-flow extinction cannot be seen in a normal-gravity test.",
        refs: ["bhatt16fsj"],
      },
    ],
  },
  {
    test: "M19",
    phenomenon: "Thick sample",
    title: "A thick slab that burns for almost half an hour",
    notes: [
      {
        text: "A 4 mm slab burning on both sides holds its flame far longer than a film. The flow was lowered in steps until the flame went out on its own.",
        refs: ["report"],
      },
      {
        text: "For one-sided slabs, thicker samples went out at lower oxygen but needed more flow: heat leaks into the solid behind the flame. Two-sided slabs like this one burned faster and went out at lower flow.",
        refs: ["report"],
      },
      {
        text: "The air sensor responds in about a minute, so the reading lags each fan step. Trust it only on long, steady steps.",
        refs: ["report"],
      },
    ],
  },
];
