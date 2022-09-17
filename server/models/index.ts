import env from "../env";

export * from "./domain";
export * from "./host";
export * from "./ip";
export * from "./link";
export * from "./user";
export * from "./visit";

export class TableName {
  private static prefix = env.DB_PREFIX_TABLE;
  public static setPrefix(prefix: string) {
    TableName.prefix = prefix;
  }

  public static get domain() {
    return TableName.prefix + "domains";
  }

  public static get host() {
    return TableName.prefix + "hosts";
  }

  public static get ip() {
    return TableName.prefix + "ips";
  }

  public static get link() {
    return TableName.prefix + "links";
  }

  public static get user() {
    return TableName.prefix + "users";
  }

  public static get visit() {
    return TableName.prefix + "visits";
  }
}
