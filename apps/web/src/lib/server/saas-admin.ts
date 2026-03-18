export function getSaaSAdminEmails() {
    return (process.env.OPENAUTOMATE_SAAS_ADMIN_EMAILS || process.env.NEXT_PUBLIC_OPENAUTOMATE_SAAS_ADMIN_EMAILS || '')
        .split(',')
        .map((email) => email.trim().toLowerCase())
        .filter(Boolean);
}

export function isSaaSAdminEmail(email?: string | null) {
    if (!email) return false;
    return getSaaSAdminEmails().includes(email.toLowerCase());
}
