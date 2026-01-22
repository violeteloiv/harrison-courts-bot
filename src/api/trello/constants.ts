export const BOARDS = {
    COUNTY: "68929e8db5fe44776b435721",
    CIRCUIT: "6892a4c496df6092610ed5db",
};

export const TEMPLATE_CARDS = {
    county: {
        list_id: "696ec3bd4493ff7eb2db5d97",
        card_id: "68944e50232e7a5cd1f726e0",
    },
    circuit: {
        list_id: "6892a4c496df6092610ed6dc",
        card_id: "6896e43ff3c33669b7af985a",
    },
};

export const CASE_LABELS: Record<string, { id: string; name: string }> = {
    civil: { id: "6897f11ed92e87ddd328ed1b", name: "CIVIL" },
    criminal: { id: "6897f125e85d8fe0a3529d90", name: "CRIMINAL" },
    expungement: { id: "6897f13b58f531982d709450", name: "EXPUNGEMENT" },
    special: { id: "6897f141a2b53de765c705e5", name: "SPECIAL" },
    admin: { id: "6892a4c496df6092610ed6d5", name: "ADMIN" },
};