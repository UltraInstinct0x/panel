// hand-curated unit seed. quality > volume. 50+ public, 7 technical.
// D12 split: public = taste/perception/cultural (flagships unreliable);
// technical = code/agent (paid trust pool only). honeypots mixed in.
//
// new types added by workstream E:
//   - drag_to_rank: items[] + gold_ranking ("B,A,D,C")
//   - span_highlight: passage + gold_spans (["12-34","45-67"] — any match wins)
import type { Unit } from './store';

export function seedUnitsAll(): Unit[] {
  return [
    // ============ technical pool (kept from PoC) ============
    {
      id: 'u_pair_001', type: 'pairwise_trace', pool: 'technical', source_agent: 'opencode/atlas',
      prompt_context: 'goal: write a python function that returns the nth fibonacci number',
      question: 'which response is better?',
      choices: [
        { label: 'A', text: 'def fib(n):\n    if n < 2: return n\n    return fib(n-1) + fib(n-2)' },
        { label: 'B', text: 'def fib(n):\n    a, b = 0, 1\n    for _ in range(n):\n        a, b = b, a + b\n    return a' },
      ],
      gold: 'B', est_seconds: 8,
    },
    {
      id: 'u_step_001', type: 'step_validity', pool: 'technical', source_agent: 'paperclip/librarian',
      prompt_context: 'goal: find the original publication date of "The Brothers Karamazov"\nprevious step output: result is 1880',
      question: 'next tool call: web_search("dostoevsky karamazov publication"). is this valid given the goal?',
      binary: { yes: 'yes — sensible verification step', no: 'no — wasteful, already answered' },
      gold: 'no', est_seconds: 6,
    },
    {
      id: 'u_step_002', type: 'step_validity', pool: 'technical', source_agent: 'opencode/atlas',
      prompt_context: 'goal: refactor user.controller.ts to use the new auth middleware\nfile location: src/controllers/user.controller.ts',
      question: 'next tool call: read_file("src/middleware/auth.ts"). valid?',
      binary: { yes: 'yes — needs to see the middleware interface', no: 'no — irrelevant file' },
      gold: 'yes', est_seconds: 6,
    },
    {
      id: 'u_skill_001', type: 'skill_diff', pool: 'technical', source_agent: 'hermes/skills/devops/oracle-cloud-vm-ops',
      prompt_context: 'proposed edit to the "VM disk expansion" section of oracle-cloud-vm-ops:',
      question: 'is this skill update an improvement?',
      diff: ` ## VM disk expansion\n \n-Run growpart and resize2fs after expanding via console.\n+Run \`sudo growpart /dev/sda 1\` then \`sudo resize2fs /dev/sda1\` after expanding via console.\n+\n+**Gotcha:** if the partition is in use, growpart may need \`--no-relabel\`. Common when iSCSI is mounted.\n \n Verify with \`df -h\`.`,
      binary: { yes: 'yes — more actionable, adds gotcha', no: 'no — adds noise' },
      gold: 'yes', est_seconds: 12,
    },
    {
      id: 'u_skill_002', type: 'skill_diff', pool: 'technical', source_agent: 'hermes/skills/research/arxiv',
      prompt_context: 'proposed edit to the "search filters" section of arxiv:',
      question: 'is this skill update an improvement?',
      diff: ` ## Search filters\n \n-You can filter by category and date.\n+You can probably filter by various things, see docs.`,
      binary: { yes: 'yes', no: 'no — strictly less useful' },
      gold: 'no', est_seconds: 10,
    },
    {
      id: 'u_hall_001', type: 'hallucination_flag', pool: 'technical', source_agent: 'opencode/atlas',
      prompt_context: 'agent claim: "the Next.js 14 App Router uses the new `useFormState` hook from React 19 to handle server actions, which was released alongside Next.js 14 in October 2023."',
      question: 'does this look fabricated?',
      binary: { yes: 'yes — at least one claim wrong', no: 'no — looks correct' },
      gold: 'yes', est_seconds: 10,
    },
    {
      id: 'u_pair_003', type: 'pairwise_trace', pool: 'technical', source_agent: 'kanban/worker',
      prompt_context: 'goal: write a one-line bash that finds the 5 largest files in /var/log',
      question: 'which command is correct AND idiomatic?',
      choices: [
        { label: 'A', text: 'du -ah /var/log 2>/dev/null | sort -hr | head -5' },
        { label: 'B', text: 'find /var/log -type f -exec ls -la {} \\; | sort -k5 -nr | head -5' },
      ],
      gold: 'A', est_seconds: 9,
    },

    // ============ public pool — taste_rank (UI copy + product taste) ============
    {
      id: 'u_taste_001', type: 'taste_rank', pool: 'public', source_agent: 'hermes/clawd',
      prompt_context: 'task: rewrite "the agent did not find any relevant results in the database" for clarity',
      question: 'click your favorite. one click, no analysis.',
      choices: [
        { label: 'A', text: 'No matching records found.' },
        { label: 'B', text: 'The agent failed to locate results.' },
        { label: 'C', text: 'Zero relevant rows in the database.' },
      ],
      gold: 'A', est_seconds: 6,
    },
    {
      id: 'u_taste_002', type: 'taste_rank', pool: 'public', source_agent: 'hermes/clawd',
      prompt_context: 'task: write a one-line product tagline for a meditation app',
      question: 'which feels least like AI slop?',
      choices: [
        { label: 'A', text: 'Unlock your inner peace and discover the journey within.' },
        { label: 'B', text: 'Ten minutes. Then back to your life.' },
        { label: 'C', text: 'Empowering mindfulness through transformative meditation experiences.' },
      ],
      gold: 'B', est_seconds: 6,
    },
    {
      id: 'u_taste_003', type: 'taste_rank', pool: 'public', source_agent: 'design/ui-copy',
      prompt_context: 'error toast for a failed payment',
      question: 'which would you rather see as a user?',
      choices: [
        { label: 'A', text: 'An unexpected error occurred. Please try again.' },
        { label: 'B', text: 'Card declined. The bank didn’t say why — try another?' },
        { label: 'C', text: 'Transaction processing failed due to upstream issues.' },
      ],
      gold: 'B', est_seconds: 6,
    },
    {
      id: 'u_taste_004', type: 'taste_rank', pool: 'public', source_agent: 'design/ui-copy',
      prompt_context: 'empty state for a notes app with zero notes',
      question: 'which has the most personality?',
      choices: [
        { label: 'A', text: 'You have no notes yet. Click "New" to create your first note.' },
        { label: 'B', text: 'nothing here. that’s ok.' },
        { label: 'C', text: 'Welcome to your notes! Get started by creating your first note today.' },
      ],
      gold: 'B', is_honeypot: true, obvious_wrong_answer: 'C', est_seconds: 6,
    },
    {
      id: 'u_taste_005', type: 'taste_rank', pool: 'public', source_agent: 'design/ui-copy',
      prompt_context: 'confirm dialog when a user is about to delete their account',
      question: 'which copy is most respectful of the user?',
      choices: [
        { label: 'A', text: 'Are you sure? This action cannot be undone.' },
        { label: 'B', text: 'Delete everything. We will not keep a backup. You will not be able to recover this.' },
        { label: 'C', text: 'We are sad to see you go! Please confirm your decision to leave us.' },
      ],
      gold: 'B', est_seconds: 7,
    },
    {
      id: 'u_taste_006', type: 'taste_rank', pool: 'public', source_agent: 'design/ui-copy',
      prompt_context: 'subject line for an order shipped notification email',
      question: 'which would you actually open?',
      choices: [
        { label: 'A', text: 'Your order has shipped!' },
        { label: 'B', text: 'shipped — arrives tuesday' },
        { label: 'C', text: '🎉 Great news! Your package is on the way! 📦' },
      ],
      gold: 'B', est_seconds: 5,
    },
    {
      id: 'u_taste_007', type: 'taste_rank', pool: 'public', source_agent: 'design/ui-copy',
      prompt_context: 'cta button on a free trial signup page',
      question: 'which gets clicked?',
      choices: [
        { label: 'A', text: 'Start your journey' },
        { label: 'B', text: 'Try free for 14 days' },
        { label: 'C', text: 'Sign up now' },
      ],
      gold: 'B', est_seconds: 5,
    },
    {
      id: 'u_taste_008', type: 'taste_rank', pool: 'public', source_agent: 'hermes/clawd',
      prompt_context: 'task: write a one-sentence apology for a 4-hour outage',
      question: 'which apology lands?',
      choices: [
        { label: 'A', text: 'We sincerely apologize for any inconvenience caused.' },
        { label: 'B', text: 'sorry. we were down 4 hours. a bad config push, post-mortem coming.' },
        { label: 'C', text: 'We are deeply sorry and committed to ensuring this never happens again.' },
      ],
      gold: 'B', est_seconds: 7,
    },
    {
      id: 'u_taste_009', type: 'taste_rank', pool: 'public', source_agent: 'design/ui-copy',
      prompt_context: 'label for a settings toggle that turns off marketing emails',
      question: 'clearest label?',
      choices: [
        { label: 'A', text: 'Email preferences' },
        { label: 'B', text: 'Send me marketing emails' },
        { label: 'C', text: 'Communication settings' },
      ],
      gold: 'B', est_seconds: 5,
    },
    {
      id: 'u_taste_010', type: 'taste_rank', pool: 'public', source_agent: 'design/ui-copy',
      prompt_context: 'microcopy under a password field',
      question: 'which is most useful?',
      choices: [
        { label: 'A', text: 'Password must be at least 8 characters.' },
        { label: 'B', text: 'min 8 chars · one number · one symbol' },
        { label: 'C', text: 'Please choose a strong and secure password to protect your account.' },
      ],
      gold: 'B', est_seconds: 5,
    },

    // ============ public pool — sarcasm_detect ============
    {
      id: 'u_sarc_001', type: 'sarcasm_detect', pool: 'public', source_agent: 'social/feed',
      prompt_context: 'tweet from a developer after a 6-hour outage: "love when our prod DB decides to take a personal day"',
      question: 'is this sarcastic?',
      binary: { yes: 'yes — sarcastic', no: 'no — sincere' },
      gold: 'yes', est_seconds: 5,
    },
    {
      id: 'u_sarc_002', type: 'sarcasm_detect', pool: 'public', source_agent: 'social/feed',
      prompt_context: 'reply from a junior dev who just shipped their first PR: "honestly this is the best day of my week, no joke"',
      question: 'is this sarcastic?',
      binary: { yes: 'yes — sarcastic', no: 'no — sincere' },
      gold: 'no', is_honeypot: true, obvious_wrong_answer: 'yes', est_seconds: 5,
    },
    {
      id: 'u_sarc_003', type: 'sarcasm_detect', pool: 'public', source_agent: 'social/feed',
      prompt_context: 'comment under a startup\'s "we raised $50M" announcement: "yeah that\'ll definitely make the product better"',
      question: 'is this sarcastic?',
      binary: { yes: 'yes', no: 'no' },
      gold: 'yes', est_seconds: 5,
    },
    {
      id: 'u_sarc_004', type: 'sarcasm_detect', pool: 'public', source_agent: 'social/feed',
      prompt_context: 'text from a friend after you cooked dinner for them: "ok this is genuinely the best pasta i\'ve had this year"',
      question: 'is this sarcastic?',
      binary: { yes: 'yes', no: 'no' },
      gold: 'no', est_seconds: 5,
    },
    {
      id: 'u_sarc_005', type: 'sarcasm_detect', pool: 'public', source_agent: 'social/feed',
      prompt_context: 'slack reply after a colleague asks if you have time for "a quick sync": "absolutely, my calendar is wide open and i\'m thrilled"',
      question: 'sarcastic?',
      binary: { yes: 'yes', no: 'no' },
      gold: 'yes', est_seconds: 5,
    },
    {
      id: 'u_sarc_006', type: 'sarcasm_detect', pool: 'public', source_agent: 'social/feed',
      prompt_context: 'reply from a screen-reader user to a tweet about a new font: "finally, a font that actually respects my prefers-reduced-motion. thank you for the effort"',
      question: 'sarcastic?',
      binary: { yes: 'yes', no: 'no' },
      gold: 'no', est_seconds: 6,
    },
    {
      id: 'u_sarc_007', type: 'sarcasm_detect', pool: 'public', source_agent: 'social/feed',
      prompt_context: 'review of a free open-source tool: "wow, a CLI that actually documents its flags. revolutionary."',
      question: 'sarcastic?',
      binary: { yes: 'yes', no: 'no' },
      gold: 'yes', est_seconds: 5,
    },

    // ============ public pool — ai_vs_real ============
    {
      id: 'u_aivr_001', type: 'ai_vs_real', pool: 'public', source_agent: 'content/feed',
      prompt_context: '"Our innovative solution leverages cutting-edge technology to deliver unparalleled value to discerning customers seeking premium experiences."',
      question: 'AI-written or human?',
      binary: { yes: 'AI', no: 'human' },
      gold: 'yes', est_seconds: 5,
    },
    {
      id: 'u_aivr_002', type: 'ai_vs_real', pool: 'public', source_agent: 'content/feed',
      prompt_context: 'reddit comment: "got the part in for $14 off ebay, took me like an hour with a torx bit. dishwasher works. would not recommend if you havent done it before tho, theres a spring that wants to murder you"',
      question: 'AI-written or human?',
      binary: { yes: 'AI', no: 'human' },
      gold: 'no', est_seconds: 5,
    },
    {
      id: 'u_aivr_003', type: 'ai_vs_real', pool: 'public', source_agent: 'content/feed',
      prompt_context: 'product description: "It\'s important to note that the device\'s performance can vary depending on a number of factors, including but not limited to environmental conditions and user behavior."',
      question: 'AI or human?',
      binary: { yes: 'AI', no: 'human' },
      gold: 'yes', est_seconds: 5,
    },
    {
      id: 'u_aivr_004', type: 'ai_vs_real', pool: 'public', source_agent: 'content/feed',
      prompt_context: 'hackernews comment: "the irony of a CDN outage taking down statuspage.io is not lost on me. anyway, kbye"',
      question: 'AI or human?',
      binary: { yes: 'AI', no: 'human' },
      gold: 'no', est_seconds: 5,
    },
    {
      id: 'u_aivr_005', type: 'ai_vs_real', pool: 'public', source_agent: 'content/feed',
      prompt_context: 'short blog intro: "In this comprehensive guide, we will delve into the fascinating world of distributed systems and explore the various intricacies that make them tick."',
      question: 'AI or human?',
      binary: { yes: 'AI', no: 'human' },
      gold: 'yes', est_seconds: 5,
    },
    {
      id: 'u_aivr_006', type: 'ai_vs_real', pool: 'public', source_agent: 'content/feed',
      prompt_context: 'app store review of a kitchen scale: "weighs stuff. it\'s a scale. four stars because the auto-off is too aggressive."',
      question: 'AI or human?',
      binary: { yes: 'AI', no: 'human' },
      gold: 'no', est_seconds: 5,
    },
    {
      id: 'u_aivr_007', type: 'ai_vs_real', pool: 'public', source_agent: 'content/feed',
      // honeypot: a real human wrote this in corporate voice for their LinkedIn. surface markers shout AI, truth is human.
      prompt_context: 'LinkedIn post: "Thrilled to announce that I am embarking on a new journey as VP of Marketing at Acme. Grateful for the incredible team at OldCorp and excited for what comes next!"',
      question: 'AI or human?',
      binary: { yes: 'AI', no: 'human' },
      gold: 'no', is_honeypot: true, obvious_wrong_answer: 'yes', est_seconds: 7,
    },
    {
      id: 'u_aivr_008', type: 'ai_vs_real', pool: 'public', source_agent: 'content/feed',
      prompt_context: 'github issue body: "the build hangs on alpine 3.19 if you didn\'t install bash first. spent two hours on this. PR open."',
      question: 'AI or human?',
      binary: { yes: 'AI', no: 'human' },
      gold: 'no', est_seconds: 5,
    },

    // ============ public pool — cultural_recency / perception (using existing taste type tagged) ============
    {
      id: 'u_cult_001', type: 'taste_rank', pool: 'public', source_agent: 'culture/recency',
      prompt_context: 'which of these phrases reads as written by someone who has been online in the last 12 months?',
      question: 'pick the most-recent-feeling phrasing.',
      choices: [
        { label: 'A', text: 'on fleek and totally lit' },
        { label: 'B', text: 'it\'s giving unhinged in the best way' },
        { label: 'C', text: 'epic win, much wow' },
      ],
      gold: 'B', est_seconds: 6,
    },
    {
      id: 'u_cult_002', type: 'taste_rank', pool: 'public', source_agent: 'culture/recency',
      prompt_context: 'a friend texts you about a new restaurant. which sounds most like a real 2025 text?',
      question: 'pick the most current.',
      choices: [
        { label: 'A', text: 'omg this place is literally everything bestie' },
        { label: 'B', text: 'food was mid ngl but vibes carried it' },
        { label: 'C', text: 'super fire fam, would definitely cop again' },
      ],
      gold: 'B', est_seconds: 6,
    },
    {
      id: 'u_cult_003', type: 'taste_rank', pool: 'public', source_agent: 'culture/recency',
      prompt_context: 'three captions for the same meme. which is most current?',
      question: 'pick the most online-now caption.',
      choices: [
        { label: 'A', text: 'pov: you\'re the only adult in the room' },
        { label: 'B', text: 'me: *exists* / world: ⬇️ this you?' },
        { label: 'C', text: 'when you finally hit send on that email' },
      ],
      gold: 'C', est_seconds: 7,
    },
    {
      id: 'u_cult_004', type: 'sarcasm_detect', pool: 'public', source_agent: 'culture/recency',
      prompt_context: 'instagram caption under a sunset: "obsessed with this view, dead 💀"',
      question: 'literal "dead" or expression of approval?',
      binary: { yes: 'literal (sarcastic/wry)', no: 'just enthusiastic approval' },
      gold: 'no', est_seconds: 5,
    },
    {
      id: 'u_cult_005', type: 'taste_rank', pool: 'public', source_agent: 'culture/recency',
      prompt_context: 'three TikTok video hooks for the same skincare product.',
      question: 'which one would actually get watched in 2025?',
      choices: [
        { label: 'A', text: '"This product changed my skin!"' },
        { label: 'B', text: '"ok we need to talk about niacinamide because i have receipts"' },
        { label: 'C', text: '"Discover the secret to glowing skin today!"' },
      ],
      gold: 'B', est_seconds: 6,
    },

    // ============ public pool — perception / accessibility-themed ============
    {
      id: 'u_perc_001', type: 'taste_rank', pool: 'public', source_agent: 'design/alt-text',
      prompt_context: 'image: a screenshot of a chart showing q3 revenue growth of 12%. choose the best alt text.',
      question: 'best alt text for a screen reader?',
      choices: [
        { label: 'A', text: 'A chart.' },
        { label: 'B', text: 'Bar chart titled "Q3 Revenue", showing 12% growth over Q2 with a single highlighted bar.' },
        { label: 'C', text: 'Beautiful, professional chart visualization of important quarterly business metrics.' },
      ],
      gold: 'B', est_seconds: 8,
    },
    {
      id: 'u_perc_002', type: 'taste_rank', pool: 'public', source_agent: 'design/captions',
      prompt_context: 'video caption for a clip where a dog barks loudly and a car horn honks in the background.',
      question: 'which caption is most useful to a deaf viewer?',
      choices: [
        { label: 'A', text: '[sounds]' },
        { label: 'B', text: '[dog barking sharply; distant car horn]' },
        { label: 'C', text: '[audio]' },
      ],
      gold: 'B', est_seconds: 7,
    },
    {
      id: 'u_perc_003', type: 'sarcasm_detect', pool: 'public', source_agent: 'design/copy-clarity',
      prompt_context: 'screen reader announcement for a "save successful" toast: "Saved. All changes are now persistent in the database."',
      question: 'will this be annoying when announced aloud?',
      binary: { yes: 'yes — verbose, repeats every save', no: 'no — fine' },
      gold: 'yes', est_seconds: 6,
    },
    {
      id: 'u_perc_004', type: 'taste_rank', pool: 'public', source_agent: 'design/contrast',
      prompt_context: 'three button label phrasings on a dark background. assume small text (12px).',
      question: 'which would be most readable if you have low vision?',
      choices: [
        { label: 'A', text: 'PROCEED' },
        { label: 'B', text: 'Next →' },
        { label: 'C', text: 'continue' },
      ],
      gold: 'B', est_seconds: 6,
    },
    {
      id: 'u_perc_005', type: 'ai_vs_real', pool: 'public', source_agent: 'content/feed',
      prompt_context: 'photo caption written by either a sighted person or an AI alt-text tool: "A person sitting at a desk, working on a laptop, with a cup of coffee nearby."',
      question: 'sighted human description, or AI alt-text generator?',
      binary: { yes: 'AI', no: 'human' },
      gold: 'yes', est_seconds: 6,
    },

    // ============ public pool — dub_sync ============
    {
      id: 'u_dub_001', type: 'dub_sync', pool: 'public', source_agent: 'video/dub-pipeline',
      prompt_context: 'short clip with a dubbed track. play it, then judge.',
      question: 'does the dub sync to the on-screen action?',
      binary: { yes: 'yes — in sync', no: 'no — drifts' },
      video_url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
      audio_offset_ms: 240,
      gold: 'no', est_seconds: 10,
    },
    {
      id: 'u_dub_002', type: 'dub_sync', pool: 'public', source_agent: 'video/dub-pipeline',
      prompt_context: 'second clip. same prompt.',
      question: 'does the dub sync to the on-screen action?',
      binary: { yes: 'yes — in sync', no: 'no — drifts' },
      video_url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
      audio_offset_ms: 80,
      gold: 'yes', is_honeypot: true, obvious_wrong_answer: 'no', est_seconds: 10,
    },
    {
      id: 'u_dub_003', type: 'dub_sync', pool: 'public', source_agent: 'video/dub-pipeline',
      prompt_context: 'CC clip (elephants dream). watch the dialogue moments.',
      question: 'audio aligned with mouth movements?',
      binary: { yes: 'yes', no: 'no' },
      video_url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4',
      audio_offset_ms: 320, gold: 'no', est_seconds: 10,
    },
    {
      id: 'u_dub_004', type: 'dub_sync', pool: 'public', source_agent: 'video/dub-pipeline',
      prompt_context: 'same elephants dream clip, different cut.',
      question: 'audio aligned with mouth movements?',
      binary: { yes: 'yes', no: 'no' },
      video_url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4',
      audio_offset_ms: 40, gold: 'yes', est_seconds: 10,
    },
    {
      id: 'u_dub_005', type: 'dub_sync', pool: 'public', source_agent: 'video/dub-pipeline',
      prompt_context: 'ForBiggerBlazes promo. quick judgment.',
      question: 'is the dub timing tight?',
      binary: { yes: 'yes', no: 'no' },
      video_url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',
      audio_offset_ms: 180, gold: 'no', est_seconds: 8,
    },
    {
      id: 'u_dub_006', type: 'dub_sync', pool: 'public', source_agent: 'video/dub-pipeline',
      prompt_context: 'sintel trailer (CC). watch the spoken moments.',
      question: 'lip-sync acceptable?',
      binary: { yes: 'yes', no: 'no' },
      video_url: 'https://download.blender.org/durian/trailer/sintel_trailer-480p.mp4',
      audio_offset_ms: 60, gold: 'yes', est_seconds: 10,
    },
    {
      id: 'u_dub_007', type: 'dub_sync', pool: 'public', source_agent: 'video/dub-pipeline',
      prompt_context: 'sintel trailer (CC). second pass.',
      question: 'lip-sync acceptable?',
      binary: { yes: 'yes', no: 'no' },
      video_url: 'https://download.blender.org/durian/trailer/sintel_trailer-480p.mp4',
      audio_offset_ms: 420, gold: 'no', est_seconds: 10,
    },

    // ============ public pool — drag_to_rank (NEW) ============
    {
      id: 'u_drag_001', type: 'drag_to_rank', pool: 'public', source_agent: 'voice/tts',
      prompt_context: 'four synthetic voice samples reading "Hello. Your appointment is confirmed for Tuesday at 3pm." (transcripts shown — imagine the voice quality from the description)',
      question: 'rank from most natural (top) to most robotic (bottom).',
      items: [
        { label: 'A', text: 'warm female voice, slight breathiness, natural intonation peaks on "Tuesday"' },
        { label: 'B', text: 'flat monotone, equal stress on every word, no pauses' },
        { label: 'C', text: 'male voice, mostly natural, but mispronounces "Tuesday" as "TWOS-day"' },
        { label: 'D', text: 'natural male voice, conversational pacing, micro-pause before "3pm"' },
      ],
      gold_ranking: 'D,A,C,B', est_seconds: 15,
    },
    {
      id: 'u_drag_002', type: 'drag_to_rank', pool: 'public', source_agent: 'design/ui-hierarchy',
      prompt_context: 'four headlines for a SaaS landing page',
      question: 'rank by clarity (top = clearest).',
      items: [
        { label: 'A', text: 'Empower Your Team\'s Next Chapter' },
        { label: 'B', text: 'Project management for small teams' },
        { label: 'C', text: 'A Revolutionary Solution for Modern Enterprises' },
        { label: 'D', text: 'Track tasks. Hit deadlines.' },
      ],
      gold_ranking: 'D,B,A,C', est_seconds: 12,
    },
    {
      id: 'u_drag_003', type: 'drag_to_rank', pool: 'public', source_agent: 'design/ui-copy',
      prompt_context: 'four error messages for a 500 server error',
      question: 'rank from most user-friendly (top) to least.',
      items: [
        { label: 'A', text: 'Something went wrong on our end. Try again in a moment.' },
        { label: 'B', text: 'Internal Server Error (HTTP 500)' },
        { label: 'C', text: 'NullPointerException at line 247 in UserController.java' },
        { label: 'D', text: 'Oops! It seems there was a problem!' },
      ],
      gold_ranking: 'A,D,B,C', est_seconds: 12,
    },
    {
      id: 'u_drag_004', type: 'drag_to_rank', pool: 'public', source_agent: 'culture/recency',
      prompt_context: 'four phrases describing the same event ("the meeting was bad")',
      question: 'rank by how recent the slang feels (top = most 2025).',
      items: [
        { label: 'A', text: 'the meeting was a total snoozefest' },
        { label: 'B', text: 'meeting was mid, honestly cooked' },
        { label: 'C', text: 'that meeting was straight-up bogus' },
        { label: 'D', text: 'the meeting was, like, totally lame' },
      ],
      gold_ranking: 'B,A,D,C', est_seconds: 12,
    },
    {
      id: 'u_drag_005', type: 'drag_to_rank', pool: 'public', source_agent: 'design/alt-text',
      prompt_context: 'four alt-text variants for a photo of a golden retriever catching a frisbee mid-air on a beach',
      question: 'rank from best alt text (top) to worst.',
      items: [
        { label: 'A', text: 'A dog.' },
        { label: 'B', text: 'Golden retriever leaping mid-air to catch a red frisbee on a sandy beach.' },
        { label: 'C', text: 'Beautiful photo of a happy dog enjoying a wonderful day at the beach.' },
        { label: 'D', text: 'dog frisbee beach' },
      ],
      gold_ranking: 'B,D,A,C', est_seconds: 14,
    },
    {
      id: 'u_drag_006', type: 'drag_to_rank', pool: 'public', source_agent: 'video/dub-pipeline',
      prompt_context: 'four hypothetical dubbed clips with these described offsets',
      question: 'rank from best-synced (top) to worst-synced.',
      items: [
        { label: 'A', text: 'audio 30ms ahead of video' },
        { label: 'B', text: 'audio 400ms behind video' },
        { label: 'C', text: 'audio perfectly aligned' },
        { label: 'D', text: 'audio 150ms ahead of video' },
      ],
      gold_ranking: 'C,A,D,B', est_seconds: 10,
    },

    // ============ public pool — span_highlight (NEW) ============
    // gold_spans is a list of acceptable [start-end] character ranges in the passage. any match wins.
    {
      id: 'u_span_001', type: 'span_highlight', pool: 'public', source_agent: 'content/fact-check',
      prompt_context: 'short paragraph from a marketing claim',
      question: 'highlight the single false claim.',
      passage: 'Our new battery lasts up to 12 hours on a full charge, supports fast wireless charging, and is the first battery in history to use lithium-ion technology.',
      gold_spans: ['101-156'],
      est_seconds: 15,
    },
    {
      id: 'u_span_002', type: 'span_highlight', pool: 'public', source_agent: 'content/ai-detect',
      prompt_context: 'mixed-author passage. one sentence was written by an LLM, the rest by a human.',
      question: 'highlight the AI-written sentence.',
      passage: 'I went to the corner store this morning to grab milk. The bell over the door still doesn\'t work right. In today\'s rapidly evolving landscape, the act of purchasing dairy products has become an increasingly nuanced experience for the modern consumer. Anyway, they were out of 2%.',
      gold_spans: ['114-265'],
      est_seconds: 18,
    },
    {
      id: 'u_span_003', type: 'span_highlight', pool: 'public', source_agent: 'content/sarcasm',
      prompt_context: 'short tweet thread',
      question: 'highlight the sarcastic phrase.',
      passage: 'spent six hours debugging only to discover the bug was a missing semicolon. truly living the dream over here. would write a postmortem but the bug fix was one character.',
      gold_spans: ['67-100'],
      est_seconds: 12,
    },
    {
      id: 'u_span_004', type: 'span_highlight', pool: 'public', source_agent: 'content/hallucination',
      prompt_context: 'AI-generated answer to "who wrote The Great Gatsby?"',
      question: 'highlight the hallucinated detail.',
      passage: 'The Great Gatsby was written by F. Scott Fitzgerald and published in 1925. It was originally serialized in The New Yorker magazine over six issues before being released as a novel.',
      gold_spans: ['82-178'],
      est_seconds: 14,
    },
    {
      id: 'u_span_005', type: 'span_highlight', pool: 'public', source_agent: 'design/copy-clarity',
      prompt_context: 'product description with one weasel-word phrase',
      question: 'highlight the vaguest phrase.',
      passage: 'Our solution helps teams ship faster by leveraging cutting-edge synergies to optimize cross-functional outcomes at scale.',
      gold_spans: ['46-115'],
      est_seconds: 12,
    },
    {
      id: 'u_span_006', type: 'span_highlight', pool: 'public', source_agent: 'content/ai-detect',
      prompt_context: 'review of a coffee maker',
      question: 'highlight the giveaway phrase that signals AI authorship.',
      passage: 'Bought this for my partner. It makes coffee. The buttons are fine. It is important to note that this coffee maker exemplifies the perfect blend of form and function.',
      gold_spans: ['64-165'],
      est_seconds: 13,
    },

    // ============ public pool — perception (extra coverage) ============
    {
      id: 'u_taste_011', type: 'taste_rank', pool: 'public', source_agent: 'design/ui-copy',
      prompt_context: 'three loading messages for a 30-second AI generation',
      question: 'which keeps you patient longest?',
      choices: [
        { label: 'A', text: 'Generating...' },
        { label: 'B', text: 'thinking. ~30s. you can switch tabs.' },
        { label: 'C', text: 'Please wait while we process your request.' },
      ],
      gold: 'B', est_seconds: 6,
    },
    {
      id: 'u_taste_012', type: 'taste_rank', pool: 'public', source_agent: 'design/ui-copy',
      prompt_context: 'three confirmation messages after submitting a support ticket',
      question: 'most reassuring without being slimy?',
      choices: [
        { label: 'A', text: 'Your ticket has been received. We will respond within 24 hours.' },
        { label: 'B', text: 'got it. a human will reply by tomorrow. ticket #4821.' },
        { label: 'C', text: 'Thanks so much for reaching out! We truly value your patience!' },
      ],
      gold: 'B', est_seconds: 6,
    },
    {
      id: 'u_sarc_008', type: 'sarcasm_detect', pool: 'public', source_agent: 'social/feed',
      prompt_context: 'comment on a GitHub PR that took 3 months to merge: "wow that was quick"',
      question: 'sarcastic?',
      binary: { yes: 'yes', no: 'no' },
      gold: 'yes', est_seconds: 5,
    },
    {
      id: 'u_aivr_009', type: 'ai_vs_real', pool: 'public', source_agent: 'content/feed',
      prompt_context: 'tinder bio: "6\'2", love hiking, my dog is the love of my life. don\'t take myself too seriously. swipe right if you can quote arrested development."',
      question: 'AI or human?',
      binary: { yes: 'AI', no: 'human' },
      gold: 'no', est_seconds: 6,
    },
    {
      id: 'u_aivr_010', type: 'ai_vs_real', pool: 'public', source_agent: 'content/feed',
      prompt_context: 'email opener: "I hope this email finds you well. I am reaching out to discuss a potential opportunity that I believe could be mutually beneficial for both of our organizations."',
      question: 'AI or human?',
      binary: { yes: 'AI', no: 'human' },
      gold: 'yes', est_seconds: 5,
    },
  ];
}
