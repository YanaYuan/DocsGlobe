import { beforeGraduate } from "./email-graduate.mjs";

const laterSharedSourceRecipients = new Set([
  "puh3-sjwk-2801", "puh3-sjwk-3001", "puh3-sjwk-3161",
]);

export function beforeCrossfieldContacts(data) {
  data = beforeGraduate(data);
  // Three new recipients reuse an old article, so source age alone cannot restore the baseline.
  const isLaterSource = id => ["email-crossfield-", "email-followup-", "email-innovation-", "email-author-", "email-corresp-", "email-trial-", "email-orcid-", "email-mentor-round2-", "email-audit-", "email-reassess-", "email-hundred-"]
    .some(prefix => id.startsWith(prefix));
  return data.doctors.map(d => ({
    ...d,
    contacts: laterSharedSourceRecipients.has(d.id) ? [] :
      d.contacts.filter(c => !isLaterSource(c.sourceId)),
    evidence: d.evidence.filter(e => !isLaterSource(e.sourceId) &&
      (!laterSharedSourceRecipients.has(d.id) || !e.fields.includes("contacts"))),
  }));
}
