'use client'

import { Link, useMatchRoute } from '@tanstack/react-router'
import {
  Bell,
  ChevronsUpDown,
  House,
  KeyRound,
  LayoutDashboard,
  LogOut,
  type LucideIcon,
  Moon,
  Send,
  Smartphone,
  Sun,
} from 'lucide-react'
import { useTheme } from 'next-themes'

import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from '@/components/ui/sidebar'
import { signOut, useSessionPrincipal } from '@/lib/business-auth-client'

type DashboardNavItem = {
  to: string
  label: string
  icon: LucideIcon
}

type DashboardNavGroup = {
  group: string
  items: DashboardNavItem[]
}

const DASHBOARD_NAV: DashboardNavGroup[] = [
  {
    group: 'Manage',
    items: [
      { to: '/dashboard', label: 'Overview', icon: LayoutDashboard },
      { to: '/dashboard/apps', label: 'Apps', icon: Smartphone },
      { to: '/dashboard/api-keys', label: 'API keys', icon: KeyRound },
      { to: '/dashboard/deliveries', label: 'Deliveries', icon: Send },
    ],
  },
]

// The brand row doubles as the account/instance switcher: one instance, one
// product, so the only navigation it offers is back to the consuming site.
function SiteSwitcher() {
  const { isMobile } = useSidebar()
  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <SidebarMenuButton
                size="lg"
                className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
              />
            }
          >
            <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground">
              <Bell className="size-4" aria-hidden />
            </span>
            <span className="grid flex-1 text-left text-sm leading-tight">
              <span className="truncate font-medium">Last Notifications</span>
              <span className="truncate text-xs text-muted-foreground">Dashboard</span>
            </span>
            <ChevronsUpDown className="ml-auto" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" side={isMobile ? 'bottom' : 'right'} sideOffset={4}>
            <DropdownMenuItem>
              <Link to="/" className="flex w-full items-center gap-2">
                <House />
                Back to site
              </Link>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  )
}

// Icons and labels swap on the `dark` class, as the site's own toggles do, so
// nothing depends on client-only state.
function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme()
  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <SidebarMenuButton tooltip="Switch theme" onClick={() => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')}>
          <Sun className="hidden dark:block" />
          <Moon className="block dark:hidden" />
          <span className="dark:hidden">Switch to dark mode</span>
          <span className="hidden dark:inline">Switch to light mode</span>
        </SidebarMenuButton>
      </SidebarMenuItem>
    </SidebarMenu>
  )
}

function initialsOf(name: string): string {
  return name
    .split(/[\s@._-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('')
}

function UserMenu() {
  const { isMobile } = useSidebar()
  const { principal } = useSessionPrincipal()
  const email = principal?.email ?? ''
  const name = principal?.displayName || email || 'Admin'

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <SidebarMenuButton
                size="lg"
                className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
              />
            }
          >
            <Avatar size="sm">
              <AvatarFallback>{initialsOf(name) || 'A'}</AvatarFallback>
            </Avatar>
            <span className="grid flex-1 text-left text-sm leading-tight">
              <span className="truncate font-medium">{name}</span>
              <span className="truncate text-xs text-muted-foreground">{email}</span>
            </span>
            <ChevronsUpDown className="ml-auto size-4" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" side={isMobile ? 'bottom' : 'right'} sideOffset={4}>
            <DropdownMenuGroup>
              <DropdownMenuLabel>
                <span className="grid gap-0.5">
                  <span className="truncate font-medium">{name}</span>
                  <span className="truncate font-normal text-muted-foreground">{email}</span>
                </span>
              </DropdownMenuLabel>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuItem variant="destructive" onClick={() => void signOut()}>
              <LogOut />
              Log out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  )
}

export function AdminSidebar() {
  const matchRoute = useMatchRoute()

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <SiteSwitcher />
      </SidebarHeader>
      <SidebarContent>
        {DASHBOARD_NAV.map((section) => (
          <SidebarGroup key={section.group}>
            <SidebarGroupLabel>{section.group}</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {section.items.map((item) => {
                  const Icon = item.icon
                  const isActive = Boolean(matchRoute({ to: item.to, fuzzy: true }))
                  return (
                    <SidebarMenuItem key={item.to}>
                      <SidebarMenuButton
                        render={<Link to={item.to} activeProps={{ 'data-active': true }} />}
                        tooltip={item.label}
                        isActive={isActive}
                      >
                        <Icon />
                        <span>{item.label}</span>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  )
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>
      <SidebarFooter>
        <ThemeToggle />
        <UserMenu />
      </SidebarFooter>
    </Sidebar>
  )
}
