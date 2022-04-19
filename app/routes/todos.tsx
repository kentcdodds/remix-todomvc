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

type LoaderData = {
  todos: Array<Todo>;
};

export const links: LinksFunction = () => {
  return [{ rel: "stylesheet", href: todosStylesheet }];
};

export const loader: LoaderFunction = async ({ request }) => {
  const userId = await requireUserId(request);
  return json<LoaderData>({
    todos: await prisma.todo.findMany({
      where: { userId },
    }),
  });
};

export const action: ActionFunction = async ({ request }) => {
  const formData = await request.formData();
  const userId = await requireUserId(request);

  const intent = formData.get("intent");

  switch (intent) {
    case "createTodo": {
      await prisma.todo.create({
        data: {
          complete: false,
          title: String(formData.get("title")),
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

export default function TodosRoute() {
  const data = useLoaderData() as LoaderData;
  const createFetcher = useFetcher();
  const clearFetcher = useFetcher();
  const toggleAllFetcher = useFetcher();
  const createFormRef = React.useRef<HTMLFormElement>(null);
  const location = useLocation();

  const createDone = createFetcher.type === "done";
  React.useEffect(() => {
    if (createDone && createFormRef.current) {
      createFormRef.current.reset();
    }
  }, [createDone]);

  const hasCompleteTodos = data.todos.some((todo) => todo.complete === true);

  const filter: "all" | "active" | "complete" = location.pathname.endsWith(
    "/complete"
  )
    ? "complete"
    : location.pathname.endsWith("/active")
    ? "active"
    : "all";

  return (
    <>
      <section className="todoapp">
        <div>
          <header className="header">
            <h1>todos</h1>
            <createFetcher.Form ref={createFormRef} method="post">
              <input type="hidden" name="intent" value="createTodo" />
              <input
                className="new-todo"
                placeholder="What needs to be done?"
                name="title"
              />
            </createFetcher.Form>
          </header>
          <section className="main">
            <input
              id="toggle-all"
              className="toggle-all"
              type="checkbox"
              checked={data.todos.every((t) => t.complete)}
              onChange={(event) =>
                toggleAllFetcher.submit(
                  {
                    intent: "toggleAllTodos",
                    complete: String(event.currentTarget.checked),
                  },
                  { method: "post" }
                )
              }
            />
            <label htmlFor="toggle-all"></label>
            <ul className="todo-list">
              {data.todos
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
              <strong>{data.todos.length}</strong>
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
        <p>Double-click to edit a todo</p>
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

function ListItem({ todo }: { todo: Todo }) {
  const updateFetcher = useFetcher();
  const toggleFetcher = useFetcher();
  const deleteFetcher = useFetcher();
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [isEditing, setIsEditing] = React.useState(false);

  const toggleEditing = () => setIsEditing((is) => !is);
  function handleKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter" || event.key === "Escape") {
      setIsEditing(false);
    }
  }

  return (
    <li className={cn(todo.complete && "complete", isEditing && "editing")}>
      <div className="view">
        <input
          className="toggle"
          type="checkbox"
          checked={todo.complete}
          onChange={(event) =>
            toggleFetcher.submit(
              {
                intent: "toggleTodo",
                todoId: todo.id,
                complete: String(event.currentTarget.checked),
              },
              { method: "post" }
            )
          }
        />
        <label
          onDoubleClick={() => {
            toggleEditing();
            requestAnimationFrame(() => {
              if (!inputRef.current) return;
              inputRef.current.focus();
              inputRef.current.setSelectionRange(
                inputRef.current.value.length,
                inputRef.current.value.length
              );
            });
          }}
        >
          {todo.title}
        </label>
        <deleteFetcher.Form method="post">
          <input type="hidden" name="intent" value="deleteTodo" />
          <input type="hidden" name="todoId" value={todo.id} />
          <button className="destroy"></button>
        </deleteFetcher.Form>
      </div>
      <updateFetcher.Form method="post">
        <input type="hidden" name="intent" value="updateTodo" />
        <input type="hidden" name="todoId" value={todo.id} />
        <input
          ref={inputRef}
          className="edit"
          name="title"
          defaultValue={todo.title}
          onKeyDown={handleKeyDown}
          onBlur={toggleEditing}
        />
      </updateFetcher.Form>
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
