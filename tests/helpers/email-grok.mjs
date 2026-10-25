export function beforeGrok(data) {
  const added = sourceId => sourceId.startsWith("email-grok-");
  return {
    ...data,
    sources: data.sources.filter(source => !added(source.id)),
    doctors: data.doctors.map(doctor => ({
      ...doctor,
      contacts: (doctor.contacts || []).filter(contact => !added(contact.sourceId)),
      evidence: (doctor.evidence || []).filter(item => !added(item.sourceId)),
    })),
  };
}
