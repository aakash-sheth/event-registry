/**
 * Config loader for Living Poster invitations
 */

import { InviteConfig } from './schema'

/**
 * Load config from API (stub - can be extended to fetch from database)
 */
export async function loadConfig(slug: string): Promise<InviteConfig | null> {
  // TODO: Fetch from API endpoint
  // For now, return null to use demo config
  return null
}

/**
 * Demo config for /aakash-alisha route
 */
export const DEMO: InviteConfig = {
  themeId: 'classic-noir',
  hero: {
    background: {
      type: 'image',
      src: '/demo-bg.jpg',
      parallax: false,
    },
    eventType: 'Wedding Celebration',
    title: "Aakash & Alisha's Wedding",
    subtitle: 'We would love your presence',
    showTimer: true,
    eventDate: '2025-12-22T18:00:00-05:00',
    buttons: [
      { label: 'Save the Date', action: 'calendar' },
      { label: 'RSVP', action: 'rsvp', href: '/event/aakash-alisha/rsvp' },
      { label: 'Registry', action: 'registry', href: '/registry/aakash-alisha' },
    ],
  },
  descriptionMarkdown: [
    '# Details',
    'Join us for an evening of love, laughter, and joy.',
    '',
    '**Venue:** Orchid Lawn, Pune',
    '',
    '**Dress Code:** Pastel & Elegant',
    '',
    '## Schedule',
    '- 6:00 PM — Welcome & Seating',
    '- 6:30 PM — Ceremony',
    '- 7:30 PM — Dinner & Dancing',
  ].join('\n'),
}

