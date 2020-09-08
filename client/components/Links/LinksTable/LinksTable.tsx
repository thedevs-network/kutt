
import Header from './Header'
import React, { useState } from "react";

import { useMessage } from "../../../hooks";
import { errorMessage } from "../../../utils";
import { useStoreActions, useStoreState } from "../../../store";
import Text from "../../Text";
import Item from "./Item/Item"

import DeleteModal from "../Modal/DeleteModal";
import {Tr, Td} from "../../Table";

type Props = {
  tableMessage: String,
  onRemove: () => void
}

const LinksTable = ({
  tableMessage,
  onRemove
}: Props) => {
  const [deleteModal, setDeleteModal] = useState(-1);
  const links = useStoreState(s => s.links);
  const linkToDelete = links.items[deleteModal];
  const [deleteMessage, setDeleteMessage] = useMessage();
  const [deleteLoading, setDeleteLoading] = useState(false);
  const { remove } = useStoreActions(s => s.links);
  const onDelete = async () => {
    setDeleteLoading(true);
    try {
      await remove(linkToDelete.id);
      await onRemove();
      setDeleteModal(-1);
    } catch (err) {
      setDeleteMessage(errorMessage(err));
    }
    setDeleteLoading(false);
  };
    return(
      <>
      <thead>
        <Header/>
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
              <Item
                setDeleteModal={setDeleteModal}
                index={index}
                link={link}
                key={link.id}
              />
            ))}
          </>
        )}
    </tbody>
      <DeleteModal 
        link={linkToDelete} 
        showModal={deleteModal} 
        closeModal={setDeleteModal} 
        loading={deleteLoading} 
        message={deleteMessage} 
        onDelete={onDelete}
        />
    </>
    )
}
export default LinksTable;