import { Flex } from "reflexbox/styled-components";
import styled, { css } from "styled-components";
import { ifProp, prop } from "styled-tools";

// @ts-ignore
const Table = styled(Flex)<{ scrollWidth?: string }>`
  background-color:  ${prop("theme.table.row")};
  border-radius: 12px;
  box-shadow: 0 6px 15px ${prop("theme.table.shadow")};
  text-align: center;
  overflow: auto;

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
    border-bottom: 1px solid ${prop("theme.table.headBorder")};
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
    background: ${prop("theme.table.row")};
  }

  thead {
    background-color: ${prop("theme.table.headBg")};
    border-top-right-radius: 12px;
    border-top-left-radius: 12px;
    font-weight: bold;

    tr {
      border-bottom: 1px solid ${prop("theme.table.border")};
    }
  }

  tfoot {
    background-color: ${prop("theme.table.headBg")};
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
