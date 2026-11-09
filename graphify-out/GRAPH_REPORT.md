# Graph Report - last-notifications  (2026-11-09)

## Corpus Check
- 382 files · ~127,715 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 15 file(s) not represented in the graph (top: (none) 6, .css 4, .example 1)

## Summary
- 2316 nodes · 6089 edges · 125 communities (102 shown, 23 thin omitted)
- Extraction: 98% EXTRACTED · 2% INFERRED · 0% AMBIGUOUS · INFERRED: 97 edges (avg confidence: 0.87)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `8157f6e0`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- stream-bus.ts
- @base-ui/react
- @payloadcms/tanstack-start
- dashboard.apps_.$appKey.tsx
- registry.ts
- host-api.integration.test.ts
- button-group.tsx
- Package Dependencies
- payload.config.ts
- email.plugin.ts
- Business backend kernel under src/server
- dashboard.apps.tsx
- admin-apps.ts
- Deliveries Dashboard Page
- HttpError
- notification-handler.ts
- Docs Site Routing
- Response Schemas
- Package Build Dependencies
- Vite Build Plugins
- Dropdown and Menubar UI
- health-handler.ts
- Combobox and Input Groups
- api-key-repository.ts
- realtime-ws.ts
- API Keys Dashboard Page
- recipient-repository.ts
- env
- Biome Config
- Package Scripts
- Admin Sidebar UI
- webpush.plugin.ts
- Semantic design tokens centralised for light and dark themes
- Sidebar Components
- Components Config
- webhook.plugin.ts
- Outbound Webhook Safety
- HttpError
- Notification Schemas
- TypeScript Config
- environment
- Toast and Root Shell
- shadcn rules: use registry, owned source, providers once in root shell
- dashboard-shell.tsx
- Context Menu UI
- Stats Queries
- Channel Plugin Docs
- Button
- payload-logger.ts
- Syntax Highlighter
- router.tsx
- Drawer UI
- Email Channel Docs
- admin-schemas.ts
- Changelog Notes
- Collapsible Trace UI
- CI and Deployment Docs
- Security and Tenancy Docs
- Async Channels and Outbox Docs
- Business API reference
- tabs.tsx
- attachment.tsx
- x-app-environment
- vite
- Publishing Docs
- channel-config-handler.ts
- business-auth.ts
- Boot Contract Docs
- marker.tsx
- class-variance-authority
- Realtime Endpoint Docs
- Self-hosting Docs
- ws
- Navigation Menu UI
- drizzle-orm
- api-key-scopes.ts
- Leaderboard UI
- payload-shutdown.ts
- channel-delivery.ts
- Compose Stack Docs
- Channel plugin contract: trusted TypeScript module with NotificationChannel type
- Realtime Architecture Docs
- ws
- notification-handler.ts
- permissions.mdx
- sheet.tsx
- logger-format.ts
- services
- Filename Sanitizer
- Error Envelope Docs
- shell.tsx
- Payload Admin CSS Generator
- Smoke Test Script
- ref_bun_test
- business-sql.ts
- Delivery channel
- Start Script
- code-block.tsx
- Vendored Payload Workaround
- Robots.txt
- Bootstrap Databases Script
- Business Area Recipe
- Health Reference Slice
- react-dom
- vite-logger.ts
- worker-pause.ts
- path
- app
- bubble.tsx
- dev.ts
- cn
- CLAUDE.md
- .claude/CLAUDE.md
- logger.ts
- webhook.config.ts
- chart.tsx
- logger-settings.ts
- unsubscribe-page.ts

## God Nodes (most connected - your core abstractions)
1. `withContext()` - 76 edges
2. `HttpError` - 69 edges
3. `cn` - 58 edges
4. `@tanstack/react-router` - 57 edges
5. `react` - 53 edges
6. `ok()` - 52 edges
7. `getBusinessDb()` - 43 edges
8. `Button()` - 42 edges
9. `@base-ui/react` - 40 edges
10. `ApiKeyCreateDialog()` - 39 edges

## Surprising Connections (you probably didn't know these)
- `PAYLOAD_PUBLIC_SERVER_URL dummy (https://example.com)` --semantically_similar_to--> `Loopback origin guard in payload-server-url.ts (production)`  [INFERRED] [semantically similar]
  .github/workflows/ci.yml → AGENTS.md
- `Semantic design tokens centralised for light and dark themes` --semantically_similar_to--> `Status numbers and standard codes from httprism or ErrorCode, never hand-typed`  [INFERRED] [semantically similar]
  DESIGN.md → src/server/AGENTS.md
- `app service (Dockerfile build, loopback APP_PORT)` --semantically_similar_to--> `Docker compose services: migrate, app, worker, ws`  [INFERRED] [semantically similar]
  compose.yaml → README.md
- `ws service (scripts/realtime-ws.ts on WS_PORT)` --semantically_similar_to--> `WebSocket gateway on WS_PORT (default 3001)`  [INFERRED] [semantically similar]
  compose.yaml → README.md
- `Tests mirror module basename, inject fakes, never mock.module` --semantically_similar_to--> `Tests mirror basename, inject fakes via deps, TDD red then green`  [INFERRED] [semantically similar]
  AGENTS.md → src/server/AGENTS.md

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Boot contract load-bearing wiring** — agents_boot_contract, agents_serverhandler_false, agents_withpayloadroot, agents_payload_search_serializer, agents_handle_server_functions, agents_payload_server_url_guard, agents_migrations_policy, agents_admin_css_link [EXTRACTED 1.00]
- **Caller credentials (service key, recipient token, session cookie)** — content_docs_authentication_service_key, content_docs_authentication_recipient_token, content_docs_authentication_session_cookie [EXTRACTED 1.00]
- **Shipped channel plugins implement the channel contract** — content_docs_plugins_notification_channel_contract, content_docs_channels_email_email_channel, content_docs_channels_web_push_web_push_channel, content_docs_channels_webhook_webhook_channel [EXTRACTED 1.00]
- **Async channel outbox delivery flow** — agents_outbox_pattern, agents_channel_worker, agents_inapp_no_delivery_row [EXTRACTED 1.00]
- **Realtime fan-out over the inbox cursor** — agents_realtime_transports, agents_cursor_created_at_id, agents_realtime_ws_gateway, agents_to_inbox_item [EXTRACTED 1.00]
- **Publish to delivery flow** — content_docs_publishing_publish_endpoint, content_docs_channels_index_delivery_outbox, content_docs_channels_index_channel_worker, content_docs_channels_index_inapp_channel, content_docs_channels_email_email_channel, content_docs_channels_web_push_web_push_channel, content_docs_channels_webhook_webhook_channel [INFERRED 0.85]

## Communities (125 total, 23 thin omitted)

### Community 0 - "stream-bus.ts"
Cohesion: 0.10
Nodes (29): encodeCursor(), NotificationRecord, toInboxItem(), createLiveGate(), resolveNotificationOrigin(), encodeKeepaliveFrame(), encodeNotificationFrame(), SSE_KEEPALIVE_MS (+21 more)

### Community 2 - "@payloadcms/tanstack-start"
Cohesion: 0.13
Nodes (13): @payloadcms/tanstack-start@4.0.0-beta.4, @tanstack/react-start@latest, @payloadcms/tanstack-start, @tanstack/react-start, payloadLayout, PayloadLayout(), useAdminStyleCleanup(), adminRenderServerFn (+5 more)

### Community 3 - "dashboard.apps_.$appKey.tsx"
Cohesion: 0.15
Nodes (22): ChannelPanel(), DashboardPage(), RangeToggle(), SkeletonCards(), Breadcrumb(), BreadcrumbItem(), BreadcrumbLink(), BreadcrumbList() (+14 more)

### Community 4 - "registry.ts"
Cohesion: 0.08
Nodes (27): appAdmin, appParams, consumerAuth, deliveryParams, failure, json(), noAuth, notificationParams (+19 more)

### Community 5 - "host-api.integration.test.ts"
Cohesion: 0.10
Nodes (30): notificationDeliveries, NotificationChannelKind, logger, NO_SETTINGS, publishNotification(), PublishNotificationDeps, PublishNotificationInput, ARCHIVE_RETENTION_DAYS (+22 more)

### Community 6 - "button-group.tsx"
Cohesion: 0.27
Nodes (7): ButtonGroup(), ButtonGroupSeparator(), buttonGroupVariants, FieldSeparator(), ItemSeparator(), Separator(), SidebarSeparator()

### Community 7 - "Package Dependencies"
Cohesion: 0.05
Nodes (42): dependencies, @asteasolutions/zod-to-openapi@9.1.0, @better-auth/api-key@1.7.10, @better-auth/drizzle-adapter@1.7.10, cn@^0.4.0, drizzle-orm@0.45.2, @fontsource-variable/geist@^5.3.0, @lst97-oss/last-httprism@0.2.0 (+34 more)

### Community 8 - "payload.config.ts"
Cohesion: 0.09
Nodes (18): payload@4.0.0-beta.4, @payloadcms/db-postgres@4.0.0-beta.4, @payloadcms/richtext-lexical@4.0.0-beta.4, payload, @payloadcms/db-postgres, @payloadcms/richtext-lexical, Users, migrations (+10 more)

### Community 9 - "email.plugin.ts"
Cohesion: 0.12
Nodes (24): createUnsubscribeToken(), secret(), verifyUnsubscribeToken(), EMAIL_PROVIDERS, EmailConfig, emailConfig, emailConfigDef, EmailProviderId (+16 more)

### Community 10 - "Business backend kernel under src/server"
Cohesion: 0.12
Nodes (9): Release v0.2.0: backend kernel and boot contract, Release v0.4.0: Payload beta.2, kernel auto-sync, schema drift test, Business backend kernel under src/server, Kernel files synced from template; never hand-edit; no CMS imports, New-module recipe: domain, application, infrastructure, http, openapi spec: registry, response schemas, reference, on/off switch, src/server/README.md business backend overview, request flow: route, withContext, getXData, use case, then domain and infrastructure (+1 more)

### Community 11 - "dashboard.apps.tsx"
Cohesion: 0.15
Nodes (43): DashboardAccessDenied(), DashboardStats, DashboardStatsBody(), TopAppsCard(), ACTIVITY_CONFIG, CHANNEL_CONFIG, ChannelActivityPanel(), DeliveryStatusPie() (+35 more)

### Community 12 - "admin-apps.ts"
Cohesion: 0.12
Nodes (30): ApiKeyScope, Route, Route, Route, appsForDashboardData(), createAppData(), deleteAppData(), getAppChannelsData() (+22 more)

### Community 13 - "Deliveries Dashboard Page"
Cohesion: 0.13
Nodes (20): Pagination(), PaginationContent(), PaginationItem(), PaginationLink(), PaginationLinkProps, PaginationNext(), PaginationPrevious(), Table() (+12 more)

### Community 14 - "HttpError"
Cohesion: 0.14
Nodes (29): Route, Route, Route, Route, resolveSessionPrincipal(), appMemberships, apps, HttpError (+21 more)

### Community 15 - "notification-handler.ts"
Cohesion: 0.13
Nodes (30): @tanstack/react-router, Route, Route, Route, Route, Route, Route, Route (+22 more)

### Community 16 - "Docs Site Routing"
Cohesion: 0.08
Nodes (29): fumadocs-core@16.17.7, fumadocs-mdx@15.4.8, fumadocs-ui@16.17.7, fumadocs-core, fumadocs-mdx, fumadocs-ui, ErrorTable(), DocsCard() (+21 more)

### Community 17 - "Response Schemas"
Cohesion: 0.06
Nodes (35): apiErrorSchema, apiKeySchema, appChannelSchema, appChannelSettingSchema, appDetailSchema, appSchema, appStats, archivedSchema (+27 more)

### Community 18 - "Package Build Dependencies"
Cohesion: 0.06
Nodes (44): devDependencies, @biomejs/biome@2.6.2, bun-types@^1.4.4, consola@3.4.2, drizzle-kit@0.31.11, nitro@^3.0.260903-beta, oxc-transform-react@0.152.0, @scalar/api-reference@^1.77.0 (+36 more)

### Community 19 - "Vite Build Plugins"
Cohesion: 0.08
Nodes (19): clientModuleResolution(), payloadDevTransforms(), buildBundledPackages, buildExternalPackages, devExternalPackages, payloadNoExternalPatterns, serverExternalPackages, ssrExternalPackages (+11 more)

### Community 20 - "Dropdown and Menubar UI"
Cohesion: 0.11
Nodes (26): DropdownMenu(), DropdownMenuContent(), DropdownMenuGroup(), DropdownMenuItem(), DropdownMenuLabel(), DropdownMenuPortal(), DropdownMenuRadioGroup(), DropdownMenuSeparator() (+18 more)

### Community 21 - "health-handler.ts"
Cohesion: 0.14
Nodes (15): Route, Route, DbProbe, getHealth(), GetHealthDeps, buildHealthReport(), buildLiveReport(), HealthCheckState (+7 more)

### Community 22 - "Combobox and Input Groups"
Cohesion: 0.11
Nodes (12): ComboboxChip(), ComboboxClear(), ComboboxInput(), ComboboxTrigger(), InputGroup(), InputGroupAddon(), inputGroupAddonVariants, InputGroupButton() (+4 more)

### Community 23 - "api-key-repository.ts"
Cohesion: 0.14
Nodes (25): Route, prefixedBearer(), assertSameOrigin(), createKeyData(), deleteKeyData(), listKeysData(), requireManagedKey(), updateKeyData() (+17 more)

### Community 24 - "realtime-ws.ts"
Cohesion: 0.14
Nodes (15): describe(), logger, port, sockets, startRealtimeServer(), WS_HEARTBEAT_MS, WsData, appOriginAllowed() (+7 more)

### Community 25 - "API Keys Dashboard Page"
Cohesion: 0.13
Nodes (28): ApiKeyRow(), ConfirmDeleteDialog(), AlertDialog(), AlertDialogAction(), AlertDialogCancel(), AlertDialogContent(), AlertDialogDescription(), AlertDialogFooter() (+20 more)

### Community 26 - "recipient-repository.ts"
Cohesion: 0.18
Nodes (8): maskEmail(), maskWebhookUrl(), getChannelPreferences(), getRecipientSummary(), listRecipientKeys(), RecipientSummary, config, notification

### Community 27 - "env"
Cohesion: 0.05
Nodes (42): env, image, options, ports, env, runs-on, services, steps (+34 more)

### Community 28 - "Biome Config"
Cohesion: 0.08
Nodes (23): source, assist, actions, enabled, includes, files, includes, formatter (+15 more)

### Community 29 - "Package Scripts"
Cohesion: 0.08
Nodes (24): scripts, build, channels:work, check, db:business:generate, db:business:migrate, db:migrate, db:up (+16 more)

### Community 30 - "Admin Sidebar UI"
Cohesion: 0.16
Nodes (18): AdminSidebar(), DASHBOARD_NAV, DashboardNavGroup, DashboardNavItem, initialsOf(), SiteSwitcher(), ThemeToggle(), UserMenu() (+10 more)

### Community 31 - "webpush.plugin.ts"
Cohesion: 0.17
Nodes (10): ChannelFact, isPushServiceEndpoint(), PUSH_HOST_SUFFIXES, PUSH_HOSTS, createWebpushChannel(), WebpushDeps, WebpushSender, parseWebpushStyle() (+2 more)

### Community 32 - "Semantic design tokens centralised for light and dark themes"
Cohesion: 0.15
Nodes (6): DESIGN.md as the styling authority, Status alerts: muted background, readable foreground, icon, subtle border, DESIGN.md frontend styling authority, Standard semantic token set: core, brand, neutral, status, destructive, WCAG AA contrast: 4.5:1 text, 3:1 large text and non-text, Module map: http, observability, db, config, env, security, modules

### Community 33 - "Sidebar Components"
Cohesion: 0.14
Nodes (12): SidebarContext, SidebarContextProps, SidebarInput(), SidebarMenuButton(), sidebarMenuButtonVariants, SidebarRail(), useSidebar(), Tooltip() (+4 more)

### Community 34 - "Components Config"
Cohesion: 0.09
Nodes (21): aliases, components, hooks, lib, ui, utils, iconLibrary, menuAccent (+13 more)

### Community 35 - "webhook.plugin.ts"
Cohesion: 0.11
Nodes (21): getRecipientChannelAddress(), emailChannel, inappChannel, AppChannelSettings, ChannelSendInput, ChannelStatus, NotificationChannel, validateChannelManifest() (+13 more)

### Community 36 - "Outbound Webhook Safety"
Cohesion: 0.16
Nodes (12): ipv6Groups(), isPublicAddress(), isPublicIPv4(), isPublicIPv6(), WEBHOOK_URL_MAX_LENGTH, ChannelError, blocked(), guardedLookup() (+4 more)

### Community 37 - "HttpError"
Cohesion: 0.10
Nodes (23): @lst97-oss/last-httprism, Route, Route, Route, ErrorCode, toHttpError(), fail(), mergeHeaders() (+15 more)

### Community 38 - "Notification Schemas"
Cohesion: 0.09
Nodes (21): CONTACT_CHANNELS, ContactChannelKind, DEFAULT_CHANNELS, NOTIFICATION_CHANNELS, archiveBodySchema, channelSchema, contactBodySchema, contactClearQuerySchema (+13 more)

### Community 39 - "TypeScript Config"
Cohesion: 0.09
Nodes (21): compilerOptions, allowImportingTsExtensions, jsx, lib, module, moduleResolution, noEmit, noFallthroughCasesInSwitch (+13 more)

### Community 40 - "environment"
Cohesion: 0.30
Nodes (23): AUTH_BOOTSTRAP_EMAIL, BETTER_AUTH_SECRET, BETTER_AUTH_URL, BUSINESS_DATABASE_URL, DATABASE_URL, GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, HOST (+15 more)

### Community 41 - "Toast and Root Shell"
Cohesion: 0.17
Nodes (17): next-themes@^0.4.6, next-themes, Toast(), ToastAction(), ToastClose(), ToastContent(), ToastDescription(), Toaster() (+9 more)

### Community 42 - "shadcn rules: use registry, owned source, providers once in root shell"
Cohesion: 0.36
Nodes (5): shadcn registry components in src/components/ui, Shell providers in __root.tsx: ThemeProvider and Base-UI Toaster, withPayloadRoot in src/routes/__root.tsx, Global providers mount once in src/routes/__root.tsx, src/components/ui shadcn registry (base-nova, neutral, lucide); components.json and template-owned files

### Community 43 - "dashboard-shell.tsx"
Cohesion: 0.18
Nodes (14): DashboardShell(), SidebarInset(), SidebarProvider(), SidebarTrigger(), authClient, fetchSessionState(), SESSION_QUERY_KEY, SessionPrincipalClient (+6 more)

### Community 45 - "Stats Queries"
Cohesion: 0.20
Nodes (17): AppDashboardStats, AppDetail, ChannelBreakdown, FleetDashboardStats, getAppStats(), getFleetStats(), rangeStart(), readBreakdowns() (+9 more)

### Community 46 - "Channel Plugin Docs"
Cohesion: 0.16
Nodes (15): Dead letter, Stale push endpoint purge, Push subscription, VAPID keys, Web Push channel, ChannelError(code), Channel plugin, describe() operator facts (+7 more)

### Community 47 - "Button"
Cohesion: 0.10
Nodes (52): lucide-react, @tanstack/react-form, @tanstack/react-query, AdminLogin(), ApiKeyCreateDialog(), CreatedKey, EXPIRY_SECONDS, ExpiryChoice (+44 more)

### Community 48 - "payload-logger.ts"
Cohesion: 0.23
Nodes (8): LogLevel, levelFromPino(), PayloadLogDestination, payloadLogDestination(), payloadLoggerConfig(), PINO_KEYS, Redact, SETTINGS

### Community 49 - "Syntax Highlighter"
Cohesion: 0.17
Nodes (14): shiki@^4.6.0, @shikijs/core@^4.6.0, shiki, @shikijs/core, highlighterFor(), Loaded, loads, useHighlightedCode() (+6 more)

### Community 50 - "router.tsx"
Cohesion: 0.16
Nodes (10): @tanstack/react-router-ssr-query@latest, @tanstack/react-router-ssr-query, getContext(), SiteError(), SiteNotFound(), getRouter(), Register, @tanstack/react-router (+2 more)

### Community 51 - "Drawer UI"
Cohesion: 0.17
Nodes (7): DrawerContent(), DrawerContext, DrawerContextProps, DrawerOverlay(), DrawerPortal(), DrawerSwipeHandle(), useDrawer()

### Community 52 - "Email Channel Docs"
Cohesion: 0.20
Nodes (12): Email channel (SMTP), Email theme options (data.email), Signed unsubscribe link (HMAC), Channel switches (app and recipient), Webhook signature header, Per-app webhook signing secret, verifyWebhook example, BETTER_AUTH_SECRET (+4 more)

### Community 53 - "admin-schemas.ts"
Cohesion: 0.13
Nodes (14): zod, appCreateSchema, appKeySchema, appUpdateSchema, channelPatchSchema, deliveriesQuerySchema, deliveryIdSchema, keyCreateSchema (+6 more)

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
Cohesion: 0.15
Nodes (7): channel-worker and channel-delivery: lease, retries, dead letter, purge, Inbox archive, restore and archive-all-read with 30-day retention (migration 0006), Inbox order=desc, unread count and latest stream cursor, Docker compose services: migrate, app, worker, ws, GET inbox keyset page with unread count and latest cursor, SSE stream with Last-Event-ID resume, WebSocket gateway on WS_PORT (default 3001)

### Community 59 - "Business API reference"
Cohesion: 0.24
Nodes (12): Auth API reference, Business API reference, OpenAPI document (/api/openapi.json), OpenAPI plugin switch, App-bound service key, Dashboard, Permission set (resource:verb), Service key (lnk_) (+4 more)

### Community 61 - "attachment.tsx"
Cohesion: 0.20
Nodes (5): Attachment(), AttachmentAction(), AttachmentMedia(), attachmentMediaVariants, attachmentVariants

### Community 62 - "x-app-environment"
Cohesion: 0.10
Nodes (20): x-app-environment, AUTH_BOOTSTRAP_EMAIL, BETTER_AUTH_SECRET, BETTER_AUTH_URL, BUSINESS_DATABASE_URL, DATABASE_URL, GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET (+12 more)

### Community 64 - "Publishing Docs"
Cohesion: 0.22
Nodes (9): Recommended permission sets, Delivery id header (x-last-notifications-delivery), Dedupe key, Notification, Notification priority, Publish body and limits, Publish endpoint, recipientKey (opaque recipient id) (+1 more)

### Community 66 - "channel-config-handler.ts"
Cohesion: 0.23
Nodes (12): Route, Route, Route, getAppChannelSettings(), setAppChannelSecret(), setAppChannelSecretIfAbsent(), setAppChannelSetting(), getChannelsData() (+4 more)

### Community 67 - "business-auth.ts"
Cohesion: 0.05
Nodes (48): better-auth@1.7.10, better-auth, allowedOrigin(), respondWithCors(), Route, Route, businessApiKeyPlugin(), businessAuthEnvSchema (+40 more)

### Community 68 - "Boot Contract Docs"
Cohesion: 0.15
Nodes (11): drizzle/business committed DDL applied by db:business:migrate, handleServerFunctions Flight Response passed through unchanged, payloadParseSearch and payloadStringifySearch in src/router.tsx, Payload CMS v4 (4.0.0-beta.4), TanStack Start (RSC, Nitro), Release v0.5.0: Payload 4.0.0-beta.4 and src/payload layout, Business Postgres database for identities, apps, keys, notifications, deliveries, Notification console at /dashboard (+3 more)

### Community 70 - "class-variance-authority"
Cohesion: 0.39
Nodes (6): class-variance-authority@^0.7.1, class-variance-authority, ToggleGroupContext, ToggleGroupItem(), Toggle(), toggleVariants

### Community 71 - "Realtime Endpoint Docs"
Cohesion: 0.29
Nodes (9): Recipient token (lrt_), App (tenant), Last Notifications, Inbox read endpoint, Registered origin rule for browser calls, Inbox cursor, Last-Event-ID resume, SSE stream endpoint (+1 more)

### Community 72 - "Self-hosting Docs"
Cohesion: 0.27
Nodes (7): Email deliverability (SPF, DKIM, DMARC), Channel worker (channels:work), Plugin migrations folder, Business database (BUSINESS_DATABASE_URL), Docker Compose production deployment, Local setup, Three-process topology (app, worker, gateway)

### Community 73 - "ws"
Cohesion: 0.17
Nodes (12): depends_on, migrate, condition, ws, depends_on, command, depends_on, extra_hosts (+4 more)

### Community 74 - "Navigation Menu UI"
Cohesion: 0.24
Nodes (4): NavigationMenu(), NavigationMenuPositioner(), NavigationMenuTrigger(), navigationMenuTriggerStyle

### Community 75 - "drizzle-orm"
Cohesion: 0.15
Nodes (21): drizzle-orm, account, apikey, session, verification, appChannels, createdAt(), createdAtMs() (+13 more)

### Community 76 - "api-key-scopes.ts"
Cohesion: 0.10
Nodes (25): chooseApp(), fetchAppChannels(), adminFormSchema, adminSignupSchema, apiKeyCreateFormSchema, apiKeyEditFormSchema, appFormSchema, API_KEY_SCOPES (+17 more)

### Community 77 - "Leaderboard UI"
Cohesion: 0.44
Nodes (7): Leaderboard(), LeaderboardItem, Progress(), ProgressIndicator(), ProgressLabel(), ProgressTrack(), ProgressValue()

### Community 78 - "payload-shutdown.ts"
Cohesion: 0.33
Nodes (7): cachedPayloads(), countFailures(), Destroyable, destroyCachedPayloads(), drainAll(), logger, payloadShutdownPlugin()

### Community 79 - "channel-delivery.ts"
Cohesion: 0.13
Nodes (22): logger, startedAt, stop(), stopController, wake(), AppChannelRuntime, loadAppChannelRuntime(), purgeExpiredRecipientTokens() (+14 more)

### Community 80 - "Compose Stack Docs"
Cohesion: 0.29
Nodes (10): environment, app service (Dockerfile build, loopback APP_PORT), migrate service (db:migrate then db:business:migrate), name, postgres:16 local service on 127.0.0.1:5435, SECRET_ENCRYPTION_KEY pass-through (default empty), volumes, pgdata (+2 more)

### Community 81 - "Channel plugin contract: trusted TypeScript module with NotificationChannel type"
Cohesion: 0.17
Nodes (14): Channel plugin contract with install list, ChannelError and describe, Webhook channel as the outbound HTTP reference plugin, Better Auth reference at /api/auth/reference, Fumadocs guides at /docs with search, OpenAPI document and self-hosted Scalar reference, Business API route table, Channel kinds: in-app, email, browser push, webhook, Channel plugin contract: trusted TypeScript module with NotificationChannel type (+6 more)

### Community 83 - "ws"
Cohesion: 0.13
Nodes (15): disable, command, extra_hosts, healthcheck, image, restart, migrate, worker (+7 more)

### Community 84 - "notification-handler.ts"
Cohesion: 0.17
Nodes (32): Route, Route, Route, RFC-8058, parseJsonBody(), parseWith(), requireServiceKey(), webhookUrlProblem() (+24 more)

### Community 85 - "permissions.mdx"
Cohesion: 0.33
Nodes (5): Features, How a key is checked, Permission reference, Recommended sets, Why a token needs no inbox permission

### Community 86 - "sheet.tsx"
Cohesion: 0.26
Nodes (8): Sheet(), SheetContent(), SheetDescription(), SheetHeader(), SheetOverlay(), SheetPortal(), SheetTitle(), Sidebar()

### Community 87 - "logger-format.ts"
Cohesion: 0.17
Nodes (20): cellValue(), errorKey(), formatJson(), formatPretty(), formatTime(), inlineValue(), isRecord(), isRecordList() (+12 more)

### Community 88 - "services"
Cohesion: 0.14
Nodes (14): POSTGRES_DB, POSTGRES_PASSWORD, POSTGRES_USER, interval, retries, test, timeout, environment (+6 more)

### Community 89 - "Filename Sanitizer"
Cohesion: 0.43
Nodes (6): encoder, replaceMatches(), Replacement, sanitize(), sanitizeFilename(), truncateUtf8()

### Community 90 - "Error Envelope Docs"
Cohesion: 0.33
Nodes (5): Error code, ErrorTable reference, Liveness and readiness probes, x-request-id header, Response envelope

### Community 91 - "shell.tsx"
Cohesion: 0.15
Nodes (16): CHANNEL_PANELS, EmailChannelPanel, CHANNEL_LABELS, channelLabel(), ChannelPanelProps, ChannelPanelShell(), ChannelView, CardAction() (+8 more)

### Community 92 - "Payload Admin CSS Generator"
Cohesion: 0.47
Nodes (5): collect(), main(), ROOTS, SKIPPED, toSpecifier()

### Community 93 - "Smoke Test Script"
Cohesion: 0.33
Nodes (3): base, Check, checks

### Community 95 - "ref_bun_test"
Cohesion: 0.27
Nodes (9): appChannelSettings(), Env, masterKey(), newSigningSecret(), openSecret(), sealSecret(), SecretBoxError, KEY (+1 more)

### Community 96 - "business-sql.ts"
Cohesion: 0.13
Nodes (22): BusinessDb, closeBusinessSql(), getBusinessDb(), getBusinessSql(), toBunSqlUrl(), user, instanceAdmins, createInitialAdmin() (+14 more)

### Community 97 - "Delivery channel"
Cohesion: 0.33
Nodes (5): Delivery channel, inapp channel, Per-recipient webhook URL, Webhook retry classification, Webhook channel

### Community 100 - "code-block.tsx"
Cohesion: 0.24
Nodes (6): CodeBlock(), CodeBlockContent(), CodeBlockCopyButton(), CodeBlockLine(), codeBlockLineVariants, codeBlockVariants

### Community 112 - "react-dom"
Cohesion: 0.47
Nodes (4): react-dom@^19.3.1, react-dom, RadioGroup(), RadioGroupItem()

### Community 113 - "vite-logger.ts"
Cohesion: 0.23
Nodes (14): classifyEnvRunnerLine(), classifyViteLine(), consolaLevel(), plainLines(), routeConsola(), routeDevToolLogs(), routeEnvRunnerWarnings(), Rule (+6 more)

### Community 115 - "path"
Cohesion: 0.29
Nodes (10): env_file, path, required, env_file, env_file, env_file, x-app-service, env_file (+2 more)

### Community 116 - "app"
Cohesion: 0.20
Nodes (10): build, extra_hosts, image, ports, restart, stop_grace_period, BUN_VERSION, args (+2 more)

### Community 117 - "bubble.tsx"
Cohesion: 0.38
Nodes (4): Bubble(), BubbleReactions(), bubbleReactionsVariants, bubbleVariants

### Community 120 - "cn"
Cohesion: 0.10
Nodes (16): cn, react, ApiKeyScopePicker(), TurnstileApi, Window, Accordion(), AccordionContent(), AccordionItem() (+8 more)

### Community 124 - "logger.ts"
Cohesion: 0.26
Nodes (9): createLogger(), getRequestLogger(), LogFields, Logger, LogWriter, makeLogger(), sanitize(), sanitizeLogFields() (+1 more)

### Community 125 - "webhook.config.ts"
Cohesion: 0.13
Nodes (14): defaultEnv(), definePluginConfig(), loadPluginConfig(), PluginConfigDef, SecretRef, MIN_SIGNING_SECRET_LENGTH, ResolvedWebhookConfig, webhookConfigDef (+6 more)

### Community 126 - "chart.tsx"
Cohesion: 0.18
Nodes (12): recharts@3.8.0, recharts, ChartConfig, ChartContext, ChartContextProps, ChartLegendContent(), ChartStyle(), getPayloadConfigFromPayload() (+4 more)

### Community 127 - "logger-settings.ts"
Cohesion: 0.31
Nodes (7): choose(), LEVEL_ORDER, levelAtLeast(), LEVELS, LogFormat, LogSettings, resolveLogSettings()

### Community 129 - "unsubscribe-page.ts"
Cohesion: 0.67
Nodes (4): page(), unsubscribeConfirmPage(), unsubscribedPage(), escapeHtml()

## Ambiguous Edges - Review These
- `Pre-rename keys are not upgraded; reissue them` → `Migration 0007 adds app_channels.signing_secret_encrypted`  [AMBIGUOUS]
  CHANGELOG.md · relation: conceptually_related_to
- `Pre-rename keys are not upgraded; reissue them` → `notifications:write removed; subscribers renamed to recipients`  [AMBIGUOUS]
  CHANGELOG.md · relation: conceptually_related_to
- `Migration 0005 widens channel CHECK constraints` → `Channel names validated by zod and plugin registry, not CHECK constraints`  [AMBIGUOUS]
  CHANGELOG.md · relation: conceptually_related_to
- `notifications:write removed; subscribers renamed to recipients` → `PUT contact accepts channel webhook; doc says subscribers:write`  [AMBIGUOUS]
  CHANGELOG.md · relation: conceptually_related_to
- `better-auth: lnk_ API keys, session cookie, instance_admins` → `claims there is no auth wrapper (withAuth 501 stub)`  [AMBIGUOUS]
  src/server/README.md · relation: conceptually_related_to
- `Business migrations rebuilt as one file per domain (0000 to 0004)` → `notifications.inapp column (migration 0004, default true)`  [AMBIGUOUS]
  CHANGELOG.md · relation: conceptually_related_to
- `Auth API reference` → `Response envelope`  [AMBIGUOUS]
  content/docs/api-reference.mdx · relation: conceptually_related_to

## Knowledge Gaps
- **40 isolated node(s):** `RFC-8058`, `RFC-8058`, `RFC-8058`, `shared kernel auto-synced from the canonical template`, `Release v0.4.0: Payload beta.2, kernel auto-sync, schema drift test` (+35 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 713 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **23 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `@tanstack/react-router` connect `notification-handler.ts` to `@payloadcms/tanstack-start`, `dashboard.apps_.$appKey.tsx`, `Package Dependencies`, `payload.config.ts`, `dashboard.apps.tsx`, `admin-apps.ts`, `Deliveries Dashboard Page`, `HttpError`, `Docs Site Routing`, `Package Build Dependencies`, `health-handler.ts`, `api-key-repository.ts`, `API Keys Dashboard Page`, `Admin Sidebar UI`, `HttpError`, `Toast and Root Shell`, `dashboard-shell.tsx`, `Button`, `router.tsx`, `channel-config-handler.ts`, `business-auth.ts`, `notification-handler.ts`?**
  _High betweenness centrality (0.133) - this node is a cross-community bridge._
- **What connects `RFC-8058`, `RFC-8058`, `RFC-8058` to the rest of the system?**
  _40 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `stream-bus.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.09619450317124736 - nodes in this community are weakly interconnected._
- **Why does `react` connect `cn` to `@base-ui/react`, `@payloadcms/tanstack-start`, `dashboard.apps_.$appKey.tsx`, `Package Dependencies`, `dashboard.apps.tsx`, `Deliveries Dashboard Page`, `Docs Site Routing`, `Package Build Dependencies`, `Dropdown and Menubar UI`, `Combobox and Input Groups`, `API Keys Dashboard Page`, `Admin Sidebar UI`, `Sidebar Components`, `Toast and Root Shell`, `Context Menu UI`, `Button`, `Syntax Highlighter`, `router.tsx`, `Drawer UI`, `Collapsible Trace UI`, `attachment.tsx`, `message.tsx`, `marker.tsx`, `class-variance-authority`, `sheet.tsx`, `shell.tsx`, `code-block.tsx`, `bubble.tsx`, `chart.tsx`?**
  _High betweenness centrality (0.078) - this node is a cross-community bridge._
- **Should `@base-ui/react` be split into smaller, more focused modules?**
  _Cohesion score 0.125 - nodes in this community are weakly interconnected._

### Low-confidence Hints
_AMBIGUOUS edges — the extractor was unsure. Verify before acting on these._

- **What is the exact relationship between `Pre-rename keys are not upgraded; reissue them` and `Migration 0007 adds app_channels.signing_secret_encrypted`?**
  _Edge tagged AMBIGUOUS (relation: conceptually_related_to) - confidence is low._
- **What is the exact relationship between `Pre-rename keys are not upgraded; reissue them` and `notifications:write removed; subscribers renamed to recipients`?**
  _Edge tagged AMBIGUOUS (relation: conceptually_related_to) - confidence is low._