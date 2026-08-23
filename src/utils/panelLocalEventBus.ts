import {
  BusEvent,
  BusEventBase,
  BusEventHandler,
  BusEventType,
  DataHoverEvent,
  EventBus,
  EventFilterOptions,
  FieldType,
} from '@grafana/data';
import { Observable, Unsubscribable, filter } from 'rxjs';

/** What the X values in a panel's cursor events mean. Only panels that agree can sync. */
export type CursorDomain = 'time' | 'numeric';

/** Tag every uPlot-backed panel puts on its cursor events. See `EventBusPlugin`. */
const UPLOT_TAG = 'uplot';

/**
 * Panel event bus that keeps this panel out of cursor-sync exchanges that would fight with
 * its own cursor. It drops two classes of incoming event:
 *
 * 1. Events this panel published itself.
 *
 *    The deprecated `TimeSeries` / `GraphNG` we render from @grafana/ui still carries the
 *    legacy cursor-sync subscriptions: it listens for `DataHoverEvent` and
 *    `DataHoverClearEvent` on the panel event bus and moves the uPlot cursor in response.
 *    Its clear handler does no origin check at all, so it also reacts to the panel's own
 *    events. Grafana's current core GraphNG dropped those subscriptions and left the job
 *    to `EventBusPlugin`; we render both, which closes a feedback loop:
 *
 *      EventBusPlugin publishes DataHoverClearEvent (cursor left the points)
 *        -> GraphNG receives its own event and calls setCursor(-10, -10)
 *        -> that fires uPlot's setLegend with no hovered index
 *        -> EventBusPlugin publishes another DataHoverClearEvent ... forever
 *
 *    The loop free-runs at the publish throttle (~10 cursor resets per second) from the
 *    first time the cursor leaves the points until the panel unmounts, and each reset kills
 *    the tooltip about 100ms after it opens — a tooltip that blinks on every hover.
 *
 * 2. Cursor events from another uPlot-backed panel.
 *
 *    `EventBusPlugin` tags what it publishes with `uplot` and ignores events carrying that
 *    tag, so between uPlot panels Grafana syncs cursors through uPlot's own sync groups and
 *    uses the event bus only to reach panels of other kinds. The legacy GraphNG predates
 *    that split and honours no tags, so it acts on the sibling charts' events as well —
 *    every clear event resets our cursor, we answer with a clear of our own, and the panels
 *    end up trading clears while the pointer sits still over a point.
 *
 * 3. Hover events whose X value is in a different domain than ours.
 *
 *    A hover event carries only a bare `point.time` number. From a numeric X-axis panel
 *    that number is a sample index; a time panel resolves it as an epoch and slams its
 *    cursor to the far edge of the plot, which fires its own hover event back, and the two
 *    panels then chase each other's cursor for as long as they stay mounted. Grafana's
 *    Trend panel sidesteps this by staying out of cursor sync entirely; matching on the
 *    domain is the same protection, and keeps a non-uPlot panel publishing timestamps from
 *    yanking a numeric X-axis chart's cursor.
 *
 * Publishing is left untouched in both cases, so shared crosshair/tooltip with other
 * panels keeps working.
 */
export class PanelLocalEventBus implements EventBus {
  /** Events this panel published; identity is stable because the plugins reuse event objects. */
  private readonly published = new WeakSet<BusEvent>();

  constructor(
    private readonly bus: EventBus,
    private readonly domain: CursorDomain
  ) {}

  publish<T extends BusEvent>(event: T): void {
    this.published.add(event);
    this.bus.publish(event);
  }

  getStream<T extends BusEvent>(eventType: BusEventType<T>): Observable<T> {
    return this.bus.getStream(eventType).pipe(filter((event) => this.accepts(event)));
  }

  subscribe<T extends BusEvent>(eventType: BusEventType<T>, handler: BusEventHandler<T>): Unsubscribable {
    return this.getStream(eventType).subscribe({ next: handler });
  }

  removeAllListeners(): void {
    this.bus.removeAllListeners();
  }

  newScopedBus(key: string, filterOptions: EventFilterOptions): EventBus {
    return this.bus.newScopedBus(key, filterOptions);
  }

  private accepts(event: BusEvent): boolean {
    if (this.isSelfPublished(event) || isTagged(event, UPLOT_TAG)) {
      return false;
    }
    return event.type !== DataHoverEvent.type || sourceDomain(event) === this.domain;
  }

  private isSelfPublished(event: BusEvent): boolean {
    // `origin` is set by Grafana's ScopedEventBus on the first publish; the WeakSet covers
    // buses that leave it unset and events re-published by the dashboard's sync behaviour.
    return this.published.has(event) || event.origin === this.bus;
  }
}

/** `tags` is declared on BusEventBase rather than the BusEvent interface subscribers see. */
function isTagged(event: BusEvent, tag: string): boolean {
  return (event as BusEventBase).tags?.has(tag) === true;
}

/**
 * What the X value of a hover event means, read off the frame the publisher attached.
 * Senders that attach no frame (a table panel, Explore) publish timestamps by convention.
 */
function sourceDomain(event: BusEvent): CursorDomain {
  const xField = (event as DataHoverEvent).payload?.data?.fields[0];
  return xField != null && xField.type !== FieldType.time ? 'numeric' : 'time';
}
