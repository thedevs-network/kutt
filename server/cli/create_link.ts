import query from "../queries";
import * as utils from "../utils";

async function main() {
  if (process.argv.length <= 2) {
    console.error("Usage: create_link <url>");
    console.log(process.argv);
    process.exit(1);
  }

  const target = process.argv[2];
  const address = await utils.generateId();

  const link = await query.link.create({
    address,
    target
  });

  console.log(link.address);

  process.exit(0);
}

main();
