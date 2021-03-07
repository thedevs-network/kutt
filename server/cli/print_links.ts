import query from "../queries";

async function main() {
  const links = await query.link.get({}, { skip: 0, limit: 500 });
  for (const link of links) {
    console.log(
      `http://localhost:3000/${link.address} -> ${link.target} (${link.visit_count})`
    );
  }

  process.exit(0);
}

main();
