import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function seed() {
  const email = "kody@kcd.dev";

  // cleanup the existing database
  await prisma.user.delete({ where: { email } }).catch(() => {
    // no worries if it doesn't exist yet
  });

  const hashedPassword = await bcrypt.hash("kodylovesyou", 10);

  const user = await prisma.user.create({
    data: {
      email,
      password: {
        create: {
          hash: hashedPassword,
        },
      },
    },
  });

  await prisma.todo.create({
    data: { userId: user.id, title: "Take a nap", complete: true },
  });

  await prisma.todo.create({
    data: { userId: user.id, title: "Stretch", complete: true },
  });

  await prisma.todo.create({
    data: { userId: user.id, title: "Laundry", complete: false },
  });

  await prisma.todo.create({
    data: { userId: user.id, title: "Setup Database", complete: true },
  });
  await prisma.todo.create({
    data: { userId: user.id, title: "Give talk", complete: true },
  });

  console.log(`Database has been seeded. 🌱`);
}

seed()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
