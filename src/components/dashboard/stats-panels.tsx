'use client'

import { Send } from 'lucide-react'
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Pie,
  PieChart,
  PolarAngleAxis,
  RadialBar,
  RadialBarChart,
  XAxis,
  YAxis,
} from 'recharts'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
} from '@/components/ui/chart'
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty'
import { Skeleton } from '@/components/ui/skeleton'
import { formatDay } from '@/lib/dashboard-format'

export type StatsSeriesPoint = {
  day: string
  published: number
  read: number
  delivered: number
  deadLetter: number
  pending: number
}

export type DeliveryTotals = {
  published: number
  read: number
  delivered: number
  deadLetter: number
  pending: number
  processing: number
}

// Hoisted so the chart context and the tooltip keep a stable identity
// instead of a fresh object on every render.
const ACTIVITY_CONFIG = {
  published: { label: 'Published', color: 'var(--chart-1)' },
  deadLetter: { label: 'Dead letters', color: 'var(--chart-2)' },
}
const STATUS_CONFIG = {
  delivered: { label: 'Delivered', color: 'var(--chart-1)' },
  pending: { label: 'Pending', color: 'var(--chart-2)' },
  deadLetter: { label: 'Dead letters', color: 'var(--chart-3)' },
  processing: { label: 'Processing', color: 'var(--chart-4)' },
}
const CHANNEL_CONFIG = {
  delivered: { label: 'Delivered', color: 'var(--chart-1)' },
  deadLetter: { label: 'Dead letters', color: 'var(--chart-2)' },
}
const RATE_CONFIG = { rate: { label: 'Read', color: 'var(--chart-1)' } }

export function StatCard({
  title,
  description,
  value,
  footnote,
  action,
}: {
  title: string
  description: string
  value: string
  footnote: string
  action?: React.ReactNode
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
        {action}
      </CardHeader>
      <CardContent>
        <p className="text-3xl font-semibold tabular-nums">{value}</p>
        <p className="text-xs text-muted-foreground">{footnote}</p>
      </CardContent>
    </Card>
  )
}

export function NotificationActivityPanel({
  days,
  windowPublished,
  series,
  className,
}: {
  days: number
  windowPublished: number
  series: StatsSeriesPoint[]
  className?: string
}) {
  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle>Notification activity</CardTitle>
        <CardDescription>Published and dead-lettered per day, last {days} days</CardDescription>
      </CardHeader>
      <CardContent>
        {windowPublished === 0 ? (
          <Empty>
            <EmptyHeader>
              <EmptyTitle>No notifications in this period</EmptyTitle>
              <EmptyDescription>Nothing was published in the last {days} days.</EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <ChartContainer config={ACTIVITY_CONFIG} className="aspect-auto h-[240px] w-full">
            <AreaChart accessibilityLayer data={series} margin={{ left: 12, right: 12 }}>
              <CartesianGrid vertical={false} />
              <XAxis
                dataKey="day"
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                minTickGap={24}
                tickFormatter={(value: string) => value.slice(5)}
              />
              <YAxis allowDecimals={false} tickLine={false} axisLine={false} width={32} />
              <ChartTooltip content={<ChartTooltipContent labelFormatter={(value) => formatDay(String(value))} />} />
              <Area
                dataKey="published"
                type="natural"
                fill="var(--color-published)"
                fillOpacity={0.4}
                stroke="var(--color-published)"
              />
              <Area
                dataKey="deadLetter"
                type="natural"
                fill="var(--color-deadLetter)"
                fillOpacity={0.4}
                stroke="var(--color-deadLetter)"
              />
            </AreaChart>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  )
}

export function DeliveryStatusPie({
  totals,
  emptyTitle,
  emptyDescription,
}: {
  totals: DeliveryTotals
  emptyTitle: string
  emptyDescription: string
}) {
  const rows = totals.delivered + totals.pending + totals.deadLetter + totals.processing
  return (
    <Card>
      <CardHeader>
        <CardTitle>Delivery status</CardTitle>
        <CardDescription>Async delivery rows by status</CardDescription>
      </CardHeader>
      <CardContent>
        {rows === 0 ? (
          <Empty>
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <Send />
              </EmptyMedia>
              <EmptyTitle>{emptyTitle}</EmptyTitle>
              <EmptyDescription>{emptyDescription}</EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <ChartContainer config={STATUS_CONFIG} className="mx-auto aspect-square max-h-[260px]">
            <PieChart accessibilityLayer>
              <ChartTooltip cursor={false} content={<ChartTooltipContent hideLabel nameKey="status" />} />
              <Pie
                data={[
                  { status: 'delivered', count: totals.delivered, fill: 'var(--color-delivered)' },
                  { status: 'pending', count: totals.pending, fill: 'var(--color-pending)' },
                  { status: 'deadLetter', count: totals.deadLetter, fill: 'var(--color-deadLetter)' },
                  { status: 'processing', count: totals.processing, fill: 'var(--color-processing)' },
                ]}
                dataKey="count"
                nameKey="status"
                innerRadius={48}
                outerRadius={72}
                paddingAngle={2}
              />
              <ChartLegend content={<ChartLegendContent nameKey="status" />} />
            </PieChart>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  )
}

export function ChannelActivityPanel({
  days,
  byChannel,
}: {
  days: number
  byChannel: { channel: string; delivered: number; deadLetter: number }[]
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Channels</CardTitle>
        <CardDescription>Finished deliveries per channel, last {days} days</CardDescription>
      </CardHeader>
      <CardContent>
        {byChannel.every((row) => row.delivered + row.deadLetter === 0) ? (
          <Empty>
            <EmptyHeader>
              <EmptyTitle>No channel activity</EmptyTitle>
              <EmptyDescription>No deliveries finished in the last {days} days.</EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <ChartContainer config={CHANNEL_CONFIG} className="aspect-auto h-[220px] w-full">
            <BarChart accessibilityLayer data={byChannel} margin={{ left: 12, right: 12 }}>
              <CartesianGrid vertical={false} />
              <XAxis dataKey="channel" tickLine={false} axisLine={false} tickMargin={8} />
              <YAxis allowDecimals={false} tickLine={false} axisLine={false} width={32} />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Bar dataKey="delivered" fill="var(--color-delivered)" radius={[4, 4, 0, 0]} />
              <Bar dataKey="deadLetter" fill="var(--color-deadLetter)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  )
}

export function ReadRatePanel({ totals }: { totals: { published: number; read: number } }) {
  const readRate = totals.published === 0 ? 0 : Math.round((totals.read / totals.published) * 100)
  return (
    <Card>
      <CardHeader>
        <CardTitle>Read rate</CardTitle>
        <CardDescription>Share of notifications marked read</CardDescription>
      </CardHeader>
      <CardContent>
        {totals.published === 0 ? (
          <Empty>
            <EmptyHeader>
              <EmptyTitle>No notifications to rate</EmptyTitle>
              <EmptyDescription>The rate appears once the first notification is published.</EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <div className="relative">
            <ChartContainer config={RATE_CONFIG} className="mx-auto aspect-square max-h-[220px]">
              <RadialBarChart
                accessibilityLayer
                data={[{ name: 'rate', value: readRate }]}
                startAngle={90}
                endAngle={-270}
                innerRadius="55%"
                outerRadius="100%"
              >
                <PolarAngleAxis type="number" domain={[0, 100]} tick={false} axisLine={false} />
                <RadialBar dataKey="value" fill="var(--color-rate)" cornerRadius={8} background />
              </RadialBarChart>
            </ChartContainer>
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-3xl font-semibold tabular-nums">{readRate}%</span>
              <span className="text-xs text-muted-foreground">read</span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

export function SkeletonCards() {
  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {[0, 1, 2, 3].map((index) => (
          <Skeleton key={index} className="h-24" />
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        <Skeleton className="h-72 lg:col-span-2" />
        <Skeleton className="h-72" />
      </div>
      <Skeleton className="h-40" />
    </div>
  )
}
