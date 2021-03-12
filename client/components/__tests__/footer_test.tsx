import React from "react";
import { render } from "@testing-library/react";
import { StoreProvider } from "easy-peasy";
import { initializeStore } from "../../store";
import Footer from "../Footer";
import getConfig from "next/config";

describe("<Footer /> component test", () => {
  let app;

  beforeEach(() => {
    const store = initializeStore();
    app = (
      <StoreProvider store={store}>
        <Footer />
      </StoreProvider>
    );
  });

  it("should contain a github link", () => {
    const screen = render(app);
    const githubLink = screen.getByRole("link", { name: "GitHub" });
    expect(githubLink).toHaveAttribute("href", "https://github.com/thedevs-network/kutt");
  });

  it("should contain a TOS link", () => {
    const config = getConfig();
    const screen = render(app);
    const tosLink = screen.getByRole("link", { name: "Terms of Service" });

    expect(tosLink).toHaveAttribute("href", "/terms");
  });

  it("should show contact email if defined", () => {
    const config = getConfig();
    config.publicRuntimeConfig.CONTACT_EMAIL = 'foobar';
    const screen = render(app);
    const emailLink = screen.getByRole("link", { name: "Contact us" });

    expect(emailLink).toHaveAttribute("href", "mailto:foobar");
  });

  it("should NOT show contact email if none is defined", () => {
    const config = getConfig();
    delete(config.publicRuntimeConfig.CONTACT_EMAIL);
    const screen = render(app);
    const emailLink= screen.queryByRole("link", { name: "Contact us" });

    expect(emailLink).toBeNull();
  });
})

