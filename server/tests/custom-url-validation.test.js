const assert = require("node:assert");
const path = require("node:path");

process.env.DB_FILENAME = path.join(__dirname, "../../db/test-db");
process.env.JWT_SECRET = "test-secret-key";
process.env.DISALLOW_ANONYMOUS_LINKS = "false";

const utils = require("../utils");
const knex = require("../knex");
const query = require("../queries");

async function runTests() {
  console.log("=== 开始运行自定义短码验证测试 ===\n");

  await runMigrations();
  await testPreservedURLsCaseInsensitive();
  await testCaseInsensitiveConflictCheck();
  await testDifferentDomainsCanUseSameCode();
  await testEditLinkExcludeSelf();
  await cleanup();

  console.log("\n=== 所有测试通过！ ===");
  process.exit(0);
}

async function runMigrations() {
  console.log("1. 初始化测试数据库...");
  
  await knex.schema.dropTableIfExists("knex_migrations_lock");
  await knex.schema.dropTableIfExists("knex_migrations");
  await knex.schema.dropTableIfExists("visits");
  await knex.schema.dropTableIfExists("links");
  await knex.schema.dropTableIfExists("domains");
  await knex.schema.dropTableIfExists("users");
  await knex.schema.dropTableIfExists("hosts");
  await knex.schema.dropTableIfExists("ips");

  await knex.schema.createTable("users", (table) => {
    table.increments("id").primary();
    table.string("email").notNullable().unique();
    table.string("password").notNullable();
    table.boolean("banned").notNullable().defaultTo(false);
    table.boolean("verified").notNullable().defaultTo(false);
    table.integer("role").notNullable().defaultTo(1);
    table.string("apikey");
    table.timestamps(false, true);
  });

  await knex.schema.createTable("domains", (table) => {
    table.increments("id").primary();
    table.string("address").notNullable().unique();
    table.string("homepage");
    table.boolean("banned").notNullable().defaultTo(false);
    table.integer("banned_by_id").unsigned().references("id").inTable("users");
    table.integer("user_id").unsigned().references("id").inTable("users");
    table.uuid("uuid").notNullable().defaultTo(knex.fn.uuid());
    table.timestamps(false, true);
  });

  await knex.schema.createTable("links", (table) => {
    table.increments("id").primary();
    table.string("address").notNullable();
    table.string("description");
    table.boolean("banned").notNullable().defaultTo(false);
    table.integer("banned_by_id").unsigned().references("id").inTable("users");
    table.integer("domain_id").unsigned().references("id").inTable("domains");
    table.string("password");
    table.dateTime("expire_in");
    table.string("target", 2040).notNullable();
    table.integer("user_id").unsigned().references("id").inTable("users").onDelete("CASCADE");
    table.integer("visit_count").notNullable().defaultTo(0);
    table.uuid("uuid").notNullable().defaultTo(knex.fn.uuid());
    table.timestamps(false, true);
  });

  console.log("   ✓ 数据库表创建成功\n");
}

async function testPreservedURLsCaseInsensitive() {
  console.log("2. 测试系统路径大小写不敏感验证...");
  
  const testCases = [
    { input: "api", expected: true, description: "小写 api 应该被拒绝" },
    { input: "API", expected: true, description: "大写 API 应该被拒绝" },
    { input: "Api", expected: true, description: "混合大小写 Api 应该被拒绝" },
    { input: "aPi", expected: true, description: "混合大小写 aPi 应该被拒绝" },
    { input: "login", expected: true, description: "小写 login 应该被拒绝" },
    { input: "LOGIN", expected: true, description: "大写 LOGIN 应该被拒绝" },
    { input: "Login", expected: true, description: "混合大小写 Login 应该被拒绝" },
    { input: "settings", expected: true, description: "小写 settings 应该被拒绝" },
    { input: "SETTINGS", expected: true, description: "大写 SETTINGS 应该被拒绝" },
    { input: "Settings", expected: true, description: "混合大小写 Settings 应该被拒绝" },
    { input: "MyCustomCode", expected: false, description: "非保留路径应该允许" },
    { input: "test123", expected: false, description: "普通短码应该允许" },
  ];

  for (const testCase of testCases) {
    const isPreserved = utils.preservedURLs.some(
      url => url.toLowerCase() === testCase.input.toLowerCase()
    );
    assert.strictEqual(
      isPreserved,
      testCase.expected,
      `失败: ${testCase.description}`
    );
    console.log(`   ✓ ${testCase.description}`);
  }

  console.log("   ✓ 所有系统路径测试通过\n");
}

async function testCaseInsensitiveConflictCheck() {
  console.log("3. 测试大小写不敏感的冲突检查...");
  
  const testUser = await query.user.create({
    email: "test@example.com",
    password: "testpassword123"
  });

  await query.link.create({
    address: "MyTestCode",
    target: "https://example.com",
    user_id: testUser.id,
    domain_id: null
  });

  const conflictTests = [
    { address: "mytestcode", expectedConflict: true, description: "全小写应该检测到冲突" },
    { address: "MYTESTCODE", expectedConflict: true, description: "全大写应该检测到冲突" },
    { address: "MyTestCode", expectedConflict: true, description: "相同大小写应该检测到冲突" },
    { address: "mYtEsTcOdE", expectedConflict: true, description: "随机大小写应该检测到冲突" },
    { address: "DifferentCode", expectedConflict: false, description: "不同短码不应该冲突" },
    { address: "Another123", expectedConflict: false, description: "另一个短码不应该冲突" },
  ];

  for (const testCase of conflictTests) {
    const existingLink = await query.link.findByAddressCaseInsensitive(
      testCase.address,
      null
    );
    const hasConflict = !!existingLink;
    assert.strictEqual(
      hasConflict,
      testCase.expectedConflict,
      `失败: ${testCase.description} (address: ${testCase.address})`
    );
    console.log(`   ✓ ${testCase.description}`);
  }

  console.log("   ✓ 所有大小写冲突测试通过\n");
}

async function testDifferentDomainsCanUseSameCode() {
  console.log("4. 测试不同域名下可以使用相同短码...");
  
  const testUser = await query.user.find({ email: "test@example.com" });
  
  const domain1 = await query.domain.add({
    address: "custom1.example.com",
    user_id: testUser.id
  });
  
  const domain2 = await query.domain.add({
    address: "custom2.example.com",
    user_id: testUser.id
  });

  await query.link.create({
    address: "SharedCode",
    target: "https://example.com/1",
    user_id: testUser.id,
    domain_id: domain1.id
  });

  const conflictInDomain1 = await query.link.findByAddressCaseInsensitive(
    "sharedcode",
    domain1.id
  );
  assert.ok(conflictInDomain1, "在 domain1 中应该检测到冲突");
  console.log("   ✓ 在同一域名中检测到冲突");

  const conflictInDomain2 = await query.link.findByAddressCaseInsensitive(
    "sharedcode",
    domain2.id
  );
  assert.ok(!conflictInDomain2, "在 domain2 中不应该检测到冲突");
  console.log("   ✓ 在不同域名中没有冲突");

  const conflictInDefaultDomain = await query.link.findByAddressCaseInsensitive(
    "sharedcode",
    null
  );
  assert.ok(!conflictInDefaultDomain, "在默认域名中不应该检测到冲突");
  console.log("   ✓ 在默认域名中没有冲突");

  await query.link.create({
    address: "SHAREDCODE",
    target: "https://example.com/2",
    user_id: testUser.id,
    domain_id: domain2.id
  });
  console.log("   ✓ 成功在不同域名创建相同短码");

  const linkInDomain1 = await query.link.findByAddressCaseInsensitive(
    "SharedCode",
    domain1.id
  );
  const linkInDomain2 = await query.link.findByAddressCaseInsensitive(
    "sharedcode",
    domain2.id
  );
  
  assert.ok(linkInDomain1, "domain1 中的链接应该存在");
  assert.ok(linkInDomain2, "domain2 中的链接应该存在");
  assert.strictEqual(linkInDomain1.domain_id, domain1.id, "链接1 属于 domain1");
  assert.strictEqual(linkInDomain2.domain_id, domain2.id, "链接2 属于 domain2");
  console.log("   ✓ 两个链接分别属于不同的域名");

  console.log("   ✓ 所有域名隔离测试通过\n");
}

async function testEditLinkExcludeSelf() {
  console.log("5. 测试编辑链接时排除自身冲突...");
  
  const testUser = await query.user.find({ email: "test@example.com" });

  const originalLink = await query.link.create({
    address: "EditTest",
    target: "https://example.com/original",
    user_id: testUser.id,
    domain_id: null
  });

  const conflictWhenChangingCase = await query.link.findByAddressCaseInsensitive(
    "EDITTEST",
    null,
    originalLink.id
  );
  assert.ok(
    !conflictWhenChangingCase,
    "编辑时改变大小写不应该检测到自身冲突"
  );
  console.log("   ✓ 改变大小写时排除自身冲突");

  const otherLink = await query.link.create({
    address: "OtherLink",
    target: "https://example.com/other",
    user_id: testUser.id,
    domain_id: null
  });

  const conflictWithOther = await query.link.findByAddressCaseInsensitive(
    "otherlink",
    null,
    originalLink.id
  );
  assert.ok(
    conflictWithOther,
    "编辑时应该检测到与其他链接的冲突"
  );
  console.log("   ✓ 正确检测到与其他链接的冲突");

  const conflictWithOtherExcludingOther = await query.link.findByAddressCaseInsensitive(
    "otherlink",
    null,
    otherLink.id
  );
  assert.ok(
    !conflictWithOtherExcludingOther,
    "排除其他链接后不应该检测到冲突"
  );
  console.log("   ✓ 排除其他链接后没有冲突");

  console.log("   ✓ 所有编辑排除自身测试通过\n");
}

async function cleanup() {
  console.log("6. 清理测试数据...");
  
  await knex("links").del();
  await knex("domains").del();
  await knex("users").del();
  
  await knex.destroy();
  
  console.log("   ✓ 测试数据清理完成\n");
}

runTests().catch(async (error) => {
  console.error("\n❌ 测试失败:", error.message);
  console.error(error.stack);
  
  try {
    await knex.destroy();
  } catch (e) {
    // ignore cleanup errors
  }
  
  process.exit(1);
});
