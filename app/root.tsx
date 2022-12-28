import {
  json,
  type LinksFunction,
  type DataFunctionArgs,
  type MetaFunction,
} from "@remix-run/node";
import {
  Links,
  LiveReload,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
  type ShouldRevalidateFunction,
} from "@remix-run/react";
import { getUser } from "./session.server";
import rootStylesheetUrl from "./root.css";

export const links: LinksFunction = () => {
  return [{ rel: "stylesheet", href: rootStylesheetUrl }];
};

export const meta: MetaFunction = () => ({
  charset: "utf-8",
  title: "Remix TodoMVC",
  viewport: "width=device-width,initial-scale=1",
});

export async function loader({ request }: DataFunctionArgs) {
  return json({ user: await getUser(request) });
}

export function shouldRevalidate({
  formAction,
}: Parameters<ShouldRevalidateFunction>[0]) {
  return formAction === "/logout" || formAction === "/login";
}

export default function App() {
  return (
    <html lang="en">
      <head>
        <Meta />
        <Links />
      </head>
      <body>
        <Outlet />
        <ScrollRestoration />
        <Scripts />
        <LiveReload />
      </body>
    </html>
  );
}
