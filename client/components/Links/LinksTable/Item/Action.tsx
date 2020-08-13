
import React from "react";

import Icon from "../../../Icon";

const Action = (props: React.ComponentProps<typeof Icon>) => {
  return (
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
};

export default Action