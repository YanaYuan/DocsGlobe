import { beforeTenRounds } from "./email-ten.mjs";

export function beforeReflection(data) {
  data = beforeTenRounds(data);
  const added = sourceId => sourceId.startsWith("email-reflect-");
  return {
    ...data,
    sources: data.sources.filter(source => !added(source.id)),
    doctors: data.doctors.map(doctor => ({
      ...doctor,
      contacts: doctor.contacts.filter(contact => !added(contact.sourceId)),
      evidence: doctor.evidence.filter(item => !added(item.sourceId)),
    })),
  };
}
