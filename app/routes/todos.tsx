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

type TodoItem = Pick<Todo, "id" | "complete" | "title">;

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

export const action: ActionFunction = async ({ request }) => {
  const formData = await request.formData();
  const userId = await requireUserId(request);

  const intent = formData.get("intent");

  switch (intent) {
    case "createTodo": {
      const title = formData.get("title");
      invariant(typeof title === "string", "title must be a string");
      // if (Math.random() > 0.5) {
      //   return json<CreateTodoActionData>(
      //     { title, error: "An unknown error occurred" },
      //     { status: 500 }
      //   );
      // }
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
      await prisma.todo.updateMany({
        where: { userId },
        data: { complete: formData.get("complete") === "true" },
      });
      return new Response("ok");
    }
    case "deleteCompletedTodos": {
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
      await prisma.todo.update({
        where: { id: todoId },
        data: { complete: formData.get("complete") === "true" },
      });
      return new Response("ok");
    }
    case "updateTodo": {
      await prisma.todo.update({
        where: { id: todoId },
        data: { title: String(formData.get("title")) },
      });
      return new Response("ok");
    }
    case "deleteTodo": {
      await prisma.todo.delete({ where: { id: todoId } });
      return new Response("ok");
    }
    default: {
      throw json({ message: `Unknown intent: ${intent}` }, { status: 400 });
    }
  }
};

const generateRandomId = () => Math.random().toString(32).slice(2);

export default function TodosRoute() {
  const data = useLoaderData() as LoaderData;
  const createFetcher = useFetcher();
  const clearFetcher = useFetcher();
  const toggleAllFetcher = useFetcher();
  const createFormRef = React.useRef<HTMLFormElement>(null);
  const location = useLocation();

  const todos = [...data.todos];

  const createFetcherData = createFetcher.data as
    | CreateTodoActionData
    | undefined;

  if (createFetcher.submission && !createFetcherData?.error) {
    const newTodoTitle = createFetcher.submission.formData.get("title");
    if (
      typeof newTodoTitle === "string" &&
      !validateNewTodoTitle(newTodoTitle)
    ) {
      todos.push({
        id: generateRandomId(),
        title: newTodoTitle,
        complete: false,
      });
    }
  }

  if (clearFetcher.submission) {
    // TODO: clear fetcher
    // todos = todos.filter
  }

  React.useEffect(() => {
    if (!createFormRef.current) return;
    if (createFetcher.type === "actionSubmission") {
      createFormRef.current.reset();
    } else if (createFetcher.type === "actionReload") {
      if (createFetcherData?.error) {
        createFormRef.current.elements.title.value = createFetcherData.title;
      }
    }
  }, [createFetcher.submission?.key, createFetcher.type, createFetcherData]);

  const hasCompleteTodos = data.todos.some((todo) => todo.complete === true);

  const filter: "all" | "active" | "complete" = location.pathname.endsWith(
    "/complete"
  )
    ? "complete"
    : location.pathname.endsWith("/active")
    ? "active"
    : "all";

  const allComplete = data.todos.every((t) => t.complete);

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
              {createFetcherData?.error && (
                <div className="error" id="new-todo-error">
                  {createFetcherData?.error}
                </div>
              )}
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
              {todos
                .filter(
                  (todo) =>
                    filter === "all" ||
                    (filter === "complete" ? todo.complete : !todo.complete)
                )
                .map((todo) => (
                  <ListItem todo={todo} key={todo.id} />
                ))}
            </ul>
          </section>
          <footer className="footer">
            <span className="todo-count">
              <strong>{todos.length}</strong>
              <span> items left</span>
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

const cn = (...cns: Array<string | false>) => cns.filter(Boolean).join(" ");

function ListItem({ todo }: { todo: TodoItem }) {
  const updateFetcher = useFetcher();
  const toggleFetcher = useFetcher();
  const deleteFetcher = useFetcher();
  const inputRef = React.useRef<HTMLInputElement>(null);

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
        <updateFetcher.Form method="post">
          <input type="hidden" name="intent" value="updateTodo" />
          <input type="hidden" name="todoId" value={todo.id} />
          <input
            ref={inputRef}
            name="title"
            className="edit-input"
            defaultValue={todo.title}
            onBlur={(e) => {
              if (todo.title !== e.currentTarget.value) {
                updateFetcher.submit(e.currentTarget.form);
              }
            }}
          />
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

function IncompleteIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="40"
      height="40"
      viewBox="-3 -3 105 105"
    >
      <circle
        cx="50"
        cy="50"
        r="50"
        fill="none"
        stroke="#ededed"
        strokeWidth="3"
      />
    </svg>
  );
}

function CompleteIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="40"
      height="40"
      viewBox="-3 -3 105 105"
    >
      <circle
        cx="50"
        cy="50"
        r="50"
        fill="none"
        stroke="#bddad5"
        strokeWidth="3"
      />
      <path fill="#5dc2af" d="M72 25L42 71 27 56l-4 4 20 20 34-52z" />
    </svg>
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
