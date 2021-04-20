import styled, { css } from "styled-components";
import { Flex } from "reflexbox/styled-components";
import { ifProp } from "styled-tools";
import { Colors } from "../consts";
import { useStoreActions, useStoreState } from "../store";
import React, { FC, useEffect, useState } from "react";
import Table from "./Table";
import Text, { H2, Span } from "./Text";
import Icon from "./Icon";
import Tooltip from "./Tooltip";
import { Button, NavButton } from "./Button";
import { useFormState } from "react-use-form-state";
import { User } from "../store/users";
import { useMessage } from "../hooks";
import { errorMessage, removeProtocol } from "../utils";
import Modal from "./Modal";
import CreateNewUserButton from "./Admin/CreateNewUser";
import { TextInput } from "./Input";

const Tr = styled(Flex).attrs({ as: "tr", px: [12, 12, 2] })``;
const Th = styled(Flex)``;
Th.defaultProps = { as: "th", flexBasis: 0, py: [12, 12, 3], px: [12, 12, 3] };

const Td = styled(Flex)<{ withFade?: boolean }>`
  position: relative;
  white-space: nowrap;

  ${ifProp(
    "withFade",
    css`
      :after {
        content: "";
        position: absolute;
        right: 0;
        top: 0;
        height: 100%;
        width: 16px;
        background: linear-gradient(to left, white, rgba(255, 255, 255, 0.001));
      }

      tr:hover &:after {
        background: linear-gradient(
          to left,
          ${Colors.TableRowHover},
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

const Action = (props: React.ComponentProps<typeof Icon>) => (
  <Icon
    as="button"
    py={0}
    px={0}
    mr={2}
    size={[23, 24]}
    flexShrink={0}
    p={["4px", "5px"]}
    stroke="#666"
    {...props}
  />
);

const actionsFlex = {
  flexGrow: [1, 1, 3],
  flexShrink: [1, 1, 3],
  justifyContent: "flex-end",
  alignItems: "center"
};

const emailFlex = {
  flexGrow: [1, 3, 7],
  flexShrink: [1, 3, 7],
  alignItems: "center"
};

const verifiedFlex = {
  flexGrow: [1, 1, 3],
  flexShrink: [1, 1, 3],
  alignItems: "center",
  justifyContent: "center"
};

interface Form {
  all: boolean;
  limit: string;
  skip: string;
  search: string;
}

const UsersTable = () => {
  const users = useStoreState(s => s.users);
  const { get } = useStoreActions(s => s.users);
  const [tableMessage, setTableMessage] = useState("No users to show.");
  const [formState, { label, checkbox, text }] = useFormState<Form>(
    { skip: "0", limit: "10", all: false },
    { withIds: true }
  );

  const options = formState.values;

  const load = () => {
    get(options).catch(err =>
      setTableMessage(err?.response?.data?.error || "An error occurred.")
    );
  };

  useEffect(() => {
    load();
  }, [options.limit, options.skip, options.all]);

  const onNavChange = (nextPage: number) => () => {
    formState.setField("skip", (parseInt(options.skip) + nextPage).toString());
  };

  const Nav = (
    <Th
      alignItems="center"
      justifyContent="flex-end"
      flexGrow={1}
      flexShrink={1}
    >
      <Flex as="ul" m={0} p={0} style={{ listStyle: "none" }}>
        {["10", "25", "50"].map(c => (
          <Flex key={c} ml={[10, 12]}>
            <NavButton
              disabled={options.limit === c}
              onClick={() => {
                formState.setField("limit", c);
                formState.setField("skip", "0");
              }}
            >
              {c}
            </NavButton>
          </Flex>
        ))}
      </Flex>
      <Flex
        width="1px"
        height={20}
        mx={[3, 24]}
        style={{ backgroundColor: "#ccc" }}
      />
      <Flex>
        <NavButton
          onClick={onNavChange(-parseInt(options.limit))}
          disabled={options.skip === "0"}
          px={2}
        >
          <Icon name="chevronLeft" size={15} />
        </NavButton>
        <NavButton
          onClick={onNavChange(parseInt(options.limit))}
          disabled={
            parseInt(options.skip) + parseInt(options.limit) >= users.total
          }
          ml={12}
          px={2}
        >
          <Icon name="chevronRight" size={15} />
        </NavButton>
      </Flex>
    </Th>
  );

  return (
    <Table mt={4} flex="">
      <thead>
        <Tr justifyContent="space-between">{Nav}</Tr>
        <Tr>
          <Th {...emailFlex}>Email</Th>
          <Th {...verifiedFlex}>Verified</Th>
          <Th {...actionsFlex}>
            <CreateNewUserButton reload={load} />
          </Th>
        </Tr>
      </thead>
      <tbody style={{ opacity: users.loading ? 0.4 : 1 }}>
        {!users.users.length ? (
          <Tr width={1} justifyContent="center">
            <Td flex="1 1 auto" justifyContent="center">
              <Text fontSize={18} light>
                {users.loading ? "Loading links..." : tableMessage}
              </Text>
            </Td>
          </Tr>
        ) : (
          <>
            {users.users.map(user => (
              <Row key={user.id} user={user} reload={load} />
            ))}
          </>
        )}
      </tbody>
      <tfoot>
        <Tr justifyContent="flex-end">{Nav}</Tr>
      </tfoot>
    </Table>
  );
};

interface RowProps {
  user: User;
  reload: () => void;
}

const Row: FC<RowProps> = ({ user, reload }) => {
  const { ban, remove } = useStoreActions(s => s.users);
  const { email } = useStoreState(s => s.auth);
  const [banModal, setBanModal] = useState(false);
  const [banLoading, setBanLoading] = useState(false);
  const [banMessage, setBanMessage] = useMessage();

  const [deleteModal, setDeleteModal] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteMessage, setDeleteMessage] = useMessage();

  const isMe = user.email === email;

  const onDelete = async () => {
    setDeleteLoading(true);
    try {
      await remove(user.id);
      setDeleteMessage("User deleted", "green");
      setTimeout(() => {
        setDeleteModal(false);
        reload();
      }, 2000);
    } catch (err) {
      setDeleteMessage(errorMessage(err));
    }
    setDeleteLoading(false);
  };

  const onBan = async () => {
    setBanLoading(true);
    try {
      const res = await ban(user.id);
      setBanMessage("User banned", "green");
      setTimeout(() => {
        setBanModal(false);
        reload();
      }, 2000);
    } catch (err) {
      setBanMessage(errorMessage(err));
    }
    setBanLoading(false);
  };

  return (
    <>
      <Tr key={user.id}>
        <Td {...emailFlex} withFade>
          {user.email}
        </Td>
        <Td {...verifiedFlex}>
          {user.verified ? (
            <Action
              as="span"
              data-tip
              data-for={`${user.id}-tooltip-verified`}
              name="check"
              stroke={Colors.CheckIcon}
              strokeWidth="2.5"
              backgroundColor="none"
            />
          ) : (
            <Action
              as="span"
              data-tip
              data-for={`${user.id}-tooltip-unverified`}
              name="x"
              stroke="#bbb"
              strokeWidth="2.5"
              backgroundColor="none"
            />
          )}
        </Td>
        <Td {...actionsFlex} justifyContent="flex-end">
          {user.banned && (
            <>
              <Tooltip id={`${user.id}-tooltip-banned`}>Banned</Tooltip>
              <Action
                as="span"
                data-tip
                data-for={`${user.id}-tooltip-banned`}
                name="stop"
                stroke="#bbb"
                strokeWidth="2.5"
                backgroundColor="none"
              />
            </>
          )}
          {!isMe && !user.banned && (
            <Action
              name="stop"
              strokeWidth="2"
              stroke={Colors.StopIcon}
              backgroundColor={Colors.StopIconBg}
              onClick={() => setBanModal(true)}
            />
          )}
          {!isMe && (
            <Action
              mr={0}
              name="trash"
              strokeWidth="2"
              stroke={Colors.TrashIcon}
              backgroundColor={Colors.TrashIconBg}
              onClick={() => setDeleteModal(true)}
            />
          )}
        </Td>
      </Tr>
      <Modal
        id="delete-user"
        show={deleteModal}
        closeHandler={() => setDeleteModal(false)}
      >
        {user && (
          <>
            <H2 mb={24} textAlign="center" bold>
              Delete User?
            </H2>
            <Text textAlign="center">
              Are you sure do you want to delete the user{" "}
              <Span bold>"{user.email}"</Span>?
            </Text>
            <Text textAlign="center">
              All Links created by this User will also be deleted
            </Text>
            <Flex justifyContent="center" mt={44}>
              {deleteLoading ? (
                <>
                  <Icon name="spinner" size={20} stroke={Colors.Spinner} />
                </>
              ) : deleteMessage.text ? (
                <Text fontSize={15} color={deleteMessage.color}>
                  {deleteMessage.text}
                </Text>
              ) : (
                <>
                  <Button
                    color="gray"
                    mr={3}
                    onClick={() => setDeleteModal(false)}
                  >
                    Cancel
                  </Button>
                  <Button color="red" ml={3} onClick={onDelete}>
                    <Icon name="trash" stroke="white" mr={2} />
                    Delete
                  </Button>
                </>
              )}
            </Flex>
          </>
        )}
      </Modal>
      <Modal
        id="ban-user"
        show={banModal}
        closeHandler={() => setBanModal(false)}
      >
        {user && (
          <>
            <H2 mb={24} textAlign="center" bold>
              Ban User?
            </H2>
            <Text textAlign="center">
              Are you sure do you want to ban the user{" "}
              <Span bold>"{user.email}"</Span>?
            </Text>
            <Flex justifyContent="center" mt={44}>
              {banLoading ? (
                <>
                  <Icon name="spinner" size={20} stroke={Colors.Spinner} />
                </>
              ) : banMessage.text ? (
                <Text fontSize={15} color={banMessage.color}>
                  {banMessage.text}
                </Text>
              ) : (
                <>
                  <Button
                    color="gray"
                    mr={3}
                    onClick={() => setBanModal(false)}
                  >
                    Cancel
                  </Button>
                  <Button color="red" ml={3} onClick={onBan}>
                    <Icon name="stop" stroke="white" mr={2} />
                    Ban
                  </Button>
                </>
              )}
            </Flex>
          </>
        )}
      </Modal>
    </>
  );
};

export default UsersTable;
