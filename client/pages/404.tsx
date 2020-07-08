import React from "react";
import AppWrapper from "../components/AppWrapper";
import  { H2 } from "../components/Text";


const custom404 = () => {
  return (
    <AppWrapper>
        <H2 my={4} light>
          404 | Link could not be found test.
        </H2>
    </AppWrapper>
  );
};

export default custom404;
