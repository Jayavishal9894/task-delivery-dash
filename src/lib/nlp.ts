// Natural-language parsing for task input.
// Extracts due time, day, recurrence, urgency from free text and returns the
// stripped task name plus suggested field values.

import { ROUTINES } from "./tasks";

export type Parsed = {
  name: string;
  time?: string; // HH:MM (24h)
  date?: Date; // date portion (time set to 00:00)
  recurrence?: "none" | "daily" | "weekly" | "custom";
  customDays?: number[];
  urgent?: boolean;
  priority?: "low" | "medium" | "high";
  routineKey?: string;
  routineLabel?: string;
  matched: string[]; // human-readable detections, e.g. "6:00 PM", "tomorrow", "daily"
};

const DAY_NAMES: Record<string, number> = {
  sunday: 0, sun: 0,
  monday: 1, mon: 1,
  tuesday: 2, tue: 2, tues: 2,
  wednesday: 3, wed: 3,
  thursday: 4, thu: 4, thur: 4, thurs: 4,
  friday: 5, fri: 5,
  saturday: 6, sat: 6,
};

const pad = (n: number) => String(n).padStart(2, "0");

const stripRange = (s: string, ranges: Array<[number, number]>) => {
  if (ranges.length === 0) return s;
  // merge then cut
  ranges.sort((a, b) => a[0] - b[0]);
  let out = "";
  let cursor = 0;
  for (const [a, b] of ranges) {
    if (a < cursor) continue;
    out += s.slice(cursor, a);
    cursor = b;
  }
  out += s.slice(cursor);
  return out.replace(/\s{2,}/g, " ").replace(/\s+([,.!?])/g, "$1").trim();
};

const titleCase = (s: string) =>
  s.length ? s[0].toUpperCase() + s.slice(1) : s;

export function parseTaskInput(raw: string): Parsed {
  const text = raw;
  const lower = text.toLowerCase();
  const cuts: Array<[number, number]> = [];
  const matched: string[] = [];
  const out: Parsed = { name: raw, matched };

  // --- Urgency ---
  const urgentRe = /\b(urgent|asap|important|critical|don'?t forget)\b|!{2,}/gi;
  let um: RegExpExecArray | null;
  while ((um = urgentRe.exec(text)) !== null) {
    out.urgent = true;
    out.priority = "high";
    cuts.push([um.index, um.index + um[0].length]);
    if (!matched.includes("urgent")) matched.push("urgent");
  }

  // --- Explicit priority words ---
  const prioRe = /\b(high|medium|low)\s+priority\b/i;
  const pm = prioRe.exec(text);
  if (pm) {
    out.priority = pm[1].toLowerCase() as "low" | "medium" | "high";
    cuts.push([pm.index, pm.index + pm[0].length]);
    matched.push(`${out.priority} priority`);
  }

  // --- Routine hints ---
  // Match phrases like "after lunch", "after waking up", "before sleeping",
  // "after reaching office", "after leaving office", "after brushing teeth"
  const routinePatterns: Array<{ re: RegExp; key: string; label: string }> = [
    { re: /\bafter\s+waking\s+up\b/i, key: "wake", label: "After waking up" },
    { re: /\bafter\s+brushing(\s+teeth)?\b/i, key: "teeth", label: "After brushing teeth" },
    { re: /\bafter\s+breakfast\b/i, key: "breakfast", label: "After breakfast" },
    { re: /\bafter\s+lunch\b/i, key: "lunch", label: "After lunch" },
    { re: /\bafter\s+dinner\b/i, key: "dinner", label: "After dinner" },
    { re: /\bbefore\s+(sleeping|sleep|bed)\b/i, key: "sleep", label: "Before sleeping" },
    { re: /\bafter\s+reaching\s+office\b/i, key: "office_in", label: "After reaching office" },
    { re: /\bafter\s+leaving\s+office\b/i, key: "office_out", label: "After leaving office" },
  ];
  for (const p of routinePatterns) {
    const rm = p.re.exec(text);
    if (rm) {
      out.routineKey = p.key;
      out.routineLabel = p.label;
      cuts.push([rm.index, rm.index + rm[0].length]);
      matched.push(p.label.toLowerCase());
      break;
    }
  }
  void ROUTINES; // ensure import not pruned

  // --- Recurrence ---
  // every weekday / weekend
  const weekdayRe = /\bevery\s+weekday(s)?\b/i;
  const weekendRe = /\bevery\s+weekend(s)?\b/i;
  const dailyRe = /\b(every\s+(day|morning|evening|night|afternoon)|daily)\b/i;
  const weeklyRe = /\b(every\s+week|weekly)\b/i;
  const everyDowRe = /\bevery\s+(sunday|monday|tuesday|wednesday|thursday|friday|saturday|sun|mon|tue|tues|wed|thu|thur|thurs|fri|sat)s?\b/gi;

  let m: RegExpExecArray | null;
  if ((m = weekdayRe.exec(text))) {
    out.recurrence = "custom";
    out.customDays = [1, 2, 3, 4, 5];
    cuts.push([m.index, m.index + m[0].length]);
    matched.push("every weekday");
  } else if ((m = weekendRe.exec(text))) {
    out.recurrence = "custom";
    out.customDays = [0, 6];
    cuts.push([m.index, m.index + m[0].length]);
    matched.push("every weekend");
  } else if ((m = dailyRe.exec(text))) {
    out.recurrence = "daily";
    cuts.push([m.index, m.index + m[0].length]);
    matched.push("daily");
  } else if ((m = weeklyRe.exec(text))) {
    out.recurrence = "weekly";
    cuts.push([m.index, m.index + m[0].length]);
    matched.push("weekly");
  } else {
    const days = new Set<number>();
    let dm: RegExpExecArray | null;
    while ((dm = everyDowRe.exec(text)) !== null) {
      const d = DAY_NAMES[dm[1].toLowerCase()];
      if (d !== undefined) days.add(d);
      cuts.push([dm.index, dm.index + dm[0].length]);
    }
    if (days.size) {
      out.recurrence = "custom";
      out.customDays = [...days].sort();
      matched.push("custom days");
    }
  }

  // --- Date hints ---
  const todayRe = /\btoday\b/i;
  const tomorrowRe = /\btomorrow\b|\btmrw\b|\btmr\b/i;
  const thisDowRe = /\b(this|on|next)\s+(sunday|monday|tuesday|wednesday|thursday|friday|saturday|sun|mon|tue|tues|wed|thu|thur|thurs|fri|sat)\b/i;
  const bareDowRe = /\bon\s+(sunday|monday|tuesday|wednesday|thursday|friday|saturday)\b/i;

  const now = new Date();
  let dateMatched = false;

  if ((m = tomorrowRe.exec(text))) {
    const d = new Date(now);
    d.setDate(d.getDate() + 1);
    d.setHours(0, 0, 0, 0);
    out.date = d;
    cuts.push([m.index, m.index + m[0].length]);
    matched.push("tomorrow");
    dateMatched = true;
  } else if ((m = todayRe.exec(text))) {
    const d = new Date(now);
    d.setHours(0, 0, 0, 0);
    out.date = d;
    cuts.push([m.index, m.index + m[0].length]);
    matched.push("today");
    dateMatched = true;
  } else if ((m = thisDowRe.exec(text)) || (m = bareDowRe.exec(text))) {
    const kind = m[1].toLowerCase(); // this/on/next or "on" from bareDowRe (m[1] is the dow there)
    const dowToken = (m[2] ?? m[1]).toLowerCase();
    const day = DAY_NAMES[dowToken];
    if (day !== undefined) {
      const d = new Date(now);
      d.setHours(0, 0, 0, 0);
      let diff = (day - d.getDay() + 7) % 7;
      if (diff === 0) diff = 7; // future occurrence
      if (kind === "next" && diff < 7) diff += 7;
      d.setDate(d.getDate() + diff);
      out.date = d;
      cuts.push([m.index, m.index + m[0].length]);
      matched.push(titleCase(dowToken));
      dateMatched = true;
    }
  }

  // --- Time ---
  // at/by 6pm | 6:30pm | 9 am | 18:00 | noon | midnight
  const noonRe = /\b(at\s+|by\s+)?(noon|midnight)\b/i;
  const clockRe = /\b(at|by|@)\s*(\d{1,2})(?::(\d{2}))?\s*(am|pm|a\.m\.|p\.m\.)?\b/i;
  const bareTimeRe = /\b(\d{1,2}):(\d{2})\s*(am|pm)?\b/i;

  let h: number | undefined;
  let mi = 0;
  let timeRange: [number, number] | null = null;

  if ((m = noonRe.exec(text))) {
    h = m[2].toLowerCase() === "noon" ? 12 : 0;
    mi = 0;
    timeRange = [m.index, m.index + m[0].length];
    matched.push(m[2].toLowerCase());
  } else if ((m = clockRe.exec(text))) {
    const hr = parseInt(m[2], 10);
    const mm = m[3] ? parseInt(m[3], 10) : 0;
    const mer = m[4]?.toLowerCase().replace(/\./g, "");
    if (!isNaN(hr) && hr >= 0 && hr <= 23 && mm >= 0 && mm < 60) {
      let H = hr;
      if (mer === "pm" && H < 12) H += 12;
      else if (mer === "am" && H === 12) H = 0;
      h = H;
      mi = mm;
      timeRange = [m.index, m.index + m[0].length];
      const display = `${((H + 11) % 12) + 1}:${pad(mm)} ${H < 12 ? "AM" : "PM"}`;
      matched.push(display);
    }
  } else if ((m = bareTimeRe.exec(text))) {
    const hr = parseInt(m[1], 10);
    const mm = parseInt(m[2], 10);
    const mer = m[3]?.toLowerCase();
    if (!isNaN(hr) && hr >= 0 && hr <= 23 && mm >= 0 && mm < 60) {
      let H = hr;
      if (mer === "pm" && H < 12) H += 12;
      else if (mer === "am" && H === 12) H = 0;
      h = H;
      mi = mm;
      timeRange = [m.index, m.index + m[0].length];
      const display = `${((H + 11) % 12) + 1}:${pad(mm)} ${H < 12 ? "AM" : "PM"}`;
      matched.push(display);
    }
  }

  if (h !== undefined) {
    out.time = `${pad(h)}:${pad(mi)}`;
    if (timeRange) cuts.push(timeRange);
    // If no explicit date but time is in past, assume tomorrow
    if (!dateMatched) {
      const proposed = new Date();
      proposed.setHours(h, mi, 0, 0);
      if (proposed.getTime() < Date.now()) {
        const d = new Date();
        d.setDate(d.getDate() + 1);
        d.setHours(0, 0, 0, 0);
        out.date = d;
      }
    }
  }

  // Strip detected ranges and clean leftover prepositions
  let name = stripRange(text, cuts);
  name = name
    .replace(/\s+(at|by|on|every|this|next)\s*$/i, "")
    .replace(/^(at|by|on|every|this|next)\s+/i, "")
    .replace(/\s{2,}/g, " ")
    .trim();
  out.name = name.length ? name[0].toUpperCase() + name.slice(1) : text.trim();

  return out;
}

export function describeParsed(p: Parsed): string {
  const bits: string[] = [];
  if (p.time) {
    const [hh, mm] = p.time.split(":").map(Number);
    const display = `${((hh + 11) % 12) + 1}:${pad(mm)} ${hh < 12 ? "AM" : "PM"}`;
    bits.push(display);
  }
  if (p.date) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const diff = Math.round((p.date.getTime() - today.getTime()) / 86400000);
    if (diff === 0) bits.push("today");
    else if (diff === 1) bits.push("tomorrow");
    else bits.push(p.date.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" }));
  }
  if (p.recurrence && p.recurrence !== "none") {
    if (p.recurrence === "custom" && p.customDays?.length) {
      const dn = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
      bits.push(p.customDays.map((d) => dn[d]).join("/"));
    } else bits.push(p.recurrence);
  }
  if (p.urgent) bits.push("urgent");
  return bits.join(" · ");
}