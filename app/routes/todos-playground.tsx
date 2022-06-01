import * as React from "react";
import type { Todo } from "@prisma/client";
import type {
  ActionFunction,
  LinksFunction,
  LoaderFunction,
} from "@remix-run/node";
import { json } from "@remix-run/node";
import {
  useCatch,
  useFetcher,
  useLoaderData,
  Link,
  useLocation,
} from "@remix-run/react";
import { prisma } from "~/db.server";
import { requireUserId } from "~/session.server";
import todosStylesheet from "./todos.css";
import invariant from "tiny-invariant";
import { CompleteIcon, IncompleteIcon } from "~/icons";

type TodoItem = Pick<Todo, "id" | "complete" | "title">;
type Filter = "all" | "active" | "complete";

type LoaderData = {
  todos: Array<TodoItem>;
};

export const links: LinksFunction = () => {
  return [{ rel: "stylesheet", href: todosStylesheet }];
};

export const loader: LoaderFunction = async ({ request }) => {
  const userId = await requireUserId(request);
  return json<LoaderData>({
    todos: await prisma.todo.findMany({
      where: { userId },
      select: { id: true, complete: true, title: true },
    }),
  });
};

function validateNewTodoTitle(title: string) {
  return title ? null : "Todo title required";
}

type CreateTodoActionData = {
  title: string;
  error: string;
};

type UpdateTodoActionData = {
  title: string;
  error: string;
};

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export const action: ActionFunction = async ({ request }) => {
  await sleep(Math.random() * 1000 + 500);
  const formData = await request.formData();
  const userId = await requireUserId(request);

  const intent = formData.get("intent");

  switch (intent) {
    case "createTodo": {
      const title = formData.get("title");
      invariant(typeof title === "string", "title must be a string");
      // if (Math.random() > 0.5) {
      //   return json({ title, error: `Random failure` }, { status: 500 });
      // }
      if (title.includes("error")) {
        return json<CreateTodoActionData>(
          { title, error: `Todos cannot include the word "error"` },
          { status: 400 }
        );
      }
      const titleError = validateNewTodoTitle(title);
      if (titleError) {
        return json<CreateTodoActionData>(
          { title, error: titleError },
          { status: 400 }
        );
      }
      await prisma.todo.create({
        data: {
          complete: false,
          title: String(title),
          userId,
        },
      });
      return new Response("ok");
    }
    case "toggleAllTodos": {
      // if (Math.random() > 0.5) {
      //   return json({ error: `Random failure` }, { status: 500 });
      // }
      await prisma.todo.updateMany({
        where: { userId },
        data: { complete: formData.get("complete") === "true" },
      });
      return new Response("ok");
    }
    case "deleteCompletedTodos": {
      // if (Math.random() > 0.5) {
      //   return json({ error: `Random failure` }, { status: 500 });
      // }
      await prisma.todo.deleteMany({ where: { complete: true, userId } });
      return new Response("ok");
    }
  }

  const todoId = String(formData.get("todoId"));
  // make sure the todo belongs to the user
  const todo = await prisma.todo.findFirst({ where: { id: todoId, userId } });

  if (!todo) {
    throw json({ error: "todo not found" }, { status: 404 });
  }

  switch (intent) {
    case "toggleTodo": {
      // if (Math.random() > 0.5) {
      //   return json({ error: `Random failure` }, { status: 500 });
      // }
      await prisma.todo.update({
        where: { id: todoId },
        data: { complete: formData.get("complete") === "true" },
      });
      return new Response("ok");
    }
    case "updateTodo": {
      const title = formData.get("title");
      invariant(typeof title === "string", "title must be a string");
      // if (Math.random() > 0.5) {
      //   return json({ title, error: `Random failure` }, { status: 500 });
      // }
      if (title.includes("error")) {
        return json<UpdateTodoActionData>(
          { title, error: `Todos cannot include the word "error"` },
          { status: 400 }
        );
      }
      const titleError = validateNewTodoTitle(title);
      if (titleError) {
        return json<UpdateTodoActionData>(
          { title, error: titleError },
          { status: 400 }
        );
      }

      await prisma.todo.update({
        where: { id: todoId },
        data: { title: String(formData.get("title")) },
      });
      return new Response("ok");
    }
    case "deleteTodo": {
      // if (Math.random() > 0.5) {
      //   return json({ error: `Random failure` }, { status: 500 });
      // }
      await prisma.todo.delete({ where: { id: todoId } });
      return new Response("ok");
    }
    default: {
      throw json({ message: `Unknown intent: ${intent}` }, { status: 400 });
    }
  }
};

const cn = (...cns: Array<string | false>) => cns.filter(Boolean).join(" ");

export default function TodosRoute() {
  const data = useLoaderData() as LoaderData;
  const createFetcher = useFetcher();
  const clearFetcher = useFetcher();
  const toggleAllFetcher = useFetcher();
  const createFormRef = React.useRef<HTMLFormElement>(null);
  const location = useLocation();

  const createFetcherData = createFetcher.data as
    | CreateTodoActionData
    | undefined;

  const hasCompleteTodos = data.todos.some((todo) => todo.complete === true);

  const filter: Filter = location.pathname.endsWith("/complete")
    ? "complete"
    : location.pathname.endsWith("/active")
    ? "active"
    : "all";

  const remainingActive = data.todos.filter((t) => !t.complete);
  const allComplete = remainingActive.length === 0;

  return (
    <>
      <section className="todoapp">
        <div>
          <header className="header">
            <h1>todos</h1>
            <createFetcher.Form
              ref={createFormRef}
              method="post"
              className="create-form"
            >
              <input type="hidden" name="intent" value="createTodo" />
              <input
                className="new-todo"
                placeholder="What needs to be done?"
                name="title"
                aria-invalid={createFetcherData?.error ? true : undefined}
                aria-describedby="new-todo-error"
              />
              {createFetcherData?.error ? (
                <div className="error" id="new-todo-error">
                  {createFetcherData?.error}
                </div>
              ) : null}
            </createFetcher.Form>
          </header>
          <section className="main">
            <toggleAllFetcher.Form method="post">
              <input
                type="hidden"
                name="complete"
                value={(!allComplete).toString()}
              />
              <button
                className={`toggle-all ${allComplete ? "checked" : ""}`}
                type="submit"
                name="intent"
                value="toggleAllTodos"
                title={
                  allComplete
                    ? "Mark all as incomplete"
                    : "Mark all as complete"
                }
              >
                ❯
              </button>
            </toggleAllFetcher.Form>
            <ul className="todo-list">
              {data.todos.map((todo) => (
                <ListItem todo={todo} key={todo.id} filter={filter} />
              ))}
            </ul>
          </section>
          <footer className="footer">
            <span className="todo-count">
              <strong>{remainingActive.length}</strong>
              <span>
                {" "}
                {remainingActive.length === 1 ? "item" : "items"} left
              </span>
            </span>
            <ul className="filters">
              <li>
                <Link to="." className={cn(filter === "all" && "selected")}>
                  All
                </Link>
              </li>{" "}
              <li>
                <Link
                  to="active"
                  className={cn(filter === "active" && "selected")}
                >
                  Active
                </Link>
              </li>{" "}
              <li>
                <Link
                  to="complete"
                  className={cn(filter === "complete" && "selected")}
                >
                  Completed
                </Link>
              </li>
            </ul>
            {hasCompleteTodos ? (
              <clearFetcher.Form method="post">
                <input
                  type="hidden"
                  name="intent"
                  value="deleteCompletedTodos"
                />
                <button className="clear-completed">Clear completed</button>
              </clearFetcher.Form>
            ) : null}
          </footer>
        </div>
      </section>
      <footer className="info">
        <p>
          Created by <a href="http://github.com/kentcdodds">Kent C. Dodds</a>
        </p>
        <p>
          Part of <a href="http://todomvc.com">TodoMVC</a>
        </p>
      </footer>
    </>
  );
}

function ListItem({ todo, filter }: { todo: TodoItem; filter: Filter }) {
  const updateFetcher = useFetcher();
  const toggleFetcher = useFetcher();
  const deleteFetcher = useFetcher();
  const updateFormRef = React.useRef<HTMLFormElement>(null);

  const shouldRender =
    filter === "all" ||
    (filter === "complete" && todo.complete) ||
    (filter === "active" && !todo.complete);

  if (!shouldRender) return null;

  return (
    <li className={todo.complete ? "completed" : ""}>
      <div className="view">
        <toggleFetcher.Form method="post">
          <input type="hidden" name="todoId" value={todo.id} />
          <input
            type="hidden"
            name="complete"
            value={(!todo.complete).toString()}
          />
          <button
            type="submit"
            name="intent"
            value="toggleTodo"
            className="toggle"
            title={todo.complete ? "Mark as incomplete" : "Mark as complete"}
          >
            {todo.complete ? <CompleteIcon /> : <IncompleteIcon />}
          </button>
        </toggleFetcher.Form>
        <updateFetcher.Form
          method="post"
          className="update-form"
          ref={updateFormRef}
        >
          <input type="hidden" name="intent" value="updateTodo" />
          <input type="hidden" name="todoId" value={todo.id} />
          <input
            name="title"
            className="edit-input"
            defaultValue={todo.title}
            onBlur={(e) => {
              if (todo.title !== e.currentTarget.value) {
                updateFetcher.submit(e.currentTarget.form);
              }
            }}
            aria-invalid={updateFetcher.data?.error ? true : undefined}
            aria-describedby={`todo-update-error-${todo.id}`}
          />
          {updateFetcher.data?.error && updateFetcher.state !== "submitting" ? (
            <div
              className="error todo-update-error"
              id={`todo-update-error-${todo.id}`}
            >
              {updateFetcher.data?.error}
            </div>
          ) : null}
        </updateFetcher.Form>
        <deleteFetcher.Form method="post">
          <input type="hidden" name="todoId" value={todo.id} />
          <button
            className="destroy"
            title="Delete todo"
            type="submit"
            name="intent"
            value="deleteTodo"
          />
        </deleteFetcher.Form>
      </div>
    </li>
  );
}

export function CatchBoundary() {
  const caught = useCatch();

  if (caught.status === 400) {
    return <div>You did something wrong: {caught.data.message}</div>;
  }

  if (caught.status === 404) {
    return <div>Not found</div>;
  }

  throw new Error(`Unexpected caught response with status: ${caught.status}`);
}

export function ErrorBoundary({ error }: { error: Error }) {
  console.error(error);

  return <div>An unexpected error occurred: {error.message}</div>;
}
