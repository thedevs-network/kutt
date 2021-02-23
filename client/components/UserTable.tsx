import styled, { css } from "styled-components";
import { Flex } from "reflexbox/styled-components";
import { ifProp } from "styled-tools";
import { Colors } from "../consts";
import { useStoreActions, useStoreState } from "../store";
import React, { FC, useEffect, useState } from "react";
import Table from "./Table";
import Text from "./Text";
import LinksTable from "./LinksTable";
import Icon from "./Icon";
import Tooltip from "./Tooltip";
import { NavButton } from "./Button";
import { useFormState } from "react-use-form-state";
import { User } from "../store/users";
import { useMessage } from "../hooks";

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

const actionsFlex = { flexGrow: [1, 1, 3], flexShrink: [1, 1, 3] };

const emailFlex = { flexGrow: [1, 3, 7], flexShrink: [1, 3, 7] };

interface Form {
  all: boolean;
  limit: string;
  skip: string;
  search: string;
}

const UsersTable = () => {
  const users = useStoreState(s => s.users);
  const { get } = useStoreActions(s => s.users);
  const [formState, { label, checkbox, text }] = useFormState<Form>(
    { skip: "0", limit: "10", all: false },
    { withIds: true }
  );

  const options = formState.values;

  useEffect(() => {
    get(options).catch(err => console.log("Error occured"));
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
            parseInt(options.skip) + parseInt(options.limit) > users.total
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
    <Table mt={4}>
      <thead>
        <Tr justifyContent="space-between">
          <Th flexGrow={1} flexShrink={1}>
            <Flex as="form">
              {/*<TextInput*/}
              {/*    {...text("search")}*/}
              {/*    placeholder="Search..."*/}
              {/*    height={[30, 32]}*/}
              {/*    placeholderSize={[13, 13, 13, 13]}*/}
              {/*    fontSize={[14]}*/}
              {/*    pl={12}*/}
              {/*    pr={12}*/}
              {/*    width={[1]}*/}
              {/*    br="3px"*/}
              {/*    bbw="2px"*/}
              {/*/>*/}
            </Flex>
          </Th>
          {Nav}
        </Tr>
        <Tr>
          <Th {...emailFlex}>Email</Th>
          <Th {...actionsFlex}></Th>
        </Tr>
      </thead>
      <tbody style={{ opacity: users.loading ? 0.4 : 1 }}>
        {!users.users.length ? (
          <Tr width={1} justifyContent="center">
            <Td flex="1 1 auto" justifyContent="center">
              <Text fontSize={18} light>
                {users.loading ? "Loading links..." : null}
              </Text>
            </Td>
          </Tr>
        ) : (
          <>
            {users.users.map(user => (
              <Row user={user} />
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
}

const Row: FC<RowProps> = ({ user }) => {
  const { ban, remove } = useStoreActions(s => s.users);
  const [banModal, setBanModal] = useState(false);
  const [banLoading, setBanLoading] = useState(false);
  const [banMessage, setBanMessage] = useMessage();

  const [deleteModal, setDeleteModal] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteMessage, setDeleteMessage] = useMessage();

  return (
    <Tr key={user.id}>
      <Td {...emailFlex} withFade>
        {user.email}
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
        {!user.banned && (
          <Action
            name="stop"
            strokeWidth="2"
            stroke={Colors.StopIcon}
            backgroundColor={Colors.StopIconBg}
            onClick={() => {
              ban(user.id);
            }}
          />
        )}
        <Action
          mr={0}
          name="trash"
          strokeWidth="2"
          stroke={Colors.TrashIcon}
          backgroundColor={Colors.TrashIconBg}
          onClick={() => {
            remove(user.id);
          }}
        />
      </Td>
    </Tr>
  );
};

export default UsersTable;
