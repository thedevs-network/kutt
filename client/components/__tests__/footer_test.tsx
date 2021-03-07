import React from "react";
import { render } from "@testing-library/react";
import { StoreProvider } from "easy-peasy";
import { initializeStore } from "../../store";
import Footer from "../Footer";
import getConfig from "next/config";

describe("<Footer /> component test", () => {
  it("should work", () => {
    expect(1).toEqual(1);
  });
})

