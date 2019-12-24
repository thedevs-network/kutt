import { Flex } from "reflexbox/styled-components";
import React, { FC, useState } from "react";
import styled from "styled-components";

import { useStoreState, useStoreActions } from "../../store";
import { useFormState } from "react-use-form-state";
import { Domain } from "../../store/settings";
import { useMessage } from "../../hooks";
import TextInput from "../TextInput";
import Table from "../CustomTable";
import Button from "../Button";
import Modal from "../Modal";
import Icon from "../Icon";
import Text from "../Text";

const Th = styled(Flex).attrs({ as: "th", py: 3, px: 3 })`
  font-size: 15px;
`;
const Td = styled(Flex).attrs({ as: "td", py: 12, px: 3 })`
  font-size: 15px;
`;

const SettingsDomain: FC = () => {
  const [modal, setModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [domainToDelete, setDomainToDelete] = useState<Domain>(null);
  const [message, setMessage] = useMessage(2000);
  const domains = useStoreState(s => s.settings.domains);
  const { saveDomain, deleteDomain } = useStoreActions(s => s.settings);
  const [formState, { text }] = useFormState<{
    customDomain: string;
    homepage: string;
  }>();

  const onSubmit = async e => {
    e.preventDefault();
    setLoading(true);

    try {
      await saveDomain(formState.values);
    } catch (err) {
      setMessage(err?.response?.data?.error || "Couldn't add domain.");
    }
    formState.clear();
    setLoading(false);
  };

  const closeModal = () => {
    setDomainToDelete(null);
    setModal(false);
  };

  const onDelete = async () => {
    setDeleteLoading(true);
    try {
      await deleteDomain();
      setMessage("Domain has been deleted successfully.", "green");
    } catch (err) {
      setMessage(err?.response?.data?.error || "Couldn't delete the domain.");
    }
    closeModal();
    setDeleteLoading(false);
  };

  return (
    <Flex alignItems="flex-start" flexDirection="column">
      <Text as="h2" fontWeight={700} mb={4}>
        Custom domain
      </Text>
      <Text as="p" mb={3}>
        You can set a custom domain for your short URLs, so instead of{" "}
        <b>kutt.it/shorturl</b> you can have <b>example.com/shorturl.</b>
      </Text>
      <Text mb={4}>
        Point your domain A record to <b>192.64.116.170</b> then add the domain
        via form below:
      </Text>
      {domains.length ? (
        <Table my={3}>
          <thead>
            <tr>
              <Th width={2 / 5}>Domain</Th>
              <Th width={2 / 5}>Homepage</Th>
              <Th width={1 / 5}></Th>
            </tr>
          </thead>
          <tbody>
            {domains.map(d => (
              <tr>
                <Td width={2 / 5}>{d.customDomain}</Td>
                <Td width={2 / 5}>{d.homepage || "default"}</Td>
                <Td width={1 / 5} justifyContent="center">
                  <Icon
                    as="button"
                    name="trash"
                    color="#f2392c"
                    py={0}
                    px="2px"
                    size={15}
                    onClick={() => {
                      setDomainToDelete(d);
                      setModal(true);
                    }}
                  />
                </Td>
              </tr>
            ))}
          </tbody>
        </Table>
      ) : (
        <Flex
          alignItems="flex-start"
          flexDirection="column"
          onSubmit={onSubmit}
          width={1}
          as="form"
          my={4}
        >
          <Flex width={1}>
            <Flex flexDirection="column" mr={2} flex="1 1 auto">
              <Text as="label" htmlFor="customdomain" fontWeight={700} mb={3}>
                Domain
              </Text>
              <TextInput
                {...text("customDomain")}
                placeholder="example.com"
                height={44}
                pl={24}
                pr={24}
                required
              />
            </Flex>
            <Flex flexDirection="column" ml={2} flex="1 1 auto">
              <Text as="label" htmlFor="customdomain" fontWeight={700} mb={3}>
                Homepage (optional)
              </Text>
              <TextInput
                {...text("homepage")}
                type="text"
                placeholder="Homepage URL"
                flex="1 1 auto"
                height={44}
                pl={24}
                pr={24}
              />
            </Flex>
          </Flex>
          <Button type="submit" color="purple" mt={3} disabled={loading}>
            <Icon name={loading ? "spinner" : "plus"} mr={2} color="white" />
            {loading ? "Setting..." : "Set domain"}
          </Button>
        </Flex>
      )}
      <Text color={message.color}>{message.text}</Text>
      <Modal id="delete-custom-domain" show={modal} closeHandler={closeModal}>
        <Text as="h2" fontWeight={700} mb={24} textAlign="center">
          Delete domain?
        </Text>
        <Text as="p" textAlign="center">
          Are you sure do you want to delete the domain{" "}
          <Text as="span" fontWeight={700}>
            "{domainToDelete && domainToDelete.customDomain}""
          </Text>
          ?
        </Text>
        {/* FIXME: user a proper loading */}
        <Flex justifyContent="center" mt={44}>
          {deleteLoading ? (
            <>
              <Icon name="spinner" size={20} />
            </>
          ) : (
            <>
              <Button color="gray" mr={3} onClick={closeModal}>
                Cancel
              </Button>
              <Button color="blue" ml={3} onClick={onDelete}>
                <Icon name="trash" color="white" mr={2} />
                Delete
              </Button>
            </>
          )}
        </Flex>
      </Modal>
    </Flex>
  );
};

export default SettingsDomain;
