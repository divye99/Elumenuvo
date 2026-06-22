/* ------------------------------------------------------------------
   Elumenuvo catalogue data.

   Categories, subtypes, and representative suppliers are derived from a
   verified deep-research pass (NASA primary sources + manufacturer
   catalogues: Glenair, Moog, AAC Clyde Space, Blue Canyon Technologies,
   TE Connectivity, Keysight, Beyond Gravity, Celestia STS, Dhruva Space).

   IMAGES: each category has an `image` slot that is intentionally empty.
   Drop in your own or licensed supplier photography (see SOURCING.md for
   the per-category manufacturer pages to request imagery from). Do NOT
   hot-link manufacturer images without permission.
   ------------------------------------------------------------------ */

export type CatalogueCategory = {
  slug: string;
  /** lucide-react icon name */
  icon: string;
  title: string;
  blurb: string;
  subtypes: string[];
  suppliers: string[];
  /** India-specific to (≈50% of satellite content). Optional flag. */
  importHeavy?: boolean;
  /** Path under /public once you add a photo, e.g. "/catalogue/structures.jpg". Empty = placeholder. */
  image: string;
  imageAlt: string;
};

export const CATALOGUE: CatalogueCategory[] = [
  {
    slug: "structures-materials",
    icon: "Box",
    title: "Structures & materials",
    blurb:
      "Flight-grade metal stock, composites, and ready-to-fly primary structures for cube- and small-satellite builds.",
    subtypes: [
      "Aluminium 6061 / 7075",
      "Titanium",
      "Carbon-fibre composites",
      "COTS CubeSat structures (1U–16U)",
      "Fasteners & hardware",
    ],
    suppliers: [
      "NanoAvionics",
      "ISISPACE",
      "GomSpace",
      "EnduroSat",
      "Pumpkin Space Systems",
    ],
    importHeavy: true,
    image: "",
    imageAlt: "Satellite primary structure / machined aluminium frame",
  },
  {
    slug: "avionics-adcs",
    icon: "Cpu",
    title: "Avionics, ADCS & computing",
    blurb:
      "Attitude determination and control hardware plus onboard computing, available as components or turnkey systems.",
    subtypes: [
      "Star trackers",
      "Reaction wheels",
      "Control moment gyroscopes",
      "Torque rods & sun sensors",
      "On-board computers (C&DH)",
    ],
    suppliers: ["Blue Canyon Technologies", "AAC Clyde Space"],
    image: "",
    imageAlt: "Reaction wheel / star tracker ADCS hardware",
  },
  {
    slug: "power-systems",
    icon: "BatteryCharging",
    title: "Power systems",
    blurb:
      "Generation, storage, and distribution — from solar arrays to space-grade batteries and power-control units.",
    subtypes: [
      "Space-grade batteries",
      "Power control & distribution units (PCDU)",
      "Solar arrays / panels",
      "Solar array drive assemblies",
    ],
    suppliers: ["AAC Clyde Space", "Blue Canyon Technologies"],
    importHeavy: true,
    image: "",
    imageAlt: "Satellite solar array panel and PCDU",
  },
  {
    slug: "rf-communications",
    icon: "RadioTower",
    title: "RF & communications",
    blurb:
      "Onboard comms across VHF to X-band, plus emerging optical/laser downlink terminals.",
    subtypes: [
      "Transceivers & transmitters",
      "Antennas (VHF / UHF / S / X-band)",
      "Laser / optical comms terminals",
    ],
    suppliers: ["AAC Clyde Space", "Dhruva Space"],
    image: "",
    imageAlt: "Satellite RF transceiver and patch antenna",
  },
  {
    slug: "propulsion",
    icon: "Flame",
    title: "Propulsion components",
    blurb:
      "Flow-control hardware for in-space propulsion — isolation and latch valves with decades of flight heritage.",
    subtypes: [
      "Latching isolation valves",
      "Normally-closed solenoid valves",
      "Single- & dual-line isolation valves",
    ],
    suppliers: ["Moog"],
    importHeavy: true,
    image: "",
    imageAlt: "Spacecraft propulsion isolation / latch valve",
  },
  {
    slug: "connectors-harnessing",
    icon: "Cable",
    title: "Connectors & harnessing",
    blurb:
      "Space-grade interconnect across the whole vehicle — connectors, cable assemblies, release mechanisms, and databus.",
    subtypes: [
      "Micro-D & Nano-D connectors",
      "D-Sub & circular (38999) connectors",
      "Cable assemblies & space wire",
      "Hold-down & release mechanisms",
      "MIL-STD-1553 databus",
    ],
    suppliers: ["Glenair", "TE Connectivity"],
    image: "",
    imageAlt: "Space-grade Micro-D connectors and wiring harness",
  },
  {
    slug: "sensors",
    icon: "Radar",
    title: "Sensors",
    blurb:
      "Measurement and sensing components qualified for the launch and orbital environment.",
    subtypes: [
      "Temperature sensors (NTC)",
      "Coarse sun sensors",
      "Pressure & position sensors",
    ],
    suppliers: ["TE Connectivity", "Blue Canyon Technologies"],
    image: "",
    imageAlt: "Space-qualified temperature / sun sensor",
  },
  {
    slug: "ground-segment-gse",
    icon: "SatelliteDish",
    title: "Ground segment, GSE & test",
    blurb:
      "Everything on the ground — ground-station antennas plus the electrical and mechanical equipment for assembly, integration and test.",
    subtypes: [
      "Ground-station antennas (S / X-band, 3–7.5 m)",
      "Electrical GSE (solar-array & battery sim, RF SCOE)",
      "Mechanical GSE (lifting, adapters, handling)",
      "Spacecraft interface simulators",
    ],
    suppliers: ["Dhruva Space (India)", "Keysight", "Celestia STS", "Beyond Gravity"],
    image: "",
    imageAlt: "Ground-station antenna and EGSE test rack",
  },
  {
    slug: "thermal",
    icon: "Thermometer",
    title: "Thermal protection",
    blurb:
      "Materials and hardware that keep flight electronics and structures within their thermal limits.",
    subtypes: [
      "Multi-layer insulation (MLI)",
      "Silica-fibre tiles",
      "Thermal straps & interface materials",
    ],
    suppliers: ["Beyond Gravity", "specialist material suppliers"],
    image: "",
    imageAlt: "Multi-layer insulation blanket / thermal hardware",
  },
];

/* India-specific procurement friction — the problem Elumenuvo absorbs.
   Source: WEF / IN-SPACe "Strengthening India's Space Supply Chain
   Ecosystem" (2025) + ISRO import data. */
export const INDIA_FRICTION = [
  {
    stat: "12–16 mo",
    label: "Typical lead times",
    detail:
      "Critical imported components routinely take over a year — enough to slip a launch.",
  },
  {
    stat: "~50%",
    label: "Satellite content imported",
    detail:
      "Roughly half of satellite hardware is imported; semiconductors, carbon fibre, and space-grade cells/batteries top the list.",
  },
  {
    stat: "ITAR / EAR",
    label: "Export controls",
    detail:
      "US and EU dual-use controls add licensing, paperwork, and customs friction on space-grade parts shipped to India.",
  },
];
