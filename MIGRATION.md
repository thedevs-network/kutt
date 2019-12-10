# Migrate database from Neo4j to Postgres

As explained in issue #197, Kutt is ditching Neo4j in favor of Postgres in version 2. But what happens to old data? Well, I have created migration scripts that you can use to transfer data from your Neo4j database to your new Postgres database.

### 🚧 IMPORTANT: v2 is still in beta (but somehow more stable than v1)

## General recommendations

- Importing Neo4j data into local Neo4j database and migrate from there would speed things up.
- Use local Postgres database (where app lives), because using a remote database server will be way slower. If you're doing this locally, you can import data from local database to the remote one after migration has finished. I used this command to move data:

## 1. Set up a Postgres database

Set up a Postgres database, either on your own server or using a SaaS service.

## 2. Pull and run Kutt's new version

Right now version 2 is in beta. Therefore, pull from `develop` branch and create and fill the `.env` file based on `.example.env`.

**NOTE**: Run the app at least once and let it create and initialize tables in the database. You just need to do `npm run dev` and wait for it to create tables. Then check your database to make sure tables have been created. (If your production database is separate, you need to initialize it too).

## 3. Migrate data using scripts

First, do `npm run build` to build the files. Now if you check `production-server/migration` folder you will fine 4 files. You can now run these scripts one by one.

**NOTE:** that the order of running the scripts is important.

**NOTE:** Step 4 is going to take a good chunk of time.

**NOTE:** If step 4 fails at any stage, you should delete links and visits data from the database and try again.

```
// 1. Migrate data: Hosts
node production-server/migration/01_hosts.js

// 2. Migrate data: Users
node production-server/migration/02_users.js

// 3. Migrate data: Domains
node production-server/migration/03_domains.js

// 4. Migrate data: Links
node production-server/migration/04_links.js
```
