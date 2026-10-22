import { Line, LineChart, YAxis } from 'recharts'

/** A single plain curve: no axes, grid, legend or tooltip. */
export function Sparkline({
  values,
  max,
  width = 120,
  height = 30,
  color = '#e6e6e6'
}: {
  values: number[]
  max?: number
  width?: number
  height?: number
  color?: string
}) {
  const data = values.map((v, i) => ({ i, v }))
  return (
    <LineChart width={width} height={height} data={data} margin={{ top: 2, right: 2, bottom: 2, left: 2 }}>
      <YAxis hide domain={[0, max ?? 'auto']} />
      <Line type="monotone" dataKey="v" stroke={color} strokeWidth={1.5} dot={false} isAnimationActive={false} />
    </LineChart>
  )
}
