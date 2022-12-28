import { faker } from "@faker-js/faker";
import { expect, test, type Page } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { parse } from "cookie";
import invariant from "tiny-invariant";
import { getSession, sessionStorage, USER_SESSION_KEY } from "~/session.server";

test("creating a new user", async ({ page }) => {
  const loginForm = makeLoginForm();

  await page.goto("/");
  await expect(page).toHaveURL(`/login`);
  await page.getByRole("textbox", { name: "Email" }).fill(loginForm.email);
  await page.getByLabel("Password").fill(loginForm.password);
  await page.getByRole("checkbox", { name: "Remember me" }).check();
  await page.getByRole("button", { name: "Sign up" }).click();
  await expect(page).toHaveURL(`/todos`);

  await page.getByRole("button", { name: "Logout" }).click();
  await expect(page).toHaveURL(`/login`);

  await deleteUserByEmail(loginForm.email);
});

test("login as existing user", async ({ page }) => {
  const password = faker.internet.password();
  const user = await insertNewUser({ password });
  invariant(user.email, "User email not found");
  await page.goto("/login");
  await page.getByRole("textbox", { name: "Email" }).fill(user.email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Log in" }).click();
  await expect(page).toHaveURL(`/todos`);

  await page.getByRole("button", { name: "Logout" }).click();
  await expect(page).toHaveURL(`/login`);
});

test("Simple todo crud", async ({ page, baseURL }) => {
  await loginPage({ page, baseURL });
  await page.goto("/todos");
  const markAsCompleteButton = page.getByRole("button", {
    name: "Mark all as complete",
  });
  const newTodoInput = page.getByRole("textbox", {
    name: "What needs to be done?",
  });
  const clearCompletedButton = page.getByRole("button", {
    name: "Clear completed",
  });
  await expect(markAsCompleteButton).not.toBeVisible();
  await expect(clearCompletedButton).not.toBeVisible();
  await expect(page.getByText(/item left/)).not.toBeVisible();

  await newTodoInput.fill("Buy milk");
  await newTodoInput.press("Enter");

  await expect(page.getByText("1 item left")).toBeVisible();
  await expect(markAsCompleteButton).toBeVisible();
  await expect(clearCompletedButton).not.toBeVisible();

  await page.getByRole("button", { name: "Mark as complete" }).click();
  await expect(clearCompletedButton).toBeVisible();
  await page.getByRole("button", { name: "Mark as incomplete" }).click();
  await page.getByRole("button", { name: "Delete todo" }).click();
});

const testUserIds = new Set<string>();

type LoginForm = {
  email: string;
  password: string;
};

export function makeLoginForm(
  overrides: Partial<LoginForm> | undefined = {}
): LoginForm {
  const username = faker.helpers.unique(faker.internet.userName);
  const email = `${username}@example.com`;
  return {
    email,
    password: username.padEnd(8, "0").toUpperCase(),
    ...overrides,
  };
}

export async function insertNewUser({ password }: { password?: string } = {}) {
  return runPrisma(async (prisma) => {
    const username = faker.helpers.unique(faker.internet.userName);
    const email = `${username}@example.com`;
    const user = await prisma.user.create({
      data: {
        email,
        password: {
          create: {
            hash: bcrypt.hashSync(
              password || username.padEnd(8, "0").toUpperCase(),
              10
            ),
          },
        },
      },
    });
    testUserIds.add(user.id);
    return user;
  });
}

export async function runPrisma<ReturnType>(
  cb: (prisma: PrismaClient) => Promise<ReturnType>
) {
  const prisma = new PrismaClient();
  const ret = await cb(prisma);
  await prisma.$disconnect();
  return ret;
}

export function deleteUserByEmail(email: string) {
  return runPrisma((prisma) => prisma.user.delete({ where: { email } }));
}

export async function loginPage({
  page,
  baseURL,
  user,
}: {
  page: Page;
  // baseURL can be undefined in the test callback for some reason
  // so we'll make it easier to use. But I don't know why it would
  // ever be undefined, so we'll toss invariant at it.
  baseURL: string | undefined;
  user?: { id: string; email: string };
}) {
  invariant(baseURL, "baseURL is required...");
  user = user ?? (await insertNewUser());
  const session = await getSession(new Request(baseURL));
  session.set(USER_SESSION_KEY, user.id);
  const cookieValue = await sessionStorage.commitSession(session);
  const { __session } = parse(cookieValue);
  page.context().addCookies([
    {
      name: "__session",
      sameSite: "Lax",
      url: baseURL,
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      value: __session,
    },
  ]);
  return user;
}

test.afterEach(async () => {
  await runPrisma(async (prisma) => {
    await prisma.user.deleteMany({
      where: { id: { in: [...testUserIds] } },
    });
  });
});
