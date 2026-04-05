/**
 * Contact Picker API (Chromium / Android). https://developer.mozilla.org/en-US/docs/Web/API/Contact_Picker_API
 */

export type PickerGuestRow = {
  name: string
  phone: string
  email: string
}

type ContactPickerContact = {
  name?: string[]
  tel?: string[]
  email?: string[]
}

function contactDisplayName(contact: ContactPickerContact): string {
  const parts = contact.name
  if (!parts?.length) return ''
  return parts.map((s) => s.trim()).filter(Boolean).join(' ') || parts[0] || ''
}

/** Picker does not expose TEL TYPE; use first non-empty number (matches common single-mobile case). */
function firstTel(contact: ContactPickerContact): string {
  const tels = contact.tel
  if (!tels?.length) return ''
  return tels.map((t) => t.trim()).find(Boolean) || ''
}

function firstEmail(contact: ContactPickerContact): string {
  const emails = contact.email
  if (!emails?.length) return ''
  return emails.map((e) => e.trim()).find(Boolean) || ''
}

export function isContactPickerSupported(): boolean {
  if (typeof navigator === 'undefined') return false
  const c = (navigator as Navigator & { contacts?: { select?: unknown } }).contacts
  return Boolean(c && typeof c.select === 'function')
}

export async function selectContactsAsGuestRows(): Promise<PickerGuestRow[]> {
  const nav = navigator as Navigator & {
    contacts: {
      select: (
        properties: string[],
        options?: { multiple?: boolean }
      ) => Promise<ContactPickerContact[]>
    }
  }
  const contacts = await nav.contacts.select(['name', 'tel', 'email'], { multiple: true })
  return contacts.map((c) => ({
    name: contactDisplayName(c),
    phone: firstTel(c),
    email: firstEmail(c),
  }))
}
