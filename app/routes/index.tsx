import { type DataFunctionArgs } from "@remix-run/node";
import { redirect } from "@remix-run/node";
import { getUser } from "~/session.server";

export async function loader({ request }: DataFunctionArgs) {
  const user = await getUser(request);
  if (user) return redirect("/todos");
  else return redirect("/login");
}
