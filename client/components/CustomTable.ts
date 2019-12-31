import { Flex } from "reflexbox/styled-components";
import styled, { css } from "styled-components";
import { ifProp, prop } from "styled-tools";

const Table = styled(Flex)<{ scrollWidth?: string }>`
  background-color: white;
  border-radius: 12px;
  box-shadow: 0 6px 15px hsla(200, 20%, 70%, 0.3);
  text-align: center;
  overflow: scroll;

  tr,
  th,
  td,
  tbody,
  thead,
  tfoot {
    display: flex;
    overflow: hidden;
  }

  tbody,
  thead,
  tfoot {
    flex-direction: column;
  }

  tr {
    border-bottom: 1px solid hsl(200, 14%, 94%);
  }
  tbody {
    border-bottom-right-radius: 12px;
    border-bottom-left-radius: 12px;
    overflow: hidden;
  }
  tbody + tfoot {
    border: none;
  }
  tbody tr:hover {
    background-color: hsl(200, 14%, 98%);
  }
  thead {
    background-color: hsl(200, 14%, 96%);
    border-top-right-radius: 12px;
    border-top-left-radius: 12px;
    font-weight: bold;
    tr {
      border-bottom: 1px solid hsl(200, 14%, 90%);
    }
  }
  tfoot {
    background-color: hsl(200, 14%, 96%);
    border-bottom-right-radius: 12px;
    border-bottom-left-radius: 12px;
  }

  ${ifProp(
    "scrollWidth",
    css`
      thead,
      tbody,
      tfoot {
        min-width: ${prop("scrollWidth")};
      }
    `
  )}
`;

Table.defaultProps = {
  as: "table",
  flex: "1 1 auto",
  flexDirection: "column",
  width: 1
};

export default Table;
