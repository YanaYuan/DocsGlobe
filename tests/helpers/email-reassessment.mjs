import { beforeGraduate } from "./email-graduate.mjs";

export function beforeReassessment(data) {
  data = beforeGraduate(data);
  const isNew = id => ["email-reassess-", "email-hundred-"].some(prefix => id.startsWith(prefix));
  return {
    ...data,
    sources: data.sources.filter(source => !isNew(source.id)),
    doctors: data.doctors.map(doctor => ({
      ...doctor,
      contacts: doctor.contacts.filter(contact => !isNew(contact.sourceId)),
      evidence: doctor.evidence.filter(item => !isNew(item.sourceId)),
    })),
  };
}
