/** Example first runs for the intake screen. Each reference act was checked to carry fan
 * data in Qloo (many listed acts don't). The artists themselves are left unnamed on purpose:
 * these are the kind of people TourScout is for. */
export interface Example {
  /** URL key: /?example=lagos, /api/examples/lagos */
  key: string;
  home: string;
  who: string;
  refs: { id: string; name: string }[];
}

export const EXAMPLES: Example[] = [
  {
    key: "lagos",
    home: "Lagos",
    who: "An Afro-R&B singer",
    refs: [
      { id: "29E14130-BD3E-4227-B7F3-54C870D09456", name: "Tay Iwar" },
      { id: "E6A2CE5C-DAE6-4ACE-94F3-754ECBC180B5", name: "Ruger" },
    ],
  },
  {
    key: "london",
    home: "London",
    who: "A soul singer-songwriter",
    refs: [
      { id: "B9CDE427-563E-474D-A3AD-8BFBCDB31ADF", name: "Cleo Sol" },
      { id: "CCAA6ADA-CCB4-488D-939A-4989E3311CE7", name: "Joy Crookes" },
    ],
  },
  {
    key: "atlanta",
    home: "Atlanta",
    who: "A rapper",
    refs: [
      { id: "B083D7A8-B8AD-4727-B900-F3FEF0C5C0CA", name: "Kenny Mason" },
      { id: "0CEF94BA-824D-4C8E-853C-DFD5A043AAAB", name: "Baby Tate" },
    ],
  },
  {
    key: "nairobi",
    home: "Nairobi",
    who: "An Afro-pop band",
    refs: [
      { id: "B4D83497-C4CB-4BC6-8C94-CDD43E939AF7", name: "Bien" },
      { id: "5EC43278-B1F8-45A1-B85E-2252F664798E", name: "Sauti Sol" },
    ],
  },
  {
    key: "accra",
    home: "Accra",
    who: "An alté singer",
    refs: [
      { id: "01F0953A-F5B8-45D9-AE1C-2FCFB046E352", name: "King Promise" },
      { id: "7274E19C-539B-449E-97C1-1C60B2218099", name: "Amaarae" },
    ],
  },
];
