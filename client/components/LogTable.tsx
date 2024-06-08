import React, { useEffect, useState } from "react";
import formatDistanceToNow from "date-fns/formatDistanceToNow";
import styled from "styled-components";
import { Link as LinkType } from "../store/links";

const Col = styled.div`
  min-width: 100%;
  max-width: 100%;
  margin-top: 1rem;
`;

const TableContainer = styled.div`
  overflow-x: auto;
`;

const Table = styled.table`
  width: 100%;
  border-collapse: collapse;
`;

const Th = styled.th`
  padding: 8px 12px;
  border-bottom: 2px solid #ddd;
  background-color: #f2f2f2;
  text-align: left;
`;

const Td = styled.td`
  padding: 8px 12px;
  border-bottom: 1px solid #ddd;
`;

const Tr = styled.tr`
  &:nth-child(even) {
    background-color: #f9f9f9;
  }
`;

const LogsTable = ({
  link,
  reload
}: {
  link: LinkType;
  reload: () => Promise<void>;
}) => {
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (typeof link.logs === "undefined" || link.logs === null) {
      setIsLoading(true);
      reload().then(() => setIsLoading(false));
    }
  }, [link, reload]);

  if (
    typeof link.logs !== "undefined" &&
    typeof link.logs.map === "function" &&
    isLoading
  ) {
    setIsLoading(false);
  }

  if (isLoading) {
    return <Col>Loading...</Col>;
  }

  return (
    <Col>
      <TableContainer>
        <Table>
          <thead>
            <tr>
              <Th>#</Th>
              <Th>Action</Th>
              <Th>Address</Th>
              <Th>Banned</Th>
              <Th>Link</Th>
              <Th>Password</Th>
              <Th>Description</Th>
              <Th>User</Th>
              <Th>Created at</Th>
              <Th>Updated at</Th>
            </tr>
          </thead>
          <tbody>
            {link.logs.map((log, i) => (
              <Tr key={log.id}>
                <Td>{i + 1}</Td>
                <Td>{log.action}</Td>
                <Td>{log.address}</Td>
                <Td>{log.banned ? "Yes" : "No"}</Td>
                <Td>{log.target}</Td>
                <Td>{log.password ? "Yes" : "No"}</Td>
                <Td>{log.description || "-"}</Td>
                <Td>{log.user_email || "-"}</Td>
                <Td>{formatDistanceToNow(new Date(log.created_at))} ago</Td>
                <Td>{formatDistanceToNow(new Date(log.updated_at))} ago</Td>
              </Tr>
            ))}
          </tbody>
        </Table>
      </TableContainer>
    </Col>
  );
};

export default LogsTable;
