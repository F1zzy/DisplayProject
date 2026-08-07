import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { Area } from '@/components/charts/area'
import { AreaChart } from '@/components/charts/area-chart'
import { Bar } from '@/components/charts/bar'
import { BarChart } from '@/components/charts/bar-chart'
import { BarXAxis } from '@/components/charts/bar-x-axis'
import { BarYAxis } from '@/components/charts/bar-y-axis'
import { Grid } from '@/components/charts/grid'
import { ChartTooltip } from '@/components/charts/tooltip'
import { XAxis } from '@/components/charts/x-axis'
import { cn } from '@/lib/utils'

const SESSION_API_KEY = 'displayControlApiKeySession'
const SERVER_URL_KEY = 'displayControlServerUrl'

const WIDGET_LABELS: Record<string, string> = {
  stock: 'Stocks',
  news: 'News',
  timetable: 'Schedule',
  network: 'Network',
  sky: 'Night Sky',
  spotify: 'Spotify',
  f1: 'Formula 1',
}

type WidgetView = { key: string; views: number }
type HourBucket = { hour: number; events: number }
type ApiLatency = { path: string; avgMs: number; samples: number }

type AnalyticsSummary = {
  available?: boolean
  widgetViews?: WidgetView[]
  eventsByHour?: HourBucket[]
  apiLatency?: ApiLatency[]
  windowHours?: number
}

type LoadState = 'loading' | 'ready' | 'empty' | 'offline' | 'error'

function getCredentials() {
  const baseUrl = (
    localStorage.getItem(SERVER_URL_KEY) ||
    window.location.origin
  ).replace(/\/$/, '')
  const apiKey = sessionStorage.getItem(SESSION_API_KEY)?.trim() || ''
  return { baseUrl, apiKey }
}

function shortPath(path: string) {
  if (path.length <= 22) return path
  return `…${path.slice(-20)}`
}

function ChartCard({
  title,
  children,
  className,
}: {
  title: string
  children: ReactNode
  className?: string
}) {
  return (
    <section className={cn('analytics-chart-card', className)}>
      <h3 className="analytics-chart-title">{title}</h3>
      <div className="analytics-chart-body">{children}</div>
    </section>
  )
}

function StatusMessage({ message }: { message: string }) {
  return <p className="analytics-chart-status">{message}</p>
}

export default function App() {
  const [summary, setSummary] = useState<AnalyticsSummary | null>(null)
  const [state, setState] = useState<LoadState>('loading')

  const load = useCallback(async () => {
    setState('loading')
    const { baseUrl, apiKey } = getCredentials()
    if (!apiKey) {
      setSummary(null)
      setState('error')
      return
    }

    try {
      const response = await fetch(`${baseUrl}/api/analytics/summary`, {
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
        },
      })
      if (!response.ok) {
        throw new Error(`Request failed (${response.status})`)
      }
      const data = (await response.json()) as AnalyticsSummary
      setSummary(data)
      if (data.available === false) {
        setState('offline')
        return
      }
      const hasSeries =
        (data.widgetViews?.length ?? 0) > 0 ||
        (data.eventsByHour?.some((h) => h.events > 0) ?? false) ||
        (data.apiLatency?.length ?? 0) > 0
      setState(hasSeries ? 'ready' : 'empty')
    } catch {
      setSummary(null)
      setState('error')
    }
  }, [])

  useEffect(() => {
    void load()
    const onRefresh = () => {
      void load()
    }
    window.addEventListener('analytics:refresh', onRefresh)
    return () => window.removeEventListener('analytics:refresh', onRefresh)
  }, [load])

  const widgetData =
    summary?.widgetViews?.map((row) => ({
      name: WIDGET_LABELS[row.key] || row.key,
      views: row.views,
    })) ?? []

  const hourData =
    summary?.eventsByHour?.map((row) => ({
      date: new Date(2000, 0, 1, row.hour, 0, 0, 0),
      events: row.events,
      hour: row.hour,
    })) ?? []

  const latencyData =
    summary?.apiLatency?.map((row) => ({
      name: shortPath(row.path),
      avgMs: Math.round(row.avgMs),
      samples: row.samples,
      path: row.path,
    })) ?? []

  if (state === 'loading') {
    return (
      <div className="analytics-charts">
        <StatusMessage message="Loading charts…" />
      </div>
    )
  }

  if (state === 'offline') {
    return (
      <div className="analytics-charts">
        <StatusMessage message="Service offline — charts unavailable." />
      </div>
    )
  }

  if (state === 'error') {
    return (
      <div className="analytics-charts">
        <StatusMessage message="Could not load chart data." />
      </div>
    )
  }

  if (state === 'empty') {
    return (
      <div className="analytics-charts">
        <StatusMessage message="No data yet for the last 24 hours." />
      </div>
    )
  }

  return (
    <div className="analytics-charts">
      <ChartCard title="Widget views">
        {widgetData.length === 0 ? (
          <StatusMessage message="No widget views yet." />
        ) : (
          <BarChart
            aspectRatio="16 / 9"
            data={widgetData}
            margin={{ top: 16, right: 12, bottom: 28, left: 12 }}
            xDataKey="name"
          >
            <Grid horizontal />
            <Bar dataKey="views" fill="var(--chart-line-primary)" lineCap={4} />
            <BarXAxis maxLabels={8} showAllLabels />
            <ChartTooltip />
          </BarChart>
        )}
      </ChartCard>

      <ChartCard title="Activity by hour">
        {hourData.every((d) => d.events === 0) ? (
          <StatusMessage message="No events yet." />
        ) : (
          <AreaChart
            aspectRatio="16 / 9"
            data={hourData}
            margin={{ top: 16, right: 12, bottom: 28, left: 12 }}
            xDataKey="date"
          >
            <Grid horizontal />
            <Area
              dataKey="events"
              fill="var(--chart-line-primary)"
              stroke="var(--chart-line-primary)"
            />
            <XAxis />
            <ChartTooltip />
          </AreaChart>
        )}
      </ChartCard>

      <ChartCard title="Slowest APIs">
        {latencyData.length === 0 ? (
          <StatusMessage message="No API samples yet." />
        ) : (
          <BarChart
            aspectRatio="16 / 10"
            data={latencyData}
            margin={{ top: 12, right: 16, bottom: 12, left: 88 }}
            orientation="horizontal"
            xDataKey="name"
          >
            <Grid horizontal={false} vertical />
            <Bar dataKey="avgMs" fill="var(--chart-3)" lineCap={4} />
            <BarYAxis showAllLabels />
            <ChartTooltip />
          </BarChart>
        )}
      </ChartCard>
    </div>
  )
}
