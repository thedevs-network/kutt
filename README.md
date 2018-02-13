<a href="https://kutt.it" title="kutt.it"><img src="https://camo.githubusercontent.com/073e709d02d3cf6ee5439ee6ce0bb0895f9f3733/687474703a2f2f6f6936372e74696e797069632e636f6d2f3636797a346f2e6a7067" alt="Kutt.it"></a>

# Kutt.it

**Kutt** is a modern URL shortener which lets you set custom domains for your shortened URLs, manage your links and view the click rate statistics.

*Contributions and bug reports are welcome.*

[https://kutt.it](https://kutt.it)

[![Build Status](https://travis-ci.org/thedevs-network/kutt.svg?branch=develop)](https://travis-ci.org/thedevs-network/kutt)
[![Contributions](https://img.shields.io/badge/contributions-welcome-brightgreen.svg)](https://github.com/thedevs-network/kutt/#contributing)
[![GitHub license](https://img.shields.io/github/license/thedevs-network/kutt.svg)](https://github.com/thedevs-network/kutt/blob/develop/LICENSE)
[![Twitter](https://img.shields.io/twitter/url/https/github.com/thedevs-network/kutt/.svg?style=social)](https://twitter.com/intent/tweet?text=Wow:&url=https%3A%2F%2Fgithub.com%2Fthedevs-network%2Fkutt%2F)

## Table of Contents
* [Key Features](#key-features)
* [Stack](#stack)
* [Setup](#setup)
* [API](#api)
* [Contributing](#contributing)

## Key Features
* Free and open source.
* Setting custom domain.
* Using custom URLs for shortened links
* Setting password for links.
* Private statistics for shortened URLs.
* View and manage your links.
* Provided API.

## Stack
* Node (Web server)
* Express (Web server framework)
* Passport (Authentication)
* React (UI library)
* Next (Universal/server-side rendered React)
* Redux (State management)
* styled-components (CSS styling solution library)
* Recharts (Chart library)
* Neo4j (Graph database)

## Setup
You need to have [Node.js](https://nodejs.org/) and [Neo4j](https://neo4j.com/) installed on your system.

1. Clone this repository or [download zip](https://github.com/thedevs-network/kutt/archive/master.zip).
2. Copy `config.example.js` to `config.js` in both server and client folders and fill them properly.
3. Install dependencies: `npm install`.
4. Start Neo4j database.
5. Run for development: `npm run dev`.
6. Run for production: `npm run build` then `npm start`.

## API
In additional to website, you can use these APIs to create, delete and get URLs.

In order to use these APIs you need to generate an API key from settings. Don not ever put this key in the client side of your app or anywhere that is exposed to others.

Include API key as `apikey` in the body of all below requests. Available API URLs with body parameters:

**Get shortened URLs list:**
```
POST /api/url/geturls
```

**Submit a links to be shortened**:
```
POST /api/url/submit
```
Body:
  * `target`: Original long URL to be shortened.

**Delete a shortened URL** and **Get stats for a shortened URL:**
```
POST /api/url/deleteurl
POST /api/url/stats
```
Body
  * `id`: ID of the shortened URL.
  * `domain` (optional):  Required if a custom domain is used for short URL.

## Contributing
Pull requests are welcome. You'll probably find lots of improvements to be made.

Open issues for feadback, needed features, reporting bugs or discussing ideas.

Special thanks to [Thomas](https://github.com/trgwii) and [Muthu](https://github.com/MKRhere). Logo design by [Muthu](https://github.com/MKRhere)
