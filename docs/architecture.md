# System architecture diagram

The major components of the solution and how they interact. Arrows point from caller to callee.

```mermaid
flowchart LR
  User(["User"])

  Browser["<b>Web app</b><br/>React single-page app<br/>map, legend, attribute table,<br/>symbology editor,<br/>saved-configurations menu"]

  API["<b>REST API</b><br/>Hono on Node<br/>sign-in sessions,<br/>configuration rules,<br/>OpenAPI docs"]

  DB[("<b>SQLite</b><br/>users and sessions<br/>configurations:<br/>default, private, shared")]

  ArcGIS[("<b>ArcGIS Online</b><br/>third-party service<br/>Landscape Trees<br/>feature service")]

  User -- "configures the map and table,<br/>saves, opens and shares configurations" --> Browser
  Browser -- "reads the tree points<br/>(HTTPS, ArcGIS REST)" --> ArcGIS
  Browser -- "on start: fetch the default configuration<br/>(HTTPS JSON, no sign-in)" --> API
  Browser -- "sign in; list, save, publish<br/>and unpublish configurations<br/>(HTTPS JSON, session cookie)" --> API
  API -- "stores and queries users, sessions<br/>and configurations (SQL)" --> DB

  classDef ours fill:#dbe7ff,stroke:#3b6fd4,color:#111;
  classDef external fill:#b0b4ba,stroke:#444,stroke-width:2px,stroke-dasharray:5 4,color:#111;
  classDef actor fill:#fff3c4,stroke:#b8941f,color:#111;
  class Browser,API,DB ours;
  class ArcGIS external;
  class User actor;
```

Blue: built and run by this project. Dark grey with a dashed border: third-party service. Yellow: a person.

Notes:

- The default configuration is a predefined row in the database, created by the seed script (`pnpm run db:seed`) together with the demo users.
- The web app and the API share one configuration schema (`src/configSchema.ts`, zod). The web app imports only its types; the API uses it to validate requests and to generate the API documentation at `/api/docs`.
- The browser never talks to the database, and the API never talks to ArcGIS Online, so server-side validation checks the shape of a configuration but not whether its fields exist on the layer.
