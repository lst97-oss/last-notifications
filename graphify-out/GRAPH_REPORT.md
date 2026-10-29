# Graph Report - last-notifications  (2026-10-30)

## Corpus Check
- 354 files · ~115,731 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 13 file(s) not represented in the graph (top: (none) 6, .css 4, .example 1)

## Summary
- 2023 nodes · 5417 edges · 112 communities (93 shown, 19 thin omitted)
- Extraction: 98% EXTRACTED · 2% INFERRED · 0% AMBIGUOUS · INFERRED: 97 edges (avg confidence: 0.87)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- Notification Repository and Inbox
- API Key Dialogs
- Payload CMS Setup
- Channel Plugins
- App Repository and Host Tests
- Error Handling and Validation
- Dashboard App Detail Page
- Package Dependencies
- Channel Delivery Worker
- Channel Plugin Config
- Agent Rules and Design Guidance
- Dashboard Stats Panels
- Admin App Management
- Deliveries Dashboard Page
- Request Context and CORS
- Notification Handlers
- Docs Site Routing
- Response Schemas
- Package Build Dependencies
- Vite Build Plugins
- Dropdown and Menubar UI
- Health Probes
- Combobox and Input Groups
- API Key Repository
- Route Registry and Envelope
- API Keys Dashboard Page
- Tabs and Toggle UI
- Stream Bus and Streaming
- Biome Config
- Package Scripts
- Admin Sidebar UI
- Route Guards and Deliveries
- API Key Scope Picker
- Sidebar Components
- Components Config
- Button Group UI
- Outbound Webhook Safety
- Business Schema Modules
- Notification Schemas
- TypeScript Config
- Dev Dependencies
- Toast and Root Shell
- Router and Site Errors
- Dashboard Shell and Auth Client
- Context Menu UI
- Stats Queries
- Channel Plugin Docs
- API Reference Routes
- Business Auth
- Syntax Highlighter
- API Key Rows
- Drawer UI
- Email Channel Docs
- Admin Schemas
- Changelog Notes
- Collapsible Trace UI
- CI and Deployment Docs
- Security and Tenancy Docs
- Async Channels and Outbox Docs
- Business API Docs
- Chart UI
- Attachment UI
- Sheet UI
- Business Auth Config
- Publishing Docs
- Code Block UI
- Recipient Handlers
- Logger
- Boot Contract Docs
- Quickstart Docs
- Realtime and Inbox Docs
- Realtime Endpoint Docs
- Self-hosting Docs
- Payload Shutdown
- Navigation Menu UI
- Dashboard Apps Page
- Channel Plugin Contract Docs
- Leaderboard UI
- Business Auth Routes and CORS
- Publish Use Case
- Compose Stack Docs
- Radio and Switch UI
- Realtime Architecture Docs
- Webhook Channel Docs
- Bubble UI
- Registered Origins
- Payload Build Externals
- Filename Sanitizer
- Error Envelope Docs
- Vite Type Declarations
- Payload Admin CSS Generator
- Smoke Test Script
- Masking Helpers
- Unsubscribe Page
- OpenAPI Tests
- Favicon Design
- Admin Schema Validation
- Start Script
- Scroll Area UI
- Vendored Payload Workaround
- Robots.txt
- Bootstrap Databases Script
- Business Area Recipe
- Health Reference Slice

## God Nodes (most connected - your core abstractions)
1. `withContext()` - 76 edges
2. `HttpError` - 67 edges
3. `cn` - 57 edges
4. `@tanstack/react-router` - 56 edges
5. `ok()` - 52 edges
6. `react` - 51 edges
7. `Button()` - 42 edges
8. `getBusinessDb()` - 42 edges
9. `@base-ui/react` - 39 edges
10. `DeliveriesPage` - 38 edges

## Surprising Connections (you probably didn't know these)
- `Semantic design tokens centralised for light and dark themes` --semantically_similar_to--> `Status numbers and standard codes from httprism or ErrorCode, never hand-typed`  [INFERRED] [semantically similar]
  DESIGN.md → src/server/AGENTS.md
- `PAYLOAD_PUBLIC_SERVER_URL dummy (https://example.com)` --semantically_similar_to--> `Loopback origin guard in payload-server-url.ts (production)`  [INFERRED] [semantically similar]
  .github/workflows/ci.yml → AGENTS.md
- `Tests mirror module basename, inject fakes, never mock.module` --semantically_similar_to--> `Tests mirror basename, inject fakes via deps, TDD red then green`  [INFERRED] [semantically similar]
  AGENTS.md → src/server/AGENTS.md
- `renderThrowingRoute()` --indirect_call--> `SiteError()`  [INFERRED]
  tests/site-error.test.ts → src/lib/site-error.tsx
- `webhookDelivery()` --calls--> `getBusinessDb()`  [EXTRACTED]
  tests/webhook-delivery.integration.test.ts → src/server/db/business-sql.ts

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Boot contract load-bearing wiring** — agents_boot_contract, agents_serverhandler_false, agents_withpayloadroot, agents_payload_search_serializer, agents_handle_server_functions, agents_payload_server_url_guard, agents_migrations_policy, agents_admin_css_link [EXTRACTED 1.00]
- **Realtime fan-out over the inbox cursor** — agents_realtime_transports, agents_cursor_created_at_id, agents_realtime_ws_gateway, agents_to_inbox_item [EXTRACTED 1.00]
- **Async channel outbox delivery flow** — agents_outbox_pattern, agents_channel_worker, agents_inapp_no_delivery_row [EXTRACTED 1.00]
- **Caller credentials (service key, recipient token, session cookie)** — content_docs_authentication_service_key, content_docs_authentication_recipient_token, content_docs_authentication_session_cookie [EXTRACTED 1.00]
- **Shipped channel plugins implement the channel contract** — content_docs_plugins_notification_channel_contract, content_docs_channels_email_email_channel, content_docs_channels_web_push_web_push_channel, content_docs_channels_webhook_webhook_channel [EXTRACTED 1.00]
- **Publish to delivery flow** — content_docs_publishing_publish_endpoint, content_docs_channels_index_delivery_outbox, content_docs_channels_index_channel_worker, content_docs_channels_index_inapp_channel, content_docs_channels_email_email_channel, content_docs_channels_web_push_web_push_channel, content_docs_channels_webhook_webhook_channel [INFERRED 0.85]
- **Favicon icon composition** — public_favicon, public_favicon_dark_tile, public_favicon_p_monogram [EXTRACTED 1.00]

## Communities (112 total, 19 thin omitted)

### Community 0 - "Notification Repository and Inbox"
Cohesion: 0.07
Nodes (44): logger, port, sockets, startRealtimeServer(), WS_HEARTBEAT_MS, WsData, ContactChannelKind, DEFAULT_CHANNELS (+36 more)

### Community 1 - "API Key Dialogs"
Cohesion: 0.13
Nodes (44): lucide-react, react, @tanstack/react-form, @tanstack/react-query, AdminLogin(), ApiKeyCreateDialog(), CreatedKey, EXPIRY_SECONDS (+36 more)

### Community 2 - "Payload CMS Setup"
Cohesion: 0.06
Nodes (26): payload, @payloadcms/db-postgres, @payloadcms/richtext-lexical, @payloadcms/tanstack-start, @tanstack/react-start, Users, PayloadLayout, useAdminStyleCleanup() (+18 more)

### Community 3 - "Channel Plugins"
Cohesion: 0.07
Nodes (34): ChannelFact, getRecipientChannelAddress(), buildUnsubscribeUrl(), emailChannel, EmailDeps, publicOrigin(), RFC-8058, AppChannelSettings (+26 more)

### Community 4 - "App Repository and Host Tests"
Cohesion: 0.10
Nodes (34): drizzle-orm, BusinessDb, closeBusinessSql(), getBusinessDb(), pushSubscriptions, recipients, recipientTokens, AppChannelRuntime (+26 more)

### Community 5 - "Error Handling and Validation"
Cohesion: 0.11
Nodes (27): @lst97-oss/last-httprism, Route, Route, Route, getBusinessSetupAuth(), ErrorCode, HttpError, toHttpError() (+19 more)

### Community 6 - "Dashboard App Detail Page"
Cohesion: 0.10
Nodes (34): CHANNEL_PANELS, ChannelPanel(), EmailChannelPanel, CHANNEL_LABELS, channelLabel(), ChannelPanelProps, ChannelPanelShell(), ChannelView (+26 more)

### Community 7 - "Package Dependencies"
Cohesion: 0.05
Nodes (44): dependencies, @asteasolutions/zod-to-openapi, @base-ui/react, better-auth, @better-auth/api-key, @better-auth/drizzle-adapter, class-variance-authority, cn (+36 more)

### Community 8 - "Channel Delivery Worker"
Cohesion: 0.09
Nodes (29): logger, stop(), wake(), purgeArchivedNotifications(), purgeExpiredRecipientTokens(), appChannelSettings(), BATCH_SIZE, deliverPendingChannelDeliveries() (+21 more)

### Community 9 - "Channel Plugin Config"
Cohesion: 0.07
Nodes (33): createUnsubscribeToken(), secret(), verifyUnsubscribeToken(), EMAIL_PROVIDERS, emailConfig, emailConfigDef, EmailProviderId, fileSchema (+25 more)

### Community 10 - "Agent Rules and Design Guidance"
Cohesion: 0.06
Nodes (20): DESIGN.md as the styling authority, shadcn registry components in src/components/ui, Shell providers in __root.tsx: ThemeProvider and Base-UI Toaster, withPayloadRoot in src/routes/__root.tsx, Release v0.2.0: backend kernel and boot contract, Release v0.4.0: Payload beta.2, kernel auto-sync, schema drift test, Global providers mount once in src/routes/__root.tsx, src/components/ui shadcn registry (base-nova, neutral, lucide); components.json and template-owned files (+12 more)

### Community 11 - "Dashboard Stats Panels"
Cohesion: 0.21
Nodes (32): DashboardAccessDenied(), DashboardStats, DashboardStatsBody(), TopAppsCard(), ACTIVITY_CONFIG, CHANNEL_CONFIG, ChannelActivityPanel(), DeliveryStatusPie() (+24 more)

### Community 12 - "Admin App Management"
Cohesion: 0.14
Nodes (33): Route, Route, Route, Route, Route, appsForDashboardData(), createAppData(), deleteAppData() (+25 more)

### Community 13 - "Deliveries Dashboard Page"
Cohesion: 0.10
Nodes (26): Pagination(), PaginationContent(), PaginationItem(), PaginationLink(), PaginationLinkProps, PaginationNext(), PaginationPrevious(), SelectContent() (+18 more)

### Community 14 - "Request Context and CORS"
Cohesion: 0.15
Nodes (25): @tanstack/react-router, Route, Route, Route, Route, Route, Route, Route (+17 more)

### Community 15 - "Notification Handlers"
Cohesion: 0.18
Nodes (33): Route, Route, Route, RFC-8058, ok(), parseJsonBody(), parseWith(), authenticateInbox() (+25 more)

### Community 16 - "Docs Site Routing"
Cohesion: 0.09
Nodes (26): fumadocs-core, fumadocs-mdx, fumadocs-ui, ErrorTable(), DocsCard(), DocsMdxComponents, getMDXComponents(), MdxLink() (+18 more)

### Community 17 - "Response Schemas"
Cohesion: 0.06
Nodes (34): apiErrorSchema, apiKeySchema, appChannelSchema, appChannelSettingSchema, appDetailSchema, appSchema, appStats, archivedSchema (+26 more)

### Community 18 - "Package Build Dependencies"
Cohesion: 0.06
Nodes (32): imports, #vendor/*, license, name, private, type, @asteasolutions/zod-to-openapi, @biomejs/biome (+24 more)

### Community 19 - "Vite Build Plugins"
Cohesion: 0.09
Nodes (17): @tailwindcss/vite, unwasm, @vitejs/plugin-react, @vitejs/plugin-rsc, clientModuleResolution(), payloadDevTransforms(), defaultImportProtectionIgnoreImporters, onImportProtectionViolation() (+9 more)

### Community 20 - "Dropdown and Menubar UI"
Cohesion: 0.11
Nodes (26): DropdownMenu(), DropdownMenuContent(), DropdownMenuGroup(), DropdownMenuItem(), DropdownMenuLabel(), DropdownMenuPortal(), DropdownMenuRadioGroup(), DropdownMenuSeparator() (+18 more)

### Community 21 - "Health Probes"
Cohesion: 0.13
Nodes (17): Route, Route, getBusinessSql(), toBunSqlUrl(), DbProbe, getHealth(), GetHealthDeps, buildHealthReport() (+9 more)

### Community 22 - "Combobox and Input Groups"
Cohesion: 0.11
Nodes (12): ComboboxChip(), ComboboxClear(), ComboboxInput(), ComboboxTrigger(), InputGroup(), InputGroupAddon(), inputGroupAddonVariants, InputGroupButton() (+4 more)

### Community 23 - "API Key Repository"
Cohesion: 0.16
Nodes (24): Route, createKeyData(), deleteKeyData(), listKeysData(), requireManagedKey(), requireScopeManager(), updateKeyData(), boundAppKeyOf() (+16 more)

### Community 24 - "Route Registry and Envelope"
Cohesion: 0.08
Nodes (27): appAdmin, appParams, consumerAuth, deliveryParams, failure, json(), noAuth, notificationParams (+19 more)

### Community 25 - "API Keys Dashboard Page"
Cohesion: 0.19
Nodes (20): ConfirmDeleteDialog(), DashboardPage(), AlertDialog(), AlertDialogAction(), AlertDialogCancel(), AlertDialogContent(), AlertDialogDescription(), AlertDialogFooter() (+12 more)

### Community 26 - "Tabs and Toggle UI"
Cohesion: 0.10
Nodes (10): @base-ui/react, class-variance-authority, Marker(), markerVariants, TabsList(), tabsListVariants, ToggleGroupContext, ToggleGroupItem() (+2 more)

### Community 27 - "Stream Bus and Streaming"
Cohesion: 0.13
Nodes (16): createLiveGate(), BusDeps, BusListener, handlePayload(), instanceId, logger, publishNotificationEvent(), stopStreamBus() (+8 more)

### Community 28 - "Biome Config"
Cohesion: 0.08
Nodes (23): source, assist, actions, enabled, includes, files, includes, formatter (+15 more)

### Community 29 - "Package Scripts"
Cohesion: 0.08
Nodes (24): scripts, build, channels:work, check, db:business:generate, db:business:migrate, db:migrate, db:up (+16 more)

### Community 30 - "Admin Sidebar UI"
Cohesion: 0.16
Nodes (18): AdminSidebar(), DASHBOARD_NAV, DashboardNavGroup, DashboardNavItem, initialsOf(), SiteSwitcher(), ThemeToggle(), UserMenu() (+10 more)

### Community 31 - "Route Guards and Deliveries"
Cohesion: 0.17
Nodes (17): Route, Route, Route, Principal, adapters, resolveSessionPrincipal(), assertSameOrigin(), configuredPublicOrigin() (+9 more)

### Community 32 - "API Key Scope Picker"
Cohesion: 0.15
Nodes (18): ApiKeyScopePicker(), Accordion(), AccordionContent(), AccordionItem(), AccordionTrigger(), Badge(), badgeVariants, Checkbox() (+10 more)

### Community 33 - "Sidebar Components"
Cohesion: 0.13
Nodes (13): SidebarContext, SidebarContextProps, SidebarInput(), SidebarMenuButton(), sidebarMenuButtonVariants, SidebarMenuSkeleton(), SidebarRail(), useSidebar() (+5 more)

### Community 34 - "Components Config"
Cohesion: 0.09
Nodes (21): aliases, components, hooks, lib, ui, utils, iconLibrary, menuAccent (+13 more)

### Community 35 - "Button Group UI"
Cohesion: 0.11
Nodes (9): cn, ButtonGroup(), ButtonGroupSeparator(), buttonGroupVariants, FieldSeparator(), ItemSeparator(), NativeSelectProps, Separator() (+1 more)

### Community 36 - "Outbound Webhook Safety"
Cohesion: 0.16
Nodes (12): ipv6Groups(), isPublicAddress(), isPublicIPv4(), isPublicIPv6(), WEBHOOK_URL_MAX_LENGTH, blocked(), guardedLookup(), PostOptions (+4 more)

### Community 37 - "Business Schema Modules"
Cohesion: 0.16
Nodes (17): appChannels, createdAt(), createdAtMs(), updatedAt(), notificationDeliveries, notificationDeliveryStatus, notifications, notificationPreferences (+9 more)

### Community 38 - "Notification Schemas"
Cohesion: 0.10
Nodes (18): CONTACT_CHANNELS, archiveBodySchema, channelSchema, contactBodySchema, contactClearQuerySchema, inboxQuerySchema, inboxReadBodySchema, notificationIdParamSchema (+10 more)

### Community 39 - "TypeScript Config"
Cohesion: 0.09
Nodes (21): compilerOptions, allowImportingTsExtensions, jsx, lib, module, moduleResolution, noEmit, noFallthroughCasesInSwitch (+13 more)

### Community 40 - "Dev Dependencies"
Cohesion: 0.11
Nodes (18): devDependencies, @biomejs/biome, bun-types, drizzle-kit, nitro, oxc-transform-react, @scalar/api-reference, @tanstack/router-cli (+10 more)

### Community 41 - "Toast and Root Shell"
Cohesion: 0.19
Nodes (15): next-themes, ToastAction(), ToastClose(), ToastContent(), ToastDescription(), Toaster(), ToastIcon(), ToastList() (+7 more)

### Community 42 - "Router and Site Errors"
Cohesion: 0.17
Nodes (9): @tanstack/react-router-ssr-query, getContext(), SiteError(), SiteNotFound(), getRouter(), Register, @tanstack/react-router, Route (+1 more)

### Community 43 - "Dashboard Shell and Auth Client"
Cohesion: 0.18
Nodes (14): @better-auth/api-key, DashboardShell(), SidebarInset(), SidebarProvider(), SidebarTrigger(), authClient, fetchSessionState(), SESSION_QUERY_KEY (+6 more)

### Community 45 - "Stats Queries"
Cohesion: 0.23
Nodes (15): AppDashboardStats, AppDetail, ChannelBreakdown, FleetDashboardStats, getAppStats(), getFleetStats(), readBreakdowns(), readSeries() (+7 more)

### Community 46 - "Channel Plugin Docs"
Cohesion: 0.16
Nodes (15): Dead letter, Stale push endpoint purge, Push subscription, VAPID keys, Web Push channel, ChannelError(code), Channel plugin, describe() operator facts (+7 more)

### Community 47 - "API Reference Routes"
Cohesion: 0.23
Nodes (11): better-auth, Route, Route, openApiDocsEnabled, apiReferenceResponse(), htmlResponse(), openApiJsonResponse(), referenceHtml() (+3 more)

### Community 48 - "Business Auth"
Cohesion: 0.19
Nodes (12): @better-auth/drizzle-adapter, getBusinessSession(), resolveBetterAuthSession(), PrincipalCredential, SessionAdapter, SessionPrincipal, account, apikey (+4 more)

### Community 49 - "Syntax Highlighter"
Cohesion: 0.20
Nodes (12): shiki, @shikijs/core, highlighterFor(), Loaded, loads, useHighlightedCode(), aliases, getHighlighter() (+4 more)

### Community 50 - "API Key Rows"
Cohesion: 0.26
Nodes (11): ApiKeyRow(), Item(), ItemActions(), ItemContent(), ItemDescription(), ItemMedia(), itemMediaVariants, ItemTitle() (+3 more)

### Community 51 - "Drawer UI"
Cohesion: 0.17
Nodes (7): DrawerContent(), DrawerContext, DrawerContextProps, DrawerOverlay(), DrawerPortal(), DrawerSwipeHandle(), useDrawer()

### Community 52 - "Email Channel Docs"
Cohesion: 0.20
Nodes (12): Email channel (SMTP), Email theme options (data.email), Signed unsubscribe link (HMAC), Channel switches (app and recipient), Webhook signature header, Per-app webhook signing secret, verifyWebhook example, BETTER_AUTH_SECRET (+4 more)

### Community 53 - "Admin Schemas"
Cohesion: 0.14
Nodes (13): NOTIFICATION_CHANNELS, appCreateSchema, appKeySchema, appUpdateSchema, channelPatchSchema, deliveriesQuerySchema, deliveryIdSchema, keyCreateSchema (+5 more)

### Community 54 - "Changelog Notes"
Cohesion: 0.18
Nodes (8): Pre-rename keys are not upgraded; reissue them, Migration 0005 widens channel CHECK constraints, Migration 0007 adds app_channels.signing_secret_encrypted, notifications:write removed; subscribers renamed to recipients, Webhook channel: signed HTTPS POST, opt-in, retryable ChannelError, PUT contact accepts channel webhook; doc says subscribers:write, PUT channels/webhook sets per-app endpoint and issues signing secret, WEBHOOK_SIGNING_SECRET 16+ chars; channel refuses to send without it

### Community 55 - "Collapsible Trace UI"
Cohesion: 0.24
Nodes (7): Collapsible(), CollapsibleContent(), CollapsibleTrigger(), TraceCollapsible(), TraceCollapsibleContent(), TraceCollapsibleTrigger(), TraceIcon()

### Community 56 - "CI and Deployment Docs"
Cohesion: 0.17
Nodes (9): ci.yml GitHub Actions workflow, node-server boot proof and smoke step, .bun-version (CI Bun version source), business-postgres:16 service (notifications_business, host port 5435), check job (ubuntu-latest, 25 min timeout), generate steps (routeTree, Payload import map, admin CSS), migration steps (db:migrate, db:business:migrate), PAYLOAD_PUBLIC_SERVER_URL dummy (https://example.com) (+1 more)

### Community 57 - "Security and Tenancy Docs"
Cohesion: 0.20
Nodes (8): better-auth: lnk_ API keys, session cookie, instance_admins, Business migrations rebuilt as one file per domain (0000 to 0004), notifications.inapp column (migration 0004, default true), recipients table and recipient_contacts rename, Host registers delivery settings via the widget server SDK, App-bound lnk_ keys via x-api-key or Bearer; tenancy via api_key_apps, Permission set: resource:verb with CRUD verbs, claims there is no auth wrapper (withAuth 501 stub)

### Community 58 - "Async Channels and Outbox Docs"
Cohesion: 0.17
Nodes (4): channel-worker and channel-delivery: lease, retries, dead letter, purge, Inbox archive, restore and archive-all-read with 30-day retention (migration 0006), Inbox order=desc, unread count and latest stream cursor, Docker compose services: migrate, app, worker, ws

### Community 59 - "Business API Docs"
Cohesion: 0.24
Nodes (12): Auth API reference, Business API reference, OpenAPI document (/api/openapi.json), OpenAPI plugin switch, App-bound service key, Dashboard, Permission set (resource:verb), Service key (lnk_) (+4 more)

### Community 60 - "Chart UI"
Cohesion: 0.20
Nodes (11): recharts, ChartConfig, ChartContext, ChartContextProps, ChartLegendContent(), ChartStyle(), getPayloadConfigFromPayload(), INITIAL_DIMENSION (+3 more)

### Community 61 - "Attachment UI"
Cohesion: 0.20
Nodes (5): Attachment(), AttachmentAction(), AttachmentMedia(), attachmentMediaVariants, attachmentVariants

### Community 62 - "Sheet UI"
Cohesion: 0.26
Nodes (8): Sheet(), SheetContent(), SheetDescription(), SheetHeader(), SheetOverlay(), SheetPortal(), SheetTitle(), Sidebar()

### Community 63 - "Business Auth Config"
Cohesion: 0.23
Nodes (10): businessApiKeyPlugin(), businessAuthEnvSchema, BusinessAuthSettings, getBootstrapEmail(), getBusinessAuthSettings(), optionalCredential, createBusinessAuth(), isPlaceholderSecret() (+2 more)

### Community 64 - "Publishing Docs"
Cohesion: 0.22
Nodes (9): Recommended permission sets, Delivery id header (x-last-notifications-delivery), Dedupe key, Notification, Notification priority, Publish body and limits, Publish endpoint, recipientKey (opaque recipient id) (+1 more)

### Community 65 - "Code Block UI"
Cohesion: 0.24
Nodes (6): CodeBlock(), CodeBlockContent(), CodeBlockCopyButton(), CodeBlockLine(), codeBlockLineVariants, codeBlockVariants

### Community 66 - "Recipient Handlers"
Cohesion: 0.29
Nodes (8): Route, Route, appKeyParamSchema, recipientKeyParamSchema, decodeRecipientCursor(), encodeRecipientCursor(), getRecipientData(), listRecipientsData()

### Community 67 - "Logger"
Cohesion: 0.29
Nodes (8): registeredOrigins, consoleWriter(), createLogger(), getRequestLogger(), Logger, LogLevel, LogWriter, makeLogger()

### Community 68 - "Boot Contract Docs"
Cohesion: 0.24
Nodes (5): handleServerFunctions Flight Response passed through unchanged, payloadParseSearch and payloadStringifySearch in src/router.tsx, Payload CMS v4 (4.0.0-beta.4), TanStack Start (RSC, Nitro), Release v0.5.0: Payload 4.0.0-beta.4 and src/payload layout

### Community 69 - "Quickstart Docs"
Cohesion: 0.24
Nodes (9): drizzle/business committed DDL applied by db:business:migrate, postgres:16 local service on 127.0.0.1:5435, Business Postgres database for identities, apps, keys, notifications, deliveries, Channel kinds: in-app, email, browser push, webhook, Notification console at /dashboard, last-notifications: self-hosted multi-tenant notification server, Payload CMS admin at /admin (users collection only), Publish body and POST notifications route (202 response) (+1 more)

### Community 70 - "Realtime and Inbox Docs"
Cohesion: 0.29
Nodes (8): Better Auth reference at /api/auth/reference, Fumadocs guides at /docs with search, OpenAPI document and self-hosted Scalar reference, Business API route table, Docs and API reference: /docs, /api/reference, /api/openapi.json, GET inbox keyset page with unread count and latest cursor, SSE stream with Last-Event-ID resume, WebSocket gateway on WS_PORT (default 3001)

### Community 71 - "Realtime Endpoint Docs"
Cohesion: 0.29
Nodes (9): Recipient token (lrt_), App (tenant), Last Notifications, Inbox read endpoint, Registered origin rule for browser calls, Inbox cursor, Last-Event-ID resume, SSE stream endpoint (+1 more)

### Community 72 - "Self-hosting Docs"
Cohesion: 0.27
Nodes (7): Email deliverability (SPF, DKIM, DMARC), Channel worker (channels:work), Plugin migrations folder, Business database (BUSINESS_DATABASE_URL), Docker Compose production deployment, Local setup, Three-process topology (app, worker, gateway)

### Community 73 - "Payload Shutdown"
Cohesion: 0.36
Nodes (7): nitro, armProcessHandlers(), cachedPayloads(), Destroyable, destroyCachedPayloads(), drainAll(), payloadShutdownPlugin()

### Community 74 - "Navigation Menu UI"
Cohesion: 0.24
Nodes (4): NavigationMenu(), NavigationMenuPositioner(), NavigationMenuTrigger(), navigationMenuTriggerStyle

### Community 75 - "Dashboard Apps Page"
Cohesion: 0.24
Nodes (8): toast, AppRow, APPS_KEY, copyKey(), fetchApps(), filterApps(), Route, apps

### Community 76 - "Channel Plugin Contract Docs"
Cohesion: 0.36
Nodes (7): Channel plugin contract with install list, ChannelError and describe, Webhook channel as the outbound HTTP reference plugin, Channel plugin contract: trusted TypeScript module with NotificationChannel type, Email channel plugin: SMTP via nodemailer, List-Unsubscribe, Environment variable table, RFC 8058 one-click unsubscribe with HMAC token, Webhook channel plugin: signed HTTPS POST to recipient URL

### Community 77 - "Leaderboard UI"
Cohesion: 0.44
Nodes (7): Leaderboard(), LeaderboardItem, Progress(), ProgressIndicator(), ProgressLabel(), ProgressTrack(), ProgressValue()

### Community 78 - "Business Auth Routes and CORS"
Cohesion: 0.44
Nodes (6): allowedOrigin(), respondWithCors(), Route, getBusinessAuth(), isRegisteredAuthOrigin(), applyCors()

### Community 79 - "Publish Use Case"
Cohesion: 0.36
Nodes (8): publishNotification(), PublishNotificationDeps, PublishNotificationInput, asyncDeliveryChannels(), resolveTargetChannels(), insertDeliveries(), insertNotification(), loadChannelContext()

### Community 80 - "Compose Stack Docs"
Cohesion: 0.54
Nodes (7): compose.yaml local and self-host stack, x-app-environment anchor shared by migrate, app, worker and ws, app service (Dockerfile build, loopback APP_PORT), migrate service (db:migrate then db:business:migrate), SECRET_ENCRYPTION_KEY pass-through (default empty), worker service (scripts/channel-worker.ts), ws service (scripts/realtime-ws.ts on WS_PORT)

### Community 81 - "Radio and Switch UI"
Cohesion: 0.36
Nodes (4): react-dom, RadioGroup(), RadioGroupItem(), Switch()

### Community 83 - "Webhook Channel Docs"
Cohesion: 0.33
Nodes (5): Delivery channel, inapp channel, Per-recipient webhook URL, Webhook retry classification, Webhook channel

### Community 84 - "Bubble UI"
Cohesion: 0.38
Nodes (4): Bubble(), BubbleReactions(), bubbleReactionsVariants, bubbleVariants

### Community 87 - "Registered Origins"
Cohesion: 0.33
Nodes (6): createRegisteredOrigins(), list(), refresh(), RegisteredOrigins, RegisteredOriginsOptions, RegisteredOriginSource

### Community 88 - "Payload Build Externals"
Cohesion: 0.29
Nodes (6): buildBundledPackages, buildExternalPackages, devExternalPackages, payloadNoExternalPatterns, serverExternalPackages, ssrExternalPackages

### Community 89 - "Filename Sanitizer"
Cohesion: 0.43
Nodes (6): encoder, replaceMatches(), Replacement, sanitize(), sanitizeFilename(), truncateUtf8()

### Community 90 - "Error Envelope Docs"
Cohesion: 0.33
Nodes (5): Error code, ErrorTable reference, Liveness and readiness probes, x-request-id header, Response envelope

### Community 92 - "Payload Admin CSS Generator"
Cohesion: 0.47
Nodes (5): collect(), main(), ROOTS, SKIPPED, toSpecifier()

### Community 93 - "Smoke Test Script"
Cohesion: 0.33
Nodes (3): base, Check, checks

### Community 94 - "Masking Helpers"
Cohesion: 0.53
Nodes (4): maskEmail(), maskWebhookUrl(), getChannelPreferences(), getRecipientSummary()

### Community 95 - "Unsubscribe Page"
Cohesion: 0.80
Nodes (4): escapeHtml(), page(), unsubscribeConfirmPage(), unsubscribedPage()

### Community 97 - "Favicon Design"
Cohesion: 0.83
Nodes (4): favicon.svg (P monogram icon), Dark rounded-square tile (32x32, rx 7), Neutral near-black and off-white palette (#0a0a0a, #fafafa), White P monogram text (system-ui, 17px, centred at x=16 y=22)

### Community 98 - "Admin Schema Validation"
Cohesion: 0.50
Nodes (3): zod, adminSignupSchema, appFormSchema

## Ambiguous Edges - Review These
- `better-auth: lnk_ API keys, session cookie, instance_admins` → `claims there is no auth wrapper (withAuth 501 stub)`  [AMBIGUOUS]
  src/server/README.md · relation: conceptually_related_to
- `Business migrations rebuilt as one file per domain (0000 to 0004)` → `notifications.inapp column (migration 0004, default true)`  [AMBIGUOUS]
  CHANGELOG.md · relation: conceptually_related_to
- `Pre-rename keys are not upgraded; reissue them` → `Migration 0007 adds app_channels.signing_secret_encrypted`  [AMBIGUOUS]
  CHANGELOG.md · relation: conceptually_related_to
- `Pre-rename keys are not upgraded; reissue them` → `notifications:write removed; subscribers renamed to recipients`  [AMBIGUOUS]
  CHANGELOG.md · relation: conceptually_related_to
- `Channel names validated by zod and plugin registry, not CHECK constraints` → `Migration 0005 widens channel CHECK constraints`  [AMBIGUOUS]
  CHANGELOG.md · relation: conceptually_related_to
- `notifications:write removed; subscribers renamed to recipients` → `PUT contact accepts channel webhook; doc says subscribers:write`  [AMBIGUOUS]
  CHANGELOG.md · relation: conceptually_related_to
- `Auth API reference` → `Response envelope`  [AMBIGUOUS]
  content/docs/api-reference.mdx · relation: conceptually_related_to

## Knowledge Gaps
- **62 isolated node(s):** `@fontsource-variable/geist`, `@payloadcms/drizzle`, `@payloadcms/translations`, `@payloadcms/ui`, `@tanstack/react-form-start` (+57 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 660 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **19 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `react` connect `API Key Dialogs` to `Payload CMS Setup`, `Dashboard App Detail Page`, `Dashboard Stats Panels`, `Deliveries Dashboard Page`, `Docs Site Routing`, `Package Build Dependencies`, `Dropdown and Menubar UI`, `Combobox and Input Groups`, `API Keys Dashboard Page`, `Tabs and Toggle UI`, `Admin Sidebar UI`, `Sidebar Components`, `Button Group UI`, `Toast and Root Shell`, `Router and Site Errors`, `Context Menu UI`, `Syntax Highlighter`, `API Key Rows`, `Drawer UI`, `Collapsible Trace UI`, `Chart UI`, `Attachment UI`, `Sheet UI`, `Code Block UI`, `Dashboard Apps Page`, `Bubble UI`, `Message UI`, `Popover UI`?**
  _High betweenness centrality (0.101) - this node is a cross-community bridge._
- **What connects `@fontsource-variable/geist`, `@payloadcms/drizzle`, `@payloadcms/translations` to the rest of the system?**
  _62 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Notification Repository and Inbox` be split into smaller, more focused modules?**
  _Cohesion score 0.06927551560021153 - nodes in this community are weakly interconnected._
- **Why does `@tanstack/react-router` connect `Request Context and CORS` to `API Key Dialogs`, `Payload CMS Setup`, `Error Handling and Validation`, `Dashboard App Detail Page`, `Dashboard Stats Panels`, `Admin App Management`, `Deliveries Dashboard Page`, `Notification Handlers`, `Docs Site Routing`, `Package Build Dependencies`, `Health Probes`, `API Key Repository`, `API Keys Dashboard Page`, `Admin Sidebar UI`, `Route Guards and Deliveries`, `Toast and Root Shell`, `Router and Site Errors`, `Dashboard Shell and Auth Client`, `API Reference Routes`, `Recipient Handlers`, `Dashboard Apps Page`, `Business Auth Routes and CORS`?**
  _High betweenness centrality (0.094) - this node is a cross-community bridge._
- **Should `API Key Dialogs` be split into smaller, more focused modules?**
  _Cohesion score 0.1285034373347435 - nodes in this community are weakly interconnected._

### Low-confidence Hints
_AMBIGUOUS edges — the extractor was unsure. Verify before acting on these._

- **What is the exact relationship between `better-auth: lnk_ API keys, session cookie, instance_admins` and `claims there is no auth wrapper (withAuth 501 stub)`?**
  _Edge tagged AMBIGUOUS (relation: conceptually_related_to) - confidence is low._
- **What is the exact relationship between `Business migrations rebuilt as one file per domain (0000 to 0004)` and `notifications.inapp column (migration 0004, default true)`?**
  _Edge tagged AMBIGUOUS (relation: conceptually_related_to) - confidence is low._