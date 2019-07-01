<p align="center"><a href="https://kutt.it" title="kutt.it"><img src="https://raw.githubusercontent.com/thedevs-network/kutt/9d1c873897c3f5b9a1bd0c74dc5d23f2ed01f2ec/static/images/logo-github.png" alt="Kutt.it"></a></p>

# Kutt.it

**Kutt** is a modern URL shortener with support for custom domains. Shorten URLs, manage your links and view the click rate statistics.

*Contributions and bug reports are welcome.*

[https://kutt.it](https://kutt.it)

[![Build Status](https://travis-ci.org/thedevs-network/kutt.svg?branch=develop)](https://travis-ci.org/thedevs-network/kutt)
[![Contributions](https://img.shields.io/badge/contributions-welcome-brightgreen.svg)](https://github.com/thedevs-network/kutt/#contributing)
[![GitHub license](https://img.shields.io/github/license/thedevs-network/kutt.svg)](https://github.com/thedevs-network/kutt/blob/develop/LICENSE)




## Table of Contents
* [Key Features](#key-features)
* [Stack](#stack)
* [Setup](#setup)
* [Browser Extensions](#browser-extensions)
* [API](#api)
* [Integrations](#integrations)
* [3rd Party API Packages](#3rd-party-api-packages)
* [Contributing](#contributing)

## Key Features
* Free and open source.
* Custom domain support.
* Custom URLs for shortened links
* Setting password for links.
* Private statistics for shortened URLs.
* View and manage your links.
* RESTful API.

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
You need to have [Node.js](https://nodejs.org/), [Neo4j](https://neo4j.com/) and [Redis](https://redis.io/) installed on your machine.

1. Clone this repository or [download zip](https://github.com/thedevs-network/kutt/archive/develop.zip).
2. Copy `.example.env` to `.env`  and fill it properly.
3. Install dependencies: `npm install`.
4. Start Neo4j database.
5. Run for development: `npm run dev`.
6. Run for production: `npm run build` then `npm start`.

**[Visit our wiki for a more complete setup and development guide.](https://github.com/thedevs-network/kutt/wiki/Setup-and-deployment)**

**Docker:** You can also use Docker to run the app. Read [docker-examples](/docker-examples) for more info.

## Browser Extensions
Download Kutt's extension for web browsers via below links. You can also find the source code on [kutt-extension](https://github.com/abhijithvijayan/kutt-extension).
* [Chrome](https://chrome.google.com/webstore/detail/kutt/pklakpjfiegjacoppcodencchehlfnpd)
* [Firefox](https://addons.mozilla.org/en-US/firefox/addon/kutt/)

## API
In addition to the website, you can use these APIs to create, delete and get URLs.

### Usage

In order to use these APIs you need to generate an API key from settings. Never publish this key in the client side of your app or anywhere that is exposed to others.

All API requests and responses are in JSON format.

Include the API key as `X-API-Key` in the header of all  requests.

Available API endpoints with body parameters:



**Get shortened URLs list:**
```
GET /api/url/geturls
```

Returns
```
{
  list:
   [
    {
      count {int},
      createdAt {string},
      id {string},
      target  {string<URL>},
      password {boolean},
      shortUrl {string<URL>}
    }
   ],
  countAll {int}
}
```
* `list` : Array of shorted URLs data 
* `count` : Total number of clicks
* `createdAt` :  ISO timestamp of when the URL was created.
* `id` : Unique ID of the URL
* `target` : Where the URL will redirect to
* `password` : Whether a password is required
* `count` : The number of visits to this URL
* `shortUrl` : The shortened link (Usually https://kutt.it/id)
* `countAll` : Total number of URLs shorted

**Submit a link to be shortened**:
```
POST /api/url/submit
```
Body
```
{
  target {string<URL>}  ,
  customurl {string },
  password {string},
  reuse {boolean}
}
```

  * `target` (mandatory) : Original long URL to be shortened.
  * `customurl` (optional) : Set a custom URL.
  * `password` (optional): Set a password.
  * `reuse` (optional) : If a URL with the specified target exists returns it, otherwise will send a new shortened URL.

Returns
```
{
  createdAt {string},
  id {string}, 
  target {string<URL>} ,
  password {boolean} ,
  count {number} ,
  shortUrl {string<URL>} 
}
```
* `createdAt` : ISO timestamp of when the URL was created.
* `id`  : Unique ID of the URL
* `target`  : Where the URL will redirect to
* `password` : Whether a password is required
* `count` : The number of visits to this URL
* `shortUrl` : The shortened link (Usually https://kutt.it/id)


**Delete a shortened URL** 
```
POST /api/url/deleteurl
```

Body
```
{
  id {string},
  domain {string<URL>}
}
```
  * `id`: ID of the shortened URL.
  * `domain` (optional):  Required if a custom domain is used for short URL.

Returns 
```
{
  message {string}
}
```
* `message` : Response message (Short URL deleted successfully )

**Get stats for a shortened URL**
```
GET /api/url/stats
```

Query
```
 id {string}
 domain {string<URL>}
```
* `id`: ID of the shortened URL.
* `domain` (optional):  Required if a custom domain is used for short URL.

Returns
```
{
  total {int},
  id {string},
  updatedAt {string},
  lastDay {stats,views[]},
  lastWeek {stats,views[]},
  lastMonth {stats,views[]},
  allTime {stats,views[]},
  shortUrl {string<URL>},
  target {string<URL>}
}
```
where status is like
```
 stats
  {
    browser[{name,value}],
    os[{name,value}],
    country[],
    referrer[]
  }
```
* `total` : total number of clicks 
* `id` : ID of the shortened URL
* `updatedAt` : ISO timestamp of when the URL was updated.
* `lastDay` : Analytics data for the last day  
* `lastWeek` : Analytics data for the last week
* `lastMonth` : Analytics data for the last month
* `allTime` : Analytics data since the short URL was created
* `browser` : Array of number of clicks in browsers where `name` referes to the browser's name and `value` refers to the number of times clicked in that browser
* `os` : Array of number of clicks in different operating systems where `name` referes to the Operating systems's name and `value` refers to the number of times clicked in that OS.
* `country` : Array of list of countries where the Short URL is clicked
* `referrer` : Array of list of referrers  where the Short URL is clicked

**Error Response**

On receiving any errors a message like this will be sent as response. 
```
{ error":"Couldn't find the short URL" }
```


## Integrations

### ShareX
You can use Kutt as your default URL shortener in [ShareX](https://getsharex.com/). If you host your custom instance of Kutt, refer to [ShareX wiki](https://github.com/thedevs-network/kutt/wiki/ShareX) on how to setup.

### Alfred Workflow
Download Kutt's official workflow for [Alfred](https://www.alfredapp.com/) app from [alfred-kutt](https://github.com/thedevs-network/alfred-kutt) repository.

## 3rd Party API packages
| Language  | Link                                                       | Description                                       |
|-----------|------------------------------------------------------------|---------------------------------------------------|
| C# (.NET) | [KuttSharp](https://github.com/0xaryan/KuttSharp)          | .NET package for Kutt.it url shortener            |
| Python    | [kutt-cli](https://github.com/univa64/kutt-cli)            | Command-line client for Kutt written in Python    |
| Ruby      | [kutt.rb](https://github.com/univa64/kutt.rb)              | Kutt library written in Ruby                      |
| Rust      | [kutt-rs](https://github.com/robatipoor/kutt-rs)           | Command line tool written in Rust                 |
| Node.js   | [node-kutt](https://github.com/ardalanamini/node-kutt)     | Node.js client for Kutt.it url shortener          |
| Bash      | [kutt-bash](https://git.nixnet.xyz/caltlgin/kutt-bash)     | Simple command line program for Kutt              |

## Contributing
Pull requests are welcome. You'll probably find lots of improvements to be made .

Open issues for feedback, requesting features, reporting bugs or discussing ideas.

Special thanks to [Thomas](https://github.com/trgwii) and [Muthu](https://github.com/MKRhere). Logo design by [Muthu](https://github.com/MKRhere).

## Share
  [![Tweet](https://img.shields.io/twitter/url/https/kutt.svg?style=social)](https://twitter.com/intent/tweet?text=Wow:%20This%20Open%20Source%20URL%20Shortner%20is%20%23awesome%20%23kutt%20&url=https%3A%2F%2Fgithub.com%2Fthedevs-network%2Fkutt%2F)


