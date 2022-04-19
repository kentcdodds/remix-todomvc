import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function seed() {
  const email = "rachel@remix.run";

  // cleanup the existing database
  await prisma.user.delete({ where: { email } }).catch(() => {
    // no worries if it doesn't exist yet
  });

  const hashedPassword = await bcrypt.hash("racheliscool", 10);

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

  await prisma.note.create({
    data: {
      title: "My first note",
      body: "Hello, world!",
      userId: user.id,
    },
  });

  await prisma.note.create({
    data: {
      title: "My second note",
      body: "Hello, world!",
      userId: user.id,
    },
  });

  const list1 = await prisma.list.create({
    data: { title: "Personal", userId: user.id },
  });

  const list2 = await prisma.list.create({
    data: { title: "Work", userId: user.id },
  });

  await prisma.listTodo.create({
    data: { listId: list1.id, title: "Take a nap", complete: true },
  });

  await prisma.listTodo.create({
    data: { listId: list1.id, title: "Stretch", complete: true },
  });

  await prisma.listTodo.create({
    data: { listId: list1.id, title: "Laundry", complete: false },
  });

  await prisma.listTodo.create({
    data: { listId: list2.id, title: "Setup Database", complete: true },
  });
  await prisma.listTodo.create({
    data: { listId: list2.id, title: "Give talk", complete: true },
  });

  const allListTodos = await prisma.listTodo.findMany({
    where: { list: { userId: user.id } },
    select: { title: true, complete: true },
  });

  for (const todo of allListTodos) {
    await prisma.todo.create({ data: { ...todo, userId: user.id } });
  }

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
