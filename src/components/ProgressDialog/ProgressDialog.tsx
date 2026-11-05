import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { quizBones } from '@/data/bones'
import { allLandmarks } from '@/data/landmarks'
import { bandFor, masteryByRegion } from '@/features/srs/mastery'
import { useSrsStore } from '@/features/srs/srsStore'
import { startWeakestWalk } from '@/features/srs/startWeakestWalk'
import { accuracyBy, dueForecast, retentionByDay, reviewsPerDay, streak, summarize } from '@/features/srs/stats'
import { useMasteryByBone, useNow } from '@/features/srs/useMastery'
import { useAnatomyStore } from '@/store/anatomyStore'
import { Flame, Map as MapIcon, Route } from 'lucide-react'
import { useMemo, type ReactNode } from 'react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

const AXIS = { fill: 'var(--muted-foreground)', fontSize: 10 }
const GRID = 'var(--border)'
const TOOLTIP = {
  contentStyle: { background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 6, fontSize: 12 },
  labelStyle: { color: 'var(--muted-foreground)' },
  cursor: { fill: 'rgb(255 255 255 / 0.04)' },
}

function percent(value: number | null): string {
  return value === null ? '—' : `${Math.round(value * 100)}%`
}

function Stat({ label, value, icon }: { label: string; value: string; icon?: ReactNode }) {
  return (
    <div className="rounded-xl border border-white/8 bg-white/3 px-3 py-3">
      <p className="kicker">{label}</p>
      <p className="mt-2 flex items-center gap-1.5 font-specimen text-[1.65rem] leading-none tracking-tight">
        {icon}
        {value}
      </p>
    </div>
  )
}

function ChartCard({ title, note, children }: { title: string; note?: string; children: ReactNode }) {
  return (
    <section className="rounded-xl border border-white/8 p-3">
      <div className="flex items-baseline justify-between gap-2">
        <h3 className="text-sm font-medium">{title}</h3>
        {note ? <p className="text-[11px] text-muted-foreground">{note}</p> : null}
      </div>
      <div className="mt-2 h-40">{children}</div>
    </section>
  )
}

export function ProgressDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const events = useSrsStore((state) => state.events)
  const cards = useSrsStore((state) => state.cards)
  const mastery = useMasteryByBone()
  const now = useNow()
  const setLook = useAnatomyStore((state) => state.setLook)
  const setStudyQueue = useAnatomyStore((state) => state.setStudyQueue)
  const totalCards = useMemo(() => {
    const quiz = new Set(quizBones().map((bone) => bone.id))
    return quiz.size + allLandmarks.filter((record) => quiz.has(record.boneId)).length
  }, [])
  const data = useMemo(
    () => ({
      summary: summarize(events, cards, now),
      streak: streak(events, now),
      perDay: reviewsPerDay(events, now, 30),
      retention: retentionByDay(events).slice(-30),
      forecast: dueForecast(cards, now, 14),
      regions: accuracyBy(events, 'region'),
      classes: accuracyBy(events, 'classification'),
      regionMastery: masteryByRegion(mastery),
    }),
    [cards, events, mastery, now],
  )
  const close = () => onOpenChange(false)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto p-5 sm:max-w-3xl">
        <DialogHeader>
          <p className="kicker">Spaced repetition</p>
          <DialogTitle className="font-specimen text-2xl leading-none tracking-tight">Your progress</DialogTitle>
          <DialogDescription>
            Spaced-repetition stats from every question you have answered on this device
            {events.length === 0 ? '. Answer a few study questions to fill this in.' : '.'}
          </DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
          <Stat label="Reviews" value={String(data.summary.reviews)} />
          <Stat label="Studied" value={`${data.summary.studied} / ${totalCards}`} />
          <Stat label="Due now" value={String(data.summary.dueNow)} />
          <Stat label="Accuracy" value={percent(data.summary.accuracy)} />
          <Stat label="Streak" value={`${data.streak} d`} icon={<Flame className="size-4 text-primary" />} />
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            size="sm"
            onClick={() => {
              setStudyQueue('review')
              close()
            }}
          >
            Start review
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => {
              setLook('mastery')
              close()
            }}
          >
            <MapIcon />
            Show mastery map
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={mastery.size === 0}
            onClick={() => {
              if (startWeakestWalk(mastery)) close()
            }}
          >
            <Route />
            Walk my weakest bones
          </Button>
        </div>
        <Tabs defaultValue="activity">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="activity">Activity</TabsTrigger>
            <TabsTrigger value="mastery">Mastery</TabsTrigger>
            <TabsTrigger value="accuracy">Accuracy</TabsTrigger>
          </TabsList>
          <TabsContent value="activity" className="mt-3 grid gap-3 sm:grid-cols-2">
            <ChartCard title="Reviews per day" note="Last 30 days">
              <ResponsiveContainer>
                <BarChart data={data.perDay}>
                  <CartesianGrid stroke={GRID} vertical={false} />
                  <XAxis dataKey="label" tick={AXIS} interval={6} tickLine={false} axisLine={false} />
                  <YAxis allowDecimals={false} tick={AXIS} width={28} tickLine={false} axisLine={false} />
                  <Tooltip {...TOOLTIP} />
                  <Bar dataKey="count" name="Reviews" fill="var(--chart-1)" radius={[2, 2, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>
            <ChartCard title="Due forecast" note="Next 14 days">
              <ResponsiveContainer>
                <BarChart data={data.forecast}>
                  <CartesianGrid stroke={GRID} vertical={false} />
                  <XAxis dataKey="label" tick={AXIS} interval={3} tickLine={false} axisLine={false} />
                  <YAxis allowDecimals={false} tick={AXIS} width={28} tickLine={false} axisLine={false} />
                  <Tooltip {...TOOLTIP} />
                  <Bar dataKey="count" name="Cards due" fill="var(--chart-3)" radius={[2, 2, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>
            <ChartCard title="Retention" note="Repeat reviews answered correctly">
              {data.retention.length === 0 ? (
                <p className="grid h-full place-items-center text-sm text-muted-foreground">
                  Shows up once you review a card a second time.
                </p>
              ) : (
                <ResponsiveContainer>
                  <LineChart data={data.retention}>
                    <CartesianGrid stroke={GRID} vertical={false} />
                    <XAxis dataKey="label" tick={AXIS} tickLine={false} axisLine={false} />
                    <YAxis
                      domain={[0, 1]}
                      tickFormatter={(value: number) => `${Math.round(value * 100)}%`}
                      tick={AXIS}
                      width={36}
                      tickLine={false}
                      axisLine={false}
                    />
                    <Tooltip {...TOOLTIP} formatter={(value) => percent(Number(value))} />
                    <Line
                      type="monotone"
                      dataKey="retention"
                      name="Retention"
                      stroke="var(--chart-1)"
                      strokeWidth={2}
                      dot={{ r: 2 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </ChartCard>
          </TabsContent>
          <TabsContent value="mastery" className="mt-3">
            <section className="rounded-xl border border-white/8 p-3">
              <h3 className="text-sm font-medium">Mastery by region</h3>
              <p className="text-[11px] text-muted-foreground">
                Mean estimated recall of studied bones. The mastery map paints the same numbers.
              </p>
              <ul className="mt-3 grid gap-2">
                {data.regionMastery.map((row) => (
                  <li key={row.region} className="grid grid-cols-[8rem_1fr_3rem_4rem] items-center gap-2 text-[12px]">
                    <span className="truncate">{row.label}</span>
                    <span className="h-2 overflow-hidden rounded-full bg-muted">
                      <span
                        className="block h-full rounded-full"
                        style={{
                          width: `${Math.round((row.average ?? 0) * 100)}%`,
                          background: row.average === null ? 'transparent' : bandFor(row.average).color,
                        }}
                      />
                    </span>
                    <span className="text-right font-mono">{percent(row.average)}</span>
                    <span className="text-right font-mono text-muted-foreground">
                      {row.studied}/{row.total}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          </TabsContent>
          <TabsContent value="accuracy" className="mt-3 grid gap-3 sm:grid-cols-2">
            {[
              { title: 'By region', rows: data.regions },
              { title: 'By classification', rows: data.classes },
            ].map((chart) => (
              <ChartCard key={chart.title} title={chart.title} note="Share of answers correct">
                {chart.rows.length === 0 ? (
                  <p className="grid h-full place-items-center text-sm text-muted-foreground">No answers yet.</p>
                ) : (
                  <ResponsiveContainer>
                    <BarChart data={chart.rows} layout="vertical" margin={{ left: 8 }}>
                      <CartesianGrid stroke={GRID} horizontal={false} />
                      <XAxis
                        type="number"
                        domain={[0, 1]}
                        tickFormatter={(value: number) => `${Math.round(value * 100)}%`}
                        tick={AXIS}
                        tickLine={false}
                        axisLine={false}
                      />
                      <YAxis type="category" dataKey="label" tick={AXIS} width={92} tickLine={false} axisLine={false} />
                      <Tooltip {...TOOLTIP} formatter={(value) => percent(Number(value))} />
                      <Bar dataKey="accuracy" name="Accuracy" radius={[0, 2, 2, 0]}>
                        {chart.rows.map((row) => (
                          <Cell key={row.key} fill={bandFor(row.accuracy).color} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </ChartCard>
            ))}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  )
}

export default ProgressDialog
