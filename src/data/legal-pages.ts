import { supabase } from '../config/supabase';
import { AppError } from '../utils/api-response';
import { hasRichContent, sanitizeRichText } from '../utils/rich-text';

/**
 * The four legal pages — Privacy Policy, Terms, Cancellation Policy and Data
 * Retention — and the single place their English lives.
 *
 * What is written here is the built-in wording. Admin → Settings can replace
 * any part of it (settings legal_<doc>_<part>); an emptied setting falls back
 * to this again. Translations (entity type legal_pages) are made from the
 * resulting English like any other content, which is why it lives on the
 * server: the website, the Settings form and the translation tools all read
 * the same text.
 */

export const LEGAL_DOCUMENTS = ['privacy', 'terms', 'cancellation', 'data_retention'] as const;
export type LegalDocKey = (typeof LEGAL_DOCUMENTS)[number];

/** The parts an editor can change in Settings. */
export const LEGAL_PARTS = ['title', 'updated', 'intro', 'body', 'meta_description'] as const;
export type LegalPart = (typeof LEGAL_PARTS)[number];

export type LegalPage = Record<LegalPart, string>;

/**
 * Fixed ids, so each page can own translations like a database row does
 * (content_translations.entity_id is a uuid). Never change them: every
 * translation of a page is keyed by its id.
 */
export const LEGAL_PAGE_IDS: Record<LegalDocKey, string> = {
  privacy: '9f54a814-4ab1-45bf-81dc-6e8ffad69dee',
  terms: 'acf43f3f-bda8-4f28-9ee7-7d0e1bb999cb',
  cancellation: 'd8b55d10-bbff-4443-b623-be698d6bf39c',
  data_retention: '1891dad6-cb04-4b63-a5fd-2461aa75b6af'
};

export const isLegalDocument = (value: unknown): value is LegalDocKey =>
  (LEGAL_DOCUMENTS as readonly string[]).includes(String(value));

export const legalDocForId = (id: string): LegalDocKey | null =>
  LEGAL_DOCUMENTS.find((doc) => LEGAL_PAGE_IDS[doc] === id) ?? null;

export const legalSettingKey = (doc: LegalDocKey, part: LegalPart): string => `legal_${doc}_${part}`;

export const LEGAL_DEFAULTS: Record<LegalDocKey, LegalPage> = {
  privacy: {
    title: 'Privacy Policy',
    updated: 'August 2026',
    intro: 'Your trust matters to us. This policy explains what information we collect when you browse our site, send an enquiry, chat with our AI Travel Advisor, or talk to us on WhatsApp — and exactly how we use and protect it.',
    meta_description: 'How Goldfinch Adventures collects, uses and protects your personal information when you plan a trip with us, chat with our AI Travel Advisor, or talk to us on WhatsApp.',
    body: `
<h2>Who is responsible for your data</h2>
<p><strong>Goldfinch Adventures Limited</strong> is responsible for the personal information described in this policy. We are an East Africa travel-planning company, based at 1923 Dodoma, United Republic of Tanzania. We help travellers plan safaris, Kilimanjaro climbs, gorilla trekking and beach holidays through honest, local expertise. In this policy, "we", "us" and "our" mean Goldfinch Adventures Limited.</p>
<p>If you have any question about your privacy, or you want to exercise any of the rights below, please reach us through the <a href="/contact">Contact</a> page and a specialist will pick it up.</p>
<p>This policy applies to our website, our AI Travel Advisor and our WhatsApp conversations with you. It does not cover third-party websites we may link to.</p>

<h2>Information we collect</h2>
<h3>Information you give us</h3>
<ul>
  <li><strong>Contact details</strong> — your name, email address, phone or WhatsApp number, and country of residence.</li>
  <li><strong>Trip preferences</strong> — destinations, travel dates, group size, budget range, interests and any notes you share when you submit a planning request or enquiry.</li>
  <li><strong>Messages</strong> — anything you write to us through forms, the AI Travel Advisor, WhatsApp, or when you contact our team.</li>
  <li><strong>Your permissions</strong> — whether you have asked us to message you on WhatsApp, and whether you want marketing. We record which form or conversation each permission came from and when you gave it, so we can always show why we contacted you.</li>
</ul>
<h3>Information collected automatically</h3>
<ul>
  <li>Basic technical data such as your browser and device type, and a temporary session identifier used to keep your chat working and to prevent abuse.</li>
  <li>A <strong>hashed</strong> version of your IP address. We use it only as a weak signal to limit spam and abuse — we do not store your raw IP address.</li>
  <li>Delivery receipts for WhatsApp messages we send you, and a note of when a quotation link was first opened.</li>
</ul>

<h2>How we use your information</h2>
<ul>
  <li>To answer your questions and respond to enquiries.</li>
  <li>To plan and tailor trip suggestions to your dates, budget and travel style.</li>
  <li>To create a <strong>booking request</strong> that one of our specialists reviews and follows up with you.</li>
  <li>To prepare and send you a quotation, and to record it if you accept.</li>
  <li>To message you on WhatsApp about your trip, where you have asked us to.</li>
  <li>To improve our service, content and the quality of the AI Travel Advisor.</li>
  <li>To keep the site secure and prevent misuse.</li>
  <li>To meet our legal and accounting obligations.</li>
</ul>
<p>We do not sell your personal information, and we do not use it for advertising.</p>

<h2>Our legal bases</h2>
<p>Where data protection law requires us to have a legal basis for using your information, these are ours:</p>
<ul>
  <li><strong>Legitimate interests</strong> — answering your enquiry and planning your trip, keeping the website secure and free of spam, and understanding how the site is used so we can improve it.</li>
  <li><strong>Consent</strong> — messaging you on WhatsApp, and sending you marketing. These are two separate permissions and we record each one on its own. You can withdraw either at any time.</li>
  <li><strong>Legal obligation</strong> — keeping accounting and business records for as long as the law requires.</li>
</ul>

<h2>Talking to us on WhatsApp</h2>
<p>You can hold a normal two-way conversation with us on WhatsApp, and we message from <strong>+255 673 337 026</strong>. WhatsApp is run by Meta, so Meta processes those messages in order to deliver them — the same as for any other WhatsApp conversation you have.</p>
<h3>How we get your permission</h3>
<ul>
  <li>Every form on our site carries a checkbox — "Contact me on WhatsApp about my trip, quotation and booking updates" — that is <strong>unticked by default</strong>. We record your permission with the time you gave it and the form it came from.</li>
  <li><strong>Giving us a phone number is not permission.</strong> We treat the number and the permission as two separate things, so we never message you simply because we have a number for you.</li>
  <li><strong>Messaging us first also counts.</strong> If you open a WhatsApp conversation with us, we record that as your opt-in — you have asked us to talk to you there.</li>
  <li>Leaving the box unticked on a later form does not cancel permission you gave us earlier by another route. If you want us to stop, tell us and we will stop.</li>
</ul>
<h3>Trip messages and marketing are separate</h3>
<p>Permission to message you about <strong>your own trip</strong> — quotations, booking updates, practical details — is not permission to market to you. Marketing has its own separate checkbox, and agreeing to one never implies the other.</p>
<h3>Meta's 24-hour rule</h3>
<p>WhatsApp limits when a business may message you. Within 24 hours of your last message to us we can reply freely; outside that window, we may only send <strong>pre-approved template messages</strong>. This is a WhatsApp platform rule, not ours, and it is there to protect you from unwanted messages.</p>
<h3>Stopping our messages</h3>
<p>Reply to any of our WhatsApp messages asking us to stop, or tell us through the <a href="/contact">Contact</a> page, and we will stop messaging you there. We will still reply to your enquiry by email.</p>

<h2>Quotations</h2>
<p>When a specialist prepares a priced offer for you, we send a private link containing a long, unguessable token. There is no account and no password — anyone with the link can open the quotation, so please treat it as personal to you.</p>
<p>Opening the quotation for the first time is recorded, so your specialist knows the offer actually arrived and can follow up properly. If you accept it, we store your acceptance, the time of it, and the traveller details you choose to give us — lead traveller name, email, phone and any notes.</p>
<p><strong>Accepting a quotation is not a confirmed booking and takes no payment.</strong> It tells us you are happy with the price; a specialist then confirms the details with you. See our <a href="/terms">Terms of Service</a> for how that works.</p>

<h2>The AI Travel Advisor</h2>
<p>Our AI Travel Advisor is powered by Anthropic's Claude. When you chat, your messages are processed to generate helpful, grounded responses about travel in East Africa. A short consent notice is shown before the advisor asks for any contact details.</p>
<p>The AI advisor offers guidance and suggestions only. <strong>It never takes payment and never confirms a booking</strong> — a human specialist always reviews and confirms your trip. We keep a record of conversations to assist you and to improve the service; see <a href="/data-retention">Data Retention</a> for how long we keep them.</p>

<h2>Keeping the site free of spam</h2>
<p>Our forms carry a hidden field that a real visitor never sees and never fills in, we limit how many times the same visitor can submit a form in a short window, and we use Cloudflare Turnstile to tell real visitors from automated abuse. These checks look at the submission and the connection, not at who you are.</p>

<h2>Who we share it with</h2>
<p>We share information only with the service providers that help us run Goldfinch Adventures, and only the minimum needed:</p>
<ul>
  <li><strong>Supabase</strong> — hosts our website, database and uploaded files.</li>
  <li><strong>Anthropic</strong> — powers the AI Travel Advisor with Claude.</li>
  <li><strong>Meta</strong> — delivers our WhatsApp Business messages, and receives the ones you send us.</li>
  <li><strong>Resend</strong> — sends our transactional email, such as enquiry confirmations and quotations.</li>
  <li><strong>HubSpot</strong> — our customer relationship tool, where your enquiry is managed and followed up.</li>
  <li><strong>Cloudflare</strong> — provides the Turnstile check that separates real visitors from bots.</li>
  <li><strong>Microsoft Clarity</strong> — shows us how pages are actually used so we can improve them.</li>
  <li><strong>Google Analytics</strong> — gives us aggregate traffic statistics.</li>
</ul>
<p>We may also disclose information where required by law.</p>

<h2>Cookies</h2>
<p>We use a small number of functional cookies and similar storage — for example, to remember your chat session and your shortlist. Our analytics providers, named above, also set their own. We do not use intrusive advertising trackers. Where a cookie notice is shown, you can manage your choices there.</p>

<h2>How long we keep your data</h2>
<ul>
  <li><strong>Anonymous AI advisor conversations</strong> — deleted automatically after <strong>90 days</strong>.</li>
  <li><strong>Analytics events</strong> — deleted automatically after <strong>180 days</strong>.</li>
  <li><strong>Enquiries, quotations and conversations linked to a booking request</strong> — kept while we assist you, and afterwards to meet our records and accounting obligations.</li>
</ul>
<p>Full details are on our <a href="/data-retention">Data Retention</a> page.</p>

<h2>Your rights</h2>
<p>You can ask us to access, correct or delete your personal information at any time, and you can withdraw your WhatsApp or marketing permission whenever you like without affecting anything we did beforehand. If you are in the EU or UK, you also have rights under the GDPR, including the right to object to or restrict certain processing, and the right to lodge a complaint with a supervisory authority. To exercise any of these, just <a href="/contact">contact us</a>.</p>

<h2>International transfers</h2>
<p>Some of our providers process data outside your country, including outside East Africa. Where this happens we take care to use reputable providers with appropriate safeguards.</p>

<h2>Children</h2>
<p>Our website and AI advisor are intended for adults planning travel. We do not knowingly collect information from children under 18 without a parent or guardian.</p>

<h2>Changes to this policy</h2>
<p>We may update this policy from time to time. The "last updated" date above always reflects the current version.</p>

<h2>Contact us</h2>
<p>Questions about your privacy, or want to exercise your rights? Please reach our team through the <a href="/contact">Contact</a> page and we will be glad to help.</p>
`.trim()
  },
  terms: {
    title: 'Terms of Service',
    updated: 'August 2026',
    intro: 'These terms explain how our website, AI Travel Advisor, quotations and WhatsApp messaging work — and, importantly, that everything here is a planning request that a human specialist confirms before anything is booked or paid.',
    meta_description: 'The terms that govern your use of the Goldfinch Adventures website, AI Travel Advisor, quotations and WhatsApp messaging — including why a request or an accepted quotation is never a confirmed booking.',
    body: `
<h2>Acceptance of these terms</h2>
<p>By using the Goldfinch Adventures website or AI Travel Advisor, you agree to these terms. If you do not agree, please do not use the site.</p>

<h2>What Goldfinch Adventures does</h2>
<p>Goldfinch Adventures Limited ("Goldfinch Adventures", "we", "us") helps travellers plan trips across East Africa. Through this website you can browse trips and destinations, ask our AI Travel Advisor for guidance, and submit a request for a Goldfinch specialist to help plan your trip. As your plans take shape, a specialist may send you a written quotation, and — if you ask us to — keep in touch with you on WhatsApp.</p>

<h2>Booking requests, not confirmed bookings</h2>
<p>Submitting a request — whether through a form or the AI Travel Advisor — <strong>does not create a confirmed booking</strong>. Every request is a planning enquiry. A Goldfinch specialist reviews it and contacts you to discuss the details, check availability, and confirm an accurate price before anything is agreed.</p>

<h2>Quotations</h2>
<p>A quotation is a priced offer that a specialist prepares for your trip, based on what you have told us. It is a proposal for you to consider — <strong>not a confirmed booking</strong>, and never a request for payment.</p>

<h3>Your quotation link is private</h3>
<p>We send each quotation as a link containing a long, unguessable token. That link is the only thing needed to view the offer and respond to it, so please treat it as private and avoid forwarding or posting it publicly — anyone who has it can open it. We record when a quotation is opened, so we know it reached you.</p>

<h3>Validity, and changes before you accept</h3>
<p>Each quotation shows the date it is valid until. We hold the quoted price until that date, and it remains subject to availability at the time of booking — dates, permits, park fees and seasonal rates all move. After the valid-until date the quotation lapses, and we will gladly prepare an up-to-date price if you ask. We may also revise or withdraw a quotation before you accept it, for example if availability changes or costs we rely on change.</p>

<h3>What accepting means</h3>
<p>Accepting a quotation records your agreement that the price and itinerary work for you, together with the traveller details you supply at that point, and moves your trip to the next stage. <strong>It takes no payment, and it does not confirm your booking.</strong> A specialist follows up to confirm availability and arrange the details with you. You can also decline a quotation, and you are welcome to tell us why so we can offer something that suits you better.</p>

<h2>No payment is taken online</h2>
<p>We do <strong>not</strong> collect payment through this website. You will never be asked to enter card or payment details here — not on a form, not in the AI Travel Advisor, and not when accepting a quotation. Any payment arrangements are made directly with your specialist after your trip has been discussed and confirmed, and only once you are happy to proceed.</p>

<h2>Prices and availability</h2>
<p>Prices shown on the site are <strong>indicative guide prices</strong> (typically "from" prices per person) intended to help you plan. They can change, and availability, dates, permits and seasonal rates are always subject to confirmation. Nothing on the website constitutes a binding offer or a guaranteed price until confirmed in writing by a specialist.</p>

<h2>Messaging you on WhatsApp</h2>
<p>WhatsApp is optional, and it is your choice. Every form on this site has a checkbox — <strong>unticked by default</strong> — that reads "Contact me on WhatsApp about my trip, quotation and booking updates". Ticking it gives us permission to message you on WhatsApp about your own trip: answering your enquiry, asking the questions we need to plan well, sending your quotation, and keeping you posted on your booking. We record when you gave that permission and which form it came from.</p>
<p>Giving us a phone number is <strong>not</strong> the same as asking to be messaged on it — only the checkbox does that. If you message our WhatsApp number first, we take that as permission to reply to you there. Leaving the box unticked on a later form does not cancel permission you have already given us another way; if you want us to stop, tell us (see below).</p>

<h3>Trip messages and marketing are separate</h3>
<p>Permission to message you about your own trip is separate from permission to send you travel ideas and offers. Those are two independent choices with their own checkboxes, and agreeing to one never signs you up for the other.</p>

<h3>The 24-hour rule</h3>
<p>WhatsApp is run by Meta, and Meta sets the rules for business messaging on it. One of them matters to you: more than 24 hours after your last message to us, we may only send pre-approved template messages rather than a free-form reply. That is a platform rule rather than ours, and it is why a message from us after a quiet spell can read more formally than usual. Sending us a message reopens normal conversation.</p>

<h3>Costs, and how to stop</h3>
<p>We do not charge you for WhatsApp messages, but your own mobile or internet provider's message and data rates may apply. You can ask us to stop at any time — say so in a reply on WhatsApp, or get in touch through the <a href="/contact">Contact</a> page — and we will continue by email instead. <strong>We reply by email either way</strong>, so declining WhatsApp never means a slower or lesser answer. How we store these messages and consent records is set out in our <a href="/privacy">Privacy Policy</a> and <a href="/data-retention">Data Retention</a> page.</p>

<h2>Using the AI Travel Advisor</h2>
<p>The AI Travel Advisor provides general information and suggestions to help you plan. It is an automated tool — not a human agent — and:</p>
<ul>
  <li>it does not confirm bookings or take payment;</li>
  <li>its suggestions may not always be complete or up to date, and it may occasionally be unavailable;</li>
  <li>important details (visas, health requirements, exact pricing, availability) should always be confirmed with our team.</li>
</ul>

<h2>Your responsibilities</h2>
<ul>
  <li>Provide accurate information so we can help you well.</li>
  <li>Ensure you hold valid travel documents, visas, vaccinations and travel insurance as required for your trip. We offer guidance, but meeting entry and health requirements remains your responsibility.</li>
  <li>Use the website and AI advisor lawfully and not to misuse, disrupt or attempt to abuse the service.</li>
</ul>

<h2>Acceptable use</h2>
<p>A few plain requests, so the site stays useful for everyone:</p>
<ul>
  <li><strong>Other people's details.</strong> If you are enquiring on behalf of a group, only share the details your fellow travellers are happy for you to give us. Please do not submit anyone's personal information without their permission.</li>
  <li><strong>No probing or abuse.</strong> Do not scan, overload or attempt to gain unauthorised access to the site, our systems or anyone else's quotation link.</li>
  <li><strong>No automated tools.</strong> Please do not point scripts, bots or scrapers at our forms or the AI Travel Advisor.</li>
</ul>
<p>To keep automated abuse out, our forms use a hidden field that only bots fill in, limits on how often the same visitor can submit, and a Cloudflare Turnstile check. Ordinary use should sail through; automated submissions may be blocked. We may decline or withdraw access to the site where it is being misused.</p>

<h2>Availability of the site</h2>
<p>We work to keep the website and AI Travel Advisor running well, but they may be unavailable at times — for maintenance and updates, or because of a problem with a service we depend on. We do not guarantee uninterrupted or error-free service, and features may change over time; if you cannot reach us here, the <a href="/contact">Contact</a> page has other ways to get hold of a specialist.</p>

<h2>Intellectual property</h2>
<p>The content on this website — text, images, branding and design — belongs to Goldfinch Adventures or its licensors and may not be copied or reused without permission.</p>

<h2>Third-party links</h2>
<p>Our site may link to third-party websites. We are not responsible for their content or practices, and you use them at your own discretion.</p>

<h2>Limitation of liability</h2>
<p>To the fullest extent permitted by law, Goldfinch Adventures is not liable for any indirect or consequential loss arising from your use of the website or AI Travel Advisor, or from reliance on indicative information published here before it is confirmed by a specialist. Once your trip is confirmed, the specific terms of that confirmed arrangement will govern it.</p>

<h2>Governing law</h2>
<p>These terms are governed by the laws of the United Republic of Tanzania, where Goldfinch Adventures is based, unless otherwise agreed in writing.</p>

<h2>Changes to these terms</h2>
<p>We may update these terms from time to time. The "last updated" date above reflects the current version.</p>

<h2>Contact us</h2>
<p>If you have any questions about these terms, please reach us through the <a href="/contact">Contact</a> page. You can also call or message us on <strong>+255 673 337 026</strong>, or write to Goldfinch Adventures Limited, 1923 Dodoma, Tanzania.</p>
`.trim()
  },
  cancellation: {
    title: 'Cancellation & Refund Policy',
    updated: 'June 2026',
    intro: 'We keep things fair and transparent. Planning requests are free to cancel, and once your trip is confirmed the exact cancellation terms are always shared with you in writing before any payment.',
    meta_description: 'How cancellations, changes and refunds work at Goldfinch Adventures — from a free-to-cancel planning request to confirmed trips governed by your written quote.',
    body: `
<h2>Cancelling a planning request or enquiry</h2>
<p>If you have only submitted a planning request or enquiry — through a form or the AI Travel Advisor — there is <strong>nothing to cancel and no charge</strong>. A request is not a booking. If you no longer wish to proceed, simply let your specialist know, or <a href="/contact">contact us</a>, and we will close the enquiry.</p>

<h2>Once your trip is confirmed</h2>
<p>When you decide to go ahead, your specialist sends you a written quote and booking confirmation. That document sets out the <strong>specific cancellation and refund terms for your trip</strong>, which depend on the lodges, parks, permits, flights and other suppliers involved. Those confirmed terms govern your booking. The points below explain how cancellations generally work so there are no surprises.</p>

<h2>Deposits and supplier costs</h2>
<p>Most East Africa trips require a deposit to secure lodges, vehicles and permits. Because suppliers commit resources on your behalf, some costs may be non-refundable once paid — for example:</p>
<ul>
  <li><strong>Gorilla and chimpanzee permits</strong>, which are issued in your name and are typically non-refundable once purchased.</li>
  <li><strong>Peak-season lodge deposits</strong> and domestic or international flights, which often carry supplier cancellation charges.</li>
  <li>Cancellations made closer to your departure date, which usually attract higher charges as suppliers can no longer resell the space.</li>
</ul>
<p>Your written quote always states the deposit, the balance due date, and the cancellation charges that apply at each stage.</p>

<h2>Changing your trip</h2>
<p>Plans change — we understand. We will always do our best to accommodate changes to dates, routing or party size, subject to availability and any supplier fees. Reach out to your specialist as early as possible and we will let you know what is possible and any cost involved.</p>

<h2>Refunds</h2>
<p>Where a refund is due under your confirmed terms, we process it promptly and transparently, returning any amounts that suppliers refund to us less any non-recoverable costs already incurred. We will always show you a clear breakdown.</p>

<h2>Travel insurance</h2>
<p>We strongly recommend comprehensive travel insurance that covers cancellation, curtailment, medical care and repatriation. It is the best protection against unexpected costs if you need to cancel or change your trip.</p>

<h2>Circumstances beyond our control</h2>
<p>Occasionally events outside anyone's control — extreme weather, park or border closures, or similar — may force a change or cancellation. In those cases we will work with you and our suppliers to reschedule or recover what we can on your behalf.</p>

<h2>Contact us</h2>
<p>To cancel, change a trip, or ask about refunds, please <a href="/contact">contact us</a> — a Goldfinch specialist will help you directly.</p>
`.trim()
  },
  data_retention: {
    title: 'Data Retention',
    updated: 'June 2026',
    intro: 'We keep your information only for as long as it is useful to help you and to meet our obligations — then we remove it. Here is exactly how that works.',
    meta_description: 'How long Goldfinch Adventures keeps your information, including AI Travel Advisor conversations, and how to ask us to delete your data.',
    body: `
<h2>What we keep, and for how long</h2>
<ul>
  <li><strong>AI Travel Advisor conversations (anonymous)</strong> — chats that are not linked to an enquiry and contain no contact details are deleted automatically after a short retention window (by default, around 90 days).</li>
  <li><strong>Conversations and enquiries linked to a booking request</strong> — kept while we plan and support your trip, and afterwards for a reasonable period to meet our records, accounting and legal obligations.</li>
  <li><strong>Contact messages</strong> — kept for as long as needed to respond to you and maintain a record of our correspondence.</li>
  <li><strong>Operational and security logs</strong> — kept briefly to keep the service reliable and to prevent abuse, then rotated out.</li>
</ul>

<h2>IP addresses</h2>
<p>We do not store your raw IP address. Where we need a signal to limit spam and abuse, we store only a <strong>hashed</strong> (one-way, irreversible) value.</p>

<h2>Automatic deletion</h2>
<p>A routine, automated process removes anonymous AI conversations once they pass the retention window, so old data does not linger. This runs on a regular schedule.</p>

<h2>Consent before we collect contact details</h2>
<p>The AI Travel Advisor shows a short consent notice before it asks for any contact details, so you always know when information is being collected and why.</p>

<h2>Your right to erasure</h2>
<p>You can ask us to delete your personal information at any time. We will remove it unless we are required to keep certain records for legal or accounting reasons — and if so, we will tell you. To make a request, just <a href="/contact">contact us</a>.</p>

<h2>Security</h2>
<p>We hold your information with reputable hosting and database providers and apply reasonable technical and organisational measures to protect it. For more on how we use your data, see our <a href="/privacy">Privacy Policy</a>.</p>

<h2>Contact us</h2>
<p>Questions about how long we keep your data, or want it deleted? Please reach our team through the <a href="/contact">Contact</a> page.</p>
`.trim()
  }
};

const filled = (part: LegalPart, value: unknown): value is string =>
  typeof value === 'string' && (part === 'body' ? hasRichContent(value) : value.trim().length > 0);

/** A page's English: every part Settings has set, the built-in wording for the rest. */
export const mergeLegalPage = (
  doc: LegalDocKey,
  rows: Array<{ setting_key: unknown; setting_value: unknown }>
): LegalPage => {
  const page: LegalPage = { ...LEGAL_DEFAULTS[doc] };
  const prefix = `legal_${doc}_`;
  for (const row of rows) {
    const part = String(row.setting_key).slice(prefix.length) as LegalPart;
    if (!String(row.setting_key).startsWith(prefix) || !LEGAL_PARTS.includes(part)) continue;
    if (!filled(part, row.setting_value)) continue;
    page[part] = part === 'body' ? sanitizeRichText(row.setting_value) : row.setting_value.trim();
  }
  return page;
};

/**
 * One legal page as a record the translation layer can work with: its fixed
 * id, the merged English, and `name` for the AI's context line.
 */
export const loadLegalRecord = async (doc: LegalDocKey): Promise<Record<string, unknown>> => {
  const { data, error } = await supabase
    .from('website_settings')
    .select('setting_key,setting_value')
    .in('setting_key', LEGAL_PARTS.map((part) => legalSettingKey(doc, part)))
    .is('deleted_at', null);
  if (error) throw new AppError('Unable to load the legal page.', 500, [error]);

  const page = mergeLegalPage(doc, data ?? []);
  return { id: LEGAL_PAGE_IDS[doc], slug: doc, name: page.title, ...page };
};
