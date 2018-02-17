# Running Kutt in Docker

Assumptions:
The domain in this example is `kutt.local`. This needs to be configured in your hosts file for this example to work _as written_. You should, of course, modify this domain to suit your needs. 

### Configure Kutt

server/config.js
```
module.exports = {

	PORT: process.env.KUTT_PORT, # Or whatever you want to name the env var
    
    /* The domain that this website is on */
    DEFAULT_DOMAIN: process.env.KUTT_DOMAIN, # Or whatever..
    
    ...
    
}
```

### Neo4j in a container

You can run neo4j in a container and link it to the kutt container in Docker. 

Properly installing and running neo4j is outside of the scope of this document. But here's a simple one-liner to get neo4j running on docker for dev/test:

```
docker run \
    --publish=7474:7474 --publish=7687:7687 \
    --name neo4j \
    neo4j
```
**This is not a production-ready setup. There is no data persistence, nor proper security. Use for test/dev only.**

Then, configure Kutt:
server/config.js
```
...
/* Neo4j database credential details */
DB_URI: 'bolt://neo4j',
DB_USERNAME: 'neo4j', # Or pass this in via env var as before 
DB_PASSWORD: 'neo4j', # Or via env var..
...
```

Once you have neo4j running in a container, you'll link your Kutt container to it. This will be documented below.

### Build Kutt Image

First you'll need to build Kutt.
From the root directory of Kutt, execute the following:
`docker build -t kutt .`

### Run Kutt

Once you've built the image, then all that is left to do is run Kutt.

`docker run -d -p80:3000 -e KUTT_PORT=3000 -e KUTT_DOMAIN=kutt.local --link=neo4j kutt`

Direct your browser to http://kutt.local/ and begin kutting URLs!
