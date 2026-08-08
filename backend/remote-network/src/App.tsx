import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { Area } from '@/components/charts/area'
import { AreaChart } from '@/components/charts/area-chart'
import { Bar } from '@/components/charts/bar'
import { BarChart } from '@/components/charts/bar-chart'
import { BarXAxis } from '@/components/charts/bar-x-axis'
import { Grid } from '@/components/charts/grid'
import { ChartTooltip } from '@/components/charts/tooltip'
import { XAxis } from '@/components/charts/x-axis'
import { cn } from '@/lib/utils'

const SESSION_API_KEY = 'displayControlApiKeySession'
const SERVER_URL_KEY = 'displayControlServerUrl'

const TARGET_LABELS: Record<string, string> = {
  internet: 'Internet',
  gateway: 'Gateway',
  dns: 'DNS',
}

type TargetLatency = { name: string; latencyMs: number | null }
type HistoryPoint = {
  at: string
  rxBps: number | null
  txBps: number | null
  latencyMs: number | null
}

type NetworkSummary = {
  available?: boolean
  online?: boolean
  latencyMs?: number | null
  publicIp?: string | null
  interface?: string | null
  targets?: TargetLatency[]
  history?: HistoryPoint[]
  windowSamples?: number
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

function toKbps(bps: number) {
  return Math.round((bps / 1024) * 10) / 10
}

export default function App() {
  const [summary, setSummary] = useState<NetworkSummary | null>(null)
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
      const response = await fetch(`${baseUrl}/api/network/summary`, {
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
        },
      })
      if (!response.ok) {
        throw new Error(`Request failed (${response.status})`)
      }
      const data = (await response.json()) as NetworkSummary
      setSummary(data)
      if (data.available === false) {
        setState('offline')
        return
      }
      const hasSeries =
        (data.history?.some((h) => h.rxBps != null || h.latencyMs != null) ?? false) ||
        (data.targets?.some((t) => t.latencyMs != null) ?? false)
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
    window.addEventListener('network:refresh', onRefresh)
    return () => window.removeEventListener('network:refresh', onRefresh)
  }, [load])

  const rateData =
    summary?.history
      ?.filter((row) => row.rxBps != null)
      .map((row) => ({
        date: new Date(row.at),
        rxKbps: toKbps(row.rxBps as number),
      })) ?? []

  const latencyData =
    summary?.history
      ?.filter((row) => row.latencyMs != null)
      .map((row) => ({
        date: new Date(row.at),
        latencyMs: row.latencyMs as number,
      })) ?? []

  const targetData =
    summary?.targets?.map((row) => ({
      name: TARGET_LABELS[row.name] || row.name,
      latencyMs: row.latencyMs == null ? 0 : Math.round(row.latencyMs),
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
        <StatusMessage message="Network service offline — charts unavailable." />
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
        <StatusMessage message="No samples yet — wait for the next probe cycle." />
      </div>
    )
  }

  return (
    <div className="analytics-charts">
      <ChartCard title="Download rate">
        {rateData.length < 2 ? (
          <StatusMessage message="Need more samples for the rate chart." />
        ) : (
          <AreaChart
            aspectRatio="16 / 9"
            data={rateData}
            margin={{ top: 16, right: 12, bottom: 28, left: 12 }}
            xDataKey="date"
          >
            <Grid horizontal />
            <Area
              dataKey="rxKbps"
              fill="var(--chart-line-primary)"
              stroke="var(--chart-line-primary)"
            />
            <XAxis />
            <ChartTooltip />
          </AreaChart>
        )}
      </ChartCard>

      <ChartCard title="Latency">
        {latencyData.length < 2 ? (
          <StatusMessage message="Need more samples for the latency chart." />
        ) : (
          <AreaChart
            aspectRatio="16 / 9"
            data={latencyData}
            margin={{ top: 16, right: 12, bottom: 28, left: 12 }}
            xDataKey="date"
          >
            <Grid horizontal />
            <Area
              dataKey="latencyMs"
              fill="var(--chart-3)"
              stroke="var(--chart-3)"
            />
            <XAxis />
            <ChartTooltip />
          </AreaChart>
        )}
      </ChartCard>

      <ChartCard title="Target latencies">
        {targetData.length === 0 ? (
          <StatusMessage message="No target probes yet." />
        ) : (
          <BarChart
            aspectRatio="16 / 9"
            data={targetData}
            margin={{ top: 16, right: 12, bottom: 28, left: 12 }}
            xDataKey="name"
          >
            <Grid horizontal />
            <Bar dataKey="latencyMs" fill="var(--chart-line-primary)" lineCap={4} />
            <BarXAxis maxLabels={6} showAllLabels />
            <ChartTooltip />
          </BarChart>
        )}
      </ChartCard>
    </div>
  )
}
