import { Flex } from "reflexbox/styled-components";
import styled, { css } from "styled-components";
import { ifProp, prop } from "styled-tools";

import { Colors } from "../consts";

//@ts-ignore
export const Table = styled(Flex)<{ scrollWidth?: string }>`
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

export const Tr = styled(Flex).attrs({ as: "tr", px: [12, 12, 2] })``;

export const Th = styled(Flex)``;
Th.defaultProps = { as: "th", flexBasis: 0, py: [12, 12, 3], px: [12, 12, 3] };


export const Td = styled(Flex) <{ withFade?: boolean }>`
  position: relative;
  white-space: nowrap;

  ${ifProp(
  "withFade",
  `
      :after {
        content: "";
        position: absolute;
        right: 0;
        top: 0;
        height: 100%;
        width: 16px;
        background: linear-gradient(to left, ${({ theme }) => theme.table.row}, rgba(255, 255, 255, 0.001));
      }

      tr:hover &:after {
        background: linear-gradient(
          to left,
          ${({ theme }) => theme.table.rowHover},
          rgba(255, 255, 255, 0.001)
        );
      }
    `
)}
`;
Td.defaultProps = {
  as: "td",
  fontSize: [15, 16],
  alignItems: "center",
  flexBasis: 0,
  py: [12, 12, 3],
  px: [12, 12, 3]
};

