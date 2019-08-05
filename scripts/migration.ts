// 1. Connect to Neo4j database
// 2. Connect to MongoDB database

// HOSTS
// 1. [NEO4J] Get all hosts
// 2. [MONGODB] Create Hosts

// USERS
// 1. [NEO4J] Get all user
// 2. [MONGODB] Upsert users
// 3. [MONGODB] Update bannedBy

// DOMAINS
// 1. [NEO4J] Get all domains as stream
// 2. [MONGODB] If domain has user, get user
// 3. [MONGODB] Upsert domain
// 4. [MONGODB] Update user

// LINKS
// 1. [NEO4J] Get all links as stream
// 2. [MONGODB] If link has user and domain, get them
// 3. [MONGODB] Upsert link
// 4. [MONGODB] Update user
// 5. [MONGODB] Update domain

// VISISTS
// 1. [NEO4J] For every link get visists as stream
// 2. [JAVaSCRIPT] Sum stats for each visist with the same date
// 3. [MONGODB] Create visits
// 4. [MONGODB] Update link