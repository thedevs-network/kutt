import { NextPage } from "next";
import React from "react";
import AppWrapper from "../components/AppWrapper";
import { H1, H2, Span } from "../components/Text";
import Divider from "../components/Divider";
import { Col } from "../components/Layout";
import Footer from "../components/Footer";
import { useStoreState } from "../store";
import UsersTable from "../components/UserTable";

const AdminPage: NextPage = () => {
  const email = useStoreState(s => s.auth.email);

  return (
    <AppWrapper>
      <Col
        width={1200}
        maxWidth="95%"
        alignItems="flex-start"
        pb={80}
        my={4}
        flex={1}
      >
        <H1 alignItems="center" fontSize={[24, 28]} light>
          Welcome,{" "}
          <Span pb="2px" style={{ borderBottom: "2px dotted #999" }}>
            {email}
          </Span>
          .
        </H1>
        <Divider mt={4} mb={48} />
        <H2 mb={4} bold>
          Users
        </H2>

        <UsersTable />
      </Col>
      <Footer />
    </AppWrapper>
  );
};

export default AdminPage;
