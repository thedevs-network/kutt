
const p = require("../../package.json");
const campaignProperties = Object.fromEntries(require("../../static/scripts/campaign-url").fields.map(field => [field, {
  type: "string", nullable: true, maxLength: 255,
  description: "Optional campaign parameter, merged into target before saving. Requires an explicit HTTP(S) target even on PATCH. Empty string or null removes it; omission preserves it. Final URL is limited to 2040 characters."
}]));

module.exports = {
  openapi: "3.0.0",
  info: {
    title: "Kutt.to",
    description: "API reference for [http://kutt.to](http://kutt.to).\n",
    version: p.version
  },
  servers: [
    {
      url: "https://kutt.to/api/v2"
    }
  ],
  tags: [
    {
      name: "health"
    },
    {
      name: "links"
    },
    {
      name: "domains"
    },
    {
      name: "users"
    }
  ],
  paths: {
    "/domains/available": {
      get: {
        tags: ["domains"], summary: "List currently available owned or explicitly granted short domains",
        description: "No implicit global sharing. Session/legacy account or links:create token; token domain restriction applies. Management origin required when configured.",
        security: [{ SessionAuth: [] }, { APIKeyAuth: [] }],
        responses: { "200": { description: "data entries: id (domain UUID), address, owned (boolean)" }, "401": { description: "Authentication required" }, "403": { description: "Token scope denied" } }
      }
    },
    "/domains/{id}/grants": {
      parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
      get: {
        tags: ["domains"], summary: "List explicit per-user domain grants",
        description: "Domain owner or current administrator. Named tokens require domains:share and ownership, never administrator inheritance. No onward sharing by recipients.",
        security: [{ SessionAuth: [] }, { APIKeyAuth: [] }],
        responses: { "200": { description: "domain object and data entries: id (grant UUID), email, created_at (UTC ISO date)" }, "403": { description: "Token scope denied" }, "404": { description: "Domain unavailable" } }
      },
      post: {
        tags: ["domains"], summary: "Grant a verified account use of a short domain",
        description: "Owner/admin only; owner named tokens require domains:share. Session writes require matching Origin when supplied. Maximum 100 grants per domain and recipient. New links belong to their creator; no ownership or analytics access transfers.",
        security: [{ SessionAuth: [] }, { APIKeyAuth: [] }],
        requestBody: { required: true, content: { "application/json": { schema: { type: "object", additionalProperties: false, required: ["email"], properties: { email: { type: "string", format: "email", maxLength: 255 } } } } } },
        responses: { "201": { description: "Created grant: id, email, created_at" }, "400": { description: "Invalid or unavailable recipient" }, "403": { description: "Origin, domain or scope denied" }, "404": { description: "Domain unavailable" }, "409": { description: "Duplicate or grant limit" }, "429": { description: "Rate limited" } }
      }
    },
    "/domains/{id}/grants/{grantId}": {
      delete: {
        tags: ["domains"], summary: "Revoke a per-user domain grant",
        description: "Same owner/admin/domains:share boundary as grant creation. Atomically invalidates domain-scoped tokens and health schedules. Existing public redirects and independent bans remain unchanged; regrant does not reactivate tokens or schedules.",
        security: [{ SessionAuth: [] }, { APIKeyAuth: [] }],
        parameters: ["id", "grantId"].map(name => ({ name, in: "path", required: true, schema: { type: "string", format: "uuid" } })),
        responses: { "204": { description: "Revoked" }, "403": { description: "Origin or scope denied" }, "404": { description: "Domain/grant unavailable" }, "429": { description: "Rate limited" } }
      }
    },
    "/links/{id}/qr": {
      get: {
        tags: ["links"], summary: "Download an unbranded QR image",
        description: "Owner-only export of the public short URL, never the destination or password. Scoped tokens require links:read and an allowed domain. No visits are recorded. Existing GET behavior is unchanged; logos are accepted only by POST.",
        security: [{ SessionAuth: [] }, { APIKeyAuth: [] }],
        parameters: [
          { name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } },
          { name: "size", in: "query", schema: { type: "integer", minimum: 128, maximum: 1024, default: 512 } },
          { name: "level", in: "query", schema: { type: "string", enum: ["L", "M", "Q", "H"], default: "M" } },
          { name: "format", in: "query", schema: { type: "string", enum: ["png", "svg"], default: "png" } }
        ],
        responses: {
          "200": { description: "Private, no-store attachment", content: { "image/png": { schema: { type: "string", format: "binary" } }, "image/svg+xml": { schema: { type: "string", format: "binary" } } } },
          "400": { description: "Invalid options or insufficient size" }, "401": { description: "Authentication required" },
          "403": { description: "Token scope denied" }, "404": { description: "Link unavailable or not owned" }, "410": { description: "Restore link/domain first" }
        }
      },
      post: {
        tags: ["links"], summary: "Download a QR image with an optional ephemeral PNG logo",
        description: "Same owner/domain/links:read authorization as GET. Use JSON and session authentication or X-API-Key. Supplied foreign/null Origin and cross-site browser requests are denied, including token requests. No external URLs are fetched. Logo is never stored. Only the public short URL is encoded. A logo forces correction H and a center plate of at most 20% symbol width; finder patterns and the four-module quiet zone are untouched. Dense symbols require at least two pixels per module. Omit logo for a plain export; null/empty is invalid.",
        security: [{ SessionAuth: [] }, { APIKeyAuth: [] }],
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
        requestBody: { required: true, content: { "application/json": { schema: {
          type: "object", additionalProperties: false, properties: {
            size: { oneOf: [{ type: "integer", minimum: 128, maximum: 1024 }, { type: "string", pattern: "^[0-9]{3,4}$" }], default: 512 },
            level: { type: "string", enum: ["L", "M", "Q", "H"], default: "M", description: "Validated, then overridden to H when logo is present." },
            format: { type: "string", enum: ["png", "svg"], default: "png" },
            logo: { type: "string", maxLength: 87406, description: "Canonical plain PNG base64 (preferred, at most 87384 characters), without whitespace and with required padding. The exact legacy data:image/png;base64, prefix is also accepted; no other URI format is permitted. Both forms produce identical output. At most 65536 decoded bytes, dimensions 1..512 each, non-interlaced, non-animated PNG. Framing, CRC, IHDR and bounded exact inflation are checked before raster decoding. Metadata is stripped; embedded output is a newly encoded raster." }
          }
        } } } },
        responses: {
          "200": { description: "Private, no-store attachment; SVG permits only its embedded PNG data image", content: { "image/png": { schema: { type: "string", format: "binary" } }, "image/svg+xml": { schema: { type: "string", format: "binary" } } } },
          "400": { description: "Invalid PNG/options or insufficient image size" }, "401": { description: "Authentication required" },
          "403": { description: "Origin or scope denied" }, "404": { description: "Link unavailable or not owned" },
          "410": { description: "Restore link/domain first" }, "413": { description: "JSON body exceeds the existing 100 KiB limit" }, "429": { description: "Export rate limit exceeded" }
        }
      }
    },
    "/moderation": {
      get: {
        tags: ["users"], summary: "List active bans and private moderation audit (administrator only)",
        description: "Scoped tokens are not supported and cannot borrow an administrator cookie. Audit entries contain IDs/actions/times, never destinations or credentials. Audit is global; entity filters the banned entries only.",
        security: [{ SessionAuth: [] }, { APIKeyAuth: [] }],
        parameters: [
          { name: "entity", in: "query", schema: { type: "string", enum: ["user", "domain", "link", "host"], default: "user" } },
          { name: "page", in: "query", schema: { type: "integer", minimum: 1, maximum: 999999, default: 1 } }
        ],
        responses: {
          "200": { description: "At most 25 bans and 25 audit events", content: { "application/json": { schema: {
            type: "object", properties: {
              entity: { type: "string" }, page: { type: "integer" }, limit: { type: "integer", enum: [25] },
              total: { type: "integer" }, event_total: { type: "integer" },
              previous: { type: "integer", nullable: true }, next: { type: "integer", nullable: true },
              bans: { type: "array", items: { type: "object", properties: { id: { type: "string" }, entity: { type: "string" }, label: { type: "string" } } } },
              events: { type: "array", items: { type: "object", properties: {
                id: { type: "integer" }, actor_id: { type: "integer" }, entity: { type: "string" }, entity_id: { type: "string" },
                action: { type: "string", enum: ["ban", "unban", "delete"] }, created_at: { type: "string", format: "date-time" }
              } } }
            }
          } } } },
          "400": { description: "Invalid filter" }, "401": { description: "Not an authenticated administrator" }, "403": { description: "Scoped credential rejected" }
        }
      }
    },
    "/moderation/{entity}/{id}/unban": {
      post: {
        tags: ["users"], summary: "Remove one explicit ban (administrator only)",
        description: "Related bans remain. User credentials and sessions stay revoked after unban. JSON body must be empty. Same-origin enforcement applies to sessions. Legacy full administrator keys are supported, not scoped tokens.",
        security: [{ SessionAuth: [] }, { APIKeyAuth: [] }],
        parameters: [
          { name: "entity", in: "path", required: true, schema: { type: "string", enum: ["user", "domain", "link", "host"] } },
          { name: "id", in: "path", required: true, description: "Link UUID, otherwise positive numeric record ID", schema: { type: "string" } }
        ],
        requestBody: { content: { "application/json": { schema: { type: "object", additionalProperties: false } } } },
        responses: { "200": { description: "Ban removed or already absent; related bans unchanged" },
          "400": { description: "Invalid target or extra options" }, "401": { description: "Not an authenticated administrator" },
          "403": { description: "Invalid origin, scoped credential or stale administrator" }, "404": { description: "Target does not exist" } }
      }
    },
    ...Object.fromEntries(Object.entries({ users: ["links", "domains"], domains: ["links", "user"], links: ["host", "domain", "user", "userLinks"] }).map(([entity, flags]) => ["/" + entity + "/admin/ban/{id}", {
      post: {
        tags: [entity], summary: "Atomically ban " + entity + " with explicit related targets (administrator only)",
        description: "All selected mutations and audit records commit together or none do. A destination domain ban preserves ownership/homepage. Self-administrative bans and removal of the final active administrator are forbidden. User bans revoke credentials/sessions. No cascading restoration is supported.",
        security: [{ SessionAuth: [] }, { APIKeyAuth: [] }],
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" }, description: entity === "links" ? "Link UUID" : "Positive numeric record ID" }],
        requestBody: { content: { "application/json": { schema: {
          type: "object", additionalProperties: false, properties: Object.fromEntries(flags.map(flag => [flag, { type: "boolean", default: false }]))
        } } } },
        responses: { "200": { description: "Committed or already applied" }, "400": { description: "Invalid flags, target or DNS failure" },
          "401": { description: "Not an authenticated administrator" }, "403": { description: "Invalid origin, scoped credential or stale administrator" },
          "404": { description: "Target does not exist" }, "409": { description: "Protected administrator or destination changed; no writes committed" } }
      }
    }])),
    "/health": {
      get: {
        tags: ["health"],
        summary: "API health",
        responses: {
          "200": {
            description: "Health",
            content: {
              "text/html": {
                example: "OK"
              }
            }
          }
        }
      }
    },
    "/links": {
      get: {
        tags: ["links"],
        description: "Get list of links",
        parameters: [
          {
            name: "sort", in: "query", required: false,
            description: "Stable list order. Ties use internal insertion order descending; owner and token scope are unchanged.",
            schema: { type: "string", enum: ["id", "created_at", "address", "target", "visit_count"], default: "id" }
          },
          {
            name: "direction", in: "query", required: false,
            description: "Direction of the selected sort field. Unknown, empty or structured sort input returns 400.",
            schema: { type: "string", enum: ["asc", "desc"], default: "desc" }
          },
          {
            name: "limit",
            in: "query",
            description: "Limit",
            required: false,
            style: "form",
            explode: true,
            schema: {
              type: "number",
              example: 10
            }
          },
          {
            name: "skip",
            in: "query",
            description: "Skip",
            required: false,
            style: "form",
            explode: true,
            schema: {
              type: "number",
              example: 0
            }
          },
          {
            name: "all",
            in: "query",
            description: "All links (ADMIN only)",
            required: false,
            style: "form",
            explode: true,
            schema: {
              type: "boolean",
              example: false
            }
          }
        ],
        responses: {
          "200": {
            description: "List of links",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/inline_response_200"
                }
              }
            }
          }
        },
        security: [
          {
            APIKeyAuth: []
          }
        ]
      },
      post: {
        tags: ["links"],
        description: "Create a short link",
        requestBody: {
          content: {
            "application/json": {
              schema: {
                $ref: "#/components/schemas/body"
              }
            }
          }
        },
        responses: {
          "200": {
            description: "Created link",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/Link"
                }
              }
            }
          }
        },
        security: [
          {
            APIKeyAuth: []
          }
        ]
      }
    },
    "/links/{id}": {
      delete: {
        tags: ["links"],
        description: "Delete a link",
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            style: "simple",
            explode: false,
            schema: {
              type: "string",
              format: "uuid"
            }
          }
        ],
        responses: {
          "200": {
            description: "Deleted link successfully",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/inline_response_200_1"
                }
              }
            }
          }
        },
        security: [
          {
            APIKeyAuth: []
          }
        ]
      },
      patch: {
        tags: ["links"],
        description: "Update a link",
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            style: "simple",
            explode: false,
            schema: {
              type: "string",
              format: "uuid"
            }
          }
        ],
        requestBody: {
          content: {
            "application/json": {
              schema: {
                $ref: "#/components/schemas/body_1"
              }
            }
          }
        },
        responses: {
          "200": {
            description: "Updated link successfully",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/Link"
                }
              }
            }
          }
        },
        security: [
          {
            APIKeyAuth: []
          }
        ]
      }
    },
    "/links/{id}/stats": {
      get: {
        tags: ["links"],
        description: "Get link stats",
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            style: "simple",
            explode: false,
            schema: {
              type: "string",
              format: "uuid"
            }
          }
        ],
        responses: {
          "200": {
            description: "Link stats",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/Stats"
                }
              }
            }
          }
        },
        security: [
          {
            APIKeyAuth: []
          }
        ]
      }
    },
    "/domains": {
      post: {
        tags: ["domains"],
        description: "Claim a domain after DNS TXT ownership proof. Existing domains are unchanged. First submit address/homepage, publish the TXT challenge returned with 409, then repeat with its opaque proof. Challenges expire after 30 minutes and are bound to account, hostname and authentication generation.",
        requestBody: {
          content: {
            "application/json": {
              schema: {
                $ref: "#/components/schemas/body_2"
              }
            }
          }
        },
        responses: {
          "200": {
            description: "Verified and claimed domain",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/Domain"
                }
              }
            }
          },
          "409": {
            description: "Ownership proof required, expired, unavailable in DNS, or a competing ownership/ban conflict. When verification is present, publish its TXT record and retry with proof.",
            content: { "application/json": { schema: {
              type: "object", required: ["error"], properties: {
                error: { type: "string" },
                verification: { type: "object", required: ["record_name", "record_value", "proof", "expires_at"], properties: {
                  record_name: { type: "string" }, record_value: { type: "string" },
                  proof: { type: "string" }, expires_at: { type: "string", format: "date-time" }
                } }
              }
            } } }
          },
          "429": { description: "Domain claim request rate exceeded. Retry later." }
        },
        security: [
          {
            APIKeyAuth: []
          }
        ]
      }
    },
    "/domains/{id}": {
      delete: {
        tags: ["domains"],
        description: "Delete a domain",
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            style: "simple",
            explode: false,
            schema: {
              type: "string",
              format: "uuid"
            }
          }
        ],
        responses: {
          "200": {
            description: "Deleted domain successfully",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/inline_response_200_1"
                }
              }
            }
          }
        },
        security: [
          {
            APIKeyAuth: []
          }
        ]
      }
    },
    "/users": {
      get: {
        tags: ["users"],
        description: "Get user info",
        responses: {
          "200": {
            description: "User info",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/User"
                }
              }
            }
          }
        },
        security: [
          {
            APIKeyAuth: []
          }
        ]
      }
    }
  },
  components: {
    schemas: {
      Link: {
        type: "object",
        properties: {
          address: {
            type: "string"
          },
          banned: {
            type: "boolean",
            default: false
          },
          created_at: {
            type: "string",
            format: "date-time"
          },
          id: {
            type: "string",
            format: "uuid"
          },
          link: {
            type: "string"
          },
          password: {
            type: "boolean",
            default: false
          },
          target: {
            type: "string"
          },
          description: {
            type: "string"
          },
          updated_at: {
            type: "string",
            format: "date-time"
          },
          visit_count: {
            type: "number"
          }
        }
      },
      Domain: {
        type: "object",
        properties: {
          address: {
            type: "string"
          },
          banned: {
            type: "boolean",
            default: false
          },
          created_at: {
            type: "string",
            format: "date-time"
          },
          id: {
            type: "string",
            format: "uuid"
          },
          homepage: {
            type: "string"
          },
          updated_at: {
            type: "string",
            format: "date-time"
          }
        }
      },
      User: {
        type: "object",
        properties: {
          apikey: {
            type: "string"
          },
          email: {
            type: "string"
          },
          domains: {
            type: "array",
            items: {
              $ref: "#/components/schemas/Domain"
            }
          }
        }
      },
      StatsItem: {
        type: "object",
        properties: {
          stats: {
            $ref: "#/components/schemas/StatsItem_stats"
          },
          views: {
            type: "array",
            items: {
              type: "number"
            }
          }
        }
      },
      Stats: {
        type: "object",
        properties: {
          lastDay: {
            $ref: "#/components/schemas/StatsItem"
          },
          lastMonth: {
            $ref: "#/components/schemas/StatsItem"
          },
          lastWeek: {
            $ref: "#/components/schemas/StatsItem"
          },
          lastYear: {
            $ref: "#/components/schemas/StatsItem"
          },
          updatedAt: {
            type: "string"
          },
          address: {
            type: "string"
          },
          banned: {
            type: "boolean",
            default: false
          },
          created_at: {
            type: "string",
            format: "date-time"
          },
          id: {
            type: "string",
            format: "uuid"
          },
          link: {
            type: "string"
          },
          password: {
            type: "boolean",
            default: false
          },
          target: {
            type: "string"
          },
          updated_at: {
            type: "string",
            format: "date-time"
          },
          visit_count: {
            type: "number"
          }
        }
      },
      inline_response_200: {
        properties: {
          limit: {
            type: "number",
            default: 10
          },
          skip: {
            type: "number",
            default: 0
          },
          total: {
            type: "number",
            default: 0
          },
          data: {
            type: "array",
            items: {
              $ref: "#/components/schemas/Link"
            }
          }
        }
      },
      body: {
        required: ["target"],
        properties: {
          ...campaignProperties,
          target: {
            type: "string"
          },
          description: {
            type: "string"
          },
          expire_in: {
            type: "string",
            example: "2 minutes/hours/days"
          },
          password: {
            type: "string"
          },
          customurl: {
            type: "string",
            maxLength: 64,
            example: "docs/v1.2/guide.pdf",
            description: "Alias text is preserved without case folding; existing database collation and collision semantics apply. Up to 8 nonempty slash-separated segments and 64 characters total. Dotted/nested segments use ASCII letters, digits, underscore and hyphen with single interior dots. Leading/trailing/consecutive dots, encoding, traversal and reserved management/static roots are rejected. Legacy dot-free single-segment custom-alphabet aliases remain supported."
          },
          reuse: {
            type: "boolean",
            default: false
          },
          domain: {
            type: "string"
          }
        }
      },
      inline_response_200_1: {
        properties: {
          message: {
            type: "string"
          }
        }
      },
      body_1: {
        required: ["target", "address"],
        properties: {
          ...campaignProperties,
          target: {
            type: "string"
          },
          address: {
            type: "string",
            maxLength: 64,
            example: "docs/v1.2/guide.pdf",
            description: "Replacement alias; follows the same segment, interior-dot, length, collation and reserved-path rules as customurl on creation. Renamed aliases remain permanently reserved."
          },
          description: {
            type: "string"
          },
          expire_in: {
            type: "string",
            example: "2 minutes/hours/days"
          }
        }
      },
      body_2: {
        required: ["address"],
        properties: {
          address: {
            type: "string"
          },
          homepage: {
            type: "string"
          },
          proof: {
            type: "string",
            description: "Opaque unexpired DNS ownership challenge returned by the server. Submit only after publishing its TXT value."
          }
        }
      },
      StatsItem_stats_browser: {
        type: "object",
        properties: {
          name: {
            type: "string"
          },
          value: {
            type: "number"
          }
        }
      },
      StatsItem_stats: {
        type: "object",
        properties: {
          browser: {
            type: "array",
            items: {
              $ref: "#/components/schemas/StatsItem_stats_browser"
            }
          },
          os: {
            type: "array",
            items: {
              $ref: "#/components/schemas/StatsItem_stats_browser"
            }
          },
          country: {
            type: "array",
            items: {
              $ref: "#/components/schemas/StatsItem_stats_browser"
            }
          },
          referrer: {
            type: "array",
            items: {
              $ref: "#/components/schemas/StatsItem_stats_browser"
            }
          }
        }
      }
    },
    securitySchemes: {
      SessionAuth: { type: "apiKey", in: "cookie", name: "token", description: "Authenticated browser session; mutations enforce same-origin checks" },
      APIKeyAuth: {
        type: "apiKey",
        name: "X-API-KEY",
        in: "header"
      }
    }
  }
};
