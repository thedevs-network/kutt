import { Flex } from "reflexbox/styled-components";
import styled, { css } from "styled-components";
import { ifProp, prop } from "styled-tools";

import { Colors } from "../consts";

const Table = styled(Flex)<{ scrollWidth?: string }>`
  background-color: white;
  border-radius: 12px;
  box-shadow: 0 6px 15px ${Colors.TableShadow};
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
    border-bottom: 1px solid ${Colors.TableHeadBorder};
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
    background-color: ${Colors.TableRowHover};
  }
  thead {
    background-color: ${Colors.TableHeadBg};
    border-top-right-radius: 12px;
    border-top-left-radius: 12px;
    font-weight: bold;
    tr {
      border-bottom: 1px solid ${Colors.TableBorder};
    }
  }
  tfoot {
    background-color: ${Colors.TableHeadBg};
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
