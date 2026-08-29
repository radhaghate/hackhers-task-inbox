import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const prisma = new PrismaClient({ adapter: new PrismaPg(process.env.DATABASE_URL!) });

function daysFromNow(days: number): Date {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d;
}

async function main() {
  console.log("Seeding fictional demo data...");

  // --- Team members -------------------------------------------------------
  const [devUser, maria, priya, jordan, sam] = await Promise.all([
    prisma.teamMember.upsert({
      where: { email: "dev@example.com" },
      update: {},
      create: { email: "dev@example.com", name: "Dev User", role: "Local Dev (AUTH_DEV_BYPASS)" },
    }),
    prisma.teamMember.upsert({
      where: { email: "maria.chen@example.com" },
      update: {},
      create: { email: "maria.chen@example.com", name: "Maria Chen", role: "President" },
    }),
    prisma.teamMember.upsert({
      where: { email: "priya.patel@example.com" },
      update: {},
      create: { email: "priya.patel@example.com", name: "Priya Patel", role: "Sponsorship Lead" },
    }),
    prisma.teamMember.upsert({
      where: { email: "jordan.lee@example.com" },
      update: {},
      create: { email: "jordan.lee@example.com", name: "Jordan Lee", role: "Treasurer" },
    }),
    prisma.teamMember.upsert({
      where: { email: "sam.okafor@example.com" },
      update: {},
      create: { email: "sam.okafor@example.com", name: "Sam Okafor", role: "Events Lead" },
    }),
  ]);

  // --- Gmail accounts (mock mode: no real tokens stored) ------------------
  // This seed script uses the two real club addresses as fictional-data
  // placeholders. If either has already been connected for real (GMAIL_PROVIDER=google,
  // via /settings), refuse to touch it — the re-seed step below deletes and
  // recreates these GmailAccount rows, which would destroy a real encrypted
  // OAuth refresh token and disconnect the account.
  const existingReal = await prisma.gmailAccount.findMany({
    where: {
      emailAddress: { in: ["rutgers.hackhers@gmail.com", "rutgerswics@gmail.com"] },
      encryptedRefreshToken: { not: null },
    },
    select: { emailAddress: true },
  });
  if (existingReal.length > 0) {
    throw new Error(
      `Refusing to seed: ${existingReal.map((a) => a.emailAddress).join(", ")} already has a real Gmail OAuth ` +
        "connection. Re-seeding would delete and recreate that GmailAccount row, destroying the stored refresh " +
        "token and disconnecting it. If you really want fictional demo data alongside a real connection, seed " +
        "into a separate database instead of this one.",
    );
  }

  const [hackhers, wics] = await Promise.all([
    prisma.gmailAccount.upsert({
      where: { emailAddress: "rutgers.hackhers@gmail.com" },
      update: {},
      create: { emailAddress: "rutgers.hackhers@gmail.com", displayName: "HackHERS", isActive: true },
    }),
    prisma.gmailAccount.upsert({
      where: { emailAddress: "rutgerswics@gmail.com" },
      update: {},
      create: { emailAddress: "rutgerswics@gmail.com", displayName: "Rutgers WiCS", isActive: true },
    }),
  ]);

  // Idempotent re-seeding: wipe any prior demo content for these two
  // accounts (cascades to threads/messages/tasks/replies/reminders) before
  // recreating it, so `npm run db:seed` can be run repeatedly.
  await prisma.gmailAccount.deleteMany({ where: { id: { in: [hackhers.id, wics.id] } } });
  const hackhersAccount = await prisma.gmailAccount.create({
    data: { emailAddress: "rutgers.hackhers@gmail.com", displayName: "HackHERS", isActive: true },
  });
  const wicsAccount = await prisma.gmailAccount.create({
    data: { emailAddress: "rutgerswics@gmail.com", displayName: "Rutgers WiCS", isActive: true },
  });

  // --- 1. Sponsor confirmation -> Needs Attention (explicit due date, high) ---
  const sponsorThread = await prisma.emailThread.create({
    data: {
      gmailAccountId: hackhersAccount.id,
      gmailThreadId: "seed-thread-sponsor-acme",
      subject: "HackHERS 2026 workshop schedule",
      lastMessageAt: daysFromNow(-1),
      messageCount: 1,
      lastClassifiedMessageCount: 1,
      lastClassifiedAt: daysFromNow(-1),
      storedSummary: "Sponsor (Acme Corp) needs confirmation of the 2 PM workshop slot.",
    },
  });
  const sponsorMessage = await prisma.emailMessage.create({
    data: {
      emailThreadId: sponsorThread.id,
      gmailAccountId: hackhersAccount.id,
      gmailMessageId: "seed-msg-sponsor-1",
      fromAddress: "sponsors@acmecorp.example",
      toAddresses: ["rutgers.hackhers@gmail.com"],
      sentAt: daysFromNow(-1),
      snippet: "Can you confirm the 2 PM slot for our workshop?",
      sanitizedBodyText:
        "Hi team,\n\nCan you confirm the 2 PM slot for our workshop on the 22nd? We need to finalize our travel plans by then.",
      rawSizeBytes: 512,
      isFromOrgAccount: false,
    },
  });
  const sponsorTask = await prisma.task.create({
    data: {
      emailThreadId: sponsorThread.id,
      sourceEmailMessageId: sponsorMessage.id,
      title: "Confirm workshop time with Acme Corp",
      description: "Reply confirming the proposed 2 PM slot for the sponsor's workshop.",
      emailSummary: "Sponsor requests confirmation of the workshop time.",
      priority: "HIGH",
      dueDate: daysFromNow(1),
      dueDateSource: "EXPLICIT",
      confidence: 0.92,
      assignedOwnerId: priya.id,
      status: "OPEN",
      originalExcerpt: sponsorMessage.sanitizedBodyText,
    },
  });
  await prisma.suggestedReply.create({
    data: {
      taskId: sponsorTask.id,
      subject: "Re: HackHERS 2026 workshop schedule",
      body: "Hi Jane,\n\nConfirming the 2 PM slot works great for us on the 22nd. Looking forward to it!\n\nBest,\nHackHERS Team",
      aiGeneratedOriginalSubject: "Re: HackHERS 2026 workshop schedule",
      aiGeneratedOriginalBody:
        "Hi Jane,\n\nConfirming the 2 PM slot works great for us on the 22nd. Looking forward to it!\n\nBest,\nHackHERS Team",
    },
  });
  await prisma.reminder.create({
    data: {
      taskId: sponsorTask.id,
      remindAt: daysFromNow(1),
      note: "Send the confirmation reply before end of day.",
      status: "PENDING",
      createdByTeamMemberId: priya.id,
    },
  });

  // --- 2. Multi-task venue-logistics email -> split Needs Attention / Upcoming ---
  const venueThread = await prisma.emailThread.create({
    data: {
      gmailAccountId: hackhersAccount.id,
      gmailThreadId: "seed-thread-venue-logistics",
      subject: "Venue logistics checklist for HackHERS 2026",
      lastMessageAt: daysFromNow(-2),
      messageCount: 1,
      lastClassifiedMessageCount: 1,
      lastClassifiedAt: daysFromNow(-2),
      storedSummary: "Rutgers Venue Services needs headcount, AV form, and insurance certificate.",
    },
  });
  const venueMessage = await prisma.emailMessage.create({
    data: {
      emailThreadId: venueThread.id,
      gmailAccountId: hackhersAccount.id,
      gmailMessageId: "seed-msg-venue-1",
      fromAddress: "events@rutgersvenues.example",
      toAddresses: ["rutgers.hackhers@gmail.com"],
      sentAt: daysFromNow(-2),
      snippet: "A few things we need before your event: headcount, AV form, insurance cert.",
      sanitizedBodyText:
        "Hello,\n\nA few things we need before your event on the 22nd:\n1. Final headcount by tomorrow.\n2. Submit the AV request form at least 5 business days before setup.\n3. Send your certificate of insurance — no hard deadline, but sooner is better.\n\nThanks,\nRutgers Venue Services",
      rawSizeBytes: 640,
      isFromOrgAccount: false,
    },
  });
  await prisma.task.create({
    data: {
      emailThreadId: venueThread.id,
      sourceEmailMessageId: venueMessage.id,
      title: "Submit final headcount to Venue Services",
      description: "Reply with the final expected attendee headcount.",
      emailSummary: "Venue Services needs headcount, AV form, and insurance certificate before the event.",
      priority: "URGENT",
      dueDate: daysFromNow(1),
      dueDateSource: "EXPLICIT",
      confidence: 0.88,
      assignedOwnerId: sam.id,
      status: "OPEN",
      originalExcerpt: venueMessage.sanitizedBodyText,
    },
  });
  await prisma.task.create({
    data: {
      emailThreadId: venueThread.id,
      sourceEmailMessageId: venueMessage.id,
      title: "Submit AV request form",
      description: "Complete and submit the venue's AV equipment request form.",
      emailSummary: "Venue Services needs headcount, AV form, and insurance certificate before the event.",
      priority: "HIGH",
      dueDate: daysFromNow(2),
      dueDateSource: "EXPLICIT",
      confidence: 0.85,
      assignedOwnerId: sam.id,
      status: "OPEN",
      originalExcerpt: venueMessage.sanitizedBodyText,
    },
  });
  await prisma.task.create({
    data: {
      emailThreadId: venueThread.id,
      sourceEmailMessageId: venueMessage.id,
      title: "Send certificate of insurance to Venue Services",
      description: "No deadline was stated explicitly, but 'sooner is better' alongside the near-term event date suggests this should be done within the next couple weeks.",
      emailSummary: "Venue Services needs headcount, AV form, and insurance certificate before the event.",
      priority: "MEDIUM",
      dueDate: daysFromNow(14),
      dueDateSource: "INFERRED",
      dueDateExplanation:
        "No deadline was stated explicitly, but 'sooner is better' alongside the near-term event date suggests this should be done within the next couple weeks.",
      confidence: 0.6,
      assignedOwnerId: jordan.id,
      status: "OPEN",
      originalExcerpt: venueMessage.sanitizedBodyText,
    },
  });

  // --- 3. Newsletter -> non-actionable, no Task row ------------------------
  const newsletterThread = await prisma.emailThread.create({
    data: {
      gmailAccountId: hackhersAccount.id,
      gmailThreadId: "seed-thread-newsletter",
      subject: "ACM-W Monthly Digest — August",
      lastMessageAt: daysFromNow(-3),
      messageCount: 1,
      lastClassifiedMessageCount: 1,
      lastClassifiedAt: daysFromNow(-3),
      storedSummary: "Monthly ACM-W newsletter digest; no action required.",
    },
  });
  await prisma.emailMessage.create({
    data: {
      emailThreadId: newsletterThread.id,
      gmailAccountId: hackhersAccount.id,
      gmailMessageId: "seed-msg-newsletter-1",
      fromAddress: "digest@acm-w.example",
      toAddresses: ["rutgers.hackhers@gmail.com"],
      sentAt: daysFromNow(-3),
      snippet: "This month in ACM-W: chapter spotlights, upcoming webinars...",
      sanitizedBodyText: "This month in ACM-W: chapter spotlights, upcoming webinars, and scholarship deadlines.",
      rawSizeBytes: 300,
      isFromOrgAccount: false,
    },
  });

  // --- 4. Automated receipt -> non-actionable, no Task row -----------------
  const receiptThread = await prisma.emailThread.create({
    data: {
      gmailAccountId: wicsAccount.id,
      gmailThreadId: "seed-thread-receipt",
      subject: "Your Canva for Nonprofits receipt",
      lastMessageAt: daysFromNow(-4),
      messageCount: 1,
      lastClassifiedMessageCount: 1,
      lastClassifiedAt: daysFromNow(-4),
      storedSummary: "Automated subscription receipt; no action required.",
    },
  });
  await prisma.emailMessage.create({
    data: {
      emailThreadId: receiptThread.id,
      gmailAccountId: wicsAccount.id,
      gmailMessageId: "seed-msg-receipt-1",
      fromAddress: "billing@canva.example",
      toAddresses: ["rutgerswics@gmail.com"],
      sentAt: daysFromNow(-4),
      snippet: "Thanks for your subscription. Here is your receipt.",
      sanitizedBodyText: "This is an automated receipt for your Canva for Nonprofits renewal. No action needed. Amount: $0.00.",
      rawSizeBytes: 220,
      isFromOrgAccount: false,
    },
  });

  // --- 5. Inferred-deadline speaker outreach -> Upcoming --------------------
  const speakerThread = await prisma.emailThread.create({
    data: {
      gmailAccountId: wicsAccount.id,
      gmailThreadId: "seed-thread-speaker-outreach",
      subject: "Guest speaker for spring kickoff?",
      lastMessageAt: daysFromNow(-2),
      messageCount: 1,
      lastClassifiedMessageCount: 1,
      lastClassifiedAt: daysFromNow(-2),
      storedSummary: "Prospective guest speaker wants to confirm before the semester picks up.",
    },
  });
  const speakerMessage = await prisma.emailMessage.create({
    data: {
      emailThreadId: speakerThread.id,
      gmailAccountId: wicsAccount.id,
      gmailMessageId: "seed-msg-speaker-1",
      fromAddress: "amina.k@example.com",
      toAddresses: ["rutgerswics@gmail.com"],
      sentAt: daysFromNow(-2),
      snippet: "I'd love to speak at your kickoff sometime this semester.",
      sanitizedBodyText:
        "Hi WiCS team,\n\nI'd love to come speak at your kickoff event sometime this semester — happy to work around your schedule, just would love to confirm before the semester picks up.\n\nBest,\nAmina",
      rawSizeBytes: 420,
      isFromOrgAccount: false,
    },
  });
  await prisma.task.create({
    data: {
      emailThreadId: speakerThread.id,
      sourceEmailMessageId: speakerMessage.id,
      title: "Confirm guest speaker slot with Amina",
      description: "Reply to propose a date for the spring kickoff talk.",
      emailSummary: "Prospective guest speaker wants to confirm a date before the semester picks up.",
      priority: "MEDIUM",
      dueDate: daysFromNow(21),
      dueDateSource: "INFERRED",
      dueDateExplanation:
        "No specific date was given; 'before the semester picks up' implies a few weeks out, so a 3-week window was used as a reasonable placeholder.",
      confidence: 0.6,
      assignedOwnerId: maria.id,
      status: "OPEN",
      originalExcerpt: speakerMessage.sanitizedBodyText,
    },
  });

  // --- 6. Low-priority, no-due-date actionable item -> Upcoming ------------
  const deckThread = await prisma.emailThread.create({
    data: {
      gmailAccountId: hackhersAccount.id,
      gmailThreadId: "seed-thread-deck-update",
      subject: "Small update for the sponsor deck",
      lastMessageAt: daysFromNow(-1),
      messageCount: 1,
      lastClassifiedMessageCount: 1,
      lastClassifiedAt: daysFromNow(-1),
      storedSummary: "A sponsor's logo needs a minor swap on the sponsor deck; no urgency stated.",
    },
  });
  const deckMessage = await prisma.emailMessage.create({
    data: {
      emailThreadId: deckThread.id,
      gmailAccountId: hackhersAccount.id,
      gmailMessageId: "seed-msg-deck-1",
      fromAddress: "marketing@acmecorp.example",
      toAddresses: ["rutgers.hackhers@gmail.com"],
      sentAt: daysFromNow(-1),
      snippet: "Whenever convenient, could you swap our logo to the updated version?",
      sanitizedBodyText:
        "Hi team, whenever convenient, could you swap our logo on the sponsor deck to the updated version we sent over? No rush at all.",
      rawSizeBytes: 260,
      isFromOrgAccount: false,
    },
  });
  await prisma.task.create({
    data: {
      emailThreadId: deckThread.id,
      sourceEmailMessageId: deckMessage.id,
      title: "Swap sponsor logo on sponsor deck",
      description: "Replace Acme Corp's logo on the sponsor deck with the updated version they sent.",
      emailSummary: "Sponsor asked for a minor logo update on the sponsor deck, no urgency.",
      priority: "LOW",
      dueDate: null,
      dueDateSource: null,
      confidence: 0.8,
      status: "OPEN",
      originalExcerpt: deckMessage.sanitizedBodyText,
    },
  });

  // --- 7. Waiting for reply -----------------------------------------------
  const waitingThread = await prisma.emailThread.create({
    data: {
      gmailAccountId: hackhersAccount.id,
      gmailThreadId: "seed-thread-catering",
      subject: "Catering headcount for Saturday",
      lastMessageAt: daysFromNow(-1),
      messageCount: 1,
      lastClassifiedMessageCount: 1,
      lastClassifiedAt: daysFromNow(-1),
      storedSummary: "Caterer asked for a final headcount; the club has drafted and sent a reply, now awaiting their confirmation.",
    },
  });
  const waitingMessage = await prisma.emailMessage.create({
    data: {
      emailThreadId: waitingThread.id,
      gmailAccountId: hackhersAccount.id,
      gmailMessageId: "seed-msg-catering-1",
      fromAddress: "orders@campuscatering.example",
      toAddresses: ["rutgers.hackhers@gmail.com"],
      sentAt: daysFromNow(-1),
      snippet: "What's the final headcount for Saturday's order?",
      sanitizedBodyText: "Hi, what's the final headcount for Saturday's order? We can lock in pricing once we hear back.",
      rawSizeBytes: 200,
      isFromOrgAccount: false,
    },
  });
  const waitingTask = await prisma.task.create({
    data: {
      emailThreadId: waitingThread.id,
      sourceEmailMessageId: waitingMessage.id,
      title: "Confirm catering headcount",
      description: "Reply with the final headcount so the caterer can lock in pricing.",
      emailSummary: "Caterer needs the final headcount for Saturday's order.",
      priority: "HIGH",
      dueDate: daysFromNow(2),
      dueDateSource: "EXPLICIT",
      confidence: 0.9,
      assignedOwnerId: jordan.id,
      status: "WAITING_FOR_REPLY",
      originalExcerpt: waitingMessage.sanitizedBodyText,
    },
  });
  await prisma.suggestedReply.create({
    data: {
      taskId: waitingTask.id,
      subject: "Re: Catering headcount for Saturday",
      body: "Hi, our final headcount is 120 attendees. Let us know if you need anything else to lock in pricing!",
      aiGeneratedOriginalSubject: "Re: Catering headcount for Saturday",
      aiGeneratedOriginalBody: "Hi, our final headcount is 120 attendees. Let us know if you need anything else to lock in pricing!",
      isEdited: true,
      editedByTeamMemberId: jordan.id,
      gmailDraftId: "mock-draft-seed-catering-1",
      draftCreatedAt: daysFromNow(-1),
      draftApprovedByTeamMemberId: jordan.id,
    },
  });

  // --- 8. Completed -----------------------------------------------------
  const w9Thread = await prisma.emailThread.create({
    data: {
      gmailAccountId: wicsAccount.id,
      gmailThreadId: "seed-thread-w9",
      subject: "W9 for sponsorship payment",
      lastMessageAt: daysFromNow(-6),
      messageCount: 1,
      lastClassifiedMessageCount: 1,
      lastClassifiedAt: daysFromNow(-6),
      storedSummary: "Sponsor's finance team requested a completed W9 for the sponsorship payment. Sent.",
    },
  });
  const w9Message = await prisma.emailMessage.create({
    data: {
      emailThreadId: w9Thread.id,
      gmailAccountId: wicsAccount.id,
      gmailMessageId: "seed-msg-w9-1",
      fromAddress: "finance@partnerfirm.example",
      toAddresses: ["rutgerswics@gmail.com"],
      sentAt: daysFromNow(-6),
      snippet: "Please send us your completed W9 for the sponsorship payment.",
      sanitizedBodyText: "Please send us your completed W9 for the sponsorship payment so we can process the check.",
      rawSizeBytes: 260,
      isFromOrgAccount: false,
    },
  });
  await prisma.task.create({
    data: {
      emailThreadId: w9Thread.id,
      sourceEmailMessageId: w9Message.id,
      title: "Send W9 to sponsor",
      description: "Send the completed W9 form to the sponsor's finance team.",
      emailSummary: "Sponsor's finance team requested a completed W9 for the sponsorship payment.",
      priority: "MEDIUM",
      dueDate: daysFromNow(-4),
      dueDateSource: "EXPLICIT",
      confidence: 0.9,
      assignedOwnerId: jordan.id,
      status: "COMPLETED",
      completedAt: daysFromNow(-5),
      originalExcerpt: w9Message.sanitizedBodyText,
    },
  });

  // --- 9. Ignored / dismissed ------------------------------------------
  const coldOutreachThread = await prisma.emailThread.create({
    data: {
      gmailAccountId: wicsAccount.id,
      gmailThreadId: "seed-thread-cold-outreach",
      subject: "Partner program opportunity for your club",
      lastMessageAt: daysFromNow(-5),
      messageCount: 1,
      lastClassifiedMessageCount: 1,
      lastClassifiedAt: daysFromNow(-5),
      storedSummary: "Unsolicited partner-program pitch, dismissed as not relevant.",
    },
  });
  const coldOutreachMessage = await prisma.emailMessage.create({
    data: {
      emailThreadId: coldOutreachThread.id,
      gmailAccountId: wicsAccount.id,
      gmailMessageId: "seed-msg-cold-1",
      fromAddress: "partnerships@randombrand.example",
      toAddresses: ["rutgerswics@gmail.com"],
      sentAt: daysFromNow(-5),
      snippet: "We'd love to explore a partnership with your club!",
      sanitizedBodyText: "We'd love to explore a partnership opportunity with your club — let us know if you're interested!",
      rawSizeBytes: 220,
      isFromOrgAccount: false,
    },
  });
  await prisma.task.create({
    data: {
      emailThreadId: coldOutreachThread.id,
      sourceEmailMessageId: coldOutreachMessage.id,
      title: "Review cold partnership pitch",
      description: "Unsolicited partnership pitch from an unfamiliar brand.",
      emailSummary: "Unsolicited partner-program pitch.",
      priority: "LOW",
      confidence: 0.55,
      status: "DISMISSED",
      dismissedAt: daysFromNow(-5),
      privateNotes: "Not relevant to our current sponsor pipeline — dismissed without reply.",
      originalExcerpt: coldOutreachMessage.sanitizedBodyText,
    },
  });

  console.log("Seed complete:");
  console.log(`  Team members: ${[devUser, maria, priya, jordan, sam].length}`);
  console.log("  Gmail accounts: 2");
  console.log("  Threads: 9, spanning all 5 dashboard sections");
}

main()
  .catch((error) => {
    console.error("Seed failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
