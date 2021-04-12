import React from "react";
import { render } from "@testing-library/react";
import { StoreProvider, createStore, thunk } from "easy-peasy";
import userEvent from "@testing-library/user-event"
import { store } from "../../store";
import Shortener from "../Shortener";

describe("<Shortener /> component test", () => {
  let app;

  beforeEach(() => {
    store.links = {
      ...store.links,
      submit: thunk(async (actions, payload) => {
        return {
          id: "0",
          address: "localhost:3000/foobar",
          banned: false,
          created_at: "now",
          link: "localhost:3000/foobar",
          target: "",
          updated_at: "now",
          visit_count: 0
        };
      })
    };
    const testStore = createStore(store);
    app = (
      <StoreProvider store={testStore}>
        <Shortener />
      </StoreProvider>
    );
  });

  it("Should show the short URL", async () => {
    const screen = render(app);
    const urlInput = screen.getByRole("textbox", { name: "target" });
    userEvent.type(urlInput, "https://easy-peasy.now.sh/docs/api/thunk.html");
    const submitButton = screen.getByRole("button", { name: "submit" });
    userEvent.click(submitButton);
    const msg = await screen.findByText(/localhost:3000\/foobar/i);
    expect(msg).toBeInTheDocument();
  });

  it("Should empty target input", async () => {
    const screen = render(app);
    let urlInput: HTMLInputElement = screen.getByRole("textbox", {
      name: "target"
    }) as HTMLInputElement;
    userEvent.type(urlInput, "https://easy-peasy.now.sh/docs/api/thunk.html");
    const submitButton = screen.getByRole("button", { name: "submit" });
    userEvent.click(submitButton);
    await screen.findByText(/localhost:3000\/foobar/i);
    urlInput = screen.getByRole("textbox", {
      name: "target"
    }) as HTMLInputElement;
    expect(urlInput.value).toEqual("");
  });
});
