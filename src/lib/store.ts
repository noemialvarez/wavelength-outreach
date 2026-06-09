import { useSyncExternalStore } from "react";

export type SignalType = "Funding" | "Key hire" | "Product launch" | "Other";
export type LeadStatus = "Pending review" | "Approved" | "Skipped" | "Pushed";

export type Source = { id: string; name: string; url: string; enabled: boolean };
export type IcpFilters = {
  titles: string[];
  industries: string[];
  companySize: string;
  geography: string;
};
export type Lead = {
  id: string;
  company: string;
  signalSummary: string;
  signalType: SignalType;
  founderName: string;
  linkedinUrl: string;
  status: LeadStatus;
  dateFound: string;
  draftSubject?: string;
  draftBody?: string;
};
export type EmailSettings = {
  positioningFileName: string;
  toneNotes: string;
  lemlistSequenceId: string;
};
export type Prospect = {
  id: string;
  name: string;
  company: string;
  linkedinUrl: string;
  addedDate: string;
  lastActivity: string;
  status: "Active" | "Paused";
};
export type EngagementPost = {
  id: string;
  prospectId: string;
  prospectName: string;
  company: string;
  snippet: string;
  postUrl: string;
  draftComment: string;
};
export type SequenceStatus = "Active" | "Opened" | "Replied" | "Bounced" | "Unsubscribed";
export type SequenceRow = {
  id: string;
  leadName: string;
  company: string;
  step: number;
  lastActivity: string;
  status: SequenceStatus;
  flagged?: boolean;
  notes?: string;
};

type State = {
  sources: Source[];
  icp: IcpFilters;
  leads: Lead[];
  emailSettings: EmailSettings;
  prospects: Prospect[];
  engagement: EngagementPost[];
  sequences: SequenceRow[];
};

const KEY = "insightsphere-state-v1";

const seed = (): State => ({
  sources: [
    { id: "s1", name: "Wellfound", url: "https://wellfound.com", enabled: true },
    { id: "s2", name: "Startupticker.ch", url: "https://startupticker.ch", enabled: true },
    { id: "s3", name: "Swiss Startup Radar", url: "https://swissstartupradar.com", enabled: true },
    { id: "s4", name: "Crunchbase", url: "https://crunchbase.com", enabled: false },
  ],
  icp: {
    titles: ["CEO", "Head of Sales", "VP Marketing"],
    industries: ["SaaS", "Fintech"],
    companySize: "11-50",
    geography: "Switzerland",
  },
  leads: [
    {
      id: "l1",
      company: "Nordlys AI",
      signalSummary: "Raised CHF 4M seed round led by Redalpine",
      signalType: "Funding",
      founderName: "Lena Krüger",
      linkedinUrl: "https://linkedin.com/in/lenakrueger",
      status: "Pending review",
      dateFound: "2026-06-08",
    },
    {
      id: "l2",
      company: "Helvetia Robotics",
      signalSummary: "Hired new VP Sales from ABB",
      signalType: "Key hire",
      founderName: "Marc Aebischer",
      linkedinUrl: "https://linkedin.com/in/marcaebischer",
      status: "Approved",
      dateFound: "2026-06-07",
      draftSubject: "Quick thought after your VP Sales hire",
      draftBody:
        "Hi Marc,\n\nCongrats on bringing on your new VP Sales — saw the news. At this stage outbound systems often need a refresh; we help Swiss B2B teams set up a repeatable pipeline in 30 days.\n\nWorth a 15-min chat next week?\n\nBest,\n",
    },
    {
      id: "l3",
      company: "Alpine Health",
      signalSummary: "Launched new patient-engagement product",
      signalType: "Product launch",
      founderName: "Sophie Berger",
      linkedinUrl: "https://linkedin.com/in/sophieberger",
      status: "Pending review",
      dateFound: "2026-06-06",
    },
    {
      id: "l4",
      company: "Zürich Logistics Co",
      signalSummary: "Featured in Startupticker for warehouse AI pilot",
      signalType: "Other",
      founderName: "Tobias Meier",
      linkedinUrl: "https://linkedin.com/in/tobiasmeier",
      status: "Skipped",
      dateFound: "2026-06-05",
    },
  ],
  emailSettings: {
    positioningFileName: "",
    toneNotes: "Direct, warm, Swiss German business context. Short sentences.",
    lemlistSequenceId: "",
  },
  prospects: [
    {
      id: "p1",
      name: "Anna Schmid",
      company: "Veltra",
      linkedinUrl: "https://linkedin.com/in/annaschmid",
      addedDate: "2026-05-20",
      lastActivity: "2 days ago",
      status: "Active",
    },
    {
      id: "p2",
      name: "Daniel Frei",
      company: "Lumen Labs",
      linkedinUrl: "https://linkedin.com/in/danielfrei",
      addedDate: "2026-05-22",
      lastActivity: "5 hours ago",
      status: "Active",
    },
  ],
  engagement: [
    {
      id: "e1",
      prospectId: "p1",
      prospectName: "Anna Schmid",
      company: "Veltra",
      snippet:
        "Excited to share that Veltra has just closed our Series A. We're hiring across engineering and go-to-market — reach out if you're building in the climate-tech space.",
      postUrl: "https://linkedin.com/posts/annaschmid-1",
      draftComment:
        "Congrats Anna — exciting milestone. The climate-tech GTM hiring market in DACH is heating up fast.",
    },
    {
      id: "e2",
      prospectId: "p2",
      prospectName: "Daniel Frei",
      company: "Lumen Labs",
      snippet:
        "Three lessons from our first year selling to Swiss enterprises: trust beats novelty, references compound, and slow procurement is real but learnable.",
      postUrl: "https://linkedin.com/posts/danielfrei-2",
      draftComment:
        "Daniel, the references-compound point hits hard. Curious how you scaled past the first 5 logos.",
    },
  ],
  sequences: [
    {
      id: "q1",
      leadName: "Marc Aebischer",
      company: "Helvetia Robotics",
      step: 2,
      lastActivity: "Opened 1h ago",
      status: "Opened",
    },
    {
      id: "q2",
      leadName: "Priya Patel",
      company: "Bern Data",
      step: 1,
      lastActivity: "Sent yesterday",
      status: "Active",
    },
    {
      id: "q3",
      leadName: "Felix Huber",
      company: "Volt Mobility",
      step: 3,
      lastActivity: "Replied 30m ago",
      status: "Replied",
    },
    {
      id: "q4",
      leadName: "Nora Keller",
      company: "Sentio",
      step: 2,
      lastActivity: "Bounced",
      status: "Bounced",
    },
  ],
});

let state: State = (() => {
  if (typeof window === "undefined") return seed();
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return JSON.parse(raw) as State;
  } catch {
    /* ignore */
  }
  const s = seed();
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    /* ignore */
  }
  return s;
})();

const listeners = new Set<() => void>();

function emit() {
  if (typeof window !== "undefined") {
    try {
      localStorage.setItem(KEY, JSON.stringify(state));
    } catch {
      /* ignore */
    }
  }
  listeners.forEach((l) => l());
}

export const store = {
  get: () => state,
  set: (updater: (s: State) => State) => {
    state = updater(state);
    emit();
  },
  subscribe: (l: () => void) => {
    listeners.add(l);
    return () => listeners.delete(l);
  },
  reset: () => {
    state = seed();
    emit();
  },
};

export function useStore<T>(selector: (s: State) => T): T {
  return useSyncExternalStore(
    (l) => store.subscribe(l),
    () => selector(store.get()),
    () => selector(state),
  );
}

export const uid = () => Math.random().toString(36).slice(2, 10);

export function generateDraft(lead: Lead): { subject: string; body: string } {
  const subject = `Quick thought on ${lead.company}`;
  const body = `Hi ${lead.founderName.split(" ")[0]},\n\nSaw the news about ${lead.company} — ${lead.signalSummary.toLowerCase()}. Congrats.\n\nWe help founders in your stage build a Swiss B2B outbound motion that actually converts. Worth a quick 15-min call next week?\n\nBest,\n`;
  return { subject, body };
}
