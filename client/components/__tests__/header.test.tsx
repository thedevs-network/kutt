import React from "react";
import { render } from "@testing-library/react";
import { StoreProvider } from "easy-peasy";
import { initializeStore } from "../../store";
import Header from "../Header";
import getConfig from "next/config";

Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: jest.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: jest.fn(), // Deprecated
    removeListener: jest.fn(), // Deprecated
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
  }))
});

describe("<Header /> component test", () => {
  let app;
  it("should have a login button", () => {
    const store = initializeStore();
    app = (
      <StoreProvider store={store}>
        <Header />
      </StoreProvider>
    );

    const screen = render(app);
    const button = screen.getByText(/Log in/);
    expect(button).toHaveTextContent("Log in / Sign up");
  });
});
