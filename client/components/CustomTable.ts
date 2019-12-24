import styled from "styled-components";
import { Flex } from "reflexbox/styled-components";

const Table = styled(Flex).attrs({
  as: "table",
  flex: "1 1 auto",
  flexDirection: "column",
  width: 1
})`
  background-color: white;
  border-radius: 12px;
  box-shadow: 0 6px 30px rgba(50, 50, 50, 0.2);
  text-align: center;

  tr,
  th,
  td,
  tbody,
  thead,
  tfoot {
    display: flex;
    flex: 1 1 auto;
  }

  tr {
    border-bottom: 1px solid #eaeaea;
  }
  tbody tr:last-child {
    border-bottom-right-radius: 12px;
    border-bottom-left-radius: 12px;
  }
  tbody tr:last-child + tfoot {
    border: none;
  }
  tbody tr:hover {
    background-color: #f8f8f8;
  }
  thead {
    background-color: #f1f1f1;
    border-top-right-radius: 12px;
    border-top-left-radius: 12px;
    font-weight: bold;
    tr {
      border-bottom: 1px solid #dedede;
    }
  }
  tfoot {
    background-color: #f1f1f1;
    border-bottom-right-radius: 12px;
    border-bottom-left-radius: 12px;
  }
`;

export default Table;
