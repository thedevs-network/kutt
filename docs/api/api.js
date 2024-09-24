
const p = require("../../package.json");

module.exports = {
  openapi: "3.0.0",
  info: {
    title: "Kutt.it",
    description: "API reference for [http://kutt.it](http://kutt.it).\n",
    version: p.version
  },
  servers: [
    {
      url: "https://kutt.it/api/v2"
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
        description: "Create a domain",
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
            description: "Created domain",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/Domain"
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
            type: "string"
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
          target: {
            type: "string"
          },
          address: {
            type: "string"
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
      APIKeyAuth: {
        type: "apiKey",
        name: "X-API-KEY",
        in: "header"
      }
    }
  }
};
