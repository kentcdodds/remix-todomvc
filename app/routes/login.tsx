import {
  json,
  redirect,
  type DataFunctionArgs,
  type LinksFunction,
  type MetaFunction,
} from "@remix-run/node";
import { Form, useActionData, useSearchParams } from "@remix-run/react";
import { useEffect, useRef } from "react";
import bcrypt from "bcryptjs";
import { prisma } from "~/db.server";
import { createUserSession, getUserId } from "~/session.server";
import loginStylesheetUrl from "./login.css";
import { type Password, type User } from "@prisma/client";

export const links: LinksFunction = () => {
  return [{ rel: "stylesheet", href: loginStylesheetUrl }];
};

export async function loader({ request }: DataFunctionArgs) {
  const userId = await getUserId(request);
  if (userId) return redirect("/todos");
  return json({});
}

export function validateEmail(email: unknown): email is string {
  return typeof email === "string" && email.length > 3 && email.includes("@");
}

export async function action({ request }: DataFunctionArgs) {
  const formData = await request.formData();
  const intent = formData.get("intent");
  const email = formData.get("email");
  const password = formData.get("password");
  const redirectTo = formData.get("redirectTo");
  const remember = formData.get("remember");

  if (!validateEmail(email)) {
    return json(
      { errors: { email: "Email is invalid", password: null } },
      { status: 400 }
    );
  }

  if (typeof password !== "string") {
    return json(
      { errors: { email: null, password: "Password is required" } },
      { status: 400 }
    );
  }

  if (password.length < 8) {
    return json(
      { errors: { email: null, password: "Password is too short" } },
      { status: 400 }
    );
  }

  let userId: string | undefined;
  if (intent === "login") {
    const user = await verifyLogin(email, password);
    userId = user?.id;
  } else if (intent === "signup") {
    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      return json(
        {
          errors: {
            email: "A user already exists with this email",
            password: null,
          },
        },
        { status: 400 }
      );
    }

    const user = await createUser(email, password);
    userId = user.id;
  } else {
    throw new Error(`Unknown intent: ${intent}`);
  }

  if (!userId) {
    return json(
      { errors: { email: "Invalid email or password", password: null } },
      { status: 400 }
    );
  }

  return createUserSession({
    request,
    userId,
    remember: remember === "on" ? true : false,
    redirectTo: typeof redirectTo === "string" ? redirectTo : "/todos",
  });
}

export async function createUser(email: User["email"], password: string) {
  const hashedPassword = await bcrypt.hash(password, 10);

  return prisma.user.create({
    data: {
      email,
      password: {
        create: {
          hash: hashedPassword,
        },
      },
    },
  });
}

export async function verifyLogin(
  email: User["email"],
  password: Password["hash"]
) {
  const userWithPassword = await prisma.user.findUnique({
    where: { email },
    include: {
      password: true,
    },
  });

  if (!userWithPassword || !userWithPassword.password) {
    return null;
  }

  const isValid = await bcrypt.compare(
    password,
    userWithPassword.password.hash
  );

  if (!isValid) {
    return null;
  }

  const { password: _password, ...userWithoutPassword } = userWithPassword;

  return userWithoutPassword;
}

export const meta: MetaFunction = () => {
  return { title: "Login" };
};

export default function LoginPage() {
  const [searchParams] = useSearchParams();
  const redirectTo = searchParams.get("redirectTo") || "/";
  const actionData = useActionData<typeof action>();
  const emailRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (actionData?.errors?.email) {
      emailRef.current?.focus();
    } else if (actionData?.errors?.password) {
      passwordRef.current?.focus();
    }
  }, [actionData]);

  return (
    <div className="login-wrapper">
      <h1>TodoMVC Login</h1>
      <div className="login-container">
        <Form method="post">
          <div>
            <label
              htmlFor="email"
              className={actionData?.errors.email ? "invalid" : ""}
            >
              Email address
            </label>
            <input
              ref={emailRef}
              id="email"
              required
              autoFocus={true}
              name="email"
              type="email"
              autoComplete="email"
              aria-invalid={actionData?.errors.email ? true : undefined}
              aria-describedby="email-error"
            />
            {actionData?.errors.email && (
              <div id="email-error">{actionData.errors.email}</div>
            )}
          </div>

          <div>
            <label
              htmlFor="password"
              className={actionData?.errors.password ? "invalid" : ""}
            >
              Password
            </label>
            <input
              id="password"
              ref={passwordRef}
              name="password"
              type="password"
              autoComplete="current-password"
              aria-invalid={actionData?.errors.password ? true : undefined}
              aria-describedby="password-error"
            />
            {actionData?.errors.password && (
              <div id="password-error">{actionData.errors.password}</div>
            )}
          </div>

          <input type="hidden" name="redirectTo" value={redirectTo} />
          <button type="submit" name="intent" value="login">
            Log in
          </button>
          <button type="submit" name="intent" value="signup">
            Sign Up
          </button>
          <div>
            <label htmlFor="remember">
              <input id="remember" name="remember" type="checkbox" /> Remember
              me
            </label>
          </div>
        </Form>
      </div>
    </div>
  );
}
