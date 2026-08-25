import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding ProSource database...');

  // Create default admin user
  const passwordHash = await bcrypt.hash('admin123', 12);
  const user = await prisma.user.upsert({
    where: { email: 'admin@prosource.io' },
    update: {},
    create: {
      email: 'admin@prosource.io',
      passwordHash,
      name: 'Admin',
    },
  });
  console.log('✅ Admin user created:', user.email);

  // Create default email template
  const template = await prisma.emailTemplate.create({
    data: {
      name: 'Professional Outreach v1',
      isDefault: true,
      introSubject: 'Helping {{company}} with {{serviceNeed}}',
      introBody: `Hi {{contactPerson}},

I came across {{company}} and was impressed by what you're building. I specialize in {{serviceNeed}} and have helped similar companies streamline their operations and scale efficiently.

I'd love to explore how I can support {{company}} — whether it's a one-time project or ongoing collaboration.

Would you be open to a quick 15-minute call this week to discuss?

Looking forward to hearing from you.`,
      followup1Subject: 'Re: Helping {{company}} with {{serviceNeed}}',
      followup1Body: `Hi {{contactPerson}},

Just wanted to follow up on my previous email. I understand things get busy, so I wanted to keep this brief.

I've been working with companies similar to {{company}} on {{serviceNeed}}, and I'd love to share some ideas that could be valuable for your team.

Would a quick chat work for you this week?`,
      followup2Subject: 'Quick follow-up — {{company}}',
      followup2Body: `Hi {{contactPerson}},

I wanted to reach out one more time — I genuinely believe there's a great fit between what I offer and what {{company}} needs in terms of {{serviceNeed}}.

If the timing isn't right, I completely understand. Just let me know and I'll circle back at a better time.

Either way, I'd appreciate a quick reply so I know where things stand.`,
      followup3Subject: 'Last check-in — {{company}}',
      followup3Body: `Hi {{contactPerson}},

This will be my last follow-up for now. I don't want to be a nuisance, but I didn't want to leave things without giving it one more shot.

If {{serviceNeed}} is something {{company}} is looking to address, I'm here and ready to help whenever the time is right.

Wishing you and the team all the best!`,
    },
  });
  console.log('✅ Default template created:', template.name);

  // Create default signature
  const signature = await prisma.signature.create({
    data: {
      name: 'Harsh Patel',
      role: 'Founder',
      tagline: 'Helping businesses grow with expert solutions',
      isDefault: true,
      links: JSON.stringify([
        { label: 'LinkedIn', url: 'https://linkedin.com/in/harshpatel', icon: 'linkedin' },
        { label: 'Website', url: 'https://prosource.io', icon: 'globe' },
      ]),
    },
  });
  console.log('✅ Default signature created:', signature.name);

  console.log('🎉 Seed complete!');
}

main()
  .catch((e) => {
    console.error('Seed error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
