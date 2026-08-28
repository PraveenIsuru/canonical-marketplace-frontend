import { formatUtcDay } from '@/lib/format/dates';
import type { DailyViews } from '@/types/analytics';

/**
 * The daily series, drawn as two overlaid bars per day.
 *
 * The pale bar is every view of the products this store carries. The solid bar in
 * front of it is the share that reached this store. Overlaid rather than side by side
 * because one genuinely contains the other, and two separate bars would invite a
 * seller to add them together.
 *
 * **Every day in the range is drawn, including the empty ones.** The API zero fills
 * the series for exactly this reason, and skipping the zeros here would put the gaps
 * straight back in and make a quiet week look like a broken endpoint.
 *
 * Inline SVG rather than a charting library. Thirty bars and two rectangles each does
 * not justify a dependency, and this way the chart inherits the page's colours.
 */
export function ViewsChart({ daily }: { daily: DailyViews[] }) {
  if (daily.length === 0) return null;

  const ceiling = Math.max(1, ...daily.map((day) => day.product_views));

  // A fixed viewBox scaled by CSS, so the chart is responsive without measuring.
  const height = 120;
  const gap = 2;
  const slot = 10;
  const width = daily.length * slot;

  /*
   * Labels only at the ends and the middle. One per day would be unreadable at thirty
   * days and illegible at a year, and the table below carries every exact figure
   * anyway.
   */
  const labelled = [0, Math.floor(daily.length / 2), daily.length - 1];

  return (
    <figure className="flex flex-col gap-2">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="none"
        role="img"
        aria-label={`Daily views from ${formatUtcDay(daily[0].date)} to ${formatUtcDay(
          daily[daily.length - 1].date,
        )}. The exact figures are in the table below.`}
        className="h-32 w-full"
      >
        {daily.map((day, index) => {
          const total = (day.product_views / ceiling) * height;
          const mine = (day.store_views / ceiling) * height;

          return (
            <g key={day.date}>
              {/*
                A title on each bar, so a pointer reveals the day without the chart
                needing interactive state. Screen readers get the table instead.
              */}
              <title>
                {`${formatUtcDay(day.date)}: ${day.store_views} of ${day.product_views}`}
              </title>
              <rect
                x={index * slot}
                y={height - total}
                width={slot - gap}
                height={total}
                className="fill-zinc-200 dark:fill-zinc-800"
              />
              <rect
                x={index * slot}
                y={height - mine}
                width={slot - gap}
                height={mine}
                className="fill-zinc-900 dark:fill-zinc-100"
              />
            </g>
          );
        })}
      </svg>

      <div className="flex justify-between text-xs text-zinc-500 dark:text-zinc-400">
        {labelled.map((index) => (
          <span key={index}>{formatUtcDay(daily[index].date)}</span>
        ))}
      </div>

      <figcaption className="flex flex-wrap items-center gap-4 text-xs text-zinc-500 dark:text-zinc-400">
        <span className="flex items-center gap-1.5">
          <span aria-hidden="true" className="h-2.5 w-2.5 rounded-sm bg-zinc-900 dark:bg-zinc-100" />
          Reached your store
        </span>
        <span className="flex items-center gap-1.5">
          <span aria-hidden="true" className="h-2.5 w-2.5 rounded-sm bg-zinc-200 dark:bg-zinc-800" />
          All views of the same products
        </span>
      </figcaption>
    </figure>
  );
}
