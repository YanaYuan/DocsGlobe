import { beforeJournal } from "./email-journal.mjs";

const addedContactSources = new Map([
  ["puh3-xhk-5081", "email-hundred-pmc12389329"],
  ["puh3-gk-1722", "email-hundred-pmc11939441"],
  ["puh3-gk-6963", "email-hundred-pmc6805603"],
  ["puh3-ptwk-1561", "email-graduate-pmc7877389"],
  ["puh3-szyxzx-3271", "email-hundred-pmc6245701"],
  ["puh3-ttk-4035", "email-hundred-pmc9137062"],
  ["puh3-ttk-4045", "email-hundred-pmc9137062"],
  ["puh3-wzbxk-1551", "email-graduate-pmc9746762"],
  ["puh3-yk-1588", "email-graduate-pmc6192275"],
]);

export function beforeGraduate(data) {
  data = beforeJournal(data);
  return {
    ...data,
    sources: data.sources.filter(source => !source.id.startsWith("email-graduate-")),
    doctors: data.doctors.map(doctor => {
      const sourceId = addedContactSources.get(doctor.id);
      return {
        ...doctor,
        contacts: doctor.contacts.filter(contact => contact.sourceId !== sourceId),
        evidence: doctor.evidence.filter(item => item.sourceId !== sourceId ||
          item.fields.length !== 1 || item.fields[0] !== "contacts"),
      };
    }),
  };
}
