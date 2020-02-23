import formatDistanceToNow from "date-fns/formatDistanceToNow";
import { CopyToClipboard } from "react-copy-to-clipboard";
import React, { FC, useState, useEffect } from "react";
import { useFormState } from "react-use-form-state";
import { Flex } from "reflexbox/styled-components";
import styled, { css } from "styled-components";
import { ifProp } from "styled-tools";
import QRCode from "qrcode.react";
import Link from "next/link";

import { removeProtocol, withComma, errorMessage } from "../utils";
import { useStoreActions, useStoreState } from "../store";
import { Link as LinkType } from "../store/links";
import { Checkbox, TextInput } from "./Input";
import { NavButton, Button } from "./Button";
import { Col, RowCenter } from "./Layout";
import Text, { H2, Span } from "./Text";
import { useMessage } from "../hooks";
import Animation from "./Animation";
import { Colors } from "../consts";
import Tooltip from "./Tooltip";
import Table from "./Table";
import ALink from "./ALink";
import Modal from "./Modal";
import Icon from "./Icon";

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
        background: linear-gradient(to left, white, white, transparent);
      }

      tr:hover &:after {
        background: linear-gradient(
          to left,
          ${Colors.TableRowHover},
          ${Colors.TableRowHover},
          transparent
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

const EditContent = styled(Col)`
  border-bottom: 1px solid ${Colors.TableHeadBorder};
  background-color: #fafafa;
`;

const Action = (props: React.ComponentProps<typeof Icon>) => (
  <Icon
    as="button"
    py={0}
    px={0}
    mr={2}
    size={[23, 24]}
    p={["4px", "5px"]}
    stroke="#666"
    {...props}
  />
);

const ogLinkFlex = { flexGrow: [1, 3, 7], flexShrink: [1, 3, 7] };
const createdFlex = { flexGrow: [1, 1, 3], flexShrink: [1, 1, 3] };
const shortLinkFlex = { flexGrow: [1, 1, 3], flexShrink: [1, 1, 3] };
const viewsFlex = {
  flexGrow: [0.5, 0.5, 1],
  flexShrink: [0.5, 0.5, 1],
  justifyContent: "flex-end"
};
const actionsFlex = { flexGrow: [1, 1, 2.5], flexShrink: [1, 1, 2.5] };

interface RowProps {
  index: number;
  link: LinkType;
  setDeleteModal: (number) => void;
}

interface BanForm {
  host: boolean;
  user: boolean;
  userLinks: boolean;
  domain: boolean;
}

interface EditForm {
  target: string;
  address: string;
}

const Row: FC<RowProps> = ({ index, link, setDeleteModal }) => {
  const isAdmin = useStoreState(s => s.auth.isAdmin);
  const ban = useStoreActions(s => s.links.ban);
  const edit = useStoreActions(s => s.links.edit);
  const [banFormState, { checkbox }] = useFormState<BanForm>();
  const [editFormState, { text, label }] = useFormState<EditForm>(
    {
      target: link.target,
      address: link.address
    },
    { withIds: true }
  );
  const [copied, setCopied] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [qrModal, setQRModal] = useState(false);
  const [banModal, setBanModal] = useState(false);
  const [banLoading, setBanLoading] = useState(false);
  const [banMessage, setBanMessage] = useMessage();
  const [editLoading, setEditLoading] = useState(false);
  const [editMessage, setEditMessage] = useMessage();

  const onCopy = () => {
    setCopied(true);
    setTimeout(() => {
      setCopied(false);
    }, 1500);
  };

  const onBan = async () => {
    setBanLoading(true);
    try {
      const res = await ban({ id: link.id, ...banFormState.values });
      setBanMessage(res.message, "green");
      setTimeout(() => {
        setBanModal(false);
      }, 2000);
    } catch (err) {
      setBanMessage(errorMessage(err));
    }
    setBanLoading(false);
  };

  const onEdit = async e => {
    e.preventDefault();
    if (editLoading) return;
    setEditLoading(true);
    try {
      await edit({ id: link.id, ...editFormState.values });
      setShowEdit(false);
    } catch (err) {
      setEditMessage(errorMessage(err));
    }
    setEditLoading(false);
  };

  const toggleEdit = () => {
    setShowEdit(s => !s);
    if (showEdit) editFormState.reset();
    setEditMessage("");
  };

  return (
    <>
      <Tr key={link.id}>
        <Td {...ogLinkFlex} withFade>
          <ALink href={link.target}>{link.target}</ALink>
        </Td>
        <Td {...createdFlex}>{`${formatDistanceToNow(
          new Date(link.created_at)
        )} ago`}</Td>
        <Td {...shortLinkFlex} withFade>
          {copied ? (
            <Animation
              minWidth={32}
              offset="10px"
              duration="0.2s"
              alignItems="center"
            >
              <Icon
                size={[23, 24]}
                py={0}
                px={0}
                mr={2}
                p="3px"
                name="check"
                strokeWidth="3"
                stroke={Colors.CheckIcon}
              />
            </Animation>
          ) : (
            <Animation minWidth={32} offset="-10px" duration="0.2s">
              <CopyToClipboard text={link.link} onCopy={onCopy}>
                <Action
                  name="copy"
                  strokeWidth="2.5"
                  stroke={Colors.CopyIcon}
                  backgroundColor={Colors.CopyIconBg}
                />
              </CopyToClipboard>
            </Animation>
          )}
          <ALink href={link.link}>{removeProtocol(link.link)}</ALink>
        </Td>
        <Td {...viewsFlex}>{withComma(link.visit_count)}</Td>
        <Td {...actionsFlex} justifyContent="flex-end">
          {link.password && (
            <>
              <Tooltip id={`${index}-tooltip-password`}>
                Password protected
              </Tooltip>
              <Action
                as="span"
                data-tip
                data-for={`${index}-tooltip-password`}
                name="key"
                stroke={"#bbb"}
                strokeWidth="2.5"
                backgroundColor="none"
              />
            </>
          )}
          {link.banned && (
            <>
              <Tooltip id={`${index}-tooltip-banned`}>Banned</Tooltip>
              <Action
                as="span"
                data-tip
                data-for={`${index}-tooltip-banned`}
                name="stop"
                stroke="#bbb"
                strokeWidth="2.5"
                backgroundColor="none"
              />
            </>
          )}
          {link.visit_count > 0 && (
            <Link href={`/stats?id=${link.id}`}>
              <ALink title="View stats" forButton>
                <Action
                  name="pieChart"
                  stroke={Colors.PieIcon}
                  strokeWidth="2.5"
                  backgroundColor={Colors.PieIconBg}
                />
              </ALink>
            </Link>
          )}
          <Action
            name="qrcode"
            stroke="none"
            fill={Colors.QrCodeIcon}
            backgroundColor={Colors.QrCodeIconBg}
            onClick={() => setQRModal(true)}
          />
          <Action
            name="editAlt"
            strokeWidth="2.5"
            stroke={Colors.EditIcon}
            backgroundColor={Colors.EditIconBg}
            onClick={toggleEdit}
          />
          {isAdmin && !link.banned && (
            <Action
              name="stop"
              strokeWidth="2"
              stroke={Colors.StopIcon}
              backgroundColor={Colors.StopIconBg}
              onClick={() => setBanModal(true)}
            />
          )}
          <Action
            mr={0}
            name="trash"
            strokeWidth="2"
            stroke={Colors.TrashIcon}
            backgroundColor={Colors.TrashIconBg}
            onClick={() => setDeleteModal(index)}
          />
        </Td>
      </Tr>
      {showEdit && (
        <EditContent key={link.id} px={[3, 3, 24]} py={[3, 3, 24]}>
          <Col as="form" alignItems="flex-start" onSubmit={onEdit}>
            <Flex alignItems="flex-start">
              <Col alignItems="flex-start" mr={[0, 3, 3]}>
                <Text
                  {...label("target")}
                  as="label"
                  mb={2}
                  fontSize={[14, 15]}
                  bold
                >
                  Target:
                </Text>
                <Flex as="form">
                  <TextInput
                    {...text("target")}
                    placeholder="Target..."
                    placeholderSize={[13, 14]}
                    fontSize={[14, 15]}
                    height={[40, 44]}
                    width={[1, 300, 420]}
                    pl={[3, 24]}
                    pr={[3, 24]}
                    required
                  />
                </Flex>
              </Col>
              <Col alignItems="flex-start">
                <Text
                  {...label("address")}
                  as="label"
                  mb={2}
                  fontSize={[14, 15]}
                  bold
                >
                  {link.domain || process.env.DEFAULT_DOMAIN}/
                </Text>
                <Flex as="form">
                  <TextInput
                    {...text("address")}
                    placeholder="Custom address..."
                    placeholderSize={[13, 14]}
                    fontSize={[14, 15]}
                    height={[40, 44]}
                    width={[1, 210, 240]}
                    pl={[3, 24]}
                    pr={[3, 24]}
                    required
                  />
                </Flex>
              </Col>
            </Flex>
            <Button
              color="blue"
              mt={3}
              height={[30, 38]}
              disabled={editLoading}
            >
              <Icon
                name={editLoading ? "spinner" : "refresh"}
                stroke="white"
                mr={2}
              />
              {editLoading ? "Updating..." : "Update"}
            </Button>
            {editMessage.text && (
              <Text mt={3} fontSize={15} color={editMessage.color}>
                {editMessage.text}
              </Text>
            )}
          </Col>
        </EditContent>
      )}
      <Modal
        key={link.id}
        id="table-qrcode-modal"
        minWidth="max-content"
        show={qrModal}
        closeHandler={() => setQRModal(false)}
      >
        <RowCenter width={192}>
          <QRCode size={192} value={link.link} />
        </RowCenter>
      </Modal>
      <Modal
        key={link.id}
        id="table-ban-modal"
        show={banModal}
        closeHandler={() => setBanModal(false)}
      >
        <>
          <H2 mb={24} textAlign="center" bold>
            Ban link?
          </H2>
          <Text mb={24} textAlign="center">
            Are you sure do you want to ban the link{" "}
            <Span bold>"{removeProtocol(link.link)}"</Span>?
          </Text>
          <RowCenter>
            <Checkbox {...checkbox("user")} label="User" mb={12} />
            <Checkbox {...checkbox("userLinks")} label="User links" mb={12} />
            <Checkbox {...checkbox("host")} label="Host" mb={12} />
            <Checkbox {...checkbox("domain")} label="Domain" mb={12} />
          </RowCenter>
          <Flex justifyContent="center" mt={4}>
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
                <Button color="gray" mr={3} onClick={() => setBanModal(false)}>
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
      </Modal>
    </>
  );
};

interface Form {
  all: boolean;
  limit: string;
  skip: string;
  search: string;
}

const LinksTable: FC = () => {
  const isAdmin = useStoreState(s => s.auth.isAdmin);
  const links = useStoreState(s => s.links);
  const { get, remove } = useStoreActions(s => s.links);
  const [tableMessage, setTableMessage] = useState("No links to show.");
  const [deleteModal, setDeleteModal] = useState(-1);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteMessage, setDeleteMessage] = useMessage();
  const [formState, { label, checkbox, text }] = useFormState<Form>(
    { skip: "0", limit: "10", all: false },
    { withIds: true }
  );

  const options = formState.values;
  const linkToDelete = links.items[deleteModal];

  useEffect(() => {
    get(options).catch(err =>
      setTableMessage(err?.response?.data?.error || "An error occurred.")
    );
  }, [options.limit, options.skip, options.all]);

  const onSubmit = e => {
    e.preventDefault();
    get(options);
  };

  const onDelete = async () => {
    setDeleteLoading(true);
    try {
      await remove(linkToDelete.id);
      await get(options);
      setDeleteModal(-1);
    } catch (err) {
      setDeleteMessage(errorMessage(err));
    }
    setDeleteLoading(false);
  };

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
            parseInt(options.skip) + parseInt(options.limit) > links.total
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
    <Col width={1200} maxWidth="95%" margin="40px 0 120px" my={6}>
      <H2 mb={3} light>
        Recent shortened links.
      </H2>
      <Table scrollWidth="800px">
        <thead>
          <Tr justifyContent="space-between">
            <Th flexGrow={1} flexShrink={1}>
              <Flex as="form" onSubmit={onSubmit}>
                <TextInput
                  {...text("search")}
                  placeholder="Search..."
                  height={[30, 32]}
                  placeholderSize={[13, 13, 13, 13]}
                  fontSize={[14]}
                  pl={12}
                  pr={12}
                  width={[1]}
                  br="3px"
                  bbw="2px"
                />

                {isAdmin && (
                  <Checkbox
                    {...label("all")}
                    {...checkbox("all")}
                    label="All links"
                    ml={3}
                    fontSize={[14, 15]}
                    width={[15, 16]}
                    height={[15, 16]}
                  />
                )}
              </Flex>
            </Th>
            {Nav}
          </Tr>
          <Tr>
            <Th {...ogLinkFlex}>Original URL</Th>
            <Th {...createdFlex}>Created</Th>
            <Th {...shortLinkFlex}>Short URL</Th>
            <Th {...viewsFlex}>Views</Th>
            <Th {...actionsFlex}></Th>
          </Tr>
        </thead>
        <tbody style={{ opacity: links.loading ? 0.4 : 1 }}>
          {!links.items.length ? (
            <Tr width={1} justifyContent="center">
              <Td flex="1 1 auto" justifyContent="center">
                <Text fontSize={18} light>
                  {links.loading ? "Loading links..." : tableMessage}
                </Text>
              </Td>
            </Tr>
          ) : (
            <>
              {links.items.map((link, index) => (
                <Row
                  setDeleteModal={setDeleteModal}
                  index={index}
                  link={link}
                />
              ))}
            </>
          )}
        </tbody>
        <tfoot>
          <Tr justifyContent="flex-end">{Nav}</Tr>
        </tfoot>
      </Table>
      <Modal
        id="delete-custom-domain"
        show={deleteModal > -1}
        closeHandler={() => setDeleteModal(-1)}
      >
        {linkToDelete && (
          <>
            <H2 mb={24} textAlign="center" bold>
              Delete link?
            </H2>
            <Text textAlign="center">
              Are you sure do you want to delete the link{" "}
              <Span bold>"{removeProtocol(linkToDelete.link)}"</Span>?
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
                    onClick={() => setDeleteModal(-1)}
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
    </Col>
  );
};

export default LinksTable;
